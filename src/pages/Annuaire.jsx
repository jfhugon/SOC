import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useMessagerie } from '../lib/messagerie'
import { rpc } from '../lib/supabase'
import { nomComplet } from '../lib/format'
import { EnteteEcran, Pied } from '../components/Layout'
import { Avatar, Segment, Vide, useAction } from '../components/UI'
import Icone from '../components/Icones'

// US4 : annuaire ; téléphone et e-mail visibles seulement si le membre l'accepte
export default function Annuaire() {
  const { annuaire } = useMessagerie()
  const { utilisateur } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [vue, setVue] = useState('tous')
  const [executer] = useAction()

  const liste = annuaire.filter((p) => !p.est_avocat)
    .filter((p) => vue === 'tous' || p.est_ca)
    .filter((p) => `${p.prenom} ${p.nom} ${p.appartements || ''} ${p.role}`.toLowerCase().includes(q.trim().toLowerCase()))

  async function ecrire(p) {
    const id = await executer(() => rpc('ouvrir_conversation_privee', { p_autre: p.id }))
    if (id) navigate(`/messages/${id}`)
  }

  return (
    <>
      <EnteteEcran titre="Annuaire." chapeau={`${annuaire.filter((p) => !p.est_avocat).length} membres actifs. Les coordonnées n'apparaissent que si le membre l'a accepté.`} />
      <section className="bande bande--neige" style={{ paddingTop: 32 }}>
        <div className="conteneur pile pile--large">
          <div className="ligne">
            <input className="saisie" style={{ maxWidth: 420 }} type="search" placeholder="Nom, appartement ou rôle" aria-label="Rechercher un membre" value={q} onChange={(e) => setQ(e.target.value)} />
            <Segment etiquette="Filtre" valeur={vue} onChange={setVue} options={[['tous', 'Tous'], ['ca', 'Conseil d\'administration']]} />
          </div>
          {liste.length === 0 ? <div className="carte"><Vide icone="annuaire" titre="Aucun membre trouvé." /></div> : (
            <div className="liste">
              {liste.map((p) => (
                <div key={p.id} className="liste__el">
                  <Avatar personne={p} couleur={p.est_ca ? 'encre' : undefined} />
                  <span className="liste__corps">
                    <span className="liste__titre">{nomComplet(p)}{p.id === utilisateur.id ? ' (vous)' : ''}</span>
                    <span className="liste__sous">{[p.appartements && `Appt ${p.appartements}`, p.role !== 'Membre' && p.role].filter(Boolean).join(' · ') || 'Membre'}</span>
                    {(p.telephone || p.email) && (
                      <span className="petit" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                        {p.telephone && <a href={`tel:${p.telephone}`}>{p.telephone}</a>}
                        {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
                      </span>
                    )}
                  </span>
                  {p.id !== utilisateur.id && <button className="btn btn--tertiaire" onClick={() => ecrire(p)}><Icone nom="messages" taille={18} />Écrire</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
      <Pied />
    </>
  )
}
