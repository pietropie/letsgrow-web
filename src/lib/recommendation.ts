/**
 * Planos v2 (UX item 19b; Figma W28 2401:21133 e W29 2400:21433). A regra da recomendação é do backend
 * (GET /billing/recommendation?platform=web, contrato final do Pagamentos, 9 nov): o plano, os motivos, os motivos que
 * o plano cobre, o uso de plantas e ambientes e as mudanças (atual × recomendado). Aqui só o texto: nada decide plano
 * nem motivo no cliente. Preço e nome vêm do /billing/catalog; consultas e créditos, do /usage.
 * Decisões do usuário (9 nov): "RECOMENDADO PARA VOCÊ" só com motivo real, senão "PRÓXIMO PASSO" em cartão claro;
 * "Menos de R$ 1 por dia" só se preço ÷ 30 < 1; limite igual aparece como "igual".
 * Puro, sem imports: os testes do Node cobrem (tests/recommendation.test.cjs).
 */

export type Reason = "plants_limit" | "grows_limit" | "queries_limit" | "queries_near_limit" | "credits_exhausted";
/** key: plants, grows, pots_per_grow, queries, credits (só com créditos) ou sensors (booleano). to null = sem limite. */
export type Change = { key: string; from: number | boolean | null; to: number | boolean | null };
export type Recommendation = {
  current_plan: string;
  /** null: não há plano acima à venda (e changes vem vazio). */
  plan_key: string | null;
  reasons: Reason[];
  /** Os motivos que o plano recomendado aumenta: o texto "Cobre os dois limites…". */
  covers: Reason[];
  usage: { plants: { used: number; total: number | null }; grows: { used: number; total: number | null } };
  /** null = sem limite. */
  changes: Change[];
};
/** O que o /usage já traz e esta tela lê. */
export type QueriesUsage = { mode?: string; queries: { used: number; total: number | null } | null; exhausted: boolean; near_limit: boolean } | null;
/** O backend manda 9999 como "sem limite" nos totais de plantas e ambientes. */
const UNLIMITED = 9999;
const unlimited = (total: number | null) => total == null || total >= UNLIMITED;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const join = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`);
const NUMBER = ["zero", "uma", "duas", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

export type UsageRow = { key: "plants" | "queries" | "grows"; label: string; value: string; fill: number; tag: { label: string; tone: "alert" | "error" } | null };
export type RecommendationView = {
  usage: { rows: UsageRow[]; conclusion: string; tone: "alert" | "calm" };
  /** null: sem plano acima à venda, sem destaque. */
  highlight: null | {
    planKey: string;
    tag: "RECOMENDADO PARA VOCÊ" | "PRÓXIMO PASSO";
    dark: boolean;
    reason: string;
    changes: { label: string; from: string | null; to: string; same: boolean }[];
    benefits: string[];
  };
};

/** Faixa "Seu uso hoje": plantas, Bobby neste mês e ambientes, com a etiqueta do motivo que o backend mandou. */
function usageRows(rec: Recommendation, q: QueriesUsage): UsageRow[] {
  const has = (r: Reason) => rec.reasons.includes(r);
  const row = (key: UsageRow["key"], label: string, used: number, total: number | null, tag: UsageRow["tag"]): UsageRow =>
    ({ key, label, value: unlimited(total) ? `${used} · sem limite` : `${used} de ${total}`, fill: unlimited(total) ? 0 : total ? Math.min(1, used / total!) : 0, tag });
  const rows = [row("plants", "Plantas", rec.usage.plants.used, rec.usage.plants.total, has("plants_limit") ? { label: "NO LIMITE", tone: "alert" } : null)];
  if (q?.queries && q.queries.total != null) rows.push(row("queries", "Bobby neste mês", q.queries.used, q.queries.total,
    has("queries_limit") ? { label: "ESGOTADO", tone: "alert" } : has("queries_near_limit") ? { label: "PERTO DO FIM", tone: "alert" } : null));
  else if (q?.mode === "unlimited") rows.push({ key: "queries", label: "Bobby neste mês", value: q.queries ? `${q.queries.used} · sem limite` : "Sem limite", fill: 0, tag: null });
  rows.push(row("grows", "Ambientes", rec.usage.grows.used, rec.usage.grows.total, has("grows_limit") ? { label: "NO LIMITE", tone: "alert" } : null));
  return rows;
}

const LIMIT_NAME: Partial<Record<Reason, [string, string]>> = { plants_limit: ["de plantas", "plantas"], queries_limit: ["do Bobby", "Bobby"], grows_limit: ["de ambientes", "ambientes"] };

const CHANGE_LABEL: Record<string, string> = { plants: "Plantas ao mesmo tempo", queries: "Conversas com o Bobby", grows: "Ambientes" };
const ORDER = ["plants", "queries", "grows"];

type NumChange = { key: string; from: number | null; to: number | null };
const numeric = (c: Change): c is NumChange => typeof c.from !== "boolean" && typeof c.to !== "boolean";

function changeRows(changes: Change[]) {
  return changes.filter(numeric).filter(c => CHANGE_LABEL[c.key]).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)).map(c => {
    const fmt = (n: number | null) => (n == null ? "Sem limite" : c.key === "queries" ? `${n} por mês` : `${n}`);
    const same = c.from === c.to;
    return { label: CHANGE_LABEL[c.key], from: same ? null : c.from == null ? "Sem limite" : `${c.from}`, to: same ? `${fmt(c.to)} (igual)` : fmt(c.to), same };
  });
}

/** Benefícios de cultivo, a partir do que aumenta. */
function cultivation(changes: Change[], currentLabel: string): string[] {
  const up = (k: string) => changes.filter(numeric).find(c => c.key === k && c.from !== c.to && (c.to == null || (c.from != null && c.to > c.from)));
  const out: string[] = [];
  const plants = up("plants");
  if (plants) out.push(plants.to == null ? "Cultive quantas genéticas quiser e compare" : `Cultive ${NUMBER[plants.to] ?? plants.to} genéticas no mesmo ciclo e compare`);
  const queries = up("queries");
  if (queries) out.push(queries.to == null ? "Converse com o Bobby sem limite, da rega à colheita" : queries.to >= 4 ? "Tire dúvidas com o Bobby toda semana, da rega à colheita" : "Mais conversas com o Bobby, da rega à colheita");
  const grows = up("grows");
  if (grows) out.push(grows.to == null ? "Separe o cultivo em quantos ambientes quiser" : `Separe o cultivo em ${plural(grows.to, "ambiente", "ambientes")}`);
  if (changes.some(c => c.key === "sensors" && c.from === false && c.to === true)) out.push("Conecte sensores ao ambiente");
  out.push(currentLabel === "Free" ? "Tudo do Free continua: diário, fotos, timer da luz e clima" : `Tudo do ${currentLabel} continua`);
  return out;
}

export function recommendationView(rec: Recommendation, q: QueriesUsage, currentLabel: string, recommendedLabel: string | null): RecommendationView {
  const limits = rec.reasons.filter(r => LIMIT_NAME[r]);
  const near = rec.reasons.includes("queries_near_limit");
  const credits = rec.reasons.includes("credits_exhausted");
  const withReason = rec.reasons.length > 0;

  const sentences: string[] = [];
  if (limits.length) sentences.push(`Você chegou ao limite ${join(limits.map(r => LIMIT_NAME[r]![0]))} no ${currentLabel}.`);
  if (near) sentences.push("O Bobby está perto do limite deste mês.");
  if (credits) sentences.push("Seus créditos acabaram.");
  if (!withReason) {
    const free = unlimited(rec.usage.plants.total) && unlimited(rec.usage.grows.total) && q?.mode === "unlimited";
    sentences.push(rec.plan_key && recommendedLabel
      ? `O ${currentLabel} ainda cobre o seu uso. Quando quiser mais espaço, o próximo passo é o ${recommendedLabel}.`
      : free ? `O ${currentLabel} não tem limite de plantas, ambientes nem do Bobby.` : `O ${currentLabel} cobre o seu uso. Não há plano acima à venda.`);
  }

  if (!rec.plan_key || !recommendedLabel) return { usage: { rows: usageRows(rec, q), conclusion: sentences.join(" "), tone: withReason ? "alert" : "calm" }, highlight: null };

  // O texto do motivo usa só o que o backend diz que o plano cobre (covers).
  const covered = rec.covers.filter(r => LIMIT_NAME[r]);
  let reason: string;
  if (covered.length > 1) reason = `Cobre os ${["", "", "dois", "três"][covered.length]} limites que você atingiu: ${join(covered.map(r => LIMIT_NAME[r]![1]))}.`;
  else if (covered.length === 1) reason = `Cobre o limite que você atingiu: ${LIMIT_NAME[covered[0]]![1]}.`;
  else if (rec.covers.includes("queries_near_limit")) reason = "Para o Bobby não parar antes do fim do mês.";
  else if (rec.covers.includes("credits_exhausted")) reason = "Mais conversas com o Bobby incluídas no plano todo mês.";
  else {
    const wants: string[] = [];
    const plants = rec.changes.find(c => c.key === "plants" && c.from !== c.to);
    if (plants && plants.from != null) wants.push(`cuidar de mais de ${plants.from === 1 ? "uma planta" : `${plants.from} plantas`}`);
    if (rec.changes.some(c => c.key === "queries" && c.from !== c.to)) wants.push("conversar mais com o Bobby");
    if (rec.changes.some(c => c.key === "grows" && c.from !== c.to)) wants.push("separar o cultivo em mais ambientes");
    reason = wants.length ? `Para quando você quiser ${wants.length > 1 ? `${wants.slice(0, -1).join(", ")} ou ${wants.at(-1)}` : wants[0]}.` : `O próximo plano acima do ${currentLabel}.`;
  }

  return {
    usage: { rows: usageRows(rec, q), conclusion: sentences.join(" "), tone: withReason ? "alert" : "calm" },
    highlight: {
      planKey: rec.plan_key,
      tag: withReason ? "RECOMENDADO PARA VOCÊ" : "PRÓXIMO PASSO",
      dark: withReason,
      reason,
      changes: changeRows(rec.changes),
      benefits: cultivation(rec.changes, currentLabel),
    },
  };
}

/** "Menos de R$ 1 por dia": só se o preço mensal ÷ 30 for menor que 1. */
export const underOneRealADay = (monthly: number | null | undefined) => monthly != null && monthly > 0 && monthly / 30 < 1;
