"use client";

import { BackLink, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";

/** Figma 2160:5402 — Como funciona (mobile (app)/help.tsx). */
export default function HelpPage() {
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback="/" />
      <PageTitle>Como funciona</PageTitle>
      <PageSubtitle>Você escolhe o que compartilhar.</PageSubtitle>
      <Notice title="Registre quando fizer sentido" body="Uma observação simples já ajuda a organizar seu histórico. Não há obrigação de registrar todos os dias." />
      <Notice white title="Veja a base de cada resumo" body="Bobby indica os registros usados. Sem dados suficientes, ele explica a limitação." />
      <Notice white title="Você mantém o controle" body="Pode corrigir informações, ajustar o acompanhamento e revisar o contexto guardado." />
      <PageSubtitle>As respostas são geradas por IA e podem conter erros. O app não oferece diagnóstico, prescrição ou autorização legal.</PageSubtitle>
      <ButtonLink secondary label="Entendi" href="/" />
    </div>
  );
}
