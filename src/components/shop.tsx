"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { CornerLink, Marker, PanelCard, PanelTitle } from "@/components/panel";
import { routes } from "@/lib/routes";
import { SHOP_NOTICE, SHOP_TITLE, contextItems, haveLabel, labelTone, phaseBlockTitle, shopShows, shortLabel, type ShopItem, type ShopProduct } from "@/lib/shop";
import { countShopClick, useShopHave, useShopRecommendations, useShopSettings } from "@/lib/shop-client";

/**
 * Equipamentos e insumos (Figma C2–C5 e W9p, seção 2432:24180; UX 26b–26d). Nenhuma ação é o botão verde; o link abre
 * a loja em nova aba (rel sponsored) e conta o toque. Sem preço, nota ou "mais vendido"; o Bobby fica de fora.
 */
const ACTION = "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface px-3 font-label text-[15px] text-text-primary uppercase shadow-[0_1px_3px_rgba(0,0,0,0.12)] hover:bg-surface-high disabled:opacity-50 cursor-pointer";

export function StoreLink({ product, className, children }: { product: ShopProduct; className?: string; children: ReactNode }) {
  return (
    <a href={product.url} target="_blank" rel="noopener sponsored" onClick={() => countShopClick(product.id)} className={className}
      aria-label={`Ver ${product.name} na loja ${product.store.name} (abre em nova aba)`}>{children}</a>
  );
}

function useHave(item: ShopItem) {
  const have = useShopHave();
  const [error, setError] = useState(false);
  const run = () => { setError(false); have.mutate({ trigger: item.trigger, targets: item.targets, productId: item.product.id }, { onError: () => setError(true) }); };
  return { run, busy: have.isPending, error };
}

/** C5: o cartão inteiro, com "Por que aparece", o rótulo e as duas ações. Sem `item`, só o produto (lista da categoria). */
export function ProductCard({ product, item }: { product: ShopProduct; item?: ShopItem }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-stroke bg-surface p-3" aria-label={product.name}>
      <div className="flex flex-col gap-1">
        <span className="font-label text-[13px] leading-4 text-display uppercase">{product.category.name}</span>
        <h3 className="text-[17px] leading-[22px] font-semibold text-text-primary">{product.name}</h3>
        {!!product.specs.length && <div className="flex flex-wrap gap-1.5">{product.specs.slice(0, 2).map(s => <Marker key={s}>{s}</Marker>)}</div>}
        <span className="text-xs leading-4 text-text-secondary">{product.store.name} · {product.store.domain}</span>
      </div>
      <div className="h-px bg-stroke" />
      {item ? <>
        <span className="font-label text-[13px] leading-4 text-display uppercase">Por que aparece</span>
        <p className="text-sm leading-5 text-text">{item.reason}</p>
      </> : product.reason && <p className="text-sm leading-5 text-text">{product.reason}</p>}
      <Marker tone={labelTone(product.label)}>{product.label_text}</Marker>
      <Actions product={product} item={item} />
    </article>
  );
}

function Actions({ product, item }: { product: ShopProduct; item?: ShopItem }) {
  const store = <StoreLink product={product} className={ACTION}>Ver na loja <span aria-hidden>↗</span></StoreLink>;
  return item ? <HaveActions item={item}>{store}</HaveActions> : <div className="flex gap-2">{store}</div>;
}

function HaveActions({ item, children }: { item: ShopItem; children: ReactNode }) {
  const have = useHave(item);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <button type="button" onClick={have.run} disabled={have.busy || !item.targets.length} className={ACTION}>{have.busy ? "Gravando…" : haveLabel(item.trigger)}<span aria-hidden>›</span></button>
        {children}
      </div>
      {have.error && <p role="alert" className="text-sm leading-5 text-state-error">Não foi possível gravar. Tente de novo.</p>}
    </div>
  );
}

/** A linha fixa (LOJA §2.3): a compra é da loja; podemos receber comissão sem mudar o preço. */
export function ShopNotice() {
  return <p className="text-xs leading-4 text-text-secondary">{SHOP_NOTICE}</p>;
}

/**
 * C2 e C3: bloco curto no painel do ambiente ("Falta no ambiente") ou na página da planta ("Para a floração"). Cada
 * linha abre a loja; o rótulo curto fica junto; "Já tenho"/"Já uso" grava e tira a indicação. Some sem indicação.
 */
export function ShopContextBlock({ title, intro, items, pageLink }: { title: string; intro?: string | null; items: ShopItem[]; pageLink: boolean }) {
  if (!items.length) return null;
  return (
    <PanelCard label={title}>
      <PanelTitle divider right={pageLink ? <CornerLink href={routes.shop()}>{SHOP_TITLE}</CornerLink> : undefined}>{title}</PanelTitle>
      {intro && <p className="text-sm leading-5 text-text">{intro}</p>}
      <ul className="-my-1 flex flex-col">
        {items.map(item => <ContextRow key={`${item.trigger}-${item.product.id}`} item={item} />)}
      </ul>
      <ShopNotice />
    </PanelCard>
  );
}

function ContextRow({ item }: { item: ShopItem }) {
  const have = useHave(item);
  return (
    <li className="flex flex-col gap-1.5 border-b border-stroke py-2 last:border-b-0">
      <StoreLink product={item.product} className="flex items-center gap-2 rounded-lg hover:bg-surface-high">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base leading-6 font-semibold text-text-primary">{item.product.name}</span>
          {/* Na planta o motivo já está no alto do bloco (C3); a linha mostra as especificações. */}
          {(item.trigger.startsWith("plant_phase_") ? item.product.specs.join(" · ") : item.reason) && <span className="text-sm leading-5 text-text-secondary">{item.trigger.startsWith("plant_phase_") ? item.product.specs.join(" · ") : item.reason}</span>}
        </span>
        <Marker tone={labelTone(item.product.label)}>{shortLabel(item.product)}</Marker>
        <span aria-hidden className="text-text-primary">↗</span>
      </StoreLink>
      <div className="flex">
        <button type="button" onClick={have.run} disabled={have.busy || !item.targets.length} className="min-h-9 rounded-full border border-input-border px-3 text-sm font-semibold text-text-primary hover:bg-bg disabled:opacity-50 cursor-pointer">
          {have.busy ? "Gravando…" : haveLabel(item.trigger)}
        </button>
      </div>
      {have.error && <p role="alert" className="text-sm leading-5 text-state-error">Não foi possível gravar. Tente de novo.</p>}
    </li>
  );
}

/** Entrada pela Conta ou por Equipamentos do ambiente: uma linha que abre a página. */
export function ShopEntryLink({ body }: { body: string }) {
  return (
    <Link href={routes.shop()} className="flex min-h-16 items-center gap-3 rounded-2xl border border-stroke bg-surface px-3.5 py-3 hover:bg-surface-high">
      <span className="flex flex-1 flex-col gap-0.5"><span className="text-base leading-6 font-semibold text-text-primary">{SHOP_TITLE}</span><span className="text-sm leading-5 text-text-secondary">{body}</span></span>
      <span aria-hidden className="text-text-primary">›</span>
    </Link>
  );
}

/** C2, no painel do ambiente, abaixo dos equipamentos: só com o bloco ligado e com alguma indicação. */
export function GrowShopBlock({ growId }: { growId: string }) {
  const settings = useShopSettings();
  const recs = useShopRecommendations({ growId }, shopShows(settings, "environment_block"));
  if (!shopShows(settings, "environment_block")) return null;
  return <ShopContextBlock title="Falta no ambiente" items={contextItems(recs.data ?? [])} pageLink={shopShows(settings, "page")} />;
}

/** C3, na página da planta, abaixo da fase: o título pela fase ("PARA A FLORAÇÃO") e o motivo neutro do servidor. */
export function PlantShopBlock({ plantId }: { plantId: string }) {
  const settings = useShopSettings();
  const recs = useShopRecommendations({ plantId }, shopShows(settings, "phase_block"));
  if (!shopShows(settings, "phase_block")) return null;
  const items = contextItems(recs.data ?? []);
  if (!items.length) return null;
  return <ShopContextBlock title={phaseBlockTitle(items[0].trigger)} intro={items[0].reason} items={items} pageLink={shopShows(settings, "page")} />;
}

/** Entrada pela Conta (account_entry) ou por Equipamentos do ambiente: só com a página ligada. */
export function ShopEntry({ point, body }: { point: "account_entry" | "page"; body: string }) {
  const settings = useShopSettings();
  if (!shopShows(settings, "page") || !shopShows(settings, point)) return null;
  return <ShopEntryLink body={body} />;
}
