"use client";

/* eslint-disable @next/next/no-img-element */
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { SegmentedDisplay } from "@/components/home/blocks";
import { GrowPicker } from "@/components/home/place-flow";
import { EnvironmentReadings, ExhaustDimmer, PanelTag, PhotoperiodDial, PpfdGauge, type PanelTone } from "@/components/grows/instruments";
import { ActionRow, BackLink, Button, PageHeader, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { useBobAlerts, useGrow, useGrowPlants, useGrows, usePlantSummaries, useRememberedGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { phases } from "@/shared/constants/theme";
import { dayMonthTime } from "@/shared/lib/dates";
import { hasExhaust } from "@/shared/lib/exhaustDimmer";
import { carbonFilterLabel, exhaustDescription, fans, growTypeLabel, lightDescription, locationLabel } from "@/shared/lib/growEquipment";
import { growChoiceLine } from "@/shared/lib/homeClimate";
import { durationLabel, formatClock, offMinute, photoperiodText, scheduleFromGrow } from "@/shared/lib/lightSchedule";
import { environmentMeasurement } from "@/shared/lib/measurements";
import { phaseDay } from "@/shared/lib/phaseDay";
import { plantCount } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";
import type { EquipmentKind } from "@/shared/lib/equipmentForms";
import type { GrowResponse } from "@/shared/types/api";

const PHASE_TAG: Record<string, string> = { germination: "GERMINAÇÃO", seedling: "MUDA", veg: "VEGA", flower: "FLORA", late_flower: "FLORA FINAL", harvest: "COLHEITA", drying: "SECAGEM", curing: "CURA" };
const sourceTag = (source?: string | null) => source === "sensor" ? "SENSOR" : source === "manual" ? "REGISTRO MANUAL" : null;

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`flex flex-col gap-2.5 rounded-2xl border border-stroke bg-surface p-3.5 ${className}`}>{children}</section>;
}
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
 * Painel do ambiente (Figma 2160:6350; desktop W16 2374:17792). Mesma lógica do letsgrow-mobile/app/(app)/grows/[id]/index.tsx.
 * Desktop: coluna 1 com Bobby, Ambiente e Iluminação; coluna 2 com Exaustão, Ventilação e Plantas.
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

  const grow = growQuery.data;
  const plants = plantsQuery.data ?? [];
  const active = (grows.data ?? []).filter(g => g.status === "active");
  const index = active.findIndex(g => g.id === id);

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
  const alert = (alerts.data?.alerts ?? []).find(a => plants.some(p => p.id === a.plant_id));
  const base = sourceTag(temperature.source);
  const updated = dayMonthTime(temperature.observed_at, " ");
  const fanList = fans(grow);
  const archived = grow.status === "abandoned";
  const subtitle = [index >= 0 ? `Ambiente selecionado · ${index + 1} de ${active.length}` : archived ? "Arquivado" : null, (growTypeLabel[grow.grow_type] ?? "").toLowerCase(), plantCount(plants.length)].filter(Boolean).join(" · ");
  const scheduleTag = schedule.incomplete ? null : schedule.light == null ? null
    : schedule.light >= 1440 ? "PROGRAMAÇÃO · 24/0"
    : schedule.onAt == null ? `PROGRAMAÇÃO · ${photoperiodText(schedule.light)}`
    : `PROGRAMAÇÃO · ${formatClock(schedule.onAt)} → ${formatClock(offMinute(schedule.onAt, schedule.light))}`;
  const lightTone: PanelTone = light.value == null ? "alert" : light.source === "sensor" ? "pink" : "calm";

  return (
    <>
      <PageHeader title={grow.name} subtitle={subtitle}
        action={active.length > 1 && <button type="button" onClick={() => setPicker(true)} className="min-h-11 rounded-[10px] border border-input-border bg-surface px-4 text-[15px] font-semibold text-text-primary hover:bg-surface-high cursor-pointer">Trocar ambiente</button>} />
      <div className="grid items-start gap-[14px] md:grid-cols-2 md:gap-6">
        <div className="flex flex-col gap-[14px] md:gap-5">
          <Card>
            <div className="flex flex-col gap-2.5 rounded-xl bg-surface-bobby p-3">
              <div className="flex items-center gap-2"><img src="/figma/bobby-panel.svg" alt="" /><h2 className="font-label text-base text-display">ACOMPANHAMENTO DO BOBBY</h2></div>
              <p className="text-base leading-6">{alert?.message ?? "Veja a origem das leituras antes de comparar."}</p>
              <div className="flex flex-wrap gap-1.5">
                {base ? <PanelTag tone="stable" label={`BASE: ${base}`} /> : <PanelTag label="SEM LEITURA REGISTRADA" />}
                {updated && <PanelTag label={`ATUALIZADO ${updated.toUpperCase()}`} />}
              </div>
              {!archived && (
                <Link href={routes.growReading(grow.id)!} className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg border-[0.5px] border-bg bg-surface px-4 py-3 text-base font-semibold text-display shadow-[4px_4px_4px_rgba(0,0,0,0.1)] hover:bg-surface-high">
                  REGISTRAR LEITURA <img src="/figma/chevron-right.svg" alt="" />
                </Link>
              )}
              <ActionRow title="Histórico do ambiente" body="Leituras, notas e ajustes registrados." href={routes.growHistory(grow.id)} />
            </div>
          </Card>

          <Card>
            <CardTitle icon={<img src="/figma/temperature.svg" alt="" width={30} height={27} />} title="AMBIENTE" edit={{ label: "Editar ambiente", href: routes.growEdit(grow.id) }} />
            <EnvironmentReadings env={grow.env} indoor={grow.grow_type !== "outdoor"} />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex w-[132px] flex-col gap-0.5"><span className="font-label text-sm leading-4 text-display">FAIXA DEFINIDA POR VOCÊ</span><PanelTag label="CADASTRO" /></div>
              <div className="flex gap-3">
                <div className="flex w-24 flex-col items-center gap-0.5"><span className="font-label text-base text-display">TEMP.</span><SegmentedDisplay size="small" unit="°" value={grow.target_temp_c ?? null} label="Temperatura definida" /></div>
                <div className="flex w-24 flex-col items-center gap-0.5"><span className="font-label text-base text-display">UMID.</span><SegmentedDisplay size="small" unit="%" value={grow.target_humidity_rh ?? null} label="Umidade definida" /></div>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle icon={<img src="/figma/light.svg" alt="" />} title="ILUMINAÇÃO" edit={{ label: "Editar iluminação", href: form("light") }} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm leading-[17px] text-display">{lightDescription(grow) ?? "Luminária não informada"}</span>
              {schedule.light != null && (
                <span className="flex min-w-[200px] flex-1">
                  <span className="flex flex-1 items-center justify-center gap-2.5 bg-state-alert px-2.5 text-sm"><img src="/figma/sun-small.svg" alt="" />{durationLabel(schedule.light)}</span>
                  <span className="flex flex-1 items-center justify-center gap-2.5 bg-stroke-soft px-2.5 text-sm"><img src="/figma/moon-small.svg" alt="" />{durationLabel(1440 - schedule.light)}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <PpfdGauge value={null} badge="SEM LEITURA" />
              <div className="flex min-w-[212px] flex-1 justify-center"><PhotoperiodDial onAt={schedule.onAt} light={schedule.light} lastReading={light} /></div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Programação incompleta ou ausente abre o formulário de Iluminação (Figma 02C J6/J10). */}
              {scheduleTag ? <PanelTag label={scheduleTag} />
                : <Link href={form("light")} aria-label={schedule.incomplete ? "Programação incompleta. Completar a programação de luz" : "Sem programação de luz. Cadastrar a programação"}>
                    <PanelTag tone={schedule.incomplete ? "alert" : "neutral"} label={schedule.incomplete ? "PROGRAMAÇÃO INCOMPLETA" : "SEM PROGRAMAÇÃO"} />
                  </Link>}
              <PanelTag tone={lightTone} label={light.value == null ? "ESTADO ATUAL: SEM LEITURA" : `LUZ: ${Math.round(light.value)} LUX · ${dayMonthTime(light.observed_at, " ")?.toUpperCase() ?? "SEM DATA"}`} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-[14px] md:gap-5">
          <Card>
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
          </Card>

          <Card className="!flex-row !gap-0">
            {(fanList.length ? fanList : [{ title: "Ventilação não informada", location: "NÃO INFORMADO" }]).map((fan, i) => (
              <div key={i} className={`flex flex-1 flex-col gap-1.5 ${i > 0 ? "border-l border-stroke pl-2" : "pr-2"}`}>
                <CardTitle icon={<img src="/figma/fan.svg" alt="" />} title="VENTILAÇÃO" edit={{ label: "Editar ventilação", href: form("fans") }} />
                <p className="text-sm leading-[17px] text-display">{fan.title}</p>
                <Field label="LOCAL:" value={fan.location} />
              </div>
            ))}
          </Card>

          <Card>
            <div className="flex items-center gap-2"><img src="/figma/leaf-22.svg" alt="" /><h2 className="font-label flex-1 text-base text-display">PLANTAS DESTE AMBIENTE</h2><PanelTag tone="stable" label={String(plants.length)} /></div>
            {plants.map(plant => {
              const watering = dayMonthTime(summaries.data?.[plant.id]?.last_watering_at, ", ");
              const day = phaseDay(plant);
              const image = summaries.data?.[plant.id]?.strain_image_url || `/figma/plant-${plantIllustration(plant.id)}.png`;
              const href = routes.plant(plant.id);
              const body = (
                <>
                  <img src={image} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="font-label text-xl leading-6 text-text-primary">{plantDisplayName(plant)}</span>
                    <span className="text-sm leading-5 text-text-secondary">{watering ? `Última rega: ${watering}` : "Nenhuma rega registrada"}</span>
                    <PanelTag tone={phases[plant.current_phase] && plant.current_phase !== "unknown" ? "calm" : "neutral"} label={(PHASE_TAG[plant.current_phase] ?? "FASE NÃO INFORMADA") + (day ? ` · DIA ${day}` : "")} />
                  </span>
                  {href && <img src="/figma/arrow-right-dark.svg" alt="" />}
                </>
              );
              const cls = "flex items-center gap-2.5 rounded-[10px] border border-stroke p-2";
              return href ? <Link key={plant.id} href={href} className={`${cls} hover:border-input-border`}>{body}</Link> : <div key={plant.id} className={cls}>{body}</div>;
            })}
            {!plants.length && <p className="text-sm leading-5 text-text-secondary">Nenhuma planta ativa neste ambiente.</p>}
            {routes.newPlant(grow.id) && !archived && <Link href={routes.newPlant(grow.id)!} className="flex min-h-12 items-center justify-center gap-2.5 rounded-lg bg-primary px-4 text-base font-semibold text-white hover:bg-primary-dark">ADICIONAR PLANTA <img src="/figma/arrow-right.svg" alt="" /></Link>}
            <p className="text-sm leading-5 text-text-secondary">Vaso e substrato são opcionais e ficam na ficha de cada planta.</p>
          </Card>
        </div>
      </div>

      <GrowPicker open={picker} onClose={() => setPicker(false)} current={grow.id} title="Trocar ambiente" subtitle="A escolha também vale para o Início."
        onPick={next => { select(next); setPicker(false); router.push(routes.growPanel(next)!); }}
        grows={active.map(g => ({ id: g.id, name: g.name, line: growChoiceLine(g, environmentMeasurement(g.env, "temperature").value, environmentMeasurement(g.env, "humidity").value) }))} />
    </>
  );
}
