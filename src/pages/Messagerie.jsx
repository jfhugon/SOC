import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useMessagerie, demanderNotifications } from '../lib/messagerie'
import { supabase, rpc, verifier, messageErreur, urlSignee, journaliser } from '../lib/supabase'
import { ACCEPT_MESSAGERIE, DUREE_VOCAL_MAX, REACTIONS, TAILLE_MAX } from '../lib/constants'
import { heure, horodatageCourt, jourMessage, nomComplet, nomFichierSur, taille } from '../lib/format'
import Icone from '../components/Icones'
import { Avatar, Champ, Chargement, Modale, Segment, useAction, useToast } from '../components/UI'
import DeposerPiece from '../components/DeposerPiece'

const ICONES_TYPE = { annonces: 'megaphone', tous: 'groupe', ca: 'bouclier', dossier: 'balance', avocat: 'cadenas', groupe: 'groupe' }
const SOUS_TITRES = {
  annonces: 'Canal du CA · lecture seule',
  tous: 'Tous les membres actifs',
  ca: 'Conseil d\'administration',
  dossier: 'Groupe du dossier juridique',
  avocat: 'Confidentiel · CA et avocat',
  groupe: 'Groupe',
  prive: 'Conversation privée',
}

function AvatarConv({ conv, parId }) {
  if (conv.type === 'prive') return <Avatar personne={parId[conv.interlocuteur]} nom={conv.titre} />
  const couleur = conv.type === 'annonces' ? 'encre' : conv.type === 'avocat' || conv.type === 'ca' ? 'encre' : undefined
  return <span className={`avatar${couleur ? ' avatar--' + couleur : ''}`}><Icone nom={ICONES_TYPE[conv.type] || 'groupe'} taille={22} /></span>
}

export default function Messagerie() {
  const { id } = useParams()
  const { conversations, parId } = useMessagerie()
  const { roles } = useAuth()
  const [nouvelle, setNouvelle] = useState(false)
  const [filtre, setFiltre] = useState('')

  const triees = useMemo(() => {
    const l = [...(conversations || [])]
    l.sort((a, b) => (a.type === 'annonces' ? -1 : b.type === 'annonces' ? 1 : 0))
    if (!filtre.trim()) return l
    const q = filtre.trim().toLowerCase()
    return l.filter((c) => (c.titre || '').toLowerCase().includes(q) || (c.dernier_message || '').toLowerCase().includes(q))
  }, [conversations, filtre])

  return (
    <div className={`messagerie${id ? ' messagerie--fil-ouvert' : ''}`}>
      <aside className="messagerie__liste" aria-label="Conversations">
        <div className="messagerie__entete">
          <div className="ligne ligne--entre">
            <h1 className="titre-carte">Messagerie.</h1>
            {roles.membre && (
              <button className="btn btn--principal btn--icone" onClick={() => setNouvelle(true)} aria-label="Nouveau message" title="Nouveau message">
                <Icone nom="crayon" taille={20} />
              </button>
            )}
          </div>
          <input className="saisie" type="search" placeholder="Rechercher une conversation" aria-label="Rechercher une conversation" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        </div>
        <div className="messagerie__convs">
          {conversations === null ? <Chargement /> : triees.length === 0 ? (
            <p className="secondaire" style={{ padding: 20 }}>Aucune conversation.</p>
          ) : triees.map((c) => (
            <Link key={c.id} to={`/messages/${c.id}`} className={`conv-el${c.id === id ? ' actif' : ''}${c.non_lus > 0 ? ' conv-el--non-lu' : ''}`}>
              <AvatarConv conv={c} parId={parId} />
              <div className="conv-el__corps">
                <div className="conv-el__ligne">
                  <span className="conv-el__titre">{c.titre || 'Conversation'}</span>
                  <span className="conv-el__heure">{horodatageCourt(c.dernier_le)}</span>
                </div>
                <div className="conv-el__ligne">
                  <span className="conv-el__apercu">
                    {c.dernier_message
                      ? `${c.type !== 'prive' && c.dernier_auteur ? (parId[c.dernier_auteur]?.prenom || 'Membre') + ' : ' : ''}${c.dernier_message}`
                      : SOUS_TITRES[c.type]}
                  </span>
                  <span className="ligne" style={{ gap: 4, flex: 'none' }}>
                    {c.notifications === 'muet' && <Icone nom="cloche_off" taille={16} titre="Muet" />}
                    {c.mentions_non_lues > 0 && <span className="pastille" title="Vous êtes mentionné">@</span>}
                    {c.non_lus > 0 && <span className="pastille" style={c.notifications === 'muet' ? { background: 'var(--soc-texte-secondaire)' } : undefined}>{c.non_lus}</span>}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </aside>
      {id ? <Fil key={id} id={id} /> : (
        <section className="fil">
          <div className="fil-vide">
            <Icone nom="messages" taille={48} epaisseur={1.6} />
            <p className="intertitre" style={{ color: 'var(--soc-encre)' }}>Choisissez une conversation.</p>
            <p>Les échanges restent entre membres vérifiés de l'association.</p>
          </div>
        </section>
      )}
      {nouvelle && <NouvelleConversation onFermer={() => setNouvelle(false)} />}
    </div>
  )
}

function NouvelleConversation({ onFermer }) {
  const { annuaire } = useMessagerie()
  const { utilisateur } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('prive')
  const [q, setQ] = useState('')
  const [titre, setTitre] = useState('')
  const [choisis, setChoisis] = useState([])
  const [executer, enCours] = useAction()
  const membres = annuaire.filter((p) => p.id !== utilisateur.id && !p.est_avocat
    && `${p.prenom} ${p.nom} ${p.appartements || ''}`.toLowerCase().includes(q.trim().toLowerCase()))

  async function ouvrir(p) {
    const id = await executer(() => rpc('ouvrir_conversation_privee', { p_autre: p.id }))
    if (id) { onFermer(); navigate(`/messages/${id}`) }
  }
  async function creer() {
    const id = await executer(() => rpc('creer_groupe', { p_titre: titre, p_membres: choisis }))
    if (id) { onFermer(); navigate(`/messages/${id}`) }
  }

  return (
    <Modale titre="Nouveau message." onFermer={onFermer}
      pied={mode === 'groupe' && <button className="btn btn--principal" disabled={!titre.trim() || !choisis.length || enCours} onClick={creer}>Créer le groupe ({choisis.length})</button>}>
      <Segment etiquette="Type de conversation" valeur={mode} onChange={setMode} options={[['prive', 'Message privé'], ['groupe', 'Nouveau groupe']]} />
      {mode === 'groupe' && (
        <Champ libelle="Nom du groupe" id="titre-groupe"><input id="titre-groupe" className="saisie" value={titre} onChange={(e) => setTitre(e.target.value)} /></Champ>
      )}
      <input className="saisie" type="search" placeholder="Nom ou appartement" aria-label="Rechercher un membre" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="liste" style={{ maxHeight: 360, overflowY: 'auto' }}>
        {membres.map((p) => mode === 'prive' ? (
          <button key={p.id} className="liste__el" onClick={() => ouvrir(p)} disabled={enCours}>
            <Avatar personne={p} />
            <span className="liste__corps"><span className="liste__titre">{nomComplet(p)}</span><span className="liste__sous">{[p.appartements && `Appt ${p.appartements}`, p.role].filter(Boolean).join(' · ')}</span></span>
            <Icone nom="chevron" taille={18} />
          </button>
        ) : (
          <label key={p.id} className="liste__el" style={{ cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 22, height: 22, accentColor: 'var(--soc-bleu-action)' }} checked={choisis.includes(p.id)}
              onChange={(e) => setChoisis(e.target.checked ? [...choisis, p.id] : choisis.filter((x) => x !== p.id))} />
            <Avatar personne={p} />
            <span className="liste__corps"><span className="liste__titre">{nomComplet(p)}</span><span className="liste__sous">{p.appartements ? `Appt ${p.appartements}` : p.role}</span></span>
          </label>
        ))}
        {!membres.length && <p className="secondaire" style={{ padding: 18 }}>Aucun membre trouvé.</p>}
      </div>
    </Modale>
  )
}

// ---------------------------------------------------------------------------
// Fil de conversation
// ---------------------------------------------------------------------------
const TAILLE_PAGE = 100

function Fil({ id }) {
  const { utilisateur, profil, roles } = useAuth()
  const { conversations, parId, rafraichir, definirConvOuverte } = useMessagerie()
  const navigate = useNavigate()
  const toast = useToast()
  const [executer] = useAction()
  const [conv, setConv] = useState(null)
  const [messages, setMessages] = useState(null)
  const [reactions, setReactions] = useState([])
  const [etats, setEtats] = useState([])
  const [membres, setMembres] = useState([])
  const [epingles, setEpingles] = useState([])
  const [plusAnciens, setPlusAnciens] = useState(false)
  const [frappe, setFrappe] = useState({})
  const [reponseA, setReponseA] = useState(null)
  const [edition, setEdition] = useState(null)
  const [recherche, setRecherche] = useState(false)
  const [versCoffre, setVersCoffre] = useState(null)
  const [lecteurs, setLecteurs] = useState(null)
  const [masquage, setMasquage] = useState(null)
  const canalRef = useRef(null)
  const derniereFrappe = useRef(0)
  const zoneRef = useRef(null)
  const enBas = useRef(true)

  const infosListe = conversations?.find((c) => c.id === id)

  const chargerReactions = useCallback(async (ids) => {
    if (!ids.length) return setReactions([])
    const { data } = await supabase.from('message_reactions').select('*').in('message_id', ids)
    setReactions(data || [])
  }, [])

  const chargerEtats = useCallback(async () => {
    const { data } = await supabase.from('conversation_etats').select('*').eq('conversation_id', id)
    setEtats(data || [])
  }, [id])

  const chargerEpingles = useCallback(async () => {
    const { data } = await supabase.from('messages').select('id, contenu, piece_jointe, auteur_id, created_at').eq('conversation_id', id).eq('epingle', true).order('created_at', { ascending: false })
    setEpingles(data || [])
  }, [id])

  const marquerLu = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    rpc('marquer_lu', { p_conversation: id }).then(rafraichir).catch(() => {})
  }, [id, rafraichir])

  useEffect(() => {
    definirConvOuverte(id)
    let annule = false
    async function charger() {
      const [c, m, mb] = await Promise.all([
        supabase.from('conversations').select('*').eq('id', id).maybeSingle(),
        supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: false }).limit(TAILLE_PAGE),
        supabase.from('conversation_membres').select('membre_id').eq('conversation_id', id),
      ])
      if (annule) return
      if (!c.data) { setConv(false); return }
      setConv(c.data)
      const liste = (m.data || []).reverse()
      setMessages(liste)
      setPlusAnciens((m.data || []).length === TAILLE_PAGE)
      setMembres((mb.data || []).map((x) => x.membre_id))
      chargerReactions(liste.map((x) => x.id))
      chargerEtats()
      chargerEpingles()
      marquerLu()
    }
    charger()
    return () => { annule = true; definirConvOuverte(null) }
  }, [id, chargerReactions, chargerEtats, chargerEpingles, marquerLu, definirConvOuverte])

  // Temps réel : messages, réactions, accusés de lecture, « en train d'écrire »
  useEffect(() => {
    let canal
    let actif = true
    ;(async () => {
      // canal privé : le jeton de session doit être transmis au serveur Realtime
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.realtime.setAuth(session?.access_token ?? null)
      if (!actif) return
      canal = supabase.channel(`conv:${id}`, { config: { private: true, broadcast: { self: false } } })
        .on('broadcast', { event: 'frappe' }, ({ payload }) => {
          if (payload?.id === utilisateur.id) return
          setFrappe((f) => ({ ...f, [payload.id]: Date.now() }))
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, ({ new: m }) => {
          setMessages((l) => (l && !l.some((x) => x.id === m.id) ? [...l, m] : l))
          setFrappe((f) => { const g = { ...f }; delete g[m.auteur_id]; return g })
          if (m.auteur_id !== utilisateur.id) marquerLu()
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` }, ({ new: m }) => {
          setMessages((l) => l?.map((x) => (x.id === m.id ? m : x)))
          chargerEpingles()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
          setMessages((l) => { if (l) chargerReactions(l.map((x) => x.id)); return l })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_etats', filter: `conversation_id=eq.${id}` }, chargerEtats)
        .subscribe()
      canalRef.current = canal
    })()
    const vis = () => marquerLu()
    document.addEventListener('visibilitychange', vis)
    return () => {
      actif = false
      document.removeEventListener('visibilitychange', vis)
      if (canal) supabase.removeChannel(canal)
      canalRef.current = null
    }
  }, [id, utilisateur.id, marquerLu, chargerReactions, chargerEtats, chargerEpingles])

  // L'indicateur « en train d'écrire » s'efface après 4 s
  useEffect(() => {
    const t = setInterval(() => setFrappe((f) => {
      const g = Object.fromEntries(Object.entries(f).filter(([, ts]) => Date.now() - ts < 4000))
      return Object.keys(g).length === Object.keys(f).length ? f : g
    }), 1000)
    return () => clearInterval(t)
  }, [])

  // Défilement automatique en bas si l'utilisateur y était déjà
  useEffect(() => {
    const z = zoneRef.current
    if (z && enBas.current) z.scrollTop = z.scrollHeight
  }, [messages])

  async function chargerPrecedents() {
    const premier = messages?.[0]
    if (!premier) return
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).lt('created_at', premier.created_at).order('created_at', { ascending: false }).limit(TAILLE_PAGE)
    const anciens = (data || []).reverse()
    enBas.current = false
    setMessages((l) => [...anciens, ...l])
    setPlusAnciens((data || []).length === TAILLE_PAGE)
    chargerReactions([...anciens, ...messages].map((x) => x.id))
  }

  function signalerFrappe() {
    const c = canalRef.current
    if (!c) return
    const maintenant = Date.now()
    if (maintenant - derniereFrappe.current < 2000) return
    derniereFrappe.current = maintenant
    c.send({ type: 'broadcast', event: 'frappe', payload: { id: utilisateur.id } })
  }

  function allerAuMessage(mid) {
    const el = document.getElementById(`msg-${mid}`)
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.animate?.([{ opacity: .4 }, { opacity: 1 }], { duration: 900 }) }
    else toast('Message plus ancien : utilisez « Charger les messages précédents ».')
  }

  async function ajouterAuCoffre(m) {
    await executer(async () => {
      const { data, error } = await supabase.storage.from('messagerie').download(m.piece_jointe.chemin)
      if (error) throw new Error(messageErreur(error))
      setVersCoffre({ fichier: new File([data], m.piece_jointe.nom, { type: m.piece_jointe.mime || data.type }), message: m.id })
    })
  }

  if (conv === false) return <section className="fil"><div className="fil-vide"><p>Conversation introuvable ou accès retiré.</p><Link to="/messages">Retour</Link></div></section>
  if (!conv || !messages) return <section className="fil"><Chargement /></section>

  const titre = infosListe?.titre || conv.titre || 'Conversation'
  const suspendu = profil?.suspendu_jusqu_a && new Date(profil.suspendu_jusqu_a) > new Date()
  const lectureSeule = conv.type === 'annonces' && !roles.ca
  const autres = (conv.type === 'prive' || conv.type === 'groupe') ? membres.filter((x) => x !== utilisateur.id) : null
  const peutEpingler = roles.ca || conv.type === 'prive' || conv.type === 'groupe'
  const quiEcrit = Object.keys(frappe).map((x) => parId[x]?.prenom || 'Quelqu\'un')
  const parMessage = messages.reduce((acc, m) => { acc[m.id] = m; return acc }, {})

  function accuse(m) {
    if (m.auteur_id !== utilisateur.id) return null
    const lusPar = etats.filter((e) => e.membre_id !== utilisateur.id && e.lu_jusqu_a && e.lu_jusqu_a >= m.created_at)
    const recusPar = etats.filter((e) => e.membre_id !== utilisateur.id && e.recu_jusqu_a && e.recu_jusqu_a >= m.created_at)
    if (conv.type === 'prive') {
      if (lusPar.length) return <span className="lu" title="Lu"><Icone nom="double_coche" taille={16} /> Lu</span>
      if (recusPar.length) return <span title="Distribué"><Icone nom="double_coche" taille={16} /> Distribué</span>
      return <span title="Envoyé"><Icone nom="coche" taille={16} /> Envoyé</span>
    }
    const total = autres ? autres.length : null
    const texte = lusPar.length ? `Lu par ${lusPar.length}${total ? ' sur ' + total : ''}` : recusPar.length ? 'Distribué' : 'Envoyé'
    if (conv.type === 'annonces' && roles.ca) {
      return <button className="btn btn--lien" style={{ minHeight: 28, padding: 0, fontSize: 14 }} onClick={() => setLecteurs(m)}>{texte}</button>
    }
    return <span className={lusPar.length ? 'lu' : undefined}>{texte}</span>
  }

  return (
    <section className="fil" aria-label={`Conversation ${titre}`}>
      <header className="fil__entete">
        <button className="btn btn--tertiaire btn--icone fil__retour" onClick={() => navigate('/messages')} aria-label="Retour aux conversations"><Icone nom="retour" taille={20} /></button>
        <AvatarConv conv={{ ...conv, titre, interlocuteur: infosListe?.interlocuteur }} parId={parId} />
        <div className="fil__titre">
          <strong>{titre}</strong>
          <span>{autres ? `${autres.length + 1} participants` : SOUS_TITRES[conv.type]}</span>
        </div>
        <button className="btn btn--tertiaire btn--icone" onClick={() => setRecherche((x) => !x)} aria-label="Rechercher dans la conversation" aria-pressed={recherche}><Icone nom="recherche" taille={20} /></button>
        <ReglageNotifications conv={id} mode={infosListe?.notifications || 'tous'} onChange={rafraichir} />
      </header>

      {recherche && <Recherche convId={id} parId={parId} onAller={allerAuMessage} onFermer={() => setRecherche(false)} />}

      {epingles.length > 0 && (
        <button className="fil__epingles" style={{ border: 0, borderBottom: '1px solid var(--soc-bordure)', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => allerAuMessage(epingles[0].id)}>
          <Icone nom="epingle" taille={18} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong>Épinglé{epingles.length > 1 ? ` (${epingles.length})` : ''} · </strong>{epingles[0].contenu || epingles[0].piece_jointe?.nom}
          </span>
        </button>
      )}

      <div className="fil__messages" ref={zoneRef} onScroll={(e) => { const z = e.currentTarget; enBas.current = z.scrollHeight - z.scrollTop - z.clientHeight < 80 }}>
        {plusAnciens && <button className="btn btn--tertiaire" style={{ alignSelf: 'center', background: '#fff' }} onClick={chargerPrecedents}>Charger les messages précédents</button>}
        {['tous', 'groupe', 'dossier', 'prive'].includes(conv.type) && (
          <p className="fil__rappel">Échanges réservés aux membres vérifiés. Rappel : aucune discussion politique ou confessionnelle (art. 2 des statuts).</p>
        )}
        {conv.type === 'avocat' && <p className="fil__rappel"><Icone nom="cadenas" taille={14} /> Conversation confidentielle, invisible des autres membres.</p>}
        {messages.length === 0 && <p className="fil__rappel">Aucun message pour l'instant.</p>}
        {messages.map((m, i) => {
          const prec = messages[i - 1]
          const nouveauJour = !prec || new Date(prec.created_at).toDateString() !== new Date(m.created_at).toDateString()
          const suite = !nouveauJour && prec && prec.auteur_id === m.auteur_id && new Date(m.created_at) - new Date(prec.created_at) < 5 * 60000
          return (
            <Fragment key={m.id}>
              {nouveauJour && <span className="fil__jour">{jourMessage(m.created_at)}</span>}
              <Message
                m={m} moi={m.auteur_id === utilisateur.id} suite={suite} afficherAuteur={conv.type !== 'prive' && !suite}
                auteur={parId[m.auteur_id]} parId={parId} cite={m.reponse_a ? parMessage[m.reponse_a] : null}
                reactions={reactions.filter((r) => r.message_id === m.id)} utilisateurId={utilisateur.id}
                accuse={accuse(m)}
                actions={{
                  peutReagir: !suspendu,
                  peutRepondre: !lectureSeule && !suspendu,
                  peutEpingler: peutEpingler,
                  peutMasquer: roles.ca,
                  peutCoffre: roles.membre && !!m.piece_jointe,
                  repondre: () => setReponseA(m),
                  modifier: () => setEdition(m),
                  supprimer: () => window.confirm('Supprimer ce message pour tout le monde ?') && executer(() => rpc('supprimer_message', { p_message: m.id })),
                  epingler: () => executer(() => rpc('epingler_message', { p_message: m.id, p_epingle: !m.epingle }), m.epingle ? 'Message désépinglé.' : 'Message épinglé.'),
                  masquer: () => setMasquage(m),
                  coffre: () => ajouterAuCoffre(m),
                  reagir: async (emoji) => {
                    const mienne = reactions.find((r) => r.message_id === m.id && r.membre_id === utilisateur.id && r.emoji === emoji)
                    await executer(async () => {
                      if (mienne) verifier(await supabase.from('message_reactions').delete().match({ message_id: m.id, membre_id: utilisateur.id, emoji }))
                      else verifier(await supabase.from('message_reactions').insert({ message_id: m.id, membre_id: utilisateur.id, emoji }))
                    })
                    chargerReactions(messages.map((x) => x.id))
                  },
                  allerA: allerAuMessage,
                }}
              />
            </Fragment>
          )
        })}
      </div>
      <div className="fil__frappe" aria-live="polite">{quiEcrit.length ? `${quiEcrit.join(', ')} ${quiEcrit.length > 1 ? 'écrivent' : 'écrit'}…` : ''}</div>

      {lectureSeule ? (
        <div className="saisie-msg"><p className="secondaire" style={{ textAlign: 'center', padding: 10 }}>Canal en lecture seule. Vous pouvez réagir aux annonces.</p></div>
      ) : suspendu ? (
        <div className="saisie-msg"><p className="secondaire" style={{ textAlign: 'center', padding: 10 }}>Votre accès à l'écriture est suspendu par le CA jusqu'au {new Date(profil.suspendu_jusqu_a).toLocaleDateString('fr-FR')}.</p></div>
      ) : (
        <Composer conv={conv} membresConv={autres} reponseA={reponseA} edition={edition}
          annulerContexte={() => { setReponseA(null); setEdition(null) }}
          onFrappe={signalerFrappe} onEnvoye={() => { enBas.current = true; setReponseA(null); setEdition(null) }} />
      )}

      {versCoffre && <DeposerPiece fichierInitial={versCoffre.fichier} messageSource={versCoffre.message} onFermer={() => setVersCoffre(null)} />}
      {lecteurs && <Lecteurs message={lecteurs} etats={etats} parId={parId} onFermer={() => setLecteurs(null)} />}
      {masquage && <Masquer message={masquage} auteur={parId[masquage.auteur_id]} onFermer={() => setMasquage(null)} />}
    </section>
  )
}

function ReglageNotifications({ conv, mode, onChange }) {
  const [ouvert, setOuvert] = useState(false)
  const [executer] = useAction()
  async function choisir(m) {
    setOuvert(false)
    if (m !== 'muet') await demanderNotifications()
    await executer(() => rpc('regler_notifications', { p_conversation: conv, p_mode: m }))
    onChange()
  }
  return (
    <div style={{ position: 'relative' }}>
      <button className="btn btn--tertiaire btn--icone" aria-haspopup="menu" aria-expanded={ouvert} onClick={() => setOuvert((x) => !x)} aria-label="Notifications de la conversation">
        <Icone nom={mode === 'muet' ? 'cloche_off' : 'cloche'} taille={20} />
      </button>
      {ouvert && (
        <div className="menu" role="menu" style={{ right: 0, left: 'auto', top: 48 }}>
          {[['tous', 'Tous les messages'], ['mentions', 'Mentions seulement'], ['muet', 'Muet']].map(([k, v]) => (
            <button key={k} role="menuitemradio" aria-checked={mode === k} onClick={() => choisir(k)}>
              <span style={{ width: 18 }}>{mode === k && <Icone nom="coche" taille={18} />}</span>{v}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------
function texteAvecMentions(texte, mentions, parId, moi) {
  const noms = (mentions || []).map((id) => '@' + nomComplet(parId[id])).filter((n) => n.length > 1)
  const motifs = [...noms.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'https?://[^\\s]+']
  const re = new RegExp(`(${motifs.join('|')})`, 'g')
  return texte.split(re).map((part, i) => {
    if (noms.includes(part)) return <span key={i} className="bulle__mention">{part}</span>
    if (/^https?:\/\//.test(part)) return <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    return <Fragment key={i}>{part}</Fragment>
  })
}

function Message({ m, moi, suite, afficherAuteur, auteur, parId, cite, reactions, utilisateurId, accuse, actions }) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef(null)
  const retire = m.supprime_le || m.masque_le

  useEffect(() => {
    if (!menu) return
    const fermer = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false) }
    document.addEventListener('mousedown', fermer)
    return () => document.removeEventListener('mousedown', fermer)
  }, [menu])

  const groupes = reactions.reduce((acc, r) => { (acc[r.emoji] ||= []).push(r.membre_id); return acc }, {})
  const action = (fn) => () => { setMenu(false); fn() }

  return (
    <div id={`msg-${m.id}`} className={`msg${moi ? ' msg--moi' : ''}${suite ? ' msg--suite' : ''}`}>
      {afficherAuteur && !moi && <span className="msg__auteur">{nomComplet(auteur)}{auteur?.role && auteur.role !== 'Membre' ? ` · ${auteur.role}` : ''}</span>}
      <div style={{ position: 'relative' }} ref={menuRef}>
        {retire ? (
          <div className="bulle bulle--retire">{m.masque_le ? 'Message masqué par le CA' : 'Message supprimé'}</div>
        ) : (
          <div className="bulle">
            {m.epingle && <Icone nom="epingle" taille={14} style={{ float: 'right', marginLeft: 6, opacity: .7 }} titre="Épinglé" />}
            {cite && (
              <button type="button" className="bulle__citation" style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => actions.allerA(cite.id)}>
                <strong>{nomComplet(parId[cite.auteur_id])}</strong><br />
                {(cite.contenu || cite.piece_jointe?.nom || 'Message retiré').slice(0, 140)}
              </button>
            )}
            {m.piece_jointe && <PieceJointe pj={m.piece_jointe} />}
            {m.contenu && <div style={m.piece_jointe ? { marginTop: 8 } : undefined}>{texteAvecMentions(m.contenu, m.mentions, parId, moi)}</div>}
          </div>
        )}
        {!retire && (
          <button className="btn btn--tertiaire btn--icone msg__actions-btn" style={{ minHeight: 32, width: 32, background: '#fff' }}
            aria-label="Actions sur le message" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((x) => !x)}>
            <Icone nom="plus_actions" taille={18} />
          </button>
        )}
        {menu && (
          <div className="menu" role="menu">
            {actions.peutReagir && (
              <div className="menu__emojis">
                {REACTIONS.map((e) => <button key={e} role="menuitem" aria-label={`Réagir ${e}`} onClick={action(() => actions.reagir(e))}>{e}</button>)}
              </div>
            )}
            {actions.peutRepondre && <button role="menuitem" onClick={action(actions.repondre)}><Icone nom="repondre" taille={18} />Répondre</button>}
            {moi && m.contenu && actions.peutRepondre && <button role="menuitem" onClick={action(actions.modifier)}><Icone nom="crayon" taille={18} />Modifier</button>}
            {actions.peutCoffre && <button role="menuitem" onClick={action(actions.coffre)}><Icone nom="coffre_ajout" taille={18} />Ajouter au coffre</button>}
            {actions.peutEpingler && <button role="menuitem" onClick={action(actions.epingler)}><Icone nom="epingle" taille={18} />{m.epingle ? 'Désépingler' : 'Épingler'}</button>}
            {m.contenu && <button role="menuitem" onClick={action(() => navigator.clipboard?.writeText(m.contenu))}><Icone nom="document" taille={18} />Copier le texte</button>}
            {moi && <button role="menuitem" style={{ color: 'var(--soc-rouge-rejet)' }} onClick={action(actions.supprimer)}><Icone nom="corbeille" taille={18} />Supprimer</button>}
            {actions.peutMasquer && !moi && <button role="menuitem" style={{ color: 'var(--soc-orange-alerte)' }} onClick={action(actions.masquer)}><Icone nom="oeil_barre" taille={18} />Masquer (modération)</button>}
          </div>
        )}
      </div>
      {Object.keys(groupes).length > 0 && (
        <div className="msg__reactions">
          {Object.entries(groupes).map(([emoji, qui]) => (
            <button key={emoji} className={`reaction${qui.includes(utilisateurId) ? ' moi' : ''}`} onClick={() => actions.peutReagir && actions.reagir(emoji)}
              title={qui.map((x) => nomComplet(parId[x])).join(', ')} aria-label={`${emoji} ${qui.length}`}>
              {emoji} {qui.length > 1 ? qui.length : ''}
            </button>
          ))}
        </div>
      )}
      {(!suite || moi) && (
        <span className="msg__meta">
          {heure(m.created_at)}{m.modifie_le && !retire ? ' · modifié' : ''}
          {accuse && <> · {accuse}</>}
        </span>
      )}
    </div>
  )
}

function PieceJointe({ pj }) {
  const [url, setUrl] = useState(null)
  const image = (pj.mime || '').startsWith('image/') && !/heic|heif/i.test(pj.mime)
  const audio = (pj.mime || '').startsWith('audio/')
  useEffect(() => {
    if (image || audio) urlSignee('messagerie', pj.chemin).then(setUrl).catch(() => {})
  }, [pj.chemin, image, audio])

  async function ouvrir(e) {
    e.preventDefault()
    try {
      const u = await urlSignee('messagerie', pj.chemin, pj.nom)
      journaliser('telechargement', 'piece_jointe', pj.chemin)
      window.open(u, '_blank', 'noopener')
    } catch { /* accès refusé */ }
  }

  if (image) return url ? <a href={url} target="_blank" rel="noopener noreferrer"><img className="pj-image" src={url} alt={pj.nom} loading="lazy" /></a> : <div className="pj">Image…</div>
  if (audio) return <div><span className="petit" style={{ display: 'block', marginBottom: 4 }}>Message vocal{pj.duree ? ` · ${Math.floor(pj.duree / 60)}:${String(pj.duree % 60).padStart(2, '0')}` : ''}</span>{url && <audio className="pj-audio" controls src={url} preload="metadata" />}</div>
  return (
    <a href="#" className="pj" onClick={ouvrir}>
      <Icone nom="document" taille={28} style={{ color: /pdf/i.test(pj.mime || pj.nom) ? 'var(--soc-rouge-rejet)' : undefined, flex: 'none' }} />
      <span><span className="pj__nom">{pj.nom}</span><br /><span className="pj__taille">{taille(pj.taille)} · Ouvrir</span></span>
    </a>
  )
}

// ---------------------------------------------------------------------------
// Saisie : texte, mentions, pièces jointes, message vocal
// ---------------------------------------------------------------------------
function Composer({ conv, membresConv, reponseA, edition, annulerContexte, onFrappe, onEnvoye }) {
  const { utilisateur } = useAuth()
  const { annuaire, parId } = useMessagerie()
  const toast = useToast()
  const [texte, setTexte] = useState('')
  const [mentions, setMentions] = useState([])
  const [suggestion, setSuggestion] = useState(null) // { debut, requete }
  const [indexSugg, setIndexSugg] = useState(0)
  const [envoi, setEnvoi] = useState(false)
  const [enregistrement, setEnregistrement] = useState(null)
  const zone = useRef(null)
  const fichierRef = useRef(null)

  useEffect(() => {
    if (edition) { setTexte(edition.contenu || ''); setMentions(edition.mentions || []); zone.current?.focus() }
  }, [edition])
  useEffect(() => { if (reponseA) zone.current?.focus() }, [reponseA])

  useEffect(() => {
    const z = zone.current
    if (!z) return
    z.style.height = 'auto'
    z.style.height = Math.min(z.scrollHeight, 160) + 'px'
  }, [texte])

  const candidats = useMemo(() => {
    if (!suggestion) return []
    const base = membresConv ? annuaire.filter((p) => membresConv.includes(p.id)) : annuaire.filter((p) => !p.est_avocat || conv.type === 'avocat')
    const q = suggestion.requete.toLowerCase()
    return base.filter((p) => p.id !== utilisateur.id && nomComplet(p).toLowerCase().includes(q)).slice(0, 8)
  }, [suggestion, annuaire, membresConv, utilisateur.id, conv.type])

  function changer(e) {
    const v = e.target.value
    setTexte(v)
    onFrappe()
    const curseur = e.target.selectionStart
    const avant = v.slice(0, curseur)
    const m = /(^|\s)@([^\s@]{0,30})$/.exec(avant)
    setSuggestion(m ? { debut: curseur - m[2].length - 1, requete: m[2] } : null)
    setIndexSugg(0)
  }

  function choisirMention(p) {
    const nom = '@' + nomComplet(p) + ' '
    const curseur = zone.current.selectionStart
    const v = texte.slice(0, suggestion.debut) + nom + texte.slice(curseur)
    setTexte(v)
    setMentions((x) => [...new Set([...x, p.id])])
    setSuggestion(null)
    requestAnimationFrame(() => { const pos = suggestion.debut + nom.length; zone.current?.setSelectionRange(pos, pos); zone.current?.focus() })
  }

  function clavier(e) {
    if (suggestion && candidats.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndexSugg((i) => (i + 1) % candidats.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndexSugg((i) => (i - 1 + candidats.length) % candidats.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choisirMention(candidats[indexSugg]); return }
      if (e.key === 'Escape') { setSuggestion(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(hover: hover)').matches) {
      e.preventDefault(); envoyer()
    }
    if (e.key === 'Escape' && (reponseA || edition)) { annulerContexte(); setTexte('') }
  }

  async function envoyer(pieceJointe) {
    const contenu = texte.trim()
    if (!contenu && !pieceJointe) return
    const mentionsValides = mentions.filter((id) => contenu.includes('@' + nomComplet(parId[id])))
    setEnvoi(true)
    try {
      if (edition && !pieceJointe) {
        await rpc('modifier_message', { p_message: edition.id, p_contenu: contenu })
      } else {
        verifier(await supabase.from('messages').insert({
          conversation_id: conv.id, auteur_id: utilisateur.id,
          contenu: contenu || null, piece_jointe: pieceJointe || null,
          reponse_a: reponseA?.id || null, mentions: mentionsValides,
        }))
      }
      setTexte(''); setMentions([])
      onEnvoye()
    } catch (e) {
      toast(e.message, 'erreur')
    } finally {
      setEnvoi(false)
    }
  }

  async function televerser(blob, nom, extra = {}) {
    if (blob.size > TAILLE_MAX) { toast('Fichier trop lourd : 50 Mo au maximum.', 'erreur'); return }
    setEnvoi(true)
    try {
      const chemin = `${conv.id}/${crypto.randomUUID()}-${nomFichierSur(nom)}`
      const { error } = await supabase.storage.from('messagerie').upload(chemin, blob, { contentType: blob.type || undefined })
      if (error) throw new Error(messageErreur(error))
      await envoyer({ chemin, nom, mime: blob.type || null, taille: blob.size, ...extra })
    } catch (e) {
      toast(e.message, 'erreur')
    } finally {
      setEnvoi(false)
    }
  }

  async function demarrerVocal() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast('Enregistrement vocal indisponible sur ce navigateur.', 'erreur'); return }
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || ''
      const rec = new MediaRecorder(flux, type ? { mimeType: type } : undefined)
      const morceaux = []
      const debut = Date.now()
      rec.ondataavailable = (e) => e.data.size && morceaux.push(e.data)
      rec.onstop = () => {
        flux.getTracks().forEach((t) => t.stop())
        clearInterval(etat.minuteur)
        const annule = etat.annule
        setEnregistrement(null)
        if (annule) return
        const mime = rec.mimeType || 'audio/webm'
        const blob = new Blob(morceaux, { type: mime.split(';')[0] })
        const ext = /mp4/.test(mime) ? 'm4a' : 'webm'
        televerser(blob, `vocal-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.${ext}`, { duree: Math.round((Date.now() - debut) / 1000) })
      }
      const etat = { rec, debut, secondes: 0, annule: false }
      etat.original = etat
      etat.minuteur = setInterval(() => {
        const s = Math.round((Date.now() - debut) / 1000)
        setEnregistrement((x) => (x ? { ...x, secondes: s } : x))
        if (s >= DUREE_VOCAL_MAX) rec.stop() // 5 minutes au maximum
      }, 500)
      rec.start()
      setEnregistrement(etat)
    } catch {
      toast('Accès au micro refusé.', 'erreur')
    }
  }

  return (
    <div className="saisie-msg">
      {suggestion && candidats.length > 0 && (
        <div className="mentions" role="listbox" aria-label="Mentionner un membre">
          {candidats.map((p, i) => (
            <button key={p.id} type="button" role="option" aria-selected={i === indexSugg} className={i === indexSugg ? 'actif' : undefined}
              onMouseDown={(e) => { e.preventDefault(); choisirMention(p) }}>
              <Avatar personne={p} petit />{nomComplet(p)}<span className="secondaire petit">{p.appartements ? `Appt ${p.appartements}` : p.role}</span>
            </button>
          ))}
        </div>
      )}
      {(reponseA || edition) && (
        <div className="saisie-msg__contexte">
          <Icone nom={edition ? 'crayon' : 'repondre'} taille={18} />
          <span><strong>{edition ? 'Modifier le message' : `Réponse à ${nomComplet(parId[reponseA.auteur_id])}`}</strong> · {(edition || reponseA).contenu || (edition || reponseA).piece_jointe?.nom}</span>
          <button className="btn btn--icone" style={{ minHeight: 32, width: 32 }} aria-label="Annuler" onClick={() => { annulerContexte(); if (edition) setTexte('') }}><Icone nom="fermer" taille={16} /></button>
        </div>
      )}
      <div className="saisie-msg__ligne">
        {enregistrement ? (
          <>
            <button className="btn btn--tertiaire btn--icone" aria-label="Annuler l'enregistrement" onClick={() => { enregistrement.original.annule = true; enregistrement.rec.stop() }}><Icone nom="corbeille" taille={20} /></button>
            <div className="enregistrement"><span className="enregistrement__point" />{Math.floor(enregistrement.secondes / 60)}:{String(enregistrement.secondes % 60).padStart(2, '0')} / 5:00</div>
            <button className="btn btn--principal btn--icone" aria-label="Envoyer le message vocal" onClick={() => enregistrement.rec.stop()}><Icone nom="envoyer" taille={20} /></button>
          </>
        ) : (
          <>
            {!edition && (
              <>
                <button className="btn btn--tertiaire btn--icone" aria-label="Joindre un fichier" onClick={() => fichierRef.current?.click()} disabled={envoi}><Icone nom="trombone" taille={20} /></button>
                <input ref={fichierRef} type="file" accept={ACCEPT_MESSAGERIE} className="visuellement-cache" tabIndex={-1}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) televerser(f, f.name) }} />
              </>
            )}
            <textarea ref={zone} rows={1} value={texte} onChange={changer} onKeyDown={clavier} placeholder="Message" aria-label="Message" maxLength={8000} />
            {texte.trim() || edition ? (
              <button className="btn btn--principal btn--icone" aria-label="Envoyer" onClick={() => envoyer()} disabled={envoi || !texte.trim()}><Icone nom="envoyer" taille={20} /></button>
            ) : (
              <button className="btn btn--tertiaire btn--icone" aria-label="Enregistrer un message vocal (5 minutes au maximum)" onClick={demarrerVocal} disabled={envoi}><Icone nom="micro" taille={20} /></button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recherche dans les messages et les fichiers d'une conversation
// ---------------------------------------------------------------------------
function Recherche({ convId, parId, onAller, onFermer }) {
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('messages')
  const [resultats, setResultats] = useState(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      let req = supabase.from('messages').select('id, contenu, piece_jointe, auteur_id, created_at').eq('conversation_id', convId)
        .is('supprime_le', null).is('masque_le', null).order('created_at', { ascending: false }).limit(50)
      const propre = q.trim().replace(/[,()*%\\]/g, ' ')
      if (mode === 'fichiers') {
        req = req.not('piece_jointe', 'is', null)
        if (propre) req = req.ilike('piece_jointe->>nom', `%${propre}%`)
      } else {
        if (!propre) { setResultats(null); return }
        req = req.or(`contenu.ilike.*${propre}*,piece_jointe->>nom.ilike.*${propre}*`)
      }
      const { data } = await req
      setResultats(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q, mode, convId])

  return (
    <div style={{ background: '#fff', borderBottom: '1px solid var(--soc-bordure)', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '45%', overflow: 'auto' }}>
      <div className="ligne">
        <input className="saisie" style={{ flex: 1, minWidth: 160 }} type="search" autoFocus placeholder={mode === 'fichiers' ? 'Nom de fichier' : 'Rechercher dans la conversation'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
        <Segment etiquette="Rechercher dans" valeur={mode} onChange={setMode} options={[['messages', 'Messages'], ['fichiers', 'Fichiers']]} />
        <button className="btn btn--tertiaire btn--icone" onClick={onFermer} aria-label="Fermer la recherche"><Icone nom="fermer" taille={18} /></button>
      </div>
      {resultats && (resultats.length === 0 ? <p className="secondaire petit">Aucun résultat.</p> : (
        <div className="liste">
          {resultats.map((r) => (
            <button key={r.id} className="liste__el" style={{ minHeight: 52 }} onClick={() => onAller(r.id)}>
              {r.piece_jointe && <Icone nom="document" taille={20} />}
              <span className="liste__corps">
                <span className="liste__titre" style={{ fontWeight: 400 }}>{r.piece_jointe?.nom || r.contenu}</span>
                <span className="liste__sous">{nomComplet(parId[r.auteur_id])} · {horodatageCourt(r.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

// US6 : accusés de lecture nominatifs des annonces, visibles du CA
function Lecteurs({ message, etats, parId, onFermer }) {
  const { annuaire } = useMessagerie()
  const lus = new Set(etats.filter((e) => e.lu_jusqu_a && e.lu_jusqu_a >= message.created_at).map((e) => e.membre_id))
  const membres = annuaire.filter((p) => !p.est_avocat && p.id !== message.auteur_id)
  const [vue, setVue] = useState('lu')
  const liste = membres.filter((p) => (vue === 'lu' ? lus.has(p.id) : !lus.has(p.id)))
  return (
    <Modale titre="Lecture de l'annonce." sousTitre={`${lus.size} membre${lus.size > 1 ? 's' : ''} sur ${membres.length}`} onFermer={onFermer}>
      <Segment etiquette="Filtre" valeur={vue} onChange={setVue} options={[['lu', `Lu (${membres.filter((p) => lus.has(p.id)).length})`], ['non', `Pas encore lu (${membres.filter((p) => !lus.has(p.id)).length})`]]} />
      <div className="liste" style={{ maxHeight: 400, overflow: 'auto' }}>
        {liste.map((p) => (
          <div key={p.id} className="liste__el"><Avatar personne={p} petit /><span className="liste__corps"><span className="liste__titre">{nomComplet(p)}</span></span>
            {vue === 'lu' && <span className="petit secondaire">{horodatageCourt(etats.find((e) => e.membre_id === p.id)?.lu_jusqu_a)}</span>}</div>
        ))}
        {!liste.length && <p className="secondaire" style={{ padding: 18 }}>Personne.</p>}
      </div>
    </Modale>
  )
}

// US7 : masquer un message, motif journalisé
function Masquer({ message, auteur, onFermer }) {
  const [motif, setMotif] = useState('')
  const [executer, enCours] = useAction()
  async function valider() {
    const ok = await executer(() => rpc('masquer_message', { p_message: message.id, p_motif: motif }), 'Message masqué. Le motif est journalisé.')
    if (ok !== undefined) onFermer()
  }
  return (
    <Modale titre="Masquer le message." sousTitre={`Auteur : ${nomComplet(auteur)}`} onFermer={onFermer}
      pied={<><button className="btn btn--tertiaire" onClick={onFermer}>Annuler</button><button className="btn btn--secondaire" disabled={!motif.trim() || enCours} onClick={valider}>Masquer</button></>}>
      <div className="bloc"><p className="tertiaire" style={{ whiteSpace: 'pre-wrap' }}>{message.contenu || message.piece_jointe?.nom}</p></div>
      <Champ libelle="Motif (obligatoire)" id="motif" aide="Ex. : discussion politique ou confessionnelle (art. 2 des statuts).">
        <textarea id="motif" className="saisie" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
      </Champ>
    </Modale>
  )
}
