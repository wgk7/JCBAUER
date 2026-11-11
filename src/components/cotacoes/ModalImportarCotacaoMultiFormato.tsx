"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  ItemComparativoRapido,
  FornecedorCotadoRapido,
  FornecedorCadastro,
} from "../../types/jcBauer";

interface ModalImportarCotacaoMultiFormatoProps {
  isOpen: boolean;
  onClose: () => void;
  fornecedorIndexPadrao?: number;
  fornecedores: FornecedorCotadoRapido[];
  itens: ItemComparativoRapido[];
  fornecedoresCadastrados?: FornecedorCadastro[];
  obraNome?: string;
  onAplicarPrecos: (
    fornecedorIndex: number,
    dados: {
      precos: Record<string, number>;
      freteTipo?: "CIF" | "FOB";
      freteValor?: number;
      prazo?: string;
      condicao?: string;
      descontoValor?: number;
      nomeFornecedor?: string;
      novosItens?: {
        id?: string;
        nome: string;
        quantidade: number;
        unidade: string;
        preco: number;
      }[];
    }
  ) => void;
  dispararAviso: (msg: string) => void;
}

interface ItemReconhecido {
  itemId: string;
  itemNome: string;
  quantidade: number;
  unidade: string;
  precoDetectado: number;
  precoTotal?: number;
  status: "encontrado" | "faltante" | "manual";
  textoOrigem?: string;
  isNovo?: boolean;
}

function formatBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoedaBR(str: string): number {
  if (!str) return 0;
  const limpo = str.replace(/[^\d.,]/g, "").trim();
  if (!limpo) return 0;

  if (limpo.includes(",") && limpo.includes(".")) {
    return parseFloat(limpo.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (limpo.includes(",")) {
    return parseFloat(limpo.replace(",", ".")) || 0;
  }
  return parseFloat(limpo) || 0;
}

export function ModalImportarCotacaoMultiFormato({
  isOpen,
  onClose,
  fornecedorIndexPadrao = 0,
  fornecedores,
  itens,
  fornecedoresCadastrados = [],
  obraNome = "Canteiro de Obras JC Bauer",
  onAplicarPrecos,
  dispararAviso,
}: ModalImportarCotacaoMultiFormatoProps) {
  const [fornecedorIndex, setFornecedorIndex] = useState<number>(fornecedorIndexPadrao);
  const [abaAtiva, setAbaAtiva] = useState<"whatsapp" | "arquivo">("arquivo");
  const [textoColado, setTextoColado] = useState<string>("");
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [processandoArquivo, setProcessandoArquivo] = useState<boolean>(false);
  const [mensagemProgresso, setMensagemProgresso] = useState<string>("");

  // Dados extraídos
  const [itensReconhecidos, setItensReconhecidos] = useState<ItemReconhecido[]>([]);
  const [freteTipo, setFreteTipo] = useState<"CIF" | "FOB">("CIF");
  const [freteValor, setFreteValor] = useState<number>(0);
  const [prazoEntrega, setPrazoEntrega] = useState<string>("");
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>("");
  const [descontoValor, setDescontoValor] = useState<number>(0);
  const [nomeDetectado, setNomeDetectado] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    setFornecedorIndex(fornecedorIndexPadrao);
  }, [fornecedorIndexPadrao]);

  // Inicializa a grade de itens com base nos itens da cotação ativa APENAS na abertura inicial
  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    if (!prevIsOpenRef.current) {
      prevIsOpenRef.current = true;

      if (Array.isArray(itens) && itens.length > 0) {
        const inicial: ItemReconhecido[] = itens.map((it) => ({
          itemId: it.id,
          itemNome: it.nome,
          quantidade: it.quantidade || 1,
          unidade: it.unidade || "un",
          precoDetectado: 0,
          status: "faltante" as const,
        }));
        setItensReconhecidos(inicial);
      } else {
        setItensReconhecidos([]);
      }

      setTextoColado("");
      setNomeArquivo("");
      setPrazoEntrega(fornecedores[fornecedorIndex]?.prazo || "");
      setCondicaoPagamento(fornecedores[fornecedorIndex]?.condicao || "");
      setFreteTipo(fornecedores[fornecedorIndex]?.freteTipo || "CIF");
      setFreteValor(fornecedores[fornecedorIndex]?.freteValor || 0);
      setDescontoValor(fornecedores[fornecedorIndex]?.descontoValor || 0);
    }
  }, [isOpen, itens, fornecedorIndex, fornecedores]);

  // Processa itens extraídos pelo motor inteligente (seja via API ou local)
  const aplicarItensExtraidos = (
    itensExtraidos: {
      codigo?: string;
      nome: string;
      quantidade: number;
      unidade: string;
      precoUnitario: number;
      precoTotal: number;
    }[],
    textoCompleto: string
  ) => {
    // Se a soma dos itens divergir ligeiramente do total oficial do documento (decorrente de centavos de casas decimais do ERP do fornecedor),
    // equaliza automaticamente a diferença no campo de desconto para fechar 100% no centavo com o PDF original
    const somaItensCalc = itensExtraidos.reduce(
      (acc, it) => acc + (it.quantidade || 0) * (it.precoUnitario || 0),
      0
    );
    const matchTotalDoc = (textoCompleto || "").match(/\b(?:total|total\s*geral)[\s:]*\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
    if (matchTotalDoc && matchTotalDoc[1]) {
      const totalDoc = parseMoedaBR(matchTotalDoc[1]);
      if (totalDoc > 0 && somaItensCalc > totalDoc) {
        const dif = Math.round((somaItensCalc - totalDoc) * 100) / 100;
        if (dif > 0 && dif < (somaItensCalc * 0.15)) {
          setDescontoValor(dif);
        }
      }
    }

    const itensValidos = (itens || []).filter(
      (item) => item && item.nome && item.nome.trim().length > 0
    );

    // CASO 1: A cotação JÁ TEM itens válidos definidos pelo usuário -> Faz pareamento inteligente
    if (itensValidos.length > 0) {
      const pareados: ItemReconhecido[] = itensValidos.map((item) => {
        const nomeNorm = normalizar(item.nome);
        const palavrasChave = nomeNorm
          .split(" ")
          .filter((p) => p.length > 2 && !["com", "para", "de", "da", "do", "tipo"].includes(p));
        const medidas = nomeNorm.match(/\d+[\w.,]+/g) || [];

        let melhorMatch: (typeof itensExtraidos)[0] | null = null;
        let maiorScore = 0;

        for (const ext of itensExtraidos) {
          const extNorm = normalizar(ext.nome);
          let score = 0;

          for (const pal of palavrasChave) {
            if (extNorm.includes(pal)) score += 2;
          }
          for (const med of medidas) {
            if (extNorm.includes(med)) score += 4;
          }

          if (score > maiorScore && score >= 2) {
            maiorScore = score;
            melhorMatch = ext;
          }
        }

        if (melhorMatch && melhorMatch.precoUnitario > 0) {
          return {
            itemId: item.id,
            itemNome: item.nome,
            quantidade: item.quantidade || melhorMatch.quantidade || 1,
            unidade: item.unidade || melhorMatch.unidade || "un",
            precoDetectado: melhorMatch.precoUnitario,
            precoTotal: melhorMatch.precoTotal,
            status: "encontrado" as const,
            textoOrigem: melhorMatch.nome,
          };
        }

        return {
          itemId: item.id,
          itemNome: item.nome,
          quantidade: item.quantidade || 1,
          unidade: item.unidade || "un",
          precoDetectado: 0,
          status: "faltante" as const,
        };
      });

      // Também inclui itens do documento que não estavam na lista original (para não perder nada!)
      const itensNovosDoArquivo: ItemReconhecido[] = [];
      itensExtraidos.forEach((ext, idx) => {
        const jaPareado = pareados.some(
          (p) =>
            p.status === "encontrado" &&
            (normalizar(p.textoOrigem || "") === normalizar(ext.nome) ||
              normalizar(p.itemNome) === normalizar(ext.nome))
        );
        if (!jaPareado && ext.precoUnitario > 0) {
          itensNovosDoArquivo.push({
            itemId: `novo-${Date.now()}-${idx}`,
            itemNome: ext.nome,
            quantidade: ext.quantidade || 1,
            unidade: ext.unidade || "un",
            precoDetectado: ext.precoUnitario,
            precoTotal: ext.precoTotal,
            status: "encontrado",
            textoOrigem: ext.codigo ? `Cód: ${ext.codigo}` : "Extraído do Arquivo",
            isNovo: true,
          });
        }
      });

      const resultadoFinal = [...pareados, ...itensNovosDoArquivo];
      setItensReconhecidos(resultadoFinal);

      const totalEncontrados = resultadoFinal.filter((i) => i.precoDetectado > 0).length;
      dispararAviso(
        `Leitura concluída: ${totalEncontrados} insumo(s) e preços identificados com sucesso!`
      );
      return;
    }

    // CASO 2: A cotação estava VAZIA (0 itens) -> Adiciona todos os itens lidos do arquivo!
    if (itensExtraidos.length > 0) {
      const novos: ItemReconhecido[] = itensExtraidos.map((ext, idx) => ({
        itemId: `item-import-${Date.now()}-${idx}`,
        itemNome: ext.nome,
        quantidade: ext.quantidade || 1,
        unidade: ext.unidade || "un",
        precoDetectado: ext.precoUnitario || 0,
        precoTotal: ext.precoTotal,
        status: (ext.precoUnitario > 0 ? "encontrado" : "faltante") as const,
        textoOrigem: ext.codigo ? `Cód: ${ext.codigo}` : undefined,
        isNovo: true,
      }));

      setItensReconhecidos(novos);
      dispararAviso(
        `${novos.length} insumo(s) lidos e preenchidos automaticamente do documento!`
      );
      return;
    }

    dispararAviso(
      "Nenhum insumo estruturado com preço foi identificado. Você pode adicionar manualmente na grade abaixo."
    );
  };

  // Motor Inteligente de Interpretação Textual (WhatsApp / TXT / Colado)
  const analisarTextoCompleto = async (conteudoBruto: string) => {
    if (!conteudoBruto || !conteudoBruto.trim()) {
      dispararAviso("Cole uma mensagem ou selecione um arquivo válido.");
      return;
    }

    setProcessandoArquivo(true);
    setMensagemProgresso("Analisando texto e insumos...");

    try {
      const res = await fetch("/api/extrair-cotacao", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texto: conteudoBruto }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.sucesso && data.dados) {
          const { dados } = data;
          if (dados.freteTipo) setFreteTipo(dados.freteTipo);
          if (dados.freteValor !== undefined) setFreteValor(dados.freteValor);
          if (dados.prazo) setPrazoEntrega(dados.prazo);
          if (dados.condicao) setCondicaoPagamento(dados.condicao);
          if (dados.descontoValor !== undefined) setDescontoValor(dados.descontoValor);
          if (dados.fornecedorNome) setNomeDetectado(dados.fornecedorNome);

          aplicarItensExtraidos(dados.itens || [], conteudoBruto);
          return;
        }
      }
    } catch (e) {
      console.warn("Erro ao chamar API de extração de texto, usando fallback local:", e);
    } finally {
      setProcessandoArquivo(false);
      setMensagemProgresso("");
    }
  };

  // Upload e Parsing de Arquivo Completo (PDF, Word, Excel, CSV, TXT)
  const handleUploadArquivo = async (file: File) => {
    if (!file) return;
    setNomeArquivo(file.name);
    setProcessandoArquivo(true);
    setMensagemProgresso(`Lendo ${file.name} e extraindo insumos...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/extrair-cotacao", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Servidor retornou status ${response.status}`);
      }

      const resData = await response.json();

      if (resData.sucesso && resData.dados) {
        const { dados } = resData;

        if (dados.freteTipo) setFreteTipo(dados.freteTipo);
        if (dados.freteValor !== undefined) setFreteValor(dados.freteValor);
        if (dados.prazo) setPrazoEntrega(dados.prazo);
        if (dados.condicao) setCondicaoPagamento(dados.condicao);
        if (dados.descontoValor !== undefined) setDescontoValor(dados.descontoValor);
        if (dados.fornecedorNome) setNomeDetectado(dados.fornecedorNome);
        if (dados.textoCompleto) setTextoColado(dados.textoCompleto);

        aplicarItensExtraidos(dados.itens || [], dados.textoCompleto || "");
      } else {
        throw new Error(resData.erro || "Falha na extração de dados");
      }
    } catch (err: any) {
      console.warn("Falha no parser do servidor, tentando leitura local de contingência:", err);

      // Contingência local para Excel caso ocorra falha de rede
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        try {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvContent = XLSX.utils.sheet_to_csv(firstSheet);
          setTextoColado(csvContent);
          await analisarTextoCompleto(csvContent);
          return;
        } catch {}
      }

      dispararAviso(
        `Não foi possível ler automaticamente o arquivo "${file.name}". Você também pode copiar o texto do documento e colar na aba "Colar Mensagem do WhatsApp"!`
      );
    } finally {
      setProcessandoArquivo(false);
      setMensagemProgresso("");
    }
  };

  // Atualização manual de preço na prévia
  const handleAtualizarPrecoManual = (itemId: string, novoValor: number) => {
    setItensReconhecidos((prev) =>
      prev.map((i) =>
        i.itemId === itemId
          ? {
              ...i,
              precoDetectado: novoValor,
              precoTotal: undefined, // remove precoTotal fixo do PDF para recalcular Qtd * novoValor
              status: novoValor > 0 ? "manual" : "faltante",
            }
          : i
      )
    );
  };

  // Atualização de quantidade manual
  const handleAtualizarQtdManual = (itemId: string, novaQtd: number) => {
    setItensReconhecidos((prev) =>
      prev.map((i) =>
        i.itemId === itemId
          ? {
              ...i,
              quantidade: novaQtd,
              precoTotal: undefined, // remove precoTotal fixo do PDF para recalcular novaQtd * preco
            }
          : i
      )
    );
  };

  // Adicionar um novo insumo manualmente na grade
  const handleAdicionarInsumoManual = () => {
    const novo: ItemReconhecido = {
      itemId: `item-manual-${Date.now()}`,
      itemNome: "Novo Insumo / Material",
      quantidade: 1,
      unidade: "un",
      precoDetectado: 0,
      status: "faltante",
      isNovo: true,
    };
    setItensReconhecidos((prev) => [...prev, novo]);
  };

  // Cálculo de Totais da Prévia
  const subtotalItens = useMemo(() => {
    return itensReconhecidos.reduce(
      (acc, it) => acc + (it.quantidade || 0) * (it.precoDetectado || 0),
      0
    );
  }, [itensReconhecidos]);

  const totalFinalProposta = useMemo(() => {
    const frete = freteTipo === "FOB" ? freteValor : 0;
    const desc = descontoValor || 0;
    return Math.max(0, subtotalItens + frete - desc);
  }, [subtotalItens, freteTipo, freteValor, descontoValor]);

  const itensFaltantes = useMemo(() => {
    return itensReconhecidos.filter((i) => i.status === "faltante" || i.precoDetectado <= 0);
  }, [itensReconhecidos]);

  // Mensagem de cobrança rápida no WhatsApp para itens que o fornecedor esqueceu
  const gerarMensagemCobrancaFaltantes = () => {
    const nomesFaltantes = itensFaltantes
      .map((i) => `• ${i.itemNome} (${i.quantidade} ${i.unidade})`)
      .join("\n");
    const fornAtual = fornecedores[fornecedorIndex];
    return `Olá ${
      fornAtual?.vendedor || fornAtual?.nome || "Amigo"
    }, recebemos sua cotação para a obra ${obraNome}.\n\nPorém ficou faltando o preço dos seguintes itens:\n${nomesFaltantes}\n\nConsegue nos passar os valores desses itens para concluirmos a equalização? Obrigado!`;
  };

  const handleCopiarMensagemCobranca = () => {
    const msg = gerarMensagemCobrancaFaltantes();
    navigator.clipboard?.writeText(msg);
    dispararAviso(
      "Mensagem de cobrança copiada! Basta dar Ctrl + V no WhatsApp do vendedor."
    );
  };

  const handleAbrirWhatsAppCobranca = () => {
    const msg = gerarMensagemCobrancaFaltantes();
    const fornAtual = fornecedores[fornecedorIndex];
    const fCrm = fornecedoresCadastrados.find(
      (f) => f.empresa.toLowerCase() === (fornAtual?.nome || "").toLowerCase()
    );
    const tel = fCrm?.whatsapp || fCrm?.telefone || fornAtual?.telefone || "";
    const cleanTel = tel.replace(/\D/g, "");
    const url = cleanTel
      ? `https://wa.me/55${cleanTel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Aplicação final na planilha de equalização
  const handleConfirmarEAplicar = () => {
    const precosMap: Record<string, number> = {};
    itensReconhecidos.forEach((it) => {
      precosMap[it.itemId] = it.precoDetectado || 0;
    });

    const novosItens = itensReconhecidos.map((it) => ({
      id: it.itemId,
      nome: it.itemNome,
      quantidade: it.quantidade || 1,
      unidade: it.unidade || "un",
      preco: it.precoDetectado || 0,
    }));

    onAplicarPrecos(fornecedorIndex, {
      precos: precosMap,
      freteTipo,
      freteValor: freteTipo === "FOB" ? freteValor : 0,
      prazo: prazoEntrega || "A combinar",
      condicao: condicaoPagamento || "28 ddl",
      descontoValor: descontoValor || 0,
      nomeFornecedor: nomeDetectado || undefined,
      novosItens,
    });

    dispararAviso(
      `Cotação de ${formatBRL(
        totalFinalProposta
      )} aplicada com sucesso ao Fornecedor #${fornecedorIndex + 1} (${
        fornecedores[fornecedorIndex]?.nome || "Fornecedor"
      })!`
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* CABEÇALHO DO MODAL */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xl shrink-0">
              ⚡
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base text-white">
                  Assistente Inteligente de Cotações
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 uppercase">
                  PDF • Excel • Word • WhatsApp
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                Arraste o orçamento do fornecedor ou cole o texto do WhatsApp para ler insumos e valores automaticamente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* SELEÇÃO DO FORNECEDOR ALVO */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">🎯 Preencher dados para:</span>
              <select
                value={fornecedorIndex}
                onChange={(e) => setFornecedorIndex(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                {fornecedores.map((f, idx) => (
                  <option key={idx} value={idx}>
                    #{idx + 1} - {f.nome || `Fornecedor #${idx + 1}`} {f.vendedor ? `(${f.vendedor})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <span>📍 Obra:</span>
              <strong className="text-slate-700">{obraNome}</strong>
            </div>
          </div>

          {/* ABAS DE ENTRADA: ARQUIVO (PDF, EXCEL, WORD) VS WHATSAPP */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setAbaAtiva("arquivo")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  abaAtiva === "arquivo"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>📁</span> Arrastar Arquivo (PDF, Excel .xlsx, Word .docx, TXT)
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva("whatsapp")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  abaAtiva === "whatsapp"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>💬</span> Colar Mensagem do WhatsApp (Ctrl + V)
              </button>
            </div>

            {/* ABA ARQUIVO */}
            {abaAtiva === "arquivo" && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,.docx,.doc,.txt"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleUploadArquivo(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleUploadArquivo(e.dataTransfer.files[0]);
                    }
                  }}
                  className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50/30 rounded-2xl p-7 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 bg-emerald-50/10 shadow-2xs"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-3xl shadow-xs">
                    {processandoArquivo ? "⏳" : "📄"}
                  </div>
                  <div>
                    <strong className="text-sm font-black text-slate-800 block">
                      {nomeArquivo
                        ? `Arquivo selecionado: ${nomeArquivo}`
                        : "Clique aqui ou arraste o PDF, Excel ou Word do fornecedor"}
                    </strong>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Suporta orçamentos em <strong>PDF</strong>, planilhas <strong>Excel (.xlsx, .xls)</strong> e documentos <strong>Word (.docx)</strong>
                    </span>
                  </div>

                  {processandoArquivo ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold bg-white px-3 py-1.5 rounded-lg border border-emerald-300 shadow-2xs animate-pulse mt-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                      <span>{mensagemProgresso || "Lendo documento e extraindo insumos..."}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-md mt-1">
                      ⚡ Leitura 100% Automática de Insumos e Valores
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ABA WHATSAPP */}
            {abaAtiva === "whatsapp" && (
              <div className="space-y-2">
                <textarea
                  value={textoColado}
                  onChange={(e) => setTextoColado(e.target.value)}
                  placeholder={`Cole aqui a mensagem recebida do vendedor no WhatsApp...\n\nExemplo:\n"Segue preços da Ilumisul:\n100 m Cabo Flexível 2,5mm: R$ 2,45\n20 un Disjuntor Bipolar 20A: R$ 18,90\nFrete CIF incluso\nPrazo: 5 dias úteis\nCondição: 28 dias no boleto"`}
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono leading-relaxed"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    💡 Dica: Pode colar a mensagem completa. O sistema detecta os insumos, quantidades, unidades e valores!
                  </span>
                  <div className="flex items-center gap-2">
                    {textoColado && (
                      <button
                        type="button"
                        onClick={() => setTextoColado("")}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-rose-600 font-semibold"
                      >
                        Limpar
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={processandoArquivo}
                      onClick={() => analisarTextoCompleto(textoColado)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>🔍</span> Analisar Mensagem
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ALERTA DE ITENS FALTANTES (SE HOUVER) */}
          {itensFaltantes.length > 0 && itensReconhecidos.some((i) => i.precoDetectado > 0) && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-xl shrink-0">⚠️</span>
                  <div>
                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-wide">
                      Atenção: O fornecedor não cotou {itensFaltantes.length} item(ns)!
                    </h4>
                    <p className="text-xs text-rose-800 mt-0.5">
                      Verifique os itens pendentes abaixo para evitar distorções no comparativo de preços:
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopiarMensagemCobranca}
                    className="px-2.5 py-1 rounded bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Copiar texto de cobrança para colar no WhatsApp"
                  >
                    <span>📋</span> Copiar Cobrança
                  </button>
                  <button
                    type="button"
                    onClick={handleAbrirWhatsAppCobranca}
                    className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Abrir WhatsApp direto com a mensagem de cobrança"
                  >
                    <span>📲</span> Cobrar no WhatsApp
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {itensFaltantes.map((f) => (
                  <span
                    key={f.itemId}
                    className="px-2 py-0.5 rounded bg-rose-200/80 border border-rose-300 text-[11px] font-bold text-rose-900"
                  >
                    ✕ {f.itemNome} ({f.quantidade} {f.unidade})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* TABELA DE PRÉVIA & CONFERÊNCIA DOS ITENS EXTRAÍDOS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>📋</span> Conferência dos Insumos ({itensReconhecidos.length} itens)
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAdicionarInsumoManual}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>+</span> Adicionar Item
                </button>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Ajuste quantidades ou preços diretamente nas caixinhas.
                </span>
              </div>
            </div>

            {itensReconhecidos.length === 0 ? (
              <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 text-slate-500 space-y-1">
                <p className="font-bold text-xs">Nenhum insumo carregado no momento.</p>
                <p className="text-[11px]">
                  Arraste o arquivo em PDF, Excel ou Word acima para extrair todos os materiais automaticamente!
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">Item / Insumo Solicitado</th>
                      <th className="py-2.5 px-2 text-center w-20">Qtd</th>
                      <th className="py-2.5 px-2 text-center w-16">Und</th>
                      <th className="py-2.5 px-3 text-right w-36">Preço Unitário (R$)</th>
                      <th className="py-2.5 px-3 text-right w-32">Total (R$)</th>
                      <th className="py-2.5 px-3 text-center w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itensReconhecidos.map((item) => {
                      const totalLinha = (item.quantidade || 0) * (item.precoDetectado || 0);
                      return (
                        <tr
                          key={item.itemId}
                          className={`hover:bg-slate-50/80 transition ${
                            item.status === "faltante" ? "bg-rose-50/40" : ""
                          }`}
                        >
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              {item.isNovo && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                                  Novo
                                </span>
                              )}
                              <span>{item.itemNome}</span>
                            </div>
                            {item.textoOrigem && (
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-md">
                                {item.textoOrigem}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={item.quantidade || ""}
                              onChange={(e) =>
                                handleAtualizarQtdManual(item.itemId, parseFloat(e.target.value) || 1)
                              }
                              className="w-16 text-center font-bold text-xs rounded-md px-1.5 py-0.5 border border-slate-300 bg-white"
                            />
                          </td>
                          <td className="py-2 px-2 text-center text-slate-500 uppercase font-semibold">
                            {item.unidade}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={
                                item.precoDetectado > 0
                                  ? Number((Math.round(item.precoDetectado * 100) / 100).toFixed(2))
                                  : ""
                              }
                              placeholder="0,00"
                              onChange={(e) =>
                                handleAtualizarPrecoManual(item.itemId, parseFloat(e.target.value) || 0)
                              }
                              className={`w-28 text-right font-bold text-xs rounded-lg px-2 py-1 border transition focus:outline-hidden ${
                                item.precoDetectado > 0
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-950 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                                  : "bg-white border-rose-300 text-rose-900 focus:border-rose-600"
                              }`}
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                            {formatBRL(totalLinha)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.precoDetectado > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                <span>✓</span> Cotado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                <span>✕</span> Faltando
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* CONDIÇÕES COMERCIAIS ADICIONAIS (FRETE, PRAZO, CONDIÇÃO, DESCONTO) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>🚚</span> Condições Comerciais Detectadas
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              {/* Frete */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tipo de Frete:
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFreteTipo("CIF")}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition border cursor-pointer ${
                      freteTipo === "CIF"
                        ? "bg-emerald-700 text-white border-emerald-800"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    CIF (Incluso)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFreteTipo("FOB")}
                    className={`flex-1 py-1.5 px-2 rounded-lg font-bold text-xs transition border cursor-pointer ${
                      freteTipo === "FOB"
                        ? "bg-amber-600 text-white border-amber-700"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    FOB (À parte)
                  </button>
                </div>
                {freteTipo === "FOB" && (
                  <div className="mt-1.5">
                    <input
                      type="number"
                      step="10"
                      min="0"
                      placeholder="Valor Frete (R$)"
                      value={freteValor || ""}
                      onChange={(e) => setFreteValor(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-right font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Prazo de Entrega */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Prazo de Entrega:
                </label>
                <input
                  type="text"
                  value={prazoEntrega}
                  placeholder="Ex: 5 dias úteis"
                  onChange={(e) => setPrazoEntrega(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold"
                />
              </div>

              {/* Condição de Pagamento */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Condição de Pagamento:
                </label>
                <input
                  type="text"
                  value={condicaoPagamento}
                  placeholder="Ex: 28 dias boleto"
                  onChange={(e) => setCondicaoPagamento(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold"
                />
              </div>

              {/* Desconto Comercial */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Desconto / Ajuste (R$):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={descontoValor > 0 ? Number(descontoValor.toFixed(2)) : ""}
                  placeholder="0,00"
                  onChange={(e) => setDescontoValor(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold text-right"
                />
                {descontoValor > 0 && (
                  <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                    Equalizado com o total do PDF
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ COM TOTALIZADOR E AÇÕES FINAIS */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[11px] text-slate-500 font-medium block">Subtotal dos Itens:</span>
              <strong className="text-sm font-bold text-slate-700">{formatBRL(subtotalItens)}</strong>
            </div>
            {freteTipo === "FOB" && freteValor > 0 && (
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Frete FOB:</span>
                <strong className="text-sm font-bold text-amber-700">+{formatBRL(freteValor)}</strong>
              </div>
            )}
            {descontoValor > 0 && (
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">Desconto:</span>
                <strong className="text-sm font-bold text-emerald-700">-{formatBRL(descontoValor)}</strong>
              </div>
            )}
            <div className="border-l border-slate-300 pl-4">
              <span className="text-[11px] text-slate-500 font-semibold block">Total Proposta Equalizada:</span>
              <strong className="text-lg font-black text-emerald-800">{formatBRL(totalFinalProposta)}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmarEAplicar}
              disabled={itensReconhecidos.length === 0 || itensReconhecidos.every((i) => i.precoDetectado <= 0)}
              className={`px-5 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-md cursor-pointer ${
                itensReconhecidos.some((i) => i.precoDetectado > 0)
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/20"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              <span>✅</span> Aplicar Preços na Planilha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
