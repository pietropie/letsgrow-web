"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { NewEventPanel } from "@/components/plants/new-event-panel";
import { PlantsCalendar } from "@/components/plants/plants-calendar";
import { ActionRow, Button, ButtonLink, Notice, PageHeader, Spinner } from "@/components/ui";
import { useBobAlerts, useGrows, usePlants, usePlantSummaries } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { phases } from "@/shared/constants/theme";
import { phaseDay } from "@/shared/lib/phaseDay";
import { PHASE_ICON_LABEL, dayCount, phaseIcon } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";
import type { GrowSummary, PlantResponse, PlantSummary } from "@/shared/types/api";

type View = "cards" | "calendar";
/** Última escolha Cartões | Calendário, por navegador (UX-CORRECOES.md item 6). */
const VIEW_KEY = "letsgrow-plants-view";

export default function PlantsPage() {
  return <Suspense fallback={<Spinner />}><Plants /></Suspense>;
}

/**
 * Suas plantas (Figma W17 cartões, W18 calendário; mobile app/(app)/plants/index.tsx). Os chips de ambiente ficam no
 * topo das duas vistas; ?modo=calendario abre direto o calendário (atalho do Início).
 */
function Plants() {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<View>(params.get("modo") === "calendario" ? "calendar" : "cards");
  useEffect(() => {
    if (params.get("modo")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const v = window.localStorage.getItem(VIEW_KEY); if (v === "calendar" || v === "cards") setView(v); } catch { /* sem armazenamento */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (v: View) => {
    setView(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* sem armazenamento */ }
    if (params.get("modo")) router.replace(routes.plants());
  };
  const [growId, setGrowId] = useState<string | null>(null);
  const grows = useGrows();
  const all = usePlants();
  const summaries = usePlantSummaries();
  const alerts = useBobAlerts();
  const [recordPlant, setRecordPlant] = useState<PlantResponse | null>(null);
  const active = (grows.data ?? []).filter(g => g.status === "active");
  const activePlants = (all.data ?? []).filter(p => p.is_active && (!growId || p.grow_id === growId) && active.some(g => g.id === p.grow_id));

  // Figma 2160:5532: sem ambiente ainda não há onde pôr uma planta.
  if (grows.isSuccess && !active.length) {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <PageHeader title="Suas plantas" subtitle="Cadastre quando estiver pronto." />
        <Notice title="Ainda não há plantas" body="Primeiro, dê um nome ao ambiente. Os detalhes podem ser adicionados depois." />
        <ButtonLink label="Começar pelo ambiente" href={routes.newGrow()!} />
      </div>
    );
  }

  const tabs = (
    <div role="radiogroup" aria-label="Modo de visualização" className="flex w-full rounded-xl border border-display bg-surface p-[5px] md:w-[266px]">
      {(["cards", "calendar"] as const).map(v => (
        <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => choose(v)}
          className={`font-label min-h-10 flex-1 rounded-lg text-base leading-[21px] cursor-pointer ${view === v ? "bg-primary text-white" : "text-display"}`}>{v === "cards" ? "CARTÕES" : "CALENDÁRIO"}</button>
      ))}
    </div>
  );
  const chips = (
    <div role="radiogroup" aria-label="Ambiente" className="-mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
      {[{ id: null, name: "Todos os ambientes" }, ...active].map(g => {
        const on = growId === g.id;
        return <button key={g.id ?? "all"} type="button" role="radio" aria-checked={on} onClick={() => setGrowId(g.id)}
          className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold cursor-pointer ${on ? "border-primary bg-primary text-white" : "border-input-border bg-surface text-display hover:bg-surface-high"}`}>{g.name}</button>;
      })}
    </div>
  );
  const loading = grows.isPending || all.isPending;
  const error = grows.isError || all.isError;

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex-1">
          <h1 className="text-[28px] leading-9 font-bold text-text-primary">Suas plantas</h1>
          <p className="text-sm leading-5 text-text-secondary">{view === "calendar" ? "Calendário de todas as plantas" : all.isSuccess ? `${activePlants.length} ${activePlants.length === 1 ? "planta ativa" : "plantas ativas"}` : ""}</p>
        </div>
        {tabs}
      </div>
      {chips}
      {loading ? <Spinner /> : error ? <div className="max-w-[600px]"><Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void (grows.isError ? grows.refetch() : all.refetch())} /></div>
        : view === "calendar"
          ? (all.data!.length ? <PlantsCalendar plants={all.data!} grows={active} growId={growId} />
            : <div className="flex max-w-[600px] flex-col gap-4"><Notice title="Ainda não há plantas" body="Você pode adicionar a primeira planta quando quiser. Os registros de todas as plantas aparecem aqui." /><ButtonLink secondary label="Adicionar planta" href={routes.newPlant(growId ?? undefined)!} /></div>)
          : <>
            {activePlants.length ? (
              <div className="flex flex-col gap-5 md:flex-row md:flex-wrap">
                {activePlants.map(plant => (
                  <PlantCard key={plant.id} plant={plant} grow={active.find(g => g.id === plant.grow_id)} summary={summaries.data?.[plant.id]}
                    advice={alerts.isPending ? "Carregando observações…" : alerts.isError ? "Não foi possível carregar as observações." : alerts.data?.alerts.find(a => a.plant_id === plant.id)?.message ?? "Nenhuma observação retornada. Você pode abrir o histórico e conversar sobre seus registros."}
                    onRecord={() => setRecordPlant(plant)} />
                ))}
              </div>
            ) : <div className="max-w-[600px]"><Notice title="Ainda não há plantas" body="Você pode adicionar a primeira planta deste ambiente quando quiser. Os detalhes podem ser adicionados depois." /></div>}
            <div className="flex max-w-[600px] flex-col gap-4">
              <ButtonLink secondary label="Adicionar planta" href={routes.newPlant(growId ?? undefined)!} />
              <ActionRow title="Plantas arquivadas" body="O histórico continua disponível." href={routes.archivedPlants()} />
            </div>
          </>}
      {recordPlant && <NewEventPanel open onClose={() => setRecordPlant(null)} plantId={recordPlant.id} growId={recordPlant.grow_id}
        growLabel={active.find(g => g.id === recordPlant.grow_id)?.name} />}
    </>
  );
}

/** Cartão de 330 do mobile (Figma 2287:8821), em grade com quebra no desktop (W17). */
function PlantCard({ plant, grow, summary, advice, onRecord }: { plant: PlantResponse; grow?: GrowSummary; summary?: PlantSummary; advice: string; onRecord: () => void }) {
  const name = plantDisplayName(plant);
  const icon = phaseIcon(plant.current_phase);
  const day = phaseDay(plant);
  const soft = "flex min-h-12 items-center justify-center gap-2 rounded-lg border-[0.5px] border-stroke-soft bg-surface p-3 text-base font-semibold text-display shadow-[4px_4px_4px_rgba(0,0,0,0.1)] hover:bg-surface-high";
  return (
    <article aria-labelledby={`plant-${plant.id}`} className="flex flex-col gap-1 rounded-2xl border-[0.5px] border-stroke bg-surface px-2.5 py-4 md:w-[330px]">
      <div className="flex h-[156px] items-center justify-center"><img src={summary?.strain_image_url || `/figma/plant-${plantIllustration(plant.id)}.png`} alt="" className="h-[156px] w-[156px] object-contain" /></div>
      <p className="text-sm leading-5 text-text-muted">Imagem ilustrativa</p>
      <Link href={routes.plant(plant.id)!} className="flex items-center gap-1.5 hover:underline">
        <img src="/figma/leaf-small.svg" alt="" /><h2 id={`plant-${plant.id}`} className="font-label text-xl leading-[26px] text-display">{name}</h2><img src="/figma/chevron-right.svg" alt="" />
      </Link>
      <p className="pt-0.5 pb-1 text-sm leading-5 text-text-muted">{grow?.name} · histórico da planta</p>
      <div className="h-px bg-stroke" />
      <div className="mt-1 flex flex-col gap-1.5 rounded-lg bg-[#E1EBE6] p-2">
        <div className="flex items-center gap-1.5"><img src="/figma/bobby-plant.svg" alt="" /><h3 className="font-label text-xl leading-[26px] text-display">Acompanhamento do Bobby</h3></div>
        <p className="text-base leading-6">{advice}</p>
        <Link href={routes.bobbyObservation(plant.id)!} className={soft}>VER OBSERVAÇÃO</Link>
      </div>
      <div className="flex flex-col gap-2 py-2.5">
        <div className="flex items-center justify-between"><span className="font-label text-base text-display">FASE ATUAL</span>
          <Link href={routes.plantInfo(plant.id)} aria-label={`Editar fase da ${name}`} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg"><img src="/figma/edit.svg" alt="" /></Link></div>
        <div className="flex items-center gap-1.5">
          {icon && <span className="flex min-w-[53px] flex-col items-center"><img src={`/figma/phase-${icon}.svg`} alt="" /><span className="text-sm text-text-muted">{PHASE_ICON_LABEL[icon]}</span></span>}
          <span><span className="block text-base leading-6">{phases[plant.current_phase]?.label ?? "Fase não informada"}</span>{!!day && <span className="block text-base leading-6">{dayCount(day)} nesta fase</span>}</span>
        </div>
      </div>
      <button type="button" onClick={onRecord} className="mt-1 flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-primary p-3 text-base font-semibold text-white hover:bg-primary-dark cursor-pointer">NOVO REGISTRO <img src="/figma/arrow-right.svg" alt="" /></button>
      <Link href={routes.plantDiary(plant.id)!} className={`mt-1 ${soft}`}>ABRIR DIÁRIO <img src="/figma/chevron-right.svg" alt="" /></Link>
    </article>
  );
}
