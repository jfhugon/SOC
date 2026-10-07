import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useMessagerie } from '../lib/messagerie'
import { supabase, rpc, urlSignee, journaliser } from '../lib/supabase'
import { TYPES_PIECE } from '../lib/constants'
import { dateHeure, dateLongue, nomComplet, taille } from '../lib/format'
import StatutPiece from './Statut'
import { Bandeau, Champ, Modale, useAction } from './UI'
import Icone from './Icones'
import DeposerPiece from './DeposerPiece'

// Détail d'une pièce : aperçu, horodatage, empreinte, versions ; vérification par le CA (US11)
export default function FichePiece({ piece, onFermer, onChange }) {
  const { utilisateur, roles } = useAuth()
  const { parId } = useMessagerie()
  const [url, setUrl] = useState(null)
  const [versions, setVersions] = useState([piece])
  const [conversationSource, setConversationSource] = useState(null)
  const [decision, setDecision] = useState(null) // 'a_completer' | 'rejetee'
  const [motif, setMotif] = useState('')
  const [nouvelleVersion, setNouvelleVersion] = useState(false)
  const [executer, enCours] = useAction()

  const mime = piece.mime || ''
  const apercuPdf = mime === 'application/pdf'
  const apercuImage = mime.startsWith('image/') && !/heic|heif/.test(mime)
  const sienne = piece.membre_id === utilisateur.id

  useEffect(() => {
    if (apercuPdf || apercuImage) urlSignee('pieces', piece.chemin).then(setUrl).catch(() => {})
    supabase.from('pieces').select('*').eq('membre_id', piece.membre_id).eq('type_piece', piece.type_piece).order('version')
      .then(({ data }) => {
        const toutes = data || []
        // remonte et descend la chaîne des versions de cette pièce
        const chaine = [piece]
        let p = piece
        while (p?.version_precedente) { p = toutes.find((x) => x.id === p.version_precedente); if (p) chaine.unshift(p) }
        p = piece
        while (p) { const suivante = toutes.find((x) => x.version_precedente === p.id); if (suivante) chaine.push(suivante); p = suivante }
        setVersions(chaine)
      })
    if (piece.message_source) {
      supabase.from('messages').select('conversation_id').eq('id', piece.message_source).maybeSingle()
        .then(({ data }) => setConversationSource(data?.conversation_id || null))
    }
  }, [piece, apercuPdf, apercuImage])

  async function telecharger() {
    const u = await urlSignee('pieces', piece.chemin, piece.nom_fichier)
    journaliser('telechargement', 'piece', piece.id, { sha256: piece.sha256 })
    window.open(u, '_blank', 'noopener')
  }

  async function decider(statut) {
    const r = await executer(() => rpc('verifier_piece', { p_piece: piece.id, p_statut: statut, p_motif: motif || null }),
      statut === 'verifiee' ? 'Pièce vérifiée.' : statut === 'a_completer' ? 'Pièce renvoyée à compléter.' : 'Pièce rejetée.')
    if (r !== undefined) { onChange?.(); onFermer() }
  }

  const peutVerifier = roles.ca && !sienne && !piece.remise_a_avocat && !piece.remplacee
  const peutRemplacer = sienne && !piece.remplacee && !piece.remise_a_avocat && ['a_completer', 'rejetee', 'deposee'].includes(piece.statut)

  if (nouvelleVersion) {
    return <DeposerPiece versionPrecedente={piece} onFermer={() => setNouvelleVersion(false)} onDepose={() => { onChange?.(); onFermer() }} />
  }

  return (
    <Modale large titre={TYPES_PIECE[piece.type_piece] || piece.type_piece} onFermer={onFermer}
      sousTitre={`${sienne ? 'Ma pièce' : nomComplet(parId[piece.membre_id])}${piece.date_document ? ' · document du ' + dateLongue(piece.date_document) : ''} · version ${piece.version}`}>
      <div className="ligne"><StatutPiece statut={piece.statut} motif={piece.motif} />{piece.remise_a_avocat && <span className="statut statut--neutre"><Icone nom="cadenas" taille={16} />Remise à l'avocat · figée</span>}{piece.remplacee && <span className="etiquette">Remplacée par une version plus récente</span>}</div>
      {sienne && roles.ca && <Bandeau type="info">Personne ne vérifie sa propre pièce : un autre membre du CA s'en chargera.</Bandeau>}

      <div className="grille-2" style={{ alignItems: 'start' }}>
        <div>
          {apercuPdf && url && <iframe className="apercu-doc" src={url} title={`Aperçu de ${piece.nom_fichier}`} />}
          {apercuImage && url && <img className="apercu-img" src={url} alt={piece.nom_fichier} />}
          {!apercuPdf && !apercuImage && (
            <div className="zone-depot"><Icone nom="document" taille={40} /><p>Aperçu indisponible pour ce format.</p></div>
          )}
          <button className="btn btn--tertiaire" style={{ marginTop: 12 }} onClick={() => executer(telecharger)}><Icone nom="telecharger" taille={18} />Télécharger l'original</button>
        </div>
        <div className="pile">
          <dl className="meta-liste">
            <dt>Fichier</dt><dd>{piece.nom_fichier} · {taille(piece.taille)}</dd>
            <dt>Déposé le</dt><dd>{dateHeure(piece.created_at)}</dd>
            {piece.description && <><dt>Description</dt><dd>{piece.description}</dd></>}
            <dt>SHA-256</dt><dd className="mono">{piece.sha256}</dd>
            {piece.verifie_le && <><dt>Vérification</dt><dd>{dateHeure(piece.verifie_le)}{parId[piece.verifie_par] ? ` · ${nomComplet(parId[piece.verifie_par])}` : ''}</dd></>}
            {piece.message_source && <><dt>Origine</dt><dd>{conversationSource ? <Link to={`/messages/${conversationSource}`}>Message d'origine ›</Link> : 'Messagerie'}</dd></>}
          </dl>
          {versions.length > 1 && (
            <div className="pile pile--serre">
              <p className="intertitre">Versions</p>
              {versions.map((v) => (
                <div key={v.id} className="ligne ligne--entre petit" style={{ fontWeight: v.id === piece.id ? 600 : 400 }}>
                  <span>Version {v.version} · {dateLongue(v.created_at)}</span>
                  <StatutPiece statut={v.statut} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {peutVerifier && !decision && (
        <div className="modale__pied" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn--secondaire" disabled={enCours} onClick={() => decider('verifiee')}><Icone nom="coche" taille={18} />Vérifiée</button>
          <button className="btn btn--alerte" onClick={() => setDecision('a_completer')}>À compléter</button>
          <button className="btn btn--danger" onClick={() => setDecision('rejetee')}>Rejeter</button>
        </div>
      )}
      {decision && (
        <div className="bloc formulaire">
          <Champ libelle={decision === 'a_completer' ? 'Que faut-il corriger ? (obligatoire)' : 'Motif du rejet (obligatoire)'} id="motif"
            aide="Dites quoi corriger : « page 2 illisible », « bail non signé »…">
            <textarea id="motif" className="saisie" rows={2} value={motif} onChange={(e) => setMotif(e.target.value)} autoFocus />
          </Champ>
          <div className="ligne">
            <button className="btn btn--tertiaire" onClick={() => setDecision(null)}>Annuler</button>
            <button className={`btn ${decision === 'rejetee' ? 'btn--danger' : 'btn--secondaire'}`} disabled={!motif.trim() || enCours} onClick={() => decider(decision)}>Confirmer</button>
          </div>
        </div>
      )}
      {peutRemplacer && (
        <div className="modale__pied" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn--principal" onClick={() => setNouvelleVersion(true)}>Déposer une nouvelle version</button>
        </div>
      )}
    </Modale>
  )
}
