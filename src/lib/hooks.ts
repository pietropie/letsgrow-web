"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { BobAlertsResponse } from "@/shared/types/bob";
import type { DailyBriefResponse, GrowResponse, GrowSummary, PlanStatusResponse, PlantResponse, PlantSummary } from "@/shared/types/api";
import { api } from "./api";

/** Mesmas chaves e rotas dos hooks do mobile (hooks/useGrows, useBobAlerts, useProfile, Início). */

export function useGrows() {
  return useQuery({ queryKey: ["grows"], queryFn: () => api<GrowSummary[]>("/grows") });
}

export function useGrow(id: string | null | undefined) {
  return useQuery({ queryKey: ["grows", id], queryFn: () => api<GrowResponse>(`/grows/${id}`), enabled: !!id });
}

export function useUpdateGrow(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: object) => api<GrowResponse>(`/grows/${id}`, { method: "PATCH", body }),
    onSuccess: () => Promise.all([client.invalidateQueries({ queryKey: ["grows"] }), client.invalidateQueries({ queryKey: ["weather", id] })]),
  });
}

export function useActivePlants() {
  return useQuery({ queryKey: ["plants", { is_active: true }], queryFn: () => api<PlantResponse[]>("/plants?is_active=true") });
}

export function usePlantSummaries() {
  return useQuery({ queryKey: ["plants", "summaries", { is_active: true }], queryFn: () => api<Record<string, PlantSummary>>("/plants/summaries?is_active=true") });
}

/** O servidor guarda o resumo por 24 h e ele não gasta consulta do plano. */
export function useDailyBrief() {
  return useQuery({ queryKey: ["plants", "daily-brief"], queryFn: () => api<DailyBriefResponse>("/plants/daily-brief"), staleTime: 60 * 60_000, retry: false });
}

export function useBobAlerts() {
  return useQuery({ queryKey: ["plants", "bob-alerts"], queryFn: () => api<BobAlertsResponse>("/plants/bob-alerts"), staleTime: 0 });
}

export function usePlanStatus() {
  return useQuery({ queryKey: ["plan-status"], queryFn: () => api<PlanStatusResponse>("/users/me/plan"), staleTime: 30_000 });
}

/** Minuto do dia (0–1439), atualizado na virada de cada minuto e ao voltar para a aba (como o useMinuteOfDay do mobile). */
export function useMinuteOfDay() {
  const read = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const [minute, setMinute] = useState(read);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { setMinute(read()); schedule(); };
    const schedule = () => { timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50); };
    const onVisible = () => { if (document.visibilityState === "visible") { clearTimeout(timer); tick(); } };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return minute;
}

/**
 * Ambiente escolhido no Início (H7: "a escolha fica lembrada"), guardado neste navegador.
 * Sem armazenamento (aba privada), vale só enquanto a página estiver aberta.
 */
const GROW_KEY = "letsgrow-environment";
const listeners = new Set<() => void>();
let memoryGrow: string | null = null;
function readGrow() {
  try { return window.localStorage.getItem(GROW_KEY) ?? memoryGrow; } catch { return memoryGrow; }
}
export function useRememberedGrow(): [string | null, (id: string) => void] {
  const value = useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    readGrow,
    () => null,
  );
  const select = (id: string) => {
    memoryGrow = id;
    try { window.localStorage.setItem(GROW_KEY, id); } catch { /* fica só na memória */ }
    listeners.forEach(l => l());
  };
  return [value, select];
}
