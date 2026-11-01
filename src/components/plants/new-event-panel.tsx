"use client";

/* eslint-disable @next/next/no-img-element */
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidePanel } from "@/components/side-panel";
import { Button, ButtonLink, Notice, PageSubtitle, TextArea, TextField } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useGrowPlants, useInvalidateDiary } from "@/lib/hooks";
import { uploadEventPhotos } from "@/lib/photos";
import { routes } from "@/lib/routes";
import { dayMonthTime, fullDateTime } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";
import { parseNumericText, sanitizeNumericText, type NumericKind } from "@/shared/lib/numericInput";
import { plantDisplayName } from "@/shared/lib/plantIdentity";

/**
 * Novo registro (Figma 2160:7092, "Tipo de registro" 2250:8989), web do letsgrow-mobile/components/plants/NewEventSheet.tsx.
 * Mesmos tipos, campos, validações e telas (consentimento da foto, prévia, salvo, erro com rascunho preservado).
 * Painel lateral de 400 no desktop e folha alta no celular (W22). A foto vem de <input type="file">: no iPhone,
 * câmera ou galeria.
 */
type Kind = "watering" | "feeding" | "environment" | "note" | "photo" | "phase" | "light" | "other";
type Page = "form" | "consent" | "photo" | "saved" | "error";
export type SheetPlant = { id: string; display_name?: string | null; strain_name: string; current_phase?: string | null };

const KINDS: { key: Kind; label: string; icon: string }[] = [
  { key: "watering", label: "REGA", icon: "watering" }, { key: "feeding", label: "NUTRIÇÃO", icon: "fert" }, { key: "environment", label: "AMBIENTE", icon: "temperature" }, { key: "note", label: "NOTA", icon: "align-left" },
  { key: "photo", label: "FOTO", icon: "tab-plant" }, { key: "phase", label: "FASE", icon: "phase-seedling" }, { key: "light", label: "LUZ", icon: "light" }, { key: "other", label: "OUTRO", icon: "" },
];
const PHASE_EVENTS = [["germination", "Germinação"], ["seedling", "Muda"], ["veg", "Vegetativa"], ["flip", "Flip 12/12"], ["harvest", "Colheita"], ["drying", "Secagem"], ["curing", "Cura"]] as const;
const OTHER_EVENTS = [["training", "Treino"], ["topping", "Topping"], ["pruning", "Poda"], ["transplant", "Transplante"], ["symptom", "Sintoma"], ["trichome_reading", "Tricomas"]] as const;
const PHASE_TAG: Record<string, string> = { germination: "GERM.", seedling: "MUDA", veg: "VEGA", flower: "FLORA", late_flower: "FLORA", harvest: "COLHEITA", drying: "SECAGEM", curing: "CURA" };

class FormProblem extends Error {}
function parseNumber(value: string) {
  const n = parseNumericText(value);
  if (n == null) return null;
  if (!Number.isFinite(n)) throw new FormProblem("Informe um número válido ou deixe o campo em branco.");
  return n;
}
function parseWhen(text: string): Date | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  return Number.isFinite(d.getTime()) && d.getTime() <= Date.now() ? d : null;
}
const pad = (n: number) => String(n).padStart(2, "0");
const whenText = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const tech = "font-label text-sm leading-[18px] text-display";
const card = "flex flex-col gap-2.5 rounded-2xl border-[0.5px] border-stroke bg-surface p-3";
const tile = (on: boolean) => `flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-[10px] py-2 cursor-pointer ${on ? "border-2 border-display bg-source-highlight" : "border border-display hover:bg-surface-high"}`;
const chip = (on: boolean) => `min-h-11 rounded-[10px] px-3 font-label text-[13px] text-display cursor-pointer ${on ? "border-2 border-display bg-source-highlight" : "border border-display"}`;

function Measure({ label, unit, value, onChange, disabled, kind = "decimal" }: { label: string; unit?: string; value: string; onChange: (v: string) => void; disabled?: boolean; kind?: NumericKind }) {
  return (
    <label className={`flex flex-1 flex-col gap-1 ${disabled ? "opacity-50" : ""}`}>
      <span className="font-label text-[13px] leading-4 text-display">{label}</span>
      <span className="flex min-h-14 items-center justify-center gap-0.5 rounded-[10px] border border-display px-2">
        <input inputMode={kind === "integer" ? "numeric" : "decimal"} disabled={disabled} value={value} placeholder="—" onChange={e => onChange(sanitizeNumericText(e.target.value, kind))}
          className="w-full min-w-0 bg-transparent py-2 text-center text-[22px] font-black text-display outline-none placeholder:text-display" />
        {unit && <span className="font-label text-xs text-display">{unit}</span>}
      </span>
    </label>
  );
}
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={value} onClick={() => onChange(!value)} className="flex min-h-11 items-center gap-3 cursor-pointer">
      <span className={`h-[22px] w-[22px] rounded-full border-2 ${value ? "border-[#1F7A53] bg-[#2DB37A]" : "border-stroke-soft bg-[#C9CCCA]"}`} />
      <span className={tech}>{label}</span>
    </button>
  );
}

export function NewEventPanel({ open, onClose, plantId, plants, defaultPlantIds, eventDate, growLabel, growId, firstRecord = false }: {
  open: boolean; onClose: () => void; plantId?: string; plants?: SheetPlant[]; defaultPlantIds?: string[]; eventDate?: Date;
  growLabel?: string | null; growId?: string;
  /** Figma 2160:6002: a primeira nota da planta usa o formulário simplificado. */
  firstRecord?: boolean;
}) {
  const invalidate = useInvalidateDiary();
  // "Aplicar a" lista as plantas do mesmo ambiente, mesmo quando aberto a partir de uma planta.
  const growPlants = useGrowPlants(plants ? null : growId);
  const options: SheetPlant[] = plants ?? growPlants.data ?? [];
  const [selected, setSelected] = useState<string[]>(defaultPlantIds ?? (plantId ? [plantId] : []));
  const [kind, setKind] = useState<Kind>("note");
  const [subtype, setSubtype] = useState("");
  const [page, setPage] = useState<Page>("form");
  const [when, setWhen] = useState<Date>(eventDate ?? new Date());
  const [editingWhen, setEditingWhen] = useState(false);
  const [whenDraft, setWhenDraft] = useState("");
  const [notes, setNotes] = useState("");
  const [volume, setVolume] = useState(""); const [ph, setPh] = useState(""); const [ppm, setPpm] = useState("");
  const [flush, setFlush] = useState(false); const [runoff, setRunoff] = useState(false);
  const [temp, setTemp] = useState(""); const [humidity, setHumidity] = useState(""); const [weight, setWeight] = useState("");
  const [clear, setClear] = useState(""); const [milky, setMilky] = useState(""); const [amber, setAmber] = useState("");
  const [severity, setSeverity] = useState<"" | "leve" | "moderado" | "grave">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState<{ plant: string; date: Date; eventId?: string; plantId?: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const contextPlant = options.find(p => p.id === (plantId ?? selected[0]));
  const eventType = kind === "phase" || kind === "other" ? subtype : kind === "photo" ? "note" : kind;

  const save = useMutation({
    mutationFn: async () => {
      const targets = plantId && !options.length ? [plantId] : selected;
      if (!targets.length) throw new FormProblem("Selecione ao menos uma planta.");
      if (!eventType) throw new FormProblem("Escolha o tipo de registro.");
      const payload: Record<string, unknown> = { event_type: eventType, event_date: when.toISOString(), notes: notes.trim() || null };
      if (kind === "watering" || kind === "feeding") Object.assign(payload, { water_volume_ml: parseNumber(volume), is_flush: flush || null, ppm: flush ? null : parseNumber(ppm), ph_in: flush ? null : parseNumber(ph), has_runoff: runoff || null });
      if (kind === "environment") Object.assign(payload, { temperature_c: parseNumber(temp), humidity_rh: parseNumber(humidity) });
      if (["harvest", "drying"].includes(eventType)) Object.assign(payload, { weight_g: parseNumber(weight) });
      if (eventType === "trichome_reading") Object.assign(payload, { trichome_clear_pct: parseNumber(clear), trichome_milky_pct: parseNumber(milky), trichome_amber_pct: parseNumber(amber) });
      if (eventType === "symptom") Object.assign(payload, { severity: severity || null });
      if (["note", "light", "other", "photo"].includes(kind) && !notes.trim() && !photo) throw new FormProblem("Escreva uma observação ou adicione uma foto.");
      const keys = photo ? await uploadEventPhotos([photo]) : [];
      payload.photo_keys = keys.length ? keys : null;
      if (targets.length === 1) {
        const created = await api<{ id?: string }>(`/plants/${targets[0]}/events`, { method: "POST", body: payload });
        return { id: created?.id, plantId: targets[0] };
      }
      await api("/diary", { method: "POST", body: { ...payload, plant_ids: targets, grow_id: growId } });
      return { id: undefined, plantId: undefined };
    },
    onSuccess: result => {
      void invalidate([...selected, plantId]);
      setSaved({ plant: selected.length > 1 ? `${selected.length} plantas` : contextPlant ? plantDisplayName(contextPlant) : "Planta", date: when, eventId: result.id, plantId: result.plantId });
      setPage("saved");
    },
    onError: e => {
      setFormError(getErrorMessage(e, "Tente novamente."));
      // Problemas de validação ficam no formulário; falha de envio vai para a tela de erro com o rascunho (Figma 2160:7348).
      if (!(e instanceof FormProblem)) setPage("error");
    },
  });

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file); setPreview(URL.createObjectURL(file)); setPage("photo");
  }
  function chooseKind(next: Kind) {
    setKind(next); setSubtype(""); setFormError("");
    if (next === "photo") setPage(consented ? "form" : "consent");
  }
  const submit = () => { setFormError(""); save.mutate(); };
  const openPicker = () => fileInput.current?.click();
  const editHref = saved?.eventId && saved.plantId ? routes.diaryEntry(saved.plantId, saved.eventId) : null;

  let title = "Novo registro";
  let body: ReactNode;
  if (page === "consent") {
    title = "Antes de enviar uma foto";
    body = <>
      <PageSubtitle>Você escolhe como usar a imagem.</PageSubtitle>
      <Notice title="Guardar no diário" body="A foto fica vinculada à planta. Outros usuários não têm acesso a ela." />
      <p className="text-base leading-6">Analisar com o Bobby é uma ação separada. Antes de analisar, você verá quais dados serão usados e o custo.</p>
      <Link href="/privacidade" className="text-sm font-semibold text-primary underline">Como os dados são tratados</Link>
      <Button label="Escolher foto" onClick={() => { setConsented(true); openPicker(); }} />
      <Button secondary label="Continuar só com a nota" onClick={() => { setKind("note"); setPage("form"); }} />
    </>;
  } else if (page === "photo") {
    title = "Foto selecionada";
    body = <>
      <PageSubtitle>{contextPlant ? `${plantDisplayName(contextPlant)} · prévia` : "Prévia"}</PageSubtitle>
      {preview && <img src={preview} alt="Foto selecionada" className="mx-auto h-[217px] w-[217px] rounded-xl object-cover" />}
      <TextField label="Legenda — opcional" placeholder="Minha observação de hoje." value={notes} onChange={e => setNotes(e.target.value)} />
      {!!formError && <p role="alert" className="text-sm text-error">{formError}</p>}
      <Button label={save.isPending ? "Salvando…" : "Salvar no diário"} loading={save.isPending} onClick={submit} />
      <Button secondary label="Remover foto" onClick={() => { setPhoto(null); setPreview(null); setPage("form"); }} />
      <PageSubtitle>A foto não será analisada automaticamente.</PageSubtitle>
    </>;
  } else if (page === "saved" && saved) {
    title = firstRecord ? "Seu primeiro registro está salvo" : "Registro salvo";
    body = firstRecord ? <>
      <PageSubtitle>{[saved.plant, growLabel].filter(Boolean).join(" · ")}</PageSubtitle>
      <Notice title={dayMonthTime(saved.date.toISOString(), " · ") ?? ""} body={notes.trim() || "Registro sem observação escrita."} meta="Nota manual" />
      <p className="text-base leading-6">Você pode voltar quando tiver algo para registrar. Não há obrigação diária.</p>
      {editHref && <ButtonLink secondary label="Editar minha nota" href={editHref} />}
      <Button label="Fechar" onClick={onClose} />
    </> : <>
      <PageSubtitle>{saved.plant} · {dayMonthTime(saved.date.toISOString(), ", ")}</PageSubtitle>
      <Notice title="Sua atualização está no diário" body={`${kind === "note" ? "Nota adicionada" : "Registro adicionado"}. Você pode editar ou voltar quando quiser.`} />
      {saved.plantId && <ButtonLink label="Ver no diário" href={routes.plantDiary(saved.plantId)!} />}
      {editHref && <ButtonLink secondary label="Editar nota" href={editHref} />}
      <Button secondary label="Fechar" onClick={onClose} />
    </>;
  } else if (page === "error") {
    title = "Não foi possível salvar";
    body = <>
      <PageSubtitle>Sua nota continua aqui.</PageSubtitle>
      <Notice title="O envio não foi concluído" body="Tente novamente quando a conexão estiver disponível. Não é preciso escrever tudo de novo." meta={formError || undefined} />
      <TextArea label="Rascunho preservado" readOnly value={notes || "Sem texto escrito."} />
      <Button label={save.isPending ? "Enviando…" : "Tentar novamente"} loading={save.isPending} onClick={submit} />
      <Button secondary label="Voltar ao rascunho" onClick={() => setPage("form")} />
    </>;
  } else if (firstRecord) {
    title = "Primeira nota";
    body = <>
      <PageSubtitle>{[contextPlant && plantDisplayName(contextPlant), growLabel].filter(Boolean).join(" · ")}</PageSubtitle>
      <TextField label="Quando" placeholder="DD/MM/AAAA HH:MM" hint="Você pode registrar algo que aconteceu antes."
        value={editingWhen ? whenDraft : fullDateTime(when.toISOString()) ?? ""} onFocus={() => { setEditingWhen(true); setWhenDraft(whenText(when)); }}
        onChange={e => setWhenDraft(e.target.value)} onBlur={() => { const d = parseWhen(whenDraft); if (d) setWhen(d); setEditingWhen(false); }} />
      <TextArea label="Sua observação" placeholder="Hoje comecei meu diário." hint="Escreva com suas palavras." value={notes} onChange={e => setNotes(e.target.value)} />
      {!!formError && <p role="alert" className="text-sm text-error">{formError}</p>}
      <Button label={save.isPending ? "Salvando…" : "Salvar nota"} loading={save.isPending} onClick={submit} />
      <PageSubtitle>Registrar não consome créditos.</PageSubtitle>
    </>;
  } else {
    body = <>
      <div className="flex flex-wrap items-center gap-1.5">
        {!!growLabel && <span className="bg-stroke-soft px-1.5 text-sm text-display">{growLabel}</span>}
        {!!growLabel && <span className={tech}>›</span>}
        {contextPlant && <span className={`bg-source-highlight px-1.5 ${tech}`}>{plantDisplayName(contextPlant).toUpperCase()}</span>}
        <span className={`bg-state-alert px-1.5 ${tech}`}>{dayMonthTime(when.toISOString(), " · ")?.toUpperCase()}</span>
        <button type="button" aria-label="Alterar data e hora" onClick={() => { setEditingWhen(v => !v); setWhenDraft(whenText(when)); }} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-bg cursor-pointer"><img src="/figma/edit.svg" alt="" /></button>
      </div>
      {editingWhen && <TextField label="Quando" placeholder="DD/MM/AAAA HH:MM" hint="Datas futuras não são aceitas." value={whenDraft} onChange={e => setWhenDraft(e.target.value)}
        onBlur={() => { const d = parseWhen(whenDraft); if (d) setWhen(d); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const d = parseWhen(whenDraft); if (d) { setWhen(d); setEditingWhen(false); } } }} />}
      <p className="text-sm leading-5 text-text">Uma nota simples já basta. Campos de medição são opcionais; salvar registros não consome créditos.</p>

      <section className={card} aria-label="Tipo de registro">
        <div className="flex items-center gap-2"><img src="/figma/align-left.svg" alt="" /><h3 className="font-label text-base text-display">TIPO DE REGISTRO</h3></div>
        <div className="h-px bg-stroke" />
        <div role="radiogroup" aria-label="Tipo de registro" className="grid grid-cols-4 gap-2">
          {KINDS.map(k => (
            <button key={k.key} type="button" role="radio" aria-checked={kind === k.key} onClick={() => chooseKind(k.key)} className={tile(kind === k.key)}>
              {k.icon ? <img src={`/figma/${k.icon}.svg`} alt="" className="h-6 w-auto" /> : <span className="text-[38px] leading-9 font-black text-display">+</span>}
              <span className="font-label text-[13px] leading-4 text-display">{k.label}</span>
            </button>
          ))}
        </div>
        {(kind === "phase" || kind === "other") && (
          <div role="radiogroup" aria-label={kind === "phase" ? "Fase" : "Outro tipo"} className="flex flex-wrap gap-2">
            {(kind === "phase" ? PHASE_EVENTS : OTHER_EVENTS).map(([key, label]) => <button key={key} type="button" role="radio" aria-checked={subtype === key} onClick={() => setSubtype(key)} className={chip(subtype === key)}>{label.toUpperCase()}</button>)}
          </div>
        )}
      </section>

      {(kind === "watering" || kind === "feeding") && (
        <section className={card}>
          <div className="flex items-center gap-2"><img src={`/figma/${kind === "watering" ? "watering" : "fert"}.svg`} alt="" className="h-5 w-auto" /><h3 className="font-label flex-1 text-base text-display">{kind === "watering" ? "REGA" : "NUTRIÇÃO"}</h3><span className={`bg-bg px-1.5 ${tech}`}>OPCIONAL</span></div>
          <div className="h-px bg-stroke" />
          <div className="flex gap-2">
            <Measure label="VOLUME" unit="ML" value={volume} onChange={setVolume} />
            <Measure label="pH · opcional" value={ph} onChange={setPh} disabled={flush} />
            <Measure label="PPM · opcional" value={ppm} onChange={setPpm} disabled={flush} />
          </div>
          <Check label="SÓ ÁGUA" value={flush} onChange={setFlush} />
          <Check label="ÁGUA ESCOOU PELO VASO?" value={runoff} onChange={setRunoff} />
        </section>
      )}
      {kind === "environment" && (
        <section className={card}>
          <div className="flex items-center gap-2"><img src="/figma/temperature.svg" alt="" className="h-5 w-auto" /><h3 className="font-label flex-1 text-base text-display">AMBIENTE</h3><span className={`bg-bg px-1.5 ${tech}`}>OPCIONAL</span></div>
          <div className="h-px bg-stroke" />
          <div className="flex gap-2"><Measure label="TEMPERATURA" unit="°C" kind="signed-decimal" value={temp} onChange={setTemp} /><Measure label="UMIDADE" unit="%" value={humidity} onChange={setHumidity} /></div>
        </section>
      )}
      {["harvest", "drying"].includes(subtype) && <section className={card}><div className="flex gap-2"><Measure label="PESO · opcional" unit="G" value={weight} onChange={setWeight} /></div></section>}
      {subtype === "trichome_reading" && <section className={card}><div className="flex gap-2"><Measure label="CLAROS" unit="%" kind="integer" value={clear} onChange={setClear} /><Measure label="LEITOSOS" unit="%" kind="integer" value={milky} onChange={setMilky} /><Measure label="ÂMBAR" unit="%" kind="integer" value={amber} onChange={setAmber} /></div></section>}
      {subtype === "symptom" && (
        <section className={card}>
          <p className="font-label text-[13px] text-display">GRAVIDADE · opcional</p>
          <div role="radiogroup" aria-label="Gravidade" className="flex flex-wrap gap-2">{(["leve", "moderado", "grave"] as const).map(level => <button key={level} type="button" role="radio" aria-checked={severity === level} onClick={() => setSeverity(severity === level ? "" : level)} className={chip(severity === level)}>{level.toUpperCase()}</button>)}</div>
        </section>
      )}
      {kind === "photo" && preview && <section className={card}><img src={preview} alt="Foto escolhida" className="h-[120px] w-[120px] rounded-[10px] object-cover" /><Button secondary label="Trocar foto" onClick={openPicker} /></section>}
      {kind === "photo" && !preview && consented && <Button secondary label="Escolher foto" onClick={openPicker} />}

      <section className={card}>
        <div className="flex items-center gap-2"><img src="/figma/tab-plant.svg" alt="" className="h-[22px] w-auto" /><h3 className="font-label text-base text-display">OBSERVAÇÃO</h3></div>
        <textarea aria-label="Observação" placeholder="O que você observou?" value={notes} onChange={e => setNotes(e.target.value)}
          className="min-h-24 resize-y rounded-[10px] border border-display bg-white p-3.5 text-base leading-6 text-text outline-none focus:border-2 focus:border-primary" />
      </section>

      {options.length > 0 && (
        <section className={card}>
          <div className="flex items-center gap-2"><img src="/figma/phase-seedling.svg" alt="" className="h-[22px] w-auto" /><h3 className="font-label text-base text-display">APLICAR A</h3></div>
          <p className="text-sm leading-5 text-display">Escolha em qual diário salvar. Você pode selecionar mais de uma planta.</p>
          <div className="h-px bg-stroke" />
          {options.map(p => {
            const on = selected.includes(p.id);
            return (
              <button key={p.id} type="button" role="checkbox" aria-checked={on} onClick={() => setSelected(cur => on ? cur.filter(id => id !== p.id) : [...cur, p.id])} className="flex min-h-12 items-center gap-3 cursor-pointer">
                <span className={`h-[22px] w-[22px] shrink-0 rounded-full border-2 ${on ? "border-[#1F7A53] bg-[#2DB37A]" : "border-stroke-soft bg-[#C9CCCA]"}`} />
                <span className={`flex-1 text-left ${tech}`}>{plantDisplayName(p).toUpperCase()}</span>
                {!!p.current_phase && PHASE_TAG[p.current_phase] && <span className={`bg-source-highlight px-1.5 ${tech}`}>{PHASE_TAG[p.current_phase]}</span>}
              </button>
            );
          })}
        </section>
      )}

      {!!formError && <p role="alert" className="text-sm text-error">{formError}</p>}
      <button type="button" disabled={save.isPending} onClick={submit} className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-primary px-4 text-base font-semibold text-white hover:bg-primary-dark disabled:opacity-50 cursor-pointer">
        {save.isPending ? "SALVANDO…" : "SALVAR REGISTRO"} <img src="/figma/arrow-right.svg" alt="" />
      </button>
      <Button secondary label="CANCELAR" onClick={onClose} />
    </>;
  }

  return (
    <SidePanel open={open} onClose={onClose} title={title} tall>
      {body}
      {/* accept="image/*": no iPhone abre "Tirar foto" ou "Fototeca". */}
      <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={e => { pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      {save.isError && save.error instanceof ApiError && save.error.response.status === 401 && <p className="text-sm text-error">Sua sessão venceu. Entre de novo para salvar.</p>}
    </SidePanel>
  );
}
