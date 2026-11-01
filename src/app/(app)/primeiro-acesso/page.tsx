"use client";

import { ActionRow, ButtonLink, PageSubtitle, PageTitle } from "@/components/ui";
import { routes } from "@/lib/routes";

/** Figma 2160:5145 — O que você quer fazer agora? Aparece uma vez, logo depois de confirmar o e-mail (mobile (app)/entry.tsx). */
export default function EntryChoicePage() {
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <PageTitle>O que você quer fazer agora?</PageTitle>
      <PageSubtitle>Você pode mudar de ideia depois.</PageSubtitle>
      <ActionRow title="Quero conhecer o LetsGrow" body="Entenda o acompanhamento sem cadastrar uma planta." href={routes.help()} />
      <ActionRow title="Quero organizar minhas informações" body="Comece por um ambiente simples." href={routes.newGrow()!} />
      <ActionRow title="Já tenho plantas" body="Vá direto ao cadastro. Detalhes ficam para depois." href={routes.newPlant()!} />
      <ButtonLink secondary replace label="Decidir depois" href="/" />
    </div>
  );
}
