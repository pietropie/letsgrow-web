"use client";

import { SegmentedDisplay } from "@/components/home/blocks";
import { EnvPanel } from "@/components/home/panel-home";
import { AddCard, LinkCard, Marker, PanelButton, PanelCard, PanelTitle, SegMeter } from "@/components/panel";
import { Button, Spinner } from "@/components/ui";
import { usePlanConfigs } from "@/lib/account";
import { useActivePlants, useBobAlerts, useGrows, useMinuteOfDay, usePlantSummaries } from "@/lib/hooks";
import { growPanelProps, type GrowNextAction } from "@/lib/panel-props";
import { normalizePlan } from "@/lib/plans";
import { useRecommendation } from "@/lib/recommendation-client";
import { routes } from "@/lib/routes";
import { attentionItems } from "@/shared/lib/homeClimate";
import { environmentMeasurement } from "@/shared/lib/measurements";
import type { GrowSummary } from "@/shared/types/api";

/** Faixas e medidas que o GET /grows vai passar a mandar (item 22, dependência 1); opcionais até lá. */
type GrowWithTargets = GrowSummary & {
  target_temp_c?: number | null; target_humidity_rh?: number | null; tent_width_cm?: number | null; tent_depth_cm?: number | null; tent_height_cm?: number | null;
  photoperiod_on_at?: string | null; active_phases?: Record<string, number> | null; next_action?: GrowNextAction;
};

/**
 * Seus ambientes v2 no painel (UX itens 22 e 23b; web W2p 2423:24132, celular G1p 2422:23488, estados E6–E8
 * 2424:23590). Uma lista de cartões, um por ambiente; "ABRIR PAINEL" leva ao painel de sempre. O limite do plano vem
 * do /billing/recommendation (usado de total) e, com motivo e plano à venda, a recomendação sem preço.
 */
export default function GrowsPage() {
  const grows = useGrows();
  const plants = useActivePlants();
  const summaries = usePlantSummaries();
  const alerts = useBobAlerts();
  const recommendation = useRecommendation();
  const planConfigs = usePlanConfigs().data;
  const minute = useMinuteOfDay();
  const active = (grows.data ?? []).filter(g => g.status === "active") as GrowWithTargets[];
  const archivedCount = (grows.data ?? []).filter(g => g.status === "abandoned").length;
  const rec = recommendation.status === "ok" ? recommendation.rec : null;
  const usage = rec?.usage.grows;
  const unlimited = !usage || usage.total == null || usage.total >= 9999;
  const atLimit = !!usage && !unlimited && usage.used >= usage.total!;
  const label = (key: string | null | undefined) => key ? planConfigs?.find(p => p.plan_key === normalizePlan(key))?.label ?? null : null;
  const recLabel = label(rec?.plan_key);
  const covers = !!rec?.plan_key && rec.reasons.includes("grows_limit") && rec.covers.includes("grows_limit") && !!recLabel;
  const growsTo = rec?.changes.find(c => c.key === "grows")?.to;

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <h1 className="font-label text-[28px] leading-9 text-text-primary">Seus ambientes</h1>
      {usage && (unlimited
        ? <Marker>{usage.used} {usage.used === 1 ? "ambiente" : "ambientes"}</Marker>
        : <span className="flex items-center gap-2"><SegMeter filled={usage.used} total={usage.total!} /><Marker tone={atLimit ? "out" : "plain"}>{usage.used} de {usage.total}</Marker></span>)}
    </div>
  );

  const limitCard = atLimit && (covers ? (
    <PanelCard tone="bobby" label="Limite do plano">
      <PanelTitle right={<SegMeter filled={usage!.used} total={usage!.total!} />}>Limite do plano</PanelTitle>
      <Marker tone="light">Recomendado para você</Marker>
      <p className="text-[15px] leading-[21px] text-text">Você usa {usage!.used} de {usage!.total} {usage!.total === 1 ? "ambiente" : "ambientes"}.{typeof growsTo === "number" ? ` O plano ${recLabel} permite ${growsTo} ambientes.` : growsTo === null ? ` O plano ${recLabel} não tem limite de ambientes.` : ""}</p>
      <div className="flex"><PanelButton label="Ver o plano" href={routes.plans()} /></div>
    </PanelCard>
  ) : (
    <PanelCard label="Limite do plano">
      <PanelTitle right={<SegMeter filled={usage!.used} total={usage!.total!} />}>Limite do plano</PanelTitle>
      <p className="text-[15px] leading-[21px] text-text">Você usa {usage!.used} de {usage!.total} {usage!.total === 1 ? "ambiente" : "ambientes"} do seu plano.</p>
    </PanelCard>
  ));
  const archivedRow = archivedCount > 0 && (
    <LinkCard href={routes.archivedGrows()} title="Ambientes arquivados" body={`${archivedCount === 1 ? "1 ambiente" : `${archivedCount} ambientes`} · o histórico continua disponível.`} />
  );

  if (grows.isPending) return <>{header}<Spinner /></>;
  if (grows.isError) return <>{header}<div className="max-w-[600px]"><Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void grows.refetch()} /></div></>;

  if (!active.length) {
    // E8: vazio, com a linha de arquivados.
    return (
      <>
        {header}
        <div className="flex max-w-[600px] flex-col gap-[14px]">
          <PanelCard label="Nenhum ambiente">
            <div className="flex items-center gap-3">
              <SegmentedDisplay size="small" value={null} unit="°" spoken="Sem leitura" />
              <p className="text-[15px] leading-[21px] text-text">{archivedCount ? "Nenhum ambiente ativo. Crie um novo ou restaure um arquivado; o histórico continua disponível." : "Nenhum ambiente ainda. O ambiente guarda as leituras, a luz e os equipamentos."}</p>
            </div>
            <div className="flex"><PanelButton label="Adicionar ambiente" href={routes.newGrow()} /></div>
          </PanelCard>
          {archivedRow}
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      {/* Desktop (pedido do usuário, 12 nov): uma grade só, cartões com a mesma altura por linha. */}
      <div className="flex flex-col gap-[14px] md:grid md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          {active.map(g => {
            const growPlants = (plants.data ?? []).filter(p => p.grow_id === g.id);
            const ids = new Set(growPlants.map(p => p.id));
            const items = attentionItems({
              growId: g.id, growName: g.name,
              temperature: environmentMeasurement(g.env, "temperature"), humidity: environmentMeasurement(g.env, "humidity"),
              targetTemp: g.target_temp_c, targetRh: g.target_humidity_rh,
              alerts: (alerts.data?.alerts ?? []).filter(a => ids.has(a.plant_id)),
              lastWatering: Object.fromEntries(growPlants.map(p => [p.id, summaries.data?.[p.id]?.last_watering_at])),
            }).items;
            return <EnvPanel key={g.id} {...growPanelProps({ grow: g, plantCount: g.active_plant_count, items, minute, showDays: true })} />;
          })}
        {limitCard}
        {!atLimit && <AddCard href={routes.newGrow()} label="Adicionar ambiente" hint="Um espaço simples também pode ser um ambiente." />}
        {archivedRow && <div className="flex flex-col md:col-span-2 lg:col-span-3">{archivedRow}</div>}
      </div>
    </>
  );
}
