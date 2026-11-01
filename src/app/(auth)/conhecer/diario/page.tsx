import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Um diário simples" };

/** Exemplo do diário, sem conta (mobile (auth)/demo-diary.tsx). */
export default function DemoDiaryPage() {
  return (
    <EntryPage fallback="/conhecer">
      <PageTitle>Um diário simples</PageTitle>
      <PageSubtitle>Exemplo ilustrativo · nenhuma planta foi cadastrada.</PageSubtitle>
      <Notice title="15 out · 09:40" body="“Adicionei uma observação e uma foto.”" meta="Nota de demonstração." />
      <Notice white title="De onde vem uma observação?" body="O Bobby apresenta a base usada e reconhece quando faltam informações." meta="Você pode abrir e corrigir os registros." />
      <ButtonLink label="Continuar conhecendo" href="/conhecer/bobby" />
      <ButtonLink secondary label="Voltar à demonstração" href="/conhecer" />
    </EntryPage>
  );
}
