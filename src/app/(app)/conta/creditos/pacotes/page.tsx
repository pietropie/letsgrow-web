"use client";

import { useState } from "react";
import { BackLink, Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { checkoutErrorMessage, startCheckout, useBillingCatalog, useCreditPackages } from "@/lib/account";
import { useCreditBalance } from "@/lib/bobby";
import { routes } from "@/lib/routes";
import { formatBRL, validityText } from "@/shared/lib/accountFeatures";
import { getErrorMessage } from "@/shared/lib/errors";

/**
 * Figma 2160:8709 (Créditos extras; desktop W20). Na web a compra é pelo Mercado Pago (contrato do WEBAPP.md §4):
 * POST /billing/checkout leva a aba ao checkout, e a volta cai em /conta/creditos/retorno. Sem o provedor no ar
 * (`web_enabled` falso no catálogo), a tela diz que a compra não está disponível, sem botão que finge comprar.
 */
export default function PacksPage() {
  const balance = useCreditBalance();
  const catalog = useBillingCatalog();
  const packages = useCreditPackages();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = packages.data ?? [];
  const pkg = list.find(p => p.id === selected) ?? list[0];

  async function buy() {
    if (!pkg) return;
    setError(""); setBusy(true);
    try {
      const res = await startCheckout({ kind: "credits", package_id: pkg.id });
      if (!res.checkout_url) throw new Error("O Mercado Pago não devolveu o endereço do pagamento. Nada foi cobrado.");
      window.location.assign(res.checkout_url);
    } catch (e) {
      setError(checkoutErrorMessage(e) ?? getErrorMessage(e, "Não foi possível abrir o pagamento. Nada foi cobrado."));
      setBusy(false);
    }
  }

  function body() {
    if (balance.isPending || catalog.isPending || packages.isPending) return <Spinner />;
    if (!packages.data || !catalog.data) return <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => { void packages.refetch(); void catalog.refetch(); }} />;
    if (!balance.data?.enabled) return <Notice white title="Créditos não estão ativos" body="Seu plano funciona pelo limite mensal de consultas. Nenhuma compra avulsa é oferecida agora." />;
    if (!catalog.data.web_enabled) return <Notice white title="Compra ainda não disponível" body="A compra de créditos pela web ainda não está no ar. Nada é cobrado por esta tela." />;
    if (!pkg) return <Notice white title="Nenhum pacote disponível" body="Não há pacotes à venda no momento. Nada é cobrado por esta tela." />;
    return <>
      <div role="radiogroup" aria-label="Pacotes de créditos" className="flex flex-col gap-3">
        {list.map(p => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === pkg.id} onClick={() => setSelected(p.id)}
            className={`flex flex-col gap-2 rounded-xl border p-4 text-left cursor-pointer ${p.id === pkg.id ? "border-primary bg-surface-bobby" : "border-border bg-white hover:bg-surface-high"}`}>
            <span className="text-lg leading-6 font-semibold text-text">{p.credits} créditos</span>
            <span className="text-base leading-6 text-text">{formatBRL(p.price_brl)} · pagamento único</span>
            <span className="text-sm leading-5 text-text-muted">{validityText(p.validity_days)}</span>
          </button>
        ))}
      </div>
      <p className="text-base leading-6 text-text">Seu plano atual permanece igual. O resumo básico continua incluído.</p>
      <FormError message={error} />
      <Button label={busy ? "Abrindo o Mercado Pago…" : "Continuar com este pacote"} loading={busy} onClick={() => void buy()} />
    </>;
  }

  return (
    <>
      <BackLink fallback={routes.credits()} />
      <PageTitle>Créditos extras</PageTitle>
      <PageSubtitle>Compra avulsa · sem recarga automática</PageSubtitle>
      {body()}
      <ButtonLink secondary label="Ver planos disponíveis" href={routes.plans()} />
      <ButtonLink secondary label="Voltar sem comprar" href={routes.credits()} />
    </>
  );
}
