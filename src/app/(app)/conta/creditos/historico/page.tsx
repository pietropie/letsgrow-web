"use client";

import { BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { useCreditHistory } from "@/lib/account";
import { routes } from "@/lib/routes";
import { historyCard } from "@/shared/lib/accountFeatures";

/** Figma 2160:8625 — Histórico de créditos (W19, 3ª coluna). Itens reais de GET /credits/ledger. */
export default function CreditLogPage() {
  const history = useCreditHistory();
  return (
    <>
      <BackLink fallback={routes.credits()} />
      <PageTitle>Histórico de créditos</PageTitle>
      <PageSubtitle>Tarefas, consumo e estornos</PageSubtitle>
      {history.isPending ? <Spinner />
        : !history.data ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void history.refetch()} />
        : !history.data.items.length ? <Notice white title="Nenhum uso registrado" body="Tarefas com custo, compras e créditos do plano aparecem aqui." />
        : history.data.items.map((item, i) => {
          const card = historyCard(item);
          const reread = item.type === "task" && item.status === "captured" && item.task_key === "chat_message" && item.task_ref;
          return (
            <div key={item.id} className="flex flex-col gap-3">
              <Notice white={i > 0 || item.type !== "task" || item.status !== "captured"} title={card.title} body={card.body} meta={reread ? `${card.meta} · abrir resposta` : card.meta} />
              {!!reread && <ButtonLink secondary label="Reler resposta sem custo" href={routes.bobbyConversation(item.task_ref!)} />}
            </div>
          );
        })}
      <ButtonLink secondary label="Voltar ao saldo" href={routes.credits()} />
    </>
  );
}
