/* eslint-disable @typescript-eslint/no-unused-vars -- os parâmetros ficam para quando cada fase ligar o destino. */
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
  growSensors: (_growId: string): string | null => null, // F7
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
  bobbyObservation: (_plantId: string): string | null => null, // F5
  /** Abre o Bobby com uma pergunta pronta (dica do clima, resumo). */
  bobbyAsk: (_prompt: string, _ctx?: { grow_id?: string; plant_id?: string | null }): string | null => null, // F5
  bobby: (): string | null => null, // F5
};
