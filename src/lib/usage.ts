/**
 * Mostrador de créditos e uso do Bobby (UX item 16; Figma 2383:19323, estados U1–U10, C1–C5, web W23 e W24).
 * Contrato final do GET /api/v1/usage (nota usage-contrato.md da sessão Backend, 2026-11-05): só os números da API,
 * nada calculado aqui além do texto e da fração do arco. `near_limit` e `exhausted` vêm do backend, com o limiar
 * configurável (`warning_threshold`, padrão 0.8), para ser o mesmo no app, na web e no Início.
 * Puro, sem imports: os testes do Node cobrem (tests/usage.test.cjs).
 */

export type Usage = {
  /** both: limite de consultas e créditos ao mesmo tempo; unlimited: nada limita. */
  mode: "queries" | "credits" | "both" | "unlimited";
  /** ISO. Com créditos, o mês de Brasília (start 00:00 do dia 1 = 03:00Z); só a parte da data é lida. */
  period: { start: string; renews_at: string | null };
  queries: { used: number; total: number | null; remaining: number | null } | null;
  credits: {
    /** Créditos concedidos pelo plano neste mês; 0 (ou null) quando o plano não dá créditos: só extras (U8). */
    plan_total: number | null; plan_used: number | null; extra_balance: number;
    /** Tudo o que saiu no mês, plano e extra (reservas menos estornos). */
    used_in_period: number;
    /** Saldo disponível agora, plano + extra: o número central. */
    remaining: number;
    next_expiry: { at: string; credits: number } | null;
  } | null;
  near_limit: boolean;
  exhausted: boolean;
  warning_threshold?: number;
};

export type Tone = "normal" | "alert" | "error";
export type MeterView = {
  title: string;
  tag: { label: string; tone: "alert" | "error" | "calm" } | null;
  /** null: a API não mandou o contador (unlimited sem `queries`); nenhum número é inventado. */
  center: number | null;
  centerCaption: string;
  /** Fração usada (0–1) para o arco de 24 segmentos; null sem arco (sem limite, só extras). */
  arc: { used: number; tone: Tone } | null;
  stats: { label: string; value: string }[];
  note: string | null;
  primary: "plans" | "packs" | null;
  secondary: "plans" | "packs" | null;
  link: { label: string; to: "history" | "plans" };
};
export type CompactView = { text: string; tone: Tone; bar: number | null; label: string };
export type UsageNotice = { title: string; meta: string };

const MONTH_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function parts(date: string | null | undefined): { day: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? "");
  return m ? { day: Number(m[3]), month: Number(m[2]) - 1 } : null;
}
/** "1 nov" */
export function usageDay(date: string | null | undefined): string | null {
  const p = parts(date);
  return p ? `${p.day} ${MONTH_SHORT[p.month]}` : null;
}
/** "outubro", o mês do período */
export function usageMonth(date: string | null | undefined): string | null {
  const p = parts(date);
  return p ? MONTH_LONG[p.month] : null;
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const clamp = (x: number) => Math.min(1, Math.max(0, x));

function queriesMeter(u: Usage, q: { used: number | null; total: number | null; remaining: number | null }): MeterView {
  const month = usageMonth(u.period.start), renews = usageDay(u.period.renews_at);
  const title = `BOBBY · CONSULTAS${month ? ` DE ${month.toUpperCase()}` : " DO MÊS"}`;
  if (q.total == null) return {
    title, tag: { label: "SEM LIMITE", tone: "calm" }, center: q.used, centerCaption: month ? `USADAS EM ${month.toUpperCase()}` : "USADAS NO MÊS",
    arc: null, stats: [], note: "Seu plano não tem limite mensal de consultas.", primary: null, secondary: null, link: { label: "Ver histórico de uso", to: "history" },
  };
  const usedNow = q.used ?? 0;
  const remaining = q.remaining ?? Math.max(0, q.total - usedNow);
  const stats = [{ label: "USADAS", value: String(usedNow) }, { label: "TOTAL NO MÊS", value: String(q.total) }];
  if (renews) stats.push({ label: u.exhausted ? "VOLTA EM" : "RENOVA", value: renews });
  if (u.exhausted) return {
    title, tag: { label: "ESGOTADO", tone: "error" }, center: 0, centerCaption: "RESTAM", arc: { used: 1, tone: "error" }, stats,
    note: `Você usou as ${q.total} consultas${month ? ` de ${month}` : " do mês"}.${renews ? ` O Bobby volta em ${renews}.` : ""}`,
    primary: "plans", secondary: null, link: { label: "Ver histórico de uso", to: "history" },
  };
  const used = clamp(usedNow / q.total);
  if (u.near_limit) return {
    title, tag: { label: "PERTO DO FIM", tone: "alert" }, center: remaining, centerCaption: "RESTAM", arc: { used, tone: "normal" }, stats,
    note: `Restam ${plural(remaining, "consulta", "consultas")}${renews ? ` até ${renews}` : ""}. Depois, o Bobby pausa até a renovação.`,
    primary: null, secondary: null, link: { label: "Ver planos", to: "plans" },
  };
  return { title, tag: null, center: remaining, centerCaption: "RESTAM", arc: { used, tone: "normal" }, stats, note: null, primary: null, secondary: null, link: { label: "Ver histórico de uso", to: "history" } };
}

/** A fração do mês, como o backend calcula o near_limit: usado / (usado + restante). */
function creditsUsed(c: NonNullable<Usage["credits"]>): number {
  const all = c.used_in_period + c.remaining;
  return all > 0 ? clamp(c.used_in_period / all) : 1;
}

function creditsMeter(u: Usage, c: NonNullable<Usage["credits"]>, packs: boolean): MeterView {
  const renews = usageDay(u.period.renews_at);
  const title = "CRÉDITOS · SALDO";
  const link = { label: "Ver histórico de créditos", to: "history" as const };
  // U8: plano sem créditos no mês, só o saldo comprado à parte.
  if (!c.plan_total) {
    const expiry = c.next_expiry && usageDay(c.next_expiry.at);
    return {
      title, tag: u.exhausted ? { label: "ESGOTADO", tone: "error" } : null, center: c.remaining, centerCaption: "CRÉDITOS EXTRAS", arc: null, stats: [],
      note: u.exhausted ? "Seu saldo acabou." : `Créditos comprados à parte.${c.next_expiry && expiry ? ` ${c.next_expiry.credits} ${c.next_expiry.credits === 1 ? "vence" : "vencem"} em ${expiry}.` : ""}`,
      primary: u.exhausted ? (packs ? "packs" : "plans") : null, secondary: null, link,
    };
  }
  const planLeft = Math.max(0, c.plan_total - (c.plan_used ?? 0));
  const stats = [{ label: "DO PLANO", value: `${planLeft} de ${c.plan_total}` }, { label: "EXTRAS", value: String(c.extra_balance) }];
  if (!u.near_limit && !u.exhausted) stats.push({ label: "USADOS NO MÊS", value: String(c.used_in_period) });
  if (renews) stats.push({ label: "PLANO RENOVA", value: renews });
  const used = creditsUsed(c);
  if (u.exhausted) return {
    title, tag: { label: "ESGOTADO", tone: "error" }, center: 0, centerCaption: "DISPONÍVEIS", arc: { used: 1, tone: "error" }, stats,
    note: `Seu saldo acabou.${renews ? ` O plano volta com ${c.plan_total} créditos em ${renews}.` : ""}`,
    primary: packs ? "packs" : "plans", secondary: packs ? "plans" : null, link,
  };
  if (u.near_limit) return {
    title, tag: { label: "PERTO DO FIM", tone: "alert" }, center: c.remaining, centerCaption: "DISPONÍVEIS", arc: { used, tone: "normal" }, stats,
    note: "Você vê o custo antes de cada tarefa paga.", primary: null, secondary: packs ? "packs" : null, link,
  };
  return { title, tag: null, center: c.remaining, centerCaption: "DISPONÍVEIS", arc: { used, tone: "normal" }, stats, note: null, primary: null, secondary: null, link };
}

/** O cartão completo (Conta › Créditos e plano). `packs`: há pacote de créditos à venda. */
export function meterView(u: Usage, packs = false): MeterView | null {
  if (u.mode === "credits") return u.credits ? creditsMeter(u, u.credits, packs) : null;
  // U4: nada limita; só o uso do mês.
  if (u.mode === "unlimited") return queriesMeter(u, { used: u.queries?.used ?? null, total: null, remaining: null });
  if (!u.queries) return null;
  const view = queriesMeter(u, u.queries);
  // U9: limite e créditos. O arco é o das consultas; os créditos entram como mais uma linha.
  if (u.mode === "both" && u.credits && u.queries.total != null) {
    view.stats.push({ label: "CRÉDITOS", value: `${u.credits.remaining} ${u.credits.remaining === 1 ? "disponível" : "disponíveis"}` });
    if (!view.note) view.note = "Fotos e outras tarefas pagas usam créditos e também contam no limite do mês.";
  }
  return view;
}

/** A pílula do Bobby (C1–C5). Null no plano sem limite (C6): não há o que acompanhar. */
export function compactView(u: Usage): CompactView | null {
  const renews = usageDay(u.period.renews_at);
  const tone: Tone = u.exhausted ? "error" : u.near_limit ? "alert" : "normal";
  const q = u.queries, c = u.credits;
  if (u.mode === "unlimited") return null;
  if (u.mode !== "credits" && q) {
    if (q.total == null) return null;
    const remaining = q.remaining ?? Math.max(0, q.total - q.used);
    const bar = clamp(q.used / q.total);
    const text = u.exhausted ? `${q.used} de ${q.total} usadas${renews ? ` · volta em ${renews}` : ""}`
      : u.near_limit ? `${q.used} de ${q.total} usadas · restam ${remaining}`
      : u.mode === "both" && c ? `${q.used} de ${q.total} consultas · ${c.remaining} créditos`
      : `${q.used} de ${q.total} consultas${renews ? ` · renova ${renews}` : ""}`;
    return { text, tone, bar, label: `Consultas do Bobby: ${text}. Abrir créditos e plano` };
  }
  if (!c) return null;
  const bar = c.plan_total ? creditsUsed(c) : null;
  const text = u.exhausted ? `Sem créditos${c.plan_total && renews ? ` · plano volta em ${renews}` : ""}`
    : u.near_limit ? `${plural(c.remaining, "crédito", "créditos")} · perto do fim`
    : !c.plan_total ? `${plural(c.remaining, "crédito extra", "créditos extras")}`
    : `${plural(c.remaining, "crédito", "créditos")}${renews ? ` · plano renova ${renews}` : ""}`;
  return { text, tone, bar, label: `Créditos: ${text}. Abrir créditos e plano` };
}

/** O aviso em "Precisa de atenção" do Início (M4): só perto do fim ou esgotado. */
export function usageNotice(u: Usage): UsageNotice | null {
  if (!u.near_limit && !u.exhausted) return null;
  const compact = compactView(u);
  if (!compact) return null;
  const credits = u.mode === "credits";
  const title = u.exhausted ? (credits ? "Créditos do Bobby acabaram" : "Consultas do Bobby acabaram") : "Bobby perto do limite";
  return { title, meta: compact.text };
}
