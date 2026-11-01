"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { GrowPlaceFlow } from "@/components/home/place-flow";
import { ActionRow, BackLink, Button, ChoiceField, ConfirmDialog, FormError, PageSubtitle, PageTitle, Spinner, TextField } from "@/components/ui";
import { useArchiveGrow, useGrow, useGrows, useRememberedGrow, useUpdateGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { getErrorMessage } from "@/shared/lib/errors";
import { growTypeLabel } from "@/shared/lib/growEquipment";
import { archiveGrowMessage } from "@/shared/lib/growHistory";

const TYPES = ["indoor", "outdoor", "greenhouse"] as const;

/** Figma 2160:6526 — Editar ambiente (nome, localização, tipo de local) e Arquivar (02B A/B/B2). */
export default function EditGrowPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const grow = useGrow(id);
  const grows = useGrows();
  const update = useUpdateGrow(id);
  const archive = useArchiveGrow(id, "archive");
  const [remembered, select] = useRememberedGrow();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("indoor");
  const [error, setError] = useState("");
  const [place, setPlace] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const g = grow.data;
  // Preenche uma vez por ambiente: uma releitura depois de salvar não sobrescreve o que está sendo editado.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (g) { setName(g.name); setType(g.grow_type); } }, [g?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => router.push(routes.growPanel(id)!);

  function save(e: FormEvent) {
    e.preventDefault();
    if (update.isPending) return;
    if (!name.trim()) { setError("O ambiente precisa de um nome."); return; }
    setError("");
    update.mutate({ name: name.trim(), grow_type: type }, { onSuccess: back, onError: err => setError(getErrorMessage(err, "Não foi possível salvar. Tente novamente.")) });
  }

  const active = (grows.data ?? []).filter(x => x.status === "active");
  const plants = active.find(x => x.id === id)?.active_plant_count ?? 0;
  /** O servidor arquiva o ambiente e as plantas ativas numa transação só. */
  function runArchive() {
    archive.mutate(undefined, {
      onSuccess: () => {
        // A escolha passa ao próximo ambiente ativo; sem nenhum, Ambientes mostra "Nenhum ambiente ativo".
        const next = active.find(x => x.id !== id);
        if (remembered === id && next) select(next.id);
        setConfirming(false);
        router.replace(routes.grows());
      },
      onError: err => { setConfirming(false); setError(getErrorMessage(err, "Não foi possível arquivar. Nada foi alterado; tente de novo.")); },
    });
  }

  return (
    <form onSubmit={save} className="flex max-w-[600px] flex-col gap-4" noValidate>
      <BackLink fallback={routes.growPanel(id)!} />
      <PageTitle>Editar ambiente</PageTitle>
      <PageSubtitle>{g?.name ?? ""}</PageSubtitle>
      {grow.isPending ? <Spinner /> : !g ? <Button secondary label="Não foi possível carregar. Tentar novamente" onClick={() => void grow.refetch()} /> : <>
        <TextField label="Nome" value={name} onChange={e => setName(e.target.value)} autoCapitalize="sentences" />
        {/* O local do ambiente dá o clima do Início; abre o mesmo painel (H3, H4). */}
        <ActionRow title="Localização" onClick={() => setPlace(true)}
          body={g.lat != null && g.lon != null ? `${g.location_label ?? "Local do ambiente"} · usada para o clima no Início` : "Não informada · defina para ver o clima no Início"} />
        <ChoiceField label="Tipo de local" hint="Pode ser preenchido depois." value={type} options={TYPES.map(t => ({ value: t, label: growTypeLabel[t] }))} onChange={setType} />
        <FormError message={error} />
        <Button type="submit" label={update.isPending ? "Salvando…" : "Salvar alterações"} loading={update.isPending} />
        <Button secondary label="Cancelar" onClick={back} />
        {/* Longe de "Salvar alterações" de propósito, como "Arquivar planta". */}
        {g.status === "active" && <>
          <div className="mt-6 h-px bg-stroke" />
          <Button secondary label={archive.isPending ? "Arquivando…" : "Arquivar ambiente"} loading={archive.isPending} onClick={() => setConfirming(true)} />
          <PageSubtitle>Sai dos ambientes ativos. As leituras e o diário continuam em Ambientes arquivados.</PageSubtitle>
        </>}
        <GrowPlaceFlow growId={id} growName={g.name} mode={place ? "place" : null} onClose={() => setPlace(false)} canRemove={g.lat != null} />
        <ConfirmDialog open={confirming} title={`Arquivar ${g.name}?`} message={archiveGrowMessage(plants, active.length === 1)} confirm="Arquivar" destructive
          busy={archive.isPending} onConfirm={runArchive} onCancel={() => setConfirming(false)} />
      </>}
    </form>
  );
}
