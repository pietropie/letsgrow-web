import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { ActionRow, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Termos de uso" };

/** Figma 2160:9053 — Sobre o uso do serviço (textos de letsgrow-mobile/components/account/LegalScreens.tsx). */
export default function TermsPage() {
  return (
    <EntryPage fallback="/criar-conta">
      <PageTitle>Sobre o uso do serviço</PageTitle>
      <PageSubtitle>Conheça os limites antes de continuar.</PageSubtitle>
      <Notice title="Seu conteúdo" body="Registre apenas informações que você pode compartilhar. Você controla os dados associados à sua conta." />
      <Notice white title="Bobby é uma IA" body="As respostas podem conter erros. O app não substitui avaliação médica, orientação jurídica ou atendimento de emergência." />
      <Notice white title="Cobrança transparente" body="O modelo de créditos está em desenvolvimento. Esta versão ainda utiliza os limites do plano da conta." />
      <ActionRow title="Dúvidas sobre estas condições" body="Entenda como seus dados são tratados." href="/privacidade" />
      <ButtonLink secondary label="Voltar para criar conta" href="/criar-conta" />
    </EntryPage>
  );
}
