"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountBilling, BillingCatalog, BillingPeriod, BillingSubscription, CreditHistoryItem, CreditPackage, CreditPurchase, DataExport, DeletionRequest, NotificationPreferences, SupportMessage } from "@/shared/types/features";
import { ApiError, api } from "./api";

/** Conta (F6): as mesmas rotas e chaves dos hooks do mobile (hooks/useAccountFeatures, usePlanConfigs, useFeatureFlags). */

// ── Acompanhamento ──────────────────────────────────────────────────────────

const PREFS = ["notification-preferences"] as const;
export function useNotificationPreferences(timezone: string) {
  return useQuery({ queryKey: [...PREFS, timezone], queryFn: () => api<NotificationPreferences>(`/users/me/notification-preferences?timezone=${encodeURIComponent(timezone)}`) });
}
export function useSaveNotificationPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<NotificationPreferences, "is_default">) => api<NotificationPreferences>("/users/me/notification-preferences", { method: "PUT", body }),
    onSuccess: () => client.invalidateQueries({ queryKey: PREFS }),
  });
}

// ── Créditos e planos ───────────────────────────────────────────────────────

export function useCreditHistory() {
  return useQuery({ queryKey: ["credits", "history"], queryFn: () => api<{ items: CreditHistoryItem[]; total: number }>("/credits/ledger?limit=50") });
}
export function useCreditPackages() {
  return useQuery({ queryKey: ["credits", "packages"], queryFn: () => api<CreditPackage[]>("/credits/packages") });
}

export interface PlanConfig {
  plan_key: string; label: string; price_brl: number; price_display: string; period_display: string; badge_text: string | null;
  max_plants: number; max_grows: number; max_pots_per_grow: number; ai_queries_per_month: number | null; sensors_allowed: boolean;
}
export function usePlanConfigs() {
  return useQuery({ queryKey: ["plan-configs"], queryFn: () => api<PlanConfig[]>("/plans/config"), staleTime: 5 * 60_000 });
}
export function useFeatureFlag(key: string) {
  const q = useQuery({ queryKey: ["feature-flags"], queryFn: () => api<{ key: string; enabled: boolean }[]>("/feature-flags"), staleTime: 5 * 60_000 });
  return { enabled: !!q.data?.find(f => f.key === key)?.enabled, isPending: q.isPending };
}
export function useBillingCatalog() {
  return useQuery({ queryKey: ["billing", "catalog"], queryFn: () => api<BillingCatalog>("/billing/catalog") });
}
export function useAccountBilling() {
  return useQuery({ queryKey: ["billing", "subscription"], queryFn: () => api<AccountBilling>("/billing/subscription") });
}
export function useCancelSubscription() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<BillingSubscription>("/billing/subscription/cancel", { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["billing"] }),
  });
}

export type CheckoutBody = { kind: "subscription"; plan_key: string; period: BillingPeriod; method: "card" | "pix" } | { kind: "credits"; package_id: string };
/**
 * POST /billing/checkout (contrato do WEBAPP.md §4): o backend cria a preferência no Mercado Pago com as back_urls da web
 * e devolve `checkout_url`; quem chama leva a aba até lá. Créditos e plano só entram pelo webhook.
 */
export function startCheckout(body: CheckoutBody) {
  return api<{ kind: string; id: string; status: string; checkout_url: string | null }>("/billing/checkout", { method: "POST", body });
}
export const getPurchase = (id: string) => api<CreditPurchase>(`/credits/purchases/${id}`);
export const getSubscription = (id: string) => api<BillingSubscription>(`/billing/subscriptions/${id}`);

/** Mensagem de um erro do checkout pelo `detail.code` do contrato; null deixa o texto do servidor. */
export function checkoutErrorMessage(e: unknown): string | null {
  const code = ((e as ApiError).response?.data as { detail?: { code?: string } } | undefined)?.detail?.code;
  switch (code) {
    case "payments_unavailable": return "A compra ainda não está disponível. Nada foi cobrado.";
    case "plan_not_for_sale": return "Este plano não está à venda agora.";
    case "managed_by_google_play":
    case "manage_in_google_play": return "Sua assinatura foi feita pelo Google Play. Gerencie no app Android.";
    case "already_subscribed": return "Você já tem este plano ativo.";
    case "checkout_failed": return "O Mercado Pago não respondeu agora. Nada foi cobrado; tente de novo em instantes.";
    default: return null;
  }
}

// ── Privacidade e dados ─────────────────────────────────────────────────────

const EXPORTS = ["account", "data-exports"] as const;
export function useDataExports() {
  return useQuery({ queryKey: EXPORTS, queryFn: () => api<DataExport[]>("/account/data-exports") });
}
export function useRequestDataExport() {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => api<DataExport>("/account/data-exports", { method: "POST" }), onSuccess: () => client.invalidateQueries({ queryKey: EXPORTS }) });
}
export const exportDownloadUrl = (id: string) => api<{ url: string }>(`/account/data-exports/${id}/download`).then(r => r.url);

const DELETION = ["account", "deletion-request"] as const;
/** Carência definida pela equipe; null quando o servidor ainda não a expõe. */
export function useDeletionPolicy() {
  return useQuery({ queryKey: ["account", "deletion-policy"], queryFn: () => api<{ grace_days: number }>("/account/deletion-policy").then(r => r.grace_days).catch(() => null) });
}
/** null = nenhum pedido pendente (o servidor responde 404). */
export function useDeletionRequest() {
  return useQuery({
    queryKey: DELETION,
    queryFn: () => api<DeletionRequest>("/account/deletion-request").catch((e: ApiError) => { if (e.response?.status === 404) return null; throw e; }),
  });
}
export function useRequestDeletion() {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => api<DeletionRequest>("/account/deletion-request", { method: "POST", body: { confirm: true } }), onSuccess: data => client.setQueryData(DELETION, data) });
}
export function useCancelDeletion() {
  const client = useQueryClient();
  return useMutation({ mutationFn: () => api("/account/deletion-request", { method: "DELETE" }), onSuccess: () => client.setQueryData(DELETION, null) });
}
export function useSendSupport() {
  return useMutation({ mutationFn: (body: { subject: string; message: string }) => api<SupportMessage>("/support/messages", { method: "POST", body }) });
}
