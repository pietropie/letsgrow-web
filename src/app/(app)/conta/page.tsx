"use client";

import { Button, Notice, PageTitle, UnavailableNotice } from "@/components/ui";
import { useLogout, useMe } from "@/lib/session-client";
import { getErrorMessage } from "@/shared/lib/errors";

/** Conta (F6 do WEBAPP.md). Por enquanto: quem está conectado e sair. */
export default function AccountPage() {
  const me = useMe();
  const logout = useLogout();
  return (
    <>
      <PageTitle>Conta</PageTitle>
      {me.isPending && <p className="text-sm text-text-muted">Carregando…</p>}
      {me.isError && <Notice white title="Não foi possível carregar sua conta" body={getErrorMessage(me.error)} />}
      {me.data && <Notice white title={me.data.full_name || "Sua conta"} body={me.data.email} />}
      <UnavailableNotice body="Planos, créditos, notificações, privacidade e suporte ainda não chegaram à versão web. Enquanto isso, use o app no celular." />
      <Button secondary label="Sair" onClick={logout} />
    </>
  );
}
