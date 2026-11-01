"use client";

import { AccountBack } from "@/components/account";
import { Button, ButtonLink, FormError, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { useNotificationPreferences, useSaveNotificationPreferences } from "@/lib/account";
import { routes } from "@/lib/routes";
import { deviceTimezone, quietRangeText } from "@/shared/lib/accountFeatures";
import { getErrorMessage } from "@/shared/lib/errors";

/**
 * Figma 2160:9095 (Seu acompanhamento) e 2160:9183 (Notificações desativadas), mobile account/notifications.tsx.
 * As notificações saem pelo app no celular; a web só guarda as preferências da conta (push na web é proposta à parte).
 */
export default function NotificationsPage() {
  const timezone = deviceTimezone();
  const prefs = useNotificationPreferences(timezone);
  const save = useSaveNotificationPreferences();
  const p = prefs.data;

  if (prefs.isPending) return <><AccountBack /><PageTitle>Seu acompanhamento</PageTitle><Spinner /></>;
  if (!p) return <>
    <AccountBack />
    <PageTitle>Seu acompanhamento</PageTitle>
    <Notice title="Não foi possível carregar" body="Suas preferências não foram alteradas." />
    <Button secondary label="Tentar novamente" onClick={() => void prefs.refetch()} />
  </>;

  // O mesmo corpo para os dois: só a frequência muda. "in_app" leva ao estado desativado (2160:9183).
  const saveFrequency = (frequency: "daily" | "in_app") => save.mutate({
    frequency, brief_time: p.brief_time ?? "19:00", timezone: p.timezone && p.timezone !== "UTC" ? p.timezone : timezone,
    quiet_start: p.quiet_start, quiet_end: p.quiet_end, preview: p.preview,
  });

  if (p.frequency === "in_app") return <>
    <AccountBack />
    <PageTitle>Notificações desativadas</PageTitle>
    <PageSubtitle>Você continua no controle.</PageSubtitle>
    <Notice title="Acompanhamento dentro do app" body="As novidades ficam disponíveis quando você abrir o LetsGrow. Nenhum alerta externo será enviado." />
    <FormError message={save.error ? getErrorMessage(save.error, "Não foi possível reativar agora.") : ""} />
    <ButtonLink label="Voltar à conta" href={routes.account()} />
    <Button secondary label={save.isPending ? "Reativando…" : "Reativar resumo diário"} loading={save.isPending} onClick={() => saveFrequency("daily")} />
  </>;

  const quiet = quietRangeText(p);
  return <>
    <AccountBack />
    <PageTitle>Seu acompanhamento</PageTitle>
    <ButtonLink secondary label="Editar preferências" href={routes.notificationPrefs()} />
    <PageSubtitle>Escolha quando e como receber novidades.</PageSubtitle>
    <Notice title="Resumo diário" body="Uma atualização reunida, sem alertas repetidos." meta={p.brief_time ? `${p.is_default ? "Horário padrão" : "Horário escolhido"}: ${p.brief_time}` : "Horário não definido"} />
    <Notice white title={p.preview === "discreet" ? "Prévia discreta" : "Prévia completa"}
      body={p.preview === "discreet" ? "“Há uma atualização no LetsGrow.”" : "A notificação mostra o resumo, com nomes de plantas."}
      meta={p.preview === "discreet" ? "Nomes de plantas e mensagens ficam ocultos." : "Você pode trocar para a prévia discreta."} />
    <Notice white title="Horário silencioso" body={quiet ? `Das ${quiet}` : "Não definido"} meta="Horário local" />
    <FormError message={save.error ? getErrorMessage(save.error, "Não foi possível desativar agora.") : ""} />
    <ButtonLink label="Manter estas preferências" href={routes.account()} />
    <Button secondary label={save.isPending ? "Desativando…" : "Desativar notificações externas"} loading={save.isPending} onClick={() => saveFrequency("in_app")} />
    <PageSubtitle>O acompanhamento dentro do app continua disponível.</PageSubtitle>
    <PageSubtitle>As notificações externas chegam pelo app LetsGrow no celular e dependem da permissão do aparelho.</PageSubtitle>
  </>;
}
