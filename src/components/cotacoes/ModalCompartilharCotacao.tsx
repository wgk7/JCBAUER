"use client";

import React, { useState, useEffect } from "react";
import {
  ProcessoCotacao,
  FornecedorCotadoRapido,
  ItemComparativoRapido,
  PropostaFornecedorOnline,
} from "../../types/jcBauer";
import {
  carregarPropostasCotacao,
  salvarChaveSupabase,
} from "../../lib/supabase";

interface ModalCompartilharCotacaoProps {
  isOpen: boolean;
  onClose: () => void;
  cotacao: ProcessoCotacao | null;
  fornecedores: FornecedorCotadoRapido[];
  itens: ItemComparativoRapido[];
  onAplicarPropostaFornecedor: (
    fornecedorIdx: number,
    proposta: PropostaFornecedorOnline
  ) => void;
  dispararAviso: (msg: string) => void;
}

function formatBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function ModalCompartilharCotacao({
  isOpen,
  onClose,
  cotacao,
  fornecedores,
  itens,
  onAplicarPropostaFornecedor,
  dispararAviso,
}: ModalCompartilharCotacaoProps) {
  const [propostasRecebidas, setPropostasRecebidas] = useState<
    Record<number, PropostaFornecedorOnline>
  >({});
  const [buscando, setBuscando] = useState<boolean>(false);
  const [linkCopiadoIdx, setLinkCopiadoIdx] = useState<number | null>(null);

  // Garante que a cotação está pública no Supabase para o fornecedor ler sem autenticação
  useEffect(() => {
    if (!isOpen || !cotacao) return;

    // Publica snapshot da cotação no Supabase para consumo do fornecedor
    salvarChaveSupabase(`jc_cotacao_publica_${cotacao.id}`, cotacao).catch(
      () => {}
    );

    // Carrega propostas que já tenham sido submetidas
    verificarPropostas();
  }, [isOpen, cotacao?.id]);

  const verificarPropostas = async () => {
    if (!cotacao) return;
    setBuscando(true);

    const resultado: Record<number, PropostaFornecedorOnline> = {};

    // 1. Busca no Supabase
    try {
      const nuvem = await carregarPropostasCotacao(cotacao.id);
      if (nuvem && Object.keys(nuvem).length > 0) {
        Object.assign(resultado, nuvem);
      }
    } catch (e) {
      console.warn("Falha ao buscar propostas na nuvem:", e);
    }

    // 2. Busca também no localStorage local (para fallback/testes)
    if (typeof window !== "undefined") {
      fornecedores.forEach((_, idx) => {
        try {
          const localStr = window.localStorage.getItem(
            `jc_proposta_${cotacao.id}_forn_${idx}`
          );
          if (localStr) {
            const parsed = JSON.parse(localStr);
            if (parsed && !resultado[idx]) {
              resultado[idx] = parsed;
            }
          }
        } catch {}
      });
    }

    setPropostasRecebidas(resultado);
    setBuscando(false);
  };

  if (!isOpen || !cotacao) return null;

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://jcbauer.com.br";

  const gerarLinkFornecedor = (idx: number, nomeForn: string) => {
    return `${baseUrl}/portal-fornecedor?cotacaoId=${encodeURIComponent(
      cotacao.id
    )}&fornIdx=${idx}&fornNome=${encodeURIComponent(nomeForn || "")}`;
  };

  const handleCopiarLink = (idx: number, link: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setLinkCopiadoIdx(idx);
      dispararAviso(
        `Link de cotação do Fornecedor ${idx + 1} copiado para a área de transferência!`
      );
      setTimeout(() => setLinkCopiadoIdx(null), 3000);
    }
  };

  const handleEnviarWhatsApp = (
    idx: number,
    forn: FornecedorCotadoRapido,
    link: string
  ) => {
    const telefoneLimpo = (forn.telefone || "").replace(/\D/g, "");
    const ddi = telefoneLimpo.startsWith("55") ? "" : "55";
    const numeroFinal = telefoneLimpo ? `${ddi}${telefoneLimpo}` : "";

    const saudacao = forn.vendedor
      ? `Olá *${forn.vendedor}* (${forn.nome || `Fornecedor ${idx + 1}`}), tudo bem?`
      : `Olá equipe comercial da *${forn.nome || `Fornecedor ${idx + 1}`}*, tudo bem?`;

    const itensTexto = itens
      .slice(0, 5)
      .map(
        (it, i) =>
          `  ${i + 1}. ${it.nome || "Insumo"} — ${it.quantidade} ${it.unidade || "un"}`
      )
      .join("\n");

    const maisItens =
      itens.length > 5 ? `\n  ...e mais ${itens.length - 5} itens na lista completa.` : "";

    const mensagem = [
      `${saudacao}`,
      ``,
      `Aqui é da equipe de *Suprimentos da JC BAUER Construtora & Incorporadora*.`,
      `Temos uma nova cotação aberta para fornecimento no canteiro de obras:`,
      `🏗️ *Empreendimento:* ${cotacao.obraNome || "JC BAUER"}`,
      `📋 *Cotação:* ${cotacao.codigo} — ${cotacao.titulo}`,
      `📦 *Quantidade de Insumos:* ${itens.length} itens`,
      ``,
      `*Alguns dos materiais solicitados:*`,
      `${itensTexto}${maisItens}`,
      ``,
      `Para sua comodidade e agilidade, geramos seu *Link Exclusivo de Cotação Online* onde você pode preencher seus preços, marcas e prazos diretamente pelo celular ou computador:`,
      `👉 ${link}`,
      ``,
      `Ao clicar em "Submeter Proposta", seus valores entrarão diretamente na nossa mesa de compras para emissão da Ordem de Compra (OC).`,
      ``,
      `Agradecemos a atenção e aguardamos seu retorno!`,
    ].join("\n");

    const waUrl = numeroFinal
      ? `https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

    if (typeof window !== "undefined") {
      window.open(waUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in font-sans">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 text-slate-100 my-8">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 text-xl font-black shadow-md shadow-amber-500/20">
              🔗
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Envio de Cotações Online para Fornecedores
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase">
                  Agilidade 1 Clique
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Gere links exclusivos para os fornecedores preencherem seus preços sem precisar digitar nada manual.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* RESUMO DA COTAÇÃO ATIVA */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold px-2 py-1 rounded bg-amber-400 text-slate-950 text-xs">
              {cotacao.codigo}
            </span>
            <div>
              <div className="font-extrabold text-white text-sm">
                {cotacao.titulo}
              </div>
              <div className="text-slate-400 text-[11px]">
                🏗️ Obra: <strong className="text-slate-200">{cotacao.obraNome}</strong> • Categoria:{" "}
                <strong className="text-amber-300">{cotacao.categoria || "Geral"}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-semibold">
              📦 {itens.length} Insumos na Planilha
            </span>
            <button
              type="button"
              disabled={buscando}
              onClick={verificarPropostas}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-md border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>🔄</span>
              <span>{buscando ? "Sincronizando..." : "Sincronizar Propostas"}</span>
            </button>
          </div>
        </div>

        {/* LISTA DE FORNECEDORES E SEUS LINKS EXCLUSIVOS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold text-white uppercase text-[11px] tracking-wider">
              Fornecedores da Matriz ({fornecedores.length} orçamentos)
            </span>
            <span>Cada link é pré-vinculado à coluna correspondente no comparativo</span>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {fornecedores.map((forn, idx) => {
              const link = gerarLinkFornecedor(idx, forn.nome);
              const proposta = propostasRecebidas[idx];
              const jaRespondeu = !!proposta;
              const linkCopiado = linkCopiadoIdx === idx;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border transition ${
                    jaRespondeu
                      ? "bg-slate-950/90 border-emerald-500/60 shadow-md shadow-emerald-950/20"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-800 text-amber-300 font-bold text-xs flex items-center justify-center font-mono">
                        {idx + 1}
                      </span>
                      <strong className="text-white text-sm">
                        {forn.nome || `Fornecedor ${idx + 1} (Não Nomeado)`}
                      </strong>
                      {forn.vendedor && (
                        <span className="text-xs text-slate-400">
                          • Contato: {forn.vendedor}
                        </span>
                      )}
                      {forn.telefone && (
                        <span className="text-xs text-slate-400">
                          • {forn.telefone}
                        </span>
                      )}
                    </div>

                    <div>
                      {jaRespondeu ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-xs font-black flex items-center gap-1">
                          <span>✓</span>
                          <span>Proposta Recebida: {formatBRL(proposta.valorTotalProposta)}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-medium">
                          Aguardando Envio
                        </span>
                      )}
                    </div>
                  </div>

                  {/* LINK E BOTÕES DE AÇÃO */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center pt-2 border-t border-slate-800/80">
                    <div className="md:col-span-6">
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          value={link}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 focus:outline-none select-all"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-6 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopiarLink(idx, link)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          linkCopiado
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        }`}
                      >
                        <span>{linkCopiado ? "✓" : "📋"}</span>
                        <span>{linkCopiado ? "Copiado!" : "Copiar Link"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEnviarWhatsApp(idx, forn, link)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                        title="Abrir WhatsApp com mensagem pronta da JC BAUER"
                      >
                        <span>💬</span>
                        <span>Enviar WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.open(link, "_blank");
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                        title="Simular visualização que o fornecedor terá"
                      >
                        <span>👁️</span>
                        <span>Testar Portal</span>
                      </button>

                      {jaRespondeu && (
                        <button
                          type="button"
                          onClick={() => {
                            onAplicarPropostaFornecedor(idx, proposta);
                            dispararAviso(
                              `Proposta do "${proposta.fornecedorNome}" aplicada à tabela com sucesso!`
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition flex items-center gap-1 shadow-md cursor-pointer animate-pulse"
                        >
                          <span>📥</span>
                          <span>Importar na Tabela</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {jaRespondeu && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span>
                          📅 Enviado em: <strong className="text-white">{proposta.dataEnvio}</strong>
                        </span>
                        <span>
                          🚚 Frete: <strong className="text-white">{proposta.tipoFrete} ({proposta.prazoEntregaGeral})</strong>
                        </span>
                        <span>
                          💳 Pagamento: <strong className="text-white">{proposta.condicaoPagamento}</strong>
                        </span>
                      </div>
                      <span className="text-emerald-400 font-bold">
                        {proposta.itens.filter((it) => it.precoUnitario > 0).length} de {itens.length} preços preenchidos
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* NOTA DE CONFORTO E REFORÇO DO MODO MANUAL */}
        <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
          <span className="text-base">💡</span>
          <div>
            <strong className="text-white">Seu modo manual continua 100% ativo:</strong> Você pode usar esses links automatizados para economizar tempo, mas se preferir ligar para um fornecedor e preencher manualmente direto na tabela, tudo continua funcionando exatamente como antes!
          </div>
        </div>

        {/* FOOTER */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
