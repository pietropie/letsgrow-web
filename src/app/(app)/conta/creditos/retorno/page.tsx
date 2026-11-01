"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckoutResult } from "@/components/account";
import { ButtonLink, Spinner } from "@/components/ui";
import { getPurchase } from "@/lib/account";
import type { ApiError } from "@/lib/api";
import { routes } from "@/lib/routes";
import { dayMonthTime } from "@/shared/lib/dates";

const POLL_MS = 2_000, POLL_FOR_MS = 60_000;

export default function CreditReturnPage() {
  return <Suspense fallback={<Spinner />}><CreditReturn /></Suspense>;
}

/**
 * W21, volta do Mercado Pago (back_urls do backend: ?purchase_id=). A página não confia nos parâmetros da URL: consulta
 * GET /credits/purchases/{id} a cada 2 s por até 60 s. Quem credita é só o webhook; enquanto não houver confirmação,
 * o estado é PENDENTE.
 */
function CreditReturn() {
  const id = useSearchParams().get("purchase_id");
  const client = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const purchase = useQuery({
    queryKey: ["credits", "purchase", id], queryFn: () => getPurchase(id!), enabled: !!id,
    refetchInterval: q => q.state.data?.status === "pending" && Date.now() - startedAt < POLL_FOR_MS ? POLL_MS : false,
  });
  const status = purchase.data?.status;
  useEffect(() => { if (status === "paid") void client.invalidateQueries({ queryKey: ["credits"] }); }, [status, client]);

  const missing = !id || (purchase.error as ApiError | null)?.response?.status === 404;
  if (missing) return <CheckoutResult state="failed" title="Compra não encontrada" body="Este endereço não traz o pedido. Nenhum crédito foi adicionado por ele."><ButtonLink label="Voltar aos créditos" href={routes.credits()} /></CheckoutResult>;
  if (purchase.isPending) return <Spinner label="Confirmando o pagamento…" />;
  const p = purchase.data;
  if (p?.status === "paid") return (
    <CheckoutResult state="paid" title="Créditos adicionados" body={`${p.credits} créditos entraram no seu saldo.`}
      meta={`Compra avulsa · confirmada pelo Mercado Pago${p.paid_at ? ` · ${dayMonthTime(p.paid_at, " ")}` : ""}`}>
      <ButtonLink label="Voltar aos créditos" href={routes.credits()} />
    </CheckoutResult>
  );
  if (p && p.status !== "pending") return (
    <CheckoutResult state="failed" title={p.status === "refunded" || p.status === "charged_back" ? "Compra estornada" : "Pagamento não aprovado"}
      body={p.status === "refunded" || p.status === "charged_back" ? "O Mercado Pago devolveu o valor desta compra. Confira o saldo em Seus créditos." : "O Mercado Pago não aprovou o pagamento. Nenhum crédito foi adicionado."}
      meta="Você pode tentar de novo com outro meio de pagamento.">
      <ButtonLink label="Tentar de novo" href={routes.packs()} />
      <ButtonLink secondary label="Voltar aos créditos" href={routes.credits()} />
    </CheckoutResult>
  );
  // Ainda pendente (Pix, boleto, análise) ou a consulta falhou: nunca diz que deu certo sem a confirmação do backend.
  return (
    <CheckoutResult state="pending" title="Pagamento em análise"
      body="O Mercado Pago ainda está confirmando o pagamento. Os créditos entram assim que ele aprovar; você não precisa pagar de novo."
      meta={purchase.isError ? "Não foi possível consultar o pedido agora · verifique em Histórico de créditos" : "Status atualizado automaticamente · verifique em Histórico de créditos"}>
      <ButtonLink label="Ver histórico de créditos" href={routes.creditLog()} />
      <ButtonLink secondary label="Voltar ao início" href="/" />
    </CheckoutResult>
  );
}
