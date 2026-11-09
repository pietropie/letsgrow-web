/**
 * Card "Seu plano" (UX item 19; Figma 2388:19857, estados P1–P7, web W25). O plano recomendado é do backend
 * (GET /billing/recommendation, item 19b): aqui não se escolhe plano.
 * Preço e o que está à venda vêm de GET /billing/catalog (web); limites, de GET /plans/config pelo `plan_key` (o
 * `price_display` e o `badge_text` de lá não são usados: nada de "Popular" sem dado). Uso, de GET /usage.
 * Decisões do usuário (9 nov): Free normal → "Fazer upgrade" primário; explorar → "Ver planos" secundário; sem teste
 * grátis; anual só com desconto real; prova social só com a nota real da Play Store (até lá, oculta).
 * Puro, sem imports: os testes do Node cobrem (tests/plans.test.cjs).
 */

export type PlanLimits = {
  plan_key: string; label: string; price_brl: number;
  max_plants: number; max_grows: number; max_pots_per_grow: number; ai_queries_per_month: number | null; sensors_allowed: boolean;
};
export type CatalogPlan = { plan_key: string; label: string; periods: { period: "monthly" | "yearly"; months: number; price_brl: number | null }[] };
export type Catalog = { web_enabled: boolean; plans: CatalogPlan[] };
export type Subscription = { plan_key: string; period: "monthly" | "yearly"; provider: "mercadopago" | "google_play"; kind: "recurring" | "prepaid"; auto_renew: boolean; current_period_end: string | null; access_until: string | null };
export type PlanUsage = {
  mode: "queries" | "credits" | "both" | "unlimited";
  period: { start: string; renews_at: string | null };
  queries: { used: number; total: number | null; remaining: number | null } | null;
  credits: { remaining: number } | null;
  near_limit: boolean; exhausted: boolean;
};

const UNLIMITED = 9999;
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const parts = (date: string | null | undefined) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? ""); return m ? { day: Number(m[3]), month: Number(m[2]) - 1 } : null; };
const day = (date: string | null | undefined) => { const p = parts(date); return p ? `${p.day} ${MONTH_SHORT[p.month]}` : null; };
const month = (date: string | null | undefined) => { const p = parts(date); return p ? MONTH_LONG[p.month] : null; };
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
export const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/** Os nomes antigos do backend (grower, pro) apontam para os atuais. */
export const normalizePlan = (plan: string) => (plan === "grower" ? "cultivador" : plan === "pro" ? "grower_pro" : plan);
const queriesOf = (p: PlanLimits) => p.ai_queries_per_month ?? Infinity;
const isUnlimited = (p: PlanLimits) => p.max_plants >= UNLIMITED && p.ai_queries_per_month == null;

/** Preço vendável de um período, ou null. */
export function priceOf(catalog: Catalog | null | undefined, planKey: string, period: "monthly" | "yearly" = "monthly"): number | null {
  if (!catalog?.web_enabled) return null;
  return catalog.plans.find(p => p.plan_key === planKey)?.periods.find(x => x.period === period)?.price_brl ?? null;
}
/** Planos com algum período vendável na web, na ordem de /plans/config (do menor para o maior). */
export function plansForSale(plans: PlanLimits[], catalog: Catalog | null | undefined): PlanLimits[] {
  return plans.filter(p => p.plan_key !== "free" && (priceOf(catalog, p.plan_key, "monthly") != null || priceOf(catalog, p.plan_key, "yearly") != null));
}


/** "1 planta · 1 ambiente · 1 consulta do Bobby por mês" */
export function limitsLine(p: PlanLimits, withQueries = true): string {
  if (isUnlimited(p)) return "Plantas, ambientes e Bobby sem limite";
  const items = [
    p.max_plants >= UNLIMITED ? "plantas sem limite" : plural(p.max_plants, "planta", "plantas"),
    p.max_grows >= UNLIMITED ? "ambientes sem limite" : plural(p.max_grows, "ambiente", "ambientes"),
  ];
  if (withQueries) items.push(p.ai_queries_per_month == null ? "Bobby sem limite" : `${plural(p.ai_queries_per_month, "consulta", "consultas")} do Bobby por mês`);
  return items.join(" · ");
}

const WEEKLY = ["", "uma", "duas", "três"];
/** O que se ganha com o plano, em resultado e não em número de recurso; só o que melhora em relação ao atual. */
export function benefits(target: PlanLimits, mine: PlanLimits | undefined): string[] {
  const out: string[] = [];
  if (!mine || target.max_plants > mine.max_plants) out.push(target.max_plants >= UNLIMITED ? "Acompanhe quantas plantas quiser" : `Acompanhe ${plural(target.max_plants, "planta", "plantas")} ao mesmo tempo`);
  if (!mine || target.max_grows > mine.max_grows) { if (mine) out.push(target.max_grows >= UNLIMITED ? "Ambientes sem limite" : `${plural(target.max_grows, "ambiente", "ambientes")} para organizar o cultivo`); }
  if (!mine || queriesOf(target) > queriesOf(mine)) {
    const q = target.ai_queries_per_month;
    const weekly = q != null ? WEEKLY[Math.round(q / 4)] : "";
    out.push(q == null ? "Converse com o Bobby sem limite" : `${plural(q, "conversa", "conversas")} com o Bobby por mês${weekly ? `, cerca de ${weekly} por semana` : ""}`);
  }
  if (target.sensors_allowed && !mine?.sensors_allowed) out.push("Conecte sensores ao ambiente");
  return out;
}

export type CardState = "normal" | "near" | "exhausted" | "credits" | "paid" | "unlimited" | "explore";
export type PlanCardView = {
  state: CardState;
  name: string;
  tag: { label: string; tone: "alert" | "error" | "calm" } | null;
  /** Linha abaixo do nome: limites, ou o convite do modo explorar. */
  lead: string;
  /** Faixa de uso: barra de 10 segmentos (null sem barra) e o texto. */
  usage: { bar: number | null; tone: "normal" | "alert" | "error"; text: string } | null;
  note: string | null;
  upsell: { plan: PlanLimits; benefits: string[]; price: string } | null;
  primary: { label: string; to: "plans" | "packs" } | null;
  manage: { to: "plans" | "play" } | null;
  secondary: { label: string; to: "plans" } | null;
  link: { label: string; to: "credits" | "plans" };
};

export type PlanCardInput = {
  current: string;
  plans: PlanLimits[];
  catalog: Catalog | null | undefined;
  usage: PlanUsage | null | undefined;
  subscription: Subscription | null | undefined;
  /** Sem planta ativa (modo explorar). */
  exploring: boolean;
  /** O plano que o backend recomenda (GET /billing/recommendation, item 19b); null ou ausente: sem upsell. */
  recommended?: string | null;
  /** A compra está liberada (flag `plan_switch` ou conta em modo dev). */
  canBuy: boolean;
  /** Há pacote de créditos à venda na web. */
  packs: boolean;
};

function renewal(sub: Subscription | null | undefined): string | null {
  if (!sub) return null;
  const when = day(sub.auto_renew ? sub.current_period_end : sub.access_until ?? sub.current_period_end);
  if (!when) return null;
  if (sub.provider === "google_play") return sub.auto_renew ? `renova em ${when} pelo Google Play` : `acesso até ${when}, pelo Google Play`;
  return sub.auto_renew ? `renova em ${when}` : `acesso até ${when}, sem renovação`;
}

/** O card "Seu plano" da Minha conta (P1–P7). P8 é só do Android. */
export function planCardView(input: PlanCardInput): PlanCardView | null {
  const current = normalizePlan(input.current);
  const mine = input.plans.find(p => p.plan_key === current);
  if (!mine) return null;
  const u = input.usage ?? null;
  const renews = day(u?.period.renews_at);
  const rec = input.canBuy && input.recommended ? input.plans.find(p => p.plan_key === normalizePlan(input.recommended!) && p.plan_key !== current) ?? null : null;
  const recPrice = rec ? priceOf(input.catalog, rec.plan_key) : null;
  const upsell = rec && recPrice != null ? { plan: rec, benefits: benefits(rec, mine), price: `${brl(recPrice)} por mês · cartão ou Pix` } : null;
  const base = { name: mine.label, note: null, upsell: null, primary: null, manage: null, secondary: null, link: { label: "Ver uso e histórico", to: "credits" as const } };

  if (input.exploring) {
    const lead = current === "free"
      ? `Comece cadastrando sua primeira planta. O Free acompanha ${plural(mine.max_plants, "planta", "plantas")} e ${mine.ai_queries_per_month == null ? "o Bobby sem limite" : `${plural(mine.ai_queries_per_month, "consulta", "consultas")} do Bobby por mês`}.`
      : limitsLine(mine);
    return { ...base, state: "explore", tag: null, lead, usage: null, secondary: input.canBuy && plansForSale(input.plans, input.catalog).length ? { label: "Ver planos", to: "plans" } : null, link: { label: "Créditos e plano", to: "credits" } };
  }

  const sub = input.subscription ?? null;
  const paid = current !== "free";
  const manage = sub ? { to: sub.provider === "google_play" ? "play" as const : "plans" as const } : null;

  if (u?.mode === "credits" && u.credits) {
    const text = `${plural(u.credits.remaining, "crédito", "créditos")}${renews ? ` · plano renova ${renews}` : ""}`;
    return {
      ...base, state: "credits", tag: u.exhausted ? { label: "ESGOTADO", tone: "error" } : u.near_limit ? { label: "PERTO DO FIM", tone: "alert" } : null,
      lead: limitsLine(mine, false), usage: { bar: null, tone: u.exhausted ? "error" : u.near_limit ? "alert" : "normal", text },
      primary: input.packs ? { label: "Comprar créditos", to: "packs" } : null, manage,
      link: input.canBuy && plansForSale(input.plans, input.catalog).length ? { label: "Ver planos", to: "plans" } : base.link,
    };
  }

  if (u?.mode === "unlimited" || isUnlimited(mine)) {
    const used = u?.queries?.used;
    const m = month(u?.period.start);
    const r = renewal(sub);
    return {
      ...base, state: "unlimited", tag: { label: "SEM LIMITES", tone: "calm" }, lead: limitsLine(mine),
      usage: used != null && m ? { bar: null, tone: "normal", text: `Bobby · ${plural(used, "consulta", "consultas")} em ${m}` } : null,
      note: r ? `${r[0].toUpperCase()}${r.slice(1)}.` : null, manage,
    };
  }

  const q = u?.queries;
  const total = q?.total ?? null;
  const state: CardState = u?.exhausted ? "exhausted" : u?.near_limit ? "near" : "normal";
  let usage: PlanCardView["usage"] = null;
  if (q && total != null) {
    const head = `Bobby · ${q.used} de ${plural(total, "consulta", "consultas")}`;
    const tail = state === "exhausted" ? (renews ? `volta em ${renews}` : null) : state === "near" ? (q.remaining != null ? `restam ${q.remaining}` : null) : (renews ? `renova ${renews}` : null);
    usage = { bar: total > 0 ? Math.min(1, q.used / total) : 1, tone: state === "exhausted" ? "error" : state === "near" ? "alert" : "normal", text: tail ? `${head} · ${tail}` : head };
  }
  const tag: PlanCardView["tag"] = state === "exhausted" ? { label: "ESGOTADO", tone: "error" } : state === "near" ? { label: "PERTO DO FIM", tone: "alert" } : paid ? { label: "ATIVO", tone: "calm" } : null;
  const exhaustedNote = state === "exhausted" ? `O Bobby volta${renews ? ` em ${renews}` : " na renovação"}.${upsell ? " Com o upgrade, você continua agora." : ""}` : null;

  if (upsell) return { ...base, state, tag, lead: limitsLine(mine), usage, note: exhaustedNote, upsell, primary: { label: "Fazer upgrade", to: "plans" } };

  // Sem plano acima à venda: sem upsell (P5); o pago mostra preço e renovação.
  const price = sub ? priceOf(input.catalog, sub.plan_key, sub.period) ?? (sub.plan_key === current ? mine.price_brl : null) : null;
  const r = renewal(sub);
  const paidNote = paid && (price || r) ? [price ? `${brl(price)} por ${sub?.period === "yearly" ? "ano" : "mês"}` : null, r].filter(Boolean).join(" · ") + "." : null;
  return { ...base, state: paid ? "paid" : state, tag, lead: limitsLine(mine), usage, note: exhaustedNote ?? paidNote, manage };
}
