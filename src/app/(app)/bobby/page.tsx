import type { Metadata } from "next";
import { PageSubtitle, PageTitle, UnavailableNotice } from "@/components/ui";

export const metadata: Metadata = { title: "Bobby" };

/** Fase seguinte do MVP web (analise-2026-10-16/WEBAPP.md §6). */
export default function Page() {
  return (
    <>
      <PageTitle>Bobby</PageTitle>
      <PageSubtitle>A conversa com o Bobby, com as fontes de cada resposta.</PageSubtitle>
      <UnavailableNotice />
    </>
  );
}
