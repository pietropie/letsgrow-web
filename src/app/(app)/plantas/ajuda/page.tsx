import type { Metadata } from "next";
import { BackLink, ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Sobre os detalhes" };

/** Figma 2160:5876 — Sobre os detalhes. */
export default function TermHelpPage() {
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.newPlant()!} />
      <PageTitle>Sobre os detalhes</PageTitle>
      <PageSubtitle>Você não precisa responder tudo.</PageSubtitle>
      <Notice title="Variedade ou strain" body="É o nome pelo qual a variedade foi identificada. Se não tiver essa informação, escolha “Não sei”." />
      <Notice white title="Datas e características" body="Preencha apenas o que conhece. Dados não informados não serão tratados como fatos pelo Bobby." />
      <ButtonLink label="Voltar às plantas" href={routes.plants()} />
    </div>
  );
}
