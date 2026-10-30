import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { Notice } from "@/components/ui";
import { hasPlaceholders, Markdown, readContent } from "@/lib/server/markdown";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o LetsGrow trata os seus dados pessoais, conforme a LGPD.",
  alternates: { canonical: "/privacidade" },
};
export const dynamic = "force-static";

/**
 * URL pública exigida pela Play Store. O texto vem de content/privacidade.md (rascunho da sessão LOJA,
 * analise-2026-10-16/PRIVACIDADE-RASCUNHO.md); não mude o conteúdo jurídico aqui sem o usuário.
 */
export default function PrivacyPage() {
  const source = readContent("privacidade.md");
  return (
    <LegalPage title="Política de Privacidade do LetsGrow" current="/privacidade">
      {hasPlaceholders(source) && <Notice white title="Versão em revisão" body="Os trechos destacados ainda serão preenchidos." />}
      <Markdown source={source} />
    </LegalPage>
  );
}
