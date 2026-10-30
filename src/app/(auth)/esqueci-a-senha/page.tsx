"use client";

import { useState, type FormEvent } from "react";
import { EntryPage } from "@/components/entry-page";
import { Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/shared/lib/errors";

/** Mesmo fluxo do mobile (app/(auth)/forgot-password.tsx): a API responde 204 com ou sem conta. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const normalized = email.trim().toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!normalized) { setError("Informe seu e-mail."); return; }
    setLoading(true); setError("");
    try { await api("/auth/forgot-password", { method: "POST", body: { email: normalized } }); setSent(true); }
    catch (err) { setError(getErrorMessage(err, "Erro ao enviar. Tente novamente.")); }
    finally { setLoading(false); }
  }

  return (
    <EntryPage>
      <PageTitle>{sent ? "Confira seu e-mail" : "Recuperar acesso"}</PageTitle>
      <PageSubtitle>{sent ? "Solicitação enviada" : "Vamos enviar as instruções para seu e-mail."}</PageSubtitle>
      {sent ? (
        <>
          <Notice title="Próximo passo" body="Se houver uma conta com esse e-mail, você receberá as instruções. Confira também a pasta de spam." />
          <ButtonLink label="Inserir código recebido" href={`/nova-senha?email=${encodeURIComponent(normalized)}`} />
          <ButtonLink secondary replace label="Voltar para entrar" href="/entrar" />
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <TextField label="E-mail" placeholder="voce@exemplo.com" type="email" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" inputMode="email" />
          <FormError message={error} />
          <Button type="submit" label={loading ? "Enviando…" : "Enviar instruções"} loading={loading} />
          <ButtonLink secondary replace label="Voltar para entrar" href="/entrar" />
        </form>
      )}
    </EntryPage>
  );
}
