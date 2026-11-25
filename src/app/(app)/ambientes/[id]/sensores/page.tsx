"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Marker, PanelButton, PanelLabel } from "@/components/panel";
import { SidePanel } from "@/components/side-panel";
import { BackLink, Button, ButtonLink, ChoiceField, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextField } from "@/components/ui";
import { useGrow, usePlants } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { useDeleteDevice, useGrowDevices, useLatestReading, useOpenHubPairing, useSensorSummary, useUpdateDevice } from "@/lib/sensors";
import { getErrorMessage } from "@/shared/lib/errors";
import { growHub, newPendingDevice, pairingErrorCopy, secondsLeft } from "@/shared/lib/hubProvisioning";
import { plantDisplayName } from "@/shared/lib/plantIdentity";
import type { DeviceResponse, SensorReadingResponse } from "@/shared/types/api";

/** Faixas e casas decimais das leituras, as mesmas do mobile (grows/[id]/sensors.tsx). */
const METRICS: { key: keyof SensorReadingResponse; label: string; unit: string; min: number; max: number; decimals: number }[] = [
  { key: "temp_air", label: "Temperatura", unit: "°C", min: 20, max: 28, decimals: 1 },
  { key: "humidity_air", label: "Umidade", unit: "%", min: 40, max: 70, decimals: 0 },
  { key: "vpd_kpa", label: "VPD", unit: "kPa", min: 0.8, max: 1.6, decimals: 2 },
  { key: "co2_ppm", label: "CO₂", unit: "ppm", min: 400, max: 1500, decimals: 0 },
  { key: "ph_solution", label: "pH", unit: "", min: 5.8, max: 6.5, decimals: 1 },
  { key: "soil_moisture_pct", label: "Solo", unit: "%", min: 30, max: 70, decimals: 0 },
  { key: "temp_root", label: "Temp. raiz", unit: "°C", min: 18, max: 24, decimals: 1 },
  { key: "lux", label: "Luminosidade", unit: "lux", min: 0, max: 65535, decimals: 0 },
  { key: "ec_ms_cm", label: "EC", unit: "mS", min: 0.5, max: 3.0, decimals: 2 },
];
const MODULE: Record<DeviceResponse["module_type"], string> = { hub: "Hub central", satellite: "Satélite", standalone: "Standalone" };
const TONE = { ok: "var(--color-primary)", warn: "var(--color-warning)", danger: "var(--color-error)" };

function status(value: number, min: number, max: number): keyof typeof TONE {
  const margin = (max - min) * 0.15;
  if (value < min - margin || value > max + margin) return "danger";
  return value < min || value > max ? "warn" : "ok";
}
function age(iso: string | null) {
  if (!iso) return "sem sinal ainda";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  return s < 60 ? `${Math.round(s)} s atrás` : s < 3600 ? `${Math.round(s / 60)} min atrás` : s < 86400 ? `${Math.round(s / 3600)} h atrás` : `${Math.round(s / 86400)} d atrás`;
}

function Metric({ m, value }: { m: (typeof METRICS)[number]; value: number | null | undefined }) {
  if (value == null) return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 opacity-50"><span className="text-xl font-bold text-text-faint">—</span><span className="text-sm text-text-muted">{m.label}</span></div>
  );
  const tone = TONE[status(value, m.min, m.max)];
  const fill = Math.min(100, Math.max(0, ((value - m.min) / (m.max - m.min)) * 100));
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-surface p-3" style={{ borderColor: tone }}>
      <span className="text-[22px] leading-7 font-bold" style={{ color: tone }}>{value.toFixed(m.decimals)}<span className="text-sm font-normal text-text-muted"> {m.unit}</span></span>
      <span className="text-sm text-text-muted">{m.label}</span>
      <span className="h-[3px] overflow-hidden rounded bg-border"><span className="block h-full" style={{ width: `${fill}%`, background: tone }} /></span>
    </div>
  );
}

/**
 * Sensores do ambiente (mobile grows/[id]/sensors.tsx e PairingModal; sem frame no Figma): leituras automáticas enviadas pelo Hub,
 * médias de 24 h, satélites novos achados pelo Hub para parear com uma planta, e remover. Não há registro manual: Hub e
 * satélites entram só pelo "Adicionar Hub" e "Adicionar satélite". A tela não mostra MAC nem fala em ESP32.
 */
export default function SensorsPage() {
  const { id } = useParams<{ id: string }>();
  const grow = useGrow(id).data;
  const devices = useGrowDevices(id);
  const plants = (usePlants({ is_active: true }).data ?? []).filter(p => p.grow_id === id);
  const plantIds = new Set(plants.map(p => p.id));
  const all = (devices.data ?? []).filter(d => d.grow_id === id || (d.plant_id != null && plantIds.has(d.plant_id)));
  const paired = all.filter(d => d.is_paired || d.module_type !== "satellite");
  const pending = all.filter(d => !d.is_paired && d.module_type === "satellite");
  const [selected, setSelected] = useState<string | null>(null);
  const active = paired.find(d => d.id === selected) ?? paired[0] ?? null;
  const latest = useLatestReading(active?.id ?? null);
  const summary = useSensorSummary(active?.id ?? null);
  const remove = useDeleteDevice();
  const [pairing, setPairing] = useState<DeviceResponse | null>(null);
  const [removing, setRemoving] = useState<DeviceResponse | null>(null);
  const [error, setError] = useState("");
  const reading = latest.data;
  const plantOptions = plants.map(p => ({ value: p.id, label: plantDisplayName(p) }));

  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.growEquipment(id)} />
      <PageTitle>Sensores do ambiente</PageTitle>
      <PageSubtitle>{grow ? `${grow.name} · leituras automáticas enviadas pelo Hub` : "Leituras automáticas enviadas pelo Hub."}</PageSubtitle>
      {devices.isPending ? <Spinner /> : devices.isError ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void devices.refetch()} /> : <>
        <SatelliteSearch growId={id} devices={all} />
        {!!pending.length && (
          <section className="flex flex-col gap-2 rounded-xl border border-warning bg-surface p-4" aria-label="Novos sensores detectados">
            <h2 className="font-label text-base text-display">NOVOS SENSORES DETECTADOS · {pending.length}</h2>
            {pending.map(d => (
              <div key={d.id} className="flex items-center gap-3">
                <span className="flex flex-1 flex-col"><span className="text-base font-semibold text-text">{d.name || "Satélite novo"}</span><span className="text-xs text-text-muted">{d.last_seen_at ? `achado ${age(d.last_seen_at)}` : "achado agora"}</span></span>
                <button type="button" onClick={() => setPairing(d)} className="min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-white cursor-pointer">Parear</button>
              </div>
            ))}
          </section>
        )}
        {!paired.length ? <>
          <Notice title="Nenhum sensor conectado" body="Adicione o Hub para acompanhar temperatura, umidade, CO₂, pH e mais. Sensores são opcionais." />
        </> : <>
          {paired.length > 1 && (
            <div role="radiogroup" aria-label="Dispositivo" className="flex flex-wrap gap-2">
              {paired.map(d => (
                <button key={d.id} type="button" role="radio" aria-checked={d.id === active?.id} onClick={() => setSelected(d.id)}
                  className={`flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold cursor-pointer ${d.id === active?.id ? "border-primary bg-surface-bobby text-primary" : "border-border bg-surface text-text-muted"}`}>
                  <span className={`h-2 w-2 rounded-full ${d.is_online ? "bg-primary" : "bg-text-faint"}`} />{d.name}
                </button>
              ))}
            </div>
          )}
          {active && <p className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${active.is_online ? "bg-primary" : "bg-text-faint"}`} /><span className="flex-1 font-semibold">{active.name}</span>
            <span className="text-xs text-text-muted">{MODULE[active.module_type]}</span><span className="text-xs text-text-faint">{age(reading?.recorded_at ?? active.last_seen_at)}</span>
          </p>}
          {!!summary.data?.alerts.length && <Notice white title="Atenção">{summary.data.alerts.map(a => <p key={a} className="text-sm leading-5">• {a}</p>)}</Notice>}
          {latest.isPending ? <Spinner label="Buscando leituras…" />
            : !reading ? <Notice white title="Aguardando leitura" body="O sensor ainda não enviou dados. Confira se o Hub está ligado e conectado ao Wi-Fi." />
            : <>
              <h2 className="font-label text-base text-display">LEITURA ATUAL</h2>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {METRICS.map(m => <Metric key={m.key} m={m} value={reading[m.key] as number | null} />)}
                {reading.light_leak != null && <div className="flex flex-col gap-1 rounded-xl border bg-surface p-3" style={{ borderColor: reading.light_leak ? TONE.danger : TONE.ok }}>
                  <span className="text-base font-bold" style={{ color: reading.light_leak ? TONE.danger : TONE.ok }}>{reading.light_leak ? "Detectado" : "Normal"}</span><span className="text-sm text-text-muted">Vazamento de luz</span>
                </div>}
              </div>
            </>}
          {summary.data && <>
            <h2 className="font-label text-base text-display">MÉDIAS 24H</h2>
            <div className="grid grid-cols-4 gap-2">
              {([["Temp. ar", summary.data.avg_temp_air_24h, "°C", 1], ["Umidade", summary.data.avg_humidity_24h, "%", 0], ["VPD", summary.data.avg_vpd_24h, "kPa", 2], ["CO₂", summary.data.avg_co2_24h, "ppm", 0]] as const).map(([label, v, unit, dec]) => (
                <div key={label} className="flex flex-col items-center rounded-xl border border-border bg-surface p-2 text-center">
                  <span className="text-lg font-bold text-text">{v != null ? v.toFixed(dec) : "—"}</span><span className="text-xs text-text-muted">{unit}</span><span className="text-xs text-text-muted">{label}</span>
                </div>
              ))}
            </div>
          </>}
          <h2 className="font-label text-base text-display">DISPOSITIVOS</h2>
          {paired.map(d => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <span className={`h-2 w-2 shrink-0 rounded-full ${d.is_online ? "bg-primary" : "bg-text-faint"}`} />
              <span className="flex flex-1 flex-col"><span className="text-base font-semibold text-text">{d.name}</span>
                <span className="text-xs text-text-muted">{MODULE[d.module_type]} · {plants.find(p => p.id === d.plant_id) ? plantDisplayName(plants.find(p => p.id === d.plant_id)!) : "sem planta"} · {d.is_online ? "online" : `offline, ${age(d.last_seen_at)}`}</span></span>
              <button type="button" onClick={() => { setError(""); setRemoving(d); }} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-error hover:bg-bg cursor-pointer">Remover</button>
            </div>
          ))}
          <FormError message={error} />
        </>}
      </>}
      <ButtonLink secondary label="Voltar aos equipamentos" href={routes.growEquipment(id)} />

      {/* Montado só ao abrir: a planta sugerida é a primeira já carregada. */}
      {pairing && <PairPanel key={pairing.id} device={pairing} plants={plantOptions} onClose={() => setPairing(null)} />}
      <ConfirmDialog open={!!removing} title="Remover este sensor?" confirm="Remover" destructive busy={remove.isPending}
        message={`"${removing?.name ?? ""}" deixa de aparecer neste ambiente. Para voltar, adicione ${removing?.module_type === "hub" ? "o Hub" : "o sensor"} de novo.`}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null), onError: e => { setRemoving(null); setError(getErrorMessage(e, "Não foi possível remover agora.")); } })} />
    </div>
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
