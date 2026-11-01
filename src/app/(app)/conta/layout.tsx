"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { ActionRow, Button, ConfirmDialog, PageSubtitle, PageTitle } from "@/components/ui";
import { useNotificationPreferences } from "@/lib/account";
import { useGrows } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { useLogout, useMe } from "@/lib/session-client";
import { deviceTimezone } from "@/shared/lib/accountFeatures";

/**
 * Minha conta (Figma 2160:8793 e 2160:8881; desktop W19–W20). Celular: a lista é a página /conta e cada item abre a
 * sua. Tablet e desktop: a lista fica fixa à esquerda (360) e o item aberto ao lado (até 560), marcado na lista.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const root = usePathname() === "/conta";
  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,360px)_minmax(0,560px)] md:items-start md:gap-6">
      <div className={root ? "flex flex-col gap-4" : "hidden md:flex md:flex-col md:gap-4"}><AccountMenu /></div>
      {!root && <div className="flex min-w-0 flex-col gap-4">{children}</div>}
    </div>
  );
}

function AccountMenu() {
  const path = usePathname();
  const me = useMe().data;
  const grows = useGrows().data;
  const logout = useLogout();
  const [confirm, setConfirm] = useState(false);
  const prefs = useNotificationPreferences(deviceTimezone()).data;
  const name = me?.full_name?.trim().split(/\s+/)[0];
  const exploring = !!grows && !grows.some(g => g.status === "active");
  const notifications = !prefs ? "Frequência e prévia das notificações." : prefs.frequency === "in_app" ? "Notificações desativadas · só no app." : `Resumo diário · ${prefs.preview === "discreet" ? "prévias discretas" : "prévia completa"}.`;
  const at = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <>
      <PageTitle>Minha conta</PageTitle>
      {exploring ? <>
        <PageSubtitle>Você pode explorar sem cadastrar plantas.</PageSubtitle>
        <ActionRow title="Privacidade e dados" body="Informações sobre conta, fotos e conversas." href={routes.accountData()} active={at(routes.accountData())} />
        <ActionRow title="Entender os créditos" body="O que é incluído e o que pode ser cobrado." href={routes.creditHelp()} active={at(routes.creditHelp())} />
        <ActionRow title="Como o LetsGrow funciona" body="Conheça o acompanhamento." href={routes.help()} />
      </> : <>
        <PageSubtitle>{name ? `${name} · conta privada` : "Conta privada"}</PageSubtitle>
        <ActionRow title="Créditos e plano" body="Saldo, renovação e histórico de uso." href={routes.credits()} active={at(routes.credits()) || at(routes.plans())} />
        <ActionRow title="Privacidade e dados" body="Veja como suas informações são usadas." href={routes.accountData()} active={at(routes.accountData())} />
        <ActionRow title="Acompanhamento e notificações" body={notifications} href={routes.notifications()} active={at(routes.notifications())} />
        <ActionRow title="Contexto do Bobby" body="Revise ou esqueça preferências." href={routes.bobbyMemory()} />
        <ActionRow title="Ajuda e suporte" body="Entenda o serviço ou relate um problema." href={routes.support()} active={at(routes.support())} />
      </>}
      {/* Só na web: abrir como app, a partir da tela inicial do iPhone. */}
      <ActionRow title="Usar como app no iPhone" body="Adicione o LetsGrow à Tela de Início." href={routes.install()} />
      <Button secondary label="Sair da conta" onClick={() => setConfirm(true)} />
      <ConfirmDialog open={confirm} title="Sair da conta" message="Deseja encerrar a sessão?" confirm="Sair" destructive onConfirm={logout} onCancel={() => setConfirm(false)} />
    </>
  );
}
