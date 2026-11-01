"use client";

import { useParams } from "next/navigation";
import { ActionRow, BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { useGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { EQUIPMENT_KINDS, KIND_TITLE, equipmentSummary, hasAnyEquipment } from "@/shared/lib/equipmentForms";

/** Figma 02C G (2302:10050) e G1 (2302:10219): uma linha por tipo de equipamento, cada uma abre o formulário. */
export default function EquipmentPage() {
  const { id } = useParams<{ id: string }>();
  const grow = useGrow(id);
  const g = grow.data;
  const sensors = routes.growSensors(id);
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.growPanel(id)!} />
      <PageTitle>Equipamentos</PageTitle>
      <PageSubtitle>{g ? `${g.name} · dados de cadastro` : "Dados de cadastro"}</PageSubtitle>
      {grow.isPending ? <Spinner /> : !g ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void grow.refetch()} /> : <>
        {hasAnyEquipment(g)
          ? <PageSubtitle>O cadastro descreve o equipamento. Ele não confirma se está ligado agora.</PageSubtitle>
          : <Notice title="Nenhum equipamento cadastrado" body="Equipamentos são opcionais. Toque num tipo para descrever o que você usa." meta="O cadastro não confirma se o equipamento está ligado." />}
        {EQUIPMENT_KINDS.map(kind => <ActionRow key={kind} title={KIND_TITLE[kind]} body={equipmentSummary(kind, g)} href={routes.growEquipmentForm(id, kind)} />)}
        {sensors && <ActionRow title="Sensores do ambiente" body="Pareie ou revise sensores, se você usar algum." href={sensors} />}
      </>}
      <ButtonLink secondary label="Voltar ao ambiente" href={routes.growPanel(id)!} />
    </div>
  );
}
