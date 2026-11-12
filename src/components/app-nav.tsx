"use client";

import Link from "next/link";
import { BobbyIcon } from "@/components/bobby-icon";
import { usePathname } from "next/navigation";
import { Brand } from "./ui";

/** As 5 áreas da barra de abas do mobile (components/ui/BottomBar.tsx), com os ícones do Figma. */
const AREAS = [
  { href: "/", label: "Início", icon: "tab-home", match: (p: string) => p === "/" },
  { href: "/ambientes", label: "Ambientes", icon: "tab-grow", match: (p: string) => p.startsWith("/ambientes") },
  { href: "/plantas", label: "Plantas", icon: "tab-plant", match: (p: string) => p.startsWith("/plantas") || p.startsWith("/diario") },
  { href: "/bobby", label: "Bobby", icon: "tab-bobby", match: (p: string) => p.startsWith("/bobby") },
  { href: "/conta", label: "Conta", icon: "account", match: (p: string) => p.startsWith("/conta") },
] as const;

/* eslint-disable @next/next/no-img-element */
function AreaIcon({ icon, active }: { icon: string; active: boolean }) {
  const suffix = active ? "-active" : "";
  if (icon === "tab-bobby") return <BobbyIcon filled={active} size={24} className="text-display" />;
  if (icon === "account") {
    return (
      <span className="flex h-[22px] w-[22px] flex-col items-center justify-between">
        <img src={`/figma/user-head${suffix}.svg`} alt="" />
        <img src={`/figma/user-body${suffix}.svg`} alt="" />
      </span>
    );
  }
  return <img src={`/figma/${icon}${suffix}.svg`} alt="" width={24} height={24} />;
}
/* eslint-enable @next/next/no-img-element */

/** Celular (< 768 px): barra de abas do Figma, embaixo. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Áreas" className="pb-safe fixed inset-x-0 bottom-0 z-20 flex rounded-t-2xl border-[0.5px] border-border bg-bg px-2 pt-[10px] md:hidden">
      {AREAS.map(a => {
        const active = a.match(pathname);
        return (
          <Link key={a.href} href={a.href} aria-current={active ? "page" : undefined} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1">
            <span className="flex h-7 w-7 items-center justify-center"><AreaIcon icon={a.icon} active={active} /></span>
            <span className={`font-label px-1.5 py-px text-sm leading-[18px] text-text ${active ? "bg-source-highlight" : ""}`}>{a.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Figma W1–W3 (seção "Web • desktop e tablet", 2371:16939). Desktop (≥ 1024): lateral de 240 com marca,
 * nomes e o usuário embaixo. Tablet (768–1023): 72, só ícones.
 */
export function SideNav({ userName, onLogout }: { userName: string | null; onLogout: () => void }) {
  const pathname = usePathname();
  const initial = userName?.trim().charAt(0).toUpperCase() || "·";
  return (
    <nav aria-label="Áreas" className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1 bg-surface px-3 py-6 md:flex md:w-[72px] lg:w-[240px] lg:px-4">
      <Link href="/" aria-label="LetsGrow, Início" className="mb-8 hidden px-2 lg:block"><Brand size={32} /></Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <Link href="/" aria-label="LetsGrow, Início" className="mb-8 flex justify-center lg:hidden"><img src="/figma/brand-leaf.svg" alt="" width={21} height={24} /></Link>
      {AREAS.map(a => {
        const active = a.match(pathname);
        return (
          <Link key={a.href} href={a.href} aria-current={active ? "page" : undefined} title={a.label}
            className={`flex h-11 items-center justify-center gap-3 rounded-[10px] px-3 text-[15px] leading-5 text-text lg:justify-start ${active ? "bg-source-highlight font-semibold" : "hover:bg-bg"}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center"><AreaIcon icon={a.icon} active={active} /></span>
            <span className="hidden lg:inline">{a.label}</span>
          </Link>
        );
      })}
      <div className="mt-auto flex flex-col items-center gap-3 lg:flex-row">
        <span aria-hidden className="font-label flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-bobby text-base text-text">{initial}</span>
        <span className="hidden min-w-0 flex-1 flex-col lg:flex">
          <span className="truncate text-sm leading-5 font-semibold text-text" title={userName ?? undefined}>{userName ?? ""}</span>
          <span className="text-xs leading-4 text-text-muted">Conta</span>
        </span>
        <button type="button" onClick={onLogout} className="min-h-9 rounded-lg border border-input-border px-3 text-sm font-semibold text-text hover:bg-bg cursor-pointer max-lg:px-2 max-lg:text-xs">Sair</button>
      </div>
    </nav>
  );
}
