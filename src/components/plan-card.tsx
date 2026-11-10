"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { useAccountBilling, useCreditPackages, useBillingCatalog, useFeatureFlag, usePlanConfigs } from "@/lib/account";
import { accountPlanView, type AccountPlanView } from "@/lib/account-v2";
import { planBandView, type Meter } from "@/lib/home-v3";
import { normalizePlan } from "@/lib/plans";
import { useRecommendation } from "@/lib/recommendation-client";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { useUsage } from "@/lib/usage-client";

/**
 * Minha conta v2 (UX item 21; Figma A1–A4, web W31): perfil só leitura, o cartão "Plano e uso" enxuto e as linhas
 * agrupadas. Substitui o card "Seu plano" do item 19 (sem benefícios nem preço; a comparação fica em Planos).
 */

/** Junta /billing/recommendation, /usage e /billing/subscription. null enquanto carrega ou se algum falhar. */
export function useAccountPlan(exploring: boolean): { view: AccountPlanView; planName: string; free: boolean; playUrl?: string } | null {
  const me = useMe().data;
  const plans = usePlanConfigs().data;
  const billing = useAccountBilling();
  const catalog = useBillingCatalog().data;
  const packages = useCreditPackages().data;
  const flag = useFeatureFlag("plan_switch");
  const usage = useUsage();
  const recommendation = useRecommendation();
  if (!plans || flag.isPending || billing.isPending || usage.status === "loading" || recommendation.status !== "ok") return null;
  const rec = recommendation.rec;
  const label = (key: string | null) => key ? plans.find(p => p.plan_key === normalizePlan(key))?.label ?? null : null;
  const planName = label(rec.current_plan);
  if (!planName) return null;
  const u = usage.status === "ok" ? usage.usage : null;
  const band = planBandView(rec, u, label(rec.plan_key));
  const view = accountPlanView({
    rec, usage: u, sub: billing.data?.current ?? null, meters: band.meters, offerText: band.offer?.text ?? null,
    recommendedLabel: label(rec.plan_key), exploring,
    canBuy: flag.enabled || me?.is_dev_mode === true,
    packs: !!catalog?.web_enabled && !!packages?.length,
  });
  return { view, planName, free: rec.current_plan === "free", playUrl: billing.data?.play_manage_url };
}

const label = "font-label text-xs leading-4 text-text-secondary";
const DOT = { limit: "bg-state-alert", near: "bg-state-alert", out: "bg-state-error" } as const;
const MARK = { limit: "no limite", near: "perto do fim", out: "esgotado" } as const;
const secondary = "flex min-h-[52px] w-full items-center justify-center rounded-xl border border-border bg-surface px-4 py-[13px] text-center text-base leading-[22px] font-semibold text-text hover:bg-surface-high";

function MeterCell({ m }: { m: Meter }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className={label}>{m.label}</p>
      <p className="flex items-center gap-1.5 text-[15px] leading-5 font-bold text-text-primary">
        <span className="truncate">{m.value}</span>
        {m.mark && <><span aria-hidden className={`size-2.5 shrink-0 rounded-full border border-display ${DOT[m.mark]}`} /><span className="sr-only">{MARK[m.mark]}</span></>}
      </p>
      <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-stroke-soft">
        {m.fill != null && <span className="block h-full rounded-full bg-display" style={{ width: `${Math.round(m.fill * 100)}%` }} />}
      </span>
    </div>
  );
}

/** Perfil (só leitura): inicial, nome, e-mail e a etiqueta do plano. */
export function AccountProfile({ name, email, exploring, plan }: { name: string | null; email: string | null; exploring: boolean; plan: { name: string; free: boolean } | null }) {
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3.5">
      <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-source-highlight text-2xl font-bold text-text-primary">{initial}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl leading-7 font-bold text-text-primary">{name || "Sua conta"}</p>
        <p className="text-sm leading-5 break-words text-text-secondary">{[email, exploring ? "explorando" : "conta privada"].filter(Boolean).join(" · ")}</p>
      </div>
      {plan && <span className={`font-label shrink-0 rounded px-1.5 text-[13px] leading-5 text-display ${plan.free ? "bg-state-stable" : "bg-source-highlight"}`}>{plan.name.toUpperCase()}</span>}
    </div>
  );
}

/** "Plano e uso" (A1–A4, W31): nome, situação, os três medidores do Início v3 e a ação do estado. */
export function AccountPlanCard({ planName, view, active, playUrl }: { planName: string; view: AccountPlanView; active: boolean; playUrl?: string }) {
  return (
    <section aria-label="Plano e uso" className={`flex flex-col gap-3 rounded-2xl border bg-surface p-4 ${active ? "border-primary" : "border-stroke"}`}>
      <div className="flex items-start justify-between gap-2">
        <div><p className={label}>SEU PLANO</p><p className="text-[26px] leading-8 font-extrabold text-text-primary">{planName}</p></div>
        <Link href={routes.credits()} className="flex min-h-11 items-center gap-1 text-[15px] font-semibold text-text-primary hover:underline">Uso e histórico <span aria-hidden>›</span></Link>
      </div>
      {view.situation && <p className="text-[15px] leading-5 text-text-secondary">{view.situation}</p>}
      <div className="grid grid-cols-3 gap-3">{view.meters.map(m => <MeterCell key={m.label} m={m} />)}</div>
      {view.notice && <p className="rounded-lg bg-state-alert px-3 py-2.5 text-[15px] leading-5 font-semibold text-text-primary">{view.notice}</p>}
      {view.offer && (
        <div className="flex flex-col gap-1 rounded-xl bg-source-highlight p-3.5">
          <p className="font-label text-xs leading-4 text-display">RECOMENDADO PARA VOCÊ</p>
          <p className="text-[15px] leading-[21px] font-semibold text-text-primary">{view.offer}</p>
        </div>
      )}
      {view.primary && <ButtonLink label={view.primary.label} href={view.primary.to === "packs" ? routes.packs() : routes.plans()} />}
      {view.manage && (view.manage === "play" && playUrl
        ? <a href={playUrl} target="_blank" rel="noreferrer" className={secondary}>Gerenciar no Google Play</a>
        : <Link href={routes.plans()} className={secondary}>Gerenciar assinatura</Link>)}
      {view.link && <Link href={routes.plans()} className="flex min-h-11 items-center justify-center gap-1 text-[15px] font-semibold text-text-primary hover:underline">{view.link.label} <span aria-hidden>›</span></Link>}
    </section>
  );
}

/** Um grupo de linhas num cartão, com divisórias (Configurações, Ajuda, Neste aparelho). */
export function RowGroup({ title, rows }: { title: string; rows: { title: string; body: string; href: string | null; active?: boolean }[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className={`${label} px-0.5`}>{title.toUpperCase()}</h2>
      <ul className="overflow-hidden rounded-2xl border border-stroke bg-surface">
        {rows.map(r => (
          <li key={r.title} className="border-b border-stroke last:border-b-0">
            <Link href={r.href ?? "#"} aria-current={r.active ? "page" : undefined}
              className={`flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-high ${r.active ? "bg-surface-bobby" : ""}`}>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-base leading-6 font-semibold text-text-primary">{r.title}</span>
                <span className="text-sm leading-5 text-text-secondary">{r.body}</span>
              </span>
              <span aria-hidden className="text-lg text-text-primary">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
