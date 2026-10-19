"use client";

import React, { useState, useEffect } from "react";
import { useProcurement, ActiveTab } from "@/context/ProcurementContext";
import { DashboardModule } from "@/components/DashboardModule";
import { EqualizationMapModule } from "@/components/EqualizationMapModule";
import { VendorsCrmModule } from "@/components/VendorsCrmModule";
import { PurchaseOrdersModule } from "@/components/PurchaseOrdersModule";
import { DataMigrationModule } from "@/components/DataMigrationModule";
import { CommandPalette } from "@/components/CommandPalette";
import {
  ExecutiveReportModal,
  ExecutiveReportInlineView,
} from "@/components/ExecutiveReportModal";
import {
  CatalogModule,
  SpreadsheetImportModal,
  NewPurchaseRequestModal,
} from "@/components/CatalogAndModals";
import {
  LayoutDashboard,
  Scale,
  Users2,
  FileCheck2,
  Database,
  FileText,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Search,
  Package,
} from "lucide-react";

export function AppShell() {
  const {
    activeTab,
    setActiveTab,
    toasts,
    removeToast,
    resetDemoData,
    setIsCommandPaletteOpen,
  } = useProcurement();

  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewScModal, setShowNewScModal] = useState(false);
  const [showExecutiveReportModal, setShowExecutiveReportModal] =
    useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        if (e.key === "1") {
          e.preventDefault();
          setActiveTab("dashboard");
        } else if (e.key === "2") {
          e.preventDefault();
          setActiveTab("equalizer");
        } else if (e.key === "3") {
          e.preventDefault();
          setActiveTab("vendors");
        } else if (e.key === "4") {
          e.preventDefault();
          setActiveTab("orders");
        } else if (e.key === "5") {
          e.preventDefault();
          setActiveTab("migration");
        } else if (e.key === "6") {
          e.preventDefault();
          setActiveTab("reports");
        } else if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          setShowNewScModal(true);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTab]);

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: "dashboard",
      label: "Visão Geral",
      icon: LayoutDashboard,
    },
    {
      id: "equalizer",
      label: "Solicitações & Cotações",
      icon: Scale,
    },
    {
      id: "vendors",
      label: "Fornecedores & Vendedores",
      icon: Users2,
    },
    {
      id: "orders",
      label: "Ordens de Compra",
      icon: FileCheck2,
    },
    {
      id: "migration",
      label: "Migração de Planilhas (Excel)",
      icon: Database,
    },
    {
      id: "reports",
      label: "Relatórios para Diretoria",
      icon: FileText,
    },
  ];

  const activeLabel =
    navItems.find((i) => i.id === activeTab)?.label ||
    (activeTab === "catalog" ? "Catálogo de Obras & Insumos" : "Visão Geral");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900 print:h-auto print:w-auto print:overflow-visible">
      {/* BARRA LATERAL FIXA À ESQUERDA (w-60) - LIMPA E DIRETA */}
      <aside className="no-print print:hidden w-60 bg-white border-r border-slate-300 flex flex-col justify-between shrink-0 h-full overflow-y-auto">
        <div className="space-y-5">
          {/* Identidade da Construtora */}
          <div className="h-16 px-5 border-b border-slate-300 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm shrink-0">
              JB
            </div>
            <div className="leading-snug min-w-0">
              <div className="font-bold text-base text-slate-900 truncate">
                JC Bauer
              </div>
              <div className="text-sm text-slate-700 truncate">
                Suprimentos & Obras
              </div>
            </div>
          </div>

          {/* Ação Rápida: Nova Solicitação */}
          <div className="px-4 space-y-2.5">
            <button
              onClick={() => setShowNewScModal(true)}
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nova Solicitação</span>
            </button>

            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full py-2 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-sm flex items-center gap-2 transition"
            >
              <Search className="w-4 h-4 text-slate-700 shrink-0" />
              <span>Buscar (Ctrl+K)</span>
            </button>
          </div>

          {/* 6 Módulos Principais */}
          <nav className="px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition text-left ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-white" : "text-slate-700"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <div className="pt-3 mt-3 border-t border-slate-200">
              <button
                onClick={() => setActiveTab("catalog")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition text-left ${
                  activeTab === "catalog"
                    ? "bg-slate-200 text-slate-900 font-semibold"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Package className="w-4 h-4 shrink-0 text-slate-700" />
                <span className="truncate">Catálogo & 11 Disciplinas</span>
              </button>
            </div>
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="p-4 border-t border-slate-300 space-y-3">
          <button
            onClick={resetDemoData}
            className="w-full px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-2 transition font-medium"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Restaurar Dados Demo</span>
          </button>

          <div className="px-2 pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900">Rafael Mendes</span>
            <span className="text-emerald-800 font-semibold">Suprimentos</span>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO À DIREITA DA SIDEBAR (ENQUADRAMENTO 100% NO MONITOR) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100 print:overflow-visible">
        {/* Cabeçalho Superior Responsivo sem cortar botões à direita */}
        <header className="no-print print:hidden bg-white border-b border-slate-300 flex flex-wrap items-center justify-between gap-4 px-6 py-4 w-full shrink-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">
              {activeLabel}
            </h1>
            <span className="hidden xl:inline-block text-sm text-slate-700 truncate">
              • Gestão Corporativa de Suprimentos e Engenharia
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeTab !== "equalizer" && (
              <button
                onClick={() => setActiveTab("equalizer")}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 flex items-center gap-2 transition whitespace-nowrap"
              >
                <Scale className="w-4 h-4 shrink-0" />
                <span>Solicitações & Cotações</span>
              </button>
            )}

            <button
              onClick={() => setShowExecutiveReportModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-2 transition whitespace-nowrap"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Imprimir Relatório para Diretoria (PDF)</span>
            </button>
          </div>
        </header>

        {/* Área de Rolagem Interna Principal */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 w-full min-w-0 print:p-0 print:overflow-visible">
          <div className="w-full max-w-[1800px] mx-auto min-w-0">
            {activeTab === "dashboard" && (
              <DashboardModule
                onOpenNewScModal={() => setShowNewScModal(true)}
                onOpenExecutiveReport={() => setShowExecutiveReportModal(true)}
              />
            )}
            {activeTab === "equalizer" && (
              <EqualizationMapModule
                onOpenExecutiveReport={() => setShowExecutiveReportModal(true)}
              />
            )}
            {activeTab === "vendors" && (
              <VendorsCrmModule
                onOpenImportModal={() => setActiveTab("migration")}
              />
            )}
            {activeTab === "orders" && <PurchaseOrdersModule />}
            {activeTab === "catalog" && (
              <CatalogModule
                onOpenImportModal={() => setActiveTab("migration")}
              />
            )}
            {activeTab === "migration" && <DataMigrationModule />}
            {activeTab === "reports" && <ExecutiveReportInlineView />}
          </div>
        </main>
      </div>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette />

      {/* Executive Report A4 Modal (PDF / Print for Board Meeting) */}
      <ExecutiveReportModal
        isOpen={showExecutiveReportModal}
        onClose={() => setShowExecutiveReportModal(false)}
      />

      {/* Modals */}
      <SpreadsheetImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      <NewPurchaseRequestModal
        isOpen={showNewScModal}
        onClose={() => setShowNewScModal(false)}
      />

      {/* Notificações Toast Limpas */}
      <div className="no-print fixed bottom-5 right-5 z-50 space-y-2.5 max-w-md w-full pointer-events-none print:hidden">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto p-4 rounded-xl bg-white border border-slate-300 shadow-lg flex items-start justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              {t.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
              ) : t.type === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
              )}
              <div>
                <div className="text-sm font-bold text-slate-900">
                  {t.title}
                </div>
                {t.description && (
                  <div className="text-sm text-slate-700 mt-0.5 leading-relaxed">
                    {t.description}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-700 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
