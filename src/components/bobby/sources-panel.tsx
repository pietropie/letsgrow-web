"use client";

import Link from "next/link";
import { SidePanel } from "@/components/side-panel";
import { SOURCE_COLOR, type MessageSource } from "./ui";

const KIND_LABEL: Record<string, string> = { event: "REGISTRO DO DIÁRIO", environment_reading: "REGISTRO DO AMBIENTE", knowledge: "GUIA · BASE DE CONHECIMENTO", photo: "FOTO ENVIADA" };

/**
 * W11 "De onde veio isto": um cartão por fonte, com o tipo, o título, a data e "Abrir registro" quando o registro tem
 * tela. Também é a lista "Registros usados" depois de um aviso de registro errado (B7). Na web é sempre o painel
 * lateral (no W11 ele empurra a conversa a partir de 1360 px; aqui sobrepõe em todas as larguras).
 */
export function SourcesPanel({ open, onClose, sources, afterFeedback = false }: { open: boolean; onClose: () => void; sources: MessageSource[]; afterFeedback?: boolean }) {
  return (
    <SidePanel open={open} onClose={onClose} title={afterFeedback ? "Registros usados" : "De onde veio isto"}
      subtitle={afterFeedback ? "Seu aviso foi enviado. Abra um registro para conferir ou corrigir." : "O que o Bobby leu para esta resposta."}>
      {!sources.length && <p className="text-sm text-text-secondary">Esta resposta não citou registros.</p>}
      {sources.map(src => (
        <article key={src.key} className="flex flex-col gap-1.5 rounded-xl border border-stroke bg-surface p-3">
          <span className="font-label self-start px-1.5 text-[13px] leading-4 text-display" style={{ background: SOURCE_COLOR[src.tone] }}>{KIND_LABEL[src.kind] ?? "FONTE"}</span>
          <p className="text-base leading-[22px] font-semibold text-text-primary">{src.label}</p>
          <p className="text-[13px] leading-4 text-text-secondary">{src.kind === "knowledge" ? "Trecho da base de conhecimento" : src.kind === "photo" ? "Enviada nesta conversa" : src.date ? "Registrado por você" : "Sem data"}</p>
          {src.href && <Link href={src.href} onClick={onClose} className="self-start text-sm font-semibold text-primary hover:underline">Abrir registro</Link>}
        </article>
      ))}
    </SidePanel>
  );
}
