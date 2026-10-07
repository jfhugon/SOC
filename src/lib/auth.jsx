import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase, journaliser, messageErreur, DOMAINE_IDENTIFIANTS } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined : chargement
  const [profil, setProfil] = useState(null)
  const [aal, setAal] = useState(null)
  const [parametres, setParametres] = useState(null)
  const [pret, setPret] = useState(false)

  const charger = useCallback(async (s) => {
    if (!s) { setProfil(null); setAal(null); setPret(true); return }
    const [p, a, par] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.from('parametres').select('*').maybeSingle(),
    ])
    setProfil(p.data); setAal(a.data); setParametres(par.data); setPret(true)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); charger(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((evenement, s) => {
      setSession(s)
      // hors du callback : Supabase déconseille d'y appeler l'API directement
      if (evenement !== 'TOKEN_REFRESHED') setTimeout(() => charger(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [charger])

  const valeur = useMemo(() => {
    const aal2 = aal?.currentLevel === 'aal2'
    const actif = profil?.statut === 'actif'
    const ca = !!(actif && profil?.est_ca && aal2)
    const president = ca && (profil.fonction === 'president' || (profil.fonction === 'vice_president' && !!parametres?.vp_suppleance))
    const roles = {
      membre: !!(actif && !profil?.est_avocat),
      ca,
      president,
      secretaire: ca && profil.fonction === 'secretaire',
      tresorier: ca && profil.fonction === 'tresorier',
      avocat: !!(actif && profil?.est_avocat && aal2),
      adminTech: !!(actif && profil?.est_admin_tech && aal2),
    }
    // US1 : double authentification obligatoire pour le CA, l'avocat et l'administrateur technique
    const mfaRequis = !!(actif && (profil?.est_ca || profil?.est_avocat || profil?.est_admin_tech))
    let mfa = 'ok'
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2') mfa = 'a_verifier'
    else if (mfaRequis && aal?.nextLevel !== 'aal2') mfa = 'a_enroler'

    return {
      session, profil, parametres, roles, mfa, pret: pret && session !== undefined,
      utilisateur: session?.user ?? null,
      async connexion(identifiant, motDePasse) {
        // un identifiant de membre correspond à une adresse technique, jamais utilisée pour écrire
        const saisie = identifiant.trim().toLowerCase()
        const email = saisie.includes('@') ? saisie : `${saisie}@${DOMAINE_IDENTIFIANTS}`
        const { error } = await supabase.auth.signInWithPassword({ email, password: motDePasse })
        if (error) throw new Error(messageErreur(error))
        journaliser('connexion', 'profil', null, { agent: navigator.userAgent.slice(0, 120) })
      },
      async deconnexion() {
        await journaliser('deconnexion')
        await supabase.auth.signOut()
      },
      async rafraichir() {
        // session déjà en mémoire : pas de nouvel appel à getSession(), sujet aux attentes de verrou
        await charger(session)
      },
    }
  }, [session, profil, parametres, aal, pret, charger])

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
