type NameFields = { firstName?: string; lastName?: string; username?: string }

/** Prefer first + last name; fall back to username for older accounts. */
export function displayName(u: NameFields | null | undefined): string {
  if (!u) return 'User'
  const fn = (u.firstName || '').trim()
  const ln = (u.lastName || '').trim()
  if (fn && ln) return `${fn} ${ln}`
  if (fn) return fn
  if (ln) return ln
  return (u.username || '').trim() || 'User'
}

export function nameInitial(u: NameFields | null | undefined): string {
  const n = displayName(u)
  return n[0]?.toUpperCase() || '?'
}
