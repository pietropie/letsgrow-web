"use client";

import { useGrowDevices } from "@/lib/sensors";
import { useHubRelays } from "@/lib/relay-client";
import { equipmentOptions, type EquipKind, type RelayState } from "@/lib/relays";
import { formatClock, isLit, offMinute, scheduleFromGrow } from "@/shared/lib/lightSchedule";
import type { GrowResponse } from "@/shared/types/api";

/** O que a programação de luz do ambiente diz agora: acesa, até quando, quando volta a acender. */
export function scheduleFacts(grow: GrowResponse | null | undefined, minute: number) {
  const s = scheduleFromGrow(grow);
  if (s.onAt == null || s.light == null) return { lit: null, until: null, nextOn: null, window: null };
  if (s.light >= 1440) return { lit: true, until: null, nextOn: null, window: "o dia todo" };
  const off = offMinute(s.onAt, s.light);
  return {
    lit: isLit(minute, s.onAt, s.light),
    until: formatClock(off),
    nextOn: `${minute < s.onAt ? "hoje" : "amanhã"} às ${formatClock(s.onAt)}`,
    window: `${formatClock(s.onAt)} → ${formatClock(off)}`,
  };
}

export const SUBJECT: Record<EquipKind, string> = { light: "a luz", exhaust: "o exaustor", fan: "o ventilador" };

/** Hub do ambiente, os relés dele (quando a API já tem a rota) e os equipamentos que podem ir em cada posição. */
export function useGrowRelays(grow: GrowResponse | null | undefined) {
  const devices = useGrowDevices(grow?.id ?? "");
  const hub = (devices.data ?? []).find(d => d.module_type === "hub" && d.grow_id === grow?.id) ?? null;
  const relays = useHubRelays(hub?.id ?? null);
  const list: RelayState[] = relays.data?.relays ?? [];
  const options = hub ? equipmentOptions(relays.data?.equipment, hub.id) : [];
  const relayFor = (kind: EquipKind, key: string) => list.find(r => r.equip_kind === kind && r.equip_key === key) ?? null;
  return { devices, hub, relays, list, options, relayFor, online: relays.data?.online ?? false };
}
