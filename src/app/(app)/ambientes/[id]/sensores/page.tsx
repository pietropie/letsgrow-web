"use client";

import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SidePanel } from "@/components/side-panel";
import { BackLink, Button, ButtonLink, ChoiceField, ConfirmDialog, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextField } from "@/components/ui";
import { useGrow, usePlants } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { useDeleteDevice, useGrowDevices, useLatestReading, useRegisterDevice, useSensorSummary, useUpdateDevice } from "@/lib/sensors";
import { getErrorMessage } from "@/shared/lib/errors";
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
const mac = (m: string) => m.replace(/[^A-Fa-f0-9]/g, "").toUpperCase().match(/.{1,2}/g)?.join(":") ?? m;

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
 * Sensores do ambiente (mobile grows/[id]/sensors.tsx e PairingModal; sem frame no Figma): leituras automáticas do ESP32,
 * médias de 24 h, satélites novos detectados pelo hub para parear com uma planta, registro manual de um ESP32 e remover.
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
  const [register, setRegister] = useState(false);
  const [pairing, setPairing] = useState<DeviceResponse | null>(null);
  const [removing, setRemoving] = useState<DeviceResponse | null>(null);
  const [error, setError] = useState("");
  const reading = latest.data;
  const plantOptions = plants.map(p => ({ value: p.id, label: plantDisplayName(p) }));

  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.growEquipment(id)} />
      <PageTitle>Sensores do ambiente</PageTitle>
      <PageSubtitle>{grow ? `${grow.name} · leituras automáticas enviadas pelo ESP32` : "Leituras automáticas enviadas pelo ESP32."}</PageSubtitle>
      {devices.isPending ? <Spinner /> : devices.isError ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void devices.refetch()} /> : <>
        {!!pending.length && (
          <section className="flex flex-col gap-2 rounded-xl border border-warning bg-surface p-4" aria-label="Novos sensores detectados">
            <h2 className="font-label text-base text-display">NOVOS SENSORES DETECTADOS · {pending.length}</h2>
            {pending.map(d => (
              <div key={d.id} className="flex items-center gap-3">
                <span className="flex flex-1 flex-col"><span className="text-base font-semibold text-text">{d.name || "Satélite"}</span><span className="font-mono text-xs text-text-muted">{mac(d.esp32_mac)} · {age(d.last_seen_at)}</span></span>
                <button type="button" onClick={() => setPairing(d)} className="min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-white cursor-pointer">Parear</button>
              </div>
            ))}
          </section>
        )}
        {!paired.length ? <>
          <Notice title="Nenhum sensor conectado" body="Registre seu ESP32 para acompanhar temperatura, umidade, CO₂, pH e mais. Sensores são opcionais." />
          <Button label="Registrar ESP32" onClick={() => setRegister(true)} />
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
            <span className="font-mono text-xs text-text-muted">{mac(active.esp32_mac)}</span><span className="text-xs text-text-faint">{age(reading?.recorded_at ?? active.last_seen_at)}</span>
          </p>}
          {!!summary.data?.alerts.length && <Notice white title="Atenção">{summary.data.alerts.map(a => <p key={a} className="text-sm leading-5">• {a}</p>)}</Notice>}
          {latest.isPending ? <Spinner label="Buscando leituras…" />
            : !reading ? <Notice white title="Aguardando leitura" body="O ESP32 ainda não enviou dados. Verifique se está ligado e conectado ao Wi-Fi." />
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
          <Button secondary label="Registrar outro ESP32" onClick={() => setRegister(true)} />
        </>}
      </>}
      <ButtonLink secondary label="Voltar aos equipamentos" href={routes.growEquipment(id)} />

      {/* Montado só ao abrir: a planta sugerida é a primeira já carregada. */}
      {register && <RegisterPanel onClose={() => setRegister(false)} growId={id} plants={plantOptions} />}
      {pairing && <PairPanel key={pairing.id} device={pairing} plants={plantOptions} onClose={() => setPairing(null)} />}
      <ConfirmDialog open={!!removing} title="Remover este sensor?" confirm="Remover" destructive busy={remove.isPending}
        message={`"${removing?.name ?? ""}" deixa de aparecer neste ambiente. Para voltar, registre o ESP32 de novo.`}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.id, { onSuccess: () => setRemoving(null), onError: e => { setRemoving(null); setError(getErrorMessage(e, "Não foi possível remover agora.")); } })} />
    </div>
  );
}

const NO_PLANT = "";

function RegisterPanel({ onClose, growId, plants }: { onClose: () => void; growId: string; plants: { value: string; label: string }[] }) {
  const save = useRegisterDevice();
  const [name, setName] = useState("");
  const [esp, setEsp] = useState("");
  const [plant, setPlant] = useState(plants[0]?.value ?? NO_PLANT);
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    const clean = esp.replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
    if (!name.trim()) return setError("Dê um nome ao dispositivo.");
    if (clean.length !== 12) return setError("O MAC tem 12 caracteres (0–9 e A–F), por exemplo AABBCCDDEEFF.");
    setError("");
    save.mutate({ grow_id: growId, plant_id: plant || undefined, name: name.trim(), esp32_mac: clean }, {
      onSuccess: () => { setName(""); setEsp(""); onClose(); },
      onError: err => setError(getErrorMessage(err, "Não foi possível registrar.")),
    });
  }
  return (
    <SidePanel open onClose={onClose} title="Registrar ESP32" subtitle="O MAC está impresso no ESP32 ou aparece no Serial Monitor ao ligar o dispositivo.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField label="Nome do dispositivo" placeholder="Sensor do ambiente" value={name} onChange={e => setName(e.target.value)} data-autofocus />
        <TextField label="MAC do ESP32" placeholder="AABBCCDDEEFF" value={esp} onChange={e => setEsp(e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
        {!!plants.length && <ChoiceField label="Vincular à planta" hint="Opcional." value={plant} onChange={setPlant} options={[...plants, { value: NO_PLANT, label: "Sem planta" }]} />}
        <FormError message={error} />
        <Button type="submit" label={save.isPending ? "Registrando…" : "Registrar"} loading={save.isPending} />
      </form>
    </SidePanel>
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
    <SidePanel open onClose={onClose} title="Parear sensor" subtitle={`Satélite ${mac(device.esp32_mac)} detectado pelo hub.`}>
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
