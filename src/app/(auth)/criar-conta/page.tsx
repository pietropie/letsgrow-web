"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AdultCheck, EntryButton, EntryField, EntryShell, EntryTitle, ErrorBox, SmallLink, StepMeter } from "@/components/entry";
import { api } from "@/lib/api";
import { localError, registerError, type EntryError, type EntryField as Field } from "@/lib/entry";

/**
 * UX item 25: L3 no celular, W8p no web (Figma 2431:24166, 2431:24497). Passo 1 de 2; o passo 2 é a confirmação do
 * e-mail, que já existia. Mesmo fluxo do mobile (register.tsx): a conta nasce sem verificação e o código vai por e-mail.
 * 18+ continua obrigatório (PLAYSTORE P10) e o aceite dos termos segue por frase (decisão do usuário, 16 nov).
 */
export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Compatibilidade com a API: identificador interno, não é um nome público.
  const [username] = useState(() => "lg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 12));
  const [adult, setAdult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<EntryError | null>(null);
  const bad = (f: Field) => !!error?.fields.includes(f);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) {
      setError(localError("Falta preencher", [...(!email.trim() ? ["email" as const] : []), ...(!password ? ["password" as const] : [])], "Informe seu e-mail e uma senha."));
      return;
    }
    if (password.length < 8) { setError(localError("Senha curta", ["password"], "Use uma senha com pelo menos 8 caracteres.")); return; }
    if (!adult) { setError(localError("Confirme a idade", ["adult"], "A conta é só para quem tem 18 anos ou mais.")); return; }
    setError(null); setLoading(true);
    try {
      const data = await api<{ email: string }>("/auth/register", { method: "POST", body: { email: email.trim().toLowerCase(), password, full_name: name.trim() || null, username, age_confirmed: true } });
      router.replace(`/confirmar-email?email=${encodeURIComponent(data.email)}`);
    } catch (err) {
      setError(registerError(err));
      setLoading(false);
    }
  }

  return (
    <EntryShell>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <StepMeter step={1} label="Seus dados" />
        <EntryTitle title="Crie sua conta" subtitle="Você pode continuar sem ambiente ou planta." />
        <ErrorBox error={error} />
        <EntryField label="Como quer ser chamado?" icon="user" placeholder="Seu apelido" value={name} onChange={e => setName(e.target.value)} autoCapitalize="words" autoComplete="nickname" />
        <EntryField label="E-mail" icon="mail" placeholder="voce@exemplo.com" hint="Enviamos um código para este e-mail" type="email" value={email} invalid={bad("email")} onChange={e => setEmail(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="email" inputMode="email" />
        <EntryField label="Senha" icon="lock" placeholder="••••••••••••" hint="Mínimo de 8 caracteres" type="password" value={password} invalid={bad("password")} onChange={e => setPassword(e.target.value)} autoCapitalize="none" autoComplete="new-password" />
        <AdultCheck checked={adult} invalid={bad("adult")} onChange={v => { setAdult(v); if (v && bad("adult")) setError(null); }} />
        <p className="text-sm leading-5 text-text">Ao criar a conta, você aceita os Termos de uso. Leia como seus dados são tratados.</p>
        <div className="flex flex-wrap gap-4"><SmallLink href="/termos">Termos de uso</SmallLink><SmallLink href="/privacidade">Privacidade</SmallLink></div>
        <EntryButton type="submit" label={loading ? "Criando conta…" : "Criar conta"} busy={loading} />
        <EntryButton kind="clear" replace label="Já tenho conta" href="/entrar" />
      </form>
    </EntryShell>
  );
}
