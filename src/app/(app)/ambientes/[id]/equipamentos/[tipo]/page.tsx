"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { LightScheduleField } from "@/components/grows/light-schedule";
import { BackLink, Button, ChoiceField, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextField } from "@/components/ui";
import { useGrow, useUpdateGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { KIND_TITLE, OPTIONS, draftFromGrow, isEquipmentKind, payloadFromDraft, unsavedFields, type EquipmentDraft, type EquipmentKind, type FanDraft } from "@/shared/lib/equipmentForms";
import { CLEAR_SCHEDULE, canClearSchedule, formatClock, parseClock, scheduleCleared, scheduleFromGrow } from "@/shared/lib/lightSchedule";
import { sanitizeNumericText } from "@/shared/lib/numericInput";

const SAVE_ERROR = "Não foi possível salvar. Seus dados continuam como antes, tente novamente.";
const CLEAR_ERROR = "Não foi possível limpar. A programação continua cadastrada.";

/** Figma 02C (2302:10048) H–H8: um formulário curto por tipo de equipamento; salva só os próprios campos. */
export default function EquipmentFormPage() {
  const { id, tipo } = useParams<{ id: string; tipo: string }>();
  const router = useRouter();
  const kind: EquipmentKind = isEquipmentKind(tipo) ? tipo : "light";
  const grow = useGrow(id);
  const update = useUpdateGrow(id);
  const [draft, setDraft] = useState<EquipmentDraft | null>(null);
  const [error, setError] = useState("");
  const [cleared, setCleared] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const g = grow.data;
  // Preenchido uma vez por ambiente e tipo: a releitura depois de salvar não sobrescreve o rascunho.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (g) setDraft(draftFromGrow(kind, g)); }, [g?.id, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => router.push(routes.growEquipment(id));

  const set = (key: string) => (value: string) => setDraft(d => d && { ...d, values: { ...d.values, [key]: value } });
  const setFan = (i: number, patch: Partial<FanDraft>) => setDraft(d => d && { ...d, fans: d.fans.map((f, j) => j === i ? { ...f, ...patch } : f) });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || update.isPending) return;
    const result = payloadFromDraft(kind, draft);
    if ("error" in result) { setError(result.error); return; }
    setError("");
    try {
      const saved = await update.mutateAsync(result.body);
      const kept = unsavedFields(result.body, saved);
      if (kept.length) { setError(`O resto foi salvo, mas o servidor não gravou: ${kept.join(", ")}. A informação anterior continua cadastrada.`); return; }
      back();
    } catch { setError(SAVE_ERROR); }
  }

  // Item 5b (Figma J8): confirma e salva só a programação na hora; o resto continua no rascunho.
  async function clearSchedule() {
    setConfirmClear(false); setClearError(""); setClearing(true);
    try {
      const saved = await update.mutateAsync(CLEAR_SCHEDULE);
      if (!scheduleCleared(saved)) { setClearError(CLEAR_ERROR); return; }
      setDraft(d => d && { ...d, values: { ...d.values, photoperiod_on_at: "", photoperiod_light_minutes: "" } });
      setCleared(true);
    } catch { setClearError(CLEAR_ERROR); } finally { setClearing(false); }
  }

  const vals = draft?.values ?? {};
  const field = (key: string, label: string, hint: string, numeric: "integer" | "decimal" = "integer") => (
    <TextField key={key} label={label} hint={hint} value={vals[key] ?? ""} placeholder="Não informado" inputMode={numeric === "integer" ? "numeric" : "decimal"}
      onChange={e => set(key)(sanitizeNumericText(e.target.value, numeric))} />
  );
  const choice = (key: string, label: string, hint: string | undefined, options: { value: string; label: string }[]) =>
    <ChoiceField key={key} label={label} hint={hint} value={vals[key] ?? ""} options={options} onChange={set(key)} />;

  const body = !draft || !g ? null : kind === "light" ? <>
    {choice("light_type", "Tipo de luminária", undefined, OPTIONS.lightType)}
    {field("lighting_watts", "Potência", "Unidade: W")}
    {field("light_distance_cm", "Distância até a copa", "Unidade: cm")}
    {/* Figma 02C J–J5: hora em que liga + minutos de luz; a hora de desligar é calculada. */}
    <LightScheduleField onAt={parseClock(vals.photoperiod_on_at)} light={vals.photoperiod_light_minutes ? Number(vals.photoperiod_light_minutes) : null} incomplete={scheduleFromGrow(g).incomplete}
      onChange={(on, minutes) => setDraft(d => d && { ...d, values: { ...d.values, photoperiod_on_at: on == null ? "" : formatClock(on), photoperiod_light_minutes: minutes == null ? "" : String(minutes) } })}
      onClear={!cleared && canClearSchedule(g) ? () => setConfirmClear(true) : undefined} clearing={clearing} clearError={clearError} cleared={cleared} />
    {choice("light_leak_controlled", "Vazamento de luz controlado", "Sim, Não ou Não sei.", OPTIONS.yesNo)}
  </> : kind === "exhaust" ? <>
    {choice("exhaust_type", "Tipo de exaustor", vals.exhaust_type === "none" ? "O dimmer de potência do painel fica desativado." : undefined, OPTIONS.exhaustType)}
    {vals.exhaust_type !== "none" && <>
      {field("exhaust_cfm", "Vazão nominal", "CFM, do manual do exaustor. Não é a potência do dimmer.")}
      {choice("exhaust_location", "Local", "Copa ou base.", OPTIONS.location)}
      {choice("carbon_filter", "Filtro de carvão", "Acoplado, Sem filtro ou Não sei.", OPTIONS.carbonFilter)}
    </>}
    {choice("intake_type", "Entrada de ar", "Ventilador ativo, Passiva ou Nenhuma.", OPTIONS.intake)}
    {choice("negative_pressure", "Pressão negativa", "Sim, Não ou Não sei.", OPTIONS.yesNo)}
  </> : kind === "fans" ? <>
    {draft.fans.length ? <p className="text-base leading-6">Cada ventilador de circulação dentro do ambiente. O cadastro não confirma se ele está ligado.</p>
      : <Notice title="Nenhum ventilador cadastrado" body="Adicione cada ventilador com o local e, se souber, a potência." meta="Opcional." />}
    {draft.fans.map((fan, i) => (
      <fieldset key={i} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
        <legend className="font-label px-1 text-base text-display">VENTILADOR {i + 1}</legend>
        <ChoiceField label="Local" hint="Copa ou base." value={fan.location} options={OPTIONS.location} onChange={location => setFan(i, { location })} />
        <TextField label="Potência" hint="Unidade: W · opcional." value={fan.watts} inputMode="numeric" placeholder="Não informado" onChange={e => setFan(i, { watts: sanitizeNumericText(e.target.value, "integer") })} />
        {/* Sem confirmação: remover só vale quando o formulário é salvo. */}
        <button type="button" onClick={() => setDraft(d => d && { ...d, fans: d.fans.filter((_, j) => j !== i) })} className="min-h-11 self-start text-base font-semibold text-error cursor-pointer">Remover ventilador {i + 1}</button>
      </fieldset>
    ))}
    <Button secondary label="Adicionar ventilador" onClick={() => setDraft(d => d && { ...d, fans: [...d.fans, { location: "", watts: "" }] })} />
  </> : kind === "climate" ? <>
    {choice("air_conditioning", "Ar-condicionado", "Sim, Não ou Não sei.", OPTIONS.yesNo)}
    {choice("dehumidifier", "Desumidificador", "Sim, Não ou Não sei.", OPTIONS.yesNo)}
    {choice("humidifier", "Umidificador", "Sim, Não ou Não sei.", OPTIONS.yesNo)}
    {choice("heater", "Aquecedor", "Sim, Não ou Não sei.", OPTIONS.yesNo)}
    <p className="font-label text-base text-display">FAIXA DEFINIDA POR VOCÊ</p>
    {field("target_temp_c", "Temperatura-alvo", "Unidade: °C · aparece no painel como referência.", "decimal")}
    {field("target_humidity_rh", "Umidade-alvo", "Unidade: %", "decimal")}
  </> : kind === "space" ? <>
    {field("tent_width_cm", "Largura", "Unidade: cm")}
    {field("tent_depth_cm", "Profundidade", "Unidade: cm")}
    {field("tent_height_cm", "Altura", "Unidade: cm · medidas internas da tenda, opcionais.")}
  </> : <>
    {choice("pot_type", "Tipo de vaso", "Feltro, Plástico, Air pot ou Outro.", OPTIONS.pot)}
    {choice("substrate_type", "Substrato", "Terra mineral, Fibra de coco, Supersoil orgânico, Hidroponia (DWC) ou Outro.", OPTIONS.substrate)}
  </>;

  return (
    <form onSubmit={save} className="flex max-w-[600px] flex-col gap-4" noValidate>
      <BackLink fallback={routes.growEquipment(id)} />
      <PageTitle>{KIND_TITLE[kind]}</PageTitle>
      <PageSubtitle>{g ? `${g.name} · cadastro do equipamento` : "Cadastro do equipamento"}</PageSubtitle>
      {grow.isPending ? <Spinner label="Carregando o cadastro…" />
        : !g ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void grow.refetch()} />
        : <>
          {body}
          <FormError message={error} />
          <Button type="submit" label={update.isPending && !clearing ? "Salvando…" : "Salvar"} loading={update.isPending && !clearing} />
          <Button secondary label="Cancelar" onClick={back} />
        </>}
      <ConfirmDialog open={confirmClear} title="Limpar programação de luz?" destructive confirm="Limpar" busy={clearing}
        message="A hora em que a luz liga e a duração saem do cadastro. No painel do ambiente, o timer passa a mostrar “Sem programação”. Registros e leituras não mudam."
        onConfirm={() => void clearSchedule()} onCancel={() => setConfirmClear(false)} />
    </form>
  );
}
