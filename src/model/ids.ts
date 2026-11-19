const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Short, URL/DOM-safe random identifier, e.g. "el_k3j9x2ab". */
export function uid(prefix = 'id'): string {
  let out = '';
  const bytes = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export const SAFE_ID = /^[A-Za-z0-9_@-]{1,64}$/;
