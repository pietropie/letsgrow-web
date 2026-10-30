import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

/** Figma 2160:5019 — Bem-vindo de volta. */
export default async function LoginPage({ searchParams }: PageProps<"/entrar">) {
  const { de } = await searchParams;
  const next = typeof de === "string" && de.startsWith("/") && !de.startsWith("//") ? de : "/";
  return <LoginForm next={next} />;
}
