import type { Metadata } from "next";
import { EntryPage } from "@/components/entry-page";
import { ActionRow, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Você controla seus dados" };

/** Figma 2170:6372 — Você controla seus dados (mobile LegalScreens PublicDataScreen), antes de criar a conta. */
export default function PublicDataPage() {
  return (
    <EntryPage fallback="/boas-vindas">
      <PageTitle>Você controla seus dados</PageTitle>
      <PageSubtitle>Conheça os controles antes de criar sua conta.</PageSubtitle>
      <Notice title="Conta sem perfil público" body="Seus registros não são publicados para outros usuários." />
      <Notice white title="Memória separada da conversa" body="O que o Bobby guarda sobre você fica fora das conversas. Depois de entrar, você revisa, corrige ou apaga em Conta › Privacidade e dados." />
      <Notice white title="Exportar e excluir" body="Depois de entrar, em Conta › Privacidade e dados, você pede uma cópia dos seus dados ou a exclusão da conta." />
      <ActionRow title="Política de privacidade" body="O texto completo, no site do LetsGrow." href="/privacidade" />
      <ButtonLink secondary label="Voltar" href="/boas-vindas" />
    </EntryPage>
  );
}
