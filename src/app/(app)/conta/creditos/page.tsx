"use client";

import { AccountBack, PLAN_NAMES } from "@/components/account";
import { ActionRow, Button, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { UsageError, UsageMeter } from "@/components/usage";
import { useBillingCatalog, useCreditPackages } from "@/lib/account";
import { useCreditBalance } from "@/lib/bobby";
import { usePlanStatus } from "@/lib/hooks";
import { useUsage } from "@/lib/usage-client";
import { routes } from "@/lib/routes";
import { shortDayMonth } from "@/shared/lib/dates";

/**
 * Figma 2160:8453 (Seus créditos; desktop W19), mobile account/credits.tsx. Com os créditos ligados (admin), o saldo real;
 * desligados, o plano funciona pelo limite mensal de consultas do Bobby e o contador real aparece no lugar.
 */
export default function CreditsPage() {
  const balance = useCreditBalance();
  const plan = usePlanStatus();
  const usage = useUsage();
  // "Comprar créditos" só aparece com pacote à venda na web.
  const catalog = useBillingCatalog(), packages = useCreditPackages();
  const packs = !!catalog.data?.web_enabled && !!packages.data?.length;

  function summary() {
    const b = balance.data!, p = plan.data!;
    const planName = PLAN_NAMES[p.effective_plan] ?? p.effective_plan;
    if (b.enabled) {
      const renew = shortDayMonth(b.renews_at);
      const parts = b.extra_available ? [b.plan_available ? `${b.plan_available} do plano` : null, `${b.extra_available} extras`].filter(Boolean) : b.plan_available ? ["Créditos incluídos no plano"] : [];
      return <Notice title={`${b.available} ${b.available === 1 ? "crédito disponível" : "créditos disponíveis"}`}
        body={renew ? `Renovação do saldo do plano: ${renew}.` : "Seu plano não inclui créditos mensais."}
        meta={parts.length ? parts.join(" · ") : `Plano ${planName}`} />;
    }
    const limit = p.ai_queries_per_month;
    // A cota renova no dia 1 do mês seguinte; é uma data de calendário, lida pela parte da data para o fuso não voltar um dia.
    const now = new Date();
    const reset = shortDayMonth(p.ai_queries_renews_at ? `${p.ai_queries_renews_at.slice(0, 10)}T12:00:00` : new Date(now.getFullYear(), now.getMonth() + 1, 1, 12).toISOString());
    return <Notice title={limit == null ? `${p.ai_queries_used} consultas do Bobby usadas` : `${p.ai_queries_used} de ${limit} consultas do Bobby usadas`}
      body={reset ? `Renovação do limite do plano: ${reset}.` : "Data de renovação não informada."}
      meta={`Plano ${planName} · créditos não estão ativos`} />;
  }

  return (
    <>
      <AccountBack />
      <PageTitle>Créditos e plano</PageTitle>
      <PageSubtitle>Uso do Bobby e saldo em um só lugar</PageSubtitle>
      {/* UX item 16 (W24): o mostrador completo no lugar do resumo, quando o GET /usage estiver ligado. */}
      {usage.status === "ok" ? <UsageMeter usage={usage.usage} packs={packs} />
        : usage.status === "error" ? <UsageError onRetry={usage.retry} />
        : usage.status === "loading" || balance.isPending || plan.isPending ? <Spinner />
        : !balance.data || !plan.data ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => { void balance.refetch(); void plan.refetch(); }} />
        : summary()}
      <ActionRow title="O que é incluído?" body="Registros, histórico e resumo automático básico." href={routes.creditHelp()} />
      <ActionRow title="Histórico de uso" body="Veja tarefas e eventuais estornos." href={routes.creditLog()} />
      <ActionRow title="Créditos extras" body="Saldo extra sem mudar seu plano." href={routes.packs()} />
      <ActionRow title="Planos" body={plan.data ? `Seu plano atual: ${PLAN_NAMES[plan.data.effective_plan] ?? plan.data.effective_plan}` : "Limites e assinatura."} href={routes.plans()} />
      <PageSubtitle>Você verá o custo antes de cada tarefa paga. Bobby não gasta seu saldo por iniciativa própria.</PageSubtitle>
    </>
  );
}
