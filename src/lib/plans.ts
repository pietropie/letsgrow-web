/**
 * Planos: preço do que está à venda na web (GET /billing/catalog, web_enabled) e os nomes de plano. Limites vêm de
 * GET /plans/config pelo `plan_key` (o `price_display` e o `badge_text` de lá não são usados: nada de "Popular" sem
 * dado). O plano recomendado é do backend (GET /billing/recommendation, item 19b); o cartão "Plano e uso" da Minha
 * conta está em account-v2.ts (item 21).
 * Puro, sem imports: os testes do Node cobrem (tests/plans.test.cjs).
 */

export type PlanLimits = {
  plan_key: string; label: string; price_brl: number;
  max_plants: number; max_grows: number; max_pots_per_grow: number; ai_queries_per_month: number | null; sensors_allowed: boolean;
};
export type CatalogPlan = { plan_key: string; label: string; periods: { period: "monthly" | "yearly"; months: number; price_brl: number | null }[] };
export type Catalog = { web_enabled: boolean; plans: CatalogPlan[] };

export const brl = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

/** Os nomes antigos do backend (grower, pro) apontam para os atuais. */
export const normalizePlan = (plan: string) => (plan === "grower" ? "cultivador" : plan === "pro" ? "grower_pro" : plan);

/** Preço vendável de um período, ou null. */
export function priceOf(catalog: Catalog | null | undefined, planKey: string, period: "monthly" | "yearly" = "monthly"): number | null {
  if (!catalog?.web_enabled) return null;
  return catalog.plans.find(p => p.plan_key === planKey)?.periods.find(x => x.period === period)?.price_brl ?? null;
}

export type Period = "monthly" | "yearly";
/**
 * O preço de um período (pedido do usuário, 12 nov): `price_brl` é o total cobrado e `months` quantos meses cobre. O
 * destaque é o valor por mês (total ÷ meses); o total real aparece sempre embaixo, porque o Mercado Pago cobra de uma vez.
 */
export function periodPrice(catalog: (Catalog & { plans: (CatalogPlan & { periods: { months?: number }[] })[] }) | null | undefined, planKey: string, period: Period): { total: number; months: number; perMonth: number } | null {
  if (!catalog?.web_enabled) return null;
  const p = catalog.plans.find(x => x.plan_key === planKey)?.periods.find(x => x.period === period);
  if (!p || p.price_brl == null) return null;
  const months = p.months && p.months > 0 ? p.months : period === "yearly" ? 12 : 1;
  return { total: p.price_brl, months, perMonth: Math.round((p.price_brl / months) * 100) / 100 };
}
/** Quanto o anual economiza no ano em relação a 12 mensais; null se não houver os dois ou não houver economia. */
export function yearlySaving(catalog: Parameters<typeof periodPrice>[0], planKey: string): number | null {
  const m = periodPrice(catalog, planKey, "monthly"), y = periodPrice(catalog, planKey, "yearly");
  if (!m || !y) return null;
  const save = Math.round((m.perMonth * 12 - y.total) * 100) / 100;
  return save > 0 ? save : null;
}
