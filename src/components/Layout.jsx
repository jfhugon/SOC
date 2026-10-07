import { NavLink, Link, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLangue } from '../lib/i18n'
import { useMessagerie } from '../lib/messagerie'
import Icone, { Monogramme } from './Icones'
import { Avatar } from './UI'

export function liensNavigation(roles) {
  const liens = [{ to: '/', nom: 'Accueil', icone: 'accueil', fin: true }]
  liens.push({ to: '/messages', nom: 'Messagerie', icone: 'messages', badge: true })
  if (roles.membre) liens.push({ to: '/mon-dossier', nom: 'Mon dossier', icone: 'dossier' })
  if (roles.ca) liens.push({ to: '/coffre', nom: 'Coffre', icone: 'coffre' })
  if (roles.membre || roles.ca) liens.push({ to: '/juridique', nom: 'Juridique', icone: 'cadenas' })
  if (roles.membre) liens.push({ to: '/annuaire', nom: 'Annuaire', icone: 'annuaire' })
  if (roles.ca) liens.push({ to: '/membres', nom: 'Membres', icone: 'membres' })
  liens.push({ to: '/association', nom: 'L\'association', icone: 'groupe' })
  if (roles.adminTech) liens.push({ to: '/administration', nom: 'Administration', icone: 'reglages' })
  return liens
}

export default function Layout() {
  const { profil, roles } = useAuth()
  const { t } = useLangue()
  const { nonLus } = useMessagerie()
  const liens = liensNavigation(roles)
  // Barre d'onglets mobile : 5 entrées au plus
  const onglets = liens.filter((l) => ['/', '/messages', '/mon-dossier', '/coffre', '/juridique'].includes(l.to)).slice(0, 4)

  return (
    <>
      <a href="#contenu" className="visuellement-cache">Aller au contenu</a>
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" className="nav__logo" aria-label="Centaure, accueil"><Monogramme />Centaure</Link>
          <nav className="nav__liens" aria-label="Navigation principale">
            {liens.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.fin} className="nav__lien">
                {t(l.nom)}
                {l.badge && nonLus > 0 && <span className="pastille" aria-label={`${nonLus} non lus`}>{nonLus}</span>}
              </NavLink>
            ))}
          </nav>
          <NavLink to="/profil" className="nav__profil" aria-label="Mon profil">
            <span className="petit nav__profil-nom" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profil?.prenom || t('Profil')}</span>
            <Avatar personne={profil} petit couleur="encre" />
          </NavLink>
        </div>
      </header>
      <main id="contenu" className="app-contenu">
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Navigation mobile">
        {onglets.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.fin}>
            <Icone nom={l.icone} taille={24} />
            {t(l.nom)}
            {l.badge && nonLus > 0 && <span className="pastille">{nonLus}</span>}
          </NavLink>
        ))}
        <NavLink to="/plus">
          <Icone nom="plus_actions" taille={24} />
          Plus
        </NavLink>
      </nav>
    </>
  )
}

export function Pied() {
  return (
    <footer className="pied">
      <div className="conteneur ligne ligne--entre">
        <span>Spirit Of Centaure · association loi 1901 · accès réservé aux membres</span>
        <Link to="/rgpd">Protection des données</Link>
      </div>
    </footer>
  )
}

export function EnteteEcran({ titre, chapeau, etiquette, actions }) {
  return (
    <div className="entete-ecran">
      <div className="conteneur">
        {etiquette && <p className="etiquette" style={{ marginBottom: 10 }}>{etiquette}</p>}
        <div className="entete-ecran__ligne">
          <h1 className="titre-ecran">{titre}</h1>
          {actions && <div className="ligne">{actions}</div>}
        </div>
        {chapeau && <p className="chapeau">{chapeau}</p>}
      </div>
    </div>
  )
}
