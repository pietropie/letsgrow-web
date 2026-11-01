"use client";

import { BackLink, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { useCreditBalance } from "@/lib/bobby";
import { routes } from "@/lib/routes";

/** Figma 2160:8541 — O que consome créditos? A última linha diz se os créditos estão ativos (configuração do admin). */
export default function CreditHelpPage() {
  const balance = useCreditBalance().data;
  return (
    <>
      <BackLink fallback={routes.credits()} />
      <PageTitle>O que consome créditos?</PageTitle>
      <PageSubtitle>Conhecer o serviço não consome saldo.</PageSubtitle>
      <Notice title="Incluído" body="Cadastrar, registrar, consultar o diário e receber o resumo automático básico." />
      <Notice white title="Com créditos" body="Tarefas adicionais solicitadas por você. O escopo e o custo aparecem antes de começar." />
      <Notice white title="Sem cobrança duplicada" body="Reler respostas não custa créditos. Falhas técnicas sem entrega liberam o valor reservado." />
      <PageSubtitle>Esclarecimentos necessários fazem parte do escopo confirmado. Uma tarefa diferente mostra um novo custo.{balance && !balance.enabled ? " Os créditos ainda não estão ativos: seu plano usa o limite mensal de consultas." : ""}</PageSubtitle>
      <ButtonLink secondary label="Entendi" href={routes.credits()} />
    </>
  );
}
