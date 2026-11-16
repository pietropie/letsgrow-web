/**
 * Anexos do chat do Bobby (contrato do backend, 15 nov, nota anexos-chat-contrato.md): ficam 30 dias; a foto pode ir
 * para o calendário da planta. Os campos são opcionais até o deploy: sem `attachments`, a mensagem segue pelas
 * `photo_keys` como antes. Lib pura (sem imports), testada em tests/chatAttachments.test.cjs.
 */
export type ChatAttachment = {
  key: string;
  kind: "image" | "pdf";
  available: boolean;
  url: string | null;
  expires_at: string | null;
  can_save: boolean;
  saved_event_id: string | null;
  /** Ainda não está no contrato; quando vier, o "Guardada no calendário" abre o registro na planta certa. */
  saved_plant_id?: string | null;
};

export type SaveState = { kind: "none" } | { kind: "can" } | { kind: "saved"; eventId: string; plantId: string | null };

export type AttachmentView = {
  key: string;
  kind: "image" | "pdf" | "expired";
  url: string | null;
  /** "Disponível até 13/12", só enquanto o anexo existe. */
  until: string | null;
  save: SaveState;
};

/** Dia e mês no fuso de Brasília: o mesmo dia que a pessoa vê no app. */
export function untilLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
  return `Disponível até ${day}`;
}

/**
 * O que mostrar de cada anexo. `savedPlants` guarda a planta escolhida nesta visita (event_id → plant_id), porque o
 * GET ainda não diz em que planta a foto foi guardada.
 */
export function attachmentViews(attachments: ChatAttachment[] | undefined, savedPlants: Record<string, string> = {}): AttachmentView[] | null {
  if (!Array.isArray(attachments)) return null;
  return attachments.map(a => {
    if (!a.available || !a.url) return { key: a.key, kind: "expired", url: null, until: null, save: { kind: "none" } };
    const save: SaveState = a.saved_event_id
      ? { kind: "saved", eventId: a.saved_event_id, plantId: a.saved_plant_id ?? savedPlants[a.saved_event_id] ?? null }
      : a.kind === "image" && a.can_save ? { kind: "can" } : { kind: "none" };
    return { key: a.key, kind: a.kind === "pdf" ? "pdf" : "image", url: a.url, until: untilLabel(a.expires_at), save };
  });
}

/** Marca a foto como guardada depois do POST, sem reler a conversa. */
export function markSaved(attachments: ChatAttachment[] | undefined, key: string, eventId: string, plantId: string): ChatAttachment[] | undefined {
  return attachments?.map(a => (a.key === key ? { ...a, saved_event_id: eventId, saved_plant_id: plantId, can_save: false } : a));
}

/** Mensagens do POST .../attachments/save e do "Gerar de novo" com anexo vencido. O texto do servidor vem primeiro. */
export function saveErrorMessage(status: number | undefined, detail: string | null): string {
  if (detail) return detail;
  if (status === 410) return "Este anexo expirou e não pode mais ser guardado.";
  if (status === 422) return "Só fotos podem ir para o calendário.";
  if (status === 404) return "Não encontramos esta foto ou a planta escolhida.";
  return "Não foi possível guardar a foto. Tente de novo.";
}

export const EXPIRED_REGENERATE = "O anexo desta pergunta expirou (fica 30 dias). Envie a pergunta de novo com o anexo.";
