// Types de pièces (US9)
export const TYPES_PIECE = {
  bail: 'Bail commercial',
  avenant: 'Avenant',
  releve_loyers: 'Relevé de loyers ou redevances',
  compte_rendu_gestion: 'Compte rendu de gestion',
  courrier: 'Courrier ou e-mail avec le gestionnaire',
  etat_des_lieux: 'État des lieux',
  photo: 'Photo',
  constat: 'Constat de commissaire de justice',
  facture: 'Facture',
  mandat: 'Mandat à l\'avocat',
  autorisation_agir: 'Autorisation d\'agir',
  autre: 'Autre document',
}

export const STATUTS_PIECE = {
  deposee: 'Déposée, en vérification',
  verifiee: 'Vérifiée',
  a_completer: 'À compléter',
  rejetee: 'Rejetée',
  manquante: 'Manquante',
}

export const FONCTIONS = {
  president: 'Président',
  vice_president: 'Vice-Président',
  secretaire: 'Secrétaire',
  tresorier: 'Trésorier',
}

// US9 : formats acceptés, 50 Mo par fichier
export const EXTENSIONS_ACCEPTEES = ['pdf', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'docx', 'xlsx', 'msg', 'eml']
export const ACCEPT_PIECES = EXTENSIONS_ACCEPTEES.map((e) => '.' + e).join(',')
export const TAILLE_MAX = 50 * 1024 * 1024

export const ACCEPT_MESSAGERIE = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,audio/*'
export const DUREE_VOCAL_MAX = 5 * 60 // secondes

export const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '✅']

// Base juridique : documents des procédures en cours avec l'avocat
export const CATEGORIES_JURIDIQUES = {
  acte: 'Acte de procédure',
  conclusions: 'Conclusions',
  decision: 'Jugement, ordonnance ou arrêt',
  correspondance: 'Correspondance de l\'avocat',
  note: 'Note ou consultation juridique',
  autre: 'Autre document',
}
export const ACCEPT_JURIDIQUE = '.pdf,.jpg,.jpeg,.png'
export const MIMES_JURIDIQUE = ['application/pdf', 'image/jpeg', 'image/png']
export const PAGES_JURIDIQUE_MAX = 300
