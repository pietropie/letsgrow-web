"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextArea, TextField } from "@/components/ui";
import { showFlash } from "@/lib/flash";
import { useDeleteEnvironmentReading, useEnvironmentReading, useGrow, useSaveEnvironmentReading } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { brDateTimeText, dayMonthTime, fullDateTime, parseBrDateTime } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";
import { deleteReadingMessage } from "@/shared/lib/growHistory";
import { parseNumericText, sanitizeNumericText } from "@/shared/lib/numericInput";
import type { EnvironmentReading } from "@/shared/types/features";

const numberText = (value: number | null) => value == null ? "" : String(value).replace(".", ",");

export default function ReadingPage() {
  return <Suspense fallback={<Spinner />}><ReadingForm /></Suspense>;
}

/** Figma 2160:6568 (Registro do ambiente) e 2160:6610 (Registro salvo). Com ?leitura= edita aquele registro. */
function ReadingForm() {
  const { id } = useParams<{ id: string }>();
  const readingId = useSearchParams().get("leitura");
  const router = useRouter();
  const grow = useGrow(id);
  const existing = useEnvironmentReading(id, readingId);
  const save = useSaveEnvironmentReading(id);
  const remove = useDeleteEnvironmentReading(id);
  const [when, setWhen] = useState(() => brDateTimeText(new Date()));
  const [editingWhen, setEditingWhen] = useState(false);
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<EnvironmentReading | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>(readingId ?? undefined);
  const [confirming, setConfirming] = useState(false);

  const r = existing.data;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!r) return; setWhen(brDateTimeText(new Date(r.observed_at))); setTemperature(numberText(r.temperature_c)); setHumidity(numberText(r.humidity_rh)); setNotes(r.notes ?? ""); }, [r?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const growName = grow.data?.name ?? "Ambiente";

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const date = parseBrDateTime(when);
    if (!date) { setError("Use o formato DD/MM/AAAA HH:MM, sem datas futuras."); return; }
    const temperature_c = parseNumericText(temperature);
    const humidity_rh = parseNumericText(humidity);
    if (Number.isNaN(temperature_c) || (temperature_c != null && (temperature_c < -20 || temperature_c > 60))) { setError("Temperatura entre -20 e 60 °C, ou deixe em branco."); return; }
    if (Number.isNaN(humidity_rh) || (humidity_rh != null && (humidity_rh < 0 || humidity_rh > 100))) { setError("Umidade entre 0 e 100%, ou deixe em branco."); return; }
    if (temperature_c == null && humidity_rh == null && !notes.trim()) { setError("Informe temperatura, umidade ou uma nota."); return; }
    save.mutate({ id: editingId, body: { observed_at: date.toISOString(), temperature_c, humidity_rh, notes: notes.trim() || null } }, {
      onSuccess: reading => { setSaved(reading); setEditingId(reading.id); },
      onError: err => setError(getErrorMessage(err, "Não foi possível salvar o registro. Seus dados continuam no formulário.")),
    });
  }

  /** Figma 02B E1/E2: só pela tela de edição, nunca por gesto na lista. */
  function runDelete() {
    if (!r) return;
    remove.mutate(r.id, {
      onSuccess: () => { setConfirming(false); showFlash("Registro apagado."); router.replace(routes.growHistory(id)); },
      onError: err => { setConfirming(false); setError(getErrorMessage(err, "Não foi possível apagar. O registro continua salvo.")); },
    });
  }
  // Escrito pelo servidor quando a potência do exaustor muda: não se edita nem apaga (a API responde 409).
  const automatic = r?.kind === "exhaust_power";

  if (saved) {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <PageTitle>Registro salvo</PageTitle>
        <PageSubtitle>{[growName, dayMonthTime(saved.observed_at, ", ")].filter(Boolean).join(" · ")}</PageSubtitle>
        <Notice title="Informação adicionada" body="Seu registro manual está no histórico do ambiente." />
        <ButtonLink label="Voltar ao ambiente" href={routes.growPanel(id)!} />
        <Button secondary label="Editar registro" onClick={() => setSaved(null)} />
        <ButtonLink secondary label="Ver histórico do ambiente" href={routes.growHistory(id)} replace />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex max-w-[600px] flex-col gap-4" noValidate>
      <BackLink fallback={routes.growPanel(id)!} />
      <PageTitle>{editingId ? "Editar registro" : "Registro do ambiente"}</PageTitle>
      <PageSubtitle>{growName}</PageSubtitle>
      {readingId && existing.isPending ? <Spinner />
        : readingId && existing.isError ? <Notice title="Registro não encontrado" body="Ele pode ter sido excluído ou pertencer a outro ambiente." />
        : automatic ? <Notice title="Registro automático" body="Este registro foi criado ao ajustar a potência do exaustor. Para mudar, ajuste a potência no painel do ambiente." />
        : <>
          <TextField label="Quando" value={editingWhen ? when : (fullDateTime(parseBrDateTime(when)?.toISOString()) ?? when)}
            onFocus={() => setEditingWhen(true)} onBlur={() => setEditingWhen(false)} onChange={e => setWhen(e.target.value)}
            placeholder="DD/MM/AAAA HH:MM" inputMode="text" hint="DD/MM/AAAA HH:MM" />
          <TextField label="Temperatura — opcional" value={temperature} inputMode="decimal" hint="Unidade: °C · registro manual"
            onChange={e => setTemperature(sanitizeNumericText(e.target.value, "signed-decimal"))} />
          <TextField label="Umidade — opcional" value={humidity} inputMode="decimal" hint="Unidade: % · registro manual"
            onChange={e => setHumidity(sanitizeNumericText(e.target.value, "decimal"))} />
          <TextArea label="Nota — opcional" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observação sobre o ambiente." hint="Uma nota sozinha também pode ser salva." />
          <FormError message={error} />
          <Button type="submit" label={save.isPending ? "Salvando…" : editingId ? "Salvar correção" : "Salvar registro"} loading={save.isPending} />
          <PageSubtitle>Registrar não consome créditos.</PageSubtitle>
          {!!editingId && r && <>
            <Button secondary label={remove.isPending ? "Apagando…" : "Apagar registro"} loading={remove.isPending} onClick={() => setConfirming(true)} />
            <PageSubtitle>Apagar tira o registro do histórico e da medição atual.</PageSubtitle>
            <ConfirmDialog open={confirming} title="Apagar registro?" message={deleteReadingMessage(r)} confirm="Apagar" destructive busy={remove.isPending}
              onConfirm={runDelete} onCancel={() => setConfirming(false)} />
          </>}
        </>}
    </form>
  );
}
