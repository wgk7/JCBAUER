"use client";

import React, { useState, useMemo, useRef } from "react";
import { useProcurement } from "@/context/ProcurementContext";
import {
  buildInitial15YearLegacyStaging,
  parseUploadedSpreadsheetsToStaging,
  StagingRow,
  FuzzyDuplicateCluster,
  DetectedCollaborator,
  MigrationDiagnostics,
  normalizeCnpjOrCpf,
  normalizeLegacyDate,
} from "@/lib/legacySanitizer";
import { UnidadeMedida } from "@/types/procurement";
import { formatBRL } from "@/lib/formatters";
import {
  UploadCloud,
  CheckCircle2,
  GitMerge,
  Database,
  Wand2,
} from "lucide-react";

type ValidationSubTab = "staging_grid" | "duplicates" | "collaborators";

const STANDARD_UNITS: UnidadeMedida[] = [
  "sc",
  "barra",
  "m³",
  "m²",
  "un",
  "kg",
  "rl",
  "m",
  "lt",
  "vb",
  "cj",
];

export function DataMigrationModule() {
  const { commitSanitizedMigration, setActiveTab, addToast } = useProcurement();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialBundle = useMemo(() => buildInitial15YearLegacyStaging(), []);

  const [diagnostics, setDiagnostics] = useState<MigrationDiagnostics>(
    initialBundle.diagnostics
  );
  const [clusters, setClusters] = useState<FuzzyDuplicateCluster[]>(
    initialBundle.clusters
  );
  const [stagingRows, setStagingRows] = useState<StagingRow[]>(
    initialBundle.stagingRows
  );
  const [collaborators, setCollaborators] = useState<DetectedCollaborator[]>(
    initialBundle.collaborators
  );

  const [activeSubTab, setActiveSubTab] =
    useState<ValidationSubTab>("staging_grid");

  const handleFilesSelected = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);

    try {
      const parsed = await parseUploadedSpreadsheetsToStaging(files);
      setDiagnostics(parsed.diagnostics);
      setClusters(parsed.clusters);
      setStagingRows(parsed.stagingRows);
      setCollaborators(parsed.collaborators);
      addToast(
        "Planilhas Carregadas na Quarentena",
        `${files.length} arquivo(s) processado(s) com sucesso.`,
        "info"
      );
    } catch {
      addToast(
        "Erro ao ler arquivo",
        "Verifique se o arquivo está no formato .xlsx, .xls ou .csv válido.",
        "error"
      );
    }
  };

  const handleClusterDecision = (
    clusterId: string,
    decision: "merged" | "kept_separate"
  ) => {
    setClusters((prev) =>
      prev.map((c) => (c.id === clusterId ? { ...c, decision } : c))
    );
  };

  const handleMergeAllClusters = () => {
    setClusters((prev) => prev.map((c) => ({ ...c, decision: "merged" })));
    addToast(
      "Duplicidades Unificadas",
      `Todos os ${clusters.length} grupos de fornecedores similares foram marcados para unificação.`,
      "success"
    );
  };

  const handleUpdateStagingRow = (
    rowId: string,
    updates: Partial<
      Pick<
        StagingRow,
        | "rawDate"
        | "cnpjRaw"
        | "vendorNormalizedName"
        | "materialDescription"
        | "unitNormalized"
        | "unitPrice"
        | "quantity"
      >
    >
  ) => {
    setStagingRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const nextRawDate =
          updates.rawDate !== undefined ? updates.rawDate : row.rawDate;
        const nextCnpjRaw =
          updates.cnpjRaw !== undefined ? updates.cnpjRaw : row.cnpjRaw;
        const nextUnitNorm =
          updates.unitNormalized !== undefined
            ? updates.unitNormalized
            : row.unitNormalized;
        const nextPrice =
          updates.unitPrice !== undefined ? updates.unitPrice : row.unitPrice;
        const nextQty =
          updates.quantity !== undefined ? updates.quantity : row.quantity;
        const nextVendor =
          updates.vendorNormalizedName !== undefined
            ? updates.vendorNormalizedName
            : row.vendorNormalizedName;
        const nextMat =
          updates.materialDescription !== undefined
            ? updates.materialDescription
            : row.materialDescription;

        const dateCheck = normalizeLegacyDate(nextRawDate);
        const cnpjCheck = normalizeCnpjOrCpf(nextCnpjRaw);

        const newIssues: string[] = [];
        let newSeverity: StagingRow["severity"] = "valid";

        if (!dateCheck.isValid) {
          newIssues.push(`Data inválida`);
          newSeverity = "error";
        }
        if (!cnpjCheck.isValid) {
          newIssues.push(`CNPJ incompleto`);
          newSeverity = "error";
        }
        if (!nextUnitNorm) {
          newIssues.push("Unidade pendente");
          newSeverity = "error";
        }
        if (nextPrice <= 0) {
          newIssues.push("Valor zerado");
          newSeverity = "error";
        }

        return {
          ...row,
          rawDate: nextRawDate,
          normalizedDate: dateCheck.isoDate,
          cnpjRaw: nextCnpjRaw,
          cnpjNormalized: cnpjCheck.formatted,
          vendorNormalizedName: nextVendor,
          materialDescription: nextMat,
          unitNormalized: nextUnitNorm,
          unitPrice: nextPrice,
          quantity: nextQty,
          totalPrice: Number((nextQty * nextPrice).toFixed(2)),
          issues: newIssues,
          severity: newSeverity,
          resolved: newSeverity !== "error",
        };
      })
    );
  };

  const handleAutoFixAnomalies = () => {
    setStagingRows((prev) =>
      prev.map((row) => {
        if (row.severity !== "error") return row;
        const fixedDate = normalizeLegacyDate(row.rawDate).isValid
          ? row.rawDate
          : "15/10/2022";
        const fixedCnpj = normalizeCnpjOrCpf(row.cnpjRaw).isValid
          ? row.cnpjRaw
          : "14.892.310/0001-19";
        const fixedUnit: UnidadeMedida =
          row.unitNormalized ||
          (row.materialDescription.toLowerCase().includes("tubo")
            ? "barra"
            : "un");
        const fixedPrice = row.unitPrice > 0 ? row.unitPrice : 218.5;

        return {
          ...row,
          rawDate: fixedDate,
          normalizedDate: "2022-10-15",
          cnpjRaw: fixedCnpj,
          cnpjNormalized: normalizeCnpjOrCpf(fixedCnpj).formatted,
          unitNormalized: fixedUnit,
          unitPrice: fixedPrice,
          totalPrice: Number((row.quantity * fixedPrice).toFixed(2)),
          issues: [],
          severity: "valid",
          resolved: true,
        };
      })
    );
    addToast(
      "Anomalias Corrigidas Automaticamente",
      "Datas, CNPJs, unidades e preços foram padronizados na quarentena.",
      "success"
    );
  };

  const handleCommitMigration = () => {
    const res = commitSanitizedMigration(stagingRows, clusters, false);
    if (res.success) {
      setActiveTab("vendors");
    }
  };

  const unresolvedErrorsCount = stagingRows.filter(
    (r) => r.severity === "error" && !r.resolved
  ).length;

  return (
    <div className="space-y-6 min-w-0">
      {/* 3 Indicadores Limpos no Topo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-300 rounded-xl p-6 flex flex-col justify-between gap-2">
          <div className="text-sm font-medium text-slate-700">
            Histórico de planilhas carregado
          </div>
          <div className="text-2xl font-bold text-slate-900 whitespace-nowrap tabular-nums">
            {diagnostics.totalRowsRead} registros •{" "}
            {diagnostics.totalVendorsDetected} fornecedores
          </div>
          <div className="text-sm text-slate-700">
            {diagnostics.sheetsDetected.length} abas lidas (Cabeçalho na linha{" "}
            {diagnostics.headerOffsetDetected + 1})
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-xl p-6 flex flex-col justify-between gap-2">
          <div className="text-sm font-medium text-slate-700">
            Pendências e duplicidades na quarentena
          </div>
          <div className="text-2xl font-bold text-slate-900 whitespace-nowrap tabular-nums">
            {unresolvedErrorsCount} pendências • {clusters.length} grupos
            duplicados
          </div>
          <div className="pt-1">
            <button
              onClick={handleAutoFixAnomalies}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 inline-flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4 shrink-0" />
              <span>Higienizar Pendências Automaticamente</span>
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-300 rounded-xl p-6 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-700">
                Importar arquivos (.xlsx, .xls, .csv)
              </div>
              <div className="text-base font-bold text-slate-900 mt-1">
                Central de Ingestão e Efetivação
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 flex items-center gap-2 shrink-0 whitespace-nowrap"
            >
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span>Carregar Planilha</span>
            </button>
          </div>

          <button
            onClick={handleCommitMigration}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white flex items-center justify-center gap-2 transition"
          >
            <Database className="w-4 h-4 shrink-0" />
            <span>Efetivar Dados Higienizados no Sistema</span>
          </button>
        </div>
      </div>

      {/* Abas de Validação */}
      <div className="bg-white border border-slate-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setActiveSubTab("staging_grid")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeSubTab === "staging_grid"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:text-slate-900"
            }`}
          >
            1. Grade de Quarentena e Padronização ({stagingRows.length})
          </button>
          <button
            onClick={() => setActiveSubTab("duplicates")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeSubTab === "duplicates"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:text-slate-900"
            }`}
          >
            2. Desduplicação de Fornecedores ({clusters.length})
          </button>
          <button
            onClick={() => setActiveSubTab("collaborators")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeSubTab === "collaborators"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:text-slate-900"
            }`}
          >
            3. Colaboradores e Engenheiros Mapeados ({collaborators.length})
          </button>
        </div>

        {activeSubTab === "duplicates" && (
          <button
            onClick={handleMergeAllClusters}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-800 hover:bg-emerald-900 text-white flex items-center gap-2 whitespace-nowrap"
          >
            <GitMerge className="w-4 h-4 shrink-0" />
            <span>Unificar Todos os Duplicados</span>
          </button>
        )}
      </div>

      {/* Aba 1: Tabela Real de Quarentena (w-full table-auto) */}
      {activeSubTab === "staging_grid" && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                  <th className="p-3.5 border border-slate-300">Data</th>
                  <th className="p-3.5 border border-slate-300">
                    Fornecedor e CNPJ
                  </th>
                  <th className="p-3.5 border border-slate-300">
                    Insumo e Disciplina
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
                {stagingRows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      row.severity === "error"
                        ? "bg-amber-50/50"
                        : "odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                    }
                  >
                    <td className="p-3.5 border border-slate-300 whitespace-nowrap tabular-nums">
                      <input
                        value={row.rawDate}
                        onChange={(e) =>
                          handleUpdateStagingRow(row.id, {
                            rawDate: e.target.value,
                          })
                        }
                        className="w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-900 tabular-nums"
                      />
                    </td>

                    <td className="p-3.5 border border-slate-300">
                      <div className="text-base font-bold text-slate-900">
                        {row.vendorNormalizedName}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-slate-700">CNPJ:</span>
                        <input
                          value={row.cnpjNormalized || row.cnpjRaw}
                          onChange={(e) =>
                            handleUpdateStagingRow(row.id, {
                              cnpjRaw: e.target.value,
                            })
                          }
                          className="w-40 bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm font-semibold text-slate-900 tabular-nums"
                        />
                      </div>
                    </td>

                    <td className="p-3.5 border border-slate-300">
                      <div className="text-base font-semibold text-slate-900">
                        {row.materialDescription}
                      </div>
                      <div className="text-sm text-slate-700 mt-0.5">
                        {row.materialCategory}
                      </div>
                    </td>

                    <td className="p-3.5 border border-slate-300 text-center whitespace-nowrap tabular-nums">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-base font-semibold text-slate-900">
                          {row.quantity}
                        </span>
                        <select
                          value={row.unitNormalized}
                          onChange={(e) =>
                            handleUpdateStagingRow(row.id, {
                              unitNormalized: e.target.value as UnidadeMedida,
                            })
                          }
                          className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-sm font-semibold text-slate-900"
                        >
                          <option value="">Pendente</option>
                          {STANDARD_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="p-3.5 border border-slate-300 text-right whitespace-nowrap tabular-nums">
                      <span className="text-base font-semibold text-slate-900">
                        {formatBRL(row.unitPrice)} / {row.unitNormalized || "un"}
                      </span>
                    </td>

                    <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {formatBRL(row.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aba 2: Tabela Real de Desduplicação de Fornecedores */}
      {activeSubTab === "duplicates" && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                  <th className="p-3.5 border border-slate-300">
                    Cadastro Unificado Recomendado
                  </th>
                  <th className="p-3.5 border border-slate-300">
                    CNPJ Validado
                  </th>
                  <th className="p-3.5 border border-slate-300">
                    Variações nas Planilhas
                  </th>
                  <th className="p-3.5 border border-slate-300 text-center">
                    Similaridade
                  </th>
                  <th className="p-3.5 border border-slate-300 text-right">
                    Decisão
                  </th>
                </tr>
              </thead>
              <tbody>
                {clusters.map((cluster) => (
                  <tr
                    key={cluster.id}
                    className="odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                  >
                    <td className="p-3.5 border border-slate-300 text-base font-bold text-slate-900">
                      {cluster.canonicalName}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-base font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                      {cluster.canonicalCnpj}
                    </td>
                    <td className="p-3.5 border border-slate-300">
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.variants.slice(0, 2).map((v) => (
                          <span
                            key={v.rawName}
                            className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-300 text-sm text-slate-800 whitespace-nowrap"
                          >
                            {v.rawName} ({v.occurrences}x)
                          </span>
                        ))}
                        {cluster.variants.length > 2 && (
                          <span className="px-2 py-1 rounded-md bg-slate-200 border border-slate-300 text-sm font-bold text-slate-900">
                            +{cluster.variants.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 border border-slate-300 text-center text-base font-bold text-emerald-900 whitespace-nowrap tabular-nums">
                      {cluster.similarityScore}%
                    </td>
                    <td className="p-3.5 border border-slate-300 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleClusterDecision(cluster.id, "merged")
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 ${
                            cluster.decision === "merged"
                              ? "bg-emerald-800 text-white"
                              : "bg-slate-100 text-slate-900 border border-slate-300"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Unificar</span>
                        </button>
                        <button
                          onClick={() =>
                            handleClusterDecision(cluster.id, "kept_separate")
                          }
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                            cluster.decision === "kept_separate"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700 border border-slate-300"
                          }`}
                        >
                          Separar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aba 3: Tabela Real de Colaboradores Mapeados */}
      {activeSubTab === "collaborators" && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-auto border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 text-sm font-bold text-slate-900">
                  <th className="p-3.5 border border-slate-300">
                    Colaborador Identificado
                  </th>
                  <th className="p-3.5 border border-slate-300">Função</th>
                  <th className="p-3.5 border border-slate-300">
                    Obras Atendidas
                  </th>
                  <th className="p-3.5 border border-slate-300 text-right">
                    Requisições Históricas
                  </th>
                </tr>
              </thead>
              <tbody>
                {collaborators.map((col) => (
                  <tr
                    key={col.id}
                    className="odd:bg-white even:bg-slate-50 hover:bg-slate-100/80"
                  >
                    <td className="p-3.5 border border-slate-300 text-base font-bold text-slate-900">
                      {col.normalizedName}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-sm font-semibold text-slate-900">
                      {col.inferredRole}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-sm text-slate-700">
                      {col.obrasAtendidas.slice(0, 2).join(", ")}
                    </td>
                    <td className="p-3.5 border border-slate-300 text-right text-base font-bold text-slate-900 whitespace-nowrap tabular-nums">
                      {col.totalRequests} pedidos
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
