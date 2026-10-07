import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Icone from './Icones'

export function Chargement({ texte = 'Chargement…' }) {
  return <div className="chargement" role="status"><span className="rouet" />{texte}</div>
}

export function Vide({ icone = 'document', titre, children }) {
  return (
    <div className="vide">
      <Icone nom={icone} taille={40} epaisseur={1.6} />
      {titre && <p className="intertitre" style={{ color: 'var(--soc-encre)' }}>{titre}</p>}
      {children}
    </div>
  )
}

export function Segment({ options, valeur, onChange, etiquette, defilant }) {
  return (
    <div className={`segment${defilant ? ' segment--defilant' : ''}`} role="group" aria-label={etiquette}>
      {options.map(([v, libelle]) => (
        <button key={v} type="button" aria-pressed={valeur === v} onClick={() => onChange(v)}>{libelle}</button>
      ))}
    </div>
  )
}

export function Jauge({ valeur, libelle }) {
  const pct = Math.max(0, Math.min(100, Math.round(valeur)))
  return (
    <div className="jauge" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={libelle}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Champ({ libelle, aide, erreur, children, id }) {
  return (
    <div className="champ">
      {libelle && <label htmlFor={id}>{libelle}</label>}
      {children}
      {aide && !erreur && <span className="champ__aide">{aide}</span>}
      {erreur && <span className="champ__erreur" role="alert">{erreur}</span>}
    </div>
  )
}

export function Modale({ titre, sousTitre, onFermer, children, pied, large }) {
  const ref = useRef(null)
  useEffect(() => {
    const precedent = document.activeElement
    ref.current?.querySelector('input, select, textarea, button:not(.modale__fermer)')?.focus()
    function echap(e) { if (e.key === 'Escape') onFermer?.() }
    document.addEventListener('keydown', echap)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', echap)
      document.body.style.overflow = ''
      precedent?.focus?.()
    }
  }, [onFermer])
  return (
    <div className="voile" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer?.() }}>
      <div className={`modale${large ? ' modale--large' : ''}`} role="dialog" aria-modal="true" aria-label={titre} ref={ref}>
        <div className="modale__entete">
          <div>
            <h2 className="titre-carte">{titre}</h2>
            {sousTitre && <p className="secondaire" style={{ marginTop: 6 }}>{sousTitre}</p>}
          </div>
          {onFermer && (
            <button type="button" className="btn btn--tertiaire btn--icone modale__fermer" onClick={onFermer} aria-label="Fermer">
              <Icone nom="fermer" taille={20} />
            </button>
          )}
        </div>
        {children}
        {pied && <div className="modale__pied">{pied}</div>}
      </div>
    </div>
  )
}

export function Bandeau({ type = 'info', children, icone }) {
  return (
    <div className={`bandeau bandeau--${type}`} role={type === 'erreur' ? 'alert' : undefined}>
      <Icone nom={icone || (type === 'info' ? 'bouclier' : 'alerte')} taille={20} style={{ flex: 'none', marginTop: 1 }} />
      <div>{children}</div>
    </div>
  )
}

export function Avatar({ personne, nom, couleur, petit }) {
  const n = nom || [personne?.prenom, personne?.nom].filter(Boolean).join(' ') || '?'
  const ini = n.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()
  return <span className={`avatar${couleur ? ` avatar--${couleur}` : ''}${petit ? ' avatar--petit' : ''}`} aria-hidden="true">{ini}</span>
}

// Notifications éphémères
const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const afficher = useCallback((texte, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, texte, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), type === 'erreur' ? 7000 : 4000)
  }, [])
  return (
    <ToastContext.Provider value={afficher}>
      {children}
      <div className="toast-zone" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.type === 'erreur' ? ' toast--erreur' : ''}`}>
            <span>{t.texte}</span>
            <button type="button" className="btn btn--icone" style={{ color: '#fff', minHeight: 32, width: 32 }} aria-label="Fermer"
              onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><Icone nom="fermer" taille={18} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

// Exécute une action asynchrone en affichant l'erreur éventuelle
export function useAction() {
  const toast = useToast()
  const [enCours, setEnCours] = useState(false)
  const executer = useCallback(async (fn, succes) => {
    setEnCours(true)
    try {
      const r = await fn()
      if (succes) toast(succes)
      return r === undefined ? true : r // undefined est réservé à l'échec
    } catch (e) {
      toast(e.message || String(e), 'erreur')
      return undefined
    } finally {
      setEnCours(false)
    }
  }, [toast])
  return [executer, enCours]
}
