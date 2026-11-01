"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BackLink, Button, ChoiceField, FormError, PageSubtitle, PageTitle, Spinner, TextField } from "@/components/ui";
import { useNotificationPreferences, useSaveNotificationPreferences } from "@/lib/account";
import { routes } from "@/lib/routes";
import { clockInQuietRange, deviceTimezone, parseClock, parseQuietRange, quietRangeText } from "@/shared/lib/accountFeatures";
import { getErrorMessage } from "@/shared/lib/errors";
import type { NotificationPreferences } from "@/shared/types/features";

type Frequency = "daily" | "in_app";
type Preview = "discreet" | "full";

/** Figma 2173:6380 — Editar acompanhamento. Salva em PUT /users/me/notification-preferences. */
export default function NotificationPrefsPage() {
  const prefs = useNotificationPreferences(deviceTimezone());
  return <>
    <BackLink fallback={routes.notifications()} />
    <PageTitle>Editar acompanhamento</PageTitle>
    <PageSubtitle>Você escolhe a frequência e a prévia.</PageSubtitle>
    {prefs.isPending ? <Spinner /> : <PrefsForm initial={prefs.data} />}
  </>;
}

function PrefsForm({ initial }: { initial?: NotificationPreferences }) {
  const router = useRouter();
  const timezone = deviceTimezone();
  const save = useSaveNotificationPreferences();
  const [frequency, setFrequency] = useState<Frequency>(initial?.frequency ?? "daily");
  // Um padrão do servidor em UTC só faz sentido no fuso para o qual foi convertido.
  const [briefTime, setBriefTime] = useState(initial?.brief_time ?? "19:00");
  const [quiet, setQuiet] = useState(initial ? quietRangeText(initial) : "");
  const [preview, setPreview] = useState<Preview>(initial?.preview ?? "discreet");
  const [error, setError] = useState("");

  function submit(nextFrequency: Frequency = frequency) {
    setError("");
    const time = parseClock(briefTime);
    if (!time) return setError("Horário do resumo no formato HH:MM, por exemplo 19:00.");
    const range = parseQuietRange(quiet);
    if (range === "invalid") return setError("Horário silencioso no formato 21:00 às 08:00, ou deixe em branco.");
    if (range && nextFrequency === "daily" && clockInQuietRange(time, range)) return setError("O horário do resumo está dentro do horário silencioso.");
    save.mutate({ frequency: nextFrequency, brief_time: time, timezone, preview, quiet_start: range?.start ?? null, quiet_end: range?.end ?? null }, {
      onSuccess: () => router.push(routes.notifications()),
      onError: e => setError(getErrorMessage(e, "Não foi possível salvar. Suas escolhas continuam na tela.")),
    });
  }

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); submit(); }} className="flex flex-col gap-4">
      <ChoiceField label="Frequência" value={frequency} onChange={v => setFrequency(v as Frequency)}
        options={[{ value: "daily", label: "Resumo diário" }, { value: "in_app", label: "Somente no app" }]}
        hint="Você também pode manter apenas o acompanhamento dentro do app." />
      <TextField label="Horário do resumo" value={briefTime} onChange={e => setBriefTime(e.target.value)} placeholder="19:00" inputMode="numeric" hint="Horário local." />
      <TextField label="Horário silencioso" value={quiet} onChange={e => setQuiet(e.target.value)} placeholder="21:00 às 08:00" hint="Sem notificações externas nesse período. Deixe em branco para não usar." />
      <ChoiceField label="Prévia na tela bloqueada" value={preview} onChange={v => setPreview(v as Preview)}
        options={[{ value: "discreet", label: "Discreta" }, { value: "full", label: "Completa" }]}
        hint={preview === "discreet" ? "Sem nomes de plantas ou conteúdo das mensagens." : "Mostra o resumo com nomes de plantas."} />
      <FormError message={error} />
      <Button type="submit" label={save.isPending ? "Salvando…" : "Salvar preferências"} loading={save.isPending} />
      {frequency === "daily" && <Button secondary label="Desativar notificações externas" onClick={() => { setFrequency("in_app"); submit("in_app"); }} />}
    </form>
  );
}
