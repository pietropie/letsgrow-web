"use client";

import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BackLink, Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextArea, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { useEvents, useGrows, useInvalidateDiary, usePlant } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { dayMonthTime, fullDateTime } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";
import { eventTypeLabel } from "@/shared/lib/plantFacts";
import { plantDisplayName } from "@/shared/lib/plantIdentity";

const pad = (n: number) => String(n).padStart(2, "0");
const whenText = (iso: string) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function parseWhen(text: string): Date | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  return Number.isFinite(d.getTime()) && d.getTime() <= Date.now() ? d : null;
}

/** Figma 2160:7390 (Revisar registro), 2160:7432 (Excluir este registro?) e 2160:7474 (Registro excluído). */
export default function DiaryEntryPage() {
  const { id: plantId, eventId } = useParams<{ id: string; eventId: string }>();
  const router = useRouter();
  const plant = usePlant(plantId);
  const grows = useGrows();
  const events = useEvents(plantId);
  const invalidate = useInvalidateDiary();
  const event = events.data?.find(e => e.id === eventId);
  const [step, setStep] = useState<"edit" | "delete" | "deleted">("edit");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [editingWhen, setEditingWhen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (event) { setWhen(whenText(event.event_date)); setNotes(event.notes ?? ""); } }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = plant.data ? plantDisplayName(plant.data) : "Planta";
  const grow = grows.data?.find(g => g.id === plant.data?.grow_id);
  const kind = (eventTypeLabel[event?.event_type ?? ""] ?? "registro").toLowerCase();
  // Depois de excluir, a lista recarregada já não tem o registro: o tipo fica guardado para a tela final.
  const [deletedKind, setDeletedKind] = useState("registro");

  const update = useMutation({
    mutationFn: () => {
      const date = parseWhen(when);
      if (!date) throw new Error("Use o formato DD/MM/AAAA HH:MM, sem datas futuras.");
      return api(`/plants/${plantId}/events/${eventId}`, { method: "PATCH", body: { event_date: date.toISOString(), notes: notes.trim() || null } });
    },
    onSuccess: async () => { await invalidate([plantId]); router.push(routes.plantDiary(plantId)!); },
    onError: e => setError(getErrorMessage(e, "Não foi possível salvar a correção.")),
  });
  const remove = useMutation({
    mutationFn: () => api(`/plants/${plantId}/events/${eventId}`, { method: "DELETE" }),
    onSuccess: async () => { setDeletedKind(kind); await invalidate([plantId]); setStep("deleted"); },
    onError: e => setError(getErrorMessage(e, "Não foi possível excluir. Tente novamente.")),
  });

  if (step === "deleted") {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <PageTitle>Registro excluído</PageTitle>
        <PageSubtitle>{name}</PageSubtitle>
        <Notice title={deletedKind === "nota" ? "A nota foi removida" : "O registro foi removido"} body="As próximas observações do Bobby não usarão esse registro." />
        <ButtonLink label="Voltar ao diário" href={routes.plantDiary(plantId)!} replace />
        <ButtonLink secondary label="Voltar às plantas" href={routes.plants()} replace />
      </div>
    );
  }
  if (step === "delete") {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <BackLink fallback={routes.plantDiary(plantId)!} />
        <PageTitle>Excluir este registro?</PageTitle>
        <PageSubtitle>{name}{event ? ` · ${dayMonthTime(event.event_date, ", ")}` : ""}</PageSubtitle>
        <Notice title={kind === "nota" ? "Esta ação remove a nota" : "Esta ação remove o registro"} body="As observações que usam este registro precisam ser atualizadas. Os outros registros permanecem." />
        <FormError message={error} />
        <Button label="Manter registro" onClick={() => setStep("edit")} />
        <Button secondary label={remove.isPending ? "Excluindo…" : "Confirmar exclusão"} loading={remove.isPending} onClick={() => remove.mutate()} />
      </div>
    );
  }
  return (
    <form className="flex max-w-[600px] flex-col gap-4" noValidate onSubmit={(e: FormEvent) => { e.preventDefault(); setError(""); update.mutate(); }}>
      <BackLink fallback={routes.plantDiary(plantId)!} />
      <PageTitle>Revisar registro</PageTitle>
      <PageSubtitle>{[name, grow?.name].filter(Boolean).join(" · ")}</PageSubtitle>
      {events.isPending ? <Spinner /> : !event ? <Notice title="Registro não encontrado" body="Ele pode ter sido excluído ou pertencer a outra planta." /> : <>
        <TextField label="Quando" placeholder="DD/MM/AAAA HH:MM" value={editingWhen ? when : (fullDateTime(parseWhen(when)?.toISOString()) ?? when)}
          onFocus={() => setEditingWhen(true)} onBlur={() => setEditingWhen(false)} onChange={e => setWhen(e.target.value)} />
        <TextArea label="Observação" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Sem observação escrita." />
        <FormError message={error} />
        <Button type="submit" label={update.isPending ? "Salvando…" : "Salvar correção"} loading={update.isPending} />
        <Button secondary label="Excluir este registro" onClick={() => { setError(""); setStep("delete"); }} />
      </>}
    </form>
  );
}
