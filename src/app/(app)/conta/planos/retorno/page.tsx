"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckoutResult, PLAN_NAMES } from "@/components/account";
import { ButtonLink, Spinner } from "@/components/ui";
import { getSubscription } from "@/lib/account";
import type { ApiError } from "@/lib/api";
import { routes } from "@/lib/routes";
import { shortDayMonth } from "@/shared/lib/dates";
import type { BillingSubscription } from "@/shared/types/features";

const POLL_MS = 2_000, POLL_FOR_MS = 60_000;

/** Sucesso é `active`, ou `canceled` com acesso ainda no futuro (contrato do WEBAPP.md §4). */
function isActive(s: BillingSubscription) {
  return s.status === "active" ||(s.status === "canceled" && !!s.access_until && new Date(s.access_until).getTime() > Date.now());
}

export default function PlanReturnPage() {
  return <Suspense fallback={<Spinner />}><PlanReturn /></Suspense>;
}

/**
 * W21 para a assinatura (?subscription_id=): consulta GET /billing/subscriptions/{id} a cada 2 s por até 60 s, sem
 * confiar na URL. No cartão a assinatura fica `pending` até a 1ª cobrança; quem ativa é o webhook ou a reconciliação.
 */
function PlanReturn() {
  const id = useSearchParams().get("subscription_id");
  const client = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const sub = useQuery({
    queryKey: ["billing", "subscriptions", id], queryFn: () => getSubscription(id!), enabled: !!id,
    refetchInterval: q => q.state.data?.status === "pending" && Date.now() - startedAt < POLL_FOR_MS ? POLL_MS : false,
  });
  const s = sub.data;
  const active = !!s && isActive(s);
  useEffect(() => {
    if (!active) return;
    void client.invalidateQueries({ queryKey: ["billing"] });
    void client.invalidateQueries({ queryKey: ["plan-status"] });
  }, [active, client]);

  const missing = !id || (sub.error as ApiError | null)?.response?.status === 404;
  if (missing) return <CheckoutResult state="failed" title="Assinatura não encontrada" body="Este endereço não traz o pedido. Nada mudou no seu plano."><ButtonLink label="Ver planos" href={routes.plans()} /></CheckoutResult>;
  if (sub.isPending) return <Spinner label="Confirmando o pagamento…" />;
  const name = s ? PLAN_NAMES[s.plan_key] ?? s.plan_key : "";
  if (s && active) return (
    <CheckoutResult state="paid" title={`Plano ${name} ativo`} body="Os novos limites já valem na sua conta."
      meta={`${s.kind === "recurring" ? "Assinatura no cartão" : "Pago com Pix"} · confirmado pelo Mercado Pago${shortDayMonth(s.access_until ?? s.current_period_end) ? ` · até ${shortDayMonth(s.access_until ?? s.current_period_end)}` : ""}`}>
      <ButtonLink label="Voltar aos planos" href={routes.plans()} />
    </CheckoutResult>
  );
  if (s && s.status !== "pending") return (
    <CheckoutResult state="failed" title="Pagamento não aprovado" body="O Mercado Pago não aprovou o pagamento. Seu plano não mudou." meta="Você pode tentar de novo com outro meio de pagamento.">
      <ButtonLink label="Tentar de novo" href={routes.plans()} />
      <ButtonLink secondary label="Voltar à conta" href={routes.account()} />
    </CheckoutResult>
  );
  return (
    <CheckoutResult state="pending" title="Pagamento em análise"
      body="O Mercado Pago ainda está confirmando o pagamento. O plano é liberado assim que ele aprovar; você não precisa pagar de novo."
      meta={sub.isError ? "Não foi possível consultar o pedido agora · confira em Planos daqui a pouco" : "Status atualizado automaticamente · confira em Planos daqui a pouco"}>
      <ButtonLink label="Ver planos" href={routes.plans()} />
      <ButtonLink secondary label="Voltar ao início" href="/" />
    </CheckoutResult>
  );
}
