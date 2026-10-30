"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EntryPage } from "@/components/entry-page";
import { Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, TextField } from "@/components/ui";
import { api, authAction } from "@/lib/api";
import { getErrorMessage } from "@/shared/lib/errors";

/** Mesmo fluxo do mobile (app/(auth)/verify-email.tsx). O e-mail vem do cadastro ou do login. */
export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (loading || resending) return;
    if (!email) { setError("Volte ao cadastro para informar seu e-mail."); return; }
    if (!/^\d{6}$/.test(code)) { setError("Insira o código completo de 6 dígitos."); return; }
    setLoading(true); setError("");
    try {
      await authAction("verify-email", { email, code });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Código inválido ou expirado."));
      setLoading(false);
    }
  }

  async function resend() {
    if (loading || resending || !email) return;
    setResending(true); setResent(false); setError("");
    try { await api("/auth/resend-verification", { method: "POST", body: { email } }); setResent(true); setCode(""); }
    catch (err) { setError(getErrorMessage(err, "Não foi possível reenviar. Tente novamente.")); }
    finally { setResending(false); }
  }

  return (
    <EntryPage>
      <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
        <PageTitle>Confirme seu e-mail</PageTitle>
        <PageSubtitle>{email ? `Digite o código enviado para ${email}.` : "Volte ao cadastro para informar seu e-mail."}</PageSubtitle>
        <TextField label="Código de verificação" placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
        {resent && <Notice title="Código reenviado" body="Confira seu e-mail e a pasta de spam." />}
        <FormError message={error} />
        <Button type="submit" label={loading ? "Verificando…" : "Confirmar e-mail"} loading={loading} disabled={resending} />
        <Button secondary label={resending ? "Reenviando…" : "Reenviar código"} loading={resending} disabled={loading || !email} onClick={resend} />
        <ButtonLink secondary replace label="Voltar para entrar" href="/entrar" />
      </form>
    </EntryPage>
  );
}
