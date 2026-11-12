"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PlantPanel } from "@/components/home/panel-home";
import { AddCard, LinkCard, Marker, PanelButton, PanelCard, PanelTitle, SegMeter } from "@/components/panel";
import { PlantsCalendar } from "@/components/plants/plants-calendar";
import { Button, Notice, Spinner } from "@/components/ui";
import { usePlanConfigs } from "@/lib/account";
import { type SummaryV3 } from "@/lib/home-v3";
import { useBobAlerts, useGrows, usePlants, usePlantSummaries } from "@/lib/hooks";
import { plantPanelProps } from "@/lib/panel-props";
import { normalizePlan } from "@/lib/plans";
import { useRecommendation } from "@/lib/recommendation-client";
import { routes } from "@/lib/routes";
import { attentionItems, type AttentionItem } from "@/shared/lib/homeClimate";
import { environmentMeasurement } from "@/shared/lib/measurements";
import { plantDisplayName } from "@/shared/lib/plantIdentity";
import type { PlantResponse, PlantSummary } from "@/shared/types/api";

type View = "cards" | "calendar";
type Sort = "attention" | "phase" | "name" | "recent";
/** Últimas escolhas, por navegador (itens 6 e 22): Cartões | Calendário e a ordenação. */
const VIEW_KEY = "letsgrow-plants-view";
const SORT_KEY = "letsgrow-plants-sort";
const SORTS: Record<Sort, string> = { attention: "Atenção primeiro", phase: "Por fase", name: "Por nome", recent: "Registro mais recente" };
const PHASE_ORDER = ["germination", "seedling", "veg", "flower", "late_flower", "harvest", "drying", "curing", "unknown"];

export default function PlantsPage() {
  return <Suspense fallback={<Spinner />}><Plants /></Suspense>;
}

/**
 * Suas plantas v2 no painel (UX itens 22 e 23b; web W3p 2423:24352, celular P1p 2422:23723, estados E9–E11
 * 2424:23690). Lista de cartões (compacto com 2 ou mais, grande com 1), filtros Todas, Atenção e por ambiente,
 * "Atenção primeiro" como ordem padrão, e o limite do plano. O modo Calendário não muda.
 */
function Plants() {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<View>(params.get("modo") === "calendario" ? "calendar" : "cards");
  const [sort, setSort] = useState<Sort>("attention");
  const [filter, setFilter] = useState<string>("all");
  useEffect(() => {
    try {
      const s = window.localStorage.getItem(SORT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s && s in SORTS) setSort(s as Sort);
      if (params.get("modo")) return;
      const v = window.localStorage.getItem(VIEW_KEY);
      if (v === "calendar" || v === "cards") setView(v);
    } catch { /* sem armazenamento */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (v: View) => {
    setView(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* sem armazenamento */ }
    if (params.get("modo")) router.replace(routes.plants());
  };
  const chooseSort = (s: Sort) => { setSort(s); try { window.localStorage.setItem(SORT_KEY, s); } catch { /* sem armazenamento */ } };

  const grows = useGrows();
  const all = usePlants();
  const archived = usePlants({ is_active: false });
  const summaries = usePlantSummaries();
  const alerts = useBobAlerts();
  const recommendation = useRecommendation();
  const planConfigs = usePlanConfigs().data;
  const active = (grows.data ?? []).filter(g => g.status === "active");
  const activePlants = (all.data ?? []).filter(p => p.is_active && active.some(g => g.id === p.grow_id));
  const growName = (id: string) => active.find(g => g.id === id)?.name ?? null;
  const summaryOf = (id: string) => summaries.data?.[id] as (PlantSummary & SummaryV3) | undefined;

  // Itens de atenção por ambiente (rega e alertas do Bobby), para a próxima ação de cada planta.
  const items: AttentionItem[] = active.flatMap(g => {
    const growPlants = activePlants.filter(p => p.grow_id === g.id);
    const ids = new Set(growPlants.map(p => p.id));
    return attentionItems({
      growId: g.id, growName: g.name, temperature: environmentMeasurement(g.env, "temperature"), humidity: environmentMeasurement(g.env, "humidity"),
      alerts: (alerts.data?.alerts ?? []).filter(a => ids.has(a.plant_id)),
      lastWatering: Object.fromEntries(growPlants.map(p => [p.id, summaryOf(p.id)?.last_watering_at])),
    }).items;
  });
  const hrefOf = (item: AttentionItem) => item.target.kind === "diary" ? routes.plantDiary(item.target.id) : item.target.kind === "grow" ? routes.growPanel(item.target.id) : routes.bobbyObservation(item.target.id);
  const cards = activePlants.map(plant => ({ plant, props: plantPanelProps({ plant, summary: summaryOf(plant.id), growName: growName(plant.grow_id), items, hrefOf, illustrate: false, detailedTags: true }) }));

  const attentionCount = cards.filter(c => c.props.next).length;
  const chips: { key: string; label: string }[] = [
    { key: "all", label: `Todas · ${cards.length}` },
    { key: "attention", label: `Atenção · ${attentionCount}` },
    ...(active.length > 1 ? active.map(g => ({ key: g.id, label: `${g.name} · ${cards.filter(c => c.plant.grow_id === g.id).length}` })) : []),
  ];
  const lastOf = (p: PlantResponse) => { const s = summaryOf(p.id); return s?.last_event?.event_date ?? s?.last_event_at ?? ""; };
  const shown = cards
    .filter(c => filter === "all" || (filter === "attention" ? !!c.props.next : c.plant.grow_id === filter))
    .sort((a, b) => sort === "attention" ? Number(!!b.props.next) - Number(!!a.props.next) || plantDisplayName(a.plant).localeCompare(plantDisplayName(b.plant))
      : sort === "phase" ? PHASE_ORDER.indexOf(a.plant.current_phase) - PHASE_ORDER.indexOf(b.plant.current_phase)
        : sort === "name" ? plantDisplayName(a.plant).localeCompare(plantDisplayName(b.plant))
          : lastOf(b.plant).localeCompare(lastOf(a.plant)));

  // Limite do plano (item 22): usado de total do /billing/recommendation; no limite, "Arquivar uma planta".
  const rec = recommendation.status === "ok" ? recommendation.rec : null;
  const usage = rec?.usage.plants;
  const unlimited = !usage || usage.total == null || usage.total >= 9999;
  const atLimit = !!usage && !unlimited && usage.used >= usage.total!;
  const recLabel = rec?.plan_key ? planConfigs?.find(p => p.plan_key === normalizePlan(rec.plan_key!))?.label ?? null : null;
  const covers = !!rec?.plan_key && rec.reasons.includes("plants_limit") && rec.covers.includes("plants_limit") && !!recLabel;
  const plantsTo = rec?.changes.find(c => c.key === "plants")?.to;

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="font-label text-[28px] leading-9 text-text-primary">Suas plantas</h1>
      {usage && (unlimited
        ? <Marker>{usage.used} {usage.used === 1 ? "planta" : "plantas"}</Marker>
        : <span className="flex items-center gap-2"><SegMeter filled={usage.used} total={usage.total!} /><Marker tone={atLimit ? "out" : "plain"}>{usage.used} de {usage.total}</Marker></span>)}
    </div>
  );
  const tabs = (
    <div role="radiogroup" aria-label="Modo de visualização" className="flex w-full rounded-lg border border-display bg-surface p-[4px] md:w-[300px]">
      {(["cards", "calendar"] as const).map(v => (
        <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => choose(v)}
          className={`font-label min-h-10 flex-1 rounded-md text-base leading-[21px] uppercase cursor-pointer ${view === v ? "bg-display text-surface" : "text-display"}`}>{v === "cards" ? "Cartões" : "Calendário"}</button>
      ))}
    </div>
  );
  const growFilter = filter !== "all" && filter !== "attention" ? filter : null;
  // Calendário: só Todas e os ambientes (o filtro de atenção e a ordem são dos cartões).
  const calendarChips = active.length > 1 && (
    <div role="radiogroup" aria-label="Ambiente" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:flex-1 md:flex-wrap md:px-0">
      {[{ key: "all", label: "Todos os ambientes" }, ...active.map(g => ({ key: g.id, label: g.name }))].map(c => (
        <button key={c.key} type="button" role="radio" aria-checked={(growFilter ?? "all") === c.key} onClick={() => setFilter(c.key)}
          className={`font-label min-h-9 shrink-0 px-2 text-[13px] leading-4 uppercase cursor-pointer ${(growFilter ?? "all") === c.key ? "bg-display text-surface" : "text-display hover:bg-bg"}`}>{c.label}</button>
      ))}
    </div>
  );
  const filters = cards.length >= 2 && (
    <div className="flex flex-col gap-3 md:flex-1 md:flex-row md:items-center">
      <div role="radiogroup" aria-label="Filtrar plantas" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:flex-1 md:flex-wrap md:px-0">
        {chips.map(c => (
          <button key={c.key} type="button" role="radio" aria-checked={filter === c.key} onClick={() => setFilter(c.key)}
            className={`font-label min-h-9 shrink-0 px-2 text-[13px] leading-4 uppercase cursor-pointer ${filter === c.key ? "bg-display text-surface" : "text-display hover:bg-bg"}`}>{c.label}</button>
        ))}
      </div>
      <label className="font-label flex items-center gap-2 text-[13px] text-display uppercase">
        Ordenar:
        <select value={sort} onChange={e => chooseSort(e.target.value as Sort)} className="font-label min-h-9 cursor-pointer bg-transparent text-[13px] text-display uppercase">
          {(Object.keys(SORTS) as Sort[]).map(s => <option key={s} value={s}>{SORTS[s]}</option>)}
        </select>
      </label>
    </div>
  );
  const archivedCount = archived.data?.length ?? 0;
  const archivedRow = archivedCount > 0 && (
    <LinkCard href={routes.archivedPlants()} title="Plantas arquivadas e colhidas" body={`${archivedCount === 1 ? "1 planta" : `${archivedCount} plantas`} · o histórico continua disponível.`} />
  );
  const limitCard = atLimit && (
    <PanelCard tone={covers ? "bobby" : undefined} label="Limite do plano">
      <PanelTitle right={<span className="flex items-center gap-2"><SegMeter filled={usage!.used} total={usage!.total!} /><Marker tone="out">{usage!.used} de {usage!.total}</Marker></span>}>Limite do plano</PanelTitle>
      {covers && <Marker tone="light">Recomendado para você</Marker>}
      <p className="text-[15px] leading-[21px] text-text">
        Você usa {usage!.used} de {usage!.total} {usage!.total === 1 ? "planta" : "plantas"} do seu plano.
        {covers ? (typeof plantsTo === "number" ? ` O plano ${recLabel} permite ${plantsTo} plantas.` : plantsTo === null ? ` O plano ${recLabel} não tem limite de plantas.` : "") : activePlants.length > 1 ? " Para abrir espaço, abra uma planta e escolha Arquivar." : ""}
      </p>
      {covers ? <div className="flex"><PanelButton label="Ver o plano" href={routes.plans()} /></div>
        : activePlants.length === 1 && <div className="flex"><PanelButton kind="clear" label="Arquivar uma planta" href={routes.plant(activePlants[0].id)} /></div>}
    </PanelCard>
  );

  // Sem ambiente ainda não há onde pôr uma planta.
  if (grows.isSuccess && !active.length) {
    return (
      <>
        {header}
        <div className="flex max-w-[600px] flex-col gap-4">
          <Notice title="Ainda não há plantas" body="Primeiro, dê um nome ao ambiente. Os detalhes podem ser adicionados depois." />
          <div className="flex"><PanelButton label="Começar pelo ambiente" href={routes.newGrow()} /></div>
        </div>
      </>
    );
  }

  const loading = grows.isPending || all.isPending;
  const error = grows.isError || all.isError;
  return (
    <>
      {header}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">{tabs}{view === "cards" ? filters : calendarChips}</div>
      {loading ? <Spinner /> : error ? <div className="max-w-[600px]"><Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void (grows.isError ? grows.refetch() : all.refetch())} /></div>
        : view === "calendar"
          ? (all.data!.length ? <PlantsCalendar plants={all.data!} grows={active} growId={growFilter} />
            : <div className="flex max-w-[600px] flex-col gap-4"><Notice title="Ainda não há plantas" body="Você pode adicionar a primeira planta quando quiser. Os registros de todas as plantas aparecem aqui." /><div className="flex"><PanelButton kind="clear" label="Adicionar planta" href={routes.newPlant()} /></div></div>)
          : !cards.length ? (
            // E11: vazio.
            <div className="flex max-w-[600px] flex-col gap-[14px]">
              <PanelCard label="Nenhuma planta">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className="flex shrink-0 flex-col items-center" aria-hidden><img src="/figma/phase-germination.svg" alt="" width={34} height={42} /><span className="font-label text-xs leading-4 text-display">GÉRMEN</span></span>
                  <p className="text-[15px] leading-[21px] text-text">Nenhuma planta ainda. Cadastre a primeira para acompanhar fase, rega e registros.</p>
                </div>
                <div className="flex"><PanelButton label="Adicionar planta" href={routes.newPlant()} /></div>
              </PanelCard>
              {archivedRow}
            </div>
          ) : (
            // Desktop (pedido do usuário, 12 nov): uma grade só, cartões com a mesma altura por linha.
            <div className="flex flex-col gap-[14px] md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-3">
              {shown.map(c => <PlantPanel key={c.plant.id} {...c.props} large={cards.length === 1} />)}
              {!shown.length && <p className="text-[15px] leading-[21px] text-text">Nenhuma planta neste filtro.</p>}
              {limitCard}
              {!atLimit && <AddCard href={routes.newPlant(growFilter ?? undefined)} label="Adicionar planta" hint="Os detalhes podem ser completados depois." />}
              {archivedRow && <div className="flex flex-col md:col-span-2 lg:col-span-3">{archivedRow}</div>}
            </div>
          )}
    </>
  );
}
