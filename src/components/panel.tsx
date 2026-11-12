import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Painel · componentes v2 (UX item 23; Figma 2416:529, regras 2416:534): as peças do "painel retrô futurista
 * brutalista". Regras: leitura medida em mostrador; toda leitura diz de onde veio; cor é sinal (cinza por padrão,
 * amarelo luz e próxima ação, rosa fora da faixa ou no limite, verde só sensor ao vivo; no máximo um marcador
 * colorido por bloco); rótulo em Share Tech caixa alta; sem sombra nem degradê decorativo.
 */

export type MarkerTone = "plain" | "light" | "out" | "live";
const MARKER: Record<MarkerTone, string> = { plain: "bg-bg", light: "bg-state-alert", out: "bg-source-secondary", live: "bg-source-highlight" };

/** Marcador: etiqueta em Share Tech caixa alta. */
export function Marker({ children, tone = "plain" }: { children: ReactNode; tone?: MarkerTone }) {
  return <span className={`font-label inline-block self-start px-1.5 py-px text-xs leading-4 text-display uppercase lg:text-[13px] lg:leading-[18px] ${MARKER[tone]}`}>{children}</span>;
}

export type LampState = "ok" | "attention" | "none";
const LAMP: Record<LampState, string> = { ok: "bg-[#3b9965]", attention: "bg-state-error", none: "bg-stroke-soft" };
const LAMP_TEXT: Record<LampState, string> = { ok: "sem pendências", attention: "atenção", none: "sem leitura" };

/** Lâmpada de estado (o Radio Button do usuário): verde sem pendências, vermelha atenção, cinza sem leitura. */
export function Lamp({ state }: { state: LampState }) {
  return (
    <span role="img" aria-label={LAMP_TEXT[state]} className="flex size-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-display bg-surface">
      <span className={`size-3 rounded-full ${LAMP[state]}`} />
    </span>
  );
}

/**
 * Medidor segmentado (a barra do PPFD reaproveitada): um bloco por unidade quando o total é pequeno, senão 10 blocos
 * proporcionais. `filled` e `total` são os números reais.
 */
export function SegMeter({ filled, total, max = 10, className = "" }: { filled: number; total: number; max?: number; className?: string }) {
  const n = Math.max(1, Math.min(total, max));
  const on = total <= max ? Math.min(filled, total) : Math.round((Math.min(filled, total) / total) * n);
  return (
    <span aria-hidden className={`inline-flex gap-[3px] self-start rounded-[3px] border border-display p-[3px] ${className}`}>
      {Array.from({ length: n }, (_, i) => <span key={i} className={`h-3.5 rounded-[1px] ${n <= 4 ? "w-8" : n <= 6 ? "w-5" : "w-3"} ${i < on ? "bg-display" : "bg-stroke-soft"}`} />)}
    </span>
  );
}

/** Cartão do painel: superfície clara, traço fino, canto 16; `tone="bobby"` é o verde do Bobby. */
export function PanelCard({ children, tone, label, className = "" }: { children: ReactNode; tone?: "bobby"; label?: string; className?: string }) {
  return <section aria-label={label} className={`flex flex-col gap-3 rounded-2xl border border-stroke p-3.5 ${tone === "bobby" ? "bg-surface-bobby" : "bg-surface"} ${className}`}>{children}</section>;
}

/** Título do bloco: lâmpada opcional, rótulo em Share Tech caixa alta e o que fica à direita. */
export function PanelTitle({ children, lamp, right, divider = false }: { children: ReactNode; lamp?: LampState; right?: ReactNode; divider?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${divider ? "border-b border-stroke pb-2.5" : ""}`}>
      {lamp && <Lamp state={lamp} />}
      <h2 className="font-label min-w-0 flex-1 truncate text-lg leading-6 text-display uppercase">{children}</h2>
      {right}
    </div>
  );
}

/** Link pequeno de canto ("USO E PLANO ›", "VER CALENDÁRIO ›"). */
export function CornerLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return null;
  return <Link href={href} className="font-label flex min-h-11 shrink-0 items-center text-[13px] leading-4 text-display uppercase hover:underline">{children} ›</Link>;
}

const BTN = "font-label flex min-h-12 flex-1 items-center justify-center gap-2.5 rounded-lg px-3 text-center text-[17px] leading-5 uppercase cursor-pointer";
const KIND = {
  primary: "bg-primary text-surface hover:bg-primary-dark",
  clear: "border border-stroke bg-surface text-text-primary hover:bg-surface-high",
};

/** Botões `btn` do usuário: principal com "→", claro com "›". Rótulos curtos em caixa alta. */
export function PanelButton({ label, href, onClick, kind = "primary", external = false }: { label: string; href?: string | null; onClick?: () => void; kind?: "primary" | "clear"; external?: boolean }) {
  const body = <>{label}<span aria-hidden>{kind === "primary" ? "→" : "›"}</span></>;
  const cls = `${BTN} ${KIND[kind]}`;
  if (href && external) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a>;
  if (href) return <Link href={href} className={cls}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return null;
}

/** Rótulo pequeno em Share Tech sobre um medidor ou mostrador. */
export function PanelLabel({ children }: { children: ReactNode }) {
  return <p className="font-label text-[13px] leading-4 text-display uppercase">{children}</p>;
}

/** Cartão tracejado de "Adicionar" dentro da grade (Ambientes e Plantas): ocupa a altura da linha. */
export function AddCard({ href, label, hint }: { href: string | null; label: string; hint: string }) {
  if (!href) return null;
  return (
    <Link href={href} className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-input-border p-5 text-center hover:bg-surface-high">
      <span className="font-label text-[17px] leading-5 text-text-primary uppercase">+ {label}</span>
      <span className="text-sm leading-5 text-text-secondary">{hint}</span>
    </Link>
  );
}

/** Cartão de link dentro da grade (arquivados, histórico): título, frase e "›". */
export function LinkCard({ href, title, body }: { href: string | null; title: string; body: string }) {
  return (
    <Link href={href ?? "#"} className="flex min-h-16 items-center gap-3 rounded-2xl border border-stroke bg-surface px-3.5 py-3 hover:bg-surface-high">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-base leading-6 font-semibold text-text-primary">{title}</span>
        <span className="text-sm leading-5 text-text-secondary">{body}</span>
      </span>
      <span aria-hidden className="text-text-primary">›</span>
    </Link>
  );
}
