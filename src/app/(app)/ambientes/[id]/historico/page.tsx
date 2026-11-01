"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelTag } from "@/components/grows/instruments";
import { BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { clearFlash, useFlash } from "@/lib/flash";
import { useArchiveGrow, useEnvironmentReadings, useGrow, useRememberedGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { getErrorMessage } from "@/shared/lib/errors";
import { HISTORY_TAG, RESTORE_GROW_MESSAGE, archivedCaption, groupByDay, historyA11yLabel, historyDetail, historyTime, historyTitle, historyType, restoredMessage } from "@/shared/lib/growHistory";
import type { EnvironmentReading } from "@/shared/types/features";

/**
 * Figma 02B: D · Histórico do ambiente (2299:9495) e C1 · Ambiente arquivado (2298:9489), a mesma lista mais
 * "Restaurar ambiente". Só o que foi registrado no app; leituras de sensor não entram.
 */
export default function GrowHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const grow = useGrow(id);
  const history = useEnvironmentReadings(id);
  const restore = useArchiveGrow(id, "restore");
  const [, select] = useRememberedGrow();
  const flash = useFlash();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  // O aviso deixado pela tela de onde viemos ("Registro apagado.").
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (flash) { setNotice(flash); clearFlash(); } }, [flash]);

  const g = grow.data;
  const archived = g?.status === "abandoned";
  const items = history.data?.pages.flatMap(p => p.items) ?? [];

  function runRestore() {
    if (!g) return;
    restore.mutate(undefined, {
      onSuccess: result => { select(g.id); setConfirming(false); setError(""); setNotice(restoredMessage(result.plants_affected)); },
      // 403: limite do plano; o servidor não mudou nada.
      onError: err => { setConfirming(false); setError(getErrorMessage(err, "Não foi possível restaurar. Nada foi alterado; tente de novo.")); },
    });
  }

  const list = history.isPending ? <>
    <p className="text-sm text-text-muted" role="status">Carregando registros…</p>
    {[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-stroke-soft/50" />)}
  </> : history.isError && !items.length ? <>
    <Notice title="Não foi possível carregar o histórico" body="Seus registros não foram alterados. Verifique a conexão e tente de novo." />
    <Button secondary label="Tentar novamente" onClick={() => void history.refetch()} />
  </> : !items.length ? <>
    <Notice title="Nenhum registro ainda" body="As leituras, notas e ajustes de potência que você registrar aparecem aqui, do mais recente para o mais antigo." />
    {!archived && <ButtonLink label="Registrar leitura" href={routes.growReading(id)!} />}
  </> : <>
    {groupByDay(items).map(group => (
      <section key={group.key} className="flex flex-col gap-2" aria-labelledby={`day-${group.key}`}>
        <h2 id={`day-${group.key}`} className="font-label text-base leading-[22px] text-display">{group.label}</h2>
        {group.items.map(r => <HistoryItem key={r.id} reading={r} href={archived ? null : routes.growReading(id, r.id)} />)}
      </section>
    ))}
    {history.hasNextPage && <Button secondary loading={history.isFetchingNextPage} label={history.isFetchNextPageError ? "Tentar carregar mais" : "Carregar mais"} onClick={() => void history.fetchNextPage()} />}
    <PageSubtitle>Leituras de sensor não aparecem aqui: esta lista mostra o que foi registrado no app.</PageSubtitle>
  </>;

  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={archived ? routes.archivedGrows() : routes.growPanel(id)!} />
      <PageTitle>{archived ? g?.name ?? "" : "Histórico do ambiente"}</PageTitle>
      <PageSubtitle>{archived && g ? archivedCaption(g) : `${g?.name ?? "Ambiente"} · leituras, notas e ajustes registrados no app`}</PageSubtitle>
      {!!notice && <div role="status"><Notice title={notice} /></div>}
      {archived && g && <>
        <Notice title="Ambiente arquivado" body="Não recebe novas leituras nem plantas. Restaure para voltar a acompanhar este ambiente." />
        <Button label={restore.isPending ? "Restaurando…" : "Restaurar ambiente"} loading={restore.isPending} onClick={() => setConfirming(true)} />
        <FormError message={error} />
        <h2 className="font-label text-base leading-[22px] text-display">HISTÓRICO</h2>
        <ConfirmDialog open={confirming} title={`Restaurar ${g.name}?`} message={RESTORE_GROW_MESSAGE} confirm="Restaurar" busy={restore.isPending}
          onConfirm={runRestore} onCancel={() => setConfirming(false)} />
      </>}
      {list}
    </div>
  );
}

/** Figma Lists/HistoryItem (2297:9004). Registros de potência são automáticos: não abrem e não têm seta. */
function HistoryItem({ reading, href }: { reading: EnvironmentReading; href: string | null }) {
  const type = historyType(reading);
  const tag = HISTORY_TAG[type];
  const detail = historyDetail(reading);
  const content = (
    <>
      <span className="font-label min-w-11 text-base leading-[22px] text-display">{historyTime(reading)}</span>
      <span className="flex flex-1 flex-col gap-1">
        <span className="text-base leading-6 font-semibold">{historyTitle(reading)}</span>
        {!!detail && <span className="line-clamp-2 text-sm leading-5 text-text-muted">{detail}</span>}
        <PanelTag tone={tag.tone} label={tag.label} />
      </span>
    </>
  );
  const cls = "flex items-center gap-3 rounded-xl border border-border bg-surface p-4";
  if (type === "power" || !href) return <div className={cls} aria-label={historyA11yLabel(reading)}>{content}</div>;
  return <Link href={href} aria-label={historyA11yLabel(reading)} className={`${cls} hover:bg-surface-high`}>{content}<img src="/figma/chevron-right.svg" alt="" /></Link>;
}
