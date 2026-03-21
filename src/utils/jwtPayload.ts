/**
 * Read `id` from JWT payload without verifying signature (client-side sanity check only).
 */
export function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4
    if (pad) b64 += '===='.slice(0, 4 - pad)
    let raw = ''
    try {
      if (typeof atob !== 'undefined') raw = atob(b64)
      else if (typeof Buffer !== 'undefined') raw = Buffer.from(b64, 'base64').toString('utf8')
    } catch {
      return null
    }
    if (!raw) return null
    const p = JSON.parse(raw) as { id?: string }
    return p.id != null ? String(p.id) : null
  } catch {
    return null
  }
}
