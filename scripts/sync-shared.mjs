#!/usr/bin/env node
/**
 * Copia a lógica pura do app mobile para src/shared/, com os testes dela.
 *
 *   node scripts/sync-shared.mjs            copia e lista o que mudou
 *   node scripts/sync-shared.mjs --check    só confere: sai com 1 se alguma cópia divergiu
 *
 * A fonte é ../letsgrow-mobile (pasta irmã) ou MOBILE_DIR. Nunca edite os arquivos de
 * src/shared/ à mão: mude no mobile e rode o script. Decisão em analise-2026-10-16/WEBAPP.md §2.6.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mobile = resolve(process.env.MOBILE_DIR ?? join(root, '..', 'letsgrow-mobile'))
const check = process.argv.includes('--check')

/** Só arquivos sem React Native nem Expo. */
const LIB = [
  'accountFeatures', 'bobbyChat', 'bobbyOverview', 'carousel', 'chatStream', 'dates', 'diaryCalendar', 'diaryEntries',
  'equipmentForms', 'errors', 'exhaustDimmer', 'growEquipment', 'growHistory', 'homeClimate', 'lightDial',
  'lightSchedule', 'markdown', 'measurements', 'numericInput', 'phaseDay', 'plantFacts', 'plantIdentity',
]
const TYPES = ['api', 'bob', 'features']
/** Testes cujos requires estão todos entre os arquivos acima. */
const TESTS = [
  'accountFeatures', 'bobbyChat', 'bobbyOverview', 'carousel', 'chatStream', 'diaryCalendar', 'diaryTimeline',
  'equipmentForms', 'errors', 'exhaustDimmer', 'growHistory', 'homeClimate', 'lightDial', 'lightSchedule',
  'measurements', 'numericInput', 'plantIdentity', 'plantsCalendar', 'screenFacts',
]

const header = (src) => `// Copiado de letsgrow-mobile/${src} por scripts/sync-shared.mjs. Não edite aqui.\n`

/** constants/theme.ts importa TextStyle do React Native só para tipar a tipografia. */
const webTheme = (text) => text
  .replace(/^import \{ TextStyle \} from 'react-native'\n/m, '')
  .replace(/ as TextStyle/g, '')

const jobs = [
  ...LIB.map(n => [`lib/${n}.ts`, `src/shared/lib/${n}.ts`]),
  ...TYPES.map(n => [`types/${n}.ts`, `src/shared/types/${n}.ts`]),
  ['constants/theme.ts', 'src/shared/constants/theme.ts', webTheme],
  ...TESTS.map(n => [`tests/${n}.test.cjs`, `tests/${n}.test.cjs`, t => t.replaceAll("'../lib/", "'../src/shared/lib/")]),
]

if (!existsSync(join(mobile, 'lib'))) {
  console.error(`Não achei o app mobile em ${mobile}. Defina MOBILE_DIR.`)
  process.exit(2)
}

const changed = []
for (const [from, to, transform] of jobs) {
  const raw = readFileSync(join(mobile, from), 'utf8').replace(/\r\n/g, '\n')
  const body = (from.endsWith('.cjs') ? `// Copiado de letsgrow-mobile/${from} por scripts/sync-shared.mjs.\n` : header(from)) + (transform ? transform(raw) : raw)
  const target = join(root, to)
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null
  if (current === body) continue
  changed.push(to)
  if (!check) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body)
  }
}

if (changed.length === 0) console.log('src/shared/ igual ao mobile.')
else console.log(`${check ? 'Diferente do mobile' : 'Atualizado'} (${changed.length}):\n  ${changed.join('\n  ')}`)
process.exit(check && changed.length ? 1 : 0)
