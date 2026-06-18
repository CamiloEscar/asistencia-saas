/**
 * check-i18n.ts
 *
 * Scans the frontend source code for `t('...')` (and `t("...")`) usages
 * and verifies that each key resolves to a translation in the default
 * locale.
 *
 * Lookup strategy (mirrors the runtime, with a safety net):
 *   1. Look up the key as-is in the defaultNS (common) JSON.
 *   2. If the first dot-segment is a known namespace, look up the
 *      remainder as `subKey` in that namespace's JSON (this is what
 *      `parseMissingKeyHandler` does at runtime).
 *   3. As a safety net, also do a flat dot-path search across ALL
 *      locale JSONs — catches keys whose JSON has a redundant
 *      namespace prefix (e.g. `courses.json` wraps everything in
 *      `{"courses": {...}}`).
 *
 * Usage:
 *   tsx apps/web/scripts/check-i18n.ts          # warn mode (dev)
 *   tsx apps/web/scripts/check-i18n.ts --strict  # exit 1 on missing keys
 */
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_DIR = path.resolve(__dirname, '../src')
const LOCALES_DIR = path.resolve(__dirname, '../src/locales')
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])
const STRICT = process.argv.includes('--strict')

const DEFAULT_NS = 'common'
const KNOWN_NS = new Set([
  'common',
  'errors',
  'feedback',
  'ui',
  'validation',
  'attendance',
  'auth',
  'courses',
  'dashboard',
  'institutions',
  'profile',
  'students',
  'subjects',
  'teachers',
  'users',
])

const T_CALL_RE = /\bt\(\s*['"`]([a-zA-Z0-9_.:]+)['"`]/g

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build') continue
      await walk(full, files)
    } else if (SOURCE_EXTS.has(path.extname(e.name))) {
      files.push(full)
    }
  }
  return files
}

function flatten(obj: unknown, prefix = ''): Set<string> {
  const out = new Set<string>()
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const kk of flatten(v, key)) out.add(kk)
      } else {
        out.add(key)
      }
    }
  }
  return out
}

interface LocaleData {
  // Per-namespace flattened keys
  byNs: Record<string, Set<string>>
  // All keys flattened across all namespaces (for safety-net search)
  allKeys: Set<string>
}

async function loadLocale(lang: string): Promise<LocaleData> {
  const dir = path.join(LOCALES_DIR, lang)
  const byNs: Record<string, Set<string>> = {}
  const allKeys = new Set<string>()
  try {
    const files = await fs.readdir(dir)
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      const ns = f.replace(/\.json$/, '')
      const full = path.join(dir, f)
      const text = await fs.readFile(full, 'utf8')
      const data = text.trim() ? JSON.parse(text) : {}
      const flat = flatten(data)
      byNs[ns] = flat
      for (const k of flat) allKeys.add(k)
    }
  } catch (e) {
    console.warn(`Could not read locale dir ${dir}: ${(e as Error).message}`)
  }
  return { byNs, allKeys }
}

/**
 * Mirrors runtime i18next resolution:
 *   1. If the key uses the `ns:key` form (e.g. `errors:generic`), look
 *      up `key` in the named namespace.
 *   2. Look up the full key in defaultNS.
 *   3. If first dot-segment is a known namespace, look up the remainder
 *      in that namespace's JSON (parseMissingKeyHandler).
 *   4. Safety net: flat search across all locale keys.
 */
function keyResolves(key: string, locale: LocaleData): boolean {
  // 1. Explicit `ns:key` form
  if (key.includes(':')) {
    const [ns, sub] = key.split(':', 2)
    if (ns && sub && locale.byNs[ns]?.has(sub)) return true
  }
  // 2. defaultNS
  if (locale.byNs[DEFAULT_NS]?.has(key)) return true
  // 3. parseMissingKeyHandler behavior
  const parts = key.split('.')
  if (parts.length >= 2) {
    const candidateNs = parts[0]
    if (candidateNs && KNOWN_NS.has(candidateNs)) {
      const subKey = parts.slice(1).join('.')
      if (locale.byNs[candidateNs]?.has(subKey)) return true
    }
  }
  // 4. safety net
  return locale.allKeys.has(key)
}

function main() {
  void (async () => {
    const files = await walk(SRC_DIR)
    const usedKeys = new Set<string>()
    for (const f of files) {
      const text = await fs.readFile(f, 'utf8')
      let m: RegExpExecArray | null
      while ((m = T_CALL_RE.exec(text)) !== null) {
        usedKeys.add(m[1])
      }
    }

    const locales = (await fs.readdir(LOCALES_DIR, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name)

    if (locales.length === 0) {
      console.error('No locales found in', LOCALES_DIR)
      process.exit(1)
    }

    const indexes: Record<string, LocaleData> = {}
    for (const lang of locales) indexes[lang] = await loadLocale(lang)

    const defaultLocale = locales.includes('es') ? 'es' : locales[0]
    const defaultIdx = indexes[defaultLocale]

    console.log(
      `i18n check — default locale: ${defaultLocale} — ${usedKeys.size} unique keys used in code across ${files.length} files\n`,
    )

    let exitCode = 0
    const missing: string[] = []
    for (const key of usedKeys) {
      if (!keyResolves(key, defaultIdx)) missing.push(key)
    }

    if (missing.length > 0) {
      missing.sort()
      console.error(
        `[MISSING in ${defaultLocale}] ${missing.length} keys used in code but not in locale:`,
      )
      for (const k of missing) console.error(`  - ${k}`)
      console.error('')
      exitCode = STRICT ? 1 : 0
    }

    for (const lang of locales) {
      if (lang === defaultLocale) continue
      const miss = [...usedKeys].filter((k) => !keyResolves(k, indexes[lang]))
      if (miss.length > 0) {
        console.log(`[${lang}] ${miss.length} keys missing (may be empty in MVP — informational)`)
      }
    }

    const unused = [...defaultIdx.allKeys].filter((k) => !usedKeys.has(k))
    if (unused.length > 0) {
      console.log(
        `\n[INFO] ${unused.length} keys in ${defaultLocale} are not used in code (kept for future use)`,
      )
    }

    if (missing.length === 0) {
      console.log('\nAll good! No missing keys in default locale.')
    } else if (!STRICT) {
      console.log(`\nRun with --strict to exit non-zero on missing keys (dev mode: warn only).`)
    }

    process.exit(exitCode)
  })().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

main()
