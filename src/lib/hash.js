// Empreinte SHA-256 du fichier original, conservé tel quel (US9, §6 Intégrité)
export async function sha256(blob) {
  const tampon = await blob.arrayBuffer()
  const empreinte = await crypto.subtle.digest('SHA-256', tampon)
  return Array.from(new Uint8Array(empreinte)).map((o) => o.toString(16).padStart(2, '0')).join('')
}
