"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Project,
  ItemCatalog,
  Vendor,
  PurchaseRequest,
  Quotation,
  PurchaseOrder,
  VendorEvaluation,
  InsumoCategory,
  UnidadeMedida,
  TechnicalPackageDetails,
} from "@/types/procurement";
import {
  INITIAL_PROJECTS,
  INITIAL_ITEMS_CATALOG,
  INITIAL_VENDORS,
  INITIAL_PURCHASE_REQUESTS,
  INITIAL_QUOTATIONS,
  INITIAL_PURCHASE_ORDERS,
  ALL_CATEGORIES,
} from "@/data/mockData";
import {
  StagingRow,
  FuzzyDuplicateCluster,
} from "@/lib/legacySanitizer";

export type ActiveTab =
  | "dashboard"
  | "equalizer"
  | "vendors"
  | "orders"
  | "catalog"
  | "migration"
  | "reports";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: "success" | "info" | "warning" | "error";
}

interface ProcurementContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedScId: string;
  setSelectedScId: (id: string) => void;
  selectedOcId: string | null;
  setSelectedOcId: (id: string | null) => void;
  selectedProjectFilter: string;
  setSelectedProjectFilter: (projectId: string) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;

  projects: Project[];
  catalog: ItemCatalog[];
  vendors: Vendor[];
  purchaseRequests: PurchaseRequest[];
  quotations: Quotation[];
  purchaseOrders: PurchaseOrder[];

  toasts: ToastMessage[];
  addToast: (
    title: string,
    description?: string,
    type?: "success" | "info" | "warning" | "error"
  ) => void;
  removeToast: (id: string) => void;

  updateQuotationItem: (
    quotationId: string,
    requestItemId: string,
    updates: {
      preco_unitario?: number;
      aliquota_ipi_icms?: number;
      marca_oferecida?: string;
    }
  ) => void;

  updateQuotationHeader: (
    quotationId: string,
    updates: {
      prazo_entrega_dias?: number;
      condicao_pagamento?: string;
      tipo_frete?: "CIF" | "FOB";
      valor_frete?: number;
      desconto_negociado?: number;
    }
  ) => void;

  updateTechnicalPackage: (
    quotationId: string,
    updates: Partial<TechnicalPackageDetails>
  ) => void;

  pasteExcelIntoQuotation: (quotationId: string, rawClipboard: string) => number;

  approveQuotationAndGenerateOC: (quotationId: string) => PurchaseOrder | null;

  addVendorNote: (vendorId: string, contactId: string, newNote: string) => void;

  addVendorEvaluation: (
    vendorId: string,
    evaluation: Omit<VendorEvaluation, "id" | "data">
  ) => void;

  addVendor: (newVendor: Vendor) => void;

  importCatalogFromText: (rawText: string) => number;
  importVendorsFromText: (rawText: string) => number;

  commitSanitizedMigration: (
    rows: StagingRow[],
    clusters: FuzzyDuplicateCluster[],
    simulateRollbackError?: boolean
  ) => {
    success: boolean;
    vendorsAdded: number;
    materialsAdded: number;
    ordersAdded: number;
  };

  createPurchaseRequest: (sc: PurchaseRequest, vendorIdsToQuote: string[]) => void;

  updatePurchaseOrderStatus: (
    ocId: string,
    status: PurchaseOrder["status"],
    deAcordo?: boolean
  ) => void;

  resetDemoData: () => void;
}

const ProcurementContext = createContext<ProcurementContextType | undefined>(
  undefined
);

const STORAGE_KEY = "jc_bauer_procurement_v3";

export function ProcurementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [selectedScId, setSelectedScId] = useState<string>("sc-01");
  const [selectedOcId, setSelectedOcId] = useState<string | null>("oc-01");
  const [selectedProjectFilter, setSelectedProjectFilter] =
    useState<string>("ALL");
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] =
    useState<boolean>(false);

  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [catalog, setCatalog] = useState<ItemCatalog[]>(INITIAL_ITEMS_CATALOG);
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_VENDORS);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>(
    INITIAL_PURCHASE_REQUESTS
  );
  const [quotations, setQuotations] =
    useState<Quotation[]>(INITIAL_QUOTATIONS);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(
    INITIAL_PURCHASE_ORDERS
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    title: string,
    description?: string,
    type: "success" | "info" | "warning" | "error" = "success"
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.projects) setProjects(parsed.projects);
        if (parsed.catalog) setCatalog(parsed.catalog);
        if (parsed.vendors) setVendors(parsed.vendors);
        if (parsed.purchaseRequests)
          setPurchaseRequests(parsed.purchaseRequests);
        if (parsed.quotations) setQuotations(parsed.quotations);
        if (parsed.purchaseOrders) setPurchaseOrders(parsed.purchaseOrders);
      }
    } catch {
      // Fallback to initial data
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          projects,
          catalog,
          vendors,
          purchaseRequests,
          quotations,
          purchaseOrders,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [projects, catalog, vendors, purchaseRequests, quotations, purchaseOrders]);

  const updateQuotationItem = (
    quotationId: string,
    requestItemId: string,
    updates: {
      preco_unitario?: number;
      aliquota_ipi_icms?: number;
      marca_oferecida?: string;
    }
  ) => {
    const sc = purchaseRequests.find(
      (r) => r.id === quotations.find((q) => q.id === quotationId)?.sc_id
    );
    const reqItem = sc?.items.find((i) => i.id === requestItemId);
    const qtd = reqItem ? reqItem.quantidade : 1;

    setQuotations((prev) =>
      prev.map((q) => {
        if (q.id !== quotationId) return q;
        return {
          ...q,
          items: q.items.map((item) => {
            if (item.request_item_id !== requestItemId) return item;
            const novoUnit =
              updates.preco_unitario !== undefined
                ? updates.preco_unitario
                : item.preco_unitario;
            const novoImposto =
              updates.aliquota_ipi_icms !== undefined
                ? updates.aliquota_ipi_icms
                : item.aliquota_ipi_icms;
            const novaMarca =
              updates.marca_oferecida !== undefined
                ? updates.marca_oferecida
                : item.marca_oferecida;
            const novoTotal = qtd * novoUnit * (1 + novoImposto / 100);
            return {
              ...item,
              preco_unitario: novoUnit,
              aliquota_ipi_icms: novoImposto,
              marca_oferecida: novaMarca,
              valor_total_item: Number(novoTotal.toFixed(2)),
            };
          }),
        };
      })
    );
  };

  const updateQuotationHeader = (
    quotationId: string,
    updates: {
      prazo_entrega_dias?: number;
      condicao_pagamento?: string;
      tipo_frete?: "CIF" | "FOB";
      valor_frete?: number;
      desconto_negociado?: number;
    }
  ) => {
    setQuotations((prev) =>
      prev.map((q) => (q.id === quotationId ? { ...q, ...updates } : q))
    );
  };

  const updateTechnicalPackage = (
    quotationId: string,
    updates: Partial<TechnicalPackageDetails>
  ) => {
    setQuotations((prev) =>
      prev.map((q) => {
        if (q.id !== quotationId) return q;
        const currentPkg: TechnicalPackageDetails = q.pacote_tecnico || {
          valor_fornecimento_material: 0,
          valor_mao_de_obra_instalacao: 0,
          valor_art_rrt_projetos: 0,
          prazo_fabricacao_engenharia_dias: 30,
          prazo_montagem_canteiro_dias: 30,
          condicao_medicao_desembolso: q.condicao_pagamento || "Conforme Medição Física (BM)",
          garantia_anos: 5,
          detalhe_garantia: "Garantia contratual técnica conforme NBR.",
          assistencia_tecnica_local: "Atendimento técnico regional.",
          escopo_incluso: "Escopo turn-key conforme projeto executivo.",
          ressalvas_aditivos: "Nenhuma exclusão apontada.",
          cumpre_integralmente_escopo: true,
        };

        const mergedPkg = { ...currentPkg, ...updates };
        const novoSubtotalPacote =
          mergedPkg.valor_fornecimento_material +
          mergedPkg.valor_mao_de_obra_instalacao +
          mergedPkg.valor_art_rrt_projetos;
        const novoPrazoTotal =
          mergedPkg.prazo_fabricacao_engenharia_dias +
          mergedPkg.prazo_montagem_canteiro_dias;

        return {
          ...q,
          prazo_entrega_dias: novoPrazoTotal,
          condicao_pagamento: mergedPkg.condicao_medicao_desembolso,
          pacote_tecnico: mergedPkg,
          items: q.items.map((it, idx) =>
            idx === 0
              ? {
                  ...it,
                  preco_unitario: novoSubtotalPacote,
                  valor_total_item: novoSubtotalPacote,
                }
              : it
          ),
        };
      })
    );
  };

  const pasteExcelIntoQuotation = (
    quotationId: string,
    rawClipboard: string
  ): number => {
    const targetQuotation = quotations.find((q) => q.id === quotationId);
    if (!targetQuotation) return 0;

    const sc = purchaseRequests.find((r) => r.id === targetQuotation.sc_id);
    if (!sc) return 0;

    const lines = rawClipboard
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let updatedCount = 0;

    lines.forEach((line, idx) => {
      const reqItem = sc.items[idx];
      if (!reqItem) return;

      const cols = line.split(/\t|;/).map((c) => c.trim());
      const rawPrice = cols[0]
        ?.replace(/R\$\s?/gi, "")
        .replace(/\./g, "")
        .replace(",", ".");
      const parsedPrice = parseFloat(rawPrice);

      if (!isNaN(parsedPrice) && parsedPrice > 0) {
        const brand = cols[1] || undefined;
        const rawTax = cols[2]?.replace("%", "").replace(",", ".");
        const parsedTax =
          rawTax !== undefined && !isNaN(parseFloat(rawTax))
            ? parseFloat(rawTax)
            : undefined;

        updateQuotationItem(quotationId, reqItem.id, {
          preco_unitario: parsedPrice,
          ...(brand ? { marca_oferecida: brand } : {}),
          ...(parsedTax !== undefined ? { aliquota_ipi_icms: parsedTax } : {}),
        });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      addToast(
        "Colagem do Excel concluída",
        `${updatedCount} itens atualizados automaticamente na proposta.`,
        "success"
      );
    } else {
      addToast(
        "Formato não reconhecido",
        "Cole linhas com Preço Unitário (ex: 53,80 [TAB] Marca [TAB] IPI%).",
        "warning"
      );
    }

    return updatedCount;
  };

  const approveQuotationAndGenerateOC = (
    quotationId: string
  ): PurchaseOrder | null => {
    const winningQuote = quotations.find((q) => q.id === quotationId);
    if (!winningQuote) return null;

    const sc = purchaseRequests.find((r) => r.id === winningQuote.sc_id);
    if (!sc) return null;

    const vendor = vendors.find((v) => v.id === winningQuote.vendor_id);
    const scQuotations = quotations.filter((q) => q.sc_id === sc.id);

    const calcQuoteTotal = (q: Quotation) => {
      if (sc.modalidade === "PACOTE_TECNICO" && q.pacote_tecnico) {
        const pkg = q.pacote_tecnico;
        const subtotal =
          pkg.valor_fornecimento_material +
          pkg.valor_mao_de_obra_instalacao +
          pkg.valor_art_rrt_projetos;
        return subtotal + q.valor_frete - q.desconto_negociado;
      }
      const subtotal = q.items.reduce((acc, i) => acc + i.valor_total_item, 0);
      return subtotal + q.valor_frete - q.desconto_negociado;
    };

    const winningTotal = calcQuoteTotal(winningQuote);
    const allTotals = scQuotations.map(calcQuoteTotal);
    const highestQuoted = Math.max(...allTotals, winningTotal);

    const budgetTotal = sc.items.reduce(
      (acc, item) => acc + item.quantidade * item.preco_orcado_unit,
      0
    );

    const savingNegociacao = Math.max(0, highestQuoted - winningTotal);
    const savingOrcamento = budgetTotal - winningTotal;

    const nextOcNum = `OC-2026-0${892 + purchaseOrders.length}`;
    const deliveryDate = new Date();
    deliveryDate.setDate(
      deliveryDate.getDate() + winningQuote.prazo_entrega_dias
    );
    const previsaoStr = deliveryDate.toISOString().split("T")[0];

    const newOC: PurchaseOrder = {
      id: `oc-${Date.now()}`,
      numero_oc: nextOcNum,
      sc_id: sc.id,
      quotation_id: winningQuote.id,
      vendor_id: winningQuote.vendor_id,
      vendor_contact_id: winningQuote.vendor_contact_id,
      project_id: sc.project_id,
      data_emissao: new Date().toISOString().split("T")[0],
      valor_total: Number(winningTotal.toFixed(2)),
      valor_orcado_referencia: Number(budgetTotal.toFixed(2)),
      valor_maior_cotado: Number(highestQuoted.toFixed(2)),
      valor_saving_orcamento: Number(savingOrcamento.toFixed(2)),
      valor_saving_negociacao: Number(savingNegociacao.toFixed(2)),
      condicao_fechada: winningQuote.condicao_pagamento,
      tipo_frete: winningQuote.tipo_frete,
      valor_frete: winningQuote.valor_frete,
      previsao_entrega: previsaoStr,
      status: "Emitida",
      de_acordo_fornecedor: false,
      historico_auditoria: [
        {
          data_hora: new Date().toLocaleString("pt-BR"),
          usuario: "Rafael Mendes (Comprador Sênior)",
          acao: `Proposta Vencedora Homologada (${vendor?.nome_fantasia})`,
          detalhe: `Equalização (${sc.modalidade === "PACOTE_TECNICO" ? "Pacote Técnico Turn-Key" : "Insumos Unitários"}) entre ${scQuotations.length} propostas. Saving de negociação: R$ ${savingNegociacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
        },
      ],
    };

    setQuotations((prev) =>
      prev.map((q) => {
        if (q.sc_id !== sc.id) return q;
        return {
          ...q,
          status: q.id === quotationId ? "Vencedora" : "Equalizada",
        };
      })
    );

    setPurchaseRequests((prev) =>
      prev.map((r) => (r.id === sc.id ? { ...r, status: "Comprada" } : r))
    );

    setPurchaseOrders((prev) => [newOC, ...prev]);
    setSelectedOcId(newOC.id);

    addToast(
      `Ordem de Compra ${nextOcNum} Gerada`,
      `Fornecedor: ${vendor?.nome_fantasia} • Saving: R$ ${savingNegociacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      "success"
    );

    return newOC;
  };

  const addVendorNote = (
    vendorId: string,
    contactId: string,
    newNote: string
  ) => {
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== vendorId) return v;
        return {
          ...v,
          contacts: v.contacts.map((c) =>
            c.id === contactId ? { ...c, notas_negociacao: newNote } : c
          ),
        };
      })
    );
    addToast(
      "Nota de negociação salva",
      "Histórico comercial do vendedor atualizado.",
      "info"
    );
  };

  const addVendorEvaluation = (
    vendorId: string,
    evaluation: Omit<VendorEvaluation, "id" | "data">
  ) => {
    setVendors((prev) =>
      prev.map((v) => {
        if (v.id !== vendorId) return v;
        const novaEval: VendorEvaluation = {
          ...evaluation,
          id: `eval-${Date.now()}`,
          data: new Date().toISOString().split("T")[0],
        };
        const todas = [novaEval, ...v.avaliacoes];
        const media =
          todas.reduce(
            (acc, e) =>
              acc +
              (e.pontualidade +
                e.conformidade_material +
                e.atendimento_comercial) /
                3,
            0
          ) / todas.length;

        return {
          ...v,
          score_avaliacao: Number(media.toFixed(1)),
          avaliacoes: todas,
        };
      })
    );
    addToast(
      "Avaliação Pós-Entrega Registrada",
      "Score de homologação recalculado.",
      "success"
    );
  };

  const addVendor = (newVendor: Vendor) => {
    setVendors((prev) => [newVendor, ...prev]);
    addToast(
      "Fornecedor Cadastrado",
      `${newVendor.nome_fantasia} adicionado à base de suprimentos.`,
      "success"
    );
  };

  const importCatalogFromText = (rawText: string): number => {
    const lines = rawText
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const added: ItemCatalog[] = [];

    lines.forEach((line, index) => {
      if (
        index === 0 &&
        line.toLowerCase().includes("codigo") &&
        line.toLowerCase().includes("descricao")
      ) {
        return;
      }
      const cols = line.split(/\t|;|,/).map((c) => c.trim());
      if (cols.length >= 2) {
        const codigo =
          cols[0] || `INS-${Math.floor(1000 + Math.random() * 9000)}`;
        const descricao = cols[1];
        const catRaw = (cols[2] || "Estrutura") as InsumoCategory;
        const unidRaw = (cols[3] || "un") as UnidadeMedida;
        const preco = parseFloat((cols[4] || "0").replace(",", ".")) || 50;

        added.push({
          id: `cat-imp-${Date.now()}-${index}`,
          codigo_insumo: codigo,
          descricao,
          categoria: ALL_CATEGORIES.includes(catRaw) ? catRaw : "Estrutura",
          unidade_medida: unidRaw,
          preco_referencia: preco,
        });
      }
    });

    if (added.length > 0) {
      setCatalog((prev) => [...added, ...prev]);
      addToast(
        "Importação de Catálogo Concluída",
        `${added.length} novos insumos importados.`,
        "success"
      );
    }
    return added.length;
  };

  const importVendorsFromText = (rawText: string): number => {
    const lines = rawText
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const added: Vendor[] = [];

    lines.forEach((line, idx) => {
      if (idx === 0 && line.toLowerCase().includes("cnpj")) return;
      const cols = line.split(/\t|;/).map((c) => c.trim());
      if (cols.length >= 3) {
        const vId = `vend-imp-${Date.now()}-${idx}`;
        const rawCat = cols[4] as InsumoCategory;
        const matchedCat: InsumoCategory = ALL_CATEGORIES.includes(rawCat)
          ? rawCat
          : "Estrutura";
        added.push({
          id: vId,
          nome_fantasia: cols[0],
          razao_social: cols[1] || `${cols[0].toUpperCase()} LTDA`,
          cnpj: cols[2] || "00.000.000/0001-00",
          inscricao_estadual: "ISENTO",
          cidade_uf: cols[3] || "Itajaí / SC",
          categorias_atendidas: [matchedCat],
          tags_especialidade: [cols[4] || matchedCat],
          status_homologacao: "Homologado",
          score_avaliacao: 4.5,
          condicoes_pagamento_padrao: cols[5] || "28/42 ddl Boleto",
          contacts: [
            {
              id: `cont-imp-${Date.now()}-${idx}`,
              vendor_id: vId,
              nome_vendedor: cols[6] || "Comercial B2B",
              cargo: "Consultor de Vendas",
              whatsapp: (cols[7] || "5547999999999").replace(/\D/g, ""),
              telefone: cols[7] || "(47) 3333-0000",
              email: cols[8] || "vendas@fornecedor.com.br",
              chave_pix: cols[2] || "CNPJ",
              notas_negociacao:
                cols[9] || "Importado via planilha de migração.",
            },
          ],
          avaliacoes: [],
        });
      }
    });

    if (added.length > 0) {
      setVendors((prev) => [...added, ...prev]);
      addToast(
        "Fornecedores Importados",
        `${added.length} fornecedores adicionados.`,
        "success"
      );
    }
    return added.length;
  };

  /**
   * Transação Atômica de Efetivação da Migração (Human-in-the-Loop Commit c/ Rollback Automático)
   */
  const commitSanitizedMigration = (
    rows: StagingRow[],
    clusters: FuzzyDuplicateCluster[],
    simulateRollbackError = false
  ) => {
    const snapshotVendors = [...vendors];
    const snapshotCatalog = [...catalog];
    const snapshotOrders = [...purchaseOrders];

    try {
      if (simulateRollbackError) {
        throw new Error(
          "Violação de integridade simulada durante gravação do lote."
        );
      }

      const validRows = rows.filter(
        (r) => r.severity !== "error" || r.resolved
      );

      const newVendors: Vendor[] = [];
      const newCatalogItems: ItemCatalog[] = [];

      validRows.forEach((row, idx) => {
        const matchedCluster = clusters.find(
          (c) =>
            c.decision === "merged" &&
            c.variants.some((v) => v.rawName === row.vendorRawName)
        );
        const finalVendorName = matchedCluster
          ? matchedCluster.canonicalName
          : row.vendorNormalizedName;
        const finalCnpj = matchedCluster
          ? matchedCluster.canonicalCnpj
          : row.cnpjNormalized || "00.000.000/0001-00";

        const alreadyExistsInVendors =
          vendors.some(
            (v) =>
              v.cnpj === finalCnpj ||
              v.nome_fantasia.toLowerCase() === finalVendorName.toLowerCase()
          ) ||
          newVendors.some(
            (v) =>
              v.cnpj === finalCnpj ||
              v.nome_fantasia.toLowerCase() === finalVendorName.toLowerCase()
          );

        if (!alreadyExistsInVendors) {
          const vId = `vend-mig-${Date.now()}-${idx}`;
          newVendors.push({
            id: vId,
            nome_fantasia: finalVendorName,
            razao_social: `${finalVendorName.toUpperCase()}`,
            cnpj: finalCnpj,
            inscricao_estadual: "254.000.100",
            cidade_uf: "Santa Catarina / PR",
            categorias_atendidas: [row.materialCategory],
            tags_especialidade: [row.materialCategory],
            status_homologacao: "Homologado",
            score_avaliacao: 4.7,
            condicoes_pagamento_padrao: "28/42 ddl Boleto",
            contacts: [
              {
                id: `cont-mig-${Date.now()}-${idx}`,
                vendor_id: vId,
                nome_vendedor: row.extractedSalesperson || "Executivo B2B",
                cargo: "Representante Comercial (Histórico 15 Anos)",
                whatsapp:
                  row.extractedPhone.replace(/\D/g, "") || "5547999990000",
                telefone: row.extractedPhone || "(47) 3333-0000",
                email: row.extractedEmail || "comercial@fornecedor.com.br",
                chave_pix: finalCnpj,
                notas_negociacao: `Migrado do acervo histórico (${row.sheetName}). Obs original: ${row.notesRaw}`,
              },
            ],
            avaliacoes: [],
          });
        }

        const alreadyInCatalog =
          catalog.some(
            (c) =>
              c.descricao.toLowerCase() ===
              row.materialDescription.toLowerCase()
          ) ||
          newCatalogItems.some(
            (c) =>
              c.descricao.toLowerCase() ===
              row.materialDescription.toLowerCase()
          );

        if (!alreadyInCatalog) {
          newCatalogItems.push({
            id: `cat-mig-${Date.now()}-${idx}`,
            codigo_insumo: `HIST-${1040 + idx}`,
            descricao: row.materialDescription,
            categoria: row.materialCategory,
            unidade_medida: (row.unitNormalized || "un") as UnidadeMedida,
            preco_referencia: row.unitPrice > 0 ? row.unitPrice : 55.0,
            norma_tecnica: "Acervo Histórico Higienizado",
          });
        }
      });

      setVendors((prev) => [...newVendors, ...prev]);
      setCatalog((prev) => [...newCatalogItems, ...prev]);

      addToast(
        "Migração Efetivada com Sucesso",
        `${newVendors.length} fornecedores unificados e ${newCatalogItems.length} insumos padronizados gravados no banco definitivo.`,
        "success"
      );

      return {
        success: true,
        vendorsAdded: newVendors.length,
        materialsAdded: newCatalogItems.length,
        ordersAdded: validRows.length,
      };
    } catch (err) {
      setVendors(snapshotVendors);
      setCatalog(snapshotCatalog);
      setPurchaseOrders(snapshotOrders);

      addToast(
        "Rollback Automático Executado",
        `Falha detectada na transação (${
          err instanceof Error ? err.message : "Erro"
        }). Nenhum dado corrompido foi gravado em produção.`,
        "error"
      );

      return {
        success: false,
        vendorsAdded: 0,
        materialsAdded: 0,
        ordersAdded: 0,
      };
    }
  };

  const createPurchaseRequest = (
    sc: PurchaseRequest,
    vendorIdsToQuote: string[]
  ) => {
    setPurchaseRequests((prev) => [sc, ...prev]);

    const budgetTotal = sc.items.reduce(
      (acc, item) => acc + item.quantidade * item.preco_orcado_unit,
      0
    );

    const newQuotations: Quotation[] = vendorIdsToQuote.map((vId, idx) => {
      const v = vendors.find((vend) => vend.id === vId);
      const contactId = v?.contacts[0]?.id || "cont-01";
      const qId = `quot-new-${Date.now()}-${idx}`;
      const isPacote = sc.modalidade === "PACOTE_TECNICO";

      const factor = 0.94 + idx * 0.035;
      const matVal = Math.round(budgetTotal * factor * 0.78);
      const moVal = Math.round(budgetTotal * factor * 0.2);
      const artVal = Math.round(budgetTotal * factor * 0.02);

      return {
        id: qId,
        sc_id: sc.id,
        vendor_id: vId,
        vendor_contact_id: contactId,
        data_envio: new Date().toISOString().split("T")[0],
        data_retorno: new Date().toISOString().split("T")[0],
        prazo_entrega_dias: isPacote ? 65 + idx * 10 : 4 + idx,
        condicao_pagamento:
          v?.condicoes_pagamento_padrao ||
          (isPacote ? "20% Sinal + 80% Medição Física (BM)" : "28 ddl"),
        tipo_frete: "CIF",
        valor_frete: 0,
        desconto_negociado: 0,
        status: "Equalizada",
        ...(isPacote
          ? {
              pacote_tecnico: {
                valor_fornecimento_material: matVal,
                valor_mao_de_obra_instalacao: moVal,
                valor_art_rrt_projetos: artVal,
                prazo_fabricacao_engenharia_dias: 35 + idx * 5,
                prazo_montagem_canteiro_dias: 30 + idx * 5,
                condicao_medicao_desembolso:
                  v?.condicoes_pagamento_padrao ||
                  "20% Sinal + 80% Medição Física (BM)",
                garantia_anos: 5,
                detalhe_garantia:
                  "5 anos de garantia integral (fabricação, estanqueidade e instalação com ART).",
                assistencia_tecnica_local:
                  "Equipe própria em SC • SLA de atendimento em obra até 24h",
                escopo_incluso:
                  "Fornecimento completo de materiais, fabricação sob medida, montagem em canteiro com equipe própria, projetos executivos e emissão de ART.",
                ressalvas_aditivos:
                  idx === 2
                    ? "ATENÇÃO: Não inclui içamento por grua nem andaime fachadeiro externo."
                    : "Nenhuma exclusão. Escopo 100% turn-key conforme memorial da obra.",
                cumpre_integralmente_escopo: idx !== 2,
              },
            }
          : {}),
        items: sc.items.map((reqItem, itemIdx) => {
          const itemFactor =
            0.94 + idx * 0.035 + (itemIdx % 2 === 0 ? -0.01 : 0.02);
          const unitPrice = isPacote
            ? matVal + moVal + artVal
            : Number((reqItem.preco_orcado_unit * itemFactor).toFixed(2));
          return {
            id: `qi-new-${Date.now()}-${idx}-${itemIdx}`,
            quotation_id: qId,
            request_item_id: reqItem.id,
            preco_unitario: unitPrice,
            aliquota_ipi_icms: 0,
            valor_total_item: Number(
              (unitPrice * (isPacote ? 1 : reqItem.quantidade)).toFixed(2)
            ),
            marca_oferecida: isPacote
              ? `${v?.nome_fantasia || "Sistema Homologado"} Turn-Key`
              : "Conforme NBR",
            prazo_item_dias: isPacote ? 65 + idx * 10 : 4 + idx,
          };
        }),
      };
    });

    if (newQuotations.length > 0) {
      setQuotations((prev) => [...newQuotations, ...prev]);
    }

    setSelectedScId(sc.id);
    addToast(
      `Solicitação ${sc.numero_sc} Criada`,
      `${newQuotations.length} fornecedores especializados vinculados ao Mapa de Cotação.`,
      "success"
    );
  };

  const updatePurchaseOrderStatus = (
    ocId: string,
    status: PurchaseOrder["status"],
    deAcordo?: boolean
  ) => {
    setPurchaseOrders((prev) =>
      prev.map((oc) => {
        if (oc.id !== ocId) return oc;
        const novoDeAcordo =
          deAcordo !== undefined ? deAcordo : oc.de_acordo_fornecedor;
        return {
          ...oc,
          status,
          de_acordo_fornecedor: novoDeAcordo,
          historico_auditoria: [
            {
              data_hora: new Date().toLocaleString("pt-BR"),
              usuario: "Sistema Suprimentos JC BAUER",
              acao: `Status atualizado para: ${status}${
                deAcordo ? " (De Acordo Confirmado)" : ""
              }`,
              detalhe: "Registro auditado pelo comprador responsável.",
            },
            ...oc.historico_auditoria,
          ],
        };
      })
    );
    addToast(
      "Pedido Atualizado",
      `Status alterado para "${status}" com registro de auditoria.`,
      "info"
    );
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProjects(INITIAL_PROJECTS);
    setCatalog(INITIAL_ITEMS_CATALOG);
    setVendors(INITIAL_VENDORS);
    setPurchaseRequests(INITIAL_PURCHASE_REQUESTS);
    setQuotations(INITIAL_QUOTATIONS);
    setPurchaseOrders(INITIAL_PURCHASE_ORDERS);
    setSelectedScId("sc-01");
    setSelectedOcId("oc-01");
    addToast(
      "Dados de Demonstração Restaurados",
      "Todas as cotações, obras e pedidos voltaram ao estado original.",
      "info"
    );
  };

  return (
    <ProcurementContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedScId,
        setSelectedScId,
        selectedOcId,
        setSelectedOcId,
        selectedProjectFilter,
        setSelectedProjectFilter,
        darkMode,
        setDarkMode,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        projects,
        catalog,
        vendors,
        purchaseRequests,
        quotations,
        purchaseOrders,
        toasts,
        addToast,
        removeToast,
        updateQuotationItem,
        updateQuotationHeader,
        updateTechnicalPackage,
        pasteExcelIntoQuotation,
        approveQuotationAndGenerateOC,
        addVendorNote,
        addVendorEvaluation,
        addVendor,
        importCatalogFromText,
        importVendorsFromText,
        commitSanitizedMigration,
        createPurchaseRequest,
        updatePurchaseOrderStatus,
        resetDemoData,
      }}
    >
      {children}
    </ProcurementContext.Provider>
  );
}

export function useProcurement() {
  const context = useContext(ProcurementContext);
  if (!context) {
    throw new Error(
      "useProcurement must be used within a ProcurementProvider"
    );
  }
  return context;
}
