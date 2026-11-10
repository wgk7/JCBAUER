"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Obra,
  PacoteFinalizacao,
  StatusPacoteFinalizacao,
  CronogramaEntregaEmpreendimento,
  OrdemCompra,
  DadosNotificacaoCargaWhatsApp,
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
  onNotificarCargaWhatsApp?: (dados: DadosNotificacaoCargaWhatsApp) => void;
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

// Trava rigorosa: detecta e expurga qualquer item de demonstração
const isDemoPacote = (p: PacoteFinalizacao): boolean => {
  const demoOcs = [
    "OC-2026-038",
    "OC-2026-041",
    "OC-2026-044",
    "OC-2026-047",
    "OC-2026-050",
    "OC-2026-053",
    "OC-2026-056",
    "OC-2026-059",
  ];
  const demoForns = [
    "Portobello Shop / Eliane",
    "Deca / Docol Distribuidora",
    "Pormade / Sincol Portas",
    "Suvinil / Tintas Coral",
    "Stella / Schneider Electric",
    "Vidraçaria & Esquadrias Alumilux",
    "Paisagismo & Móveis Corporativos",
    "Equipe Especializada Limpeza Fina",
  ];
  return (
    demoOcs.includes(p.numeroOc || "") ||
    demoForns.includes(p.fornecedorNome || "") ||
    (p.id?.startsWith("pac-") && Boolean(p.observacoes?.includes("1º Lote de 600m²")))
  );
};

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
  onNotificarCargaWhatsApp,
}: PainelEntregaEmpreendimentoProps) {
  // Obra Ativa para o Painel
  const obraAtivaId = obraFiltro !== "ALL" ? obraFiltro : obras[0]?.id || "";
  const obraAtual = obras.find((o) => o.id === obraAtivaId) || obras[0];

  // Visualização ativa: Cards vs Timeline vs Tabela
  const [modoVisualizacao, setModoVisualizacao] = useState<"cards" | "timeline" | "tabela">("cards");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  // Modais
  const [modalPacoteAberto, setModalPacoteAberto] = useState<boolean>(false);
  const [pacoteEditando, setPacoteEditando] = useState<PacoteFinalizacao | null>(null);
  const [modalDataEntregaAberto, setModalDataEntregaAberto] = useState<boolean>(false);
  const [novaDataEntregaChaves, setNovaDataEntregaChaves] = useState<string>("");
  const [modalImportarOcsAberto, setModalImportarOcsAberto] = useState<boolean>(false);

  // Ordens de Compra Reais desta Obra
  const ordensDestaObra = useMemo(() => {
    return ordens.filter(
      (o) => (o.obraId === obraAtivaId || obraAtivaId === "ALL") && o.status !== "Cancelada"
    );
  }, [ordens, obraAtivaId]);

  // Cronograma da Obra Atual - 100% LIMPO E REAL, ZERO DADOS DEMO
  const cronogramaAtual: CronogramaEntregaEmpreendimento = useMemo(() => {
    if (cronogramasSalvos[obraAtivaId]) {
      const salvo = cronogramasSalvos[obraAtivaId];
      const pacotesLimpos = (salvo.pacotes || []).filter((p) => !isDemoPacote(p));
      return {
        ...salvo,
        pacotes: pacotesLimpos,
      };
    }
    return {
      obraId: obraAtivaId,
      obraNome: obraAtual?.nome || "Empreendimento JC Bauer",
      dataEntregaChaves: obraAtual?.dataFim || "",
      responsavelEngenheiro: obraAtual?.engenheiro || "",
      observacoesGerais: "",
      pacotes: [],
    };
  }, [cronogramasSalvos, obraAtivaId, obraAtual]);

  // Purga dados demo do storage caso existissem
  useEffect(() => {
    if (cronogramasSalvos[obraAtivaId]) {
      const salvo = cronogramasSalvos[obraAtivaId];
      const pacotesLimpos = (salvo.pacotes || []).filter((p) => !isDemoPacote(p));
      if (pacotesLimpos.length !== (salvo.pacotes || []).length) {
        onSalvarCronograma(obraAtivaId, { ...salvo, pacotes: pacotesLimpos });
      }
    }
  }, [cronogramasSalvos, obraAtivaId, onSalvarCronograma]);

  // Contagem regressiva até a data de entrega
  const diasRestantesEntrega = useMemo(() => {
    if (!cronogramaAtual.dataEntregaChaves) return null;
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

  // Handlers
  const handleSalvarPacote = (pacote: PacoteFinalizacao) => {
    const pacotesAtuais = cronogramaAtual.pacotes || [];
    const index = pacotesAtuais.findIndex((p) => p.id === pacote.id);
    let novosPacotes: PacoteFinalizacao[];

    if (index >= 0) {
      novosPacotes = [...pacotesAtuais];
      novosPacotes[index] = pacote;
    } else {
      novosPacotes = [...pacotesAtuais, pacote];
    }

    onSalvarCronograma(obraAtivaId, { ...cronogramaAtual, pacotes: novosPacotes });
    setModalPacoteAberto(false);
    setPacoteEditando(null);
    dispararAviso(`Pacote "${pacote.nomeMaterial}" salvo com sucesso!`);
  };

  const handleMudarStatusPacote = (
    pacoteId: string,
    novoStatus: StatusPacoteFinalizacao
  ) => {
    const novosPacotes = cronogramaAtual.pacotes.map((p) => {
      if (p.id !== pacoteId) return p;
      let novoPerc = p.percentualConcluido;
      if (novoStatus === "Instalado") novoPerc = 100;
      else if (novoStatus === "Entregue" && novoPerc < 50) novoPerc = 50;
      else if (novoStatus === "Programado" && novoPerc > 0) novoPerc = 0;

      return {
        ...p,
        status: novoStatus,
        percentualConcluido: novoPerc,
      };
    });

    onSalvarCronograma(obraAtivaId, { ...cronogramaAtual, pacotes: novosPacotes });
    dispararAviso("Status do pacote atualizado!");
  };

  const handleSalvarDataEntrega = () => {
    if (!novaDataEntregaChaves) {
      dispararAviso("Selecione uma data válida.");
      return;
    }
    onSalvarCronograma(obraAtivaId, {
      ...cronogramaAtual,
      dataEntregaChaves: novaDataEntregaChaves,
    });
    setModalDataEntregaAberto(false);
    dispararAviso("Data oficial de entrega das chaves atualizada!");
  };

  const handleExcluirPacote = (pacoteId: string) => {
    if (!window.confirm("Deseja realmente remover este pacote do cronograma de finalização?")) return;
    const novosPacotes = cronogramaAtual.pacotes.filter((p) => p.id !== pacoteId);
    onSalvarCronograma(obraAtivaId, { ...cronogramaAtual, pacotes: novosPacotes });
    dispararAviso("Pacote removido do cronograma.");
  };

  const gerarRelatorioHtmlLocal = (cron: CronogramaEntregaEmpreendimento) => {
    const hojeStr = new Date().toLocaleDateString("pt-BR");
    const horaStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const pacotes = cron.pacotes || [];
    const total = pacotes.length;
    const entregues = pacotes.filter((p) => p.status === "Entregue" || p.status === "Instalado").length;
    const emTransito = pacotes.filter((p) => p.status === "Em Transito").length;
    const somaPerc = pacotes.reduce((acc, p) => acc + (Number(p.percentualConcluido) || 0), 0);
    const percGeral = total > 0 ? Math.round(somaPerc / total) : 0;
    const valorTotal = pacotes.reduce((acc, p) => acc + (Number(p.valorTotal) || 0), 0);

    let diasRestantesStr = "Data não definida";
    let diasNum = 0;
    if (cron.dataEntregaChaves) {
      diasNum = calcularDiferencaDias(cron.dataEntregaChaves);
      diasRestantesStr = diasNum >= 0 ? `Faltam ${diasNum} dias para as Chaves` : `Prazo expirou há ${Math.abs(diasNum)} dias`;
    }

    const logoUrl = typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>JC BAUER - Cronograma de Entrega do Empreendimento & Acabamentos</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { margin: 0; padding: 12px; background: #f8fafc; color: #0f172a; font-size: 11px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { position: sticky; top: 0; background: #0f172a; color: #fff; padding: 10px 16px; border-radius: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; border-bottom: 2px solid #059669; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
    .logo-container { display: flex; align-items: center; gap: 12px; }
    .logo-img { height: 48px; width: auto; object-fit: contain; }
    .logo-title { font-size: 17px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; text-transform: uppercase; }
    .sub-title { font-size: 11px; color: #059669; font-weight: 800; text-transform: uppercase; margin-top: 1px; }
    .badge-fase { background: #0f172a; color: #fbbf24; border: 1px solid #d97706; padding: 5px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; text-align: right; }
    
    .meta-grid { display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr; gap: 10px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; }
    .meta-item { font-size: 11px; }
    .meta-item strong { color: #0f172a; }
    .meta-item span { color: #475569; display: block; font-size: 10px; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
    .kpi-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; }
    .kpi-label { font-size: 9.5px; font-weight: 800; color: #64748b; text-transform: uppercase; }
    .kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px; }
    .kpi-sub { font-size: 10px; color: #475569; margin-top: 2px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; background: #ffffff; }
    th { background: #0f172a; color: #ffffff; padding: 6px 8px; text-align: left; font-size: 9.5px; text-transform: uppercase; border: 1px solid #0f172a; }
    td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; vertical-align: middle; }
    tr:nth-child(even) { background: #f8fafc; }

    .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .status-instalado { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .status-entregue { background: #ccfbf1; color: #115e59; border: 1px solid #5eead4; }
    .status-transito { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
    .status-producao { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
    .status-programado { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    .status-atrasado { background: #ffe4e6; color: #9f1239; border: 1px solid #fda4af; }

    .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 20px; }
    .sig-line { border-top: 1px solid #0f172a; text-align: center; padding-top: 4px; font-size: 9.5px; font-weight: 700; color: #0f172a; }
    .footer { margin-top: 15px; border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #64748b; }

    @media print {
      .no-print { display: none !important; }
      body { padding: 0; background: #ffffff !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div><strong>JC BAUER • Cronograma de Entrega do Empreendimento & Acabamentos</strong> (A4 Paisagem)</div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" style="background: #059669; color: #fff; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 800; cursor: pointer;">🖨️ Imprimir / Salvar PDF</button>
      <button onclick="window.close()" style="background: #334155; color: #fff; border: 1px solid #64748b; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">Fechar</button>
    </div>
  </div>

  <div class="header">
    <div class="logo-container">
      <img src="${logoUrl}" alt="JC Bauer" class="logo-img" onerror="this.style.display='none'" />
      <div>
        <div class="logo-title">JC BAUER EMPREENDIMENTOS</div>
        <div class="sub-title">Cronograma Oficial de Materiais de Finalização & Entrega das Chaves</div>
      </div>
    </div>
    <div class="badge-fase">
      <div>FASE FINAL DE ACABAMENTOS</div>
      <div style="color: #ffffff; font-size: 9px; margin-top: 2px;">Relatório de Diretoria & Canteiro</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span>Empreendimento / Obra:</span>
      <strong>${cron.obraNome}</strong>
    </div>
    <div class="meta-item">
      <span>Engenheiro Responsável:</span>
      <strong>${cron.responsavelEngenheiro || "Engenharia JC Bauer"}</strong>
    </div>
    <div class="meta-item">
      <span>Data Entrega das Chaves:</span>
      <strong style="color: #0369a1;">${formatarDataBR(cron.dataEntregaChaves)}</strong>
      <div style="font-size: 9px; color: ${diasNum >= 0 ? "#059669" : "#dc2626"}; font-weight: 800;">
        ${diasRestantesStr}
      </div>
    </div>
    <div class="meta-item">
      <span>Emissão do Relatório:</span>
      <strong>${hojeStr}</strong> às ${horaStr}
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Avanço Físico Geral</div>
      <div class="kpi-val" style="color: #059669;">${percGeral}%</div>
      <div class="kpi-sub">${entregues} de ${total} pacotes entregues/instalados</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Materiais em Trânsito</div>
      <div class="kpi-val" style="color: #0284c7;">${emTransito} cargas</div>
      <div class="kpi-sub">A caminho do canteiro</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total de Pacotes</div>
      <div class="kpi-val">${total} frentes</div>
      <div class="kpi-sub">Mapeadas para finalização</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Comprometido Acabamentos</div>
      <div class="kpi-val" style="font-size: 15px;">${formatBRL(valorTotal)}</div>
      <div class="kpi-sub">Total investido na fase</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Disciplina / Categoria</th>
        <th style="width: 25%;">Material de Finalização</th>
        <th style="width: 18%;">Fornecedor & Nº OC</th>
        <th style="width: 10%; text-align: center;">Início Chegada</th>
        <th style="width: 10%; text-align: center;">Limite Instalação</th>
        <th style="width: 9%; text-align: center;">Status</th>
        <th style="width: 10%; text-align: right;">Valor Contratado</th>
      </tr>
    </thead>
    <tbody>
      ${pacotes.length === 0 ? `
        <tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">Nenhum pacote de acabamento cadastrado no momento para esta obra.</td></tr>
      ` : pacotes.map((p) => {
        let statusClass = "status-programado";
        if (p.status === "Instalado") statusClass = "status-instalado";
        else if (p.status === "Entregue") statusClass = "status-entregue";
        else if (p.status === "Em Transito") statusClass = "status-transito";
        else if (p.status === "Em Producao") statusClass = "status-producao";
        else if (p.status === "Atrasado") statusClass = "status-atrasado";

        return `
          <tr>
            <td><strong>${p.categoria}</strong></td>
            <td>
              <div style="font-weight: 700; color: #0f172a;">${p.nomeMaterial}</div>
              ${p.localPavimento ? `<div style="font-size: 9px; color: #64748b; margin-top: 2px;">📍 ${p.localPavimento}</div>` : ""}
            </td>
            <td>
              <div><strong>${p.fornecedorNome}</strong></div>
              <div style="font-size: 9px; color: #64748b; font-family: monospace;">${p.numeroOc || "OC a vincular"}</div>
            </td>
            <td style="text-align: center; font-weight: 700; color: #0284c7;">${formatarDataBR(p.dataInicioEntrega)}</td>
            <td style="text-align: center; font-weight: 700;">${formatarDataBR(p.dataLimiteConclusao)}</td>
            <td style="text-align: center;">
              <span class="status-badge ${statusClass}">${p.status}</span>
              <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${p.percentualConcluido}% concluído</div>
            </td>
            <td style="text-align: right; font-weight: 700; font-family: monospace;">${formatBRL(p.valorTotal)}</td>
          </tr>
        `;
      }).join("")}
    </tbody>
  </table>

  <div class="signature-grid">
    <div>
      <div class="sig-line">Engenharia Residente / Gestão da Obra</div>
      <div style="text-align: center; font-size: 8.5px; color: #64748b; margin-top: 2px;">Validação dos Prazos & Instalações de Campo</div>
    </div>
    <div>
      <div class="sig-line">Suprimentos & Logística de Materiais</div>
      <div style="text-align: center; font-size: 8.5px; color: #64748b; margin-top: 2px;">Follow-up dos Fornecedores & Chegadas</div>
    </div>
    <div>
      <div class="sig-line">Diretoria Executiva / CFO</div>
      <div style="text-align: center; font-size: 8.5px; color: #64748b; margin-top: 2px;">Aprovação da Entrega das Chaves</div>
    </div>
  </div>

  <div class="footer">
    <div>JC Bauer Empreendimentos • Sistema Integrado de Suprimentos & Engenharia Civil</div>
    <div>Documento gerado em conformidade com o cronograma executivo de obras • Página 1 de 1</div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</body>
</html>`;

    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank");
      if (win) {
        win.focus();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
        return;
      }
    } catch {}

    const win = window.open("", "_blank");
    if (win && win.document) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
    }
  };

  const handleAbrirWhatsAppFornecedor = (pacote: PacoteFinalizacao) => {
    const tel = (pacote.fornecedorTelefone || "").replace(/\D/g, "");
    const prazoChaves = cronogramaAtual.dataEntregaChaves
      ? ` (Entrega oficial das chaves: ${formatarDataBR(cronogramaAtual.dataEntregaChaves)})`
      : "";
    const msg = `Olá ${pacote.fornecedorNome}, tudo bem? Aqui é da JC Bauer Empreendimentos.\n\nEstamos acompanhando o cronograma de finalização da obra ${cronogramaAtual.obraNome}${prazoChaves}.\n\nGostaria de confirmar o status e a data de chegada do material:\n• ${pacote.nomeMaterial}\n• Início previsto: ${formatarDataBR(pacote.dataInicioEntrega)}\n• Data limite para término: ${formatarDataBR(pacote.dataLimiteConclusao)}\n\nPoderia nos confirmar o envio? Obrigado!`;

    const url = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleNotificarEquipe = (pacote: PacoteFinalizacao) => {
    if (onNotificarCargaWhatsApp) {
      onNotificarCargaWhatsApp({
        tipo: "PACOTE_FINALIZACAO",
        id: pacote.id,
        obraId: cronogramaAtual.obraId,
        obraNome: cronogramaAtual.obraNome,
        numeroOc: pacote.numeroOc,
        fornecedorNome: pacote.fornecedorNome,
        fornecedorTelefone: pacote.fornecedorTelefone,
        descricaoMaterial: `${pacote.nomeMaterial} (${pacote.categoria})`,
        dataEntregaFormatada: formatarDataBR(pacote.dataInicioEntrega),
        horarioJanela: "Horário de Obra (07:30 - 17:30)",
        tipoVeiculo: "Caminhão / Frete Fornecedor",
        tipoFrete: "CIF",
        localPavimento: pacote.localPavimento,
        status: pacote.status,
        observacoes: pacote.observacoes,
        pacotesDisponiveis: pacotesValidos,
      });
      return;
    }

    const msg = `🚚 *AVISO DE CHEGADA DE ACABAMENTO - JC BAUER*\n📍 *Obra:* ${cronogramaAtual.obraNome}\n📦 *Material:* ${pacote.nomeMaterial} (${pacote.categoria})\n🏢 *Fornecedor:* ${pacote.fornecedorNome}\n📄 *Ordem de Compra:* ${pacote.numeroOc || "Direto"}\n📅 *Previsão de Chegada:* ${formatarDataBR(pacote.dataInicioEntrega)}\n⏱️ *Limite Término:* ${formatarDataBR(pacote.dataLimiteConclusao)}\n📍 *Local / Pavimento:* ${pacote.localPavimento || "Obra"}\n\n⚠️ *Atenção Almoxarifado:* Manter equipe e pátio preparados para descarregamento e conferência de NF.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    dispararAviso("WhatsApp aberto para notificar a equipe da obra!");
  };

  const handleAbrirDisparoRapidoHeader = () => {
    const proximoPacote =
      pacotesValidos.find((p) => p.status === "Em Transito") ||
      pacotesValidos.find((p) => p.status === "Programado") ||
      pacotesValidos[0];

    if (proximoPacote) {
      handleNotificarEquipe(proximoPacote);
    } else {
      if (onNotificarCargaWhatsApp) {
        onNotificarCargaWhatsApp({
          tipo: "PACOTE_FINALIZACAO",
          id: `aviso-${Date.now()}`,
          obraId: cronogramaAtual.obraId,
          obraNome: cronogramaAtual.obraNome,
          descricaoMaterial: "Materiais de Finalização & Acabamentos",
          fornecedorNome: "Fornecedor Programado",
          dataEntregaFormatada: "Hoje",
          horarioJanela: "Horário de Obra (07:30 - 17:30)",
          tipoVeiculo: "Caminhão / Frete Fornecedor",
          tipoFrete: "CIF",
          status: "Em Transito",
          observacoes: "Manter portão e pátio desimpedidos para descarregamento",
          pacotesDisponiveis: pacotesValidos,
        });
      } else {
        dispararAviso("Nenhum pacote cadastrado para disparo no momento.");
      }
    }
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
                Controle das datas de chegada de materiais de finalização para garantir a entrega das chaves no prazo.
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

            {/* Importar OCs Reais */}
            {ordensDestaObra.length > 0 && (
              <button
                type="button"
                onClick={() => setModalImportarOcsAberto(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Puxar materiais de Ordens de Compra reais da obra"
              >
                <span>📦</span> Puxar de OCs ({ordensDestaObra.length})
              </button>
            )}

            {/* Botão de Disparo Rápido de Notificação WhatsApp */}
            <button
              type="button"
              onClick={handleAbrirDisparoRapidoHeader}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition flex items-center gap-1.5 shadow-sm hover:shadow-md cursor-pointer"
              title="Disparo Rápido de WhatsApp: Notificar celulares do Engenheiro, Almoxarife e Diretoria sobre a chegada dos materiais deste empreendimento"
            >
              <span>📲</span>
              <span>Disparo Rápido WhatsApp</span>
            </button>

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
                  gerarRelatorioHtmlLocal(cronogramaAtual);
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
                  {cronogramaAtual.dataEntregaChaves
                    ? formatarDataBR(cronogramaAtual.dataEntregaChaves)
                    : "A Definir"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNovaDataEntregaChaves(cronogramaAtual.dataEntregaChaves || "");
                  setModalDataEntregaAberto(true);
                }}
                className="text-[10px] text-slate-400 hover:text-amber-400 font-bold underline cursor-pointer"
              >
                {cronogramaAtual.dataEntregaChaves ? "Alterar Data" : "Definir Data"}
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Prazo Regressivo:</span>
              {diasRestantesEntrega !== null ? (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                    diasRestantesEntrega > 30
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : diasRestantesEntrega >= 0
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
                      : "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-bounce"
                  }`}
                >
                  {diasRestantesEntrega >= 0
                    ? `⏳ Faltam ${diasRestantesEntrega} dias`
                    : `⚠️ Venceu há ${Math.abs(diasRestantesEntrega)} dias`}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalDataEntregaAberto(true)}
                  className="text-xs text-amber-300 underline font-semibold"
                >
                  Definir Prazo
                </button>
              )}
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
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-blue-700">
                  {metricas.emTransito}
                </span>
                <span className="text-xs text-slate-500">cargas a caminho</span>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-200 pt-2 flex items-center justify-between">
              <span>Atrasos / Alertas:</span>
              <strong className={metricas.atrasados > 0 ? "text-rose-600 font-black animate-pulse" : "text-emerald-700 font-bold"}>
                {metricas.atrasados > 0 ? `⚠️ ${metricas.atrasados} com risco` : "✅ Nenhum atraso"}
              </strong>
            </div>
          </div>

          {/* CARD 4: VALOR INVESTIDO NOS ACABAMENTOS */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Total Comprometido Acabamentos
              </span>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {formatBRL(metricas.valorTotal)}
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 border-t border-slate-200 pt-2 flex items-center justify-between">
              <span>Engenheiro:</span>
              <span className="font-semibold text-slate-800 truncate max-w-[130px]" title={cronogramaAtual.responsavelEngenheiro || "Não definido"}>
                {cronogramaAtual.responsavelEngenheiro || "Não definido"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SELETOR DE MODO DE VISUALIZAÇÃO & FILTROS                             */}
      {/* ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setModoVisualizacao("cards")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
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
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              modoVisualizacao === "timeline"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📅 Linha do Tempo (Gantt)
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("tabela")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              modoVisualizacao === "tabela"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            📊 Tabela Resumo
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filtrar:</span>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-xs font-bold rounded-lg px-2.5 py-1.5 text-slate-800 cursor-pointer"
          >
            <option value="TODOS">Todos os Pacotes ({cronogramaAtual.pacotes.length})</option>
            <option value="Programado">Programados</option>
            <option value="Em Producao">Em Produção</option>
            <option value="Em Transito">Em Trânsito / Chegando</option>
            <option value="Entregue">Entregues no Canteiro</option>
            <option value="Instalado">100% Instalados</option>
            <option value="ATRASADOS">⚠️ Com Risco / Atrasados</option>
          </select>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CONTEÚDO PRINCIPAL: ESTADO VAZIO OU MODOS DE VISUALIZAÇÃO             */}
      {/* ===================================================================== */}
      {cronogramaAtual.pacotes.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-3xl">
            🏁
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-black text-slate-900">
              Nenhum material de finalização cadastrado para {obraAtual?.nome || "este empreendimento"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Cadastre os pacotes de acabamento (pisos, pintura, louças, marcenaria, etc.) ou puxe diretamente das Ordens de Compra já emitidas para esta obra.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setPacoteEditando(null);
                setModalPacoteAberto(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <span>+</span> Cadastrar Pacote de Finalização
            </button>

            {ordensDestaObra.length > 0 && (
              <button
                type="button"
                onClick={() => setModalImportarOcsAberto(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <span>📦</span> Importar das Ordens de Compra ({ordensDestaObra.length})
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* ================================================================= */}
          {/* MODO 1: CARDS POR DISCIPLINA / PACOTE                             */}
          {/* ================================================================= */}
          {modoVisualizacao === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {pacotesFiltrados.map((pacote) => {
                const diasAteInicio = calcularDiferencaDias(pacote.dataInicioEntrega);
                const diasAteLimite = calcularDiferencaDias(pacote.dataLimiteConclusao);
                const atrasado = diasAteLimite < 0 && pacote.status !== "Instalado";

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
                          className="text-xs text-slate-400 hover:text-slate-800 font-bold cursor-pointer"
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

                      {/* Datas de Entrega e Conclusão */}
                      <div className="bg-slate-50 rounded-xl p-2.5 space-y-1.5 text-xs border border-slate-200/70">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Início das Entregas:</span>
                          <strong className="text-slate-900">{formatarDataBR(pacote.dataInicioEntrega)}</strong>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Limite Instalação:</span>
                          <strong className={atrasado ? "text-rose-600 font-black" : "text-slate-900"}>
                            {formatarDataBR(pacote.dataLimiteConclusao)}
                          </strong>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 text-[11px]">
                          <span className="text-slate-500">Previsão:</span>
                          <span className="font-semibold text-slate-700">
                            {diasAteInicio > 0
                              ? `Chega em ${diasAteInicio} dias`
                              : diasAteInicio === 0
                              ? "Chega hoje!"
                              : `Em andamento (${Math.abs(diasAteInicio)}d)`}
                          </span>
                        </div>
                      </div>

                      {/* Barra de Progresso Físico */}
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500">Avanço Físico:</span>
                          <strong className="text-slate-900">{pacote.percentualConcluido}%</strong>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              pacote.percentualConcluido === 100
                                ? "bg-emerald-600"
                                : pacote.percentualConcluido >= 50
                                ? "bg-teal-600"
                                : "bg-cyan-600"
                            }`}
                            style={{ width: `${pacote.percentualConcluido}%` }}
                          />
                        </div>
                      </div>

                      {/* Local / Pavimento */}
                      {pacote.localPavimento && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <span>📍</span>
                          <span className="truncate">{pacote.localPavimento}</span>
                        </div>
                      )}
                    </div>

                    {/* Rodapé do Card: Mudança rápida de Status & WhatsApp */}
                    <div className="pt-3 border-t border-slate-200 flex items-center gap-1.5">
                      <select
                        value={pacote.status}
                        onChange={(e) =>
                          handleMudarStatusPacote(
                            pacote.id,
                            e.target.value as StatusPacoteFinalizacao
                          )
                        }
                        className={`text-xs font-bold rounded-lg px-2 py-1.5 flex-1 border cursor-pointer ${
                          pacote.status === "Instalado"
                            ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                            : pacote.status === "Entregue"
                            ? "bg-teal-100 text-teal-900 border-teal-300"
                            : pacote.status === "Em Transito"
                            ? "bg-blue-100 text-blue-900 border-blue-300"
                            : pacote.status === "Em Producao"
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : "bg-slate-100 text-slate-800 border-slate-300"
                        }`}
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
                        onClick={() => handleNotificarEquipe(pacote)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
                        title="Disparar WhatsApp para Engenheiro, Almoxarife, Diretoria ou Fornecedor"
                      >
                        <span>📲</span>
                        <span>Notificar WhatsApp</span>
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

          {/* ================================================================= */}
          {/* MODO 2: LINHA DO TEMPO VISUAL (GANTT SEMANAL DE ENTREGA)         */}
          {/* ================================================================= */}
          {modoVisualizacao === "timeline" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Linha do Tempo das Chegadas até a Entrega das Chaves
                  </h3>
                  <p className="text-xs text-slate-500">
                    Visão sequencial de quando cada material encosta no canteiro.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Chegada
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Instalação
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

                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full transition-all ${
                            p.status === "Instalado"
                              ? "bg-emerald-500"
                              : p.status === "Entregue"
                              ? "bg-teal-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${Math.max(p.percentualConcluido, 15)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MODO 3: TABELA RESUMO EXECUTIVA                                  */}
          {/* ================================================================= */}
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
                      <td className="py-2.5 px-3 text-center">
                        <span className="font-bold text-slate-900">{p.percentualConcluido}%</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === "Instalado"
                              ? "bg-emerald-100 text-emerald-800"
                              : p.status === "Entregue"
                              ? "bg-teal-100 text-teal-800"
                              : p.status === "Em Transito"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">
                        {formatBRL(p.valorTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setPacoteEditando(p);
                              setModalPacoteAberto(true);
                            }}
                            className="p-1 rounded text-slate-500 hover:text-slate-900"
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNotificarEquipe(p)}
                            className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold transition flex items-center gap-1 border border-emerald-300"
                            title="Notificar WhatsApp: Engenheiro, Almoxarife, Diretoria ou Fornecedor"
                          >
                            <span>📲</span>
                            <span>WhatsApp</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirPacote(p.id)}
                            className="p-1 rounded text-rose-500 hover:text-rose-700"
                            title="Excluir"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ===================================================================== */}
      {/* MODAL: IMPORTAR DE ORDENS DE COMPRA REAIS DA OBRA                     */}
      {/* ===================================================================== */}
      {modalImportarOcsAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Importar das Ordens de Compra Reais da Obra
                </h3>
                <p className="text-xs text-slate-500">
                  Selecione as OCs emitidas para incluir diretamente no cronograma de finalização.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalImportarOcsAberto(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {ordensDestaObra.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-8">
                  Nenhuma Ordem de Compra encontrada para esta obra.
                </p>
              ) : (
                ordensDestaObra.map((oc) => {
                  const jaImportado = cronogramaAtual.pacotes.some((p) => p.numeroOc === oc.numeroOc);
                  const itensDesc = (oc.itens || []).map((i) => i.descricao).join(", ") || oc.categoria || "Materiais";

                  return (
                    <div
                      key={oc.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                        jaImportado ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">{oc.numeroOc}</span>
                          <span className="text-xs text-slate-600 font-semibold truncate">• {oc.fornecedorNome}</span>
                          {jaImportado && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                              Já no Cronograma
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate" title={itensDesc}>
                          {itensDesc}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                          <span>Total: <strong className="text-slate-800">{formatBRL(oc.valorTotal)}</strong></span>
                          {oc.dataPrevistaEntrega && (
                            <span>Previsão: <strong className="text-blue-700">{formatarDataBR(oc.dataPrevistaEntrega)}</strong></span>
                          )}
                        </div>
                      </div>

                      {!jaImportado ? (
                        <button
                          type="button"
                          onClick={() => {
                            const dataAtual = new Date().toISOString().split("T")[0];
                            const novoPacote: PacoteFinalizacao = {
                              id: `pac-oc-${oc.id}-${Date.now()}`,
                              categoria: oc.categoria || "Outros / Personalizado",
                              nomeMaterial: itensDesc.slice(0, 120),
                              fornecedorNome: oc.fornecedorNome,
                              fornecedorTelefone: oc.whatsapp || "",
                              numeroOc: oc.numeroOc,
                              dataInicioEntrega: oc.dataPrevistaEntrega || dataAtual,
                              dataLimiteConclusao: oc.dataPrevistaEntrega || dataAtual,
                              localPavimento: "Canteiro da Obra",
                              status: oc.status === "Entregue" ? "Entregue" : "Programado",
                              percentualConcluido: oc.status === "Entregue" ? 100 : 0,
                              valorTotal: oc.valorTotal || 0,
                              observacoes: `Ordem de Compra ${oc.numeroOc}.`,
                            };
                            onSalvarCronograma(obraAtivaId, {
                              ...cronogramaAtual,
                              pacotes: [...cronogramaAtual.pacotes, novoPacote],
                            });
                            dispararAviso(`Ordem ${oc.numeroOc} adicionada ao cronograma de entrega!`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shrink-0 cursor-pointer"
                        >
                          + Adicionar
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-600 font-bold shrink-0">✓ Adicionada</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModalImportarOcsAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ALTERAR DATA OFICIAL DE ENTREGA DAS CHAVES                     */}
      {/* ===================================================================== */}
      {modalDataEntregaAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Data Oficial de Entrega das Chaves
              </h3>
              <p className="text-xs text-slate-500">
                Define a data meta da obra para o cálculo da contagem regressiva.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Data Limite das Chaves:
              </label>
              <input
                type="date"
                value={novaDataEntregaChaves}
                onChange={(e) => setNovaDataEntregaChaves(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-sm font-bold text-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModalDataEntregaAberto(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSalvarDataEntrega}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Salvar Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ADICIONAR / EDITAR PACOTE DE ACABAMENTO                        */}
      {/* ===================================================================== */}
      {modalPacoteAberto && (
        <ModalEditarPacote
          pacoteInicial={pacoteEditando}
          onClose={() => {
            setModalPacoteAberto(false);
            setPacoteEditando(null);
          }}
          onSalvar={handleSalvarPacote}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SUBCOMPONENTE MODAL DE EDIÇÃO / CADASTRO DE PACOTE DE ACABAMENTO
// ---------------------------------------------------------------------------
function ModalEditarPacote({
  pacoteInicial,
  onClose,
  onSalvar,
}: {
  pacoteInicial: PacoteFinalizacao | null;
  onClose: () => void;
  onSalvar: (pacote: PacoteFinalizacao) => void;
}) {
  const [categoria, setCategoria] = useState<string>(
    pacoteInicial?.categoria || CATEGORIAS_PADRAO[0]
  );
  const [nomeMaterial, setNomeMaterial] = useState<string>(
    pacoteInicial?.nomeMaterial || ""
  );
  const [fornecedorNome, setFornecedorNome] = useState<string>(
    pacoteInicial?.fornecedorNome || ""
  );
  const [fornecedorTelefone, setFornecedorTelefone] = useState<string>(
    pacoteInicial?.fornecedorTelefone || ""
  );
  const [numeroOc, setNumeroOc] = useState<string>(
    pacoteInicial?.numeroOc || ""
  );
  const [dataInicioEntrega, setDataInicioEntrega] = useState<string>(
    pacoteInicial?.dataInicioEntrega || new Date().toISOString().split("T")[0]
  );
  const [dataLimiteConclusao, setDataLimiteConclusao] = useState<string>(
    pacoteInicial?.dataLimiteConclusao || new Date().toISOString().split("T")[0]
  );
  const [localPavimento, setLocalPavimento] = useState<string>(
    pacoteInicial?.localPavimento || ""
  );
  const [status, setStatus] = useState<StatusPacoteFinalizacao>(
    pacoteInicial?.status || "Programado"
  );
  const [percentualConcluido, setPercentualConcluido] = useState<number>(
    pacoteInicial?.percentualConcluido || 0
  );
  const [valorTotal, setValorTotal] = useState<number>(
    pacoteInicial?.valorTotal || 0
  );
  const [observacoes, setObservacoes] = useState<string>(
    pacoteInicial?.observacoes || ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeMaterial.trim()) {
      alert("Informe o nome do material de finalização.");
      return;
    }

    const pacoteSalvar: PacoteFinalizacao = {
      id: pacoteInicial?.id || `pac-${Date.now()}`,
      categoria,
      nomeMaterial: nomeMaterial.trim(),
      fornecedorNome: fornecedorNome.trim() || "Fornecedor a confirmar",
      fornecedorTelefone: fornecedorTelefone.trim(),
      numeroOc: numeroOc.trim(),
      dataInicioEntrega,
      dataLimiteConclusao,
      localPavimento: localPavimento.trim(),
      status,
      percentualConcluido,
      valorTotal,
      observacoes: observacoes.trim(),
    };

    onSalvar(pacoteSalvar);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {pacoteInicial ? "Editar Pacote de Finalização" : "Novo Pacote de Acabamento"}
            </h3>
            <p className="text-xs text-slate-500">
              Preencha as informações reais do material de acabamento da obra.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Disciplina / Categoria: *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
              >
                {CATEGORIAS_PADRAO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Status Atual: *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusPacoteFinalizacao)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
              >
                <option value="Programado">🔵 Programado</option>
                <option value="Em Producao">🟡 Em Produção</option>
                <option value="Em Transito">🚚 Em Trânsito / Chegando</option>
                <option value="Entregue">🟢 Entregue no Canteiro</option>
                <option value="Instalado">✅ Instalado</option>
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
              placeholder="Descrição do material de acabamento"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Fornecedor:</label>
              <input
                type="text"
                value={fornecedorNome}
                onChange={(e) => setFornecedorNome(e.target.value)}
                placeholder="Empresa fornecedora"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">WhatsApp / Telefone:</label>
              <input
                type="text"
                value={fornecedorTelefone}
                onChange={(e) => setFornecedorTelefone(e.target.value)}
                placeholder="(DDD) 99999-9999"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nº da OC:</label>
              <input
                type="text"
                value={numeroOc}
                onChange={(e) => setNumeroOc(e.target.value)}
                placeholder="OC-2026-..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/40 p-3 rounded-xl border border-amber-200">
            <div>
              <label className="block font-bold text-slate-900 mb-1">
                🚚 Data Início das Entregas no Canteiro: *
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
              <span className="text-[10px] text-slate-500">Prazo final para conclusão da instalação.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Locais / Pavimentos:</label>
              <input
                type="text"
                value={localPavimento}
                onChange={(e) => setLocalPavimento(e.target.value)}
                placeholder="Ex: Torre A, Apto 101"
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
                placeholder="0,00"
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
              placeholder="Instruções de descarga, transportadora, etc."
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
