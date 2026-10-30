"use client";

import { useEffect } from "react";

/** Registra public/sw.js só em produção: no `next dev` ele atrapalharia o recarregamento. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
