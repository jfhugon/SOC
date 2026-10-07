// Consultation en ligne de la base juridique : renvoie l'aperçu d'une page, jamais le fichier original
// ni un lien réutilisable. Le droit de lecture est celui de la table documents_juridiques (RLS de l'appelant).
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const erreur = (message: string, statut = 400) =>
  new Response(JSON.stringify({ erreur: message }), { status: statut, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return erreur('Méthode non autorisée', 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const appelant = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: u } = await appelant.auth.getUser()
  if (!u?.user) return erreur('Non connecté', 401)

  let corps: Record<string, unknown>
  try { corps = await req.json() } catch { return erreur('Requête illisible') }
  const id = String(corps.document ?? '')
  const page = Number(corps.page)

  // la RLS de l'appelant décide : membre actif ou CA
  const { data: doc } = await appelant.from('documents_juridiques').select('id, titre, nb_pages').eq('id', id).maybeSingle()
  if (!doc) return erreur('Document introuvable ou accès non autorisé', 403)
  if (!Number.isInteger(page) || page < 1 || page > doc.nb_pages) return erreur('Page inexistante')

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { data: image, error } = await admin.storage.from('juridique-apercus').download(`${doc.id}/${page}.jpg`)
  if (error || !image) return erreur('Aperçu indisponible', 404)

  if (page === 1) {
    await admin.from('journal_audit').insert({
      acteur_id: u.user.id, action: 'consultation_document_juridique', entite: 'document_juridique', entite_id: doc.id,
      details: { titre: doc.titre },
    })
  }

  return new Response(image, {
    headers: {
      ...cors,
      // octet-stream : le client le reçoit en mémoire, sans nom ni lien à partager
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})
