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
  status: "encontrado" | "faltante" | "manual";
  textoOrigem?: string;
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
  const [abaAtiva, setAbaAtiva] = useState<"whatsapp" | "arquivo">("whatsapp");
  const [textoColado, setTextoColado] = useState<string>("");
  const [nomeArquivo, setNomeArquivo] = useState<string>("");
  const [processandoArquivo, setProcessandoArquivo] = useState<boolean>(false);

  // Dados extraídos
  const [itensReconhecidos, setItensReconhecidos] = useState<ItemReconhecido[]>([]);
  const [freteTipo, setFreteTipo] = useState<"CIF" | "FOB">("CIF");
  const [freteValor, setFreteValor] = useState<number>(0);
  const [prazoEntrega, setPrazoEntrega] = useState<string>("");
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>("");
  const [descontoValor, setDescontoValor] = useState<number>(0);
  const [nomeDetectado, setNomeDetectado] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFornecedorIndex(fornecedorIndexPadrao);
  }, [fornecedorIndexPadrao]);

  // Inicializa a grade de itens com base nos itens da cotação ativa
  useEffect(() => {
    if (!isOpen) return;
    const inicial = itens.map((it) => ({
      itemId: it.id,
      itemNome: it.nome,
      quantidade: it.quantidade || 1,
      unidade: it.unidade || "un",
      precoDetectado: 0,
      status: "faltante" as const,
    }));
    setItensReconhecidos(inicial);
    setTextoColado("");
    setNomeArquivo("");
    setPrazoEntrega(fornecedores[fornecedorIndex]?.prazo || "");
    setCondicaoPagamento(fornecedores[fornecedorIndex]?.condicao || "");
    setFreteTipo(fornecedores[fornecedorIndex]?.freteTipo || "CIF");
    setFreteValor(fornecedores[fornecedorIndex]?.freteValor || 0);
    setDescontoValor(fornecedores[fornecedorIndex]?.descontoValor || 0);
  }, [isOpen, itens, fornecedorIndex, fornecedores]);

  // Motor Inteligente de Interpretação Textual (WhatsApp / TXT / Excel / PDF)
  const analisarTextoCompleto = (conteudoBruto: string) => {
    if (!conteudoBruto || !conteudoBruto.trim()) {
      dispararAviso("Cole uma mensagem ou selecione um arquivo válido.");
      return;
    }

    const linhas = conteudoBruto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const textoTotalNorm = normalizar(conteudoBruto);

    // 1. Extração de Condições Comerciais Gerais
    // Frete
    if (/(?:cif|incluso|gratis|gratuito|por nossa conta|entregue|frete\s*incluso)/i.test(conteudoBruto)) {
      setFreteTipo("CIF");
      setFreteValor(0);
    } else if (/(?:fob|retira|por conta do cliente|sem frete)/i.test(conteudoBruto)) {
      setFreteTipo("FOB");
    }

    const matchValorFrete = conteudoBruto.match(
      /(?:frete|transporte)[\s:]*(?:de|R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{1,2})/i
    );
    if (matchValorFrete && matchValorFrete[1]) {
      const v = parseFloat(matchValorFrete[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(v) && v > 0) {
        setFreteTipo("FOB");
        setFreteValor(v);
      }
    }

    // Prazo de Entrega
    const matchPrazo = conteudoBruto.match(
      /(?:prazo|entrega)[\s:]*([^\n,.;]+?(?:dias|ddl|horas|hrs|imediato|pronta entrega|semana))/i
    );
    if (matchPrazo && matchPrazo[1]) {
      setPrazoEntrega(matchPrazo[1].trim());
    } else {
      const matchPrazoSimples = conteudoBruto.match(/(\d+\s*(?:a\s*\d+)?\s*(?:dias|ddl)|pronta entrega|imediato)/i);
      if (matchPrazoSimples && matchPrazoSimples[1]) {
        setPrazoEntrega(matchPrazoSimples[1].trim());
      }
    }

    // Condição de Pagamento
    const matchPagto = conteudoBruto.match(
      /(?:pagamento|condicao|condic|faturamento)[\s:]*([^\n,.;]+?(?:dias|ddl|vista|boleto|pix|14|28|30|60))/i
    );
    if (matchPagto && matchPagto[1]) {
      setCondicaoPagamento(matchPagto[1].trim());
    } else {
      const matchPagtoSimples = conteudoBruto.match(
        /(\d+\s*(?:dias|ddl)|\d+\/\d+|\d+\/\d+\/\d+|a vista|à vista|boleto\s*\d+\s*dias|pix)/i
      );
      if (matchPagtoSimples && matchPagtoSimples[1]) {
        setCondicaoPagamento(matchPagtoSimples[1].trim());
      }
    }

    // Desconto
    const matchDesc = conteudoBruto.match(
      /desconto[\s:]*(?:de|R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{1,2})/i
    );
    if (matchDesc && matchDesc[1]) {
      const d = parseFloat(matchDesc[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(d) && d > 0) setDescontoValor(d);
    }

    // 2. Extração e Pareamento Inteligente Insumo por Insumo
    const novosItens: ItemReconhecido[] = itens.map((item) => {
      const nomeLimpo = normalizar(item.nome);
      const palavrasChave = nomeLimpo
        .split(" ")
        .filter((p) => p.length > 2 && !["com", "para", "de", "da", "do", "tipo"].includes(p));

      // Extrai medidas específicas como 18mm, 14mm, 2,44, 30cm, 5cm
      const medidas = nomeLimpo.match(/\d+[\w.,]+/g) || [];

      let melhorPreco = 0;
      let melhorLinha = "";
      let maiorScore = 0;

      for (const linha of linhas) {
        const linhaNorm = normalizar(linha);

        // Se for linha puramente de cabeçalho ou de frete/prazo, pula
        if (/^(frete|prazo|condicao|pagamento|atenciosamente|orcamento|proposta|total|subtotal)/.test(linhaNorm)) {
          continue;
        }

        // Pontuação de similaridade semântica
        let score = 0;
        for (const pal of palavrasChave) {
          if (linhaNorm.includes(pal)) {
            score += 2;
          }
        }
        for (const med of medidas) {
          if (linhaNorm.includes(med)) {
            score += 4; // Medidas têm peso alto para não trocar 14mm por 18mm!
          }
        }

        // Se encontrou palavras-chave relevantes
        if (score >= 2 && score > maiorScore) {
          // Extrai valores monetários da linha
          // Regex captura R$ 78,50, 78.50, 78,50, 1.250,00
          const matchesPreco = linha.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2}))/g);
          if (matchesPreco && matchesPreco.length > 0) {
            // Pega o valor mais provável de ser o unitário
            const valoresNum = matchesPreco
              .map((str) => {
                const limpo = str.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
                return parseFloat(limpo);
              })
              .filter((n) => !isNaN(n) && n > 0);

            if (valoresNum.length > 0) {
              // Se tiver múltiplos valores na linha (ex: qtd 100 e unit 78,50 e total 7850)
              // Escolhe o valor que for menor ou mais coerente
              let precoCandidato = valoresNum[0];
              if (valoresNum.length >= 2) {
                // Tenta achar o valor unitário próximo da quantidade
                const qtd = item.quantidade || 1;
                const candidatoUnit = valoresNum.find(
                  (v) => Math.abs(v * qtd - valoresNum[valoresNum.length - 1]) < 1
                );
                precoCandidato = candidatoUnit || valoresNum[valoresNum.length - 1];
              }

              if (precoCandidato > 0) {
                melhorPreco = precoCandidato;
                melhorLinha = linha;
                maiorScore = score;
              }
            }
          }
        }
      }

      return {
        itemId: item.id,
        itemNome: item.nome,
        quantidade: item.quantidade || 1,
        unidade: item.unidade || "un",
        precoDetectado: melhorPreco,
        status: melhorPreco > 0 ? "encontrado" : "faltante",
        textoOrigem: melhorLinha || undefined,
      };
    });

    setItensReconhecidos(novosItens);

    const totalEncontrados = novosItens.filter((i) => i.status === "encontrado").length;
    const totalFaltantes = novosItens.filter((i) => i.status === "faltante").length;

    if (totalEncontrados > 0) {
      dispararAviso(
        `Análise concluída: ${totalEncontrados} item(ns) reconhecido(s)${
          totalFaltantes > 0 ? ` e ${totalFaltantes} item(ns) pendente(s)` : ""
        }!`
      );
    } else {
      dispararAviso(
        "Não foi possível identificar preços automáticos com certeza. Você pode preencher manualmente na grade abaixo."
      );
    }
  };

  // Upload e Parsing de Arquivo (Excel, CSV, Word, TXT)
  const handleUploadArquivo = async (file: File) => {
    if (!file) return;
    setNomeArquivo(file.name);
    setProcessandoArquivo(true);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        // Planilha Excel ou CSV via SheetJS
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const csvContent = XLSX.utils.sheet_to_csv(worksheet);

        setTextoColado(csvContent);
        analisarTextoCompleto(csvContent);
      } else if (ext === "docx" || ext === "doc") {
        // Arquivo Word (.docx) — extração de strings textuais do pacote XML
        const buffer = await file.arrayBuffer();
        const dec = new TextDecoder("utf-8", { fatal: false });
        const rawText = dec.decode(buffer);

        // Extrai texto de tags <w:t> do documento Word
        const matches = rawText.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
        if (matches && matches.length > 0) {
          const textoLimpo = matches
            .map((m) => m.replace(/<\/?[^>]+(>|$)/g, ""))
            .join(" ")
            .replace(/\s+/g, " ");
          setTextoColado(textoLimpo);
          analisarTextoCompleto(textoLimpo);
        } else {
          // Fallback para strings legíveis
          const textoGeral = rawText.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ");
          setTextoColado(textoGeral);
          analisarTextoCompleto(textoGeral);
        }
      } else {
        // Arquivo de texto puro (.txt) ou fallback
        const texto = await file.text();
        setTextoColado(texto);
        analisarTextoCompleto(texto);
      }
    } catch (err: any) {
      dispararAviso(
        `Erro ao ler o arquivo "${file.name}". Você também pode copiar o texto do documento e colar na aba WhatsApp!`
      );
    } finally {
      setProcessandoArquivo(false);
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
              status: novoValor > 0 ? "manual" : "faltante",
            }
          : i
      )
    );
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
    const nomesFaltantes = itensFaltantes.map((i) => `• ${i.itemNome} (${i.quantidade} ${i.unidade})`).join("\n");
    const fornAtual = fornecedores[fornecedorIndex];
    return `Olá ${fornAtual?.vendedor || fornAtual?.nome || "Amigo"}, recebemos sua cotação para a obra ${obraNome}.\n\nPorém ficou faltando o preço dos seguintes itens:\n${nomesFaltantes}\n\nConsegue nos passar os valores desses itens para concluirmos a equalização? Obrigado!`;
  };

  const handleCopiarMensagemCobranca = () => {
    const msg = gerarMensagemCobrancaFaltantes();
    navigator.clipboard?.writeText(msg);
    dispararAviso("Mensagem de cobrança copiada! Basta dar Ctrl + V no WhatsApp do vendedor.");
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

    onAplicarPrecos(fornecedorIndex, {
      precos: precosMap,
      freteTipo,
      freteValor: freteTipo === "FOB" ? freteValor : 0,
      prazo: prazoEntrega || "A combinar",
      condicao: condicaoPagamento || "28 ddl",
      descontoValor: descontoValor || 0,
      nomeFornecedor: nomeDetectado || undefined,
    });

    dispararAviso(
      `Cotação de ${formatBRL(
        totalFinalProposta
      )} aplicada com sucesso ao Fornecedor #${fornecedorIndex + 1} (${fornecedores[fornecedorIndex]?.nome || "Fornecedor"})!`
    );
    onClose();
  };

  if (!isOpen) return null;

  const fornAlvo = fornecedores[fornecedorIndex];

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
              <h2 className="text-base font-bold truncate flex items-center gap-2">
                <span>Assistente Inteligente de Cotações</span>
                <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-500/40">
                  WhatsApp • PDF • Excel • Word
                </span>
              </h2>
              <p className="text-xs text-slate-300 truncate">
                Cole o texto do WhatsApp ou arraste o arquivo do fornecedor para preencher sem digitação manual.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white flex items-center justify-center text-sm transition cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* CORPO PRINCIPAL COM ROLAGEM */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* SELETOR DO FORNECEDOR DESTINO */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">🎯 Preencher dados para:</span>
              <select
                value={fornecedorIndex}
                onChange={(e) => setFornecedorIndex(Number(e.target.value))}
                className="bg-white border border-slate-300 font-bold text-slate-900 text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                {fornecedores.map((f, idx) => (
                  <option key={idx} value={idx}>
                    #{idx + 1} - {f.nome || `Fornecedor ${idx + 1}`} ({f.vendedor || "Sem contato"})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-600 flex items-center gap-1.5">
              <span>📍 Obra:</span>
              <strong className="text-slate-900">{obraNome}</strong>
            </div>
          </div>

          {/* ABAS DE ENTRADA: WHATSAPP VS ARQUIVO */}
          <div className="space-y-3">
            <div className="flex border-b border-slate-200 gap-2">
              <button
                type="button"
                onClick={() => setAbaAtiva("whatsapp")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  abaAtiva === "whatsapp"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>💬</span> Colar Mensagem do WhatsApp (Ctrl + V)
              </button>
              <button
                type="button"
                onClick={() => setAbaAtiva("arquivo")}
                className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                  abaAtiva === "arquivo"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>📁</span> Arrastar Arquivo (Excel .xlsx, PDF, Word .docx, TXT)
              </button>
            </div>

            {/* ABA WHATSAPP */}
            {abaAtiva === "whatsapp" && (
              <div className="space-y-2">
                <textarea
                  value={textoColado}
                  onChange={(e) => setTextoColado(e.target.value)}
                  placeholder={`Cole aqui a mensagem recebida do vendedor no WhatsApp...\n\nExemplo:\n"Segue preços da Marcondes:\nCompensado 18mm: R$ 79,50 a chapa\nSarrafo 5cm: R$ 4,50 metro\nFrete CIF incluso para quinta-feira\nCondição: 28 dias no boleto"`}
                  rows={5}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden font-mono leading-relaxed"
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    💡 Dica: Pode colar a conversa inteira, com ou sem horário. O algoritmo extrai os itens automaticamente!
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
                      onClick={() => analisarTextoCompleto(textoColado)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <span>🔍</span> Analisar Mensagem
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ABA ARQUIVO */}
            {abaAtiva === "arquivo" && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.docx,.doc,.txt,.pdf"
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
                  className="border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/20 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 bg-slate-50/50"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-2xl">
                    📥
                  </div>
                  <div>
                    <strong className="text-sm text-slate-800 block">
                      {nomeArquivo
                        ? `Arquivo selecionado: ${nomeArquivo}`
                        : "Clique ou arraste o arquivo do orçamento aqui"}
                    </strong>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      Suporta planilhas Excel (.xlsx, .xls, .csv), Documentos Word (.docx) ou Texto (.txt)
                    </span>
                  </div>

                  {processandoArquivo && (
                    <div className="text-xs text-emerald-700 font-bold animate-pulse mt-1">
                      Lendo e analisando arquivo...
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                  <span>💡</span>
                  <span>
                    <strong>Dica para orçamentos em PDF:</strong> Se o fornecedor mandou um PDF protegido ou escaneado, você também pode abrir o PDF, selecionar o texto com <code>Ctrl + A</code>, copiar e colar diretamente na aba <strong>"Colar Mensagem do WhatsApp"</strong> acima!
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ALERTA CRÍTICO DE ITENS FALTANTES (SE HOUVER) */}
          {itensFaltantes.length > 0 && itensReconhecidos.some((i) => i.precoDetectado > 0) && (
            <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-xl shrink-0">⚠️</span>
                  <div>
                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-wide">
                      Trava Anti-Furo: O fornecedor NÃO cotou {itensFaltantes.length} item(ns)!
                    </h4>
                    <p className="text-xs text-rose-800 mt-0.5">
                      Verifique os itens abaixo antes de emitir a Ordem de Compra para evitar furos no orçamento da obra:
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
                    ❌ {f.itemNome} ({f.quantidade} {f.unidade})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* TABELA DE PRÉVIA & CONFERÊNCIA DOS ITENS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>📋</span> Conferência dos Insumos Equalizados ({itensReconhecidos.length} itens)
              </h3>
              <span className="text-xs text-slate-500">
                Você pode ajustar qualquer valor diretamente nas caixinhas de preço.
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
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
                          <div>{item.itemNome}</div>
                          {item.textoOrigem && (
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-md">
                              Texto achado: "{item.textoOrigem}"
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-slate-700">
                          {item.quantidade}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-500 uppercase font-semibold">
                          {item.unidade}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.precoDetectado || ""}
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
                  placeholder="Ex: 2 a 3 dias úteis"
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
                  Desconto Adicional (R$):
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={descontoValor || ""}
                  placeholder="0,00"
                  onChange={(e) => setDescontoValor(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold text-right"
                />
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
              disabled={itensReconhecidos.every((i) => i.precoDetectado <= 0)}
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
