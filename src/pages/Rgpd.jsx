import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const lignes = [
  ['Responsable de traitement', 'L\'association Spirit Of Centaure, représentée par son Président. L\'avocat agit en responsable de traitement distinct pour ses propres dossiers.'],
  ['Base légale', 'Exécution du contrat d\'adhésion (membres) ; intérêt légitime de défense en justice (dossiers juridiques).'],
  ['Données', 'Identité, coordonnées, lots. Les données de tiers figurant dans les pièces ne sont visibles que du cercle du dossier.'],
  ['Conservation', 'Messagerie : 3 ans. Pièces : durée de la procédure + 5 ans. Anciens membres anonymisés après 1 an.'],
  ['Vos droits', 'Export de vos données et de vos pièces, rectification, effacement — sauf pour les pièces remises à l\'avocat, conservées pour la défense en justice.'],
  ['Hébergement', 'Serveurs dans l\'Union européenne. Aucune donnée n\'est utilisée pour entraîner une IA.'],
  ['Sous-traitants', 'Hébergeur, envoi d\'e-mails, signature électronique, fournisseur IA : contrats conformes à l\'article 28 du RGPD.'],
  ['Confidentialité', 'Accès sur invitation uniquement. Le gestionnaire de la résidence n\'a jamais accès à l\'application.'],
]

export default function Rgpd() {
  const { session } = useAuth()
  return (
    <div style={{ background: 'var(--soc-neige)', minHeight: '100vh' }}>
      <div className="conteneur" style={{ padding: '56px 24px' }}>
        <p className="etiquette" style={{ marginBottom: 10 }}>Mention d'information</p>
        <h1 className="titre-ecran">Vos données.</h1>
        <p className="chapeau" style={{ marginTop: 12, maxWidth: 760 }}>Comment l'association Spirit Of Centaure traite vos informations personnelles.</p>
        <div className="tableau" style={{ marginTop: 32 }}>
          <table>
            <tbody>
              {lignes.map(([k, v]) => <tr key={k}><th scope="row" style={{ width: 220, background: 'var(--soc-neige)' }}>{k}</th><td>{v}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 24 }}><Link to={session ? '/profil' : '/connexion'}>{session ? 'Exporter mes données ›' : 'Retour à la connexion ›'}</Link></p>
      </div>
    </div>
  )
}
