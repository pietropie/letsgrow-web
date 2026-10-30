/* eslint-disable @typescript-eslint/no-unused-vars -- os parâmetros ficam para quando cada fase ligar o destino. */
/**
 * Destinos das telas web. As áreas que ainda não foram construídas (WEBAPP.md §6) devolvem null, e o
 * botão ou link que levaria até elas não aparece: nada de ação que leva a uma tela vazia.
 * Ao entregar uma fase, troque o null pelo caminho.
 */
export const routes = {
  growPanel: (_growId: string): string | null => null, // F3
  growReading: (_growId: string): string | null => null, // F3
  plant: (_plantId: string): string | null => null, // F4
  plantDiary: (_plantId: string): string | null => null, // F4
  plantsCalendar: (): string | null => null, // F4
  newGrow: (): string | null => null, // F3
  newPlant: (_growId: string): string | null => null, // F4
  bobbyObservation: (_plantId: string): string | null => null, // F5
  /** Abre o Bobby com uma pergunta pronta (dica do clima, resumo). */
  bobbyAsk: (_prompt: string, _ctx?: { grow_id?: string; plant_id?: string | null }): string | null => null, // F5
};
