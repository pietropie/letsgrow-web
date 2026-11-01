"use client";

import { useSyncExternalStore } from "react";

/**
 * Aviso que sobrevive a uma navegação ("Registro apagado."), como o store/flashStore do mobile.
 * A tela de destino lê e limpa.
 */
let message: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function showFlash(text: string) { message = text; emit(); }
export function clearFlash() { message = null; emit(); }
export function useFlash() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => message, () => null);
}
