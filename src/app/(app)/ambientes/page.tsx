import type { Metadata } from "next";
import { PageSubtitle, PageTitle, UnavailableNotice } from "@/components/ui";

export const metadata: Metadata = { title: "Ambientes" };

/** Fase seguinte do MVP web (analise-2026-10-16/WEBAPP.md §6). */
export default function Page() {
  return (
    <>
      <PageTitle>Ambientes</PageTitle>
      <PageSubtitle>Seus ambientes, o painel com timer de luz e exaustão, o histórico e os equipamentos.</PageSubtitle>
      <UnavailableNotice />
    </>
  );
}
