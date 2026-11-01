"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { NewEventPanel } from "@/components/plants/new-event-panel";
import { ActionRow, BackLink, Button, ButtonLink, Notice, PageSubtitle, PageTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { usePlant } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { dayMonthTime } from "@/shared/lib/dates";
import { shortPlantName } from "@/shared/lib/plantFacts";
import { plantDisplayName } from "@/shared/lib/plantIdentity";

type DiaryPhotoEntry = { id: string; event_date: string; photo_urls: string[]; notes: string | null };

/** Figma 2160:7516 — Fotos da planta (as do próprio diário). */
export default function PlantPhotosPage() {
  const { id } = useParams<{ id: string }>();
  const plant = usePlant(id);
  const [adding, setAdding] = useState(false);
  const [index, setIndex] = useState(0);
  const entries = useQuery({
    queryKey: ["diary", { plant_id: id, photos: true }],
    queryFn: () => api<DiaryPhotoEntry[]>(`/diary?plant_id=${id}&limit=100&include_archived=true`).then(list => list.filter(e => e.photo_urls?.length)),
  });
  const photos = (entries.data ?? []).flatMap(e => e.photo_urls.map(url => ({ url, entry: e })));
  const current = photos[Math.min(index, photos.length - 1)];
  const name = plant.data ? shortPlantName(plantDisplayName(plant.data)) : "planta";
  return (
    <div className="flex max-w-[600px] flex-col gap-4">
      <BackLink fallback={routes.plant(id)!} />
      <PageTitle>Fotos da {name}</PageTitle>
      <PageSubtitle>{photos.length === 1 ? "1 imagem" : `${photos.length} imagens`} · histórico</PageSubtitle>
      {entries.isPending ? <Spinner /> : entries.isError ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void entries.refetch()} />
        : current ? <>
          <img src={current.url} alt={`Foto de ${dayMonthTime(current.entry.event_date, ", ")}`} className="mx-auto aspect-square w-full max-w-[420px] rounded-xl object-cover" />
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((p, i) => <button key={p.url} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)}
                className={`shrink-0 rounded-[10px] border-2 cursor-pointer ${i === index ? "border-primary" : "border-transparent"}`}><img src={p.url} alt="" className="h-14 w-14 rounded-lg object-cover" /></button>)}
            </div>
          )}
          <p className="text-sm text-text-muted">Foto do diário · {dayMonthTime(current.entry.event_date, ", ")}</p>
          <ActionRow title="Revisar o registro associado" body="Data e legenda da imagem." href={routes.diaryEntry(id, current.entry.id)} />
        </> : <Notice title="Nenhuma foto ainda" body="As fotos que você adicionar aos registros do diário aparecem aqui." />}
      {plant.data?.is_active && <Button label={photos.length ? "Adicionar outra foto" : "Adicionar foto"} onClick={() => setAdding(true)} />}
      <ButtonLink secondary label="Voltar ao diário" href={routes.plantDiary(id)!} />
      {adding && plant.data && <NewEventPanel open onClose={() => { setAdding(false); void entries.refetch(); }} plantId={plant.data.id} growId={plant.data.grow_id} />}
    </div>
  );
}
