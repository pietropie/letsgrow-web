// Copiado de letsgrow-mobile/lib/bobbyChat.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * Bobby chat in the pattern of AI apps (UX item 10, Figma "Bobby 2026" B1–B11). Pure rules, no runtime imports,
 * so they run in the Node tests.
 */

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTH_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "Bom dia, Pietro" (5–11 h), "Boa tarde" (12–17 h), "Boa noite" otherwise; the first name only. */
export function greeting(name: string | null | undefined, hour: number): string {
  const first = name?.trim().split(/\s+/)[0]
  const hello = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite'
  return first ? `${hello}, ${first}` : hello
}

/** A calendar date ("2026-11-01" or an ISO datetime) read by its date part, so the time zone cannot shift it. */
function calendarDate(value?: string | null): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
const dayMonth = (d: Date) => `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`

export type ComposerFooter = {
  text: string
  /** The link after the text (B8 "· Ver meu limite"): only in the plan-only mode, and not once the limit is reached (B9). */
  link: 'limit' | null
  /** Limit reached: the footer turns error, sending is paused, and B9 shows its card. */
  limitReached: boolean
  /** "1 nov", when the plan says when the limit renews. */
  renews: string | null
  /** "outubro": the month whose queries ran out (B9 title). */
  month: string | null
  limit: number | null
}

/**
 * Footer of the composer by billing mode (UX item 9, U1), worded as the Figma screens draw it: B1 shows the credits
 * text without the "Ver escopo e custo" link, B8 ends the usage without a period before " · Ver meu limite", and B9
 * has no link once the limit is reached. `used`/`limit` come from the plan
 * (ai_queries_used, ai_queries_per_month), `renewsAt` from ai_queries_renews_at (or the reset date).
 */
export function composerFooter(balance: { enabled: boolean; replaces_query_limit: boolean } | null | undefined,
  plan: { used: number; limit: number | null; renewsAt?: string | null } | null | undefined, now = new Date()): ComposerFooter {
  const renewDate = calendarDate(plan?.renewsAt)
  const renews = renewDate ? dayMonth(renewDate) : null
  const base = { limitReached: false, renews, month: null, limit: plan?.limit ?? null }
  if (balance?.enabled && balance.replaces_query_limit) return { ...base, text: 'Nada é cobrado antes de você confirmar.', link: null }
  if (balance?.enabled) return { ...base, text: 'Nada é cobrado antes de você confirmar. Cada mensagem também conta no limite mensal do plano.', link: null }
  if (!plan || plan.limit == null) return { ...base, text: 'Seu plano não tem limite mensal de consultas.', link: null }
  const tail = renews ? ` · renova em ${renews}` : ''
  if (plan.used >= plan.limit) return { ...base, limitReached: true, month: MONTH_LONG[now.getMonth()], link: null,
    text: `Você usou as ${plan.limit} consultas deste mês${tail}.` }
  return { ...base, link: 'limit', text: `${plan.used} de ${plan.limit} consultas usadas este mês${tail}` }
}

export type Suggestion = { key: string; title: string; subtitle: string; prompt?: string; plantId?: string | null; growId?: string | null; photo?: boolean }

/**
 * Starter suggestions (B1): only from the person's context and alerts, at most 4, no fixed intro questions
 * (user decision 3). In order: alerts, the next watering of the plant watered longest ago, what changed this
 * week (when there were records in the last 7 days) and a photo analysis (when there is a plant).
 */
export function starterSuggestions(input: {
  alerts: { alert_id: string; plant_id: string; plant_name: string; message: string }[]
  plants: { id: string; name: string; growName?: string | null; lastWateringAt?: string | null }[]
  /** The most recent record date across the environments (env.last_event_at). */
  lastRecordAt?: string | null
  now?: Date
}): Suggestion[] {
  const now = input.now ?? new Date()
  const days = (iso: string) => Math.max(0, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(new Date(iso).getFullYear(), new Date(iso).getMonth(), new Date(iso).getDate()).getTime()) / 86400000))
  const out: Suggestion[] = []
  for (const a of input.alerts.slice(0, 2)) {
    const plant = input.plants.find(p => p.id === a.plant_id)
    out.push({ key: 'alert-' + a.alert_id, title: `O que o alerta da ${a.plant_name} quer dizer?`, subtitle: ['Alerta de hoje', plant?.growName].filter(Boolean).join(' · '),
      prompt: `Explique este alerta da ${a.plant_name}: "${a.message}"`, plantId: a.plant_id })
  }
  const watered = input.plants.filter(p => p.lastWateringAt).sort((a, b) => new Date(a.lastWateringAt!).getTime() - new Date(b.lastWateringAt!).getTime())[0]
  if (watered) {
    const d = days(watered.lastWateringAt!)
    out.push({ key: 'water-' + watered.id, title: `Quando regar a ${watered.name} de novo?`, subtitle: `Última rega ${d === 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`}`,
      prompt: `Quando devo regar a ${watered.name} de novo?`, plantId: watered.id })
  }
  if (input.lastRecordAt && days(input.lastRecordAt) <= 7) out.push({ key: 'week', title: 'O que mudou nesta semana?', subtitle: 'Resumo dos registros', prompt: 'O que mudou nos meus registros nesta semana?' })
  if (input.plants.length) out.push({ key: 'photo', title: 'Analisar uma foto da folha', subtitle: 'Diagnóstico por imagem', photo: true })
  return out.slice(0, 4)
}

export type ConversationGroup<C> = { label: string; items: C[] }
/** Drawer groups (B4): HOJE, ONTEM, ÚLTIMOS 7 DIAS and ANTERIORES, by the local day of the last update. */
export function groupConversations<C extends { updated_at: string }>(items: C[], now = new Date()): ConversationGroup<C>[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const bucket = (iso: string) => {
    const d = new Date(iso), day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const diff = Math.round((today - day) / 86400000)
    return diff <= 0 ? 'HOJE' : diff === 1 ? 'ONTEM' : diff < 7 ? 'ÚLTIMOS 7 DIAS' : 'ANTERIORES'
  }
  const order = ['HOJE', 'ONTEM', 'ÚLTIMOS 7 DIAS', 'ANTERIORES']
  const sorted = [...items].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  return order.map(label => ({ label, items: sorted.filter(c => bucket(c.updated_at) === label) })).filter(g => g.items.length)
}

/** "Esta análise usa 2 créditos", "Inclui as 2 fotos e os registros da Aurora.", "Saldo: 18 → 16 créditos." (B10). */
export function quoteCard(q: { cost: number; available: number; after: number; scope: { plant_name?: string; grow_name?: string } | null }, photos: number) {
  const credits = (n: number) => `${n} ${n === 1 ? 'crédito' : 'créditos'}`
  const where = q.scope?.plant_name ? `os registros da ${q.scope.plant_name}` : q.scope?.grow_name ? `os registros do ambiente ${q.scope.grow_name}` : 'todos os seus registros'
  const what = photos ? `${photos === 1 ? 'a foto' : `as ${photos} fotos`} e ${where}` : where
  return { title: `Esta ${photos ? 'análise' : 'mensagem'} usa ${credits(q.cost)}`, body: `Inclui ${what}.`, balance: `Saldo: ${q.available} → ${credits(q.after)}.` }
}
