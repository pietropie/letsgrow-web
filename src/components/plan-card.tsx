"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { useAccountBilling, useBillingCatalog, useCreditPackages, useFeatureFlag, usePlanConfigs } from "@/lib/account";
import { planCardView, type PlanCardView } from "@/lib/plans";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { useRecommendation } from "@/lib/recommendation-client";
import { useUsage } from "@/lib/usage-client";

/** Junta /plans/config, /billing/catalog, /billing/subscription e /usage no card. null enquanto carrega ou sem dado. */
export function usePlanCard(exploring: boolean): { view: PlanCardView | null; playUrl?: string } {
  const me = useMe().data;
  const plans = usePlanConfigs().data;
  const catalog = useBillingCatalog().data;
  const billing = useAccountBilling().data;
  const packages = useCreditPackages().data;
  const flag = useFeatureFlag("plan_switch");
  const usage = useUsage();
  const recommendation = useRecommendation();
  const current = billing?.effective_plan ?? me?.plan;
  if (!plans || !current || flag.isPending || usage.status === "loading" || recommendation.status === "loading") return { view: null };
  const view = planCardView({
    current, plans, catalog, exploring,
    recommended: recommendation.status === "ok" ? recommendation.rec.plan_key : null,
    usage: usage.status === "ok" ? usage.usage : null,
    subscription: billing?.current ?? null,
    canBuy: flag.enabled || me?.is_dev_mode === true,
    packs: !!catalog?.web_enabled && !!packages?.length,
  });
  return { view, playUrl: billing?.play_manage_url };
}

const TAG = { alert: "bg-state-alert", error: "bg-state-error", calm: "bg-source-highlight" } as const;
const STRIP = { normal: "bg-bg", alert: "bg-state-alert", error: "bg-bg" } as const;
const BAR = { normal: "var(--color-display)", alert: "var(--color-display)", error: "var(--color-state-error)" } as const;
const secondaryLink = "flex min-h-[52px] w-full items-center justify-center rounded-xl border border-border bg-surface px-4 py-[13px] text-center text-base leading-[22px] font-semibold text-text hover:bg-surface-high";

/** Item com o check verde dos benefícios (Figma P1, W26). */
export function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[15px] leading-[21px] text-text">
      <span aria-hidden className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-source-highlight">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/figma/check.svg" alt="" className="size-4" />
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Card "Seu plano" no topo da Minha conta (UX item 19, P1–P7; web W25). Um primário só ("Fazer upgrade" ou "Comprar
 * créditos"); no modo explorar, "Ver planos" é secundário. O toque fora do botão abre o link de baixo (Créditos e plano).
 */
export function PlanCard({ view, active = false, playUrl }: { view: PlanCardView; active?: boolean; playUrl?: string }) {
  const href = (to: "plans" | "packs" | "credits") => (to === "plans" ? routes.plans() : to === "packs" ? routes.packs() : routes.credits());
  const filled = view.usage?.bar == null ? 0 : Math.round(view.usage.bar * 10);
  return (
    <section aria-label="Seu plano" className={`relative flex flex-col gap-3 rounded-2xl border bg-surface p-4 ${active ? "border-primary" : "border-stroke"}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-label text-sm leading-[18px] text-text-secondary">SEU PLANO</h2>
        {view.tag && <span className={`font-label rounded px-1.5 text-[13px] leading-5 ${view.tag.tone === "error" ? "text-white" : "text-display"} ${TAG[view.tag.tone]}`}>{view.tag.label}</span>}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[26px] leading-8 font-extrabold text-text-primary">{view.name}</p>
        <p className="text-sm leading-5 text-text-muted">{view.lead}</p>
      </div>
      {view.usage && (
        <p className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm leading-5 font-semibold text-text-primary ${STRIP[view.usage.tone]}`}>
          {view.usage.bar != null && <span aria-hidden className="flex shrink-0 gap-[2px]">{Array.from({ length: 10 }, (_, i) => <span key={i} className="h-3.5 w-[5px] rounded-[1px]" style={{ background: i < filled ? BAR[view.usage!.tone] : "var(--color-stroke-soft)" }} />)}</span>}
          <span>{view.usage.text}</span>
        </p>
      )}
      {view.note && <p className="text-[15px] leading-[21px] text-text">{view.note}</p>}
      {view.upsell && <>
        <hr className="border-stroke" />
        <h3 className="font-label text-xs leading-4 text-text-secondary">COM O {view.upsell.plan.label.toUpperCase()}</h3>
        <ul className="flex flex-col gap-2">{view.upsell.benefits.map(b => <Benefit key={b}>{b}</Benefit>)}</ul>
        <p className="text-sm leading-5 font-semibold text-text-muted">{view.upsell.price}</p>
      </>}
      {(view.primary || view.secondary || view.manage) && (
        <div className="relative z-10 flex flex-col gap-2">
          {view.primary && <ButtonLink label={view.primary.label} href={href(view.primary.to)} />}
          {view.secondary && <ButtonLink secondary label={view.secondary.label} href={href(view.secondary.to)} />}
          {view.manage && (view.manage.to === "play" && playUrl
            ? <a href={playUrl} target="_blank" rel="noreferrer" className={secondaryLink}>Gerenciar no Google Play</a>
            : <Link href={routes.plans()} className={secondaryLink}>Gerenciar assinatura</Link>)}
        </div>
      )}
      <Link href={href(view.link.to)} className="flex min-h-11 items-center justify-between text-[15px] font-semibold text-text-primary after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:underline">
        {view.link.label}<span aria-hidden>›</span>
      </Link>
    </section>
  );
}
