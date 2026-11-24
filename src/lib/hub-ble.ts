"use client";

/**
 * Onboarding do Hub pelo navegador (Web Bluetooth): o mesmo contrato do mobile (services/hubBle.ts,
 * hub-onboarding-ble-contrato.md v1). Funciona no Chrome e no Edge (computador e Android), em HTTPS; Safari e
 * Firefox não têm Web Bluetooth. O navegador não deixa listar aparelhos: `requestHub` abre o seletor dele,
 * filtrado por "LetsGrow-Hub-", e precisa vir de um clique.
 */
import {
  HUB_CHAR, HUB_NAME_PREFIX, HUB_SERVICE_UUID, SCAN_REQUEST, buildConfig, hubSuffix, parseInfo, parseScan,
  parseStatus, type HubInfo, type HubStatus, type WifiNetwork,
} from "@/shared/lib/hubProvisioning";

// Tipos mínimos da Web Bluetooth (o lib.dom do TypeScript não traz).
interface Characteristic extends EventTarget {
  value: DataView | null;
  readValue(): Promise<DataView>;
  writeValueWithResponse(data: BufferSource): Promise<void>;
  startNotifications(): Promise<Characteristic>;
}
interface Service { getCharacteristic(uuid: string): Promise<Characteristic> }
interface Gatt { connected: boolean; connect(): Promise<Gatt>; disconnect(): void; getPrimaryService(uuid: string): Promise<Service> }
interface BleDevice extends EventTarget { id: string; name?: string; gatt?: Gatt }
interface Bluetooth {
  getAvailability(): Promise<boolean>;
  requestDevice(options: { filters: { namePrefix: string }[]; optionalServices: string[] }): Promise<BleDevice>;
}
const bluetooth = (): Bluetooth | null =>
  typeof navigator !== "undefined" && "bluetooth" in navigator ? (navigator as unknown as { bluetooth: Bluetooth }).bluetooth : null;

export type WebBleSupport = "ok" | "no_api" | "insecure" | "no_adapter";

/** Se este navegador consegue falar com o Hub: API presente, página segura e um adaptador Bluetooth. */
export async function webBleSupport(): Promise<WebBleSupport> {
  const bt = bluetooth();
  if (!bt) return "no_api";
  if (typeof window !== "undefined" && !window.isSecureContext) return "insecure";
  try { return (await bt.getAvailability()) ? "ok" : "no_adapter"; } catch { return "ok"; }
}

export interface ChosenHub { device: BleDevice; name: string; suffix: string }

/** Abre o seletor do navegador. Null quando a pessoa fecha o seletor sem escolher. */
export async function requestHub(): Promise<ChosenHub | null> {
  const bt = bluetooth();
  if (!bt) throw new Error("no_api");
  try {
    const device = await bt.requestDevice({ filters: [{ namePrefix: HUB_NAME_PREFIX }], optionalServices: [HUB_SERVICE_UUID] });
    const name = device.name ?? HUB_NAME_PREFIX;
    return { device, name, suffix: hubSuffix(name) };
  } catch (e) {
    if ((e as Error)?.name === "NotFoundError") return null; // seletor fechado
    throw e;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const text = (v: DataView | null) => (v ? decoder.decode(v) : null);

/** Uma conexão GATT com o Hub em modo de configuração. */
export class HubSession {
  private closing = false;
  private listeners: (() => void)[] = [];

  private constructor(readonly device: BleDevice, private gatt: Gatt, private chars: Record<keyof typeof HUB_CHAR, Characteristic>) {}

  static async connect(hub: ChosenHub): Promise<HubSession> {
    if (!hub.device.gatt) throw new Error("no_gatt");
    const gatt = await hub.device.gatt.connect();
    const service = await gatt.getPrimaryService(HUB_SERVICE_UUID);
    const [info, scan, config, status] = await Promise.all([
      service.getCharacteristic(HUB_CHAR.info), service.getCharacteristic(HUB_CHAR.scan),
      service.getCharacteristic(HUB_CHAR.config), service.getCharacteristic(HUB_CHAR.status),
    ]);
    return new HubSession(hub.device, gatt, { info, scan, config, status });
  }

  /** Chamado uma vez quando o link cai por qualquer motivo que não seja `close()`. */
  onDisconnect(cb: () => void) {
    const handler = () => { if (!this.closing) cb(); };
    this.device.addEventListener("gattserverdisconnected", handler);
    this.listeners.push(() => this.device.removeEventListener("gattserverdisconnected", handler));
  }

  private watch(c: Characteristic, cb: (t: string) => void): () => void {
    const handler = () => { const t = text(c.value); if (t) cb(t); };
    c.addEventListener("characteristicvaluechanged", handler);
    const off = () => c.removeEventListener("characteristicvaluechanged", handler);
    this.listeners.push(off);
    return off;
  }

  async readInfo(): Promise<HubInfo | null> { return parseInfo(text(await this.chars.info.readValue())); }

  /** Pede o scan de Wi-Fi e espera o notify; sem notify em 12 s, lê a característica. */
  async scanWifi(timeoutMs = 12000): Promise<WifiNetwork[]> {
    const c = this.chars.scan;
    await c.startNotifications().catch(() => c);
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (nets: WifiNetwork[] | null, err?: unknown) => {
        if (done) return;
        done = true; clearTimeout(timer); off();
        if (nets) resolve(nets); else reject(err ?? new Error("scan_timeout"));
      };
      const off = this.watch(c, t => { const nets = parseScan(t); if (nets) finish(nets); });
      const timer = setTimeout(() => { c.readValue().then(v => finish(parseScan(text(v)) ?? []), e => finish(null, e)); }, timeoutMs);
      c.writeValueWithResponse(encoder.encode(SCAN_REQUEST)).catch(e => finish(null, e));
    });
  }

  /** Acompanha o `status` (notify) e lê o valor atual uma vez. */
  watchStatus(cb: (s: HubStatus) => void): () => void {
    const c = this.chars.status;
    const off = this.watch(c, t => { const s = parseStatus(t); if (s) cb(s); });
    c.startNotifications().catch(() => {});
    c.readValue().then(v => { const s = parseStatus(text(v)); if (s) cb(s); }, () => {});
    return off;
  }

  /** `config` exige link cifrado: a primeira escrita dispara o pareamento "Just Works" no sistema. */
  async writeConfig(cfg: { ssid: string; pass: string; growId: string; code: string }) {
    await this.chars.config.writeValueWithResponse(encoder.encode(buildConfig(cfg)));
  }

  close() {
    this.closing = true;
    for (const off of this.listeners.splice(0)) off();
    if (this.gatt.connected) this.gatt.disconnect();
  }
}
