"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Lamp, Marker, PanelButton } from "@/components/panel";
import { RelayControl } from "@/components/relays/relay-ui";
import { SUBJECT, scheduleFacts, useGrowRelays } from "@/components/relays/grow-relays";
import { SidePanel } from "@/components/side-panel";
import { BackLink, Button, ConfirmDialog, FormError, Spinner } from "@/components/ui";
import { useGrow, useMinuteOfDay } from "@/lib/hooks";
import { useSaveRelay } from "@/lib/relay-client";
import { KIND_ICON, KIND_LABEL, KIND_SHORT, MODE_LABEL, POSITIONS, inUse, relaySaveErrorText, shownMode, warningText, type EquipOption, type RelayState } from "@/lib/relays";
import { routes } from "@/lib/routes";
import { ApiError } from "@/lib/api";

/** Número da posição em caixa, como está marcado no Hub ao lado de cada saída. */
function PositionBadge({ n, free = false, size = 44 }: { n: number; free?: boolean; size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size }} className={`flex shrink-0 items-center justify-center rounded-lg border-[1.5px] p-[3px] ${free ? "border-stroke-soft" : "border-display"}`}>
      <span className={`flex h-full w-full items-center justify-center rounded-md text-2xl font-black ${free ? "bg-stroke-soft text-surface" : "bg-display text-surface"}`}>{n}</span>
    </span>
  );
}

/**
 * Relés do Hub (Figma 28 · W12p, SN8–SN10): as 4 saídas, o equipamento ligado em cada uma, a chave com o estado que o Hub
 * confirmou e a troca de equipamento. Só aparecem a luz, o exaustor e os ventiladores cadastrados neste ambiente.
 */
export default function HubRelaysPage() {
  const { id } = useParams<{ id: string }>();
  const growQuery = useGrow(id);
  const grow = growQuery.data;
  const minute = useMinuteOfDay();
  const g = useGrowRelays(grow);
  const save = useSaveRelay(g.hub?.id ?? null);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [error, setError] = useState("");
  const facts = scheduleFacts(grow, minute);

  const back = <BackLink fallback={routes.growSensors(id) ?? routes.grows()} />;
  if (growQuery.isPending || g.devices.isPending || (g.hub && g.relays.isPending)) return <div className="flex flex-col gap-4">{back}<Spinner /></div>;
  if (!grow) return <div className="flex flex-col gap-4">{back}<Button secondary label="Não foi possível carregar o ambiente. Tentar novamente" onClick={() => void growQuery.refetch()} /></div>;
  if (!g.hub) return (
    <div className="flex max-w-[600px] flex-col gap-4">{back}
      <h1 className="font-label text-[28px] leading-9 text-text-primary">Relés do Hub</h1>
      <p className="text-base leading-6 text-text">Os relés ficam no Hub. Adicione o Hub neste ambiente para ligar e desligar a luz, o exaustor e os ventiladores pelo app.</p>
      <div className="flex"><PanelButton label="Adicionar Hub" href={routes.growAddHub(id)} /></div>
    </div>
  );
  if (!g.relays.available) return (
    <div className="flex max-w-[600px] flex-col gap-4">{back}
      <h1 className="font-label text-[28px] leading-9 text-text-primary">Relés do Hub</h1>
      <p className="text-base leading-6 text-text">{g.relays.isError ? "O controle dos relés pelo app ainda não está disponível no servidor." : "Não foi possível carregar os relés."}</p>
      {!g.relays.isError && <Button secondary label="Tentar novamente" onClick={() => void g.relays.refetch()} />}
    </div>
  );

  const byN = new Map(g.list.map(r => [r.n, r]));
  const online = g.online;
  const used = inUse(g.list);
  const titleOf = (r: RelayState) => r.equip_name || g.options.find(o => o.kind === r.equip_kind && o.key === r.equip_key)?.title || KIND_LABEL[r.equip_kind!];
  const warnings = (g.relays.data?.warnings ?? []).map(w => ({ ...w, text: warningText(w.code) })).filter(w => w.text);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {back}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-label min-w-0 flex-1 text-[28px] leading-9 text-text-primary">Relés do Hub</h1>
          <Marker>{used} de 4 em uso</Marker>
        </div>
        <p className="text-base leading-6 text-text">Cada saída do Hub liga e desliga um equipamento. Diga o que está ligado em cada uma.</p>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
        <div className="flex flex-col gap-4">
          <section aria-label="Saídas do Hub" className="flex flex-col gap-2.5 rounded-2xl border-[1.5px] border-display bg-surface p-3.5">
            <p className="font-label text-center text-sm leading-4 text-display uppercase">{g.hub.name} · saídas de relé</p>
            <div className="grid grid-cols-4 gap-2">
              {POSITIONS.map(n => {
                const r = byN.get(n);
                const free = !r?.equip_kind;
                return (
                  <a key={n} href={`#rele-${n}`} className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg ${free ? "border border-dashed border-input-border bg-surface text-display" : "bg-display text-surface"}`}>
                    <span className="text-2xl leading-7 font-black">{n}</span>
                    <span className="font-label text-xs leading-4 uppercase">{free ? "Livre" : KIND_SHORT[r!.equip_kind!]}</span>
                    <span aria-hidden className={`size-2 rounded-full ${r?.state === 1 && online ? "bg-[#3b9965]" : "bg-stroke-soft"}`} />
                  </a>
                );
              })}
            </div>
            <p className="text-center text-sm leading-5 text-text-secondary">Numeração igual à marcada no Hub, ao lado de cada saída.</p>
          </section>
          {!online && (
            <section className="flex flex-col gap-2 rounded-2xl border border-stroke bg-surface p-3.5" aria-label="Hub offline">
              <div className="flex items-center gap-2.5"><Lamp state="attention" /><h2 className="font-label flex-1 text-lg leading-6 text-display uppercase">Relés do Hub</h2><Marker tone="out">Hub offline</Marker></div>
              <p className="text-[15px] leading-[21px] text-text">Dá para mudar o que está em cada posição; as chaves ficam bloqueadas até o Hub voltar.</p>
            </section>
          )}
          {g.relays.data && !g.relays.data.synced && online && <p className="text-sm leading-5 text-text-secondary">Enviando a configuração nova ao Hub…</p>}
          {g.relays.data?.sync_error && <p role="alert" className="text-sm leading-5 text-state-error">O Hub recusou a configuração nova. Tente de novo.</p>}
          {warnings.map(w => <p key={`${w.code}-${w.n ?? ""}`} className="rounded-lg bg-source-secondary px-3 py-2 text-sm leading-5 text-display">{w.n ? `Posição ${w.n}: ` : ""}{w.text}</p>)}
          <section className="flex flex-col gap-1 rounded-lg border border-display bg-surface p-3" aria-label="Regra">
            <p className="font-label text-sm leading-4 text-display uppercase">Só aparecem equipamentos deste ambiente</p>
            <p className="text-[15px] leading-[21px] text-text">Luz, exaustor e ventiladores cadastrados em Equipamentos. Cada equipamento fica em uma posição só.</p>
          </section>
          <FormError message={error} />
        </div>

        <div className="flex flex-col gap-3">
          {POSITIONS.map(n => {
            const r = byN.get(n);
            if (!r?.equip_kind) return (
              <section key={n} id={`rele-${n}`} aria-label={`Posição ${n}, livre`} className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-dashed border-input-border bg-surface p-3.5">
                <div className="flex items-center gap-3"><PositionBadge n={n} free /><span className="flex flex-col"><span className="font-label text-lg leading-6 text-text-secondary">Livre</span><span className="text-sm leading-5 text-text-secondary">Nada ligado nesta saída.</span></span></div>
                {g.options.length ? <div className="flex"><PanelButton kind="clear" label="Atribuir equipamento" onClick={() => setAssigning(n)} /></div>
                  : <>
                    <p className="text-[15px] leading-[21px] text-text">{grow.name} ainda não tem luz, exaustor nem ventilador cadastrados. Cadastre o equipamento e volte para escolher a posição.</p>
                    <div className="flex"><PanelButton label="Cadastrar equipamento" href={routes.growEquipment(id)} /></div>
                  </>}
              </section>
            );
            const kind = r.equip_kind;
            return (
              <section key={n} id={`rele-${n}`} aria-label={`Posição ${n}: ${titleOf(r)}`} className="flex scroll-mt-4 flex-col gap-2 rounded-2xl border border-stroke bg-surface p-3.5">
                <div className="flex flex-wrap items-start gap-3">
                  <PositionBadge n={n} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2"><img src={`/figma/${KIND_ICON[kind]}.svg`} alt="" className="size-5" /><span className="font-label truncate text-lg leading-6 text-display">{titleOf(r)}</span></span>
                    <span className="flex flex-wrap gap-x-4 font-label text-xs leading-4 text-display uppercase"><span>{KIND_LABEL[kind]}</span><span>Modo: {MODE_LABEL[shownMode(r)]}</span></span>
                  </div>
                  <div className="w-[150px]">
                    <RelayControl hubId={g.hub!.id} relay={r} online={online} subject={SUBJECT[kind]} nextOn={kind === "light" ? facts.nextOn : null} />
                  </div>
                </div>
                <button type="button" onClick={() => setAssigning(n)} className="font-label self-end text-[13px] leading-4 text-display uppercase hover:underline cursor-pointer min-h-8">Trocar ›</button>
              </section>
            );
          })}
        </div>
      </div>

      {assigning != null && (
        <AssignPanel key={assigning} n={assigning} growName={grow.name} current={byN.get(assigning) ?? null} options={g.options} busy={save.isPending}
          equipmentHref={routes.growEquipment(id)}
          onClose={() => setAssigning(null)}
          onSave={async (opt, move) => {
            setError("");
            // Sem "desligar" antes: ao mudar o vínculo, o Hub desliga a saída sozinho (rebind). A luz segue o fotoperíodo
            // do ambiente quando ele está completo; nos outros, o modo não vai (campo ausente não muda nada).
            const body = opt
              ? { equip_kind: opt.kind, equip_key: opt.key, ...(opt.kind === "light" && facts.until && { mode: "schedule" as const }), ...(move && { move: true }) }
              : { equip_kind: null, equip_key: null };
            try {
              await save.mutateAsync({ n: assigning, body });
              setAssigning(null);
              return "ok";
            } catch (e) {
              const detail = e instanceof ApiError ? (e.response.data as { detail?: string } | null)?.detail : undefined;
              if (e instanceof ApiError && e.response.status === 409 && detail === "equipment_in_use") return "in_use";
              setAssigning(null);
              setError(relaySaveErrorText(detail));
              return "error";
            }
          }} />
      )}
    </div>
  );
}

/**
 * SN9a "O que está ligado aqui?", SN9b mover de posição, SN10b liberar. Os equipamentos já em outra posição aparecem
 * apagados com "na posição N"; escolher um deles pergunta se é para mover.
 */
function AssignPanel({ n, growName, current, options, busy, equipmentHref, onClose, onSave }: {
  n: number; growName: string; current: RelayState | null; options: EquipOption[]; busy: boolean; equipmentHref: string;
  onClose: () => void; onSave: (opt: EquipOption | null, move?: boolean) => Promise<"ok" | "in_use" | "error">;
}) {
  const currentOpt = current?.equip_kind ? options.find(o => o.kind === current.equip_kind && o.key === current.equip_key) ?? null : null;
  const [picked, setPicked] = useState<EquipOption | null>(currentOpt);
  const [ask, setAsk] = useState<"move" | "release" | null>(null);
  const confirmPick = async () => {
    if (!picked || picked === currentOpt) return onClose();
    if ((picked.at && picked.at !== n) || picked.otherHub) return setAsk("move");
    // O servidor também confere: se o equipamento já estiver em outra posição, ele responde 409 e o app pergunta.
    if (await onSave(picked) === "in_use") setAsk("move");
  };
  const subject = currentOpt ? SUBJECT[currentOpt.kind] : "o equipamento";
  const on = current?.state === 1;

  return (
    <SidePanel open onClose={onClose} title={`Posição ${n} · o que está ligado aqui?`} subtitle={`Escolha um equipamento cadastrado em ${growName}.`}>
      <div role="radiogroup" aria-label="Equipamento" className="flex flex-col gap-2">
        {options.map(o => {
          const sel = picked?.key === o.key && picked.kind === o.kind;
          const elsewhere = o.otherHub || (o.at != null && o.at !== n);
          return (
            <button key={`${o.kind}-${o.key}`} type="button" role="radio" aria-checked={sel} onClick={() => setPicked(o)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left cursor-pointer ${sel ? "border-[1.5px] border-display bg-surface" : elsewhere ? "border-stroke bg-bg" : "border-stroke bg-surface hover:border-input-border"}`}>
              <img src={`/figma/${KIND_ICON[o.kind]}.svg`} alt="" className={`size-6 ${elsewhere && !sel ? "opacity-50" : ""}`} />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`text-base leading-[22px] font-semibold ${elsewhere && !sel ? "text-text-secondary" : "text-text-primary"}`}>{o.title}</span>
                <span className="flex gap-1.5"><Marker>{KIND_LABEL[o.kind]}</Marker><Marker>{o.otherHub ? "Em outro Hub" : o.at == null ? "Livre" : o.at === n ? "Nesta posição" : `Na posição ${o.at}`}</Marker></span>
              </span>
              <span aria-hidden className={`flex size-6 items-center justify-center rounded-full border-[1.5px] ${sel ? "border-display" : "border-stroke-soft"}`}>{sel && <span className="size-3 rounded-full bg-display" />}</span>
            </button>
          );
        })}
      </div>
      <p className="text-sm leading-5 text-text-secondary">Já está em outra posição? Escolha mesmo assim: o app pergunta se é para mover.</p>
      <Link href={equipmentHref} className="font-label flex min-h-12 items-center justify-center rounded-lg border border-dashed border-input-border text-[17px] text-text-primary uppercase hover:bg-surface-high">+ Cadastrar outro equipamento</Link>
      <div className="flex gap-2.5">
        <PanelButton kind="clear" label="Cancelar" onClick={onClose} />
        <PanelButton label={busy ? "Salvando…" : "Atribuir"} onClick={busy ? undefined : () => void confirmPick()} />
      </div>
      {currentOpt && <button type="button" onClick={() => setAsk("release")} className="min-h-11 text-sm font-semibold text-state-error hover:underline cursor-pointer">Liberar a posição {n}</button>}

      <ConfirmDialog open={ask === "move"} busy={busy} confirm="Mover"
        title={picked ? `Mover ${SUBJECT[picked.kind]} para a posição ${n}?` : ""}
        message={picked ? `${picked.title} sai ${picked.at ? `da posição ${picked.at}` : "da posição em que está"}, que fica livre. Confira se o cabo dele está na saída ${n} do Hub antes de confirmar.` : ""}
        onCancel={() => setAsk(null)} onConfirm={() => { setAsk(null); void onSave(picked, true); }} />
      <ConfirmDialog open={ask === "release"} busy={busy} destructive={on} confirm={on ? "Desligar e liberar" : "Liberar"}
        title={`Liberar a posição ${n}?`}
        message={on ? `${subject.charAt(0).toUpperCase()}${subject.slice(1)} está ${subject === "a luz" ? "ligada" : "ligado"} por esta saída. Ao liberar, o app desliga a posição ${n} e deixa de controlar ${subject}.` : `O app deixa de controlar ${subject} por esta saída.`}
        onCancel={() => setAsk(null)} onConfirm={() => { setAsk(null); void onSave(null); }} />
    </SidePanel>
  );
}
