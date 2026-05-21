import { describe, it, expect } from 'vitest'
import { pickLocale } from '../src/i18n.js'

// ── Fixtures: tiny "string packs" with the same shape ──────────────────────

const en = {
  HELLO: 'Hello',
  GREET: (name: string) => `Hello, ${name}!`,
}

const sk = {
  HELLO: 'Ahoj',
  GREET: (name: string) => `Ahoj, ${name}!`,
}

const ru = {
  HELLO: 'Привет',
  GREET: (name: string) => `Привет, ${name}!`,
}

describe('pickLocale', () => {
  it('returns the default locale when code is null', () => {
    const result = pickLocale(en, { sk, ru }, null)
    expect(result).toBe(en)
    expect(result.HELLO).toBe('Hello')
  })

  it('returns the default locale when code is undefined', () => {
    const result = pickLocale(en, { sk, ru }, undefined)
    expect(result).toBe(en)
  })

  it('returns the default locale when code is an empty string', () => {
    const result = pickLocale(en, { sk, ru }, '')
    expect(result).toBe(en)
  })

  it('returns the matching locale when code is recognised', () => {
    const result = pickLocale(en, { sk, ru }, 'sk')
    expect(result).toBe(sk)
    expect(result.HELLO).toBe('Ahoj')
  })

  it('matches codes case-insensitively', () => {
    expect(pickLocale(en, { sk, ru }, 'SK').HELLO).toBe('Ahoj')
    expect(pickLocale(en, { sk, ru }, 'Sk').HELLO).toBe('Ahoj')
    expect(pickLocale(en, { sk, ru }, 'sK').HELLO).toBe('Ahoj')
  })

  it('falls back to the default locale for an unknown code', () => {
    const result = pickLocale(en, { sk, ru }, 'jp')
    expect(result).toBe(en)
  })

  it('falls back to the default for nonsense codes', () => {
    expect(pickLocale(en, { sk, ru }, '1234NOWRITE')).toBe(en)
    expect(pickLocale(en, { sk, ru }, '@#$%').HELLO).toBe('Hello')
  })

  it('treats the conventional "en" code as the default (not a locales key)', () => {
    // 'en' isn't in the locales map — by design — so it falls back.
    // This keeps the English source-of-truth at strings.ts without
    // requiring a strings.en.ts rename.
    const result = pickLocale(en, { sk, ru }, 'en')
    expect(result).toBe(en)
  })

  it('also supports the default living in the locales map (overrides default arg only if matched)', () => {
    // If a project DOES want strings.en.ts as a peer file, they can put 'en'
    // in the locales map and pickLocale will route to it normally.
    const enExplicit = { HELLO: 'HOWDY', GREET: (n: string) => `Howdy, ${n}!` }
    const result = pickLocale(en, { en: enExplicit, sk }, 'en')
    expect(result).toBe(enExplicit)
    expect(result.HELLO).toBe('HOWDY')
  })

  it('preserves template function behaviour on the selected locale', () => {
    const result = pickLocale(en, { sk, ru }, 'ru')
    expect(result.GREET('Yuri')).toBe('Привет, Yuri!')
  })

  it('returns the same default reference across calls (no copying)', () => {
    const a = pickLocale(en, { sk }, null)
    const b = pickLocale(en, { sk }, 'unknown')
    expect(a).toBe(b)
    expect(a).toBe(en)
  })

  it('works with an empty locales map (always returns default)', () => {
    expect(pickLocale(en, {}, 'sk')).toBe(en)
    expect(pickLocale(en, {}, null)).toBe(en)
  })
})
