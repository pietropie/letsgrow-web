"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Notice } from "@/components/ui";
import { PanelTag } from "./instruments";
import {
  DAY, MIN_GAP, PRESETS, angleToMinute, atClock, clockDigits, durationLabel, formatClock, isLit, minuteToAngle, moveHandle, nearestHandle,
  offMinute, parseClock, photoperiodText, presetFor, scheduleSummary, shiftSchedule, snapMinute, type Handle,
} from "@/shared/lib/lightSchedule";

/**
 * "Programação de luz" do formulário de Iluminação (Figma 02C J–J5). Portado de
 * letsgrow-mobile/components/grows/LightScheduleClock.tsx; a geometria e as regras vêm de lib/lightSchedule.
 */

const v = (name: string) => `var(--color-${name})`;
const SIZE = 264, C = SIZE / 2, OUTER = 128, INNER = 82, ARC = 74.4, HANDLE = 14, HANDLE_DRAG = 18, CENTER = 50;
/** Um toque a até 24 px de uma alça a pega. O arco aceso é pego no traço, e no toque só depois de segurar. */
const GRAB = 24, ARC_GRAB = 14, ARC_HOLD_MS = 250, TAP_SLOP = 6;

const point = (minute: number, r: number) => { const a = (minuteToAngle(minute) * Math.PI) / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)] as const; };
const arcPath = (from: number, light: number) => {
  const [x1, y1] = point(from, ARC), [x2, y2] = point(from + light, ARC);
  return `M${x1} ${y1} A${ARC} ${ARC} 0 ${light > DAY / 2 ? 1 : 0} 1 ${x2} ${y2}`;
};

type Drag = { kind: Handle | "arc"; startOn: number; grab: number; last: number };
type Press = { id: number; x: number; y: number; kind: Handle | "arc" | null; at: number; dragging: boolean };

/**
 * Relógio de 24 h com as alças "liga" e "desliga": o arrasto anda em passos de 15 min e passa pela meia-noite;
 * arrastar o arco aceso move as duas. Um toque sem arrasto põe a alça mais próxima ali. Oculto para leitores de
 * tela: as linhas abaixo são os controles acessíveis.
 */
function LightScheduleClock({ onAt, light, onChange }: { onAt: number | null; light: number | null; onChange: (onAt: number | null, light: number | null) => void }) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<Press | null>(null);
  const cur = useRef({ onAt, light });
  useEffect(() => { cur.current = { onAt, light }; }, [onAt, light]);
  const full = light != null && light >= DAY;
  const hasArc = onAt != null && light != null;
  const off = hasArc && !full ? offMinute(onAt, light) : null;

  const local = (e: PointerEvent<SVGSVGElement>) => { const b = e.currentTarget.getBoundingClientRect(); return [(e.clientX - b.left) * SIZE / b.width, (e.clientY - b.top) * SIZE / b.height] as const; };
  const minuteAt = (x: number, y: number) => angleToMinute((Math.atan2(x - C, C - y) * 180) / Math.PI);
  const apply = (next: { on: number | null; light: number | null }) => {
    if (next.on === cur.current.onAt && next.light === cur.current.light) return;
    cur.current = { onAt: next.on, light: next.light };
    onChange(next.on, next.light);
  };
  const hit = (x: number, y: number): Handle | "arc" | null => {
    const { onAt: on, light: lit } = cur.current;
    if (on == null) return null;
    const near = (m: number) => { const [hx, hy] = point(m, ARC); return Math.hypot(x - hx, y - hy) <= GRAB; };
    const ring = Math.abs(Math.hypot(x - C, y - C) - ARC) <= ARC_GRAB;
    if (near(on)) return "on";
    if (lit != null && lit >= DAY) return ring ? "on" : null;
    if (lit != null && near((on + lit) % DAY)) return "off";
    if (lit != null && ring && isLit(minuteAt(x, y), on, lit)) return "arc";
    return null;
  };
  const startDrag = (kind: Handle | "arc", x: number, y: number) => {
    const { onAt: on, light: lit } = cur.current;
    if (on == null) return;
    const d: Drag = { kind, startOn: on, grab: minuteAt(x, y), last: kind === "off" && lit != null ? offMinute(on, lit) : on };
    dragRef.current = d; setDrag(d);
  };

  function down(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const [x, y] = local(e);
    if (Math.hypot(x - C, y - C) > OUTER) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const kind = hit(x, y);
    press.current = { id: e.pointerId, x, y, kind, at: Date.now(), dragging: false };
    // Alças pegam na hora; o arco no mouse também, e no toque só depois de segurar.
    if (kind === "on" || kind === "off" || (kind === "arc" && e.pointerType !== "touch")) { press.current.dragging = true; startDrag(kind, x, y); }
  }
  function moveTo(e: PointerEvent<SVGSVGElement>) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const [x, y] = local(e);
    if (!p.dragging) {
      if (p.kind === "arc" && Date.now() - p.at >= ARC_HOLD_MS) { p.dragging = true; startDrag("arc", p.x, p.y); }
      else return;
    }
    const d = dragRef.current;
    if (!d) return;
    const raw = minuteAt(x, y), m = snapMinute(raw);
    const { onAt: on, light: lit } = cur.current;
    if (d.kind === "arc") apply({ on: shiftSchedule(d.startOn, d.grab, raw), light: lit });
    else if (on == null || lit == null || lit >= DAY) apply({ on: m, light: lit });
    else if (m !== d.last) apply(moveHandle(d.kind, m, on, lit));
    d.last = m;
  }
  function up(e: PointerEvent<SVGSVGElement>, cancelled = false) {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    const wasDragging = p.dragging;
    dragRef.current = null; setDrag(null);
    if (wasDragging || cancelled) return;
    // Toque: sem arco (ou 24/0) põe a alça "liga"; na parte escura traz a alça mais próxima.
    const [x, y] = local(e);
    if (Math.hypot(x - p.x, y - p.y) > TAP_SLOP) return;
    const raw = minuteAt(x, y), m = snapMinute(raw);
    const { onAt: on, light: lit } = cur.current;
    if (on == null || lit == null || lit >= DAY) apply({ on: m, light: lit });
    else if (!isLit(raw, on, lit)) apply(moveHandle(nearestHandle(raw, on, lit), m, on, lit));
  }

  const handle = (kind: Handle, minute: number) => {
    const [x, y] = point(minute, ARC);
    const active = drag?.kind === kind || drag?.kind === "arc";
    const r = active ? HANDLE_DRAG : HANDLE;
    return (
      <g key={kind}>
        {active && <circle cx={x} cy={y} r={r + 4} stroke={v("special")} strokeWidth={2.5} fill="none" />}
        {kind === "on"
          ? <><circle cx={x} cy={y} r={r} fill={v("display")} /><circle cx={x} cy={y} r={5} fill={v("state-alert")} /></>
          : <><circle cx={x} cy={y} r={r} fill={v("surface")} stroke={v("display")} strokeWidth={2} /><circle cx={x} cy={y} r={4} fill={v("display")} /></>}
      </g>
    );
  };

  return (
    <div role="img" aria-label={scheduleSummary(onAt, light)} className="flex justify-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="max-w-full touch-none select-none"
        onPointerDown={down} onPointerMove={moveTo} onPointerUp={e => up(e)} onPointerCancel={e => up(e, true)}>
        <circle cx={C} cy={C} r={OUTER} stroke={v("display")} strokeWidth={2} fill="none" />
        <circle cx={C} cy={C} r={INNER} stroke={v("display")} strokeWidth={1} fill="none" />
        {Array.from({ length: 48 }, (_, i) => { const major = i % 2 === 0; const [x1, y1] = point(i * 30, INNER); const [x2, y2] = point(i * 30, major ? 91 : 87.5); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={v("display")} strokeWidth={major ? 1.5 : 0.75} />; })}
        {drag && <circle cx={C} cy={C} r={ARC} stroke={v("special")} strokeWidth={1.5} strokeDasharray="4 4" fill="none" />}
        {full ? <circle cx={C} cy={C} r={ARC} stroke={v("display")} strokeWidth={15} fill="none" /> : hasArc && <path d={arcPath(onAt, light)} stroke={v("display")} strokeWidth={15} fill="none" />}
        <circle cx={C} cy={C} r={CENTER} fill={hasArc || full ? v("state-alert") : v("stroke-soft")} stroke={v("display")} strokeWidth={1} />
        {onAt != null && handle("on", onAt)}
        {off != null && handle("off", off)}
        {([["0", 0], ["6", 360], ["12", 720], ["18", 1080]] as const).map(([label, m]) => { const [x, y] = point(m, 112); return <text key={label} x={x} y={y + 6} textAnchor="middle" className="font-label" fontSize={16} fill={v("display")}>{label}</text>; })}
        {light != null && (hasArc || full)
          ? <><text x={C} y={C + 4} textAnchor="middle" className="font-label" fontSize={28} fill={v("display")}>{durationLabel(light)}</text>
              <text x={C} y={C + 22} textAnchor="middle" className="font-label" fontSize={11} fill={v("display")}>{full ? "de luz · sem escuro" : `de luz · ${durationLabel(DAY - light)} escuro`}</text></>
          : <><text x={C} y={C + 4} textAnchor="middle" className="font-label" fontSize={28} fill={v("display")}>--</text>
              <text x={C} y={C + 22} textAnchor="middle" className="font-label" fontSize={11} fill={v("display")}>defina os horários</text></>}
      </svg>
    </div>
  );
}

/** Segurar repete: 1 min por passo e 5 min depois de 1 s (spec "Ajuste fino"). */
function useRepeat(step: (delta: number) => void) {
  const t = useRef<{ start?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval>; at: number }>({ at: 0 });
  const stop = () => { clearTimeout(t.current.start); clearInterval(t.current.tick); };
  useEffect(() => stop, []);
  const start = (sign: 1 | -1) => {
    stop(); step(sign); t.current.at = Date.now();
    t.current.start = setTimeout(() => { t.current.tick = setInterval(() => step(sign * (Date.now() - t.current.at >= 1000 ? 5 : 1)), 120); }, 400);
  };
  return { start, stop };
}

const box = "flex h-12 w-24 items-center justify-center rounded-lg border border-input-border bg-surface font-label text-[22px] leading-[26px] text-display";
const stepBtn = "flex h-12 w-12 items-center justify-center rounded-lg border border-input-border bg-surface text-[22px] font-semibold text-display active:opacity-80 disabled:opacity-40 cursor-pointer touch-manipulation select-none";

function TimeRow({ kind, minute, onStep, onType, disabled = false }: { kind: Handle; minute: number | null; onStep: (delta: number) => void; onType: (minute: number) => string | null; disabled?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");
  const repeat = useRepeat(onStep);
  const name = kind === "on" ? "Liga" : "Desliga";
  const verb = kind === "on" ? "liga" : "desliga";
  const submit = () => {
    if (!digits) { setEditing(false); setError(""); return; }
    // "634" → 06:34, "6" → 06:00.
    const full4 = digits.length <= 2 ? digits.padStart(2, "0") + "00" : digits.padStart(4, "0");
    const parsed = parseClock(clockDigits(full4));
    if (parsed == null) { setError("Use o formato HH:MM, por exemplo 06:30."); return; }
    const problem = onType(parsed);
    if (problem) { setError(problem); return; }
    setEditing(false); setError(""); setDigits("");
  };
  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-2.5 ${disabled ? "opacity-50" : ""}`} role="group" aria-label={`${name}: ${minute == null ? "não definido" : atClock(minute)}`}>
        <svg width={22} height={22} aria-hidden>{kind === "on"
          ? <><circle cx={11} cy={11} r={10} fill={v("display")} /><circle cx={11} cy={11} r={4} fill={v("state-alert")} /></>
          : <><circle cx={11} cy={11} r={9.5} fill={v("surface")} stroke={v("display")} strokeWidth={1.5} /><circle cx={11} cy={11} r={3} fill={v("display")} /></>}</svg>
        <span className="flex-1 text-base leading-6 font-semibold">{name}</span>
        {editing
          ? <input autoFocus inputMode="numeric" maxLength={5} value={clockDigits(digits)} placeholder="HH:MM" aria-label={`Hora em que a luz ${verb}, HH:MM`}
              onChange={e => setDigits(e.target.value.replace(/\D/g, "").slice(0, 4))} onBlur={submit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") { setEditing(false); setError(""); } }}
              className={`${box} border-2 border-primary text-center outline-none`} />
          : <button type="button" disabled={disabled} onClick={() => { setDigits(""); setEditing(true); }} aria-label={`Digitar a hora em que a luz ${verb}`} className={`${box} cursor-pointer`}>
              {minute == null ? "--:--" : formatClock(minute)}
            </button>}
        <button type="button" aria-label="Menos 1 minuto" disabled={disabled} className={stepBtn}
          onPointerDown={() => repeat.start(-1)} onPointerUp={repeat.stop} onPointerLeave={repeat.stop} onPointerCancel={repeat.stop}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStep(-1); } }}>−</button>
        <button type="button" aria-label="Mais 1 minuto" disabled={disabled} className={stepBtn}
          onPointerDown={() => repeat.start(1)} onPointerUp={repeat.stop} onPointerLeave={repeat.stop} onPointerCancel={repeat.stop}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStep(1); } }}>+</button>
      </div>
      {!!error && <p role="alert" className="text-sm leading-5 text-error">{error}</p>}
    </div>
  );
}

export function LightScheduleField({ onAt, light, incomplete, onChange, onClear, clearing = false, clearError, cleared = false }: {
  onAt: number | null; light: number | null; incomplete: boolean; onChange: (onAt: number | null, light: number | null) => void;
  onClear?: () => void; clearing?: boolean; clearError?: string; cleared?: boolean;
}) {
  const full = light != null && light >= DAY;
  const preset = presetFor(light);
  const off = onAt != null && light != null && !full ? offMinute(onAt, light) : null;
  const mod = (n: number) => ((n % DAY) + DAY) % DAY;
  const clamp = (n: number) => Math.min(DAY - MIN_GAP, Math.max(MIN_GAP, n));
  // Mover o liga mantém a duração; mover o desliga muda a duração.
  const stepOn = (delta: number) => onChange(mod((onAt ?? 0) + delta), light);
  const stepOff = (delta: number) => { if (onAt != null) onChange(onAt, clamp((light ?? MIN_GAP) + delta)); };
  const typeOff = (minute: number) => {
    if (onAt == null) return "Defina antes a hora em que a luz liga.";
    const next = mod(minute - onAt);
    if (next < MIN_GAP || next > DAY - MIN_GAP) return "Deixe pelo menos 15 minutos entre ligar e desligar.";
    onChange(onAt, next); return null;
  };
  const empty = onAt == null && light == null;
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm leading-5 font-semibold text-text">Programação de luz</legend>
      {cleared && empty && <div aria-live="polite"><Notice title="Programação removida" body="O timer do painel mostra “Sem programação”. Escolha um atalho ou mova as alças quando quiser cadastrar de novo." meta="Salvo agora · os outros campos continuam como estavam." /></div>}
      {incomplete && light == null && <p className="rounded-lg bg-state-alert p-2.5 text-sm leading-5 text-display">Programação incompleta: ela estava como “personalizada”, sem horários. Defina quando a luz liga e desliga, como no seu timer.</p>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Atalhos de programação">
        {PRESETS.map(p => {
          const on = preset?.label === p.label;
          return <button key={p.label} type="button" role="radio" aria-checked={on} onClick={() => onChange(onAt, p.minutes)}
            className={`min-h-11 min-w-16 rounded-full border px-3.5 text-base cursor-pointer ${on ? "border-primary bg-primary text-white" : "border-input-border bg-surface text-text hover:bg-surface-high"}`}>{p.label}</button>;
        })}
      </div>
      {/* Espaço reservado: a etiqueta surge no meio do arrasto e não pode empurrar o relógio sob o dedo. */}
      <div className="flex min-h-5">{light != null && !preset && <PanelTag tone="stable" label={`PERSONALIZADA · ${photoperiodText(light)}`} />}</div>
      <LightScheduleClock onAt={onAt} light={light} onChange={onChange} />
      <TimeRow kind="on" minute={onAt} onStep={stepOn} onType={m => { onChange(m, light); return null; }} />
      {!full && <TimeRow kind="off" minute={off} onStep={stepOff} onType={typeOff} disabled={onAt == null} />}
      <p className="text-sm leading-5 text-text-muted">{full ? "Com 24/0 a luz não desliga." : "Arraste em passos de 15 min; passa livre pela meia-noite. Use − e + para o minuto exato, ou toque na hora para digitar."}</p>
      {onClear && <button type="button" onClick={onClear} disabled={clearing} className="min-h-11 self-start text-base font-semibold text-state-error cursor-pointer disabled:opacity-50">{clearing ? "Limpando…" : "Limpar programação"}</button>}
      {!!clearError && <p role="alert" className="text-sm leading-5 text-error">{clearError}</p>}
    </fieldset>
  );
}
