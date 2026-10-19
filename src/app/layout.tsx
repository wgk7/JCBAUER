import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JC BAUER • Sistema Integrado de Suprimentos & Obras",
  description:
    "Portal Corporativo de Compras, Mapa de Cotações, Almoxarifado e Obras da JC Bauer Empreendimentos.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#F4F6F8] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
