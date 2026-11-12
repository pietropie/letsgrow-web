"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { type PanelTone } from "@/components/grows/instruments";
import { SegmentedDisplay } from "@/components/home/blocks";
import { CornerLink, Lamp, Marker, PanelButton, PanelCard, PanelTitle, type LampState } from "@/components/panel";
import { NewEventPanel } from "@/components/plants/new-event-panel";
import { ActionRow, BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { backendNextAction, nextMarker, readingMarker, type SummaryV3 } from "@/lib/home-v3";
import { useBobAlerts, useEvents, useGrows, usePlant, usePlantSummaries } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { phases } from "@/shared/constants/theme";
import { dayMonthTime, daysSinceDate, shortDayMonth } from "@/shared/lib/dates";
import { PHASE_ICON_LABEL, dayCount, dayNumber, eventTypeLabel, eventsInLastDays, hasPlantDetails, isFeeding, isWatering, latest, nextPhase, percentText, phaseIcon, phaseStart, photoStats, shortPlantName, sortedEvents, wateringInterval } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";
import { environmentMeasurement } from "@/shared/lib/measurements";
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

/**
 * Página da planta no painel (UX itens 24 e 24b; celular D2 2427:23864, web W6p 2429:24086), sobre a ficha (Figma 2160:6740;
 * 2160:6828 sem detalhes). Um cartão por bloco, com "Próxima ação" no topo; fase e registros são os blocos de sempre.
 */
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

  // Item 24 (W6p): "Próxima ação" no topo, um cartão por bloco, as peças do painel.
  const s = summary as (typeof summary & SummaryV3) | undefined;
  const fromBackend = backendNextAction(s);
  const nextLabel = fromBackend ? nextMarker(fromBackend, s?.last_watering_at) : alert ? nextMarker({ text: alert.message, watering: alert.action === "watering" }, s?.last_watering_at) : null;
  const nextHref = fromBackend ? (fromBackend.watering ? diaryHref : routes.bobbyObservation(plant.id)) : alert ? routes.bobbyObservation(plant.id) : null;
  const base = interval
    ? `Base: ${interval.count} regas no diário · intervalo médio de ${interval.days} ${interval.days === 1 ? "dia" : "dias"}.${watering ? ` A última foi ${relative(watering.event_date)?.toLowerCase()}.` : ""}`
    : fromBackend ? fromBackend.text : alert?.message ?? (last ? `Último registro: ${(eventTypeLabel[last.event_type] ?? "registro").toLowerCase()}, ${relative(last.event_date)?.toLowerCase()}.` : "Nenhum registro ainda. O primeiro registro ajuda o Bobby a acompanhar a planta.");
  const cover = s?.cover_image_url ?? null;
  const realPhoto = !!cover && cover === (s?.latest_photo_url ?? null);
  const lamp: LampState = nextLabel ? "attention" : "ok";
  const growTemp = environmentMeasurement(grow?.env, "temperature"), growRh = environmentMeasurement(grow?.env, "humidity");
  const rowLink = (title: string, body: string, href: string | null) => (
    <li key={title} className="border-b border-stroke last:border-b-0">
      <Link href={href ?? "#"} className="flex min-h-16 items-center gap-3 py-2.5 hover:bg-surface-high">
        <span className="flex flex-1 flex-col gap-0.5"><span className="text-base leading-6 font-semibold text-text-primary">{title}</span><span className="text-sm leading-5 text-text-secondary">{body}</span></span>
        <span aria-hidden className="text-text-primary">›</span>
      </Link>
    </li>
  );

  const photoCard = (
    <PanelCard label={name}>
      <Link href={routes.plantPhotos(plant.id)} aria-label="Fotos da planta" className="flex h-[240px] items-center justify-center">
        <img src={cover || summary?.strain_image_url || `/figma/plant-${plantIllustration(plant.id)}.png`} alt="" className={`h-[240px] w-full rounded-lg ${realPhoto ? "object-cover" : "object-contain"}`} />
      </Link>
      {!realPhoto && <p className="text-sm text-text-muted">Imagem ilustrativa</p>}
      <div className="flex items-center gap-2.5"><Lamp state={lamp} /><h1 id="plant-name" className="font-label text-2xl leading-7 text-text-primary">{name}</h1></div>
      <div className="flex flex-wrap gap-1.5">{tags.filter(([label]) => label).map(([label]) => <Marker key={label}>{label}</Marker>)}</div>
    </PanelCard>
  );
  const growCard = grow && (
    <PanelCard label={`Ambiente ${grow.name}`}>
      <PanelTitle divider lamp={growTemp.value == null && growRh.value == null ? "none" : "ok"} right={<CornerLink href={routes.growPanel(grow.id)}>Abrir painel</CornerLink>}>{grow.name}</PanelTitle>
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedDisplay size="small" value={growTemp.value == null ? null : Math.round(growTemp.value)} unit="°" label="Temperatura do ambiente" />
        <SegmentedDisplay size="small" value={growRh.value == null ? null : Math.round(growRh.value)} unit="%" label="Umidade do ambiente" />
        {(() => { const m = readingMarker(growTemp.value != null ? growTemp : growRh, null); return <Marker tone={m.tone}>{m.text}</Marker>; })()}
      </div>
    </PanelCard>
  );
  const nextCard = (
    <PanelCard label="Próxima ação">
      <PanelTitle right={nextLabel ? (nextHref ? <Link href={nextHref} className="hover:opacity-80"><Marker tone="light">{nextLabel}</Marker></Link> : <Marker tone="light">{nextLabel}</Marker>) : <Marker>Nada pendente</Marker>}>Próxima ação</PanelTitle>
      <p className="text-[15px] leading-[21px] text-text">{base}</p>
      <div className="flex gap-2.5">
        <PanelButton kind="clear" label="Bobby" href={routes.bobbyWith({ plantId: plant.id })} />
        {add && <PanelButton label="Registrar" onClick={() => setRecording(true)} />}
      </div>
    </PanelCard>
  );
  const phaseCard = (
    <PanelCard label="Fase">
      <div className="flex items-center justify-between"><h2 className="font-label text-lg text-display uppercase">Fase</h2><Link href={routes.plantInfo(plant.id)} aria-label="Editar fase" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg"><img src="/figma/edit.svg" alt="" /></Link></div>
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-[53px] flex-col items-center justify-center">{icon && <img src={`/figma/phase-${icon}.svg`} alt="" />}<span className="text-sm text-display">{icon ? PHASE_ICON_LABEL[icon] : PHASE_SHORT[plant.current_phase] ?? "—"}</span></div>
        <div className="flex w-[55px] flex-col items-center justify-center gap-0.5 rounded-lg border border-display py-1"><span className="text-sm">TEMPO</span><span className="h-px self-stretch bg-stroke" /><span className="text-[26px] leading-[31px] font-black text-display">{phaseDays ?? "—"}</span><span className="text-sm">{phaseDays === 1 ? "dia" : "dias"}</span></div>
        <div className="flex flex-1 flex-col items-center gap-1 overflow-hidden rounded-lg border border-display">
          <div className="flex gap-1 pt-1.5 text-sm"><span>DIAS</span><span>{expected ? `${phaseDays} de ${expected}` : "sem estimativa"}</span></div>
          <span className="h-px self-stretch bg-stroke" />
          <div className="flex flex-wrap justify-center gap-[3px] px-1 pb-1.5" aria-hidden>{Array.from({ length: 28 }, (_, i) => <span key={i} className="h-[9px] w-[9px] rounded-full" style={{ background: expected && phaseDays && i < Math.round((phaseDays / expected) * 28) ? v("display") : v("stroke-soft") }} />)}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {next && <p className="flex flex-1 items-center gap-1.5"><span className={tech}>PRÓXIMA FASE:</span><Marker tone="light">{phases[next]?.label}</Marker></p>}
        <div className="flex"><PanelButton kind="clear" label="Ver diário" href={diaryHref} /></div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plant.germination_date && <><Marker>Germinou {ddmm(plant.germination_date)}</Marker><Marker>{dayCount(lifeDays!)} de vida</Marker></>}
        <Marker>No app: {dayCount(appDays)}</Marker>
      </div>
    </PanelCard>
  );
  const linksCard = (
    <PanelCard label="Diário e arquivo">
      <ul className="-my-1 flex flex-col">
        {rowLink("Diário completo", `${events.length} ${events.length === 1 ? "registro" : "registros"} desta planta.`, diaryHref)}
        {rowLink("Fotos da planta", photos.count ? `${photos.count} ${photos.count === 1 ? "imagem" : "imagens"} no histórico` : "Nenhuma imagem no histórico", routes.plantPhotos(plant.id))}
        {rowLink(add ? "Marcar como colhida ou arquivar" : "Informações da planta", add ? "Nas informações da planta. O histórico continua disponível." : "Detalhes opcionais · editar", routes.plantInfo(plant.id))}
      </ul>
    </PanelCard>
  );
  const recordsCard = (
    <PanelCard label="Registros">
      <div className="flex items-center justify-between"><h2 className="font-label text-lg text-display uppercase">Registros</h2><Link href={diaryHref} aria-label="Abrir diário" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg"><img src="/figma/edit.svg" alt="" /></Link></div>
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
      <div className="flex flex-wrap gap-1.5"><Marker>{week} {week === 1 ? "registro" : "registros"} na semana</Marker>{last && <Marker>Último: {dayMonthTime(last.event_date, " ")}</Marker>}</div>
      {add && <div className="flex"><PanelButton kind="clear" label="Novo registro" onClick={() => setRecording(true)} /></div>}
    </PanelCard>
  );
  const bobbyCard = (
    <PanelCard tone="bobby" label="Acompanhamento do Bobby">
      <div className="flex items-center gap-2"><img src="/figma/bobby-28.svg" alt="" /><h2 className="font-label text-lg leading-6 text-display">Acompanhamento do Bobby</h2></div>
      <p className="text-[15px] leading-[21px] text-text">{alert?.message ?? tip.data?.tip ?? "Nenhuma observação retornada para esta planta. Você pode conversar sobre os registros com o Bobby."}</p>
      <div className="flex gap-2.5">
        <PanelButton kind="clear" label="Ver observação" href={routes.bobbyObservation(plant.id)} />
        <PanelButton kind="clear" label="Bobby" href={routes.bobbyWith({ plantId: plant.id })} />
      </div>
    </PanelCard>
  );

  // W6p: foto e ambiente | próxima ação, fase e diário | registros e Bobby. Celular (D2): a mesma ordem, empilhada.
  return (
    <>
      <BackLink fallback={routes.plants()} />
      <div className="flex flex-col gap-[14px] lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
        <div className="flex flex-col gap-[14px] lg:gap-5">{photoCard}{growCard}</div>
        <div className="flex flex-col gap-[14px] lg:gap-5">{nextCard}{phaseCard}{linksCard}</div>
        <div className="flex flex-col gap-[14px] lg:gap-5">{recordsCard}{bobbyCard}</div>
      </div>
      {panel}
    </>
  );
}
