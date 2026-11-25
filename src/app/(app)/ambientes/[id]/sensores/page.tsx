"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Lamp, Marker, PanelButton, PanelLabel } from "@/components/panel";
import { scheduleFacts } from "@/components/relays/grow-relays";
import { HubCard, SensorCard } from "@/components/sensors/cards";
import { SidePanel } from "@/components/side-panel";
import { BackLink, Button, ChoiceField, ConfirmDialog, FormError, Notice, Spinner, TextField } from "@/components/ui";
import { useGrow, useMinuteOfDay, usePlants } from "@/lib/hooks";
import { useHubRelays } from "@/lib/relay-client";
import { routes } from "@/lib/routes";
import { ago } from "@/lib/sensor-cards";
import { useSensorScreen } from "@/lib/sensor-screen";
import { useDeleteDevice, useGrowDevices, useNow, useOpenHubPairing, useUpdateDevice } from "@/lib/sensors";
import { getErrorMessage } from "@/shared/lib/errors";
import { growHub, newPendingDevice, pairingErrorCopy, secondsLeft } from "@/shared/lib/hubProvisioning";
import { plantDisplayName } from "@/shared/lib/plantIdentity";
import type { DeviceResponse } from "@/shared/types/api";

const MODULE: Record<DeviceResponse["module_type"], string> = { hub: "Hub", satellite: "Satélite", standalone: "Sensor" };

/**
 * Sensores do ambiente (Figma 28 · W10p, SN1–SN3): o cartão do Hub e um cartão por medida, com a leitura, a faixa, as
 * barras de 24 h e há quanto tempo chegou. Atualiza sozinho. Hub e satélites entram só por "Adicionar Hub" e "Adicionar
 * satélite"; "Gerenciar sensores" pareia os novos e remove. Nenhum texto fala em placa, MAC ou Serial Monitor.
 */
export default function SensorsPage() {
  const { id } = useParams<{ id: string }>();
  const grow = useGrow(id).data;
  const plants = (usePlants({ is_active: true }).data ?? []).filter(p => p.grow_id === id);
  const plantIds = new Set(plants.map(p => p.id));
  const minute = useMinuteOfDay();
  const light = scheduleFacts(grow, minute);
  const plantName = (pid: string) => { const p = plants.find(x => x.id === pid); return p ? plantDisplayName(p) : null; };
  const data = useSensorScreen(id, { growName: grow?.name ?? "Ambiente", plantName, lightOn: light.lit, inGrow: d => d.grow_id === id || (d.plant_id != null && plantIds.has(d.plant_id)) });
  const all = data.all;
  const paired = all.filter(d => d.is_paired || d.module_type !== "satellite");
  const pending = all.filter(d => !d.is_paired && d.module_type === "satellite");
  const screen = data.screen;
  const hub = screen?.hub ?? null;
  const relays = useHubRelays(hub?.id ?? null);
  const [manage, setManage] = useState(false);
  const [pairing, setPairing] = useState<DeviceResponse | null>(null);
  const [removing, setRemoving] = useState<DeviceResponse | null>(null);
  const remove = useDeleteDevice();
  const [error, setError] = useState("");
  const now = useNow();
  const plantOptions = plants.map(p => ({ value: p.id, label: plantDisplayName(p) }));

  const hubCard = hub && (
    <HubCard hub={hub} now={now}>
      <div className="flex flex-col gap-2.5">
        <PanelButton kind="clear" label={pending.length ? `Gerenciar sensores · ${pending.length} novo${pending.length > 1 ? "s" : ""}` : "Gerenciar sensores"} onClick={() => setManage(true)} />
        {relays.available && <PanelButton kind="clear" label="Relés do Hub" href={routes.growRelays(id)} />}
      </div>
    </HubCard>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <BackLink fallback={routes.growPanel(id) ?? routes.grows()} />
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-label min-w-0 flex-1 text-[28px] leading-9 text-text-primary">Sensores</h1>
          {!!screen?.cards.length && <Marker>Atualiza sozinho</Marker>}
        </div>
        <p className="text-base leading-6 text-text">{grow ? `Leituras automáticas do Hub e dos satélites de ${grow.name}.` : "Leituras automáticas do Hub e dos satélites deste ambiente."}</p>
      </div>
      {data.pending ? <Spinner /> : data.error || !screen ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={data.refetch} /> : !hub && !screen.cards.length ? (
        <div className="flex max-w-[600px] flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl border border-stroke bg-surface p-3.5" aria-label="Sensores">
            <div className="flex items-center gap-2.5"><Lamp state="none" /><h2 className="font-label flex-1 text-lg leading-6 text-display uppercase">Sensores</h2><Marker>Sem Hub</Marker></div>
            <p className="text-[15px] leading-[21px] text-text">Com um Hub, a temperatura, a umidade, a luz, o solo e a solução chegam sozinhos, sem você anotar.</p>
            <SatelliteSearch growId={id} devices={all} />
            <p className="text-sm leading-5 text-text-secondary">Leva uns 3 minutos pelo Bluetooth. Enquanto isso, as leituras manuais continuam valendo.</p>
          </section>
          {!!pending.length && <PendingList pending={pending} onPair={setPairing} />}
        </div>
      ) : (
        <div className="gap-5 md:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {hubCard}
          {screen.cards.map(c => <SensorCard key={c.id} card={c} now={now} lightOn={screen.lightOn ?? light.lit} lightWindow={light.window} />)}
          {!!pending.length && <PendingList pending={pending} onPair={setPairing} />}
          <div><SatelliteSearch growId={id} devices={all} /></div>
          <FormError message={error} />
        </div>
      )}

      <SidePanel open={manage} onClose={() => setManage(false)} title="Gerenciar sensores" subtitle={grow?.name}>
        {!!pending.length && <PendingList pending={pending} onPair={d => { setManage(false); setPairing(d); }} />}
        <PanelLabel>Conectados · {paired.length}</PanelLabel>
        {paired.map(d => (
          <div key={d.id} className="flex items-center gap-3 rounded-xl border border-stroke bg-surface p-3">
            <Lamp state={d.is_online ? "ok" : "none"} />
            <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-base font-semibold text-text">{d.name}</span>
              <span className="text-xs text-text-secondary">{[MODULE[d.module_type], d.plant_id ? plantName(d.plant_id) : null, d.is_online ? "online" : `sem sinal${d.last_seen_at ? ` ${ago(d.last_seen_at, now)}` : ""}`].filter(Boolean).join(" · ")}</span></span>
            <button type="button" onClick={() => { setError(""); setManage(false); setRemoving(d); }} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-state-error hover:bg-bg cursor-pointer">Remover</button>
          </div>
        ))}
      </SidePanel>

      {/* Montado só ao abrir: a planta sugerida é a primeira já carregada. */}
      {pairing && <PairPanel key={pairing.id} device={pairing} plants={plantOptions} onClose={() => setPairing(null)} />}
      <ConfirmDialog open={!!removing} title="Remover este sensor?" confirm="Remover" destructive busy={remove.isPending}
        message={`"${removing?.name ?? ""}" deixa de aparecer neste ambiente. Para voltar, adicione ${removing?.module_type === "hub" ? "o Hub" : "o sensor"} de novo.`}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null), onError: e => { setRemoving(null); setError(getErrorMessage(e, "Não foi possível remover agora.")); } })} />
    </div>
  );
}

/** Satélites que o Hub achou e ainda esperam nome e planta. */
function PendingList({ pending, onPair }: { pending: DeviceResponse[]; onPair: (d: DeviceResponse) => void }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-stroke bg-surface p-3.5" aria-label="Novos sensores detectados">
      <div className="flex items-center gap-2.5"><h2 className="font-label flex-1 text-lg leading-6 text-display uppercase">Novos sensores</h2><Marker tone="light">{pending.length} achado{pending.length > 1 ? "s" : ""}</Marker></div>
      {pending.map(d => (
        <div key={d.id} className="flex items-center gap-3">
          <span className="flex flex-1 flex-col"><span className="text-base font-semibold text-text">{d.name || "Satélite novo"}</span><span className="text-xs text-text-secondary">{d.last_seen_at ? `achado ${ago(d.last_seen_at)}` : "achado agora"}</span></span>
          <button type="button" onClick={() => onPair(d)} className="font-label min-h-10 rounded-lg bg-primary px-3 text-sm text-surface uppercase cursor-pointer hover:bg-primary-dark">Parear</button>
        </div>
      ))}
    </section>
  );
}

/**
 * Figma 27 · S1/S2: "Adicionar satélite" abre a janela de pareamento do Hub por 60 s e espera o satélite aparecer
 * entre os pendentes; sem Hub no ambiente, vira "Adicionar Hub". `?satelite=1` (vindo do "Hub conectado") já abre a busca.
 */
function SatelliteSearch({ growId, devices }: { growId: string; devices: DeviceResponse[] }) {
  const open = useOpenHubPairing();
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [result, setResult] = useState<"found" | "timeout" | "error" | null>(null);
  const [errorText, setErrorText] = useState("");
  const [before, setBefore] = useState<ReadonlySet<string>>(() => new Set());
  const searching = until !== null;
  // Enquanto o Hub procura, a lista do ambiente atualiza a cada 3 s (mesma query da página).
  const live = useGrowDevices(growId, searching ? 3000 : 15_000);
  const list = live.data ?? devices;
  const hub = growHub(list);
  const remaining = until ? secondsLeft(until, now) : 0;
  const addHub = routes.growAddHub(growId);

  useEffect(() => {
    if (!searching) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [searching]);

  useEffect(() => {
    if (!searching) return;
    const found = newPendingDevice(list, before);
    if (found || remaining === 0) {
      // Resultado da busca que terminou agora; o intervalo acima para quando `until` volta a null.
      queueMicrotask(() => { setUntil(null); setResult(found ? "found" : "timeout"); });
    }
  }, [searching, list, before, remaining]);

  const start = useCallback(() => {
    if (!hub) return;
    setResult(null);
    setBefore(new Set(list.filter(d => !d.is_paired).map(d => d.id)));
    open.mutate({ hubId: hub.id }, {
      onSuccess: r => {
        const at = Date.parse(r.expires_at);
        const local = Date.now() + r.ttl_s * 1000;
        setNow(Date.now());
        // Relógio do computador pode divergir do servidor: o ttl é a referência.
        setUntil(Number.isFinite(at) && Math.abs(at - local) < 30_000 ? at : local);
      },
      onError: e => { setErrorText(pairingErrorCopy((e as { response?: { status?: number } })?.response?.status)); setResult("error"); },
    });
  }, [hub, list, open]);

  // Vindo do H6 ("Adicionar satélite"): abre a busca uma vez, quando o Hub já está online.
  const auto = useRef<boolean | null>(null);
  useEffect(() => {
    auto.current ??= new URLSearchParams(window.location.search).get("satelite") === "1";
    if (auto.current && hub?.is_online) { auto.current = false; start(); }
  }, [hub, start]);

  if (!hub) return addHub ? (
    <section className="flex flex-col gap-2" aria-label="Adicionar Hub">
      <PanelButton label="Adicionar Hub" href={addHub} />
      <p className="text-sm leading-5 text-text">O Hub é a central dos sensores. Depois dele, os satélites são adicionados por aqui.</p>
    </section>
  ) : null;

  return (
    <section className="flex flex-col gap-2" aria-label="Adicionar satélite" aria-live="polite">
      {searching ? <>
        <Marker tone="light">Hub procurando satélites</Marker>
        <p className="text-sm leading-5 text-text">Ligue o satélite na tomada a até 10 metros do Hub. Quando o Hub achar, ele aparece aqui para você dar um nome e escolher a planta.</p>
        <PanelLabel>Tempo restante · segundos</PanelLabel>
        <span className="inline-flex gap-1 self-start rounded-[12px] border border-display p-1" role="timer" aria-label={`${remaining} segundos restantes`}>
          {String(remaining).padStart(2, "0").split("").map((d, i) => <span key={i} aria-hidden className="flex h-[50px] w-11 items-center justify-center rounded-lg bg-display text-[30px] font-black text-surface">{d}</span>)}
        </span>
        <PanelButton kind="clear" label="Parar de procurar" onClick={() => setUntil(null)} />
      </> : <>
        <Button label={open.isPending ? "Abrindo busca…" : "Adicionar satélite"} onClick={start} disabled={!hub.is_online} loading={open.isPending} />
        <p className="text-sm leading-5 text-text">{hub.is_online ? "O Hub procura satélites ligados perto dele por 60 segundos." : "Ligue o Hub para adicionar satélites."}</p>
        {result === "found" && <><Marker tone="live">Satélite encontrado</Marker><p className="text-sm leading-5 text-text">Toque em &quot;Parear&quot; em Novos sensores detectados para dar um nome e escolher a planta.</p></>}
        {result === "timeout" && <><Marker tone="out">Nenhum satélite em 60 s</Marker><p className="text-sm leading-5 text-text">Confira se o satélite está ligado e perto do Hub e procure de novo.</p></>}
        {result === "error" && <><Marker tone="out">Não deu para falar com o Hub</Marker><p className="text-sm leading-5 text-text">{errorText}</p></>}
      </>}
    </section>
  );
}

function PairPanel({ device, plants, onClose }: { device: DeviceResponse; plants: { value: string; label: string }[]; onClose: () => void }) {
  const save = useUpdateDevice();
  const [name, setName] = useState(device.name ?? "");
  const [plant, setPlant] = useState(plants[0]?.value ?? "");
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Dê um nome ao sensor.");
    if (!plant) return setError("Escolha a planta que este sensor acompanha.");
    save.mutate({ id: device.id, body: { name: name.trim(), plant_id: plant } }, { onSuccess: onClose, onError: err => setError(getErrorMessage(err, "Não foi possível parear.")) });
  }
  return (
    <SidePanel open onClose={onClose} title="Parear sensor" subtitle={`${device.name || "Satélite novo"} achado pelo Hub.`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Nome do sensor" placeholder="Sensor do vaso 1" value={name} onChange={e => setName(e.target.value)} data-autofocus />
        {plants.length ? <ChoiceField label="Planta" value={plant} onChange={setPlant} options={plants} />
          : <Notice white title="Nenhuma planta neste ambiente" body="Um satélite é pareado com uma planta. Cadastre uma planta no ambiente e volte aqui." />}
        <FormError message={error} />
        <Button type="submit" label={save.isPending ? "Pareando…" : "Parear"} loading={save.isPending} disabled={!plants.length} />
      </form>
    </SidePanel>
  );
}
