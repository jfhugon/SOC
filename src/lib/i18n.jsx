import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'

// Français par défaut, anglais disponible (US1, §6 Langue)
const EN = {
  'Accueil': 'Home',
  'Messagerie': 'Messages',
  'Mon dossier': 'My file',
  'Coffre': 'Vault',
  'Dossiers': 'Cases',
  'Juridique': 'Legal',
  'Annuaire': 'Directory',
  'Membres': 'Members',
  'Administration': 'Admin',
  'L\'association': 'The association',
  'Profil': 'Profile',
  'Se déconnecter': 'Sign out',
  'Connexion.': 'Sign in.',
  'Se connecter': 'Sign in',
  'Identifiant': 'Username',
  'Mot de passe': 'Password',
  'Identifiant ou mot de passe oublié ?': 'Forgot your username or password?',
  'Les comptes sont créés par l\'administrateur de l\'association. Contactez-le pour obtenir vos accès ou un nouveau mot de passe.': 'Accounts are created by the association\'s administrator. Contact them to get access or a new password.',
  'Protection des données': 'Data protection',
  'Déposer une pièce': 'Upload a document',
  'Rechercher': 'Search',
  'Écrire': 'Write',
  'Envoyer': 'Send',
  'Annuler': 'Cancel',
  'Enregistrer': 'Save',
  'Fermer': 'Close',
  'Bonjour': 'Hello',
  'Nouveau message': 'New message',
  'Langue': 'Language',
}

const LangueContext = createContext({ langue: 'fr', t: (s) => s, changerLangue: () => {} })

export function LangueProvider({ children }) {
  const { profil } = useAuth()
  const [langue, setLangue] = useState(() => {
    try { return localStorage.getItem('soc-langue') || 'fr' } catch { return 'fr' }
  })

  useEffect(() => { if (profil?.langue) setLangue(profil.langue) }, [profil?.langue])
  useEffect(() => { document.documentElement.lang = langue }, [langue])

  async function changerLangue(l) {
    setLangue(l)
    try { localStorage.setItem('soc-langue', l) } catch { /* stockage indisponible */ }
    if (profil) await supabase.from('profiles').update({ langue: l }).eq('id', profil.id)
  }

  const t = (s) => (langue === 'en' ? EN[s] ?? s : s)
  return <LangueContext.Provider value={{ langue, t, changerLangue }}>{children}</LangueContext.Provider>
}

export function useLangue() {
  return useContext(LangueContext)
}
