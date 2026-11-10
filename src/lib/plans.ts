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
