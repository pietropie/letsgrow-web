"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PanelTag, type PanelTone } from "@/components/grows/instruments";
import { NewEventPanel } from "@/components/plants/new-event-panel";
import { ActionRow, BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useBobAlerts, useEvents, useGrows, usePlant, usePlantSummaries } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { phases } from "@/shared/constants/theme";
import { dayMonthTime, daysSinceDate, shortDayMonth } from "@/shared/lib/dates";
import { PHASE_ICON_LABEL, dayCount, dayNumber, eventTypeLabel, eventsInLastDays, hasPlantDetails, isFeeding, isWatering, latest, nextPhase, percentText, phaseIcon, phaseStart, photoStats, shortPlantName, sortedEvents, wateringInterval } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";
import type { BobTipResponse, StrainResponse } from "@/shared/types/api";

const STRAIN_TYPE: Record<string, string> = { photo: "FOTOPERIÓDICA", auto: "AUTOFLORESCENTE" };
const SEED_TYPE: Record<string, string> = { feminized: "FEMINIZADA", regular: "REGULAR" };
const GENETICS: Record<string, string> = { indica: "INDICA", sativa: "SATIVA", hybrid: "HÍBRIDA" };
const PHASE_SHORT: Record<string, string> = { germination: "GERM.", seedling: "MUDA", veg: "VEGA", flower: "FLORA", late_flower: "FLORA", harvest: "COLHEITA", drying: "SECAGEM", curing: "CURA" };
const ddmm = (iso?: string | null) => { const d = iso ? new Date(iso) : null; return d && Number.isFinite(d.getTime()) ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}` : null; };
const relative = (iso?: string | null) => { if (!iso) return null; const days = daysSinceDate(iso); return days === 0 ? "HOJE" : days === 1 ? "ONTEM" : shortDayMonth(iso)?.toUpperCase() ?? null; };
const tech = "font-label text-sm leading-[17px] text-display";

function Metric({ title, icon, value, note, tone, valueTone = "var(--color-bg)" }: { title: string; icon: ReactNode; value: string; note: string; tone: string; valueTone?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className={tech}>{title}</span>
      <div className="flex items-center gap-1.5 self-stretch">{icon}<div className="flex-1 py-1 text-center text-base leading-[19px] text-display"><p style={{ background: valueTone }}>{value}</p><p style={{ background: tone }}>{note}</p></div></div>
    </div>
  );
}

/** Ficha da planta (Figma 2160:6740 e 2160:6828, planta ainda sem detalhes), web do letsgrow-mobile/app/(app)/plants/[plantId].tsx. */
export default function PlantPage() {
  const { id: plantId } = useParams<{ id: string }>();
  const [recording, setRecording] = useState(false);
  const plantQuery = usePlant(plantId);
  const eventsQuery = useEvents(plantId);
  const summaries = usePlantSummaries();
  const alerts = useBobAlerts();
  const grows = useGrows();
  const plant = plantQuery.data;
  const strain = useQuery({
    queryKey: ["strains", "match", plant?.strain_name], enabled: !!plant?.strain_name?.trim(),
    queryFn: () => api<StrainResponse | null>(`/strains/match?name=${encodeURIComponent(plant!.strain_name)}`).catch(() => null),
  });
  const tip = useQuery({ queryKey: ["plants", plantId, "bob-tip"], queryFn: () => api<BobTipResponse | null>(`/plants/${plantId}/bob-tip`).catch(() => null) });

  if (plantQuery.isPending) return <Spinner />;
  if (!plant) return <div className="flex max-w-[600px] flex-col gap-4"><BackLink fallback={routes.plants()} /><Button secondary label="Não foi possível carregar a planta. Tentar novamente" onClick={() => void plantQuery.refetch()} /></div>;

  const events = eventsQuery.data ?? [];
  const name = plantDisplayName(plant);
  const grow = grows.data?.find(g => g.id === plant.grow_id);
  const photos = photoStats(events);
  const panel = recording && <NewEventPanel open onClose={() => setRecording(false)} plantId={plant.id} growLabel={grow?.name} growId={plant.grow_id} />;
  const diaryHref = routes.plantDiary(plant.id)!;
  const add = plant.is_active;

  if (!hasPlantDetails(plant) && !photos.count) {
    const last = sortedEvents(events)[0];
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <BackLink fallback={routes.plants()} />
        <PageTitle>{name}</PageTitle>
        <PageSubtitle>{[grow?.name, "ainda sem foto"].filter(Boolean).join(" · ")}</PageSubtitle>
        <Notice title={events.length === 0 ? "Nenhum registro ainda" : events.length === 1 ? (["note", "observation"].includes(last?.event_type ?? "") ? "Uma nota registrada" : "Um registro feito") : `${events.length} registros feitos`}
          body="Seu histórico fica disponível mesmo com poucos detalhes." meta={last ? `${shortDayMonth(last.event_date)} · ${(eventTypeLabel[last.event_type] ?? "registro").toLowerCase()} manual` : undefined} />
        <ButtonLink label={`Abrir diário da ${shortPlantName(name)}`} href={diaryHref} />
        {add && <Button secondary label="Novo registro" onClick={() => setRecording(true)} />}
        <ActionRow title="Detalhes não informados" body="Você pode completar depois." href={routes.plantInfo(plant.id)} />
        {panel}
      </div>
    );
  }

  const summary = summaries.data?.[plant.id];
  const alert = alerts.data?.alerts.find(a => a.plant_id === plant.id);
  const watering = latest(events, isWatering);
  const feeding = latest(events, isFeeding);
  const interval = wateringInterval(events);
  const last = sortedEvents(events)[0];
  const week = eventsInLastDays(events);
  const next = nextPhase(plant.current_phase);
  const icon = phaseIcon(plant.current_phase);
  const start = phaseStart(plant, events);
  const phaseDays = start ? dayNumber(daysSinceDate(start)) : null;
  const lifeDays = plant.germination_date ? dayNumber(daysSinceDate(plant.germination_date)) : null;
  const appDays = dayNumber(daysSinceDate(plant.created_at));
  const thc = percentText(strain.data?.thc_pct);
  // A única estimativa cadastrada é a duração da floração (expected_harvest_days).
  const expected = phaseDays != null && plant.current_phase === "flower" && plant.expected_harvest_days ? plant.expected_harvest_days : null;
  const tags: [string, PanelTone][] = [
    [[plant.pot_label, plant.pot_volume_liters && `${plant.pot_volume_liters} L`, plant.substrate].filter(Boolean).join(" · ").toUpperCase(), "neutral"],
    [STRAIN_TYPE[plant.strain_type] ?? "", "neutral"], [SEED_TYPE[plant.seed_type] ?? "", "neutral"],
    [photos.count ? `${photos.count} ${photos.count === 1 ? "FOTO" : "FOTOS"} · ÚLT. ${ddmm(photos.last)}` : "", "stable"],
    [plant.genetics ? GENETICS[plant.genetics] : "", "neutral"],
    [thc ? `THC ${thc} · BANCO DE STRAINS` : "", "stable"],
  ];
  const temperature = summary?.temperature?.value ?? summary?.last_temperature_c ?? null;
  const humidity = summary?.humidity?.value ?? summary?.last_humidity_rh ?? null;
  const v = (n: string) => `var(--color-${n})`;
  const soft = "flex min-h-12 items-center justify-center gap-2.5 rounded-lg border-[0.5px] border-stroke-soft bg-surface px-4 py-1.5 text-base font-semibold text-display shadow-[4px_4px_4px_rgba(0,0,0,0.1)] hover:bg-surface-high";

  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.plants()} />
      <article className="flex flex-col gap-1 rounded-2xl border-[0.5px] border-stroke bg-surface px-2.5 py-4" aria-labelledby="plant-name">
        <div className="flex h-[217px] items-center justify-center"><img src={summary?.strain_image_url || `/figma/plant-${plantIllustration(plant.id)}.png`} alt="" className="h-[217px] w-[217px] object-contain" /></div>
        <p className="text-sm text-text-muted">Imagem ilustrativa</p>
        <div className="flex items-center gap-1.5"><img src="/figma/leaf-small.svg" alt="" /><h1 id="plant-name" className="font-label text-xl leading-6 text-display">{name}</h1></div>
        <div className="flex flex-wrap gap-1 pt-0.5 pb-1">{tags.filter(([label]) => label).map(([label, tone]) => <PanelTag key={label} label={label} tone={tone} />)}</div>
        <div className="h-px bg-stroke" />
        <div className="flex flex-col gap-2.5">
          <div className="mt-2 flex flex-col gap-1.5 rounded-lg bg-[#E1EBE6] p-2">
            <div className="flex items-center gap-1"><img src="/figma/bobby-28.svg" alt="" /><h2 className="font-label text-xl leading-6 text-display">Acompanhamento do Bobby</h2></div>
            <p className="text-base leading-6 text-display">{alert?.message ?? tip.data?.tip ?? "Nenhuma observação retornada para esta planta. Você pode conversar sobre os registros com o Bobby."}</p>
          </div>
          <div className="h-px bg-stroke" />
          <section className="flex flex-col gap-2" aria-label="Fase">
            <div className="flex items-center justify-between"><h2 className="font-label text-base text-display">FASE</h2><Link href={routes.plantInfo(plant.id)} aria-label="Editar fase" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg"><img src="/figma/edit.svg" alt="" /></Link></div>
            <div className="flex items-stretch gap-2">
              <div className="flex min-w-[53px] flex-col items-center justify-center">{icon && <img src={`/figma/phase-${icon}.svg`} alt="" />}<span className="text-sm text-display">{icon ? PHASE_ICON_LABEL[icon] : PHASE_SHORT[plant.current_phase] ?? "—"}</span></div>
              <div className="flex w-[55px] flex-col items-center justify-center gap-0.5 rounded-lg border border-display py-1"><span className="text-sm">TEMPO</span><span className="h-px self-stretch bg-stroke" /><span className="text-[26px] leading-[31px] font-black text-display">{phaseDays ?? "—"}</span><span className="text-sm">{phaseDays === 1 ? "dia" : "dias"}</span></div>
              <div className="flex flex-1 flex-col items-center gap-1 overflow-hidden rounded-lg border border-display">
                <div className="flex gap-1 pt-1.5 text-sm"><span>DIAS</span><span>{expected ? `${phaseDays} de ${expected}` : "sem estimativa"}</span></div>
                <span className="h-px self-stretch bg-stroke" />
                <div className="flex flex-wrap justify-center gap-[3px] px-1 pb-1.5" aria-hidden>{Array.from({ length: 28 }, (_, i) => <span key={i} className="h-[9px] w-[9px] rounded-full" style={{ background: expected && phaseDays && i < Math.round((phaseDays / expected) * 28) ? v("display") : v("stroke-soft") }} />)}</div>
              </div>
            </div>
            {next && <p className="flex items-center justify-center gap-1"><span className={tech}>PRÓXIMA FASE:</span><span className="bg-state-alert text-base font-semibold text-display">{phases[next]?.label.toUpperCase()}</span><PanelTag label="SEQUÊNCIA" /></p>}
            <div className="flex flex-wrap gap-1">
              {plant.germination_date && <><span className={`grow bg-state-stable px-1.5 text-center ${tech}`}>GERMINOU {ddmm(plant.germination_date)}</span><span className={`grow bg-bg px-1.5 text-center ${tech}`}>{dayCount(lifeDays!).toUpperCase()} DE VIDA</span></>}
              <span className={`grow bg-bg px-1.5 text-center ${tech}`}>NO APP: {dayCount(appDays).toUpperCase()}</span>
            </div>
          </section>
          <div className="h-px bg-stroke" />
          <section className="flex flex-col gap-1.5" aria-label="Registros">
            <div className="flex items-center justify-between"><h2 className="font-label text-base text-display">REGISTROS</h2><Link href={diaryHref} aria-label="Abrir diário" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg"><img src="/figma/edit.svg" alt="" /></Link></div>
            <div className="flex items-center gap-1.5">
              <Metric title="REGA" icon={<img src="/figma/watering.svg" alt="" />} value={watering?.water_volume_ml != null ? `${watering.water_volume_ml}ml` : "—"} note={relative(watering?.event_date) ?? "SEM REGISTRO"} tone={watering ? v("source-highlight") : v("bg")} />
              <span className="w-px self-stretch bg-stroke" />
              <Metric title="NUTRI" icon={<img src="/figma/fert.svg" alt="" />} value={feeding?.ppm != null ? `${feeding.ppm}ppm` : "—"} note={relative(feeding?.event_date) ?? "SEM REGISTRO"} tone={feeding ? v("source-highlight") : v("bg")} />
            </div>
            <div className="h-px bg-stroke" />
            <div className="flex items-center gap-1.5">
              <Metric title="VPD" icon={<img src="/figma/light.svg" alt="" width={37} height={35} />} value="—" note="SEM LEITURA" tone={v("bg")} />
              <span className="w-px self-stretch bg-stroke" />
              <Metric title="AMBIENTE" icon={<img src="/figma/temperature.svg" alt="" width={41} height={38} />} value={temperature != null ? `${Math.round(temperature)}º C` : "—"} note={humidity != null ? `${Math.round(humidity)}% UR` : "SEM LEITURA"}
                tone={humidity != null ? v("state-stable") : v("bg")} valueTone={temperature != null ? v("state-alert") : v("bg")} />
            </div>
            {interval && <p className="flex items-center gap-1.5"><PanelTag tone="alert" label={`INTERVALO MÉDIO: ${interval.days} ${interval.days === 1 ? "DIA" : "DIAS"}`} /><span className="flex-1 text-sm">Calculado a partir de {interval.count} regas registradas no diário.</span></p>}
            <div className="flex flex-wrap gap-1"><PanelTag tone="stable" label={`${week} ${week === 1 ? "REGISTRO" : "REGISTROS"} NA SEMANA`} />{last && <PanelTag label={`ÚLTIMO: ${dayMonthTime(last.event_date, " ")?.toUpperCase()}`} />}</div>
          </section>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          {add && <button type="button" onClick={() => setRecording(true)} className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-primary px-4 text-base font-semibold text-white hover:bg-primary-dark cursor-pointer">NOVO REGISTRO <img src="/figma/arrow-right.svg" alt="" /></button>}
          <Link href={diaryHref} className={soft}>ABRIR DIÁRIO · {events.length} {events.length === 1 ? "REGISTRO" : "REGISTROS"} <img src="/figma/chevron-right.svg" alt="" /></Link>
        </div>
      </article>
      <ActionRow title="Fotos da planta" body={photos.count ? `${photos.count} ${photos.count === 1 ? "imagem" : "imagens"} no histórico` : "Nenhuma imagem no histórico"} href={routes.plantPhotos(plant.id)} />
      <ActionRow title="Informações da planta" body="Detalhes opcionais · editar" href={routes.plantInfo(plant.id)} />
      {panel}
    </div>
  );
}
