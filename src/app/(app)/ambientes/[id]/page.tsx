"use client";

/* eslint-disable @next/next/no-img-element */
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SegmentedDisplay } from "@/components/home/blocks";
import { GrowPicker } from "@/components/home/place-flow";
import { ExhaustDimmer, PanelTag, PhotoperiodDial, PpfdGauge, type PanelTone } from "@/components/grows/instruments";
import { CornerLink, Lamp, Marker, PanelButton, PanelCard, PanelLabel, PanelTitle, type LampState } from "@/components/panel";
import { BackLink, Button, Spinner } from "@/components/ui";
import { backendNextAction, nextAction, nextMarker, readingMarker, type SummaryV3 } from "@/lib/home-v3";
import { api } from "@/lib/api";
import { useBobAlerts, useGrow, useGrowPlants, useGrows, useMinuteOfDay, usePlantSummaries, useRememberedGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { dayMonthTime } from "@/shared/lib/dates";
import { hasExhaust } from "@/shared/lib/exhaustDimmer";
import { carbonFilterLabel, exhaustDescription, fans, growTypeLabel, lightDescription, locationLabel } from "@/shared/lib/growEquipment";
import { attentionItems, growChoiceLine } from "@/shared/lib/homeClimate";
import { dialProgress, durationLabel, formatClock, offMinute, photoperiodText, scheduleFromGrow } from "@/shared/lib/lightSchedule";
import { environmentMeasurement } from "@/shared/lib/measurements";
import { phaseDay } from "@/shared/lib/phaseDay";
import { plantCount } from "@/shared/lib/plantFacts";
import { plantDisplayName } from "@/shared/lib/plantIdentity";
import type { EquipmentKind } from "@/shared/lib/equipmentForms";
import type { GrowResponse } from "@/shared/types/api";

const PHASE_TAG: Record<string, string> = { germination: "GERMINAÇÃO", seedling: "MUDA", veg: "VEGA", flower: "FLORA", late_flower: "FLORA FINAL", harvest: "COLHEITA", drying: "SECAGEM", curing: "CURA" };
function CardTitle({ icon, title, edit }: { icon: ReactNode; title: string; edit?: { label: string; href: string } }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">{icon}<h2 className="font-label text-base leading-[19px] text-display">{title}</h2></div>
      {edit && <Link href={edit.href} aria-label={edit.label} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg"><img src="/figma/edit.svg" alt="" /></Link>}
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-2"><span className="font-label text-sm leading-4 text-display">{label}</span><span className="flex-1 bg-bg text-center text-sm leading-[17px] text-display">{value}</span></div>;
}

/**
 * Painel do ambiente no painel (UX itens 24 e 24b; celular D1 2427:23503, web W5p 2429:23825). Um cartão por bloco, com
 * "Precisa de atenção" no topo; iluminação (PPFD e timer), exaustão (knob) e ventilação são os blocos de sempre.
 */
export default function GrowPanelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const grows = useGrows();
  const growQuery = useGrow(id);
  const plantsQuery = useGrowPlants(id);
  const summaries = usePlantSummaries();
  const alerts = useBobAlerts();
  const [, select] = useRememberedGrow();
  const [picker, setPicker] = useState(false);
  const minute = useMinuteOfDay();

  const grow = growQuery.data;
  const plants = plantsQuery.data ?? [];
  const active = (grows.data ?? []).filter(g => g.status === "active");

  // O servidor responde com o ambiente; sem o valor enviado, não foi gravado (backend sem o campo): é erro, nunca "REGISTRADO".
  const saveExhaustPower = async (pct: number) => {
    const saved = await api<GrowResponse>(`/grows/${id}`, { method: "PATCH", body: { exhaust_power_pct: pct } });
    if (saved.exhaust_power_pct !== pct) throw new Error("exhaust_power_pct not stored");
    await client.invalidateQueries({ queryKey: ["grows"] });
  };

  if (growQuery.isPending) return <Spinner />;
  if (growQuery.isError || !grow) {
    return <div className="flex max-w-[600px] flex-col gap-4"><BackLink fallback={routes.grows()} /><Button secondary label="Não foi possível carregar o ambiente. Tentar novamente" onClick={() => void growQuery.refetch()} /></div>;
  }

  const form = (kind: EquipmentKind) => routes.growEquipmentForm(grow.id, kind);
  const temperature = environmentMeasurement(grow.env, "temperature");
  const light = environmentMeasurement(grow.env, "light");
  const withExhaust = hasExhaust(grow.exhaust_type);
  const schedule = scheduleFromGrow(grow);
  const fanList = fans(grow);
  const archived = grow.status === "abandoned";
  const scheduleTag = schedule.incomplete ? null : schedule.light == null ? null
    : schedule.light >= 1440 ? "PROGRAMAÇÃO · 24/0"
    : schedule.onAt == null ? `PROGRAMAÇÃO · ${photoperiodText(schedule.light)}`
    : `PROGRAMAÇÃO · ${formatClock(schedule.onAt)} → ${formatClock(offMinute(schedule.onAt, schedule.light))}`;
  const lightTone: PanelTone = light.value == null ? "alert" : light.source === "sensor" ? "pink" : "calm";
  const progress = dialProgress(schedule.onAt, schedule.light, minute);
  const lightNow = progress.kind === "full" ? { lit: true, text: "Luz acesa · o dia todo" } : progress.kind === "cycle" ? (progress.lit ? { lit: true, text: `Luz acesa · faltam ${durationLabel(progress.remaining)}` } : { lit: false, text: `Luz apagada · liga às ${formatClock(progress.on)}` }) : null;

  // Item 24 (W5p): "Precisa de atenção" no topo, um cartão por bloco, as peças do painel.
  const humidity = environmentMeasurement(grow.env, "humidity"), vpd = environmentMeasurement(grow.env, "vpd");
  const ids = new Set(plants.map(p => p.id));
  const attention = attentionItems({
    growId: grow.id, growName: grow.name, temperature, humidity, targetTemp: grow.target_temp_c, targetRh: grow.target_humidity_rh,
    alerts: (alerts.data?.alerts ?? []).filter(a => ids.has(a.plant_id)),
    lastWatering: Object.fromEntries(plants.map(p => [p.id, summaries.data?.[p.id]?.last_watering_at])),
  });
  const first = attention.items[0];
  const out = (key: string) => { const it = attention.items.find(i => i.key === key); return it ? (/ abaixo /.test(it.title) ? "abaixo" : "acima") : null; };
  const tOut = out("range-temperature"), hOut = out("range-humidity");
  const lamp: LampState = attention.total ? "attention" : temperature.value == null && humidity.value == null ? "none" : "ok";
  const dims = grow.tent_width_cm != null && grow.tent_depth_cm != null && grow.tent_height_cm != null ? `${grow.tent_width_cm}×${grow.tent_depth_cm}×${grow.tent_height_cm}` : null;
  const phaseNames = [...new Set(plants.map(p => PHASE_TAG[p.current_phase]).filter(Boolean))];
  const pots = grow.pot_count ?? 0;
  const facts = [
    grow.days_running != null ? `Há ${grow.days_running} ${grow.days_running === 1 ? "dia" : "dias"}` : null,
    [plantCount(plants.length), pots ? `${pots} ${pots === 1 ? "vaso" : "vasos"}` : null].filter(Boolean).join(" · "),
    phaseNames.length ? phaseNames.join(" e ") : null,
  ].filter((x): x is string => !!x);

  const attentionCard = first && (
    <PanelCard label="Precisa de atenção">
      <PanelTitle lamp="attention" right={<Marker tone="out">{first.tag === "AMBIENTE" ? first.title.replace(` da ${grow.name}`, "") : first.tag}</Marker>}>Precisa de atenção</PanelTitle>
      <p className="text-[15px] leading-[21px] text-text">{first.title}. {first.meta}.</p>
      {attention.items.slice(1).map(i => <p key={i.key} className="text-sm leading-5 text-text-secondary">· {i.title} — {i.meta}</p>)}
      <div className="flex"><PanelButton kind="clear" label="Perguntar ao Bobby" href={routes.bobbyDraft(`${first.title}. O que você recomenda?`, first.target.kind === "grow" ? { grow_id: grow.id } : { plant_id: first.target.id })} /></div>
    </PanelCard>
  );
  const reading = (label: string, value: number | null, unit: "°" | "%", target: number | null | undefined, outOf: string | null) => (
    <div className="flex flex-col gap-1.5">
      <PanelLabel>{label}</PanelLabel>
      <SegmentedDisplay value={value == null ? null : Math.round(value)} unit={unit} label={label} />
      {target != null ? <Marker tone={outOf ? "out" : "plain"}>Alvo {Math.round(target)}{unit === "°" ? "°" : "%"}</Marker> : <Marker>Sem alvo</Marker>}
    </div>
  );
  const vpdMarker = readingMarker(vpd, null);
  const envCard = (
    <PanelCard label="Ambiente">
      <PanelTitle divider right={<CornerLink href={routes.growEdit(grow.id)}>Editar alvos</CornerLink>}>Ambiente</PanelTitle>
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {reading("Temperatura", temperature.value, "°", grow.target_temp_c, tOut)}
        {reading("Umidade", humidity.value, "%", grow.target_humidity_rh, hOut)}
      </div>
      {grow.grow_type !== "outdoor" && (
        <div className="flex flex-wrap items-center gap-2">
          <PanelLabel>VPD · kPa</PanelLabel>
          <SegmentedDisplay size="small" value={vpd.value} unit="" label="VPD" />
          <Marker>{vpd.value == null ? "Sem leitura" : vpd.source === "sensor" ? "Sensor" : "Calculado"}</Marker>
          {vpd.value != null && <Marker tone={vpdMarker.tone}>{vpdMarker.text}</Marker>}
        </div>
      )}
      {temperature.value != null && <div className="flex"><Marker tone={readingMarker(temperature, null).tone}>{readingMarker(temperature, null).text}</Marker></div>}
      <div className="mt-auto flex gap-2.5">
        <PanelButton kind="clear" label="Histórico" href={routes.growHistory(grow.id)} />
        {!archived && <PanelButton label="Registrar" href={routes.growReading(grow.id)} />}
      </div>
    </PanelCard>
  );
  const plantsCard = (
    <PanelCard label="Plantas neste ambiente">
      <PanelTitle divider>Plantas neste ambiente · {plants.length}</PanelTitle>
      <ul className="flex flex-col">
        {plants.map(plant => {
          const s = summaries.data?.[plant.id] as (typeof summaries.data extends Record<string, infer T> | undefined ? T : never) & SummaryV3 | undefined;
          const fromBackend = backendNextAction(s);
          const local = fromBackend === undefined ? nextAction(plant.id, attention.items, s?.last_watering_at) : null;
          const next = fromBackend ? nextMarker(fromBackend, s?.last_watering_at) : local ? nextMarker({ text: local.text, watering: local.tag === "REGA" }, s?.last_watering_at) : null;
          const day = s?.phase_day ?? phaseDay(plant);
          return (
            <li key={plant.id}>
              <Link href={routes.plant(plant.id) ?? "#"} className="flex min-h-12 items-center gap-2.5 py-1.5 hover:bg-surface-high">
                <Lamp state={next ? "attention" : "ok"} />
                <span className="font-label text-lg leading-6 text-text-primary">{plantDisplayName(plant)}</span>
                <span className="flex flex-1 flex-wrap gap-1.5">
                  <Marker>{(PHASE_TAG[plant.current_phase] ?? "Fase não informada") + (day ? ` · dia ${day}` : "")}</Marker>
                  {next && <Marker tone="light">{next}</Marker>}
                </span>
                <span aria-hidden className="text-text-primary">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!plants.length && <p className="text-[15px] leading-[21px] text-text">Nenhuma planta ativa neste ambiente.</p>}
      {routes.newPlant(grow.id) && !archived && <div className="flex"><PanelButton kind="clear" label="Adicionar planta" href={routes.newPlant(grow.id)} /></div>}
    </PanelCard>
  );
  const lightCard = (
    <PanelCard label="Iluminação">
      <CardTitle icon={<img src="/figma/light.svg" alt="" />} title="ILUMINAÇÃO" edit={{ label: "Editar iluminação", href: form("light") }} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm leading-[17px] text-display">{lightDescription(grow) ?? "Luminária não informada"}</span>
        {schedule.light != null && (
          <span className="flex min-w-[160px] flex-1">
            <span className="flex flex-1 items-center justify-center gap-2.5 bg-state-alert px-2.5 text-sm"><img src="/figma/sun-small.svg" alt="" />{durationLabel(schedule.light)}</span>
            <span className="flex flex-1 items-center justify-center gap-2.5 bg-stroke-soft px-2.5 text-sm"><img src="/figma/moon-small.svg" alt="" />{durationLabel(1440 - schedule.light)}</span>
          </span>
        )}
      </div>
      {/* UX 2a: o timer centralizado à direita da régua, sempre na mesma linha; ele encolhe em vez de quebrar. */}
      <div className="@container flex items-center gap-3">
        <PpfdGauge value={null} badge="SEM LEITURA" />
        <div className="flex min-w-0 flex-1 justify-center"><PhotoperiodDial onAt={schedule.onAt} light={schedule.light} lastReading={light} /></div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {lightNow && <Marker tone={lightNow.lit ? "light" : "plain"}>{lightNow.text}</Marker>}
        {/* Programação incompleta ou ausente abre o formulário de Iluminação (Figma 02C J6/J10). */}
        {scheduleTag ? <Marker>{scheduleTag}</Marker>
          : <Link href={form("light")} aria-label={schedule.incomplete ? "Programação incompleta. Completar a programação de luz" : "Sem programação de luz. Cadastrar a programação"}>
            <Marker tone={schedule.incomplete ? "out" : "plain"}>{schedule.incomplete ? "Programação incompleta" : "Sem programação"}</Marker>
          </Link>}
        <PanelTag tone={lightTone} label={light.value == null ? "ESTADO ATUAL: SEM LEITURA" : `LUZ: ${Math.round(light.value)} LUX · ${dayMonthTime(light.observed_at, " ")?.toUpperCase() ?? "SEM DATA"}`} />
      </div>
    </PanelCard>
  );
  const linksCard = (
    <PanelCard label="Histórico e arquivo">
      <ul className="-my-1 flex flex-col">
        {[
          { title: "Histórico do ambiente", body: "Leituras, luz e equipamentos ao longo do tempo.", href: routes.growHistory(grow.id) },
          ...(!archived ? [{ title: "Arquivar ambiente", body: "O histórico continua disponível.", href: routes.growEdit(grow.id) }] : []),
        ].map(r => (
          <li key={r.title} className="border-b border-stroke last:border-b-0">
            <Link href={r.href} className="flex min-h-16 items-center gap-3 py-2.5 hover:bg-surface-high">
              <span className="flex flex-1 flex-col gap-0.5"><span className="text-base leading-6 font-semibold text-text-primary">{r.title}</span><span className="text-sm leading-5 text-text-secondary">{r.body}</span></span>
              <span aria-hidden className="text-text-primary">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
  const exhaustCard = (
    <PanelCard label="Exaustão">
      <div className="flex flex-wrap items-start gap-2.5">
        <div className="flex min-w-[180px] flex-1 flex-col gap-2.5">
          <CardTitle icon={<img src="/figma/exhaust.svg" alt="" />} title="EXAUSTÃO" edit={{ label: "Editar exaustão", href: form("exhaust") }} />
          <p className="text-sm leading-[17px] text-display">{exhaustDescription(grow) ?? "Exaustão não informada"}</p>
          {withExhaust && <p className="text-sm leading-[17px] text-display">Registra o ajuste do seu controlador. O app não liga nem regula o exaustor.</p>}
          <div className="flex flex-col gap-1">
            <Field label="LOCAL:" value={locationLabel(grow.exhaust_location)} />
            <Field label="FILTRO DE AR:" value={carbonFilterLabel(grow.carbon_filter)} />
          </div>
        </div>
        <ExhaustDimmer value={grow.exhaust_power_pct ?? null} updatedAt={grow.exhaust_power_updated_at ?? null} enabled={withExhaust && !archived} onSave={saveExhaustPower} />
      </div>
    </PanelCard>
  );
  const fanCard = (
    <PanelCard label="Ventilação" className="!flex-row !gap-0">
      {(fanList.length ? fanList : [{ title: "Ventilação não informada", location: "NÃO INFORMADO" }]).map((fan, i) => (
        <div key={i} className={`flex flex-1 flex-col gap-1.5 ${i > 0 ? "border-l border-stroke pl-2" : "pr-2"}`}>
          <CardTitle icon={<img src="/figma/fan.svg" alt="" />} title="VENTILAÇÃO" edit={{ label: "Editar ventilação", href: form("fans") }} />
          <p className="text-sm leading-[17px] text-display">{fan.title}</p>
          <Field label="LOCAL:" value={fan.location} />
        </div>
      ))}
    </PanelCard>
  );

  // W5p: atenção, ambiente e plantas | iluminação e histórico | exaustão, ventilação e equipamento. Celular (D1): a mesma ordem, empilhada.
  return (
    <>
      <div className="flex flex-col gap-2">
        <BackLink fallback={routes.grows()} />
        <div className="flex flex-wrap items-center gap-3">
          <Lamp state={lamp} />
          <h1 className="font-label min-w-0 flex-1 text-[28px] leading-9 text-text-primary">{grow.name}</h1>
          <Marker>{[growTypeLabel[grow.grow_type] ?? null, dims].filter(Boolean).join(" · ") || "Ambiente"}</Marker>
          {active.length > 1 && <div className="flex"><PanelButton kind="clear" label="Trocar ambiente" onClick={() => setPicker(true)} /></div>}
        </div>
        <div className="flex flex-wrap gap-1.5">{archived && <Marker tone="out">Arquivado</Marker>}{facts.map(f => <Marker key={f}>{f}</Marker>)}</div>
      </div>
      <div className="flex flex-col gap-[14px] lg:grid lg:grid-cols-3 lg:items-start lg:gap-5">
        <div className="flex flex-col gap-[14px] lg:gap-5">{attentionCard}{envCard}{plantsCard}</div>
        <div className="flex flex-col gap-[14px] lg:gap-5">{lightCard}{linksCard}</div>
        <div className="flex flex-col gap-[14px] lg:gap-5">
          {exhaustCard}{fanCard}
          {!archived && <div className="flex"><PanelButton kind="clear" label="Adicionar equipamento" href={routes.growEquipment(grow.id)} /></div>}
        </div>
      </div>

      <GrowPicker open={picker} onClose={() => setPicker(false)} current={grow.id} title="Trocar ambiente" subtitle="A escolha também vale para o Início."
        onPick={next => { select(next); setPicker(false); router.push(routes.growPanel(next)!); }}
        grows={active.map(g => ({ id: g.id, name: g.name, line: growChoiceLine(g, environmentMeasurement(g.env, "temperature").value, environmentMeasurement(g.env, "humidity").value) }))} />
    </>
  );
}
