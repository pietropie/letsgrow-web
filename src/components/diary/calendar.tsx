"use client";

import { PanelTag } from "@/components/grows/instruments";
import { monthDays, weekDays } from "@/shared/lib/diaryCalendar";
import { dayKey, entryKinds, markerColor, type DiaryEntry, type DiaryFilter, type MarkerKind } from "@/shared/lib/diaryEntries";

/**
 * Cartão do calendário do diário (Figma 2160:7004 Mês, 2246:7104 Semana, filtros do 8b), web do
 * letsgrow-mobile/components/diary/DiaryParts.tsx. `counts` traz registros e plantas por dia (calendário geral, 03C).
 */
const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const tech = "font-label text-sm leading-5 text-display";

export function kindsByDay(entries: DiaryEntry[]) {
  const map = new Map<string, MarkerKind[]>();
  entries.forEach(e => {
    const key = dayKey(e.event_date);
    const set = new Set([...(map.get(key) ?? []), ...entryKinds(e)]);
    map.set(key, [...set].filter(k => k !== "outro" || set.size === 1));
  });
  return map;
}

function Markers({ kinds }: { kinds: MarkerKind[] }) {
  return <span className="flex h-1.5 gap-0.5" aria-hidden>{kinds.slice(0, 3).map(k => <span key={k} className="h-1.5 w-1.5 rounded-full border-[0.5px] border-display" style={{ background: markerColor[k] }} />)}</span>;
}

function CalendarDay({ date, selected, outside, kinds, onPress, records, plants }: { date: Date; selected: boolean; outside?: boolean; kinds: MarkerKind[]; onPress: () => void; records?: number; plants?: number }) {
  const day = date.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const label = records == null
    ? `${day}${kinds.length ? `, ${kinds.length} tipo(s) de registro` : ""}`
    : `${day}, ${records ? `${records} ${records === 1 ? "registro" : "registros"}${plants ? ` de ${plants} ${plants === 1 ? "planta" : "plantas"}` : ""}` : "sem registros"}`;
  return (
    <button type="button" aria-pressed={selected} aria-label={label} onClick={onPress} className="relative flex h-[52px] w-11 flex-col items-center justify-center gap-[3px] cursor-pointer">
      <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-lg text-base ${selected ? "bg-display font-bold text-white" : outside ? "text-stroke" : "text-display hover:bg-bg"}`}>{date.getDate()}</span>
      {!!plants && plants > 1 && <span className="font-label absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full border-[0.5px] border-display bg-source-highlight px-[3px] text-[11px] leading-[13px] text-display">{plants}</span>}
      <Markers kinds={kinds} />
    </button>
  );
}

function WeekdayRow({ highlight }: { highlight?: number }) {
  return <div className="flex justify-between" aria-hidden>{WEEKDAYS.map((d, i) => <span key={d} className={`w-11 text-center ${tech} ${highlight === i ? "border-b-2 border-display" : ""}`}>{d}</span>)}</div>;
}

/** Chips de filtro do 8b: Regas, Notas e Fotos levam o ponto de cor do tipo e servem de legenda. */
export function FilterChips({ value, onChange }: { value: DiaryFilter; onChange: (f: DiaryFilter) => void }) {
  const items: [DiaryFilter, string, string | null][] = [["all", "Todos", null], ["waterings", "Regas", markerColor.rega], ["notes", "Notas", markerColor.nota], ["photos", "Fotos", markerColor.foto]];
  return (
    <div role="radiogroup" aria-label="Filtro de registros" className="flex flex-wrap gap-1.5">
      {items.map(([key, label, dot]) => {
        const on = value === key;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} onClick={() => onChange(key)}
            className={`flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm cursor-pointer ${on ? "border-display bg-display text-surface" : "border-stroke text-display hover:bg-bg"}`}>
            {dot && <span className="h-2 w-2 rounded-full border-[0.5px] border-display" style={{ background: dot }} />}{label}
          </button>
        );
      })}
    </div>
  );
}

export function CalendarCard({ mode, onMode, selected, onSelect, onShift, kinds, weekCount, counts, status, filter, onFilter }: {
  mode: "week" | "month"; onMode: (m: "week" | "month") => void; selected: Date; onSelect: (d: Date) => void; onShift: (n: number) => void;
  kinds: Map<string, MarkerKind[]>; weekCount: number; counts?: { records: Map<string, number>; plants: Map<string, number> };
  status?: string; filter: DiaryFilter; onFilter: (f: DiaryFilter) => void;
}) {
  const month = monthDays(selected), week = weekDays(selected);
  const daysWithRecords = month.filter(d => d.getMonth() === selected.getMonth() && kinds.has(dayKey(d))).length;
  const day = (d: Date, outside = false) => (
    <CalendarDay key={dayKey(d)} date={d} outside={outside} selected={dayKey(d) === dayKey(selected)} kinds={kinds.get(dayKey(d)) ?? []} onPress={() => onSelect(d)}
      records={counts ? counts.records.get(dayKey(d)) ?? 0 : undefined} plants={counts?.plants.get(dayKey(d))} />
  );
  const arrow = "flex h-11 w-11 items-center justify-center rounded-[10px] border border-display font-label text-base text-display hover:bg-bg cursor-pointer";
  return (
    <section aria-label="Calendário" className="flex flex-col gap-2 rounded-2xl border-[0.5px] border-stroke bg-surface px-3 pb-3">
      <div className="flex min-h-[72px] items-center gap-2">
        <div role="radiogroup" aria-label="Visualização" className="flex rounded-[10px] border border-display p-[3px]">
          {(["week", "month"] as const).map(m => <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => onMode(m)} className={`min-h-[38px] min-w-[76px] rounded-[7px] px-3.5 ${tech} cursor-pointer ${mode === m ? "bg-display text-white" : ""}`}>{m === "week" ? "SEMANA" : "MÊS"}</button>)}
        </div>
        <span className="flex-1" />
        <button type="button" aria-label={mode === "week" ? "Semana anterior" : "Mês anterior"} onClick={() => onShift(-1)} className={arrow}>‹</button>
        <button type="button" aria-label={mode === "week" ? "Próxima semana" : "Próximo mês"} onClick={() => onShift(1)} className={arrow}>›</button>
      </div>
      {mode === "month" ? <>
        <div className="flex items-center gap-2"><h3 className="font-label flex-1 text-base text-display">{MONTHS[selected.getMonth()]} {selected.getFullYear()}</h3><PanelTag label={status ?? `${daysWithRecords} ${daysWithRecords === 1 ? "DIA" : "DIAS"} COM REGISTRO`} /></div>
        <div className="h-px bg-stroke" />
        <WeekdayRow />
        {Array.from({ length: month.length / 7 }, (_, w) => <div key={w} className="flex justify-between">{month.slice(w * 7, w * 7 + 7).map(d => day(d, d.getMonth() !== selected.getMonth()))}</div>)}
        <div className="h-px bg-stroke" />
      </> : <>
        <div className="flex items-center gap-2"><h3 className="font-label flex-1 text-base text-display">{week[0].getDate()} – {week[6].getDate()} DE {MONTHS[week[6].getMonth()]}</h3><PanelTag label={status ?? `${weekCount} ${weekCount === 1 ? "REGISTRO" : "REGISTROS"}`} /></div>
        <WeekdayRow highlight={selected.getDay()} />
        <div className="flex justify-between pb-2">{week.map(d => day(d))}</div>
        <div className="h-px bg-stroke" />
      </>}
      <FilterChips value={filter} onChange={onFilter} />
    </section>
  );
}
