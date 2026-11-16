"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { WEB_HEADER, api } from "./api";
import type { ShopCategory, ShopProduct, ShopRecommendation, ShopSettings, ShopTarget } from "./shop";

/**
 * Equipamentos e insumos (contrato shop, 15 nov). Todas as rotas pedem 18+ confirmado: com 403 (ou qualquer erro) a
 * área simplesmente não aparece. Os campos são do backend novo; até o deploy, a leitura falha e nada é mostrado.
 */
const SHOP = ["shop"] as const;

export function useShopSettings() {
  const q = useQuery({ queryKey: [...SHOP, "settings"], queryFn: () => api<ShopSettings>("/shop/settings"), staleTime: 5 * 60_000, retry: false });
  return q.isSuccess ? q.data : null;
}

export function useShopCategories(enabled: boolean) {
  return useQuery({ queryKey: [...SHOP, "categories"], queryFn: () => api<ShopCategory[]>("/shop/categories"), enabled, staleTime: 5 * 60_000, retry: false });
}

export function useShopProducts(category: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...SHOP, "products", category], enabled: enabled && !!category, retry: false,
    queryFn: () => api<ShopProduct[]>(`/shop/products?category=${encodeURIComponent(category!)}`),
  });
}

/** Sem lugar: as indicações da página. Com ambiente ou planta: as do bloco de contexto. */
export function useShopRecommendations(place: { growId?: string; plantId?: string } | null, enabled: boolean) {
  const qs = place?.growId ? `?grow_id=${place.growId}` : place?.plantId ? `?plant_id=${place.plantId}` : "";
  return useQuery({
    queryKey: [...SHOP, "recommendations", place?.growId ?? null, place?.plantId ?? null], enabled, retry: false,
    queryFn: () => api<ShopRecommendation[]>(`/shop/recommendations${qs}`),
  });
}

/** "Já tenho" / "Já uso": grava o equipamento no ambiente (quando há um) e dispensa a indicação em cada lugar. */
export function useShopHave() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ trigger, targets, productId }: { trigger: string; targets: ShopTarget[]; productId: string }) =>
      Promise.all(targets.map(t => api("/shop/recommendations/have", { method: "POST", body: { trigger, ...t, product_id: productId } }))),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: [...SHOP, "recommendations"] }), client.invalidateQueries({ queryKey: ["grows"] })]),
  });
}

/**
 * Conta o toque em "Ver na loja" (só produto e dia, sem usuário). O link abre pelo próprio <a> (nova aba, fora do
 * app), então a contagem vai com keepalive e não segura a navegação; uma falha aqui não impede a pessoa de ir.
 */
export function countShopClick(productId: string) {
  try {
    void fetch(`/api/bff/shop/products/${encodeURIComponent(productId)}/click`, { method: "POST", keepalive: true, headers: { [WEB_HEADER]: "1" } }).catch(() => {});
  } catch { /* sem fetch: segue sem contar */ }
}
