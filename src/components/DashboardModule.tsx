"use client";

import React, { useMemo } from "react";
import { useProcurement } from "@/context/ProcurementContext";
import { formatBRL, formatDateBR } from "@/lib/formatters";
import {
  Building2,
  Scale,
  FileText,
  ArrowUpRight,
} from "lucide-react";

export function DashboardModule({
  onOpenNewScModal,
  onOpenExecutiveReport,
}: {
  onOpenNewScModal: () => void;
  onOpenExecutiveReport: () => void;
}) {
  const {
    projects,
    purchaseRequests,
    quotations,
    purchaseOrders,
    selectedProjectFilter,
    setSelectedProjectFilter,
    setSelectedScId,
    setSelectedOcId,
    setActiveTab,
  } = useProcurement();

  const filteredRequests = useMemo(() => {
    if (selectedProjectFilter === "ALL") return purchaseRequests;
    return purchaseRequests.filter(
      (r) => r.project_id === selectedProjectFilter
    );
  }, [purchaseRequests, selectedProjectFilter]);

  const filteredOrders = useMemo(() => {
    if (selectedProjectFilter === "ALL") return purchaseOrders;
    return purchaseOrders.filter((o) => o.project_id === selectedProjectFilter);
  }, [purchaseOrders, selectedProjectFilter]);

  const kpis = useMemo(() => {
    const abertas = filteredRequests.filter(
      (r) => r.status !== "Comprada" && r.status !== "Recusada"
    ).length;
    const finalizadas =
      filteredRequests.filter((r) => r.status === "Comprada").length +
      filteredOrders.length;

    const savingNegociacaoFechado = filteredOrders.reduce(
      (acc, oc) => acc + oc.valor_saving_negociacao,
      0
    );
    const volumeTotalComprado = filteredOrders.reduce(
      (acc, oc) => acc + oc.valor_total,
      0
    );

    return {
      abertas,
      finalizadas,
      savingNegociacaoFechado,
      volumeTotalComprado,
    };
  }, [filteredRequests, filteredOrders]);

  const handleOpenEqualizerForSc = (scId: string) => {
    setSelectedScId(scId);
    setActiveTab("equalizer");
  };

  const handleOpenOrder = (ocId: string) => {
    setSelectedOcId(ocId);
    setActiveTab("orders");
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Barra de Filtro por Obra */}
      <div className="bg-white border border-slate-300 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2 mr-1">
            <Building2 className="w-4 h-4 text-slate-900 shrink-0" />
            <span>Filtrar por obra:</span>
          </span>
          <button
            onClick={() => setSelectedProjectFilter("ALL")}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
              selectedProjectFilter === "ALL"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300"
            }`}
          >
            Todas as Obras ({projects.length})
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProjectFilter(p.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition ${
                selectedProjectFilter === p.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300"
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenExecutiveReport}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 border border-slate-300 transition flex items-center gap-2 whitespace-nowrap"
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Imprimir Relatório (PDF)</span>
          </button>
          <button
            onClick={onOpenNewScModal}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white transition whitespace-nowrap"
          >
            + Nova Solicitação
          </button>
        </div>
      </div>

      {/* 3 Indicadores Grandes e Limpos no Topo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-300 rounded-xl p-6 flex flex-col justify-between gap-2">
          <div className="text-sm font-medium text-slate-700">
            Solicitações de compra ativas
          </div>
          <div className="text-2xl font-bold text-slate-900 whitespace-nowrap tabular-nums">
            {kpis.abertas} em cotação • {kpis.finalizadas} concluídas
          </div>
          <div className="text-sm text-slate-700">
            Processos distribuídos nas 11 disciplinas da construção civil
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-xl p-6 flex flex-col justify-between gap-2">
          <div className="text-sm font-medium text-slate-700">
            Volume total contratado
          </div>
          <div className="text-2xl font-bold text-slate-900 whitespace-nowrap tabular-nums">
            {formatBRL(kpis.volumeTotalComprado)}
          </div>
          <div className="text-sm text-slate-700">
            {filteredOrders.length} ordens de compra emitidas e auditadas
          </div>
        </div>

        <div className="bg-emerald-50/70 border border-slate-300 rounded-xl p-6 flex flex-col justify-between gap-2">
          <div className="text-sm font-medium text-slate-700">
            Economia (Saving) acumulada nas obras
          </div>
          <div className="text-2xl font-bold text-emerald-900 whitespace-nowrap tabular-nums">
            {formatBRL(kpis.savingNegociacaoFechado)}
          </div>
          <div className="text-sm font-semibold text-emerald-900">
            Redução auditada frente às maiores propostas recebidas
          </div>
        </div>
      </div>

      {/* Tabela Real de Solicitações de Compra Prioritárias (100% na tela, máx 2 linhas por célula) */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Solicitações de Compra e Cotações em Andamento
            </h2>
            <p className="text-sm text-slate-700">
              Clique em qualquer processo para abrir a tabela comparativa de
              cotação
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap tabular-nums">
            {filteredRequests.length} processos listados
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                <th className="p-3.5 border border-slate-300">Processo</th>
                <th className="p-3.5 border border-slate-300">Obra</th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Orçamento Ref.
                </th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Propostas
                </th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Limite Obra
                </th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Situação
                </th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((sc) => {
                const proj = projects.find((p) => p.id === sc.project_id);
                const scQuotes = quotations.filter((q) => q.sc_id === sc.id);
                const orcamentoSc = sc.items.reduce(
                  (acc, i) => acc + i.quantidade * i.preco_orcado_unit,
                  0
                );

                return (
                  <tr
                    key={sc.id}
                    onClick={() => handleOpenEqualizerForSc(sc.id)}
                    className="odd:bg-white even:bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer"
                  >
                    {/* Processo: Máx 2 linhas curtas */}
                    <td className="p-3.5 border border-slate-300 align-middle whitespace-nowrap tabular-nums">
                      <div className="text-base font-bold text-slate-900">
                        {sc.numero_sc}
                      </div>
                      <div className="text-sm text-slate-700">
                        Prioridade {sc.prioridade}
                      </div>
                    </td>

                    {/* Coluna Obra: Linha 1 = Nome da Obra, Linha 2 = Apenas a disciplina principal */}
                    <td className="p-3.5 border border-slate-300 align-middle">
                      <div className="text-base font-bold text-slate-900">
                        {proj?.nome}
                      </div>
                      <div className="text-sm font-medium text-slate-700">
                        {sc.categoria_principal}
                      </div>
                    </td>

                    {/* Orçamento Ref: Máx 2 linhas curtas */}
                    <td className="p-3.5 border border-slate-300 align-middle text-right whitespace-nowrap tabular-nums">
                      <div className="text-base font-bold text-slate-900">
                        {formatBRL(orcamentoSc)}
                      </div>
                      <div className="text-sm text-slate-700">
                        {sc.items.length} item(ns)
                      </div>
                    </td>

                    {/* Propostas */}
                    <td className="p-3.5 border border-slate-300 align-middle text-center whitespace-nowrap tabular-nums">
                      <div className="text-base font-semibold text-slate-900">
                        {scQuotes.length} cotações
                      </div>
                      <div className="text-sm text-slate-700">
                        {sc.solicitante}
                      </div>
                    </td>

                    {/* Data Limite */}
                    <td className="p-3.5 border border-slate-300 align-middle text-center text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatDateBR(sc.data_limite_entrega)}
                    </td>

                    {/* Situação */}
                    <td className="p-3.5 border border-slate-300 align-middle text-center whitespace-nowrap">
                      <span
                        className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                          sc.status === "Comprada"
                            ? "bg-emerald-50/70 text-emerald-900"
                            : "bg-slate-100 text-slate-900 border border-slate-300"
                        }`}
                      >
                        {sc.status}
                      </span>
                    </td>

                    {/* Ação */}
                    <td className="p-3.5 border border-slate-300 align-middle text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEqualizerForSc(sc.id);
                        }}
                        className="px-3.5 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-1.5 transition whitespace-nowrap"
                      >
                        <Scale className="w-4 h-4 shrink-0" />
                        <span>Cotar</span>
                        <ArrowUpRight className="w-4 h-4 shrink-0" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela Real de Entregas Programadas nas Obras (w-full table-auto) */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-300 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Cronograma de Entregas e Ordens de Compra Emitidas
            </h2>
            <p className="text-sm text-slate-700">
              Acompanhamento de pedidos formais aguardando descarga nos
              canteiros
            </p>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                <th className="p-3.5 border border-slate-300">Ordem (OC)</th>
                <th className="p-3.5 border border-slate-300">Obra Destino</th>
                <th className="p-3.5 border border-slate-300">
                  Condição Fechada
                </th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Previsão Canteiro
                </th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Valor Fechado
                </th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Economia (Saving)
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((oc) => {
                const proj = projects.find((p) => p.id === oc.project_id);
                return (
                  <tr
                    key={oc.id}
                    onClick={() => handleOpenOrder(oc.id)}
                    className="odd:bg-white even:bg-slate-50 hover:bg-slate-100/80 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 border border-slate-300 text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {oc.numero_oc}
                    </td>
                    <td className="p-3.5 border border-slate-300">
                      <div className="text-base font-semibold text-slate-900">
                        {proj?.nome}
                      </div>
                      <div className="text-sm text-slate-700">
                        {proj?.codigo_sigla}
                      </div>
                    </td>
                    <td className="p-3.5 border border-slate-300 text-sm text-slate-700">
                      {oc.condicao_fechada} • Frete {oc.tipo_frete}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-center text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatDateBR(oc.previsao_entrega)}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatBRL(oc.valor_total)}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-emerald-900 bg-emerald-50/70 whitespace-nowrap tabular-nums">
                      {formatBRL(oc.valor_saving_negociacao)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
