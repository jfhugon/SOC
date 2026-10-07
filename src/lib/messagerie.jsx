import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, rpc } from './supabase'
import { useAuth } from './auth'
import { nomComplet } from './format'

// État partagé de la messagerie : liste des conversations, non-lus, annuaire, notifications
const MessagerieContext = createContext(null)

export function MessagerieProvider({ children }) {
  const { utilisateur, roles } = useAuth()
  const [conversations, setConversations] = useState(null)
  const [annuaire, setAnnuaire] = useState([])
  const convOuverte = useRef(null)
  const minuteur = useRef(null)
  const actif = roles.membre || roles.avocat

  const rafraichir = useCallback(async () => {
    try { setConversations(await rpc('mes_conversations')) } catch { setConversations([]) }
  }, [])

  const rafraichirBientot = useCallback(() => {
    clearTimeout(minuteur.current)
    minuteur.current = setTimeout(rafraichir, 250)
  }, [rafraichir])

  useEffect(() => {
    if (!actif || !utilisateur) return
    rafraichir()
    rpc('annuaire').then(setAnnuaire).catch(() => {})
    rpc('marquer_recu').catch(() => {})
  }, [actif, utilisateur, rafraichir, roles.ca])

  const parId = useMemo(() => Object.fromEntries(annuaire.map((p) => [p.id, p])), [annuaire])
  const convsRef = useRef(conversations)
  convsRef.current = conversations

  // Temps réel : la base ne diffuse que les messages que l'utilisateur a le droit de lire (RLS)
  useEffect(() => {
    if (!actif || !utilisateur) return
    const canal = supabase.channel('messages-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => {
        rafraichirBientot()
        if (m.auteur_id === utilisateur.id) return
        rpc('marquer_recu').catch(() => {})
        const conv = convsRef.current?.find((c) => c.id === m.conversation_id)
        const mode = conv?.notifications || 'tous'
        const mentionne = (m.mentions || []).includes(utilisateur.id)
        if (mode === 'muet' || (mode === 'mentions' && !mentionne)) return
        if (convOuverte.current === m.conversation_id && document.visibilityState === 'visible') return
        notifier(conv?.titre || 'Nouveau message', `${nomComplet(parId[m.auteur_id])} : ${m.contenu || 'Pièce jointe'}`, `/messages/${m.conversation_id}`)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, rafraichirBientot)
      .subscribe()
    return () => { supabase.removeChannel(canal) }
  }, [actif, utilisateur, rafraichirBientot, parId])

  const definirConvOuverte = useCallback((id) => { convOuverte.current = id }, [])

  const nonLus = (conversations || []).reduce((s, c) => s + (c.notifications === 'muet' ? 0 : c.non_lus), 0)

  const valeur = useMemo(() => ({
    conversations, rafraichir, annuaire, parId, nonLus, definirConvOuverte,
  }), [conversations, rafraichir, annuaire, parId, nonLus, definirConvOuverte])

  return <MessagerieContext.Provider value={valeur}>{children}</MessagerieContext.Provider>
}

export function useMessagerie() {
  return useContext(MessagerieContext)
}

// Notifications système (ordinateur et PWA installée) ; le push serveur viendra avec Web Push
export async function demanderNotifications() {
  if (!('Notification' in window)) return 'indisponible'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

async function notifier(titre, corps, url) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) reg.showNotification(titre, { body: corps.slice(0, 160), icon: '/icon-192.png', data: { url }, tag: url })
    else new Notification(titre, { body: corps.slice(0, 160), icon: '/icon-192.png' })
  } catch { /* notifications bloquées */ }
}
