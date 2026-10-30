import type { MetadataRoute } from "next";

/** Instalar na tela inicial (iPhone: Compartilhar → Adicionar à Tela de Início). WEBAPP.md §2.5. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LetsGrow",
    short_name: "LetsGrow",
    description: "Registros do seu cultivo e o Bobby, no navegador.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#E2E1E0",
    theme_color: "#E2E1E0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
