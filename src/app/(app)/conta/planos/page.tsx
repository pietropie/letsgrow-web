"use client";

import { Suspense, useState } from "react";
import { PLAN_NAMES } from "@/components/account";
import { BackLink, Button, ButtonLink, ConfirmDialog, FormError, Notice, PageTitle, Spinner, UnavailableNotice } from "@/components/ui";
import { checkoutErrorMessage, startCheckout, useAccountBilling, useBillingCatalog, useCancelSubscription, useFeatureFlag, usePlanConfigs } from "@/lib/account";
import { brl, normalizePlan, periodPrice, yearlySaving, type Period, type PlanLimits } from "@/lib/plans";
import { recommendationView, underOneRealADay, type RecommendationView } from "@/lib/recommendation";
import { useRecommendation } from "@/lib/recommendation-client";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { useUsage } from "@/lib/usage-client";
import { shortDayMonth } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";

// W28: "Tem teste grátis?" e "Como cancelo?"; W29 acrescenta "Plano ou créditos?". O cancelamento da web fica nesta tela.
const FAQ = [
  ["Tem teste grátis?", "O plano Free é o teste: é grátis e não tem prazo. As assinaturas não têm período de teste."],
  ["Como cancelo?", "Em Conta › Planos › Cancelar a renovação. O plano vale até o fim do período pago."],
  ["Plano ou créditos?", "O plano define plantas, ambientes e consultas do mês. Créditos, quando ativos, pagam tarefas avulsas."],
] as const;

const TAG = "font-label self-start rounded px-1.5 text-[13px] leading-5 whitespace-nowrap";
const PAY = (period: Period) => ({
  card: ["Cartão de crédito", `Renova todo ${period === "yearly" ? "ano" : "mês"} até você cancelar.`],
  pix: ["Pix", `Paga 1 ${period === "yearly" ? "ano" : "mês"}. Não renova sozinho; para continuar, pague de novo.`],
}) as const;
const PERIOD_WORD = { monthly: "mês", yearly: "ano" } as const;
const limit = (n: number | null) => (n == null || n >= 9999 ? "Sem limite" : String(n));

function Check() {
  return (
    <span aria-hidden className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-source-highlight">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/figma/check.svg" alt="" className="size-4" />
    </span>
  );
}

/** "Seu uso hoje": três barras e a conclusão (amarela com motivo, verde sem motivo). */
function UsageBlock({ view, planLabel }: { view: RecommendationView["usage"]; planLabel: string }) {
  return (
    <section aria-label="Seu uso hoje" className="flex flex-col gap-4 rounded-2xl border border-stroke bg-surface p-4 md:p-6">
      <div className="flex items-center justify-between gap-2 md:justify-start md:gap-3">
        <h2 className="font-label text-sm leading-[18px] text-text-secondary">SEU USO HOJE</h2>
        <span className={`${TAG} bg-state-stable text-display`}>PLANO {planLabel.toUpperCase()}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3 md:gap-8">
        {view.rows.map(r => (
          <div key={r.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[15px] leading-5 font-semibold text-text-primary">{r.label}</span>
              {r.tag && <span className={`${TAG} bg-state-alert text-display`}>{r.tag.label}</span>}
              <span className="text-[15px] leading-5 font-bold text-text-primary">{r.value}</span>
            </div>
            <span role="img" aria-label={`${r.label}: ${r.value}`} className="block h-2 overflow-hidden rounded-full bg-stroke-soft">
              <span className="block h-full rounded-full bg-display" style={{ width: `${Math.round(r.fill * 100)}%` }} />
            </span>
          </div>
        ))}
      </div>
      <p className={`rounded-lg px-3.5 py-2.5 text-[15px] leading-[21px] font-semibold text-text-primary ${view.tone === "alert" ? "bg-state-alert" : "bg-source-highlight"}`}>{view.conclusion}</p>
    </section>
  );
}

/** O cartão do plano em destaque: escuro com motivo ("RECOMENDADO PARA VOCÊ"), claro sem motivo ("PRÓXIMO PASSO"). */
function Highlight({ view, plan, price, period, saving, toggle }: {
  view: NonNullable<RecommendationView["highlight"]>; plan: PlanLimits;
  price: { total: number; months: number; perMonth: number }; period: Period; saving: number | null; toggle: React.ReactNode;
}) {
  const d = view.dark;
  const muted = d ? "text-white/75" : "text-text-muted";
  const cheap = underOneRealADay(price.perMonth);
  return (
    <section aria-label={`${view.tag === "PRÓXIMO PASSO" ? "Próximo passo" : "Recomendado para você"}: ${plan.label}`}
      className={`flex flex-col gap-5 rounded-[20px] p-5 md:p-7 ${d ? "bg-text-primary text-white" : "border-2 border-primary bg-surface text-text-primary"}`}>
      <span className={`${TAG} ${d ? "bg-source-highlight text-display" : "bg-state-stable text-display"}`}>{view.tag}</span>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-[34px] leading-10 font-black">{plan.label}</h2>
          <p className={`text-base leading-6 ${muted}`}>{view.reason}</p>
        </div>
        <div className="flex flex-col gap-1 md:items-end">
          {toggle}
          <p className="whitespace-nowrap"><span className="text-[40px] leading-[44px] font-black">{brl(price.perMonth)}</span><span className={`text-base ${muted}`}> /mês</span></p>
          <p className={`text-sm leading-5 ${muted}`}>{period === "yearly" ? `Cobrado ${brl(price.total)} por ano.` : `Cobrado ${brl(price.total)} por mês.`}{period === "yearly" && saving ? ` Economia de ${brl(saving)} no ano.` : ""}</p>
          <p className={`text-sm leading-5 ${muted}`}><span className="md:hidden">No cartão ou no Pix. </span>{cheap ? "Menos de R$ 1 por dia." : ""}<span className="md:hidden"> Cancele quando quiser.</span></p>
        </div>
      </div>
      {!!view.changes.length && (
        <div className={`flex flex-col gap-3 rounded-xl p-4 ${d ? "bg-white/10" : "bg-bg"}`}>
          <h3 className={`font-label text-xs leading-4 ${muted}`}>O QUE MUDA PARA VOCÊ</h3>
          <dl className="grid gap-3 md:grid-cols-3">
            {view.changes.map(c => (
              <div key={c.label} className="flex items-center justify-between gap-3 md:flex-col md:items-start md:justify-start md:gap-1">
                <dt className="text-[15px] leading-5">{c.label}</dt>
                <dd className="flex shrink-0 items-center gap-2 text-right whitespace-nowrap">
                  {c.from != null && <><s className={`text-base ${muted}`}>{c.from}</s><span aria-hidden className={muted}>→</span><span className="sr-only">passa para</span></>}
                  <span className={c.same ? "text-base" : "text-[22px] leading-7 font-extrabold"}>{c.to}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {view.benefits.map(b => <li key={b} className="flex items-start gap-2.5 text-[15px] leading-[21px]"><Check /><span>{b}</span></li>)}
      </ul>
    </section>
  );
}

/**
 * Planos v2 (UX item 19b; web W28 2401:21133, celular W29 2400:21433). A recomendação, os motivos e o que muda vêm do
 * backend (GET /billing/recommendation); o preço, do /billing/catalog (web_enabled); a tabela, do /plans/config.
 * Sem plano acima à venda, não há destaque: só o plano atual e a assinatura. Na web, cartão (renova) ou Pix (1 mês).
 * Uma assinatura do Google Play só aparece como ativa, com o link para o Play. A compra segue o flag `plan_switch`.
 * Fora, como decidido: selo "Popular", prova social, teste grátis e anual sem desconto real.
 */
export default function PlansPage() {
  return <Suspense fallback={<Spinner />}><Plans /></Suspense>;
}

function Plans() {
  const me = useMe().data;
  const plans = usePlanConfigs();
  const catalog = useBillingCatalog();
  const billing = useAccountBilling();
  const cancel = useCancelSubscription();
  const flag = useFeatureFlag("plan_switch");
  const usage = useUsage();
  const recommendation = useRecommendation();
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [period, setPeriod] = useState<Period>("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const all: PlanLimits[] = plans.data ?? [];
  const currentKey = normalizePlan(billing.data?.effective_plan ?? me?.plan ?? "free");
  const mine = all.find(p => p.plan_key === currentKey);
  const enabled = flag.enabled || me?.is_dev_mode === true;
  const current = billing.data?.current ?? null;
  const byPlay = billing.data?.managed_by === "google_play";

  const rec = recommendation.status === "ok" ? recommendation.rec : null;
  const recPlan = rec?.plan_key ? all.find(p => p.plan_key === normalizePlan(rec.plan_key!)) : undefined;
  const view = rec && mine ? recommendationView(rec, usage.status === "ok" ? usage.usage : null, mine.label, recPlan?.label ?? null) : null;
  // Mensal e anual (pedido do usuário, 12 nov): o seletor só aparece quando o plano tem os dois no catálogo.
  const monthly = recPlan && !byPlay ? periodPrice(catalog.data, recPlan.plan_key, "monthly") : null;
  const yearly = recPlan && !byPlay ? periodPrice(catalog.data, recPlan.plan_key, "yearly") : null;
  const chosen: Period = period === "yearly" && yearly ? "yearly" : monthly ? "monthly" : yearly ? "yearly" : "monthly";
  const price = chosen === "yearly" ? yearly : monthly;
  const saving = recPlan ? yearlySaving(catalog.data, recPlan.plan_key) : null;
  const offer = view?.highlight && recPlan && price ? { plan: recPlan, price, highlight: view.highlight } : null;

  async function buy() {
    if (!offer) return;
    setError(""); setBusy(true);
    try {
      const res = await startCheckout({ kind: "subscription", plan_key: offer.plan.plan_key, period: chosen, method });
      if (!res.checkout_url) throw new Error("O Mercado Pago não devolveu o endereço do pagamento. Nada foi cobrado.");
      window.location.assign(res.checkout_url);
    } catch (e) {
      setError(checkoutErrorMessage(e) ?? getErrorMessage(e, "Não foi possível abrir o pagamento. Nada foi cobrado."));
      setBusy(false);
    }
  }

  const ready = !plans.isPending && !catalog.isPending && !billing.isPending && recommendation.status !== "loading" && usage.status !== "loading";
  const cta = offer && <Button label={busy ? "Abrindo o Mercado Pago…" : "Continuar no Mercado Pago"} loading={busy} onClick={() => void buy()} />;
  const fine = "Você conclui o pagamento no Mercado Pago. O plano é liberado quando o pagamento é confirmado.";

  return (
    <>
      <BackLink fallback={routes.account()} />
      <PageTitle>O plano certo para o seu cultivo</PageTitle>
      {flag.isPending ? <Spinner /> : !enabled ? <>
        <UnavailableNotice body="A troca de planos ainda não está disponível. Fale com o suporte se precisar alterar seu plano agora." />
        <ButtonLink secondary label="Falar com o suporte" href={routes.support()} />
      </> : !ready ? <Spinner /> : <>
        {(plans.isError || !mine) && <Notice title="Não foi possível carregar os planos" body="Tente novamente em instantes." />}
        {recommendation.status === "error" && <Notice white title="Não foi possível carregar a recomendação" body="Nenhum plano é sugerido até ela responder.">
          <button type="button" onClick={recommendation.retry} className="self-start text-sm font-semibold text-primary underline cursor-pointer">Tentar de novo</button>
        </Notice>}
        {byPlay && <Notice white title="Assinatura pelo Google Play" body="Seu plano foi contratado no app Android e é gerenciado por lá.">
          {billing.data?.play_manage_url && <a href={billing.data.play_manage_url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary underline">Gerenciar no Google Play</a>}
        </Notice>}
        {current && !byPlay && <Notice white title={`${PLAN_NAMES[current.plan_key] ?? current.plan_key} · ${current.kind === "recurring" ? "assinatura no cartão" : "pago com Pix"}`}
          body={current.auto_renew ? `Renova automaticamente${shortDayMonth(current.current_period_end) ? ` em ${shortDayMonth(current.current_period_end)}` : ""}.` : `Acesso até ${shortDayMonth(current.access_until ?? current.current_period_end) ?? "o fim do período pago"}, sem renovação.`}
          meta={billing.data?.upcoming ? `Depois: ${PLAN_NAMES[billing.data.upcoming.plan_key] ?? billing.data.upcoming.plan_key}, a partir de ${shortDayMonth(billing.data.upcoming.current_period_end) ?? "o fim do período atual"}.` : undefined} />}
        {current?.auto_renew && !byPlay && <Button secondary label="Cancelar a renovação" onClick={() => setConfirmCancel(true)} />}
        {catalog.data && !catalog.data.web_enabled && <Notice white title="Compra ainda não disponível" body="A assinatura pela web ainda não está no ar. Nada é cobrado por esta tela." />}
        {!offer && <FormError message={error} />}

        {view && mine && <UsageBlock view={view.usage} planLabel={mine.label} />}

        {offer && mine && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
            <div className="lg:col-start-1"><Highlight view={offer.highlight} plan={offer.plan} price={offer.price} period={chosen} saving={saving}
              toggle={monthly && yearly && (
                <div role="radiogroup" aria-label="Período" className={`flex self-start rounded-lg border p-[3px] md:self-end ${offer.highlight.dark ? "border-white/40" : "border-display"}`}>
                  {(["monthly", "yearly"] as const).map(p => (
                    <button key={p} type="button" role="radio" aria-checked={chosen === p} onClick={() => setPeriod(p)}
                      className={`font-label min-h-9 rounded-md px-3 text-sm uppercase cursor-pointer ${chosen === p ? (offer.highlight.dark ? "bg-white text-text-primary" : "bg-display text-surface") : ""}`}>
                      {p === "monthly" ? "Mensal" : `Anual${saving ? ` · −${brl(saving)}` : ""}`}
                    </button>
                  ))}
                </div>
              )} /></div>

            <section aria-label="Como você quer pagar" className="flex flex-col gap-3 rounded-2xl border border-stroke bg-surface p-4 md:p-5 lg:col-start-2 lg:row-start-1">
              <h2 className="font-label text-xs leading-4 text-text-secondary">COMO VOCÊ QUER PAGAR</h2>
              <div role="radiogroup" aria-label="Forma de pagamento" className="flex flex-col gap-2">
                {(["card", "pix"] as const).map(key => (
                  <button key={key} type="button" role="radio" aria-checked={method === key} onClick={() => setMethod(key)}
                    className={`flex items-start gap-3 rounded-xl bg-surface p-3 text-left cursor-pointer ${method === key ? "border-2 border-primary" : "border border-stroke"}`}>
                    <span aria-hidden className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${method === key ? "border-primary" : "border-text-muted"}`}>
                      {method === key && <span className="size-2.5 rounded-full bg-primary" />}
                    </span>
                    <span className="flex flex-col gap-0.5"><span className="text-base leading-6 font-semibold text-text-primary">{PAY(chosen)[key][0]}</span><span className="text-sm leading-5 text-text-muted">{PAY(chosen)[key][1]}</span></span>
                  </button>
                ))}
              </div>
              <div className="hidden flex-col gap-3 md:flex">
                <p className="flex items-center justify-between pt-1 text-base text-text"><span>{offer.plan.label}, {chosen === "yearly" ? "anual" : "mensal"}</span><span className="text-lg font-extrabold text-text-primary">{brl(offer.price.total)}<span className="text-sm font-normal text-text-muted"> /{PERIOD_WORD[chosen]}</span></span></p>
                <FormError message={error} />
                {cta}
                <p className="text-xs leading-[18px] text-text-muted">{fine} Cancele a renovação nesta tela, em Conta › Planos.</p>
              </div>
            </section>

            <div className="overflow-x-auto rounded-2xl border border-stroke bg-surface lg:col-start-1">
              <table className="w-full min-w-[300px] text-left">
                <caption className="sr-only">Comparar o {mine.label} e o {offer.plan.label}</caption>
                <thead><tr>
                  <th scope="col" className="p-4"><span className="sr-only">Recurso</span></th>
                  <th scope="col" className="px-3 py-4 text-center text-sm leading-5 font-bold text-text-primary">{mine.label.toUpperCase()}<span className="hidden md:inline"> · SEU PLANO</span></th>
                  <th scope="col" className="bg-source-highlight px-3 py-4 text-center text-sm leading-5 font-bold text-text-primary">{offer.plan.label.toUpperCase()}</th>
                </tr></thead>
                <tbody>
                  {([
                    ["Plantas ao mesmo tempo", limit(mine.max_plants), limit(offer.plan.max_plants)],
                    ["Conversas com o Bobby por mês", limit(mine.ai_queries_per_month), limit(offer.plan.ai_queries_per_month)],
                    ["Ambientes", limit(mine.max_grows), limit(offer.plan.max_grows)],
                    ["Diário, fotos, timer da luz e clima", "Sim", "Sim"],
                  ] as const).map(([label, a, b]) => (
                    <tr key={label}>
                      <th scope="row" className="px-4 py-3.5 text-[15px] leading-5 font-normal text-text">{label}</th>
                      <td className="px-3 py-3.5 text-center text-[15px] leading-5 text-text">{a}</td>
                      <td className="bg-source-highlight px-3 py-3.5 text-center text-[15px] leading-5 font-bold text-text-primary">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Faq className="lg:col-start-2 lg:row-start-2" />
          </div>
        )}

        {!offer && <Faq />}

        {/* Celular (W29): o botão fica fixo acima das abas, com o aviso do Mercado Pago. */}
        {offer && (
          <div className="sticky bottom-[calc(78px+env(safe-area-inset-bottom))] z-10 -mx-5 flex flex-col gap-2 border-t border-stroke bg-bg px-5 pt-3 pb-3 md:hidden">
            <FormError message={error} />
            {cta}
            <p className="text-center text-xs leading-[18px] text-text-muted">{fine}</p>
          </div>
        )}
      </>}
      <ConfirmDialog open={confirmCancel} title="Cancelar a renovação?" confirm="Cancelar renovação" destructive busy={cancel.isPending}
        message={`O plano continua ativo até ${shortDayMonth(current?.current_period_end) ?? "o fim do período pago"}. Depois, sua conta volta ao Free e seus dados ficam preservados.`}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => cancel.mutate(undefined, { onSuccess: () => setConfirmCancel(false), onError: e => { setConfirmCancel(false); setError(checkoutErrorMessage(e) ?? getErrorMessage(e, "Não foi possível cancelar agora.")); } })} />
    </>
  );
}

function Faq({ className = "" }: { className?: string }) {
  return (
    <section aria-label="Perguntas frequentes" className={`flex flex-col gap-4 rounded-2xl border border-stroke bg-surface p-4 md:p-5 ${className}`}>
      {FAQ.map(([q, a]) => (
        <div key={q} className="flex flex-col gap-1.5">
          <h2 className="text-base leading-6 font-semibold text-text-primary">{q}</h2>
          <p className="text-[15px] leading-[21px] text-text-muted">{a}</p>
        </div>
      ))}
    </section>
  );
}
