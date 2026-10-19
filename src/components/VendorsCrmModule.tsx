"use client";

import React, { useState, useMemo } from "react";
import { useProcurement } from "@/context/ProcurementContext";
import { InsumoCategory, Vendor } from "@/types/procurement";
import { ALL_CATEGORIES } from "@/data/mockData";
import {
  formatBRL,
  formatDateBR,
  buildWhatsAppQuoteRequestUrl,
} from "@/lib/formatters";
import {
  Search,
  MessageSquare,
  Plus,
  Upload,
  X,
  ChevronRight,
} from "lucide-react";

export function VendorsCrmModule({
  onOpenImportModal,
}: {
  onOpenImportModal: () => void;
}) {
  const {
    vendors,
    quotations,
    purchaseRequests,
    projects,
    addVendorNote,
    addVendor,
  } = useProcurement();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [drawerVendorId, setDrawerVendorId] = useState<string | null>(null);
  const [scForWhatsApp, setScForWhatsApp] = useState<string>(
    purchaseRequests[0]?.id || "sc-01"
  );

  const [showNewVendorModal, setShowNewVendorModal] = useState(false);
  const [newFantasia, setNewFantasia] = useState("");
  const [newRazao, setNewRazao] = useState("");
  const [newCnpj, setNewCnpj] = useState("");
  const [newCidade, setNewCidade] = useState("Itajaí / SC");
  const [newCat, setNewCat] = useState<InsumoCategory>("Estrutura");
  const [newTags, setNewTags] = useState(
    "Esquadrias de Alumínio, Fachadas Pele de Vidro"
  );
  const [newVendedorNome, setNewVendedorNome] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("5547999990000");
  const [newNota, setNewNota] = useState("");

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      const q = searchQuery.toLowerCase();
      const matchesText =
        !q ||
        v.nome_fantasia.toLowerCase().includes(q) ||
        v.razao_social.toLowerCase().includes(q) ||
        v.cnpj.includes(q) ||
        v.cidade_uf.toLowerCase().includes(q) ||
        v.contacts.some((c) => c.nome_vendedor.toLowerCase().includes(q)) ||
        (v.tags_especialidade || []).some((t) =>
          t.toLowerCase().includes(q)
        );

      const matchesCat =
        selectedCategory === "ALL" ||
        v.categorias_atendidas.includes(selectedCategory as InsumoCategory);

      const matchesStatus =
        selectedStatus === "ALL" || v.status_homologacao === selectedStatus;

      return matchesText && matchesCat && matchesStatus;
    });
  }, [vendors, searchQuery, selectedCategory, selectedStatus]);

  const activeVendor = useMemo(
    () =>
      drawerVendorId ? vendors.find((v) => v.id === drawerVendorId) || null : null,
    [vendors, drawerVendorId]
  );

  const activeContact = activeVendor?.contacts[0];

  const [draftNote, setDraftNote] = useState<string>("");

  React.useEffect(() => {
    if (activeVendor) {
      setDraftNote(activeVendor.contacts[0]?.notas_negociacao || "");
    }
  }, [activeVendor]);

  const vendorQuotationsHistory = useMemo(() => {
    if (!activeVendor) return [];
    return quotations.filter((q) => q.vendor_id === activeVendor.id);
  }, [quotations, activeVendor]);

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFantasia.trim()) return;
    const vId = `vend-${Date.now()}`;
    const parsedTags = newTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const created: Vendor = {
      id: vId,
      nome_fantasia: newFantasia,
      razao_social: newRazao || `${newFantasia} Comércio Ltda`,
      cnpj: newCnpj || "19.400.120/0001-90",
      inscricao_estadual: "256.001.900",
      cidade_uf: newCidade,
      categorias_atendidas: [newCat],
      tags_especialidade: parsedTags.length > 0 ? parsedTags : [newCat],
      status_homologacao: "Homologado",
      score_avaliacao: 5.0,
      condicoes_pagamento_padrao: "28/42 ddl Boleto",
      contacts: [
        {
          id: `cont-${Date.now()}`,
          vendor_id: vId,
          nome_vendedor: newVendedorNome || "Consultor B2B",
          cargo: "Executivo Comercial",
          whatsapp: newWhatsapp.replace(/\D/g, ""),
          telefone: newWhatsapp,
          email: `comercial@${newFantasia
            .toLowerCase()
            .replace(/\s+/g, "")}.com.br`,
          chave_pix: newCnpj || "CNPJ",
          notas_negociacao:
            newNota || "Fornecedor homologado para cotações B2B.",
        },
      ],
      avaliacoes: [],
    };
    addVendor(created);
    setDrawerVendorId(vId);
    setShowNewVendorModal(false);
    setNewFantasia("");
    setNewRazao("");
    setNewCnpj("");
    setNewVendedorNome("");
    setNewNota("");
  };

  const targetScObj =
    purchaseRequests.find((r) => r.id === scForWhatsApp) || purchaseRequests[0];
  const targetProjObj = projects.find((p) => p.id === targetScObj?.project_id);

  return (
    <div className="space-y-6 min-w-0">
      {/* Barra de Busca e Filtro por Disciplina */}
      <div className="bg-white border border-slate-300 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-700 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por fornecedor, cidade, vendedor ou especialidade (ex: Esquadrias, Elevadores)..."
              className="w-full bg-slate-100 border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-900"
            >
              <option value="ALL">
                Todas as 11 Disciplinas ({vendors.length})
              </option>
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-900"
            >
              <option value="ALL">Situação: Todos</option>
              <option value="Homologado">Homologado</option>
              <option value="Em Análise">Em Análise</option>
              <option value="Bloqueado">Bloqueado</option>
            </select>

            <button
              onClick={onOpenImportModal}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4 text-slate-700 shrink-0" />
              <span>Importar Planilha</span>
            </button>

            <button
              onClick={() => setShowNewVendorModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Novo Fornecedor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabela Real de Fornecedores Homologados (w-full table-auto, máx 2 linhas curtas) */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-300 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Fornecedores e Vendedores Homologados
            </h2>
            <p className="text-sm text-slate-700">
              Clique em qualquer fornecedor para abrir a Gaveta Lateral (Drawer)
              com Razão Social, CNPJ, especialidades e histórico
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap tabular-nums">
            {filteredVendors.length} fornecedores listados
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                <th className="p-3.5 border border-slate-300">Fornecedor</th>
                <th className="p-3.5 border border-slate-300">
                  Especialidades
                </th>
                <th className="p-3.5 border border-slate-300">Vendedor</th>
                <th className="p-3.5 border border-slate-300">
                  Condição Padrão
                </th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((vendor) => {
                const contact = vendor.contacts[0];
                const isSelected = vendor.id === drawerVendorId;

                // Combinar categorias e tags de especialidade sem repetição
                const allTags = Array.from(
                  new Set([
                    ...vendor.categorias_atendidas,
                    ...(vendor.tags_especialidade || []),
                  ])
                );
                const visibleTags = allTags.slice(0, 2);
                const extraTagsCount = Math.max(0, allTags.length - 2);

                return (
                  <tr
                    key={vendor.id}
                    onClick={() => setDrawerVendorId(vendor.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-emerald-50/70"
                        : "odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                    }`}
                  >
                    {/* Coluna Fornecedor: APENAS Nome Fantasia (Linha 1) e Cidade abaixo (Linha 2) */}
                    <td className="p-3.5 border border-slate-300 align-middle">
                      <div className="text-base font-bold text-slate-900">
                        {vendor.nome_fantasia}
                      </div>
                      <div className="text-sm text-slate-700">
                        {vendor.cidade_uf}
                      </div>
                    </td>

                    {/* Coluna Especialidade: Máx 2 tags limpas + indicador +N */}
                    <td className="p-3.5 border border-slate-300 align-middle">
                      <div className="flex flex-wrap items-center gap-2">
                        {visibleTags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-sm font-medium text-slate-800 whitespace-nowrap"
                          >
                            {tag}
                          </span>
                        ))}
                        {extraTagsCount > 0 && (
                          <span className="px-2.5 py-1 rounded-md bg-slate-200 border border-slate-300 text-sm font-bold text-slate-900 whitespace-nowrap tabular-nums">
                            +{extraTagsCount}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Coluna Vendedor: Nome do Vendedor + Botão rápido de WhatsApp ao lado */}
                    <td className="p-3.5 border border-slate-300 align-middle">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-semibold text-slate-900">
                            {contact?.nome_vendedor}
                          </div>
                          <div className="text-sm text-slate-700 whitespace-nowrap tabular-nums">
                            {contact?.telefone}
                          </div>
                        </div>

                        {contact && targetScObj && (
                          <a
                            href={buildWhatsAppQuoteRequestUrl(
                              contact,
                              vendor,
                              targetScObj,
                              targetProjObj
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition shrink-0 whitespace-nowrap"
                          >
                            <MessageSquare className="w-4 h-4 shrink-0" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Condição Padrão */}
                    <td className="p-3.5 border border-slate-300 align-middle">
                      <div className="text-base font-semibold text-emerald-900">
                        {vendor.condicoes_pagamento_padrao}
                      </div>
                      <div className="text-sm text-slate-700">
                        {vendor.status_homologacao}
                      </div>
                    </td>

                    {/* Botão Abrir Gaveta */}
                    <td className="p-3.5 border border-slate-300 align-middle text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerVendorId(vendor.id);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-sm font-semibold text-slate-900 inline-flex items-center gap-1 transition"
                      >
                        <span>Ver Ficha</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* GAVETA DE DETALHES (DRAWER LATERAL DIREITO) AO CLICAR NA LINHA    */}
      {/* ================================================================= */}
      {activeVendor && activeContact && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div
            className="flex-1"
            onClick={() => setDrawerVendorId(null)}
            aria-hidden="true"
          />
          <aside className="w-full max-w-2xl bg-white border-l border-slate-300 shadow-2xl h-full flex flex-col justify-between overflow-hidden">
            {/* Cabeçalho Fixo da Gaveta */}
            <div className="p-6 border-b border-slate-300 bg-slate-100 flex items-start justify-between gap-4 shrink-0">
              <div>
                <div className="text-sm font-semibold text-emerald-900">
                  Ficha Cadastral e Histórico do Fornecedor
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {activeVendor.nome_fantasia}
                </h2>
                <p className="text-sm text-slate-700 mt-0.5">
                  Razão Social: {activeVendor.razao_social}
                </p>
              </div>
              <button
                onClick={() => setDrawerVendorId(null)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-200 border border-slate-300 text-slate-900 text-sm font-semibold flex items-center gap-1.5 shrink-0"
              >
                <X className="w-4 h-4" />
                <span>Fechar</span>
              </button>
            </div>

            {/* Corpo Rolável da Gaveta */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Dados Fiscais e de Contato */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-300 rounded-xl p-4 text-sm">
                <div>
                  <span className="text-slate-700 block">CNPJ Validado</span>
                  <span className="text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                    {activeVendor.cnpj}
                  </span>
                </div>
                <div>
                  <span className="text-slate-700 block">
                    Inscrição Estadual / Cidade
                  </span>
                  <span className="text-base font-semibold text-slate-900">
                    IE {activeVendor.inscricao_estadual} •{" "}
                    {activeVendor.cidade_uf}
                  </span>
                </div>
                <div>
                  <span className="text-slate-700 block">
                    Vendedor Responsável
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {activeContact.nome_vendedor} ({activeContact.cargo})
                  </span>
                </div>
                <div>
                  <span className="text-slate-700 block">
                    Telefone / WhatsApp Direto
                  </span>
                  <span className="text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                    {activeContact.telefone}
                  </span>
                </div>
                <div>
                  <span className="text-slate-700 block">E-mail Comercial</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {activeContact.email}
                  </span>
                </div>
                <div>
                  <span className="text-slate-700 block">
                    Chave PIX / Faturamento
                  </span>
                  <span className="text-sm font-bold text-emerald-900 whitespace-nowrap tabular-nums">
                    {activeContact.chave_pix}
                  </span>
                </div>
              </div>

              {/* Todas as Disciplinas e Especialidades */}
              <div className="space-y-2.5">
                <div className="text-base font-bold text-slate-900">
                  Disciplinas e Especialidades Atendidas
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    new Set([
                      ...activeVendor.categorias_atendidas,
                      ...(activeVendor.tags_especialidade || []),
                    ])
                  ).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-300 text-sm font-semibold text-slate-900"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Ação Rápida de Cotação por WhatsApp */}
              <div className="bg-emerald-50/70 border border-slate-300 rounded-xl p-4 space-y-3">
                <div className="text-sm font-bold text-slate-900">
                  Disparar Solicitação de Cotação no WhatsApp de{" "}
                  {activeContact.nome_vendedor}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={scForWhatsApp}
                    onChange={(e) => setScForWhatsApp(e.target.value)}
                    className="flex-1 min-w-[220px] bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900"
                  >
                    {purchaseRequests.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.numero_sc} — {r.categoria_principal}
                      </option>
                    ))}
                  </select>
                  {targetScObj && (
                    <a
                      href={buildWhatsAppQuoteRequestUrl(
                        activeContact,
                        activeVendor,
                        targetScObj,
                        targetProjObj
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-2 transition whitespace-nowrap"
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>Enviar no WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Notas Internas de Negociação */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-base font-bold text-slate-900">
                    Notas Internas de Negociação
                  </label>
                  <button
                    onClick={() =>
                      addVendorNote(activeVendor.id, activeContact.id, draftNote)
                    }
                    className="px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    Salvar Nota
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              {/* Histórico de Cotações deste Fornecedor */}
              <div className="space-y-2.5">
                <h3 className="text-base font-bold text-slate-900">
                  Histórico de Cotações Participadas (
                  {vendorQuotationsHistory.length})
                </h3>
                {vendorQuotationsHistory.length === 0 ? (
                  <p className="text-sm text-slate-700">
                    Nenhuma cotação registrada para este fornecedor até o
                    momento.
                  </p>
                ) : (
                  <div className="border border-slate-300 rounded-xl overflow-hidden">
                    <table className="w-full table-auto text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                          <th className="p-3 border border-slate-300">
                            Processo
                          </th>
                          <th className="p-3 border border-slate-300">
                            Retorno
                          </th>
                          <th className="p-3 border border-slate-300">
                            Pagamento
                          </th>
                          <th className="p-3 border border-slate-300 text-right">
                            Valor Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendorQuotationsHistory.map((q) => {
                          const sc = purchaseRequests.find(
                            (r) => r.id === q.sc_id
                          );
                          const val = q.pacote_tecnico
                            ? q.pacote_tecnico.valor_fornecimento_material +
                              q.pacote_tecnico.valor_mao_de_obra_instalacao +
                              q.pacote_tecnico.valor_art_rrt_projetos +
                              q.valor_frete -
                              q.desconto_negociado
                            : q.items.reduce(
                                (a, b) => a + b.valor_total_item,
                                0
                              ) +
                              q.valor_frete -
                              q.desconto_negociado;
                          return (
                            <tr
                              key={q.id}
                              className="odd:bg-white even:bg-slate-50"
                            >
                              <td className="p-3 border border-slate-300 text-sm font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                {sc?.numero_sc}
                              </td>
                              <td className="p-3 border border-slate-300 text-sm text-slate-700 whitespace-nowrap tabular-nums">
                                {formatDateBR(q.data_retorno)}
                              </td>
                              <td className="p-3 border border-slate-300 text-sm text-slate-900">
                                {q.condicao_pagamento}
                              </td>
                              <td className="p-3 border border-slate-300 text-right text-sm font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                {formatBRL(val)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Modal Novo Fornecedor */}
      {showNewVendorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateVendor}
            className="bg-white border border-slate-300 rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-300 pb-3">
              Homologar Novo Fornecedor e Vendedor
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Nome Fantasia *
                </label>
                <input
                  required
                  value={newFantasia}
                  onChange={(e) => setNewFantasia(e.target.value)}
                  placeholder="Ex: Catarinense Esquadrias"
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  CNPJ
                </label>
                <input
                  value={newCnpj}
                  onChange={(e) => setNewCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 tabular-nums"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Cidade / UF
                </label>
                <input
                  value={newCidade}
                  onChange={(e) => setNewCidade(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Disciplina Principal
                </label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value as InsumoCategory)}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
                >
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-slate-700 font-semibold block mb-1">
                  Especialidades Atendidas (separadas por vírgula)
                </label>
                <input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="Ex: Esquadrias de Alumínio, Fachadas Pele de Vidro"
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  Nome do Vendedor *
                </label>
                <input
                  required
                  value={newVendedorNome}
                  onChange={(e) => setNewVendedorNome(e.target.value)}
                  placeholder="Ex: Marcos Oliveira"
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
                />
              </div>
              <div>
                <label className="text-slate-700 font-semibold block mb-1">
                  WhatsApp (com DDD)
                </label>
                <input
                  value={newWhatsapp}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-700 font-semibold block mb-1">
                Observações de Negociação
              </label>
              <input
                value={newNota}
                onChange={(e) => setNewNota(e.target.value)}
                placeholder="Ex: Bom desconto para pagamento em 28 dias..."
                className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewVendorModal(false)}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white"
              >
                Salvar Fornecedor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
