"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { ClimateCard, HomeGreeting, SkeletonCard } from "@/components/home/blocks";
import { AttentionPanel, BobbyPanel, EmptyPlantsPanel, EnvPanel, PlanPanel, PlantPanel } from "@/components/home/panel-home";
import { CornerLink, PanelCard, PanelTitle } from "@/components/panel";
import { GrowPicker, GrowPlaceFlow, type PlaceMode } from "@/components/home/place-flow";
import { InstallBanner } from "@/components/install-banner";
import { useUsage } from "@/lib/usage-client";
import { Button, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { usePlanConfigs } from "@/lib/account";
import { conversationsLine, exhaustedNotice, homeSuggestions, planBandView, type BriefSuggestion, type SummaryV3 } from "@/lib/home-v3";
import { normalizePlan } from "@/lib/plans";
import { growPanelProps, plantPanelProps } from "@/lib/panel-props";
import { useRecommendation } from "@/lib/recommendation-client";
import { ApiError, api } from "@/lib/api";
import { useActivePlants, useBobAlerts, useDailyBrief, useGrow, useGrows, useMinuteOfDay, usePlantSummaries, useRememberedGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { phases } from "@/shared/constants/theme";
import { attentionItems, climateFooter, compareClimate, greetingDate, growChoiceLine, outdoorLine, pickGrow, stamp, tipBasis, weatherCard, weatherIcon, whole, type AttentionItem, type Weather } from "@/shared/lib/homeClimate";
import { environmentMeasurement } from "@/shared/lib/measurements";
import { phaseDay } from "@/shared/lib/phaseDay";
import { plantDisplayName } from "@/shared/lib/plantIdentity";

const SOURCE: Record<string, string> = { manual: "manual", sensor: "sensor" };
const noSubscribe = () => () => {};


type DiaryPhotoEntry = { id: string; event_date: string; photo_urls: string[] };

/**
 * Início v3 (UX item 20; Figma N1–N4, faixa F1–F6, desktop W30 2407:21595), sobre o Início 2026 (H1–H9, W1–W5).
 * Celular: saudação, Seu plano, Precisa de atenção, plantas, Bobby, clima e ambiente. A partir de 768: a faixa do plano
 * larga; plantas em grade de 2 e atenção à esquerda, o Bobby à direita; clima e ambiente embaixo, lado a lado.
 * O plano e a oferta vêm de GET /billing/recommendation; o aviso de uso não entra mais em "Precisa de atenção".
 */
export default function HomePage() {
  const me = useMe();
  const usageMeter = useUsage();
  const usage = usageMeter.status === "ok" ? usageMeter.usage : null;
  const recommendation = useRecommendation();
  const rec = recommendation.status === "ok" ? recommendation.rec : null;
  const planConfigs = usePlanConfigs();
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
  const growPlants = (plants.data ?? []).filter(p => p.grow_id === grow?.id);
  const summaryOf = (id: string) => summaries.data?.[id] as (SummaryV3 & NonNullable<typeof summaries.data>[string]) | undefined;
  // Foto do cartão: `cover_image_url` do backend (a mais recente; sem foto, a genética). Enquanto o backend não manda o
  // campo, a mais recente do diário (mesma consulta da tela de Fotos), e a imagem da genética como reserva.
  const photos = useQueries({
    queries: growPlants.map(p => ({
      enabled: summaries.isSuccess && !(summaryOf(p.id) && "cover_image_url" in summaryOf(p.id)!),
      queryKey: ["diary", { plant_id: p.id, photos: true }],
      queryFn: () => api<DiaryPhotoEntry[]>(`/diary?plant_id=${p.id}&limit=100&include_archived=true`).then(list => list.filter(e => e.photo_urls?.length)),
      staleTime: 5 * 60_000,
    })),
  });

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

  // Faixa "Seu plano" (F1–F6): só com a recomendação e os planos carregados; nada inventado enquanto isso.
  const labelOf = (key: string | null | undefined) => key ? planConfigs.data?.find(p => p.plan_key === normalizePlan(key))?.label ?? null : null;
  const planName = rec ? labelOf(rec.current_plan) : null;
  const band = rec && planName ? planBandView(rec, usage, labelOf(rec.plan_key)) : null;
  const left = conversationsLine(usage);
  const unlimitedBobby = usage?.mode === "unlimited";
  const footer = `O resumo é gerado uma vez por dia e não gasta conversas.${unlimitedBobby ? "" : " Cada pergunta enviada gasta uma."}`;

  // N4 (Figma 2406:21946) — nada cadastrado ainda: conhecer sem pressão.
  if (!grows.isPending && !grows.isError && !activeGrows.length && plants.isSuccess && !plants.data.length) {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <div><PageTitle>No seu tempo.</PageTitle><PageSubtitle>Você ainda não precisa cadastrar nada.</PageSubtitle></div>
        {band && <PlanPanel name={planName!} view={{ ...band, offer: null }} link={{ label: "Ver planos", href: routes.plans() }} planHref={routes.plans()} />}
        <EmptyPlantsPanel plansHref={rec?.plan_key ? routes.plans() : null} addHref={routes.newGrow()!} />
        <BobbyPanel title="Olá, eu sou o Bobby" body="Posso explicar como o LetsGrow funciona e quais informações você controla."
          marker="Atalhos para a ajuda · não gastam conversas" suggestionsTitle="Para começar"
          suggestions={[
            { key: "help", label: "Como funciona o acompanhamento?", href: routes.help() },
            { key: "data", label: "Quem pode ver meus dados?", href: routes.beforeSharing() },
            { key: "plan", label: "O que é incluído no meu plano?", href: routes.creditHelp() },
          ]}
          exhausted={null} inputHref={routes.bobby()!} footer={null}
          meter={usage?.queries && usage.queries.total != null && usage.mode !== "unlimited" ? { used: usage.queries.used, total: usage.queries.total, text: left?.text ?? "" } : null} />
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
  const temperature = environmentMeasurement(env, "temperature"), humidity = environmentMeasurement(env, "humidity");
  const outdoor = grow.grow_type === "outdoor";
  const status = weather.error instanceof ApiError ? weather.error.response.status : null;
  const state = weatherCard({ data: weather.data, failed: !!weather.error, status });
  const w = weather.data;
  const tip = !outdoor && w?.weather_tip ? w.weather_tip : null;
  const place = grow.location_label ?? detail?.location_label ?? (state === "ok" ? "Local do ambiente" : null);
  const insideRef = temperature.value != null ? temperature : humidity;
  const insideTag = temperature.value != null || humidity.value != null
    ? [SOURCE[insideRef.source ?? ""] ?? null, stamp(insideRef.observed_at)].filter(Boolean).join(" · ").toUpperCase() || null : null;

  const plantIds = new Set(growPlants.map(p => p.id));
  const lastWatering = Object.fromEntries(growPlants.map(p => [p.id, summaries.data?.[p.id]?.last_watering_at]));
  // Item 20: o aviso de uso do Bobby fica só na faixa do plano.
  const attention = attentionItems({
    growId: grow.id, growName: grow.name, temperature, humidity, targetTemp: detail?.target_temp_c, targetRh: detail?.target_humidity_rh,
    alerts: (alerts.data?.alerts ?? []).filter(a => plantIds.has(a.plant_id)), lastWatering,
  });
  const attentionHref = (item: AttentionItem) =>
    item.target.kind === "grow" ? routes.growPanel(item.target.id) : item.target.kind === "diary" ? routes.plantDiary(item.target.id)
      : item.target.kind === "usage" ? routes.credits() : routes.bobbyObservation(item.target.id);


  const facts = growPlants.map(p => ({ id: p.id, name: plantDisplayName(p), phaseLabel: phases[p.current_phase]?.label ?? null, day: summaryOf(p.id)?.phase_day ?? phaseDay(p) ?? null, lastWatering: lastWatering[p.id] }));
  // Sugestões: `suggestions[]` do daily-brief (regras do backend, não gastam conversa; lista vazia esconde o bloco).
  // Enquanto o backend não manda o campo, o cliente monta com os itens de atenção e a fase.
  const fromBrief = (brief.data as { suggestions?: BriefSuggestion[] } | undefined)?.suggestions;
  const suggestions = fromBrief
    ? fromBrief.slice(0, 3).map((s, i) => ({ key: `s${i}`, label: s.label, href: routes.bobbyDraft(s.prompt || s.label, { plant_id: s.plant_id, grow_id: s.plant_id ? null : s.grow_id }) }))
    : homeSuggestions({ items: attention.items, plants: facts, growId: grow.id, growName: grow.name })
      .map(s => ({ ...s, href: routes.bobbyDraft(s.label, { plant_id: s.plantId, grow_id: s.growId }) }));
  const out = exhaustedNotice(usage);
  const b = brief.data;
  const q = usage?.queries;
  const meter = q && q.total != null && usage?.mode !== "unlimited" ? { used: q.used, total: q.total, text: left?.text ?? "" } : null;

  // Ambiente no painel (item 23b): lâmpada, mostradores com o marcador da origem ou "fora da faixa", luz e contagens.
  // Ambiente no painel (item 23b), com a mesma regra da lista de Ambientes.
  const envPanel = <EnvPanel {...growPanelProps({ grow: { ...grow, ...(detail ?? {}) }, plantCount: growPlants.length, items: attention.items, minute })} />;
  const climate = (
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
  );

  // W1p (1200, 3 colunas): plano, atenção e ambiente | plantas | Bobby e clima. Celular (I1): plano, atenção, plantas,
  // Bobby, clima e ambiente. As colunas viram "contents" abaixo de lg para a ordem do celular valer.
  return (
    <>
      {greeting}
      <InstallBanner />
      <div className="flex flex-col gap-[14px] lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          {band && <div className="order-1 lg:order-none"><PlanPanel name={planName!} view={band} link={{ label: "Uso e plano", href: routes.credits() }} planHref={routes.plans()} /></div>}
          {attention.total > 0 && <div className="order-2 lg:order-none"><AttentionPanel items={attention.items} total={attention.total} hrefOf={attentionHref} /></div>}
          <div className="order-6 lg:order-none">{envPanel}</div>
        </div>
        <section className="order-3 flex min-w-0 flex-col gap-[14px] lg:order-none lg:gap-5" aria-label="Suas plantas">
          {growPlants.length ? growPlants.map((plant, i) => (
            <PlantPanel key={plant.id} header={{ title: growPlants.length === 1 ? "Sua planta" : `Suas plantas · ${growPlants.length}`, calendarHref: routes.plantsCalendar() }}
              {...plantPanelProps({ plant, summary: summaryOf(plant.id), growName: grow.name, items: attention.items, hrefOf: attentionHref, diaryPhoto: photos[i]?.data?.[0]?.photo_urls?.[0], illustrate: true })} />
          )) : (
            <PanelCard label="Suas plantas">
              <PanelTitle right={<CornerLink href={routes.plantsCalendar()}>Ver calendário</CornerLink>}>Suas plantas</PanelTitle>
              <p className="text-[15px] leading-[21px] text-text">Nenhuma planta ativa neste ambiente.</p>
            </PanelCard>
          )}
        </section>
        <div className="contents lg:flex lg:flex-col lg:gap-5">
          <div className="order-4 lg:order-none">
            <BobbyPanel title={b?.title || "Pergunte sobre o seu cultivo"} body={b?.body}
              marker={b?.title ? "Resumo de hoje · feito com os seus registros" : "O resumo aparece quando houver registros"}
              suggestionsTitle="Sugestões pelo que você registrou" suggestions={suggestions}
              exhausted={out ? { text: `${out.title}. ${out.body}`, plansHref: rec?.plan_key ? routes.plans() : null } : null}
              inputHref={routes.bobby()!} meter={meter} footer={footer} />
          </div>
          <div className="order-5 lg:order-none">{climate}</div>
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
