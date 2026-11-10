"use client";

import React, { useState, useEffect } from "react";
import {
  Obra,
  UserSettings,
  UsuarioSistema,
  DadosNotificacaoCargaWhatsApp,
  PacoteFinalizacao,
} from "../../types/jcBauer";

interface ModalNotificarCargaWhatsAppProps {
  isOpen: boolean;
  onClose: () => void;
  dados: DadosNotificacaoCargaWhatsApp | null;
  obra?: Obra;
  settings: UserSettings;
  usuarios?: UsuarioSistema[];
  onSalvarContatosObra?: (
    obraId: string,
    contatos: {
      telefoneEngenheiro?: string;
      telefoneAlmoxarife?: string;
      telefoneDiretor?: string;
      grupoWhatsapp?: string;
    }
  ) => void;
  dispararAviso?: (msg: string) => void;
}

function formatarDataBR(iso?: string): string {
  if (!iso) return "A definir";
  const partes = iso.split("-");
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return iso;
}

export function ModalNotificarCargaWhatsApp({
  isOpen,
  onClose,
  dados,
  obra,
  settings,
  usuarios = [],
  onSalvarContatosObra,
  dispararAviso,
}: ModalNotificarCargaWhatsAppProps) {
  // Dados do pacote atualmente em foco
  const [pacoteIdAtivo, setPacoteIdAtivo] = useState<string>("");
  const [materialNome, setMaterialNome] = useState("");
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [numeroOc, setNumeroOc] = useState("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [janelaHorario, setJanelaHorario] = useState("");
  const [veiculo, setVeiculo] = useState("");
  const [tipoFrete, setTipoFrete] = useState("");
  const [localPavimento, setLocalPavimento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Telefones dos Destinatários
  const [telEngenheiro, setTelEngenheiro] = useState("");
  const [telAlmoxarife, setTelAlmoxarife] = useState("");
  const [telDiretor, setTelDiretor] = useState("");
  const [telFornecedor, setTelFornecedor] = useState("");
  const [linkGrupo, setLinkGrupo] = useState("");
  const [telAvulso, setTelAvulso] = useState("");
  const [nomeAvulso, setNomeAvulso] = useState("");

  // Seleção para disparo em lote simultâneo ("Enviar para Todos ao Mesmo Tempo")
  const [incEngenheiro, setIncEngenheiro] = useState<boolean>(true);
  const [incAlmoxarife, setIncAlmoxarife] = useState<boolean>(true);
  const [incDiretor, setIncDiretor] = useState<boolean>(true);
  const [incGrupo, setIncGrupo] = useState<boolean>(false);
  const [incFornecedor, setIncFornecedor] = useState<boolean>(false);
  const [incAvulso, setIncAvulso] = useState<boolean>(false);

  // Status visual do disparo em lote
  const [disparoEmAndamento, setDisparoEmAndamento] = useState<boolean>(false);
  const [destinosDisparados, setDestinosDisparados] = useState<
    {
      id: string;
      titulo: string;
      icone: string;
      telefone: string;
      url: string;
    }[]
  >([]);

  const [salvarNoCadastro, setSalvarNoCadastro] = useState(true);
  const [textoMensagem, setTextoMensagem] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Helper para gerar o texto da mensagem para a equipe interna
  const gerarTemplateEquipe = (params: {
    obraNome: string;
    material: string;
    fornecedor: string;
    oc?: string;
    data: string;
    janela?: string;
    veiculo?: string;
    frete?: string;
    local?: string;
    obs?: string;
  }) => {
    return [
      "🚚 *AVISO DE CHEGADA DE ACABAMENTO / CARGA - JC BAUER*",
      `📍 *Empreendimento / Obra:* ${params.obraNome}`,
      `📦 *Material / Insumo:* ${params.material}`,
      `🏢 *Fornecedor:* ${params.fornecedor}`,
      params.oc ? `📄 *Ordem de Compra:* ${params.oc}` : null,
      `📅 *Previsão de Chegada:* ${params.data || "Hoje"}`,
      params.janela ? `⏰ *Janela de Horário:* ${params.janela}` : null,
      params.veiculo ? `🚛 *Veículo / Transporte:* ${params.veiculo}` : null,
      params.frete ? `🚚 *Tipo de Frete:* ${params.frete}` : null,
      params.local ? `📍 *Pavimento / Destino:* ${params.local}` : null,
      params.obs ? `📝 *Observações:* ${params.obs}` : null,
      "",
      "⚠️ *Atenção Equipe de Canteiro & Almoxarifado:*",
      "Favor verificar desimpedimento do portão e preparar equipe para conferência da Nota Fiscal.",
      "",
      "Disparado via *Sistema Central JC Bauer*.",
    ]
      .filter((linha) => linha !== null)
      .join("\n");
  };

  // Helper para gerar o texto da mensagem para o fornecedor
  const gerarTemplateFornecedor = (params: {
    obraNome: string;
    material: string;
    fornecedor: string;
    oc?: string;
    data: string;
    local?: string;
  }) => {
    return [
      `Olá *${params.fornecedor}*, tudo bem? Aqui é da *JC Bauer Empreendimentos*.`,
      "",
      `Estamos acompanhando o cronograma de entrega da obra *${params.obraNome}*.`,
      "Gostaríamos de confirmar o status do envio e data de entrega do seguinte material:",
      `• *Material / Acabamento:* ${params.material}`,
      params.oc ? `• *Ordem de Compra:* ${params.oc}` : null,
      `• *Previsão de Entrega:* ${params.data}`,
      params.local ? `• *Local / Pavimento:* ${params.local}` : null,
      "",
      "Poderia nos confirmar o envio para garantirmos o descarregamento no canteiro? Obrigado!",
    ]
      .filter((l) => l !== null)
      .join("\n");
  };

  // Inicializa quando dados mudam
  useEffect(() => {
    if (!dados) return;

    const almoxarifeUsuario = usuarios.find(
      (u) =>
        u.cargo === "Almoxarife" &&
        (u.obraId === dados.obraId || u.obraId === "ALL")
    );

    const engenheiroPadrao = obra?.telefoneEngenheiro || "";
    const almoxarifePadrao =
      obra?.telefoneAlmoxarife || almoxarifeUsuario?.telefone || "";
    const diretorPadrao =
      obra?.telefoneDiretor || settings?.userPhone || "47 997810384";
    const grupoPadrao = obra?.grupoWhatsapp || "";
    const fornPadrao = dados.fornecedorTelefone || "";

    setTelEngenheiro(engenheiroPadrao);
    setTelAlmoxarife(almoxarifePadrao);
    setTelDiretor(diretorPadrao);
    setLinkGrupo(grupoPadrao);
    setTelFornecedor(fornPadrao);

    setPacoteIdAtivo(dados.id);
    setMaterialNome(dados.descricaoMaterial);
    setFornecedorNome(dados.fornecedorNome);
    setNumeroOc(dados.numeroOc || "");
    setDataEntrega(dados.dataEntregaFormatada || "Hoje");
    setJanelaHorario(dados.horarioJanela || "Horário de Obra (07:30 - 17:30)");
    setVeiculo(dados.tipoVeiculo || "Caminhão / Frete Fornecedor");
    setTipoFrete(dados.tipoFrete || "CIF");
    setLocalPavimento(dados.localPavimento || "");
    setObservacoes(dados.observacoes || "");

    const t = gerarTemplateEquipe({
      obraNome: dados.obraNome || obra?.nome || "Canteiro Central",
      material: dados.descricaoMaterial,
      fornecedor: dados.fornecedorNome,
      oc: dados.numeroOc,
      data: dados.dataEntregaFormatada || "Hoje",
      janela: dados.horarioJanela,
      veiculo: dados.tipoVeiculo,
      frete: dados.tipoFrete,
      local: dados.localPavimento,
      obs: dados.observacoes,
    });

    setTextoMensagem(t);
    setCopiado(false);
    setDisparoEmAndamento(false);
    setDestinosDisparados([]);

    if (grupoPadrao.trim()) {
      setIncGrupo(true);
    }
  }, [dados, obra, settings, usuarios]);

  if (!isOpen || !dados) return null;

  // Quando o usuário alterna entre os pacotes disponíveis do empreendimento
  const handleTrocarPacote = (novoId: string) => {
    setPacoteIdAtivo(novoId);
    const p = dados.pacotesDisponiveis?.find((x) => x.id === novoId);
    if (!p) return;

    const mat = `${p.nomeMaterial} (${p.categoria})`;
    const dataFmt = formatarDataBR(p.dataInicioEntrega);

    setMaterialNome(mat);
    setFornecedorNome(p.fornecedorNome || "A Definir");
    setNumeroOc(p.numeroOc || "");
    setDataEntrega(dataFmt);
    setLocalPavimento(p.localPavimento || "");
    setObservacoes(p.observacoes || "");
    if (p.fornecedorTelefone) {
      setTelFornecedor(p.fornecedorTelefone);
    }

    const t = gerarTemplateEquipe({
      obraNome: dados.obraNome || obra?.nome || "Canteiro Central",
      material: mat,
      fornecedor: p.fornecedorNome || "A Definir",
      oc: p.numeroOc,
      data: dataFmt,
      janela: janelaHorario,
      veiculo: veiculo,
      frete: tipoFrete,
      local: p.localPavimento,
      obs: p.observacoes,
    });
    setTextoMensagem(t);
  };

  const sanitizarTelefone = (tel: string) => {
    let limpo = (tel || "").replace(/\D/g, "");
    if (!limpo) return "";
    if (limpo.length === 10 || limpo.length === 11) {
      limpo = `55${limpo}`;
    }
    return limpo;
  };

  const salvarContatosSeNecessario = () => {
    if (salvarNoCadastro && onSalvarContatosObra && dados.obraId) {
      onSalvarContatosObra(dados.obraId, {
        telefoneEngenheiro: telEngenheiro.trim(),
        telefoneAlmoxarife: telAlmoxarife.trim(),
        telefoneDiretor: telDiretor.trim(),
        grupoWhatsapp: linkGrupo.trim(),
      });
    }
  };

  const handleDispararPara = (telefone: string, nomeDestino: string, msgCustom?: string) => {
    salvarContatosSeNecessario();
    const limpo = sanitizarTelefone(telefone);
    const msgFinal = msgCustom || textoMensagem;

    if (!limpo) {
      const urlGeral = `https://wa.me/?text=${encodeURIComponent(msgFinal)}`;
      window.open(urlGeral, "_blank");
      if (dispararAviso) {
        dispararAviso(
          `WhatsApp aberto! Selecione o contato de ${nomeDestino} para enviar.`
        );
      }
      return;
    }

    const url = `https://wa.me/${limpo}?text=${encodeURIComponent(msgFinal)}`;
    window.open(url, "_blank");
    if (dispararAviso) {
      dispararAviso(
        `Disparo via WhatsApp iniciado para ${nomeDestino} (${telefone})!`
      );
    }
  };

  const handleDispararFornecedor = () => {
    const msgForn = gerarTemplateFornecedor({
      obraNome: dados.obraNome || obra?.nome || "Canteiro Central",
      material: materialNome,
      fornecedor: fornecedorNome,
      oc: numeroOc,
      data: dataEntrega,
      local: localPavimento,
    });
    handleDispararPara(telFornecedor, `Fornecedor ${fornecedorNome}`, msgForn);
  };

  const handleDispararGrupo = () => {
    salvarContatosSeNecessario();
    if (linkGrupo.trim().startsWith("http")) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textoMensagem).catch(() => {});
      }
      window.open(linkGrupo.trim(), "_blank");
      if (dispararAviso) {
        dispararAviso(
          "Mensagem copiada para a área de transferência e grupo da obra aberto!"
        );
      }
      return;
    }

    const limpo = sanitizarTelefone(linkGrupo);
    if (limpo) {
      window.open(`https://wa.me/${limpo}?text=${encodeURIComponent(textoMensagem)}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(textoMensagem)}`, "_blank");
    }
    if (dispararAviso) {
      dispararAviso("WhatsApp aberto para envio no grupo da obra!");
    }
  };

  const handleCopiarMensagem = async () => {
    salvarContatosSeNecessario();
    try {
      await navigator.clipboard.writeText(textoMensagem);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
      if (dispararAviso) {
        dispararAviso("Texto da notificação copiado com sucesso!");
      }
    } catch {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    }
  };

  const nomeEngenheiro = obra?.engenheiro || "Engenheiro Responsável";
  const nomeDiretor = settings?.userName || "Diretoria (Welliton Schmidt)";

  // Lista dos contatos selecionados para envio em lote
  const listaDestinosAtivos: {
    id: string;
    titulo: string;
    icone: string;
    telefone: string;
    link?: string;
    msgCustom?: string;
  }[] = [];

  if (incEngenheiro) {
    listaDestinosAtivos.push({
      id: "eng",
      titulo: `Eng. ${nomeEngenheiro}`,
      icone: "👷‍♂️",
      telefone: telEngenheiro,
    });
  }
  if (incAlmoxarife) {
    listaDestinosAtivos.push({
      id: "almox",
      titulo: "Almoxarife / Canteiro",
      icone: "📦",
      telefone: telAlmoxarife,
    });
  }
  if (incDiretor) {
    listaDestinosAtivos.push({
      id: "dir",
      titulo: `Diretoria (${nomeDiretor})`,
      icone: "🏢",
      telefone: telDiretor,
    });
  }
  if (incGrupo && linkGrupo.trim()) {
    listaDestinosAtivos.push({
      id: "grupo",
      titulo: "Grupo da Obra",
      icone: "👥",
      telefone: linkGrupo,
      link: linkGrupo,
    });
  }
  if (incFornecedor && telFornecedor.trim()) {
    const msgForn = gerarTemplateFornecedor({
      obraNome: dados.obraNome || obra?.nome || "Canteiro Central",
      material: materialNome,
      fornecedor: fornecedorNome,
      oc: numeroOc,
      data: dataEntrega,
      local: localPavimento,
    });
    listaDestinosAtivos.push({
      id: "forn",
      titulo: `Fornecedor (${fornecedorNome})`,
      icone: "🏭",
      telefone: telFornecedor,
      msgCustom: msgForn,
    });
  }
  if (incAvulso && telAvulso.trim()) {
    listaDestinosAtivos.push({
      id: "avulso",
      titulo: nomeAvulso || "Contato Avulso",
      icone: "📱",
      telefone: telAvulso,
    });
  }

  // DISPARAR PARA TODOS AO MESMO TEMPO
  const handleDispararTodosAoMesmoTempo = () => {
    salvarContatosSeNecessario();

    if (listaDestinosAtivos.length === 0) {
      if (dispararAviso) {
        dispararAviso("Marque ao menos um destinatário para o envio simultâneo.");
      }
      return;
    }

    // Copia a mensagem para a área de transferência no momento do clique do usuário
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textoMensagem).catch(() => {});
    }

    // Monta as URLs finais de cada destinatário
    const listaComUrl = listaDestinosAtivos.map((dest) => {
      const msg = dest.msgCustom || textoMensagem;
      if (dest.link?.trim().startsWith("http")) {
        return { ...dest, url: dest.link.trim() };
      }
      const limpo = sanitizarTelefone(dest.telefone);
      const url = limpo
        ? `https://wa.me/${limpo}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      return { ...dest, url };
    });

    setDestinosDisparados(listaComUrl);
    setDisparoEmAndamento(true);

    // Abre o primeiro destinatário instantaneamente
    if (listaComUrl[0]) {
      window.open(listaComUrl[0].url, "_blank");
    }

    // Abre os demais com pequeno espaçamento para o navegador processar as abas
    for (let i = 1; i < listaComUrl.length; i++) {
      const item = listaComUrl[i];
      setTimeout(() => {
        window.open(item.url, "_blank");
      }, i * 450);
    }

    if (dispararAviso) {
      dispararAviso(
        `Disparo iniciado para ${listaComUrl.length} contatos! O WhatsApp está abrindo os destinatários.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in duration-150">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl shrink-0">
              📲
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">
                  Painel de Entregas — Disparo Rápido WhatsApp
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950 uppercase shadow-xs">
                  Envio Simultâneo
                </span>
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                Envie para o Engenheiro, Almoxarife e Diretoria de uma só vez ou individualmente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* =============================================================== */}
          {/* DESTAQUE PRINCIPAL: ENVIAR PARA TODOS AO MESMO TEMPO           */}
          {/* =============================================================== */}
          <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 rounded-2xl p-4 text-white shadow-md border border-emerald-500/40 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-400 text-amber-950 flex items-center justify-center text-sm font-black shadow-xs">
                    ⚡
                  </span>
                  <h4 className="font-black text-sm text-white uppercase tracking-wide">
                    Enviar para Todos ao Mesmo Tempo
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                    Super Rápido
                  </span>
                </div>
                <p className="text-xs text-emerald-100 mt-1">
                  Dispara a notificação desta carga para todos os contatos marcados abaixo em 1 só clique:
                </p>
              </div>

              <button
                type="button"
                onClick={handleDispararTodosAoMesmoTempo}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-emerald-950 text-xs font-black transition flex items-center justify-center gap-2 shadow-lg cursor-pointer shrink-0"
              >
                <span className="text-base">🚀</span>
                <span>ENVIAR PARA TODOS AGORA ({listaDestinosAtivos.length})</span>
              </button>
            </div>

            {/* Checkboxes de quem entra no envio simultâneo */}
            <div className="pt-2.5 border-t border-white/20 flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="text-emerald-200 text-[11px] font-medium mr-1">
                Destinatários:
              </span>

              <label className="flex items-center gap-1.5 cursor-pointer bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition">
                <input
                  type="checkbox"
                  checked={incEngenheiro}
                  onChange={(e) => setIncEngenheiro(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <span>👷‍♂️ Engenheiro</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition">
                <input
                  type="checkbox"
                  checked={incAlmoxarife}
                  onChange={(e) => setIncAlmoxarife(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <span>📦 Almoxarife</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition">
                <input
                  type="checkbox"
                  checked={incDiretor}
                  onChange={(e) => setIncDiretor(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <span>🏢 Diretoria</span>
              </label>

              {linkGrupo.trim() && (
                <label className="flex items-center gap-1.5 cursor-pointer bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition">
                  <input
                    type="checkbox"
                    checked={incGrupo}
                    onChange={(e) => setIncGrupo(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <span>👥 Grupo da Obra</span>
                </label>
              )}

              {telFornecedor.trim() && (
                <label className="flex items-center gap-1.5 cursor-pointer bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition">
                  <input
                    type="checkbox"
                    checked={incFornecedor}
                    onChange={(e) => setIncFornecedor(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <span>🏭 Fornecedor</span>
                </label>
              )}
            </div>
          </div>

          {/* Painel Informativo pós-disparo simultâneo com links rápidos */}
          {disparoEmAndamento && destinosDisparados.length > 0 && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Disparo executado para {destinosDisparados.length} contatos:</span>
                </div>
                <span className="text-[11px] font-normal text-emerald-700">
                  Dica: Se o navegador bloquear alguma aba, clique abaixo para abrir direto:
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {destinosDisparados.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => window.open(item.url, "_blank")}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-900 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                    title={`Abrir conversa de ${item.titulo}`}
                  >
                    <span>{item.icone}</span>
                    <span>{item.titulo}</span>
                    <span className="text-emerald-700 text-[10px]">📲 Abrir</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Seletor de Pacote quando houver múltiplos acabamentos no empreendimento */}
          {dados.pacotesDisponiveis && dados.pacotesDisponiveis.length > 1 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-2xs">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
                <span>📦</span>
                <span>Material de Acabamento Selecionado:</span>
              </div>
              <select
                value={pacoteIdAtivo}
                onChange={(e) => handleTrocarPacote(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-900 focus:outline-none cursor-pointer w-full md:w-auto flex-1 max-w-md shadow-2xs"
              >
                {dados.pacotesDisponiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nomeMaterial} ({p.categoria}) • {formatarDataBR(p.dataInicioEntrega)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Card Resumo do Material que está Chegando */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/70 pb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>📦</span>
                <span>{materialNome}</span>
              </span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                {numeroOc || "Entrega Acabamento"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Empreendimento:</span>
                <strong className="text-slate-900 truncate block">{dados.obraNome}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Fornecedor:</span>
                <strong className="text-slate-900 truncate block">{fornecedorNome}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Data Prevista:</span>
                <strong className="text-emerald-700 font-bold block">{dataEntrega}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Janela / Local:</span>
                <strong className="text-slate-900 truncate block">
                  {localPavimento || "Obra Principal"}
                </strong>
              </div>
            </div>
          </div>

          {/* Seleção e Disparo Individual por Destinatário (Caso queira enviar separado) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span>🎯</span>
                <span>Contatos da Obra & Disparo Individual (Opcional):</span>
              </label>
              <label className="text-[11px] text-slate-600 flex items-center gap-1.5 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={salvarNoCadastro}
                  onChange={(e) => setSalvarNoCadastro(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Salvar números digitados na Obra</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. ENGENHEIRO DA OBRA */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>👷‍♂️</span>
                    <span className="truncate">Engenheiro: {nomeEngenheiro}</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                    Canteiro
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={telEngenheiro}
                    onChange={(e) => setTelEngenheiro(e.target.value)}
                    placeholder="WhatsApp do Eng."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleDispararPara(telEngenheiro, `Eng. ${nomeEngenheiro}`)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                    title="Disparar aviso para o Engenheiro da Obra"
                  >
                    <span>📲</span>
                    <span>Enviar</span>
                  </button>
                </div>
              </div>

              {/* 2. ALMOXARIFE DO CANTEIRO */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>📦</span>
                    <span className="truncate">Almoxarife / Portaria</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                    Recebimento
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={telAlmoxarife}
                    onChange={(e) => setTelAlmoxarife(e.target.value)}
                    placeholder="WhatsApp do Almoxarife"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleDispararPara(telAlmoxarife, "Almoxarife do Canteiro")}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                    title="Disparar aviso para o Almoxarife da Obra"
                  >
                    <span>📲</span>
                    <span>Enviar</span>
                  </button>
                </div>
              </div>

              {/* 3. DIRETORIA / SUPRIMENTOS */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🏢</span>
                    <span className="truncate">Diretoria: {nomeDiretor}</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700">
                    Gestão
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={telDiretor}
                    onChange={(e) => setTelDiretor(e.target.value)}
                    placeholder="WhatsApp do Diretor"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleDispararPara(telDiretor, `Diretor ${nomeDiretor}`)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                    title="Disparar aviso para a Diretoria"
                  >
                    <span>📲</span>
                    <span>Enviar</span>
                  </button>
                </div>
              </div>

              {/* 4. GRUPO DE WHATSAPP DA OBRA */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>👥</span>
                    <span className="truncate">Grupo da Obra</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    Equipe
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={linkGrupo}
                    onChange={(e) => setLinkGrupo(e.target.value)}
                    placeholder="chat.whatsapp.com/... ou número"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={handleDispararGrupo}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                    title="Disparar no grupo da obra"
                  >
                    <span>💬</span>
                    <span>Grupo</span>
                  </button>
                </div>
              </div>

              {/* 5. FORNECEDOR DO MATERIAL */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🏭</span>
                    <span className="truncate">Fornecedor: {fornecedorNome}</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700">
                    Cobrança / Prazo
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={telFornecedor}
                    onChange={(e) => setTelFornecedor(e.target.value)}
                    placeholder="WhatsApp do Fornecedor"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleDispararFornecedor}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                    title="Cobrar ou alinhar prazo diretamente no WhatsApp do fornecedor"
                  >
                    <span>🏢</span>
                    <span>Fornec.</span>
                  </button>
                </div>
              </div>

              {/* 6. CONTATO AVULSO */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white hover:border-slate-400 transition space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>📱</span>
                    <span className="truncate">Contato Avulso</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    Qualquer Número
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={telAvulso}
                    onChange={(e) => setTelAvulso(e.target.value)}
                    placeholder="Número com DDD"
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleDispararPara(telAvulso, nomeAvulso || "Contato Avulso")}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                  >
                    <span>📲</span>
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pré-visualização da Mensagem & Edição */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>📝</span>
                <span>Texto Oficial da Notificação (Edição permitida):</span>
              </label>
              <button
                type="button"
                onClick={handleCopiarMensagem}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <span>{copiado ? "✅" : "📋"}</span>
                <span>{copiado ? "Mensagem Copiada!" : "Copiar Texto"}</span>
              </button>
            </div>

            <textarea
              rows={7}
              value={textoMensagem}
              onChange={(e) => setTextoMensagem(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-mono leading-relaxed focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopiarMensagem}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{copiado ? "✅" : "📋"}</span>
              <span>{copiado ? "Copiado!" : "Copiar Texto"}</span>
            </button>

            <button
              type="button"
              onClick={handleDispararTodosAoMesmoTempo}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <span>🚀</span>
              <span>Enviar para Todos ao Mesmo Tempo ({listaDestinosAtivos.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
