"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError, api } from "./api";
import { screenFromApi, screenFromLocal, type SensorScreen } from "./sensor-cards";
import { useGrowDevices, useLatestReadings } from "./sensors";
import type { DeviceResponse } from "@/shared/types/api";

/**
 * Tela de sensores de um ambiente. A fonte é `GET /iot/grows/{grow_id}/sensors` (API-SENSORES-RELES.md §2), que já traz
 * os cartões, a faixa da fase e o mini-histórico. Enquanto a rota não está no ar (404), a tela é montada aqui, das
 * leituras de cada dispositivo, com as faixas fixas e sem histórico.
 */
export function useSensorScreen(growId: string, ctx: { growName: string; plantName: (id: string) => string | null; lightOn: boolean | null; inGrow: (d: DeviceResponse) => boolean }) {
  const q = useQuery({
    queryKey: ["iot", "grow-sensors", growId], queryFn: () => api<unknown>(`/iot/grows/${growId}/sensors`),
    enabled: !!growId, retry: false, refetchInterval: 30_000, staleTime: 20_000,
  });
  const missing = q.error instanceof ApiError && (q.error.response.status === 404 || q.error.response.status === 405);
  const devices = useGrowDevices(growId);
  const all = (devices.data ?? []).filter(ctx.inGrow);
  const paired = all.filter(d => d.is_paired || d.module_type !== "satellite");
  const latest = useLatestReadings(missing ? paired.map(d => d.id) : []);

  const screen: SensorScreen | null = q.data ? screenFromApi(q.data, ctx.growName)
    : missing && devices.data ? screenFromLocal(paired, latest.byId, ctx) : null;
  return {
    screen, devices, all,
    pending: !screen && (q.isPending || (missing && (devices.isPending || latest.pending))),
    error: !screen && ((q.isError && !missing) || devices.isError),
    refetch: () => { void q.refetch(); void devices.refetch(); },
  };
}
