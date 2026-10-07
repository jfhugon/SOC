import { useEffect, useState } from 'react'
import { supabase, rpc, journaliser } from '../lib/supabase'
import { FONCTIONS } from '../lib/constants'
import { dateLongue, nomComplet, telecharger } from '../lib/format'
import { EnteteEcran, Pied } from '../components/Layout'
import { Bandeau, Champ, Chargement, Modale, useAction } from '../components/UI'
import Icone from '../components/Icones'

const STATUTS = { en_attente: 'En attente', actif: 'Actif', inactif: 'Inactif', refuse: 'Refusé' }

// Registre des membres réservé au CA (US4) et modération (US7). Les comptes sont créés par l'administrateur global.
export default function Membres() {
  const [d, setD] = useState(null)

  async function charger() {
    const [profils, lots, participations] = await Promise.all([
      supabase.from('profiles').select('*').order('nom'),
      supabase.from('lots').select('*, lot_proprietaires(membre_id)').order('numero'),
      supabase.from('dossier_participants').select('membre_id, dossier_id, mandat_signe_le'),
    ])
    setD({ profils: profils.data || [], lots: lots.data || [], participations: participations.data || [] })
  }
  useEffect(() => { charger() }, [])

  if (!d) return <Chargement />

  return (
    <>
      <EnteteEcran titre="Membres." chapeau="Registre de l'association. Réservé au Conseil d'administration ; les comptes sont créés par l'administrateur global." />
      <section className="bande bande--neige" style={{ paddingTop: 32 }}>
        <div className="conteneur">
          <Registre d={d} recharger={charger} />
        </div>
      </section>
      <Pied />
    </>
  )
}

const lotsDe = (d, id) => d.lots.filter((l) => l.lot_proprietaires.some((x) => x.membre_id === id))

function Registre({ d, recharger }) {
  const [q, setQ] = useState('')
  const [fiche, setFiche] = useState(null)
  const liste = d.profils.filter((p) => !p.est_avocat && `${p.prenom} ${p.nom} ${p.identifiant || ''} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase()))

  function exporter() {
    const cellule = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lignes = [['Nom', 'Prénom', 'Identifiant', 'E-mail', 'Téléphone', 'Statut', 'Fonction', 'CA', 'Lots', 'Dossiers', 'Mandats signés', 'Conflit d\'intérêts']]
    for (const p of liste) {
      const parts = d.participations.filter((x) => x.membre_id === p.id)
      lignes.push([p.nom, p.prenom, p.identifiant, p.email, p.telephone, STATUTS[p.statut], FONCTIONS[p.fonction] || '', p.est_ca ? 'oui' : '',
        lotsDe(d, p.id).map((l) => `${l.numero}/${l.appartement}${l.societe ? ` (${l.societe})` : ''}`).join(' '), parts.length, parts.filter((x) => x.mandat_signe_le).length, p.conflit_interet ? 'oui' : ''])
    }
    telecharger(new Blob(['﻿' + lignes.map((r) => r.map(cellule).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), `registre-membres-${new Date().toISOString().slice(0, 10)}.csv`)
    journaliser('export', 'registre', null, { lignes: liste.length })
  }

  return (
    <div className="pile pile--large">
      <div className="ligne">
        <input className="saisie" style={{ maxWidth: 420 }} type="search" placeholder="Rechercher" aria-label="Rechercher dans le registre" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn--tertiaire" onClick={exporter}><Icone nom="telecharger" taille={18} />Exporter le registre</button>
      </div>
      <div className="tableau">
        <table>
          <thead><tr><th>Membre</th><th>Lots</th><th>Statut</th><th>Rôle</th><th>Dossiers · mandats</th><th>Signalements</th></tr></thead>
          <tbody>
            {liste.map((p) => {
              const parts = d.participations.filter((x) => x.membre_id === p.id)
              const suspendu = p.suspendu_jusqu_a && new Date(p.suspendu_jusqu_a) > new Date()
              return (
                <tr key={p.id} className="cliquable" tabIndex={0} onClick={() => setFiche(p)} onKeyDown={(e) => e.key === 'Enter' && setFiche(p)}>
                  <td><strong>{nomComplet(p)}</strong><br /><span className="secondaire">{[p.identifiant, p.email].filter(Boolean).join(' · ')}</span></td>
                  <td>{lotsDe(d, p.id).map((l) => `${l.numero} · ${l.appartement}${l.societe ? ` (${l.societe})` : ''}`).join(', ') || '—'}</td>
                  <td>{STATUTS[p.statut]}</td>
                  <td>{FONCTIONS[p.fonction] || (p.est_ca ? 'Administrateur' : 'Membre')}</td>
                  <td>{parts.length} · {parts.filter((x) => x.mandat_signe_le).length}</td>
                  <td>{p.conflit_interet && <span className="etiquette">Conflit d'intérêts</span>}{suspendu && <span className="etiquette"> Suspendu</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {fiche && <FicheMembre p={fiche} onFermer={() => setFiche(null)} recharger={recharger} />}
    </div>
  )
}

function FicheMembre({ p, onFermer, recharger }) {
  const [executer, enCours] = useAction()
  const [conflit, setConflit] = useState({ c: p.conflit_interet, note: p.conflit_note || '', acces: p.acces_dossiers })
  const [suspension, setSuspension] = useState({ jusqu: '', motif: '' })
  const suspendu = p.suspendu_jusqu_a && new Date(p.suspendu_jusqu_a) > new Date()

  return (
    <Modale titre={nomComplet(p)} sousTitre={[p.identifiant, p.email].filter(Boolean).join(' · ')} onFermer={onFermer}>
      <section className="bloc formulaire">
        <h3 className="intertitre">Conflit d'intérêts</h3>
        <p className="petit secondaire">Copropriétaire lié au gestionnaire (salarié, mandataire) : le CA peut lui retirer l'accès aux dossiers.</p>
        <label className="case"><input type="checkbox" checked={conflit.c} onChange={(e) => setConflit({ ...conflit, c: e.target.checked })} />Signaler un conflit d'intérêts</label>
        <Champ libelle="Note" id="note"><input id="note" className="saisie" value={conflit.note} onChange={(e) => setConflit({ ...conflit, note: e.target.value })} /></Champ>
        <label className="case"><input type="checkbox" checked={!conflit.acces} onChange={(e) => setConflit({ ...conflit, acces: !e.target.checked })} />Retirer l'accès aux dossiers juridiques</label>
        <button className="btn btn--secondaire" style={{ alignSelf: 'flex-start' }} disabled={enCours}
          onClick={() => executer(async () => { await rpc('signaler_conflit', { p_membre: p.id, p_conflit: conflit.c, p_note: conflit.note || null, p_acces_dossiers: conflit.acces }); await recharger(); onFermer() }, 'Enregistré et journalisé.')}>Enregistrer</button>
      </section>
      <section className="bloc formulaire">
        <h3 className="intertitre">Suspension temporaire</h3>
        {suspendu && <Bandeau type="alerte">Suspendu jusqu'au {dateLongue(p.suspendu_jusqu_a)}.</Bandeau>}
        {!suspendu && <Champ libelle="Jusqu'au" id="jusqu"><input id="jusqu" type="date" className="saisie" min={new Date().toISOString().slice(0, 10)} value={suspension.jusqu} onChange={(e) => setSuspension({ ...suspension, jusqu: e.target.value })} /></Champ>}
        <Champ libelle="Motif (obligatoire, journalisé)" id="motif-s"><input id="motif-s" className="saisie" value={suspension.motif} onChange={(e) => setSuspension({ ...suspension, motif: e.target.value })} /></Champ>
        <button className="btn btn--alerte" style={{ alignSelf: 'flex-start' }} disabled={enCours || !suspension.motif.trim() || (!suspendu && !suspension.jusqu)}
          onClick={() => executer(async () => {
            await rpc('suspendre_membre', { p_membre: p.id, p_jusqu_a: suspendu ? null : new Date(suspension.jusqu + 'T23:59:59').toISOString(), p_motif: suspension.motif })
            await recharger(); onFermer()
          }, suspendu ? 'Suspension levée.' : 'Membre suspendu.')}>{suspendu ? 'Lever la suspension' : 'Suspendre'}</button>
      </section>
    </Modale>
  )
}
