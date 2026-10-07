import { useEffect, useMemo, useState } from 'react'
import { useMessagerie } from '../lib/messagerie'
import { supabase } from '../lib/supabase'
import { TYPES_PIECE } from '../lib/constants'
import { dateLongue, nomComplet, taille } from '../lib/format'
import { EnteteEcran, Pied } from '../components/Layout'
import StatutPiece from '../components/Statut'
import { Champ, Chargement, Segment, Vide } from '../components/UI'
import FichePiece from '../components/FichePiece'

// Coffre : toutes les pièces, filtres par membre, type et statut, vérification (CA)
export default function Coffre() {
  const { parId, annuaire } = useMessagerie()
  const [pieces, setPieces] = useState(null)
  const [lots, setLots] = useState([])
  const [f, setF] = useState({ statut: 'deposee', membre: '', type: '', anciennes: false, q: '' })
  const [fiche, setFiche] = useState(null)

  async function charger() {
    const [p, l] = await Promise.all([
      supabase.from('pieces').select('*').order('created_at', { ascending: false }).limit(2000),
      supabase.from('lots').select('id, numero, appartement'),
    ])
    setPieces(p.data || []); setLots(l.data || [])
  }
  useEffect(() => { charger() }, [])

  const filtrees = useMemo(() => (pieces || []).filter((p) => {
    if (!f.anciennes && p.remplacee) return false
    if (f.statut !== 'tous' && p.statut !== f.statut) return false
    if (f.membre && p.membre_id !== f.membre) return false
    if (f.type && p.type_piece !== f.type) return false
    if (f.q) {
      const q = f.q.toLowerCase()
      if (![p.nom_fichier, p.description, nomComplet(parId[p.membre_id]), p.sha256].some((x) => (x || '').toLowerCase().includes(q))) return false
    }
    return true
  }), [pieces, f, parId])

  const compte = (s) => (pieces || []).filter((p) => !p.remplacee && (s === 'tous' || p.statut === s)).length
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <>
      <EnteteEcran titre="Coffre." chapeau="Pièces des bailleurs, vérifiées avant toute remise à l'avocat. Personne ne vérifie sa propre pièce." />
      <section className="bande bande--neige" style={{ paddingTop: 32 }}>
        <div className="conteneur pile pile--large">
          <Segment etiquette="Statut" defilant valeur={f.statut} onChange={(statut) => setF({ ...f, statut })}
            options={[['deposee', `À vérifier (${compte('deposee')})`], ['a_completer', `À compléter (${compte('a_completer')})`], ['verifiee', `Vérifiées (${compte('verifiee')})`], ['rejetee', `Rejetées (${compte('rejetee')})`], ['tous', 'Toutes']]} />
          <div className="filtres">
            <Champ libelle="Membre" id="f-membre">
              <select id="f-membre" className="saisie" value={f.membre} onChange={maj('membre')}>
                <option value="">Tous les membres</option>
                {annuaire.filter((p) => !p.est_avocat).map((p) => <option key={p.id} value={p.id}>{nomComplet(p)}{p.appartements ? ` · ${p.appartements}` : ''}</option>)}
              </select>
            </Champ>
            <Champ libelle="Type" id="f-type">
              <select id="f-type" className="saisie" value={f.type} onChange={maj('type')}>
                <option value="">Tous les types</option>
                {Object.entries(TYPES_PIECE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Champ>
            <Champ libelle="Recherche" id="f-q">
              <input id="f-q" className="saisie" type="search" placeholder="Nom, fichier, empreinte" value={f.q} onChange={maj('q')} />
            </Champ>
          </div>
          <label className="case" style={{ alignSelf: 'flex-start' }}>
            <input type="checkbox" checked={f.anciennes} onChange={(e) => setF({ ...f, anciennes: e.target.checked })} />Afficher les versions remplacées
          </label>

          {pieces === null ? <Chargement /> : filtrees.length === 0 ? (
            <div className="carte"><Vide icone="coffre" titre="Aucune pièce pour ces filtres." /></div>
          ) : (
            <div className="tableau">
              <table>
                <thead><tr><th>Membre</th><th>Pièce</th><th>Date du document</th><th>Déposée le</th><th>Statut</th></tr></thead>
                <tbody>
                  {filtrees.map((p) => {
                    const lot = lots.find((l) => l.id === p.lot_id)
                    return (
                      <tr key={p.id} className="cliquable" onClick={() => setFiche(p)} onKeyDown={(e) => e.key === 'Enter' && setFiche(p)} tabIndex={0}>
                        <td><strong>{nomComplet(parId[p.membre_id])}</strong><br /><span className="secondaire">{lot ? `Lot ${lot.numero} · appt ${lot.appartement}` : parId[p.membre_id]?.appartements}</span></td>
                        <td>{TYPES_PIECE[p.type_piece]}{p.version > 1 ? ` · v${p.version}` : ''}<br /><span className="secondaire">{p.nom_fichier} · {taille(p.taille)}</span></td>
                        <td>{p.date_document ? dateLongue(p.date_document) : '—'}</td>
                        <td>{dateLongue(p.created_at)}</td>
                        <td><StatutPiece statut={p.statut} />{p.remise_a_avocat && <><br /><span className="secondaire petit">Remise à l'avocat</span></>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <Pied />
      {fiche && <FichePiece piece={fiche} onFermer={() => setFiche(null)} onChange={charger} />}
    </>
  )
}
