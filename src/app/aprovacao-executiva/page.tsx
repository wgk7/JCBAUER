"use client";

import React, { useState, useEffect } from "react";
import {
  SUPABASE_URL,
  salvarChaveSupabase,
} from "../../lib/supabase";
import { OrdemCompra } from "../../types/jcBauer";

function formatBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function AprovacaoExecutivaPage() {
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<boolean>(false);
  const [processando, setProcessando] = useState<boolean>(false);

  // Parâmetros da URL
  const [ocId, setOcId] = useState<string>("");
  const [diretorNome, setDiretorNome] = useState<string>("Diretoria Executiva / CFO");

  // Dados da Ordem de Compra
  const [ordem, setOrdem] = useState<OrdemCompra | null>(null);
  const [listaOrdens, setListaOrdens] = useState<OrdemCompra[]>([]);

  // Motivo de recusa
  const [mostrarRecusa, setMostrarRecusa] = useState<boolean>(false);
  const [motivoRecusa, setMotivoRecusa] = useState<string>("");
  const [recusadoComSucesso, setRecusadoComSucesso] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("ocId") || params.get("id") || "";
    const diretor = params.get("diretor") || "Diretoria Executiva / CFO";

    setOcId(id);
    setDiretorNome(diretor);

    if (!id) {
      setErro("Identificador da Ordem de Compra não informado no link. Solicite o link completo ao setor de suprimentos.");
      setCarregando(false);
      return;
    }

    async function carregarOC() {
      setCarregando(true);
      setErro(null);

      let ordensCarregadas: OrdemCompra[] = [];

      // 1. Tenta buscar do Supabase (system_store)
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/system_store?key=eq.jc_bauer_ordens_v3&select=value`,
          {
            headers: {
              apikey: "sb_publishable_tsBEF9j8kYzaoQvhL-PXXA_ig6kakut",
              Authorization: "Bearer sb_publishable_tsBEF9j8kYzaoQvhL-PXXA_ig6kakut",
            },
          }
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && Array.isArray(rows[0]?.value)) {
            ordensCarregadas = rows[0].value;
          }
        }
      } catch (e) {
        console.warn("Falha ao buscar OCs do Supabase:", e);
      }

      // 2. Fallback no localStorage
      if (ordensCarregadas.length === 0 && typeof window !== "undefined") {
        try {
          const localStr = window.localStorage.getItem("jc_bauer_ordens_v3");
          if (localStr) {
            ordensCarregadas = JSON.parse(localStr) || [];
          }
        } catch {}
      }

      setListaOrdens(ordensCarregadas);

      const encontrada = ordensCarregadas.find(
        (o) => o.id === id || o.numeroOc === id
      );

      if (!encontrada) {
        setErro(`A Ordem de Compra "${id}" não foi localizada ou já foi processada.`);
      } else {
        setOrdem(encontrada);
        if (encontrada.aprovadoPorDiretoria) {
          setSucesso(true);
        }
      }

      setCarregando(false);
    }

    carregarOC();
  }, []);

  const handleAprovarOC = async () => {
    if (!ordem) return;
    setProcessando(true);

    const agoraTexto =
      new Date().toLocaleDateString("pt-BR") +
      " às " +
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const ordemAtualizada: OrdemCompra = {
      ...ordem,
      aprovadoPorDiretoria: true,
      assinaturaDiretoria: `Aprovado Digitalmente por ${diretorNome} em ${agoraTexto}`,
      status: "Emitida",
    };

    const novaLista = listaOrdens.map((o) =>
      o.id === ordem.id ? ordemAtualizada : o
    );

    try {
      // 1. Salva na nuvem Supabase
      await salvarChaveSupabase("jc_bauer_ordens_v3", novaLista);

      // 2. Salva localmente
      if (typeof window !== "undefined") {
        window.localStorage.setItem("jc_bauer_ordens_v3", JSON.stringify(novaLista));
      }

      setOrdem(ordemAtualizada);
      setListaOrdens(novaLista);
      setSucesso(true);
    } catch (err: any) {
      alert(`Falha ao registrar aprovação: ${err?.message || "Tente novamente"}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleRecusarOC = async () => {
    if (!ordem) return;
    if (!motivoRecusa.trim()) {
      alert("Por favor, informe a justificativa ou instrução de renegociação.");
      return;
    }

    setProcessando(true);
    const agoraTexto =
      new Date().toLocaleDateString("pt-BR") +
      " às " +
      new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const ordemAtualizada: OrdemCompra = {
      ...ordem,
      aprovadoPorDiretoria: false,
      assinaturaDiretoria: `Devolvido para Revisão por ${diretorNome}: "${motivoRecusa.trim()}" em ${agoraTexto}`,
    };

    const novaLista = listaOrdens.map((o) =>
      o.id === ordem.id ? ordemAtualizada : o
    );

    try {
      await salvarChaveSupabase("jc_bauer_ordens_v3", novaLista);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("jc_bauer_ordens_v3", JSON.stringify(novaLista));
      }

      setOrdem(ordemAtualizada);
      setListaOrdens(novaLista);
      setRecusadoComSucesso(true);
    } catch (err: any) {
      alert(`Erro ao registrar: ${err?.message}`);
    } finally {
      setProcessando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold">Carregando Ordem de Compra...</h2>
        <p className="text-slate-400 text-xs mt-1">Conectando ao sistema de governança JC BAUER</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold text-white">Aprovação Não Disponível</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{erro}</p>
          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
            Construtora JC BAUER • Suprimentos: suprimentos@jcbauer.com.br
          </div>
        </div>
      </div>
    );
  }

  if (recusadoComSucesso) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-amber-950/80 border border-amber-500/50 flex items-center justify-center text-amber-400 text-2xl">
            ↩️
          </div>
          <h2 className="text-xl font-bold text-white">Devolvido para Renegociação</h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            A Ordem de Compra <strong>{ordem?.numeroOc}</strong> foi devolvida para a equipe de suprimentos com sua observação:
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-amber-300 text-xs text-left italic">
            "{motivoRecusa}"
          </div>
          <p className="text-xs text-slate-500">
            O comprador foi notificado para renegociar as condições com o fornecedor.
          </p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="max-w-lg w-full bg-slate-900 border border-emerald-500/50 rounded-2xl p-8 shadow-2xl text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-300 text-3xl shadow-lg shadow-emerald-950/50">
            ✓
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-xs font-black uppercase tracking-wider">
              Homologação Concluída
            </span>
            <h1 className="text-2xl font-black text-white mt-3">
              Ordem de Compra Aprovada!
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              A <strong className="text-amber-300">{ordem?.numeroOc}</strong> foi liberada formalmente para faturamento e entrega no canteiro.
            </p>
          </div>

          <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-400">Empreendimento:</span>
              <strong className="text-white">{ordem?.obraNome}</strong>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-400">Fornecedor Contratado:</span>
              <strong className="text-white">{ordem?.fornecedorNome}</strong>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-1.5">
              <span className="text-slate-400">Saving Obtido:</span>
              <strong className="text-emerald-400">+{formatBRL(ordem?.savingGerado || 0)}</strong>
            </div>
            <div className="flex justify-between pt-1">
              <span className="font-bold text-amber-400">Valor Autorizado:</span>
              <strong className="text-emerald-300 font-mono text-base font-black">
                {formatBRL(ordem?.valorTotal || 0)}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-left text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-300">Carimbo Digital de Assinatura:</div>
            <div className="font-mono text-emerald-400 text-[10px] break-all">
              {ordem?.assinaturaDiretoria || `Aprovado por ${diretorNome}`}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            O Almoxarifado e o Comprador já receberam a autorização no sistema central.
          </p>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-2 cursor-pointer"
            >
              🖨️ Imprimir Espelho de Liberação
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* HEADER MOBILE-FIRST JC BAUER */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shadow-amber-500/20">
              JB
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-sm text-white">JC BAUER</h1>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 font-bold uppercase">
                  Alçada Executiva
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Liberação de Ordem de Compra</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono">
              {ordem?.numeroOc}
            </span>
            <span className="text-xs font-extrabold text-emerald-400 font-mono">
              {formatBRL(ordem?.valorTotal || 0)}
            </span>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL DA APROVAÇÃO */}
      <main className="max-w-2xl mx-auto px-4 mt-5 space-y-4">
        {/* BANNER DE DESTAQUE & SAVING */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border-2 border-amber-500/50 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[11px] font-bold">
              ⚖️ Alçada de Aprovação: {ordem?.alcadaAprovacao || "Diretoria Executiva / CFO"}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {ordem?.dataEmissao}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 font-semibold block">
              Empreendimento:
            </span>
            <h2 className="text-lg font-black text-white">
              {ordem?.obraNome}
            </h2>
            <p className="text-xs text-amber-300 mt-0.5">
              Categoria: <strong>{ordem?.categoria}</strong>
            </p>
          </div>

          {/* CARD DE SAVING CONQUISTADO */}
          {(ordem?.savingGerado || 0) > 0 && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-300 uppercase block">
                  Economia Conquistada nesta Cotação
                </span>
                <strong className="text-emerald-300 text-sm font-mono font-black">
                  +{formatBRL(ordem?.savingGerado || 0)}
                </strong>
              </div>
              <span className="px-2 py-1 rounded bg-emerald-900 text-emerald-200 text-xs font-black">
                Proposta Vencedora
              </span>
            </div>
          )}
        </div>

        {/* DADOS DO FORNECEDOR E CONDIÇÕES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-2.5 text-xs">
          <h3 className="font-extrabold text-white text-xs uppercase tracking-wide pb-2 border-b border-slate-800 flex items-center gap-1.5">
            <span>🏢</span> Fornecedor Selecionado
          </h3>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 block">Razão Social:</span>
              <strong className="text-white text-xs block truncate">
                {ordem?.fornecedorNome}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">CNPJ:</span>
              <strong className="text-slate-200 font-mono block">
                {ordem?.fornecedorCnpj || "Não informado"}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Condição de Pagamento:</span>
              <strong className="text-white block">
                {ordem?.prazoPagamento}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Frete & Prazo:</span>
              <strong className="text-white block">
                {ordem?.tipoFrete} • {ordem?.dataPrevistaEntrega}
              </strong>
            </div>
          </div>
        </div>

        {/* LISTA DE INSUMOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="font-extrabold text-white text-xs uppercase tracking-wide flex items-center gap-1.5">
              <span>📦</span> Insumos Contratados ({ordem?.itens?.length || 0})
            </h3>
            <span className="text-[10px] text-slate-400">Total de Itens</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto pr-1">
            {ordem?.itens?.map((it, idx) => (
              <div key={idx} className="py-2 flex items-center justify-between text-xs">
                <div className="pr-2">
                  <div className="font-bold text-white text-xs">
                    {it.descricao}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Qtd: <strong className="text-amber-300">{it.quantidade} {it.unidade}</strong> • Unit: {formatBRL(it.precoUnitario)}
                  </div>
                </div>
                <div className="text-right font-mono font-bold text-emerald-400 shrink-0">
                  {formatBRL(it.subtotal)}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline text-sm">
            <span className="font-bold text-slate-400">Valor Total da Ordem:</span>
            <strong className="text-emerald-400 font-mono text-lg font-black">
              {formatBRL(ordem?.valorTotal || 0)}
            </strong>
          </div>
        </div>

        {/* CAMPO DE RECUSA / RENEGOCIAÇÃO */}
        {mostrarRecusa && (
          <div className="p-4 bg-slate-900 border border-amber-500/40 rounded-2xl space-y-3 animate-fade-in text-xs">
            <h4 className="font-bold text-amber-300 flex items-center gap-1.5">
              <span>⚠️</span> Instrução de Renegociação ou Motivo de Recusa:
            </h4>
            <textarea
              rows={3}
              value={motivoRecusa}
              onChange={(e) => setMotivoRecusa(e.target.value)}
              placeholder="Ex: Negociar prazo de pagamento para 35 DDL ou frete CIF incluso..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMostrarRecusa(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={processando}
                onClick={handleRecusarOC}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-black cursor-pointer disabled:opacity-50"
              >
                {processando ? "Enviando..." : "Confirmar Devolução"}
              </button>
            </div>
          </div>
        )}

        {/* BARRA FIXA DE AÇÃO PARA O DIRETOR */}
        <div className="pt-2 pb-6 space-y-2.5">
          <button
            type="button"
            disabled={processando}
            onClick={handleAprovarOC}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm tracking-wide shadow-xl shadow-emerald-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {processando ? (
              <>
                <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                <span>Homologando no Sistema...</span>
              </>
            ) : (
              <>
                <span>✅</span>
                <span>Aprovar Ordem de Compra ({formatBRL(ordem?.valorTotal || 0)})</span>
              </>
            )}
          </button>

          {!mostrarRecusa && (
            <button
              type="button"
              onClick={() => setMostrarRecusa(true)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 text-xs font-semibold border border-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>↩️</span>
              <span>Devolver para Renegociação de Preço / Prazo</span>
            </button>
          )}
        </div>
      </main>

      <footer className="max-w-2xl mx-auto px-4 text-center text-[10px] text-slate-600">
        Construtora & Incorporadora JC BAUER • Governança & Alçadas Executivas
      </footer>
    </div>
  );
}
