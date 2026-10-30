import type { Metadata, Viewport } from "next";
import { Figtree, Share_Tech } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { Providers } from "./providers";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "900"], variable: "--font-figtree" });
const shareTech = Share_Tech({ subsets: ["latin"], weight: "400", variable: "--font-share-tech" });

export const metadata: Metadata = {
  title: { default: "LetsGrow", template: "%s · LetsGrow" },
  description: "Registros do seu cultivo e o Bobby, no navegador.",
  applicationName: "LetsGrow",
  appleWebApp: { capable: true, title: "LetsGrow", statusBarStyle: "default" },
  icons: { apple: "/icons/icon-180.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#E2E1E0",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${figtree.variable} ${shareTech.variable} antialiased`}>
      <body className="bg-bg text-text">
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
