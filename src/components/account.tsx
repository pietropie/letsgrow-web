"use client";

import { BackLink } from "@/components/ui";
import { routes } from "@/lib/routes";

/** "Voltar" de um item de primeiro nível da conta: só no celular, porque no desktop a lista fica ao lado (W19). */
export function AccountBack() {
  return <div className="md:hidden"><BackLink fallback={routes.account()} /></div>;
}

const TAG = { paid: ["PAGO", "bg-source-highlight"], pending: ["PENDENTE", "bg-state-alert"], failed: ["FALHOU", "bg-state-error"] } as const;

/** W21: um cartão por estado do retorno do checkout (PAGO, PENDENTE, FALHOU), com as ações embaixo. */
export function CheckoutResult({ state, title, body, meta, children }: { state: keyof typeof TAG; title: string; body: string; meta?: string; children: React.ReactNode }) {
  const [label, cls] = TAG[state];
  return (
    <section aria-live="polite" className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface p-4 md:p-6">
      <span className={`font-label self-start px-1.5 text-[13px] leading-4 text-display ${cls}`}>{label}</span>
      <h1 className="text-[22px] leading-7 font-bold text-text-primary">{title}</h1>
      <p className="text-base leading-6 text-text">{body}</p>
      {meta && <p className="text-sm leading-5 text-text-muted">{meta}</p>}
      {children}
    </section>
  );
}

export const PLAN_NAMES: Record<string, string> = { free: "Free", jardineiro: "Jardineiro", cultivador: "Cultivador", grower_pro: "Grower Pro", grower: "Cultivador", pro: "Grower Pro" };
