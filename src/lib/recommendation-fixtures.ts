import type { Recommendation } from "./recommendation";

/**
 * Exemplos do contrato final de GET /billing/recommendation (UX item 19b), só para ver a tela em desenvolvimento
 * com `?rec=R1` (nunca em produção, como o `?uso=` do mostrador). R1 = W28/S6, R2 = S6c, R3 = sem plano acima.
 */
export const RECOMMENDATION_FIXTURES: Record<string, Recommendation> = {
  R1: {
    current_plan: "free", plan_key: "jardineiro", reasons: ["plants_limit", "queries_limit"], covers: ["plants_limit", "queries_limit"],
    usage: { plants: { used: 1, total: 1 }, grows: { used: 1, total: 1 } },
    changes: [{ key: "plants", from: 1, to: 2 }, { key: "grows", from: 1, to: 1 }, { key: "pots_per_grow", from: 3, to: 3 }, { key: "queries", from: 1, to: 4 }, { key: "sensors", from: false, to: false }],
  },
  R2: {
    current_plan: "free", plan_key: "jardineiro", reasons: [], covers: [],
    usage: { plants: { used: 0, total: 1 }, grows: { used: 1, total: 1 } },
    changes: [{ key: "plants", from: 1, to: 2 }, { key: "grows", from: 1, to: 1 }, { key: "pots_per_grow", from: 3, to: 3 }, { key: "queries", from: 1, to: 4 }, { key: "sensors", from: false, to: false }],
  },
  R3: {
    current_plan: "jardineiro", plan_key: null, reasons: ["queries_near_limit"], covers: [],
    usage: { plants: { used: 2, total: 2 }, grows: { used: 1, total: 1 } },
    changes: [],
  },
};
