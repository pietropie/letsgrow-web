"use client";

import { useState, type FormEvent } from "react";
import { EntryPage } from "@/components/entry-page";
import { Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, PasswordField, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/shared/lib/errors";

/** Mesmo fluxo do mobile (app/(auth)/reset-password.tsx). */
export function ResetForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email) { setError("Volte à recuperação para informar seu e-mail."); return; }
    if (!/^\d{6}$/.test(code)) { setError("Insira o código completo de 6 dígitos."); return; }
    if (password.length < 8) { setError("Use uma senha com pelo menos 8 caracteres."); return; }
    if (password !== confirmation) { setError("As senhas não coincidem."); return; }
    setLoading(true); setError("");
    try { await api("/auth/reset-password", { method: "POST", body: { email, code, new_password: password } }); setDone(true); }
    catch (err) { setError(getErrorMessage(err, "Código inválido ou expirado.")); }
    finally { setLoading(false); }
  }

  return (
    <EntryPage fallback="/esqueci-a-senha">
      <PageTitle>{done ? "Senha redefinida" : "Nova senha"}</PageTitle>
      {done ? (
        <>
          <Notice title="Tudo pronto" body="Sua senha foi alterada. Você já pode entrar com a nova senha." />
          <ButtonLink replace label="Entrar agora" href="/entrar" />
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <PageSubtitle>{email ? `Digite o código enviado para ${email} e escolha sua nova senha.` : "Volte à recuperação para informar seu e-mail."}</PageSubtitle>
          <TextField label="Código de verificação" placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
          <PasswordField label="Nova senha" hint="Use pelo menos 8 caracteres." value={password} onChange={e => setPassword(e.target.value)} autoCapitalize="none" autoComplete="new-password" />
          <PasswordField label="Confirmar nova senha" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoCapitalize="none" autoComplete="new-password" />
          <FormError message={error} />
          <Button type="submit" label={loading ? "Salvando…" : "Redefinir senha"} loading={loading} />
        </form>
      )}
    </EntryPage>
  );
}
