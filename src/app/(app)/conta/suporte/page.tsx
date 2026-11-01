"use client";

import { useState, type FormEvent } from "react";
import { AccountBack } from "@/components/account";
import { Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, TextArea, TextField } from "@/components/ui";
import { useSendSupport } from "@/lib/account";
import { routes } from "@/lib/routes";
import { getErrorMessage } from "@/shared/lib/errors";

/** Figma 2160:9397 (Como podemos ajudar?) e 2160:9439 (Mensagem recebida). */
export default function SupportPage() {
  const send = useSendSupport();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (subject.trim().length < 3) return setError("Escreva um assunto com pelo menos 3 letras.");
    if (message.trim().length < 10) return setError("Escreva a mensagem com pelo menos 10 letras.");
    send.mutate({ subject: subject.trim(), message: message.trim() }, {
      onSuccess: () => setSent(true),
      onError: err => setError(getErrorMessage(err, "Não foi possível enviar. Seu texto continua aqui.")),
    });
  }

  if (sent) return <>
    <PageTitle>Mensagem recebida</PageTitle>
    <PageSubtitle>Você receberá o retorno pelo e-mail da conta.</PageSubtitle>
    <Notice title="Seu pedido foi registrado" body="O envio ao suporte não consome créditos." />
    <ButtonLink label="Voltar à conta" href={routes.account()} />
  </>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <AccountBack />
      <PageTitle>Como podemos ajudar?</PageTitle>
      <PageSubtitle>Ajuda com sua conta e com o serviço.</PageSubtitle>
      <TextField label="Assunto" value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} placeholder="Dúvida sobre meus dados" />
      <TextArea label="Sua mensagem" value={message} onChange={e => setMessage(e.target.value)} maxLength={4000} rows={5}
        placeholder="Gostaria de entender como meus dados são tratados." hint="Não inclua informações sensíveis desnecessárias." />
      <FormError message={error} />
      <Button type="submit" label={send.isPending ? "Enviando…" : "Enviar mensagem"} loading={send.isPending} />
    </form>
  );
}
