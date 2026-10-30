import type { Metadata } from "next";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Confirmar e-mail" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/confirmar-email">) {
  const { email } = await searchParams;
  return <VerifyForm email={typeof email === "string" ? email : ""} />;
}
