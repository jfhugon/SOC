import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase, verifier, messageErreur, urlSignee, journaliser } from '../lib/supabase'
import { sha256 } from '../lib/hash'
import { genererApercus, chargerPage } from '../lib/juridique'
import { ACCEPT_JURIDIQUE, CATEGORIES_JURIDIQUES, MIMES_JURIDIQUE, TAILLE_MAX } from '../lib/constants'
import { dateHeure, dateLongue, nomComplet, nomFichierSur, taille } from '../lib/format'
import { EnteteEcran, Pied } from '../components/Layout'
import { Bandeau, Champ, Chargement, Modale, Vide, useAction, useToast } from '../components/UI'
import Icone from '../components/Icones'

const SANS_PROCEDURE = 'Documents généraux'

// Base juridique : consultation en ligne pour les membres et le CA ; dépôt et téléchargement par le Président
export default function Juridique() {
  const { roles } = useAuth()
  const [documents, setDocuments] = useState(null)
  const [f, setF] = useState({ procedure: '', q: '' })
  const [ouvert, setOuvert] = useState(null)
  const [depot, setDepot] = useState(false)

  async function charger() {
    const { data } = await supabase.from('documents_juridiques').select('*')
      .order('date_document', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
    setDocuments(data || [])
  }
  useEffect(() => { charger() }, [])

  const procedures = useMemo(() => [...new Set((documents || []).map((d) => d.procedure || SANS_PROCEDURE))].sort(), [documents])

  const groupes = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    const g = new Map()
    for (const d of documents || []) {
      const p = d.procedure || SANS_PROCEDURE
      if (f.procedure && p !== f.procedure) continue
      if (q && ![d.titre, d.description, d.procedure, CATEGORIES_JURIDIQUES[d.categorie]].some((x) => (x || '').toLowerCase().includes(q))) continue
      if (!g.has(p)) g.set(p, [])
      g.get(p).push(d)
    }
    return [...g.entries()].sort(([a], [b]) => (a === SANS_PROCEDURE) - (b === SANS_PROCEDURE) || a.localeCompare(b))
  }, [documents, f])

  return (
    <>
      <EnteteEcran titre="Base juridique." etiquette="Confidentiel"
        chapeau="Documents des procédures en cours avec notre avocat. Consultation en ligne uniquement : aucun téléchargement ni impression."
        actions={roles.president && (
          <button className="btn btn--principal" onClick={() => setDepot(true)}><Icone nom="plus" taille={20} />Déposer un document</button>
        )} />
      <section className="bande bande--neige" style={{ paddingTop: 32 }}>
        <div className="conteneur pile pile--large">
          {!roles.president && (
            <Bandeau type="info" icone="cadenas">
              Ces documents couverts par la confidentialité de la procédure sont réservés aux membres. Chaque page affiche votre nom et chaque consultation est enregistrée au journal.
            </Bandeau>
          )}
          <div className="filtres">
            <Champ libelle="Procédure" id="j-procedure">
              <select id="j-procedure" className="saisie" value={f.procedure} onChange={(e) => setF({ ...f, procedure: e.target.value })}>
                <option value="">Toutes les procédures</option>
                {procedures.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Champ>
            <Champ libelle="Recherche" id="j-q">
              <input id="j-q" className="saisie" type="search" placeholder="Titre, description" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
            </Champ>
          </div>

          {documents === null ? <Chargement /> : groupes.length === 0 ? (
            <div className="carte">
              <Vide icone="cadenas" titre={documents.length ? 'Aucun document pour ces filtres.' : 'Aucun document pour le moment.'}>
                {!documents.length && <p className="secondaire">{roles.president ? 'Déposez le premier document reçu de l\'avocat.' : 'Le Président dépose ici les documents reçus de l\'avocat.'}</p>}
              </Vide>
            </div>
          ) : groupes.map(([procedure, docs]) => (
            <div key={procedure} className="pile pile--serre">
              <h2 className="intertitre">{procedure}</h2>
              <div className="liste carte" style={{ padding: 0 }}>
                {docs.map((d) => (
                  <button key={d.id} className="liste__el" onClick={() => setOuvert(d)}>
                    <Icone nom="document" />
                    <span className="liste__corps">
                      <span className="liste__titre">{d.titre}</span>
                      <span className="liste__sous">
                        {CATEGORIES_JURIDIQUES[d.categorie]}{d.date_document ? ` · ${dateLongue(d.date_document)}` : ''} · {d.nb_pages} page{d.nb_pages > 1 ? 's' : ''}
                      </span>
                    </span>
                    <Icone nom="chevron" taille={18} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <Pied />
      {ouvert && <LecteurJuridique document={ouvert} onFermer={() => setOuvert(null)} onRetire={() => { setOuvert(null); charger() }} />}
      {depot && <DeposerDocumentJuridique procedures={procedures.filter((p) => p !== SANS_PROCEDURE)} onFermer={() => setDepot(false)} onDepose={charger} />}
    </>
  )
}

// Lecteur protégé : pages dessinées dans un canevas avec filigrane nominatif, sans fichier ni lien
function LecteurJuridique({ document: doc, onFermer, onRetire }) {
  const { profil, roles } = useAuth()
  const [page, setPage] = useState(1)
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(true)
  const [confirmer, setConfirmer] = useState(false)
  const [executer, enCours] = useAction()
  const canvas = useRef(null)
  const cache = useRef(new Map())
  const ouverture = useRef(new Date())

  useEffect(() => () => { cache.current.forEach((b) => b.close()); cache.current.clear() }, [])

  // raccourcis d'enregistrement et d'impression neutralisés pendant la consultation
  useEffect(() => {
    function clavier(e) {
      if ((e.metaKey || e.ctrlKey) && ['s', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
      if (e.key === 'ArrowRight') setPage((p) => Math.min(doc.nb_pages, p + 1))
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1))
    }
    window.addEventListener('keydown', clavier)
    return () => window.removeEventListener('keydown', clavier)
  }, [doc.nb_pages])

  useEffect(() => {
    let annule = false
    setErreur(''); setChargement(true)
    const deja = cache.current.get(page)
    ;(deja ? Promise.resolve(deja) : chargerPage(doc.id, page)).then((image) => {
      cache.current.set(page, image)
      if (annule || !canvas.current) return
      dessiner(canvas.current, image, `${nomComplet(profil)} · ${dateHeure(ouverture.current)} · consultation seule`)
      setChargement(false)
    }).catch((e) => { if (!annule) { setErreur(e.message); setChargement(false) } })
    return () => { annule = true }
  }, [doc.id, page, profil])

  async function telechargerOriginal() {
    await executer(async () => {
      const u = await urlSignee('juridique', doc.chemin, doc.nom_fichier)
      journaliser('telechargement', 'document_juridique', doc.id, { sha256: doc.sha256 })
      window.open(u, '_blank', 'noopener')
    })
  }

  async function retirer() {
    const r = await executer(async () => {
      verifier(await supabase.from('documents_juridiques').delete().eq('id', doc.id))
      const apercus = Array.from({ length: doc.nb_pages }, (_, i) => `${doc.id}/${i + 1}.jpg`)
      await supabase.storage.from('juridique-apercus').remove(apercus)
      await supabase.storage.from('juridique').remove([doc.chemin])
    }, 'Document retiré de la base juridique.')
    if (r !== undefined) onRetire()
  }

  const pied = (
    <>
      {roles.president && (confirmer ? (
        <>
          <span className="secondaire" style={{ alignSelf: 'center' }}>Retirer définitivement ce document ?</span>
          <button className="btn btn--tertiaire" onClick={() => setConfirmer(false)}>Annuler</button>
          <button className="btn btn--danger" disabled={enCours} onClick={retirer}>Retirer</button>
        </>
      ) : (
        <>
          <button className="btn btn--tertiaire" onClick={() => setConfirmer(true)}><Icone nom="corbeille" taille={18} />Retirer</button>
          <button className="btn btn--contour" disabled={enCours} onClick={telechargerOriginal}><Icone nom="telecharger" taille={18} />Télécharger l'original</button>
        </>
      ))}
      <button className="btn btn--secondaire" onClick={onFermer}>Fermer</button>
    </>
  )

  return (
    <Modale large titre={doc.titre} onFermer={onFermer} pied={pied}
      sousTitre={[doc.procedure, CATEGORIES_JURIDIQUES[doc.categorie], doc.date_document && dateLongue(doc.date_document)].filter(Boolean).join(' · ')}>
      {doc.description && <p>{doc.description}</p>}
      <div className="lecteur-protege" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        {erreur ? <Bandeau type="erreur">{erreur}</Bandeau> : (
          <>
            {chargement && <Chargement texte={`Page ${page}…`} />}
            <canvas ref={canvas} className="lecteur-protege__page" style={{ display: chargement ? 'none' : 'block' }} aria-label={`${doc.titre}, page ${page} sur ${doc.nb_pages}`} role="img" />
          </>
        )}
      </div>
      {doc.nb_pages > 1 && (
        <div className="ligne ligne--entre">
          <button className="btn btn--tertiaire" disabled={page === 1} onClick={() => setPage(page - 1)}><Icone nom="retour" taille={18} />Précédente</button>
          <span className="secondaire">Page {page} sur {doc.nb_pages}</span>
          <button className="btn btn--tertiaire" disabled={page === doc.nb_pages} onClick={() => setPage(page + 1)}>Suivante<Icone nom="chevron" taille={18} /></button>
        </div>
      )}
      {roles.president && <p className="petit secondaire">Original : {doc.nom_fichier} · {taille(doc.taille)} · SHA-256 <span className="mono">{doc.sha256.slice(0, 16)}…</span></p>}
    </Modale>
  )
}

function dessiner(canvas, image, filigrane) {
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const corps = Math.max(14, Math.round(image.width / 38))
  ctx.save()
  ctx.font = `600 ${corps}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(20, 30, 60, 0.13)'
  ctx.translate(image.width / 2, image.height / 2)
  ctx.rotate(-Math.PI / 6)
  const largeur = ctx.measureText(filigrane).width + corps * 3
  const etendue = Math.hypot(image.width, image.height)
  for (let y = -etendue / 2; y < etendue / 2; y += corps * 6) {
    const decalage = (Math.round(y / (corps * 6)) % 2) * (largeur / 2)
    for (let x = -etendue / 2 - largeur; x < etendue / 2; x += largeur) ctx.fillText(filigrane, x + decalage, y)
  }
  ctx.restore()
}

function DeposerDocumentJuridique({ procedures, onFermer, onDepose }) {
  const { utilisateur } = useAuth()
  const toast = useToast()
  const [fichier, setFichier] = useState(null)
  const [f, setF] = useState({ titre: '', procedure: '', categorie: 'acte', date_document: '', description: '' })
  const [erreur, setErreur] = useState('')
  const [etape, setEtape] = useState('')
  const maj = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function choisir(fi) {
    if (!fi) return
    setErreur('')
    setFichier(fi)
    if (!f.titre) setF((x) => ({ ...x, titre: fi.name.replace(/\.[^.]+$/, '') }))
  }

  async function deposer(e) {
    e.preventDefault()
    setErreur('')
    if (!fichier) return setErreur('Choisissez le document à déposer.')
    if (!MIMES_JURIDIQUE.includes(fichier.type)) return setErreur('Format non accepté : PDF, JPG ou PNG. Convertissez les documents Word en PDF.')
    if (fichier.size > TAILLE_MAX) return setErreur(`Fichier trop lourd (${taille(fichier.size)}) : 50 Mo au maximum.`)
    if (!f.titre.trim()) return setErreur('Indiquez un titre.')
    if (!f.date_document) return setErreur('Indiquez la date figurant sur le document.')

    const id = crypto.randomUUID()
    const chemin = `${id}/${nomFichierSur(fichier.name)}`
    const deposes = { juridique: [], 'juridique-apercus': [] }
    const envoyer = async (bucket, cheminFichier, blob, type) => {
      const { error } = await supabase.storage.from(bucket).upload(cheminFichier, blob, { contentType: type, upsert: false })
      if (error) throw new Error(messageErreur(error))
      deposes[bucket].push(cheminFichier)
    }
    try {
      setEtape('Préparation des pages…')
      const apercus = await genererApercus(fichier, (n, total) => setEtape(`Préparation des pages : ${n} sur ${total}…`))
      const empreinte = await sha256(fichier)
      setEtape('Envoi de l\'original…')
      await envoyer('juridique', chemin, fichier, fichier.type)
      for (let i = 0; i < apercus.length; i++) {
        setEtape(`Envoi des pages : ${i + 1} sur ${apercus.length}…`)
        await envoyer('juridique-apercus', `${id}/${i + 1}.jpg`, apercus[i], 'image/jpeg')
      }
      verifier(await supabase.from('documents_juridiques').insert({
        id, depose_par: utilisateur.id,
        titre: f.titre.trim(), procedure: f.procedure.trim() || null, categorie: f.categorie,
        date_document: f.date_document, description: f.description.trim() || null,
        chemin, nom_fichier: fichier.name, mime: fichier.type, taille: fichier.size, sha256: empreinte, nb_pages: apercus.length,
      }))
      toast('Document déposé. Les membres peuvent le consulter en ligne.')
      onDepose?.()
      onFermer()
    } catch (err) {
      // pas de fichiers orphelins si le dépôt échoue en cours de route
      for (const [bucket, chemins] of Object.entries(deposes)) if (chemins.length) await supabase.storage.from(bucket).remove(chemins)
      setErreur(err.message)
      setEtape('')
    }
  }

  return (
    <Modale titre="Déposer un document juridique" sousTitre="Les membres le consulteront en ligne, page par page. Vous seul pourrez télécharger l'original." onFermer={etape ? undefined : onFermer}
      pied={<>
        <button type="button" className="btn btn--tertiaire" disabled={!!etape} onClick={onFermer}>Annuler</button>
        <button type="submit" form="form-juridique" className="btn btn--principal" disabled={!!etape}>{etape || 'Déposer'}</button>
      </>}>
      <form id="form-juridique" className="formulaire" onSubmit={deposer}>
        {erreur && <Bandeau type="erreur">{erreur}</Bandeau>}
        <Champ libelle="Document" id="j-fichier" aide="PDF, JPG ou PNG · 50 Mo au maximum">
          <input id="j-fichier" className="saisie" type="file" accept={ACCEPT_JURIDIQUE} onChange={(e) => choisir(e.target.files?.[0])} />
        </Champ>
        {fichier && <p className="petit secondaire">{fichier.name} · {taille(fichier.size)}</p>}
        <Champ libelle="Titre" id="j-titre">
          <input id="j-titre" className="saisie" value={f.titre} onChange={maj('titre')} maxLength={200} required />
        </Champ>
        <Champ libelle="Procédure" id="j-proc" aide="Regroupe les documents d'une même affaire (ex. « Assignation du gestionnaire — TJ, RG 24/01234 »).">
          <input id="j-proc" className="saisie" list="j-procedures" value={f.procedure} onChange={maj('procedure')} maxLength={200} />
          <datalist id="j-procedures">{procedures.map((p) => <option key={p} value={p} />)}</datalist>
        </Champ>
        <div className="formulaire__ligne">
          <Champ libelle="Catégorie" id="j-cat">
            <select id="j-cat" className="saisie" value={f.categorie} onChange={maj('categorie')}>
              {Object.entries(CATEGORIES_JURIDIQUES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Champ>
          <Champ libelle="Date du document" id="j-date" aide="La date qui figure sur le document.">
            <input id="j-date" className="saisie" type="date" value={f.date_document} onChange={maj('date_document')} required />
          </Champ>
        </div>
        <Champ libelle="Description (facultatif)" id="j-desc">
          <textarea id="j-desc" className="saisie" rows={3} value={f.description} onChange={maj('description')} maxLength={2000} />
        </Champ>
      </form>
    </Modale>
  )
}
