"use client";

import React, { useMemo } from "react";
import { useProcurement } from "@/context/ProcurementContext";
import {
  formatBRL,
  formatDateBR,
  buildWhatsAppPurchaseOrderUrl,
} from "@/lib/formatters";
import {
  Printer,
  MessageSquare,
  Link2,
  CheckCircle2,
} from "lucide-react";

export function PurchaseOrdersModule() {
  const {
    purchaseOrders,
    purchaseRequests,
    quotations,
    vendors,
    projects,
    selectedOcId,
    setSelectedOcId,
    updatePurchaseOrderStatus,
    addToast,
  } = useProcurement();

  const activeOc = useMemo(
    () =>
      purchaseOrders.find((o) => o.id === selectedOcId) || purchaseOrders[0],
    [purchaseOrders, selectedOcId]
  );

  const activeVendor = useMemo(
    () => vendors.find((v) => v.id === activeOc?.vendor_id),
    [vendors, activeOc]
  );

  const activeContact = useMemo(
    () =>
      activeVendor?.contacts.find(
        (c) => c.id === activeOc?.vendor_contact_id
      ) || activeVendor?.contacts[0],
    [activeVendor, activeOc]
  );

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeOc?.project_id),
    [projects, activeOc]
  );

  const activeSc = useMemo(
    () => purchaseRequests.find((r) => r.id === activeOc?.sc_id),
    [purchaseRequests, activeOc]
  );

  const activeQuote = useMemo(
    () => quotations.find((q) => q.id === activeOc?.quotation_id),
    [quotations, activeOc]
  );

  const handleCopyAcceptanceLink = () => {
    if (!activeOc) return;
    const fakeUrl = `https://suprimentos.jcbauer.eng.br/aceite/${activeOc.numero_oc.toLowerCase()}?token=b2b-${activeOc.id}`;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(fakeUrl);
    }
    addToast(
      "Link de Aceite Copiado",
      `Link de confirmação (${fakeUrl}) copiado para a área de transferência.`,
      "success"
    );
  };

  const handlePrintPdf = () => {
    window.print();
  };

  if (!activeOc) return null;

  return (
    <div className="space-y-6 min-w-0">
      {/* Tabela de Seleção de Ordens de Compra Emitidas (w-full table-auto, 100% na tela) */}
      <div className="no-print print:hidden bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-300 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Ordens de Compra Emitidas ({purchaseOrders.length})
            </h2>
            <p className="text-sm text-slate-700">
              Clique em um pedido para visualizar o documento formal, enviar via
              WhatsApp ou imprimir em PDF
            </p>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                <th className="p-3.5 border border-slate-300">Número da OC</th>
                <th className="p-3.5 border border-slate-300">Fornecedor</th>
                <th className="p-3.5 border border-slate-300">Obra Destino</th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Emissão
                </th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Valor Total
                </th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Economia (Saving)
                </th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((oc) => {
                const vend = vendors.find((v) => v.id === oc.vendor_id);
                const proj = projects.find((p) => p.id === oc.project_id);
                const isSelected = oc.id === activeOc.id;

                return (
                  <tr
                    key={oc.id}
                    onClick={() => setSelectedOcId(oc.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50/70"
                        : "odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                    }`}
                  >
                    <td className="p-3.5 border border-slate-300 text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {oc.numero_oc}
                    </td>
                    <td className="p-3.5 border border-slate-300">
                      <div className="text-base font-bold text-slate-900">
                        {vend?.nome_fantasia}
                      </div>
                      <div className="text-sm text-slate-700">
                        {vend?.cidade_uf}
                      </div>
                    </td>
                    <td className="p-3.5 border border-slate-300">
                      <div className="text-base font-semibold text-slate-900">
                        {proj?.nome}
                      </div>
                      <div className="text-sm text-slate-700">
                        {proj?.codigo_sigla}
                      </div>
                    </td>
                    <td className="p-3.5 border border-slate-300 text-center text-sm font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                      {formatDateBR(oc.data_emissao)}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatBRL(oc.valor_total)}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-emerald-900 whitespace-nowrap tabular-nums">
                      {formatBRL(oc.valor_saving_negociacao)}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-center text-sm font-semibold text-slate-900 whitespace-nowrap">
                      {oc.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barra de Ações do Pedido Selecionado */}
      <div className="no-print print:hidden bg-white border border-slate-300 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">
            Situação do pedido:
          </span>
          <select
            value={activeOc.status}
            onChange={(e) =>
              updatePurchaseOrderStatus(
                activeOc.id,
                e.target.value as typeof activeOc.status
              )
            }
            className="bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-900"
          >
            <option value="Emitida">Emitida</option>
            <option value="Aguardando Entrega">Aguardando Entrega</option>
            <option value="Parcialmente Entregue">Parcialmente Entregue</option>
            <option value="Finalizada">Finalizada</option>
            <option value="Cancelada">Cancelada</option>
          </select>

          <button
            onClick={() =>
              updatePurchaseOrderStatus(
                activeOc.id,
                activeOc.status,
                !activeOc.de_acordo_fornecedor
              )
            }
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border transition whitespace-nowrap ${
              activeOc.de_acordo_fornecedor
                ? "bg-emerald-50/70 text-emerald-900 border-slate-300"
                : "bg-slate-100 text-slate-900 border-slate-300"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {activeOc.de_acordo_fornecedor
                ? "Aceite do Fornecedor Confirmado"
                : "Registrar Aceite do Fornecedor"}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCopyAcceptanceLink}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 flex items-center gap-2 whitespace-nowrap"
          >
            <Link2 className="w-4 h-4 text-slate-700 shrink-0" />
            <span>Copiar Link de Aceite</span>
          </button>

          {activeVendor && activeContact && (
            <a
              href={buildWhatsAppPurchaseOrderUrl(
                activeOc,
                activeVendor,
                activeContact,
                activeSc,
                activeProject
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-2 whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>Enviar no WhatsApp</span>
            </a>
          )}

          <button
            onClick={handlePrintPdf}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 whitespace-nowrap"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Imprimir Ordem de Compra (PDF)</span>
          </button>
        </div>
      </div>

      {/* Documento Formal da Ordem de Compra */}
      <div className="bg-white border border-slate-300 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              JC Bauer Engenharia e Incorporações S.A.
            </h1>
            <p className="text-sm text-slate-700 mt-1 whitespace-nowrap tabular-nums">
              CNPJ: 04.819.302/0001-71 • IE: 254.991.800 • Central de
              Suprimentos B2B
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold text-slate-700">
              Pedido Formal de Compra
            </div>
            <div className="text-2xl font-bold text-slate-900 whitespace-nowrap tabular-nums">
              {activeOc.numero_oc}
            </div>
            <div className="text-sm text-slate-700 whitespace-nowrap tabular-nums">
              Emissão: {formatDateBR(activeOc.data_emissao)} • Ref:{" "}
              {activeSc?.numero_sc}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-5 space-y-1.5">
            <div className="text-sm font-semibold text-slate-700">
              1. Fornecedor Homologado
            </div>
            <div className="text-base font-bold text-slate-900">
              {activeVendor?.nome_fantasia} ({activeVendor?.razao_social})
            </div>
            <div className="text-slate-700 whitespace-nowrap tabular-nums">
              CNPJ: {activeVendor?.cnpj} • Vendedor:{" "}
              <strong className="text-slate-900">
                {activeContact?.nome_vendedor}
              </strong>{" "}
              ({activeContact?.telefone})
            </div>
            <div className="text-emerald-900 font-semibold">
              Dados de faturamento / PIX: {activeContact?.chave_pix}
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-300 rounded-xl p-5 space-y-1.5">
            <div className="text-sm font-semibold text-slate-700">
              2. Obra e Local de Entrega
            </div>
            <div className="text-base font-bold text-slate-900">
              {activeProject?.nome} ({activeProject?.codigo_sigla})
            </div>
            <div className="text-slate-700">
              Endereço: {activeProject?.endereco}
            </div>
            <div className="text-slate-900 font-semibold whitespace-nowrap tabular-nums">
              Responsável: {activeProject?.responsavel_obra} • Previsão:{" "}
              {formatDateBR(activeOc.previsao_entrega)}
            </div>
          </div>
        </div>

        {/* Tabela de Itens do Pedido (w-full table-auto, máx 2 linhas por célula) */}
        <div className="border border-slate-300 rounded-xl overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                  <th className="p-3.5 border border-slate-300">Código</th>
                  <th className="p-3.5 border border-slate-300">
                    Material / Insumo
                  </th>
                  <th className="p-3.5 border border-slate-300 text-center">
                    Unid. / Qtd.
                  </th>
                  <th className="p-3.5 border border-slate-300 text-right">
                    Unitário (R$)
                  </th>
                  <th className="p-3.5 border border-slate-300 text-right">
                    Total (R$)
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeSc?.items.map((reqItem) => {
                  const qi = activeQuote?.items.find(
                    (i) => i.request_item_id === reqItem.id
                  );
                  const unitPrice = qi
                    ? qi.preco_unitario
                    : reqItem.preco_orcado_unit * 0.92;
                  const totalItem = qi
                    ? qi.valor_total_item
                    : reqItem.quantidade * unitPrice;

                  return (
                    <tr
                      key={reqItem.id}
                      className="odd:bg-white even:bg-slate-50"
                    >
                      <td className="p-3.5 border border-slate-300 text-sm font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                        {reqItem.codigo_insumo}
                      </td>
                      <td className="p-3.5 border border-slate-300">
                        <div className="text-base font-semibold text-slate-900">
                          {reqItem.descricao}
                        </div>
                        <div className="text-sm text-slate-700">
                          {reqItem.categoria}
                        </div>
                      </td>
                      <td className="p-3.5 border border-slate-300 text-center text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                        {reqItem.quantidade} {reqItem.unidade}
                      </td>
                      <td className="p-3.5 border border-slate-300 text-right text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                        {formatBRL(unitPrice)} / {reqItem.unidade}
                      </td>
                      <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                        {formatBRL(totalItem)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                <tr>
                  <td
                    colSpan={4}
                    className="p-4 text-left border border-slate-300 text-lg font-bold text-slate-900"
                  >
                    VALOR TOTAL NEGOCIADO ({activeOc.condicao_fechada} • Frete{" "}
                    {activeOc.tipo_frete})
                  </td>
                  <td className="p-4 text-right border border-slate-300 text-lg font-bold text-emerald-900 bg-emerald-50/70 whitespace-nowrap tabular-nums">
                    {formatBRL(activeOc.valor_total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
