/**
 * Cryptographically stronger randomness using the Web Crypto API.
 * Uses rejection sampling to avoid modulo bias.
 */

function getRandomUint32(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

/** Returns an integer in [0, max) with uniform distribution. */
export function randomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error('randomInt: max must be a positive integer')
  }
  if (max === 1) return 0
  const range = 0x100000000 // 2^32
  const limit = range - (range % max)
  let x = getRandomUint32()
  while (x >= limit) x = getRandomUint32()
  return x % max
}

/** Returns a float in [0, 1). */
export function randomFloat(): number {
  return getRandomUint32() / 0x100000000
}

/** Picks one element uniformly at random. */
export function pickOne<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickOne: empty array')
  return items[randomInt(items.length)]
}

/** Picks `count` distinct elements uniformly (partial Fisher–Yates). */
export function pickMany<T>(items: readonly T[], count: number): T[] {
  const n = Math.min(count, items.length)
  const arr = items.slice()
  for (let i = 0; i < n; i++) {
    const j = i + randomInt(arr.length - i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

/** In-place Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  return pickMany(items, items.length)
}
