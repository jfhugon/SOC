import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, verifier, messageErreur } from '../lib/supabase'
import { sha256 } from '../lib/hash'
import { ACCEPT_PIECES, EXTENSIONS_ACCEPTEES, TAILLE_MAX, TYPES_PIECE } from '../lib/constants'
import { extension, nomFichierSur, taille } from '../lib/format'
import { Bandeau, Champ, Modale, useToast } from './UI'
import Icone from './Icones'

// Photo multipage → un seul PDF A4
async function imagesEnPdf(images) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  for (let i = 0; i < images.length; i++) {
    const url = URL.createObjectURL(images[i])
    const img = await new Promise((ok, ko) => {
      const im = new Image()
      im.onload = () => ok(im)
      im.onerror = () => ko(new Error(`Impossible de lire la photo ${i + 1} (format non pris en charge par ce navigateur).`))
      im.src = url
    })
    const echelle = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * echelle)
    canvas.height = Math.round(img.naturalHeight * echelle)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    const donnees = canvas.toDataURL('image/jpeg', 0.85)
    if (i > 0) doc.addPage()
    const marge = 8, lMax = 210 - 2 * marge, hMax = 297 - 2 * marge
    const r = Math.min(lMax / canvas.width, hMax / canvas.height)
    const l = canvas.width * r, h = canvas.height * r
    doc.addImage(donnees, 'JPEG', (210 - l) / 2, (297 - h) / 2, l, h)
  }
  return doc.output('blob')
}

/**
 * US9 dépôt, US8 « Ajouter au coffre » (fichierInitial + messageSource), US11 nouvelle version (versionPrecedente)
 */
export default function DeposerPiece({ onFermer, onDepose, fichierInitial, messageSource, versionPrecedente, typeInitial }) {
  const { utilisateur } = useAuth()
  const toast = useToast()
  const [fichier, setFichier] = useState(fichierInitial || null)
  const [pages, setPages] = useState([])
  const [lots, setLots] = useState([])
  const [f, setF] = useState({
    type_piece: versionPrecedente?.type_piece || typeInitial || '',
    date_document: versionPrecedente?.date_document || '',
    lot_id: versionPrecedente?.lot_id || '',
    dossier_id: versionPrecedente?.dossier_id || '',
    description: versionPrecedente?.description || '',
  })
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [survol, setSurvol] = useState(false)

  useEffect(() => {
    supabase.rpc('mes_lots')
      .then(({ data }) => { setLots(data || []); if (data?.length === 1) setF((x) => ({ ...x, lot_id: x.lot_id || data[0].id })) })
  }, [utilisateur.id])

  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function choisir(liste) {
    const fi = liste?.[0]
    if (!fi) return
    setErreur('')
    setPages([])
    setFichier(fi)
  }

  function ajouterPages(liste) {
    if (!liste?.length) return
    setFichier(null)
    setPages((p) => [...p, ...Array.from(liste)])
  }

  async function deposer(e) {
    e.preventDefault()
    setErreur('')
    if (!fichier && !pages.length) return setErreur('Choisissez un fichier ou photographiez le document.')
    if (!f.type_piece) return setErreur('Indiquez le type de pièce.')
    setEnCours(true)
    try {
      let blob = fichier
      let nom = fichier?.name || 'piece.pdf'
      let mime = fichier?.type || ''
      if (pages.length) {
        blob = await imagesEnPdf(pages)
        nom = `${nomFichierSur(TYPES_PIECE[f.type_piece])}-${new Date().toISOString().slice(0, 10)}.pdf`
        mime = 'application/pdf'
      }
      if (!EXTENSIONS_ACCEPTEES.includes(extension(nom))) throw new Error(`Format non accepté. Formats : ${EXTENSIONS_ACCEPTEES.join(', ').toUpperCase()}.`)
      if (blob.size > TAILLE_MAX) throw new Error(`Fichier trop lourd (${taille(blob.size)}) : 50 Mo au maximum.`)

      const empreinte = await sha256(blob)
      const chemin = `${utilisateur.id}/${crypto.randomUUID()}-${nomFichierSur(nom)}`
      const { error } = await supabase.storage.from('pieces').upload(chemin, blob, { contentType: mime || undefined, upsert: false })
      if (error) throw new Error(messageErreur(error))
      verifier(await supabase.from('pieces').insert({
        membre_id: utilisateur.id,
        type_piece: f.type_piece,
        date_document: f.date_document || null,
        lot_id: f.lot_id || null,
        dossier_id: f.dossier_id || null,
        description: f.description.trim() || null,
        chemin, nom_fichier: nom, mime: mime || null, taille: blob.size, sha256: empreinte,
        version_precedente: versionPrecedente?.id || null,
        message_source: messageSource || null,
      }))
      toast(versionPrecedente ? 'Nouvelle version déposée. Le CA va la vérifier.' : 'Pièce déposée. Le CA va la vérifier.')
      onDepose?.()
      onFermer()
    } catch (err) {
      setErreur(err.message)
    } finally {
      setEnCours(false)
    }
  }

  const titre = versionPrecedente ? 'Nouvelle version.' : messageSource ? 'Ajouter au coffre.' : 'Déposer une pièce.'
  return (
    <Modale titre={titre} onFermer={onFermer}
      sousTitre={versionPrecedente ? `Remplace la version ${versionPrecedente.version} · ${versionPrecedente.motif || ''}` : 'PDF, photo, Word, Excel ou e-mail · 50 Mo au maximum'}>
      <form className="formulaire" onSubmit={deposer} noValidate>
        {erreur && <Bandeau type="erreur">{erreur}</Bandeau>}

        {fichierInitial ? (
          <div className="bloc ligne"><Icone nom="document" /><span style={{ flex: 1, overflowWrap: 'anywhere' }}>{fichierInitial.name}</span><span className="petit secondaire">{taille(fichierInitial.size)}</span></div>
        ) : (
          <div className={`zone-depot${survol ? ' survol' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setSurvol(true) }} onDragLeave={() => setSurvol(false)}
            onDrop={(e) => { e.preventDefault(); setSurvol(false); choisir(e.dataTransfer.files) }}>
            {fichier && <p><strong style={{ overflowWrap: 'anywhere' }}>{fichier.name}</strong> · {taille(fichier.size)}</p>}
            {pages.length > 0 && <p><strong>{pages.length} page{pages.length > 1 ? 's' : ''} photographiée{pages.length > 1 ? 's' : ''}</strong> · un seul PDF sera créé</p>}
            {!fichier && !pages.length && <p className="secondaire">Glissez un fichier ici ou :</p>}
            <div className="ligne" style={{ justifyContent: 'center' }}>
              <label className="btn btn--secondaire">
                <Icone nom="appareil" taille={20} />{pages.length ? 'Ajouter une page' : 'Photographier'}
                <input type="file" accept="image/*" capture="environment" multiple className="visuellement-cache" onChange={(e) => { ajouterPages(e.target.files); e.target.value = '' }} />
              </label>
              <label className="btn btn--tertiaire">
                <Icone nom="document" taille={20} />Choisir un fichier
                <input type="file" accept={ACCEPT_PIECES} className="visuellement-cache" onChange={(e) => { choisir(e.target.files); e.target.value = '' }} />
              </label>
            </div>
          </div>
        )}

        <div className="formulaire__ligne">
          <Champ libelle="Type de pièce" id="type">
            <select id="type" className="saisie" value={f.type_piece} onChange={maj('type_piece')} disabled={!!versionPrecedente}>
              <option value="">Choisir…</option>
              {Object.entries(TYPES_PIECE).filter(([k]) => k !== 'autorisation_agir').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Champ>
          <Champ libelle="Date du document" id="date">
            <input id="date" type="date" className="saisie" value={f.date_document} max={new Date().toISOString().slice(0, 10)} onChange={maj('date_document')} />
          </Champ>
        </div>
        <div className="formulaire__ligne">
          {lots.length > 0 && (
            <Champ libelle="Lot concerné" id="lot">
              <select id="lot" className="saisie" value={f.lot_id} onChange={maj('lot_id')}>
                <option value="">Tous mes lots</option>
                {lots.map((l) => <option key={l.id} value={l.id}>Lot {l.numero} · appt {l.appartement}</option>)}
              </select>
            </Champ>
          )}
        </div>
        <Champ libelle="Description (facultatif)" id="desc">
          <textarea id="desc" className="saisie" rows={2} value={f.description} onChange={maj('description')} placeholder="Ex. : relevé du 2e trimestre 2025" />
        </Champ>
        <p className="petit secondaire">Le fichier original est conservé tel quel, horodaté, avec son empreinte SHA-256.</p>
        <div className="modale__pied">
          <button type="button" className="btn btn--tertiaire" onClick={onFermer}>Annuler</button>
          <button className="btn btn--principal" disabled={enCours}>{enCours ? 'Dépôt…' : 'Déposer'}</button>
        </div>
      </form>
    </Modale>
  )
}
