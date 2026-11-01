"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Button, CheckRow, FormError } from "@/components/ui";
import { api } from "@/lib/api";
import { useLogout, useMe } from "@/lib/session-client";
import { getErrorMessage } from "@/shared/lib/errors";
import type { UserResponse } from "@/shared/types/api";

/**
 * Contas criadas antes da caixa 18+ (PLAYSTORE.md P10; mobile AgeConfirmSheet): `age_confirmed_at` nulo em /auth/me.
 * Pergunta uma vez e manda PATCH /users/me {age_confirmed: true}. Não fecha com Esc nem fora; a outra saída é sair da
 * conta. Backends antigos não mandam o campo (undefined), e então nada é perguntado.
 */
export function AgeConfirm() {
  const me = useMe();
  const open = me.data?.age_confirmed_at === null;
  const client = useQueryClient();
  const logout = useLogout();
  const ref = useRef<HTMLDialogElement>(null);
  const [adult, setAdult] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  async function confirm() {
    if (!adult || saving) return;
    setSaving(true); setError("");
    try { client.setQueryData(["me"], await api<UserResponse>("/users/me", { method: "PATCH", body: { age_confirmed: true } })); }
    catch (e) { setError(getErrorMessage(e, "Não foi possível confirmar agora. Tente de novo.")); }
    finally { setSaving(false); }
  }

  return (
    <dialog ref={ref} onCancel={e => e.preventDefault()} aria-labelledby="age-title"
      className="m-auto w-[calc(100%-32px)] max-w-[480px] rounded-[20px] bg-surface p-0 text-text backdrop:bg-black/40">
      <div className="flex flex-col gap-4 p-5">
        <h2 id="age-title" className="text-lg leading-6 font-semibold">Confirme sua idade</h2>
        <p className="text-base leading-6">O LetsGrow é só para maiores de 18 anos. Confirme uma vez para continuar usando o app.</p>
        <CheckRow title="Tenho 18 anos ou mais" body="E vou usar o app de acordo com a lei do meu país." checked={adult} onChange={v => { setAdult(v); setError(""); }} />
        <FormError message={error} />
        <Button label={saving ? "Confirmando…" : "Confirmar"} loading={saving} disabled={!adult} onClick={() => void confirm()} />
        <Button secondary label="Sair da conta" onClick={() => void logout()} />
      </div>
    </dialog>
  );
}
