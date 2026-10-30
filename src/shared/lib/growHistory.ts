// Copiado de letsgrow-mobile/lib/growHistory.ts por scripts/sync-shared.mjs. Não edite aqui.
import type { EnvironmentReading } from '../types/features'

/**
 * Environment history and archiving (UX-CORRECOES.md item 3, Figma 02B 2297:8976).
 * Dates are local; the list shows only what was registered in the app (no sensor readings).
 */
export const HISTORY_PAGE_SIZE = 50

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const pad = (n: number) => String(n).padStart(2, '0')
const dayMonth = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const number = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')

export type HistoryType = 'reading' | 'note' | 'power'
/** From the server's `kind`, never from the note text: power entries are automatic and read-only. */
export function historyType(r: Pick<EnvironmentReading, 'kind' | 'temperature_c' | 'humidity_rh'>): HistoryType {
  if (r.kind === 'exhaust_power') return 'power'
  return r.temperature_c != null || r.humidity_rh != null ? 'reading' : 'note'
}

export const HISTORY_TAG: Record<HistoryType, { label: string; tone: 'calm' | 'neutral' | 'stable' }> = {
  reading: { label: 'REGISTRO MANUAL', tone: 'calm' }, note: { label: 'NOTA', tone: 'neutral' }, power: { label: 'AJUSTE DE POTÊNCIA', tone: 'stable' },
}

/** "24 °C · 55 %", "Nota" or "Exaustor ajustado para 65%" (Figma Lists/HistoryItem 2297:9004). */
export function historyTitle(r: EnvironmentReading): string {
  const type = historyType(r)
  if (type === 'reading') return [r.temperature_c != null && `${number(r.temperature_c)} °C`, r.humidity_rh != null && `${number(r.humidity_rh)} %`].filter(Boolean).join(' · ')
  if (type === 'note') return 'Nota'
  const pct = r.notes?.match(/(\d+)\s*%/)?.[1]
  if (!pct) return 'Ajuste de potência do exaustor'
  return /registrada/i.test(r.notes ?? '') ? `Exaustor registrado em ${pct}%` : `Exaustor ajustado para ${pct}%`
}

/** The note under the title; power entries show none. */
export function historyDetail(r: EnvironmentReading): string | null {
  return historyType(r) === 'power' ? null : r.notes?.trim() || null
}

export function historyTime(r: Pick<EnvironmentReading, 'observed_at'>): string {
  return clock(new Date(r.observed_at))
}

/** "Leitura, 19 out às 12:17, 24 °C · 55 %, TESTE QA registro manual" */
export function historyA11yLabel(r: EnvironmentReading): string {
  const d = new Date(r.observed_at)
  const kind = { reading: 'Leitura', note: 'Nota', power: 'Ajuste de potência' }[historyType(r)]
  return [`${kind}, ${dayMonth(d)} às ${clock(d)}`, historyType(r) === 'note' ? null : historyTitle(r), historyDetail(r)].filter(Boolean).join(', ')
}

export type HistoryGroup = { key: string; label: string; items: EnvironmentReading[] }
/** Groups by local day, keeping the server order (newest first): "HOJE · 19 OUT", "ONTEM · 18 OUT", "16 OUT". */
export function groupByDay(items: EnvironmentReading[], now: Date = new Date()): HistoryGroup[] {
  const groups: HistoryGroup[] = []
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (const item of items) {
    const d = new Date(item.observed_at)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      const days = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
      const label = (days === 0 ? `HOJE · ${dayMonth(d)}` : days === 1 ? `ONTEM · ${dayMonth(d)}` : d.getFullYear() === now.getFullYear() ? dayMonth(d) : `${dayMonth(d)} ${d.getFullYear()}`).toUpperCase()
      group = { key, label, items: [] }
      groups.push(group)
    }
    group.items.push(item)
  }
  return groups
}

/** Offset of the next page, or undefined when everything is loaded. */
export function nextHistoryOffset(loaded: number, total: number): number | undefined {
  return loaded < total ? loaded : undefined
}

/** Text of "Apagar registro?" (Figma E2 2299:10251). */
export function deleteReadingMessage(r: EnvironmentReading): string {
  const d = new Date(r.observed_at)
  const when = `${dayMonth(d)}, ${clock(d)}`
  if (historyType(r) === 'reading') {
    const values = [r.temperature_c != null && `${number(r.temperature_c)} °C`, r.humidity_rh != null && `${number(r.humidity_rh)} %`].filter(Boolean).join(' e ')
    return `A leitura de ${values} de ${when} sai do histórico e deixa de contar como medição atual do ambiente. Não dá para desfazer.`
  }
  return `A nota de ${when} sai do histórico. Não dá para desfazer.`
}

/** Text of "Arquivar {nome}?" (Figma B 2298:9141 and B2 2298:9231). The server archives the plants with it. */
export function archiveGrowMessage(plants: number, onlyActive: boolean): string {
  if (onlyActive) return `Este é seu único ambiente ativo. Ele ${plants ? `e ${plants === 1 ? 'a planta' : 'as plantas'} dele saem` : 'sai'} do acompanhamento atual, e o histórico continua em Ambientes arquivados. Depois, você pode criar outro ambiente ou restaurar este.`
  if (plants) return `${plants === 1 ? 'A planta deste ambiente também será arquivada' : `As ${plants} plantas deste ambiente também serão arquivadas`}. Leituras, notas e diário continuam disponíveis em Ambientes arquivados e Plantas arquivadas. Você pode restaurar depois.`
  return 'Ele sai do acompanhamento atual. Leituras e notas continuam disponíveis em Ambientes arquivados. Você pode restaurar depois.'
}

/** Restoring brings back the plants archived with the grow (user decision, 2026-10-19). */
export const RESTORE_GROW_MESSAGE = 'Ele volta para os ambientes ativos, e as plantas arquivadas junto com ele também voltam. Plantas arquivadas antes, separadamente, continuam em Plantas arquivadas.'

export function restoredMessage(plants: number): string {
  return plants ? `Ambiente restaurado. ${plants === 1 ? '1 planta voltou' : `${plants} plantas voltaram`} para o acompanhamento.` : 'Ambiente restaurado.'
}

/** "Arquivado em 19 out" or, for grows archived before archived_at existed, "Arquivado · iniciado em 2 out 2026". */
export function archivedCaption(grow: { archived_at?: string | null; start_date: string }): string {
  if (grow.archived_at) return `Arquivado em ${dayMonth(new Date(grow.archived_at))}`
  const [y, m, d] = grow.start_date.split('-').map(Number)
  return y && m && d ? `Arquivado · iniciado em ${d} ${MONTHS[m - 1]} ${y}` : 'Arquivado'
}
