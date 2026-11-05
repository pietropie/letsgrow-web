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
      {/* O Open-Meteo gratuito pede atribuição (CC BY 4.0); o nome saiu do card do clima a pedido do usuário (2026-11-05). */}
      <Notice white title="Fontes de dados">
        <p className="text-base leading-6 text-text">Dados meteorológicos: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Open-Meteo.com</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY 4.0</a>).</p>
      </Notice>
      <ActionRow title="Dúvidas sobre estas condições" body="Entenda como seus dados são tratados." href="/privacidade" />
      <ButtonLink secondary label="Voltar para criar conta" href="/criar-conta" />
    </EntryPage>
  );
}
