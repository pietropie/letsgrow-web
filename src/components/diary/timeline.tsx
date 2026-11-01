"use client";

/* eslint-disable @next/next/no-img-element */
import { useQueries } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PanelTag } from "@/components/grows/instruments";
import { Button, Notice } from "@/components/ui";
import { api } from "@/lib/api";
import { blocksUntil, buildTimeline, dayHeading, dayRows, gapLabel, loadDiaryPeriod, stripSync, timelineBlock, type TimelineSection } from "@/shared/lib/diaryCalendar";
import { dayKey, entryKinds, entryTitle, entryValues, matchesFilter, type DiaryEntry, type DiaryFilter } from "@/shared/lib/diaryEntries";
import { atClock } from "@/shared/lib/lightSchedule";

/**
 * Linha do tempo única e contínua (UX item 8 e 8b, Figma 03C L–L10; desktop W18), web do
 * letsgrow-mobile/components/diary/DiaryTimeline.tsx. Do mais recente para o mais antigo, hoje no topo, dias vazios
 * dobrados, carregada para trás em blocos de 30 dias de GET /diary. Tocar num dia do calendário rola até ele;
 * rolar a lista atualiza o dia marcado no calendário.
 */
const pad = (n: number) => String(n).padStart(2, "0");
const time = (iso: string) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const ddmm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const records = (n: number) => `${n} ${n === 1 ? "REGISTRO" : "REGISTROS"}`;
const HIGHLIGHT_MS = 1000, SYNC_DELAY = 150;

/** Calendário geral: o que a linha da planta mostra em cada dia (Figma 03C L6). */
export type TimelineGrouping = {
  nameOf: (e: DiaryEntry) => string;
  growOf: (e: DiaryEntry) => string;
  phaseOf: (e: DiaryEntry) => string;
  imageOf: (e: DiaryEntry) => string;
  hrefOf: (plantId: string) => string | null;
};

function TypeIcon({ entry }: { entry: DiaryEntry }) {
  const kinds = entryKinds(entry);
  const icon = kinds.includes("rega") ? "watering" : kinds.includes("nutricao") ? "fert" : entry.event_type === "photo" ? "camera" : "align-left";
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-display"><img src={`/figma/${icon}.svg`} alt="" className="max-h-[22px] max-w-[22px]" /></span>;
}

const sectionKey = (t: TimelineSection<DiaryEntry>) => t.kind === "future" ? "future-" + dayKey(t.day) : t.key;

export function DiaryTimeline({ params, keep, filter, historyStart, historyLabel, focus, selected, onVisibleDay, grouping, hrefOfEntry, onAdd }: {
  params: { plant_id?: string; include_archived: boolean };
  keep?: (e: DiaryEntry) => boolean;
  filter: DiaryFilter;
  historyStart: Date | null;
  historyLabel: string;
  focus: { day: Date; seq: number } | null;
  selected: Date;
  onVisibleDay: (day: Date) => void;
  grouping?: TimelineGrouping;
  hrefOfEntry: (e: DiaryEntry) => string;
  onAdd?: (day: Date) => void;
}) {
  const [today] = useState(() => startOfDay(new Date()));
  const [count, setCount] = useState(() => focus ? blocksUntil(today, focus.day) : 1);
  const blocks = useMemo(() => Array.from({ length: count }, (_, i) => timelineBlock(today, i)), [today, count]);
  const results = useQueries({
    queries: blocks.map(b => {
      const query = { start_at: b.start_at, end_at: b.end_at, ...params };
      const qs = (offset: number, limit: number) => new URLSearchParams(Object.entries({ ...query, limit, offset }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
      return { queryKey: ["diary", query], queryFn: ({ signal }: { signal: AbortSignal }) => loadDiaryPeriod((offset, limit) => api<DiaryEntry[]>(`/diary?${qs(offset, limit)}`, { signal })) };
    }),
  });

  // Só contam os blocos carregados sem buraco: a lista nunca mostra um dia que não buscou.
  let loaded = 0;
  while (loaded < results.length && results[loaded].isSuccess) loaded++;
  const firstPending = results[0]?.isPending ?? true;
  const firstError = results[0]?.isError ?? false;
  const pending = loaded < results.length && results[loaded].isPending;
  const failed = loaded < results.length && results[loaded].isError;
  const from = loaded ? blocks[loaded - 1].start : today;
  const reachedStart = loaded > 0 && (!historyStart || from <= historyStart);

  const dataVersion = results.slice(0, loaded).map(r => r.dataUpdatedAt).join(",");
  const entries = useMemo(() => {
    const byId = new Map<string, DiaryEntry>();
    results.slice(0, loaded).forEach(r => (r.data ?? []).forEach(e => byId.set(e.id, e)));
    return [...byId.values()].filter(e => (!keep || keep(e)) && matchesFilter(e, filter));
  }, [dataVersion, keep, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const nothingYet = reachedStart && !entries.length && filter === "all";
  // Datas entram pelo valor: o pai recria historyStart a cada renderização.
  const historyTime = historyStart?.getTime() ?? null, fromTime = from.getTime(), focusTime = focus?.day.getTime() ?? null;
  const sections = useMemo(
    () => loaded ? buildTimeline(entries, { today, from: new Date(fromTime), historyStart: historyTime == null ? null : new Date(historyTime), focus: focusTime == null ? null : new Date(focusTime) }) : [],
    [loaded, entries, today, fromTime, historyTime, focusTime],
  );

  // ── Toque no calendário → rola até o dia ──
  const nodes = useRef(new Map<string, HTMLElement>());
  const [highlight, setHighlight] = useState<string | null>(null);
  const target = useRef<string | null>(null);
  const syncTarget = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
  useEffect(() => {
    if (!focus) return;
    const day = startOfDay(focus.day);
    target.current = syncTarget.current = day > today ? "future-" + dayKey(day) : dayKey(day);
    // O toque no calendário pede os blocos até aquele dia; a rolagem acontece quando ele aparecer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCount(c => Math.max(c, blocksUntil(today, day)));
  }, [focus?.seq]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = target.current;
    if (!key) return;
    const node = nodes.current.get(key);
    if (!node) { if (!pending && loaded === count) target.current = null; return; }
    target.current = null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    node.focus({ preventScroll: true });
    // Fora da limpeza do efeito: uma nova renderização não pode apagar o destaque no meio.
    later(() => setHighlight(key), reduce ? 0 : 350);
    later(() => setHighlight(h => h === key ? null : h), (reduce ? 0 : 350) + HIGHLIGHT_MS);
    later(() => { if (syncTarget.current === key) syncTarget.current = null; }, 1500);
  }, [sections, pending, loaded, count]);

  // ── Rolagem → dia marcado no calendário ──
  const sync = useRef({ selected: dayKey(selected), onVisibleDay });
  useEffect(() => { sync.current = { selected: dayKey(selected), onVisibleDay }; });
  useEffect(() => {
    const days = new Map<Element, { key: string; day: Date }>();
    sections.forEach(t => { if (t.kind === "gap") return; const n = nodes.current.get(sectionKey(t)); if (n) days.set(n, { key: sectionKey(t), day: t.day }); });
    const visible = new Set<Element>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Como o onViewableItemsChanged do mobile, só a rolagem move o calendário: a primeira leitura do observador
    // (e trocar de mês pelas setas) não pode puxar o dia marcado de volta.
    let scrolled = false;
    const onScroll = () => { scrolled = true; };
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(items => {
      items.forEach(i => { if (i.isIntersecting) visible.add(i.target); else visible.delete(i.target); });
      if (!scrolled) return;
      scrolled = false;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const first = [...visible].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        const info = first ? days.get(first) : null;
        const r = stripSync(info?.key ?? null, { target: syncTarget.current, selected: sync.current.selected });
        if (r.clearTarget) syncTarget.current = null;
        if (r.select && info && dayKey(info.day) !== sync.current.selected) sync.current.onVisibleDay(info.day);
      }, SYNC_DELAY);
    }, { rootMargin: "0px 0px -60% 0px" });
    days.forEach((_, n) => io.observe(n));
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); if (timer) clearTimeout(timer); };
  }, [sections]);

  // ── Fim da lista → carrega o bloco anterior ──
  const sentinel = useRef<HTMLDivElement>(null);
  const canLoad = loaded === count && !reachedStart && !pending && !failed && loaded > 0;
  useEffect(() => {
    const n = sentinel.current;
    if (!n || !canLoad) return;
    const io = new IntersectionObserver(([i]) => { if (i.isIntersecting) setCount(c => c + 1); }, { rootMargin: "600px" });
    io.observe(n);
    return () => io.disconnect();
  }, [canLoad]);

  const pill = "rounded-full border border-stroke-soft px-3.5 py-1.5 text-center text-sm leading-[18px] text-text-secondary";
  const skeleton = (k: number) => (
    <div key={k} className="flex flex-col gap-2.5 rounded-2xl border-[0.5px] border-stroke bg-surface px-3.5 py-3" aria-hidden>
      <div className="h-4 w-[150px] animate-pulse rounded bg-stroke-soft" /><div className="h-px bg-stroke" />
      {[0, 1].map(i => <div key={i} className="flex items-center gap-3"><div className="h-9 w-9 animate-pulse rounded-lg bg-stroke-soft" /><div className="flex flex-1 flex-col gap-1.5"><div className="h-3.5 w-1/2 animate-pulse rounded bg-stroke-soft" /><div className="h-3 w-4/5 animate-pulse rounded bg-stroke-soft" /></div></div>)}
    </div>
  );

  if (firstError) return <div className="flex flex-col gap-3"><Notice title="Não foi possível carregar o diário" body="Seus registros não foram alterados." /><Button secondary label="Tentar novamente" onClick={() => void results[0]?.refetch()} /></div>;
  if (firstPending) return <div className="flex flex-col gap-3" role="status" aria-label="Carregando o diário">{skeleton(0)}{skeleton(1)}</div>;

  return (
    <div className="flex flex-col gap-3">
      {sections.map(t => {
        if (t.kind === "gap") { const g = gapLabel(t); return <div key={t.key} className="flex justify-center"><span className={pill} aria-label={g.a11y}>{g.text}</span></div>; }
        const key = sectionKey(t);
        const lit = highlight === key;
        const plants = grouping && t.kind === "day" ? new Set(t.entries.map(e => e.plant_id)).size : 0;
        const n = t.kind === "day" ? t.entries.length : 0;
        const h = dayHeading(t.day, n, { today: t.kind === "day" && t.today, ahead: t.kind === "future" ? t.ahead : undefined });
        const head = (
          <div className="flex items-center gap-1.5">
            <div className="flex-1"><h3 className="font-label truncate text-base leading-5 text-display">{h.title}</h3>{!!plants && <p className="text-sm leading-[18px] text-text-secondary">{plants} {plants === 1 ? "planta" : "plantas"}</p>}</div>
            {t.kind === "day" && t.today && <PanelTag tone="calm" label="HOJE" />}
            <PanelTag label={t.kind === "future" ? `DAQUI A ${t.ahead} ${t.ahead === 1 ? "DIA" : "DIAS"}` : records(n)} />
          </div>
        );
        const ref = (el: HTMLElement | null) => { if (el) nodes.current.set(key, el); else nodes.current.delete(key); };
        if (t.kind === "future") {
          return (
            <section key={key} ref={ref} tabIndex={-1} aria-label={h.a11y} className={`flex scroll-mt-4 flex-col gap-2.5 rounded-2xl px-3.5 py-3 outline-none ${lit ? "border-2 border-primary" : "border-[1.5px] border-dashed border-display"}`}>
              {head}<div className="h-px bg-stroke" /><p className="text-base leading-6 text-display">Este dia ainda não chegou. Registros só podem ser feitos até hoje.</p>
            </section>
          );
        }
        return (
          <section key={key} ref={ref} tabIndex={-1} aria-label={h.a11y} className={`flex scroll-mt-4 flex-col rounded-2xl bg-surface px-3.5 pt-3 pb-3 outline-none ${lit ? "border-2 border-primary" : "border-[0.5px] border-stroke"}`}>
            {head}
            <div className="mt-2.5 h-px bg-stroke" />
            {!t.entries.length ? (
              <div className="flex flex-col gap-3 pt-2.5">
                {t.today && nothingYet
                  ? <Notice title="Nenhum registro ainda" body="A linha do tempo começa no primeiro registro. Uma nota já basta." />
                  : <p className="text-base leading-6 text-display">{filter !== "all" ? "Nenhum registro deste tipo neste dia." : t.today ? "Nenhum registro hoje." : "Nenhum registro neste dia."}</p>}
                {onAdd && <Button label={`Adicionar registro em ${ddmm(t.day)}`} onClick={() => onAdd(t.day)} />}
              </div>
            ) : dayRows(t.entries, grouping?.nameOf).map((r, i) => {
              if (r.kind === "plant") {
                const href = grouping!.hrefOf(r.plantId);
                const sub = [grouping!.growOf(r.first), `${r.count} ${r.count === 1 ? "registro" : "registros"}`].filter(Boolean).join(" · ");
                const phase = grouping!.phaseOf(r.first);
                const inner = <>
                  <img src={grouping!.imageOf(r.first)} alt="" className="h-9 w-9 rounded-lg object-contain" />
                  <span className="flex-1"><span className="block truncate text-base leading-5 font-semibold text-text-primary">{r.name}</span><span className="text-sm leading-[18px] text-text-secondary">{sub}</span></span>
                  <PanelTag tone={/NÃO INFORMADA/.test(phase) ? "neutral" : "calm"} label={phase} />
                </>;
                return (
                  <div key={`p-${r.plantId}-${i}`}>
                    {r.divider && <div className="my-1.5 h-px bg-stroke" />}
                    {href ? <Link href={href} className="flex min-h-[52px] items-center gap-2.5 py-2 hover:bg-surface-high">{inner}</Link> : <div className="flex min-h-[52px] items-center gap-2.5 py-2">{inner}</div>}
                  </div>
                );
              }
              const e = r.entry, values = entryValues(e);
              const d = new Date(e.event_date);
              const label = [`${entryTitle(e).charAt(0)}${entryTitle(e).slice(1).toLowerCase()} ${atClock(d.getHours() * 60 + d.getMinutes())}`, grouping?.nameOf(e), ...values.map(v => v.label), e.notes].filter(Boolean).join(", ");
              return (
                <div key={e.id}>
                  {r.divider === "inset" && <div className="ml-12 h-px bg-stroke" />}
                  <Link href={hrefOfEntry(e)} aria-label={label} className="flex items-start gap-3 py-2.5 hover:bg-surface-high">
                    <TypeIcon entry={e} />
                    <span className="flex flex-1 flex-col gap-1.5">
                      <span className="flex items-center gap-2"><span className="font-label flex-1 text-base text-display">{entryTitle(e)}</span><span className="font-label text-sm text-display">{time(e.event_date)}</span></span>
                      {!!values.length && <span className="flex flex-wrap gap-1">{values.map(v => <span key={v.label} className="px-1.5 text-sm leading-[17px] text-display" style={{ background: v.color }}>{v.label}</span>)}</span>}
                      {!!e.notes && <span className="text-base leading-6 text-display">{e.notes}</span>}
                    </span>
                  </Link>
                </div>
              );
            })}
          </section>
        );
      })}
      <div ref={sentinel} />
      {failed ? <div className="flex justify-center"><button type="button" onClick={() => void results[loaded]?.refetch()} className={`${pill} border-error cursor-pointer`}>Não foi possível carregar os dias anteriores · Tentar novamente</button></div>
        : pending ? <div className="flex flex-col gap-3">{skeleton(0)}<p className="text-center text-sm text-text-secondary" role="status">Carregando dias anteriores…</p></div>
        : reachedStart ? <div className="flex justify-center"><span className="font-label rounded-full border-[0.5px] border-stroke bg-surface px-3.5 py-1.5 text-sm text-display">INÍCIO DO HISTÓRICO · {historyLabel}</span></div>
        : <div className="h-6" />}
    </div>
  );
}
