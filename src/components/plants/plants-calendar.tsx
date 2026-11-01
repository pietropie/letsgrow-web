"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { CalendarCard, kindsByDay } from "@/components/diary/calendar";
import { DiaryTimeline, type TimelineGrouping } from "@/components/diary/timeline";
import { NewEventPanel } from "@/components/plants/new-event-panel";
import { api } from "@/lib/api";
import { routes } from "@/lib/routes";
import { addCalendarMonths, calendarPlants, diaryPeriod, historyStartOf, loadDiaryPeriod, plantsByDay, weekDays } from "@/shared/lib/diaryCalendar";
import { dayKey, type DiaryEntry, type DiaryFilter } from "@/shared/lib/diaryEntries";
import { phaseTagLabel } from "@/shared/lib/phaseDay";
import { plantCount } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";
import type { GrowSummary, PlantResponse } from "@/shared/types/api";

const MONTH_SHORT = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const query = (o: Record<string, unknown>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])).toString();

/** O ambiente vem do chip da página (Todos ou um), igual ao calendário geral do mobile (UX item 6, Figma 03C K–K4). */
export function PlantsCalendar({ plants, grows, growId }: { plants: PlantResponse[]; grows: GrowSummary[]; growId: string | null }) {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [mode, setMode] = useState<"week" | "month">("month");
  const [filter, setFilter] = useState<DiaryFilter>("all");
  const [sheet, setSheet] = useState<Date | null>(null);
  const [focus, setFocus] = useState<{ day: Date; seq: number } | null>(null);

  const scope = useMemo(() => calendarPlants(plants, growId, includeArchived), [plants, growId, includeArchived]);
  const byId = useMemo(() => new Map(plants.map(p => [p.id, p])), [plants]);
  const filters = { ...diaryPeriod(selected, mode), include_archived: includeArchived };
  const strip = useQuery({
    queryKey: ["diary", filters],
    queryFn: ({ signal }) => loadDiaryPeriod((offset, limit) => api<DiaryEntry[]>(`/diary?${query({ ...filters, limit, offset })}`, { signal })),
  });
  const scopeIds = useMemo(() => new Set(scope.map(p => p.id)), [scope]);
  const visible = useMemo(() => (strip.data ?? []).filter(e => scopeIds.has(e.plant_id)), [strip.data, scopeIds]);
  const kinds = useMemo(() => strip.isSuccess ? kindsByDay(visible) : new Map(), [strip.isSuccess, visible]);
  const counts = useMemo(() => {
    const perDay = new Map<string, number>();
    visible.forEach(e => perDay.set(dayKey(e.event_date), (perDay.get(dayKey(e.event_date)) ?? 0) + 1));
    return { records: perDay, plants: plantsByDay(visible) };
  }, [visible]);
  const weekStart = weekDays(selected)[0];
  const weekCount = visible.filter(e => { const t = new Date(e.event_date).getTime(); return t >= weekStart.getTime() && t < addDays(weekStart, 7).getTime(); }).length;
  const shift = (n: number) => setSelected(d => mode === "week" ? addDays(d, 7 * n) : startOfDay(addCalendarMonths(d, n)));
  const tapDay = (d: Date) => { setSelected(d); setFocus(f => ({ day: d, seq: (f?.seq ?? 0) + 1 })); };
  const keep = useCallback((e: DiaryEntry) => scopeIds.has(e.plant_id), [scopeIds]);
  const grouping: TimelineGrouping = useMemo(() => ({
    nameOf: e => byId.get(e.plant_id) ? plantDisplayName(byId.get(e.plant_id)) : e.plant_nickname || e.plant_name || "Planta",
    growOf: e => grows.find(g => g.id === byId.get(e.plant_id)?.grow_id)?.name ?? "",
    phaseOf: e => { const p = byId.get(e.plant_id); return p ? phaseTagLabel(p) : "FASE NÃO INFORMADA"; },
    imageOf: e => e.strain_image_url || `/figma/plant-${plantIllustration(e.plant_id)}.png`,
    hrefOf: plantId => routes.plantDiary(plantId),
  }), [byId, grows]);
  // Sem endpoint de limites: a lista para na germinação ou no cadastro mais antigo do escopo.
  const historyStart = historyStartOf(scope.flatMap(p => [p.germination_date, p.created_at]));
  const historyLabel = historyStart ? `PRIMEIRA PLANTA CADASTRADA EM ${historyStart.getDate()} ${MONTH_SHORT[historyStart.getMonth()]}` : "SEM PLANTAS NESTE FILTRO";
  const sheetPlants = scope.filter(p => p.is_active);
  const archivedCount = calendarPlants(plants, growId, true).length - calendarPlants(plants, growId, false).length;
  const sheetDate = (day: Date) => { const now = new Date(); const d = new Date(day); d.setHours(now.getHours(), now.getMinutes(), 0, 0); return d > now ? now : d; };

  return (
    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,400px)_1fr] md:gap-6">
      {/* W18: a coluna do calendário fica parada enquanto a linha do tempo rola. */}
      <div className="flex flex-col gap-3 md:sticky md:top-6">
        <p className="text-sm leading-[18px] text-[#4A4B4E]">
          {plantCount(scope.length)} · {includeArchived ? "arquivadas visíveis" : "arquivadas ocultas"} ·{" "}
          <button type="button" onClick={() => setIncludeArchived(v => !v)} className="underline cursor-pointer"
            aria-label={includeArchived ? "Ocultar plantas arquivadas" : `Mostrar plantas arquivadas${archivedCount ? `, ${archivedCount}` : ""}`}>{includeArchived ? "ocultar" : "mostrar"}</button>
        </p>
        <CalendarCard mode={mode} onMode={setMode} selected={selected} onSelect={tapDay} onShift={shift} kinds={kinds} weekCount={weekCount}
          counts={strip.isSuccess ? counts : undefined} status={strip.isPending ? "CARREGANDO…" : strip.isError ? "SEM DADOS" : undefined} filter={filter} onFilter={setFilter} />
      </div>
      <DiaryTimeline params={{ include_archived: includeArchived }} keep={keep} filter={filter} historyStart={historyStart} historyLabel={historyLabel}
        focus={focus} selected={selected} onVisibleDay={setSelected} grouping={grouping} hrefOfEntry={e => routes.diaryEntry(e.plant_id, e.id)}
        onAdd={sheetPlants.length ? day => setSheet(day) : undefined} />
      {sheet && <NewEventPanel open onClose={() => setSheet(null)} plants={sheetPlants} defaultPlantIds={sheetPlants.length === 1 ? [sheetPlants[0].id] : []}
        eventDate={sheetDate(sheet)} growLabel={growId ? grows.find(g => g.id === growId)?.name : undefined} growId={growId ?? undefined} />}
    </div>
  );
}
