import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./ui";

const LINKS = [
  { href: "/privacidade", label: "Política de privacidade" },
  { href: "/excluir-conta", label: "Excluir conta" },
  { href: "/termos", label: "Termos de uso" },
];

/**
 * Páginas públicas de texto longo (privacidade, exclusão de conta), exigidas pela Play Store.
 * Renderizadas no servidor, legíveis sem JavaScript. Não há frame no Figma: segue os tokens e a coluna do app.
 */
export function LegalPage({ title, subtitle, current, children }: { title: string; subtitle?: string; current: string; children: ReactNode }) {
  return (
    <div className="pt-safe flex min-h-dvh flex-col items-center">
      <header className="flex w-full max-w-[760px] items-center justify-between px-5 pt-4 pb-2">
        <Link href="/" aria-label="LetsGrow, página inicial"><Brand size={32} /></Link>
        <Link href="/entrar" className="rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-surface">Entrar</Link>
      </header>
      <main className="flex w-full max-w-[760px] flex-col gap-4 px-5 pt-4 pb-10 text-base leading-6 text-text">
        <h1 className="text-[28px] leading-9 font-bold">{title}</h1>
        {subtitle && <p className="text-sm leading-5 text-text-muted">{subtitle}</p>}
        {children}
      </main>
      <footer className="pb-safe w-full border-t border-border">
        <nav aria-label="Páginas legais" className="mx-auto flex max-w-[760px] flex-wrap gap-x-4 gap-y-2 px-5 py-5 text-sm leading-5">
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} aria-current={l.href === current ? "page" : undefined}
              className={l.href === current ? "font-semibold text-text" : "text-primary hover:underline"}>{l.label}</Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
