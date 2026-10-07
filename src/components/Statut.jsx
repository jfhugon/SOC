import { STATUTS_PIECE } from '../lib/constants'

// Un statut porte toujours un libellé et un pictogramme, jamais la couleur seule
const pictos = {
  verifiee: <path d="M3 8.5l3 3 7-7" />,
  deposee: <><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></>,
  a_completer: <><circle cx="8" cy="8" r="6" /><path d="M8 5v3.5M8 11v.01" /></>,
  rejetee: <><circle cx="8" cy="8" r="6" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" /></>,
}

export default function StatutPiece({ statut, libelle, motif }) {
  return (
    <span className={`statut statut--${statut}`} title={motif || undefined}>
      {statut === 'manquante' ? (
        <span style={{ width: 16, height: 16, border: '2px dashed #8e8e93', borderRadius: 999, boxSizing: 'border-box', flex: 'none' }} aria-hidden="true" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {pictos[statut]}
        </svg>
      )}
      {libelle ?? STATUTS_PIECE[statut]}{motif ? ` · ${motif}` : ''}
    </span>
  )
}
