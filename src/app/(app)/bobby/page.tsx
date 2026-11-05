"use client";

/* eslint-disable @next/next/no-img-element */
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AssistantMessage, BobbyWelcome, Composer, ContextPanel, ConversationList, FeedbackPanel, InlineCard, ManageConversationPanel, MessageBubble, ThinkingMessage, type DrawerConversation, type MessageAction, type MessageSource } from "@/components/bobby/ui";
import { SourcesPanel } from "@/components/bobby/sources-panel";
import { UsageCompact } from "@/components/usage";
import { ConfirmDialog, Spinner } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { askBobby, getConversation, getPhotoUrl, rateAnswer, regenerateAnswer, requestQuote, useConversations, useCreditBalance, useDeleteConversation, useRenameConversation, type ChatBody } from "@/lib/bobby";
import { useBobAlerts, useGrows, usePlanStatus, usePlantSummaries, usePlants } from "@/lib/hooks";
import { uploadEventPhotos } from "@/lib/photos";
import { routes } from "@/lib/routes";
import { useMe } from "@/lib/session-client";
import { useUsage } from "@/lib/usage-client";
import { useKeyboardInset } from "@/lib/viewport";
import { phases } from "@/shared/constants/theme";
import { creditErrorCode } from "@/shared/lib/accountFeatures";
import { composerFooter, greeting, groupConversations, quoteCard, starterSuggestions, type Suggestion } from "@/shared/lib/bobbyChat";
import { ChatCancelled, FEEDBACK_REASONS, answerSources, StreamFailed, savedRatings, sourceChip, type ChatResult, type ChatSource, type FeedbackReason, type SavedRating } from "@/shared/lib/chatStream";
import { planLimitMessage, rejectionMessage } from "@/shared/lib/errors";
import { phaseDay } from "@/shared/lib/phaseDay";
import { plantDisplayName } from "@/shared/lib/plantIdentity";
import type { ChatMessage } from "@/shared/types/api";
import type { CreditQuote } from "@/shared/types/features";

/** Fotos locais de uma mensagem que está sendo enviada (pré-visualização); as do histórico vêm por `photo_keys`. */
type Message = Omit<ChatMessage, "images"> & { localPhotos?: string[] };
/** Uma pergunta com fotos e contexto, para tentar de novo ou confirmar a cotação mandando a mesma coisa. */
type Task = { text: string; files: File[]; previews: string[]; photoKeys?: string[]; plantId: string | null; growId: string | null; conversationId: string | null; session: number; regenerate?: Message };
type Pending =
  | { kind: "thinking"; status?: string }
  | { kind: "streaming"; text: string; status?: string }
  | { kind: "quote"; quote: CreditQuote; task: Task }
  | { kind: "noCredits"; cost: number; task: Task }
  | { kind: "failed"; task: Task; reason: string | null };

class PhotoUploadFailed extends Error {}
const MAX_PHOTOS = 4;
/** Longe do app mais que isso encerra a sessão de uso: o Bobby volta ao B1 (30 min). */
const SESSION_IDLE_MS = 30 * 60_000;

function UserMessage({ message }: { message: Message }) {
  const keys = message.localPhotos?.length ? [] : message.photo_keys ?? [];
  const urls = useQueries({ queries: keys.map(key => ({ queryKey: ["uploads", "url", "events", key], queryFn: () => getPhotoUrl(key), staleTime: 50 * 60_000 })) });
  return <MessageBubble text={message.content} images={message.localPhotos?.length ? message.localPhotos : urls.map(u => u.data).filter((u): u is string => !!u)} />;
}

/** B2 no celular e no tablet: a gaveta abre da esquerda como <dialog> modal, acima das abas, e fecha com Esc ou tocando fora. */
function Drawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onClose={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-label="Conversas"
      className="m-0 h-dvh max-h-none w-[min(310px,80vw)] max-w-none rounded-r-3xl bg-surface p-0 text-text backdrop:bg-black/40 lg:hidden">
      <div className="flex h-full flex-col px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}

export default function BobbyPage() {
  return <Suspense fallback={<Spinner />}><Bobby /></Suspense>;
}

/**
 * Bobby (UX item 10, Figma "Bobby 2026" B1–B11; desktop W9–W14), web do letsgrow-mobile/app/(app)/ai.tsx: as mesmas
 * regras de envio, streaming, cotação, limite, erro, avaliação e "gerar de novo". No desktop a gaveta de conversas fica
 * fixa à esquerda e a conversa numa coluna de até 760; no celular a gaveta abre pelo ☰.
 * Links: ?pergunta= (envia), ?planta= / ?ambiente= (contexto), ?conversa= (abre uma conversa).
 */
function Bobby() {
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const linkPrompt = params.get("pergunta"), linkPlant = params.get("planta"), linkGrow = params.get("ambiente"), linkConversation = params.get("conversa");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), [previews]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [plantId, setPlantId] = useState<string | null>(linkPlant);
  const [growId, setGrowId] = useState<string | null>(linkPlant ? null : linkGrow);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [stoppable, setStoppable] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [limitDismissed, setLimitDismissed] = useState(false);
  const [opening, setOpening] = useState<{ id: string; failed?: boolean } | null>(null);
  const [panel, setPanel] = useState<"context" | "drawer" | null>(null);
  const [ratings, setRatings] = useState<Record<string, SavedRating>>({});
  const [rateError, setRateError] = useState<string | null>(null);
  const [feedbackFor, setFeedbackFor] = useState<Message | null>(null);
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [sourcesView, setSourcesView] = useState<{ sources: MessageSource[]; afterFeedback?: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [manage, setManage] = useState<DrawerConversation | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DrawerConversation | null>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const sentPrompt = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  // Muda com uma conversa nova ou aberta: uma resposta atrasada da anterior não entra na tela.
  const session = useRef(0);
  const keyboard = useKeyboardInset();
  const usageMeter = useUsage();
  // A saudação depende do nome e da hora do aparelho: só depois de montar, para o HTML do servidor bater com o do navegador.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const me = useMe();
  const balance = useCreditBalance().data;
  const planStatus = usePlanStatus().data;
  const plants = usePlants({ is_active: true }).data;
  const grows = useGrows().data;
  const alerts = useBobAlerts().data?.alerts ?? [];
  const summaries = usePlantSummaries().data;
  const conversations = useConversations(search);
  const rename = useRenameConversation();
  const remove = useDeleteConversation();
  const activeGrows = (grows ?? []).filter(g => g.status === "active");
  const plant = plants?.find(p => p.id === plantId) ?? null;
  const grow = (grows ?? []).find(g => g.id === (plant ? plant.grow_id : growId)) ?? null;

  const footer = composerFooter(balance, planStatus ? { used: planStatus.ai_queries_used, limit: planStatus.ai_queries_per_month, renewsAt: planStatus.ai_queries_renews_at } : null);
  // Com créditos no lugar do limite, só o modo só-plano pausa o envio.
  const paused = footer.limitReached && !balance?.enabled;
  const busy = pending?.kind === "thinking" || pending?.kind === "streaming";

  async function run(task: Task, quoteId?: string) {
    const ctrl = new AbortController();
    controller.current = ctrl;
    const mine = () => task.session === session.current;
    setPending({ kind: "thinking" });
    try {
      let result: ChatResult;
      if (task.regenerate) result = await regenerateAnswer(task.regenerate.id!, quoteId);
      else {
        if (task.files.length && !task.photoKeys) {
          try { task = { ...task, photoKeys: await uploadEventPhotos(task.files, { maxSide: 768, quality: 0.6 }) }; } catch { throw new PhotoUploadFailed(); }
        }
        const body: ChatBody = {
          message: task.text, plant_id: task.plantId ?? undefined, grow_id: task.plantId ? undefined : task.growId ?? undefined,
          conversation_id: task.conversationId ?? undefined, photo_keys: task.photoKeys?.length ? task.photoKeys : undefined, quote_id: quoteId,
        };
        result = (await askBobby(body, {
          onOpen: () => { if (mine()) setStoppable(true); },
          onStatus: text => { if (mine()) setPending(p => p?.kind === "thinking" ? { kind: "thinking", status: text } : p); },
          onDelta: (_, text) => { if (mine()) setPending(p => ({ kind: "streaming", text, status: p && (p.kind === "thinking" || p.kind === "streaming") ? p.status : undefined })); },
        }, ctrl.signal)).result;
      }
      if (!mine()) return;
      if (result.conversation_id) setConversationId(result.conversation_id);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (!task.regenerate && last?.role === "user" && result.user_message_id) next[next.length - 1] = { ...last, id: result.user_message_id };
        return [...next, { id: result.message_id ?? undefined, role: "assistant", content: result.reply || "A resposta veio vazia. Você pode enviar a pergunta novamente.", timestamp: new Date().toISOString(), sources: result.sources }];
      });
      setPending(null);
    } catch (e) {
      if (!mine()) return;
      if (e instanceof ChatCancelled) return void giveBack(task);
      if (e instanceof PhotoUploadFailed) return setPending({ kind: "failed", task, reason: "Não foi possível enviar a foto." });
      const code = creditErrorCode(e);
      if (code === "quote_required" || code === "quote_expired" || code === "quote_used") return void askCost(task);
      if (code === "insufficient_credits") {
        const detail = (e as ApiError).response?.data as { detail?: { cost?: number } } | undefined;
        return setPending({ kind: "noCredits", cost: Number(detail?.detail?.cost) || 0, task });
      }
      const limit = planLimitMessage(e);
      if (limit) { setLimitNotice(limit); setLimitDismissed(false); giveBack(task); return; }
      setPending({ kind: "failed", task, reason: e instanceof StreamFailed ? null : rejectionMessage(e) });
    } finally {
      if (controller.current === ctrl) controller.current = null;
      if (mine()) setStoppable(false);
      void client.invalidateQueries({ queryKey: ["ai", "conversations"] });
      void client.invalidateQueries({ queryKey: ["plan-status"] });
      if (quoteId) void client.invalidateQueries({ queryKey: ["credits"] });
    }
  }
  /** O servidor pediu custo confirmado: busca a cotação e mostra (B10) antes de cobrar qualquer coisa. */
  async function askCost(task: Task) {
    setPending({ kind: "thinking" });
    try {
      const q = await requestQuote({ task: "chat_message", plant_id: task.plantId ?? undefined, grow_id: task.plantId ? undefined : task.growId ?? undefined });
      if (task.session !== session.current) return;
      if (!q.required) void run(task);
      else if (!q.sufficient) setPending({ kind: "noCredits", cost: q.cost, task });
      else setPending({ kind: "quote", quote: q, task });
    } catch (e) {
      if (task.session === session.current) setPending({ kind: "failed", task, reason: rejectionMessage(e) });
    }
  }
  /** Desfaz um pedido sem resposta: a pergunta volta ao composer; "gerar de novo" devolve a resposta anterior. */
  function giveBack(task: Task) {
    if (task.regenerate) { const previous = task.regenerate; setMessages(prev => [...prev, previous]); }
    else { setMessages(prev => prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev); setInput(task.text); setFiles(task.files); }
    setPending(null);
  }
  function submit(text = input, context: { plantId: string | null; growId: string | null } = { plantId, growId }, conversation: string | null = conversationId) {
    const clean = text.trim();
    if (!clean || paused || (pending && pending.kind !== "failed")) return;
    if (pending?.kind === "failed") {
      if (pending.task.regenerate) { const previous = pending.task.regenerate; setMessages(prev => [...prev, previous]); }
      else setMessages(prev => prev[prev.length - 1]?.role === "user" ? prev.slice(0, -1) : prev);
    }
    const task: Task = { text: clean, files: [...files], previews: [...previews], ...context, conversationId: conversation, session: session.current };
    setMessages(prev => [...prev, { role: "user", content: clean, localPhotos: task.files.map(f => URL.createObjectURL(f)), timestamp: new Date().toISOString() }]);
    setInput(""); setFiles([]);
    setScrolledUp(false);
    void run(task);
  }
  function regenerate(answer: Message) {
    if (busy || pending || !answer.id) return;
    const question = [...messages].reverse().find(m => m.role === "user");
    setMessages(prev => prev.slice(0, -1));
    void run({ text: question?.content ?? "", files: [], previews: [], plantId, growId, conversationId, session: session.current, regenerate: answer });
  }
  async function rate(answer: Message, rating: "up" | "down", reason?: FeedbackReason, message?: string) {
    if (!conversationId || !answer.id) return false;
    const id = answer.id, before = ratings[id];
    setRatings(r => ({ ...r, [id]: { rating, reason: rating === "down" ? reason ?? null : null } })); setRateError(null);
    try { await rateAnswer(conversationId, id, rating, reason, message); return true; }
    catch (e) {
      setRatings(r => { const next = { ...r }; if (before) next[id] = before; else delete next[id]; return next; });
      setRateError(rejectionMessage(e) ?? "Não foi possível enviar a avaliação.");
      return false;
    }
  }
  async function sendFeedback(reason: FeedbackReason, message: string) {
    const answer = feedbackFor;
    if (!answer) return;
    setFeedbackSending(true);
    const ok = await rate(answer, "down", reason, message);
    setFeedbackSending(false);
    if (!ok) return;
    setFeedbackFor(null);
    if (reason === "wrong_record") setSourcesView({ sources: chips(answer.sources), afterFeedback: true });
  }
  function newConversation() {
    session.current++;
    controller.current?.abort();
    setPanel(null); setConversationId(null); setMessages([]); setPending(null); setInput(""); setFiles([]); setOpening(null); setRatings({}); setRateError(null);
  }
  async function openConversation(id: string) {
    const mine = ++session.current;
    controller.current?.abort();
    setPanel(null); setOpening({ id }); setPending(null); setRatings({}); setRateError(null);
    try {
      // Reler uma resposta salva não chama a IA: não custa nada.
      const detail = await getConversation(id);
      if (mine !== session.current) return;
      setConversationId(id); setPlantId(detail.plant_id ?? null); setGrowId(detail.grow_id ?? null); setMessages(detail.messages ?? []); setRatings(savedRatings(detail.messages ?? [])); setOpening(null);
    } catch {
      if (mine === session.current) setOpening({ id, failed: true });
    }
  }
  function addPhotos(list: FileList | null) {
    if (!list) return;
    setFiles(prev => [...prev, ...Array.from(list).filter(f => f.type.startsWith("image/"))].slice(0, MAX_PHOTOS));
  }
  function pickSuggestion(sg: Suggestion) {
    if (sg.photo) return fileInput.current?.click();
    const context = sg.plantId ? { plantId: sg.plantId, growId: null } : { plantId, growId };
    if (sg.plantId) { setPlantId(sg.plantId); setGrowId(null); }
    submit(sg.prompt ?? sg.title, context);
  }
  function deleteConversation(c: DrawerConversation) {
    remove.mutate(c.id, {
      onSuccess: () => { setConfirmDelete(null); setManage(null); if (c.id === conversationId) newConversation(); },
      onError: e => { setConfirmDelete(null); setManageError(rejectionMessage(e) ?? "Não foi possível apagar a conversa."); void conversations.refetch(); },
    });
  }
  /** B3: só registros (os guias da base de conhecimento não aparecem, pedido do usuário em 2026-11-01); um registro abre a própria tela (diário ou leitura do ambiente). Iguais aparecem uma vez. */
  function chips(sources?: ChatSource[]): MessageSource[] {
    return answerSources(sources).map(src => {
      const chip = sourceChip(src), t = chip.target;
      return { key: `${src.kind}:${src.id}`, label: chip.label, tone: chip.tone, kind: src.kind, title: src.title, date: src.date,
        href: t?.kind === "event" ? routes.diaryEntry(t.plantId, t.eventId) : t?.kind === "reading" ? routes.growReading(t.growId, t.readingId) ?? undefined : undefined };
    });
  }
  function actions(answer: Message, last: boolean): MessageAction[] | undefined {
    if (!answer.id || !conversationId) return undefined;
    const rating = ratings[answer.id]?.rating;
    const reason = FEEDBACK_REASONS.find(r => r.key === ratings[answer.id!]?.reason)?.label;
    return [
      { key: "copy", label: "Copiar resposta", icon: "action-copy", onClick: () => void navigator.clipboard?.writeText(answer.content).catch(() => {}) },
      ...(last ? [{ key: "regenerate", label: "Gerar de novo", icon: "action-regenerate", disabled: busy || !!pending || paused, onClick: () => regenerate(answer) }] : []),
      { key: "up", label: rating === "up" ? "Gostei, marcado" : "Gostei", icon: "action-like", selected: rating === "up", onClick: () => { if (rating !== "up") void rate(answer, "up"); } },
      { key: "down", label: rating === "down" ? `Não gostei, marcado${reason ? `: ${reason}` : ""}` : "Não gostei", icon: "action-dislike", selected: rating === "down", onClick: () => setFeedbackFor(answer) },
    ];
  }

  // UX item 10: o Bobby abre no B1. Longe da aba mais de 30 min encerra a sessão de uso e volta ao B1.
  useEffect(() => {
    let since: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") since = Date.now();
      else { if (since != null && Date.now() - since > SESSION_IDLE_MS) { newConversation(); setPlantId(null); setGrowId(null); } since = null; }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);  
  // Links com conversa abrem a conversa; com pergunta, enviam com o contexto do link numa conversa nova.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (linkConversation) void openConversation(linkConversation);
  }, [linkConversation]);  
  useEffect(() => {
    const text = linkPrompt?.trim() ?? "";
    if (!text || sentPrompt.current === text) return;
    sentPrompt.current = text;
    const ctx = { plantId: linkPlant, growId: linkPlant ? null : linkGrow };
     
    newConversation(); setPlantId(ctx.plantId); setGrowId(ctx.growId);
    submit(text, ctx, null);
    router.replace(routes.bobby()!);
  }, [linkPrompt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => setSearch(query), 300); return () => clearTimeout(t); }, [query]);
  // Sair da tela de vez para a resposta em andamento (nada é salvo nem cobrado).
  useEffect(() => () => controller.current?.abort(), []);
  // Acompanha o fim da conversa enquanto a pessoa não rolou para cima.
  useEffect(() => { const el = listRef.current; if (el && !scrolledUp) el.scrollTop = el.scrollHeight; }, [messages, pending, scrolledUp]);

  const plantName = (id: string | null) => { const p = plants?.find(x => x.id === id); return p ? plantDisplayName(p) : null; };
  const growName = (id: string | null | undefined) => (grows ?? []).find(g => g.id === id)?.name ?? null;
  const contextLabel = plant ? [plantDisplayName(plant), grow?.name].filter(Boolean).join(" · ") : grow?.name ?? "Todos os registros";
  const suggestions = useMemo(() => starterSuggestions({
    alerts,
    plants: (plants ?? []).map(p => ({ id: p.id, name: plantDisplayName(p), growName: growName(p.grow_id), lastWateringAt: summaries?.[p.id]?.last_watering_at ?? null })),
    lastRecordAt: activeGrows.map(g => g.env?.last_event_at).filter((d): d is string => !!d).sort().pop() ?? null,
  }), [alerts, plants, grows, summaries]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupConversations((conversations.data ?? []).map(c => ({
    id: c.id, updated_at: c.updated_at, title: c.title || "Conversa sem título",
    sub: `${plantName(c.plant_id) ?? growName(c.grow_id) ?? "Todos os registros"} · ${c.message_count} ${c.message_count === 1 ? "mensagem" : "mensagens"}`,
  }))), [conversations.data, plants, grows]); // eslint-disable-line react-hooks/exhaustive-deps
  const usage = planStatus?.ai_queries_per_month != null && !(balance?.enabled && balance.replaces_query_limit)
    ? `${planStatus.ai_queries_used} de ${planStatus.ai_queries_per_month} usadas este mês`
    : balance?.enabled ? `Saldo: ${balance.available} ${balance.available === 1 ? "crédito" : "créditos"}` : "Seu plano não tem limite mensal";
  const currentTitle = conversationId ? (conversations.data?.find(c => c.id === conversationId)?.title || "Conversa") : "Nova conversa";
  const current = conversationId ? { id: conversationId, title: currentTitle, sub: "" } : null;

  const lastAnswer = messages.length - 1 - [...messages].reverse().findIndex(m => m.role === "assistant");
  const showLimit = !limitDismissed && (paused || !!limitNotice);
  const footerView = stoppable ? { text: "Toque em parar para interromper a resposta." }
    : rateError ? { text: rateError, error: true }
    : files.length ? { text: `${files.length} de ${MAX_PHOTOS} fotos${balance?.enabled ? " · a análise de fotos pode usar créditos" : ""}` }
    : { text: footer.text, error: footer.limitReached, link: footer.link === "limit" && routes.credits() ? { label: "Ver meu limite", href: routes.credits()! } : null };

  // Mostrador compacto (UX item 16): só enquanto a linha de baixo mostraria o uso, não um aviso do momento.
  const pill = usageMeter.status === "ok" && !stoppable && !rateError && !files.length ? <UsageCompact usage={usageMeter.usage} /> : null;

  function renderPending(p: Pending) {
    if (p.kind === "thinking") return <ThinkingMessage status={p.status} />;
    if (p.kind === "streaming") return <AssistantMessage content={p.text} status={p.status} streaming />;
    if (p.kind === "quote") {
      const card = quoteCard(p.quote, p.task.files.length);
      return <InlineCard title={card.title} body={`${card.body}\n${card.balance}`} primary={{ label: "Confirmar e enviar", onClick: () => void run(p.task, p.quote.quote_id ?? undefined) }} secondary={{ label: "Cancelar", onClick: () => giveBack(p.task) }} />;
    }
    if (p.kind === "noCredits") return <InlineCard tone="error" title="Seu saldo acabou" body={`Esta mensagem precisa de ${p.cost} ${p.cost === 1 ? "crédito" : "créditos"}. Sua pergunta foi preservada e nada foi cobrado.`}
      primary={routes.packs() ? { label: "Ver pacotes", href: routes.packs()! } : undefined} secondary={{ label: "Cancelar", onClick: () => giveBack(p.task) }} />;
    return p.reason
      ? <InlineCard tone="error" title="Bobby não pôde responder" body={`${p.reason}\n${p.task.regenerate ? "A resposta anterior foi mantida." : "Sua pergunta foi preservada."}`} primary={{ label: p.task.regenerate ? "Manter a resposta" : "Voltar à pergunta", onClick: () => giveBack(p.task) }} />
      : <InlineCard tone="error" title="A resposta não chegou" body="Sua pergunta foi preservada. Nenhum crédito ou consulta foi usado." primary={{ label: "Tentar de novo", onClick: () => void run(p.task) }} />;
  }

  const list = (
    <ConversationList groups={groups} currentId={conversationId} loading={conversations.isPending} error={conversations.isError} onRetry={() => void conversations.refetch()}
      query={query} onQuery={setQuery} onManage={c => { setManageError(null); setManage(c); }} onNew={newConversation} onOpen={id => void openConversation(id)}
      usage={usage} memoryHref={routes.bobbyMemory()} usageHref={routes.credits()} />
  );

  return (
    // Celular: entre o cabeçalho (47) e as abas; com o teclado aberto (iPhone), logo acima dele. Desktop: a altura da tela.
    <div className="fixed inset-x-0 top-[calc(47px+env(safe-area-inset-top))] flex md:static md:h-dvh"
      style={{ bottom: keyboard ? keyboard : "calc(66px + max(env(safe-area-inset-bottom), 18px))" }}>
      {/* W9: gaveta fixa de 280 a partir de 1024. */}
      <aside aria-label="Conversas" className="hidden w-[280px] shrink-0 border-r border-stroke bg-bg p-4 lg:block">{list}</aside>
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversa com o Bobby">
        <div className="flex h-12 shrink-0 items-center gap-1 px-1.5 md:h-16 md:px-4">
          <button type="button" aria-label="Conversas" onClick={() => { setPanel("drawer"); void conversations.refetch(); }} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface lg:hidden cursor-pointer"><img src="/figma/menu.svg" alt="" /></button>
          <h1 className="font-label flex-1 truncate text-center text-base text-display md:text-left md:font-sans md:text-lg md:font-semibold md:text-text-primary">
            <span className="md:hidden">BOBBY</span><span className="hidden md:inline">{currentTitle}</span>
          </h1>
          {pill && <div className="hidden md:block">{pill}</div>}
          {current && <button type="button" onClick={() => { setManageError(null); setManage(current); }} className="hidden min-h-10 rounded-lg px-3 text-sm font-semibold text-text-primary hover:bg-surface md:block cursor-pointer">Renomear ou apagar</button>}
          <button type="button" aria-label="Nova conversa" onClick={newConversation} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface cursor-pointer"><img src="/figma/new-chat.svg" alt="" /></button>
        </div>
        <div ref={listRef} onScroll={e => { const el = e.currentTarget; const up = el.scrollHeight - el.scrollTop - el.clientHeight > 240; if (up !== scrolledUp) setScrolledUp(up); }}
          className="relative flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-[18px] px-4 py-2 md:px-6">
            {opening ? (opening.failed
              ? <InlineCard tone="error" title="Não foi possível abrir a conversa" body="Ela continua guardada na sua conta." primary={{ label: "Tentar de novo", onClick: () => void openConversation(opening.id) }} secondary={{ label: "Nova conversa", onClick: newConversation }} />
              : <Spinner />)
              : !messages.length && !pending ? <BobbyWelcome greeting={mounted ? greeting(me.data?.full_name, new Date().getHours()) : ""} suggestions={suggestions} onSuggestion={pickSuggestion} />
              : <>
                {messages.map((m, i) => m.role === "user"
                  ? <UserMessage key={`m${i}`} message={m} />
                  : <AssistantMessage key={`m${i}`} content={m.content} sources={chips(m.sources)} actions={actions(m, i === lastAnswer && i === messages.length - 1)} />)}
                {pending && <div key="pending">{renderPending(pending)}</div>}
              </>}
          </div>
          {scrolledUp && !!messages.length && (
            <button type="button" aria-label="Ir para a mensagem mais recente" onClick={() => setScrolledUp(false)}
              className="sticky bottom-2 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-stroke bg-surface cursor-pointer"><img src="/figma/arrow-down.svg" alt="" /></button>
          )}
        </div>
        <div className="mx-auto w-full max-w-[760px] shrink-0 px-3 pt-2 pb-2 md:px-6 md:pb-4">
          <Composer value={input} onChange={setInput} onSend={() => submit()} onStop={stoppable ? () => controller.current?.abort() : undefined} onAttach={() => fileInput.current?.click()}
            notice={showLimit && <InlineCard tone="error" title={paused && footer.month ? `Você usou as ${footer.limit} consultas de ${footer.month}` : "Limite do seu plano"}
              body={limitNotice && !paused ? limitNotice : `Seu histórico continua aberto.${footer.renews ? ` O limite renova em ${footer.renews}.` : ""}`}
              primary={routes.plans() ? { label: "Ver planos", href: routes.plans()! } : undefined} secondary={{ label: "Entendi", onClick: () => { setLimitDismissed(true); setLimitNotice(null); } }} />}
            contextLabel={contextLabel} contextIcon={plant ? "chip-leaf" : grow ? "context-grow" : "context-all"} onContext={() => setPanel("context")}
            photos={previews} onRemovePhoto={i => setFiles(f => f.filter((_, j) => j !== i))} footer={footerView} usage={pill}
            placeholder={paused ? (footer.renews ? `Envio pausado até ${footer.renews}` : "Envio pausado") : messages.length ? "Pergunte mais" : "Pergunte ao Bobby"}
            paused={paused} sending={busy} />
          {/* B5: no iPhone o seletor oferece câmera e fototeca; até 4 fotos por mensagem. */}
          <input ref={fileInput} type="file" accept="image/*" multiple className="hidden" onChange={e => { addPhotos(e.target.files); e.target.value = ""; }} />
        </div>
      </section>

      {/* Celular e tablet: a gaveta abre como painel. */}
      {panel === "drawer" && <Drawer onClose={() => setPanel(null)}>{list}</Drawer>}
      <ContextPanel open={panel === "context"} onClose={() => setPanel(null)} current={{ plantId, growId: plant ? null : growId }}
        grows={activeGrows.map(g => ({ id: g.id, name: g.name, sub: `${g.active_plant_count} ${g.active_plant_count === 1 ? "planta" : "plantas"}` }))}
        plants={(plants ?? []).map(p => { const day = phaseDay(p); return { id: p.id, name: plantDisplayName(p), sub: [growName(p.grow_id), phases[p.current_phase]?.label ?? "Fase não informada", day && `dia ${day}`].filter(Boolean).join(" · ") }; })}
        onPick={c => { setPlantId(c.plantId); setGrowId(c.growId); setPanel(null); }} />
      {manage && <ManageConversationPanel key={manage.id} conversation={manage} onClose={() => setManage(null)} saving={rename.isPending} error={manageError}
        onRename={title => rename.mutate({ id: manage.id, title }, { onSuccess: () => setManage(null), onError: e => { setManageError(rejectionMessage(e) ?? "Não foi possível confirmar o novo nome. Confira a lista."); void conversations.refetch(); } })}
        onDelete={() => setConfirmDelete(manage)} />}
      <ConfirmDialog open={!!confirmDelete} title="Apagar conversa?" message="A conversa e as avaliações das respostas dela são apagadas. A memória do Bobby não muda."
        confirm="Apagar" destructive busy={remove.isPending} onConfirm={() => confirmDelete && deleteConversation(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      {feedbackFor && <FeedbackPanel key={feedbackFor.id} open onClose={() => setFeedbackFor(null)} initial={feedbackFor.id ? ratings[feedbackFor.id]?.reason : null} reasons={FEEDBACK_REASONS}
        onSubmit={(r, m) => void sendFeedback(r, m)} sending={feedbackSending} error={rateError} />}
      {sourcesView && <SourcesPanel open onClose={() => setSourcesView(null)} sources={sourcesView.sources} afterFeedback={sourcesView.afterFeedback} />}
    </div>
  );
}
