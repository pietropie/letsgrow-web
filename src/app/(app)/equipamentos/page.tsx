"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PanelLabel } from "@/components/panel";
import { ProductCard, ShopNotice } from "@/components/shop";
import { BackLink, Button, Notice, Spinner } from "@/components/ui";
import { useGrows } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { SHOP_TITLE, pageBlocks, shopShows } from "@/lib/shop";
import { useShopCategories, useShopProducts, useShopRecommendations, useShopSettings } from "@/lib/shop-client";

export default function ShopPage() {
  return <Suspense fallback={<Spinner />}><Shop /></Suspense>;
}

/**
 * W9p (Figma 2432:24582): "Como funciona" e as categorias à esquerda; as indicações em blocos ao lado, um por
 * ambiente ("PARA SALA") e um por fase de planta ("PARA A SUA PLANTA EM VEGA", título neutro da LOJA). Uma categoria
 * aberta (?categoria=) mostra os produtos dela no lugar das indicações. Com a página desligada no Admin, nada aparece.
 */
function Shop() {
  const params = useSearchParams();
  const category = params.get("categoria");
  const settings = useShopSettings();
  const show = shopShows(settings, "page");
  const categories = useShopCategories(show);
  const recs = useShopRecommendations(null, show && !category);
  const products = useShopProducts(category, show);
  const grows = useGrows().data;

  if (!settings) return <Spinner />;
  if (!show) {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <BackLink fallback={routes.grows()} />
        <Notice title={SHOP_TITLE} body="Esta área não está disponível agora." />
      </div>
    );
  }

  const current = categories.data?.find(c => c.key === category) ?? null;
  const blocks = pageBlocks(recs.data ?? [], id => grows?.find(g => g.id === id)?.name ?? null);

  return (
    <div className="flex flex-col gap-4">
      <BackLink fallback={routes.grows()} />
      <h1 className="font-label text-[26px] leading-8 text-text-primary">{current ? current.name : SHOP_TITLE}</h1>
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="flex flex-col gap-4">
          <section aria-label="Como funciona" className="flex flex-col gap-1.5 rounded-2xl border border-display bg-surface p-3">
            <PanelLabel>Como funciona</PanelLabel>
            <p className="text-sm leading-5 text-text">Indicamos equipamento e insumo pelo que falta no seu ambiente e pela fase das suas plantas.</p>
            <ShopNotice />
          </section>
          <PanelLabel>Categorias</PanelLabel>
          {categories.isError ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void categories.refetch()} />
            : !categories.data ? <Spinner />
            : (
              <ul className="grid grid-cols-2 gap-2.5">
                {categories.data.map(c => (
                  <li key={c.key}>
                    <Link href={routes.shopCategory(c.key)} aria-current={c.key === category ? "page" : undefined}
                      className={`font-label flex min-h-12 items-center justify-between gap-2 rounded-xl border border-display px-3 text-[14px] leading-4 text-display uppercase hover:bg-surface-high ${c.key === category ? "bg-surface-high" : "bg-surface"}`}>
                      {c.name}<span aria-hidden>›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          {category && <Link href={routes.shop()} className="text-sm font-semibold text-text-primary underline">Ver as indicações para você</Link>}
        </div>

        {category ? (
          <section aria-label={current?.name ?? "Categoria"} className="flex flex-col gap-3 lg:col-span-2">
            {products.isError ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void products.refetch()} />
              : !products.data ? <Spinner />
              : !products.data.length ? <Notice title="Nada nesta categoria por enquanto" body="Os produtos são escolhidos à mão; volte depois." />
              : <div className="grid gap-3 md:grid-cols-2">{products.data.map(p => <ProductCard key={p.id} product={p} />)}</div>}
          </section>
        ) : recs.isError ? (
          <div className="lg:col-span-2"><Button secondary label="Não foi possível carregar as indicações. Tentar novamente" onClick={() => void recs.refetch()} /></div>
        ) : !recs.data ? <Spinner />
          : !blocks.length ? (
            <div className="lg:col-span-2"><Notice title="Nenhuma indicação agora" body="Quando faltar algum equipamento no ambiente ou a planta mudar de fase, as indicações aparecem aqui. Você pode ver tudo pelas categorias." /></div>
          ) : (
            <div className="flex flex-col gap-5 lg:col-span-2 lg:grid lg:grid-cols-2 lg:items-start">
              {blocks.map(b => (
                <section key={b.key} aria-label={b.title} className="flex flex-col gap-3">
                  <PanelLabel>{b.title}</PanelLabel>
                  {b.items.map(item => <ProductCard key={`${item.trigger}-${item.product.id}`} product={item.product} item={item} />)}
                </section>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
