/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { EntryPage } from "@/components/entry-page";
import { ButtonLink, PageSubtitle } from "@/components/ui";

export const metadata: Metadata = { title: "Conheça o Bobby" };

function Row({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-y border-stroke py-4 hover:bg-surface-high">
      <span className="flex flex-1 flex-col gap-1"><span className="text-base leading-6 font-semibold text-text">{title}</span><span className="text-sm leading-5 text-text-muted">{body}</span></span>
      <img src="/figma/chevron-right.svg" alt="" />
    </Link>
  );
}

/** Conheça o Bobby, antes da conta (mobile (auth)/bobby-intro.tsx). */
export default function BobbyIntroPage() {
  return (
    <EntryPage fallback="/conhecer">
      <div className="flex items-center gap-3"><img src="/figma/bobby-calm.png" alt="" width={40} height={53} /><h1 className="flex-1 text-[22px] leading-7 font-black text-text">Conheça o Bobby</h1></div>
      <PageSubtitle>Assistente de IA do LetsGrow</PageSubtitle>
      <section className="flex flex-col gap-4 rounded-2xl border-[0.5px] border-stroke bg-surface p-3">
        <div className="flex items-center gap-2"><img src="/figma/bobby-panel.svg" alt="" /><span className="font-label text-base text-display">CONHEÇA O BOBBY</span></div>
        <div className="flex flex-col gap-2">
          <h2 className="font-label text-xl leading-[26px] text-text">Uma conversa com contexto</h2>
          <p className="text-base leading-6 text-text">O Bobby pode organizar e resumir registros. Ele mostra a base usada e avisa quando não há informação suficiente.</p>
        </div>
        <div className="flex flex-col">
          <Row title="O que preciso cadastrar?" body="Você pode começar só com uma nota." href="/conhecer/diario" />
          <Row title="Dados e privacidade" body="Saiba o que é usado no acompanhamento." href="/seus-dados" />
        </div>
        <p className="text-sm leading-5 text-text-muted">Bobby pode errar. Ele não substitui avaliação médica, orientação jurídica ou atendimento de emergência.</p>
        <ButtonLink label="Criar conta e explorar" href="/criar-conta" />
      </section>
    </EntryPage>
  );
}
