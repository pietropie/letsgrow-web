"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { EnvironmentReadings, PanelTag } from "@/components/grows/instruments";
import { ActionRow, Button, ButtonLink, Notice, PageHeader, Spinner } from "@/components/ui";
import { useGrows } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { dayMonthTime } from "@/shared/lib/dates";
import { environmentMeasurement } from "@/shared/lib/measurements";
import { plantCount } from "@/shared/lib/plantFacts";
import type { GrowSummary } from "@/shared/types/api";

/**
 * Seus ambientes (Figma W15 2374:17581; mobile app/(app)/grows/index.tsx). No desktop, um cartão de 360 por ambiente
 * em grade com quebra, mais o cartão "+ Adicionar ambiente"; no celular, os cartões um embaixo do outro.
 */
export default function GrowsPage() {
  const grows = useGrows();
  const active = (grows.data ?? []).filter(g => g.status === "active");
  const archivedCount = (grows.data ?? []).filter(g => g.status === "abandoned").length;
  const archivedRow = archivedCount > 0 && (
    <div className="md:w-[360px]">
      <ActionRow title="Ambientes arquivados" body={`${archivedCount === 1 ? "1 ambiente" : `${archivedCount} ambientes`} · o histórico continua disponível.`} href={routes.archivedGrows()} />
    </div>
  );

  if (grows.isSuccess && !active.length) {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <PageHeader title="Seus ambientes" subtitle="Um espaço simples também pode ser um ambiente." />
        {archivedCount
          ? <Notice title="Nenhum ambiente ativo" body="Crie um ambiente novo ou restaure um arquivado. O histórico dos arquivados continua disponível." meta="Equipamentos e localização são opcionais." />
          : <Notice title="Nenhum ambiente cadastrado" body="Você pode continuar conhecendo o app ou dar um nome ao seu espaço." meta="Equipamentos e localização são opcionais." />}
        <ButtonLink label="Adicionar ambiente" href={routes.newGrow()!} />
        {archivedRow}
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Seus ambientes" subtitle={grows.isSuccess ? `${active.length} ${active.length === 1 ? "ambiente ativo" : "ambientes ativos"}` : undefined}
        action={<Link href={routes.newGrow()!} className="hidden min-h-11 items-center rounded-[10px] bg-primary px-4 text-[15px] font-semibold text-white hover:bg-primary-dark md:flex">Adicionar ambiente</Link>} />
      {grows.isPending ? <Spinner /> : grows.isError ? <div className="max-w-[600px]"><Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void grows.refetch()} /></div> : (
        <div className="flex flex-col gap-5 md:flex-row md:flex-wrap">
          {active.map(g => <GrowCard key={g.id} grow={g} />)}
          <Link href={routes.newGrow()!} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-stroke-soft p-5 text-center hover:border-input-border md:min-h-[166px] md:w-[360px] md:self-start">
            <span className="text-[15px] font-semibold text-text-primary">+ Adicionar ambiente</span>
            <span className="text-[13px] text-text-secondary">Um espaço simples também pode ser um ambiente.</span>
          </Link>
        </div>
      )}
      {archivedRow}
    </>
  );
}

function GrowCard({ grow }: { grow: GrowSummary }) {
  const temperature = environmentMeasurement(grow.env, "temperature");
  const updated = dayMonthTime(temperature.observed_at, " ");
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-stroke bg-surface p-2.5 md:w-[360px]" aria-labelledby={`grow-${grow.id}`}>
      {/* O W15 não traz o nome no cartão; com vários ambientes ele é o que os diferencia (WEBAPP.md, desvios). */}
      <h2 id={`grow-${grow.id}`} className="px-1 pt-1 text-xl leading-7 font-bold text-text-primary">{grow.name}</h2>
      <div className="flex flex-col gap-2.5 rounded-xl bg-surface-bobby p-3">
        <div className="flex items-center gap-2"><img src="/figma/bobby-panel.svg" alt="" /><h3 className="font-label text-base text-display">ACOMPANHAMENTO DO BOBBY</h3></div>
        <p className="text-base leading-6">Veja a origem das leituras antes de comparar.</p>
        <div className="flex flex-wrap gap-1.5">
          {temperature.source ? <PanelTag tone="stable" label={`BASE: ${temperature.source === "sensor" ? "SENSOR" : "REGISTRO MANUAL"}`} /> : <PanelTag label="SEM LEITURA REGISTRADA" />}
          {updated && <PanelTag label={`ATUALIZADO ${updated.toUpperCase()}`} />}
        </div>
      </div>
      <div className="h-px bg-stroke" />
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><img src="/figma/temperature.svg" alt="" width={30} height={27} /><span className="font-label text-base text-display">AMBIENTE</span></div>
          <Link href={routes.growEdit(grow.id)} aria-label={`Editar ${grow.name}`} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-bg"><img src="/figma/edit.svg" alt="" /></Link>
        </div>
        <EnvironmentReadings env={grow.env} indoor={grow.grow_type !== "outdoor"} />
      </div>
      <div className="h-px bg-stroke" />
      <ButtonLink secondary label="Equipamentos e iluminação" href={routes.growEquipment(grow.id)} />
      <p className="text-sm leading-5 text-text-muted">{plantCount(grow.active_plant_count)} neste ambiente · detalhes no painel</p>
      <ButtonLink label="Abrir painel completo" href={routes.growPanel(grow.id)!} />
    </article>
  );
}
