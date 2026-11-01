"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { CalendarCard, kindsByDay } from "@/components/diary/calendar";
import { DiaryTimeline } from "@/components/diary/timeline";
import { PanelTag } from "@/components/grows/instruments";
import { NewEventPanel } from "@/components/plants/new-event-panel";
import { BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useEvents, useGrows, usePlant, usePlants } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { addCalendarMonths, diaryPeriod, historyStartOf, loadDiaryPeriod, weekDays } from "@/shared/lib/diaryCalendar";
import type { DiaryEntry, DiaryFilter } from "@/shared/lib/diaryEntries";
import { phaseTagLabel } from "@/shared/lib/phaseDay";
import { shortPlantName } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";

const MONTH_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const query = (o: Record<string, unknown>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString();

export default function DiaryPage() {
  return <Suspense fallback={<Spinner />}><Diary /></Suspense>;
}

/**
 * Diário de uma planta (Figma 03C L/L1, 2160:7004 Mês, 2246:7104 Semana, 2160:5960 diário vazio), web do
 * letsgrow-mobile/app/(app)/diary.tsx. No desktop, o calendário à esquerda e a linha do tempo à direita (W18).
 * ?novo=1 abre o novo registro; ?data=AAAA-MM-DD vai para o dia.
 */
function Diary() {
  const { id: plantId } = useParams<{ id: string }>();
  const params = useSearchParams();
  const [selected, setSelected] = useState(() => { const m = params.get("data")?.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : startOfDay(new Date()); });
  const [mode, setMode] = useState<"week" | "month">("month");
  const [filter, setFilter] = useState<DiaryFilter>("all");
  // first: se o painel abriu com o diário vazio. Fica fixo enquanto o painel está aberto: depois de salvar, o diário
  // deixa de estar vazio, e o painel não pode trocar "Seu primeiro registro está salvo" por um formulário em branco.
  const [sheet, setSheet] = useState<{ day: Date; first?: boolean } | null>(() => params.get("novo") === "1" ? { day: new Date() } : null);
  const [focus, setFocus] = useState<{ day: Date; seq: number } | null>(() => params.get("data") ? { day: selected, seq: 1 } : null);
  const plantQuery = usePlant(plantId);
  const plants = usePlants();
  const grows = useGrows();
  const history = useEvents(plantId);
  const plant = plantQuery.data;
  const grow = grows.data?.find(g => g.id === plant?.grow_id);

  const period = diaryPeriod(selected, mode);
  const filters = { ...period, plant_id: plantId, include_archived: true };
  const strip = useQuery({
    queryKey: ["diary", filters],
    queryFn: ({ signal }) => loadDiaryPeriod((offset, limit) => api<DiaryEntry[]>(`/diary?${query({ ...filters, limit, offset })}`, { signal })),
  });
  const kinds = useMemo(() => kindsByDay(strip.data ?? []), [strip.data]);
  const weekStart = weekDays(selected)[0];
  const weekCount = (strip.data ?? []).filter(e => { const t = new Date(e.event_date).getTime(); return t >= weekStart.getTime() && t < addDays(weekStart, 7).getTime(); }).length;
  const shift = (n: number) => setSelected(d => mode === "week" ? addDays(d, 7 * n) : startOfDay(addCalendarMonths(d, n)));
  const tapDay = (d: Date) => { setSelected(d); setFocus(f => ({ day: d, seq: (f?.seq ?? 0) + 1 })); };
  const sheetDate = (day: Date) => { const now = new Date(); const d = new Date(day); d.setHours(now.getHours(), now.getMinutes(), 0, 0); return d > now ? now : d; };

  const historyLoaded = history.isSuccess, emptyHistory = history.data?.length === 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (historyLoaded && sheet && sheet.first === undefined) setSheet(s => s && { ...s, first: emptyHistory });
  }, [historyLoaded, emptyHistory, sheet]);

  if (plantQuery.isPending) return <Spinner />;
  if (!plant) return <div className="flex max-w-[600px] flex-col gap-4"><BackLink fallback={routes.plants()} /><Button secondary label="Não foi possível carregar a planta. Tentar novamente" onClick={() => void plantQuery.refetch()} /></div>;

  const name = plantDisplayName(plant);
  const events = history.data;
  const photos = (events ?? []).reduce((n, e) => n + (e.photo_keys?.length ?? 0), 0);
  const firstRecord = events?.length ? events.reduce((min, e) => (e.event_date < min ? e.event_date : min), events[0].event_date) : null;
  // Onde a linha do tempo termina: o primeiro registro ou o cadastro da planta, o mais antigo.
  const historyStart = historyStartOf([firstRecord, plant.created_at]);
  const registered = historyStartOf([plant.created_at]);
  const firstIsOlder = !!historyStart && !!registered && historyStart < registered;
  const historyLabel = historyStart ? `${firstIsOlder ? "PRIMEIRO REGISTRO" : "PLANTA CADASTRADA"} EM ${historyStart.getDate()} ${MONTH_SHORT[historyStart.getMonth()]}` : "SEM REGISTROS ANTERIORES";
  const noHistory = !!events && events.length === 0;
  const panel = sheet && plant.is_active && sheet.first !== undefined && (
    <NewEventPanel key="new-event" open onClose={() => setSheet(null)} plantId={plant.id} defaultPlantIds={[plant.id]} eventDate={sheetDate(sheet.day)} growLabel={grow?.name} growId={plant.grow_id} firstRecord={sheet.first} />
  );

  // Figma 2160:5960: planta ainda sem nenhum registro.
  // A tela vazia fica enquanto o painel da primeira nota está aberto (como o "firstSheet" do mobile).
  if (noHistory || (sheet?.first && plant.is_active)) {
    const otherPlants = (plants.data ?? []).length > 1;
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <BackLink fallback={routes.plant(plant.id)!} />
        <PageTitle>Diário da {shortPlantName(name)}</PageTitle>
        <PageSubtitle>{grow?.name ?? ""}</PageSubtitle>
        <Notice title="Seu primeiro registro pode ser simples" body="Escreva uma observação com suas próprias palavras. Não é necessário preencher medições." />
        {plant.is_active && <Button label="Adicionar nota" onClick={() => setSheet({ day: new Date(), first: noHistory })} />}
        {otherPlants && <ButtonLink secondary label="Voltar às plantas" href={routes.plants()} />}
        {panel}
      </div>
    );
  }

  return (
    <>
      <BackLink fallback={routes.plant(plant.id)!} />
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,400px)_1fr] md:gap-6">
        <div className="flex flex-col gap-3 md:sticky md:top-6">
          <h1 className="text-2xl leading-[30px] text-display">Diário da {shortPlantName(name)}</h1>
          {grow && <p className="flex flex-wrap items-center gap-1.5 text-base text-[#4A4B4E]"><Link href={routes.growPanel(grow.id)!} className="border-b border-stroke-soft">{grow.name}</Link><span className="font-label text-sm text-display">›</span><span className="bg-stroke-soft px-1">{name}</span></p>}
          <Link href={routes.plant(plant.id)!} className="flex items-center gap-2 rounded-2xl border-[0.5px] border-stroke bg-surface p-3 hover:border-input-border">
            <img src={`/figma/plant-${plantIllustration(plant.id)}.png`} alt="Imagem ilustrativa" className="h-14 w-14 rounded-lg object-contain" />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-label text-xl leading-6 text-display">{name}</span>
              <span className="text-sm text-display">{events ? `${events.length} ${events.length === 1 ? "registro" : "registros"}${firstRecord ? ` desde ${ddmm(new Date(firstRecord))}` : ""}` : " "}</span>
              <span className="flex flex-wrap gap-1"><PanelTag tone={plant.current_phase !== "unknown" ? "calm" : "neutral"} label={phaseTagLabel(plant, events)} />{photos > 0 && <PanelTag tone="stable" label={`${photos} ${photos === 1 ? "FOTO" : "FOTOS"}`} />}</span>
            </span>
          </Link>
          <CalendarCard mode={mode} onMode={setMode} selected={selected} onSelect={tapDay} onShift={shift} kinds={kinds} weekCount={weekCount} filter={filter} onFilter={setFilter} />
        </div>
        <DiaryTimeline params={{ plant_id: plantId, include_archived: true }} filter={filter} historyStart={historyStart} historyLabel={historyLabel}
          focus={focus} selected={selected} onVisibleDay={setSelected} hrefOfEntry={e => routes.diaryEntry(e.plant_id, e.id)}
          onAdd={plant.is_active ? day => setSheet({ day, first: noHistory }) : undefined} />
      </div>
      {panel}
    </>
  );
}
