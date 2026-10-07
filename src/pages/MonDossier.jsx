import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { TYPES_PIECE } from '../lib/constants'
import { dateLongue, enumerer } from '../lib/format'
import { EnteteEcran, Pied } from '../components/Layout'
import StatutPiece from '../components/Statut'
import { Chargement, Segment, Vide } from '../components/UI'
import Icone from '../components/Icones'
import DeposerPiece from '../components/DeposerPiece'
import FichePiece from '../components/FichePiece'

// Mon dossier : mes lots, mes pièces et leur statut (§4.6)
export default function MonDossier() {
  const { utilisateur } = useAuth()
  const [d, setD] = useState(null)
  const [depot, setDepot] = useState(null)
  const [fiche, setFiche] = useState(null)
  const [filtre, setFiltre] = useState('tous')

  async function charger() {
    const [lots, pieces] = await Promise.all([
      supabase.rpc('mes_lots'),
      supabase.from('pieces').select('*').eq('membre_id', utilisateur.id).order('created_at', { ascending: false }),
    ])
    setD({ lots: lots.data || [], pieces: pieces.data || [] })
  }
  useEffect(() => { charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const piecesActuelles = useMemo(() => (d?.pieces || []).filter((p) => !p.remplacee), [d])
  if (!d) return <Chargement />

  const piecesFiltrees = piecesActuelles.filter((p) => filtre === 'tous' || p.statut === filtre)
  const aReprendre = piecesActuelles.filter((p) => p.statut === 'a_completer' || p.statut === 'rejetee')

  return (
    <>
      <EnteteEcran titre="Mon dossier." chapeau={d.lots.map((l) => [`Lot ${l.numero} · appartement ${l.appartement}`, l.societe, enumerer(l.proprietaires)].filter(Boolean).join(' · ')).join(' — ') || 'Aucun lot rattaché'}
        actions={<button className="btn btn--principal btn--grand" onClick={() => setDepot({})}><Icone nom="appareil" taille={22} />Déposer une pièce</button>} />

      {aReprendre.length > 0 && (
        <div className="conteneur" style={{ marginBottom: 24 }}>
          <div className="carte carte--encre pile pile--serre">
            <p className="etiquette">{aReprendre.length} pièce{aReprendre.length > 1 ? 's' : ''} à reprendre</p>
            {aReprendre.map((p) => (
              <button key={p.id} className="ligne" style={{ background: 'none', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer', padding: '6px 0', font: 'inherit' }} onClick={() => setFiche(p)}>
                <strong>{TYPES_PIECE[p.type_piece]}</strong><span className="secondaire">{p.statut === 'rejetee' ? 'Rejetée' : 'À compléter'} · {p.motif}</span><span style={{ color: 'var(--soc-sombre-bleu-lien)' }}>Reprendre ›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="bande bande--neige">
        <div className="conteneur pile pile--large">
          <div className="ligne ligne--entre">
            <h2 className="titre-section">Mes pièces.</h2>
            <Segment etiquette="Filtrer par statut" defilant valeur={filtre} onChange={setFiltre}
              options={[['tous', 'Toutes'], ['deposee', 'En vérification'], ['verifiee', 'Vérifiées'], ['a_completer', 'À compléter'], ['rejetee', 'Rejetées']]} />
          </div>
          {piecesFiltrees.length === 0 ? <Vide titre="Aucune pièce." /> : (
            <div className="liste">
              {piecesFiltrees.map((p) => (
                <button key={p.id} className="liste__el" onClick={() => setFiche(p)}>
                  <Icone nom="document" taille={24} style={{ color: p.mime === 'application/pdf' ? 'var(--soc-rouge-rejet)' : 'var(--soc-texte-tertiaire)', flex: 'none' }} />
                  <span className="liste__corps">
                    <span className="liste__titre">{TYPES_PIECE[p.type_piece]}{p.version > 1 ? ` · v${p.version}` : ''}</span>
                    <span className="liste__sous">{p.description || p.nom_fichier} · déposée le {dateLongue(p.created_at)}</span>
                  </span>
                  <StatutPiece statut={p.statut} />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
      <Pied />

      {depot && <DeposerPiece typeInitial={depot.type} onFermer={() => setDepot(null)} onDepose={charger} />}
      {fiche && <FichePiece piece={fiche} onFermer={() => setFiche(null)} onChange={charger} />}
    </>
  )
}
