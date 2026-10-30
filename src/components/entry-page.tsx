import Link from "next/link";
import type { ReactNode } from "react";
import { Brand, BackLink } from "./ui";

/**
 * Telas sem sessão. Celular: a coluna do app (Figma "App • navegação e telas", linha de auth).
 * Tablet e desktop: Figma W6–W8 (2371:18185) — marca acima de um cartão de 440 centralizado e "Termos · Privacidade" embaixo.
 */
export function EntryPage({ children, back = true, fallback = "/entrar" }: { children: ReactNode; back?: boolean; fallback?: string }) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col items-center md:justify-center md:py-10">
      <header className="flex h-[47px] items-start justify-center pt-2 md:hidden"><Brand /></header>
      <div className="mb-4 hidden md:block"><Brand size={40} /></div>
      <main className="flex w-full max-w-[600px] flex-col gap-4 p-5 pb-safe md:max-w-[440px] md:rounded-[20px] md:border-[0.5px] md:border-border md:bg-surface md:pb-5 md:shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
        {back && <BackLink fallback={fallback} />}
        {children}
      </main>
      <p className="mt-5 hidden text-xs leading-4 text-text-muted md:block">
        <Link href="/termos" className="hover:underline">Termos</Link> · <Link href="/privacidade" className="hover:underline">Privacidade</Link>
      </p>
    </div>
  );
}
