"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  SUPABASE_URL,
  salvarChaveSupabase,
  salvarPropostaFornecedor,
} from "../../lib/supabase";
import {
  ProcessoCotacao,
  PropostaFornecedorOnline,
  ItemPropostaFornecedorOnline,
} from "../../types/jcBauer";

function formatBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PortalFornecedorPage() {
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<boolean>(false);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Parâmetros da URL
  const [cotacaoId, setCotacaoId] = useState<string>("");
  const [fornIdx, setFornIdx] = useState<number>(0);

  // Dados da Cotação
  const [cotacao, setCotacao] = useState<ProcessoCotacao | null>(null);

  // Formulário da Proposta do Fornecedor
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [vendedorNome, setVendedorNome] = useState<string>("");
  const [telefone, setTelefone] = useState<string>("");
  const [cnpj, setCnpj] = useState<string>("");
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>("28 DDL");
  const [tipoFrete, setTipoFrete] = useState<"CIF" | "FOB">("CIF");
  const [freteValor, setFreteValor] = useState<number>(0);
  const [prazoEntregaGeral, setPrazoEntregaGeral] = useState<string>("5 dias úteis");
  const [chavePix, setChavePix] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  // Preços e Marcas dos Itens
  const [itensProposta, setItensProposta] = useState<
    Array<{
      itemId: string;
      descricao: string;
      quantidade: number;
      unidade: string;
      precoUnitario: number;
      marca: string;
      prazoEntregaDias: number;
      observacao: string;
    }>
  >([]);

  // Inicialização e Carga dos Dados da Cotação
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("cotacaoId") || params.get("id") || "";
    const idx = parseInt(params.get("fornIdx") || params.get("idx") || "0", 10);
    const nomeUrl = params.get("fornNome") || "";

    setCotacaoId(id);
    setFornIdx(isNaN(idx) ? 0 : idx);

    if (!id) {
      setErro("Identificador da cotação não informado no link. Verifique o link enviado pela JC BAUER.");
      setCarregando(false);
      return;
    }

    async function carregarDados() {
      setCarregando(true);
      setErro(null);

      let cotEncontrada: ProcessoCotacao | null = null;

      // 1. Tenta carregar do Supabase (cópia pública rápida)
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/system_store?key=eq.jc_cotacao_publica_${id}&select=value`,
          {
            headers: {
              apikey: "sb_publishable_tsBEF9j8kYzaoQvhL-PXXA_ig6kakut",
              Authorization: "Bearer sb_publishable_tsBEF9j8kYzaoQvhL-PXXA_ig6kakut",
            },
          }
        );
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows[0]?.value) {
            cotEncontrada = rows[0].value;
          }
        }
      } catch (e) {
        console.warn("Falha ao buscar cotação direta do Supabase:", e);
      }

      // 2. Se não achou, tenta carregar da lista global no Supabase
      if (!cotEncontrada) {
        try {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/system_store?key=eq.jc_bauer_processos_cotacoes_v1&select=value`,
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
              cotEncontrada = rows[0].value.find((p: ProcessoCotacao) => p.id === id) || null;
            }
          }
        } catch (e) {
          console.warn("Falha ao buscar cotações gerais do Supabase:", e);
        }
      }

      // 3. Fallback: localStorage
      if (!cotEncontrada) {
        try {
          const localStr = window.localStorage.getItem("jc_bauer_processos_cotacoes_v1");
          if (localStr) {
            const lista = JSON.parse(localStr);
            if (Array.isArray(lista)) {
              cotEncontrada = lista.find((p: ProcessoCotacao) => p.id === id) || null;
            }
          }
        } catch {}
      }

      if (!cotEncontrada) {
        setErro("A cotação solicitada não foi localizada ou já foi encerrada pela JC BAUER.");
        setCarregando(false);
        return;
      }

      setCotacao(cotEncontrada);

      // Preenche dados do fornecedor
      const fornAtual = cotEncontrada.fornecedores?.[idx];
      setEmpresaNome(fornAtual?.nome || nomeUrl || "");
      setVendedorNome(fornAtual?.vendedor || "");
      setTelefone(fornAtual?.telefone || "");
      if (fornAtual?.condicao) setCondicaoPagamento(fornAtual.condicao);
      if (fornAtual?.freteTipo) setTipoFrete(fornAtual.freteTipo);
      if (fornAtual?.freteValor) setFreteValor(fornAtual.freteValor);
      if (fornAtual?.prazo) setPrazoEntregaGeral(fornAtual.prazo);

      // Monta lista de itens para preenchimento
      const itensMapeados = (cotEncontrada.itens || []).map((it, itemIndex) => {
        let precoExistente = 0;
        if (Array.isArray(it.precos) && it.precos[idx] !== undefined) {
          precoExistente = Number(it.precos[idx]) || 0;
        } else if (idx === 0) precoExistente = it.preco1 || 0;
        else if (idx === 1) precoExistente = it.preco2 || 0;
        else if (idx === 2) precoExistente = it.preco3 || 0;

        return {
          itemId: it.id || `item-${itemIndex}`,
          descricao: it.nome || `Insumo #${itemIndex + 1}`,
          quantidade: it.quantidade || 1,
          unidade: it.unidade || "un",
          precoUnitario: precoExistente,
          marca: "",
          prazoEntregaDias: 5,
          observacao: "",
        };
      });

      setItensProposta(itensMapeados);
      setCarregando(false);
    }

    carregarDados();
  }, []);

  // Cálculos em tempo real
  const totalInsumos = useMemo(() => {
    return itensProposta.reduce((acc, it) => {
      const preco = Number(it.precoUnitario) || 0;
      const qtd = Number(it.quantidade) || 0;
      return acc + preco * qtd;
    }, 0);
  }, [itensProposta]);

  const totalProposta = useMemo(() => {
    const frete = tipoFrete === "FOB" ? Number(freteValor) || 0 : 0;
    return totalInsumos + frete;
  }, [totalInsumos, tipoFrete, freteValor]);

  const handleAtualizarItem = (
    index: number,
    campo: "precoUnitario" | "marca" | "prazoEntregaDias" | "observacao",
    valor: any
  ) => {
    setItensProposta((prev) => {
      const copia = [...prev];
      if (copia[index]) {
        copia[index] = { ...copia[index], [campo]: valor };
      }
      return copia;
    });
  };

  const handleSubmeterProposta = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!empresaNome.trim()) {
      alert("Por favor, preencha o Nome da sua Empresa / Razão Social.");
      return;
    }

    const itensComPreco = itensProposta.filter((it) => (Number(it.precoUnitario) || 0) > 0);
    if (itensComPreco.length === 0) {
      alert("Por favor, preencha o preço unitário de ao menos um insumo da cotação.");
      return;
    }

    setSalvando(true);

    const propostaFinal: PropostaFornecedorOnline = {
      id: `prop-${cotacaoId}-${fornIdx}-${Date.now()}`,
      cotacaoId,
      fornecedorIndex: fornIdx,
      fornecedorNome: empresaNome.trim(),
      vendedorNome: vendedorNome.trim(),
      telefoneWhatsapp: telefone.trim(),
      cnpj: cnpj.trim(),
      tipoFrete,
      freteValor: tipoFrete === "FOB" ? Number(freteValor) || 0 : 0,
      condicaoPagamento,
      prazoEntregaGeral,
      chavePix: chavePix.trim(),
      observacoesGerais: observacoes.trim(),
      dataEnvio: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      itens: itensProposta.map((it) => ({
        itemId: it.itemId,
        descricao: it.descricao,
        quantidade: it.quantidade,
        unidade: it.unidade,
        precoUnitario: Number(it.precoUnitario) || 0,
        marca: it.marca.trim(),
        prazoEntregaDias: Number(it.prazoEntregaDias) || 0,
        observacao: it.observacao.trim(),
        subtotal: (Number(it.precoUnitario) || 0) * (Number(it.quantidade) || 0),
      })),
      valorTotalInsumos: totalInsumos,
      valorTotalProposta: totalProposta,
      statusEnvio: "Submetida",
    };

    try {
      // 1. Salva no Supabase sob chave individual
      await salvarPropostaFornecedor(cotacaoId, fornIdx, propostaFinal);

      // 2. Salva backup em localStorage para testes locais
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `jc_proposta_${cotacaoId}_forn_${fornIdx}`,
          JSON.stringify(propostaFinal)
        );
      }

      setSucesso(true);
    } catch (err: any) {
      alert(`Erro ao enviar proposta: ${err?.message || "Tente novamente"}`);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white font-sans">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-bold">Carregando Cotação JC BAUER...</h2>
        <p className="text-slate-400 text-xs mt-1">Conectando ao sistema de compras central</p>
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
          <h2 className="text-xl font-bold text-white">Cotação Não Disponível</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{erro}</p>
          <div className="pt-4 border-t border-slate-800 text-xs text-slate-500">
            Dúvidas? Entre em contato diretamente com o setor de Suprimentos JC BAUER:
            <div className="font-semibold text-amber-400 mt-1">suprimentos@jcbauer.com.br</div>
          </div>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="max-w-xl w-full bg-slate-900 border border-emerald-500/50 rounded-2xl p-8 shadow-2xl text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center text-emerald-300 text-3xl shadow-lg shadow-emerald-950/50">
            ✓
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-xs font-black uppercase tracking-wider">
              Proposta Comercial Registrada
            </span>
            <h1 className="text-2xl font-black text-white mt-3">
              Obrigado, {empresaNome}!
            </h1>
            <p className="text-slate-300 text-sm mt-2">
              Sua proposta referente à cotação{" "}
              <strong className="text-amber-300">{cotacao?.codigo}</strong> foi enviada diretamente para a mesa de compras da{" "}
              <strong>JC BAUER Construtora</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Empreendimento:</span>
              <strong className="text-white">{cotacao?.obraNome}</strong>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Itens Cotados:</span>
              <strong className="text-emerald-400">
                {itensProposta.filter((it) => (Number(it.precoUnitario) || 0) > 0).length} de {itensProposta.length} insumos
              </strong>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Condição de Pagamento:</span>
              <strong className="text-white">{condicaoPagamento}</strong>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Frete / Prazo:</span>
              <strong className="text-white">{tipoFrete} • {prazoEntregaGeral}</strong>
            </div>
            <div className="flex justify-between pt-1 text-sm">
              <span className="font-bold text-amber-400">Valor Total Ofertado:</span>
              <strong className="font-extrabold text-emerald-300 font-mono text-base">
                {formatBRL(totalProposta)}
              </strong>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Caso sua proposta seja selecionada, nosso departamento de compras emitirá a respectiva{" "}
            <strong>Ordem de Compra (OC)</strong> para formalização do faturamento e entrega.
          </p>

          <div className="pt-4 border-t border-slate-800 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 transition flex items-center gap-2 cursor-pointer"
            >
              🖨️ Imprimir Comprovante
            </button>
            <button
              type="button"
              onClick={() => setSucesso(false)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition cursor-pointer"
            >
              Revisar Proposta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* HEADER EXECUTIVO JC BAUER */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20 text-slate-950 font-black text-xl tracking-tighter">
              JB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-base tracking-wide text-white">
                  JC BAUER
                </h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/30 font-bold uppercase">
                  Portal do Fornecedor
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sistema Integrado de Suprimentos & Obras
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-xs font-bold text-white">
                {cotacao?.codigo || "COT-2026"}
              </div>
              <div className="text-[11px] text-amber-400 truncate max-w-[220px]">
                {cotacao?.obraNome || "Canteiro de Obras"}
              </div>
            </div>
            <span className="h-7 w-px bg-slate-800 hidden sm:block"></span>
            <div className="text-right hidden sm:block">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                Total Estimado
              </span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">
                {formatBRL(totalProposta)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* BANNER DA DEMANDA */}
      <section className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800/80 py-6">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20 text-xs font-bold mb-2">
                <span>📋 Solicitação Oficial de Proposta Comercial</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {cotacao?.titulo || "Cotação de Insumos da Construção Civil"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
                Preencha seus melhores preços unitários, marcas e condições de fornecimento abaixo. As propostas são equalizadas automaticamente para emissão da Ordem de Compra.
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs space-y-1 min-w-[240px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Obra de Destino:</span>
                <span className="font-bold text-white">{cotacao?.obraNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Categoria:</span>
                <span className="font-bold text-amber-300">{cotacao?.categoria || "Geral"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total de Insumos:</span>
                <span className="font-bold text-emerald-400">{itensProposta.length} itens</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FORMULÁRIO PRINCIPAL */}
      <main className="max-w-6xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmeterProposta} className="space-y-6">
          {/* CARD 1: IDENTIFICAÇÃO DO FORNECEDOR */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <span className="flex h-6 w-6 rounded-lg bg-amber-400/20 text-amber-400 items-center justify-center font-bold text-xs">
                1
              </span>
              <h3 className="font-bold text-sm text-white">
                Identificação da Empresa & Vendedor Responsável
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Empresa / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  value={empresaNome}
                  onChange={(e) => setEmpresaNome(e.target.value)}
                  placeholder="Ex: Comercial Hidráulica Ltda"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Nome do Vendedor / Contato
                </label>
                <input
                  type="text"
                  value={vendedorNome}
                  onChange={(e) => setVendedorNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  WhatsApp / Telefone *
                </label>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="Ex: (47) 99999-9999"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  CNPJ (Faturamento)
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                />
              </div>
            </div>
          </div>

          {/* CARD 2: TABELA DE INSUMOS E PREÇOS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 rounded-lg bg-amber-400/20 text-amber-400 items-center justify-center font-bold text-xs">
                  2
                </span>
                <h3 className="font-bold text-sm text-white">
                  Tabela de Insumos & Valores Unitários Ofertados
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Preencha os valores unitários e marcas para cada material
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3 min-w-[220px]">Descrição do Material</th>
                    <th className="py-3 px-3 w-28 text-center">Qtd / Und</th>
                    <th className="py-3 px-3 w-36">Preço Unitário (R$) *</th>
                    <th className="py-3 px-3 w-40">Marca / Fabricante</th>
                    <th className="py-3 px-3 w-32">Prazo (Dias)</th>
                    <th className="py-3 px-3 w-36 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                  {itensProposta.map((it, idx) => {
                    const subtotal = (Number(it.precoUnitario) || 0) * (Number(it.quantidade) || 0);
                    return (
                      <tr key={it.itemId || idx} className="hover:bg-slate-800/50 transition">
                        <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                          {String(idx + 1).padStart(2, "0")}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white text-xs leading-snug">
                            {it.descricao}
                          </div>
                          {it.observacao && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Obs: {it.observacao}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-extrabold text-amber-300 text-xs">
                            {it.quantidade}
                          </span>{" "}
                          <span className="text-slate-400 text-[11px] font-bold">
                            {it.unidade}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                              R$
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0,00"
                              value={it.precoUnitario === 0 ? "" : it.precoUnitario}
                              onChange={(e) =>
                                handleAtualizarItem(
                                  idx,
                                  "precoUnitario",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400 transition"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            placeholder="Ex: Tigre / Gerdau"
                            value={it.marca}
                            onChange={(e) =>
                              handleAtualizarItem(idx, "marca", e.target.value)
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <input
                            type="number"
                            min="0"
                            placeholder="Ex: 3"
                            value={it.prazoEntregaDias === 0 ? "" : it.prazoEntregaDias}
                            onChange={(e) =>
                              handleAtualizarItem(
                                idx,
                                "prazoEntregaDias",
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 transition text-center"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-xs text-emerald-400">
                          {formatBRL(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 text-right">
              <div>
                <span className="text-xs text-slate-400 uppercase font-bold mr-3">
                  Soma dos Insumos:
                </span>
                <span className="text-base font-extrabold text-white font-mono">
                  {formatBRL(totalInsumos)}
                </span>
              </div>
            </div>
          </div>

          {/* CARD 3: CONDIÇÕES COMERCIAIS & FRETE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <span className="flex h-6 w-6 rounded-lg bg-amber-400/20 text-amber-400 items-center justify-center font-bold text-xs">
                3
              </span>
              <h3 className="font-bold text-sm text-white">
                Condições Comerciais, Modalidade de Frete & Pagamento
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Modalidade do Frete *
                </label>
                <select
                  value={tipoFrete}
                  onChange={(e) => setTipoFrete(e.target.value as "CIF" | "FOB")}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                >
                  <option value="CIF">CIF — Entregue na Obra (Incluso)</option>
                  <option value="FOB">FOB — Retira pelo Comprador (À Parte)</option>
                </select>
              </div>

              {tipoFrete === "FOB" ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Valor Adicional do Frete (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={freteValor === 0 ? "" : freteValor}
                    onChange={(e) => setFreteValor(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Prazo Médio de Entrega
                  </label>
                  <input
                    type="text"
                    value={prazoEntregaGeral}
                    onChange={(e) => setPrazoEntregaGeral(e.target.value)}
                    placeholder="Ex: 3 a 5 dias úteis"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Condição de Pagamento *
                </label>
                <select
                  value={condicaoPagamento}
                  onChange={(e) => setCondicaoPagamento(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 transition"
                >
                  <option value="28 DDL">28 DDL (Boleto Bancário)</option>
                  <option value="14/28 DDL">14/28 DDL (Parcelado)</option>
                  <option value="30/60 DDL">30/60 DDL (Parcelado)</option>
                  <option value="30 DDL">30 DDL</option>
                  <option value="À Vista c/ Desconto">À Vista c/ Desconto (PIX/TED)</option>
                  <option value="Contra Entrega">Contra Entrega no Canteiro</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                  Chave PIX / Dados Faturamento
                </label>
                <input
                  type="text"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CNPJ ou E-mail PIX"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                Observações Adicionais / Validade da Proposta
              </label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Preços válidos por 7 dias corridos. Faturamento direto de fábrica com nota fiscal inclusa."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
              />
            </div>
          </div>

          {/* CARD 4: BARRA DE FINALIZAÇÃO E ENVIO */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-2 border-emerald-500/60 rounded-2xl p-6 shadow-2xl flex flex-wrap items-center justify-between gap-6">
            <div>
              <span className="text-xs text-slate-400 uppercase font-black tracking-wider block">
                Valor Total da Proposta Comercial
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                  {formatBRL(totalProposta)}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  ({tipoFrete === "CIF" ? "Frete Incluso" : `+ ${formatBRL(freteValor)} de Frete FOB`})
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Ao enviar, a JC BAUER receberá instantaneamente sua proposta na mesa de equalização de compras.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={salvando}
                className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {salvando ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>Enviando Proposta...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Submeter Proposta à JC BAUER</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* FOOTER */}
      <footer className="max-w-6xl mx-auto px-4 mt-12 pt-6 border-t border-slate-900 text-center text-xs text-slate-600">
        JC BAUER Construtora & Incorporadora — Gestão de Suprimentos & Governança de Canteiro • Todos os direitos reservados.
      </footer>
    </div>
  );
}
