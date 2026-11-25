"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { POLL_MS, commandOutcome, relayErrorText, type EquipKind, type HubRelays, type RelayCommand, type RelayMode } from "./relays";

/** Relés do Hub: as rotas do contrato em src/lib/relays.ts. */

const KEY = (hubId: string | null) => ["iot", "relays", hubId] as const;

/**
 * Configuração e estado confirmado dos 4 relés, a cada 10 s. Sem retry: enquanto a API não tiver a rota, a resposta é
 * 404 e as telas de relé não aparecem (`available` false).
 */
export function useHubRelays(hubId: string | null) {
  const q = useQuery({
    queryKey: KEY(hubId), queryFn: () => api<HubRelays>(`/iot/devices/${hubId}/relays`),
    enabled: !!hubId, retry: false, refetchInterval: 10_000, staleTime: 5_000,
  });
  const missing = q.error instanceof ApiError && (q.error.response.status === 404 || q.error.response.status === 405);
  return { ...q, available: !!q.data && !missing };
}

/** Campo ausente não muda nada; `move: true` depois do 409 `equipment_in_use` (SN9b). */
export type RelayBinding = { equip_kind?: EquipKind | null; equip_key?: string | null; mode?: RelayMode; move?: boolean };
/** Grava o vínculo e o modo de uma posição (o servidor sobe o `rev` e publica a configuração ao Hub). */
export function useSaveRelay(hubId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ n, body }: { n: number; body: RelayBinding }) => api<HubRelays>(`/iot/devices/${hubId}/relays/${n}`, { method: "PUT", body }),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY(hubId) }),
  });
}

export type SwitchPhase = { kind: "idle" } | { kind: "sending"; want: 0 | 1 } | { kind: "failed"; want: 0 | 1; text: string };

/**
 * Liga e desliga uma posição: manda o comando, consulta o `req_id` a cada ~1 s e só então relê o estado confirmado.
 * Depois de 10 s sem confirmação, "o Hub não confirmou". A chave nunca mostra o estado pedido como se fosse o real.
 */
export function useRelaySwitch(hubId: string | null, n: number) {
  const client = useQueryClient();
  const [phase, setPhase] = useState<SwitchPhase>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (timer.current) clearInterval(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  const send = useCallback(async (want: 0 | 1) => {
    if (!hubId) return;
    stop();
    setPhase({ kind: "sending", want });
    let reqId: string;
    try {
      reqId = (await api<{ req_id: string }>(`/iot/devices/${hubId}/relays/${n}/command`, { method: "POST", body: { state: want } })).req_id;
    } catch (e) {
      const status = e instanceof ApiError ? e.response.status : undefined;
      const detail = e instanceof ApiError ? (e.response.data as { detail?: string } | null)?.detail : undefined;
      setPhase({ kind: "failed", want, text: relayErrorText(status, detail) });
      if (status === 409) void client.invalidateQueries({ queryKey: KEY(hubId) });
      return;
    }
    const started = Date.now();
    let busy = false;
    timer.current = setInterval(async () => {
      if (busy) return;
      busy = true;
      let cmd: RelayCommand | null = null;
      try { cmd = await api<RelayCommand>(`/iot/relay-commands/${reqId}`); } catch { cmd = null; }
      busy = false;
      const outcome = commandOutcome(cmd, started, Date.now());
      if (outcome === "pending") return;
      stop();
      await client.invalidateQueries({ queryKey: KEY(hubId) });
      setPhase(outcome === "confirmed" ? { kind: "idle" } : { kind: "failed", want, text: "" });
    }, POLL_MS);
  }, [client, hubId, n]);

  return { phase, send, reset: () => setPhase({ kind: "idle" }) };
}
