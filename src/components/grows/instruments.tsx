"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { SegmentedDisplay } from "@/components/home/blocks";
import { useMinuteOfDay } from "@/lib/hooks";
import { dayMonthTime, shortDayMonth } from "@/shared/lib/dates";
import { POWER_STEP, dragPower, powerToAngle, snapPower, touchAngle } from "@/shared/lib/exhaustDimmer";
import { dialAngle, lightReadingPointer } from "@/shared/lib/lightDial";
import { DAY, dialProgress, durationLabel, lightNow, progressSummary, type LightNow } from "@/shared/lib/lightSchedule";
import { environmentMeasurement, measurementCaption } from "@/shared/lib/measurements";
import type { EnvironmentMeasurement, GrowEnvSnapshot } from "@/shared/types/api";

/**
 * Instrumentos do painel do ambiente (Figma 2160:6350, desktop W16). Portados de letsgrow-mobile/components/
 * grows/{PanelInstruments,ExhaustDimmer}.tsx e data/{Tag,SourceBadge,EnvironmentReadings}.tsx. Mudou lá, mude aqui.
 */

const v = (name: string) => `var(--color-${name})`;

/** Tag marca-texto do Figma (Share Tech 14 sobre cor chapada). A cor acompanha o texto, nunca sozinha. */
export type PanelTone = "calm" | "stable" | "neutral" | "alert" | "pink";
const TONE: Record<PanelTone, string> = { calm: "bg-source-highlight", stable: "bg-state-stable", neutral: "bg-bg", alert: "bg-state-alert", pink: "bg-source-secondary" };
export function PanelTag({ label, tone = "neutral" }: { label: string; tone?: PanelTone }) {
  return <span className={`font-label self-start px-1.5 py-0.5 text-sm leading-4 text-display ${TONE[tone]}`}>{label}</span>;
}

/** Figma "Origem": "MANUAL · 14 OUT" ou, nos painéis, com a hora. */
export function SourceBadge({ measurement, withTime = false }: { measurement?: EnvironmentMeasurement | null; withTime?: boolean }) {
  const available = measurement?.value != null && Number.isFinite(measurement.value);
  const full = measurementCaption(measurement);
  const date = withTime ? dayMonthTime(measurement?.observed_at, " ") : shortDayMonth(measurement?.observed_at);
  const source = measurement?.source === "manual" ? "Manual" : measurement?.source === "sensor" ? "Sensor" : null;
  const caption = available && source && date ? `${source} · ${date}` : full;
  const bg = !available || !measurement?.source ? "bg-bg" : measurement.source === "manual" ? "bg-source-highlight" : "bg-source-secondary";
  return <span title={full} className={`font-label max-w-full self-start px-1.5 py-px text-sm leading-[18px] text-display uppercase ${bg}`}>{caption}</span>;
}

export function EnvironmentReadings({ env, indoor = true }: { env?: GrowEnvSnapshot | null; indoor?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {(["temperature", "humidity"] as const).map(metric => {
        const m = environmentMeasurement(env, metric);
        const label = metric === "temperature" ? "Temperatura" : "Umidade";
        return (
          <div key={metric} className="flex min-w-0 flex-[1_1_140px] flex-col gap-1">
            <p className="font-label text-sm leading-[18px] text-text-muted uppercase">{label}{indoor ? " interna" : " do ambiente"}</p>
            <SegmentedDisplay value={m.value} unit={metric === "temperature" ? "°" : "%"} label={metric === "temperature" ? "Temperatura em Celsius" : label} />
            <SourceBadge measurement={m} withTime />
          </div>
        );
      })}
    </div>
  );
}

// ── Timer de luz (Figma 2185:7152, com o progresso do item 2c) ──────────────────────────────────────────────────

const CENTER_FILL: Record<LightNow, string> = { on: v("state-alert"), off: v("state-night"), none: v("stroke-soft") };
const ARC_RADIUS = 59.5, ARC_WIDTH = 12;
const CAP_MINUTES = (ARC_WIDTH / 2 / ARC_RADIUS) / (2 * Math.PI) * DAY;
const SOURCE_LABEL: Record<string, string> = { sensor: "sensor", manual: "registro manual" };

export function PhotoperiodDial({ onAt, light, lastReading }: { onAt: number | null; light: number | null; lastReading?: EnvironmentMeasurement | null }) {
  const cx = 105.4, cy = 105.6, r = ARC_RADIUS;
  const point = (hour: number, radius: number) => { const a = dialAngle(hour) * Math.PI / 180 - Math.PI / 2; return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]; };
  const minute = useMinuteOfDay();
  const now = lightNow(onAt, light, minute);
  const progress = dialProgress(onAt, light, minute);
  const pointer = lightReadingPointer(lastReading?.observed_at);
  const [day, time] = dayMonthTime(lastReading?.observed_at, "|")?.split("|") ?? [];
  const source = lastReading?.source ? `, ${SOURCE_LABEL[lastReading.source] ?? lastReading.source}` : "";
  const reading = pointer ? ` Última leitura de luz às ${time} de ${day}${source}${pointer.stale ? ", há mais de 24 horas" : ""}.` : " Sem leitura de luz.";
  const arc = (from: number, length: number) => {
    const [x1, y1] = point(from / 60, r), [x2, y2] = point((from + length) / 60, r);
    return `M${x1} ${y1} A${r} ${r} 0 ${length > DAY / 2 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const onMarker = (m: number) => { const [x, y] = point(m / 60, r); return <><circle cx={x} cy={y} r={6} fill={v("display")} stroke={v("surface")} strokeWidth={1} /><circle cx={x} cy={y} r={2.2} fill={v("state-alert")} /></>; };
  const nowMarker = (m: number) => { const [x, y] = point(m / 60, r); return <><circle cx={x} cy={y} r={8} fill={v("surface")} stroke={v("display")} strokeWidth={2} /><circle cx={x} cy={y} r={3.5} fill={v("display")} /></>; };
  return (
    <svg width={212} height={211} viewBox="0 0 212 211" role="img" aria-label={progressSummary(onAt, light, minute) + reading} className="shrink-0">
      {progress.kind === "cycle" && progress.remaining > 0 && (progress.remaining > CAP_MINUTES
        ? <path d={arc(progress.on + progress.elapsed, progress.remaining - CAP_MINUTES)} stroke={v("stroke-soft")} strokeWidth={ARC_WIDTH} strokeLinecap="round" fill="none" />
        : <path d={arc(progress.on + progress.elapsed, progress.remaining)} stroke={v("stroke-soft")} strokeWidth={ARC_WIDTH} fill="none" />)}
      <circle cx={104.5} cy={104.5} r={102.5} stroke={v("display")} strokeWidth={2} fill="none" />
      <circle cx={cx} cy={cy} r={65.57} stroke={v("display")} strokeWidth={1} fill="none" />
      {Array.from({ length: 48 }, (_, i) => { const major = i % 2 === 0; const [x1, y1] = point(i / 2, 65.5); const [x2, y2] = point(i / 2, major ? 73 : 70); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={v("display")} strokeWidth={major ? 1.5 : 0.75} />; })}
      {progress.kind === "full" && <><circle cx={cx} cy={cy} r={r} stroke={v("display")} strokeWidth={ARC_WIDTH} fill="none" />{nowMarker(progress.now)}</>}
      {progress.kind === "cycle" && <>
        {progress.elapsed > 0 && <path d={arc(progress.on, progress.elapsed)} stroke={v("display")} strokeWidth={ARC_WIDTH} fill="none" />}
        {onMarker(progress.on)}
        {nowMarker(progress.now)}
      </>}
      <circle cx={cx} cy={cy} r={29} fill={CENTER_FILL[now]} style={{ filter: "drop-shadow(0 4px 2px rgba(0,0,0,0.25))" }} />
      <circle cx={cx} cy={cy} r={28.5} stroke={v("display")} strokeWidth={1} fill="none" />
      {([["0", 105.7, 13.9], ["6", 195.1, 105], ["12", 105.9, 198], ["18", 12.4, 106.4]] as const).map(([label, x, y]) => (
        <text key={label} x={x} y={y + 5} textAnchor="middle" className="font-label" fontSize={14} fill={v("display")}>{label}</text>
      ))}
      <text x={106} y={98} textAnchor="middle" fontSize={14} fontWeight={900} fill={v("display")}>{now !== "none" ? durationLabel(light!) : "—"}</text>
      <text x={106} y={113} textAnchor="middle" className="font-label" fontSize={14} fill={v("display")}>{now === "off" ? "ESCURO" : "LUZ"}</text>
      <image href={now === "off" ? "/figma/moon-small.svg" : "/figma/sun-dial.svg"} x={99} y={115.7} width={13.96} height={13.96} />
    </svg>
  );
}

const PPFD_STEPS = ["100", "300", "600", "900", "+1200"];
/** Figma 2183:8033: medidor vertical de PPFD. Só leituras de PPFD o preenchem; lux é outra grandeza e não é convertido. */
export function PpfdGauge({ value, badge }: { value: number | null; badge: string }) {
  const filled = value == null ? 0 : Math.max(0, Math.min(24, Math.round((value / 1200) * 24)));
  return (
    <div className="flex flex-col items-center gap-[5px] rounded-lg border border-display py-2 pr-2 pl-1.5" role="img" aria-label={value == null ? "PPFD: sem leitura" : `PPFD: ${value}`}>
      <div className="flex items-center gap-1"><span className="font-label text-sm leading-4 text-display">PPFD:</span><PanelTag tone={value == null ? "neutral" : "calm"} label={badge} /></div>
      <div className="flex h-[172px] gap-0.5" aria-hidden>
        <div className="flex flex-col items-end justify-between py-0.5">{[...PPFD_STEPS].reverse().map(s => <span key={s} className="font-label text-sm leading-4 text-display">{s}</span>)}</div>
        <div className="flex flex-col justify-between py-2">{PPFD_STEPS.map(s => <span key={s} className="block h-px w-[5px] bg-display" />)}</div>
        <div className="flex flex-col justify-end gap-[3px] border-y border-l border-display px-px py-0.5">
          {Array.from({ length: 24 }, (_, i) => <span key={i} className={`block h-1 w-[15px] ${23 - i < filled ? "bg-display" : "bg-bg"}`} />)}
        </div>
      </div>
    </div>
  );
}

// ── Dimmer da exaustão (Figma 2290:9145) ─────────────────────────────────────────────────────────────────────────

const W = 110, H = 118, CX = 58.7, CY = 69;
const MARK_RADIUS = 46.47, RING_RADIUS = 39.57, BODY_RADIUS = 35.57, BODY_RING_RADIUS = 25.9, INDICATOR = 23.3;
const MARKS = Array.from({ length: 100 / POWER_STEP + 1 }, (_, i) => i * POWER_STEP);
const KEY_SAVE_DELAY = 600;
/**
 * Toque: o giro só começa depois de segurar 150 ms parado. Se o dedo andar antes disso, nada muda (era uma
 * tentativa de rolar a página), para soltar nunca salvar um valor por engano (QA 2026-10-20 nº 1).
 */
const HOLD_MS = 150, HOLD_SLOP = 6;

type Status = "idle" | "dragging" | "saving" | "error";

/**
 * Registra a potência ajustada no controlador do exaustor: gire em volta do centro e solte para salvar. Nunca comanda
 * o exaustor. Mouse e toque por Pointer Events; teclado com ←→/↑↓ (±5 %) e salvamento depois de uma pausa.
 */
export function ExhaustDimmer({ value, updatedAt, enabled, onSave }: { value: number | null; updatedAt: string | null; enabled: boolean; onSave: (pct: number) => Promise<void> }) {
  const [draft, setDraft] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [failed, setFailed] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const gesture = useRef<{ id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> | null; active: boolean } | null>(null);
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (keyTimer.current) clearTimeout(keyTimer.current); }, []);

  const shown = draft ?? value;
  const move = (next: number | null) => { if (next == null || next === draftRef.current) return; draftRef.current = next; setDraft(next); };
  const reset = () => { draftRef.current = null; setDraft(null); };
  // Sem sucesso otimista: o novo valor aparece só enquanto salva; em erro volta ao salvo.
  const save = async (pct: number) => {
    if (pct === value) { reset(); setStatus("idle"); return; }
    setStatus("saving"); setFailed(null);
    try { await onSave(pct); setStatus("idle"); }
    catch { setFailed(pct); setStatus("error"); }
    finally { reset(); }
  };
  const angleOf = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return touchAngle(e.clientX - box.left, e.clientY - box.top, CX, CY);
  };
  const disabled = !enabled || status === "saving";

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const angle = angleOf(e);
    const begin = () => {
      if (!gesture.current) return;
      gesture.current.active = true;
      draftRef.current = value; setStatus("dragging");
      move(dragPower(angle, null));
    };
    // Mouse e caneta giram na hora; toque espera o "segurar".
    const timer = e.pointerType === "touch" ? setTimeout(begin, HOLD_MS) : null;
    gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, timer, active: false };
    if (!timer) begin();
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (!g.active) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > HOLD_SLOP) { if (g.timer) clearTimeout(g.timer); gesture.current = null; }
      return;
    }
    move(dragPower(angleOf(e), draftRef.current));
  }
  function end(e: PointerEvent<HTMLDivElement>, commit: boolean) {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    if (g.timer) clearTimeout(g.timer);
    gesture.current = null;
    if (!g.active) return;
    const pct = draftRef.current;
    if (commit && pct != null) void save(pct); else { reset(); setStatus("idle"); }
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const delta = e.key === "ArrowUp" || e.key === "ArrowRight" ? POWER_STEP : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -POWER_STEP
      : e.key === "Home" ? -100 : e.key === "End" ? 100 : 0;
    if (!delta || disabled) return;
    e.preventDefault();
    const next = snapPower((draftRef.current ?? value ?? 0) + delta);
    draftRef.current = next; setDraft(next);
    if (keyTimer.current) clearTimeout(keyTimer.current);
    keyTimer.current = setTimeout(() => void save(next), KEY_SAVE_DELAY);
  }

  const when = dayMonthTime(updatedAt, " ")?.toUpperCase();
  const caption = !enabled ? "CADASTRE O EXAUSTOR"
    : status === "dragging" ? "SOLTE PARA SALVAR"
    : status === "saving" ? "SALVANDO…"
    : status === "error" ? "NÃO FOI POSSÍVEL SALVAR · TENTAR DE NOVO"
    : value == null ? "GIRE PARA REGISTRAR"
    : when ? `REGISTRADO ${when}` : "REGISTRADO";
  const indicator = shown != null && enabled ? (powerToAngle(shown) * Math.PI) / 180 : null;
  const markFill = (pct: number) => shown != null && enabled && pct <= shown ? v("display") : v("stroke-soft");

  return (
    <div className="flex w-[137px] shrink-0 flex-col items-center gap-1 rounded-lg border border-display px-2 py-1">
      <p className="font-label text-base leading-[18px] text-display">POTÊNCIA · AJUSTE</p>
      <div role="slider" tabIndex={enabled ? 0 : -1} aria-label="Potência do exaustor" aria-describedby="dimmer-hint"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown ?? undefined} aria-valuetext={shown == null ? "não registrada" : `${shown} por cento`} aria-disabled={!enabled}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={e => end(e, true)} onPointerCancel={e => end(e, false)} onKeyDown={onKeyDown}
        className={`relative touch-none select-none rounded-full ${enabled ? "cursor-grab active:cursor-grabbing" : "opacity-40"}`} style={{ width: W, height: H }}>
        <svg width={W} height={H} aria-hidden className="absolute inset-0">
          {MARKS.map(pct => { const a = (powerToAngle(pct) * Math.PI) / 180; return <circle key={pct} cx={CX + MARK_RADIUS * Math.sin(a)} cy={CY - MARK_RADIUS * Math.cos(a)} r={1.39} fill={markFill(pct)} />; })}
          {(status === "dragging" || status === "saving") && <circle cx={CX} cy={CY} r={RING_RADIUS} stroke={v("special")} strokeWidth={3} fill="none" />}
          <circle cx={CX} cy={CY} r={BODY_RADIUS} fill={v("display")} />
          <circle cx={CX} cy={CY} r={BODY_RING_RADIUS} stroke={v("surface")} strokeWidth={2.5} fill="none" />
          {indicator != null && <line x1={CX} y1={CY} x2={CX + INDICATOR * Math.sin(indicator)} y2={CY - INDICATOR * Math.cos(indicator)} stroke={v("surface")} strokeWidth={1.3} strokeLinecap="round" />}
          <text x={16} y={117} textAnchor="middle" className="font-label" fontSize={14} fill={v("display")}>0</text>
          <text x={58} y={14} textAnchor="middle" className="font-label" fontSize={14} fill={v("display")}>50</text>
          <text x={100} y={117} textAnchor="middle" className="font-label" fontSize={14} fill={v("display")}>100</text>
        </svg>
      </div>
      <span id="dimmer-hint" className="sr-only">Registro do ajuste do seu controlador. Não comanda o exaustor.</span>
      <p className="text-base leading-[19px] font-black text-display" aria-hidden>{shown == null || !enabled ? "—" : `${shown}%`}</p>
      {status === "error" && failed != null
        ? <button type="button" onClick={() => void save(failed)} className="font-label text-center text-sm leading-4 text-error underline cursor-pointer">{caption}</button>
        : <p role="status" className="font-label text-center text-sm leading-4 text-display">{caption}</p>}
    </div>
  );
}
