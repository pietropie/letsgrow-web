"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PAIRING_TTL_S } from "@/shared/lib/hubProvisioning";
import type { DeviceResponse, SensorReadingResponse } from "@/shared/types/api";
import { api } from "./api";

/** Sensores IoT (mobile hooks/useSensors e useDevices): as mesmas rotas e os mesmos intervalos de atualização. */

/** POST /iot/hubs/claim-codes (mobile types/api.ts HubClaimCodeResponse). */
export interface HubClaimCodeResponse { code: string; expires_at: string }
/** POST /iot/devices/{hub_id}/pairing (mobile types/api.ts HubPairingResponse). */
export interface HubPairingResponse { hub_id: string; ttl_s: number; expires_at: string }

const DEVICES = ["iot", "devices"] as const;

/** Dispositivos do ambiente, inclusive satélites ainda não pareados; a cada 15 s, para pegar os que o hub detectar. */
export function useGrowDevices(growId: string, every = 15_000) {
  return useQuery({
    queryKey: [...DEVICES, growId, false],
    queryFn: () => api<DeviceResponse[]>(`/iot/devices?grow_id=${growId}&paired_only=false`),
    // 3 s enquanto o Hub procura satélites ou acaba de ativar.
    enabled: !!growId, refetchInterval: every, staleTime: Math.min(every, 10_000),
  });
}
/** Parear um satélite (plant_id e nome) ou renomear um já pareado. */
export function useUpdateDevice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; plant_id?: string } }) => api<DeviceResponse>(`/iot/devices/${id}`, { method: "PATCH", body }),
    onSuccess: () => client.invalidateQueries({ queryKey: DEVICES }),
  });
}
export function useDeleteDevice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/iot/devices/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: DEVICES }),
  });
}
/** Código de vínculo do Hub (8 caracteres, 15 min, uso único), enviado ao Hub pelo Bluetooth com o Wi-Fi. */
export function useHubClaimCode() {
  return useMutation({ mutationFn: (growId: string) => api<HubClaimCodeResponse>("/iot/hubs/claim-codes", { method: "POST", body: { grow_id: growId } }) });
}
/** Abre a janela de pareamento de satélites do Hub (pair_open pelo backend). */
export function useOpenHubPairing() {
  return useMutation({ mutationFn: ({ hubId, ttlS = PAIRING_TTL_S }: { hubId: string; ttlS?: number }) => api<HubPairingResponse>(`/iot/devices/${hubId}/pairing`, { method: "POST", body: { ttl_s: ttlS } }) });
}

/** Última leitura de cada dispositivo (a mesma query de `useLatestReading`, uma por id). */
export function useLatestReadings(deviceIds: string[]) {
  return useQueries({
    queries: deviceIds.map(id => ({
      queryKey: ["sensors", id, "latest"], queryFn: () => api<SensorReadingResponse | null>(`/sensors/${id}/latest`),
      refetchInterval: 30_000, staleTime: 20_000,
    })),
    combine: results => ({
      byId: Object.fromEntries(deviceIds.map((id, i) => [id, results[i]?.data ?? null])) as Record<string, SensorReadingResponse | null>,
      pending: results.some(r => r.isPending),
    }),
  });
}
/** Relógio da tela de sensores: "há 2 min" e as barras de 24 h andam sozinhos, a cada 30 s. */
export function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}
