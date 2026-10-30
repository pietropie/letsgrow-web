import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Nova senha" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/nova-senha">) {
  const { email } = await searchParams;
  return <ResetForm email={typeof email === "string" ? email : ""} />;
}
