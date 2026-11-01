"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { useBobAlerts } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { evidenceLines, evidenceSource, evidenceTitle, firstManualEvidence, mixedEvidence } from "@/shared/lib/accountFeatures";
import type { BobEvidence } from "@/shared/types/features";

export default function ObservationBasePage() {
  return <Suspense fallback={<Spinner />}><ObservationBase /></Suspense>;
}

/** Onde corrigir uma informação manual: a leitura do ambiente, o registro do diário ou os dados da planta. */
function correctionHref(e: BobEvidence): string | null {
  if (e.kind === "environment_reading" && e.grow_id) return routes.growReading(e.grow_id, e.id);
  if (e.kind === "event" && e.plant_id) return routes.diaryEntry(e.plant_id, e.id);
  if (e.kind === "plant") return routes.plantInfo(e.id);
  return null;
}

/** Figma 2160:7904 — Base da observação (mobile bobby/sources.tsx). Lista exatamente os registros que o alerta cita. */
function ObservationBase() {
  const params = useSearchParams();
  const plantId = params.get("planta"), alertId = params.get("alerta");
  const alerts = useBobAlerts();
  const list = alerts.data?.alerts ?? [];
  const alert = list.find(a => a.alert_id === alertId) ?? list.find(a => a.plant_id === plantId);
  const evidence = alert?.evidence ?? [];
  const manual = firstManualEvidence(evidence);
  const correct = manual && correctionHref(manual);
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.bobbyObservation(plantId ?? undefined)!} />
      <PageTitle>Base da observação</PageTitle>
      <PageSubtitle>{alert ? `${alert.plant_name} · registros usados por Bobby` : "Registros usados por Bobby"}</PageSubtitle>
      {alerts.isPending ? <Spinner />
        : alerts.isError ? <>
          <Notice title="Não foi possível carregar" body="A base da observação não foi atualizada agora." />
          <Button secondary label="Tentar novamente" onClick={() => void alerts.refetch()} />
        </>
        : !alert ? <Notice title="Observação não encontrada" body="Ela pode ter sido resolvida ou dispensada. Nenhum registro é listado." />
        : !evidence.length ? <Notice title="Esta observação não cita registros" body="A regra que gerou a observação não informa uma base que possa ser conferida. Nenhum registro é listado para não sugerir uma base não confirmada." meta="Você pode conferir os registros da planta no diário." />
        : <>
          {evidence.map(e => <Notice key={`${e.kind}:${e.id}`} white title={evidenceTitle(e)} body={evidenceLines(e).join("\n") || undefined} meta={evidenceSource(e)} />)}
          {mixedEvidence(evidence) && <p className="text-sm leading-5 text-text-muted">Esses registros são de momentos e fontes diferentes. Não são leituras em tempo real.</p>}
        </>}
      {correct ? <ButtonLink label="Corrigir informação manual" href={correct} />
        : !!plantId && <ButtonLink label="Abrir diário da planta" href={routes.plantDiary(plantId)!} />}
      <ButtonLink secondary label="Voltar à observação" href={routes.bobbyObservation(plantId ?? undefined)!} />
    </div>
  );
}
