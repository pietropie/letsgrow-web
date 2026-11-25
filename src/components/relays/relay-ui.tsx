"use client";

import { useState } from "react";
import { Marker } from "@/components/panel";
import { ConfirmDialog } from "@/components/ui";
import { useRelaySwitch } from "@/lib/relay-client";
import { needsLightConfirm, nextChangeClock, stateLine, stateWord, type RelayState } from "@/lib/relays";

/**
 * Chave de um relé (Figma 28 · SN5–SN7, W12p). Mostra o estado confirmado pelo Hub; enquanto o comando vai, o lado pedido
 * fica cinza e a etiqueta diz "aguardando o Hub" (SN6a); sem confirmação em 10 s, "o Hub não confirmou" (SN6b); com o Hub
 * offline, a chave trava e mostra o último estado (SN6c). Só a luz, contra a programação, pede confirmação (SN7a).
 */
export function RelayControl({ hubId, relay, online, plural = false, nextOn = null, size = "small", subject }: {
  hubId: string; relay: RelayState; online: boolean; plural?: boolean;
  /** "amanhã às 06:00": quando a programação volta a acender. */
  nextOn?: string | null;
  size?: "small" | "large";
  /** "a luz", "o exaustor", "os ventiladores": usado nos textos. */
  subject: string;
}) {
  const sw = useRelaySwitch(hubId, relay.n);
  const [confirm, setConfirm] = useState(false);
  const sending = sw.phase.kind === "sending";
  const locked = !online || sending;
  const pick = (want: 0 | 1) => {
    if (locked || relay.state === want) return;
    if (needsLightConfirm(relay, want)) return setConfirm(true);
    void sw.send(want);
  };
  const words = size === "large" ? ["Ligado", "Desligado"] : ["Lig", "Desl"];
  const seg = (want: 0 | 1, text: string) => {
    const on = relay.state === want;
    const pending = sending && sw.phase.kind === "sending" && sw.phase.want === want;
    return (
      <button key={want} type="button" role="radio" aria-checked={on} disabled={locked} onClick={() => pick(want)}
        className={`font-label flex flex-1 items-center justify-center rounded-md uppercase ${size === "large" ? "min-h-11 text-[17px]" : "min-h-8 px-2.5 text-sm"}
          ${pending ? "bg-stroke-soft text-display" : on ? (online ? "bg-display text-surface" : "bg-stroke-soft text-surface") : online ? "text-display" : "text-stroke-soft"}
          ${locked ? "cursor-default" : "cursor-pointer hover:bg-surface-high"} ${on && online && !pending ? "hover:!bg-display" : ""}`}>
        {text}
      </button>
    );
  };
  const line = stateLine(relay, { online, plural });
  const until = nextChangeClock(relay);
  const failed = sw.phase.kind === "failed";

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={`Relé ${relay.n}: ${subject}`} className={`flex gap-1 self-stretch rounded-lg border-[1.5px] p-1 ${online ? "border-display" : "border-stroke-soft"} ${size === "small" ? "self-start" : ""}`}>
        {seg(1, words[0])}{seg(0, words[1])}
      </div>
      <div aria-live="polite" className="flex flex-wrap gap-1.5">
        {sending ? <Marker tone="light">{sw.phase.kind === "sending" && sw.phase.want === 1 ? "Ligando" : "Desligando"}… aguardando o Hub</Marker>
          : failed ? <Marker tone="out">O Hub não confirmou</Marker>
          : line && <Marker tone={!online ? "out" : relay.state === 1 && relay.equip_kind === "light" ? "light" : "plain"}>{line}</Marker>}
      </div>
      {sending && size === "large" && <p className="text-sm leading-5 text-text">A chave só muda quando o Hub confirma. Leva poucos segundos.</p>}
      {failed && <p className="text-sm leading-5 text-text">{(sw.phase.kind === "failed" && sw.phase.text) || `${capital(subject)} ${relay.state == null ? "não mudou" : `continua ${stateWord(relay.equip_kind, relay.state === 1, plural).toLowerCase()}`}. Tente de novo; se repetir, confira se o Hub está online.`}</p>}
      {!online && size === "large" && <p className="text-sm leading-5 text-text-secondary">Sem o Hub, o app não sabe o estado atual nem consegue mandar comando.</p>}
      <ConfirmDialog open={confirm} title="Desligar a luz agora?" confirm="Desligar"
        message={`A programação diz que a luz fica acesa${until ? ` até as ${until}` : " agora"}. Desligar fora do horário pode atrapalhar o fotoperíodo das plantas.`}
        onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void sw.send(0); }}>
        {nextOn && <Marker>Volta pela programação {nextOn}</Marker>}
      </ConfirmDialog>
    </div>
  );
}

function capital(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
