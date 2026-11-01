"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { useBobAlerts } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { alertHeading } from "@/shared/lib/bobbyOverview";

export default function ObservationPage() {
  return <Suspense fallback={<Spinner />}><Observation /></Suspense>;
}

/** Figma 2160:7819 — O que Bobby observou (mobile bobby/observation.tsx). Usa a mensagem, a ação, o motivo e os registros do próprio alerta. */
function Observation() {
  const plantId = useSearchParams().get("planta");
  const alerts = useBobAlerts();
  const list = alerts.data?.alerts ?? [];
  const alert = list.find(a => a.plant_id === plantId) ?? (plantId ? undefined : list[0]);
  const evidence = alert?.evidence;
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={plantId ? routes.plant(plantId)! : routes.plants()} />
      <PageTitle>O que Bobby observou</PageTitle>
      {alert && <PageSubtitle>{alert.plant_name}</PageSubtitle>}
      {alerts.isPending ? <Spinner />
        : alerts.isError ? <>
          <Notice title="Não foi possível carregar" body="As observações não foram atualizadas agora." />
          <Button secondary label="Tentar novamente" onClick={() => void alerts.refetch()} />
        </>
        : !alert ? <>
          <Notice title="Nenhuma observação para esta planta" body="Nenhum alerta foi retornado. Isso não confirma a condição da planta." />
          <ButtonLink secondary label="Conversar sobre os registros" href={routes.bobbyWith({ plantId })} />
        </>
        : <>
          <Notice title={alertHeading[alert.tier]} body={alert.message} meta={alert.action ? `Ação sugerida: ${alert.action}` : undefined} />
          {!!alert.reason && <Notice white title="O que isso permite dizer" body={alert.reason} />}
          {evidence !== undefined && <p className="text-sm leading-5 text-text-muted">
            {evidence.length ? `Base: ${evidence.length} ${evidence.length === 1 ? "registro usado" : "registros usados"}` : "Esta observação não cita registros."}
          </p>}
          <ButtonLink label="Abrir os registros usados" href={routes.bobbyObservationBase(alert.plant_id, alert.alert_id)} />
          <ButtonLink secondary label="Conversar sobre isso" href={routes.bobbyWith({ plantId: alert.plant_id })} />
          <ButtonLink secondary label="Isso não corresponde ao meu caso" href={routes.bobbyObservationFeedback(alert.plant_id, alert.alert_id)} />
        </>}
    </div>
  );
}
