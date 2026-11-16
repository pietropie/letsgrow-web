"use client";

import { useState, type FormEvent } from "react";
import { EntryButton, EntryField, EntryShell, EntryTitle, ErrorBox, SuccessBox } from "@/components/entry";
import { api } from "@/lib/api";
import { codeError, localError, type EntryError } from "@/lib/entry";

/** UX item 25: L5 (Figma 2431:24294). Mesmo fluxo do mobile (forgot-password.tsx): a API responde 204 com ou sem conta. */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<EntryError | null>(null);
  const [sent, setSent] = useState(false);
  const normalized = email.trim().toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!normalized) { setError(localError("Falta o e-mail", ["email"], "Informe o e-mail da sua conta.")); return; }
    setLoading(true); setError(null);
    try { await api("/auth/forgot-password", { method: "POST", body: { email: normalized } }); setSent(true); }
    catch (err) { const r = codeError(err); setError(r.fields.includes("code") ? localError("Não foi possível enviar", [], "Tente de novo em instantes.") : r); }
    finally { setLoading(false); }
  }

  return (
    <EntryShell back={{ href: "/entrar", label: "Voltar para entrar" }}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <EntryTitle title="Recuperar acesso" subtitle="Vamos enviar as instruções para o seu e-mail." />
        <ErrorBox error={error} />
        <EntryField label="E-mail" icon="mail" placeholder="voce@exemplo.com" type="email" value={email} invalid={!!error?.fields.includes("email")} onChange={e => { setEmail(e.target.value); setSent(false); }} autoCapitalize="none" autoCorrect="off" autoComplete="email" inputMode="email" />
        <EntryButton type="submit" label={loading ? "Enviando…" : "Enviar instruções"} busy={loading} />
        {sent && (
          <SuccessBox title="Solicitação enviada">
            <p className="text-sm leading-5 text-text">Confira seu e-mail. Se ele estiver cadastrado, o código chega em instantes.</p>
            <EntryButton kind="clear" label="Inserir código recebido" href={`/nova-senha?email=${encodeURIComponent(normalized)}`} />
          </SuccessBox>
        )}
      </form>
    </EntryShell>
  );
}
