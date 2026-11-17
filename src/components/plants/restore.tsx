"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui";
import { api } from "@/lib/api";
import { useGrows, usePlanStatus } from "@/lib/hooks";
import { atPlantLimit, restoreMessage, restoreQuestion, restoreView, restoredNotice } from "@/lib/plant-restore";
import { routes } from "@/lib/routes";
import { rejectionMessage } from "@/shared/lib/errors";
import { plantDisplayName } from "@/shared/lib/plantIdentity";
import type { PlantResponse } from "@/shared/types/api";

/** Mesmo visual do PanelButton claro, com estado desligado (o PanelButton não tem). */
const BTN = "font-label flex min-h-12 flex-1 items-center justify-center gap-2.5 rounded-lg border border-stroke bg-surface px-3 text-center text-[17px] leading-5 text-text-primary uppercase hover:bg-surface-high cursor-pointer disabled:cursor-default disabled:opacity-50 disabled:hover:bg-surface";

/** O que decide o botão: o plano (limite de plantas) e se o ambiente da planta está ativo. */
export function useRestoreContext() {
  const plan = usePlanStatus().data;
  const grows = useGrows().data;
  const atLimit = atPlantLimit(plan?.plants_used, plan?.max_plants);
  return (p: PlantResponse) => restoreView(p, { atLimit, growActive: grows ? grows.find(g => g.id === p.grow_id)?.status === "active" : null });
}

/** PATCH /plants/{id} { is_active: true }; depois relê plantas (e resumos), ambientes e o plano. */
export function useRestorePlant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<PlantResponse>(`/plants/${id}`, { method: "PATCH", body: { is_active: true } }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ["plants"] }),
      client.invalidateQueries({ queryKey: ["grows"] }),
      client.invalidateQueries({ queryKey: ["plan-status"] }),
    ]),
  });
}

/**
 * "Restaurar" de uma planta arquivada (não colhida): confirma antes, mostra o motivo quando está bloqueado (limite do
 * plano → planos; ambiente arquivado → histórico do ambiente) e, se a API recusar (403/400), a mensagem dela.
 * `children` vai ao lado do botão (o "Ver histórico" da lista). Sem restauração possível, mostra só `children`.
 */
export function RestorePlant({ plant, children, onRestored }: { plant: PlantResponse; children?: React.ReactNode; onRestored?: (name: string) => void }) {
  const view = useRestoreContext()(plant);
  const restore = useRestorePlant();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = plantDisplayName(plant);
  if (!view) return children ? <div className="flex gap-2">{children}</div> : null;
  const href = view.blocked?.reason === "limit" ? routes.plans() : routes.growHistory(plant.grow_id);

  const run = () => {
    setError(null);
    restore.mutate(plant.id, {
      onSuccess: () => { setConfirm(false); onRestored?.(name); },
      onError: e => { setConfirm(false); setError(rejectionMessage(e) ?? "Não foi possível restaurar. Tente novamente."); },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {view.blocked && (
        <p className="text-sm leading-5 text-text">
          {view.blocked.text}{href && <> <Link href={href} className="font-semibold text-text-primary underline">{view.blocked.link}</Link></>}
        </p>
      )}
      <div className="flex gap-2">
        {children}
        <button type="button" className={BTN} disabled={!view.allowed || restore.isPending} onClick={() => setConfirm(true)}>
          {restore.isPending ? "Restaurando…" : "Restaurar"}<span aria-hidden>›</span>
        </button>
      </div>
      {error && <p role="alert" className="text-sm leading-5 text-state-error">{error}</p>}
      <ConfirmDialog open={confirm} title={restoreQuestion(name)} message={restoreMessage} confirm="Restaurar" busy={restore.isPending}
        onConfirm={run} onCancel={() => { if (!restore.isPending) setConfirm(false); }} />
    </div>
  );
}

export { restoredNotice };
