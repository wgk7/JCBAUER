"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useProcurement, ActiveTab } from "@/context/ProcurementContext";
import { formatBRL } from "@/lib/formatters";
import { Search, ArrowRight, X } from "lucide-react";

interface CommandItem {
  id: string;
  category: "Cotação / SC" | "Fornecedor / Vendedor" | "Insumo" | "Navegação";
  title: string;
  subtitle: string;
  meta?: string;
  action: () => void;
}

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    purchaseRequests,
    vendors,
    catalog,
    projects,
    setActiveTab,
    setSelectedScId,
  } = useProcurement();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen);
      } else if (e.key === "Escape" && isCommandPaletteOpen) {
        e.preventDefault();
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCommandPaletteOpen, setIsCommandPaletteOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isCommandPaletteOpen]);

  const allItems = useMemo<CommandItem[]>(() => {
    const navs: CommandItem[] = (
      [
        {
          tab: "dashboard" as ActiveTab,
          title: "Ir para Visão Geral",
          sub: "Resumo de solicitações, obras e economia gerada",
        },
        {
          tab: "equalizer" as ActiveTab,
          title: "Ir para Solicitações & Cotações",
          sub: "Tabela comparativa de preços e aprovação de propostas",
        },
        {
          tab: "vendors" as ActiveTab,
          title: "Ir para Fornecedores & Vendedores",
          sub: "Base homologada por disciplina e especialidade",
        },
        {
          tab: "orders" as ActiveTab,
          title: "Ir para Ordens de Compra",
          sub: "Emissão formal de pedidos e envio via WhatsApp",
        },
        {
          tab: "migration" as ActiveTab,
          title: "Ir para Migração de Planilhas (Excel)",
          sub: "Importação e higienização de histórico",
        },
        {
          tab: "reports" as ActiveTab,
          title: "Ir para Relatórios para Diretoria",
          sub: "Relatório executivo pronto para impressão e PDF",
        },
      ] as const
    ).map((n) => ({
      id: `nav-${n.tab}`,
      category: "Navegação",
      title: n.title,
      subtitle: n.sub,
      action: () => {
        setActiveTab(n.tab);
        setIsCommandPaletteOpen(false);
      },
    }));

    const scs: CommandItem[] = purchaseRequests.map((sc) => {
      const proj = projects.find((p) => p.id === sc.project_id);
      return {
        id: `sc-${sc.id}`,
        category: "Cotação / SC",
        title: `${sc.numero_sc} • ${proj?.nome || "Obra"}`,
        subtitle: `${sc.categoria_principal} — Solicitante: ${sc.solicitante}`,
        meta: sc.status,
        action: () => {
          setSelectedScId(sc.id);
          setActiveTab("equalizer");
          setIsCommandPaletteOpen(false);
        },
      };
    });

    const vends: CommandItem[] = vendors.map((v) => {
      const contact = v.contacts[0];
      return {
        id: `vend-${v.id}`,
        category: "Fornecedor / Vendedor",
        title: `${v.nome_fantasia} (${v.cnpj})`,
        subtitle: `Vendedor: ${contact?.nome_vendedor || "-"} • ${
          contact?.telefone || ""
        }`,
        meta: v.categorias_atendidas[0],
        action: () => {
          setActiveTab("vendors");
          setIsCommandPaletteOpen(false);
        },
      };
    });

    const mats: CommandItem[] = catalog.map((c) => ({
      id: `cat-${c.id}`,
      category: "Insumo",
      title: `${c.codigo_insumo} — ${c.descricao}`,
      subtitle: `Disciplina: ${c.categoria} • Unidade: ${c.unidade_medida}`,
      meta: formatBRL(c.preco_referencia),
      action: () => {
        setActiveTab("catalog");
        setIsCommandPaletteOpen(false);
      },
    }));

    return [...scs, ...vends, ...mats, ...navs];
  }, [
    purchaseRequests,
    vendors,
    catalog,
    projects,
    setActiveTab,
    setSelectedScId,
    setIsCommandPaletteOpen,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 10);
    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isCommandPaletteOpen) return null;

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0
          ? (prev - 1 + filteredItems.length) % filteredItems.length
          : 0
      );
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      filteredItems[selectedIndex].action();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-[10vh] p-4"
      onClick={() => setIsCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 py-4 border-b border-slate-300 gap-3">
          <Search className="w-5 h-5 text-slate-700 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDownInput}
            placeholder="Buscar solicitação, insumo, fornecedor, CNPJ ou vendedor..."
            className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-700 focus:outline-none"
          />
          <button
            onClick={() => setIsCommandPaletteOpen(false)}
            className="p-1 text-slate-700 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-200">
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={item.id}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between gap-3 transition ${
                  isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900 truncate">
                    {item.title}
                  </div>
                  <div className="text-sm text-slate-700 truncate">
                    {item.subtitle}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {item.meta && (
                    <span className="text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {item.meta}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-slate-700" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
