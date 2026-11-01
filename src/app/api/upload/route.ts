import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, API_URL, REFRESH_COOKIE, clearSession, isTrustedWrite, refreshTokens, setSession, type Tokens } from "@/lib/server/session";

/**
 * Foto de registro (WEBAPP.md §2.4): o navegador manda o arquivo já reduzido; aqui pedimos a URL pré-assinada à API
 * (POST /uploads/presign, bucket "events") e fazemos o PUT no MinIO do lado do servidor. Assim o bucket não precisa
 * de CORS para a origem web. Devolve { object_key }.
 */
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  if (!isTrustedWrite(req)) return NextResponse.json({ detail: "Origem não permitida" }, { status: 403 });
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  let access = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!refresh) return NextResponse.json({ detail: "Sessão expirada" }, { status: 401 });

  let file: File | null = null;
  try { file = (await req.formData()).get("file") as File | null; } catch { /* corpo inválido */ }
  if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ detail: "Envie a foto no campo file." }, { status: 422 });
  if (!TYPES.has(file.type)) return NextResponse.json({ detail: "Use uma foto JPEG, PNG ou WebP." }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ detail: "A foto passou de 8 MB." }, { status: 413 });

  let renewed: Tokens | null = null;
  const presign = (token?: string) => fetch(`${API_URL}/uploads/presign`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ bucket: "events", content_type: file!.type }),
  });
  try {
    if (!access) { renewed = await refreshTokens(refresh); access = renewed?.access_token; }
    let res = await presign(access);
    if (res.status === 401 && !renewed) { renewed = await refreshTokens(refresh); if (renewed) res = await presign(renewed.access_token); }
    if (res.status === 401) { const out = NextResponse.json({ detail: "Sessão expirada" }, { status: 401 }); clearSession(out); return out; }
    if (!res.ok) return NextResponse.json(await res.json().catch(() => ({ detail: "Não foi possível preparar o envio." })), { status: res.status });
    const { upload_url, object_key } = await res.json();
    const put = await fetch(upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: Buffer.from(await file.arrayBuffer()) });
    if (!put.ok) return NextResponse.json({ detail: "Não foi possível enviar a foto." }, { status: 502 });
    const out = NextResponse.json({ object_key });
    if (renewed) setSession(out, renewed);
    return out;
  } catch {
    return NextResponse.json({ detail: "Não foi possível enviar a foto agora." }, { status: 502 });
  }
}
