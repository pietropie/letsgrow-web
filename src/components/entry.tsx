"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { codeCells, type EntryError } from "@/lib/entry";

/**
 * Entrada no painel (UX item 25; Figma 2431:23980). Web W7p/W8p: a apresentação à esquerda ("O painel do seu cultivo."
 * e o cartão "Exemplo do painel") e o formulário num painel claro de 560 à direita. Celular (L2–L6): só a marca e o
 * formulário. Campos com traço escuro e ícone; erro em caixa vermelha com marcador rosa; código em mostrador.
 */
export function EntryShell({ children, back }: { children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1fr)_560px]">
      <aside className="hidden flex-col justify-center gap-6 px-20 py-16 lg:flex">
        <img src="/figma/wordmark.svg" alt="LetsGrow" width={172} height={54} className="h-[54px] w-auto self-start" />
        <h2 className="font-label text-[40px] leading-[48px] text-display">O painel do seu cultivo.</h2>
        <p className="max-w-[680px] text-lg leading-[26px] text-text">Registre o que acontece, acompanhe a fase e o ambiente de cada planta e pergunte ao Bobby quando tiver dúvida.</p>
        <ExampleCard />
        <div className="flex flex-wrap gap-1.5"><Tag tone="white">Para maiores de 18 anos</Tag><Tag tone="white">Grátis para começar</Tag></div>
      </aside>
      <div className="pt-safe flex min-h-dvh flex-col bg-bg lg:border-l lg:border-stroke lg:bg-surface">
        <header className="px-6 pt-6 lg:hidden"><img src="/figma/wordmark.svg" alt="LetsGrow" width={117} height={37} className="h-[37px] w-auto" /></header>
        <main className="mx-auto flex w-full max-w-[600px] flex-1 flex-col gap-4 px-6 py-6 lg:max-w-[420px] lg:justify-center lg:px-0">{children}</main>
        {back && <div className="mx-auto w-full max-w-[600px] px-6 pb-safe pb-6 lg:max-w-[420px] lg:px-0"><SmallLink href={back.href} back>{back.label}</SmallLink></div>}
        <p className="pb-6 text-center text-xs leading-4 text-text-secondary">
          <Link href="/termos" className="hover:underline">Termos</Link> · <Link href="/privacidade" className="hover:underline">Privacidade</Link>
        </p>
      </div>
    </div>
  );
}

function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "pink" | "green" | "yellow" | "white" }) {
  const bg = { plain: "bg-bg", pink: "bg-source-secondary", green: "bg-source-highlight", yellow: "bg-state-alert", white: "bg-surface" }[tone];
  return <span className={`font-label inline-block self-start px-1.5 py-px text-xs leading-4 text-display uppercase ${bg}`}>{children}</span>;
}

/** O cartão de exemplo da abertura: marcado como exemplo, com números fixos de demonstração (não são dados da conta). */
function ExampleCard() {
  const digits = (chars: string[]) => (
    <span className="inline-flex gap-0.5 rounded-[10px] border border-display p-0.5" aria-hidden>
      {chars.map((c, i) => <span key={i} className="flex h-10 w-[30px] items-center justify-center rounded-lg bg-display text-[26px] font-black text-surface">{c}</span>)}
    </span>
  );
  return (
    <figure aria-label="Exemplo do painel: 25 graus, 60% de umidade, vega no dia 22 de 28, próxima rega amanhã" className="flex w-full max-w-[428px] flex-col gap-2 rounded-2xl border border-stroke bg-surface p-3">
      <div className="flex items-center gap-4">
        <img src="/figma/entry-plant.png" alt="" width={110} height={110} className="h-[110px] w-[110px] shrink-0 object-contain" />
        <div className="flex flex-col gap-1.5">
          <span className="font-label text-xs leading-4 text-display uppercase">Temperatura · umidade</span>
          <div className="flex gap-1.5">{digits(["2", "5", "°"])}{digits(["6", "0", "%"])}</div>
          <span className="font-label text-xs leading-4 text-display uppercase">Vega · dia 22 de 28</span>
          <span className="flex h-3.5 w-[140px] gap-px border border-display p-px" aria-hidden>{Array.from({ length: 28 }, (_, i) => <span key={i} className={`flex-1 ${i < 22 ? "bg-display" : "bg-stroke-soft"}`} />)}</span>
          <Tag tone="yellow">Próx. rega: amanhã</Tag>
        </div>
      </div>
      <figcaption><Tag tone="plain">Exemplo do painel</Tag></figcaption>
    </figure>
  );
}

export function EntryTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-label text-[28px] leading-9 text-display">{title}</h1>
      {subtitle && <p className="text-base leading-6 text-text">{subtitle}</p>}
    </div>
  );
}

/** Medidor do cadastro: "PASSO 1 DE 2 · SEUS DADOS" e "PASSO 2 DE 2 · CONFIRMAÇÃO". */
export function StepMeter({ step, label }: { step: 1 | 2; label: string }) {
  return (
    <div className="flex items-center gap-2.5" aria-label={`Passo ${step} de 2: ${label}`}>
      <span className="flex h-4 w-[62px] gap-0.5 border border-display p-0.5" aria-hidden>
        <span className="flex-1 bg-display" /><span className={`flex-1 ${step === 2 ? "bg-display" : "bg-stroke-soft"}`} />
      </span>
      <span className="font-label text-xs leading-4 text-display uppercase">Passo {step} de 2 · {label}</span>
    </div>
  );
}

/** Caixa de erro geral (L2e): traço vermelho de 2, título no marcador rosa e a frase do que fazer. */
export function ErrorBox({ error }: { error: EntryError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex flex-col gap-1.5 rounded-[10px] border-2 border-state-error bg-surface px-3 py-2.5">
      <Tag tone="pink">{error.title}</Tag>
      {error.body && <p className="text-sm leading-5 text-text">{error.body}</p>}
    </div>
  );
}

/** Aviso de sucesso (código reenviado, solicitação enviada): marcador verde e a frase. */
export function SuccessBox({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-[10px] border border-display bg-surface px-3 py-2.5">
      <Tag tone="green">{title}</Tag>
      {children}
    </div>
  );
}

const ICONS = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 7.6 5.3a1.6 1.6 0 0 0 1.8 0l7.6-5.3" /></>,
  lock: <><rect x="4" y="10.5" width="16" height="10" rx="2" /><path d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
};
function Icon({ name }: { name: keyof typeof ICONS }) {
  return <svg aria-hidden width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--color-display)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{ICONS[name]}</svg>;
}
function Eye({ open }: { open: boolean }) {
  return (
    <svg aria-hidden width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--color-display)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12c1.9-4.2 5.3-6.5 9.5-6.5s7.6 2.3 9.5 6.5c-1.9 4.2-5.3 6.5-9.5 6.5S4.4 16.2 2.5 12Z" /><circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

/** Campo (L2/L3): rótulo em Share Tech, caixa com traço escuro e ícone; dica em marcador; erro marca a caixa e vem em rosa. */
export function EntryField({ label, icon, hint, error, invalid, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement> & {
  label: string; icon: keyof typeof ICONS; hint?: string; error?: string | null; invalid?: boolean;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const password = type === "password";
  const bad = invalid || !!error;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-label text-[13px] leading-4 text-display uppercase">{label}</label>
      <div className={`flex min-h-12 items-center gap-3 rounded-[10px] bg-surface px-3 focus-within:ring-2 focus-within:ring-primary/30 ${bad ? "border-2 border-state-error px-[11px]" : "border border-display"}`}>
        <Icon name={icon} />
        <input id={id} type={password && shown ? "text" : type} aria-invalid={bad || undefined} aria-describedby={hint || error ? `${id}-note` : undefined}
          className="min-w-0 flex-1 bg-transparent py-3 text-base text-text-primary outline-none placeholder:text-text-secondary" {...props} />
        {password && (
          <button type="button" onClick={() => setShown(s => !s)} aria-label={shown ? "Ocultar senha" : "Mostrar senha"} aria-pressed={shown} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg cursor-pointer"><Eye open={!shown} /></button>
        )}
      </div>
      {error ? <span id={`${id}-note`}><Tag tone="pink">{error}</Tag></span> : hint ? <span id={`${id}-note`}><Tag tone="plain">{hint}</Tag></span> : null}
    </div>
  );
}

/**
 * Código de 6 dígitos no mostrador G (L4, L6): uma célula por dígito. O campo de verdade fica por cima, invisível,
 * para colar, autocompletar o código do e-mail e ler com o leitor de tela.
 */
export function CodeDisplay({ label = "Código de verificação", value, onChange, error }: { label?: string; value: string; onChange: (code: string) => void; error?: string | null }) {
  const id = useId();
  const cells = codeCells(value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-label text-[13px] leading-4 text-display uppercase">{label}</label>
      <div className={`relative inline-flex gap-1 self-start rounded-[12px] p-1 ${error ? "border-2 border-state-error" : "border border-display"}`}>
        {cells.map((d, i) => (
          <span key={i} aria-hidden className={`flex h-[50px] w-11 items-center justify-center rounded-lg text-[30px] font-black ${d ? "bg-display text-surface" : "bg-stroke-soft"}`}>{d ?? ""}</span>
        ))}
        <input id={id} value={value} onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
          aria-invalid={!!error || undefined} aria-describedby={error ? `${id}-note` : undefined}
          className="absolute inset-0 h-full w-full cursor-text opacity-0" />
      </div>
      {error && <span id={`${id}-note`}><Tag tone="pink">{error}</Tag></span>}
    </div>
  );
}

const BTN = "flex min-h-12 w-full items-center justify-center gap-2.5 rounded-lg px-4 text-[17px] leading-5 font-semibold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-default";
/** Botão principal (verde escuro com →) e o claro (com ›), como nos frames. */
export function EntryButton({ label, kind = "primary", type = "button", onClick, disabled, busy, href, replace }: {
  label: string; kind?: "primary" | "clear"; type?: "button" | "submit"; onClick?: () => void; disabled?: boolean; busy?: boolean; href?: string; replace?: boolean;
}) {
  const cls = `${BTN} ${kind === "primary" ? "bg-primary text-surface hover:bg-primary-dark" : "bg-surface text-text-primary shadow-[0_2px_6px_rgba(0,0,0,0.12)] hover:bg-surface-high"}`;
  const body = <>{label}<span aria-hidden>{kind === "primary" ? "→" : "›"}</span></>;
  if (href) return <Link href={href} replace={replace} className={cls}>{body}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled || busy} aria-busy={busy || undefined} className={cls}>{body}</button>;
}

/** Link pequeno em Share Tech: "ESQUECI MINHA SENHA ›", "‹ VOLTAR PARA ENTRAR", "TERMOS DE USO ›". */
export function SmallLink({ href, children, back = false, replace = false }: { href: string; children: ReactNode; back?: boolean; replace?: boolean }) {
  return <Link href={href} replace={replace} className="font-label inline-flex min-h-8 items-center gap-1 text-[13px] leading-4 text-display uppercase hover:underline">{back && <span aria-hidden>‹</span>}{children}{!back && <span aria-hidden>›</span>}</Link>;
}

/** "Tenho 18 anos ou mais" (L3): a caixa com traço escuro e a marca; erro marca a caixa. */
export function AdultCheck({ checked, onChange, invalid }: { checked: boolean; onChange: (v: boolean) => void; invalid?: boolean }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] bg-surface px-3 ${invalid ? "border-2 border-state-error px-[11px]" : "border border-display"}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-invalid={invalid || undefined} className="peer sr-only" />
      <span aria-hidden className={`flex h-6 w-6 items-center justify-center rounded-[5px] border border-display peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 ${checked ? "bg-display text-surface" : "bg-surface"}`}>{checked && "✓"}</span>
      <span className="text-base leading-6 text-text-primary">Tenho 18 anos ou mais</span>
    </label>
  );
}
