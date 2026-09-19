// Escapes a user-supplied string for safe use inside `new RegExp(...)`.
// Without this, a search term containing regex metacharacters (".", "*",
// "(", etc. — all plausible in a real name or email, e.g. "O.Brien" or
// "user+test@example.com") would be interpreted as regex syntax instead
// of literal text, and could degrade into a pathological pattern.
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
