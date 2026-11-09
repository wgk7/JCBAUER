"use client";

import React, { useState, useMemo } from "react";
import {
  Obra,
  PacoteFinalizacao,
  StatusPacoteFinalizacao,
  CronogramaEntregaEmpreendimento,
  OrdemCompra,
} from "../../types/jcBauer";

interface PainelEntregaEmpreendimentoProps {
  obras: Obra[];
  obraFiltro: string;
  setObraFiltro: (id: string) => void;
  ordens?: OrdemCompra[];
  cronogramasSalvos: Record<string, CronogramaEntregaEmpreendimento>;
  onSalvarCronograma: (
    obraId: string,
    cronograma: CronogramaEntregaEmpreendimento
  ) => void;
  dispararAviso: (msg: string) => void;
  onImprimirCronogramaPDF?: (cronograma: CronogramaEntregaEmpreendimento) => void;
}

const CATEGORIAS_PADRAO = [
  "Pisos, Porcelanatos & Revestimentos",
  "Louças & Metais Sanitários",
  "Portas, Fechaduras & Rodapés",
  "Pintura Fina & Texturas",
  "Iluminação & Elétrica Fina",
  "Esquadrias, Vidros & Box",
  "Áreas Comuns, Paisagismo & Mobiliário",
  "Limpeza Pós-Obra & Vistoria",
  "Outros / Personalizado",
];

const PACOTES_EXEMPLO_PADRAO: Omit<PacoteFinalizacao, "id">[] = [
  {
    categoria: "Pisos, Porcelanatos & Revestimentos",
    nomeMaterial: "Porcelanato 90x90 Polido + Argamassa AC-III + Rejunte Epóxi",
    fornecedorNome: "Portobello Shop / Eliane",
    fornecedorTelefone: "(11) 98765-4321",
    numeroOc: "OC-2026-038",
    dataInicioEntrega: "2026-11-12",
    dataLimiteConclusao: "2026-11-28",
    localPavimento: "Aptos 101 ao 1202 + Áreas Molhadas",
    status: "Em Transito",
    percentualConcluido: 45,
    valorTotal: 148500,
    observacoes: "1º Lote de 600m² chega quinta-feira. 2º Lote agendado para o dia 19/11.",
  },
  {
    categoria: "Louças & Metais Sanitários",
    nomeMaterial: "Bacias Acopladas Deca + Cubas Embutir + Torneiras Monocomando",
    fornecedorNome: "Deca / Docol Distribuidora",
    fornecedorTelefone: "(11) 97654-3210",
    numeroOc: "OC-2026-041",
    dataInicioEntrega: "2026-11-18",
    dataLimiteConclusao: "2026-12-02",
    localPavimento: "Todos os banheiros e lavabos",
    status: "Programado",
    percentualConcluido: 20,
    valorTotal: 62400,
    observacoes: "Entrega unificada para descarregar direto nos andares.",
  },
  {
    categoria: "Portas, Fechaduras & Rodapés",
    nomeMaterial: "Kits de Portas Prontas Laca Branca + Fechaduras Inox + Rodapés 10cm",
    fornecedorNome: "Pormade / Sincol Portas",
    fornecedorTelefone: "(11) 99123-4567",
    numeroOc: "OC-2026-044",
    dataInicioEntrega: "2026-11-20",
    dataLimiteConclusao: "2026-12-05",
    localPavimento: "Portas internas e de entrada social",
    status: "Em Producao",
    percentualConcluido: 10,
    valorTotal: 84300,
    observacoes: "Fábrica confirmou despacho dia 17/11 via transportadora própria.",
  },
  {
    categoria: "Pintura Fina & Texturas",
    nomeMaterial: "Massa Corrida PVA + Tinta Acrílica Lavável Toque de Seda + Textura Externa",
    fornecedorNome: "Suvinil / Tintas Coral",
    fornecedorTelefone: "(11) 98877-6655",
    numeroOc: "OC-2026-047",
    dataInicioEntrega: "2026-11-15",
    dataLimiteConclusao: "2026-12-08",
    localPavimento: "Paredes internas, tetos e fachada",
    status: "Entregue",
    percentualConcluido: 70,
    valorTotal: 51200,
    observacoes: "Material 100% no canteiro. Pintores em ritmo acelerado nos andares 7 a 12.",
  },
  {
    categoria: "Iluminação & Elétrica Fina",
    nomeMaterial: "Painéis de LED Embutir 24W + Spots Dicroica + Placas e Interruptores Schneider",
    fornecedorNome: "Stella / Schneider Electric",
    fornecedorTelefone: "(11) 98111-2233",
    numeroOc: "OC-2026-050",
    dataInicioEntrega: "2026-11-22",
    dataLimiteConclusao: "2026-12-06",
    localPavimento: "Unidades privativas e circulação",
    status: "Programado",
    percentualConcluido: 0,
    valorTotal: 37900,
    observacoes: "Aguardando avanço do gesso nos últimos pavimentos para início da instalação.",
  },
  {
    categoria: "Esquadrias, Vidros & Box",
    nomeMaterial: "Box Banheiro Vidro Temperado 8mm + Espelhos Bisotados + Guarda-corpo",
    fornecedorNome: "Vidraçaria & Esquadrias Alumilux",
    fornecedorTelefone: "(11) 99555-4433",
    numeroOc: "OC-2026-053",
    dataInicioEntrega: "2026-11-26",
    dataLimiteConclusao: "2026-12-08",
    localPavimento: "Banheiros das suítes e sacadas",
    status: "Programado",
    percentualConcluido: 0,
    valorTotal: 58600,
    observacoes: "Medição fina dos vãos agendada para 20/11 após aplicação dos porcelanatos.",
  },
  {
    categoria: "Áreas Comuns, Paisagismo & Mobiliário",
    nomeMaterial: "Móveis Planejados Hall de Entrada + Plantas Ornamentais + Grama Esmeralda",
    fornecedorNome: "Paisagismo & Móveis Corporativos",
    fornecedorTelefone: "(11) 97788-9900",
    numeroOc: "OC-2026-056",
    dataInicioEntrega: "2026-12-01",
    dataLimiteConclusao: "2026-12-10",
    localPavimento: "Térreo, Hall, Salão de Festas e Jardim",
    status: "Programado",
    percentualConcluido: 0,
    valorTotal: 69500,
    observacoes: "Móveis prontos no depósito do fornecedor, aguardando liberação do piso do hall.",
  },
  {
    categoria: "Limpeza Pós-Obra & Vistoria",
    nomeMaterial: "Produtos Químicos Pós-Obra + Polimento de Vidros + Vistoria das Chaves",
    fornecedorNome: "Equipe Especializada Limpeza Fina",
    fornecedorTelefone: "(11) 99333-2211",
    numeroOc: "OC-2026-059",
    dataInicioEntrega: "2026-12-08",
    dataLimiteConclusao: "2026-12-14",
    localPavimento: "Geral da Torre e Áreas Comuns",
    status: "Programado",
    percentualConcluido: 0,
    valorTotal: 18500,
    observacoes: "Etapa final antes da vistoria dos proprietários e habite-se.",
  },
];

function formatBRL(valor: number): string {
  return (Number(valor) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatarDataBR(iso: string): string {
  if (!iso) return "A definir";
  const partes = iso.split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return iso;
}

function calcularDiferencaDias(dataIso: string): number {
  if (!dataIso) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataIso + "T00:00:00");
  const diffMs = alvo.getTime() - hoje.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function PainelEntregaEmpreendimento({
  obras,
  obraFiltro,
  setObraFiltro,
  ordens = [],
  cronogramasSalvos,
  onSalvarCronograma,
  dispararAviso,
  onImprimirCronogramaPDF,
}: PainelEntregaEmpreendimentoProps) {
  // Obra Ativa para o Painel
  const obraAtivaId = obraFiltro !== "ALL" ? obraFiltro : obras[0]?.id || "obra-1";
  const obraAtual = obras.find((o) => o.id === obraAtivaId) || obras[0];

  // Visualização ativa: Cards vs Timeline vs Tabela
  const [modoVisualizacao, setModoVisualizacao] = useState<"cards" | "timeline" | "tabela">("cards");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  // Modal de Adição / Edição de Pacote
  const [modalPacoteAberto, setModalPacoteAberto] = useState<boolean>(false);
  const [pacoteEditando, setPacoteEditando] = useState<PacoteFinalizacao | null>(null);

  // Modal de Edição da Data Oficial de Entrega
  const [modalDataEntregaAberto, setModalDataEntregaAberto] = useState<boolean>(false);
  const [novaDataEntregaChaves, setNovaDataEntregaChaves] = useState<string>("2026-12-15");

  // Cronograma da Obra Atual
  const cronogramaAtual: CronogramaEntregaEmpreendimento = useMemo(() => {
    if (cronogramasSalvos[obraAtivaId]) {
      return cronogramasSalvos[obraAtivaId];
    }
    // Cria cronograma inicial padrão se não existir
    return {
      obraId: obraAtivaId,
      obraNome: obraAtual?.nome || "Empreendimento JC Bauer",
      dataEntregaChaves: "2026-12-15",
      responsavelEngenheiro: obraAtual?.engenheiro || "Engenheiro Residente",
      observacoesGerais: "Fase final de acabamentos e preparação para vistoria de entrega das chaves.",
      pacotes: PACOTES_EXEMPLO_PADRAO.map((p, idx) => ({
        ...p,
        id: `pac-${idx + 1}-${Date.now()}`,
      })),
    };
  }, [cronogramasSalvos, obraAtivaId, obraAtual]);

  // Contagem regressiva até a data de entrega
  const diasRestantesEntrega = useMemo(() => {
    return calcularDiferencaDias(cronogramaAtual.dataEntregaChaves);
  }, [cronogramaAtual.dataEntregaChaves]);

  // Métricas do Painel
  const metricas = useMemo(() => {
    const pacotes = cronogramaAtual.pacotes || [];
    const total = pacotes.length;
    if (total === 0) {
      return { total: 0, entregues: 0, emTransito: 0, atrasados: 0, percentualGeral: 0, valorTotal: 0 };
    }

    const entregues = pacotes.filter((p) => p.status === "Entregue" || p.status === "Instalado").length;
    const emTransito = pacotes.filter((p) => p.status === "Em Transito").length;
    const atrasados = pacotes.filter(
      (p) => p.status === "Atrasado" || (calcularDiferencaDias(p.dataLimiteConclusao) < 0 && p.status !== "Instalado")
    ).length;

    const somaPerc = pacotes.reduce((acc, p) => acc + (Number(p.percentualConcluido) || 0), 0);
    const percentualGeral = Math.round(somaPerc / total);
    const valorTotal = pacotes.reduce((acc, p) => acc + (Number(p.valorTotal) || 0), 0);

    return { total, entregues, emTransito, atrasados, percentualGeral, valorTotal };
  }, [cronogramaAtual.pacotes]);

  // Pacotes filtrados por status
  const pacotesFiltrados = useMemo(() => {
    const list = cronogramaAtual.pacotes || [];
    if (filtroStatus === "TODOS") return list;
    if (filtroStatus === "ATRASADOS") {
      return list.filter(
        (p) => p.status === "Atrasado" || (calcularDiferencaDias(p.dataLimiteConclusao) < 0 && p.status !== "Instalado")
      );
    }
    return list.filter((p) => p.status === filtroStatus);
  }, [cronogramaAtual.pacotes, filtroStatus]);

  // Ações de Atualização
  const handleAtualizarStatusPacote = (pacoteId: string, novoStatus: StatusPacoteFinalizacao) => {
    const novosPacotes = cronogramaAtual.pacotes.map((p) => {
      if (p.id !== pacoteId) return p;
      let novoPerc = p.percentualConcluido;
      if (novoStatus === "Instalado") novoPerc = 100;
      else if (novoStatus === "Entregue" && novoPerc < 50) novoPerc = 50;
      return { ...p, status: novoStatus, percentualConcluido: novoPerc };
    });

    onSalvarCronograma(obraAtivaId, { ...cronogramaAtual, pacotes: novosPacotes });
    dispararAviso(`Status do pacote atualizado para "${novoStatus}"!`);
  };

  const handleSalvarDataOficialEntrega = () => {
    onSalvarCronograma(obraAtivaId, {
      ...cronogramaAtual,
      dataEntregaChaves: novaDataEntregaChaves,
    });
    setModalDataEntregaAberto(false);
    dispararAviso(`Data oficial de entrega da obra atualizada para ${formatarDataBR(novaDataEntregaChaves)}!`);
  };

  const handleSalvarPacote = (pacote: PacoteFinalizacao) => {
    const existe = cronogramaAtual.pacotes.some((p) => p.id === pacote.id);
    let novosPacotes: PacoteFinalizacao[];
    if (existe) {
      novosPacotes = cronogramaAtual.pacotes.map((p) => (p.id === pacote.id ? pacote : p));
      dispararAviso(`Pacote "${pacote.nomeMaterial}" atualizado com sucesso!`);
    } else {
      novosPacotes = [...cronogramaAtual.pacotes, pacote];
      dispararAviso(`Novo pacote de acabamento cadastrado!`);
    }

    onSalvarCronograma(obraAtivaId, { ...cronogramaAtual, pacotes: novosPacotes });
    setModalPacoteAberto(false);
    setPacoteEditando(null);
  };

  const handleExcluirPacote = (pacoteId: string) => {
    if (!window.confirm("Deseja realmente remover este pacote do cronograma de finalização?")) return;
    const novosPacotes = cronogramaAtual.pacotes.filter((p) => p.id !== pacoteId);
    onSalvarCronograma(obraAtivaId, { ...cronogramaAtual, pacotes: novosPacotes });
    dispararAviso("Pacote removido do cronograma.");
  };

  const handleCarregarPacotesPadrao = () => {
    if (
      !window.confirm(
        "Deseja resetar e carregar a lista com os 8 pacotes essenciais de acabamento e finalização da JC Bauer?"
      )
    ) {
      return;
    }
    const novos = PACOTES_EXEMPLO_PADRAO.map((p, idx) => ({
      ...p,
      id: `pac-${idx + 1}-${Date.now()}`,
    }));
    onSalvarCronograma(obraAtivaId, { ...cronogramaAtual, pacotes: novos });
    dispararAviso("Pacotes essenciais de acabamento carregados com sucesso!");
  };

  const handleAbrirWhatsAppFornecedor = (pacote: PacoteFinalizacao) => {
    const tel = (pacote.fornecedorTelefone || "").replace(/\D/g, "");
    const msg = `Olá ${pacote.fornecedorNome}, tudo bem? Aqui é da JC Bauer Empreendimentos.\n\nEstamos organizando o cronograma de finalização e entrega das chaves da obra ${cronogramaAtual.obraNome} (Entrega oficial: ${formatarDataBR(cronogramaAtual.dataEntregaChaves)}).\n\nGostaria de confirmar a data de chegada do material:\n• ${pacote.nomeMaterial}\n• Início previsto: ${formatarDataBR(pacote.dataInicioEntrega)}\n• Data limite para término: ${formatarDataBR(pacote.dataLimiteConclusao)}\n\nPoderia nos confirmar o status do envio? Obrigado!`;

    const url = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* ===================================================================== */}
      {/* CABEÇALHO DO PAINEL DE ENTREGA & CONTAGEM REGRESSIVA                  */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center text-2xl shrink-0">
              🏁
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Painel de Entrega do Empreendimento & Acabamentos
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                  Fase de Entrega
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Controle cirúrgico das datas de chegada de materiais de finalização para garantir a entrega das chaves no prazo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Seletor da Obra */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-xs font-bold text-slate-600">Obra:</span>
              <select
                value={obraAtivaId}
                onChange={(e) => setObraFiltro(e.target.value)}
                className="bg-transparent font-bold text-xs text-slate-900 focus:outline-hidden cursor-pointer"
              >
                {obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setPacoteEditando(null);
                setModalPacoteAberto(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <span>+</span> Novo Pacote de Acabamento
            </button>

            <button
              type="button"
              onClick={() => {
                if (onImprimirCronogramaPDF) {
                  onImprimirCronogramaPDF(cronogramaAtual);
                } else {
                  window.print();
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Gerar PDF para diretoria"
            >
              <span>🖨️</span> Imprimir Relatório (A4)
            </button>
          </div>
        </div>

        {/* CARDS KPI DE DESTAQUE: CONTAGEM REGRESSIVA + TERMÔMETRO + DIRETORIA */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* CARD 1: CONTAGEM REGRESSIVA OFICIAL */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Data de Entrega das Chaves
                </span>
                <div className="text-xl font-black text-white mt-1">
                  {formatarDataBR(cronogramaAtual.dataEntregaChaves)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNovaDataEntregaChaves(cronogramaAtual.dataEntregaChaves);
                  setModalDataEntregaAberto(true);
                }}
                className="text-[10px] text-slate-400 hover:text-amber-400 font-bold underline"
              >
                Alterar Data
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Prazo Regressivo:</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  diasRestantesEntrega > 30
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : diasRestantesEntrega > 10
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-bounce"
                }`}
              >
                ⏳ Faltam {diasRestantesEntrega} dias
              </span>
            </div>
          </div>

          {/* CARD 2: TERMÔMETRO DE ACABAMENTOS CONCLUÍDOS */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Avanço de Finalização
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">
                  {metricas.percentualGeral}%
                </span>
                <span className="text-xs text-slate-500 font-medium">concluído</span>
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metricas.percentualGeral}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{metricas.entregues} de {metricas.total} pacotes entregues</span>
                <span>Meta: 100%</span>
              </div>
            </div>
          </div>

          {/* CARD 3: EM TRÂNSITO / CHEGANDO ESTA SEMANA */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Materiais em Trânsito / Chegando
              </span>
              <div className="text-2xl font-black text-blue-700 mt-1">
                {metricas.emTransito} <span className="text-xs text-slate-500 font-normal">pacote(s)</span>
              </div>
            </div>
            <div className="text-xs text-slate-600 mt-2">
              🚚 Cargas com chegada prevista nos próximos dias no canteiro.
            </div>
          </div>

          {/* CARD 4: ALERTAS DE ATRASO / RISCO NA ENTREGA */}
          <div
            className={`rounded-xl p-4 flex flex-col justify-between border ${
              metricas.atrasados > 0
                ? "bg-rose-50 border-rose-300 ring-1 ring-rose-200"
                : "bg-emerald-50 border-emerald-300"
            }`}
          >
            <div>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  metricas.atrasados > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                Risco no Prazo das Chaves
              </span>
              <div
                className={`text-2xl font-black mt-1 ${
                  metricas.atrasados > 0 ? "text-rose-900" : "text-emerald-900"
                }`}
              >
                {metricas.atrasados > 0 ? `⚠️ ${metricas.atrasados} Pacote(s)` : "✅ Zero Atrasos"}
              </div>
            </div>
            <div
              className={`text-xs mt-2 ${
                metricas.atrasados > 0 ? "text-rose-800 font-medium" : "text-emerald-800"
              }`}
            >
              {metricas.atrasados > 0
                ? "Itens com data limite vencida ou após a entrega das chaves!"
                : "Todas as datas casadas perfeitamente com a entrega oficial."}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BARRA DE FILTROS & MODOS DE VISUALIZAÇÃO                             */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Alternador de Modo de Visão */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setModoVisualizacao("cards")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              modoVisualizacao === "cards"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📋 Cards por Disciplina
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("timeline")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              modoVisualizacao === "timeline"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📅 Linha do Tempo (Gantt Semanal)
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("tabela")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              modoVisualizacao === "tabela"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📊 Tabela Resumo
          </button>
        </div>

        {/* Filtro por Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filtrar:</span>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-800 cursor-pointer"
          >
            <option value="TODOS">Todos os Pacotes ({cronogramaAtual.pacotes.length})</option>
            <option value="Programado">Programados</option>
            <option value="Em Transito">Em Trânsito / Chegando</option>
            <option value="Entregue">Entregues no Canteiro</option>
            <option value="Instalado">100% Instalados</option>
            <option value="ATRASADOS">⚠️ Com Risco / Atrasados</option>
          </select>

          {cronogramaAtual.pacotes.length === 0 && (
            <button
              type="button"
              onClick={handleCarregarPacotesPadrao}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
            >
              ⚡ Carregar 8 Pacotes Padrão
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODO 1: CARDS POR DISCIPLINA / PACOTE                                 */}
      {/* ===================================================================== */}
      {modoVisualizacao === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {pacotesFiltrados.map((pacote) => {
            const diasAteInicio = calcularDiferencaDias(pacote.dataInicioEntrega);
            const diasAteLimite = calcularDiferencaDias(pacote.dataLimiteConclusao);
            const atrasado = diasAteLimite < 0 && pacote.status !== "Instalado";

            // Cores do Card
            const corBorda =
              pacote.status === "Instalado"
                ? "border-emerald-300 bg-emerald-50/20"
                : pacote.status === "Entregue"
                ? "border-teal-300 bg-teal-50/20"
                : pacote.status === "Em Transito"
                ? "border-blue-300 bg-blue-50/20"
                : atrasado
                ? "border-rose-300 bg-rose-50/30 ring-1 ring-rose-200"
                : "border-slate-200 bg-white";

            return (
              <div
                key={pacote.id}
                className={`rounded-2xl border p-4 shadow-xs flex flex-col justify-between space-y-4 transition ${corBorda}`}
              >
                <div className="space-y-3">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 truncate">
                      {pacote.categoria}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPacoteEditando(pacote);
                        setModalPacoteAberto(true);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-800 font-bold"
                      title="Editar pacote"
                    >
                      ✏️
                    </button>
                  </div>

                  {/* Nome do Material */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {pacote.nomeMaterial}
                    </h3>
                    <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                      <span className="truncate">🏢 {pacote.fornecedorNome}</span>
                      {pacote.numeroOc && (
                        <span className="font-mono text-[10px] text-slate-600">{pacote.numeroOc}</span>
                      )}
                    </div>
                  </div>

                  {/* DATAS DE CHEGADA E CONCLUSÃO */}
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Início das Entregas:</span>
                      <strong className="text-slate-900 font-bold">
                        {formatarDataBR(pacote.dataInicioEntrega)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Limite Instalação:</span>
                      <strong
                        className={`font-bold ${
                          atrasado ? "text-rose-700" : "text-slate-900"
                        }`}
                      >
                        {formatarDataBR(pacote.dataLimiteConclusao)}
                      </strong>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Previsão:</span>
                      {pacote.status === "Instalado" ? (
                        <span className="font-extrabold text-emerald-700">✓ Concluído</span>
                      ) : atrasado ? (
                        <span className="font-extrabold text-rose-700">Atrasado há {Math.abs(diasAteLimite)} dias!</span>
                      ) : diasAteInicio <= 0 ? (
                        <span className="font-extrabold text-blue-700">Chegando no Canteiro!</span>
                      ) : (
                        <span className="font-bold text-slate-600">Chega em {diasAteInicio} dias</span>
                      )}
                    </div>
                  </div>

                  {/* BARRA DE PROGRESSO DO PACOTE */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Avanço Físico:</span>
                      <strong className="text-slate-800 font-bold">{pacote.percentualConcluido}%</strong>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${pacote.percentualConcluido}%` }}
                      />
                    </div>
                  </div>

                  {pacote.localPavimento && (
                    <div className="text-[11px] text-slate-500 truncate" title={pacote.localPavimento}>
                      📍 {pacote.localPavimento}
                    </div>
                  )}
                </div>

                {/* RODAPÉ DO CARD: SELETOR DE STATUS + BOTÃO WHATSAPP */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5">
                  <select
                    value={pacote.status}
                    onChange={(e) =>
                      handleAtualizarStatusPacote(pacote.id, e.target.value as StatusPacoteFinalizacao)
                    }
                    className="flex-1 bg-white border border-slate-300 text-[11px] font-bold rounded-lg px-2 py-1 text-slate-800 focus:outline-hidden"
                  >
                    <option value="Programado">🔵 Programado</option>
                    <option value="Em Producao">🟡 Em Produção</option>
                    <option value="Em Transito">🚚 Em Trânsito</option>
                    <option value="Entregue">🟢 Entregue Obra</option>
                    <option value="Instalado">✅ Instalado</option>
                    <option value="Atrasado">🔴 Atrasado</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleAbrirWhatsAppFornecedor(pacote)}
                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition cursor-pointer shrink-0"
                    title="Cobrar ou alinhar prazo no WhatsApp do fornecedor"
                  >
                    📲
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExcluirPacote(pacote.id)}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 text-xs transition cursor-pointer shrink-0"
                    title="Remover pacote"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODO 2: LINHA DO TEMPO VISUAL (GANTT SEMANAL DE ENTREGA)             */}
      {/* ===================================================================== */}
      {modoVisualizacao === "timeline" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Linha do Tempo das Chegadas até a Entrega das Chaves
              </h3>
              <p className="text-xs text-slate-500">
                Visão sequencial semanal de quando cada caminhão/material encosta no canteiro.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Chegada / Descarga
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Instalação
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Data das Chaves
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {pacotesFiltrados.map((p) => {
              const dInicio = formatarDataBR(p.dataInicioEntrega);
              const dLimite = formatarDataBR(p.dataLimiteConclusao);
              const diasFaltam = calcularDiferencaDias(p.dataInicioEntrega);

              return (
                <div key={p.id} className="border border-slate-200 rounded-xl p-3 hover:bg-slate-50/80 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{p.nomeMaterial}</span>
                      <span className="text-[10px] text-slate-500">({p.fornecedorNome})</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">Chegada: <strong>{dInicio}</strong></span>
                      <span className="text-slate-400">➔</span>
                      <span className="text-slate-500">Término: <strong>{dLimite}</strong></span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          p.status === "Instalado"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "Entregue"
                            ? "bg-teal-100 text-teal-800"
                            : diasFaltam < 0
                            ? "bg-rose-100 text-rose-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>

                  {/* Linha visual de barra */}
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full transition-all ${
                        p.status === "Instalado"
                          ? "bg-emerald-500"
                          : p.status === "Entregue"
                          ? "bg-teal-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.max(p.percentualConcluido, 20)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODO 3: TABELA RESUMO EXECUTIVA                                      */}
      {/* ===================================================================== */}
      {modoVisualizacao === "tabela" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Disciplina / Pacote</th>
                <th className="py-3 px-4">Material de Finalização</th>
                <th className="py-3 px-4">Fornecedor / OC</th>
                <th className="py-3 px-3 text-center">Início Chegada</th>
                <th className="py-3 px-3 text-center">Limite Término</th>
                <th className="py-3 px-3 text-center">Avanço</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Valor (R$)</th>
                <th className="py-3 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pacotesFiltrados.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="py-2.5 px-4 font-bold text-slate-800">{p.categoria}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{p.nomeMaterial}</td>
                  <td className="py-2.5 px-4 text-slate-600">
                    <div>{p.fornecedorNome}</div>
                    <span className="font-mono text-[10px] text-slate-400">{p.numeroOc || "—"}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-blue-700">
                    {formatarDataBR(p.dataInicioEntrega)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                    {formatarDataBR(p.dataLimiteConclusao)}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">{p.percentualConcluido}%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        p.status === "Instalado"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.status === "Entregue"
                          ? "bg-teal-100 text-teal-800"
                          : p.status === "Atrasado"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums">
                    {formatBRL(p.valorTotal || 0)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAbrirWhatsAppFornecedor(p)}
                        className="p-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold"
                        title="WhatsApp"
                      >
                        📲
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPacoteEditando(p);
                          setModalPacoteAberto(true);
                        }}
                        className="p-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold"
                        title="Editar"
                      >
                        ✏️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: CADASTRAR OU EDITAR PACOTE DE ACABAMENTO                       */}
      {/* ===================================================================== */}
      {modalPacoteAberto && (
        <ModalFormularioPacote
          isOpen={modalPacoteAberto}
          pacoteInicial={pacoteEditando}
          onClose={() => {
            setModalPacoteAberto(false);
            setPacoteEditando(null);
          }}
          onSalvar={handleSalvarPacote}
          ordens={ordens}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL: ALTERAR DATA OFICIAL DE ENTREGA DAS CHAVES                    */}
      {/* ===================================================================== */}
      {modalDataEntregaAberto && (
        <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Data Oficial de Entrega do Empreendimento
              </h3>
              <button
                type="button"
                onClick={() => setModalDataEntregaAberto(false)}
                className="text-slate-400 hover:text-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Data Prevista das Chaves / Vistoria:
              </label>
              <input
                type="date"
                value={novaDataEntregaChaves}
                onChange={(e) => setNovaDataEntregaChaves(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-bold text-slate-900"
              />
              <p className="text-xs text-slate-500">
                Esta data atualiza a contagem regressiva e serve de marco final para todos os materiais de acabamento.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalDataEntregaAberto(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarDataOficialEntrega}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                Salvar Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponente Formulário de Cadastro / Edição
function ModalFormularioPacote({
  isOpen,
  pacoteInicial,
  onClose,
  onSalvar,
  ordens = [],
}: {
  isOpen: boolean;
  pacoteInicial: PacoteFinalizacao | null;
  onClose: () => void;
  onSalvar: (pacote: PacoteFinalizacao) => void;
  ordens?: OrdemCompra[];
}) {
  const [categoria, setCategoria] = useState<string>(
    pacoteInicial?.categoria || "Pisos, Porcelanatos & Revestimentos"
  );
  const [nomeMaterial, setNomeMaterial] = useState<string>(pacoteInicial?.nomeMaterial || "");
  const [fornecedorNome, setFornecedorNome] = useState<string>(pacoteInicial?.fornecedorNome || "");
  const [fornecedorTelefone, setFornecedorTelefone] = useState<string>(
    pacoteInicial?.fornecedorTelefone || ""
  );
  const [numeroOc, setNumeroOc] = useState<string>(pacoteInicial?.numeroOc || "");
  const [dataInicioEntrega, setDataInicioEntrega] = useState<string>(
    pacoteInicial?.dataInicioEntrega || new Date().toISOString().split("T")[0]
  );
  const [dataLimiteConclusao, setDataLimiteConclusao] = useState<string>(
    pacoteInicial?.dataLimiteConclusao || "2026-12-10"
  );
  const [localPavimento, setLocalPavimento] = useState<string>(pacoteInicial?.localPavimento || "");
  const [status, setStatus] = useState<StatusPacoteFinalizacao>(pacoteInicial?.status || "Programado");
  const [percentualConcluido, setPercentualConcluido] = useState<number>(
    pacoteInicial?.percentualConcluido || 0
  );
  const [valorTotal, setValorTotal] = useState<number>(pacoteInicial?.valorTotal || 0);
  const [observacoes, setObservacoes] = useState<string>(pacoteInicial?.observacoes || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeMaterial.trim()) return;

    onSalvar({
      id: pacoteInicial?.id || `pac-${Date.now()}`,
      categoria,
      nomeMaterial: nomeMaterial.trim(),
      fornecedorNome: fornecedorNome.trim() || "A Definir",
      fornecedorTelefone: fornecedorTelefone.trim(),
      numeroOc: numeroOc.trim(),
      dataInicioEntrega,
      dataLimiteConclusao,
      localPavimento: localPavimento.trim(),
      status,
      percentualConcluido: Number(percentualConcluido) || 0,
      valorTotal: Number(valorTotal) || 0,
      observacoes: observacoes.trim(),
    });
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <h3 className="text-base font-bold">
            {pacoteInicial ? "Editar Pacote de Acabamento" : "Novo Pacote de Acabamento / Finalização"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Disciplina / Categoria:</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-semibold text-slate-900"
              >
                {CATEGORIAS_PADRAO.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status Atual:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusPacoteFinalizacao)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
              >
                <option value="Programado">🔵 Programado</option>
                <option value="Em Producao">🟡 Em Produção</option>
                <option value="Em Transito">🚚 Em Trânsito</option>
                <option value="Entregue">🟢 Entregue no Canteiro</option>
                <option value="Instalado">✅ 100% Instalado</option>
                <option value="Atrasado">🔴 Atrasado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Material de Finalização / Descrição Detalhada: *
            </label>
            <input
              required
              type="text"
              value={nomeMaterial}
              onChange={(e) => setNomeMaterial(e.target.value)}
              placeholder="Ex: Porcelanato 90x90 Polido + Argamassa AC-III"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Fornecedor:</label>
              <input
                type="text"
                value={fornecedorNome}
                onChange={(e) => setFornecedorNome(e.target.value)}
                placeholder="Ex: Portobello / Deca"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">WhatsApp / Telefone:</label>
              <input
                type="text"
                value={fornecedorTelefone}
                onChange={(e) => setFornecedorTelefone(e.target.value)}
                placeholder="(11) 9...."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nº Ordem de Compra:</label>
              <input
                type="text"
                value={numeroOc}
                onChange={(e) => setNumeroOc(e.target.value)}
                placeholder="Ex: OC-2026-038"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
              />
            </div>
          </div>

          {/* DATAS DE CHEGADA E CONCLUSÃO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block font-bold text-blue-900 mb-1">
                📅 Início das Entregas no Canteiro: *
              </label>
              <input
                required
                type="date"
                value={dataInicioEntrega}
                onChange={(e) => setDataInicioEntrega(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
              />
              <span className="text-[10px] text-slate-500">Quando a primeira carga chega na obra.</span>
            </div>
            <div>
              <label className="block font-bold text-slate-900 mb-1">
                🏁 Data Limite para Conclusão / Instalação: *
              </label>
              <input
                required
                type="date"
                value={dataLimiteConclusao}
                onChange={(e) => setDataLimiteConclusao(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 font-bold text-slate-900"
              />
              <span className="text-[10px] text-slate-500">Prazo final para tudo estar pronto e testado.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Locais / Pavimentos:</label>
              <input
                type="text"
                value={localPavimento}
                onChange={(e) => setLocalPavimento(e.target.value)}
                placeholder="Ex: Aptos 101 a 1202"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Avanço Físico (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={percentualConcluido}
                onChange={(e) => setPercentualConcluido(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Valor Contratado (R$):</label>
              <input
                type="number"
                step="100"
                value={valorTotal || ""}
                onChange={(e) => setValorTotal(parseFloat(e.target.value) || 0)}
                placeholder="R$ 0,00"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Observações de Entrega / Riscos:</label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Fornecedor confirmou entrega por caminhão toco. Descarregamento direto no elevador de carga."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-xs"
            >
              Salvar Pacote
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
