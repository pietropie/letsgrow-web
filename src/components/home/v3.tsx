/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { Tag } from "@/components/home/blocks";
import type { Meter, PlanBandView, Suggestion } from "@/lib/home-v3";

/**
 * Início v3 (UX item 20; Figma N1–N4, F1–F6, W30): faixa "Seu plano", cartão grande da planta e o bloco do Bobby.
 * Os textos saem de src/lib/home-v3.ts; aqui só a forma.
 */

const card = "rounded-2xl border-[0.5px] border-stroke bg-surface";
const label = "font-label text-xs leading-4 text-text-secondary";
const DOT = { limit: "bg-state-alert", near: "bg-state-alert", out: "bg-state-error" } as const;
const MARK_TEXT = { limit: "NO LIMITE", near: "PERTO DO FIM", out: "ESGOTADO" } as const;

function MeterCell({ m }: { m: Meter }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className={label}>{m.label}</p>
      <p className="flex flex-wrap items-center gap-1.5 text-[15px] leading-5 font-bold text-text-primary">
        <span>{m.value}{m.detail && <span className="hidden font-semibold lg:inline"> · {m.detail}</span>}</span>
        {m.mark && <>
          <span aria-hidden className={`size-2.5 rounded-full border border-display lg:hidden ${DOT[m.mark]}`} />
          <span className="hidden lg:inline"><Tag tone="alert" label={MARK_TEXT[m.mark]} /></span>
          <span className="sr-only lg:hidden">{MARK_TEXT[m.mark].toLowerCase()}</span>
        </>}
      </p>
      <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-stroke-soft">
        {m.fill != null && <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(m.fill * 100)}%` }} />}
      </span>
    </div>
  );
}

/** Faixa "Seu plano" (F1–F6; W30 numa linha só). Sem oferta por padrão; o botão só com recomendação e motivo. */
export function PlanBand({ name, view, link, planHref }: { name: string; view: PlanBandView; link: { label: string; href: string }; planHref: string }) {
  return (
    <section aria-label="Seu plano" className={`${card} flex flex-col gap-3 px-4 py-3.5 lg:px-5`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex items-center gap-2 lg:flex-col lg:items-start lg:gap-0.5">
          <p className={label}>SEU PLANO</p>
          <p className="flex-1 text-lg leading-6 font-bold text-text-primary lg:text-[22px] lg:leading-7">{name}</p>
          <Link href={link.href} className="text-[15px] font-semibold text-text-primary hover:underline lg:hidden">{link.label} ›</Link>
        </div>
        <div className="grid flex-1 grid-cols-3 gap-3 lg:gap-6">{view.meters.map(m => <MeterCell key={m.label} m={m} />)}</div>
        <Link href={link.href} className="hidden shrink-0 text-[15px] font-semibold text-text-primary hover:underline lg:block">{link.label} ›</Link>
      </div>
      {view.near && <p className="rounded-lg bg-state-alert px-3 py-2.5 text-[15px] leading-5 font-semibold text-text-primary">{view.near}</p>}
      {view.offer && (
        <div className="flex flex-col gap-3 rounded-xl bg-source-highlight p-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <p className="font-label text-xs leading-4 text-display">RECOMENDADO PARA VOCÊ</p>
            <p className="text-[15px] leading-[21px] font-semibold text-text-primary">{view.offer.text}</p>
          </div>
          <Link href={planHref} className="flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-primary px-5 text-[15px] font-semibold text-surface hover:bg-primary-dark">{view.offer.button}</Link>
        </div>
      )}
    </section>
  );
}

/** Item 20a: o título da seção ("SUA PLANTA", "SUAS PLANTAS · 2") e "Ver calendário" na primeira linha do cartão. */
function CardTitle({ title, calendarHref }: { title: string; calendarHref?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="font-label flex-1 text-base leading-5 text-display">{title}</h2>
      {calendarHref && <Link href={calendarHref} className="relative z-10 text-sm leading-[18px] font-semibold text-primary hover:underline">Ver calendário</Link>}
    </div>
  );
}

const outlineBtn = "flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-input-border bg-surface px-2 text-center text-[15px] leading-5 font-semibold text-text-primary hover:bg-surface-high";

/** Cartão grande da planta (N1, W30): foto de 150, estado, fase e dia, a próxima ação e "Registrar" | "Perguntar". */
export function PlantCardV3(p: {
  header: { title: string; calendarHref: string | null };
  name: string; href: string | null; photo: { src: string; real: boolean }; phase: { icon: string; label: string } | null;
  phaseLine: string; last: string | null; next: { text: string; href: string | null } | null; idle: string;
  recordHref: string | null; askHref: string; wide: boolean;
}) {
  return (
    <article className={`${card} flex shrink-0 snap-start flex-col gap-2.5 p-3 ${p.wide ? "w-full" : "w-[300px] md:w-auto"}`}>
      <CardTitle title={p.header.title} calendarHref={p.header.calendarHref} />
      <Link href={p.href ?? "#"} aria-label={`Abrir ${p.name}`} className="block overflow-hidden rounded-xl bg-surface">
        <img src={p.photo.src} alt="" className={`h-[150px] w-full ${p.photo.real ? "object-cover" : "object-contain"}`} />
      </Link>
      <div className="flex items-center gap-2">
        <h3 className="flex-1 truncate text-xl leading-7 font-bold text-text-primary">{p.href ? <Link href={p.href} className="hover:underline">{p.name}</Link> : p.name}</h3>
        <Tag tone={p.next ? "alert" : "calm"} label={p.next ? "ATENÇÃO" : "SEM PENDÊNCIAS"} />
      </div>
      <div className="flex items-center gap-2">
        {p.phase && <span className="flex flex-col items-center" aria-hidden><img src={p.phase.icon} alt="" width={21} height={27} /><span className="text-[7.5px] leading-[9px] text-display">{p.phase.label}</span></span>}
        <div className="min-w-0">
          <p className="truncate text-[15px] leading-5 font-semibold text-text-primary">{p.phaseLine}</p>
          {p.last && <p className="truncate text-[13px] leading-4 text-text-secondary">{p.last}</p>}
        </div>
      </div>
      {p.next ? (
        <Link href={p.next.href ?? p.href ?? "#"} className="flex items-center gap-2 rounded-xl bg-state-alert px-3 py-2.5 hover:opacity-90">
          <span className="flex flex-1 flex-col gap-0.5"><span className="font-label text-xs leading-4 text-display">PRÓXIMA AÇÃO</span><span className="text-[15px] leading-5 font-semibold text-text-primary">{p.next.text}</span></span>
          <span aria-hidden className="text-lg text-text-primary">›</span>
        </Link>
      ) : (
        <div className="flex flex-col gap-0.5 rounded-xl bg-bg px-3 py-2.5">
          <span className="font-label text-xs leading-4 text-display">SEM PENDÊNCIAS</span>
          <span className="text-[15px] leading-5 text-text-primary">{p.idle}</span>
        </div>
      )}
      <div className="mt-auto flex gap-2">
        {p.recordHref && <Link href={p.recordHref} className={outlineBtn}>Registrar</Link>}
        <Link href={p.askHref} className={outlineBtn}><span className="md:hidden lg:inline">Perguntar ao Bobby</span><span className="hidden md:inline lg:hidden">Perguntar</span></Link>
      </div>
    </article>
  );
}

/** "Sua primeira planta aparece aqui" (N4). */
export function FirstPlantCard({ href }: { href: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-input-border p-4">
      <CardTitle title="SUAS PLANTAS" />
      <p className="text-lg leading-6 font-bold text-text-primary">Sua primeira planta aparece aqui</p>
      <p className="text-[15px] leading-[21px] text-text">Com foto, fase, dia do ciclo e o que fazer em seguida. Comece pelo ambiente; você completa depois.</p>
      <Link href={href} className={`${outlineBtn} min-h-12`}>Cadastrar meu ambiente</Link>
    </div>
  );
}

/**
 * O Bobby do Início (N1–N4, W30): resumo do dia, sugestões (abrem a conversa com a pergunta escrita, sem enviar),
 * a entrada e o que resta de conversas. Esgotado (N2): o aviso no lugar das sugestões, com "Ver planos" e a saída.
 */
export function BobbyHome(p: {
  title: string; subtitle: string;
  suggestionsTitle: string; suggestions: (Suggestion & { href: string })[];
  exhausted: { title: string; body: string; wait: string | null; plansHref: string } | null;
  inputHref: string; left: { text: string; fill: number } | null; footer: string | null;
}) {
  const [waiting, setWaiting] = useState(false);
  return (
    <section aria-label="Bobby" className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-primary bg-surface p-4">
      <div className="flex items-start gap-3">
        <img src="/figma/bobby-calm.png" alt="" width={48} height={64} className="h-16 w-12 shrink-0 object-contain" />
        <div className="flex flex-col gap-1">
          <p className={label}>BOBBY · ASSISTENTE DE IA</p>
          <h2 className="text-[17px] leading-[23px] font-bold text-text-primary">{p.title}</h2>
          <p className="text-sm leading-5 text-text-secondary">{p.subtitle}</p>
        </div>
      </div>
      {p.exhausted && !waiting ? (
        <>
          <div className="flex flex-col gap-1 rounded-xl bg-state-alert p-3.5">
            <p className="text-base leading-6 font-bold text-text-primary">{p.exhausted.title}</p>
            <p className="text-[15px] leading-[21px] text-text">{p.exhausted.body}</p>
          </div>
          <div className="flex gap-2">
            <Link href={p.exhausted.plansHref} className={outlineBtn}>Ver planos</Link>
            {p.exhausted.wait && <button type="button" onClick={() => setWaiting(true)} className={`${outlineBtn} cursor-pointer`}>{p.exhausted.wait}</button>}
          </div>
        </>
      ) : !p.exhausted && !!p.suggestions.length && (
        <>
          <p className={label}>{p.suggestionsTitle}</p>
          <ul className="flex flex-col gap-2">
            {p.suggestions.map(s => (
              <li key={s.key}><Link href={s.href} className="flex min-h-11 items-center gap-2 rounded-xl bg-bg px-3.5 py-2.5 text-[15px] leading-5 text-text-primary hover:bg-surface-high">
                <span className="flex-1">{s.label}</span><span aria-hidden>›</span>
              </Link></li>
            ))}
          </ul>
        </>
      )}
      {!p.exhausted && (
        <Link href={p.inputHref} className="flex min-h-12 items-center gap-2 rounded-full border border-input-border bg-surface py-1.5 pr-1.5 pl-4 text-[15px] text-text-secondary hover:bg-surface-high">
          <span className="flex-1">Pergunte ao Bobby…</span>
          <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-primary text-surface">↑</span>
        </Link>
      )}
      {p.left && (
        <p className="flex items-center gap-2.5 text-[13px] leading-[18px] font-semibold text-text-primary">
          <span aria-hidden className="block h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-stroke-soft"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(p.left.fill * 100)}%` }} /></span>
          <span>{p.left.text}</span>
        </p>
      )}
      {p.footer && <p className="text-xs leading-[18px] text-text-secondary">{p.footer}</p>}
    </section>
  );
}
