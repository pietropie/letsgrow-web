"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Marker, PanelButton, PanelCard, PanelLabel, PanelTitle } from "@/components/panel";
import { Digits, STATE_TONE, SensorPhoto } from "@/components/sensors/cards";
import { RANGE_TEXT, ago, compact, screenTiles, type SensorScreen } from "@/lib/sensor-cards";
import { routes } from "@/lib/routes";
import { useNow } from "@/lib/sensors";
import type { GrowResponse } from "@/shared/types/api";

/**
 * Bloco "Sensores" no painel do ambiente (Figma 28 · SN4a/W11p com Hub, SN4c sem Hub, SN4d Hub offline). Com Hub, ele
 * toma o lugar do cartão "Ambiente" de leituras manuais; tocar numa leitura abre o cartão dela na tela de sensores.
 */
export function SensorsBlock({ grow, screen }: { grow: GrowResponse; screen: SensorScreen }) {
  const now = useNow();
  const sensorsHref = routes.growSensors(grow.id) ?? "#";
  const hub = screen.hub;

  if (!hub) return (
    <PanelCard label="Sensores">
      <PanelTitle lamp="none" divider right={<Marker>Sem Hub</Marker>}>Sensores</PanelTitle>
      <div className="flex items-center gap-3">
        <SensorPhoto icon="sensor-hub" />
        <p className="flex-1 text-[15px] leading-[21px] text-text">Com um Hub, a temperatura, a umidade, a luz, o solo e a solução chegam sozinhos, sem você anotar.</p>
      </div>
      {grow.status !== "abandoned" && <div className="flex"><PanelButton label="Adicionar Hub" href={routes.growAddHub(grow.id)} /></div>}
      <p className="text-sm leading-5 text-text-secondary">Leva uns 3 minutos pelo Bluetooth. Enquanto isso, as leituras manuais continuam valendo.</p>
    </PanelCard>
  );

  if (!hub.online) return (
    <PanelCard label="Sensores">
      <PanelTitle lamp="attention" divider right={<Marker tone="out">Hub offline{hub.lastAt ? ` · ${ago(hub.lastAt, now)}` : ""}</Marker>}>Sensores</PanelTitle>
      <p className="text-[15px] leading-[21px] text-text">{hub.lastAt ? `As leituras mostradas são as últimas que chegaram, ${ago(hub.lastAt, now)}.` : "O Hub ainda não mandou leituras."} Confira se ele está na tomada e se o Wi-Fi funciona.</p>
      <div className="flex"><PanelButton kind="clear" label="Ver sensores" href={sensorsHref} /></div>
    </PanelCard>
  );

  const tiles = screenTiles(screen);
  // Figma SN4a: lâmpada verde com o Hub online; o "fora da faixa" vai no marcador rosa.
  const lamp = tiles.length ? "ok" : "none";
  return (
    <PanelCard label="Sensores">
      <PanelTitle lamp={lamp} divider right={<Marker tone="live">Hub online{hub.lastAt ? ` · ${ago(hub.lastAt, now)}` : ""}</Marker>}>Sensores</PanelTitle>
      {!tiles.length ? (
        <p className="text-[15px] leading-[21px] text-text">O Hub está online, mas ainda não chegou leitura. A primeira chega em até 5 minutos.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {tiles.map(t => {
            const c = compact(t.value, t.unit);
            return (
              <Link key={t.key} href={`${sensorsHref}#sensor-${t.deviceId}`} aria-label={`${t.label}: abrir o sensor`} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-stroke p-2.5 hover:bg-surface-high">
                <span className="flex min-w-0 items-center gap-1.5"><img src={`/figma/${t.icon}.svg`} alt="" className="size-5 shrink-0" /><span className="truncate"><PanelLabel>{t.label}</PanelLabel></span></span>
                <Digits value={c.value} suffix={c.prefix} decimals={c.prefix ? 0 : t.decimals} unit={t.unit} size="small" label={t.label} />
                {t.state !== "none" ? <Marker tone={STATE_TONE[t.state]}>{RANGE_TEXT[t.state]}</Marker> : t.computed ? <Marker>Calculado</Marker> : null}
              </Link>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Marker>{hub.satellites} {hub.satellites === 1 ? "satélite" : "satélites"}</Marker>
        {screen.outOfRange > 0 && <Marker tone="out">{screen.outOfRange} fora da faixa</Marker>}
      </div>
      <div className="flex"><PanelButton kind="clear" label="Ver sensores" href={sensorsHref} /></div>
    </PanelCard>
  );
}
