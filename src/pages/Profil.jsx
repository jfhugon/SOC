import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLangue } from '../lib/i18n'
import { demanderNotifications } from '../lib/messagerie'
import { supabase, verifier, journaliser, messageErreur } from '../lib/supabase'
import { telecharger } from '../lib/format'
import { EnteteEcran, Pied } from '../components/Layout'
import { Champ, Segment, useAction } from '../components/UI'
import Icone from '../components/Icones'

export default function Profil() {
  const { profil, utilisateur, rafraichir, deconnexion, roles } = useAuth()
  const { langue, changerLangue } = useLangue()
  const [executer, enCours] = useAction()
  const [f, setF] = useState({
    prenom: profil.prenom, nom: profil.nom, telephone: profil.telephone || '', adresse: profil.adresse || '', pays: profil.pays || '',
    afficher_telephone: profil.afficher_telephone, afficher_email: profil.afficher_email,
  })
  const [mdp, setMdp] = useState('')
  const [facteurs, setFacteurs] = useState([])
  const [notif, setNotif] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'indisponible')
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  useEffect(() => { supabase.auth.mfa.listFactors().then(({ data }) => setFacteurs(data?.totp || [])) }, [])

  async function enregistrer(e) {
    e.preventDefault()
    await executer(async () => {
      verifier(await supabase.from('profiles').update({
        prenom: f.prenom.trim(), nom: f.nom.trim(), telephone: f.telephone.trim() || null, adresse: f.adresse.trim() || null, pays: f.pays.trim() || null,
        afficher_telephone: f.afficher_telephone, afficher_email: f.afficher_email,
      }).eq('id', utilisateur.id))
      await rafraichir()
    }, 'Profil enregistré.')
  }

  async function changerMdp(e) {
    e.preventDefault()
    await executer(async () => {
      if (mdp.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
      const { error } = await supabase.auth.updateUser({ password: mdp })
      if (error) throw new Error(messageErreur(error))
      setMdp('')
    }, 'Mot de passe modifié.')
  }

  // §6 Droits : export de ses données et de la liste de ses pièces
  async function exporter() {
    await executer(async () => {
      const [lots, pieces, demandes, messages, participations] = await Promise.all([
        supabase.rpc('mes_lots'),
        supabase.from('pieces').select('*').eq('membre_id', utilisateur.id),
        supabase.from('demandes_adhesion').select('*').eq('membre_id', utilisateur.id),
        supabase.from('messages').select('id, conversation_id, contenu, piece_jointe, created_at, modifie_le').eq('auteur_id', utilisateur.id).order('created_at'),
        supabase.from('dossier_participants').select('*').eq('membre_id', utilisateur.id),
      ])
      const donnees = {
        exporte_le: new Date().toISOString(), association: 'Spirit Of Centaure', profil,
        lots: lots.data, demande_adhesion: demandes.data, participations: participations.data, pieces: pieces.data, messages: messages.data,
      }
      telecharger(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }), `mes-donnees-centaure-${new Date().toISOString().slice(0, 10)}.json`)
      journaliser('export', 'donnees_personnelles', utilisateur.id)
    }, 'Export téléchargé. Vos pièces se téléchargent une à une depuis « Mon dossier ».')
  }

  return (
    <>
      <EnteteEcran titre="Profil." chapeau={profil.email} />
      <section className="bande bande--neige" style={{ paddingTop: 32 }}>
        <div className="conteneur grille-2" style={{ alignItems: 'start' }}>
          <form className="carte formulaire" onSubmit={enregistrer}>
            <h2 className="titre-carte">Coordonnées.</h2>
            <div className="formulaire__ligne">
              <Champ libelle="Prénom" id="prenom"><input id="prenom" className="saisie" value={f.prenom} onChange={maj('prenom')} /></Champ>
              <Champ libelle="Nom" id="nom"><input id="nom" className="saisie" value={f.nom} onChange={maj('nom')} /></Champ>
            </div>
            <Champ libelle="Téléphone" id="tel"><input id="tel" type="tel" className="saisie" value={f.telephone} onChange={maj('telephone')} /></Champ>
            <Champ libelle="Adresse postale" id="adresse"><textarea id="adresse" className="saisie" rows={2} value={f.adresse} onChange={maj('adresse')} /></Champ>
            <Champ libelle="Pays" id="pays"><input id="pays" className="saisie" value={f.pays} onChange={maj('pays')} /></Champ>
            <p className="intertitre" style={{ marginTop: 8 }}>Visibilité dans l'annuaire</p>
            <label className="case"><input type="checkbox" checked={f.afficher_telephone} onChange={maj('afficher_telephone')} />Montrer mon téléphone aux membres</label>
            <label className="case"><input type="checkbox" checked={f.afficher_email} onChange={maj('afficher_email')} />Montrer mon e-mail aux membres</label>
            <button className="btn btn--secondaire" style={{ alignSelf: 'flex-start' }} disabled={enCours}>Enregistrer</button>
          </form>

          <div className="pile pile--large">
            <article className="carte pile">
              <h2 className="titre-carte">Préférences.</h2>
              <Champ libelle="Langue">
                <Segment etiquette="Langue" valeur={langue} onChange={changerLangue} options={[['fr', 'Français'], ['en', 'English']]} />
              </Champ>
              <div className="ligne ligne--entre">
                <span>Notifications sur cet appareil</span>
                {notif === 'granted' ? <span className="statut statut--verifiee"><Icone nom="coche" taille={16} />Activées</span>
                  : notif === 'denied' ? <span className="petit secondaire">Bloquées dans le navigateur</span>
                  : notif === 'indisponible' ? <span className="petit secondaire">Indisponibles</span>
                  : <button className="btn btn--tertiaire" onClick={async () => setNotif(await demanderNotifications())}>Activer</button>}
              </div>
              <p className="petit secondaire">Sur iPhone : ouvrez l'application dans Safari, touchez Partager puis « Sur l'écran d'accueil » pour l'installer et recevoir les notifications.</p>
            </article>

            <article className="carte pile">
              <h2 className="titre-carte">Sécurité.</h2>
              <div className="ligne ligne--entre">
                <span>Double authentification</span>
                {facteurs.some((x) => x.status === 'verified')
                  ? <span className="statut statut--verifiee"><Icone nom="bouclier" taille={16} />Activée</span>
                  : <span className="petit secondaire">{roles.ca || roles.avocat ? 'Obligatoire' : 'Non activée'}</span>}
              </div>
              <form className="formulaire" onSubmit={changerMdp}>
                <Champ libelle="Nouveau mot de passe" id="mdp" aide="8 caractères au moins."><input id="mdp" type="password" autoComplete="new-password" className="saisie" value={mdp} onChange={(e) => setMdp(e.target.value)} /></Champ>
                <button className="btn btn--tertiaire" style={{ alignSelf: 'flex-start' }} disabled={!mdp || enCours}>Changer le mot de passe</button>
              </form>
            </article>

            <article className="carte pile">
              <h2 className="titre-carte">Mes données.</h2>
              <p className="tertiaire">Export de vos données (RGPD). Les pièces remises à l'avocat sont conservées pour la défense en justice.</p>
              <div className="ligne">
                <button className="btn btn--tertiaire" onClick={exporter} disabled={enCours}><Icone nom="telecharger" taille={18} />Exporter mes données</button>
                <Link to="/rgpd">Mention d'information ›</Link>
              </div>
            </article>

            <button className="btn btn--contour" style={{ alignSelf: 'flex-start' }} onClick={deconnexion}><Icone nom="sortie" taille={18} />Se déconnecter</button>
          </div>
        </div>
      </section>
      <Pied />
    </>
  )
}
