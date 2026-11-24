"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { EntryButton, EntryField, EntryTitle, ErrorBox } from "@/components/entry";
import { Marker, PanelLabel, SegMeter, type MarkerTone } from "@/components/panel";
import { BackLink, Spinner } from "@/components/ui";
import { useHubProvisioning, type ScanProblem } from "@/lib/hub-provisioning";
import { routes } from "@/lib/routes";
import { useGrowDevices } from "@/lib/sensors";
import {
  ERROR_ACTION_LABEL, HUB_CONFIG_WINDOW_MIN, ONLINE_SLOW_MS, PROGRESS_STEPS, errorCopy, findHub, formatMac, signalBars,
  wifiFormError,
} from "@/shared/lib/hubProvisioning";

/**
 * Adicionar Hub (Figma 27 · Hub por Bluetooth, 2440:24329, H1–H7; o mesmo fluxo do mobile grows/[id]/add-hub.tsx).
 * Na web o Bluetooth é o Web Bluetooth (Chrome e Edge): "Procurar Hub" abre o seletor do navegador em vez da lista.
 */
export default function AddHubPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const flow = useHubProvisioning(id);
  const sensors = routes.growSensors(id) ?? routes.growEquipment(id);
  const backable = flow.step === "scan" || flow.step === "wifi" || flow.step === "password";

  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      {flow.step === "intro" ? <BackLink fallback={sensors} />
        : backable && <button type="button" onClick={flow.back} className="flex min-h-11 items-center gap-2 self-start px-1 py-2 text-sm leading-5 font-semibold text-text cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/figma/chevron-right.svg" alt="" className="rotate-180" />Voltar
        </button>}
      {flow.step === "intro" && <Intro flow={flow} />}
      {flow.step === "scan" && <Scan flow={flow} />}
      {flow.step === "wifi" && <Wifi flow={flow} />}
      {flow.step === "password" && <Password flow={flow} />}
      {flow.step === "progress" && <Progress flow={flow} />}
      {flow.step === "done" && <Done flow={flow} growId={id} onSensors={() => router.replace(sensors)} onSatellite={() => router.replace(`${sensors}?satelite=1`)} />}
      {flow.step === "error" && <Failure flow={flow} />}
    </div>
  );
}

type Flow = ReturnType<typeof useHubProvisioning>;

function HubStep({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5" aria-label={`Passo ${step} de 4: ${label}`}>
      <SegMeter filled={step} total={4} /><span className="font-label text-xs leading-4 text-display uppercase">Passo {step} de 4 · {label}</span>
    </div>
  );
}

/** Bloco com traço escuro de 1 ("ANTES DE COMEÇAR", "PROGRESSO"). */
function Box({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="flex flex-col gap-2 rounded-lg border border-display p-3">{title && <PanelLabel>{title}</PanelLabel>}{children}</div>;
}
const Text = ({ children }: { children: ReactNode }) => <p className="text-base leading-6 text-text">{children}</p>;
const Small = ({ children }: { children: ReactNode }) => <p className="text-sm leading-5 text-text">{children}</p>;

function Bars({ rssi }: { rssi: number }) {
  const n = signalBars(rssi);
  return <span aria-hidden className="flex items-end gap-0.5">{[5, 8, 11, 14].map((h, i) => <span key={h} className={`w-1 rounded-[1px] ${i < n ? "bg-display" : "bg-stroke-soft"}`} style={{ height: h }} />)}</span>;
}

function Row({ title, sub, right, selected, onClick }: { title: string; sub?: string; right?: ReactNode; selected?: boolean; onClick?: () => void }) {
  const body = <><span className="flex min-w-0 flex-1 flex-col text-left"><span className="truncate text-base leading-6 text-text-primary">{title}</span>{sub && <span className="font-label text-xs leading-4 text-display uppercase">{sub}</span>}</span>{right}</>;
  const cls = `flex min-h-14 w-full items-center gap-3 rounded-lg bg-surface px-3.5 py-2.5 ${selected ? "border-2 border-display" : "border border-display"}`;
  return onClick ? <button type="button" onClick={onClick} className={`${cls} cursor-pointer hover:bg-surface-high`}>{body}</button> : <div className={cls}>{body}</div>;
}

function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="font-label inline-flex min-h-8 items-center gap-1 text-[13px] leading-4 text-display uppercase hover:underline cursor-pointer">{label} <span aria-hidden>›</span></button>;
}

// ─── H1 ──────────────────────────────────────────────────────────────────────

function Intro({ flow }: { flow: Flow }) {
  const blocked = flow.support && flow.support !== "ok" ? SCAN_PROBLEM[flow.support] : null;
  return <>
    <HubStep step={1} label="Preparar" />
    <EntryTitle title="Adicionar Hub" subtitle="O Hub é a central dos sensores do ambiente. Vamos ligá-lo ao seu Wi-Fi usando o Bluetooth deste computador ou celular." />
    <Box title="ANTES DE COMEÇAR">
      <Text>1 · Hub ligado na tomada, perto de você.</Text>
      <Text>2 · Bluetooth ligado, no Chrome ou no Edge.</Text>
      <Text>3 · Nome e senha do Wi-Fi de 2,4 GHz. O Hub não usa redes de 5 GHz.</Text>
    </Box>
    <Box title="JÁ CONFIGUROU ANTES?">
      <Small>Para trocar de rede, segure o botão BOOT do Hub por 10 segundos. Ele apaga só o Wi-Fi e mantém os satélites e a calibração.</Small>
    </Box>
    {blocked ? <ErrorBox error={{ ...blocked, fields: [] }} />
      : <Small>O navegador vai abrir uma lista de dispositivos próximos. Escolha o que começa com LetsGrow-Hub.</Small>}
    <EntryButton label="Procurar Hub" onClick={() => void flow.findHub()} disabled={!!blocked} />
  </>;
}

// ─── H2 ──────────────────────────────────────────────────────────────────────

const SCAN_PROBLEM: Record<ScanProblem, { title: string; body: string }> = {
  no_api: { title: "Navegador sem Bluetooth", body: "Este navegador não fala com dispositivos Bluetooth. Use o Chrome ou o Edge, ou o app do Let's Grow no celular." },
  insecure: { title: "Página sem conexão segura", body: "O Bluetooth só funciona em páginas https. Abra o Let's Grow pelo endereço oficial." },
  no_adapter: { title: "Bluetooth desligado", body: "Ligue o Bluetooth deste aparelho e tente de novo." },
  denied: { title: "Bluetooth bloqueado", body: "O navegador recusou o acesso ao Bluetooth. Libere nas permissões do site e tente de novo." },
  cancelled: { title: "Nenhum Hub escolhido", body: `Se o Hub não apareceu na lista, confira se ele está ligado. A configuração fica aberta por ${HUB_CONFIG_WINDOW_MIN} minutos; depois disso, tire o Hub da tomada e ligue de novo.` },
};

function Scan({ flow }: { flow: Flow }) {
  const problem = flow.scanProblem ? SCAN_PROBLEM[flow.scanProblem] : null;
  return <>
    <HubStep step={2} label="Encontrar" />
    <EntryTitle title="Procurando o Hub" subtitle="Deixe o aparelho perto do Hub. Ele aparece como LetsGrow-Hub seguido de 4 letras e números." />
    {flow.connecting && <div className="flex items-center gap-2"><Marker tone="light">Conectando…</Marker><Spinner label="" /></div>}
    {problem && <ErrorBox error={{ ...problem, fields: [] }} />}
    {!flow.connecting && <EntryButton kind="clear" label="Procurar de novo" onClick={() => void flow.findHub()} />}
  </>;
}

// ─── H3 ──────────────────────────────────────────────────────────────────────

function Wifi({ flow }: { flow: Flow }) {
  return <>
    <HubStep step={3} label="Wi-Fi" />
    {flow.hub && <Marker tone="live">Conectado · {flow.hub.name}</Marker>}
    <EntryTitle title="Escolha a rede Wi-Fi" subtitle="Estas são as redes que o Hub enxerga daí de onde ele está." />
    {flow.netsLoading && <Marker tone="light">Buscando redes…</Marker>}
    {!flow.netsLoading && !flow.nets.length && <ErrorBox error={{ title: "Nenhuma rede", body: "Aproxime o Hub do roteador e atualize a lista, ou digite o nome da rede em \"Minha rede não aparece\".", fields: [] }} />}
    {flow.nets.map(n => <Row key={n.ssid} title={n.ssid} sub={n.sec ? "Com senha" : "Aberta"} right={<Bars rssi={n.rssi} />} selected={flow.network?.ssid === n.ssid} onClick={() => flow.chooseNetwork(n)} />)}
    <div className="flex items-center justify-between">
      {!flow.netsLoading ? <LinkButton label="Atualizar lista" onClick={() => void flow.loadNetworks()} /> : <span />}
      <LinkButton label="Minha rede não aparece" onClick={flow.chooseManual} />
    </div>
    <Small>O Hub só funciona em 2,4 GHz. Se o roteador mostra duas redes (2G e 5G), escolha a 2G.</Small>
  </>;
}

// ─── H4 ──────────────────────────────────────────────────────────────────────

function Password({ flow }: { flow: Flow }) {
  const net = flow.network;
  const [ssid, setSsid] = useState(net?.ssid ?? "");
  const [pass, setPass] = useState("");
  const [tried, setTried] = useState(false);
  if (!net) return null;
  const formError = wifiFormError(ssid, pass, net.sec);
  function submit(e: FormEvent) { e.preventDefault(); setTried(true); if (!formError) flow.connectHub(ssid, pass); }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <HubStep step={3} label="Wi-Fi" />
      <EntryTitle title={net.sec ? "Senha do Wi-Fi" : "Rede aberta"}
        subtitle={net.manual ? "Digite o nome da rede e a senha, do jeito que estão no roteador." : net.sec ? "Digite a senha da rede escolhida, do jeito que está no roteador." : "Esta rede não pede senha."} />
      {net.manual
        ? <EntryField label="Rede" icon="user" value={ssid} onChange={e => setSsid(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Nome da rede"
            error={tried && !ssid.trim() ? "Digite o nome da rede" : null} />
        : <div className="flex flex-col gap-1.5"><PanelLabel>Rede</PanelLabel><Row title={net.ssid} /></div>}
      {net.sec && <EntryField label="Senha do Wi-Fi" icon="lock" type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="off" data-autofocus
        error={tried && ssid.trim() ? formError : null} />}
      <Box><Small>A senha vai direto para o Hub pelo Bluetooth, com a conexão cifrada. O Let&apos;s Grow não guarda a senha do seu Wi-Fi.</Small></Box>
      <EntryButton type="submit" label="Conectar Hub" />
    </form>
  );
}

// ─── H5 ──────────────────────────────────────────────────────────────────────

function Progress({ flow }: { flow: Flow }) {
  const labels: string[] = [...PROGRESS_STEPS];
  if (flow.network?.ssid) labels[1] = `Hub entrou no Wi-Fi ${flow.network.ssid}`;
  return <>
    <HubStep step={4} label="Ativação" />
    <EntryTitle title="Conectando o Hub" subtitle="Leva até 1 minuto. Deixe esta página aberta e o aparelho perto do Hub." />
    <Box title="PROGRESSO">
      <ol className="flex flex-col gap-2" aria-live="polite">
        {labels.map((l, i) => {
          const state = i < flow.progress ? "done" : i === flow.progress ? "now" : "todo";
          return (
            <li key={i} className="flex items-center gap-2.5">
              <span aria-hidden className={`flex size-[18px] items-center justify-center rounded border text-xs ${state === "done" ? "border-display bg-display text-surface" : state === "now" ? "border-display bg-state-alert" : "border-stroke-soft"}`}>{state === "done" && "✓"}</span>
              <span className={`flex-1 text-base leading-6 text-text ${state === "todo" ? "opacity-50" : ""}`}>{l}<span className="sr-only">{state === "done" ? ", concluído" : state === "now" ? ", em andamento" : ", pendente"}</span></span>
              {state === "now" && <Marker tone="light">Agora</Marker>}
            </li>
          );
        })}
      </ol>
    </Box>
    <LinkButton label="Cancelar" onClick={flow.cancel} />
  </>;
}

// ─── H6 ──────────────────────────────────────────────────────────────────────

function Done({ flow, growId, onSensors, onSatellite }: { flow: Flow; growId: string; onSensors: () => void; onSatellite: () => void }) {
  const devices = useGrowDevices(growId, 3000);
  const device = flow.info ? findHub(devices.data, flow.info.mac) : null;
  const online = !!device?.is_online;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (online) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [online]);
  const slow = !online && !!flow.doneAt && now - flow.doneAt > ONLINE_SLOW_MS;
  const tone: MarkerTone = online ? "live" : slow ? "out" : "light";
  const details = flow.info ? [flow.info.fw && `Firmware ${flow.info.fw}`, flow.info.relays ? `${flow.info.relays} relés` : null, flow.network?.ssid && `Wi-Fi ${flow.network.ssid}`].filter(Boolean).join(" · ") : "";
  return <>
    <Marker tone={online ? "live" : "plain"}>{online ? "Pronto" : "Ativado"}</Marker>
    <EntryTitle title="Hub conectado" subtitle="O Hub já manda dados para o Let's Grow. Agora você pode adicionar satélites e ligar os relés." />
    <Box title="HUB">
      <Row title={device?.name ?? `Hub ${flow.hub?.suffix ?? ""}`} sub={flow.info ? formatMac(flow.info.mac) : undefined}
        right={<Marker tone={tone}>{online ? "Online" : slow ? "Ainda não apareceu" : "Esperando"}</Marker>} />
      {details && <PanelLabel>{details}</PanelLabel>}
    </Box>
    {!online && <Box>
      <Marker tone={slow ? "out" : "light"}>{slow ? "O Hub ainda não apareceu" : "Esperando o Hub ficar online"}</Marker>
      <Small>{slow ? "O Hub foi ativado mas ainda não apareceu. Confira se ele está ligado e perto do roteador." : "O Hub reinicia depois de ativar e aparece online em alguns segundos."}</Small>
    </Box>}
    <EntryButton label="Adicionar satélite" onClick={onSatellite} disabled={!online} />
    <EntryButton kind="clear" label="Ver sensores do ambiente" onClick={onSensors} />
  </>;
}

// ─── H7 ──────────────────────────────────────────────────────────────────────

function Failure({ flow }: { flow: Flow }) {
  if (!flow.error) return null;
  const copy = errorCopy(flow.error, flow.network?.ssid);
  return <>
    <HubStep step={4} label="Ativação" />
    <EntryTitle title="Não deu para conectar" />
    <ErrorBox error={{ title: copy.title, body: flow.errorDetail ?? copy.body, fields: [] }} />
    <EntryButton label={ERROR_ACTION_LABEL[copy.primary]} onClick={() => flow.act(copy.primary)} />
    {copy.secondary && <EntryButton kind="clear" label={ERROR_ACTION_LABEL[copy.secondary]} onClick={() => flow.act(copy.secondary!)} />}
  </>;
}
