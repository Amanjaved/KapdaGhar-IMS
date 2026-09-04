/**
 * Universal UUID utility for standard RFC 4122 v4 UUID generation and validation.
 * Works across secure contexts (HTTPS/localhost) and non-secure local IP contexts (HTTP).
 */

export function isValidUUID(val: string | null | undefined): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (_) {}
  }

  // RFC 4122 v4 generator fallback using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deterministically maps any legacy string (e.g. "prod-1788518898931" or "p0000000-...")
 * into a valid RFC 4122 v4 hexadecimal UUID.
 * The same input string will always return the exact same UUID.
 */
export function toValidUUID(str: string | null | undefined): string {
  if (!str) return generateUUID();
  const trimmed = str.trim();
  if (isValidUUID(trimmed)) return trimmed.toLowerCase();

  // Legacy p0000000 prefix mapping
  if (trimmed.startsWith('p0000000-')) {
    return trimmed.replace(/^p0000000-/, 'a0000000-');
  }

  // Deterministic 128-bit hash
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  let h3 = 0x67452301;
  let h4 = 0xefcdab89;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const hex = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).slice(0, 32);

  const part1 = hex.slice(0, 8);
  const part2 = hex.slice(8, 12);
  const part3 = '4' + hex.slice(13, 16);
  const part4 = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20);
  const part5 = hex.slice(20, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase();
}
