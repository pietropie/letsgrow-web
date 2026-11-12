/**
 * Início v3 (UX item 20; Figma N1–N4, faixa F1–F6, web W30). Só texto e estado, a partir dos dados reais:
 * /billing/recommendation (plano, motivos, plantas e ambientes), /usage (Bobby ou créditos), os itens de atenção e a
 * fase das plantas. A regra da recomendação é do backend; aqui nada escolhe plano.
 * Decisões do usuário (9 nov): a faixa não oferece nada por padrão; o botão "Ver o plano {nome}" só aparece com
 * `plan_key` e `reasons`; sem preço no Início; o aviso de uso sai de "Precisa de atenção".
 * Puro, sem imports: os testes do Node cobrem (tests/home-v3.test.cjs).
 */

type Reason = "plants_limit" | "grows_limit" | "queries_limit" | "queries_near_limit" | "credits_exhausted";
type Change = { key: string; from: number | boolean | null; to: number | boolean | null };
export type Rec = { current_plan: string; plan_key: string | null; reasons: Reason[]; covers: Reason[]; usage: { plants: { used: number; total: number | null }; grows: { used: number; total: number | null } }; changes: Change[] };
export type BandUsage = {
  mode: "queries" | "credits" | "both" | "unlimited";
  period: { renews_at: string | null };
  queries: { used: number; total: number | null; remaining: number | null } | null;
  credits: { remaining: number } | null;
  near_limit: boolean; exhausted: boolean;
} | null;

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const shortDay = (date: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? ""); return m ? `${Number(m[3])} ${MONTH_SHORT[Number(m[2]) - 1]}` : null; };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const join = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);
const UNLIMITED = 9999;
const unlimited = (n: number | null | undefined) => n == null || n >= UNLIMITED;

/** `seg`: os números para o medidor segmentado do painel (item 23); null sem limite ou em créditos. */
export type Meter = { label: string; value: string; fill: number | null; mark: "limit" | "near" | "out" | null; detail: string | null; seg: { used: number; total: number } | null };
export type PlanBandView = {
  meters: Meter[];
  /** F2: a linha amarela do que resta. */
  near: string | null;
  /** F3: só com plano recomendado e motivo. */
  offer: { text: string; button: string } | null;
};

/** Faixa "Seu plano" (F1–F6). */
export function planBandView(rec: Rec, usage: BandUsage, recommendedLabel: string | null): PlanBandView {
  const has = (r: Reason) => rec.reasons.includes(r);
  const count = (key: "plants" | "grows", label: string, reason: Reason): Meter => {
    const { used, total } = rec.usage[key];
    if (unlimited(total)) return { label, value: String(used), fill: null, mark: null, detail: null, seg: null };
    return { label, value: `${used} de ${total}`, fill: total ? Math.min(1, used / total!) : 0, mark: has(reason) ? "limit" : null, detail: null, seg: { used, total: total! } };
  };
  const renews = shortDay(usage?.period.renews_at);
  let bobby: Meter;
  if (usage?.mode === "credits" && usage.credits) {
    bobby = { label: "CRÉDITOS", value: plural(usage.credits.remaining, "crédito", "créditos"), fill: null, mark: usage.exhausted ? "out" : usage.near_limit ? "near" : null, detail: null, seg: null };
  } else if (usage?.queries && usage.queries.total != null && usage.mode !== "unlimited") {
    const q = usage.queries;
    bobby = { label: "BOBBY NO MÊS", value: `${q.used} de ${q.total}`, fill: q.total ? Math.min(1, q.used / q.total!) : 1,
      mark: usage.exhausted ? "out" : usage.near_limit ? "near" : null, detail: renews ? `renova ${renews}` : null, seg: { used: q.used, total: q.total! } };
  } else {
    bobby = { label: "BOBBY NO MÊS", value: "sem limite", fill: null, mark: null, detail: null, seg: null };
  }

  const q = usage?.queries;
  const near = usage && usage.near_limit && !usage.exhausted && q?.remaining != null && usage.mode !== "credits"
    ? `${q.remaining === 1 ? "Resta 1 conversa" : `Restam ${q.remaining} conversas`} com o Bobby${renews ? ` até ${renews}` : ""}.` : null;

  let offer: PlanBandView["offer"] = null;
  if (rec.plan_key && rec.reasons.length && recommendedLabel) {
    const to = (key: string) => { const c = rec.changes.find(x => x.key === key); return c && typeof c.to !== "boolean" ? c.to : undefined; };
    const parts: string[] = [];
    if (rec.covers.includes("plants_limit")) { const n = to("plants"); if (n !== undefined) parts.push(unlimited(n) ? "plantas sem limite" : plural(n!, "planta", "plantas")); }
    if (rec.covers.includes("grows_limit")) { const n = to("grows"); if (n !== undefined) parts.push(unlimited(n) ? "ambientes sem limite" : plural(n!, "ambiente", "ambientes")); }
    if (rec.covers.some(r => r === "queries_limit" || r === "queries_near_limit" || r === "credits_exhausted")) {
      const n = to("queries"); if (n !== undefined) parts.push(n == null ? "conversas com o Bobby sem limite" : `${plural(n, "conversa", "conversas")} com o Bobby por mês`);
    }
    offer = {
      text: parts.length ? `O ${recommendedLabel} cobre o que você atingiu: ${join(parts)}.` : `O ${recommendedLabel} aumenta os limites do seu plano.`,
      button: `Ver o plano ${recommendedLabel}`,
    };
  }
  return { meters: [count("plants", "PLANTAS", "plants_limit"), count("grows", "AMBIENTES", "grows_limit"), bobby], near, offer };
}

/** "Restam 3 de 4 conversas neste mês · renova 1 dez" (Bobby, Início v3); null sem limite. */
export function conversationsLine(usage: BandUsage): { text: string; fill: number } | null {
  if (!usage) return null;
  const renews = shortDay(usage.period.renews_at);
  if (usage.mode === "credits" && usage.credits) return { text: `${plural(usage.credits.remaining, "crédito disponível", "créditos disponíveis")}${renews ? ` · plano renova ${renews}` : ""}`, fill: 1 };
  const q = usage.queries;
  if (usage.mode === "unlimited" || !q || q.total == null) return null;
  const left = q.remaining ?? Math.max(0, q.total - q.used);
  const head = left === 0 ? `0 de ${q.total} ${q.total === 1 ? "conversa restante" : "conversas restantes"}` : `${left === 1 ? "Resta" : "Restam"} ${left} de ${plural(q.total, "conversa", "conversas")} neste mês`;
  const text = `${head}${renews ? ` · renova ${renews}` : ""}`;
  return { text, fill: q.total ? left / q.total : 0 };
}

/** Bobby esgotado (N2): o aviso no lugar das sugestões. */
export function exhaustedNotice(usage: BandUsage): { title: string; body: string; wait: string | null } | null {
  if (!usage?.exhausted) return null;
  const renews = shortDay(usage.period.renews_at);
  const total = usage.queries?.total;
  if (usage.mode === "credits") return { title: "Seus créditos acabaram", body: `O diário, os registros e o resumo diário continuam funcionando.${renews ? ` O plano renova em ${renews}.` : ""}`, wait: renews ? `Esperar até ${renews}` : null };
  return {
    title: total === 1 ? "Você usou a conversa deste mês" : `Você usou as ${total ? `${total} ` : ""}conversas deste mês`,
    body: `${renews ? `Novas perguntas voltam em ${renews}. ` : ""}O diário, os registros e o resumo diário continuam funcionando.`,
    wait: renews ? `Esperar até ${renews}` : null,
  };
}

export type Suggestion = { key: string; label: string; plantId?: string | null; growId?: string | null };
type Item = { key: string; title: string; tag: "AMBIENTE" | "REGA" | "BOBBY"; target: { kind: string; id: string } };
type PlantFact = { id: string; name: string; phaseLabel: string | null; day: number | null; lastWatering?: string | null };

const daysSince = (iso: string, now: Date) => {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((day(now) - day(new Date(iso))) / 86400000);
};

/**
 * Até 3 sugestões, enquanto o daily-brief não traz `suggestions[]` (item 20): dos itens de atenção (ambiente, rega,
 * alerta do Bobby) e, depois, da fase e do dia de cada planta. Nada cita medida que a conta não registrou.
 */
export function homeSuggestions(input: { items: Item[]; plants: PlantFact[]; growId: string; growName: string; now?: Date }): Suggestion[] {
  const now = input.now ?? new Date();
  const out: Suggestion[] = [];
  const plant = (id: string) => input.plants.find(p => p.id === id);
  for (const item of input.items) {
    if (item.tag === "AMBIENTE") {
      const what = item.key === "range-humidity" ? "a umidade" : "a temperatura";
      const up = / abaixo da faixa$/.test(item.title);
      out.push({ key: item.key, label: `Como ${up ? "aumentar" : "baixar"} ${what} da ${input.growName}?`, growId: input.growId });
    } else if (item.tag === "REGA") {
      const p = plant(item.target.id);
      if (!p) continue;
      const days = p.lastWatering ? daysSince(p.lastWatering, now) : null;
      out.push({ key: item.key, label: days != null && days > 0 ? `A ${p.name} está há ${plural(days, "dia", "dias")} sem rega. Rego hoje?` : `A ${p.name} precisa de rega hoje?`, plantId: p.id });
    } else if (item.target.kind === "observation") {
      out.push({ key: item.key, label: `${item.title.replace(/[.?!]$/, "")}: o que eu faço?`, plantId: item.target.id });
    }
  }
  for (const p of input.plants) {
    if (p.phaseLabel && p.day) out.push({ key: `phase-${p.id}`, label: `O que observar na ${p.name} no dia ${p.day} de ${p.phaseLabel.toLowerCase()}?`, plantId: p.id });
  }
  return out.slice(0, 3);
}

/** A próxima ação do cartão da planta: o primeiro item de atenção dela. */
export function nextAction<T extends Item>(plantId: string, items: T[], lastWatering: string | null | undefined, now = new Date()): (T & { text: string }) | null {
  const item = items.find(i => i.target.id === plantId && (i.tag === "REGA" || i.target.kind === "observation"));
  if (!item) return null;
  if (item.tag === "REGA") {
    const days = lastWatering ? daysSince(lastWatering, now) : null;
    return { ...item, text: days != null && days > 0 ? `Regar: a última rega foi há ${plural(days, "dia", "dias")}` : item.title };
  }
  return { ...item, text: item.title };
}

/* ── Contrato do backend para o Início v3 (nota inicio-v3-contrato.md, 9 nov). Tudo opcional até o deploy. ── */

export type BriefSuggestion = { label: string; prompt: string; plant_id?: string | null; grow_id?: string | null; basis?: { kind: "attention" | "phase" | "reading"; text: string; tier?: string; evidence?: unknown[] } };
export type SummaryV3 = {
  latest_photo_url?: string | null; cover_image_url?: string | null; phase_day?: number | null;
  next_action?: { action: string; tier: string; message: string } | null;
  last_event?: { id: string; event_type: string; label: string; event_date: string } | null;
};

/**
 * A próxima ação do backend, filtrada pelo critério de "Precisa de atenção", que recebe do /plants/bob-alerts só os
 * alertas critical e anomaly (rega atrasada incluída). O lembrete de tier "attention" não marca o cartão (como no app).
 * undefined: o backend ainda não manda o campo (o cliente usa os itens de atenção); null: nada pendente.
 */
export function backendNextAction(s: SummaryV3 | undefined): { text: string; watering: boolean } | null | undefined {
  if (!s || !("next_action" in s)) return undefined;
  const a = s.next_action;
  if (!a || !(a.tier === "critical" || a.tier === "anomaly")) return null;
  return { text: a.message, watering: a.action === "watering" };
}

/** "Nada pendente. Último registro: rega, hoje." Sem `last_event`, só "Nada pendente agora." */
export function idleLine(last: SummaryV3["last_event"], now = new Date()): string {
  if (!last?.event_date) return "Nada pendente agora.";
  const d = new Date(last.event_date);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86400000);
  const when = days <= 0 ? "hoje" : days === 1 ? "ontem" : days < 7 ? `há ${days} dias` : `em ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  return `Nada pendente. Último registro: ${last.label.toLowerCase()}, ${when}.`;
}

/* ── Painel (item 23b): marcadores curtos. Cor é sinal: rosa fora da faixa, verde só sensor ao vivo, amarelo luz e
   próxima ação; o resto é cinza. ── */

export type PanelMarker = { text: string; tone: "plain" | "light" | "out" | "live" };
const pad2 = (n: number) => String(n).padStart(2, "0");
const localDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** "hoje 08:10", "ontem", "há 3 dias", "19 out". */
export function whenShort(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((localDay(now) - localDay(d)) / 86400000);
  if (days <= 0) return `hoje ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

/** O marcador sob o mostrador: fora da faixa (rosa) ou a origem e a hora; sensor de até 30 min é "ao vivo" (verde). */
export function readingMarker(r: { value: number | null; source?: string | null; observed_at?: string | null }, out: "acima" | "abaixo" | null, now = new Date()): PanelMarker {
  if (r.value == null) return { text: "Sem leitura", tone: "plain" };
  if (out) return { text: `${out === "acima" ? "Acima" : "Abaixo"} da faixa`, tone: "out" };
  const at = r.observed_at ? new Date(r.observed_at) : null;
  const minutes = at ? Math.round((now.getTime() - at.getTime()) / 60000) : null;
  if (r.source === "sensor" && minutes != null && minutes <= 30) return { text: `Sensor · há ${Math.max(1, minutes)} min`, tone: "live" };
  const when = whenShort(r.observed_at, now);
  return { text: [r.source === "sensor" ? "Sensor" : "Manual", when].filter(Boolean).join(" · "), tone: "plain" };
}

/** "Regar · última há 3 dias" para rega; senão a primeira frase da próxima ação. */
export function nextMarker(next: { text: string; watering: boolean }, lastWatering: string | null | undefined, now = new Date()): string {
  if (next.watering) {
    const when = whenShort(lastWatering, now);
    return when ? `Regar · última ${when.startsWith("hoje") ? "hoje" : when.startsWith("há") || when === "ontem" ? when : `em ${when}`}` : "Regar";
  }
  return next.text.split(/(?<=[.!?])\s/)[0].replace(/[.]$/, "");
}

/** "Último: ontem" a partir do último registro. */
export function lastMarker(iso: string | null | undefined, now = new Date()): string | null {
  const when = whenShort(iso, now);
  return when ? `Último: ${when}` : null;
}
