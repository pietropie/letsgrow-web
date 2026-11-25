/**
 * Relés do Hub (Figma 28 · SN5–SN10, W12p). Lib pura (sem imports de runtime), testada em tests/relays.test.cjs.
 *
 * Contrato: letsgrow-backend/docs/API-SENSORES-RELES.md §4. Os nomes de campo ficam todos aqui.
 * - GET  /iot/devices/{hub_id}/relays → `HubRelays` (as 4 posições e os equipamentos que podem ir nelas)
 * - PUT  /iot/devices/{hub_id}/relays/{n} → vínculo e modo; 409 `equipment_in_use` pede a repetição com `move: true`
 * - POST /iot/devices/{hub_id}/relays/{n}/command `{state}` ou `{action:"resume"}` → 202 `{req_id}`; 409 `hub_offline`
 * - GET  /iot/relay-commands/{req_id} → `RelayCommand`, consultado a cada ~1 s; `timeout` depois de 10 s
 *
 * Regras de tela: a chave mostra só o estado que o Hub confirmou, nunca o que o app mandou. O app nunca manda
 * "desligar" antes de liberar ou trocar uma posição: o Hub desliga a saída sozinho (rebind).
 */

export type EquipKind = "light" | "exhaust" | "fan";
export type RelayMode = "manual" | "schedule" | "humidity";
export type RelayState = {
  n: number;
  equip_kind: EquipKind | null;
  equip_key: string | null;
  equip_name?: string | null;
  kind_label?: string | null;
  watts?: number | null;
  mode: RelayMode;
  /** O modo que vale de fato: `schedule` sem fotoperíodo completo (ou 24/0) vira `manual`. */
  effective_mode?: RelayMode;
  /** Último estado conhecido (1 ligado, 0 desligado). */
  state: 0 | 1 | null;
  /** Comando manual pausando o modo automático. */
  override: boolean;
  source: string | null;
  /** Desde quando vale o estado. */
  ts: string | null;
  /** false enquanto o estado ainda não veio do Hub (logo depois de trocar o equipamento, `source: "rebind"`). */
  confirmed?: boolean;
  /** A programação manda ligado agora; decide a confirmação de apagar a luz (SN7a). */
  schedule_lit?: boolean | null;
  /** Próxima borda da programação ("Ligada · até 22:00"). */
  next_change_at?: string | null;
};
/** Equipamento que pode ir numa posição; `n` e `hub_id` dizem onde ele já está, em qualquer Hub do ambiente. */
export type RelayEquipment = { kind: EquipKind; key: string; name: string; kind_label?: string; watts?: number | null; n: number | null; hub_id: string | null };
export type HubRelays = {
  hub_id?: string; online: boolean; synced: boolean; sync_error?: string | null;
  relays: RelayState[]; equipment?: RelayEquipment[]; warnings?: { code: string; n?: number | null }[];
};
export type RelayCommandStatus = "pending" | "confirmed" | "failed" | "timeout";
export type RelayCommand = { req_id: string; status: RelayCommandStatus; relay?: number; state?: 0 | 1 | null; err?: string | null };

export const POSITIONS = [1, 2, 3, 4] as const;
export const POLL_MS = 1000;
export const COMMAND_TIMEOUT_MS = 10_000;

export const KIND_LABEL: Record<EquipKind, string> = { light: "Iluminação", exhaust: "Exaustão", fan: "Ventilação" };
export const KIND_SHORT: Record<EquipKind, string> = { light: "Luz", exhaust: "Exaustor", fan: "Ventilad." };
export const KIND_ICON: Record<EquipKind, string> = { light: "light", exhaust: "exhaust", fan: "fan" };
export const MODE_LABEL: Record<RelayMode, string> = { manual: "Manual", schedule: "Programação", humidity: "Umidade" };
export const MODE_LINE: Record<RelayMode, string> = { manual: "Relé · manual", schedule: "Relé · pela programação", humidity: "Relé · pela umidade" };

/** O modo que a tela mostra: o efetivo, quando o servidor manda. */
export function shownMode(r: RelayState): RelayMode {
  return r.effective_mode ?? r.mode;
}

/** Opção da folha "O que está ligado aqui?": `at` é a posição neste Hub; `otherHub`, se está em outro Hub do ambiente. */
export type EquipOption = { kind: EquipKind; key: string; title: string; at: number | null; otherHub: boolean };

/** A lista `equipment` do GET, com o nome do cadastro, vista a partir de um Hub. */
export function equipmentOptions(list: RelayEquipment[] | undefined, hubId: string): EquipOption[] {
  return (list ?? []).map(e => {
    const here = e.n != null && (e.hub_id == null || e.hub_id === hubId);
    return { kind: e.kind, key: e.key, title: e.name || KIND_LABEL[e.kind], at: here ? e.n : null, otherHub: e.n != null && !here };
  });
}

/** Concordância do estado: "Ligada" (luz), "Ligado" (exaustor), "Ligados" (mais de um ventilador). */
export function stateWord(kind: EquipKind | null, on: boolean, plural = false): string {
  const base = on ? "Ligad" : "Desligad";
  return base + (kind === "light" ? "a" : "o") + (plural ? "s" : "");
}

function hhmm(iso: string): string | null {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;
}
/** "22:00" da próxima borda da programação, quando houver. */
export function nextChangeClock(r: RelayState): string | null {
  return r.next_change_at ? hhmm(r.next_change_at) : null;
}

/**
 * Marcador do estado (W12p, SN7b): "Ligada · até 22:00" no modo automático sem pausa e com a próxima borda; senão
 * "Ligado · desde 12:30"; offline, "Último estado: ligado · 22:10" (SN6c); sem confirmação do Hub, "Aguardando o Hub".
 */
export function stateLine(r: RelayState, opts: { online: boolean; plural?: boolean; day?: (iso: string) => string | null }): string {
  if (r.state == null || (r.confirmed === false && opts.online)) return opts.online ? "Aguardando o Hub" : "Sem estado conhecido";
  const word = stateWord(r.equip_kind, r.state === 1, opts.plural);
  const when = r.ts ? (opts.day?.(r.ts) ?? hhmm(r.ts)) : null;
  if (!opts.online) return `Último estado: ${word.toLowerCase()}${when ? ` · ${when}` : ""}`;
  const until = nextChangeClock(r);
  if (until && shownMode(r) === "schedule" && !r.override) return `${word} · até ${until}`;
  return when ? `${word} · desde ${when}` : word;
}

/** SN7a: só a luz pede confirmação, e só para desligar quando `schedule_lit` é true (a programação manda acesa). */
export function needsLightConfirm(r: RelayState, want: 0 | 1): boolean {
  return r.equip_kind === "light" && want === 0 && r.schedule_lit === true;
}

/** Leitura de um comando: `timeout` também quando o servidor ainda diz `pending` depois de 10 s. */
export function commandOutcome(c: RelayCommand | null | undefined, startedAt: number, now: number): RelayCommandStatus {
  if (!c) return now - startedAt > COMMAND_TIMEOUT_MS ? "timeout" : "pending";
  if (c.status === "pending" && now - startedAt > COMMAND_TIMEOUT_MS) return "timeout";
  return c.status;
}

/** "3 de 4 em uso". */
export function inUse(relays: RelayState[]): number {
  return relays.filter(r => r.equip_kind != null).length;
}

const WARNINGS: Record<string, string> = {
  over_output_limit: "Acima do limite seguro desta saída. Use um contator ou um relé maior.",
  over_total_limit: "A soma passa do que uma tomada de 10 A aguenta.",
  missing_watts: "Potência não informada.",
};
export function warningText(code: string): string | null {
  return WARNINGS[code] ?? null;
}

/** Erros do comando em frases da tela. */
export function relayErrorText(status: number | undefined, detail: string | undefined): string {
  if (detail === "relay_free") return "Esta posição não tem equipamento.";
  if (detail === "hub_offline" || status === 409) return "O Hub está offline. A chave volta quando ele se conectar.";
  if (status === 503) return "O servidor não conseguiu falar com o Hub agora. Tente de novo.";
  return "Não foi possível mandar o comando. Tente de novo.";
}

/** Erros do PUT de uma posição (vínculo e modo). */
const SAVE_ERRORS: Record<string, string> = {
  photoperiod_required: "Cadastre a programação de luz do ambiente para a luz seguir a programação.",
  schedule_required: "Defina os horários para usar a programação.",
  humidity_required: "Defina a umidade de ligar e de desligar.",
  mode_not_allowed: "A luz não pode seguir a umidade.",
  equipment_not_found: "Esse equipamento não está mais cadastrado no ambiente.",
  relay_free: "Escolha um equipamento antes do modo.",
  broker_unavailable: "O servidor não conseguiu falar com o Hub agora. Nada mudou; tente de novo.",
};
export function relaySaveErrorText(detail: string | undefined): string {
  return (detail && SAVE_ERRORS[detail]) || "Não foi possível salvar a posição. Tente de novo.";
}
