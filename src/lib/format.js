const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtDateCourte = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function dateLongue(d) {
  if (!d) return ''
  return fmtDate.format(typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00') : new Date(d))
}

export function dateHeure(d) {
  if (!d) return ''
  return `${dateLongue(d)} à ${fmtHeure.format(new Date(d))}`
}

export function heure(d) {
  return d ? fmtHeure.format(new Date(d)) : ''
}

// « 08:47 » aujourd'hui, « hier », « 3 oct. » sinon
export function horodatageCourt(d) {
  if (!d) return ''
  const date = new Date(d)
  const auj = new Date()
  if (date.toDateString() === auj.toDateString()) return fmtHeure.format(date)
  const hier = new Date(auj); hier.setDate(auj.getDate() - 1)
  if (date.toDateString() === hier.toDateString()) return 'hier'
  return fmtDateCourte.format(date)
}

export function jourMessage(d) {
  const date = new Date(d)
  const auj = new Date()
  if (date.toDateString() === auj.toDateString()) return 'Aujourd\'hui'
  const hier = new Date(auj); hier.setDate(auj.getDate() - 1)
  if (date.toDateString() === hier.toDateString()) return 'Hier'
  return dateLongue(d)
}

export function joursRestants(d) {
  if (!d) return null
  const cible = new Date(d + 'T00:00:00')
  const auj = new Date(); auj.setHours(0, 0, 0, 0)
  return Math.round((cible - auj) / 86400000)
}

export function taille(octets) {
  if (octets == null) return ''
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

export function nomComplet(p) {
  if (!p) return 'Membre'
  return [p.prenom, p.nom].filter(Boolean).join(' ') || p.email || 'Membre'
}

export function initiales(p) {
  const n = nomComplet(p)
  return n.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()
}

export function extension(nom) {
  const m = /\.([a-z0-9]+)$/i.exec(nom || '')
  return m ? m[1].toLowerCase() : ''
}

export function nomFichierSur(nom) {
  return (nom || 'fichier')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-120)
}

export function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nom
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

// « A », « A et B », « A, B et C »
export function enumerer(noms) {
  const l = (noms || []).filter(Boolean)
  return l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : l[0] || ''
}
