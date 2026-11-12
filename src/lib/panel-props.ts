import type { Reading } from "@/components/home/panel-home";
import type { LampState } from "@/components/panel";
import { backendNextAction, lastMarker, nextAction, nextMarker, readingMarker, type SummaryV3 } from "@/lib/home-v3";
import { routes } from "@/lib/routes";
import { phases } from "@/shared/constants/theme";
import { whole, type AttentionItem } from "@/shared/lib/homeClimate";
import { dialProgress, durationLabel, formatClock, scheduleFromGrow } from "@/shared/lib/lightSchedule";
import { environmentMeasurement } from "@/shared/lib/measurements";
import { phaseDay } from "@/shared/lib/phaseDay";
import { PHASE_ICON_LABEL, phaseIcon } from "@/shared/lib/plantFacts";
import { plantDisplayName, plantIllustration } from "@/shared/lib/plantIdentity";
import type { GrowEnvSnapshot, PlantResponse, PlantSummary } from "@/shared/types/api";

/**
 * Props dos cartões do painel (item 23b) a partir dos dados reais, para o Início, Ambientes e Plantas usarem a mesma
 * regra. Nada é estimado: sem leitura, o mostrador fica em traços; sem foto, "SEM FOTO" ou a ilustração.
 */

const GROW_TYPE: Record<string, string> = { indoor: "Indoor", outdoor: "Externo", greenhouse: "Estufa" };
const GENETICS: Record<string, string> = { indica: "índica", sativa: "sativa", hybrid: "híbrida" };
const STRAIN_TYPE: Record<string, string> = { photo: "fotoperiódica", auto: "automática" };

export type PlantPanelProps = {
  name: string; href: string | null; photo: { src: string; real: boolean } | null;
  tags: string[]; phase: { icon: string; label: string } | null; phaseLine: string;
  next: { label: string; href: string | null } | null; last: string | null; noRecords: boolean;
  askHref: string; photoHref: string | null; recordHref: string | null;
};

/**
 * Um cartão de planta: foto (capa do backend, a mais recente do diário ou, `illustrate`, a ilustração), a próxima
 * ação do backend filtrada pelo critério de "Precisa de atenção" (ou o item de atenção da planta), o último registro.
 */
export function plantPanelProps(input: {
  plant: PlantResponse; summary: (PlantSummary & SummaryV3) | undefined; growName: string | null;
  items: AttentionItem[]; hrefOf: (i: AttentionItem) => string | null; diaryPhoto?: string | null;
  /** Início: sem foto, a ilustração da genética (como antes). Plantas: "SEM FOTO" e o botão "FOTO" (item 22). */
  illustrate: boolean; detailedTags?: boolean;
}): PlantPanelProps {
  const { plant, summary: s } = input;
  const icon = phaseIcon(plant.current_phase), day = s?.phase_day ?? phaseDay(plant);
  const latest = s?.latest_photo_url ?? input.diaryPhoto ?? null;
  const cover = s?.cover_image_url ?? latest;
  const photo = cover ? { src: cover, real: !!latest && cover === latest }
    : input.illustrate ? { src: s?.strain_image_url || `/figma/plant-${plantIllustration(plant.id)}.png`, real: false }
      : s?.strain_image_url ? { src: s.strain_image_url, real: false } : null;
  const fromBackend = backendNextAction(s);
  const local = fromBackend === undefined ? nextAction(plant.id, input.items, s?.last_watering_at) : null;
  const next = fromBackend ? { label: nextMarker(fromBackend, s?.last_watering_at), href: fromBackend.watering ? routes.plantDiary(plant.id) : routes.bobbyObservation(plant.id) }
    : local ? { label: nextMarker({ text: local.text, watering: local.tag === "REGA" }, s?.last_watering_at), href: input.hrefOf(local) } : null;
  const lastIso = s?.last_event?.event_date ?? s?.last_event_at;
  const genetics = input.detailedTags
    ? [plant.strain_name || "Genética não informada", plant.genetics ? GENETICS[plant.genetics] : null, STRAIN_TYPE[plant.strain_type] ?? null].filter(Boolean).join(" · ")
    : plant.strain_name || null;
  return {
    name: plantDisplayName(plant), href: routes.plant(plant.id), photo,
    tags: [genetics, input.growName].filter((t): t is string => !!t),
    phase: icon ? { icon: `/figma/phase-${icon}.svg`, label: PHASE_ICON_LABEL[icon] } : null,
    phaseLine: [icon ? PHASE_ICON_LABEL[icon] : phases[plant.current_phase]?.label ?? "Fase não informada", day && `dia ${day}`].filter(Boolean).join(" · "),
    next, last: lastMarker(lastIso), noRecords: lastIso === null,
    askHref: routes.bobbyWith({ plantId: plant.id }), photoHref: routes.plantPhotos(plant.id), recordHref: routes.plantDiary(plant.id, { novo: true }),
  };
}

export type GrowPanelProps = {
  name: string; lamp: LampState; spec: string | null; temperature: Reading; humidity: Reading;
  vpd: { value: number | null; marker: string } | null;
  light: { onHours: number; offHours: number; marker: string; lit: boolean } | null;
  counts: string | null; phases: string[]; note: string | null; recordHref: string | null; panelHref: string | null;
};

/** O que o GET /grows passa a mandar (contrato do item 22); opcional até o deploy. */
export type GrowNextAction = { action: string; tier: string; message: string; plant_id?: string | null; plant_name?: string | null } | null;

/**
 * Um cartão de ambiente: leituras do `env` (com a faixa, quando vier), a luz pela programação, plantas e vasos, e o
 * primeiro item de atenção do ambiente. Os campos de faixa e medidas são opcionais até o backend mandá-los no GET /grows.
 */
export function growPanelProps(input: {
  grow: { id: string; name: string; grow_type: string; env?: GrowEnvSnapshot | null; pot_count?: number; days_running?: number;
    photoperiod_on_at?: string | null; photoperiod_light_minutes?: number | null; photoperiod_hours?: string | null;
    tent_width_cm?: number | null; tent_depth_cm?: number | null; tent_height_cm?: number | null;
    active_phases?: Record<string, number> | null; next_action?: GrowNextAction };
  plantCount: number; items: AttentionItem[]; minute: number;
  /** Lista de ambientes: "Externo · há 12 dias"; Início: "Indoor · 80×80×160". */
  showDays?: boolean;
}): GrowPanelProps {
  const { grow } = input;
  const temperature = environmentMeasurement(grow.env, "temperature"), humidity = environmentMeasurement(grow.env, "humidity"), vpd = environmentMeasurement(grow.env, "vpd");
  const out = (key: string): "acima" | "abaixo" | null => { const it = input.items.find(i => i.key === key); return it ? (/ abaixo /.test(it.title) ? "abaixo" : "acima") : null; };
  const envItem = input.items.find(i => i.tag === "AMBIENTE");
  // A próxima ação do ambiente (backend), com o critério de "Precisa de atenção": só critical e anomaly.
  const na = grow.next_action && (grow.next_action.tier === "critical" || grow.next_action.tier === "anomaly") ? grow.next_action : null;
  const outdoor = grow.grow_type === "outdoor";
  const dims = grow.tent_width_cm != null && grow.tent_depth_cm != null && grow.tent_height_cm != null ? `${grow.tent_width_cm}×${grow.tent_depth_cm}×${grow.tent_height_cm}` : null;
  const days = input.showDays && grow.days_running != null ? `há ${grow.days_running} ${grow.days_running === 1 ? "dia" : "dias"}` : null;
  const schedule = scheduleFromGrow(grow);
  const progress = dialProgress(schedule.onAt, schedule.light, input.minute);
  const lit = progress.kind === "full" || (progress.kind === "cycle" && progress.lit);
  const on = schedule.light != null ? Math.round(schedule.light / 60) : null;
  const light = !outdoor && on != null && on > 0
    ? {
      onHours: on, offHours: 24 - on, lit,
      marker: progress.kind === "full" ? "Luz acesa · o dia todo"
        : progress.kind === "cycle" ? (progress.lit ? `Luz acesa · faltam ${durationLabel(progress.remaining)}` : `Luz apagada · liga às ${formatClock(schedule.onAt!)}`)
          : `Luz · ${on}h por dia`,
    }
    : null;
  const pots = grow.pot_count;
  return {
    name: grow.name,
    lamp: envItem || na ? "attention" : temperature.value == null && humidity.value == null ? "none" : "ok",
    spec: [GROW_TYPE[grow.grow_type] ?? null, dims ?? days].filter(Boolean).join(" · ") || null,
    temperature: { label: "Temperatura", unit: "°", value: temperature.value == null ? null : whole(temperature.value), marker: readingMarker(temperature, out("range-temperature")) },
    humidity: { label: "Umidade", unit: "%", value: humidity.value == null ? null : whole(humidity.value), marker: readingMarker(humidity, out("range-humidity")) },
    vpd: outdoor ? null : { value: vpd.value, marker: vpd.value == null ? "Sem leitura" : vpd.source === "sensor" ? "Sensor" : "Calculado" },
    light,
    counts: [input.plantCount ? `${input.plantCount} ${input.plantCount === 1 ? "planta" : "plantas"}` : null, pots ? `${pots} ${pots === 1 ? "vaso" : "vasos"}` : null].filter(Boolean).join(" · ") || null,
    phases: Object.entries(grow.active_phases ?? {}).filter(([, n]) => n > 0).map(([k, n]) => `${n > 1 ? `${n} · ` : ""}${phases[k]?.label ?? k}`),
    note: envItem ? `${envItem.title}: ${envItem.meta.split(" · ").slice(0, 2).join(", ")}.` : na ? `${na.plant_name ? `${na.plant_name}: ` : ""}${na.message}` : null,
    recordHref: routes.growReading(grow.id), panelHref: routes.growPanel(grow.id),
  };
}
