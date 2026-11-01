"use client";

import { useState } from "react";
import { ActionRow, BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { useCancelDeletion, useDeletionPolicy, useDeletionRequest, useRequestDeletion } from "@/lib/account";
import { routes } from "@/lib/routes";
import { useLogout } from "@/lib/session-client";
import { shortDayMonth } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";

/**
 * Figma 2160:9313 (Excluir sua conta?) e 2160:9355 (Solicitação recebida). "Solicitar exclusão" pede confirmação com a
 * carência; o servidor agenda a exclusão para depois dela, e o pedido pode ser cancelado aqui até lá.
 */
export default function DeleteAccountPage() {
  const pending = useDeletionRequest();
  const request = useRequestDeletion();
  const cancel = useCancelDeletion();
  const grace = useDeletionPolicy().data;
  const logout = useLogout();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);

  if (pending.isPending) return <><BackLink fallback={routes.accountData()} /><PageTitle>Excluir sua conta?</PageTitle><Spinner /></>;
  if (pending.isError) return <>
    <BackLink fallback={routes.accountData()} />
    <PageTitle>Excluir sua conta?</PageTitle>
    <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void pending.refetch()} />
  </>;

  if (pending.data) return <>
    <PageTitle>Solicitação recebida</PageTitle>
    <PageSubtitle>A exclusão ainda está em processamento.</PageSubtitle>
    <Notice title="Você receberá uma confirmação" body="Acompanhe pelo e-mail da conta. Se precisar de ajuda sobre o pedido, fale com o suporte."
      meta={`Exclusão prevista para ${shortDayMonth(pending.data.scheduled_for) ?? "a data informada por e-mail"}. Até lá você pode cancelar.`} />
    <FormError message={error} />
    <ButtonLink label="Falar com suporte" href={routes.support()} />
    <Button secondary label={cancel.isPending ? "Cancelando…" : "Cancelar exclusão"} loading={cancel.isPending}
      onClick={() => { setError(""); cancel.mutate(undefined, { onError: e => setError(getErrorMessage(e, "Não foi possível cancelar agora.")) }); }} />
    <Button secondary label="Sair" onClick={() => void logout()} />
  </>;

  return <>
    <BackLink fallback={routes.accountData()} />
    <PageTitle>Excluir sua conta?</PageTitle>
    <PageSubtitle>Leia antes de confirmar.</PageSubtitle>
    <Notice title="Conta e conteúdo associados" body="A exclusão inclui ambientes, plantas, registros e memória do Bobby. Informações que precisem ser retidas terão tratamento explicado pelo suporte." />
    <ActionRow title="Quero guardar uma cópia primeiro" body="Solicitar exportação dos meus dados." href={routes.dataExport()} />
    <ButtonLink label="Manter minha conta" href={routes.accountData()} />
    <FormError message={error} />
    <Button secondary label={request.isPending ? "Enviando…" : "Solicitar exclusão"} loading={request.isPending} onClick={() => { setError(""); setConfirm(true); }} />
    <ConfirmDialog open={confirm} title="Excluir conta?" destructive confirm="Solicitar exclusão"
      message={grace ? `Você tem ${grace} ${grace === 1 ? "dia" : "dias"} para desistir. Até lá, é só cancelar o pedido nesta tela.` : "Você poderá desistir durante o período informado no e-mail de confirmação."}
      onCancel={() => setConfirm(false)}
      onConfirm={() => { setConfirm(false); request.mutate(undefined, { onError: e => setError(getErrorMessage(e, "Não foi possível registrar a solicitação.")) }); }} />
  </>;
}
