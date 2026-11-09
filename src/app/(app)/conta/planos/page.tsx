"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PLAN_NAMES } from "@/components/account";
import { Benefit } from "@/components/plan-card";
import { BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner, UnavailableNotice } from "@/components/ui";
import { checkoutErrorMessage, startCheckout, useAccountBilling, useBillingCatalog, useCancelSubscription, useFeatureFlag, usePlanConfigs } from "@/lib/account";
import { benefits, brl, comparisonRows, normalizePlan, planFeatures, plansForSale, priceOf, recommendedPlan, yearlySaving, type PlanLimits } from "@/lib/plans";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { shortDayMonth } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";
import type { BillingPeriod } from "@/shared/types/features";

// "Tem teste grátis?" no topo, como no Figma S3 (2389:20102): o Free é o teste, as assinaturas não têm período de teste.
const FAQ = [
  ["Tem teste grátis?", "O plano Free é o teste: é grátis e não tem prazo. As assinaturas não têm período de teste."],
  ["Posso cancelar a qualquer momento?", "Sim. Você pode cancelar quando quiser, e o acesso ao plano pago permanece até o fim do período contratado."],
  ["O que acontece com meus dados se eu voltar ao Free?", "Seus dados ficam preservados. Se o número de plantas ou ambientes passar do limite do Free, você continua vendo tudo, mas não cria novos itens."],
  ["O upgrade é imediato?", "Sim. Assim que o pagamento é confirmado, os novos limites valem na sua conta."],
  ["Posso usar em vários dispositivos?", "Sim, sua conta funciona em qualquer dispositivo. Basta entrar com o mesmo e-mail."],
] as const;

const TAG = "font-label self-start rounded px-1.5 text-[13px] leading-5 text-display whitespace-nowrap";
const PERIOD = { monthly: { short: "mês", name: "mensal" }, yearly: { short: "ano", name: "anual" } } as const;

/**
 * Planos (UX item 19; web W26 2390:20792 e W27 2390:21035). À venda, só o que tem preço em GET /billing/catalog
 * (web_enabled); limites e benefícios de /plans/config. O recomendado vem marcado; o plano atual aparece como "Seu plano"
 * e nunca é oferecido. Na web o pagamento é pelo Mercado Pago: cartão renova, Pix paga um período. Uma assinatura do
 * Google Play só aparece como ativa, com o link para gerenciar no Play. A compra segue o flag `plan_switch`.
 * Sem anual com desconto real, sem seletor; sem nota real da Play Store, sem prova social; sem selo "Popular".
 */
export default function PlansPage() {
  return <Suspense fallback={<Spinner />}><Plans /></Suspense>;
}

function Plans() {
  const me = useMe().data;
  const params = useSearchParams();
  const plans = usePlanConfigs();
  const catalog = useBillingCatalog();
  const billing = useAccountBilling();
  const cancel = useCancelSubscription();
  const flag = useFeatureFlag("plan_switch");
  const [picked, setPicked] = useState<string | null>(null);
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const all: PlanLimits[] = plans.data ?? [];
  const currentKey = normalizePlan(billing.data?.effective_plan ?? me?.plan ?? "free");
  const mine = all.find(p => p.plan_key === currentKey);
  const enabled = flag.enabled || me?.is_dev_mode === true;
  const current = billing.data?.current ?? null;
  const byPlay = billing.data?.managed_by === "google_play";
  const sale = byPlay ? [] : plansForSale(all, catalog.data).filter(p => p.plan_key !== currentKey);
  const recommended = recommendedPlan(currentKey, all, catalog.data);
  const asked = params.get("plano");
  const selected = sale.find(p => p.plan_key === (picked ?? asked)) ?? (recommended && sale.includes(recommended) ? recommended : sale[0]) ?? null;
  const saving = selected ? yearlySaving(catalog.data, selected.plan_key) : null;
  const chosenPeriod: BillingPeriod = saving ? period : "monthly";
  const price = selected ? priceOf(catalog.data, selected.plan_key, chosenPeriod) : null;
  const columns = [...(mine ? [mine] : []), ...sale].sort((a, b) => all.indexOf(a) - all.indexOf(b));

  async function buy() {
    if (!selected) return;
    setError(""); setBusy(true);
    try {
      const res = await startCheckout({ kind: "subscription", plan_key: selected.plan_key, period: chosenPeriod, method });
      if (!res.checkout_url) throw new Error("O Mercado Pago não devolveu o endereço do pagamento. Nada foi cobrado.");
      window.location.assign(res.checkout_url);
    } catch (e) {
      setError(checkoutErrorMessage(e) ?? getErrorMessage(e, "Não foi possível abrir o pagamento. Nada foi cobrado."));
      setBusy(false);
    }
  }

  function saleCard(plan: PlanLimits) {
    const isSelected = plan === selected;
    const p = priceOf(catalog.data, plan.plan_key, saving && isSelected ? chosenPeriod : "monthly");
    const per = PERIOD[saving && isSelected ? chosenPeriod : "monthly"].short;
    const items = [...benefits(plan, mine), mine?.plan_key === "free" ? "Tudo do Free: diário, fotos, timer da luz e clima" : `Tudo do ${mine?.label ?? "seu plano"}`];
    const body = <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[26px] leading-8 font-extrabold text-text-primary">{plan.label}</h2>
        {plan === recommended && <span className={`${TAG} bg-source-highlight`}>RECOMENDADO PARA VOCÊ</span>}
      </div>
      {p != null && <p><span className="text-[28px] leading-9 font-extrabold text-text-primary">{brl(p)}</span><span className="text-base text-text-muted"> /{per}</span></p>}
      <p className="text-sm leading-5 text-text-muted">Cartão (renova todo {per}) ou Pix (1 {per}).</p>
      <ul className="flex flex-col gap-2">{items.map(b => <Benefit key={b}>{b}</Benefit>)}</ul>
    </>;
    const cls = `flex flex-col gap-3 rounded-2xl bg-surface p-4 text-left md:p-5 ${isSelected ? "border-2 border-primary" : "border border-stroke"}`;
    // Com um plano só à venda, o cartão é informação; com vários, escolhe o plano do resumo.
    return sale.length > 1
      ? <button key={plan.plan_key} type="button" role="radio" aria-checked={isSelected} onClick={() => setPicked(plan.plan_key)} className={`${cls} cursor-pointer`}>{body}</button>
      : <article key={plan.plan_key} className={cls}>{body}</article>;
  }

  const ready = !plans.isPending && !catalog.isPending && !billing.isPending;
  return (
    <>
      <BackLink fallback={routes.account()} />
      <PageTitle>Planos</PageTitle>
      <PageSubtitle>Acompanhe mais plantas e converse mais com o Bobby.</PageSubtitle>
      {flag.isPending ? <Spinner /> : !enabled ? <>
        <UnavailableNotice body="A troca de planos ainda não está disponível. Fale com o suporte se precisar alterar seu plano agora." />
        <ButtonLink secondary label="Falar com o suporte" href={routes.support()} />
      </> : !ready ? <Spinner /> : <>
        {plans.isError && <Notice title="Não foi possível carregar os planos" body="Tente novamente em instantes." />}
        {byPlay && <Notice white title="Assinatura pelo Google Play" body="Seu plano foi contratado no app Android e é gerenciado por lá.">
          {billing.data?.play_manage_url && <a href={billing.data.play_manage_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary underline">Gerenciar no Google Play</a>}
        </Notice>}
        {current && !byPlay && <Notice white title={`${PLAN_NAMES[current.plan_key] ?? current.plan_key} · ${current.kind === "recurring" ? "assinatura no cartão" : "pago com Pix"}`}
          body={current.auto_renew ? `Renova automaticamente${shortDayMonth(current.current_period_end) ? ` em ${shortDayMonth(current.current_period_end)}` : ""}.` : `Acesso até ${shortDayMonth(current.access_until ?? current.current_period_end) ?? "o fim do período pago"}, sem renovação.`}
          meta={billing.data?.upcoming ? `Depois: ${PLAN_NAMES[billing.data.upcoming.plan_key] ?? billing.data.upcoming.plan_key}, a partir de ${shortDayMonth(billing.data.upcoming.current_period_end) ?? "o fim do período atual"}.` : undefined} />}
        {current?.auto_renew && !byPlay && <Button secondary label="Cancelar a renovação" onClick={() => setConfirmCancel(true)} />}
        {catalog.data && !catalog.data.web_enabled && <Notice white title="Compra ainda não disponível" body="A assinatura pela web ainda não está no ar. Nada é cobrado por esta tela." />}
        {!(selected && price != null) && <FormError message={error} />}
        {!byPlay && catalog.data?.web_enabled && !sale.length && mine && <Notice white title="Você já está no maior plano à venda" body="Não há outro plano para assinar agora." />}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div role={sale.length > 1 ? "radiogroup" : undefined} aria-label={sale.length > 1 ? "Plano" : undefined} className="grid gap-4 md:grid-cols-2 md:items-start lg:col-start-1">
            {sale.map(saleCard)}
            {mine && (
              <article className="flex flex-col gap-3 rounded-2xl border border-stroke bg-surface p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-[26px] leading-8 font-extrabold text-text-primary">{mine.label}</h2>
                  <span className={`${TAG} bg-state-stable`}>SEU PLANO</span>
                </div>
                <ul className="flex flex-col gap-2">{planFeatures(mine).map(f => <Benefit key={f}>{f}</Benefit>)}</ul>
              </article>
            )}
          </div>

          {selected && price != null && (
            <section aria-label="Resumo" className="flex flex-col gap-3 rounded-2xl border border-stroke bg-surface p-4 md:p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <h2 className="font-label text-xs leading-4 text-text-secondary">RESUMO</h2>
              <p className="text-lg leading-6 font-bold text-text-primary">{selected.label} · {PERIOD[chosenPeriod].name}</p>
              <p><span className="text-[28px] leading-9 font-extrabold text-text-primary">{brl(price)}</span><span className="text-base text-text-muted"> /{PERIOD[chosenPeriod].short}</span></p>
              {saving && (
                <div role="radiogroup" aria-label="Período" className="grid grid-cols-2 gap-2">
                  {(["monthly", "yearly"] as const).map(p => (
                    <button key={p} type="button" role="radio" aria-checked={chosenPeriod === p} onClick={() => setPeriod(p)}
                      className={`min-h-11 rounded-[10px] border text-sm font-semibold cursor-pointer ${chosenPeriod === p ? "border-primary bg-surface-bobby text-primary" : "border-border bg-surface text-text-muted"}`}>
                      {p === "monthly" ? "Mensal" : `Anual · economize ${saving} %`}
                    </button>
                  ))}
                </div>
              )}
              <h3 className="font-label pt-1 text-xs leading-4 text-text-secondary">FORMA DE PAGAMENTO</h3>
              <div role="radiogroup" aria-label="Forma de pagamento" className="flex flex-col gap-2">
                {([["card", "Cartão de crédito", `Renova todo ${PERIOD[chosenPeriod].short} até você cancelar.`], ["pix", "Pix", `Paga 1 ${PERIOD[chosenPeriod].short}. Não renova sozinho; para continuar, pague de novo.`]] as const).map(([key, title, body]) => (
                  <button key={key} type="button" role="radio" aria-checked={method === key} onClick={() => setMethod(key)}
                    className={`flex items-start gap-3 rounded-xl bg-surface p-3 text-left cursor-pointer ${method === key ? "border-2 border-primary" : "border border-stroke"}`}>
                    <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${method === key ? "border-primary" : "border-text-muted"}`}>
                      {method === key && <span className="size-2.5 rounded-full bg-primary" />}
                    </span>
                    <span className="flex flex-col gap-0.5"><span className="text-base leading-6 font-semibold text-text-primary">{title}</span><span className="text-sm leading-5 text-text-muted">{body}</span></span>
                  </button>
                ))}
              </div>
              <FormError message={error} />
              <Button label={busy ? "Abrindo o Mercado Pago…" : "Continuar no Mercado Pago"} loading={busy} onClick={() => void buy()} />
              <p className="text-xs leading-[18px] text-text-muted">Você conclui o pagamento no Mercado Pago. O plano é liberado quando o pagamento é confirmado. Cancele a renovação em Conta › Créditos e plano.</p>
            </section>
          )}

          {sale.length > 0 && columns.length > 1 && (
            <div className="overflow-x-auto rounded-2xl border border-stroke bg-surface px-4 py-2 lg:col-start-1">
              <table className="w-full min-w-[320px] text-left">
                <caption className="sr-only">Comparar planos</caption>
                <thead><tr className="border-b border-stroke">
                  <th scope="col" className="py-3"><span className="sr-only">Recurso</span></th>
                  {columns.map(p => <th key={p.plan_key} scope="col" className="font-label px-2 py-3 text-center text-xs leading-4 font-normal text-text-secondary">{p.label}</th>)}
                </tr></thead>
                <tbody>
                  {comparisonRows(columns).map(row => (
                    <tr key={row.label} className="border-b border-stroke last:border-b-0">
                      <th scope="row" className="py-3.5 pr-2 text-[15px] leading-5 font-normal text-text">{row.label}</th>
                      {row.values.map((v, i) => <td key={columns[i].plan_key} className="px-2 py-3.5 text-center text-[15px] leading-5 font-semibold text-text-primary">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>}
      <div className="flex max-w-[720px] flex-col gap-3">
        <h2 className="pt-2 text-lg font-semibold text-text-primary">Perguntas frequentes</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="border-b border-border p-4 last:border-b-0">
              <summary className="cursor-pointer text-base font-medium text-text">{q}</summary>
              <p className="mt-2 text-sm leading-5 text-text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
      <ConfirmDialog open={confirmCancel} title="Cancelar a renovação?" confirm="Cancelar renovação" destructive busy={cancel.isPending}
        message={`O plano continua ativo até ${shortDayMonth(current?.current_period_end) ?? "o fim do período pago"}. Depois, sua conta volta ao Free e seus dados ficam preservados.`}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setConfirmCancel(false), onError: e => { setConfirmCancel(false); setError(checkoutErrorMessage(e) ?? getErrorMessage(e, "Não foi possível cancelar agora.")); } })} />
    </>
  );
}
