"use client";

import { ActionRow, BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { usePlants } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { shortDayMonth } from "@/shared/lib/dates";
import { plantDisplayName } from "@/shared/lib/plantIdentity";

/** Figma 2160:7646 — Plantas arquivadas. */
export default function ArchivedPlantsPage() {
  const plants = usePlants({ is_active: false });
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.plants()} />
      <PageTitle>Plantas arquivadas</PageTitle>
      <PageSubtitle>Seus registros continuam disponíveis.</PageSubtitle>
      {plants.isPending ? <Spinner /> : plants.isError ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void plants.refetch()} />
        : plants.data.length ? plants.data.map(p => <ActionRow key={p.id} title={plantDisplayName(p)} body={`Arquivada · atualizada em ${shortDayMonth(p.updated_at) ?? "data não informada"}`} href={routes.plant(p.id)!} />)
        : <Notice title="Nenhuma planta arquivada" body="As plantas arquivadas ficam fora do acompanhamento atual e mantêm seu histórico." />}
      <ButtonLink label="Voltar às plantas" href={routes.plants()} />
    </div>
  );
}
