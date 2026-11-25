/**
 * Sensores do ambiente (Figma 28 · SN1–SN4, W10p, W11p; seção 2444:24432). Lib pura (sem imports de runtime), testada em
 * tests/sensorCards.test.cjs.
 *
 * O backend ainda não diz o tipo de cada satélite: o tipo sai dos campos que chegam na leitura. O Hub também mede
 * (ar, luz, solo e solução, no firmware hub_local_sensors.h), então um dispositivo pode virar mais de um cartão.
 * Nenhum texto daqui fala em placa, MAC ou Serial Monitor.
 */

export type SensorKind = "air" | "soil" | "light" | "solution" | "co2" | "ph" | "root";
export type RangeState = "ok" | "near" | "out";

export type ReadingLike = {
  recorded_at: string;
  temp_air: number | null; humidity_air: number | null; vpd_kpa: number | null; co2_ppm: number | null;
  ph_solution: number | null; soil_moisture_pct: number | null; temp_root: number | null; lux: number | null; ec_ms_cm: number | null;
};
type DeviceLike = { id: string; name: string; module_type: string; is_online: boolean; is_paired: boolean; last_seen_at: string | null; plant_id: string | null };

/** Medida de um cartão. `calculated`: o valor não é medido direto (VPD vem de temperatura e umidade). */
export type MetricDef = { key: string; label: string; short: string; unit: string; decimals: number; min: number; max: number; calculated?: boolean; note?: string; read: (r: ReadingLike) => number | null };

const PPM_PER_MS = 500; // escala 500 (TDS do Hub): ppm = EC em mS/cm × 500

export const KIND: Record<SensorKind, { title: string; tag: string; about: string; icon: string; metrics: MetricDef[] }> = {
  air: {
    title: "Ar", tag: "Ar · temperatura e umidade", icon: "temperature", about: "Mede temperatura e umidade do ar. O VPD é calculado pelas duas.",
    metrics: [
      { key: "temp_air", label: "Temperatura", short: "Temperatura", unit: "°C", decimals: 1, min: 20, max: 28, read: r => r.temp_air },
      { key: "humidity_air", label: "Umidade", short: "Umidade", unit: "%", decimals: 0, min: 40, max: 70, read: r => r.humidity_air },
      { key: "vpd_kpa", label: "VPD", short: "VPD", unit: "kPa", decimals: 1, min: 0.8, max: 1.6, calculated: true, read: r => r.vpd_kpa },
    ],
  },
  soil: {
    title: "Solo", tag: "Umidade do substrato", icon: "watering", about: "Fica espetado no substrato. Mostra quanto de água ainda tem no vaso.",
    metrics: [{ key: "soil_moisture_pct", label: "Umidade do substrato", short: "Solo", unit: "%", decimals: 0, min: 30, max: 70, read: r => r.soil_moisture_pct }],
  },
  light: {
    title: "Luz", tag: "Luz", icon: "light", about: "Mede a luz que chega na copa, em lux.",
    metrics: [{ key: "lux", label: "Luz", short: "Luz", unit: "lx", decimals: 0, min: 25_000, max: 50_000, read: r => r.lux }],
  },
  solution: {
    title: "Solução", tag: "PPM / EC da solução", icon: "fert", about: "Fica no reservatório. Mede os sais dissolvidos na solução.",
    metrics: [
      { key: "ppm", label: "PPM", short: "PPM", unit: "ppm", decimals: 0, min: 0.5 * PPM_PER_MS, max: 3 * PPM_PER_MS, note: "calculado do EC (escala 500)", read: r => r.ec_ms_cm == null ? null : r.ec_ms_cm * PPM_PER_MS },
      { key: "ec_ms_cm", label: "EC", short: "EC", unit: "mS/cm", decimals: 1, min: 0.5, max: 3, read: r => r.ec_ms_cm },
    ],
  },
  co2: {
    title: "CO₂", tag: "CO₂", icon: "fan", about: "Mede o gás carbônico do ar da tenda.",
    metrics: [{ key: "co2_ppm", label: "CO₂", short: "CO₂", unit: "ppm", decimals: 0, min: 400, max: 1500, read: r => r.co2_ppm }],
  },
  ph: {
    title: "pH", tag: "pH da solução", icon: "watering", about: "Fica no reservatório. Mede a acidez da solução.",
    metrics: [{ key: "ph_solution", label: "pH", short: "pH", unit: "", decimals: 1, min: 5.8, max: 6.5, read: r => r.ph_solution }],
  },
  root: {
    title: "Raiz", tag: "Temperatura da água / raiz", icon: "temperature", about: "Mede a temperatura na zona da raiz ou da água.",
    metrics: [{ key: "temp_root", label: "Temperatura", short: "Raiz", unit: "°C", decimals: 1, min: 18, max: 24, read: r => r.temp_root }],
  },
};
const ORDER: SensorKind[] = ["air", "soil", "light", "solution", "co2", "ph", "root"];

/** Tipos com pelo menos um valor na leitura, na ordem da tela. */
export function kindsIn(r: ReadingLike | null | undefined): SensorKind[] {
  if (!r) return [];
  return ORDER.filter(k => KIND[k].metrics.some(m => !m.calculated && m.read(r) != null));
}

/** Fora da faixa; perto do limite quando está a até 10 % da largura da faixa de uma borda; senão na faixa. */
export function rangeState(value: number, min: number, max: number): RangeState {
  if (value < min || value > max) return "out";
  const edge = (max - min) * 0.1;
  return value - min < edge || max - value < edge ? "near" : "ok";
}
export const RANGE_TEXT: Record<RangeState, string> = { ok: "Na faixa", near: "Perto do limite", out: "Fora da faixa" };

export function rounded(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
/** "25 000–50 000 lx", "20–28 °C", "5,8–6,5". */
export function rangeText(m: MetricDef): string {
  const n = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: m.decimals }).format(v).replace(/\./g, " ");
  return `faixa ${n(m.min)}–${n(m.max)}${m.unit ? ` ${m.unit === "%" ? "%" : m.unit}` : ""}`;
}

/** "há 2 min", "há 3 h", "ontem 22:10", "19/11 08:05". */
export function ago(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.round(s / 60)} min`;
  if (s < 86400) return `há ${Math.round(s / 3600)} h`;
  const d = new Date(t), today = new Date(now);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) return `ontem ${hm}`;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hm}`;
}
export function clock(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;
}

/**
 * Estado de um cartão de sensor:
 * - `hub-offline`: o Hub não manda dados; o cartão mostra a última leitura esmaecida (SN2b);
 * - `no-signal`: o Hub está online, mas este satélite parou (SN2c);
 * - `waiting`: pareado e ainda sem leitura (SN2d);
 * - `live`.
 */
export type CardState = "live" | "hub-offline" | "no-signal" | "waiting";
export function cardState(device: DeviceLike, reading: ReadingLike | null | undefined, hubOnline: boolean | null): CardState {
  if (hubOnline === false) return "hub-offline";
  if (!reading) return "waiting";
  if (device.module_type !== "hub" && !device.is_online) return "no-signal";
  return "live";
}

export type SensorCardModel = { id: string; deviceId: string; kind: SensorKind | null; title: string; tags: string[]; about: string; icon: string; metrics: MetricDef[]; state: CardState };

/**
 * Um cartão por tipo medido. Satélite com um tipo só leva o nome dele ("Ar da tenda"); o Hub e os satélites com
 * vários tipos levam o nome do tipo e, nas etiquetas, de onde vem. Satélite pareado sem leitura vira um cartão "aguardando".
 */
export function sensorCards(devices: DeviceLike[], readings: Record<string, ReadingLike | null | undefined>, ctx: { hubOnline: boolean | null; growName: string; plantName: (id: string) => string | null }): SensorCardModel[] {
  const out: SensorCardModel[] = [];
  for (const d of devices) {
    if (!d.is_paired && d.module_type === "satellite") continue;
    const r = readings[d.id] ?? null;
    const kinds = kindsIn(r);
    const place = d.plant_id ? ctx.plantName(d.plant_id) : null;
    const where = place ?? ctx.growName;
    const state = cardState(d, r, ctx.hubOnline);
    if (!kinds.length) {
      if (d.module_type === "hub") continue; // o Hub sem medidas aparece só no cartão dele
      out.push({ id: d.id, deviceId: d.id, kind: null, title: d.name || "Satélite novo", tags: ["Satélite", where], about: "Assim que chegar a primeira leitura, o app mostra o que este sensor mede.", icon: "sensor", metrics: [], state });
      continue;
    }
    const single = kinds.length === 1 && d.module_type !== "hub";
    for (const k of kinds) {
      const def = KIND[k];
      out.push({
        id: `${d.id}:${k}`, deviceId: d.id, kind: k,
        title: single ? d.name : def.title,
        tags: [def.tag, single ? where : d.module_type === "hub" ? `no ${d.name}` : `${d.name} · ${where}`],
        about: def.about, icon: def.icon,
        metrics: def.metrics.filter(m => r && m.read(r) != null),
        state,
      });
    }
  }
  return out;
}

/** Hub do ambiente e contagem de satélites pareados (online e total). */
export function hubFacts(devices: DeviceLike[]) {
  const hub = devices.find(d => d.module_type === "hub") ?? null;
  const sats = devices.filter(d => d.module_type === "satellite" && d.is_paired);
  return { hub, satellites: sats.length, online: sats.filter(d => d.is_online).length };
}

/** Número curto do painel: 32 400 → 32 com "k" (mil). */
export function compact(value: number, unit: string): { value: number; prefix: string } {
  return unit === "lx" && value >= 10_000 ? { value: Math.round(value / 1000), prefix: "k" } : { value, prefix: "" };
}

// ─── Modelo da tela (o mesmo para a rota do backend e para a reserva local) ──────────────────────────────────────

export type MetricState = RangeState | "none";
export type ViewMetric = { key: string; label: string; unit: string; decimals: number; value: number | null; computed: boolean; note: string | null; state: MetricState; range: { min: number; max: number } | null; outSince: string | null };
export type ViewHistory = { metric: string; window: string; bars: { value: number | null; state: MetricState }[]; min: number | null; max: number | null };
export type CardStatus = "live" | "no_signal" | "stale" | "waiting";
export type ViewCard = { id: string; deviceId: string; kind: string | null; title: string; tags: string[]; about: string; icon: string; photoUrl: string | null; status: CardStatus; lastAt: string | null; metrics: ViewMetric[]; worst: MetricState; history: ViewHistory | null; plantId: string | null };
export type ViewHub = { id: string; name: string; tag: string; online: boolean; lastAt: string | null; satellites: number; satellitesOnline: number; photoUrl: string | null };
export type SensorScreen = { hub: ViewHub | null; cards: ViewCard[]; outOfRange: number; lightOn: boolean | null; source: "api" | "local" };

/** Ícones da API (`icon`) nos arquivos de public/figma. */
const ICON: Record<string, string> = { hub: "sensor-hub", temperature: "temperature", watering: "watering", light: "light", fert: "fert", exhaust: "exhaust" };
const WINDOW: Record<string, string> = { "24h": "24 h", "3d": "3 dias", "7d": "7 dias" };
const STATES = new Set(["ok", "near", "out", "none"]);
const st = (v: unknown): MetricState => (typeof v === "string" && STATES.has(v) ? v as MetricState : "none");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
type Obj = Record<string, unknown>;

/** GET /iot/grows/{grow_id}/sensors (API-SENSORES-RELES.md §2) → modelo da tela. */
export function screenFromApi(raw: unknown, growName: string): SensorScreen {
  const r = (raw ?? {}) as Obj;
  const h = r.hub as Obj | null | undefined;
  const hub: ViewHub | null = h ? {
    id: String(h.id), name: str(h.name) ?? "Hub", tag: str(h.tag) ?? "A base · fica ligada no Wi-Fi", online: h.online === true,
    lastAt: str(h.last_seen_at), satellites: num(h.satellites_total) ?? 0, satellitesOnline: num(h.satellites_online) ?? 0, photoUrl: str(h.photo_url),
  } : null;
  const cards: ViewCard[] = (Array.isArray(r.cards) ? r.cards as Obj[] : []).map(c => {
    const placement = c.placement as { plant_id?: string | null; label?: string | null } | null | undefined;
    const hist = c.history as Obj | null | undefined;
    const status = (["live", "no_signal", "stale", "waiting"].includes(String(c.status)) ? c.status : "live") as CardStatus;
    return {
      id: str(c.card_id) ?? String(c.device_id), deviceId: String(c.device_id), kind: str(c.sensor_kind),
      title: str(c.name) ?? str(c.kind_label) ?? "Sensor",
      tags: [str(c.tag) ?? str(c.kind_label) ?? "", placement?.label ?? (c.source === "hub" ? `no ${hub?.name ?? "Hub"}` : growName)].filter(Boolean),
      about: str(c.description) ?? "", icon: ICON[String(c.icon)] ?? "sensor-hub", photoUrl: str(c.photo_url),
      status, lastAt: str(c.last_reading_at),
      metrics: (Array.isArray(c.metrics) ? c.metrics as Obj[] : []).map(m => {
        const range = m.range as { min?: unknown; max?: unknown } | null | undefined;
        const min = num(range?.min), max = num(range?.max);
        return {
          key: String(m.metric), label: str(m.label) ?? String(m.metric), unit: str(m.unit) ?? "", decimals: num(m.decimals) ?? 0,
          value: num(m.value), computed: m.computed === true, note: str(m.note), state: st(m.state),
          range: min != null && max != null ? { min, max } : null, outSince: str(m.out_of_range_since),
        };
      }),
      worst: st(c.worst_state),
      history: hist && Array.isArray(hist.buckets) ? {
        metric: String(hist.metric), window: WINDOW[String(hist.window)] ?? String(hist.window),
        bars: (hist.buckets as Obj[]).map(b => ({ value: num(b.avg), state: st(b.state) })),
        min: num(hist.min), max: num(hist.max),
      } : null,
      plantId: placement?.plant_id ?? null,
    };
  });
  return { hub, cards, outOfRange: num(r.out_of_range_count) ?? cards.filter(c => c.worst === "out").length, lightOn: typeof r.light_on === "boolean" ? r.light_on : null, source: "api" };
}

/** Reserva enquanto a rota da tela não está no ar: o mesmo modelo, montado das leituras (faixas fixas, sem histórico). */
export function screenFromLocal(devices: DeviceLike[], readings: Record<string, ReadingLike | null | undefined>, ctx: { growName: string; plantName: (id: string) => string | null; lightOn: boolean | null }): SensorScreen {
  const facts = hubFacts(devices);
  const hubOnline = facts.hub ? facts.hub.is_online : null;
  const STATUS: Record<CardState, CardStatus> = { live: "live", "hub-offline": "stale", "no-signal": "no_signal", waiting: "waiting" };
  const cards: ViewCard[] = sensorCards(devices, readings, { hubOnline, growName: ctx.growName, plantName: ctx.plantName }).map(c => {
    const r = readings[c.deviceId] ?? null;
    const lightOff = c.kind === "light" && ctx.lightOn === false;
    const metrics: ViewMetric[] = c.metrics.map(m => {
      const value = r ? m.read(r) : null;
      const computed = !!m.calculated || m.key === "ppm";
      const state: MetricState = value == null || m.calculated || lightOff || c.state !== "live" ? "none" : rangeState(value, m.min, m.max);
      return { key: m.key, label: m.label, unit: m.unit, decimals: m.decimals, value, computed, note: m.note ?? null, state, range: m.calculated || lightOff ? null : { min: m.min, max: m.max }, outSince: null };
    });
    const worst: MetricState = metrics.some(m => m.state === "out") ? "out" : metrics.some(m => m.state === "near") ? "near" : metrics.some(m => m.state === "ok") ? "ok" : "none";
    return { id: c.id, deviceId: c.deviceId, kind: c.kind, title: c.title, tags: c.tags, about: c.about, icon: c.icon === "sensor" ? "sensor-hub" : c.icon, photoUrl: null, status: STATUS[c.state], lastAt: r?.recorded_at ?? null, metrics, worst, history: null, plantId: devices.find(d => d.id === c.deviceId)?.plant_id ?? null };
  });
  const order: Record<MetricState, number> = { out: 0, near: 1, ok: 2, none: 3 };
  cards.sort((a, b) => order[a.worst] - order[b.worst] || a.title.localeCompare(b.title, "pt-BR"));
  const h = facts.hub;
  return {
    hub: h ? { id: h.id, name: h.name, tag: "A base · fica ligada no Wi-Fi", online: h.is_online, lastAt: readings[h.id]?.recorded_at ?? h.last_seen_at, satellites: facts.satellites, satellitesOnline: facts.online, photoUrl: null } : null,
    cards, outOfRange: cards.filter(c => c.worst === "out").length, lightOn: ctx.lightOn, source: "local",
  };
}

/** Bloco do painel (SN4a/W11p): uma leitura por medida, no máximo seis; o EC fica de fora (o PPM vai) e o VPD vai no fim. */
export type Tile = { key: string; label: string; icon: string; value: number; unit: string; decimals: number; state: MetricState; computed: boolean; deviceId: string };
export function screenTiles(screen: SensorScreen, limit = 6): Tile[] {
  const rank = (k: string | null) => { const i = ["air", "soil", "light", "solution"].indexOf(k ?? ""); return i < 0 ? 9 : i; };
  const cards = [...screen.cards].sort((a, b) => rank(a.kind) - rank(b.kind));
  const tiles: Tile[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    if (c.status !== "live") continue; // sem sinal, antigo ou aguardando: fica só na tela de sensores
    for (const m of c.metrics) {
      if (m.key === "ec_ms_cm" || m.value == null || seen.has(m.key)) continue;
      seen.add(m.key);
      const place = c.tags[1];
      const label = m.key === "soil_moisture_pct" ? (place && !place.startsWith("no ") ? `Solo · ${place.split(" · ")[0]}` : "Solo") : m.label;
      const icon = m.key === "humidity_air" || m.key === "vpd_kpa" || m.key === "temp_air" ? "temperature" : c.icon;
      tiles.push({ key: `${c.id}:${m.key}`, label, icon, value: rounded(m.value, m.decimals), unit: m.unit, decimals: m.decimals, state: m.state, computed: m.computed, deviceId: c.deviceId });
    }
  }
  tiles.sort((a, b) => Number(a.key.endsWith(":vpd_kpa")) - Number(b.key.endsWith(":vpd_kpa")));
  return tiles.slice(0, limit);
}

/** "Abaixo da faixa há 5 h" / "Acima da faixa desde ontem 22:10", a partir de `out_of_range_since`. */
export function outSinceText(m: ViewMetric, now = Date.now()): string | null {
  if (m.state !== "out" || !m.outSince || !m.range || m.value == null) return null;
  const when = ago(m.outSince, now);
  if (!when) return null;
  return `${m.value < m.range.min ? "Abaixo" : "Acima"} da faixa ${when.startsWith("há") || when === "agora" ? when : `desde ${when}`}.`;
}

/** "faixa 25 000–50 000 lx" a partir de uma faixa qualquer. */
export function rangeLine(m: ViewMetric): string | null {
  if (!m.range) return null;
  return rangeText({ key: m.key, label: m.label, short: m.label, unit: m.unit, decimals: m.decimals, min: m.range.min, max: m.range.max, read: () => null });
}
