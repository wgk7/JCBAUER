import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JC Bauer • Sistema de Compras e Suprimentos",
  description:
    "Gestão de Compras, Mapa de Cotações, Fornecedores, Ordens de Compra e Relatórios Executivos para Construção Civil.",
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
