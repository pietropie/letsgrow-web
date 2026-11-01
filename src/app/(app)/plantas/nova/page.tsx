"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ActionRow, BackLink, Button, ButtonLink, ChoiceField, FormError, Notice, PageSubtitle, PageTitle, Spinner, TextField } from "@/components/ui";
import { useCreatePlant, useGrows, useRememberedGrow } from "@/lib/hooks";
import { routes } from "@/lib/routes";
import { parseBrDate } from "@/shared/lib/dates";
import { getErrorMessage, planLimitMessage } from "@/shared/lib/errors";
import { strainTypeOptions } from "@/shared/lib/plantFacts";
import type { PlantResponse } from "@/shared/types/api";

type Step = "name" | "details" | "created";

export default function NewPlantPage() {
  return <Suspense fallback={<Spinner />}><NewPlant /></Suspense>;
}

/** Figma 2160:5792 / 2164:5576 (Adicionar planta), 2160:5834 (Detalhes opcionais) e 2160:5918 (Planta cadastrada). */
function NewPlant() {
  const params = useSearchParams();
  const [remembered] = useRememberedGrow();
  const grows = useGrows();
  const active = (grows.data ?? []).filter(g => g.status === "active");
  const [choice, setChoice] = useState("");
  const growId = choice || (active.find(g => g.id === params.get("ambiente")) ?? active.find(g => g.id === remembered) ?? active[0])?.id || "";
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [strain, setStrain] = useState("");
  const [strainType, setStrainType] = useState<string>("unknown");
  const [startDate, setStartDate] = useState("");
  const [container, setContainer] = useState("");
  const [error, setError] = useState("");
  const [planLimited, setPlanLimited] = useState(false);
  const [created, setCreated] = useState<PlantResponse | null>(null);
  const create = useCreatePlant();
  const grow = active.find(g => g.id === growId);

  function save(e?: FormEvent) {
    e?.preventDefault();
    if (create.isPending) return;
    setPlanLimited(false);
    if (!name.trim()) { setStep("name"); setError("Dê um nome ou apelido à planta."); return; }
    if (!grow) { setError("Escolha um ambiente para a planta."); return; }
    const germination = parseBrDate(startDate);
    if (germination === "invalid") { setStep("details"); setError("Use a data no formato DD/MM/AAAA, sem datas futuras, ou deixe em branco."); return; }
    setError("");
    // O desconhecido fica desconhecido: nenhuma fase, genética ou tipo de semente é inferido.
    create.mutate({ display_name: name.trim(), strain_name: strain.trim(), strain_type: strainType as "unknown", seed_type: "unknown", genetics: null, grow_id: grow.id, pot_label: container.trim() || null, germination_date: germination, current_phase: "unknown" }, {
      onSuccess: plant => { setCreated(plant); setStep("created"); },
      onError: err => { setError(getErrorMessage(err, "Não foi possível salvar a planta. Tente novamente.")); setPlanLimited(!!planLimitMessage(err)); },
    });
  }

  if (step === "created" && created) {
    return (
      <div className="flex max-w-[600px] flex-col gap-4">
        <PageTitle>Planta cadastrada</PageTitle>
        <PageSubtitle>{[created.display_name || created.strain_name, grow?.name].filter(Boolean).join(" · ")}</PageSubtitle>
        <Notice title="Seu histórico começa quando quiser" body="Uma nota já basta. Você também pode voltar depois." />
        <ButtonLink label="Fazer minha primeira nota" href={routes.plantDiary(created.id, { novo: true })!} replace />
        <ButtonLink secondary label="Abrir diário vazio" href={routes.plantDiary(created.id)!} replace />
      </div>
    );
  }
  if (step === "details") {
    return (
      <form className="flex max-w-[600px] flex-col gap-4" noValidate onSubmit={e => { e.preventDefault(); setError(""); setStep("name"); }}>
        <button type="button" onClick={() => setStep("name")} className="flex min-h-11 items-center gap-2 self-start px-1 text-sm font-semibold cursor-pointer">‹ Voltar</button>
        <PageTitle>Detalhes opcionais</PageTitle>
        <PageSubtitle>Não saber também é uma resposta.</PageSubtitle>
        <TextField label="Variedade" placeholder="Não sei" hint="Também chamada de strain." value={strain} onChange={e => setStrain(e.target.value)} autoCapitalize="words" />
        <ActionRow title="Entender os nomes dos campos" body="Uma explicação curta, sem preencher por você." href={routes.termHelp()} />
        <ChoiceField label="Característica informada" hint="Use apenas informações que você conhece." value={strainType} options={[...strainTypeOptions]} onChange={setStrainType} />
        <TextField label="Data inicial" placeholder="Não informada" hint="Você pode completar depois. Formato DD/MM/AAAA." value={startDate} onChange={e => setStartDate(e.target.value)} inputMode="numeric" />
        <TextField label="Recipiente" placeholder="Não informado" hint="Opcional. Não muda a organização do diário." value={container} onChange={e => setContainer(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" label="Guardar e voltar" />
        <Button secondary label="Pular detalhes" onClick={() => { setStrain(""); setStrainType("unknown"); setStartDate(""); setContainer(""); setError(""); setStep("name"); }} />
      </form>
    );
  }
  return (
    <form onSubmit={save} className="flex max-w-[600px] flex-col gap-4" noValidate>
      <BackLink fallback={routes.plants()} />
      <PageTitle>Adicionar planta</PageTitle>
      <PageSubtitle>Comece pelo que você sabe.</PageSubtitle>
      <TextField label="Nome ou apelido" placeholder="Minha planta" hint="Você pode mudar depois." value={name} onChange={e => setName(e.target.value)} autoCapitalize="sentences" />
      {grows.isPending ? <Spinner /> : grows.isError ? <Button secondary label="Não foi possível carregar os ambientes. Tentar novamente" onClick={() => void grows.refetch()} />
        : active.length ? <ChoiceField label="Ambiente" hint="Ambiente selecionado neste cadastro." value={growId} options={active.map(g => ({ value: g.id, label: g.name }))} onChange={setChoice} />
        : <><Notice title="Primeiro, um ambiente" body="Toda planta fica em um ambiente. Dê um nome ao seu espaço para continuar." /><ButtonLink secondary label="Começar pelo ambiente" href={routes.newGrow()!} /></>}
      <ActionRow title="Adicionar detalhes opcionais" body="Variedade, datas e outras informações." onClick={() => setStep("details")} />
      <FormError message={error} />
      {planLimited && <PageSubtitle>Os planos podem ser vistos no app no celular.</PageSubtitle>}
      <Button type="submit" label={create.isPending ? "Salvando…" : "Salvar planta"} loading={create.isPending} disabled={!grow} />
      <PageSubtitle>Não precisa informar variedade, foto ou recipiente agora.</PageSubtitle>
    </form>
  );
}
