"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { ActionRow, Button, ConfirmDialog, PageTitle } from "@/components/ui";
import { AccountPlanCard, AccountProfile, RowGroup, useAccountPlan } from "@/components/plan-card";
import { useNotificationPreferences } from "@/lib/account";
import { useGrows } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { useLogout, useMe } from "@/lib/session-client";
import { deviceTimezone } from "@/shared/lib/accountFeatures";

/**
 * Minha conta v2 (UX item 21; Figma A1–A4, desktop W31; antes 2160:8793, 2160:8881, W19–W20 e o card do item 19). Celular: a lista é a página
 * /conta e cada item abre a sua. Tablet e desktop: a lista fica fixa à esquerda (360) e o item aberto ao lado (até 560),
 * marcado na lista. Planos (W26/W27) ocupa a largura toda, com a coluna do pagamento, e a lista sai da frente.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const root = path === "/conta";
  if (path === routes.plans()) return <div className="flex min-w-0 flex-col gap-4">{children}</div>;
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
  const exploring = !!grows && !grows.some(g => g.status === "active");
  const notifications = !prefs ? "Frequência e prévia das notificações." : prefs.frequency === "in_app" ? "Notificações desativadas · só no app." : `Resumo diário · ${prefs.preview === "discreet" ? "prévias discretas" : "prévia completa"}.`;
  const at = (href: string) => path === href || path.startsWith(`${href}/`);
  const plan = useAccountPlan(exploring);
  const planActive = at(routes.credits()) || at(routes.plans());
  return (
    <>
      <PageTitle>Minha conta</PageTitle>
      <AccountProfile name={me?.full_name?.trim() || null} email={me?.email ?? null} exploring={exploring} plan={plan ? { name: plan.planName, free: plan.free } : null} />
      {/* "Créditos e plano" fica acessível em qualquer modo (82bdf5e): a linha simples enquanto o cartão carrega ou se falhar. */}
      {plan
        ? <AccountPlanCard planName={plan.planName} view={plan.view} active={planActive} playUrl={plan.playUrl} />
        : <ActionRow title="Créditos e plano" body="Saldo, renovação e histórico de uso." href={routes.credits()} active={planActive} />}
      <RowGroup title="Configurações" rows={exploring
        ? [{ title: "Privacidade e dados", body: "Informações sobre conta, fotos e conversas.", href: routes.accountData(), active: at(routes.accountData()) }]
        : [
          { title: "Acompanhamento e notificações", body: notifications, href: routes.notifications(), active: at(routes.notifications()) },
          { title: "Contexto do Bobby", body: "Revise ou esqueça preferências.", href: routes.bobbyMemory() },
          { title: "Privacidade e dados", body: "Veja como suas informações são usadas.", href: routes.accountData(), active: at(routes.accountData()) },
        ]} />
      <RowGroup title="Ajuda" rows={[
        { title: "Ajuda e suporte", body: "Entenda o serviço ou relate um problema.", href: routes.support(), active: at(routes.support()) },
        { title: "Entender os créditos", body: "O que é incluído e o que pode ser cobrado.", href: routes.creditHelp(), active: at(routes.creditHelp()) },
        { title: "Como o LetsGrow funciona", body: "Conheça o acompanhamento.", href: routes.help() },
      ]} />
      {/* Só na web: abrir como app, a partir da tela inicial do iPhone. */}
      <RowGroup title="Neste aparelho" rows={[{ title: "Usar como app no iPhone", body: "Adicione o LetsGrow à Tela de Início.", href: routes.install() }]} />
      <Button secondary label="Sair da conta" onClick={() => setConfirm(true)} />
      <ConfirmDialog open={confirm} title="Sair da conta" message="Deseja encerrar a sessão?" confirm="Sair" destructive onConfirm={logout} onCancel={() => setConfirm(false)} />
    </>
  );
}
