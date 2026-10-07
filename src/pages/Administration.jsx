import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, rpc, verifier, gererCompte, motDePasseProvisoire } from '../lib/supabase'
import { FONCTIONS } from '../lib/constants'
import { dateHeure, enumerer, nomComplet } from '../lib/format'
import { EnteteEcran, Pied } from '../components/Layout'
import { Bandeau, Champ, Chargement, Modale, Segment, useAction } from '../components/UI'
import Icone from '../components/Icones'

const STATUTS = { en_attente: 'En attente', actif: 'Actif', inactif: 'Inactif', refuse: 'Refusé' }

// Administration : comptes, paramètres, journal d'audit (administrateur global)
export default function Administration() {
  const [vue, setVue] = useState('comptes')
  return (
    <>
      <EnteteEcran titre="Administration." chapeau="Création des comptes membres, lots et propriétaires, rôles, paramètres et journal d'audit. Les pièces ne sont jamais supprimées définitivement." />
      <div className="conteneur" style={{ marginBottom: 24 }}>
        <Segment etiquette="Sections" defilant valeur={vue} onChange={setVue} options={[['comptes', 'Comptes'], ['lots', 'Lots'], ['parametres', 'Paramètres'], ['journal', 'Journal d\'audit']]} />
      </div>
      <section className="bande bande--neige" style={{ paddingTop: 32 }}>
        <div className="conteneur">
          {vue === 'comptes' && <Comptes />}
          {vue === 'lots' && <Lots />}
          {vue === 'parametres' && <Parametres />}
          {vue === 'journal' && <Journal />}
        </div>
      </section>
      <Pied />
    </>
  )
}

function Comptes() {
  const [profils, setProfils] = useState(null)
  const [edition, setEdition] = useState(null)
  const [creation, setCreation] = useState(false)
  const [q, setQ] = useState('')
  const charger = () => supabase.from('profiles').select('*').order('nom').then(({ data }) => setProfils(data || []))
  useEffect(() => { charger() }, [])
  if (!profils) return <Chargement />
  const liste = profils.filter((p) => `${p.prenom} ${p.nom} ${p.identifiant || ''} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="pile pile--large">
      <div className="ligne">
        <input className="saisie" style={{ maxWidth: 420 }} type="search" placeholder="Rechercher un compte" aria-label="Rechercher un compte" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn--secondaire" onClick={() => setCreation(true)}><Icone nom="plus" taille={18} />Nouveau compte</button>
      </div>
      <div className="tableau">
        <table>
          <thead><tr><th>Compte</th><th>Identifiant</th><th>Statut</th><th>Rôles</th><th>Créé le</th></tr></thead>
          <tbody>
            {liste.map((p) => (
              <tr key={p.id} className="cliquable" tabIndex={0} onClick={() => setEdition(p)} onKeyDown={(e) => e.key === 'Enter' && setEdition(p)}>
                <td><strong>{nomComplet(p)}</strong><br /><span className="secondaire">{p.email || '—'}</span></td>
                <td className="mono">{p.identifiant || <span className="secondaire">par e-mail</span>}</td>
                <td>{STATUTS[p.statut]}{p.mdp_provisoire && <><br /><span className="petit secondaire">Mot de passe provisoire</span></>}</td>
                <td>{[p.est_avocat && 'Avocat', FONCTIONS[p.fonction], p.est_ca && !p.fonction && 'Administrateur', p.est_admin_tech && 'Administrateur global'].filter(Boolean).join(' · ') || 'Membre'}</td>
                <td>{dateHeure(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edition && <EditionRoles p={edition} onFermer={() => setEdition(null)} onFait={charger} />}
      {creation && <CreationCompte onFermer={() => setCreation(false)} onFait={charger} />}
    </div>
  )
}

function EditionRoles({ p, onFermer, onFait }) {
  const [executer, enCours] = useAction()
  const [f, setF] = useState({ statut: p.statut, est_ca: p.est_ca, fonction: p.fonction || '', est_avocat: p.est_avocat, est_admin_tech: p.est_admin_tech })
  async function enregistrer() {
    const ok = await executer(() => rpc('definir_roles', {
      p_membre: p.id, p_statut: f.statut, p_est_ca: f.est_ca, p_fonction: f.fonction || null, p_est_avocat: f.est_avocat, p_est_admin_tech: f.est_admin_tech,
    }), 'Rôles enregistrés et journalisés.')
    if (ok !== undefined) { onFait(); onFermer() }
  }
  return (
    <Modale titre={nomComplet(p)} sousTitre={[p.identifiant, p.email].filter(Boolean).join(' · ')} onFermer={onFermer}
      pied={<><button className="btn btn--tertiaire" onClick={onFermer}>Annuler</button><button className="btn btn--secondaire" disabled={enCours} onClick={enregistrer}>Enregistrer</button></>}>
      <Champ libelle="Statut" id="statut">
        <select id="statut" className="saisie" value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value })}>
          {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Champ>
      <label className="case"><input type="checkbox" checked={f.est_ca || !!f.fonction} disabled={!!f.fonction} onChange={(e) => setF({ ...f, est_ca: e.target.checked })} />Membre du Conseil d'administration</label>
      <Champ libelle="Fonction au bureau" id="fonction" aide="Une même personne ne cumule pas deux fonctions (art. 10).">
        <select id="fonction" className="saisie" value={f.fonction} onChange={(e) => setF({ ...f, fonction: e.target.value })}>
          <option value="">Aucune</option>
          {Object.entries(FONCTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Champ>
      <label className="case"><input type="checkbox" checked={f.est_avocat} onChange={(e) => setF({ ...f, est_avocat: e.target.checked })} />Avocat de l'association (utilisateur extérieur)</label>
      <label className="case"><input type="checkbox" checked={f.est_admin_tech} onChange={(e) => setF({ ...f, est_admin_tech: e.target.checked })} />Administrateur global (gestion des comptes)</label>
      <p className="petit secondaire">Le CA, l'avocat et l'administrateur global devront activer la double authentification à leur prochaine connexion.</p>
      {p.identifiant && <Reinitialisation p={p} onFait={onFait} />}
    </Modale>
  )
}

function Reinitialisation({ p, onFait }) {
  const [executer, enCours] = useAction()
  const [mdp, setMdp] = useState(null)
  async function reinitialiser() {
    const nouveau = motDePasseProvisoire()
    const ok = await executer(() => gererCompte({ action: 'reinitialiser', membre: p.id, mot_de_passe: nouveau }), 'Mot de passe réinitialisé et journalisé.')
    if (ok !== undefined) { setMdp(nouveau); onFait() }
  }
  return (
    <section className="bloc formulaire">
      <h3 className="intertitre">Mot de passe</h3>
      {mdp ? (
        <>
          <p className="petit secondaire">Nouveau mot de passe provisoire pour <span className="mono">{p.identifiant}</span>, à transmettre au membre. Il ne sera plus affiché.</p>
          <p className="titre-carte mono" style={{ fontSize: 24 }}>{mdp}</p>
        </>
      ) : (
        <>
          <p className="petit secondaire">Génère un mot de passe provisoire ; le membre devra le changer à sa prochaine connexion.</p>
          <button type="button" className="btn btn--alerte" style={{ alignSelf: 'flex-start' }} disabled={enCours} onClick={reinitialiser}>Réinitialiser le mot de passe</button>
        </>
      )}
    </section>
  )
}

// Création d'un compte membre : identifiant et mot de passe provisoire, sans justificatif
function CreationCompte({ onFermer, onFait }) {
  const [executer, enCours] = useAction()
  const [f, setF] = useState({ prenom: '', nom: '', identifiant: '', email: '', telephone: '', mdp: motDePasseProvisoire() })
  const [lots, setLots] = useState([{ numero: '', appartement: '', societe: '' }])
  const [cree, setCree] = useState(null)
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value })

  // identifiant proposé à partir du prénom et du nom, modifiable
  function proposer(prenom, nom) {
    const brut = `${prenom.trim().charAt(0)}${nom.trim()}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return brut.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 32)
  }
  const majNom = (k) => (e) => {
    const g = { ...f, [k]: e.target.value }
    if (!f.identifiant || f.identifiant === proposer(f.prenom, f.nom)) g.identifiant = proposer(g.prenom, g.nom)
    setF(g)
  }

  async function creer(e) {
    e.preventDefault()
    const r = await executer(() => gererCompte({
      action: 'creer', identifiant: f.identifiant, mot_de_passe: f.mdp, prenom: f.prenom, nom: f.nom,
      email: f.email, telephone: f.telephone, lots,
    }), 'Compte créé.')
    if (r !== undefined) { setCree({ identifiant: r.identifiant, mdp: f.mdp, nom: `${f.prenom} ${f.nom}` }); onFait() }
  }

  if (cree) {
    return (
      <Modale titre="Compte créé." sousTitre={cree.nom} onFermer={onFermer}
        pied={<button className="btn btn--secondaire" onClick={onFermer}>Terminé</button>}>
        <Bandeau type="info">Transmettez ces accès au membre par un canal sûr. Le mot de passe ne sera plus affiché ; il devra le changer à sa première connexion.</Bandeau>
        <dl className="meta-liste">
          <dt>Identifiant</dt><dd className="mono">{cree.identifiant}</dd>
          <dt>Mot de passe provisoire</dt><dd className="mono">{cree.mdp}</dd>
        </dl>
      </Modale>
    )
  }

  return (
    <Modale titre="Nouveau compte." sousTitre="Le membre pourra se connecter immédiatement." onFermer={onFermer} large
      pied={<><button className="btn btn--tertiaire" onClick={onFermer}>Annuler</button><button className="btn btn--secondaire" form="creation-compte" disabled={enCours || !f.prenom.trim() || !f.nom.trim() || !f.identifiant || f.mdp.length < 8}>{enCours ? 'Création…' : 'Créer le compte'}</button></>}>
      <form id="creation-compte" className="formulaire" onSubmit={creer} noValidate>
        <div className="formulaire__ligne">
          <Champ libelle="Prénom" id="c-prenom"><input id="c-prenom" className="saisie" value={f.prenom} onChange={majNom('prenom')} /></Champ>
          <Champ libelle="Nom" id="c-nom"><input id="c-nom" className="saisie" value={f.nom} onChange={majNom('nom')} /></Champ>
        </div>
        <div className="formulaire__ligne">
          <Champ libelle="Identifiant" id="c-identifiant" aide="Minuscules, chiffres, point ou tiret ; 3 caractères au moins.">
            <input id="c-identifiant" className="saisie mono" autoCapitalize="none" spellCheck={false} value={f.identifiant}
              onChange={(e) => setF({ ...f, identifiant: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} />
          </Champ>
          <Champ libelle="Mot de passe provisoire" id="c-mdp" aide="À changer par le membre à sa première connexion.">
            <div className="ligne" style={{ flexWrap: 'nowrap' }}>
              <input id="c-mdp" className="saisie mono" value={f.mdp} onChange={maj('mdp')} />
              <button type="button" className="btn btn--tertiaire" onClick={() => setF({ ...f, mdp: motDePasseProvisoire() })}>Générer</button>
            </div>
          </Champ>
        </div>
        <div className="formulaire__ligne">
          <Champ libelle="E-mail (facultatif)" id="c-email"><input id="c-email" type="email" className="saisie" value={f.email} onChange={maj('email')} /></Champ>
          <Champ libelle="Téléphone (facultatif)" id="c-tel"><input id="c-tel" type="tel" className="saisie" value={f.telephone} onChange={maj('telephone')} /></Champ>
        </div>
        <h3 className="intertitre">Lots et appartements</h3>
        <p className="petit secondaire">Facultatif. Si le lot existe déjà, ce membre en devient copropriétaire. Indiquez la société quand le lot est détenu par une personne morale.</p>
        {lots.map((l, i) => (
          <div key={i} className="ligne" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <Champ libelle="N° de lot" id={`c-lot${i}`}><input id={`c-lot${i}`} className="saisie" value={l.numero} onChange={(e) => setLots(lots.map((x, j) => j === i ? { ...x, numero: e.target.value } : x))} /></Champ>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <Champ libelle="Appartement" id={`c-app${i}`}><input id={`c-app${i}`} className="saisie" value={l.appartement} onChange={(e) => setLots(lots.map((x, j) => j === i ? { ...x, appartement: e.target.value } : x))} /></Champ>
            </div>
            <div style={{ flex: 2, minWidth: 180 }}>
              <Champ libelle="Société (facultatif)" id={`c-soc${i}`}><input id={`c-soc${i}`} className="saisie" value={l.societe} onChange={(e) => setLots(lots.map((x, j) => j === i ? { ...x, societe: e.target.value } : x))} /></Champ>
            </div>
            {lots.length > 1 && (
              <button type="button" className="btn btn--tertiaire btn--icone" aria-label="Retirer ce lot" onClick={() => setLots(lots.filter((_, j) => j !== i))}><Icone nom="fermer" taille={18} /></button>
            )}
          </div>
        ))}
        <button type="button" className="btn btn--tertiaire" style={{ alignSelf: 'flex-start' }} onClick={() => setLots([...lots, { numero: '', appartement: '', societe: '' }])}>
          <Icone nom="plus" taille={18} />Ajouter un lot
        </button>
      </form>
    </Modale>
  )
}

// Lots : appartement, société détentrice et propriétaires (comptes membres ou personnes sans compte)
function Lots() {
  const [lots, setLots] = useState(null)
  const [profils, setProfils] = useState([])
  const [edition, setEdition] = useState(null)
  const [q, setQ] = useState('')
  const charger = () => supabase.from('lots').select('*, lot_proprietaires(id, membre_id, nom, created_at)').order('numero')
    .then(({ data }) => setLots(data || []))
  useEffect(() => {
    charger()
    supabase.from('profiles').select('id, prenom, nom, identifiant, est_avocat').order('nom').then(({ data }) => setProfils((data || []).filter((p) => !p.est_avocat)))
  }, [])
  if (!lots) return <Chargement />
  const parId = Object.fromEntries(profils.map((p) => [p.id, p]))
  const noms = (l) => [...l.lot_proprietaires].sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((x) => (x.membre_id ? nomComplet(parId[x.membre_id]) : x.nom))
  const liste = lots.filter((l) => `${l.numero} ${l.appartement} ${l.societe || ''} ${noms(l).join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  const ouvert = edition?.id ? lots.find((l) => l.id === edition.id) : edition
  return (
    <div className="pile pile--large">
      <div className="ligne">
        <input className="saisie" style={{ maxWidth: 420 }} type="search" placeholder="Lot, appartement, société ou propriétaire" aria-label="Rechercher un lot" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn--secondaire" onClick={() => setEdition({})}><Icone nom="plus" taille={18} />Nouveau lot</button>
      </div>
      <div className="tableau">
        <table>
          <thead><tr><th>Lot</th><th>Appartement</th><th>Société</th><th>Propriétaires</th></tr></thead>
          <tbody>
            {liste.map((l) => (
              <tr key={l.id} className="cliquable" tabIndex={0} onClick={() => setEdition(l)} onKeyDown={(e) => e.key === 'Enter' && setEdition(l)}>
                <td className="mono">{l.numero}</td>
                <td>{l.appartement}</td>
                <td>{l.societe || <span className="secondaire">—</span>}</td>
                <td>{enumerer(noms(l)) || <span className="secondaire">Aucun</span>}</td>
              </tr>
            ))}
            {!liste.length && <tr><td colSpan={4} className="secondaire">Aucun lot.</td></tr>}
          </tbody>
        </table>
      </div>
      {ouvert && <EditionLot lot={ouvert} profils={profils} parId={parId} onFermer={() => setEdition(null)} onFait={(l) => { charger(); if (l) setEdition(l) }} />}
    </div>
  )
}

function EditionLot({ lot, profils, parId, onFermer, onFait }) {
  const [executer, enCours] = useAction()
  const [f, setF] = useState({ numero: lot.numero || '', appartement: lot.appartement || '', societe: lot.societe || '' })
  const [ajout, setAjout] = useState({ membre_id: '', nom: '' })
  const proprietaires = [...(lot.lot_proprietaires || [])].sort((a, b) => a.created_at.localeCompare(b.created_at))
  const dejaLa = new Set(proprietaires.map((x) => x.membre_id))
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function enregistrer(e) {
    e.preventDefault()
    const valeurs = { numero: f.numero.trim(), appartement: f.appartement.trim(), societe: f.societe.trim() || null }
    await executer(async () => {
      if (!valeurs.numero || !valeurs.appartement) throw new Error('Indiquez le numéro de lot et l\'appartement.')
      const l = lot.id
        ? verifier(await supabase.from('lots').update(valeurs).eq('id', lot.id).select().single())
        : verifier(await supabase.from('lots').insert(valeurs).select().single())
      onFait(lot.id ? null : { ...l, lot_proprietaires: [] })
    }, 'Lot enregistré.')
  }

  async function ajouter() {
    const ligne = ajout.membre_id ? { lot_id: lot.id, membre_id: ajout.membre_id } : { lot_id: lot.id, nom: ajout.nom.trim() }
    await executer(async () => {
      verifier(await supabase.from('lot_proprietaires').insert(ligne))
      setAjout({ membre_id: '', nom: '' })
      onFait()
    }, 'Propriétaire ajouté.')
  }

  async function retirer(x) {
    await executer(async () => {
      verifier(await supabase.from('lot_proprietaires').delete().eq('id', x.id))
      onFait()
    }, 'Propriétaire retiré.')
  }

  return (
    <Modale titre={lot.id ? `Lot ${lot.numero}.` : 'Nouveau lot.'} sousTitre={lot.id ? `Appartement ${lot.appartement}` : 'Ajoutez ensuite le ou les propriétaires.'} onFermer={onFermer} large
      pied={<><button className="btn btn--tertiaire" onClick={onFermer}>Fermer</button><button className="btn btn--secondaire" form="edition-lot" disabled={enCours}>Enregistrer</button></>}>
      <form id="edition-lot" className="formulaire" onSubmit={enregistrer} noValidate>
        <div className="formulaire__ligne">
          <Champ libelle="N° de lot" id="l-numero"><input id="l-numero" className="saisie" value={f.numero} onChange={maj('numero')} /></Champ>
          <Champ libelle="Appartement" id="l-app"><input id="l-app" className="saisie" value={f.appartement} onChange={maj('appartement')} /></Champ>
        </div>
        <Champ libelle="Société détentrice (facultatif)" id="l-soc" aide="Si l'appartement est détenu via une société, son nom ; les personnes ci-dessous en sont les propriétaires.">
          <input id="l-soc" className="saisie" value={f.societe} onChange={maj('societe')} />
        </Champ>
      </form>
      {lot.id && (
        <section className="bloc formulaire">
          <h3 className="intertitre">Propriétaires</h3>
          {proprietaires.length === 0 && <p className="petit secondaire">Aucun propriétaire rattaché.</p>}
          {proprietaires.map((x) => (
            <div key={x.id} className="ligne ligne--entre">
              <span>{x.membre_id ? nomComplet(parId[x.membre_id]) : x.nom}<span className="petit secondaire">{x.membre_id ? ` · compte ${parId[x.membre_id]?.identifiant || 'membre'}` : ' · sans compte'}</span></span>
              <button type="button" className="btn btn--tertiaire btn--icone" aria-label="Retirer ce propriétaire" disabled={enCours} onClick={() => retirer(x)}><Icone nom="fermer" taille={18} /></button>
            </div>
          ))}
          <div className="formulaire__ligne" style={{ alignItems: 'flex-end' }}>
            <Champ libelle="Compte membre" id="l-membre">
              <select id="l-membre" className="saisie" value={ajout.membre_id} onChange={(e) => setAjout({ membre_id: e.target.value, nom: '' })}>
                <option value="">Personne sans compte…</option>
                {profils.filter((p) => !dejaLa.has(p.id)).map((p) => <option key={p.id} value={p.id}>{nomComplet(p)}{p.identifiant ? ` (${p.identifiant})` : ''}</option>)}
              </select>
            </Champ>
            {!ajout.membre_id && (
              <Champ libelle="Nom et prénom" id="l-nom"><input id="l-nom" className="saisie" value={ajout.nom} onChange={(e) => setAjout({ membre_id: '', nom: e.target.value })} /></Champ>
            )}
          </div>
          <button type="button" className="btn btn--tertiaire" style={{ alignSelf: 'flex-start' }} disabled={enCours || (!ajout.membre_id && !ajout.nom.trim())} onClick={ajouter}>
            <Icone nom="plus" taille={18} />Ajouter le propriétaire
          </button>
        </section>
      )}
    </Modale>
  )
}

function Parametres() {
  const { rafraichir } = useAuth()
  const [p, setP] = useState(null)
  const [executer, enCours] = useAction()
  useEffect(() => { supabase.from('parametres').select('*').single().then(({ data }) => setP(data)) }, [])
  if (!p) return <Chargement />
  const maj = (k, num) => (e) => setP({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : num ? Number(e.target.value) : e.target.value })
  async function enregistrer(e) {
    e.preventDefault()
    await executer(async () => {
      verifier(await supabase.from('parametres').update({
        vp_suppleance: p.vp_suppleance, cotisation_montant: p.cotisation_montant,
        conservation_messages_annees: p.conservation_messages_annees, conservation_pieces_annees: p.conservation_pieces_annees, updated_at: new Date().toISOString(),
      }).eq('id', 1))
      await rafraichir()
    }, 'Paramètres enregistrés.')
  }
  return (
    <form className="carte formulaire" style={{ maxWidth: 720 }} onSubmit={enregistrer}>
      <label className="case"><input type="checkbox" checked={p.vp_suppleance} onChange={maj('vp_suppleance')} />
        <span>Suppléance du Vice-Président activée<br /><span className="petit secondaire">Le VP exerce les droits du Président empêché, sans formalité (art. 10).</span></span></label>
      <Champ libelle="Cotisation annuelle (€)" id="cot" aide="Fixée par l'AG (50 € en 2025)."><input id="cot" type="number" min="0" step="1" className="saisie" value={p.cotisation_montant} onChange={maj('cotisation_montant', true)} /></Champ>
      <div className="formulaire__ligne">
        <Champ libelle="Conservation des messages (années)" id="cm"><input id="cm" type="number" min="1" className="saisie" value={p.conservation_messages_annees} onChange={maj('conservation_messages_annees', true)} /></Champ>
        <Champ libelle="Conservation des pièces après procédure (années)" id="cp"><input id="cp" type="number" min="1" className="saisie" value={p.conservation_pieces_annees} onChange={maj('conservation_pieces_annees', true)} /></Champ>
      </div>
      <button className="btn btn--secondaire" style={{ alignSelf: 'flex-start' }} disabled={enCours}>Enregistrer</button>
    </form>
  )
}

const ACTIONS = {
  connexion: 'Connexion', deconnexion: 'Déconnexion', depot_piece: 'Dépôt de pièce', verification_piece: 'Vérification de pièce',
  telechargement: 'Téléchargement', export: 'Export', remise_avocat: 'Remise à l\'avocat', moderation: 'Modération',
  ouverture_dossier: 'Ouverture de dossier', decision_adhesion: 'Décision d\'adhésion', roles: 'Rôles', conflit_interet: 'Conflit d\'intérêts',
  creation_compte: 'Création de compte', lot: 'Lot', reinitialisation_mdp: 'Réinitialisation du mot de passe',
}

function Journal() {
  const [lignes, setLignes] = useState(null)
  const [noms, setNoms] = useState({})
  const [action, setAction] = useState('')
  useEffect(() => {
    let req = supabase.from('journal_audit').select('*').order('created_at', { ascending: false }).limit(300)
    if (action) req = req.eq('action', action)
    req.then(({ data }) => setLignes(data || []))
  }, [action])
  useEffect(() => { supabase.from('profiles').select('id, prenom, nom, email').then(({ data }) => setNoms(Object.fromEntries((data || []).map((p) => [p.id, p])))) }, [])
  return (
    <div className="pile pile--large">
      <Champ libelle="Action" id="action">
        <select id="action" className="saisie" style={{ maxWidth: 360 }} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Toutes</option>
          {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Champ>
      {!lignes ? <Chargement /> : (
        <div className="tableau">
          <table>
            <thead><tr><th>Date</th><th>Acteur</th><th>Action</th><th>Détails</th></tr></thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dateHeure(l.created_at)}</td>
                  <td>{l.acteur_id ? nomComplet(noms[l.acteur_id]) : 'Système'}</td>
                  <td>{ACTIONS[l.action] || l.action}</td>
                  <td className="mono" style={{ fontSize: 14 }}>{[l.entite, l.entite_id && l.entite_id.slice(0, 8)].filter(Boolean).join(' ')} {Object.keys(l.details || {}).length ? JSON.stringify(l.details) : ''}</td>
                </tr>
              ))}
              {!lignes.length && <tr><td colSpan={4} className="secondaire">Aucune entrée.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
