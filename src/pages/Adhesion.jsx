import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { CadreAcces } from './Acces'

// Compte non activé ou refusé : seul l'administrateur global ouvre les accès
export default function Adhesion() {
  const { profil, deconnexion } = useAuth()
  const refuse = profil.statut === 'refuse'
  return (
    <CadreAcces>
      <div className="carte pile">
        <h1 className="titre-carte">{refuse ? 'Accès refusé.' : 'Compte pas encore activé.'}</h1>
        <p className="tertiaire">
          {refuse
            ? 'Votre accès à l\'application a été refusé par l\'association (art. 6 des statuts).'
            : 'Votre compte existe mais n\'a pas encore été activé. Contactez l\'administrateur de l\'association.'}
        </p>
        <button className="btn btn--tertiaire" onClick={deconnexion}>Se déconnecter</button>
      </div>
    </CadreAcces>
  )
}

// Membre inactif : lecture seule de son historique et export de ses données (§3)
export function Inactif() {
  const { deconnexion } = useAuth()
  return (
    <CadreAcces>
      <div className="carte pile">
        <h1 className="titre-carte">Compte inactif.</h1>
        <p className="tertiaire">Cotisation non renouvelée, démission ou cession du bien (art. 8) : vous n'avez plus accès au vote ni à la messagerie. Vous pouvez exporter vos données à tout moment.</p>
        <Link to="/profil" className="btn btn--tertiaire">Exporter mes données</Link>
        <button className="btn btn--lien" onClick={deconnexion}>Se déconnecter</button>
      </div>
    </CadreAcces>
  )
}
