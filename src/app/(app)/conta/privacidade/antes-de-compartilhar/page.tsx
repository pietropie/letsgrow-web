"use client";

import { ActionRow, BackLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { routes } from "@/lib/routes";

/** Figma 2160:8969 — Antes de compartilhar (mobile account/privacy.tsx). Aberta pelo Início e pelo novo registro com foto. */
export default function BeforeSharingPage() {
  return (
    <>
      <BackLink fallback={routes.accountData()} />
      <PageTitle>Antes de compartilhar</PageTitle>
      <PageSubtitle>Informações claras, no seu controle.</PageSubtitle>
      <Notice title="Sem perfil público" body="Nesta versão, suas plantas, fotos e conversas não ficam visíveis a outros usuários." />
      <Notice white title="Processamento pelo serviço" body="Para responder, Bobby usa a mensagem e os registros selecionados. Isso envolve o serviço de IA." />
      <ActionRow title="Seus controles" body="Revisar memória, exportar ou excluir informações." href={routes.accountData()} />
      <ActionRow title="Condições de uso" body="Conheça o papel do serviço e seus limites." href="/termos" />
    </>
  );
}
