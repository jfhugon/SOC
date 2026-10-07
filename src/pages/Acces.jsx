import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLangue } from '../lib/i18n'
import { supabase, messageErreur } from '../lib/supabase'
import { Monogramme } from '../components/Icones'
import { Bandeau, Champ } from '../components/UI'

export function CadreAcces({ children, large }) {
  const { langue, changerLangue } = useLangue()
  return (
    <div className="acces">
      <div className="acces__haut">
        <Link to="/" className="nav__logo"><Monogramme />Centaure</Link>
        <button type="button" className="btn btn--lien" onClick={() => changerLangue(langue === 'fr' ? 'en' : 'fr')}
          aria-label={langue === 'fr' ? 'Switch to English' : 'Passer en français'}>
          {langue === 'fr' ? 'English' : 'Français'}
        </button>
      </div>
      <div className="acces__corps">
        <div className={`acces__carte${large ? ' acces__carte--large' : ''}`}>{children}</div>
      </div>
      <p className="petit secondaire" style={{ textAlign: 'center', padding: '0 24px 32px' }}>
        Spirit Of Centaure · accès réservé aux membres, aucun contenu public · <Link to="/rgpd">Protection des données</Link>
      </p>
    </div>
  )
}

// US1 : connexion par identifiant (ou e-mail pour l'administrateur global) et mot de passe
export function Connexion() {
  const { connexion } = useAuth()
  const { t } = useLangue()
  const [identifiant, setIdentifiant] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function soumettre(e) {
    e.preventDefault()
    setErreur(''); setEnCours(true)
    try { await connexion(identifiant, mdp) } catch (err) { setErreur(err.message) } finally { setEnCours(false) }
  }

  return (
    <CadreAcces>
      <p className="etiquette" style={{ marginBottom: 10 }}>Spirit Of Centaure</p>
      <h1 className="titre-section" style={{ marginBottom: 24 }}>{t('Connexion.')}</h1>
      <form className="carte formulaire" onSubmit={soumettre} noValidate>
        {erreur && <Bandeau type="erreur">{erreur}</Bandeau>}
        <Champ libelle={t('Identifiant')} id="identifiant">
          <input id="identifiant" className="saisie" autoComplete="username" autoCapitalize="none" spellCheck={false} required
            value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
        </Champ>
        <Champ libelle={t('Mot de passe')} id="mdp">
          <input id="mdp" className="saisie" type="password" autoComplete="current-password" required value={mdp} onChange={(e) => setMdp(e.target.value)} />
        </Champ>
        <button className="btn btn--principal btn--grand btn--bloc" disabled={enCours || !identifiant.trim() || !mdp}>
          {enCours ? 'Connexion…' : t('Se connecter')}
        </button>
      </form>
      <div className="carte carte--compacte" style={{ marginTop: 16, textAlign: 'center' }}>
        <p className="secondaire">{t('Identifiant ou mot de passe oublié ?')}</p>
        <p className="petit secondaire" style={{ marginTop: 8 }}>{t('Les comptes sont créés par l\'administrateur de l\'association. Contactez-le pour obtenir vos accès ou un nouveau mot de passe.')}</p>
      </div>
    </CadreAcces>
  )
}

// Mot de passe provisoire remis par l'administrateur : le membre le remplace à sa première connexion
export function NouveauMotDePasse() {
  const { rafraichir, deconnexion } = useAuth()
  const [f, setF] = useState({ mdp: '', mdp2: '' })
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  async function soumettre(e) {
    e.preventDefault()
    setErreur('')
    if (f.mdp.length < 8) return setErreur('Le mot de passe doit contenir au moins 8 caractères.')
    if (f.mdp !== f.mdp2) return setErreur('Les deux mots de passe ne correspondent pas.')
    setEnCours(true)
    const { error } = await supabase.auth.updateUser({ password: f.mdp })
    if (error) { setEnCours(false); return setErreur(messageErreur(error)) }
    const { error: e2 } = await supabase.rpc('confirmer_mot_de_passe')
    setEnCours(false)
    if (e2) return setErreur(messageErreur(e2))
    await rafraichir()
  }
  return (
    <CadreAcces>
      <p className="etiquette" style={{ marginBottom: 10 }}>Première connexion</p>
      <h1 className="titre-section" style={{ marginBottom: 12 }}>Choisissez votre mot de passe.</h1>
      <p className="chapeau" style={{ fontSize: 21, marginBottom: 24 }}>Le mot de passe remis par l'administrateur est provisoire. Remplacez-le par un mot de passe connu de vous seul.</p>
      <form className="carte formulaire" onSubmit={soumettre} noValidate>
        {erreur && <Bandeau type="erreur">{erreur}</Bandeau>}
        <Champ libelle="Nouveau mot de passe" id="mdp" aide="8 caractères au moins.">
          <input id="mdp" className="saisie" type="password" autoComplete="new-password" value={f.mdp} onChange={(e) => setF({ ...f, mdp: e.target.value })} />
        </Champ>
        <Champ libelle="Confirmer le mot de passe" id="mdp2">
          <input id="mdp2" className="saisie" type="password" autoComplete="new-password" value={f.mdp2} onChange={(e) => setF({ ...f, mdp2: e.target.value })} />
        </Champ>
        <button className="btn btn--principal btn--bloc" disabled={enCours || !f.mdp}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
        <button type="button" className="btn btn--lien" onClick={deconnexion}>Se déconnecter</button>
      </form>
    </CadreAcces>
  )
}

// US1 : double authentification (TOTP) obligatoire pour le CA et l'avocat
export function DoubleAuthentification() {
  const { mfa, rafraichir, deconnexion, profil } = useAuth()
  const [etape, setEtape] = useState(null) // { factorId, qr, secret }
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)

  async function enroler() {
    setErreur(''); setEnCours(true)
    // les facteurs non vérifiés d'une tentative précédente bloquent un nouvel enrôlement
    const { data: liste } = await supabase.auth.mfa.listFactors()
    for (const f of liste?.all || []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Centaure ${Date.now()}` })
    setEnCours(false)
    if (error) return setErreur(messageErreur(error))
    setEtape({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function verifier(e) {
    e.preventDefault()
    setErreur(''); setEnCours(true)
    let factorId = etape?.factorId
    if (!factorId) {
      const { data } = await supabase.auth.mfa.listFactors()
      factorId = data?.totp?.[0]?.id
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
    setEnCours(false)
    if (error) return setErreur(messageErreur(error))
    await rafraichir()
  }

  const aEnroler = mfa === 'a_enroler'
  return (
    <CadreAcces>
      <p className="etiquette" style={{ marginBottom: 10 }}>Sécurité</p>
      <h1 className="titre-section" style={{ marginBottom: 12 }}>Double authentification.</h1>
      <p className="chapeau" style={{ fontSize: 21, marginBottom: 24 }}>
        {aEnroler
          ? `Votre rôle (${profil?.est_avocat ? 'avocat' : profil?.est_admin_tech && !profil?.est_ca ? 'administrateur global' : 'Conseil d\'administration'}) donne accès aux pièces sensibles : un second facteur est obligatoire.`
          : 'Saisissez le code à 6 chiffres de votre application d\'authentification.'}
      </p>
      <div className="carte formulaire">
        {erreur && <Bandeau type="erreur">{erreur}</Bandeau>}
        {aEnroler && !etape && (
          <>
            <ol className="tertiaire" style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>Installez une application d'authentification (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
              <li>Scannez le QR code qui va s'afficher.</li>
              <li>Saisissez le code à 6 chiffres.</li>
            </ol>
            <button className="btn btn--principal btn--bloc" onClick={enroler} disabled={enCours}>Afficher le QR code</button>
          </>
        )}
        {etape && (
          <div className="pile" style={{ alignItems: 'center' }}>
            <div className="qr"><img src={etape.qr} alt="QR code à scanner avec votre application d'authentification" /></div>
            <p className="petit secondaire" style={{ textAlign: 'center' }}>Ou saisissez cette clé : <span className="mono">{etape.secret}</span></p>
          </div>
        )}
        {(!aEnroler || etape) && (
          <form className="formulaire" onSubmit={verifier}>
            <Champ libelle="Code à 6 chiffres" id="otp">
              <input id="otp" className="saisie code-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </Champ>
            <button className="btn btn--principal btn--grand btn--bloc" disabled={code.length !== 6 || enCours}>Valider</button>
          </form>
        )}
        <button type="button" className="btn btn--lien" onClick={deconnexion}>Se déconnecter</button>
      </div>
    </CadreAcces>
  )
}
