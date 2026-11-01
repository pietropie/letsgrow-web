"use client";

import { useSyncExternalStore } from "react";

/**
 * Onde a web está aberta, para a tela "Instalar no iPhone": iPhone/iPad no Safari, iPhone em outro navegador, já
 * instalada (aberta pela Tela de Início) ou outro aparelho. No servidor é "unknown", para não divergir na hidratação.
 */
export type InstallContext = "installed" | "ios-safari" | "ios-other" | "other" | "unknown";

function read(): InstallContext {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone || window.matchMedia("(display-mode: standalone)").matches) return "installed";
  const ua = nav.userAgent;
  // iPadOS 13+ se apresenta como Mac; o toque denuncia.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  if (!ios) return "other";
  return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other" : "ios-safari";
}

export function useInstallContext(): InstallContext {
  return useSyncExternalStore(() => () => {}, read, () => "unknown");
}
