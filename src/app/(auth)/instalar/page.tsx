"use client";

import { EntryPage } from "@/components/entry-page";
import { ButtonLink, Notice, PageSubtitle, PageTitle } from "@/components/ui";
import { useInstallContext } from "@/lib/pwa";

const STEPS = [
  ["Toque em Compartilhar", "O quadrado com a seta para cima, na barra do Safari (embaixo no iPhone, em cima no iPad)."],
  ["Escolha “Adicionar à Tela de Início”", "Role a lista de opções, se precisar."],
  ["Toque em “Adicionar”", "O ícone do LetsGrow aparece na Tela de Início. Abra o app por ele."],
] as const;

/**
 * Instalar no iPhone (não há app iOS nativo): a web vira um app na Tela de Início, em tela cheia, com ícone e tela de
 * abertura. A sessão continua a mesma. Aberta também sem conta, pelo link "Usar como app no iPhone".
 */
export default function InstallPage() {
  const ctx = useInstallContext();
  return (
    <EntryPage fallback="/">
      <PageTitle>Use o LetsGrow como app no iPhone</PageTitle>
      <PageSubtitle>Sem baixar nada da App Store: o site vira um ícone na Tela de Início.</PageSubtitle>
      {ctx === "installed" ? <Notice title="Tudo certo" body="Você já está usando o LetsGrow pela Tela de Início." />
        : ctx === "ios-other" ? <Notice white title="Abra no Safari" body="No iPhone, o jeito mais simples é pelo Safari. Copie o endereço app.letsgrowapp.com.br, abra no Safari e siga os passos abaixo." />
        : ctx === "other" ? <Notice white title="Você não está num iPhone agora" body="Abra app.letsgrowapp.com.br no Safari do iPhone e siga os passos abaixo. No Android, use o app LetsGrow do Google Play." />
        : null}
      <ol className="flex flex-col gap-3">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-3 rounded-xl border border-border bg-white p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
            <span className="flex flex-col gap-1"><span className="text-base leading-6 font-semibold text-text">{title}</span><span className="text-sm leading-5 text-text-muted">{body}</span></span>
          </li>
        ))}
      </ol>
      <Notice white title="Como app, a conta é a mesma" body="Seus ambientes, plantas e conversas com o Bobby aparecem iguais. Pode ser preciso entrar de novo na primeira vez que abrir pelo ícone." />
      <ButtonLink secondary label="Voltar" href="/" />
    </EntryPage>
  );
}
