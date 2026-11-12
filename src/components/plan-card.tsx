"use client";

import Link from "next/link";
import { CornerLink, Marker, PanelButton, PanelCard, PanelLabel, PanelTitle, SegMeter } from "@/components/panel";
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

/* ── Minha conta no painel (UX item 23b; web W4p 2423:24267, celular C1 2422:23315, estados E3–E5 2424:23475). ── */

function MeterBlock({ m, room }: { m: Meter; room: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <PanelLabel>{m.label}</PanelLabel>
      {m.seg ? <SegMeter filled={m.seg.used} total={m.seg.total} /> : room ? <span aria-hidden className="h-[22px]" /> : null}
      <Marker tone={m.mark === "limit" || m.mark === "out" ? "out" : "plain"}>{m.value}</Marker>
    </div>
  );
}

/** Perfil (só leitura): inicial num quadro escuro, nome e e-mail. */
export function AccountProfile({ name, email, exploring }: { name: string | null; email: string | null; exploring: boolean }) {
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  return (
    <PanelCard label="Perfil">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-md bg-display text-2xl font-black text-surface">{initial}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg leading-6 font-semibold text-text-primary">{name || "Sua conta"}</p>
          <p className="text-sm leading-5 break-words text-text-secondary">{[email, exploring ? "explorando" : "conta privada"].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
    </PanelCard>
  );
}

/** "SEU PLANO" (C1, E3–E5): os três medidores segmentados, a situação, o aviso e a ação do estado. */
export function AccountPlanCard({ planName, view, active, playUrl }: { planName: string; view: AccountPlanView; active: boolean; playUrl?: string }) {
  return (
    <PanelCard label="Seu plano" className={active ? "!border-primary" : ""}>
      <PanelTitle divider right={<CornerLink href={routes.credits()}>Uso e histórico</CornerLink>}>Seu plano <span className="ml-1 align-middle"><Marker>{planName}</Marker></span></PanelTitle>
      <div className="flex flex-wrap gap-x-5 gap-y-3">{view.meters.map(m => <MeterBlock key={m.label} m={m} room={view.meters.some(x => !!x.seg)} />)}</div>
      {view.situation && <p className="text-[15px] leading-[21px] text-text">{view.situation}</p>}
      {view.notice && <p className="text-[15px] leading-[21px] text-text">{view.notice}</p>}
      {view.offer && (
        <div className="flex flex-col gap-2 border-t border-stroke pt-3">
          <Marker tone="live">Recomendado para você</Marker>
          <p className="text-[15px] leading-[21px] text-text">{view.offer}</p>
        </div>
      )}
      {view.primary && <div className="flex"><PanelButton label={view.primary.label} href={view.primary.to === "packs" ? routes.packs() : routes.plans()} /></div>}
      {view.manage && <div className="flex">{view.manage === "play" && playUrl
        ? <PanelButton kind="clear" label="Gerenciar no Google Play" href={playUrl} external />
        : <PanelButton kind="clear" label="Gerenciar assinatura" href={routes.plans()} />}</div>}
      {view.link && <div className="flex"><PanelButton kind="clear" label={view.link.label} href={routes.plans()} /></div>}
    </PanelCard>
  );
}

/** Um grupo de linhas num cartão do painel (Configurações, Ajuda, Neste aparelho), com o título dentro. */
export function RowGroup({ title, rows }: { title: string; rows: { title: string; body: string; href: string | null; active?: boolean }[] }) {
  return (
    <PanelCard label={title}>
      <PanelTitle divider>{title}</PanelTitle>
      <ul className="-mt-1 flex flex-col">
        {rows.map(r => (
          <li key={r.title} className="border-b border-stroke last:border-b-0">
            <Link href={r.href ?? "#"} aria-current={r.active ? "page" : undefined}
              className={`-mx-1 flex min-h-16 items-center gap-3 rounded-md px-1 py-2.5 hover:bg-surface-high ${r.active ? "bg-surface-bobby" : ""}`}>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-base leading-6 font-semibold text-text-primary">{r.title}</span>
                <span className="text-sm leading-5 text-text-secondary">{r.body}</span>
              </span>
              <span aria-hidden className="text-text-primary">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}
