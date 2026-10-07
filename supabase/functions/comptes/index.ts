// Gestion des comptes par l'administrateur global : création (identifiant + mot de passe provisoire)
// et réinitialisation du mot de passe. La clé de service ne quitte jamais le serveur.
import { createClient } from 'npm:@supabase/supabase-js@2'

const DOMAINE = 'membres.centaure.invalid'
const IDENTIFIANT = /^[a-z0-9][a-z0-9._-]{2,31}$/

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reponse(corps: unknown, statut = 200) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...cors, 'Content-Type': 'application/json' } })
}
const erreur = (message: string, statut = 400) => reponse({ erreur: message }, statut)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erreur('Méthode non autorisée', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const cleAnon = Deno.env.get('SUPABASE_ANON_KEY')!
  const cleService = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const jeton = req.headers.get('Authorization') ?? ''

  // L'appelant doit être l'administrateur global, double authentification validée (aal2)
  const appelant = createClient(url, cleAnon, { global: { headers: { Authorization: jeton } } })
  const { data: u } = await appelant.auth.getUser()
  if (!u?.user) return erreur('Non connecté', 401)
  const { data: estAdmin } = await appelant.rpc('est_admin_tech')
  if (!estAdmin) return erreur('Réservé à l\'administrateur global', 403)

  const admin = createClient(url, cleService, { auth: { persistSession: false } })
  const journal = (action: string, entiteId: string, details: Record<string, unknown>) =>
    admin.from('journal_audit').insert({ acteur_id: u.user.id, action, entite: 'profil', entite_id: entiteId, details })

  let corps: Record<string, any>
  try { corps = await req.json() } catch { return erreur('Requête illisible') }

  if (corps.action === 'creer') {
    const identifiant = String(corps.identifiant ?? '').trim().toLowerCase()
    const motDePasse = String(corps.mot_de_passe ?? '')
    const prenom = String(corps.prenom ?? '').trim()
    const nom = String(corps.nom ?? '').trim()
    const email = String(corps.email ?? '').trim() || null
    const telephone = String(corps.telephone ?? '').trim() || null
    const lots = (Array.isArray(corps.lots) ? corps.lots : [])
      .map((l: any) => ({ numero: String(l.numero ?? '').trim(), appartement: String(l.appartement ?? '').trim(), societe: String(l.societe ?? '').trim() || null }))
      .filter((l: any) => l.numero && l.appartement)

    if (!IDENTIFIANT.test(identifiant)) return erreur('Identifiant : 3 à 32 caractères, minuscules, chiffres, point, tiret ou souligné.')
    if (motDePasse.length < 8) return erreur('Le mot de passe doit contenir au moins 8 caractères.')
    if (!prenom || !nom) return erreur('Indiquez le prénom et le nom.')

    const { data: cree, error } = await admin.auth.admin.createUser({
      email: `${identifiant}@${DOMAINE}`, password: motDePasse, email_confirm: true,
      user_metadata: { identifiant, prenom, nom, email_contact: email, telephone },
    })
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return erreur('Cet identifiant est déjà utilisé.')
      return erreur(error.message)
    }
    const id = cree.user.id

    // Un lot déjà enregistré reçoit un propriétaire de plus (copropriété, ex. couple divorcé)
    const lotsCrees: string[] = []
    async function rattacher(): Promise<string | null> {
      const { error: e1 } = await admin.from('profiles').update({ statut: 'actif', mdp_provisoire: true }).eq('id', id)
      if (e1) return e1.message
      for (const l of lots) {
        const { data: existant } = await admin.from('lots').select('id, appartement, societe').eq('numero', l.numero).maybeSingle()
        let lotId = existant?.id
        if (existant) {
          if (existant.appartement !== l.appartement) return `Le lot ${l.numero} est déjà enregistré pour l'appartement ${existant.appartement}.`
          if (l.societe && l.societe !== existant.societe) {
            const { error } = await admin.from('lots').update({ societe: l.societe }).eq('id', lotId)
            if (error) return error.message
          }
        } else {
          const { data: cree, error } = await admin.from('lots').insert(l).select('id').single()
          if (error) return error.message
          lotId = cree.id
          lotsCrees.push(lotId)
        }
        const { error } = await admin.from('lot_proprietaires').insert({ lot_id: lotId, membre_id: id })
        if (error) return error.message
      }
      return null
    }
    const probleme = await rattacher()
    if (probleme) {
      // pas de compte à moitié créé
      await admin.auth.admin.deleteUser(id)
      if (lotsCrees.length) await admin.from('lots').delete().in('id', lotsCrees)
      return erreur(probleme)
    }
    await journal('creation_compte', id, { identifiant, lots: lots.map((l: any) => l.numero) })
    return reponse({ id, identifiant })
  }

  if (corps.action === 'reinitialiser') {
    const id = String(corps.membre ?? '')
    const motDePasse = String(corps.mot_de_passe ?? '')
    if (motDePasse.length < 8) return erreur('Le mot de passe doit contenir au moins 8 caractères.')
    const { error } = await admin.auth.admin.updateUserById(id, { password: motDePasse })
    if (error) return erreur(error.message)
    await admin.from('profiles').update({ mdp_provisoire: true }).eq('id', id)
    await journal('reinitialisation_mdp', id, {})
    return reponse({ ok: true })
  }

  return erreur('Action inconnue')
})
