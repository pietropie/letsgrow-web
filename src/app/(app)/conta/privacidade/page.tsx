"use client";

import { AccountBack } from "@/components/account";
import { ActionRow, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { routes } from "@/lib/routes";

/** Figma 2160:9011 — Privacidade e dados (mobile account/data.tsx). */
export default function PrivacyDataPage() {
  return (
    <>
      <AccountBack />
      <PageTitle>Privacidade e dados</PageTitle>
      <PageSubtitle>Conta, conteúdo e processamento</PageSubtitle>
      <Notice title="Você escolhe o contexto" body="O serviço usa os dados necessários à função solicitada. Acesso operacional autorizado e fornecedores não equivalem a publicação para outros usuários." />
      <ActionRow title="Contexto guardado pelo Bobby" body="Histórico de conversa e memória são separados." href={routes.bobbyMemory()} />
      <ActionRow title="Solicitar cópia dos meus dados" body="Receba instruções pelo e-mail da conta." href={routes.dataExport()} />
      <ActionRow title="Excluir minha conta" body="Veja o que acontece antes de confirmar." href={routes.deleteAccount()} />
      <ActionRow title="Dúvidas sobre dados" body="Fale com o suporte sobre acesso, retenção e exclusão." href={routes.support()} />
      <ActionRow title="Antes de compartilhar" body="Quem pode ver fotos, conversas e registros." href={routes.beforeSharing()} />
      <ActionRow title="Política de privacidade" body="O texto completo, no site do LetsGrow." href="/privacidade" />
      <ActionRow title="Condições de uso" body="Conheça o papel do serviço e seus limites." href="/termos" />
    </>
  );
}
