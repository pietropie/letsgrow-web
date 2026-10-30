"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EntryPage } from "@/components/entry-page";
import { Button, ButtonLink, FormError, PageSubtitle, PageTitle, PasswordField, TextField } from "@/components/ui";
import { authAction } from "@/lib/api";
import { getErrorMessage } from "@/shared/lib/errors";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) { setError("Informe seu e-mail e sua senha."); return; }
    setLoading(true); setError("");
    try {
      await authAction("login", { email: email.trim(), password });
      router.replace(next);
      router.refresh();
    } catch (err) {
      if ((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail === "email_not_verified") {
        router.push(`/confirmar-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setError(getErrorMessage(err, "Erro ao entrar. Verifique suas credenciais."));
      setLoading(false);
    }
  }

  return (
    <EntryPage back={false}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <PageTitle>Bem-vindo de volta</PageTitle>
        <PageSubtitle>Entre para acessar seus registros.</PageSubtitle>
        <TextField label="E-mail" placeholder="voce@exemplo.com" type="email" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" inputMode="email" />
        <PasswordField label="Senha" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} autoCapitalize="none" autoComplete="current-password" />
        <FormError message={error} />
        <Button type="submit" label={loading ? "Entrando…" : "Entrar"} loading={loading} />
        <ButtonLink secondary label="Esqueci minha senha" href="/esqueci-a-senha" />
        <ButtonLink secondary label="Criar uma conta" href="/criar-conta" />
      </form>
    </EntryPage>
  );
}
