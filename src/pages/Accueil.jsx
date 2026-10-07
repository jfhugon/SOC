import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useMessagerie } from '../lib/messagerie'
import { supabase } from '../lib/supabase'
import { enumerer, horodatageCourt, nomComplet } from '../lib/format'
import { TYPES_PIECE } from '../lib/constants'
import { EnteteEcran, Pied } from '../components/Layout'
import Icone from '../components/Icones'
import DeposerPiece from '../components/DeposerPiece'

// Écran d'accueil : annonces, conversations non lues, pièces à reprendre (§4.6)
export default function Accueil() {
  const { roles, utilisateur } = useAuth()
  const { conversations, parId } = useMessagerie()
  const [donnees, setDonnees] = useState(null)
  const [annonces, setAnnonces] = useState([])
  const [depot, setDepot] = useState(false)

  async function charger() {
    const [lots, pieces] = await Promise.all([
      supabase.rpc('mes_lots'),
      supabase.from('pieces').select('*').eq('membre_id', utilisateur.id).eq('remplacee', false),
    ])
    const d = { lots: lots.data || [], pieces: pieces.data || [] }
    if (roles.ca) {
      const aVerifier = await supabase.from('pieces').select('id', { count: 'exact', head: true }).eq('statut', 'deposee').eq('remplacee', false)
      d.aVerifier = aVerifier.count || 0
    }
    setDonnees(d)
  }

  useEffect(() => { charger() }, [roles.ca]) // eslint-disable-line react-hooks/exhaustive-deps

  const convAnnonces = conversations?.find((c) => c.type === 'annonces')
  useEffect(() => {
    if (!convAnnonces) return
    supabase.from('messages').select('*').eq('conversation_id', convAnnonces.id).is('supprime_le', null).is('masque_le', null)
      .order('created_at', { ascending: false }).limit(3).then(({ data }) => setAnnonces(data || []))
  }, [convAnnonces?.id, convAnnonces?.dernier_le]) // eslint-disable-line react-hooks/exhaustive-deps

  const nonLues = (conversations || []).filter((c) => c.non_lus > 0 && c.type !== 'annonces').slice(0, 4)
  // Pièces du membre rejetées ou à compléter
  const aReprendre = (donnees?.pieces || []).filter((p) => p.statut === 'a_completer' || p.statut === 'rejetee')
  const lots = donnees?.lots || []
  const titre = lots.length ? `Appartement${lots.length > 1 ? 's' : ''} ${lots.map((l) => l.appartement).join(', ')}.` : 'Accueil.'
  // Détention de chaque lot : société éventuelle, puis le ou les propriétaires
  const detention = lots.map((l) => [l.societe, enumerer(l.proprietaires)].filter(Boolean).join(' · ')).filter(Boolean).join(' — ')
  const roleLibelle = roles.avocat ? 'Avocat de l\'association' : parId[utilisateur.id]?.role && parId[utilisateur.id].role !== 'Membre' ? parId[utilisateur.id].role : 'Membre actif'

  return (
    <>
      <EnteteEcran etiquette={roleLibelle} titre={titre} chapeau={detention} />

      <section className="bande bande--neige">
        <div className="conteneur grille">
          {roles.membre && (
            <article className="carte pile pile--serre">
              {aReprendre.length > 0 ? <p className="etiquette">{aReprendre.length} pièce{aReprendre.length > 1 ? 's' : ''} à reprendre</p> : <p className="etiquette" style={{ color: 'var(--soc-texte-secondaire)' }}>Mon dossier</p>}
              <h2 className="titre-carte">{aReprendre.length ? 'Complétez votre dossier.' : `${donnees?.pieces.length || 0} pièce${donnees?.pieces.length > 1 ? 's' : ''} déposée${donnees?.pieces.length > 1 ? 's' : ''}.`}</h2>
              {aReprendre.slice(0, 3).map((p) => <p key={p.id} className="petit tertiaire">· {TYPES_PIECE[p.type_piece]} ({p.statut === 'rejetee' ? 'rejetée' : 'à compléter'})</p>)}
              <div className="ligne" style={{ marginTop: 12 }}>
                <button className="btn btn--principal" onClick={() => setDepot(true)}><Icone nom="appareil" taille={20} />Déposer une pièce</button>
                <Link to="/mon-dossier">Mon dossier ›</Link>
              </div>
            </article>
          )}

          {roles.ca && donnees && (
            <article className="carte pile pile--serre">
              <p className="etiquette">Conseil d'administration</p>
              <h2 className="titre-carte">À traiter.</h2>
              <Link to="/coffre" className="liste__el" style={{ padding: '12px 0', minHeight: 52 }}>
                <span className="liste__corps"><span className="liste__titre">{donnees.aVerifier} pièce{donnees.aVerifier > 1 ? 's' : ''} à vérifier</span></span><Icone nom="chevron" taille={18} />
              </Link>
              <Link to="/membres" className="liste__el" style={{ padding: '12px 0', minHeight: 52 }}>
                <span className="liste__corps"><span className="liste__titre">Registre des membres</span></span><Icone nom="chevron" taille={18} />
              </Link>
            </article>
          )}
        </div>
      </section>

      <section className="bande">
        <div className="conteneur grille-2">
          {roles.membre && (
            <article className="carte carte--neige pile">
              <div className="ligne ligne--entre"><h2 className="titre-carte">Annonces.</h2>{convAnnonces && <Link to={`/messages/${convAnnonces.id}`}>Tout voir ›</Link>}</div>
              {annonces.length === 0 && <p className="tertiaire">Aucune annonce du CA pour l'instant.</p>}
              {annonces.map((a) => (
                <div key={a.id} className="carte carte--compacte pile pile--serre">
                  <p className="petit secondaire">{nomComplet(parId[a.auteur_id])} · {horodatageCourt(a.created_at)}</p>
                  <p style={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.contenu || a.piece_jointe?.nom}</p>
                </div>
              ))}
            </article>
          )}
          <article className="carte carte--neige pile">
            <div className="ligne ligne--entre"><h2 className="titre-carte">Messages.</h2><Link to="/messages">Messagerie ›</Link></div>
            {nonLues.length === 0 && <p className="tertiaire">Vous êtes à jour : aucun message non lu.</p>}
            {nonLues.length > 0 && (
              <div className="liste">
                {nonLues.map((c) => (
                  <Link key={c.id} to={`/messages/${c.id}`} className="liste__el">
                    <span className="liste__corps"><span className="liste__titre">{c.titre}</span><span className="liste__sous">{c.dernier_message}</span></span>
                    <span className="pastille">{c.non_lus}</span>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
      <Pied />
      {depot && <DeposerPiece onFermer={() => setDepot(false)} onDepose={charger} />}
    </>
  )
}
