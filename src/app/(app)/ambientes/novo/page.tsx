"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BackLink, Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, TextField } from "@/components/ui";
import { useCreateGrow, useRememberedGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { todayLocalDate } from "@/shared/lib/dates";
import { getErrorMessage, planLimitMessage } from "@/shared/lib/errors";
import type { GrowResponse } from "@/shared/types/api";

/** Figma 2160:5620 (Dê um nome ao seu ambiente) e 2160:5662 (Ambiente criado). Só o nome é obrigatório. */
export default function NewGrowPage() {
  const router = useRouter();
  const create = useCreateGrow();
  const [, select] = useRememberedGrow();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [planLimited, setPlanLimited] = useState(false);
  const [created, setCreated] = useState<GrowResponse | null>(null);

  function save(e: FormEvent) {
    e.preventDefault();
    if (create.isPending) return;
    setPlanLimited(false);
    if (!name.trim()) { setError("Dê um nome ao ambiente para continuar."); return; }
    setError("");
    create.mutate({ name: name.trim(), start_date: todayLocalDate() }, {
      onSuccess: grow => { select(grow.id); setCreated(grow); },
      // 403 do limite do plano: o texto do servidor é o erro.
      onError: err => { setError(getErrorMessage(err, "Não foi possível salvar o ambiente. Tente novamente.")); setPlanLimited(!!planLimitMessage(err)); },
    });
  }

  if (created) {
    const newPlant = routes.newPlant(created.id);
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <PageTitle>Ambiente criado</PageTitle>
        <PageSubtitle>{created.name}</PageSubtitle>
        <Notice title="Você já pode continuar" body="Adicione uma planta quando quiser. Nenhuma configuração técnica é obrigatória." />
        {newPlant && <ButtonLink label="Adicionar minha planta" href={newPlant} replace />}
        <ButtonLink secondary={!!newPlant} label="Ver meu ambiente" href={routes.growPanel(created.id)!} replace />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex max-w-[600px] flex-col gap-4" noValidate>
      <BackLink fallback={routes.grows()} />
      <PageTitle>Dê um nome ao seu ambiente</PageTitle>
      <PageSubtitle>Sem equipamentos? Tudo bem.</PageSubtitle>
      <TextField label="Nome do ambiente" placeholder="Meu ambiente" hint="Pode ser um cômodo, um espaço externo ou outro local." value={name} onChange={e => setName(e.target.value)} autoCapitalize="sentences" enterKeyHint="done" />
      <Notice title="Só isso é necessário agora" body="Localização, estrutura e equipamentos ficam para depois." />
      <FormError message={error} />
      {planLimited && <ButtonLink secondary label="Ver planos" href={routes.plans()} />}
      <Button type="submit" label={create.isPending ? "Salvando…" : "Salvar ambiente"} loading={create.isPending} />
      <Button secondary label="Fazer isso depois" onClick={() => router.back()} />
    </form>
  );
}
