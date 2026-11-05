"use client";

import Link from "next/link";
import { SegmentedDisplay } from "@/components/home/blocks";
import { Button, ButtonLink } from "@/components/ui";
import { routes } from "@/lib/routes";
import { compactView, meterView, type Tone, type Usage } from "@/lib/usage";

const SEGMENTS = 24, SWEEP = 240, START = 150;
const ARC_COLOR: Record<Tone, string> = { normal: "var(--color-display)", alert: "var(--color-display)", error: "var(--color-state-error)" };
const TAG: Record<"alert" | "error" | "calm", string> = { alert: "bg-state-alert", error: "bg-state-error", calm: "bg-source-highlight" };

/** Arco de 24 segmentos em 240°, no estilo das marcas do timer da luz: o usado escuro (ou vermelho esgotado), o resto cinza. */
function Arc({ used, tone }: { used: number; tone: Tone }) {
  const filled = Math.round(used * SEGMENTS);
  return (
    <svg aria-hidden viewBox="0 0 156 136" className="absolute inset-0 h-full w-full">
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const a = ((START + (i * SWEEP) / (SEGMENTS - 1)) * Math.PI) / 180;
        const cx = 78, cy = 72, r1 = 56, r2 = 72;
        return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
          stroke={i < filled ? ARC_COLOR[tone] : "var(--color-border)"} strokeWidth={6} strokeLinecap="round" />;
      })}
    </svg>
  );
}

/**
 * O mostrador completo (Figma U1–U9; Conta › Créditos e plano, web W24): o restante no centro, os números ao lado.
 * O que é lido em voz alta é uma frase só, com o restante, o usado e o total.
 */
export function UsageMeter({ usage, packs = false }: { usage: Usage; packs?: boolean }) {
  const v = meterView(usage, packs);
  if (!v) return null;
  const hrefOf = (to: "plans" | "packs") => (to === "plans" ? routes.plans() : routes.packs());
  const labelOf = (to: "plans" | "packs") => (to === "plans" ? "Ver planos" : "Comprar créditos");
  const spoken = v.center == null ? v.title.toLowerCase() : `${v.center} ${v.centerCaption.toLowerCase()}${v.stats.length ? `. ${v.stats.map(s => `${s.label.toLowerCase()} ${s.value}`).join(", ")}` : ""}`;
  return (
    <section aria-label="Uso do Bobby" className="flex flex-col gap-3 rounded-2xl border-[0.5px] border-stroke bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-label text-sm leading-[18px] text-text-secondary">{v.title}</h2>
        {v.tag && <span className={`font-label px-1.5 text-[13px] leading-4 text-display ${TAG[v.tag.tone]}`}>{v.tag.label}</span>}
      </div>
      {v.center != null && <div className="flex items-center gap-4">
        <div role="img" aria-label={spoken} className={`relative flex shrink-0 flex-col items-center justify-center ${v.arc ? "h-[136px] w-[156px]" : "items-start"}`}>
          {v.arc && <Arc used={v.arc.used} tone={v.arc.tone} />}
          <span className="relative"><SegmentedDisplay size={v.arc && String(v.center).length < 3 ? "large" : "small"} value={v.center} unit="" spoken="" /></span>
          <span className={`font-label relative pt-1 text-xs leading-4 text-text-secondary ${v.arc ? "text-center" : ""}`}>{v.centerCaption}</span>
        </div>
        {!!v.stats.length && (
          <dl aria-hidden className="flex flex-col gap-1.5">
            {v.stats.map(s => <div key={s.label}><dt className="font-label text-xs leading-4 text-text-secondary">{s.label}</dt><dd className="text-lg leading-6 font-semibold text-text-primary">{s.value}</dd></div>)}
          </dl>
        )}
      </div>}
      {v.note &&<p className="text-[15px] leading-[21px] text-text">{v.note}</p>}
      {v.primary && <ButtonLink label={labelOf(v.primary)} href={hrefOf(v.primary)} />}
      {v.secondary && <ButtonLink secondary label={labelOf(v.secondary)} href={hrefOf(v.secondary)} />}
      <Link href={v.link.to === "plans" ? routes.plans() : routes.creditLog()} className="flex min-h-11 items-center justify-between text-[15px] font-semibold text-text-primary hover:underline">
        {v.link.label}<span aria-hidden>›</span>
      </Link>
    </section>
  );
}

/** U10: a API não respondeu. Nenhum número é mostrado. */
export function UsageError({ onRetry }: { onRetry: () => void }) {
  return (
    <section aria-label="Uso do Bobby" className="flex flex-col gap-3 rounded-2xl border-[0.5px] border-stroke bg-surface p-4">
      <h2 className="font-label text-sm leading-[18px] text-text-secondary">BOBBY · USO DO MÊS</h2>
      <p className="text-[15px] leading-[21px] text-text">Não foi possível carregar seu uso agora. Nenhum número é mostrado até a API responder.</p>
      <Button secondary label="Tentar de novo" onClick={onRetry} />
    </section>
  );
}

const PILL: Record<Tone, string> = { normal: "bg-surface border-stroke", alert: "bg-state-alert border-state-alert", error: "bg-surface border-stroke" };
const BAR: Record<Tone, string> = { normal: "var(--color-display)", alert: "var(--color-display)", error: "var(--color-state-error)" };

/** A pílula do Bobby (C1–C5): barra de 10 segmentos e o texto; toque abre Créditos e plano. Some no plano sem limite. */
export function UsageCompact({ usage }: { usage: Usage }) {
  const v = compactView(usage);
  if (!v) return null;
  const filled = v.bar == null ? 0 : Math.round(v.bar * 10);
  return (
    <Link href={routes.credits()} aria-label={v.label}
      className={`inline-flex min-h-11 max-w-full items-center gap-2 self-start rounded-full border px-3 text-[13px] leading-[18px] text-text-primary hover:opacity-90 ${PILL[v.tone]}`}>
      {v.bar != null && <span aria-hidden className="flex shrink-0 gap-[2px]">{Array.from({ length: 10 }, (_, i) => <span key={i} className="h-3 w-[3px] rounded-[1px]" style={{ background: i < filled ? BAR[v.tone] : "var(--color-border)" }} />)}</span>}
      <span className="truncate">{v.text}</span><span aria-hidden>›</span>
    </Link>
  );
}
