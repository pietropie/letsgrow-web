"use client";

import { useSyncExternalStore } from "react";
import { PageSubtitle, PageTitle, UnavailableNotice } from "@/components/ui";
import { useMe } from "@/lib/session-client";
import { greetingDate } from "@/shared/lib/homeClimate";

const noSubscribe = () => () => {};

/** Início 2026 (Figma 2366:15991, desktop W1 2371:16940) chega na F1; o esqueleto só confirma a sessão. */
export default function HomePage() {
  const me = useMe();
  const name = me.data?.full_name?.trim();
  // A página é estática: a data sai do relógio do aparelho, nunca do HTML gerado no build.
  const today = useSyncExternalStore(noSubscribe, () => greetingDate(), () => "");
  return (
    <>
      <PageTitle>{name ? `Olá, ${name}` : "Olá"}</PageTitle>
      <PageSubtitle>{today}</PageSubtitle>
      <UnavailableNotice body="O Início com o clima, os alertas e suas plantas está sendo montado para a web." />
    </>
  );
}
