"use client";

import { useState } from "react";
import { BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { exportDownloadUrl, useDataExports, useRequestDataExport } from "@/lib/account";
import { routes } from "@/lib/routes";
import { shortDayMonth } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";

/**
 * Figma 2160:9271 — Cópia dos seus dados. A cópia é preparada em segundo plano; o e-mail só avisa que está pronta (sem
 * link) e o arquivo é baixado aqui, com a conta conectada.
 */
export default function ExportDataPage() {
  const exports = useDataExports();
  const request = useRequestDataExport();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const latest = exports.data?.[0];
  const waiting = latest?.status === "requested" || latest?.status === "processing";

  async function download(id: string) {
    setError(""); setDownloading(true);
    try { window.location.assign(await exportDownloadUrl(id)); } catch (e) { setError(getErrorMessage(e, "Não foi possível abrir o download agora.")); }
    setDownloading(false);
  }

  function body() {
    if (exports.isPending) return <Spinner />;
    if (exports.isError) return <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void exports.refetch()} />;
    if (waiting) return <>
      <PageSubtitle>Solicitação registrada</PageSubtitle>
      <Notice title="Confira o e-mail da conta" body="Você receberá as instruções quando a cópia estiver disponível. Seus dados continuam no app." />
    </>;
    if (latest?.status === "ready") return <>
      <PageSubtitle>Cópia pronta</PageSubtitle>
      <Notice title="Sua cópia está disponível" body="O arquivo reúne seus registros, fotos e conversas em formato aberto (JSON)." meta={latest.expires_at ? `Disponível até ${shortDayMonth(latest.expires_at)}` : undefined} />
      <Button label={downloading ? "Abrindo…" : "Baixar cópia"} loading={downloading} onClick={() => void download(latest.id)} />
    </>;
    return <>
      <PageSubtitle>Solicitação pela conta</PageSubtitle>
      {latest?.status === "failed" && <Notice white title="A última cópia não foi concluída" body="Nada foi alterado na sua conta. Você pode pedir de novo." />}
      <Notice white title="O que vem na cópia" body="Perfil, ambientes, plantas, diário, fotos, conversas e memória do Bobby, preferências, créditos e mensagens ao suporte." />
      <Button label={request.isPending ? "Solicitando…" : "Solicitar cópia dos meus dados"} loading={request.isPending} onClick={() => { setError(""); setConfirm(true); }} />
    </>;
  }

  return (
    <>
      <BackLink fallback={routes.accountData()} />
      <PageTitle>Cópia dos seus dados</PageTitle>
      {body()}
      <FormError message={error} />
      <ButtonLink secondary={!waiting} label="Voltar à privacidade" href={routes.accountData()} />
      <ConfirmDialog open={confirm} title="Solicitar cópia dos dados?" message="Vamos preparar a cópia e avisar no e-mail da conta. Seus dados continuam no app." confirm="Solicitar"
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); request.mutate(undefined, { onError: e => setError(getErrorMessage(e, "Não foi possível registrar a solicitação.")) }); }} />
    </>
  );
}
