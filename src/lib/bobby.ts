"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatMessage, ConversationSummary } from "@/shared/types/api";
import type { BobMemory, CreditBalance, CreditQuote } from "@/shared/types/features";
import { ChatCancelled, HttpError, StreamUnavailable, feedbackBody, offensiveFallback, readChatStream, sendChat, type ChatResult, type FeedbackReason, type StreamHandlers } from "@/shared/lib/chatStream";
import { ApiError, WEB_HEADER, api } from "./api";

/**
 * Bobby na web, igual ao letsgrow-mobile/lib/bobbyApi.ts: POST /ai/chat/stream pelo BFF (que repassa o corpo sem buffer)
 * e POST /ai/chat quando o stream não começa. O fetch do navegador entrega o corpo aos poucos (Safari 14.1+).
 * Fechar o AbortController encerra a chamada à API: a reserva volta e nada é cobrado.
 */
const CHAT_TIMEOUT_MS = 120_000;

export type ChatBody = { message: string; plant_id?: string; grow_id?: string; conversation_id?: string; photo_keys?: string[]; quote_id?: string };

async function streamChat(body: ChatBody, handlers: StreamHandlers & { onOpen?: () => void }, signal: AbortSignal): Promise<ChatResult> {
  let res: Response;
  try {
    res = await fetch("/api/bff/ai/chat/stream", {
      method: "POST", signal, cache: "no-store", body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", [WEB_HEADER]: "1" },
    });
  } catch (e) {
    if (signal.aborted) throw new ChatCancelled();
    throw new StreamUnavailable((e as Error)?.message ?? "fetch");
  }
  // Sessão vencida (o BFF já tentou renovar) ou gateway: o POST normal decide e mostra o erro certo.
  if (res.status === 401 || res.status === 502 || res.status === 503 || res.status === 504) throw new StreamUnavailable(`HTTP ${res.status}`);
  if (!res.ok) {
    let data: unknown = null;
    try { data = await res.json(); } catch { /* sem JSON */ }
    throw new HttpError(res.status, data);
  }
  if (!res.body) throw new StreamUnavailable("no body");
  handlers.onOpen?.();
  return readChatStream(res.body.getReader(), handlers, signal);
}

const toResult = (data: Record<string, unknown>): ChatResult => ({
  conversation_id: String(data.conversation_id ?? ""), reply: String(data.reply ?? ""),
  message_id: (data.message_id as string) ?? null, user_message_id: (data.user_message_id as string) ?? null, sources: (data.sources as ChatResult["sources"]) ?? [],
});

/**
 * O sinal de quem chamou mais um tempo-limite. Sem AbortSignal.any (só existe a partir do iOS 17.4): um iPhone com
 * iOS 16 precisa funcionar.
 */
function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  const stop = () => { clearTimeout(timer); ctrl.abort(); };
  if (signal?.aborted) stop(); else signal?.addEventListener("abort", stop, { once: true });
  return ctrl.signal;
}

async function postChat(body: ChatBody, signal: AbortSignal): Promise<ChatResult> {
  return toResult(await api<Record<string, unknown>>("/ai/chat", { method: "POST", body, signal: withTimeout(signal, CHAT_TIMEOUT_MS) }));
}

export function askBobby(body: ChatBody, handlers: StreamHandlers & { onOpen?: () => void }, signal: AbortSignal) {
  return sendChat({ stream: () => streamChat(body, handlers, signal), fallback: () => postChat(body, signal), signal });
}

/** POST /ai/chat/{message_id}/regenerate: só a última resposta; conta como uma mensagem nova (limite ou créditos). */
export async function regenerateAnswer(messageId: string, quoteId?: string): Promise<ChatResult> {
  return toResult(await api<Record<string, unknown>>(`/ai/chat/${messageId}/regenerate`, { method: "POST", body: quoteId ? { quote_id: quoteId } : {}, signal: withTimeout(undefined, CHAT_TIMEOUT_MS) }));
}

/** "Conteúdo ofensivo" vai como "other" com o motivo escrito quando o backend ainda não conhece `offensive` (422). */
export async function rateAnswer(conversationId: string, messageId: string, rating: "up" | "down", reason?: FeedbackReason | null, message?: string | null) {
  const body = feedbackBody(conversationId, messageId, rating, reason, message);
  try {
    return await api("/bob/feedback", { method: "POST", body });
  } catch (e) {
    const fallback = offensiveFallback(body);
    if (!fallback || (e as ApiError).response?.status !== 422) throw e;
    return api("/bob/feedback", { method: "POST", body: fallback });
  }
}

export function requestQuote(body: { task: "chat_message" | "photo_analysis"; plant_id?: string; grow_id?: string }) {
  return api<CreditQuote>("/credits/quote", { method: "POST", body });
}

export type ConversationDetail = { id: string; grow_id: string | null; plant_id: string | null; title: string | null; messages: ChatMessage[]; created_at: string; updated_at: string };
export const getConversation = (id: string) => api<ConversationDetail>(`/ai/conversations/${id}`);

/** As 30 conversas mais recentes; `q` busca no título e no texto. */
export function useConversations(q = "") {
  const term = q.trim();
  return useQuery({
    queryKey: ["ai", "conversations", "list", term], staleTime: 30_000, placeholderData: previous => previous,
    queryFn: () => api<ConversationSummary[]>(`/ai/conversations?limit=30${term ? `&q=${encodeURIComponent(term)}` : ""}`),
  });
}

export function useRenameConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api(`/ai/conversations/${id}`, { method: "PATCH", body: { title: title.trim() } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ai", "conversations"] }),
  });
}

/** Apaga a conversa e as avaliações dela; a memória do Bobby não muda. */
export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/ai/conversations/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ai", "conversations"] }),
  });
}

export function useCreditBalance() {
  return useQuery({ queryKey: ["credits", "balance"], queryFn: () => api<CreditBalance>("/credits/balance"), staleTime: 15_000 });
}

const MEMORIES = ["bob", "memories"] as const;
export function useBobMemories() {
  return useQuery({ queryKey: MEMORIES, queryFn: () => api<BobMemory[]>("/bob/memories") });
}
export function useSaveBobMemory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id?: string; content: string }) => id
      ? api<BobMemory>(`/bob/memories/${id}`, { method: "PATCH", body: { content } })
      : api<BobMemory>("/bob/memories", { method: "POST", body: { content } }),
    onSuccess: () => client.invalidateQueries({ queryKey: MEMORIES }),
  });
}
export function useForgetBobMemory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/bob/memories/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: MEMORIES }),
  });
}
export function useSendBobFeedback() {
  return useMutation({
    mutationFn: (body: { message: string; plant_id?: string; grow_id?: string; alert_id?: string; evidence_ids?: string[] }) => api("/bob/feedback", { method: "POST", body }),
  });
}

/** Link temporário para ver uma foto guardada (bucket events). */
export const getPhotoUrl = (key: string) => api<{ url: string }>(`/uploads/url?bucket=events&key=${encodeURIComponent(key)}`).then(r => r.url);
