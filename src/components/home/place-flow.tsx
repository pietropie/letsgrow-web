"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { PanelOption, SidePanel } from "@/components/side-panel";
import { api } from "@/lib/api";
import { useUpdateGrow } from "@/lib/hooks";
import { roundCoord } from "@/shared/lib/homeClimate";

/**
 * Local do ambiente (H2–H4), web do GrowPlaceFlow do mobile (components/home/HomeSheets.tsx).
 * - "Usar minha localização": uma leitura do navegador, baixa precisão, arredondada a ≈1 km antes de subir.
 *   Sem geocodificação reversa no backend nem no navegador, o nome fica "Local do ambiente".
 * - Permissão negada ou falha: vai direto para a busca de cidade.
 * - Salva com PATCH /grows/{id}; o clima é lido de novo.
 */
export type Place = { name: string; admin1: string | null; country: string | null; lat: number; lon: number; label: string };
export type PlaceMode = "place" | "city" | "locate" | null;

function readPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject(new Error("sem geolocalização")); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 });
  });
}

export function GrowPlaceFlow({ growId, growName, mode, onClose, canRemove = false }: { growId: string; growName: string; mode: PlaceMode; onClose: () => void; canRemove?: boolean }) {
  const update = useUpdateGrow(growId);
  const [sheet, setSheet] = useState<"place" | "city" | null>(null);
  const [denied, setDenied] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setSheet(null); setError(null); onClose(); };

  async function locate() {
    setSheet(null); setLocating(true); setError(null);
    try {
      const pos = await readPosition();
      await update.mutateAsync({ lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude), location_label: null });
      close();
    } catch (e) {
      const geo = e as GeolocationPositionError;
      if (geo?.code === 1) setDenied(true);
      else setError("Não foi possível usar sua localização. Escolha a cidade.");
      setSheet("city");
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    // O modo vem de um clique no Início; abrir o painel ou ler a posição é a resposta a esse clique.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (mode === "locate") void locate();
    else if (mode) { setDenied(false); setError(null); setSheet(mode); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function pick(p: Place) {
    setError(null);
    try { await update.mutateAsync({ lat: p.lat, lon: p.lon, location_label: p.label }); close(); }
    catch { setError("Não foi possível salvar o local. Tente de novo."); }
  }

  async function remove() {
    setError(null);
    try { await update.mutateAsync({ lat: null, lon: null }); close(); }
    catch { setError("Não foi possível remover o local. Tente de novo."); }
  }

  return (
    <>
      <SidePanel open={sheet === "place"} onClose={close} title={`Onde fica a ${growName}?`} subtitle="O clima vem desse local. Vale para este ambiente.">
        <PanelOption selected title={locating ? "Buscando sua localização…" : "Usar minha localização aproximada"} disabled={locating}
          body="O navegador pede permissão uma vez. Guardamos só a coordenada arredondada (≈1 km)." onClick={() => void locate()} />
        <PanelOption title="Buscar cidade" body="Digite o nome da cidade, sem usar a localização." onClick={() => { setDenied(false); setSheet("city"); }} />
        {canRemove && <PanelOption title="Remover local" body="O clima deixa de aparecer no Início." disabled={update.isPending} onClick={() => void remove()} />}
        {!!error && <p role="alert" className="text-xs text-state-error">{error}</p>}
        <p className="text-xs leading-4 text-text-secondary">Sua localização não é enviada a outras pessoas nem guardada em histórico.</p>
      </SidePanel>
      <CitySearch open={sheet === "city"} onClose={close} denied={denied} saving={update.isPending} error={error} onPick={p => void pick(p)} />
      {locating && <p role="status" className="sr-only">Buscando sua localização…</p>}
    </>
  );
}

/** H4 "Buscar cidade": GET /weather/places?q= (2 a 80 letras), depois de uma pausa curta. */
function CitySearch({ open, onClose, denied, saving, error, onPick }: { open: boolean; onClose: () => void; denied: boolean; saving: boolean; error: string | null; onPick: (p: Place) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(t); }, [text]);
  const places = useQuery({
    queryKey: ["weather", "places", q], enabled: open && q.length >= 2, staleTime: 10 * 60_000, retry: false,
    queryFn: () => api<Place[]>(`/weather/places?q=${encodeURIComponent(q)}`),
  });
  return (
    <SidePanel open={open} onClose={() => { setText(""); onClose(); }} title="Buscar cidade"
      subtitle={denied ? "Sem a permissão de localização, você pode escolher a cidade." : "Digite o nome da cidade onde fica o ambiente."}>
      <input aria-label="Nome da cidade" value={text} onChange={e => setText(e.target.value)} placeholder="Nome da cidade" maxLength={80} data-autofocus
        className="min-h-12 rounded-xl border border-input-border bg-white px-3 text-base text-text-primary outline-none focus:border-2 focus:border-primary focus:px-[11px]" />
      <div className="flex flex-col gap-2" aria-live="polite">
        {q.length < 2 ? null
          : places.isPending ? <p className="text-xs text-text-secondary">Buscando…</p>
          : places.isError ? <p className="text-xs text-text-secondary">Não foi possível buscar agora. Tente de novo em alguns minutos.</p>
          : !places.data?.length ? <p className="text-xs text-text-secondary">Nenhuma cidade encontrada.</p>
          : places.data.map(p => <PanelOption key={`${p.lat},${p.lon},${p.name}`} title={p.name} body={[p.admin1, p.country].filter(Boolean).join(", ")} disabled={saving} onClick={() => onPick(p)} />)}
      </div>
      {!!error && <p role="alert" className="text-xs text-state-error">{error}</p>}
    </SidePanel>
  );
}

/** H7 "Qual ambiente mostrar?": um ambiente por vez, lembrado neste navegador. */
export function GrowPicker({ open, onClose, grows, current, onPick, title = "Qual ambiente mostrar?", subtitle = "O Início mostra o clima, a atenção e as plantas de um ambiente por vez. A escolha fica lembrada." }: {
  open: boolean; onClose: () => void; grows: { id: string; name: string; line: string }[]; current: string | null; onPick: (id: string) => void; title?: string; subtitle?: string;
}) {
  return (
    <SidePanel open={open} onClose={onClose} title={title} subtitle={subtitle}>
      {grows.map(g => <PanelOption key={g.id} title={g.name} body={g.line} selected={g.id === current} onClick={() => onPick(g.id)} />)}
    </SidePanel>
  );
}
