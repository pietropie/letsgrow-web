"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EntryButton, EntryField, EntryShell, EntryTitle, ErrorBox, SmallLink } from "@/components/entry";
import { authAction } from "@/lib/api";
import { localError, loginError, type EntryError } from "@/lib/entry";

/** UX item 25: L2/L2e no celular, W7p no web (Figma 2431:24071, 2431:24116, 2431:24386). Sem login social. */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<EntryError | null>(null);
  const bad = (f: "email" | "password") => !!error?.fields.includes(f);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setError(localError("Falta preencher", [...(!email.trim() ? ["email" as const] : []), ...(!password ? ["password" as const] : [])], "Informe seu e-mail e sua senha."));
      return;
    }
    setLoading(true); setError(null);
    try {
      await authAction("login", { email: email.trim(), password });
      router.replace(next);
      router.refresh();
    } catch (err) {
      if ((err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail === "email_not_verified") {
        router.push(`/confirmar-email?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      setError(loginError(err));
      setLoading(false);
    }
  }

  return (
    <EntryShell>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <EntryTitle title="Bem-vindo de volta" subtitle="Entre para acessar seus registros." />
        <ErrorBox error={error} />
        <EntryField label="E-mail" icon="mail" placeholder="voce@exemplo.com" type="email" value={email} invalid={bad("email")} onChange={e => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" inputMode="email" />
        <EntryField label="Senha" icon="lock" placeholder="••••••••••••" type="password" value={password} invalid={bad("password")} onChange={e => setPassword(e.target.value)} autoCapitalize="none" autoComplete="current-password" />
        <div className="flex justify-end"><SmallLink href="/esqueci-a-senha">Esqueci minha senha</SmallLink></div>
        <EntryButton type="submit" label={loading ? "Entrando…" : "Entrar"} busy={loading} />
        <div className="h-px bg-stroke" />
        <span className="font-label text-xs leading-4 text-display uppercase">Ainda não tem conta?</span>
        <EntryButton kind="clear" label="Criar uma conta" href="/criar-conta" />
        {/* Quem criou a conta com o Google no app ainda não tem senha: "Esqueci minha senha" cria uma. */}
        <p className="text-sm leading-5 text-text-secondary">Criou a conta com o Google no app? Use “Esqueci minha senha” com o mesmo e-mail para definir uma senha.</p>
      </form>
    </EntryShell>
  );
}
