"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, ButtonLink, FormError, Notice } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { getErrorMessage } from "@/shared/lib/errors";

type Deletion = { id: string; status: string; requested_at: string; scheduled_for: string; grace_days: number };

const LOGIN = `/entrar?de=${encodeURIComponent("/excluir-conta")}`;
const longDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
const isStatus = (e: unknown, status: number) => e instanceof ApiError && e.response.status === status;

/** Mesmo fluxo do mobile (app/(app)/account/delete.tsx): confirmar com a carência, depois acompanhar e cancelar. */
export function DeletionPanel({ signedIn }: { signedIn: boolean }) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // 404 = nenhum pedido ativo; 401 = sessão vencida (a página é pública: não redireciona sozinha).
  const current = useQuery({
    queryKey: ["deletion-request"], enabled: signedIn, retry: false,
    queryFn: async () => {
      try { return await api<Deletion>("/account/deletion-request", { stayOn401: true }); }
      catch (e) { if (isStatus(e, 404)) return null; throw e; }
    },
  });
  const policy = useQuery({
    queryKey: ["deletion-policy"], enabled: signedIn && current.data === null, retry: false,
    queryFn: () => api<{ grace_days: number }>("/account/deletion-policy", { stayOn401: true }),
  });
  const request = useMutation({
    mutationFn: () => api<Deletion>("/account/deletion-request", { method: "POST", body: { confirm: true }, stayOn401: true }),
    onSuccess: data => { setConfirming(false); client.setQueryData(["deletion-request"], data); },
    onError: e => setError(getErrorMessage(e, "Não foi possível registrar a solicitação.")),
  });
  const cancel = useMutation({
    mutationFn: () => api("/account/deletion-request", { method: "DELETE", stayOn401: true }),
    onSuccess: () => client.setQueryData(["deletion-request"], null),
    onError: e => setError(getErrorMessage(e, "Não foi possível cancelar agora.")),
  });

  if (!signedIn || isStatus(current.error, 401) || isStatus(policy.error, 401)) {
    return (
      <>
        <p>Para pedir a exclusão por aqui, entre com a conta que você quer excluir. Depois de entrar, você volta para esta página.</p>
        <ButtonLink label="Entrar para continuar" href={LOGIN} />
      </>
    );
  }
  if (current.isPending) return <p className="text-sm text-text-muted" role="status">Carregando…</p>;
  if (current.isError) {
    return (
      <>
        <FormError message={getErrorMessage(current.error, "Não foi possível carregar o pedido.")} />
        <Button secondary label="Tentar de novo" onClick={() => void current.refetch()} />
      </>
    );
  }

  const pending = current.data;
  if (pending) {
    return (
      <>
        <Notice title="Solicitação recebida" body="A exclusão está agendada. Acompanhe pelo e-mail da conta."
          meta={`Exclusão prevista para ${longDate(pending.scheduled_for)}. Até lá você pode cancelar.`} />
        <FormError message={error} />
        <Button secondary label={cancel.isPending ? "Cancelando…" : "Cancelar exclusão"} loading={cancel.isPending} onClick={() => { setError(""); cancel.mutate(); }} />
      </>
    );
  }

  const grace = policy.data?.grace_days;
  const graceText = grace != null
    ? `Você terá ${grace} ${grace === 1 ? "dia" : "dias"} para desistir. Até lá, é só cancelar o pedido nesta página ou no app.`
    : "Você poderá desistir durante o período informado no e-mail de confirmação.";
  return (
    <>
      <p>A exclusão inclui ambientes, plantas, registros, fotos, conversas e a memória do Bobby.</p>
      {confirming ? (
        <div role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-body" className="flex flex-col gap-3 rounded-xl border-2 border-error bg-white p-4">
          <p id="confirm-title" className="text-lg leading-6 font-semibold">Excluir conta?</p>
          <p id="confirm-body">{graceText}</p>
          <FormError message={error} />
          <Button label={request.isPending ? "Enviando…" : "Solicitar exclusão"} loading={request.isPending} onClick={() => { setError(""); request.mutate(); }} />
          <Button secondary label="Manter minha conta" disabled={request.isPending} onClick={() => { setConfirming(false); setError(""); }} />
        </div>
      ) : (
        <Button secondary label="Quero excluir minha conta" onClick={() => setConfirming(true)} />
      )}
    </>
  );
}
