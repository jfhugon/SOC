// Organigramme de l'association : conseil d'administration et écosystème.
// Photos : déposer un fichier `public/ca/<id>.jpg` (format carré conseillé) ; à défaut, les initiales s'affichent.

export const PRESIDENCE = [
  {
    id: 'jean-francois-hugon',
    nom: 'Jean-François Hugon',
    role: 'Président',
    pole: 'Vision, stratégie et arbitrage final',
    mission: 'Porte la vision de l\'association et fixe sa stratégie. Il représente Spirit Of Centaure, coordonne le conseil d\'administration et rend l\'arbitrage final sur les décisions engageant l\'association.',
  },
  {
    id: 'franck-coste',
    nom: 'Franck Coste',
    role: 'Vice-Président',
    pole: 'Stratégie financière',
    mission: 'Conduit l\'analyse financière de l\'association et soutient la sortie de CGH. Il seconde le Président et éclaire les choix du conseil par des éléments chiffrés.',
  },
]

export const BUREAU = [
  {
    id: 'sandra-herscher',
    nom: 'Sandra Herscher',
    role: 'Secrétaire',
    pole: 'Gouvernance administrative',
    mission: 'Rédige les procès-verbaux et les convocations, tient les archives de l\'association et veille à la conformité de son fonctionnement.',
  },
  {
    id: 'alexandre-beaudet',
    nom: 'Alexandre Beaudet',
    role: 'Trésorier',
    pole: 'Finances SOC',
    mission: 'Établit le budget, assure le suivi des dépenses et garantit la transparence financière de l\'association auprès de ses membres.',
  },
  {
    id: 'fabrice-goffin',
    nom: 'Fabrice Goffin',
    role: 'Responsable documentation',
    pole: 'Opérations, documentation et preuves',
    mission: 'Conçoit l\'architecture documentaire, indexe les pièces versées au coffre et mène un audit continu des preuves réunies pour les dossiers.',
  },
  {
    id: 'jack-dunning',
    nom: 'Jack Dunning',
    role: 'Responsable communication',
    pole: 'Communication et cohésion',
    mission: 'Assure la liaison transversale entre le conseil, les membres et les partenaires, et porte une communication bilingue français–anglais.',
  },
]

export const PARTENAIRES = [
  {
    id: 'pole-juridique',
    pole: 'Pôle juridique',
    nom: 'Me François Morabito',
    qualite: 'Avocat de l\'association',
    icone: 'balance',
    mission: 'Prépare et délivre les assignations, définit la stratégie contentieuse et assure le suivi local des procédures.',
  },
  {
    id: 'pole-technique',
    pole: 'Pôle technique',
    nom: 'Syndic / Conseil syndical',
    qualite: 'Interlocuteurs de la copropriété',
    icone: 'reglages',
    mission: 'Traite les incidents, organise les expertises et apporte le support technique nécessaire aux dossiers.',
  },
]
