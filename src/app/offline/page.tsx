import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

/** Guardada pelo service worker (public/sw.js): aparece quando uma tela não abre por falta de rede. */
export default function OfflinePage() {
  return (
    <EntryPage back={false}>
      <PageTitle>Sem conexão</PageTitle>
      <PageSubtitle>O LetsGrow precisa de internet para mostrar seus registros.</PageSubtitle>
      <Notice white title="Nada foi perdido" body="O que você já salvou continua na sua conta. Confira a conexão e tente de novo." />
      <RetryButton />
    </EntryPage>
  );
}
