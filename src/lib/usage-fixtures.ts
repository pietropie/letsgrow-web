import type { Usage } from "./usage";

/**
 * Exemplos dos estados do Figma (U1–U9), no formato final do GET /api/v1/usage (usage-contrato.md). Usados pela
 * galeria (/conta/creditos/mostrador) e, só em desenvolvimento, por `?uso=U2` em qualquer tela.
 */
const period = { start: "2026-10-01T03:00:00Z", renews_at: "2026-11-01T03:00:00Z" };
const base = { period, warning_threshold: 0.8 };
const q = (used: number, total: number) => ({ used, total, remaining: Math.max(0, total - used) });
const cr = (c: Partial<NonNullable<Usage["credits"]>> & { remaining: number }) =>
  ({ plan_total: 100, plan_used: 0, extra_balance: 0, used_in_period: 0, next_expiry: null, ...c });

export const USAGE_FIXTURES: Record<string, { name: string; usage: Usage }> = {
  U1: { name: "Limite mensal · normal", usage: { ...base, mode: "queries", queries: q(12, 30), credits: null, near_limit: false, exhausted: false } },
  U2: { name: "Limite · perto do fim (≥ 80 %)", usage: { ...base, mode: "queries", queries: q(27, 30), credits: null, near_limit: true, exhausted: false } },
  U3: { name: "Limite · esgotado", usage: { ...base, mode: "queries", queries: q(30, 30), credits: null, near_limit: true, exhausted: true } },
  U4: { name: "Plano sem limite", usage: { ...base, mode: "unlimited", queries: { used: 12, total: null, remaining: null }, credits: null, near_limit: false, exhausted: false } },
  U5: { name: "Créditos · normal", usage: { ...base, mode: "credits", queries: null, credits: cr({ plan_total: 100, plan_used: 20, extra_balance: 40, used_in_period: 20, remaining: 120 }), near_limit: false, exhausted: false } },
  U6: { name: "Créditos · perto do fim", usage: { ...base, mode: "credits", queries: null, credits: cr({ plan_total: 100, plan_used: 88, extra_balance: 0, used_in_period: 88, remaining: 12 }), near_limit: true, exhausted: false } },
  U7: { name: "Créditos · esgotado", usage: { ...base, mode: "credits", queries: null, credits: cr({ plan_total: 100, plan_used: 100, extra_balance: 0, used_in_period: 100, remaining: 0 }), near_limit: true, exhausted: true } },
  U8: { name: "Créditos · só extras", usage: { ...base, mode: "credits", queries: null, credits: cr({ plan_total: 0, plan_used: 0, extra_balance: 40, used_in_period: 0, remaining: 40, next_expiry: { at: "2026-12-12T12:00:00Z", credits: 25 } }), near_limit: false, exhausted: false } },
  U9: { name: "Limite mensal + créditos", usage: { ...base, mode: "both", queries: q(12, 30), credits: cr({ plan_total: 100, plan_used: 20, extra_balance: 40, used_in_period: 20, remaining: 120 }), near_limit: false, exhausted: false } },
};
