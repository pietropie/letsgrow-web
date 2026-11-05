/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import type { AttentionItem, CompareRow } from "@/shared/lib/homeClimate";
import { DAY, dialProgress, lightNow } from "@/shared/lib/lightSchedule";
import { formatMeasurementValue } from "@/shared/lib/measurements";

/**
 * Início 2026 (Figma H1–H9, desktop W1–W5): os blocos da tela. Portados de
 * letsgrow-mobile/components/home/HomeBlocks.tsx, com as mesmas medidas e textos. Mudou lá, mude aqui.
 */

/** Cartão do Início: elevated, borda 0,5, raio 16, 12/14/14. */
export function HomeCard({ children, tone, className = "" }: { children: ReactNode; tone?: "bobby"; className?: string }) {
  return <section className={`flex flex-col rounded-2xl border-[0.5px] border-stroke px-[14px] pt-3 pb-[14px] ${tone === "bobby" ? "bg-surface-bobby" : "bg-surface"} ${className}`}>{children}</section>;
}

export function CardHeader({ title, right }: { title: string; right?: ReactNode }) {
  return <div className="flex items-center gap-2"><h2 className="font-label flex-1 text-base leading-5 text-display">{title}</h2>{right}</div>;
}

type TagTone = "alert" | "calm" | "night" | "plain";
const TAG_BG: Record<TagTone, string> = { alert: "bg-state-alert", calm: "bg-source-highlight", night: "bg-state-night", plain: "bg-bg" };
export function Tag({ label, tone }: { label: string; tone: TagTone }) {
  return <span className={`font-label self-start px-1.5 py-0.5 text-[13px] leading-4 text-display ${TAG_BG[tone]}`}>{label}</span>;
}

const linkCls = "text-sm leading-[18px] font-semibold text-primary hover:underline cursor-pointer";
/** Link ou botão de texto; sem destino nem ação, não aparece. */
export function TextAction({ label, href, onClick }: { label: string; href?: string | null; onClick?: () => void }) {
  if (href) return <Link href={href} className={linkCls}>{label}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={linkCls}>{label}</button>;
  return null;
}

function SmallButton({ label, onClick, secondary }: { label: string; onClick: () => void; secondary?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-1 text-center text-[15px] leading-5 font-semibold cursor-pointer ${secondary ? "border border-input-border bg-surface text-text-primary hover:bg-surface-high" : "bg-primary text-surface hover:bg-primary-dark"}`}>
      {label}
    </button>
  );
}

/** Mostrador de segmentos (components/data/SegmentedDisplay do mobile). */
export function SegmentedDisplay({ value, unit, size = "large", label, spoken: said }: { value?: number | null; unit: string; size?: "large" | "small"; label?: string; spoken?: string }) {
  const formatted = formatMeasurementValue(value);
  const large = size === "large";
  const spoken = said ?? `${label ? `${label}: ` : ""}${formatted === "—" ? "não informado" : `${formatted} ${unit}`}`;
  return (
    <span role="img" aria-label={spoken} className="inline-flex max-w-full gap-0.5 self-start rounded-[10px] border border-display p-0.5">
      {[...formatted, unit].filter(Boolean).map((digit, i) => (
        <span key={i} className={`flex items-center justify-center rounded-lg bg-display px-1 font-black text-surface tabular-nums ${large ? "min-w-10 py-2 text-[40px] leading-8" : "min-w-7 py-1 text-[22px] leading-7"}`}>{digit}</span>
      ))}
    </span>
  );
}

/** H1 "Olá, Pietro · Ter, 27 de outubro" e o chip do ambiente quando há mais de um (W1: Bold 28 no desktop). */
export function HomeGreeting({ name, date, grow, onPickGrow }: { name: string | null; date: string; grow?: string | null; onPickGrow?: () => void }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl leading-[30px] font-bold text-text-primary md:text-[28px] md:leading-9">{name ? `Olá, ${name}` : "Olá"}</h1>
        <p className="text-sm leading-[18px] text-text-secondary">{date}</p>
      </div>
      {!!grow && onPickGrow && (
        <button type="button" onClick={onPickGrow} aria-label={`Ambiente: ${grow}. Trocar`}
          className="flex min-h-9 max-w-40 items-center gap-1.5 rounded-full border border-stroke bg-surface pr-2.5 pl-3 hover:border-input-border cursor-pointer">
          <span className="truncate text-sm leading-[18px] font-semibold text-text-primary">{grow}</span>
          <img src="/figma/chip-chevron.svg" alt="" />
        </button>
      )}
    </div>
  );
}

type Inside = { t: number | null; rh: number | null; tag: string | null };
/**
 * Um mostrador com o nome em cima, no rótulo dos blocos do painel (pedido do usuário em 2026-11-01: dois mostradores
 * soltos confundiam). Lido numa frase só, "Temperatura lá fora 22 graus"; o rótulo visual fica fora do leitor de tela.
 */
function Gauge({ kind, where, value, size }: { kind: "t" | "rh"; where: "lá fora" | "dentro"; value: number | null; size?: "small" }) {
  const name = kind === "t" ? "Temperatura" : "Umidade do ar";
  const amount = value == null ? "não informado" : `${value} ${kind === "t" ? "graus" : "por cento"}`;
  return (
    <span className="flex flex-col gap-1">
      <span aria-hidden className="font-label text-[13px] leading-4 text-text-secondary">{name.toUpperCase()}</span>
      <SegmentedDisplay size={size} value={value} unit={kind === "t" ? "°" : "%"} spoken={`${name} ${where} ${amount}`} />
    </span>
  );
}

export type ClimateProps = {
  state: "loading" | "ok" | "no_location" | "unavailable" | "not_found";
  growName: string; outdoor: boolean; place: string | null;
  weather?: { t: number; rh: number | null; icon: "day" | "night" | null; condition: string; line: string } | null;
  inside: Inside;
  compare: { temperature: CompareRow | null; humidity: CompareRow | null } | null;
  tip?: { title: string; text: string; basis: string } | null;
  footer: string;
  onLocate: () => void; onSearch: () => void; onChangePlace: () => void; onRetry: () => void;
  readingHref: string | null; askTipHref: string | null;
};

const COMPARE_TONE: Record<CompareRow["tone"], TagTone> = { cooler: "night", warmer: "alert", more: "calm", less: "night", same: "plain" };
const label = "font-label text-sm leading-[18px] text-text-secondary";
const note = "text-xs leading-4 text-text-secondary";
const hline = <div className="h-px bg-stroke" />;

/** "CLIMA AGORA": lá fora × dentro (H1), sem local (H2 / W4), clima indisponível ou sem leitura dentro (H5 / W5). */
export function ClimateCard(p: ClimateProps) {
  const title = p.outdoor ? "CLIMA AGORA · NO LOCAL" : "CLIMA AGORA";
  const place = p.place && (
    <button type="button" onClick={p.onChangePlace} aria-label={`Local: ${p.place}. Trocar`} className="flex max-w-[55%] items-center gap-1 hover:underline cursor-pointer">
      {p.state === "ok" && <img src="/figma/pin.svg" alt="" />}
      <span className="truncate text-[13px] leading-4 text-text-secondary">{p.place}</span>
    </button>
  );
  if (p.state === "loading") return <SkeletonCard />;
  if (p.state === "no_location") {
    return (
      <HomeCard className="gap-2.5">
        <CardHeader title={title} />
        <p className="text-[15px] leading-[21px] text-text-primary">Defina onde fica a {p.growName} para ver o clima lá fora e comparar com o ambiente.</p>
        <div className="flex gap-2"><SmallButton label="Usar minha localização" onClick={p.onLocate} /><SmallButton secondary label="Buscar cidade" onClick={p.onSearch} /></div>
        <p className={note}>Usamos só a cidade aproximada, uma vez. Não acompanhamos onde você está.</p>
      </HomeCard>
    );
  }
  const hasInside = p.inside.t != null || p.inside.rh != null;
  const insideDisplays = (
    <>
      <Gauge size="small" kind="t" where="dentro" value={p.inside.t == null ? null : Math.round(p.inside.t)} />
      <Gauge size="small" kind="rh" where="dentro" value={p.inside.rh == null ? null : Math.round(p.inside.rh)} />
      {!!p.inside.tag && <Tag tone="calm" label={p.inside.tag} />}
    </>
  );
  const insideTitle = <p className={label}>DENTRO · {p.growName.toUpperCase()}</p>;
  const noReading = !p.outdoor && !hasInside && (
    <div className="flex flex-col gap-1.5">{insideTitle}<p className="text-[15px] leading-[21px] text-text-primary">Sem leitura de temperatura e umidade.</p></div>
  );
  const registerReading = p.readingHref
    ? <Link href={p.readingHref} className="flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-primary text-[15px] font-semibold text-surface hover:bg-primary-dark">Registrar leitura</Link>
    : null;

  if (p.state !== "ok" || !p.weather) {
    return (
      <HomeCard className="gap-2.5">
        <CardHeader title={title} right={place} />
        <p className="text-[15px] leading-5 font-semibold text-text-primary">Não foi possível obter o clima agora.</p>
        <p className="text-[13px] leading-[18px] text-text-secondary">O serviço de clima não respondeu. Tentamos de novo em alguns minutos.</p>
        {!p.outdoor && hline}
        {!p.outdoor && hasInside ? <div className="flex flex-col gap-1.5">{insideTitle}<div className="flex flex-wrap items-center gap-2">{insideDisplays}</div></div> : noReading}
        <div className="flex gap-2">
          {!p.outdoor && !hasInside && registerReading}
          <SmallButton secondary={!p.outdoor && !hasInside && !!registerReading} label="Tentar de novo" onClick={p.onRetry} />
        </div>
      </HomeCard>
    );
  }
  const w = p.weather;
  return (
    <HomeCard className="gap-3">
      <CardHeader title={title} right={place} />
      <div className="flex gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className={label}>LÁ FORA</p>
          {/* Alinhados pela base; sem largura, a umidade desce para a linha de baixo com o próprio rótulo. */}
          <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
            <span className="flex items-end gap-2">
              {w.icon === "day" ? <img src="/figma/weather-partly-cloudy-day.svg" alt="" /> : w.icon === "night" ? <img src="/figma/moon-small.svg" alt="" width={28} height={28} className="m-1.5" /> : null}
              <Gauge kind="t" where="lá fora" value={w.t} />
            </span>
            {/* Pedido do usuário (2026-11-01): a umidade no mesmo mostrador da temperatura, com %. */}
            {w.rh != null && <Gauge kind="rh" where="lá fora" value={w.rh} />}
          </div>
          <p className="text-sm leading-[18px] font-semibold text-text-primary">{w.condition}</p>
          {!!w.line && <p className="text-[13px] leading-[18px] text-text-secondary">{w.line}</p>}
        </div>
        {!p.outdoor && hasInside && (
          <>
            <div className="w-px bg-stroke" />
            <div className="flex w-[118px] flex-col gap-1.5">{insideTitle}{insideDisplays}</div>
          </>
        )}
      </div>
      {noReading && <>{hline}{noReading}{registerReading && <div className="flex gap-2">{registerReading}</div>}</>}
      {!!p.compare && (p.compare.temperature || p.compare.humidity) && (
        <div className="flex flex-col gap-1.5 pt-2.5">
          {hline}
          {([["TEMPERATURA", p.compare.temperature], ["UMIDADE DO AR", p.compare.humidity]] as const).map(([name, row]) => row && (
            <div key={name} className="flex gap-2.5">
              <p className="font-label w-[98px] shrink-0 text-[13px] leading-[18px] text-text-secondary">{name}</p>
              <div className="flex flex-1 flex-col gap-1"><p className="text-sm leading-[18px] font-semibold text-text-primary">{row.text}</p><Tag tone={COMPARE_TONE[row.tone]} label={row.tag} /></div>
            </div>
          ))}
        </div>
      )}
      {!!p.tip && (
        <div className="flex flex-col gap-1.5 rounded-xl bg-surface-bobby px-3 py-2.5">
          <div className="flex items-center gap-2">
            <img src="/figma/bobby-calm.png" alt="" width={20} height={26} className="h-[26px] w-[19.65px] object-cover" />
            <p className="font-label flex-1 text-[13px] leading-4 text-display">DICA DO BOBBY</p>
          </div>
          <p className="text-[15px] leading-5 font-semibold text-text-primary">{p.tip.title}</p>
          <p className="text-sm leading-5 text-text-primary">{p.tip.text}</p>
          {!!p.tip.basis && <p className={note}>{p.tip.basis}</p>}
          <TextAction label="Perguntar ao Bobby sobre isso" href={p.askTipHref} />
        </div>
      )}
      <p className={note}>{p.footer}</p>
    </HomeCard>
  );
}

/** "PRECISA DE ATENÇÃO" com até 3 itens e o total; sem itens, uma linha. */
export function AttentionCard({ items, total, hrefOf }: { items: AttentionItem[]; total: number; hrefOf: (i: AttentionItem) => string | null }) {
  return (
    <HomeCard>
      <CardHeader title="PRECISA DE ATENÇÃO" right={total > 0 ? <Tag tone="alert" label={String(total)} /> : undefined} />
      {!items.length ? <p className="pt-2.5 text-[13px] leading-4 text-text-secondary">Nada pede atenção agora.</p> : items.map(item => {
        const href = hrefOf(item);
        const body = (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-text-primary">{item.title}</span>
              <span className="flex items-center gap-1.5"><Tag tone={item.tag === "BOBBY" ? "calm" : "alert"} label={item.tag} /><span className="truncate text-[13px] leading-4 text-text-secondary">{item.meta}</span></span>
            </span>
            {href && <img src="/figma/chevron-right-20.svg" alt="" />}
          </>
        );
        return (
          <div key={item.key}>
            {hline}
            {href
              ? <Link href={href} className="flex items-center gap-2.5 py-2.5 hover:bg-surface-high">{body}</Link>
              : <div className="flex items-center gap-2.5 py-2.5">{body}</div>}
          </div>
        );
      })}
    </HomeCard>
  );
}

/** Miniatura do timer de luz do painel (52 px) com o progresso 2c: luz que passou, luz que falta, agora. */
export function MiniLightDial({ onAt, light, minute }: { onAt: number | null; light: number | null; minute: number }) {
  const progress = dialProgress(onAt, light, minute), now = lightNow(onAt, light, minute);
  const c = 26, r = 20;
  const point = (m: number) => { const a = (m / DAY) * 2 * Math.PI - Math.PI / 2; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  const arc = (from: number, length: number) => { const [x1, y1] = point(from), [x2, y2] = point(from + length); return `M${x1} ${y1} A${r} ${r} 0 ${length > DAY / 2 ? 1 : 0} 1 ${x2} ${y2}`; };
  const [nx, ny] = point(progress.kind === "none" ? 0 : progress.now);
  const center = now === "on" ? "var(--color-state-alert)" : now === "off" ? "var(--color-state-night)" : "var(--color-stroke-soft)";
  const display = "var(--color-display)";
  return (
    <svg width={52} height={52} aria-hidden className="shrink-0">
      <circle cx={c} cy={c} r={25} stroke={display} strokeWidth={1} fill="none" />
      {progress.kind === "cycle" && progress.remaining > 0 && <path d={arc(progress.on + progress.elapsed, progress.remaining)} stroke="var(--color-stroke-soft)" strokeWidth={6} strokeLinecap="round" fill="none" />}
      {progress.kind === "cycle" && progress.elapsed > 0 && <path d={arc(progress.on, progress.elapsed)} stroke={display} strokeWidth={6} fill="none" />}
      {progress.kind === "full" && <circle cx={c} cy={c} r={r} stroke={display} strokeWidth={6} fill="none" />}
      {progress.kind !== "none" && <circle cx={nx} cy={ny} r={4} fill="var(--color-surface)" stroke={display} strokeWidth={1.5} />}
      <circle cx={c} cy={c} r={11} fill={center} stroke={display} strokeWidth={1} />
    </svg>
  );
}

export type Indicator = { value: number | null; unit: "°" | "%"; caption: string };
const tileLabel = "font-label text-[13px] leading-4 text-text-secondary";
const tileCaption = "text-xs leading-4 text-text-secondary";

/** "AMBIENTE · SALA": temperatura, umidade, VPD e luz em grade, e o exaustor. W1: três por linha no desktop. */
export function EnvironmentMini(p: {
  growName: string; panelHref: string | null;
  temperature: Indicator; humidity: Indicator;
  vpd: { text: string; caption: string };
  light: { header: string; state: string; sub: string; caption: string; onAt: number | null; minutes: number | null; minute: number };
  exhaust: { value: string; caption: string } | null;
}) {
  const tile = (name: string, body: ReactNode, caption: string) => (
    <div className="flex min-w-[140px] flex-1 basis-[47%] flex-col gap-1 rounded-xl border-[0.5px] border-stroke px-2.5 py-2 lg:basis-[30%]" aria-label={`${name}: ${caption}`} role="group">
      <p className={tileLabel}>{name}</p>{body}<p className={tileCaption}>{caption}</p>
    </div>
  );
  return (
    <HomeCard className="gap-2.5">
      <CardHeader title={`AMBIENTE · ${p.growName.toUpperCase()}`} right={<TextAction label="Abrir painel" href={p.panelHref} />} />
      <div className="flex flex-wrap gap-2">
        {tile("TEMPERATURA", <SegmentedDisplay size="small" unit="°" value={p.temperature.value} label="Temperatura" />, p.temperature.caption)}
        {tile("UMIDADE", <SegmentedDisplay size="small" unit="%" value={p.humidity.value} label="Umidade" />, p.humidity.caption)}
        {tile("VPD", <p className="text-2xl leading-[30px] font-bold text-text-primary">{p.vpd.text}</p>, p.vpd.caption)}
        {tile(p.light.header, (
          <div className="flex items-center gap-2">
            <MiniLightDial onAt={p.light.onAt} light={p.light.minutes} minute={p.light.minute} />
            <div><p className="text-sm leading-[18px] font-semibold text-text-primary">{p.light.state}</p>{!!p.light.sub && <p className={tileCaption}>{p.light.sub}</p>}</div>
          </div>
        ), p.light.caption)}
      </div>
      {!!p.exhaust && <div className="flex items-center gap-1.5"><p className={tileLabel}>EXAUSTOR</p><p className="text-sm leading-[18px] font-semibold text-text-primary">{p.exhaust.value}</p><p className={tileCaption}>· {p.exhaust.caption}</p></div>}
    </HomeCard>
  );
}

/** Cartão de planta de 204: foto 48, ícone da fase, nome, "Vegetativo · dia 22" e o último registro. */
export function HomePlantCard({ name, photo, phase, phaseLine, last, href }: { name: string; photo: string; phase: { icon: string; label: string } | null; phaseLine: string; last: string | null; href: string | null }) {
  const body = (
    <>
      <span className="flex items-center gap-2">
        <img src={photo} alt="" width={48} height={48} className="h-12 w-12 rounded-[10px] object-contain" />
        {phase && <span className="flex flex-col items-center" aria-hidden><img src={phase.icon} alt="" width={21} height={27} /><span className="text-[7.5px] leading-[9px] text-display">{phase.label}</span></span>}
      </span>
      <span className="font-label truncate text-lg leading-[22px] text-display">{name}</span>
      <span className="truncate text-sm leading-[18px] font-semibold text-text-primary">{phaseLine}</span>
      {!!last && <span className="truncate text-[13px] leading-4 text-text-secondary">{last}</span>}
    </>
  );
  const cls = "flex w-[204px] shrink-0 snap-start flex-col gap-1.5 rounded-2xl border-[0.5px] border-stroke bg-surface px-[14px] pt-3 pb-[14px]";
  return href
    ? <Link href={href} aria-label={[name, phaseLine, last].filter(Boolean).join(", ")} className={`${cls} hover:border-input-border`}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

/** Cabeçalho "SUAS PLANTAS" com "Ver calendário". */
export function SectionHeader({ title, action, href }: { title: string; action?: string; href?: string | null }) {
  return <div className="flex items-center gap-2"><h2 className="font-label flex-1 text-base leading-5 text-display">{title}</h2>{action && <TextAction label={action} href={href} />}</div>;
}

/** "RESUMO DO BOBBY" (resumo diário) em surface/bobby, com "Perguntar ao Bobby" e a linha de uso. */
export function BobbyBrief({ title, body, footer, askHref }: { title: string; body?: string | null; footer: string; askHref: string | null }) {
  return (
    <HomeCard tone="bobby" className="gap-2">
      <div className="flex items-center gap-2.5">
        <img src="/figma/bobby-calm.png" alt="" width={30} height={40} className="h-10 w-[30.24px] object-cover" />
        <div className="flex-1">
          <h2 className="font-label text-sm leading-[18px] text-display">RESUMO DO BOBBY</h2>
          <p className="text-[15px] leading-5 font-semibold text-text-primary">{title}</p>
          {!!body && <p className="text-sm leading-5 text-text-primary">{body}</p>}
        </div>
      </div>
      {askHref && <Link href={askHref} className="flex min-h-11 items-center justify-center rounded-[10px] bg-primary text-[15px] font-semibold text-surface hover:bg-primary-dark">Perguntar ao Bobby</Link>}
      {!!footer && <p className={note}>{footer}</p>}
    </HomeCard>
  );
}

/** H6: esqueletos com a forma dos cartões; a saudação aparece na hora. */
export function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div role="status" aria-label="Carregando" className="flex flex-col gap-2.5 rounded-2xl border-[0.5px] border-stroke bg-surface px-[14px] pt-3 pb-[14px]">
      <div className="h-3.5 w-[45%] animate-pulse rounded-full bg-bg" />
      <div className={`animate-pulse rounded-[10px] bg-bg ${tall ? "h-[120px]" : "h-[60px]"}`} />
      <div className="h-3.5 w-[70%] animate-pulse rounded-full bg-bg" />
    </div>
  );
}
