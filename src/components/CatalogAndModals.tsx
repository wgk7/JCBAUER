"use client";

import React, { useState, useMemo } from "react";
import { useProcurement } from "@/context/ProcurementContext";
import { formatBRL } from "@/lib/formatters";
import {
  Search,
  Upload,
  Plus,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";
import {
  PurchaseRequest,
  RequestItem,
  InsumoCategory,
  EqualizationMode,
} from "@/types/procurement";
import { CONSTRUCTION_TAXONOMY, ALL_CATEGORIES } from "@/data/mockData";

export function CatalogModule({
  onOpenImportModal,
}: {
  onOpenImportModal: () => void;
}) {
  const { catalog, projects } = useProcurement();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    return catalog.filter((item) => {
      const q = search.toLowerCase();
      const matchesText =
        !q ||
        item.descricao.toLowerCase().includes(q) ||
        item.codigo_insumo.toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q);
      const matchesCat = catFilter === "ALL" || item.categoria === catFilter;
      return matchesText && matchesCat;
    });
  }, [catalog, search, catFilter]);

  return (
    <div className="space-y-6 min-w-0">
      {/* Tabela de Obras Ativas (w-full table-auto) */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-300">
          <h2 className="text-base font-bold text-slate-900">
            Obras e Centros de Custo ({projects.length})
          </h2>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                <th className="p-3.5 border border-slate-300">Código</th>
                <th className="p-3.5 border border-slate-300">Nome da Obra</th>
                <th className="p-3.5 border border-slate-300">Endereço</th>
                <th className="p-3.5 border border-slate-300">
                  Engenheiro Responsável
                </th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Situação
                </th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                >
                  <td className="p-3.5 border border-slate-300 text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                    {p.codigo_sigla}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-base font-semibold text-slate-900">
                    {p.nome}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-sm text-slate-700">
                    {p.endereco}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-sm font-semibold text-slate-900">
                    {p.responsavel_obra}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-center text-sm font-semibold text-emerald-900 bg-emerald-50/70">
                    {p.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Catálogo Padronizado de Insumos e 11 Disciplinas (w-full table-auto) */}
      <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Base Padronizada de Insumos e Pacotes Técnicos ({filtered.length})
            </h2>
            <p className="text-sm text-slate-700">
              Estrutura oficial com as 11 disciplinas da construção civil
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-700 absolute left-3.5 top-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar código ou descrição..."
                className="bg-slate-100 border border-slate-300 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900"
              />
            </div>

            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-900"
            >
              <option value="ALL">Todas as 11 Disciplinas</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              onClick={onOpenImportModal}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>Importar Planilha</span>
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full table-auto text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                <th className="p-3.5 border border-slate-300">Código</th>
                <th className="p-3.5 border border-slate-300">
                  Descrição Técnica / Escopo
                </th>
                <th className="p-3.5 border border-slate-300">
                  Disciplina Oficial
                </th>
                <th className="p-3.5 border border-slate-300 text-center">
                  Unidade
                </th>
                <th className="p-3.5 border border-slate-300 text-right">
                  Preço Referência (R$)
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                >
                  <td className="p-3.5 border border-slate-300 text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                    {item.codigo_insumo}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-base font-semibold text-slate-900">
                    {item.descricao}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-sm text-slate-700">
                    {item.categoria}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-center text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                    {item.unidade_medida}
                  </td>
                  <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-emerald-900 whitespace-nowrap tabular-nums">
                    {formatBRL(item.preco_referencia)} / {item.unidade_medida}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function SpreadsheetImportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { importCatalogFromText, importVendorsFromText } = useProcurement();
  const [importType, setImportType] = useState<"catalog" | "vendors">(
    "catalog"
  );
  const [rawText, setRawText] = useState(
    "SINAPI-00041920\tBloco Cerâmico Estrutural 14x19x29cm NBR 15270\tAlvenaria, Vedações & Fachada Leve\tun\t2,85\nSINAPI-00039100\tDisjuntor Tripolar Termomagnético DIN 63A Curva C\tInstalações Elétricas, Telecom & Segurança\tun\t84,90"
  );

  if (!isOpen) return null;

  const handleSwitchType = (t: "catalog" | "vendors") => {
    setImportType(t);
    if (t === "catalog") {
      setRawText(
        "SINAPI-00041920\tBloco Cerâmico Estrutural 14x19x29cm NBR 15270\tAlvenaria, Vedações & Fachada Leve\tun\t2,85\nSINAPI-00039100\tDisjuntor Tripolar Termomagnético DIN 63A Curva C\tInstalações Elétricas, Telecom & Segurança\tun\t84,90"
      );
    } else {
      setRawText(
        "Catarinense Cimentos\tCatarinense Cimentos e Argamassas Ltda\t18.220.410/0001-99\tItajaí / SC\tAlvenaria, Vedações & Fachada Leve\t28/42 ddl\tEduardo Silva\t5547998112233\teduardo@catarinense.com.br\t18.220.410/0001-99"
      );
    }
  };

  const handleImport = () => {
    if (importType === "catalog") {
      importCatalogFromText(rawText);
    } else {
      importVendorsFromText(rawText);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 rounded-xl max-w-3xl w-full p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-300 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-800" />
            <h3 className="text-lg font-bold text-slate-900">
              Importador Rápido de Planilhas (CSV / Excel)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSwitchType("catalog")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              importType === "catalog"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Importar Catálogo de Insumos
          </button>
          <button
            onClick={() => handleSwitchType("vendors")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              importType === "vendors"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Importar Fornecedores e Vendedores
          </button>
        </div>

        <textarea
          rows={6}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="w-full bg-slate-100 border border-slate-300 rounded-lg p-3.5 text-sm text-slate-900"
        />

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-900"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white"
          >
            Importar Dados Agora
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewPurchaseRequestModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    projects,
    catalog,
    vendors,
    purchaseRequests,
    createPurchaseRequest,
    setActiveTab,
  } = useProcurement();

  const [projectId, setProjectId] = useState(projects[0]?.id || "proj-01");
  const [solicitante, setSolicitante] = useState("Eng. Marcos Viana");
  const [categoriaPrincipal, setCategoriaPrincipal] =
    useState<InsumoCategory>("Envoltória, Vidros & Esquadrias");
  const [modalidade, setModalidade] =
    useState<EqualizationMode>("PACOTE_TECNICO");
  const [etapaObra, setEtapaObra] = useState(
    "06.01 - Envoltória, Esquadrias e Fachada Pele de Vidro"
  );
  const [prioridade, setPrioridade] = useState<"Normal" | "Alta" | "Crítica">(
    "Alta"
  );
  const [observacoes] = useState(
    "Contratar pacote Turn-Key (Fornecimento + Instalação com ART e garantia de 5 anos)."
  );

  const suggestedVendors = useMemo(
    () =>
      vendors.filter((v) =>
        v.categorias_atendidas.includes(categoriaPrincipal)
      ),
    [vendors, categoriaPrincipal]
  );

  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([
    "vend-esq-01",
    "vend-esq-02",
    "vend-esq-03",
  ]);

  const categoryCatalogItems = useMemo(
    () => catalog.filter((c) => c.categoria === categoriaPrincipal),
    [catalog, categoriaPrincipal]
  );

  const [selectedCatalogId, setSelectedCatalogId] = useState("cat-esq-01");
  const [itemQty, setItemQty] = useState(1);
  const [draftItems, setDraftItems] = useState<
    { catalogId: string; quantidade: number; obs: string }[]
  >([
    {
      catalogId: "cat-esq-01",
      quantidade: 1,
      obs: "Pacote Turn-Key: 1.480 m² Esquadrias Gold/Suprema + 620 m² Pele de Vidro",
    },
  ]);

  const handleSelectDiscipline = (newCat: InsumoCategory) => {
    setCategoriaPrincipal(newCat);
    const meta = CONSTRUCTION_TAXONOMY.find((t) => t.categoria === newCat);
    const defaultMode = meta?.modoPadrao || "INSUMOS";
    setModalidade(defaultMode);

    const matchingVendors = vendors.filter(
      (v) =>
        v.categorias_atendidas.includes(newCat) &&
        v.status_homologacao === "Homologado"
    );
    setSelectedVendorIds(matchingVendors.map((v) => v.id));

    const matchingItems = catalog.filter((c) => c.categoria === newCat);
    if (matchingItems.length > 0) {
      setSelectedCatalogId(matchingItems[0].id);
      setDraftItems([
        {
          catalogId: matchingItems[0].id,
          quantidade: defaultMode === "PACOTE_TECNICO" ? 1 : 120,
          obs:
            defaultMode === "PACOTE_TECNICO"
              ? "Pacote Turn-Key (Fornecimento de Material + Mão de Obra + ART)"
              : "Conforme memorial descritivo e projeto executivo",
        },
      ]);
    }
    setEtapaObra(`Disciplina: ${newCat}`);
  };

  if (!isOpen) return null;

  const handleAddItem = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        catalogId: selectedCatalogId,
        quantidade: itemQty,
        obs: "Conforme projeto executivo",
      },
    ]);
  };

  const handleToggleVendor = (vId: string) => {
    setSelectedVendorIds((prev) =>
      prev.includes(vId) ? prev.filter((x) => x !== vId) : [...prev, vId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftItems.length === 0 || selectedVendorIds.length === 0) return;

    const scId = `sc-${Date.now()}`;
    const nextNum = `SC-2026-0${152 + purchaseRequests.length}`;

    const builtItems: RequestItem[] = draftItems.map((di, idx) => {
      const catObj = catalog.find((c) => c.id === di.catalogId) || catalog[0];
      return {
        id: `req-item-new-${Date.now()}-${idx}`,
        sc_id: scId,
        item_catalog_id: catObj.id,
        codigo_insumo: catObj.codigo_insumo,
        descricao: catObj.descricao,
        categoria: catObj.categoria,
        quantidade: di.quantidade,
        unidade: catObj.unidade_medida,
        preco_orcado_unit: catObj.preco_referencia,
        observacao_tecnica: di.obs,
      };
    });

    const newSc: PurchaseRequest = {
      id: scId,
      numero_sc: nextNum,
      project_id: projectId,
      categoria_principal: categoriaPrincipal,
      modalidade,
      solicitante,
      data_abertura: new Date().toISOString().split("T")[0],
      data_limite_entrega: "2026-11-25",
      prioridade,
      status: "Em Cotação",
      etapa_obra: etapaObra,
      observacoes,
      items: builtItems,
    };

    createPurchaseRequest(newSc, selectedVendorIds);
    onClose();
    setActiveTab("equalizer");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-300 rounded-xl max-w-4xl w-full p-6 shadow-xl space-y-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-slate-300 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Nova Solicitação de Compra e Abertura de Cotação
            </h3>
            <p className="text-sm text-slate-700">
              Selecione a disciplina para filtrar automaticamente os
              fornecedores homologados
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-slate-900 font-bold mb-1">
              1. Disciplina Oficial da Obra (11 Categorias)
            </label>
            <select
              value={categoriaPrincipal}
              onChange={(e) =>
                handleSelectDiscipline(e.target.value as InsumoCategory)
              }
              className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-900"
            >
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-900 font-bold mb-1">
              2. Obra / Centro de Custo
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-900"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.codigo_sigla})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Engenheiro Solicitante
            </label>
            <input
              value={solicitante}
              onChange={(e) => setSolicitante(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Prioridade
            </label>
            <select
              value={prioridade}
              onChange={(e) =>
                setPrioridade(e.target.value as "Normal" | "Alta" | "Crítica")
              }
              className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900"
            >
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Crítica">Crítica</option>
            </select>
          </div>
        </div>

        {/* Seleção de Itens */}
        <div className="space-y-3 border-t border-slate-300 pt-4">
          <div className="text-base font-bold text-slate-900">
            3. Insumos ou Escopo Solicitado
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedCatalogId}
              onChange={(e) => setSelectedCatalogId(e.target.value)}
              className="flex-1 min-w-[260px] bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900"
            >
              {(categoryCatalogItems.length > 0
                ? categoryCatalogItems
                : catalog
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.codigo_insumo} — {c.descricao} ({c.unidade_medida})
                </option>
              ))}
            </select>
            <input
              type="number"
              value={itemQty}
              onChange={(e) => setItemQty(Number(e.target.value) || 1)}
              className="w-28 bg-slate-100 border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-slate-900 tabular-nums"
            />
            <button
              type="button"
              onClick={handleAddItem}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-900 text-white flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar</span>
            </button>
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full table-auto text-left border-collapse">
              <tbody>
                {draftItems.map((di, idx) => {
                  const cat = catalog.find((c) => c.id === di.catalogId);
                  return (
                    <tr key={idx} className="odd:bg-white even:bg-slate-50">
                      <td className="p-3.5 border border-slate-300 text-sm font-semibold text-slate-900">
                        {cat?.codigo_insumo} — {cat?.descricao}
                      </td>
                      <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                        {di.quantidade} {cat?.unidade_medida}
                      </td>
                      <td className="p-3.5 border border-slate-300 text-right w-12">
                        <button
                          type="button"
                          onClick={() =>
                            setDraftItems((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-rose-700 hover:text-rose-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fornecedores Sugeridos Automaticamente */}
        <div className="space-y-3 border-t border-slate-300 pt-4">
          <div className="text-base font-bold text-slate-900">
            4. Fornecedores Homologados Sugeridos para {categoriaPrincipal} (
            {suggestedVendors.length})
          </div>

          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full table-auto text-left border-collapse">
              <tbody>
                {(suggestedVendors.length > 0 ? suggestedVendors : vendors).map(
                  (v) => {
                    const checked = selectedVendorIds.includes(v.id);
                    const tags = (v.tags_especialidade || []).slice(0, 2);
                    return (
                      <tr
                        key={v.id}
                        onClick={() => handleToggleVendor(v.id)}
                        className={`cursor-pointer ${
                          checked
                            ? "bg-emerald-50/70"
                            : "odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                        }`}
                      >
                        <td className="p-3.5 border border-slate-300 text-base font-bold text-slate-900">
                          {v.nome_fantasia}
                        </td>
                        <td className="p-3.5 border border-slate-300">
                          <div className="flex flex-wrap gap-1.5">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-sm text-slate-800"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 border border-slate-300 text-right">
                          <CheckCircle2
                            className={`w-5 h-5 inline ${
                              checked ? "text-emerald-900" : "text-slate-300"
                            }`}
                          />
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 text-slate-900"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white"
          >
            Criar Solicitação e Abrir Tabela de Cotação
          </button>
        </div>
      </form>
    </div>
  );
}
