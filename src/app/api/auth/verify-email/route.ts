import { tokenRoute } from "@/lib/server/token-route";

export const POST = tokenRoute("/auth/verify-email");
