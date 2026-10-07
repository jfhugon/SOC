import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { MessagerieProvider } from './lib/messagerie'
import Layout from './components/Layout'
import { Chargement } from './components/UI'
import { Connexion, DoubleAuthentification, NouveauMotDePasse } from './pages/Acces'
import Adhesion, { Inactif } from './pages/Adhesion'
import Accueil from './pages/Accueil'
import Messagerie from './pages/Messagerie'
import MonDossier from './pages/MonDossier'
import Coffre from './pages/Coffre'
import Annuaire from './pages/Annuaire'
import Membres from './pages/Membres'
import Administration from './pages/Administration'
import Profil from './pages/Profil'
import Plus from './pages/Plus'
import Juridique from './pages/Juridique'
import Rgpd from './pages/Rgpd'
import Association from './pages/Association'

export default function App() {
  const { pret, session, profil, roles, mfa } = useAuth()

  if (!pret) return <Chargement texte="Ouverture…" />

  // Visiteur : aucun contenu public
  if (!session) {
    return (
      <Routes>
        <Route path="/connexion" element={<Connexion />} />
        <Route path="/rgpd" element={<Rgpd />} />
        <Route path="*" element={<Navigate to="/connexion" replace />} />
      </Routes>
    )
  }

  if (!profil) return <Chargement texte="Préparation de votre espace…" />

  // Double authentification avant tout accès pour le CA et l'avocat
  if (mfa !== 'ok') return <DoubleAuthentification />

  // Mot de passe provisoire remis par l'administrateur
  if (profil.mdp_provisoire) return <NouveauMotDePasse />

  if (profil.statut === 'inactif') {
    return (
      <Routes>
        <Route path="/profil" element={<Profil />} />
        <Route path="/rgpd" element={<Rgpd />} />
        <Route path="*" element={<Inactif />} />
      </Routes>
    )
  }

  // Compte pas encore activé ou refusé par l'administrateur
  if (profil.statut !== 'actif') {
    return (
      <Routes>
        <Route path="/rgpd" element={<Rgpd />} />
        <Route path="*" element={<Adhesion />} />
      </Routes>
    )
  }

  return (
    <MessagerieProvider>
      <Routes>
        <Route path="/rgpd" element={<Rgpd />} />
        <Route element={<Layout />}>
          <Route index element={<Accueil />} />
          <Route path="messages" element={<Messagerie />} />
          <Route path="messages/:id" element={<Messagerie />} />
          {roles.membre && <Route path="mon-dossier" element={<MonDossier />} />}
          {roles.ca && <Route path="coffre" element={<Coffre />} />}
          {(roles.membre || roles.ca) && <Route path="juridique" element={<Juridique />} />}
          {roles.membre && <Route path="annuaire" element={<Annuaire />} />}
          {roles.ca && <Route path="membres" element={<Membres />} />}
          {roles.adminTech && <Route path="administration" element={<Administration />} />}
          <Route path="association" element={<Association />} />
          <Route path="profil" element={<Profil />} />
          <Route path="plus" element={<Plus />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </MessagerieProvider>
  )
}
