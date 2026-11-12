"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Lamp, Marker, PanelButton, PanelCard } from "@/components/panel";
import { BackLink, Button, Notice, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { usePlants } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { shortDayMonth } from "@/shared/lib/dates";
import { plantDisplayName } from "@/shared/lib/plantIdentity";
import type { PlantResponse } from "@/shared/types/api";

type Filter = "all" | "harvested" | "archived";
const isHarvested = (p: PlantResponse) => !!p.harvest_date;
/** Contrato do item 22 (/plants/summaries?is_active=false), opcional até o deploy: sem germinação, os de ciclo vêm null. */
type CycleSummary = { event_count?: number | null; cycle_days?: number | null };
/** "84 dias · 61 registros", "61 registros" ou nada (só a data). */
function cycleLine(s: CycleSummary | undefined): string | null {
  if (!s) return null;
  const parts = [s.cycle_days != null ? `${s.cycle_days} ${s.cycle_days === 1 ? "dia" : "dias"}` : null, s.event_count != null ? `${s.event_count} ${s.event_count === 1 ? "registro" : "registros"}` : null];
  return parts.filter(Boolean).join(" · ") || null;
}

/**
 * Plantas arquivadas e colhidas (UX itens 22 e 23b; estado E10 2424:23690): cartões esmaecidos com "COLHIDA" ou
 * "ARQUIVADA" e a data, "NÃO CONTA NO LIMITE" e "VER HISTÓRICO". Sem "Restaurar": o web e a API ainda não têm essa ação.
 */
export default function ArchivedPlantsPage() {
  const plants = usePlants({ is_active: false });
  const summaries = useQuery({ queryKey: ["plants", "summaries", { is_active: false }], queryFn: () => api<Record<string, CycleSummary>>("/plants/summaries?is_active=false") });
  const [filter, setFilter] = useState<Filter>("all");
  const list = (plants.data ?? []).filter(p => filter === "all" || (filter === "harvested") === isHarvested(p));
  const count = (f: Filter) => (plants.data ?? []).filter(p => f === "all" || (f === "harvested") === isHarvested(p)).length;
  return (
    <div className="flex max-w-[1200px] flex-col gap-4">
      <BackLink fallback={routes.plants()} />
      <h1 className="font-label text-[28px] leading-9 text-text-primary">Plantas arquivadas e colhidas</h1>
      <p className="text-sm leading-5 text-text-secondary">Os registros continuam disponíveis e não contam no limite do plano.</p>
      {plants.isPending ? <Spinner /> : plants.isError ? <div className="max-w-[600px]"><Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void plants.refetch()} /></div>
        : !plants.data.length ? <div className="max-w-[600px]"><Notice title="Nenhuma planta arquivada ou colhida" body="As plantas arquivadas ficam fora do acompanhamento atual e mantêm seu histórico." /></div> : <>
          <div role="radiogroup" aria-label="Filtrar" className="flex flex-wrap gap-1.5">
            {(["all", "harvested", "archived"] as const).map(f => (
              <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}
                className={`font-label min-h-9 px-2 text-[13px] leading-4 uppercase cursor-pointer ${filter === f ? "bg-display text-surface" : "text-display hover:bg-bg"}`}>
                {f === "all" ? "Todas" : f === "harvested" ? "Colhidas" : "Arquivadas"} · {count(f)}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-[14px] lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
            {list.map(p => (
              <PanelCard key={p.id} label={plantDisplayName(p)} className="opacity-80">
                <div className="flex items-center gap-2.5">
                  <Lamp state="none" />
                  <h2 className="font-label min-w-0 flex-1 truncate text-xl leading-6 text-text-primary">{plantDisplayName(p)}</h2>
                  <Marker>{isHarvested(p) ? `Colhida · ${shortDayMonth(p.harvest_date) ?? ""}` : `Arquivada · ${shortDayMonth(p.updated_at) ?? ""}`}</Marker>
                </div>
                <div className="flex flex-wrap gap-1.5">{cycleLine(summaries.data?.[p.id]) && <Marker>{cycleLine(summaries.data?.[p.id])}</Marker>}<Marker>Não conta no limite</Marker></div>
                <div className="flex"><PanelButton kind="clear" label="Ver histórico" href={routes.plant(p.id)} /></div>
              </PanelCard>
            ))}
          </div>
        </>}
    </div>
  );
}
