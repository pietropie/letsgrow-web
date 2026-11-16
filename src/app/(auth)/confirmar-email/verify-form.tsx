"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CodeDisplay, EntryButton, EntryShell, EntryTitle, ErrorBox, StepMeter, SuccessBox } from "@/components/entry";
import { api, authAction } from "@/lib/api";
import { codeError, localError, type EntryError } from "@/lib/entry";

/** UX item 25: L4 (Figma 2431:24232), passo 2 de 2. Mesmo fluxo do mobile (verify-email.tsx); o e-mail vem do cadastro ou do login. */
export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<EntryError | null>(null);
  const codeBad = error?.fields.includes("code");

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (loading || resending) return;
    if (!email) { setError(localError("Falta o e-mail", [], "Volte ao cadastro para informar seu e-mail.")); return; }
    if (!/^\d{6}$/.test(code)) { setError(localError("Código incompleto", ["code"], "Digite os 6 dígitos do e-mail.")); return; }
    setLoading(true); setError(null); setResent(false);
    try {
      await authAction("verify-email", { email, code });
      router.replace("/primeiro-acesso");
      router.refresh();
    } catch (err) {
      setError(codeError(err));
      setLoading(false);
    }
  }

  async function resend() {
    if (loading || resending || !email) return;
    setResending(true); setResent(false); setError(null);
    try { await api("/auth/resend-verification", { method: "POST", body: { email } }); setResent(true); setCode(""); }
    catch (err) { const r = codeError(err); setError(r.fields.includes("code") ? localError("Não foi possível reenviar", [], "Tente de novo em instantes.") : r); }
    finally { setResending(false); }
  }

  return (
    <EntryShell back={{ href: "/entrar", label: "Voltar para entrar" }}>
      <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
        <StepMeter step={2} label="Confirmação" />
        <EntryTitle title="Confirme seu e-mail" subtitle={email ? <>Enviamos um código de 6 dígitos para <strong className="font-semibold">{email}</strong>. Ele vale por alguns minutos.</> : "Volte ao cadastro para informar seu e-mail."} />
        {error && !codeBad && <ErrorBox error={error} />}
        <CodeDisplay value={code} onChange={c => { setCode(c); if (codeBad) setError(null); }} error={codeBad ? error!.title : null} />
        {resent && <SuccessBox title="Código reenviado"><p className="text-sm leading-5 text-text">Confira seu e-mail e a pasta de spam.</p></SuccessBox>}
        <EntryButton type="submit" label={loading ? "Verificando…" : "Confirmar e-mail"} busy={loading} disabled={resending} />
        <EntryButton kind="clear" label={resending ? "Reenviando…" : "Reenviar código"} busy={resending} disabled={loading || !email} onClick={resend} />
      </form>
    </EntryShell>
  );
}
