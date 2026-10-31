import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";
import { DELETION_GRACE_DAYS, PRIVACY_EMAIL } from "@/lib/legal";
import { REFRESH_COOKIE } from "@/lib/server/session";
import { DeletionPanel } from "./deletion-panel";

export const metadata: Metadata = {
  title: "Excluir conta",
  description: "Como pedir a exclusão da sua conta do LetsGrow, o que é apagado, o prazo para desistir e o que fica retido.",
  alternates: { canonical: "/excluir-conta" },
};

/**
 * URL pública exigida pela Play Store para pedir a exclusão sem o app. O texto é renderizado no servidor;
 * só o painel do pedido (com sessão) roda no navegador, pela API do app (/account/deletion-*).
 * O que é apagado segue app/services/account_data.py (delete_user_account) e a Política de privacidade §7.
 */
export default async function DeleteAccountPage() {
  const signedIn = Boolean((await cookies()).get(REFRESH_COOKIE)?.value);
  return (
    <LegalPage title="Excluir sua conta do LetsGrow" subtitle="Você pode pedir a exclusão a qualquer momento, pelo app ou por esta página." current="/excluir-conta">
      <section aria-labelledby="como" className="flex flex-col gap-2">
        <h2 id="como" className="text-[22px] leading-[30px] font-bold">Como pedir</h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          <li><strong className="font-semibold">No app:</strong> Conta › Privacidade e dados › Excluir minha conta.</li>
          <li><strong className="font-semibold">Na web:</strong> entre com a sua conta e confirme o pedido logo abaixo.</li>
          <li>
            <strong className="font-semibold">Sem acesso à conta:</strong>{" "}
            {PRIVACY_EMAIL
              ? <>escreva para <a href={`mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent("Excluir minha conta")}`} className="text-primary underline">{PRIVACY_EMAIL}</a></>
              : <>escreva para o contato de privacidade indicado na <Link href="/privacidade" className="text-primary underline">Política de privacidade</Link></>}
            , a partir do e-mail da conta.
          </li>
        </ul>
        <p className="text-sm leading-5 text-text-muted">
          Criou a conta com o Google? Para entrar por esta página, use “<Link href="/esqueci-a-senha" className="text-primary underline">Esqueci minha senha</Link>”
          com o mesmo e-mail: você recebe um código e define uma senha.
        </p>
      </section>

      <section aria-labelledby="prazo" className="flex flex-col gap-2">
        <h2 id="prazo" className="text-[22px] leading-[30px] font-bold">Prazo para desistir</h2>
        <p>
          Depois do pedido, a exclusão fica agendada por {DELETION_GRACE_DAYS} dias. A data aparece antes de você confirmar e
          no e-mail de confirmação. Até lá você pode cancelar o pedido, pelo app ou por esta página. Passado o prazo, a
          exclusão é definitiva.
        </p>
      </section>

      <section aria-labelledby="apagado" className="flex flex-col gap-2">
        <h2 id="apagado" className="text-[22px] leading-[30px] font-bold">O que é apagado</h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          <li>a conta (e-mail, nome, senha e foto de perfil);</li>
          <li>ambientes, vasos, plantas, registros do diário, leituras de temperatura e umidade e sensores pareados;</li>
          <li>fotos dos registros e das conversas;</li>
          <li>conversas com o Bobby, avaliações das respostas e a memória de preferências;</li>
          <li>pedidos de suporte, notificações, créditos e cópias de dados que você tenha solicitado.</li>
        </ul>
      </section>

      <section aria-labelledby="retido" className="flex flex-col gap-2">
        <h2 id="retido" className="text-[22px] leading-[30px] font-bold">O que fica retido</h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          <li>registros de compras e assinaturas, desvinculados da conta, pelo prazo exigido pela legislação fiscal;</li>
          <li>cópias de segurança, que expiram em até 35 dias.</li>
        </ul>
        <p className="text-sm leading-5 text-text-muted">Antes de excluir, você pode pedir uma cópia dos seus dados no app, em Conta › Privacidade e dados.</p>
      </section>

      <section aria-labelledby="pedido" className="flex flex-col gap-3 rounded-2xl bg-surface p-5">
        <h2 id="pedido" className="text-[22px] leading-[30px] font-bold">Pedir a exclusão</h2>
        <DeletionPanel signedIn={signedIn} />
      </section>
    </LegalPage>
  );
}
