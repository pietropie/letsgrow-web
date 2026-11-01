"use client";

import { useState } from "react";
import { PLAN_NAMES } from "@/components/account";
import { BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner, UnavailableNotice } from "@/components/ui";
import { checkoutErrorMessage, startCheckout, useAccountBilling, useBillingCatalog, useCancelSubscription, useFeatureFlag, usePlanConfigs, type PlanConfig } from "@/lib/account";
import { usePlanStatus } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { formatBRL } from "@/shared/lib/accountFeatures";
import { shortDayMonth } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";
import type { BillingPeriod } from "@/shared/types/features";

const FAQ = [
  ["Posso cancelar a qualquer momento?", "Sim. Você pode cancelar quando quiser, e o acesso ao plano pago permanece até o fim do período contratado."],
  ["O que acontece com meus dados se eu fizer downgrade?", "Seus dados ficam preservados. Caso o número de plantas ou ambientes ultrapasse o limite do novo plano, você poderá visualizar, mas não criar novos itens."],
  ["O upgrade é imediato?", "Sim. Assim que o pagamento for confirmado, os novos limites são aplicados instantaneamente na sua conta."],
  ["Há período de teste grátis?", "O plano Free é permanente e sem restrição de tempo — use sem pagar enquanto os limites atenderem à sua necessidade."],
  ["Posso usar em vários dispositivos?", "Sim, sua conta funciona em qualquer dispositivo. Basta fazer login com o mesmo e-mail."],
] as const;

const normalize = (plan: string) => plan === "grower" ? "cultivador" : plan === "pro" ? "grower_pro" : plan;
const count = (n: number) => n >= 9999 ? "∞" : String(n);

/**
 * Planos (mobile plans.tsx, sem frame no Figma). Na web a assinatura é pelo Mercado Pago (WEBAPP.md §4): cartão é
 * recorrente, Pix paga um período adiantado. Sem o provedor no ar, os cartões não têm botão de compra. Uma assinatura
 * do Google Play só aparece como ativa, com o link para gerenciar no Play. A troca segue o flag `plan_switch`, como no app.
 */
export default function PlansPage() {
  const me = useMe().data;
  const status = usePlanStatus().data;
  const plans = usePlanConfigs();
  const catalog = useBillingCatalog();
  const billing = useAccountBilling();
  const cancel = useCancelSubscription();
  const flag = useFeatureFlag("plan_switch");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const currentPlan = normalize(status?.effective_plan ?? me?.plan ?? "free");
  const currentLabel = plans.data?.find(p => p.plan_key === currentPlan)?.label ?? PLAN_NAMES[currentPlan] ?? currentPlan;
  const enabled = flag.enabled || me?.is_dev_mode === true;
  const sale = catalog.data?.web_enabled ? catalog.data.plans : [];
  const hasYearly = sale.some(p => p.periods.some(x => x.period === "yearly" && x.price_brl != null));
  const current = billing.data?.current ?? null;
  const byPlay = billing.data?.managed_by === "google_play";

  async function buy(plan: PlanConfig, method: "card" | "pix") {
    setError(""); setBusy(`${plan.plan_key}:${method}`);
    try {
      const res = await startCheckout({ kind: "subscription", plan_key: plan.plan_key, period, method });
      if (!res.checkout_url) throw new Error("O Mercado Pago não devolveu o endereço do pagamento. Nada foi cobrado.");
      window.location.assign(res.checkout_url);
    } catch (e) {
      setError(checkoutErrorMessage(e) ?? getErrorMessage(e, "Não foi possível abrir o pagamento. Nada foi cobrado."));
      setBusy(null);
    }
  }

  function cta(plan: PlanConfig) {
    const isCurrent = plan.plan_key === currentPlan && (!current || current.period === period);
    if (isCurrent) return <p className="flex min-h-11 items-center justify-center rounded-[10px] bg-surface-high text-sm font-bold text-primary">✓ Plano ativo</p>;
    if (plan.plan_key === "free" || byPlay) return null;
    const price = sale.find(e => e.plan_key === plan.plan_key)?.periods.find(x => x.period === period)?.price_brl;
    if (price == null) return <p className="flex min-h-11 items-center justify-center rounded-[10px] border border-border text-sm font-bold text-text-muted">{catalog.data?.web_enabled ? "Indisponível neste período" : "Em breve"}</p>;
    const per = period === "monthly" ? "mês" : "ano";
    return <div className="flex flex-col gap-2">
      <Button label={busy === `${plan.plan_key}:card` ? "Abrindo o Mercado Pago…" : `Assinar com cartão · ${formatBRL(price)}/${per}`} loading={busy === `${plan.plan_key}:card`} disabled={!!busy} onClick={() => void buy(plan, "card")} />
      <Button secondary label={busy === `${plan.plan_key}:pix` ? "Abrindo o Mercado Pago…" : `Pagar 1 ${per} com Pix · ${formatBRL(price)}`} loading={busy === `${plan.plan_key}:pix`} disabled={!!busy} onClick={() => void buy(plan, "pix")} />
    </div>;
  }

  return (
    <>
      <BackLink fallback={routes.credits()} />
      <PageTitle>Planos</PageTitle>
      <PageSubtitle>Seu plano atual: {currentLabel}</PageSubtitle>
      {flag.isPending ? <Spinner /> : !enabled ? <>
        <UnavailableNotice body="A troca de planos ainda não está disponível. Fale com o suporte se precisar alterar seu plano agora." />
        <ButtonLink secondary label="Falar com o suporte" href={routes.support()} />
      </> : <>
        {(plans.isPending || catalog.isPending || billing.isPending) && <Spinner />}
        {plans.isError && <Notice title="Não foi possível carregar os planos" body="Tente novamente em instantes." />}
        {byPlay && <Notice white title="Assinatura pelo Google Play" body="Seu plano foi contratado no app Android e é gerenciado por lá.">
          {billing.data?.play_manage_url && <a href={billing.data.play_manage_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary underline">Gerenciar no Google Play</a>}
        </Notice>}
        {current && !byPlay && <Notice white title={`${PLAN_NAMES[current.plan_key] ?? current.plan_key} · ${current.kind === "recurring" ? "assinatura no cartão" : "pago com Pix"}`}
          body={current.auto_renew ? `Renova automaticamente${shortDayMonth(current.current_period_end) ? ` em ${shortDayMonth(current.current_period_end)}` : ""}.` : `Acesso até ${shortDayMonth(current.access_until ?? current.current_period_end) ?? "o fim do período pago"}, sem renovação.`}
          meta={billing.data?.upcoming ? `Depois: ${PLAN_NAMES[billing.data.upcoming.plan_key] ?? billing.data.upcoming.plan_key}, a partir de ${shortDayMonth(billing.data.upcoming.current_period_end) ?? "o fim do período atual"}.` : undefined} />}
        {current?.auto_renew && !byPlay && <Button secondary label="Cancelar a renovação" onClick={() => setConfirmCancel(true)} />}
        {catalog.data && !catalog.data.web_enabled && <Notice white title="Compra ainda não disponível" body="A assinatura pela web ainda não está no ar. Nada é cobrado por esta tela." />}
        {hasYearly && !byPlay && (
          <div role="radiogroup" aria-label="Período" className="grid grid-cols-2 gap-2">
            {(["monthly", "yearly"] as const).map(p => (
              <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                className={`min-h-11 rounded-[10px] border text-sm font-semibold cursor-pointer ${period === p ? "border-primary bg-surface-bobby text-primary" : "border-border bg-surface text-text-muted"}`}>{p === "monthly" ? "Mensal" : "Anual"}</button>
            ))}
          </div>
        )}
        <FormError message={error} />
        <div className="grid gap-3">
          {plans.data?.map(plan => {
            const isCurrent = plan.plan_key === currentPlan;
            return (
              <article key={plan.plan_key} className={`flex flex-col gap-3 rounded-2xl bg-surface p-4 ${isCurrent ? "border-2 border-primary" : "border border-border"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-text-primary">{plan.label}</h2>
                  {(isCurrent || plan.badge_text) && <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-bold text-sage-text">{isCurrent ? "Plano atual" : plan.badge_text}</span>}
                </div>
                <p><span className="text-[26px] font-extrabold text-text">{plan.price_display}</span><span className="text-sm text-text-muted"> / {plan.period_display}</span></p>
                <p className="text-sm leading-5 text-text-muted">{count(plan.max_plants)} plantas · {count(plan.max_grows)} ambientes · {count(plan.max_pots_per_grow)} vasos · {plan.ai_queries_per_month ? `${plan.ai_queries_per_month} consultas IA/mês` : "IA ilimitada"}{plan.sensors_allowed ? " · sensores IoT" : ""}</p>
                {cta(plan)}
              </article>
            );
          })}
        </div>
      </>}
      <h2 className="pt-2 text-lg font-semibold text-text-primary">Perguntas frequentes</h2>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {FAQ.map(([q, a]) => (
          <details key={q} className="border-b border-border p-4 last:border-b-0">
            <summary className="cursor-pointer text-base font-medium text-text">{q}</summary>
            <p className="mt-2 text-sm leading-5 text-text-muted">{a}</p>
          </details>
        ))}
      </div>
      <ConfirmDialog open={confirmCancel} title="Cancelar a renovação?" confirm="Cancelar renovação" destructive busy={cancel.isPending}
        message={`O plano continua ativo até ${shortDayMonth(current?.current_period_end) ?? "o fim do período pago"}. Depois, sua conta volta ao Free e seus dados ficam preservados.`}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setConfirmCancel(false), onError: e => { setConfirmCancel(false); setError(checkoutErrorMessage(e) ?? getErrorMessage(e, "Não foi possível cancelar agora.")); } })} />
    </>
  );
}
