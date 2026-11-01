"use client";

import { usePathname } from "next/navigation";
import { BottomTabs, SideNav } from "@/components/app-nav";
import { Brand } from "@/components/ui";
import { useLogout, useMe } from "@/lib/session-client";

/**
 * Moldura das telas com sessão. Celular: cabeçalho com a marca e abas embaixo, como no Figma mobile.
 * Tablet e desktop (Figma W1–W3): lateral e conteúdo de até 1120, padding 28/32 (tablet 24), gap 20.
 * Cada tela decide a própria largura interna: as que ainda seguem o mobile usam a coluna de 600.
 * A conversa do Bobby (W9) ocupa a altura toda, sem a coluna nem o padding.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const logout = useLogout();
  const user = me.data;
  const fullBleed = usePathname() === "/bobby";
  return (
    <div className="flex min-h-dvh">
      <SideNav userName={user ? (user.full_name || user.email) : null} onLogout={logout} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe flex h-[47px] items-start justify-center pt-2 md:hidden"><Brand /></header>
        {fullBleed
          ? <main className="flex min-w-0 flex-1 flex-col">{children}</main>
          : <main className="mx-auto flex w-full max-w-[600px] flex-col gap-4 p-5 pb-32 md:max-w-[1120px] md:gap-5 md:p-6 md:pb-10 lg:px-8 lg:py-7">{children}</main>}
      </div>
      <BottomTabs />
    </div>
  );
}
