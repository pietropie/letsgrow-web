"use client";

/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";
import { Lamp, Marker, PanelLabel, type MarkerTone } from "@/components/panel";
import { RANGE_TEXT, ago, clock, outSinceText, rangeLine, rounded, type MetricState, type ViewCard, type ViewHistory, type ViewHub, type ViewMetric } from "@/lib/sensor-cards";

/**
 * Peças dos sensores (Figma 28 · SN1–SN3, W10p): mostrador com a unidade fora das casas, a foto do sensor (sem foto do
 * modelo, o ícone do tipo num quadro tracejado), o cartão do Hub e o cartão de cada sensor.
 */

export const STATE_TONE: Record<MetricState, MarkerTone> = { ok: "plain", near: "light", out: "out", none: "plain" };

function digitsOf(value: number | null, decimals: number): string[] {
  if (value == null || !Number.isFinite(value)) return ["–", "–", "–"];
  return [...new Intl.NumberFormat("pt-BR", { useGrouping: false, maximumFractionDigits: decimals }).format(rounded(value, decimals))];
}

/** Mostrador em casas (a vírgula ganha uma casa estreita) e a unidade em texto ao lado. */
export function Digits({ value, decimals = 0, unit, suffix = "", size = "large", faded = false, label }: { value: number | null; decimals?: number; unit: string; suffix?: string; size?: "large" | "small"; faded?: boolean; label: string }) {
  const cells = [...digitsOf(value, decimals), ...(value == null ? [] : [...suffix])];
  const spoken = value == null ? `${label}: sem leitura` : `${label}: ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(rounded(value, decimals))}${suffix ? " mil" : ""} ${unit}`;
  const cell = size === "large" ? "min-w-9 h-12 text-[34px]" : "min-w-6 h-8 text-xl";
  return (
    <span role="img" aria-label={spoken} className="inline-flex items-end gap-1.5">
      <span className={`inline-flex gap-1 rounded-[10px] border-[1.5px] p-1 ${faded ? "border-stroke-soft" : "border-display"}`}>
        {cells.map((c, i) => (
          <span key={i} className={`flex items-center justify-center rounded-md font-black tabular-nums ${c === "," ? `min-w-3 px-0.5 text-base ${size === "large" ? "h-12" : "h-8"}` : cell} ${faded ? "border border-stroke-soft bg-surface text-stroke-soft" : "bg-display text-surface"}`}>{c}</span>
        ))}
      </span>
      {unit && <span className={`text-sm leading-5 ${faded ? "text-text-secondary" : "text-display"}`}>{unit}</span>}
    </span>
  );
}

/** A foto do modelo do sensor, ou o ícone do tipo num quadro tracejado. */
export function SensorPhoto({ icon, photoUrl = null, faded = false }: { icon: string; photoUrl?: string | null; faded?: boolean }) {
  return (
    <span aria-hidden className={`flex size-[60px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-input-border bg-bg ${faded ? "opacity-50" : ""}`}>
      {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : <img src={`/figma/${icon}.svg`} alt="" className="size-8" />}
    </span>
  );
}

function CardShell({ children, faded = false, strong = false, id }: { children: ReactNode; faded?: boolean; strong?: boolean; id?: string }) {
  return <section id={id} className={`flex scroll-mt-4 flex-col gap-3 rounded-2xl border bg-surface p-3.5 ${strong ? "border-[1.5px] border-display" : "border-stroke"} ${faded ? "text-text-secondary" : ""}`}>{children}</section>;
}

function Head({ icon, photoUrl, lamp, title, tags, about, right, faded }: { icon: string; photoUrl?: string | null; lamp: "ok" | "attention" | "none"; title: string; tags: string[]; about?: string; right?: ReactNode; faded?: boolean }) {
  return (
    <div className="flex gap-3 border-b border-stroke pb-3">
      <SensorPhoto icon={icon} photoUrl={photoUrl} faded={faded} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2"><Lamp state={lamp} /><h2 className={`font-label min-w-0 flex-1 truncate text-lg leading-6 ${faded ? "text-text-secondary" : "text-display"}`}>{title}</h2>{right}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">{tags.map(t => <span key={t} className="font-label text-xs leading-4 text-display uppercase">{t}</span>)}</div>
        {about && <p className="text-sm leading-5 text-text-secondary">{about}</p>}
      </div>
    </div>
  );
}

/** SN1/SN2a: o Hub. Online: última leitura e satélites; offline: desde quando e o que conferir. */
export function HubCard({ hub, now, children }: { hub: ViewHub; now: number; children?: ReactNode }) {
  const when = [clock(hub.lastAt), ago(hub.lastAt, now)].filter(Boolean).join(" · ") || "Sem leitura ainda";
  const since = hub.lastAt ? (ago(hub.lastAt, now)?.startsWith("há") ? clock(hub.lastAt) : ago(hub.lastAt, now)) : null;
  return (
    <CardShell strong>
      <Head icon="sensor-hub" photoUrl={hub.photoUrl} lamp={hub.online ? "ok" : "attention"} title={hub.name} tags={[hub.tag]} right={<Marker tone={hub.online ? "live" : "out"}>{hub.online ? "Online" : "Offline"}</Marker>} />
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <div className="flex flex-col gap-1"><PanelLabel>Última leitura</PanelLabel><Marker tone={hub.online ? "live" : "out"}>{when}</Marker></div>
        <div className="flex flex-col gap-1"><PanelLabel>Satélites</PanelLabel>
          <span className="flex items-center gap-2"><Digits value={hub.satellites} unit="" size="small" label="Satélites" /><span className="font-label text-xs leading-4 text-display uppercase">{!hub.satellites ? "nenhum ainda" : hub.online ? `${hub.satellitesOnline} online` : "sem sinal"}</span></span>
        </div>
      </div>
      {!hub.online && <p className="text-[15px] leading-[21px] text-text">{since ? `O Hub não manda dados desde ${since}. As leituras abaixo são as últimas que chegaram.` : "O Hub ainda não mandou dados."} Confira se ele está na tomada e se o Wi-Fi funciona.</p>}
      {children}
    </CardShell>
  );
}

/** Mini-histórico da medida principal: a última barra é a mais recente; as fora da faixa em rosa. */
function History({ history, metric }: { history: ViewHistory; metric: ViewMetric | undefined }) {
  const values = history.bars.map(b => b.value).filter((v): v is number => v != null);
  if (!values.length) return null;
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const n = (v: number | null) => v == null ? "—" : new Intl.NumberFormat("pt-BR", { maximumFractionDigits: metric?.decimals ?? 1 }).format(rounded(v, metric?.decimals ?? 1));
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 whitespace-nowrap"><PanelLabel>{history.window}</PanelLabel></span>
      <span aria-hidden className="flex h-7 items-end gap-[2px] border border-display px-1 py-0.5">
        {history.bars.map((b, i) => <span key={i} className={`w-1.5 ${b.value == null ? "h-px bg-stroke-soft" : b.state === "out" ? "bg-source-secondary" : "bg-stroke-soft"}`} style={b.value == null ? undefined : { height: `${30 + ((b.value - lo) / span) * 70}%` }} />)}
      </span>
      <span className="font-label ml-auto text-xs leading-4 text-display uppercase">Mín {n(history.min ?? lo)} · máx {n(history.max ?? hi)}</span>
    </div>
  );
}

/**
 * SN1/W10p e os estados de SN2: ao vivo; Hub offline (`stale`, a última leitura esmaecida); satélite sem sinal
 * (`no_signal`); aguardando a primeira leitura (`waiting`). `light` diz quando a programação acende a luz.
 */
export function SensorCard({ card, lightOn, lightWindow, now }: { card: ViewCard; lightOn: boolean | null; lightWindow?: string | null; now: number }) {
  const faded = card.status === "stale";
  const lamp = card.status !== "live" ? "none" : card.worst === "out" ? "attention" : "ok";
  const main = card.metrics.find(m => m.key === card.history?.metric) ?? card.metrics[0];
  const big = (m: ViewMetric) => m === main || (card.kind === "air" && m.key !== "vpd_kpa");
  const out = card.metrics.map(m => outSinceText(m, now)).find(Boolean);

  return (
    <CardShell faded={faded} id={`sensor-${card.deviceId}`}>
      <Head icon={card.icon} photoUrl={card.photoUrl} lamp={lamp} title={card.title} tags={card.tags} about={card.about} faded={faded} />
      {card.status === "waiting" || !card.metrics.length ? (
        <div className="flex flex-col gap-1.5">
          <Digits value={null} unit="" label={card.title} />
          <div className="flex flex-wrap gap-1.5"><Marker>Sem leitura</Marker><Marker>Aguardando a primeira leitura</Marker></div>
          <p className="text-sm leading-5 text-text">A primeira leitura chega em até 5 minutos.</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
          {card.metrics.map(m => {
            const silent = card.status === "no_signal";
            const lightOff = m.key === "lux" && lightOn === false;
            return (
              <div key={m.key} className="flex flex-col gap-1">
                <PanelLabel>{m.label}</PanelLabel>
                <Digits value={silent ? null : m.value} decimals={m.decimals} unit={m.unit} size={big(m) ? "large" : "small"} faded={faded} label={m.label} />
                {silent ? <Marker>Sem leitura</Marker>
                  : faded ? <Marker>Leitura antiga</Marker>
                  : m.state !== "none" ? <Marker tone={STATE_TONE[m.state]}>{RANGE_TEXT[m.state]}</Marker>
                  : lightOff ? <Marker>Luz apagada</Marker>
                  : m.computed ? <Marker>Calculado</Marker>
                  : null}
                {card.status === "live" && (rangeLine(m) || m.note) && <p className="text-sm leading-5 text-text-secondary">{[m.key === "lux" && lightOn != null ? (lightOn ? "luz acesa" : "luz apagada") : null, rangeLine(m), m.note].filter(Boolean).join(" · ")}</p>}
              </div>
            );
          })}
        </div>
      )}
      {card.status === "live" && card.history && <History history={card.history} metric={main} />}
      {card.kind === "light" && lightWindow && card.status === "live" && <span className="font-label text-xs leading-4 text-display uppercase">Acesa {lightWindow}</span>}
      {card.status === "live" && card.lastAt && <Marker tone="live">Sensor · {ago(card.lastAt, now)}</Marker>}
      {card.status === "live" && out && <p className="text-sm leading-5 text-text">{out}</p>}
      {faded && <Marker tone="out">Última leitura {card.lastAt ? ago(card.lastAt, now) : "ainda não chegou"}</Marker>}
      {card.status === "no_signal" && <>
        <Marker tone="out">Sem sinal {card.lastAt ? ago(card.lastAt, now) : ""}</Marker>
        <p className="text-sm leading-5 text-text">O satélite parou de responder. Confira a bateria ou aproxime do Hub (até 10 metros).</p>
      </>}
    </CardShell>
  );
}
