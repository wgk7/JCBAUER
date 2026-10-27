"use client";

import React from "react";
import {
  FornecedorCotadoRapido,
  ItemComparativoRapido,
  UserSettings,
  Obra,
} from "../../types/jcBauer";

function formatBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const getItemPreco = (
  item: ItemComparativoRapido,
  index: number
): number => {
  if (!item) return 0;
  if (Array.isArray(item.precos) && item.precos[index] !== undefined) {
    return Number(item.precos[index]) || 0;
  }
  if (index === 0) return Number(item.preco1) || 0;
  if (index === 1) return Number(item.preco2) || 0;
  if (index === 2) return Number(item.preco3) || 0;
  if (index === 3) return Number(item.preco4) || 0;
  if (index === 4) return Number(item.preco5) || 0;
  if (index === 5) return Number(item.preco6) || 0;
  return Number((item as any)[`preco${index + 1}`]) || 0;
};

export interface ModalVisualizarComparativoPdfProps {
  comparativoTitulo: string;
  comparativoObraId: string;
  comparativoCategoria: string;
  comparativoFornecedores: FornecedorCotadoRapido[];
  comparativoItens: ItemComparativoRapido[];
  resumoComparativo: any;
  settings: UserSettings;
  obras: Obra[];
  onClose: () => void;
  onAbrirNovaAba: () => void;
}

export function ModalVisualizarComparativoPdf({
  comparativoTitulo,
  comparativoObraId,
  comparativoCategoria,
  comparativoFornecedores,
  comparativoItens,
  resumoComparativo,
  settings,
  obras,
  onClose,
  onAbrirNovaAba,
}: ModalVisualizarComparativoPdfProps) {
  const obraSel = obras.find((o) => o.id === comparativoObraId) || obras[0];
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-lg">📄</span>
            <div>
              <div className="text-sm font-bold text-white">Visualização do Mapa Equalizado de Preços</div>
              <div className="text-[11px] text-slate-400">Pronto para impressão em formato A4 ou exportação em PDF</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAbrirNovaAba()}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>🖨️</span> Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={() => onAbrirNovaAba()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1"
            >
              <span>↗️</span> Nova Aba
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white text-xs font-semibold transition"
            >
              ✕ Fechar
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-100 flex-1">
          <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-sm print:p-0 print:border-none print:shadow-none text-slate-900 text-xs space-y-4">
            <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="JC Bauer" className="h-10 w-auto object-contain" onError={(e) => { (e.currentTarget as HTMLElement).style.display = "none"; }} />
                <div>
                  <h1 className="text-sm font-black uppercase text-slate-900">{settings.companyName}</h1>
                  <p className="text-[11px] text-slate-600">{settings.companyCnpj && <>CNPJ: <strong>{settings.companyCnpj}</strong> • </>}Depto. de Suprimentos: <strong>{settings.userName}</strong></p>
                </div>
              </div>
              <div className="text-right text-[10px] text-slate-600 leading-tight">
                <div><strong>Data:</strong> {dataHoje}</div>
                <div><strong>Obra:</strong> {obraSel?.nome || "Todas as Obras"}</div>
                <div><strong>Categoria:</strong> {comparativoCategoria}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px]">
              <div><span className="text-slate-500 block text-[10px]">Objeto:</span><strong className="text-slate-900 truncate block">{comparativoTitulo || "Cotação Geral"}</strong></div>
              <div><span className="text-slate-500 block text-[10px]">Comprador:</span><strong className="text-slate-900 truncate block">{settings.userName}</strong></div>
              <div><span className="text-slate-500 block text-[10px]">Recomendação:</span><strong className="text-emerald-700 truncate block">{resumoComparativo.vencedorGeral?.nome || "A definir"}</strong></div>
              <div><span className="text-slate-500 block text-[10px]">Saving Apurado:</span><strong className="text-emerald-800">{formatBRL(resumoComparativo.savingGlobal)}</strong></div>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-${Math.min(comparativoFornecedores.length, 5)} gap-3`}>
              {comparativoFornecedores.map((f, i) => {
                const tot = resumoComparativo.totais?.[i] ?? 0;
                const isVenc = resumoComparativo.vencedorGeral?.index === i;
                const statusF = resumoComparativo.fornecedoresStatus?.[i];
                return (
                  <div key={i} className={`p-3 rounded-lg border text-xs ${isVenc ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20" : !statusF?.isCompleto ? "bg-amber-50/30 border-amber-200" : "bg-white border-slate-200"}`}>
                    <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                      {isVenc
                        ? "🏆 1º Lugar (Completo)"
                        : !statusF?.isCompleto
                        ? `⚠️ Cotação Parcial (${statusF?.cotados}/${statusF?.totalItens})`
                        : `Orçamento #${i + 1}`}
                    </div>
                    <div className="font-extrabold text-slate-900 text-sm truncate">{f.nome || `Fornecedor ${i + 1}`}</div>
                    <div className={`text-base font-black mt-1 ${isVenc ? "text-emerald-700" : "text-slate-900"}`}>{formatBRL(tot)}</div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {!statusF?.isCompleto && (
                        <div className="text-amber-700 font-bold mb-0.5">⚠️ Faltam {statusF?.faltam} itens</div>
                      )}
                      Frete: {f.freteTipo} ({formatBRL(f.freteValor)}) • Prazo: {f.prazo || "N/I"}
                    </div>
                  </div>
                );
              })}
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border border-slate-300 font-bold text-slate-800">
                  <th className="p-2 text-left" style={{ width: comparativoFornecedores.length >= 4 ? "24%" : "30%" }}>Insumo / Material</th>
                  <th className="p-2 text-center w-[12%]">Qtd</th>
                  {comparativoFornecedores.map((f, i) => {
                    const statusF = resumoComparativo.fornecedoresStatus?.[i];
                    return (
                      <th key={i} className="p-2 text-right">
                        <div>{f.nome || `Fornecedor ${i + 1}`}</div>
                        {statusF && (
                          <div className={`text-[9px] font-normal ${statusF.isCompleto ? "text-emerald-700 font-bold" : "text-amber-700"}`}>
                            {statusF.isCompleto ? "✅ 100% Cotado" : `⚠️ ${statusF.cotados}/${statusF.totalItens} itens`}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {resumoComparativo.itensCalculados.map((it: any) => (
                  <tr key={it.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 font-semibold text-slate-900">{it.nome}</td>
                    <td className="p-2 text-center text-slate-600">{it.quantidade} {it.unidade}</td>
                    {comparativoFornecedores.map((_, i) => {
                      const p = it.precos?.[i] ?? getItemPreco(it, i);
                      const isVenc = it.vencedores?.[i] ?? false;
                      const tot = p * (it.quantidade || 0);
                      return (
                        <td key={i} className={`p-2 text-right ${isVenc ? "bg-emerald-100/70 text-emerald-900" : "text-slate-800"}`}>
                          {p > 0 ? (
                            <div>
                              <div className="font-bold">{formatBRL(p)} <span className="text-[9px] font-normal text-slate-500">/un</span></div>
                              <div className={`text-[10px] ${isVenc ? "text-emerald-700 font-extrabold" : "text-slate-500"}`}>
                                Total: {formatBRL(tot)} {isVenc && "⭐"}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic select-none">— Não cotado</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                  <td colSpan={2} className="p-2">Subtotal dos Materiais</td>
                  {comparativoFornecedores.map((_, i) => (
                    <td key={i} className="p-2 text-right">{formatBRL(resumoComparativo.subtotais?.[i] ?? 0)}</td>
                  ))}
                </tr>
                <tr className="bg-emerald-50/70 text-emerald-950 font-semibold border-t border-slate-200">
                  <td colSpan={2} className="p-2">Desconto Comercial (R$)</td>
                  {comparativoFornecedores.map((f, i) => (
                    <td key={i} className="p-2 text-right text-emerald-700">-{formatBRL(f?.descontoValor || 0)}</td>
                  ))}
                </tr>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-t border-slate-200">
                  <td colSpan={2} className="p-2">Frete (CIF / FOB)</td>
                  {comparativoFornecedores.map((f, i) => (
                    <td key={i} className="p-2 text-right">{f?.freteTipo || "CIF"} ({formatBRL(f?.freteValor || 0)})</td>
                  ))}
                </tr>
                <tr className="bg-slate-900 text-white font-extrabold text-xs">
                  <td colSpan={2} className="p-2.5">VALOR TOTAL (COM FRETE E DESCONTO)</td>
                  {comparativoFornecedores.map((_, i) => {
                    const tot = resumoComparativo.totais?.[i] ?? 0;
                    const isVenc = resumoComparativo.vencedorGeral?.index === i;
                    const statusF = resumoComparativo.fornecedoresStatus?.[i];
                    return (
                      <td key={i} className={`p-2.5 text-right ${isVenc ? "text-emerald-400" : "text-white"}`}>
                        <div>{formatBRL(tot)}</div>
                        {isVenc && <div className="text-[9px] text-emerald-300 uppercase tracking-tight">⭐ Vencedor (100% dos Itens)</div>}
                        {!isVenc && statusF && !statusF.isCompleto && (
                          <div className="text-[9px] text-amber-300 font-normal">⚠️ Parcial ({statusF.cotados}/{statusF.totalItens})</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
            <div className="grid grid-cols-3 gap-6 pt-4 text-center text-[10px] text-slate-700">
              <div className="border-t border-slate-900 pt-1.5"><strong>{settings.userName}</strong><div className="text-slate-500">Comprador Responsável</div></div>
              <div className="border-t border-slate-900 pt-1.5"><strong>{obraSel?.engenheiro || "Engenharia de Obras"}</strong><div className="text-slate-500">Fiscal de Obras</div></div>
              <div className="border-t border-slate-900 pt-1.5"><strong>Diretoria Executiva / CFO</strong><div className="text-slate-500">Aprovação Financeira</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
