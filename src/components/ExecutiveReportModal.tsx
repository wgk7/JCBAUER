"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useProcurement } from "@/context/ProcurementContext";
import { formatBRL, formatDateBR } from "@/lib/formatters";
import { Printer, X, FileText, ShieldCheck } from "lucide-react";

function ExecutiveReportContent({ onClose }: { onClose?: () => void }) {
  const {
    purchaseRequests,
    quotations,
    vendors,
    projects,
    selectedScId,
    setSelectedScId,
    approveQuotationAndGenerateOC,
    addToast,
  } = useProcurement();

  const currentSc = useMemo(
    () =>
      purchaseRequests.find((r) => r.id === selectedScId) ||
      purchaseRequests[0],
    [purchaseRequests, selectedScId]
  );

  const isPacoteTecnico = currentSc?.modalidade === "PACOTE_TECNICO";

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentSc?.project_id),
    [projects, currentSc]
  );

  const scQuotations = useMemo(
    () => quotations.filter((q) => q.sc_id === currentSc?.id),
    [quotations, currentSc]
  );

  const budgetTotal = useMemo(() => {
    if (!currentSc) return 0;
    return currentSc.items.reduce(
      (acc, item) => acc + item.quantidade * item.preco_orcado_unit,
      0
    );
  }, [currentSc]);

  const quoteFinancials = useMemo(() => {
    const map: Record<
      string,
      {
        subtotalMercadorias: number;
        frete: number;
        desconto: number;
        custoFinalEqualizado: number;
      }
    > = {};

    scQuotations.forEach((q) => {
      if (isPacoteTecnico && q.pacote_tecnico) {
        const pkg = q.pacote_tecnico;
        const sub =
          pkg.valor_fornecimento_material +
          pkg.valor_mao_de_obra_instalacao +
          pkg.valor_art_rrt_projetos;
        map[q.id] = {
          subtotalMercadorias: sub,
          frete: q.valor_frete,
          desconto: q.desconto_negociado,
          custoFinalEqualizado: sub + q.valor_frete - q.desconto_negociado,
        };
        return;
      }

      let withTaxSum = 0;
      q.items.forEach((qi) => {
        const reqItem = currentSc?.items.find(
          (i) => i.id === qi.request_item_id
        );
        const qtd = reqItem ? reqItem.quantidade : 0;
        const withTax =
          qtd * qi.preco_unitario * (1 + qi.aliquota_ipi_icms / 100);
        withTaxSum += withTax;
      });

      map[q.id] = {
        subtotalMercadorias: withTaxSum,
        frete: q.valor_frete,
        desconto: q.desconto_negociado,
        custoFinalEqualizado:
          withTaxSum + q.valor_frete - q.desconto_negociado,
      };
    });

    return map;
  }, [scQuotations, currentSc, isPacoteTecnico]);

  const {
    winnerQuote,
    winnerVendor,
    lowestGlobalValue,
    highestGlobalValue,
    savingReal,
    savingVsBudget,
  } = useMemo(() => {
    if (scQuotations.length === 0) {
      return {
        winnerQuote: undefined,
        winnerVendor: undefined,
        lowestGlobalValue: 0,
        highestGlobalValue: 0,
        savingReal: 0,
        savingVsBudget: 0,
      };
    }

    let minQ = scQuotations[0];
    let minVal = quoteFinancials[minQ.id]?.custoFinalEqualizado || 0;
    let maxVal = minVal;

    scQuotations.forEach((q) => {
      const val = quoteFinancials[q.id]?.custoFinalEqualizado || 0;
      if (val < minVal) {
        minVal = val;
        minQ = q;
      }
      if (val > maxVal) {
        maxVal = val;
      }
    });

    const vend = vendors.find((v) => v.id === minQ.vendor_id);
    const sav = Math.max(0, maxVal - minVal);

    return {
      winnerQuote: minQ,
      winnerVendor: vend,
      lowestGlobalValue: minVal,
      highestGlobalValue: maxVal,
      savingReal: sav,
      savingVsBudget: budgetTotal - minVal,
    };
  }, [scQuotations, quoteFinancials, vendors, budgetTotal]);

  const [parecerTexto, setParecerTexto] = useState("");

  useEffect(() => {
    if (winnerVendor && winnerQuote && currentProject) {
      if (isPacoteTecnico && winnerQuote.pacote_tecnico) {
        const pkg = winnerQuote.pacote_tecnico;
        setParecerTexto(
          `Recomendamos a contratação da proposta apresentada por ${winnerVendor.nome_fantasia} (${winnerVendor.razao_social}) pelo valor total negociado de ${formatBRL(
            lowestGlobalValue
          )}, contemplando fornecimento de materiais (${formatBRL(
            pkg.valor_fornecimento_material
          )}), mão de obra de instalação (${formatBRL(
            pkg.valor_mao_de_obra_instalacao
          )}) e projetos executivos com ART (${formatBRL(
            pkg.valor_art_rrt_projetos
          )}). Garantia de ${pkg.garantia_anos} anos e pagamento conforme "${
            pkg.condicao_medicao_desembolso
          }".`
        );
      } else {
        setParecerTexto(
          `Recomendamos o fechamento com o fornecedor ${winnerVendor.nome_fantasia} (${winnerVendor.razao_social}) devido ao menor valor total negociado de ${formatBRL(
            lowestGlobalValue
          )}, frete ${winnerQuote.tipo_frete} e condição de pagamento "${
            winnerQuote.condicao_pagamento
          }" com entrega em ${
            winnerQuote.prazo_entrega_dias
          } dias úteis na obra ${currentProject.nome}.`
        );
      }
    }
  }, [
    winnerVendor,
    winnerQuote,
    currentProject,
    lowestGlobalValue,
    isPacoteTecnico,
  ]);

  if (!currentSc) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleApproveFromReport = () => {
    if (!winnerQuote) return;
    approveQuotationAndGenerateOC(winnerQuote.id);
    addToast(
      "Decisão de Compra Homologada",
      `Proposta de ${winnerVendor?.nome_fantasia} aprovada e Ordem de Compra emitida.`,
      "success"
    );
  };

  const todayFormatted = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="bg-white border border-slate-300 rounded-xl shadow-xs overflow-hidden print:border-0 print:shadow-none print:rounded-none">
      {/* Barra de Ação Superior (Oculta na Impressão) */}
      <div className="no-print bg-slate-100 border-b border-slate-300 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Relatório Executivo de Cotação para Diretoria
            </h2>
            <p className="text-sm text-slate-700">
              Documento formatado para reunião de aprovação e exportação em PDF
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={currentSc.id}
            onChange={(e) => setSelectedScId(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
          >
            {purchaseRequests.map((req) => (
              <option key={req.id} value={req.id}>
                {req.numero_sc} — {req.categoria_principal}
              </option>
            ))}
          </select>

          <button
            onClick={handleApproveFromReport}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-2 transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Homologar e Emitir Ordem</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar como PDF</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition"
              title="Fechar visualização"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* CORPO DO RELATÓRIO FORMAL (IMPRESSÃO / PDF LIMPO)            */}
      {/* ============================================================ */}
      <div className="p-8 print:p-4 space-y-6 bg-white text-slate-900">
        {/* 1. Cabeçalho Institucional */}
        <div className="border-b-2 border-slate-900 pb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1 rounded-lg border border-amber-200 shrink-0">
              <img
                src="/logo.png"
                alt="JC Bauer Empreendimentos"
                className="h-12 w-auto object-contain"
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-slate-900 uppercase">
                JC Bauer Empreendimentos • Diretoria de Suprimentos
              </div>
              <h1 className="text-xl font-bold text-slate-900">
                Mapa Comparativo de Cotação e Decisão de Compra
              </h1>
              <p className="text-sm text-slate-700">
                Obra:{" "}
                <strong className="text-slate-900">
                  {currentProject?.nome} ({currentProject?.codigo_sigla})
                </strong>{" "}
                • Disciplina:{" "}
                <strong className="text-slate-900">
                  {currentSc.categoria_principal}
                </strong>
              </p>
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 text-right text-sm space-y-1">
            <div>
              <span className="text-slate-700">Processo: </span>
              <strong className="text-slate-900 whitespace-nowrap tabular-nums">
                {currentSc.numero_sc}
              </strong>
            </div>
            <div>
              <span className="text-slate-700">Data de emissão: </span>
              <strong className="text-slate-900 whitespace-nowrap tabular-nums">
                {todayFormatted}
              </strong>
            </div>
            <div>
              <span className="text-slate-700">Solicitante: </span>
              <strong className="text-slate-900">
                {currentSc.solicitante} (Entrega:{" "}
                {formatDateBR(currentSc.data_limite_entrega)})
              </strong>
            </div>
          </div>
        </div>

        {/* 2. Três Indicadores Resumo de Decisão */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-5 space-y-1.5">
            <div className="text-sm font-medium text-slate-700">
              1. Fornecedor Recomendado
            </div>
            <div className="text-lg font-bold text-slate-900">
              {winnerVendor?.nome_fantasia}
            </div>
            <div className="text-sm text-slate-700 whitespace-nowrap tabular-nums">
              CNPJ: {winnerVendor?.cnpj}
            </div>
            <div className="pt-2 border-t border-slate-300 text-sm text-slate-700">
              Pagamento:{" "}
              <strong className="text-slate-900">
                {winnerQuote?.condicao_pagamento}
              </strong>
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-300 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">
                2. Valor Total Fechado
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1 whitespace-nowrap tabular-nums">
                {formatBRL(lowestGlobalValue)}
              </div>
              <div className="text-sm text-slate-700 mt-1 whitespace-nowrap tabular-nums">
                Orçamento de referência: {formatBRL(budgetTotal)}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-300 text-sm text-slate-700">
              Frete: <strong className="text-slate-900">{winnerQuote?.tipo_frete}</strong> • Prazo:{" "}
              <strong className="text-slate-900">
                {winnerQuote?.prazo_entrega_dias} dias úteis
              </strong>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-slate-300 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">
                3. Economia (Saving) na Negociação
              </div>
              <div className="text-2xl font-bold text-emerald-900 mt-1 whitespace-nowrap tabular-nums">
                {formatBRL(savingReal)}
              </div>
              <div className="text-sm text-slate-700 mt-1 whitespace-nowrap tabular-nums">
                Maior proposta recebida: {formatBRL(highestGlobalValue)}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-300 text-sm text-emerald-900 font-semibold whitespace-nowrap tabular-nums">
              {savingVsBudget >= 0
                ? `${formatBRL(savingVsBudget)} abaixo do orçamento`
                : `${formatBRL(Math.abs(savingVsBudget))} acima do orçamento`}
            </div>
          </div>
        </div>

        {/* 3. Tabela Comparativa Real */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-4 min-w-[300px] text-left border-r border-slate-300">
                    <div className="text-base font-bold text-slate-900">
                      Insumo / Escopo Contratado
                    </div>
                  </th>
                  <th className="p-4 min-w-[110px] text-center border-r border-slate-300">
                    <div className="text-base font-bold text-slate-900">
                      Unid. / Qtd.
                    </div>
                  </th>
                  {scQuotations.map((q) => {
                    const v = vendors.find((vend) => vend.id === q.vendor_id);
                    const contact = v?.contacts[0];
                    const isWin = q.id === winnerQuote?.id;
                    return (
                      <th
                        key={q.id}
                        className={`p-4 min-w-[230px] text-right border-r last:border-r-0 border-slate-300 ${
                          isWin ? "bg-emerald-50/70" : "bg-slate-100"
                        }`}
                      >
                        <div className="text-base font-bold text-slate-900">
                          {v?.nome_fantasia}
                        </div>
                        <div className="text-sm font-normal text-slate-700">
                          {contact?.nome_vendedor}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-300">
                {isPacoteTecnico ? (
                  <>
                    <tr>
                      <td className="p-4 text-left border-r border-slate-300 text-sm font-semibold text-slate-900">
                        1. Fornecimento de Materiais ({currentSc.items[0]?.descricao})
                      </td>
                      <td className="p-4 text-center border-r border-slate-300 text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                        1 vb
                      </td>
                      {scQuotations.map((q) => (
                        <td
                          key={q.id}
                          className="p-4 text-right border-r last:border-r-0 border-slate-300 text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums"
                        >
                          {formatBRL(
                            q.pacote_tecnico?.valor_fornecimento_material || 0
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 text-left border-r border-slate-300 text-sm font-semibold text-slate-900">
                        2. Mão de Obra de Instalação e Montagem
                      </td>
                      <td className="p-4 text-center border-r border-slate-300 text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                        1 vb
                      </td>
                      {scQuotations.map((q) => (
                        <td
                          key={q.id}
                          className="p-4 text-right border-r last:border-r-0 border-slate-300 text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums"
                        >
                          {formatBRL(
                            q.pacote_tecnico?.valor_mao_de_obra_instalacao || 0
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-4 text-left border-r border-slate-300 text-sm font-semibold text-slate-900">
                        3. Projetos Executivos e Emissão de ART
                      </td>
                      <td className="p-4 text-center border-r border-slate-300 text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                        1 cj
                      </td>
                      {scQuotations.map((q) => (
                        <td
                          key={q.id}
                          className="p-4 text-right border-r last:border-r-0 border-slate-300 text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums"
                        >
                          {formatBRL(
                            q.pacote_tecnico?.valor_art_rrt_projetos || 0
                          )}
                        </td>
                      ))}
                    </tr>
                  </>
                ) : (
                  currentSc.items.map((reqItem) => {
                    let minTotal = Infinity;
                    scQuotations.forEach((q) => {
                      const qi = q.items.find(
                        (i) => i.request_item_id === reqItem.id
                      );
                      if (qi && qi.valor_total_item < minTotal) {
                        minTotal = qi.valor_total_item;
                      }
                    });

                    return (
                      <tr key={reqItem.id}>
                        <td className="p-4 text-left border-r border-slate-300">
                          <div className="text-base font-semibold text-slate-900">
                            {reqItem.descricao}
                          </div>
                          <div className="text-sm text-slate-700">
                            Código: {reqItem.codigo_insumo}
                          </div>
                        </td>
                        <td className="p-4 text-center border-r border-slate-300 text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                          {reqItem.quantidade} {reqItem.unidade}
                        </td>
                        {scQuotations.map((q) => {
                          const qi = q.items.find(
                            (i) => i.request_item_id === reqItem.id
                          );
                          if (!qi) {
                            return (
                              <td
                                key={q.id}
                                className="p-4 text-right border-r last:border-r-0 border-slate-300 text-sm text-slate-700"
                              >
                                Não cotado
                              </td>
                            );
                          }
                          const isLowest =
                            Math.abs(qi.valor_total_item - minTotal) < 0.05;
                          return (
                            <td
                              key={q.id}
                              className={`p-4 text-right border-r last:border-r-0 border-slate-300 whitespace-nowrap tabular-nums ${
                                isLowest ? "bg-emerald-50/70" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-sm text-slate-700">
                                  Unit: {formatBRL(qi.preco_unitario)}
                                </span>
                                <span
                                  className={`text-base ${
                                    isLowest
                                      ? "text-emerald-900 font-bold"
                                      : "text-slate-900 font-semibold"
                                  }`}
                                >
                                  {formatBRL(qi.valor_total_item)}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>

              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr className="border-b border-slate-300 bg-white">
                  <td
                    colSpan={2}
                    className="p-4 text-left border-r border-slate-300 text-sm font-semibold text-slate-900"
                  >
                    Subtotal Materiais
                  </td>
                  {scQuotations.map((q) => (
                    <td
                      key={q.id}
                      className="p-4 text-right border-r last:border-r-0 border-slate-300 text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums"
                    >
                      {formatBRL(quoteFinancials[q.id]?.subtotalMercadorias || 0)}
                    </td>
                  ))}
                </tr>

                <tr className="border-b border-slate-300 bg-white">
                  <td
                    colSpan={2}
                    className="p-4 text-left border-r border-slate-300 text-sm font-semibold text-slate-900"
                  >
                    Frete ({winnerQuote?.tipo_frete}) e Desconto Negociado
                  </td>
                  {scQuotations.map((q) => (
                    <td
                      key={q.id}
                      className="p-4 text-right border-r last:border-r-0 border-slate-300 text-sm text-slate-700 whitespace-nowrap tabular-nums"
                    >
                      Frete ({q.tipo_frete}): {formatBRL(q.valor_frete)} • Desc:{" "}
                      {formatBRL(q.desconto_negociado)}
                    </td>
                  ))}
                </tr>

                <tr className="bg-slate-100">
                  <td
                    colSpan={2}
                    className="p-4 text-left border-r border-slate-300 text-lg font-bold text-slate-900"
                  >
                    VALOR TOTAL NEGOCIADO
                  </td>
                  {scQuotations.map((q) => {
                    const finalVal =
                      quoteFinancials[q.id]?.custoFinalEqualizado || 0;
                    const isWin = q.id === winnerQuote?.id;
                    return (
                      <td
                        key={q.id}
                        className={`p-4 text-right border-r last:border-r-0 border-slate-300 whitespace-nowrap tabular-nums ${
                          isWin ? "bg-emerald-50/70" : ""
                        }`}
                      >
                        <div
                          className={`text-lg font-bold ${
                            isWin ? "text-emerald-900" : "text-slate-900"
                          }`}
                        >
                          {formatBRL(finalVal)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* 4. Parecer Técnico e Comercial */}
        <div className="bg-slate-100 border border-slate-300 rounded-xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-slate-900">
              Parecer Técnico e Comercial de Suprimentos
            </h4>
            <span className="no-print text-sm text-slate-700">
              Texto editável para ata da diretoria
            </span>
          </div>
          <textarea
            rows={3}
            value={parecerTexto}
            onChange={(e) => setParecerTexto(e.target.value)}
            className="w-full bg-white print:bg-transparent border border-slate-300 print:border-0 rounded-lg p-3 print:p-0 text-sm text-slate-900 leading-relaxed focus:outline-none focus:border-slate-900 resize-none"
          />
        </div>

        {/* 5. Bloco de Assinaturas */}
        <div className="pt-8 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-12 text-center text-sm">
          <div className="space-y-1.5">
            <div className="border-b border-slate-900 w-4/5 mx-auto h-6" />
            <div className="font-bold text-slate-900">
              Coordenação de Suprimentos e Engenharia
            </div>
            <div className="text-slate-700">
              Rafael Mendes • Departamento de Compras JC Bauer
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="border-b border-slate-900 w-4/5 mx-auto h-6" />
            <div className="font-bold text-slate-900">
              Diretoria / Aprovação da Construtora
            </div>
            <div className="text-slate-700">
              Eng. João Carlos Bauer • Diretor Presidente
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExecutiveReportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs overflow-y-auto flex items-start justify-center p-4 sm:p-8 print:p-0 print:bg-white print:static print:block">
      <div className="w-full max-w-[1600px] print:max-w-none">
        <ExecutiveReportContent onClose={onClose} />
      </div>
    </div>
  );
}

export function ExecutiveReportInlineView() {
  return <ExecutiveReportContent />;
}
