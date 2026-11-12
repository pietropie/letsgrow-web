"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PanelOption, SidePanel } from "@/components/side-panel";
import type { ConversationGroup, Suggestion } from "@/shared/lib/bobbyChat";
import { parseMarkdown, type Inline } from "@/shared/lib/markdown";

/**
 * Bobby 2026 (Figma B1–B11; desktop W9–W14), web do letsgrow-mobile/components/bobby/BobbyUI.tsx. Mesmas medidas,
 * textos e regras; folhas viram painéis laterais (W22).
 */

export function BobbyAuthor({ status }: { status?: string }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/figma/bobby-calm.png" alt="" className="h-7 w-[21px] object-cover" />
      <span className="font-label text-sm leading-[18px] text-display">BOBBY</span>
      {!!status && <span className="min-w-0 truncate text-sm leading-[18px] text-text-secondary">· {status}</span>}
    </div>
  );
}

function InlineText({ parts }: { parts: Inline[] }) {
  return <>{parts.map((p, i) => <span key={i} className={`${p.bold ? "font-semibold" : ""} ${p.italic ? "italic" : ""}`}>{p.text}</span>)}</>;
}

/** Negrito em SemiBold, listas, tabelas simples e títulos em Share Tech 16; blocos a 18 de distância. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-[18px] text-base leading-6 text-text-primary">
      {parseMarkdown(text).map((b, i) => {
        if (b.kind === "heading") return <h3 key={i} className="font-label text-base leading-[22px]"><InlineText parts={b.inline} /></h3>;
        if (b.kind === "paragraph") return <p key={i} className="whitespace-pre-wrap"><InlineText parts={b.inline} /></p>;
        if (b.kind === "table") return (
          <div key={i} className="overflow-x-auto rounded-lg border-[0.5px] border-stroke">
            <table className="w-full text-sm leading-5"><tbody>{b.rows.map((row, r) => <tr key={r} className={r ? "border-t-[0.5px] border-stroke" : ""}>{row.map((cell, c) => r === 0 ? <th key={c} className="px-2 py-1.5 text-left font-semibold">{cell}</th> : <td key={c} className="px-2 py-1.5">{cell}</td>)}</tr>)}</tbody></table>
          </div>
        );
        const List = b.kind === "bullets" ? "ul" : "ol";
        return <List key={i} className={`${b.kind === "bullets" ? "list-disc" : "list-decimal"} pl-6`}>{b.items.map((item, n) => <li key={n}><InlineText parts={item} /></li>)}</List>;
      })}
    </div>
  );
}

/** Mensagem da pessoa: surface/bobby, raio 18 com o canto de baixo à direita em 6; fotos de 88 acima. */
export function MessageBubble({ text, images }: { text: string; images?: string[] }) {
  return (
    <div className="flex flex-col items-end gap-1.5" aria-label={`Você disse: ${text}${images?.length ? `, com ${images.length} ${images.length === 1 ? "foto" : "fotos"}` : ""}`}>
      {!!images?.length && <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">{images.map((src, i) => <img key={i} src={src} alt="" className="h-[88px] w-[88px] rounded-xl object-cover" />)}</div>}
      <div className="max-w-[298px] rounded-[18px] rounded-br-md bg-surface-bobby px-3.5 py-2.5 text-base leading-[22px] whitespace-pre-wrap text-text-primary md:max-w-[480px]">{text}</div>
    </div>
  );
}

export type MessageSource = { key: string; label: string; tone: "watering" | "nutrient" | "photo" | "knowledge" | "other"; href?: string; kind: string; title: string; date: string | null };
export type MessageAction = { key: string; label: string; icon: string; onClick: () => void; selected?: boolean; disabled?: boolean };
export const SOURCE_COLOR: Record<MessageSource["tone"], string> = { watering: "var(--color-state-alert)", nutrient: "var(--color-source-secondary)", photo: "var(--color-state-stable)", knowledge: "var(--color-source-highlight)", other: "var(--color-surface)" };

/**
 * "FONTES · DE ONDE VEIO ISTO ▾" recolhido (pedido do usuário em 2026-11-01, ux/bobby-fontes-recolher.png): sem chips,
 * para não tomar espaço da conversa. Aberto, uma linha de texto pequeno por registro; o que tem tela abre o registro.
 */
function SourceList({ sources }: { sources: MessageSource[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}
        className="font-label flex min-h-8 items-center gap-1 self-start text-sm leading-[18px] text-text-secondary hover:underline cursor-pointer">
        FONTES · DE ONDE VEIO ISTO
        <svg aria-hidden width={14} height={14} viewBox="0 0 20 20" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      </button>
      {open && (
        <ul id={id} aria-label="Fontes desta resposta" className="flex flex-col gap-0.5">
          {sources.map(src => (
            <li key={src.key} className="text-xs leading-[18px] text-text-secondary">
              {src.href ? <Link href={src.href} className="hover:underline">{src.label}</Link> : src.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Resposta do Bobby, sem balão, na largura toda. Enquanto chega, o autor mostra o status e o texto termina com "▍" (B2);
 * fontes e ações vêm com o `done`.
 */
export function AssistantMessage({ content, sources, actions, status, streaming }: { content: string; sources?: MessageSource[]; actions?: MessageAction[]; status?: string; streaming?: boolean }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <BobbyAuthor status={status} />
      <div aria-live={streaming ? "off" : "polite"} aria-busy={streaming || undefined}><Markdown text={streaming ? `${content}▍` : content} /></div>
      {!!sources?.length && <SourceList sources={sources} />}
      {!!actions?.length && (
        <div className="flex gap-0.5">
          {actions.map(a => (
            <button key={a.key} type="button" aria-label={a.label} title={a.label} aria-pressed={a.selected} disabled={a.disabled} onClick={a.onClick}
              className={`flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-40 cursor-pointer ${a.selected ? "bg-source-highlight" : "hover:bg-bg"}`}><img src={`/figma/${a.icon}.svg`} alt="" /></button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ThinkingMessage({ status }: { status?: string }) {
  return <div role="status" aria-label={`Bobby está ${status ?? "pensando"}`}><BobbyAuthor status={status ?? "pensando…"} /></div>;
}

type CardButton = { label: string; onClick?: () => void; href?: string };
/** Cartão dentro da conversa (B9 limite, B10 cotação, B11 erro): borda de erro com o ícone de aviso nos problemas. */
export function InlineCard({ tone = "neutral", title, body, primary, secondary }: { tone?: "neutral" | "error"; title: string; body?: string; primary?: CardButton; secondary?: CardButton }) {
  const btn = (b: CardButton, kind: "primary" | "secondary") => {
    const cls = `flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-3.5 text-[15px] font-semibold cursor-pointer ${kind === "primary" ? "bg-primary text-surface hover:bg-primary-dark" : "border border-input-border text-text-primary hover:bg-surface-high"}`;
    return b.href ? <Link href={b.href} className={cls}>{b.label}</Link> : <button type="button" onClick={b.onClick} className={cls}>{b.label}</button>;
  };
  return (
    <div role="status" className={`flex flex-col gap-2 rounded-2xl border bg-surface px-3.5 py-3 ${tone === "error" ? "border-state-error" : "border-stroke"}`}>
      <div className="flex items-center gap-2">{tone === "error" && <img src="/figma/warning.svg" alt="" />}<h3 className="flex-1 text-base leading-[22px] font-semibold text-text-primary">{title}</h3></div>
      {!!body && <p className="text-sm leading-5 whitespace-pre-line text-text-secondary">{body}</p>}
      {(primary || secondary) && <div className="flex gap-2">{primary && btn(primary, "primary")}{secondary && btn(secondary, "secondary")}</div>}
    </div>
  );
}

/** B1: avatar, saudação, a frase e até 4 sugestões, duas por linha. */
export function BobbyWelcome({ greeting, suggestions, onSuggestion }: { greeting: string; suggestions: Suggestion[]; onSuggestion: (s: Suggestion) => void }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col items-center gap-2.5 pt-5 text-center">
        <img src="/figma/bobby-calm.png" alt="" className="h-[84px] w-[63.5px] object-cover" />
        <h1 className="text-[28px] leading-9 font-bold text-text-primary">{greeting}</h1>
        <p className="text-base leading-[22px] text-text-secondary">Pergunte sobre suas plantas e registros. Eu mostro de onde vem cada informação.</p>
      </div>
      {!!suggestions.length && (
        <div className="grid grid-cols-2 gap-2 pt-2.5">
          {suggestions.map(s => (
            <button key={s.key} type="button" onClick={() => onSuggestion(s)} className="flex flex-col gap-1 rounded-2xl border border-stroke bg-surface p-3 text-left hover:border-input-border cursor-pointer">
              <span className="text-sm leading-5 font-semibold text-text-primary">{s.title}</span>
              <span className="text-xs leading-4 text-text-secondary">{s.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type ComposerFooterView = { text: string; error?: boolean; link?: { label: string; href: string } | null };

/**
 * Composer (Figma 2351:15226): chip do contexto, a caixa de raio 24 com "+", o texto, as miniaturas das fotos e o botão
 * redondo de enviar (cinza vazio); durante a resposta vira "parar" (B2). Enter envia; Shift+Enter quebra a linha.
 */
export function Composer({ value, onChange, onSend, onStop, onAttach, contextLabel, contextIcon, onContext, photos, onRemovePhoto, footer, placeholder, paused, sending, notice, usage }: {
  value: string; onChange: (v: string) => void; onSend: () => void; onStop?: () => void; onAttach: () => void;
  contextLabel: string; contextIcon: string; onContext: () => void; photos: string[]; onRemovePhoto: (i: number) => void;
  footer: ComposerFooterView; placeholder: string; paused?: boolean; sending?: boolean; notice?: ReactNode;
  /** M1: no celular, o mostrador compacto toma o lugar da linha de uso; no desktop ele fica no topo da conversa (W23). */
  usage?: ReactNode;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const canSend = !!value.trim() && !paused && !sending;
  // Cresce até 6 linhas (22 × 6), depois rola.
  useEffect(() => { const el = input.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 132)}px`; }, [value]);
  return (
    <div className="flex flex-col gap-2">
      {notice}
      <button type="button" onClick={onContext} aria-label={`Contexto da conversa: ${contextLabel}. Alterar`}
        className="flex min-h-9 max-w-full items-center gap-1.5 self-start rounded-full border border-stroke bg-surface px-3 hover:border-input-border cursor-pointer">
        <img src={`/figma/${contextIcon}.svg`} alt="" className="h-4 w-4" /><span className="truncate text-sm leading-[18px] text-display">{contextLabel}</span><img src="/figma/chip-chevron.svg" alt="" />
      </button>
      <div className={`flex flex-col gap-2 rounded-3xl border border-input-border bg-surface p-2 focus-within:border-primary ${paused ? "opacity-70" : ""}`} onClick={() => input.current?.focus()}>
        {!!photos.length && (
          <div className="flex gap-2 overflow-x-auto px-1">
            {photos.map((src, i) => (
              <div key={src} className="relative shrink-0">
                <img src={src} alt="" className="h-14 w-14 rounded-lg object-cover" />
                <button type="button" aria-label={`Remover foto ${i + 1}`} onClick={e => { e.stopPropagation(); onRemovePhoto(i); }} className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-display cursor-pointer"><img src="/figma/close-small.svg" alt="" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5">
          <button type="button" aria-label="Adicionar fotos" disabled={paused || photos.length >= 4} onClick={e => { e.stopPropagation(); onAttach(); }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-bg disabled:opacity-40 cursor-pointer"><img src="/figma/plus.svg" alt="" /></button>
          <textarea ref={input} rows={1} aria-label={placeholder} value={value} placeholder={placeholder} disabled={paused} enterKeyHint="send"
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) onSend(); } }}
            className="max-h-[132px] min-h-9 flex-1 resize-none bg-transparent py-[7px] text-base leading-[22px] text-text-primary outline-none placeholder:text-text-secondary" />
          {onStop
            ? <button type="button" aria-label="Parar resposta" onClick={onStop} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary cursor-pointer"><img src="/figma/stop.svg" alt="" /></button>
            : <button type="button" aria-label={sending ? "Enviando" : "Enviar"} disabled={!canSend} onClick={onSend}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full cursor-pointer ${canSend ? "bg-primary" : "bg-stroke-soft"}`}><img src="/figma/send-arrow.svg" alt="" /></button>}
        </div>
      </div>
      {usage && <div className="md:hidden">{usage}</div>}
      <p className={`text-center text-xs leading-4 ${footer.error ? "text-state-error" : "text-text-secondary"} ${usage ? "hidden md:block" : ""}`}>
        {footer.text}{footer.link && <> · <Link href={footer.link.href} className="underline">{footer.link.label}</Link></>}
      </p>
    </div>
  );
}

export type DrawerConversation = { id: string; title: string; sub: string };

/**
 * B4 (W9: gaveta fixa de 280 no desktop): "Nova conversa", busca, conversas agrupadas por dia (a atual marcada) e, no pé,
 * Memória e Consultas. Cada conversa tem "⋯" para renomear ou apagar.
 */
export function ConversationList({ groups, currentId, loading, error, onRetry, onNew, onOpen, onManage, query, onQuery, usage, memoryHref, usageHref }: {
  groups: ConversationGroup<DrawerConversation>[]; currentId: string | null; loading?: boolean; error?: boolean; onRetry: () => void;
  onNew: () => void; onOpen: (id: string) => void; onManage: (c: DrawerConversation) => void; query: string; onQuery: (q: string) => void;
  usage: string; memoryHref: string; usageHref: string | null;
}) {
  return (
    <div className="flex h-full flex-col gap-2.5">
      <button type="button" onClick={onNew} className="flex min-h-12 items-center gap-2 rounded-xl bg-primary px-3.5 text-base font-semibold text-surface hover:bg-primary-dark cursor-pointer"><img src="/figma/new-chat-20.svg" alt="" />Nova conversa</button>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-input-border px-3 focus-within:border-primary">
        <img src="/figma/search.svg" alt="" />
        <input type="search" aria-label="Buscar conversas" value={query} onChange={e => onQuery(e.target.value)} placeholder="Buscar conversas" className="flex-1 bg-transparent py-2 text-base leading-[18px] outline-none md:text-sm" />
      </label>
      <nav aria-label="Conversas" className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1">
        {loading ? <p role="status" className="pt-4 text-sm text-text-secondary">Carregando…</p>
          : error ? <><p className="text-[13px] text-text-secondary">Não foi possível carregar as conversas.</p><button type="button" onClick={onRetry} className="self-start rounded-lg px-2.5 py-2 text-[15px] font-semibold cursor-pointer">Tentar novamente</button></>
          : !groups.length ? <p className="text-[13px] text-text-secondary">{query.trim() ? "Nenhuma conversa encontrada." : "Nenhuma conversa guardada ainda."}</p>
          : groups.map(g => (
            <div key={g.label} className="flex flex-col gap-1">
              <h3 className="font-label pt-1.5 text-sm leading-[18px] text-text-secondary">{g.label}</h3>
              {g.items.map(c => (
                <div key={c.id} className={`group flex items-center rounded-[10px] ${c.id === currentId ? "bg-source-highlight" : "hover:bg-bg"}`}>
                  <button type="button" onClick={() => onOpen(c.id)} aria-current={c.id === currentId || undefined} className="flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2 text-left cursor-pointer">
                    <span className="truncate text-[15px] leading-5 font-semibold text-text-primary">{c.title}</span>
                    <span className="truncate text-[13px] leading-4 text-text-secondary">{c.sub}</span>
                  </button>
                  <button type="button" aria-label={`Renomear ou apagar ${c.title}`} onClick={() => onManage(c)} className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg text-display hover:bg-surface cursor-pointer">⋯</button>
                </div>
              ))}
            </div>
          ))}
      </nav>
      <Link href={memoryHref} className="flex flex-col py-1.5 hover:underline"><span className="text-[15px] font-semibold text-text-primary">Memória do Bobby</span><span className="text-[13px] text-text-secondary">O que ele lembra sobre você</span></Link>
      {usageHref ? <Link href={usageHref} className="flex flex-col py-1.5 hover:underline"><span className="text-[15px] font-semibold text-text-primary">Consultas e créditos</span><span className="text-[13px] text-text-secondary">{usage}</span></Link>
        : <div className="flex flex-col py-1.5"><span className="text-[15px] font-semibold text-text-primary">Consultas e créditos</span><span className="text-[13px] text-text-secondary">{usage}</span></div>}
    </div>
  );
}

export type ContextChoice = { growId: string | null; plantId: string | null };
/** B6 "Sobre o que é a conversa?": todos os registros, depois ambientes e plantas, com o atual marcado. */
export function ContextPanel({ open, onClose, grows, plants, current, onPick }: {
  open: boolean; onClose: () => void; grows: { id: string; name: string; sub: string }[]; plants: { id: string; name: string; sub: string }[];
  current: ContextChoice; onPick: (c: ContextChoice) => void;
}) {
  return (
    <SidePanel open={open} onClose={onClose} title="Sobre o que é a conversa?" subtitle="O Bobby usa só os registros do contexto escolhido.">
      <PanelOption title="Todos os registros" body="Todas as plantas e ambientes" selected={!current.growId && !current.plantId} onClick={() => onPick({ growId: null, plantId: null })} />
      {!!grows.length && <h3 className="font-label text-sm text-text-secondary">AMBIENTES</h3>}
      {grows.map(g => <PanelOption key={g.id} title={g.name} body={g.sub} selected={!current.plantId && current.growId === g.id} onClick={() => onPick({ growId: g.id, plantId: null })} />)}
      {!!plants.length && <h3 className="font-label text-sm text-text-secondary">PLANTAS</h3>}
      {plants.map(p => <PanelOption key={p.id} title={p.name} body={p.sub} selected={current.plantId === p.id} onClick={() => onPick({ growId: null, plantId: p.id })} />)}
    </SidePanel>
  );
}

/** B7 "O que não estava certo?": quatro motivos, depois um botão; "Outro motivo" abre um campo de texto. */
export function FeedbackPanel<R extends string>({ open, onClose, reasons, onSubmit, sending, error, initial }: {
  open: boolean; onClose: () => void; reasons: { key: R; label: string; sub: string }[]; initial?: R | null;
  onSubmit: (reason: R, message: string) => void; sending?: boolean; error?: string | null;
}) {
  const [reason, setReason] = useState<R | null>(initial ?? null);
  const [message, setMessage] = useState("");
  const label = reason === "wrong_record" ? "Ver registros usados" : "Enviar aviso";
  return (
    <SidePanel open={open} onClose={onClose} title="O que não estava certo?" subtitle="Seu aviso ajuda o Bobby a não repetir o erro. Nada é alterado sem você confirmar.">
      {reasons.map(r => <PanelOption key={r.key} title={r.label} body={r.sub} selected={reason === r.key} onClick={() => setReason(r.key)} />)}
      {reason === "other" && <textarea aria-label="O que não estava certo" value={message} onChange={e => setMessage(e.target.value)} placeholder="Escreva com suas palavras" maxLength={1000}
        className="min-h-12 rounded-xl border border-input-border bg-white px-3 py-2.5 text-base outline-none focus:border-primary" />}
      {!!error && <p role="alert" className="text-sm text-state-error">{error}</p>}
      <button type="button" disabled={!reason || sending} onClick={() => reason && onSubmit(reason, message)}
        className="min-h-12 rounded-[10px] bg-primary px-3.5 text-base font-semibold text-surface disabled:opacity-50 cursor-pointer">{sending ? "Enviando…" : label}</button>
    </SidePanel>
  );
}

/** Renomear ou apagar uma conversa. Apagar pede confirmação (como "Apagar registro?"). */
export function ManageConversationPanel({ conversation, onClose, onRename, onDelete, saving, error }: {
  conversation: { id: string; title: string } | null; onClose: () => void; onRename: (title: string) => void; onDelete: () => void; saving?: boolean; error?: string | null;
}) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(conversation?.title ?? "");
  const valid = title.trim().length >= 1 && title.trim().length <= 120;
  return (
    <SidePanel open={!!conversation} onClose={onClose} title={renaming ? "Renomear conversa" : conversation?.title ?? ""}>
      {renaming ? <>
        <input aria-label="Nome da conversa" data-autofocus value={title} onChange={e => setTitle(e.target.value)} maxLength={120}
          className="min-h-12 rounded-xl border border-input-border bg-white px-3 text-base outline-none focus:border-primary" />
        {!!error && <p role="alert" className="text-sm text-state-error">{error}</p>}
        <button type="button" disabled={!valid || saving} onClick={() => onRename(title)} className="min-h-12 rounded-[10px] bg-primary px-3.5 text-base font-semibold text-surface disabled:opacity-50 cursor-pointer">{saving ? "Salvando…" : "Salvar"}</button>
      </> : <>
        <PanelOption title="Renomear" body="Mudar o nome na lista" onClick={() => setRenaming(true)} />
        <PanelOption title="Apagar conversa" body="As avaliações das respostas também saem" onClick={onDelete} />
        {!!error && <p role="alert" className="text-sm text-state-error">{error}</p>}
      </>}
    </SidePanel>
  );
}
