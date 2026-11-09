"use client";

import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { api } from "./api";
import { RECOMMENDATION_FIXTURES } from "./recommendation-fixtures";
import type { Recommendation } from "./recommendation";

export type RecommendationState = { status: "loading" } | { status: "error"; retry: () => void } | { status: "ok"; rec: Recommendation };

function devFixture(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  return new URLSearchParams(window.location.search).get("rec");
}

/** GET /billing/recommendation?platform=web (regra do backend, UX item 19b). Em desenvolvimento, `?rec=R1`…`R3` troca pelo exemplo. */
export function useRecommendation(): RecommendationState {
  const fixture = useSyncExternalStore(() => () => {}, devFixture, () => null);
  const query = useQuery({ queryKey: ["billing", "recommendation"], queryFn: () => api<Recommendation>("/billing/recommendation?platform=web"), enabled: !fixture, staleTime: 15_000, retry: 1 });
  if (fixture && RECOMMENDATION_FIXTURES[fixture]) return { status: "ok", rec: RECOMMENDATION_FIXTURES[fixture] };
  if (query.isPending) return { status: "loading" };
  if (!query.data) return { status: "error", retry: () => void query.refetch() };
  return { status: "ok", rec: query.data };
}
