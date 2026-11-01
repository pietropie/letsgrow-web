/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { ActionRow, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Boas-vindas" };

/** Figma 2160:4851 — Comece do seu jeito (mobile (auth)/welcome.tsx). A raiz sem sessão abre aqui. */
export default function WelcomePage() {
  return (
    <EntryPage back={false}>
      <PageTitle>Comece do seu jeito.</PageTitle>
      <PageSubtitle>Conheça, registre e acompanhe com o Bobby.</PageSubtitle>
      <div className="flex justify-center rounded-[20px] bg-surface-bobby p-5"><img src="/figma/bobby-welcome.svg" alt="" /></div>
      <Notice title="Você não precisa saber tudo" body="Veja como o LetsGrow organiza informações e ajuda a entender seu histórico." meta="Sem planta? Você também pode explorar." />
      <ButtonLink label="Conhecer o aplicativo" href="/conhecer" />
      <ButtonLink secondary label="Criar minha conta" href="/criar-conta" />
      <ButtonLink secondary label="Já tenho conta" href="/entrar" />
      <ActionRow title="Dados e privacidade" body="Entenda antes de compartilhar." href="/seus-dados" />
    </EntryPage>
  );
}
