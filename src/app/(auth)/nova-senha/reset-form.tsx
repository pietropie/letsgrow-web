"use client";

import { useState, type FormEvent } from "react";
import { CodeDisplay, EntryButton, EntryField, EntryShell, EntryTitle, ErrorBox, SuccessBox } from "@/components/entry";
import { api } from "@/lib/api";
import { codeError, localError, type EntryError, type EntryField as Field } from "@/lib/entry";

/** UX item 25: L6 (Figma 2431:24331). Mesmo fluxo do mobile (reset-password.tsx). */
export function ResetForm({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<EntryError | null>(null);
  const bad = (f: Field) => !!error?.fields.includes(f);
  // O erro de um campo fica embaixo dele (marcador rosa); o geral, na caixa vermelha.
  const fieldError = (f: Field) => (bad(f) ? error!.title : null);
  const general = error && !error.fields.length ? error : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!email) { setError(localError("Falta o e-mail", [], "Volte à recuperação para informar seu e-mail.")); return; }
    if (!/^\d{6}$/.test(code)) { setError(localError("Código incompleto", ["code"])); return; }
    if (password.length < 8) { setError(localError("Mínimo de 8 caracteres", ["password"])); return; }
    if (password !== confirmation) { setError(localError("As senhas não coincidem", ["confirmation"])); return; }
    setLoading(true); setError(null);
    try { await api("/auth/reset-password", { method: "POST", body: { email, code, new_password: password } }); setDone(true); }
    catch (err) { setError(codeError(err)); }
    finally { setLoading(false); }
  }

  if (done) {
    return (
      <EntryShell>
        <EntryTitle title="Senha redefinida" />
        <SuccessBox title="Tudo pronto"><p className="text-sm leading-5 text-text">Sua senha foi alterada. Você já pode entrar com a nova senha.</p></SuccessBox>
        <EntryButton replace label="Entrar agora" href="/entrar" />
      </EntryShell>
    );
  }

  return (
    <EntryShell back={{ href: "/entrar", label: "Voltar para entrar" }}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <EntryTitle title="Redefinir senha" subtitle={email ? <>Digite o código enviado para <strong className="font-semibold">{email}</strong> e escolha a nova senha.</> : "Volte à recuperação para informar seu e-mail."} />
        <ErrorBox error={general} />
        <CodeDisplay value={code} onChange={c => { setCode(c); if (bad("code")) setError(null); }} error={fieldError("code")} />
        <EntryField label="Nova senha" icon="lock" type="password" placeholder="••••••••••••" hint="Mínimo de 8 caracteres" error={fieldError("password")} value={password} onChange={e => setPassword(e.target.value)} autoCapitalize="none" autoComplete="new-password" />
        <EntryField label="Confirmar nova senha" icon="lock" type="password" placeholder="••••••••••••" error={fieldError("confirmation")} value={confirmation} onChange={e => { setConfirmation(e.target.value); if (bad("confirmation")) setError(null); }} autoCapitalize="none" autoComplete="new-password" />
        <EntryButton type="submit" label={loading ? "Salvando…" : "Redefinir senha"} busy={loading} />
      </form>
    </EntryShell>
  );
}
