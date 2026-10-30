"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { UserResponse } from "@/shared/types/api";
import { api, authAction } from "./api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api<UserResponse>("/auth/me"), staleTime: 5 * 60_000 });
}

/** Sair: apaga os cookies e o cache, para a próxima conta não ver dados da anterior. */
export function useLogout() {
  const client = useQueryClient();
  const router = useRouter();
  return async () => {
    try { await authAction("logout"); } finally {
      client.clear();
      router.replace("/entrar");
      router.refresh();
    }
  };
}
