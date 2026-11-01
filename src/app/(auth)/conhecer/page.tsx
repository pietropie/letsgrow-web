import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { ActionRow, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Conheça o LetsGrow" };

/** Demonstração com dados ilustrativos (mobile (auth)/demo.tsx). */
export default function DemoPage() {
  return (
    <EntryPage fallback="/boas-vindas">
      <PageTitle>Seu histórico ganha contexto</PageTitle>
      <PageSubtitle>Demonstração · dados ilustrativos</PageSubtitle>
      <Notice title="1. Registre o que importa" body="Uma nota ou foto já é um começo. Detalhes técnicos são opcionais." />
      <ActionRow title="2. Volte aos seus registros" body="Encontre notas, fotos e datas num só lugar." href="/conhecer/diario" />
      <Notice white title="3. Entenda a base do Bobby" body="Veja quais registros ele usou e o que ainda não é possível concluir." />
      <ButtonLink label="Quero conhecer o Bobby" href="/conhecer/bobby" />
      <ButtonLink secondary label="Criar minha conta" href="/criar-conta" />
    </EntryPage>
  );
}
