import { NextRequest, NextResponse } from "next/server";
import { clearSession, isTrustedWrite } from "@/lib/server/session";

/** O backend não guarda sessão (JWT sem revogação): sair é apagar os cookies deste navegador. */
export async function POST(req: NextRequest) {
  if (!isTrustedWrite(req)) return NextResponse.json({ detail: "Origem não permitida" }, { status: 403 });
  const res = new NextResponse(null, { status: 204 });
  clearSession(res);
  return res;
}
