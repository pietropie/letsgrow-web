"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { api } from "./api";
import { USAGE_FIXTURES } from "./usage-fixtures";
import type { Usage } from "./usage";

/**
 * Liga o mostrador ao GET /usage (em produção desde o backend 5328a71). Desligar volta a Conta, o Bobby e o Início ao
 * que eram antes. Em desenvolvimento, `?uso=U1`…`U10` troca a resposta pelo exemplo do estado.
 */
export const USAGE_LIVE = true;

export type UsageState = { status: "off" } | { status: "loading" } | { status: "error"; retry: () => void } | { status: "ok"; usage: Usage };

function devFixture(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return new URLSearchParams(window.location.search).get("uso");
}

export function useUsage(): UsageState {
  const fixture = useSyncExternalStore(() => () => {}, devFixture, () => null);
  const query = useQuery({ queryKey: ["usage"], queryFn: () => api<Usage>("/usage"), enabled: USAGE_LIVE && !fixture, staleTime: 15_000 });
  if (fixture) {
    if (fixture === "U10") return { status: "error", retry: () => {} };
    const f = USAGE_FIXTURES[fixture];
    return f ? { status: "ok", usage: f.usage } : { status: "off" };
  }
  if (!USAGE_LIVE) return { status: "off" };
  if (query.isPending) return { status: "loading" };
  if (!query.data) return { status: "error", retry: () => void query.refetch() };
  return { status: "ok", usage: query.data };
}
