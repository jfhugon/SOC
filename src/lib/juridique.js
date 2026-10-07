import workerPdf from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { supabase, messageErreur } from './supabase'
import { PAGES_JURIDIQUE_MAX } from './constants'

const LARGEUR_APERCU = 1600 // px : lisible à l'écran, sans restituer la qualité de l'original
const QUALITE_APERCU = 0.82

function canevasEnJpeg(canvas) {
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Aperçu impossible à générer.'))), 'image/jpeg', QUALITE_APERCU))
}

// Aperçus de consultation : une image JPEG par page, générée dans le navigateur du Président.
// Les membres ne voient que ces images ; l'original reste dans l'espace réservé au Président.
export async function genererApercus(fichier, progression) {
  if (fichier.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = workerPdf
    const pdf = await pdfjs.getDocument({ data: await fichier.arrayBuffer() }).promise
    if (pdf.numPages > PAGES_JURIDIQUE_MAX) throw new Error(`Document trop long : ${PAGES_JURIDIQUE_MAX} pages au maximum.`)
    const pages = []
    for (let n = 1; n <= pdf.numPages; n++) {
      progression?.(n, pdf.numPages)
      const page = await pdf.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: Math.min(3, LARGEUR_APERCU / base.width) })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await page.render({ canvasContext: ctx, viewport }).promise
      pages.push(await canevasEnJpeg(canvas))
      page.cleanup()
    }
    await pdf.destroy()
    return pages
  }
  // image : réencodée (sans métadonnées), redimensionnée
  progression?.(1, 1)
  const img = await createImageBitmap(fichier).catch(() => { throw new Error('Image illisible par ce navigateur.') })
  const echelle = Math.min(1, LARGEUR_APERCU / img.width, 2400 / img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * echelle)
  canvas.height = Math.round(img.height * echelle)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close()
  return [await canevasEnJpeg(canvas)]
}

// Une page, reçue en mémoire depuis la fonction Edge « juridique » (aucun lien de fichier)
export async function chargerPage(documentId, page) {
  const { data, error } = await supabase.functions.invoke('juridique', { body: { document: documentId, page } })
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.erreur || messageErreur(error))
  }
  return createImageBitmap(data)
}
