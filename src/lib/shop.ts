/**
 * Equipamentos e insumos (UX 26b–26d, PLAYSTORE.md §2.3; contrato do backend na nota shop-contrato.md, 15 nov).
 * Lib pura (sem imports), testada em tests/shop.test.cjs. O servidor decide o que indicar; aqui só agrupamos e
 * escolhemos os textos. Nada de preço por enquanto, e o Bobby fica de fora.
 */
export type ShopSettings = { enabled: boolean; page: boolean; environment_block: boolean; phase_block: boolean; account_entry: boolean; notice?: string };
export type ShopPoint = "page" | "environment_block" | "phase_block" | "account_entry";
export type ShopCategory = { key: string; name: string };
export type ShopProduct = {
  id: string; category: ShopCategory; name: string; specs: string[]; store: { name: string; domain: string };
  url: string; label: "partner" | "sponsored" | "none"; label_text: string; reason: string | null;
  price_from: null; price_checked_at: null;
};
export type ShopRecommendation = { trigger: string; reason: string; grow_id: string | null; plant_id: string | null; product: ShopProduct };
export type ShopTarget = { grow_id: string } | { plant_id: string };

/** Linha fixa da área (LOJA, §2.3): a compra é da loja e a comissão não muda o preço. */
export const SHOP_NOTICE = "A compra, a entrega e a garantia são da loja. Podemos receber comissão, sem mudar o preço.";
export const SHOP_TITLE = "Equipamentos e insumos";

/** Com o geral desligado (o padrão), nenhum ponto aparece; sem resposta (erro, menor de 18), também não. */
export function shopShows(settings: ShopSettings | null | undefined, point: ShopPoint): boolean {
  return !!settings && settings.enabled === true && settings[point] === true;
}

const PHASE: Record<string, { short: string; long: string }> = {
  plant_phase_seedling: { short: "a muda", long: "muda" },
  plant_phase_veg: { short: "a vega", long: "vega" },
  plant_phase_flower: { short: "a floração", long: "floração" },
};

/** Título do bloco na página da planta (C3): "PARA A FLORAÇÃO". */
export function phaseBlockTitle(trigger: string): string {
  return `Para ${PHASE[trigger]?.short ?? "esta fase"}`.toUpperCase();
}

/** Rótulo junto do cartão: o texto do servidor; amarelo quando há comissão ou posição paga. */
export function labelTone(label: ShopProduct["label"]): "light" | "plain" {
  return label === "none" ? "plain" : "light";
}

/** Nas linhas curtas dos blocos de contexto (C2, C3), o rótulo curto do desenho; o cartão inteiro usa `label_text`. */
export function shortLabel(product: Pick<ShopProduct, "label" | "label_text">): string {
  return product.label === "partner" ? "Link de parceiro" : product.label_text;
}

export type ShopItem = { trigger: string; reason: string; product: ShopProduct; targets: ShopTarget[] };
export type ShopBlock = { key: string; title: string; items: ShopItem[] };

/**
 * Página (W9p): um bloco por ambiente ("PARA A SALA") e um por fase de planta, com o título neutro da LOJA
 * ("PARA A SUA PLANTA EM VEGA", nunca o nome da planta). Plantas na mesma fase viram um bloco só; "Já tenho" vale
 * para todas elas. O mesmo produto não se repete no bloco.
 */
export function pageBlocks(recs: ShopRecommendation[], growName: (id: string) => string | null): ShopBlock[] {
  const blocks = new Map<string, ShopBlock>();
  for (const rec of recs) {
    const plant = !!rec.plant_id;
    const key = plant ? `p:${rec.trigger}` : `g:${rec.grow_id ?? ""}`;
    if (!blocks.has(key)) {
      const name = !plant && rec.grow_id ? growName(rec.grow_id) : null;
      const title = plant ? `Para a sua planta em ${PHASE[rec.trigger]?.long ?? "fase atual"}` : name ? `Para ${name}` : "Para o seu ambiente";
      blocks.set(key, { key, title: title.toUpperCase(), items: [] });
    }
    const block = blocks.get(key)!;
    const target: ShopTarget | null = rec.plant_id ? { plant_id: rec.plant_id } : rec.grow_id ? { grow_id: rec.grow_id } : null;
    const same = block.items.find(i => i.trigger === rec.trigger && i.product.id === rec.product.id);
    if (same) { if (target && !same.targets.some(t => JSON.stringify(t) === JSON.stringify(target))) same.targets.push(target); continue; }
    block.items.push({ trigger: rec.trigger, reason: rec.reason, product: rec.product, targets: target ? [target] : [] });
  }
  return [...blocks.values()];
}

/** Blocos de contexto (C2 no ambiente, C3 na planta): as indicações daquele lugar, sem repetir produto. */
export function contextItems(recs: ShopRecommendation[]): ShopItem[] {
  return pageBlocks(recs, () => null).flatMap(b => b.items);
}

/** "Já uso" para insumo da fase da planta; "Já tenho" para equipamento do ambiente. */
export function haveLabel(trigger: string): string {
  return trigger.startsWith("plant_phase_") ? "Já uso" : "Já tenho";
}
