"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BackLink, Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextArea } from "@/components/ui";
import { useSendBobFeedback } from "@/lib/bobby";
import { useBobAlerts } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { getErrorMessage } from "@/shared/lib/errors";

export default function ObservationFeedbackPage() {
  return <Suspense fallback={<Spinner />}><ObservationFeedback /></Suspense>;
}

/** Figma 2160:8116 (Ajude a corrigir o contexto) e 2160:8158 (Obrigado pelo aviso). Fica guardado para a equipe: não chama a IA nem cobra nada. */
function ObservationFeedback() {
  const params = useSearchParams();
  const plantId = params.get("planta"), alertId = params.get("alerta");
  const alert = useBobAlerts().data?.alerts.find(a => a.alert_id === alertId);
  const send = useSendBobFeedback();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const review = plantId ? routes.plantDiary(plantId)! : routes.plants();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!message.trim()) return setError("Descreva o que não corresponde.");
    send.mutate({ message: message.trim(), plant_id: plantId || undefined, alert_id: alertId || undefined, evidence_ids: alert?.evidence?.map(ev => `${ev.kind}:${ev.id}`) }, {
      onSuccess: () => setSent(true),
      onError: err => setError(getErrorMessage(err, "Não foi possível enviar. Seu texto continua aqui.")),
    });
  }

  if (sent) return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <PageTitle>Obrigado pelo aviso</PageTitle>
      <PageSubtitle>Feedback registrado</PageSubtitle>
      <Notice title="Você pode corrigir a base" body="Enviar feedback não altera automaticamente um registro. Revise a informação para as próximas observações." />
      <ButtonLink label="Revisar registros" href={review} />
      <ButtonLink secondary label="Voltar ao Bobby" href={routes.bobby()!} replace />
    </div>
  );

  return (
    <form onSubmit={submit} className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.bobbyObservation(plantId ?? undefined)!} />
      <PageTitle>Ajude a corrigir o contexto</PageTitle>
      <PageSubtitle>Nenhuma análise será cobrada por este envio.</PageSubtitle>
      <TextArea label="O que não corresponde?" value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} autoFocus
        placeholder="A origem do registro precisa ser revisada." hint="Descreva o erro ou a informação incorreta." />
      <FormError message={error} />
      <Button type="submit" label={send.isPending ? "Enviando…" : "Enviar feedback"} loading={send.isPending} />
      <ButtonLink secondary label="Revisar os registros" href={review} />
    </form>
  );
}
