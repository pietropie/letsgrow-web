"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EntryPage } from "@/components/entry-page";
import { Button, ButtonLink, CheckRow, FormError, PageSubtitle, PageTitle, PasswordField, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/shared/lib/errors";

/** Mesmo fluxo do mobile (app/(auth)/register.tsx): a conta nasce sem verificação e o código vai por e-mail. */
export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Compatibilidade com a API: identificador interno, não é um nome público.
  const [username] = useState(() => "lg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12));
  // Exigido antes de a conta existir (Play: público 18+, PLAYSTORE.md P10); vai como age_confirmed.
  const [adult, setAdult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) { setError("Informe seu e-mail e sua senha."); return; }
    if (password.length < 8) { setError("Use uma senha com pelo menos 8 caracteres."); return; }
    if (!adult) { setError("Confirme que você tem 18 anos ou mais para criar a conta."); return; }
    setError(""); setLoading(true);
    try {
      const data = await api<{ email: string }>("/auth/register", { method: "POST", body: { email: email.trim().toLowerCase(), password, full_name: name.trim() || null, username, age_confirmed: true } });
      router.replace(`/confirmar-email?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      setError(getErrorMessage(err, "Erro ao criar conta. Tente novamente."));
      setLoading(false);
    }
  }

  return (
    <EntryPage fallback="/boas-vindas">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <PageTitle>Crie sua conta</PageTitle>
        <PageSubtitle>Você pode continuar sem ambiente ou planta.</PageSubtitle>
        <TextField label="Como quer ser chamado?" placeholder="Seu apelido" hint="Opcional. Usado dentro da sua conta." value={name} onChange={e => setName(e.target.value)} autoCapitalize="words" autoComplete="nickname" />
        <TextField label="E-mail" placeholder="voce@exemplo.com" hint="Para entrar e recuperar o acesso." type="email" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" inputMode="email" />
        <PasswordField label="Senha" placeholder="••••••••••••" hint="Use uma senha exclusiva, com pelo menos 8 caracteres." value={password} onChange={e => setPassword(e.target.value)} autoCapitalize="none" autoComplete="new-password" />
        <CheckRow title="Tenho 18 anos ou mais" body="E vou usar o app de acordo com a lei do meu país." checked={adult} onChange={v => { setAdult(v); if (v) setError(""); }} />
        <PageSubtitle>Ao criar a conta, você aceita os Termos de uso. Leia como seus dados são tratados.</PageSubtitle>
        <ButtonLink secondary label="Termos e privacidade" href="/termos" />
        <FormError message={error} />
        <Button type="submit" label={loading ? "Criando conta…" : "Criar conta"} loading={loading} />
        <ButtonLink secondary replace label="Já tenho conta" href="/entrar" />
      </form>
    </EntryPage>
  );
}
