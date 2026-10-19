"use client";

import React, { useMemo, useState } from "react";
import { useProcurement } from "@/context/ProcurementContext";
import { formatBRL, formatDateBR } from "@/lib/formatters";
import { FileText, ShieldCheck, Pencil } from "lucide-react";

export function EqualizationMapModule({
  onOpenExecutiveReport,
}: {
  onOpenExecutiveReport: () => void;
}) {
  const {
    purchaseRequests,
    quotations,
    vendors,
    projects,
    selectedScId,
    setSelectedScId,
    updateQuotationItem,
    updateQuotationHeader,
    updateTechnicalPackage,
    approveQuotationAndGenerateOC,
    setActiveTab,
  } = useProcurement();

  // Estado para edição sob demanda de preço unitário (mantendo exibição padrão formatada R$ XX,XX / un)
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);

  const currentSc = useMemo(
    () =>
      purchaseRequests.find((r) => r.id === selectedScId) ||
      purchaseRequests[0],
    [purchaseRequests, selectedScId]
  );

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentSc?.project_id),
    [projects, currentSc]
  );

  const scQuotations = useMemo(
    () => quotations.filter((q) => q.sc_id === currentSc?.id),
    [quotations, currentSc]
  );

  const isPacoteTecnico = currentSc?.modalidade === "PACOTE_TECNICO";

  const budgetTotal = useMemo(() => {
    if (!currentSc) return 0;
    return currentSc.items.reduce(
      (acc, item) => acc + item.quantidade * item.preco_orcado_unit,
      0
    );
  }, [currentSc]);

  const quoteTotals = useMemo(() => {
    const map: Record<
      string,
      {
        subtotalMateriais: number;
        frete: number;
        desconto: number;
        valorTotalNegociado: number;
      }
    > = {};

    scQuotations.forEach((q) => {
      if (isPacoteTecnico && q.pacote_tecnico) {
        const pkg = q.pacote_tecnico;
        const subtotal =
          pkg.valor_fornecimento_material +
          pkg.valor_mao_de_obra_instalacao +
          pkg.valor_art_rrt_projetos;
        const valorTotalNegociado =
          subtotal + q.valor_frete - q.desconto_negociado;
        map[q.id] = {
          subtotalMateriais: subtotal,
          frete: q.valor_frete,
          desconto: q.desconto_negociado,
          valorTotalNegociado,
        };
        return;
      }

      let subtotal = 0;
      q.items.forEach((qi) => {
        const reqItem = currentSc?.items.find(
          (i) => i.id === qi.request_item_id
        );
        const qtd = reqItem ? reqItem.quantidade : 0;
        const comImp =
          qtd * qi.preco_unitario * (1 + qi.aliquota_ipi_icms / 100);
        subtotal += comImp;
      });

      const valorTotalNegociado =
        subtotal + q.valor_frete - q.desconto_negociado;

      map[q.id] = {
        subtotalMateriais: subtotal,
        frete: q.valor_frete,
        desconto: q.desconto_negociado,
        valorTotalNegociado,
      };
    });

    return map;
  }, [scQuotations, currentSc, isPacoteTecnico]);

  const { bestGlobalQuoteId, lowestGlobalValue, highestGlobalValue } =
    useMemo(() => {
      const entries = Object.entries(quoteTotals);
      if (entries.length === 0) {
        return {
          bestGlobalQuoteId: null,
          lowestGlobalValue: 0,
          highestGlobalValue: 0,
        };
      }

      let minId = entries[0][0];
      let minVal = entries[0][1].valorTotalNegociado;
      let maxVal = entries[0][1].valorTotalNegociado;

      entries.forEach(([qId, t]) => {
        if (t.valorTotalNegociado < minVal) {
          minVal = t.valorTotalNegociado;
          minId = qId;
        }
        if (t.valorTotalNegociado > maxVal) {
          maxVal = t.valorTotalNegociado;
        }
      });

      return {
        bestGlobalQuoteId: minId,
        lowestGlobalValue: minVal,
        highestGlobalValue: maxVal,
      };
    }, [quoteTotals]);

  const itemLowestPriceMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!currentSc) return map;

    currentSc.items.forEach((reqItem) => {
      let minTotal = Infinity;
      scQuotations.forEach((q) => {
        const qi = q.items.find((i) => i.request_item_id === reqItem.id);
        if (qi && qi.valor_total_item > 0 && qi.valor_total_item < minTotal) {
          minTotal = qi.valor_total_item;
        }
      });
      map[reqItem.id] = minTotal === Infinity ? 0 : minTotal;
    });

    return map;
  }, [currentSc, scQuotations]);

  const savingNegociacao = Math.max(0, highestGlobalValue - lowestGlobalValue);
  const savingOrcamento = Math.max(0, budgetTotal - lowestGlobalValue);
  const savingDestaque =
    savingNegociacao > 0 ? savingNegociacao : savingOrcamento;

  const bestVendor = useMemo(() => {
    const winningQuote = scQuotations.find((q) => q.id === bestGlobalQuoteId);
    return vendors.find((v) => v.id === winningQuote?.vendor_id);
  }, [scQuotations, bestGlobalQuoteId, vendors]);

  const handleApproveProposal = (quoteId: string) => {
    const newOC = approveQuotationAndGenerateOC(quoteId);
    if (newOC) {
      setActiveTab("orders");
    }
  };

  if (!currentSc) return null;

  return (
    <div className="space-y-5 min-w-0">
      {/* ================================================================= */}
      {/* TOPO DA TELA: 3 INDICADORES GRANDES E LIMPOS                      */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bloco 1: Obra & Disciplina */}
        <div className="bg-white border border-slate-300 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-700">
              Obra e disciplina em cotação
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5 leading-snug">
              {currentProject?.nome} — {currentSc.categoria_principal}
            </div>
            <div className="text-sm text-slate-700 mt-0.5">
              Solicitante: {currentSc.solicitante} • Limite:{" "}
              <span className="font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                {formatDateBR(currentSc.data_limite_entrega)}
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between gap-3">
            <label
              htmlFor="sc-selector"
              className="text-sm font-semibold text-slate-700 whitespace-nowrap"
            >
              Processo:
            </label>
            <select
              id="sc-selector"
              value={currentSc.id}
              onChange={(e) => setSelectedScId(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 text-slate-900 text-sm font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-slate-900"
            >
              {purchaseRequests.map((req) => {
                const proj = projects.find((p) => p.id === req.project_id);
                return (
                  <option key={req.id} value={req.id}>
                    {req.numero_sc} • {proj?.nome} — {req.categoria_principal}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Bloco 2: Melhor Proposta Atual */}
        <div className="bg-white border border-slate-300 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-700">
              Melhor proposta atual
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {bestVendor?.nome_fantasia || "Em apuração"}
            </div>
            <div className="text-sm text-slate-700 mt-0.5">
              {bestVendor?.cidade_uf}
            </div>
          </div>

          <div className="pt-2.5 border-t border-slate-200 flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium text-slate-700">
              Menor valor global:
            </span>
            <span className="text-2xl font-bold text-emerald-800 whitespace-nowrap tabular-nums">
              {formatBRL(lowestGlobalValue)}
            </span>
          </div>
        </div>

        {/* Bloco 3: Economia (Saving) para a Construtora + Botão PDF */}
        <div className="bg-white border border-slate-300 rounded-xl p-5 flex flex-col justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-700">
              Economia (Saving) para a construtora
            </div>
            <div className="text-2xl font-bold text-emerald-800 mt-0.5 whitespace-nowrap tabular-nums">
              {formatBRL(savingDestaque)}
            </div>
            <div className="text-sm text-slate-700 mt-0.5 whitespace-nowrap tabular-nums">
              Orçamento de referência: {formatBRL(budgetTotal)}
            </div>
          </div>

          <button
            onClick={onOpenExecutiveReport}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 transition"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Imprimir Relatório para Diretoria (PDF)</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MAPA DE COTAÇÃO COM PAINÉIS CONGELADOS (STICKY TOP + STICKY LEFT) */}
      {/* E GRADE COMPLETA DE PLANILHA EXECUTIVA (border border-slate-300)  */}
      {/* ================================================================= */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-slate-300 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-800">
            Mapa Comparativo de Cotação ({currentSc.numero_sc}) — Cabeçalhos e
            coluna de materiais fixos ao rolar
          </div>
          <div className="text-sm text-slate-700">
            Clique em qualquer valor da coluna <strong>Unitário</strong> para
            ajustar o preço negociado
          </div>
        </div>

        {/* Container de rolagem com altura controlada para ativar sticky top-0 e sticky left-0 */}
        <div className="max-h-[calc(100vh-280px)] overflow-auto relative">
          <table className="w-full border-collapse text-left">
            <thead>
              {/* LINHA 1 DO CABEÇALHO FIXO: NOME DO FORNECEDOR */}
              <tr className="h-[58px]">
                {/* Canto Superior Esquerdo Congelado (sticky top-0 left-0 z-30) */}
                <th
                  rowSpan={2}
                  className="sticky top-0 left-0 z-30 bg-slate-100 border border-slate-300 p-3.5 min-w-[300px] max-w-[360px] align-middle shadow-[1px_1px_0_0_#cbd5e1]"
                >
                  <div className="text-base font-bold text-slate-900">
                    Insumo / Material Solicitado
                  </div>
                  <div className="text-sm font-normal text-slate-700 mt-0.5">
                    Quantidade pedida e meta unitária
                  </div>
                </th>

                {/* Cabeçalhos dos Fornecedores Congelados no Topo (sticky top-0 z-20) */}
                {scQuotations.map((quote) => {
                  const vendor = vendors.find((v) => v.id === quote.vendor_id);
                  const contact =
                    vendor?.contacts.find(
                      (c) => c.id === quote.vendor_contact_id
                    ) || vendor?.contacts[0];
                  const isBestGlobal = quote.id === bestGlobalQuoteId;

                  return (
                    <th
                      key={quote.id}
                      colSpan={2}
                      className={`sticky top-0 z-20 border border-slate-300 px-4 py-2 text-left align-middle shadow-[0_1px_0_0_#cbd5e1] ${
                        isBestGlobal ? "bg-emerald-50" : "bg-slate-100"
                      }`}
                    >
                      <div className="text-base font-bold text-slate-900 truncate">
                        {vendor?.nome_fantasia}
                      </div>
                      <div className="text-sm font-normal text-slate-700 truncate">
                        Vendedor: {contact?.nome_vendedor}
                      </div>
                    </th>
                  );
                })}
              </tr>

              {/* LINHA 2 DO CABEÇALHO FIXO: SUB-COLUNAS CLARAS (UNITÁRIO E TOTAL) */}
              <tr className="h-[38px]">
                {scQuotations.map((quote) => {
                  const isBestGlobal = quote.id === bestGlobalQuoteId;
                  const headerBg = isBestGlobal
                    ? "bg-emerald-50"
                    : "bg-slate-100";

                  return (
                    <React.Fragment key={`${quote.id}-subheaders`}>
                      <th
                        className={`sticky top-[58px] z-20 ${headerBg} border border-slate-300 px-3.5 py-1.5 text-right text-sm font-bold text-slate-800 whitespace-nowrap shadow-[0_1px_0_0_#cbd5e1] min-w-[155px]`}
                      >
                        Preço Unit. (R$)
                      </th>
                      <th
                        className={`sticky top-[58px] z-20 ${headerBg} border border-slate-300 px-3.5 py-1.5 text-right text-sm font-bold text-slate-800 whitespace-nowrap shadow-[0_1px_0_0_#cbd5e1] min-w-[155px]`}
                      >
                        Total (R$)
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {isPacoteTecnico ? (
                /* ========================================================= */
                /* MODO B: PACOTES TÉCNICOS (MATERIAL + MÃO DE OBRA + ART)   */
                /* ========================================================= */
                <>
                  {[
                    {
                      key: "valor_fornecimento_material" as const,
                      titulo: "1. Fornecimento de Materiais e Sistemas",
                      subtitulo: currentSc.items[0]?.descricao || "Escopo conforme memorial",
                      qtdLabel: "1 vb",
                      unidade: "vb",
                    },
                    {
                      key: "valor_mao_de_obra_instalacao" as const,
                      titulo: "2. Mão de Obra de Instalação em Canteiro",
                      subtitulo: "Equipe especializada e montagem técnica",
                      qtdLabel: "1 vb",
                      unidade: "vb",
                    },
                    {
                      key: "valor_art_rrt_projetos" as const,
                      titulo: "3. Projetos Executivos, Laudos e ART",
                      subtitulo: "Detalhamento de engenharia e responsabilidade técnica",
                      qtdLabel: "1 cj",
                      unidade: "cj",
                    },
                  ].map((etapa) => {
                    const minVal = Math.min(
                      ...scQuotations.map(
                        (q) => q.pacote_tecnico?.[etapa.key] ?? Infinity
                      )
                    );

                    return (
                      <tr
                        key={etapa.key}
                        className="group odd:bg-white even:bg-slate-50 hover:bg-slate-100/80 transition-colors"
                      >
                        {/* Coluna Material Congelada na Esquerda (sticky left-0 z-10) */}
                        <td className="sticky left-0 z-10 bg-white group-even:bg-slate-50 group-hover:bg-slate-100 border border-slate-300 p-3.5 align-middle shadow-[1px_0_0_0_#cbd5e1]">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-bold text-slate-900 truncate">
                                {etapa.titulo}
                              </div>
                              <div className="text-sm text-slate-700 truncate">
                                {etapa.subtitulo}
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-sm font-bold text-slate-900 whitespace-nowrap tabular-nums shrink-0">
                              {etapa.qtdLabel}
                            </span>
                          </div>
                        </td>

                        {scQuotations.map((quote) => {
                          const val = quote.pacote_tecnico?.[etapa.key] || 0;
                          const isLowest = Math.abs(val - minVal) < 1;
                          const cellKey = `${quote.id}-${etapa.key}`;
                          const isEditing = editingCellKey === cellKey;
                          const cellBg = isLowest ? "bg-emerald-50/70" : "";

                          return (
                            <React.Fragment key={cellKey}>
                              {/* Sub-coluna Unitário */}
                              <td
                                onClick={() => setEditingCellKey(cellKey)}
                                className={`border border-slate-300 p-3.5 text-right align-middle whitespace-nowrap tabular-nums cursor-pointer ${cellBg}`}
                                title="Clique para editar o valor"
                              >
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    step="500"
                                    value={val}
                                    onBlur={() => setEditingCellKey(null)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === "Escape") {
                                        setEditingCellKey(null);
                                      }
                                    }}
                                    onChange={(e) =>
                                      updateTechnicalPackage(quote.id, {
                                        [etapa.key]:
                                          parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-32 bg-white border border-slate-900 rounded-md px-2 py-1 text-right text-base font-bold text-slate-900 tabular-nums focus:outline-none"
                                  />
                                ) : (
                                  <div className="inline-flex items-center justify-end gap-1.5 text-base font-semibold text-slate-900">
                                    <span>
                                      {formatBRL(val)} / {etapa.unidade}
                                    </span>
                                    <Pencil className="w-3.5 h-3.5 text-slate-500 opacity-60 group-hover:opacity-100 shrink-0" />
                                  </div>
                                )}
                              </td>

                              {/* Sub-coluna Total */}
                              <td
                                className={`border border-slate-300 p-3.5 text-right align-middle whitespace-nowrap tabular-nums ${cellBg}`}
                              >
                                <span
                                  className={`text-base ${
                                    isLowest
                                      ? "text-emerald-900 font-bold"
                                      : "text-slate-900 font-semibold"
                                  }`}
                                >
                                  {formatBRL(val)}
                                </span>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Linha 4: Garantia e Escopo (Máx 2 linhas curtas) */}
                  <tr className="group odd:bg-white even:bg-slate-50">
                    <td className="sticky left-0 z-10 bg-white group-even:bg-slate-50 border border-slate-300 p-3.5 align-middle shadow-[1px_0_0_0_#cbd5e1]">
                      <div className="text-base font-bold text-slate-900">
                        4. Garantia e Cobertura de Escopo
                      </div>
                      <div className="text-sm text-slate-700">
                        Conformidade com o memorial da construtora
                      </div>
                    </td>
                    {scQuotations.map((quote) => {
                      const pkg = quote.pacote_tecnico;
                      const cumpre = pkg?.cumpre_integralmente_escopo ?? true;
                      return (
                        <td
                          key={quote.id}
                          colSpan={2}
                          className={`border border-slate-300 p-3.5 text-left align-middle ${
                            cumpre ? "bg-emerald-50/40" : ""
                          }`}
                        >
                          <div className="text-sm font-bold text-slate-900">
                            Garantia: {pkg?.garantia_anos ?? 5} anos •{" "}
                            {cumpre
                              ? "Escopo 100% completo"
                              : "Possui ressalvas"}
                          </div>
                          <div className="text-sm text-slate-700 truncate max-w-[310px]">
                            {pkg?.ressalvas_aditivos}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </>
              ) : (
                /* ========================================================= */
                /* MODO A: INSUMOS UNITÁRIOS COM ZEBRADO E PAINÉIS CONGELADOS*/
                /* ========================================================= */
                currentSc.items.map((reqItem) => {
                  const minItemTotal = itemLowestPriceMap[reqItem.id] || 0;

                  return (
                    <tr
                      key={reqItem.id}
                      className="group odd:bg-white even:bg-slate-50 hover:bg-slate-100/80 transition-colors"
                    >
                      {/* Coluna do Material Congelada na Esquerda (sticky left-0 z-10 bg-white) */}
                      <td className="sticky left-0 z-10 bg-white group-even:bg-slate-50 group-hover:bg-slate-100 border border-slate-300 p-3.5 align-middle shadow-[1px_0_0_0_#cbd5e1]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-base font-bold text-slate-900 truncate">
                              {reqItem.descricao}
                            </div>
                            <div className="text-sm text-slate-700 whitespace-nowrap tabular-nums">
                              Meta: {formatBRL(reqItem.preco_orcado_unit)} /{" "}
                              {reqItem.unidade}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-base font-bold text-slate-900 whitespace-nowrap tabular-nums shrink-0">
                            {reqItem.quantidade} {reqItem.unidade}
                          </span>
                        </div>
                      </td>

                      {/* Sub-colunas Unitário e Total de cada Fornecedor */}
                      {scQuotations.map((quote) => {
                        const qi = quote.items.find(
                          (i) => i.request_item_id === reqItem.id
                        );

                        if (!qi) {
                          return (
                            <React.Fragment key={quote.id}>
                              <td className="border border-slate-300 p-3.5 text-right text-sm text-slate-700">
                                —
                              </td>
                              <td className="border border-slate-300 p-3.5 text-right text-sm text-slate-700">
                                Não cotado
                              </td>
                            </React.Fragment>
                          );
                        }

                        const isLowest =
                          minItemTotal > 0 &&
                          Math.abs(qi.valor_total_item - minItemTotal) < 0.05;
                        const cellKey = `${quote.id}-${reqItem.id}`;
                        const isEditing = editingCellKey === cellKey;
                        const cellBg = isLowest ? "bg-emerald-50/70" : "";

                        return (
                          <React.Fragment key={quote.id}>
                            {/* Sub-coluna 1: Unitário formatado como moeda (R$ 82,40 / un) */}
                            <td
                              onClick={() => setEditingCellKey(cellKey)}
                              className={`border border-slate-300 p-3.5 text-right align-middle whitespace-nowrap tabular-nums cursor-pointer ${cellBg}`}
                              title="Clique para ajustar o preço unitário"
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  type="number"
                                  step="0.10"
                                  value={qi.preco_unitario}
                                  onBlur={() => setEditingCellKey(null)}
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" ||
                                      e.key === "Escape"
                                    ) {
                                      setEditingCellKey(null);
                                    }
                                  }}
                                  onChange={(e) =>
                                    updateQuotationItem(quote.id, reqItem.id, {
                                      preco_unitario:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-28 bg-white border border-slate-900 rounded-md px-2 py-1 text-right text-base font-bold text-slate-900 tabular-nums focus:outline-none"
                                />
                              ) : (
                                <div className="inline-flex items-center justify-end gap-1.5 text-base font-semibold text-slate-900">
                                  <span>
                                    {formatBRL(qi.preco_unitario)} /{" "}
                                    {reqItem.unidade}
                                  </span>
                                  <Pencil className="w-3.5 h-3.5 text-slate-500 opacity-60 group-hover:opacity-100 shrink-0" />
                                </div>
                              )}
                            </td>

                            {/* Sub-coluna 2: Total formatado como moeda (R$ 17.866,38) */}
                            <td
                              className={`border border-slate-300 p-3.5 text-right align-middle whitespace-nowrap tabular-nums ${cellBg}`}
                            >
                              <span
                                className={`text-base ${
                                  isLowest
                                    ? "text-emerald-900 font-bold"
                                    : "text-slate-900 font-semibold"
                                }`}
                              >
                                {formatBRL(qi.valor_total_item)}
                              </span>
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* ========================================================= */}
            {/* RODAPÉ DA TABELA (COM BORDAS DE GRADE E COLUNA ESQ. FIXA) */}
            {/* ========================================================= */}
            <tfoot className="border-t-2 border-slate-400">
              {/* Linha 1: Subtotal Materiais */}
              <tr className="bg-white">
                <td className="sticky left-0 z-10 bg-white border border-slate-300 p-3.5 text-left text-sm font-bold text-slate-900 shadow-[1px_0_0_0_#cbd5e1]">
                  Subtotal Materiais
                </td>
                {scQuotations.map((q) => {
                  const sub = quoteTotals[q.id]?.subtotalMateriais || 0;
                  return (
                    <td
                      key={q.id}
                      colSpan={2}
                      className="border border-slate-300 p-3.5 text-right text-base font-bold text-slate-900 whitespace-nowrap tabular-nums"
                    >
                      {formatBRL(sub)}
                    </td>
                  );
                })}
              </tr>

              {/* Linha 2: Frete (CIF ou FOB + Valor Formatado) */}
              <tr className="bg-slate-50">
                <td className="sticky left-0 z-10 bg-slate-50 border border-slate-300 p-3.5 text-left text-sm font-bold text-slate-900 shadow-[1px_0_0_0_#cbd5e1]">
                  Frete (Modalidade CIF/FOB e Valor)
                </td>
                {scQuotations.map((q) => {
                  const freightCellKey = `${q.id}-frete`;
                  const isEditingFreight = editingCellKey === freightCellKey;

                  return (
                    <React.Fragment key={q.id}>
                      <td className="border border-slate-300 p-3 text-right align-middle whitespace-nowrap">
                        <select
                          value={q.tipo_frete}
                          onChange={(e) =>
                            updateQuotationHeader(q.id, {
                              tipo_frete: e.target.value as "CIF" | "FOB",
                              ...(e.target.value === "CIF"
                                ? { valor_frete: 0 }
                                : {}),
                            })
                          }
                          className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-sm font-bold text-slate-900"
                        >
                          <option value="CIF">Frete CIF</option>
                          <option value="FOB">Frete FOB</option>
                        </select>
                      </td>

                      <td
                        onClick={() => setEditingCellKey(freightCellKey)}
                        className="border border-slate-300 p-3.5 text-right align-middle whitespace-nowrap tabular-nums cursor-pointer"
                        title="Clique para editar o valor do frete"
                      >
                        {isEditingFreight ? (
                          <input
                            autoFocus
                            type="number"
                            step="50"
                            value={q.valor_frete}
                            onBlur={() => setEditingCellKey(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                setEditingCellKey(null);
                              }
                            }}
                            onChange={(e) =>
                              updateQuotationHeader(q.id, {
                                valor_frete: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-28 bg-white border border-slate-900 rounded-md px-2 py-1 text-right text-base font-bold text-slate-900 tabular-nums focus:outline-none"
                          />
                        ) : (
                          <div className="inline-flex items-center justify-end gap-1.5 text-base font-semibold text-slate-900">
                            <span>{formatBRL(q.valor_frete)}</span>
                            <Pencil className="w-3.5 h-3.5 text-slate-500 opacity-60" />
                          </div>
                        )}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>

              {/* Linha 3: Prazo de Entrega e Condição de Pagamento */}
              <tr className="bg-white">
                <td className="sticky left-0 z-10 bg-white border border-slate-300 p-3.5 text-left text-sm font-bold text-slate-900 shadow-[1px_0_0_0_#cbd5e1]">
                  Prazo de Entrega e Pagamento
                </td>
                {scQuotations.map((q) => (
                  <td
                    key={q.id}
                    colSpan={2}
                    className="border border-slate-300 p-3.5 text-right"
                  >
                    <div className="text-sm font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      Entrega em {q.prazo_entrega_dias} dias úteis
                    </div>
                    <div className="text-sm text-slate-700">
                      {q.condicao_pagamento}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Linha Final (Destaque): VALOR TOTAL NEGOCIADO */}
              <tr className="bg-slate-100">
                <td className="sticky left-0 z-10 bg-slate-100 border border-slate-300 p-4 text-left align-middle shadow-[1px_0_0_0_#cbd5e1]">
                  <div className="text-lg font-bold text-slate-900">
                    VALOR TOTAL NEGOCIADO
                  </div>
                  <div className="text-sm text-slate-700">
                    Custo final equalizado na obra
                  </div>
                </td>

                {scQuotations.map((q) => {
                  const totalVal = quoteTotals[q.id]?.valorTotalNegociado || 0;
                  const isBest = q.id === bestGlobalQuoteId;

                  return (
                    <td
                      key={q.id}
                      colSpan={2}
                      className={`border border-slate-300 p-4 text-right align-middle ${
                        isBest ? "bg-emerald-50/70" : "bg-slate-100"
                      }`}
                    >
                      <div
                        className={`text-lg font-bold whitespace-nowrap tabular-nums ${
                          isBest ? "text-emerald-900" : "text-slate-900"
                        }`}
                      >
                        {formatBRL(totalVal)}
                      </div>

                      <div className="mt-2.5">
                        <button
                          onClick={() => handleApproveProposal(q.id)}
                          className={`w-full py-2 px-3.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition ${
                            isBest
                              ? "bg-emerald-800 hover:bg-emerald-900 text-white"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Aprovar e Gerar Ordem</span>
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
