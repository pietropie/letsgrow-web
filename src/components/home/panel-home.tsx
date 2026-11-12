/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { SegmentedDisplay } from "@/components/home/blocks";
import { CornerLink, Lamp, Marker, PanelButton, PanelCard, PanelLabel, PanelTitle, SegMeter, type LampState, type MarkerTone } from "@/components/panel";
import type { Meter, PlanBandView, Suggestion } from "@/lib/home-v3";
import type { AttentionItem } from "@/shared/lib/homeClimate";

/**
 * Início no painel (UX item 23b; web W1p 2423:23781, celular I1 2422:22825, estados E1 e E2 2424:23423).
 * A estrutura e as regras do Início v3 (item 20) não mudam; muda o visual: mostradores, marcadores, lâmpada,
 * medidores segmentados e os botões `btn`.
 */

const sentence = "text-[15px] leading-[21px] text-text";

function MeterBlock({ m, room }: { m: Meter; room: boolean }) {
  const tone: MarkerTone = m.mark === "limit" || m.mark === "out" ? "out" : "plain";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <PanelLabel>{m.label}</PanelLabel>
      {m.seg ? <SegMeter filled={m.seg.used} total={m.seg.total} /> : room ? <span aria-hidden className="h-[22px]" /> : null}
      <Marker tone={tone}>{m.value}</Marker>
    </div>
  );
}

/** "SEU PLANO" (F1–F6 no painel): os três medidores segmentados; a recomendação só com motivo real. */
export function PlanPanel({ name, view, link, planHref, wide = false }: { name: string; view: PlanBandView; link: { label: string; href: string }; planHref: string; wide?: boolean }) {
  const meters = <div className="flex flex-wrap gap-x-6 gap-y-3">{view.meters.map(m => <MeterBlock key={m.label} m={m} room={view.meters.some(x => !!x.seg)} />)}</div>;
  return (
    <PanelCard label="Seu plano">
      {wide ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-10">
          <div className="flex items-center gap-2.5 lg:min-w-[260px]"><h2 className="font-label text-lg leading-6 text-display uppercase">Seu plano</h2><Marker>{name}</Marker></div>
          <div className="flex-1">{meters}</div>
          <CornerLink href={link.href}>{link.label}</CornerLink>
        </div>
      ) : <>
        <PanelTitle right={<CornerLink href={link.href}>{link.label}</CornerLink>}>SEU PLANO <span className="ml-1 align-middle"><Marker>{name}</Marker></span></PanelTitle>
        {meters}
      </>}
      {view.near && <p className={sentence}>{view.near}</p>}
      {view.offer && (
        <div className="flex flex-col gap-2.5 border-t border-stroke pt-3">
          <Marker tone="live">Recomendado para você</Marker>
          <p className={sentence}>{view.offer.text}</p>
          <div className="flex"><PanelButton label={view.offer.button} href={planHref} /></div>
        </div>
      )}
    </PanelCard>
  );
}

/** "PRECISA DE ATENÇÃO" com a lâmpada e a contagem no mostrador; some sem item. */
export function AttentionPanel({ items, total, hrefOf, wide = false }: { items: AttentionItem[]; total: number; hrefOf: (i: AttentionItem) => string | null; wide?: boolean }) {
  return (
    <PanelCard label="Precisa de atenção">
      <PanelTitle lamp="attention" divider right={<SegmentedDisplay size="small" value={total} unit="" spoken={`${total} itens`} />}>Precisa de atenção</PanelTitle>
      <ul className={wide ? "flex flex-col lg:grid lg:grid-cols-3 lg:gap-x-6" : "flex flex-col"}>
        {items.map(item => {
          const href = hrefOf(item);
          const body = (
            <>
              <Marker>{item.tag}</Marker>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base leading-5 font-semibold text-text-primary">{item.title}</span>
                <span className="text-sm leading-5 text-text-secondary">{item.meta}</span>
              </span>
              {href && <span aria-hidden className="text-text-primary">›</span>}
            </>
          );
          return <li key={item.key}>{href
            ? <Link href={href} className="flex min-h-11 items-start gap-2.5 py-2 hover:bg-surface-high">{body}</Link>
            : <div className="flex items-start gap-2.5 py-2">{body}</div>}</li>;
        })}
      </ul>
    </PanelCard>
  );
}

export type Reading = { value: number | null; unit: "°" | "%"; label: string; marker: { text: string; tone: MarkerTone } };

/** O ambiente no Início (cartão de lista do item 22 no painel): mostradores, a luz, as contagens e as ações. */
export function EnvPanel(p: {
  name: string; lamp: LampState; spec: string | null;
  temperature: Reading; humidity: Reading;
  vpd: { value: number | null; marker: string } | null;
  light: { onHours: number; offHours: number; marker: string; lit: boolean } | null;
  counts: string | null; phases?: string[]; note: string | null;
  recordHref: string | null; panelHref: string | null;
}) {
  const reading = (r: Reading) => (
    <div className="flex flex-col gap-1.5">
      <PanelLabel>{r.label}</PanelLabel>
      <SegmentedDisplay size="small" value={r.value} unit={r.unit} label={r.label} />
      <Marker tone={r.marker.tone}>{r.marker.text}</Marker>
    </div>
  );
  return (
    <PanelCard label={`Ambiente ${p.name}`}>
      <PanelTitle lamp={p.lamp} right={p.spec ? <Marker>{p.spec}</Marker> : undefined}>{p.name}</PanelTitle>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {reading(p.temperature)}
        {reading(p.humidity)}
        {p.vpd && (
          <div className="flex flex-col gap-1.5">
            <PanelLabel>VPD · kPa</PanelLabel>
            <SegmentedDisplay size="small" value={p.vpd.value} unit="" label="VPD" />
            <Marker>{p.vpd.marker}</Marker>
          </div>
        )}
      </div>
      {p.light && (
        <div aria-label={`Luz: ${p.light.onHours} horas acesa, ${p.light.offHours} apagada`} role="img" className="flex h-6 overflow-hidden text-sm leading-6">
          <span className="flex items-center justify-center gap-1 bg-state-alert text-text-primary" style={{ width: `${(p.light.onHours / 24) * 100}%` }}>☀ {p.light.onHours}h</span>
          {p.light.offHours > 0 && <span className="flex flex-1 items-center justify-center gap-1 bg-stroke-soft text-text-primary">☾ {p.light.offHours}h</span>}
        </div>
      )}
      {(p.light || p.counts || !!p.phases?.length) && (
        <div className="flex flex-wrap gap-1.5">
          {p.light && <Marker tone={p.light.lit ? "light" : "plain"}>{p.light.marker}</Marker>}
          {p.counts && <Marker>{p.counts}</Marker>}
          {p.phases?.map(ph => <Marker key={ph}>{ph}</Marker>)}
        </div>
      )}
      {p.note && <p className={sentence}>{p.note}</p>}
      <div className="mt-auto flex gap-2.5">
        <PanelButton kind="clear" label="Registrar" href={p.recordHref} />
        <PanelButton label="Abrir painel" href={p.panelHref} />
      </div>
    </PanelCard>
  );
}

/**
 * Cartão da planta no painel (itens 22 e 23b): foto sem borda (ou "SEM FOTO"), lâmpada, marcadores, fase e dia, a
 * próxima ação e os botões. Compacto por padrão; `large` com uma planta só (E9). `header` é a linha do Início (20a).
 */
export function PlantPanel(p: {
  header?: { title: string; calendarHref: string | null };
  name: string; href: string | null; photo: { src: string; real: boolean } | null;
  tags: string[]; phase: { icon: string; label: string } | null; phaseLine: string;
  next: { label: string; href: string | null } | null; last: string | null;
  /** Sem registro nenhum (P1p "Muda nova"): "FAÇA O PRIMEIRO REGISTRO" e "SEM REGISTROS". */
  noRecords?: boolean;
  askHref: string; photoHref?: string | null; recordHref: string | null; large?: boolean;
}) {
  const photo = p.photo
    ? <img src={p.photo.src} alt="" className={`${p.large ? "h-[210px] w-full" : "size-[104px]"} rounded-lg ${p.photo.real ? "object-cover" : "object-contain"}`} />
    : <span className={`font-label flex items-center justify-center rounded-lg bg-bg text-xs text-display ${p.large ? "h-[160px] w-full" : "size-[104px]"}`}>SEM FOTO</span>;
  return (
    <PanelCard label={`Planta ${p.name}`}>
      {p.header && (
        <div className="flex items-center gap-2">
          <p className="font-label flex-1 text-[15px] leading-5 text-display uppercase">{p.header.title}</p>
          <CornerLink href={p.header.calendarHref}>Ver calendário</CornerLink>
        </div>
      )}
      <div className={p.large ? "flex flex-col gap-3" : "flex gap-3"}>
        <Link href={p.href ?? "#"} aria-label={`Abrir ${p.name}`} className="shrink-0">{photo}</Link>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <Lamp state={p.next ? "attention" : "ok"} />
            <h3 className="font-label min-w-0 truncate text-xl leading-6 text-text-primary">{p.href ? <Link href={p.href} className="hover:underline">{p.name}</Link> : p.name}</h3>
          </div>
          {!!p.tags.length && <div className="flex flex-wrap gap-1.5">{p.tags.map(t => <Marker key={t}>{t}</Marker>)}</div>}
          <div className="flex items-center gap-2">
            {p.phase && <span className="flex flex-col items-center" aria-hidden><img src={p.phase.icon} alt="" width={24} height={30} /><span className="font-label text-[9px] leading-[10px] text-display">{p.phase.label}</span></span>}
            <span className="font-label text-sm leading-5 text-display uppercase">{p.phaseLine}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-stroke pt-2.5">
        {p.noRecords && !p.next ? <><Marker tone="light">Faça o primeiro registro</Marker><Marker>Sem registros</Marker></> : <>
          {p.next ? (p.next.href ? <Link href={p.next.href} className="hover:opacity-80"><Marker tone="light">{p.next.label}</Marker></Link> : <Marker tone="light">{p.next.label}</Marker>) : <Marker>Nada pendente</Marker>}
          {p.last && <Marker>{p.last}</Marker>}
        </>}
      </div>
      <div className="mt-auto flex gap-2.5">
        {p.photo || !p.photoHref ? <PanelButton kind="clear" label="Bobby" href={p.askHref} /> : <PanelButton kind="clear" label="Foto" href={p.photoHref} />}
        <PanelButton label="Registrar" href={p.recordHref} />
      </div>
    </PanelCard>
  );
}

/** E2: "SUAS PLANTAS · 0", com "VER PLANOS" e "ADICIONAR". */
export function EmptyPlantsPanel({ plansHref, addHref }: { plansHref: string | null; addHref: string }) {
  return (
    <PanelCard label="Suas plantas">
      <PanelTitle>Suas plantas · 0</PanelTitle>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 flex-col items-center" aria-hidden><img src="/figma/phase-germination.svg" alt="" width={34} height={42} /><span className="font-label text-xs leading-4 text-display">GÉRMEN</span></span>
        <p className={sentence}>Nenhuma planta ainda. Cadastre a primeira para o painel mostrar fase, rega e ambiente.</p>
      </div>
      <div className="flex gap-2.5">
        {plansHref && <PanelButton kind="clear" label="Ver planos" href={plansHref} />}
        <PanelButton label="Adicionar" href={addHref} />
      </div>
    </PanelCard>
  );
}

/**
 * O Bobby no painel (verde do Bobby): resumo do dia, sugestões (abrem a conversa com a pergunta escrita, sem enviar),
 * a entrada e as conversas no medidor segmentado. Esgotado (E1): o marcador rosa, a frase e "VER O PLANO" só com
 * plano à venda que aumente o limite.
 */
export function BobbyPanel(p: {
  title: string; body?: string | null; marker: string;
  suggestionsTitle: string; suggestions: (Suggestion & { href: string })[];
  exhausted: { text: string; plansHref: string | null } | null;
  inputHref: string; meter: { used: number; total: number; text: string } | null; footer: string | null;
  wide?: boolean;
}) {
  return (
    <PanelCard tone="bobby" label="Bobby">
      <div className="flex items-center gap-2.5">
        <img src="/figma/bobby-calm.png" alt="" width={28} height={36} className="h-9 w-7 object-contain" />
        <h2 className="font-label flex-1 text-lg leading-6 text-display uppercase">Bobby · assistente de IA</h2>
      </div>
      <p className="text-[17px] leading-6 font-bold text-text-primary">{p.title}</p>
      {!!p.body && <p className="line-clamp-4 text-[15px] leading-[21px] text-text">{p.body}</p>}
      <Marker>{p.marker}</Marker>
      {p.exhausted ? (
        <>
          {p.meter && <div className="flex flex-wrap items-center gap-2.5"><SegMeter filled={p.meter.used} total={p.meter.total} /><Marker tone="out">{p.meter.text}</Marker></div>}
          <p className={sentence}>{p.exhausted.text}</p>
          {p.exhausted.plansHref && <div className="flex"><PanelButton label="Ver o plano" href={p.exhausted.plansHref} /></div>}
        </>
      ) : (
        <>
          {!!p.suggestions.length && <>
            <p className="font-label text-[13px] leading-4 text-display uppercase">{p.suggestionsTitle}</p>
            <ul className={p.wide ? "flex flex-col gap-2 lg:grid lg:grid-cols-3" : "flex flex-col gap-2"}>
              {p.suggestions.map(s => (
                <li key={s.key}><Link href={s.href} className="flex min-h-11 items-center gap-2 rounded-lg border border-display bg-surface px-3 py-2.5 text-[15px] leading-5 text-text-primary hover:bg-surface-high">
                  <span className="flex-1">{s.label}</span><span aria-hidden>›</span>
                </Link></li>
              ))}
            </ul>
          </>}
          <Link href={p.inputHref} className="mt-auto flex min-h-12 items-center gap-2 rounded-lg border border-display bg-surface py-1.5 pr-1.5 pl-3 text-[15px] text-text-secondary hover:bg-surface-high">
            <span className="flex-1">Pergunte ao Bobby…</span>
            <span aria-hidden className="flex size-9 items-center justify-center rounded-md bg-display text-surface">↑</span>
          </Link>
          {p.meter && <div className="flex flex-wrap items-center gap-2.5"><SegMeter filled={p.meter.used} total={p.meter.total} /><Marker>{p.meter.text}</Marker></div>}
        </>
      )}
      {p.footer && <p className="text-xs leading-[18px] text-text-secondary">{p.footer}</p>}
    </PanelCard>
  );
}
