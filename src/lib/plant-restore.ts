/**
 * Restaurar planta arquivada (backend cb83fc2: PATCH /plants/{id} { is_active: true }; 403 no limite do plano, 400 com o
 * ambiente arquivado). Mesmas regras e textos do mobile (letsgrow-mobile/lib/listsV2.ts, archivedView): colhida não
 * restaura, só abre o histórico. Lib pura (sem imports), testada em tests/plantRestore.test.cjs.
 */
const HARVESTED = new Set(["harvest", "drying", "curing"]);

type PlantLike = { is_active: boolean; current_phase: string; harvest_date: string | null; grow_id: string };
export type RestoreBlock = { reason: "grow" | "limit"; text: string; link: string };
export type RestoreView = { allowed: boolean; blocked: RestoreBlock | null };

export function isHarvestedPlant(p: Pick<PlantLike, "current_phase" | "harvest_date">): boolean {
  return !!p.harvest_date || HARVESTED.has(p.current_phase);
}

/**
 * `growActive` é null enquanto a lista de ambientes não chegou: aí o botão fica liberado e quem decide é a API.
 * `atLimit` vem do plano (plantas usadas ≥ máximo; 9999 é ilimitado).
 */
export function restoreView(p: PlantLike, ctx: { atLimit: boolean; growActive: boolean | null }): RestoreView | null {
  if (p.is_active || isHarvestedPlant(p)) return null;
  if (ctx.growActive === false) return { allowed: false, blocked: { reason: "grow", text: "O ambiente desta planta está arquivado. Restaure o ambiente primeiro.", link: "Ver o ambiente" } };
  if (ctx.atLimit) return { allowed: false, blocked: { reason: "limit", text: "Você está no limite de plantas do plano.", link: "Ver planos" } };
  return { allowed: true, blocked: null };
}

export function atPlantLimit(used: number | null | undefined, max: number | null | undefined): boolean {
  return used != null && max != null && max < 9999 && used >= max;
}

export const restoreQuestion = (name: string) => `Restaurar ${name}?`;
export const restoreMessage = "Ela volta para a lista de plantas ativas e passa a contar no limite do plano.";
export const restoredNotice = (name: string) => `${name} voltou para as plantas ativas.`;
