"use client";

import { ActionRow, BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { useGrows } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { archivedCaption } from "@/shared/lib/growHistory";

/** Figma 02B C · Ambientes arquivados (2298:9321). Cada linha abre o histórico com "Restaurar ambiente" (C1). */
export default function ArchivedGrowsPage() {
  const grows = useGrows();
  const archived = (grows.data ?? []).filter(g => g.status === "abandoned");
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.grows()} />
      <PageTitle>Ambientes arquivados</PageTitle>
      <PageSubtitle>O histórico de cada ambiente continua disponível.</PageSubtitle>
      {grows.isPending ? <Spinner /> : grows.isError ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void grows.refetch()} />
        : archived.length ? archived.map(g => <ActionRow key={g.id} title={g.name} body={archivedCaption(g)} href={routes.growHistory(g.id)} />)
        : <Notice title="Nenhum ambiente arquivado" body="Ambientes arquivados ficam fora do acompanhamento atual e mantêm o histórico." />}
      <ButtonLink label="Voltar aos ambientes" href={routes.grows()} />
    </div>
  );
}
