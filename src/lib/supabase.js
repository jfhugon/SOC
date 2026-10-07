import { createClient } from '@supabase/supabase-js'

const env = import.meta.env ?? globalThis.SOC_ENV ?? {}

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// Domaine des adresses techniques des comptes créés par identifiant (voir la fonction Edge « comptes »)
export const DOMAINE_IDENTIFIANTS = 'membres.centaure.invalid'

// Traduit les erreurs techniques en phrases qui disent quoi corriger
export function messageErreur(err) {
  const m = err?.message || String(err)
  if (/Invalid login credentials/i.test(m)) return 'Identifiant ou mot de passe incorrect.'
  if (/Email not confirmed/i.test(m)) return 'Confirmez d\'abord votre adresse e-mail (lien reçu par courriel).'
  if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse.'
  if (/rate limit/i.test(m)) return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
  if (/New password should be different/i.test(m)) return 'Choisissez un mot de passe différent de l\'actuel.'
  if (/Password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (/duplicate key.*lots_numero_key/i.test(m)) return 'Ce numéro de lot existe déjà.'
  if (/row-level security/i.test(m)) return 'Action non autorisée pour votre rôle.'
  if (/Payload too large|exceeded the maximum allowed size/i.test(m)) return 'Fichier trop lourd : 50 Mo au maximum.'
  if (/Invalid TOTP code|invalid.*code/i.test(m)) return 'Code incorrect. Saisissez le code à 6 chiffres affiché maintenant.'
  return m
}

export async function rpc(nom, args) {
  const { data, error } = await supabase.rpc(nom, args)
  if (error) throw new Error(messageErreur(error))
  return data
}

export function verifier({ data, error }) {
  if (error) throw new Error(messageErreur(error))
  return data
}

export async function journaliser(action, entite, entiteId, details = {}) {
  try {
    await supabase.rpc('journaliser', { p_action: action, p_entite: entite, p_entite_id: entiteId, p_details: details })
  } catch { /* le journal ne bloque jamais l'utilisateur */ }
}

export async function urlSignee(bucket, chemin, telechargement) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(chemin, 600, telechargement ? { download: telechargement } : undefined)
  if (error) throw new Error(messageErreur(error))
  return data.signedUrl
}

// Fonction Edge « comptes » (administrateur global) : création de compte, réinitialisation du mot de passe
export async function gererCompte(corps) {
  const { data, error } = await supabase.functions.invoke('comptes', { body: corps })
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.erreur || messageErreur(error))
  }
  return data
}

// Mot de passe provisoire lisible, sans caractères ambigus (0/O, 1/l/I)
export function motDePasseProvisoire() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const octets = crypto.getRandomValues(new Uint8Array(12))
  const s = Array.from(octets, (o) => alphabet[o % alphabet.length]).join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}
