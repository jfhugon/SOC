import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLangue } from '../lib/i18n'
import { liensNavigation } from '../components/Layout'
import Icone from '../components/Icones'

// Menu complet sur mobile (la barre d'onglets n'affiche que l'essentiel)
export default function Plus() {
  const { roles, deconnexion } = useAuth()
  const { t } = useLangue()
  return (
    <div className="conteneur" style={{ padding: '32px 24px' }}>
      <h1 className="titre-section" style={{ marginBottom: 24 }}>Menu.</h1>
      <div className="liste">
        {[...liensNavigation(roles), { to: '/profil', nom: 'Profil', icone: 'utilisateur' }].map((l) => (
          <Link key={l.to} to={l.to} className="liste__el"><Icone nom={l.icone} /><span className="liste__corps"><span className="liste__titre">{t(l.nom)}</span></span><Icone nom="chevron" taille={18} /></Link>
        ))}
        <Link to="/rgpd" className="liste__el"><Icone nom="bouclier" /><span className="liste__corps"><span className="liste__titre">{t('Protection des données')}</span></span><Icone nom="chevron" taille={18} /></Link>
        <button className="liste__el" onClick={deconnexion}><Icone nom="sortie" /><span className="liste__corps"><span className="liste__titre">{t('Se déconnecter')}</span></span></button>
      </div>
    </div>
  )
}
