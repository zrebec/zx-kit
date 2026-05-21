/**
 * i18n.ts — locale selection helper.
 *
 * A tiny, dependency-free utility for picking a string pack at runtime
 * based on a language code. Designed so any zx-kit game can ship with
 * multiple translations and switch them via a single config flag.
 *
 * USAGE
 * ─────
 * Each locale exports the same shape — usually as named string constants
 * and template functions (e.g. `STR_DEPTH = (m) => \`D:${m}M\``).
 * Import each locale module as a namespace and hand them to `pickLocale`:
 *
 *   import * as en from './strings.ts'        // default English
 *   import * as sk from './strings.sk.ts'     // Slovak
 *   import * as ru from './strings.ru.ts'     // Russian
 *   import { LANGUAGE_CODE } from './config.ts'
 *
 *   export const L = pickLocale(en, { sk, ru }, LANGUAGE_CODE)
 *
 * Consumers then read `L.STR_DEPTH(120)` etc. — same name, swapped values.
 *
 * SELECTION RULES
 * ───────────────
 * - `code` null / undefined / empty       → returns `defaultLocale`
 * - `code` matches a key in `locales`     → returns that locale
 *   (case-insensitive: 'SK' === 'sk')
 * - `code` doesn't match anything         → returns `defaultLocale`
 *
 * The default key (typically 'en') doesn't need to live in the `locales`
 * map — passing 'en' simply falls through to `defaultLocale`. This keeps
 * the English source-of-truth file at the conventional `strings.ts` path
 * without forcing a `strings.en.ts` rename.
 */

/**
 * Pick a locale object from a map by code, with fallback to a default.
 *
 * Generic over `T` so every entry in `locales` is type-checked against the
 * shape of `defaultLocale` — adding a new translation that misses a key
 * (or has a wrong signature) becomes a compile error.
 */
export function pickLocale<T>(
  defaultLocale: T,
  locales: Record<string, T>,
  code: string | null | undefined,
): T {
  if (!code) return defaultLocale
  const normalised = code.toLowerCase()
  return locales[normalised] ?? defaultLocale
}
