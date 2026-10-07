// Pictogrammes au trait, épaisseur 2 px, extrémités arrondies (charte)
const chemins = {
  accueil: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h5v-6h4v6h5V9" /></>,
  messages: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />,
  dossier: <><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" /></>,
  coffre: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3.5" /><path d="M12 8.5V7M12 17v-1.5M15.5 12H17M7 12h1.5" /></>,
  balance: <><path d="M12 3v18M7 21h10M5 7h14" /><path d="m5 7-3 7a3.5 3.5 0 0 0 6 0Z" /><path d="m19 7-3 7a3.5 3.5 0 0 0 6 0Z" /></>,
  membres: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  annuaire: <><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0" /></>,
  reglages: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  envoyer: <><path d="M12 19V5" /><path d="m5 12 7-7 7 7" /></>,
  trombone: <path d="m20.5 11.5-8.4 8.4a5.5 5.5 0 0 1-7.8-7.8l8.4-8.4a3.7 3.7 0 0 1 5.2 5.2l-8.4 8.4a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" />,
  micro: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
  recherche: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  epingle: <><path d="M9 3h6l-1 6 4 4H6l4-4Z" /><path d="M12 13v8" /></>,
  repondre: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  plus_actions: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  coche: <path d="M4 12.5 9 17.5 20 6.5" />,
  double_coche: <><path d="M2 12.5 7 17.5 18 6.5" /><path d="m11 16.5 1 1 11-11" /></>,
  appareil: <><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.8L9 4.5h6L16.7 7h2.8A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" /><circle cx="12" cy="13" r="3.8" /></>,
  telecharger: <><path d="M12 4v11M7 10.5l5 5 5-5M4 20h16" /></>,
  fermer: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  retour: <path d="m15 5-7 7 7 7" />,
  cloche: <><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  cloche_off: <><path d="M6 16V11a6 6 0 0 1 9.4-4.9M18 11v5l2 2H8" /><path d="M10 20.5a2 2 0 0 0 4 0M3 3l18 18" /></>,
  sortie: <><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15" /><path d="M10 16.5 14.5 12 10 7.5M14.5 12H4" /></>,
  cadenas: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  document: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  crayon: <><path d="M4 20h4L19 9l-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  corbeille: <><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5A1.5 1.5 0 0 0 8 21h8a1.5 1.5 0 0 0 1.5-1.5l1-12.5M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" /></>,
  oeil_barre: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c5.5 0 9 7 9 7a16 16 0 0 1-2.6 3.4M6.3 6.3C3.9 7.9 3 12 3 12s3.5 7 9 7a8.9 8.9 0 0 0 4.7-1.3" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  horloge: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alerte: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16v.01" /></>,
  bouclier: <><path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.4 7.5 9.5 4.3-1.1 7.5-5 7.5-9.5V6Z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  calendrier: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  coffre_ajout: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M12 11v6M9 14h6" /></>,
  utilisateur: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  megaphone: <><path d="M3 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l7 4.5v-15L7 9H4.5A1.5 1.5 0 0 0 3 10.5Z" /><path d="M18 9a4 4 0 0 1 0 6M7 15l1.5 5.5" /></>,
  groupe: <><circle cx="8" cy="9" r="3" /><circle cx="16.5" cy="9" r="3" /><path d="M2.5 19a5.5 5.5 0 0 1 11 0M13 14.3A5.5 5.5 0 0 1 21.5 19" /></>,
  envoi_relance: <><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4Z" /></>,
}

export default function Icone({ nom, taille = 22, epaisseur = 2, className, titre, ...reste }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={epaisseur}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={titre ? undefined : true}
      role={titre ? 'img' : undefined} {...reste}>
      {titre && <title>{titre}</title>}
      {chemins[nom]}
    </svg>
  )
}

// Monogramme : une montagne surmontée d'une étoile, suivi de « Centaure »
export function Monogramme({ taille = 28 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 26 L13 12 L17 18 L20.5 14 L28 26 Z" fill="none" stroke="#1d1d1f" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M16 3.2l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" fill="#0071e3" />
    </svg>
  )
}

export function IconeFichier({ mime, nom }) {
  const pdf = mime === 'application/pdf' || /\.pdf$/i.test(nom || '')
  const image = (mime || '').startsWith('image/')
  return (
    <span className="icone-fichier" style={{ color: pdf ? 'var(--soc-rouge-rejet)' : 'var(--soc-texte-tertiaire)' }}>
      <Icone nom={image ? 'appareil' : 'document'} taille={22} />
    </span>
  )
}
