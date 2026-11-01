"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeviceResponse, SensorReadingResponse } from "@/shared/types/api";
import { api } from "./api";

/** Sensores IoT (mobile hooks/useSensors e useDevices): as mesmas rotas e os mesmos intervalos de atualização. */

export interface SensorSummary {
  device_id: string;
  latest: SensorReadingResponse | null;
  avg_temp_air_24h: number | null;
  avg_humidity_24h: number | null;
  avg_vpd_24h: number | null;
  avg_co2_24h: number | null;
  alerts: string[];
}

const DEVICES = ["iot", "devices"] as const;

/** Dispositivos do ambiente, inclusive satélites ainda não pareados; a cada 15 s, para pegar os que o hub detectar. */
export function useGrowDevices(growId: string) {
  return useQuery({
    queryKey: [...DEVICES, growId, false],
    queryFn: () => api<DeviceResponse[]>(`/iot/devices?grow_id=${growId}&paired_only=false`),
    refetchInterval: 15_000, staleTime: 10_000,
  });
}
export function useRegisterDevice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { grow_id: string; plant_id?: string; name: string; esp32_mac: string }) => api<DeviceResponse>("/iot/devices", { method: "POST", body }),
    onSuccess: () => client.invalidateQueries({ queryKey: DEVICES }),
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
export function useLatestReading(deviceId: string | null) {
  return useQuery({
    queryKey: ["sensors", deviceId, "latest"], queryFn: () => api<SensorReadingResponse | null>(`/sensors/${deviceId}/latest`),
    enabled: !!deviceId, refetchInterval: 30_000, staleTime: 20_000,
  });
}
export function useSensorSummary(deviceId: string | null) {
  return useQuery({
    queryKey: ["sensors", deviceId, "summary"], queryFn: () => api<SensorSummary>(`/sensors/${deviceId}/summary`),
    enabled: !!deviceId, refetchInterval: 60_000, staleTime: 30_000,
  });
}
