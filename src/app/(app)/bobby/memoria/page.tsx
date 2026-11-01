"use client";

import { useState } from "react";
import { ActionRow, BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextArea } from "@/components/ui";
import { useBobMemories, useForgetBobMemory, useSaveBobMemory } from "@/lib/bobby";
import { routes } from "@/lib/routes";
import { shortDayMonth } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";
import type { BobMemory } from "@/shared/types/features";

type Step = { kind: "list" } | { kind: "edit"; memory?: BobMemory } | { kind: "forgotten" };

/**
 * Figma 2160:8200 (Contexto usado pelo Bobby), 2160:8242 (Editar preferência), 2160:8284 (Esquecer esta preferência?) e
 * 2160:8326 (Preferência removida); mobile bobby/memory.tsx. Só as preferências que a pessoa escreveu. Esquecer pede
 * confirmação num diálogo, como apagar um registro.
 */
export default function MemoryPage() {
  const memories = useBobMemories();
  const save = useSaveBobMemory();
  const forget = useForgetBobMemory();
  const [step, setStep] = useState<Step>({ kind: "list" });
  const [forgetting, setForgetting] = useState<BobMemory | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const list = memories.data ?? [];

  function edit(memory?: BobMemory) { setText(memory?.content ?? ""); setError(""); setStep({ kind: "edit", memory }); }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step.kind !== "edit") return;
    if (!text.trim()) return setError("Escreva a preferência.");
    save.mutate({ id: step.memory?.id, content: text.trim() }, {
      onSuccess: () => setStep({ kind: "list" }),
      onError: err => setError(getErrorMessage(err, "Não foi possível salvar. Seu texto continua aqui.")),
    });
  }
  function confirmForget() {
    if (!forgetting) return;
    forget.mutate(forgetting.id, {
      onSuccess: () => { setForgetting(null); setStep({ kind: "forgotten" }); },
      onError: err => { setForgetting(null); setError(getErrorMessage(err, "Não foi possível remover. Tente novamente.")); },
    });
  }

  if (step.kind === "edit") return (
    <form onSubmit={submit} className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.bobbyMemory()} />
      <PageTitle>{step.memory ? "Editar preferência" : "Nova preferência"}</PageTitle>
      <PageSubtitle>Guardada para próximas conversas</PageSubtitle>
      <TextArea label="Como prefere as explicações?" value={text} onChange={e => setText(e.target.value)} maxLength={300} autoFocus
        placeholder="Prefiro explicações curtas." hint="Você pode mudar isso a qualquer momento." />
      <FormError message={error} />
      <Button type="submit" label={save.isPending ? "Salvando…" : "Salvar preferência"} loading={save.isPending} />
      <Button secondary label="Cancelar" onClick={() => setStep({ kind: "list" })} />
    </form>
  );

  if (step.kind === "forgotten") return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <PageTitle>Preferência removida</PageTitle>
      <PageSubtitle>Você pode definir outra quando quiser.</PageSubtitle>
      <Notice title={list.length ? `${list.length} ${list.length === 1 ? "preferência guardada" : "preferências guardadas"}` : "Nenhuma preferência guardada"} body="O histórico de conversa permanece separado." />
      <ButtonLink label="Voltar ao Bobby" href={routes.bobby()!} replace />
      <Button secondary label="Ver preferências" onClick={() => setStep({ kind: "list" })} />
    </div>
  );

  const conversationContext = <Notice white title="Contexto desta conversa" body="Ao conversar, você escolhe o ambiente ou a planta no seletor de contexto, logo acima da caixa de mensagem." />;
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.bobby()!} />
      <PageTitle>Contexto usado pelo Bobby</PageTitle>
      <PageSubtitle>Você pode revisar e remover informações.</PageSubtitle>
      <FormError message={error} />
      {memories.isPending ? <Spinner />
        : memories.isError ? <>
          <Notice title="Não foi possível carregar" body="Suas preferências não foram alteradas." />
          <Button secondary label="Tentar novamente" onClick={() => void memories.refetch()} />
        </>
        : !list.length ? <>
          <Notice title="Nenhuma preferência guardada" body="Bobby não guarda preferências sozinho. Você pode escrever uma, como o jeito que prefere as explicações." />
          <Button label="Adicionar preferência" onClick={() => edit()} />
        </>
        : list.map(m => (
          <div key={m.id} className="flex flex-col gap-2">
            <Notice title="Preferência guardada" body={m.content} meta={`Informada por você · ${shortDayMonth(m.updated_at) ?? ""}`} />
            <Button label="Editar preferência" onClick={() => edit(m)} />
            <Button secondary label="Esquecer preferência" onClick={() => { setError(""); setForgetting(m); }} />
          </div>
        ))}
      {!!list.length && list.length < 20 && <Button secondary label="Adicionar outra preferência" onClick={() => edit()} />}
      {conversationContext}
      <ActionRow title="Como funciona a memória" body="Histórico de conversa e memória são controles diferentes." href={routes.accountData()} />
      <ConfirmDialog open={!!forgetting} title="Esquecer esta preferência?" message={`“${forgetting?.content ?? ""}”\nEla deixará de ser usada nas próximas conversas. Isso não apaga automaticamente o histórico da conversa.`}
        confirm="Esquecer preferência" destructive busy={forget.isPending} onConfirm={confirmForget} onCancel={() => setForgetting(null)} />
    </div>
  );
}
