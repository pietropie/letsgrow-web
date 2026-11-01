"use client";

import Link from "next/link";
import { useState } from "react";
import { routes } from "@/lib/routes";
import { useInstallContext } from "@/lib/pwa";

const KEY = "lg-install-banner-dismissed";

function wasDismissed() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** No Safari do iPhone, fora da Tela de Início: um convite discreto para instalar. "Agora não" some de vez neste aparelho. */
export function InstallBanner() {
  const ctx = useInstallContext();
  const [hidden, setHidden] = useState(false);
  if (ctx !== "ios-safari" || hidden || wasDismissed()) return null;
  return (
    <aside aria-label="Usar como app" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm leading-5 font-semibold text-text">Use o LetsGrow como app</span>
        <span className="text-[13px] leading-[18px] text-text-muted">Adicione à Tela de Início: abre em tela cheia, sem a barra do Safari.</span>
      </span>
      <Link href={routes.install()} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Ver como</Link>
      <button type="button" onClick={() => { try { localStorage.setItem(KEY, "1"); } catch { /* sem armazenamento: some só agora */ } setHidden(true); }}
        className="shrink-0 px-1 text-sm font-semibold text-text-muted cursor-pointer">Agora não</button>
    </aside>
  );
}
