import type { Metadata } from "next";
import { PageSubtitle, PageTitle, UnavailableNotice } from "@/components/ui";

export const metadata: Metadata = { title: "Plantas" };

/** Fase seguinte do MVP web (analise-2026-10-16/WEBAPP.md §6). */
export default function Page() {
  return (
    <>
      <PageTitle>Plantas</PageTitle>
      <PageSubtitle>Suas plantas, o diário e o calendário com a linha do tempo.</PageSubtitle>
      <UnavailableNotice />
    </>
  );
}
