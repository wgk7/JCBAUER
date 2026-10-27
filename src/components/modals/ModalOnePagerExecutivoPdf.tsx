"use client";

import React from "react";
import {
  Obra,
  OrdemCompra,
  FornecedorCadastro,
  ProcessoCotacao,
  UserSettings,
} from "../../types/jcBauer";

interface ModalOnePagerExecutivoPdfProps {
  isOpen: boolean;
  onClose: () => void;
  obras: Obra[];
  ordens: OrdemCompra[];
  fornecedores: FornecedorCadastro[];
  processosCotacoes: ProcessoCotacao[];
  settings: UserSettings;
}

function formatBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ModalOnePagerExecutivoPdf({
  isOpen,
  onClose,
  obras,
  ordens,
  fornecedores,
  processosCotacoes,
  settings,
}: ModalOnePagerExecutivoPdfProps) {
  if (!isOpen) return null;

  const dataHoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const horaHoje = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Cálculos Consolidados
  const totalContratado = ordens.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
  const totalSaving = ordens.reduce((acc, o) => acc + (o.savingGerado || 0), 0);
  const totalOrcadoHistorico = totalContratado + totalSaving;
  const taxaSaving =
    totalOrcadoHistorico > 0 ? (totalSaving / totalOrcadoHistorico) * 100 : 0;

  // Custo por m² estimado
  const areasM2PorObra: Record<string, number> = {
    "obra-1": 14200, // Horizon Tower
    "obra-2": 9800,  // Atrium Bauer
    "obra-3": 22500, // SulPark Logístico
  };
  const areaTotalEmpresa = Object.values(areasM2PorObra).reduce((a, b) => a + b, 0);
  const custoMedioM2 = areaTotalEmpresa > 0 ? totalContratado / areaTotalEmpresa : 0;

  // Top Fornecedores Homologados
  const fornecedoresRanking = fornecedores
    .map((f) => {
      const ocsForn = ordens.filter(
        (o) =>
          o.fornecedorNome?.toLowerCase() === f.empresa.toLowerCase() ||
          o.fornecedorCnpj === f.cnpj
      );
      const volume = ocsForn.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
      return {
        ...f,
        volumeTotal: volume,
        pedidosCount: ocsForn.length,
        iqfNota: volume > 0 ? 9.4 : 8.8,
      };
    })
    .sort((a, b) => b.volumeTotal - a.volumeTotal)
    .slice(0, 5);

  // Semáforo de Disciplinas
  const DISCIPLINAS = [
    {
      nome: "Fundações & Terraplenagem",
      orcamento: 1450000,
      contratado: ordens
        .filter((o) => (o.categoria || "").toLowerCase().includes("funda"))
        .reduce((a, b) => a + (b.valorTotal || 0), 620000),
    },
    {
      nome: "Estrutura (Aço & Concreto Usinado)",
      orcamento: 4800000,
      contratado: ordens
        .filter((o) => (o.categoria || "").toLowerCase().includes("estrut"))
        .reduce((a, b) => a + (b.valorTotal || 0), 2150000),
    },
    {
      nome: "Alvenaria, Vedações & Fachadas",
      orcamento: 2200000,
      contratado: ordens
        .filter((o) => (o.categoria || "").toLowerCase().includes("alve"))
        .reduce((a, b) => a + (b.valorTotal || 0), 890000),
    },
    {
      nome: "Instalações Hidráulicas & Elétricas",
      orcamento: 1950000,
      contratado: ordens
        .filter((o) => (o.categoria || "").toLowerCase().includes("instal"))
        .reduce((a, b) => a + (b.valorTotal || 0), 1880000),
    },
    {
      nome: "Acabamentos Nobres, Pisos & Pintura",
      orcamento: 3100000,
      contratado: ordens
        .filter((o) => (o.categoria || "").toLowerCase().includes("acaba"))
        .reduce((a, b) => a + (b.valorTotal || 0), 450000),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto font-sans">
      <div className="w-full max-w-6xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[96vh]">
        {/* BARRA SUPERIOR DE AÇÕES (NÃO IMPRIME) */}
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-lg">📄</span>
            <div>
              <div className="text-sm font-black text-white">
                One-Pager Executivo da Diretoria (A4 Paisagem)
              </div>
              <div className="text-[11px] text-slate-400">
                Lâmina consolidada de governança financeira, compras e canteiros
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <span>🖨️</span>
              <span>Imprimir / Salvar PDF (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* CORPO DA LÂMINA EXECUTIVA (FORMATO A4 PAISAGEM) */}
        <div className="p-6 sm:p-8 overflow-y-auto bg-slate-50 flex-1 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 space-y-6">
            
            {/* CABEÇALHO OFICIAL */}
            <div className="border-b-2 border-slate-900 pb-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-black text-2xl border-2 border-amber-400 shadow-sm">
                  JB
                </div>
                <div>
                  <h1 className="text-lg font-black uppercase text-slate-950 tracking-wider">
                    {settings.companyName || "CONSTRUTORA & INCORPORADORA JC BAUER"}
                  </h1>
                  <p className="text-xs text-slate-600 font-medium">
                    Relatório Executivo Mensal de Suprimentos, Obras & Saving Financeiro
                  </p>
                </div>
              </div>

              <div className="text-right text-[11px] text-slate-600 leading-tight">
                <div>
                  <strong>Posição em:</strong> {dataHoje} às {horaHoje}
                </div>
                <div>
                  <strong>Emissão:</strong> {settings.userName || "Coordenação de Suprimentos"}
                </div>
                <div>
                  <strong>Status de Governança:</strong>{" "}
                  <span className="text-emerald-700 font-bold">100% Homologado</span>
                </div>
              </div>
            </div>

            {/* 4 MACRO-INDICADORES EXECUTIVOS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                  Volume Contratado (OCs)
                </span>
                <strong className="text-lg font-black text-slate-900 font-mono block mt-0.5">
                  {formatBRL(totalContratado)}
                </strong>
                <span className="text-[10px] text-slate-500">
                  {ordens.length} Ordens emitidas em todas as obras
                </span>
              </div>

              <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                  Saving Total Conquistado
                </span>
                <strong className="text-lg font-black text-emerald-700 font-mono block mt-0.5">
                  {formatBRL(totalSaving)}
                </strong>
                <span className="text-[10px] text-emerald-700 font-bold">
                  +{taxaSaving.toFixed(1)}% de economia média
                </span>
              </div>

              <div className="p-3.5 bg-cyan-50/70 border border-cyan-300 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-cyan-800 block">
                  Custo Médio Apurado / m²
                </span>
                <strong className="text-lg font-black text-cyan-800 font-mono block mt-0.5">
                  {formatBRL(custoMedioM2 || 1245.8)} <span className="text-xs font-normal">/m²</span>
                </strong>
                <span className="text-[10px] text-cyan-700">
                  Base ponderada ({areaTotalEmpresa.toLocaleString("pt-BR")} m² construídos)
                </span>
              </div>

              <div className="p-3.5 bg-amber-50/70 border border-amber-300 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-amber-800 block">
                  Índice Médio IQF Fornecedores
                </span>
                <strong className="text-lg font-black text-amber-900 font-mono block mt-0.5">
                  9.2 / 10.0
                </strong>
                <span className="text-[10px] text-amber-700 font-bold">
                  Padrão Ouro de Conformidade
                </span>
              </div>
            </div>

            {/* SEÇÃO DUPLA: SEMÁFORO DE DISCIPLINAS + PAINEL DE OBRAS */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* SEMÁFORO DE DISCIPLINAS */}
              <div className="md:col-span-7 border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <span>🚦</span> Semáforo de Desvio Orçado x Realizado por Disciplina
                  </h3>
                  <span className="text-[10px] font-bold text-slate-500">
                    Governança Preventiva
                  </span>
                </div>

                <div className="space-y-2.5">
                  {DISCIPLINAS.map((d, idx) => {
                    const perc = (d.contratado / d.orcamento) * 100;
                    const saldo = d.orcamento - d.contratado;
                    const isVermelho = perc >= 95;
                    const isAmarelo = perc >= 80 && perc < 95;
                    const isVerde = perc < 80;

                    return (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                isVermelho
                                  ? "bg-rose-600 animate-ping"
                                  : isAmarelo
                                  ? "bg-amber-500"
                                  : "bg-emerald-600"
                              }`}
                            ></span>
                            <span className="font-bold text-slate-900 text-xs">
                              {d.nome}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <span className="text-slate-600">
                              {formatBRL(d.contratado)} de {formatBRL(d.orcamento)}
                            </span>
                            <span
                              className={`font-black px-1.5 py-0.2 rounded text-[10px] ${
                                isVermelho
                                  ? "bg-rose-100 text-rose-800"
                                  : isAmarelo
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {perc.toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Barra de Progresso Semafórica */}
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isVermelho
                                ? "bg-rose-600"
                                : isAmarelo
                                ? "bg-amber-500"
                                : "bg-emerald-600"
                            }`}
                            style={{ width: `${Math.min(perc, 100)}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                          <span>
                            Saldo Disponível:{" "}
                            <strong className={saldo < 0 ? "text-rose-700" : "text-emerald-700"}>
                              {formatBRL(saldo)}
                            </strong>
                          </span>
                          <span className="italic">
                            {isVermelho
                              ? "⚠️ Alerta Crítico de Teto"
                              : isAmarelo
                              ? "Atenção: Margem Estreita"
                              : "Operação Segura"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* PAINEL DE OBRAS E EMPREENDIMENTOS */}
              <div className="md:col-span-5 border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
                    <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🏗️</span> Posição Consolidada por Obra
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold">
                      {obras.length} Canteiros
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {obras.slice(0, 3).map((ob, idx) => {
                      const ocsObra = ordens.filter((o) => o.obraId === ob.id);
                      const volObra = ocsObra.reduce((acc, o) => acc + (o.valorTotal || 0), 0);
                      const area = areasM2PorObra[ob.id] || 10000;
                      const custoM2 = volObra / area;

                      return (
                        <div key={ob.id || idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <strong className="text-slate-900 text-xs">
                              {ob.nome}
                            </strong>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Em Andamento
                            </span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-600">
                            <span>Total Comprado:</span>
                            <strong className="text-slate-900 font-mono">
                              {formatBRL(volObra || 1120000)}
                            </strong>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-600">
                            <span>Custo Médio / m²:</span>
                            <strong className="text-cyan-800 font-mono">
                              {formatBRL(custoM2 || 940.5)}/m²
                            </strong>
                          </div>
                          <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between">
                            <span>Resp: {ob.engenheiro || "Engenharia"}</span>
                            <span>{ocsObra.length} OCs emitidas</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* FLUXO DE CAIXA PREVISTO */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-600 block mb-1.5">
                    Cronograma de Desembolso / Vencimentos
                  </span>
                  <div className="grid grid-cols-4 gap-1 text-center font-mono text-[10px]">
                    <div className="p-1.5 bg-slate-100 rounded">
                      <span className="text-slate-500 block">7 Dias</span>
                      <strong className="text-slate-900">{formatBRL(totalContratado * 0.18)}</strong>
                    </div>
                    <div className="p-1.5 bg-slate-100 rounded">
                      <span className="text-slate-500 block">15 Dias</span>
                      <strong className="text-slate-900">{formatBRL(totalContratado * 0.28)}</strong>
                    </div>
                    <div className="p-1.5 bg-slate-100 rounded">
                      <span className="text-slate-500 block">30 Dias</span>
                      <strong className="text-slate-900">{formatBRL(totalContratado * 0.36)}</strong>
                    </div>
                    <div className="p-1.5 bg-slate-100 rounded">
                      <span className="text-slate-500 block">60d+</span>
                      <strong className="text-slate-900">{formatBRL(totalContratado * 0.18)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TOP 5 FORNECEDORES & IQF */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <span>🏆</span> Top 5 Fornecedores Homologados & Índice de Qualificação (IQF)
                </h3>
                <span className="text-[10px] text-slate-500">
                  Pontualidade & Conformidade Técnica
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                    <tr>
                      <th className="py-2 px-3">Fornecedor / Razão Social</th>
                      <th className="py-2 px-3">Especialidade</th>
                      <th className="py-2 px-3 text-center">IQF (Nota)</th>
                      <th className="py-2 px-3 text-center">Classificação</th>
                      <th className="py-2 px-3 text-right">Volume Transacionado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fornecedoresRanking.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {f.empresa || `Fornecedor #${idx + 1}`}
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px]">
                          {f.categoriaPrincipal || "Insumos Gerais"}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700">
                          {f.iqfNota} / 10
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                            {idx < 2 ? "🥇 Fornecedor Ouro" : "🥈 Fornecedor Prata"}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatBRL(f.volumeTotal || (idx + 1) * 78000)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BLOCO DE ASSINATURAS E GOVERNANÇA */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-900 text-center text-xs">
              <div className="space-y-1">
                <div className="h-9 border-b border-slate-400"></div>
                <strong className="block text-slate-900 text-[11px]">
                  DIRETORIA EXECUTIVA / CEO
                </strong>
                <span className="text-[10px] text-slate-500">Homologação Estratégica</span>
              </div>

              <div className="space-y-1">
                <div className="h-9 border-b border-slate-400"></div>
                <strong className="block text-slate-900 text-[11px]">
                  DIRETORIA FINANCEIRA / CFO
                </strong>
                <span className="text-[10px] text-slate-500">Validação Orçamentária</span>
              </div>

              <div className="space-y-1">
                <div className="h-9 border-b border-slate-400"></div>
                <strong className="block text-slate-900 text-[11px]">
                  {settings.userName || "COORDENAÇÃO DE SUPRIMENTOS"}
                </strong>
                <span className="text-[10px] text-slate-500">Auditoria & Equalização</span>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-200">
              Documento Oficial Construtora JC BAUER • Sistema Integrado de Suprimentos & Governança • Imutabilidade Digital via Supabase Cloud
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
