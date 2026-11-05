"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { AttentionCard, BobbyBrief, ClimateCard, EnvironmentMini, HomeGreeting, HomePlantCard, SectionHeader, SkeletonCard } from "@/components/home/blocks";
import { GrowPicker, GrowPlaceFlow, type PlaceMode } from "@/components/home/place-flow";
import { InstallBanner } from "@/components/install-banner";
import { ActionRow, Button, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useActivePlants, useBobAlerts, useDailyBrief, useGrow, useGrows, useMinuteOfDay, usePlanStatus, usePlantSummaries, useRememberedGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { phases } from "@/shared/constants/theme";
import { shortDayMonth } from "@/shared/lib/dates";
import { attentionItems, climateFooter, compareClimate, greetingDate, growChoiceLine, lastRecordLine, outdoorLine, pickGrow, stamp, tipBasis, weatherCard, weatherIcon, whole, type AttentionItem, type Weather } from "@/shared/lib/homeClimate";
import { dialProgress, durationLabel, formatClock, offMinute, scheduleFromGrow } from "@/shared/lib/lightSchedule";
import { environmentMeasurement, formatMeasurementValue } from "@/shared/lib/measurements";
import { phaseDay } from "@/shared/lib/phaseDay";
import { PHASE_ICON_LABEL, phaseIcon } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";
import type { EnvironmentMeasurement } from "@/shared/types/api";

const SOURCE: Record<string, string> = { manual: "manual", sensor: "sensor" };
/** "manual 12:17", "sensor 19 out" ou "sem leitura". */
const readingCaption = (m: EnvironmentMeasurement) => m.value == null ? "sem leitura" : [m.source ? SOURCE[m.source] ?? m.source : null, stamp(m.observed_at)].filter(Boolean).join(" ");
const noSubscribe = () => () => {};

/**
 * Início 2026 (Figma H1–H9; desktop W1 2371:16940, tablet W3, W4 sem local, W5 clima indisponível).
 * Mesma lógica do letsgrow-mobile/app/(app)/index.tsx. No celular, uma coluna na ordem do mobile; a partir de 768,
 * duas colunas: clima e atenção | ambiente, plantas e resumo do Bobby.
 */
export default function HomePage() {
  const me = useMe();
  const planStatus = usePlanStatus();
  const grows = useGrows();
  const alerts = useBobAlerts();
  const plants = useActivePlants();
  const summaries = usePlantSummaries();
  const brief = useDailyBrief();
  const [remembered, select] = useRememberedGrow();
  const activeGrows = (grows.data ?? []).filter(g => g.status === "active");
  const grow = pickGrow(activeGrows, remembered);
  const detail = useGrow(grow?.id).data;
  const minute = useMinuteOfDay();
  const today = useSyncExternalStore(noSubscribe, () => greetingDate(), () => "");
  const [picker, setPicker] = useState(false);
  const [placeMode, setPlaceMode] = useState<PlaceMode>(null);

  // GET /weather?grow_id=: 409 = sem local (H2), 404 = de outra conta, 502/504 = o serviço não respondeu (H5).
  // Uma leitura nova de dentro pede de novo ao servidor (a previsão fica em cache lá).
  const lastInside = (["temperature", "humidity"] as const).map(m => environmentMeasurement(grow?.env, m).observed_at).filter(Boolean).sort().pop() ?? null;
  const weather = useQuery({
    queryKey: ["weather", grow?.id, lastInside], enabled: !!grow, staleTime: 10 * 60_000,
    queryFn: () => api<Weather>(`/weather?grow_id=${grow!.id}`),
    retry: (n, e) => n < 1 && !(e instanceof ApiError && e.response.status >= 400 && e.response.status < 500),
  });

  const name = me.data?.full_name?.trim().split(/\s+/)[0] ?? null;
  const greeting = <HomeGreeting name={name} date={today} grow={activeGrows.length > 1 ? grow?.name : null} onPickGrow={() => setPicker(true)} />;

  // Figma 2160:5187 — nada cadastrado ainda: conhecer sem pressão.
  if (!grows.isPending && !grows.isError && !activeGrows.length && plants.isSuccess && !plants.data.length) {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <PageTitle>No seu tempo.</PageTitle>
        <PageSubtitle>Você ainda não precisa cadastrar nada.</PageSubtitle>
        <Notice title="Olá, eu sou o Bobby" body="Posso explicar como o LetsGrow funciona e quais informações você controla." meta="Assistente de IA · conheça meus limites" />
        <ButtonLink label="Conhecer o acompanhamento" href={routes.help()} />
        <ActionRow title="Quem pode ver meus dados?" body="Entenda fotos, conversas e privacidade." href={routes.beforeSharing()} />
        <ActionRow title="O que é incluído?" body="Conhecer o serviço não consome créditos." href={routes.creditHelp()} />
        <ButtonLink secondary label="Cadastrar meu ambiente" href={routes.newGrow()!} />
        <InstallBanner />
      </div>
    );
  }
  // H6: a saudação na hora, esqueletos no resto.
  if (grows.isPending) {
    return (
      <>
        {greeting}
        <div className="grid gap-[14px] md:grid-cols-2 md:gap-6"><div className="flex flex-col gap-[14px] md:gap-5"><SkeletonCard tall /><SkeletonCard /></div><div className="flex flex-col gap-[14px] md:gap-5"><SkeletonCard tall /><SkeletonCard /></div></div>
      </>
    );
  }
  if (grows.isError || !grow) {
    return (
      <div className="flex max-w-[600px] flex-col gap-[14px]">
        {greeting}
        {grows.isError
          ? <Button secondary label="Tentar carregar ambientes novamente" onClick={() => void grows.refetch()} />
          : <><Notice title="Seu primeiro ambiente" body="Você pode começar com um espaço simples e completar depois." /><ButtonLink secondary label="Adicionar ambiente" href={routes.newGrow()!} /></>}
      </div>
    );
  }

  const env = detail?.env ?? grow.env;
  const temperature = environmentMeasurement(env, "temperature"), humidity = environmentMeasurement(env, "humidity"), vpd = environmentMeasurement(env, "vpd");
  const outdoor = grow.grow_type === "outdoor";
  const status = weather.error instanceof ApiError ? weather.error.response.status : null;
  const state = weatherCard({ data: weather.data, failed: !!weather.error, status });
  const w = weather.data;
  const tip = !outdoor && w?.weather_tip ? w.weather_tip : null;
  const place = grow.location_label ?? detail?.location_label ?? (state === "ok" ? "Local do ambiente" : null);
  const insideRef = temperature.value != null ? temperature : humidity;
  const insideTag = temperature.value != null || humidity.value != null
    ? [SOURCE[insideRef.source ?? ""] ?? null, stamp(insideRef.observed_at)].filter(Boolean).join(" · ").toUpperCase() || null : null;

  const growPlants = (plants.data ?? []).filter(p => p.grow_id === grow.id);
  const plantIds = new Set(growPlants.map(p => p.id));
  const attention = attentionItems({
    growId: grow.id, growName: grow.name, temperature, humidity, targetTemp: detail?.target_temp_c, targetRh: detail?.target_humidity_rh,
    alerts: (alerts.data?.alerts ?? []).filter(a => plantIds.has(a.plant_id)),
    lastWatering: Object.fromEntries(growPlants.map(p => [p.id, summaries.data?.[p.id]?.last_watering_at])),
  });
  const attentionHref = (item: AttentionItem) =>
    item.target.kind === "grow" ? routes.growPanel(item.target.id) : item.target.kind === "diary" ? routes.plantDiary(item.target.id) : routes.bobbyObservation(item.target.id);

  const schedule = scheduleFromGrow(detail ?? grow);
  const progress = dialProgress(schedule.onAt, schedule.light, minute);
  const light = {
    header: schedule.onAt != null && schedule.light != null && schedule.light < 1440 ? `LUZ · ${formatClock(schedule.onAt)} → ${formatClock(offMinute(schedule.onAt, schedule.light))}` : "LUZ",
    state: progress.kind === "none" ? "—" : progress.kind === "full" || progress.lit ? "LUZ" : "ESCURO",
    sub: progress.kind === "cycle" ? (progress.lit ? `faltam ${durationLabel(progress.remaining)}` : `liga às ${formatClock(progress.on)}`) : progress.kind === "full" ? "o dia todo" : "",
    caption: progress.kind === "none" ? "sem programação" : "pela programação", onAt: schedule.onAt, minutes: schedule.light, minute,
  };
  const range = (target: number | null | undefined, unit: string) => target != null ? `faixa ${whole(target)}${unit}` : null;

  const plan = planStatus.data;
  const usage = plan?.ai_queries_per_month != null ? `${plan.ai_queries_used} de ${plan.ai_queries_per_month} consultas usadas este mês` : null;
  const b = brief.data;
  const generated = b?.generated_at ? (stamp(b.generated_at)?.includes(":") ? `Gerado hoje ${stamp(b.generated_at)}` : `Gerado em ${stamp(b.generated_at)}`) : null;

  return (
    <>
      {greeting}
      <InstallBanner />
      <div className="grid items-start gap-[14px] md:grid-cols-2 md:gap-6">
        <div className="flex flex-col gap-[14px] md:gap-5">
          <ClimateCard
            state={state} growName={grow.name} outdoor={outdoor} place={place}
            weather={w ? { t: whole(w.temperature), rh: whole(w.humidity), icon: weatherIcon(w), condition: w.weather_description, line: outdoorLine(w) } : null}
            inside={{ t: temperature.value, rh: humidity.value, tag: insideTag }}
            compare={w && !outdoor ? compareClimate({ t: w.temperature, rh: w.humidity }, { t: temperature.value, rh: humidity.value }) : null}
            tip={tip ? { title: tip.title, text: tip.body, basis: tipBasis(tip.sources) } : null}
            footer={climateFooter({ fetchedAt: w?.fetched_at, inside: !outdoor && (temperature.value != null || humidity.value != null) ? { source: insideRef.source, observedAt: insideRef.observed_at } : null, tip: !!tip })}
            onLocate={() => setPlaceMode("locate")} onSearch={() => setPlaceMode("city")}
            onChangePlace={() => setPlaceMode("place")} onRetry={() => void weather.refetch()}
            readingHref={routes.growReading(grow.id)}
            askTipHref={tip ? routes.bobbyAsk(tip.cta_prompt || tip.title, { grow_id: grow.id }) : null} />
          <AttentionCard items={attention.items} total={attention.total} hrefOf={attentionHref} />
        </div>
        <div className="flex flex-col gap-[14px] md:gap-5">
          <EnvironmentMini growName={grow.name} panelHref={routes.growPanel(grow.id)}
            temperature={{ value: temperature.value == null ? null : whole(temperature.value), unit: "°", caption: [range(detail?.target_temp_c, " °"), readingCaption(temperature)].filter(Boolean).join(" · ") }}
            humidity={{ value: humidity.value == null ? null : whole(humidity.value), unit: "%", caption: [range(detail?.target_humidity_rh, " %"), readingCaption(humidity)].filter(Boolean).join(" · ") }}
            vpd={vpd.value == null ? { text: "—", caption: "sem leitura" } : { text: `${formatMeasurementValue(vpd.value)} kPa`, caption: [vpd.source === "sensor" ? "sensor" : "calculado", stamp(vpd.observed_at)].filter(Boolean).join(" · ") }}
            light={light}
            exhaust={detail?.exhaust_power_pct != null ? { value: `${detail.exhaust_power_pct} %`, caption: `registrado ${shortDayMonth(detail.exhaust_power_updated_at) ?? ""}`.trim() } : null} />
          <section className="flex flex-col gap-2" aria-label="Suas plantas">
            <SectionHeader title="SUAS PLANTAS" action="Ver calendário" href={routes.plantsCalendar()} />
            {growPlants.length ? (
              // Celular: faixa com rolagem e encaixe (no lugar do carrossel); tablet e desktop: grade com quebra (W1).
              <div className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                {growPlants.map(plant => {
                  const icon = phaseIcon(plant.current_phase), day = phaseDay(plant);
                  const strain = summaries.data?.[plant.id]?.strain_image_url;
                  return (
                    <HomePlantCard key={plant.id} name={plantDisplayName(plant)} href={routes.plant(plant.id)}
                      photo={strain || `/figma/plant-${plantIllustration(plant.id)}.png`}
                      phase={icon ? { icon: `/figma/phase-${icon}.svg`, label: PHASE_ICON_LABEL[icon] } : null}
                      phaseLine={[phases[plant.current_phase]?.label ?? "Fase não informada", day && `dia ${day}`].filter(Boolean).join(" · ")}
                      last={lastRecordLine(summaries.data?.[plant.id]?.last_event_at) ?? "histórico da planta"} />
                  );
                })}
              </div>
            ) : <p className="text-sm leading-5 text-text-secondary">Nenhuma planta ativa neste ambiente.</p>}
          </section>
          {!!b?.title && (
            <BobbyBrief title={b.title} body={b.body} footer={[generated, usage].filter(Boolean).join(" · ")}
              askHref={b.cta_prompt ? routes.bobbyAsk(b.cta_prompt, { plant_id: b.plant_id }) : null} />
          )}
        </div>
      </div>

      <GrowPlaceFlow growId={grow.id} growName={grow.name} mode={placeMode} onClose={() => setPlaceMode(null)} />
      <GrowPicker open={picker} onClose={() => setPicker(false)} current={grow.id} onPick={id => { select(id); setPicker(false); }}
        grows={activeGrows.map(g => {
          const e = g.id === grow.id ? env : g.env;
          return { id: g.id, name: g.name, line: growChoiceLine(g, environmentMeasurement(e, "temperature").value, environmentMeasurement(e, "humidity").value) };
        })} />
    </>
  );
}
