// Copiado de letsgrow-mobile/lib/diaryCalendar.ts por scripts/sync-shared.mjs. Não edite aqui.
export function addCalendarMonths(date: Date, amount: number): Date {
  const result = new Date(date)
  const day = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() + amount)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(day, lastDay))
  return result
}

export function diaryPeriod(date: Date, mode: 'week' | 'month') {
  const start = new Date(date.getFullYear(), date.getMonth(), mode === 'month' ? 1 : date.getDate())
  start.setDate(start.getDate() - start.getDay())
  const end = new Date(start)
  end.setDate(end.getDate() + (mode === 'month' ? 42 : 7))
  return { start_at: start.toISOString(), end_at: end.toISOString() }
}

export function filterDiaryPlants<T extends { id: string; grow_id: string }>(
  plants: T[], growId: string, plantId?: string,
): T[] {
  return plants.filter((plant) =>
    (growId === '__all__' || plant.grow_id === growId) && (!plantId || plant.id === plantId))
}

export async function loadDiaryPeriod<T extends { id: string }>(
  fetchPage: (offset: number, limit: number) => Promise<T[]>,
): Promise<T[]> {
  const entries = new Map<string, T>()
  const limit = 100
  for (let offset = 0; ; offset += limit) {
    const page = await fetchPage(offset, limit)
    page.forEach((entry) => entries.set(entry.id, entry))
    if (page.length < limit) return [...entries.values()]
  }
}

/** Local calendar day of a date or ISO string ("2026-09-14"); records are grouped by the viewer's day. */
export function dayKey(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** Whole weeks (Sunday first) covering the month of `selected`, with the adjacent months' days. */
export function monthDays(selected: Date): Date[] {
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const days = new Date(selected.getFullYear(), selected.getMonth() + 1, 0).getDate()
  const start = addDays(first, -first.getDay())
  return Array.from({ length: Math.ceil((first.getDay() + days) / 7) * 7 }, (_, i) => addDays(start, i))
}

/** Sunday-to-Saturday week of `selected`. */
export function weekDays(selected: Date): Date[] {
  const start = addDays(selected, -selected.getDay())
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Calendar of all plants (Figma 03C): which plants are in scope, by environment chip and archived toggle. */
export function calendarPlants<T extends { id: string; grow_id: string; is_active: boolean }>(plants: T[], growId: string | null, includeArchived: boolean): T[] {
  return plants.filter(p => (includeArchived || p.is_active) && (!growId || p.grow_id === growId))
}

/** Number of different plants with a record on each local day: the badge shown from 2 plants up. */
export function plantsByDay(entries: { plant_id: string; event_date: string }[]): Map<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const e of entries) { const key = dayKey(e.event_date); sets.set(key, (sets.get(key) ?? new Set()).add(e.plant_id)) }
  return new Map([...sets].map(([key, set]) => [key, set.size]))
}

export type PlantGroup<E> = { plantId: string; name: string; entries: E[]; latest: string }
/**
 * A day's records grouped by plant: the plant with the most recent record first, ties by name; records of
 * each plant in time order. `nameOf` gives the display name.
 */
export function groupByPlant<E extends { plant_id: string; event_date: string }>(entries: E[], nameOf: (e: E) => string): PlantGroup<E>[] {
  const groups = new Map<string, PlantGroup<E>>()
  for (const e of entries) {
    const g = groups.get(e.plant_id) ?? { plantId: e.plant_id, name: nameOf(e), entries: [], latest: e.event_date }
    g.entries.push(e)
    if (new Date(e.event_date).getTime() > new Date(g.latest).getTime()) g.latest = e.event_date
    groups.set(e.plant_id, g)
  }
  const list = [...groups.values()]
  list.forEach(g => g.entries.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()))
  return list.sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime() || a.name.localeCompare(b.name, 'pt-BR'))
}

// ── Continuous timeline (UX item 8, Figma 03C L–L5) ─────────────────────────────────────────────────────────
// Newest first with today on top; empty days folded into one line; loaded in 30-day blocks going back.

export const BLOCK_DAYS = 30
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Calendar days from `a` to `b` (b − a), by local date, so DST and time of day do not matter. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000)
}

/** Block `index` of the timeline: block 0 is [today − 29, tomorrow); each next one is the 30 days before. */
export function timelineBlock(today: Date, index: number) {
  const end = addDays(startOfDay(today), 1 - BLOCK_DAYS * index)
  const start = addDays(end, -BLOCK_DAYS)
  return { start, start_at: start.toISOString(), end_at: end.toISOString() }
}

/** How many blocks must be loaded so that `day` is in them (a future day or today needs only the first). */
export function blocksUntil(today: Date, day: Date): number {
  const back = daysBetween(day, today)
  return back <= 0 ? 1 : Math.floor(back / BLOCK_DAYS) + 1
}

export type TimelineSection<E> =
  | { kind: 'day'; key: string; day: Date; entries: E[]; today: boolean }
  | { kind: 'future'; key: string; day: Date; ahead: number }
  | { kind: 'gap'; key: string; newest: Date; oldest: Date; count: number; ahead: boolean }

/**
 * Sections from today (or a tapped future day) down to `from` (the oldest loaded day, never before
 * `historyStart`). Today and the tapped day always get their own section; other empty days in a row fold
 * into one "gap". Records inside a day are in time order.
 */
export function buildTimeline<E extends { event_date: string }>(entries: E[], opts: { today: Date; from: Date; historyStart?: Date | null; focus?: Date | null }): TimelineSection<E>[] {
  const today = startOfDay(opts.today)
  const byDay = new Map<string, E[]>()
  for (const e of entries) { const k = dayKey(e.event_date); byDay.set(k, [...(byDay.get(k) ?? []), e]) }
  byDay.forEach(list => list.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()))
  let lower = startOfDay(opts.from)
  if (opts.historyStart && startOfDay(opts.historyStart) > lower) lower = startOfDay(opts.historyStart)
  // A record older than the history start (backdated) still shows, as long as it is loaded.
  for (const k of byDay.keys()) { const [y, m, d] = k.split('-').map(Number); const day = new Date(y, m - 1, d); if (day < lower && day >= startOfDay(opts.from)) lower = day }
  const focus = opts.focus ? startOfDay(opts.focus) : null
  const out: TimelineSection<E>[] = []
  if (focus && focus > today) {
    const ahead = daysBetween(today, focus)
    out.push({ kind: 'future', key: 'future-' + dayKey(focus), day: focus, ahead })
    if (ahead > 1) out.push({ kind: 'gap', key: 'ahead-' + dayKey(focus), newest: addDays(focus, -1), oldest: addDays(today, 1), count: ahead - 1, ahead: true })
  }
  let gap: { newest: Date; oldest: Date; count: number } | null = null
  const flush = () => { if (gap) out.push({ kind: 'gap', key: 'gap-' + dayKey(gap.newest), ...gap, ahead: false }); gap = null }
  for (let day = today; day >= lower; day = addDays(day, -1)) {
    const k = dayKey(day), list = byDay.get(k)
    const isToday = k === dayKey(today)
    if (list?.length || isToday || (focus && k === dayKey(focus))) { flush(); out.push({ kind: 'day', key: k, day, entries: list ?? [], today: isToday }) }
    else if (gap) { gap.oldest = day; gap.count++ }
    else gap = { newest: day, oldest: day, count: 1 }
  }
  flush()
  return out
}

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTH_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const WEEKDAY_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** "9–11 set", "30 set–2 out", "18 out". */
export function dayRange(oldest: Date, newest: Date): string {
  if (dayKey(oldest) === dayKey(newest)) return `${newest.getDate()} ${MONTH_SHORT[newest.getMonth()]}`
  return oldest.getMonth() === newest.getMonth()
    ? `${oldest.getDate()}–${newest.getDate()} ${MONTH_SHORT[newest.getMonth()]}`
    : `${oldest.getDate()} ${MONTH_SHORT[oldest.getMonth()]}–${newest.getDate()} ${MONTH_SHORT[newest.getMonth()]}`
}

/** "3 dias sem registros · 9–11 set", "2 dias à frente · 15–16 set", and the spoken form. */
export function gapLabel(gap: { newest: Date; oldest: Date; count: number; ahead: boolean }) {
  const days = `${gap.count} ${gap.count === 1 ? 'dia' : 'dias'}`
  const what = gap.ahead ? 'à frente' : 'sem registros'
  const spoken = gap.count === 1
    ? `${gap.newest.getDate()} de ${MONTH_LONG[gap.newest.getMonth()]}`
    : `de ${gap.oldest.getDate()}${gap.oldest.getMonth() === gap.newest.getMonth() ? '' : ` de ${MONTH_LONG[gap.oldest.getMonth()]}`} a ${gap.newest.getDate()} de ${MONTH_LONG[gap.newest.getMonth()]}`
  return { text: `${days} ${what} · ${dayRange(gap.oldest, gap.newest)}`, a11y: `${days} ${what}, ${spoken}` }
}

/** "SEG, 19 DE OUTUBRO" and "Segunda, 19 de outubro, 2 registros, hoje" (or ", daqui a 3 dias"). */
export function dayHeading(day: Date, records: number, opts: { today?: boolean; ahead?: number } = {}) {
  const title = `${WEEKDAY_SHORT[day.getDay()]}, ${day.getDate()} DE ${MONTH_LONG[day.getMonth()].toUpperCase()}`
  const count = opts.ahead ? '' : `, ${records} ${records === 1 ? 'registro' : 'registros'}`
  const when = opts.today ? ', hoje' : opts.ahead ? `, daqui a ${opts.ahead} ${opts.ahead === 1 ? 'dia' : 'dias'}` : ''
  return { title, a11y: `${WEEKDAY_LONG[day.getDay()]}, ${day.getDate()} de ${MONTH_LONG[day.getMonth()]}${count}${when}` }
}

/**
 * Two-way sync between the list and the strip. A scroll made by the app (after a tap) has a target: until the
 * list reaches it nothing goes back to the strip, so there is no loop. A scroll made by the person selects the
 * day of the sticky header.
 */
export function stripSync(visible: string | null, state: { target: string | null; selected: string }): { select: string | null; clearTarget: boolean } {
  if (!visible) return { select: null, clearTarget: false }
  if (state.target) return { select: null, clearTarget: visible === state.target }
  return { select: visible === state.selected ? null : visible, clearTarget: false }
}

/** The oldest of the given dates (plant registered, germinated, first record), as a local day. */
export function historyStartOf(dates: (string | null | undefined)[]): Date | null {
  const days = dates.filter((d): d is string => !!d).map(d => { const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return d.length > 10 ? startOfDay(new Date(d)) : new Date(y, m - 1, dd) })
  return days.length ? new Date(Math.min(...days.map(d => d.getTime()))) : null
}

export type DayRow<E> =
  | { kind: 'plant'; plantId: string; name: string; count: number; first: E; divider: boolean }
  | { kind: 'entry'; entry: E; divider: 'none' | 'inset' }
/**
 * Rows inside a day card (UX item 8b, Figma L6/L7): with `nameOf` (all-plants calendar), one plant row per plant
 * in the item 6 order, a full-width divider between plants and an indented one between records; without it
 * (a single plant's diary), only the records.
 */
export function dayRows<E extends { plant_id: string; event_date: string }>(entries: E[], nameOf?: (e: E) => string): DayRow<E>[] {
  if (!nameOf) return [...entries].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()).map((entry, i) => ({ kind: 'entry', entry, divider: i ? 'inset' : 'none' }))
  const rows: DayRow<E>[] = []
  groupByPlant(entries, nameOf).forEach((g, gi) => {
    rows.push({ kind: 'plant', plantId: g.plantId, name: g.name, count: g.entries.length, first: g.entries[0], divider: gi > 0 })
    g.entries.forEach((entry, i) => rows.push({ kind: 'entry', entry, divider: i ? 'inset' : 'none' }))
  })
  return rows
}
