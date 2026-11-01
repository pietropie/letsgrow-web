"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { BackLink, Button, ButtonLink, ChoiceField, ConfirmDialog, FormError, PageSubtitle, PageTitle, Spinner, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { useInvalidateDiary, usePlant, useUpdatePlant } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { phases } from "@/shared/constants/theme";
import { formatBrDate, parseBrDate } from "@/shared/lib/dates";
import { getErrorMessage } from "@/shared/lib/errors";
import { phaseOptions, shortPlantName } from "@/shared/lib/plantFacts";
import { plantDisplayName } from "@/shared/lib/plantIdentity";

/** Figma 2160:7604 / 2164:6154 — Informações da planta. Campos vazios ficam como desconhecidos. */
export default function PlantInfoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const plant = usePlant(id);
  const update = useUpdatePlant(id);
  const invalidate = useInvalidateDiary();
  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [start, setStart] = useState("");
  const [container, setContainer] = useState("");
  const [phase, setPhase] = useState("unknown");
  const [error, setError] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const p = plant.data;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (p) { setName(p.display_name ?? ""); setStrain(p.strain_name ?? ""); setStart(formatBrDate(p.germination_date)); setContainer(p.pot_label ?? ""); setPhase(p.current_phase || "unknown"); } }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => router.push(routes.plant(id)!);

  function save(e: FormEvent) {
    e.preventDefault();
    if (update.isPending) return;
    const germination = parseBrDate(start);
    if (germination === "invalid") { setError("Use a data no formato DD/MM/AAAA, sem datas futuras, ou deixe em branco."); return; }
    if (!name.trim() && !strain.trim()) { setError("Informe um nome ou a variedade."); return; }
    setError("");
    update.mutate({ display_name: name.trim() || null, strain_name: strain.trim(), pot_label: container.trim() || null, germination_date: germination, current_phase: phase },
      { onSuccess: back, onError: err => setError(getErrorMessage(err, "Não foi possível salvar. Tente novamente.")) });
  }
  // Fora do Figma: o arquivamento mantém "Plantas arquivadas" alcançável, como no mobile.
  async function archive() {
    setArchiving(true);
    try { await api(`/plants/${id}`, { method: "DELETE" }); await invalidate([id]); setConfirming(false); router.replace(routes.plants()); }
    catch (err) { setConfirming(false); setError(getErrorMessage(err, "Não foi possível arquivar. Tente novamente.")); }
    finally { setArchiving(false); }
  }

  return (
    <form onSubmit={save} className="flex max-w-[600px] flex-col gap-4" noValidate>
      <BackLink fallback={routes.plant(id)!} />
      <PageTitle>{p ? `Informações da ${shortPlantName(plantDisplayName(p))}` : "Informações da planta"}</PageTitle>
      <PageSubtitle>Preencha apenas o que você conhece.</PageSubtitle>
      {plant.isPending ? <Spinner /> : <>
        <TextField label="Nome" placeholder="Minha planta" value={name} onChange={e => setName(e.target.value)} />
        <TextField label="Variedade" placeholder="Não sei" value={strain} onChange={e => setStrain(e.target.value)} autoCapitalize="words" />
        <ChoiceField label="Fase" hint="Registros de fase no diário também atualizam este campo." value={phase} onChange={setPhase}
          options={phaseOptions.some(o => o.value === phase) ? [...phaseOptions] : [...phaseOptions, { value: phase, label: phases[phase]?.label ?? phase }]} />
        <TextField label="Data inicial" placeholder="Não informada" hint="Formato DD/MM/AAAA." value={start} onChange={e => setStart(e.target.value)} inputMode="numeric" />
        <TextField label="Recipiente" placeholder="Não informado" hint="Opcional." value={container} onChange={e => setContainer(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" label={update.isPending ? "Salvando…" : "Salvar informações"} loading={update.isPending} />
        <ButtonLink secondary label="Ajuda com os campos" href={routes.termHelp()} />
        {p?.is_active && <Button secondary label={archiving ? "Arquivando…" : "Arquivar planta"} loading={archiving} onClick={() => setConfirming(true)} />}
        <ConfirmDialog open={confirming} title="Arquivar planta?" message="A planta sai do acompanhamento atual. O histórico continua disponível em Plantas arquivadas."
          confirm="Arquivar" destructive busy={archiving} onConfirm={() => void archive()} onCancel={() => setConfirming(false)} />
      </>}
    </form>
  );
}
