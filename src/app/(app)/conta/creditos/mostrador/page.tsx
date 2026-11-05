"use client";

import { notFound } from "next/navigation";
import { BackLink, PageSubtitle, PageTitle } from "@/components/ui";
import { UsageCompact, UsageError, UsageMeter } from "@/components/usage";
import { routes } from "@/lib/routes";
import { usageNotice } from "@/lib/usage";
import { USAGE_FIXTURES } from "@/lib/usage-fixtures";

/**
 * Galeria do mostrador de uso (UX item 16), só em desenvolvimento: os estados U1–U10 com a pílula C e o aviso do
 * Início, a partir dos exemplos do contrato provisório. Some do build de produção.
 */
export default function UsageGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <BackLink fallback={routes.credits()} />
      <PageTitle>Mostrador de uso</PageTitle>
      <PageSubtitle>Estados do Figma com dados de exemplo. Em qualquer tela, ?uso=U1…U10 usa o mesmo exemplo.</PageSubtitle>
      {Object.entries(USAGE_FIXTURES).map(([id, f]) => {
        const notice = usageNotice(f.usage);
        return (
          <section key={id} className="flex flex-col gap-2" aria-label={`${id} · ${f.name}`}>
            <h2 className="font-label text-sm text-text-secondary">{id} · {f.name.toUpperCase()}</h2>
            <UsageMeter usage={f.usage} packs />
            <UsageCompact usage={f.usage} />
            <p className="text-xs text-text-secondary">Início: {notice ? `${notice.title} · ${notice.meta}` : "sem aviso"}</p>
          </section>
        );
      })}
      <section className="flex flex-col gap-2" aria-label="U10 · Sem resposta da API">
        <h2 className="font-label text-sm text-text-secondary">U10 · SEM RESPOSTA DA API</h2>
        <UsageError onRetry={() => {}} />
      </section>
    </>
  );
}
