/**
 * Destinos das telas web. As áreas que ainda não foram construídas (WEBAPP.md §6) devolvem null, e o
 * botão ou link que levaria até elas não aparece: nada de ação que leva a uma tela vazia.
 * Ao entregar uma fase, troque o null pelo caminho.
 */
export const routes = {
  grows: () => "/ambientes",
  archivedGrows: () => "/ambientes/arquivados",
  newGrow: (): string | null => "/ambientes/novo",
  growPanel: (growId: string): string | null => `/ambientes/${growId}`,
  growEdit: (growId: string) => `/ambientes/${growId}/editar`,
  growEquipment: (growId: string) => `/ambientes/${growId}/equipamentos`,
  growEquipmentForm: (growId: string, kind: string) => `/ambientes/${growId}/equipamentos/${kind}`,
  growHistory: (growId: string) => `/ambientes/${growId}/historico`,
  growReading: (growId: string, readingId?: string): string | null => `/ambientes/${growId}/registro${readingId ? `?leitura=${readingId}` : ""}`,
  growSensors: (growId: string): string | null => `/ambientes/${growId}/sensores`,
  plants: () => "/plantas",
  plantsCalendar: (): string | null => "/plantas?modo=calendario",
  archivedPlants: () => "/plantas/arquivadas",
  newPlant: (growId?: string): string | null => `/plantas/nova${growId ? `?ambiente=${growId}` : ""}`,
  plant: (plantId: string): string | null => `/plantas/${plantId}`,
  plantInfo: (plantId: string) => `/plantas/${plantId}/informacoes`,
  plantPhotos: (plantId: string) => `/plantas/${plantId}/fotos`,
  plantDiary: (plantId: string, opts?: { novo?: boolean }): string | null => `/plantas/${plantId}/diario${opts?.novo ? "?novo=1" : ""}`,
  diaryEntry: (plantId: string, eventId: string) => `/plantas/${plantId}/registro/${eventId}`,
  termHelp: () => "/plantas/ajuda",
  bobby: (): string | null => "/bobby",
  /** Abre o Bobby com uma pergunta pronta (dica do clima, resumo): ela é enviada numa conversa nova. */
  bobbyAsk: (prompt: string, ctx?: { grow_id?: string; plant_id?: string | null }): string | null => `/bobby?${query({ pergunta: prompt, planta: ctx?.plant_id, ambiente: ctx?.grow_id })}`,
  /** Abre o Bobby já com a planta ou o ambiente como contexto, sem enviar nada. */
  bobbyWith: (ctx: { plantId?: string | null; growId?: string | null }) => `/bobby${ctx.plantId || ctx.growId ? `?${query({ planta: ctx.plantId, ambiente: ctx.growId })}` : ""}`,
  bobbyObservation: (plantId?: string): string | null => `/bobby/observacao${plantId ? `?planta=${plantId}` : ""}`,
  bobbyObservationBase: (plantId: string, alertId?: string) => `/bobby/base?${query({ planta: plantId, alerta: alertId })}`,
  bobbyObservationFeedback: (plantId: string, alertId?: string) => `/bobby/aviso?${query({ planta: plantId, alerta: alertId })}`,
  bobbyMemory: () => "/bobby/memoria",
  /** Reabre uma conversa salva (reler não custa nada). */
  bobbyConversation: (id: string) => `/bobby?conversa=${id}`,
  account: () => "/conta",
  credits: () => "/conta/creditos",
  creditHelp: () => "/conta/creditos/o-que-consome",
  creditLog: () => "/conta/creditos/historico",
  packs: () => "/conta/creditos/pacotes",
  plans: () => "/conta/planos",
  notifications: () => "/conta/notificacoes",
  notificationPrefs: () => "/conta/notificacoes/editar",
  accountData: () => "/conta/privacidade",
  beforeSharing: () => "/conta/privacidade/antes-de-compartilhar",
  dataExport: () => "/conta/privacidade/copia",
  deleteAccount: () => "/conta/privacidade/excluir",
  support: () => "/conta/suporte",
  help: () => "/como-funciona",
  install: () => "/instalar",
};

function query(params: Record<string, string | null | undefined>) {
  return new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();
}
