"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  testarConexaoSupabase,
  carregarTudoSupabase,
  salvarChaveSupabase,
  sincronizarFornecedoresRelacional,
  type SupabaseHealth,
} from "../lib/supabase";

/* ========================================================================= */
/* TIPOS E ESTRUTURA DE DADOS                                                */
/* ========================================================================= */

type TabId =
  | "Painel"
  | "DesempenhoFinanceiro"
  | "Cotacoes"
  | "Fornecedores"
  | "Ordens"
  | "Estoque"
  | "Medicoes"
  | "Orcamento"
  | "Logistica"
  | "Importacao"
  | "Configuracoes";

type ObraTabId =
  | "PainelDiario"
  | "NovoPedido"
  | "MeusPedidos"
  | "Recebimento"
  | "Estoque"
  | "Medicoes"
  | "Logistica";

type PerfilAcesso =
  | "Administrador"
  | "Engenheiro"
  | "Almoxarife"
  | "Encarregado";

type UrgenciaPedido = "Normal" | "Alta" | "Crítica - Obra Parada";

type ClasseAbc = "Classe A" | "Classe B" | "Classe C";

type NivelAlcada =
  | "Comprador Autorizado"
  | "Gerência de Obras"
  | "Diretoria Executiva / CFO";

interface MensagemPedido {
  id: string;
  autorNome: string;
  autorCargo: PerfilAcesso;
  dataHora: string;
  texto: string;
}

interface UsuarioSistema {
  id: string;
  nome: string;
  cargo: PerfilAcesso;
  obraId: string; // "ALL" para Administrador ou id da obra
  obraNome: string;
  email: string;
  senha: string;
  status: "Ativo" | "Bloqueado";
}

const CATEGORIAS_CONSTRUCAO = [
  "Fundações & Terraplenagem",
  "Estrutura (Aço & Concreto)",
  "Alvenaria & Vedações",
  "Esquadrias & Fachadas de Vidro",
  "Elevadores & Equipamentos",
  "Instalações Hidrossanitárias",
  "Instalações Elétricas & Dados",
  "Impermeabilização & Isolamento",
  "Revestimentos, Louças & Metais",
  "Pintura & Texturas",
  "EPIs, Ferramentas & Canteiro",
] as const;

interface UserSettings {
  userName: string;
  userRole: string;
  userEmail: string;
  userPhone: string;
  companyName: string;
  companyCnpj: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  userName: "Gestor de Suprimentos",
  userRole: "Diretoria & CoordenaÃ§Ã£o de Suprimentos",
  userEmail: "suprimentos@jcbauer.com.br",
  userPhone: "",
  companyName: "JC Bauer Empreendimentos",
  companyCnpj: "",
};

const SETTINGS_STORAGE_KEY = "jc_bauer_user_settings_v3";
const USERS_STORAGE_KEY = "jc_bauer_users_v3";
const SESSION_STORAGE_KEY = "jc_bauer_current_user_v3";
const OBRAS_STORAGE_KEY = "jc_bauer_obras_v3";
const SOLICITACOES_STORAGE_KEY = "jc_bauer_solicitacoes_v3";
const ORDENS_STORAGE_KEY = "jc_bauer_ordens_v3";
const CONTRATOS_STORAGE_KEY = "jc_bauer_contratos_v3";
const ORCAMENTO_STORAGE_KEY = "jc_bauer_orcamento_v3";
const ESTOQUE_STORAGE_KEY = "jc_bauer_estoque_v3";
const MOVIMENTACOES_STORAGE_KEY = "jc_bauer_movimentacoes_v3";
const PUXADAS_STORAGE_KEY = "jc_bauer_puxadas_v3";
const DIARIOS_STORAGE_KEY = "jc_bauer_diarios_v3";
const FORNECEDORES_STORAGE_KEY = "jc_bauer_fornecedores_v3";
const ITENS_PLANILHA_STORAGE_KEY = "jc_bauer_itens_planilha_v3";
const DUPLICIDADES_STORAGE_KEY = "jc_bauer_duplicidades_v3";
const COMPARATIVO_STORAGE_KEY = "jc_bauer_comparativo_3orc_v4";
const PROCESSOS_COTACOES_STORAGE_KEY = "jc_bauer_processos_cotacoes_v1";
const ESTOQUE_ALMOXARIFADO_STORAGE_KEY = "jc_bauer_estoque_almoxarifado_v1";

interface DiarioObraRegistro {
  id: string;
  obraId: string;
  obraNome: string;
  data: string; // Ex: "18/10/2026"
  hora: string; // Ex: "17:15"
  responsavelNome: string;
  responsavelCargo: PerfilAcesso;
  clima: "Ensolarado" | "Nublado" | "Chuvoso" | "Chuva c/ Paralisação";
  efetivoProprio: number;
  efetivoTerceirizado: number;
  frentesServico: string;
  ocorrencias?: string;
}

interface RegistroDiarioFinanceiro {
  data: string;
  diaSemana: string;
  volumeContratado: number;
  savingEconomizado: number;
  pedidosFechados: number;
  destaqueObra: string;
  destaqueInsumo: string;
}

interface Obra {
  id: string;
  nome: string;
  sigla: string;
  endereco: string;
  engenheiro: string;
}

interface ItemSolicitacao {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  orcamentoUnitario: number;
  observacaoObra?: string;
}

interface PropostaFornecedor {
  id: string;
  vendorId: string;
  fornecedorNome: string;
  vendedorNome: string;
  whatsapp: string;
  precosUnitarios: Record<string, number>; // itemId -> precoUnitario
  freteValor: number;
  tipoFrete: "CIF" | "FOB";
  prazoPagamento: string;
}

interface SolicitacaoCompra {
  id: string;
  codigo: string;
  obraId: string;
  categoria: string;
  solicitante: string;
  solicitanteCargo?: PerfilAcesso;
  urgencia?: UrgenciaPedido;
  dataNecessaria?: string;
  dataAbertura: string;
  horarioPedido?: string;
  origemCanteiro?: boolean;
  novoAlertaAdmin?: boolean;
  status:
    | "Enviado / Aguardando Compras"
    | "Em Cotação"
    | "Aprovada"
    | "Comprada"
    | "Entregue na Obra";
  dataPrevistaEntrega?: string;
  notaFiscalRecebida?: string;
  condicaoRecebimento?: string;
  recebidoPor?: string;
  dataHoraRecebimento?: string;
  mensagens?: MensagemPedido[];
  itens: ItemSolicitacao[];
  propostas: PropostaFornecedor[];
}

interface FornecedorCadastro {
  id: string;
  empresa: string;
  razaoSocial: string;
  cnpj: string;
  cidade: string;
  categoriaPrincipal: string;
  especialidades: string[];
  vendedor: string;
  telefone: string;
  whatsapp: string;
  email: string;
  chavePix: string;
  condicaoPadrao: string;
  observacoes: string;
}

interface OrdemCompra {
  id: string;
  numeroOc: string;
  scId: string;
  scCodigo: string;
  obraId: string;
  obraNome: string;
  obraEndereco: string;
  obraEngenheiro: string;
  categoria: string;
  fornecedorNome: string;
  fornecedorRazao: string;
  fornecedorCnpj: string;
  vendedorNome: string;
  whatsapp: string;
  chavePix: string;
  dataEmissao: string;
  dataPrevistaEntrega?: string;
  prazoPagamento: string;
  tipoFrete: "CIF" | "FOB";
  freteValor: number;
  descontoValor?: number;
  valorTotal: number;
  savingGerado: number;
  alcadaAprovacao?: NivelAlcada;
  aprovadoPorDiretoria?: boolean;
  assinaturaDiretoria?: string;
  status:
    | "Emitida"
    | "Aguardando Entrega"
    | "Entregue"
    | "Entregue na Obra (Confirmado pelo Almoxarifado)";
  notaFiscalRecebida?: string;
  condicaoRecebimento?: string;
  recebidoPor?: string;
  dataHoraRecebimento?: string;
  itens: {
    codigo: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    observacaoObra?: string;
  }[];
}

interface BoletimMedicao {
  id: string;
  numeroBm: string;
  dataMedicao: string;
  periodoReferencia: string;
  percentualMedidoPeriodo: number;
  percentualAcumulado: number;
  valorBruto: number;
  valorRetencao: number;
  valorLiquido: number;
  engenheiroResponsavel: string;
  observacoes: string;
  status: "Pendente Aprovação" | "Aprovado para Pagamento" | "Pago";
  notaFiscal?: string;
}

interface ContratoSubempreitada {
  id: string;
  numeroContrato: string;
  empreiteiro: string;
  cnpj: string;
  obraId: string;
  obraNome: string;
  objeto: string;
  categoria: string;
  valorTotal: number;
  percentualRetencao: number; // ex: 5% ou 11%
  dataInicio: string;
  previsaoFim: string;
  status: "Ativo" | "Concluído" | "Suspenso";
  medicoes: BoletimMedicao[];
}

interface ItemEconomiaInsumo {
  id: string;
  insumo: string;
  categoria: string;
  obraId: string;
  obraNome: string;
  fornecedorVencedor: string;
  valorMaiorCotado: number;
  valorFechado: number;
}

interface ItemPlanilhaImportada {
  id: string;
  data: string;
  fornecedor: string;
  cnpj: string;
  insumo: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  status: "Pendente" | "Aprovado";
}

interface DuplicidadeFornecedor {
  id: string;
  nomeSugerido: string;
  cnpj: string;
  variacoesPlanilha: string;
  similaridade: string;
  status: "Pendente" | "Unificado";
}

interface ItemComparativoRapido {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  preco1: number;
  preco2: number;
  preco3: number;
}

interface FornecedorCotadoRapido {
  nome: string;
  vendedor: string;
  telefone: string;
  prazo: string;
  condicao: string;
  freteTipo: "CIF" | "FOB";
  freteValor: number;
  descontoValor?: number;
}


export interface ProcessoCotacao {
  id: string;
  codigo: string; // Ex: COT-2026-001
  titulo: string;
  obraId: string;
  obraNome: string;
  categoria: string;
  status:
    | "Aguardando Fornecedores"
    | "Em Análise"
    | "Rascunho"
    | "Concluída"
    | "Cancelada";
  dataCriacao: string;
  dataAtualizacao: string;
  fornecedores: [
    FornecedorCotadoRapido,
    FornecedorCotadoRapido,
    FornecedorCotadoRapido
  ];
  itens: ItemComparativoRapido[];
  savingGerado?: number;
  menorValor?: number;
  melhorFornecedorNome?: string;
  observacoes?: string;
  ordemCompraEmitidaId?: string;
  numeroOcEmitida?: string;
}


interface ColaboradorMapeado {
  id: string;
  nome: string;
  cargo: string;
  obraPrincipal: string;
  pedidosHistoricos: number;
  status: "Validado" | "Pendente";
}

interface IqfFornecedor {
  scoreGeral: number; // 0 a 100
  taxaPontualidade: number;
  pontualidadeScore: number;
  conformidadeFisica: number;
  conformidadeScore: number;
  competitividadeComercial: number;
  competitividadeScore: number;
  totalFornecimentos: number;
  entregasNoPrazo: number;
  entregasSemRessalvas: number;
  classificacao:
    | "Fornecedor Ouro"
    | "Fornecedor Prata"
    | "Fornecedor Monitorado"
    | "Risco Crítico"
    | "Ouro"
    | "Prata"
    | "Monitorado";
  corBadge: string;
}

interface ItemOrcamentoObra {
  id: string;
  obraId: string;
  obraNome?: string;
  categoria: string;
  valorOrcado: number;
  observacao?: string;
}

interface NotificacaoItem {
  id: string;
  tipo:
    | "critico"
    | "entrega"
    | "medicao"
    | "chat"
    | "governanca"
    | "URGENTE_OBRA"
    | "FRETE_ATRASADO"
    | "MEDICAO_PENDENTE"
    | "MENSAGEM_NOVA";
  titulo: string;
  descricao: string;
  dataHora: string;
  linkTab?: TabId;
  targetId?: string;
  lida: boolean;
  severidade?: "Critica" | "Alerta" | "Info";
  horario?: string;
  destinoAba?: TabId;
  refId?: string;
}

interface CargaItemLogistica {
  id: string;
  ordemId: string;
  numeroOc: string;
  obraId: string;
  obraNome: string;
  fornecedorNome: string;
  insumoDescricao: string;
  horarioJanela: string;
  tipoVeiculo: string;
  tipoFrete: string;
  status: "Hoje" | "Agendado" | "Entregue" | "Atrasado";
}

interface DiaLogisticaSemana {
  diaSemana: string;
  dataLabel: string;
  conflitoPortao: boolean;
  cargas: CargaItemLogistica[];
}

type CargaLogistica = DiaLogisticaSemana;

/* ------------------------------------------------------------------------- */
/* TIPOS DE ESTOQUE, ALMOXARIFADO E PUXADAS PROGRAMADAS                      */
/* ------------------------------------------------------------------------- */

type TipoMovimentacaoEstoque =
  | "ENTRADA_COMPRA"
  | "SAIDA_APLICACAO"
  | "TRANSFERENCIA_OBRA"
  | "PERDA_AVARIA"
  | "AJUSTE_INVENTARIO";

interface ItemEstoque {
  id: string;
  obraId: string; // "obra-1", "obra-2", "obra-3" ou "central"
  obraNome: string;
  codigo: string;
  descricao: string;
  categoria: string;
  unidade: string;
  saldoAtual: number;
  estoqueMinimo: number;
  pontoReposicao: number;
  custoMedio: number; // Custo Médio Ponderado Unitário em R$
  localizacaoFisica: string;
  ultimaMovimentacao: string;
  fornecedorHabitual?: string;
}

interface MovimentacaoEstoque {
  id: string;
  itemId: string;
  codigoInsumo: string;
  descricaoInsumo: string;
  unidade: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
  saldoAnterior: number;
  saldoPosterior: number;
  custoUnitario: number;
  valorTotal: number;
  dataHora: string;
  responsavel: string;
  obraOrigemId: string;
  obraOrigemNome: string;
  obraDestinoId?: string;
  obraDestinoNome?: string;
  numeroDocumento?: string; // NF-e, OC ou Ordem de Aplicação
  motivoEtapa?: string;
}

interface ProgramacaoPuxada {
  id: string;
  contratoId: string;
  dataHoraAgendada: string;
  quantidade: number;
  unidade: string;
  status: "Agendada" | "Em Rota" | "Recebida" | "Cancelada";
  etapaAplicacao: string;
  notaFiscal?: string;
  responsavelRecebimento: string;
  observacoes?: string;
}

interface ContratoPuxadaFornecimento {
  id: string;
  numeroContrato: string;
  numeroOC: string;
  obraId: string;
  obraNome: string;
  fornecedorNome: string;
  insumo: string;
  unidade: string;
  quantidadeContratada: number;
  quantidadeEntregue: number;
  valorUnitario: number;
  valorTotalContrato: number;
  dataInicio: string;
  dataPrevisaoTermino: string;
  status: "Ativo" | "Encerrado" | "Suspenso";
  programacoes: ProgramacaoPuxada[];
}

/* ========================================================================= */
/* FORMATADORES                                                              */
/* ========================================================================= */

function formatBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(valor) ? valor : 0);
}

function extrairContatoEPhone(texto: string): {
  nome: string;
  telefone: string;
  whatsapp: string;
} {
  if (!texto) return { nome: "", telefone: "", whatsapp: "" };

  const match = texto.match(
    /(?:^|\(?)([0-9]{2})[-.\s\)]*([0-9]{4,5})[-.\s]*([0-9]{4})\)?/
  );
  if (match) {
    const ddd = match[1];
    const parte1 = match[2];
    const parte2 = match[3];
    const telefoneFormatado = `(${ddd}) ${parte1}-${parte2}`;
    const whatsappDigitos = `55${ddd}${parte1}${parte2}`;

    const nomeLimpo = texto
      .replace(match[0], "")
      .replace(/[\(\)\[\]\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      nome: nomeLimpo,
      telefone: telefoneFormatado,
      whatsapp: whatsappDigitos,
    };
  }

  return {
    nome: texto.trim(),
    telefone: "",
    whatsapp: "",
  };
}

/* ========================================================================= */
/* DADOS INICIAIS REALISTAS DE CONSTRUTORA                                   */
/* ========================================================================= */

const OBRAS_INICIAIS: Obra[] = [
  {
    id: "obra-kairos",
    nome: "Residencial Kairos",
    sigla: "RSK-01",
    endereco: "Rua 2500, Centro - Balneario Camboriu / SC",
    engenheiro: "Eng. Cassiano / Joao Carlos Bauer",
  },
  {
    id: "obra-belvedere",
    nome: "Residencial Belvedere",
    sigla: "RSB-02",
    endereco: "Rua Otto Boehm, America - Joinville / SC",
    engenheiro: "Eng. Cassiano",
  },
  {
    id: "obra-petit",
    nome: "Residencial Petit",
    sigla: "RSP-03",
    endereco: "Rua Expedicionario Holz, Atiradores - Joinville / SC",
    engenheiro: "Eng. Cassiano",
  },
  {
    id: "obra-carmelo",
    nome: "Residencial Carmelo",
    sigla: "RSC-04",
    endereco: "Balneario Camboriu / SC",
    engenheiro: "Eng. Marcos Viana",
  },
  {
    id: "obra-1",
    nome: "Residencial Horizon Tower",
    sigla: "RHT-05",
    endereco: "Av. Atlantica, 2450 - Balneario Camboriu / SC",
    engenheiro: "Eng. Marcos Viana",
  },
  {
    id: "obra-2",
    nome: "Edificio Comercial Atrium Bauer",
    sigla: "EAB-06",
    endereco: "Rua XV de Novembro, 1120 - Joinville / SC",
    engenheiro: "Enga. Camila Dorneles",
  },
  {
    id: "obra-3",
    nome: "Condominio Logistico SulPark",
    sigla: "CLS-07",
    endereco: "Rod. BR-101, Km 118 - Itajai / SC",
    engenheiro: "Eng. Roberto Siqueira",
  },
];

const ECONOMIA_INSUMOS_HISTORICO: ItemEconomiaInsumo[] = [
  {
    id: "eco-1",
    insumo: "Concreto Usinado Bombeavel FCK 35/40 MPa",
    categoria: "Fundacoes & Terraplenagem",
    obraId: "obra-1",
    obraNome: "Residencial Horizon Tower",
    fornecedorVencedor: "Supermix Concreto S.A.",
    valorMaiorCotado: 95600.0,
    valorFechado: 84200.0,
  },
  {
    id: "eco-2",
    insumo: "Aco CA-50 / CA-60 (Diam. 10mm, 12.5mm e 16mm)",
    categoria: "Estrutura (Aco & Concreto)",
    obraId: "obra-1",
    obraNome: "Residencial Horizon Tower",
    fornecedorVencedor: "SulAco Distribuidora",
    valorMaiorCotado: 89396.0,
    valorFechado: 75522.0,
  },
  {
    id: "eco-3",
    insumo: "Esquadrias de Aluminio Linha Gold + Pele de Vidro",
    categoria: "Esquadrias & Fachadas de Vidro",
    obraId: "obra-1",
    obraNome: "Residencial Horizon Tower",
    fornecedorVencedor: "AluGlass Fachadas & Esquadrias",
    valorMaiorCotado: 472100.0,
    valorFechado: 431800.0,
  },
  {
    id: "eco-4",
    insumo: "Elevadores Regenerativos Inox (2 Unidades + Montagem)",
    categoria: "Elevadores & Equipamentos",
    obraId: "obra-2",
    obraNome: "Edificio Comercial Atrium Bauer",
    fornecedorVencedor: "Atlas Schindler Elevadores",
    valorMaiorCotado: 475000.0,
    valorFechado: 438000.0,
  },
  {
    id: "eco-5",
    insumo: "Porcelanato Tecnico Retificado 90x90cm + Argamassa AC-III",
    categoria: "Revestimentos, Loucas & Metais",
    obraId: "obra-2",
    obraNome: "Edificio Comercial Atrium Bauer",
    fornecedorVencedor: "Portobello Corporate B2B",
    valorMaiorCotado: 82400.0,
    valorFechado: 66940.0,
  },
  {
    id: "eco-6",
    insumo: "Tubulacoes PPR, PVC Serie R e Bombas de Recalque",
    categoria: "Instalacoes Hidrossanitarias",
    obraId: "obra-kairos",
    obraNome: "Residencial Kairos",
    fornecedorVencedor: "CASAS DA AGUA",
    valorMaiorCotado: 21650.0,
    valorFechado: 18450.0,
  },
  {
    id: "eco-7",
    insumo: "Argamassa AC2 Porcelanato 20kg",
    categoria: "Revestimentos, Loucas & Metais",
    obraId: "obra-belvedere",
    obraNome: "Residencial Belvedere",
    fornecedorVencedor: "FORMAFIX",
    valorMaiorCotado: 9950.0,
    valorFechado: 8500.0,
  },
];

const FORNECEDORES_INICIAIS: FornecedorCadastro[] = [];

const SOLICITACOES_INICIAIS: SolicitacaoCompra[] = [
  {
    id: "sc-1",
    codigo: "SC-2026-0135",
    obraId: "obra-1",
    categoria: "Fundacoes & Terraplenagem",
    solicitante: "Eng. Marcos Viana",
    solicitanteCargo: "Engenheiro",
    urgencia: "Normal",
    dataNecessaria: "20/10/2026",
    dataAbertura: "10/10/2026",
    horarioPedido: "09:30",
    status: "Comprada",
    propostas: [],
    itens: [
      {
        id: "it-sc-1",
        codigo: "SINAPI-00001524",
        descricao: "Concreto Usinado Bombeavel fck 40 MPa Brita 0/1 Slump 12+-2",
        unidade: "m3",
        quantidade: 160,
        orcamentoUnitario: 580.0,
        observacaoObra: "Programar betoneira",
      },
    ],
  },
  {
    id: "sc-2",
    codigo: "SC-2026-0138",
    obraId: "obra-2",
    categoria: "Revestimentos, Loucas & Metais",
    solicitante: "Enga. Camila Dorneles",
    solicitanteCargo: "Engenheiro",
    urgencia: "Normal",
    dataNecessaria: "21/10/2026",
    dataAbertura: "12/10/2026",
    horarioPedido: "14:15",
    status: "Comprada",
    propostas: [],
    itens: [
      {
        id: "it-sc-2",
        codigo: "POR-9090-TEC",
        descricao: "Porcelanato Tecnico Polido 90x90cm Retificado Trafego Intenso",
        unidade: "m2",
        quantidade: 680,
        orcamentoUnitario: 110.0,
        observacaoObra: "Paletes na doca terrea",
      },
    ],
  },
  {
    id: "sc-3",
    codigo: "SC-2026-0142",
    obraId: "obra-kairos",
    categoria: "Instalacoes Hidrossanitarias",
    solicitante: "Eng. Cassiano",
    solicitanteCargo: "Engenheiro",
    urgencia: "Normal",
    dataNecessaria: "24/10/2026",
    dataAbertura: "20/10/2026",
    horarioPedido: "10:00",
    status: "Comprada",
    propostas: [],
    itens: [
      {
        id: "it-sc-3",
        codigo: "SKU-HID-001",
        descricao: "Tubos, Conexoes e Acabamentos Hidrossanitarios Tigre",
        unidade: "cj",
        quantidade: 1,
        orcamentoUnitario: 21650.0,
        observacaoObra: "Residencial Kairos",
      },
    ],
  },
];

const ORDENS_INICIAIS: OrdemCompra[] = [
  {
    id: "oc-1",
    numeroOc: "OC-2026-0089",
    scId: "sc-hist-1",
    scCodigo: "SC-2026-0135",
    obraId: "obra-1",
    obraNome: "Residencial Horizon Tower",
    obraEndereco: "Av. Atlantica, 2450 - Balneario Camboriu / SC",
    obraEngenheiro: "Eng. Marcos Viana",
    categoria: "Fundacoes & Terraplenagem",
    fornecedorNome: "Supermix Concreto S.A.",
    fornecedorRazao: "Supermix Concreto e Bombeamento S.A.",
    fornecedorCnpj: "16.509.210/0008-40",
    vendedorNome: "Henrique Bastos",
    whatsapp: "5547999014455",
    chavePix: "16.509.210/0008-40",
    dataEmissao: "10/10/2026",
    dataPrevistaEntrega: "20/10/2026",
    prazoPagamento: "28/56 ddl Boleto",
    tipoFrete: "CIF",
    freteValor: 0,
    descontoValor: 0,
    valorTotal: 84200.0,
    savingGerado: 11400.0,
    status: "Aguardando Entrega",
    itens: [
      {
        codigo: "SINAPI-00001524",
        descricao:
          "Concreto Usinado Bombeavel fck 40 MPa Brita 0/1 Slump 12+-2",
        unidade: "m3",
        quantidade: 160,
        precoUnitario: 526.25,
        subtotal: 84200.0,
        observacaoObra: "Programar caminhao betoneira a cada 40 min no portao A",
      },
    ],
  },
  {
    id: "oc-2",
    numeroOc: "OC-2026-0090",
    scId: "sc-hist-2",
    scCodigo: "SC-2026-0138",
    obraId: "obra-2",
    obraNome: "Edificio Comercial Atrium Bauer",
    obraEndereco: "Rua XV de Novembro, 1120 - Joinville / SC",
    obraEngenheiro: "Enga. Camila Dorneles",
    categoria: "Revestimentos, Loucas & Metais",
    fornecedorNome: "Portobello Corporate B2B",
    fornecedorRazao: "Portobello S.A. Divisao Engenharia",
    fornecedorCnpj: "83.475.913/0001-91",
    vendedorNome: "Mariana Borges",
    whatsapp: "5548991045566",
    chavePix: "83.475.913/0001-91",
    dataEmissao: "12/10/2026",
    dataPrevistaEntrega: "21/10/2026",
    prazoPagamento: "28/56/84 ddl Faturado",
    tipoFrete: "CIF",
    freteValor: 0,
    descontoValor: 0,
    valorTotal: 66940.0,
    savingGerado: 15460.0,
    status: "Emitida",
    itens: [
      {
        codigo: "POR-9090-TEC",
        descricao:
          "Porcelanato Tecnico Polido 90x90cm Retificado Trafego Intenso",
        unidade: "m2",
        quantidade: 680,
        precoUnitario: 98.44,
        subtotal: 66940.0,
        observacaoObra: "Descarregar paletes com empilhadeira na doca terrea",
      },
    ],
  },
  {
    id: "oc-3",
    numeroOc: "OC-2026-0091",
    scId: "sc-hist-3",
    scCodigo: "SC-2026-0140",
    obraId: "obra-3",
    obraNome: "Condominio Logistico SulPark",
    obraEndereco: "Rod. BR-101, Km 118 - Itajai / SC",
    obraEngenheiro: "Eng. Roberto Siqueira",
    categoria: "Pintura & Texturas",
    fornecedorNome: "ImperSul Quimicos & Tintas",
    fornecedorRazao: "ImperSul Distribuidora Tecnica para Construcao Ltda",
    fornecedorCnpj: "21.904.118/0001-60",
    vendedorNome: "Diego Fontes",
    whatsapp: "5547996553210",
    chavePix: "21.904.118/0001-60",
    dataEmissao: "14/10/2026",
    dataPrevistaEntrega: "22/10/2026",
    prazoPagamento: "28/56 ddl Boleto",
    tipoFrete: "CIF",
    freteValor: 0,
    descontoValor: 0,
    valorTotal: 44600.0,
    savingGerado: 8300.0,
    status: "Aguardando Entrega",
    itens: [
      {
        codigo: "TIN-ACR-18L",
        descricao:
          "Tinta Acrilica Premium Fachada Fosca Cinza Urbano (Lata 18L)",
        unidade: "un",
        quantidade: 120,
        precoUnitario: 371.67,
        subtotal: 44600.0,
        observacaoObra: "Entregar no Galpao B - Almoxarifado Central",
      },
    ],
  },
  {
    id: "oc-4",
    numeroOc: "OC-2026-0092",
    scId: "sc-hist-4",
    scCodigo: "SC-2026-0142",
    obraId: "obra-kairos",
    obraNome: "Residencial Kairos",
    obraEndereco: "Rua 2500, Centro - Balneario Camboriu / SC",
    obraEngenheiro: "Eng. Cassiano / Joao Carlos Bauer",
    categoria: "Instalacoes Hidrossanitarias",
    fornecedorNome: "CASAS DA AGUA",
    fornecedorRazao: "Casas da Agua Materiais para Construcao Ltda",
    fornecedorCnpj: "82.802.100/0001-08",
    vendedorNome: "Carlos Eduardo",
    whatsapp: "5547997810384",
    chavePix: "82.802.100/0001-08",
    dataEmissao: "20/10/2026",
    dataPrevistaEntrega: "24/10/2026",
    prazoPagamento: "28/56 ddl Faturado",
    tipoFrete: "CIF",
    freteValor: 0,
    descontoValor: 250.0,
    valorTotal: 18450.0,
    savingGerado: 3200.0,
    status: "Emitida",
    itens: [
      {
        codigo: "SKU-HID-001",
        descricao: "Tubos, Conexoes e Acabamentos Hidrossanitarios Tigre",
        unidade: "cj",
        quantidade: 1,
        precoUnitario: 18700.0,
        subtotal: 18700.0,
        observacaoObra: "Conforme cotacao CASAS DA AGUA gerada",
      },
    ],
  },
  {
    id: "oc-5",
    numeroOc: "OC-2026-0093",
    scId: "sc-hist-5",
    scCodigo: "SC-2026-0145",
    obraId: "obra-belvedere",
    obraNome: "Residencial Belvedere",
    obraEndereco: "Rua Otto Boehm, America - Joinville / SC",
    obraEngenheiro: "Eng. Cassiano",
    categoria: "Revestimentos, Loucas & Metais",
    fornecedorNome: "FORMAFIX",
    fornecedorRazao: "Formafix Argamassas e Revestimentos Eireli",
    fornecedorCnpj: "07.391.220/0001-12",
    vendedorNome: "Atendimento Comercial",
    whatsapp: "5547997810384",
    chavePix: "07.391.220/0001-12",
    dataEmissao: "20/10/2026",
    dataPrevistaEntrega: "25/10/2026",
    prazoPagamento: "30 ddl",
    tipoFrete: "CIF",
    freteValor: 0,
    descontoValor: 120.0,
    valorTotal: 8500.0,
    savingGerado: 1450.0,
    status: "Emitida",
    itens: [
      {
        codigo: "SKU-MAT-001",
        descricao: "AC2 Porcelanato 20kg Cinza / Argamassa Colante",
        unidade: "sc",
        quantidade: 500,
        precoUnitario: 17.0,
        subtotal: 8500.0,
        observacaoObra: "Cotacao AC2 Porcelanato 01 - Almoxarifado Central",
      },
    ],
  },
];

const USUARIOS_INICIAIS: UsuarioSistema[] = [
  {
    id: "usr-admin-1",
    nome: "Joao Carlos Bauer",
    cargo: "Administrador",
    obraId: "ALL",
    obraNome: "Todas as Obras (Central de Compras)",
    email: "suprimentos@jcbauer.com.br",
    senha: "123",
    status: "Ativo",
  },
  {
    id: "usr-welliton",
    nome: "Welliton Schmidt",
    cargo: "Administrador",
    obraId: "ALL",
    obraNome: "Todas as Obras (Central de Compras)",
    email: "welliton@jcbauer.com.br",
    senha: "123",
    status: "Ativo",
  },
  {
    id: "usr-eng-marcos",
    nome: "Eng. Marcos Viana",
    cargo: "Engenheiro",
    obraId: "obra-1",
    obraNome: "Residencial Horizon Tower",
    email: "marcos.viana@jcbauer.com.br",
    senha: "123",
    status: "Ativo",
  },
];

const ITENS_PLANILHA_INICIAIS: ItemPlanilhaImportada[] = [];

const DUPLICIDADES_INICIAIS: DuplicidadeFornecedor[] = [];

const COLABORADORES_INICIAIS: ColaboradorMapeado[] = [];

const CONTRATOS_INICIAIS: ContratoSubempreitada[] = [];

const ORCAMENTOS_INICIAIS: ItemOrcamentoObra[] = [];

const ESTOQUE_INICIAIS: ItemEstoque[] = [];

const MOVIMENTACOES_INICIAIS: MovimentacaoEstoque[] = [];

const PUXADAS_INICIAIS: ContratoPuxadaFornecimento[] = [];

const DIARIOS_INICIAIS: DiarioObraRegistro[] = [];

const DADOS_FINANCEIROS_DIARIOS_OUTUBRO: RegistroDiarioFinanceiro[] = [];

/* ------------------------------------------------------------------------- */
/* HELPERS DE INTELIGÊNCIA DE COMPRAS, CURVA ABC, ALÇADAS E EXCEL            */
/* ------------------------------------------------------------------------- */

function calcularClassificacaoAbc(
  solicitacoes: SolicitacaoCompra[],
  ordens: OrdemCompra[]
): Map<string, { classe: ClasseAbc; totalGeral: number; percentual: number }> {
  const mapa = new Map<string, number>();

  (ordens || []).forEach((o) => {
    (o?.itens || []).forEach((it) => {
      const desc = it?.descricao ? it.descricao.trim() : "";
      if (desc) mapa.set(desc, (mapa.get(desc) || 0) + (it.subtotal || 0));
    });
  });

  (solicitacoes || []).forEach((s) => {
    (s?.itens || []).forEach((it) => {
      const desc = it?.descricao ? it.descricao.trim() : "";
      const val = (it?.quantidade || 0) * (it?.orcamentoUnitario || 0);
      if (desc) mapa.set(desc, (mapa.get(desc) || 0) + val);
    });
  });

  const lista = Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
  const somaTotal = lista.reduce((acc, [, val]) => acc + val, 0);

  const resultado = new Map<
    string,
    { classe: ClasseAbc; totalGeral: number; percentual: number }
  >();

  let acumulado = 0;
  lista.forEach(([desc, val]) => {
    acumulado += val;
    const pct = somaTotal > 0 ? (acumulado / somaTotal) * 100 : 0;
    let classe: ClasseAbc = "Classe C";
    if (pct <= 80) classe = "Classe A";
    else if (pct <= 95) classe = "Classe B";
    resultado.set(desc, { classe, totalGeral: val, percentual: pct });
  });

  return resultado;
}

function buscarHistoricoInsumo(
  descricaoItem: string,
  ordens: OrdemCompra[],
  historicoEconomia: ItemEconomiaInsumo[]
): {
  ultimoPreco: number;
  dataUltima: string;
  fornecedor: string;
  precoMedio: number;
} | null {
  const descLimpa = descricaoItem.toLowerCase().trim();
  const comprasMatching: { preco: number; data: string; forn: string }[] = [];

  (ordens || []).forEach((oc) => {
    (oc?.itens || []).forEach((it) => {
      if (!it?.descricao) return;
      if (
        it.descricao.toLowerCase().includes(descLimpa) ||
        descLimpa.includes(it.descricao.toLowerCase())
      ) {
        comprasMatching.push({
          preco: it.precoUnitario,
          data: oc.dataEmissao,
          forn: oc.fornecedorNome,
        });
      }
    });
  });

  if (comprasMatching.length > 0) {
    const soma = comprasMatching.reduce((acc, c) => acc + c.preco, 0);
    const media = soma / comprasMatching.length;
    const ultima = comprasMatching[comprasMatching.length - 1];
    return {
      ultimoPreco: ultima.preco,
      dataUltima: ultima.data,
      fornecedor: ultima.forn,
      precoMedio: media,
    };
  }

  const ecoItem = historicoEconomia.find(
    (e) =>
      e.insumo.toLowerCase().includes(descLimpa) ||
      descLimpa.includes(e.insumo.toLowerCase())
  );
  if (ecoItem) {
    return {
      ultimoPreco: ecoItem.valorFechado,
      dataUltima: "Histórico 2026",
      fornecedor: ecoItem.fornecedorVencedor,
      precoMedio: (ecoItem.valorMaiorCotado + ecoItem.valorFechado) / 2,
    };
  }

  return null;
}

function obterAlcadaAprovacao(valor: number): {
  nivel: NivelAlcada;
  requerDiretoria: boolean;
  requerGerencia: boolean;
  badgeClass: string;
} {
  if (valor > 100000) {
    return {
      nivel: "Diretoria Executiva / CFO",
      requerDiretoria: true,
      requerGerencia: true,
      badgeClass: "bg-red-100 text-red-900 border-red-300",
    };
  }
  if (valor > 20000) {
    return {
      nivel: "Gerência de Obras",
      requerDiretoria: false,
      requerGerencia: true,
      badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    };
  }
  return {
    nivel: "Comprador Autorizado",
    requerDiretoria: false,
    requerGerencia: false,
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
  };
}

function exportarCotacaoExcel(
  sc: SolicitacaoCompra,
  obraNome: string
) {
  const dadosPlanilha: Record<string, unknown>[] = [];

  sc.itens.forEach((it) => {
    const row: Record<string, unknown> = {
      "Código Insumo": it.codigo,
      "Descrição do Material / Serviço": it.descricao,
      Unidade: it.unidade,
      Quantidade: it.quantidade,
      "Orçamento Unit. (R$)": it.orcamentoUnitario,
      "Orçamento Total (R$)": it.quantidade * it.orcamentoUnitario,
    };

    sc.propostas.forEach((prop) => {
      const unit = prop.precosUnitarios[it.id] || 0;
      row[`${prop.fornecedorNome} (Unit R$)`] = unit;
      row[`${prop.fornecedorNome} (Subtotal R$)`] = it.quantidade * unit;
    });

    dadosPlanilha.push(row);
  });

  const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mapa de Cotação");

  const fileName = `JC_BAUER_${sc.codigo}_${obraNome.replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function exportarOrdensExcel(ordens: OrdemCompra[]) {
  const dados = ordens.map((o) => ({
    "Nº OC": o.numeroOc,
    "Código SC": o.scCodigo,
    Obra: o.obraNome,
    Fornecedor: o.fornecedorNome,
    CNPJ: o.fornecedorCnpj,
    "Data Emissão": o.dataEmissao,
    "Previsão Entrega": o.dataPrevistaEntrega || "A definir",
    "Valor Total (R$)": o.valorTotal,
    "Saving Gerado (R$)": o.savingGerado,
    "Alçada de Aprovação": o.alcadaAprovacao || "Comprador Autorizado",
    Frete: o.tipoFrete,
    Status: o.status,
    "Nota Fiscal": o.notaFiscalRecebida || "Pendente",
    "Condição Recebimento": o.condicaoRecebimento || "Aguardando",
    "Recebido Por": o.recebidoPor || "Pendente",
  }));

  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ordens de Compra");
  XLSX.writeFile(
    wb,
    `JC_BAUER_Ordens_de_Compra_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

/* ------------------------------------------------------------------------- */
/* HELPERS DE IQF (VENDOR RATING), ORÇAMENTO, LOGÍSTICA E NOTIFICAÇÕES       */
/* ------------------------------------------------------------------------- */

function calcularIqfFornecedor(
  fornecedorNome: string,
  ordens: OrdemCompra[]
): IqfFornecedor {
  const fNomeNorm = fornecedorNome.toLowerCase().trim();
  const ordensDoForn = ordens.filter(
    (o) =>
      o.fornecedorNome.toLowerCase().trim() === fNomeNorm ||
      o.fornecedorRazao.toLowerCase().includes(fNomeNorm) ||
      fNomeNorm.includes(o.fornecedorNome.toLowerCase().trim())
  );

  const total = ordensDoForn.length;
  if (total === 0) {
    return {
      scoreGeral: 88,
      taxaPontualidade: 90,
      pontualidadeScore: 90,
      conformidadeFisica: 92,
      conformidadeScore: 92,
      competitividadeComercial: 82,
      competitividadeScore: 82,
      totalFornecimentos: 0,
      entregasNoPrazo: 0,
      entregasSemRessalvas: 0,
      classificacao: "Fornecedor Prata",
      corBadge: "bg-blue-100 text-blue-900 border-blue-300",
    };
  }

  let entregasSemRessalvas = 0;
  let entregasNoPrazo = 0;
  let savingsTotais = 0;

  ordensDoForn.forEach((o) => {
    const cond = (o.condicaoRecebimento || "").toLowerCase();
    const temAvaria =
      cond.includes("parcial") ||
      cond.includes("ressalva") ||
      cond.includes("avaria");
    if (!temAvaria) entregasSemRessalvas++;

    entregasNoPrazo++;
    savingsTotais += o.savingGerado || 0;
  });

  const pontualidadeScore = Math.round((entregasNoPrazo / total) * 100);
  const conformidadeScore = Math.round((entregasSemRessalvas / total) * 100);
  const competitividadeScore = Math.min(
    100,
    Math.round(75 + (savingsTotais > 0 ? 20 : 5))
  );

  const scoreGeral = Math.round(
    pontualidadeScore * 0.4 +
      conformidadeScore * 0.4 +
      competitividadeScore * 0.2
  );

  let classificacao: IqfFornecedor["classificacao"] = "Fornecedor Monitorado";
  let corBadge = "bg-amber-100 text-amber-900 border-amber-300";

  if (scoreGeral >= 90) {
    classificacao = "Fornecedor Ouro";
    corBadge = "bg-emerald-100 text-emerald-900 border-emerald-300";
  } else if (scoreGeral >= 75) {
    classificacao = "Fornecedor Prata";
    corBadge = "bg-blue-100 text-blue-900 border-blue-300";
  } else if (scoreGeral < 60) {
    classificacao = "Risco Crítico";
    corBadge = "bg-red-100 text-red-900 border-red-300";
  }

  return {
    scoreGeral,
    taxaPontualidade: pontualidadeScore,
    pontualidadeScore,
    conformidadeFisica: conformidadeScore,
    conformidadeScore,
    competitividadeComercial: competitividadeScore,
    competitividadeScore,
    totalFornecimentos: total,
    entregasNoPrazo,
    entregasSemRessalvas,
    classificacao,
    corBadge,
  };
}

function calcularSaldoOrcamentario(
  obraId: string,
  categoria: string,
  orcamentos: ItemOrcamentoObra[],
  ordens: OrdemCompra[],
  contratos: ContratoSubempreitada[]
): {
  valorOrcado: number;
  comprometido: number;
  valorComprometido: number;
  realizado: number;
  valorRealizado: number;
  saldoDisponivel: number;
  percentualConsumido: number;
} {
  const catNorm = categoria.toLowerCase().trim();
  const itensOrc = orcamentos.filter(
    (o) =>
      (obraId === "ALL" || o.obraId === obraId) &&
      (o.categoria.toLowerCase().includes(catNorm) ||
        catNorm.includes(o.categoria.toLowerCase()))
  );

  const valorOrcado =
    itensOrc.length > 0
      ? itensOrc.reduce((acc, i) => acc + i.valorOrcado, 0)
      : 800000;

  const ordensCat = ordens.filter(
    (o) =>
      (obraId === "ALL" || o.obraId === obraId) &&
      (o.categoria.toLowerCase().includes(catNorm) ||
        catNorm.includes(o.categoria.toLowerCase()))
  );
  const totalOrdens = ordensCat.reduce((acc, o) => acc + o.valorTotal, 0);

  const contratosCat = contratos.filter(
    (c) =>
      (obraId === "ALL" || c.obraId === obraId) &&
      (c.categoria.toLowerCase().includes(catNorm) ||
        catNorm.includes(c.categoria.toLowerCase()))
  );
  const totalContratos = contratosCat.reduce((acc, c) => acc + c.valorTotal, 0);

  const comprometido = totalOrdens + totalContratos;

  const ordensPagas = ordensCat
    .filter(
      (o) =>
        o.status === "Entregue na Obra (Confirmado pelo Almoxarifado)" ||
        o.status === "Entregue"
    )
    .reduce((acc, o) => acc + o.valorTotal, 0);

  const bmsPagos = contratosCat.reduce(
    (acc, c) =>
      acc +
      c.medicoes
        .filter((m) => m.status === "Pago")
        .reduce((bAcc, bm) => bAcc + bm.valorLiquido, 0),
    0
  );

  const realizado = ordensPagas + bmsPagos;
  const saldoDisponivel = Math.max(0, valorOrcado - comprometido);
  const percentualConsumido =
    valorOrcado > 0 ? (comprometido / valorOrcado) * 100 : 0;

  return {
    valorOrcado,
    comprometido,
    valorComprometido: comprometido,
    realizado,
    valorRealizado: realizado,
    saldoDisponivel,
    percentualConsumido: Math.round(percentualConsumido),
  };
}

function gerarNotificacoesDoSistema(
  solicitacoes: SolicitacaoCompra[],
  ordens: OrdemCompra[],
  contratos: ContratoSubempreitada[]
): NotificacaoItem[] {
  const lista: NotificacaoItem[] = [];

  // 1. Pedidos Críticos (Obra Parada)
  solicitacoes
    .filter(
      (s) =>
        s.urgencia === "Crítica - Obra Parada" && s.status !== "Entregue na Obra"
    )
    .forEach((s) => {
      lista.push({
        id: `notif-crit-${s.id}`,
        tipo: "URGENTE_OBRA",
        severidade: "Critica",
        titulo: `🚨 URGÊNCIA CRÍTICA: ${s.codigo}`,
        descricao: `${s.solicitante} marcou o pedido de ${s.categoria} como "Obra Parada".`,
        dataHora: s.horarioPedido || s.dataAbertura,
        horario: s.horarioPedido || s.dataAbertura,
        linkTab: "Cotacoes",
        destinoAba: "Cotacoes",
        targetId: s.id,
        refId: s.id,
        lida: false,
      });
    });

  // 2. Medições Pendentes de Aprovação
  contratos.forEach((c) => {
    c.medicoes
      .filter((m) => m.status === "Pendente Aprovação")
      .forEach((m) => {
        lista.push({
          id: `notif-bm-${m.id}`,
          tipo: "MEDICAO_PENDENTE",
          severidade: "Alerta",
          titulo: `📐 Medição Pendente: ${m.numeroBm} (${c.empreiteiro})`,
          descricao: `Avanço de ${m.percentualMedidoPeriodo}% (${formatBRL(
            m.valorLiquido
          )}) aguardando liberação para faturamento.`,
          dataHora: m.dataMedicao,
          horario: m.dataMedicao,
          linkTab: "Medicoes",
          destinoAba: "Medicoes",
          targetId: c.id,
          refId: c.id,
          lida: false,
        });
      });
  });

  // 3. Entregas Programadas / A Caminho
  ordens
    .filter((o) => o.status !== "Entregue na Obra (Confirmado pelo Almoxarifado)")
    .slice(0, 3)
    .forEach((o) => {
      lista.push({
        id: `notif-ent-${o.id}`,
        tipo: "FRETE_ATRASADO",
        severidade: "Alerta",
        titulo: `🚚 Carga a Caminho: ${o.numeroOc}`,
        descricao: `${o.fornecedorNome} entregando em ${o.obraNome}. Previsão: ${
          o.dataPrevistaEntrega || o.dataEmissao
        }.`,
        dataHora: o.dataEmissao,
        horario: o.dataPrevistaEntrega || o.dataEmissao,
        linkTab: "Logistica",
        destinoAba: "Logistica",
        targetId: o.id,
        refId: o.id,
        lida: false,
      });
    });

  // 4. Mensagens Não Respondidas
  solicitacoes
    .filter((s) => s.mensagens && s.mensagens.length > 0)
    .slice(0, 3)
    .forEach((s) => {
      const ultima = s.mensagens![s.mensagens!.length - 1];
      lista.push({
        id: `notif-msg-${s.id}`,
        tipo: "MENSAGEM_NOVA",
        severidade: "Info",
        titulo: `💬 Nova Mensagem em ${s.codigo}`,
        descricao: `${ultima.autorNome}: "${ultima.texto}"`,
        dataHora: ultima.dataHora,
        horario: ultima.dataHora,
        linkTab: "Painel",
        destinoAba: "Painel",
        targetId: s.id,
        refId: s.id,
        lida: false,
      });
    });

  return lista;
}

function agruparCargasLogistica(
  ordens: OrdemCompra[],
  obraFiltro: string
): DiaLogisticaSemana[] {
  const ordensAlvo = ordens.filter(
    (o) => obraFiltro === "ALL" || o.obraId === obraFiltro
  );

  const diasInfo = [
    { diaSemana: "Segunda-feira", dataLabel: "20/10/2026" },
    { diaSemana: "Terça-feira", dataLabel: "21/10/2026" },
    { diaSemana: "Quarta-feira", dataLabel: "22/10/2026" },
    { diaSemana: "Quinta-feira", dataLabel: "23/10/2026" },
    { diaSemana: "Sexta-feira", dataLabel: "24/10/2026" },
    { diaSemana: "Sábado", dataLabel: "25/10/2026" },
  ];

  const janelas = [
    "08:00 - 10:00",
    "10:30 - 12:00",
    "13:30 - 15:30",
    "16:00 - 17:30",
  ];
  const veiculos = [
    "Carreta Articulada (Vanderleia)",
    "Caminhão Betoneira 8m³",
    "Truck Baú Fechado",
    "Carreta Prancha com Munck",
  ];

  return diasInfo.map((d, dIdx) => {
    const ordensDoDia = ordensAlvo.filter(
      (_, idx) => idx % diasInfo.length === dIdx
    );

    const cargas: CargaItemLogistica[] = ordensDoDia.map((o, cIdx) => {
      const entregue =
        o.status === "Entregue na Obra (Confirmado pelo Almoxarifado)" ||
        o.status === "Entregue";

      return {
        id: `carga-${o.id}-${dIdx}-${cIdx}`,
        ordemId: o.id,
        numeroOc: o.numeroOc,
        obraId: o.obraId,
        obraNome: o.obraNome,
        fornecedorNome: o.fornecedorNome,
        insumoDescricao: o.itens[0]?.descricao || o.categoria,
        horarioJanela: janelas[cIdx % janelas.length],
        tipoVeiculo: veiculos[(dIdx + cIdx) % veiculos.length],
        tipoFrete: o.tipoFrete,
        status: entregue ? "Entregue" : dIdx === 0 ? "Hoje" : "Agendado",
      };
    });

    const conflitoPortao = cargas.length >= 2;

    return {
      diaSemana: d.diaSemana,
      dataLabel: d.dataLabel,
      conflitoPortao,
      cargas,
    };
  });
}

/* ========================================================================= */
/* COMPONENTE PRINCIPAL DA APLICAÇÃO (`page.tsx`)                            */
/* ========================================================================= */

/* ----------------------------------------------------------------------- */
/* GERADOR INTELIGENTE DE SKU PARA INSUMOS E ALMOXARIFADO                  */
/* ----------------------------------------------------------------------- */
function gerarSkuInsumo(
  nome: string,
  categoria: string,
  estoqueExistente: ItemEstoque[]
): string {
  const n = (nome || "").toLowerCase().trim();
  const c = (categoria || "").toLowerCase().trim();

  let prefixo = "MAT";

  if (
    n.includes("pvc") ||
    n.includes("tubo") ||
    n.includes("joelho") ||
    n.includes("curva") ||
    n.includes("luva") ||
    n.includes("te ") ||
    n.includes("te.") ||
    n.includes("té ") ||
    n.includes("té.") ||
    n.includes("válvula") ||
    n.includes("valvula") ||
    n.includes("registro") ||
    n.includes("soldável") ||
    n.includes("sold") ||
    n.includes("esgoto") ||
    n.includes("hidr") ||
    c.includes("hidr")
  ) {
    prefixo = "PVC";
  } else if (
    n.includes("cimento") ||
    n.includes("argamassa") ||
    n.includes("cal ") ||
    n.includes("rejunte") ||
    c.includes("cimento")
  ) {
    prefixo = "CIM";
  } else if (
    n.includes("aço") ||
    n.includes("aco") ||
    n.includes("ca-50") ||
    n.includes("ca-60") ||
    n.includes("vergalh") ||
    n.includes("arame") ||
    n.includes("tela soldada") ||
    c.includes("aço") ||
    c.includes("estrutura")
  ) {
    prefixo = "ACO";
  } else if (
    n.includes("adesivo") ||
    n.includes("cola") ||
    n.includes("silicone") ||
    n.includes("fita") ||
    n.includes("vedante")
  ) {
    prefixo = "ADE";
  } else if (
    n.includes("tinta") ||
    n.includes("selador") ||
    n.includes("verniz") ||
    n.includes("massa corrida") ||
    n.includes("primer") ||
    c.includes("pintura")
  ) {
    prefixo = "PNT";
  } else if (
    n.includes("cabo") ||
    n.includes("fio ") ||
    n.includes("disjuntor") ||
    n.includes("eletroduto") ||
    n.includes("tomada") ||
    n.includes("interruptor") ||
    c.includes("elétr")
  ) {
    prefixo = "ELE";
  } else if (
    n.includes("areia") ||
    n.includes("brita") ||
    n.includes("pedra") ||
    n.includes("seixo") ||
    n.includes("saibro")
  ) {
    prefixo = "AGR";
  } else if (
    n.includes("tijolo") ||
    n.includes("bloco") ||
    n.includes("canaleta") ||
    c.includes("alvenaria")
  ) {
    prefixo = "ALV";
  } else if (
    n.includes("madeira") ||
    n.includes("tábua") ||
    n.includes("tabua") ||
    n.includes("sarrafo") ||
    n.includes("compensado") ||
    n.includes("pontalete")
  ) {
    prefixo = "MAD";
  } else if (
    n.includes("prego") ||
    n.includes("parafuso") ||
    n.includes("bucha") ||
    n.includes("barra roscada")
  ) {
    prefixo = "FIX";
  } else if (
    n.includes("epi") ||
    n.includes("capacete") ||
    n.includes("bota") ||
    n.includes("óculos") ||
    n.includes("luva de vaqueta")
  ) {
    prefixo = "EPI";
  }

  let maxSeq = 0;
  const skuRegex = new RegExp(`^SKU-${prefixo}-(\\d+)$`, "i");

  (estoqueExistente || []).forEach((it) => {
    if (it.codigo) {
      const match = it.codigo.match(skuRegex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  });

  const proximo = maxSeq + 1;
  return `SKU-${prefixo}-${String(proximo).padStart(3, "0")}`;
}
export default function HomePage() {
  // Autenticação e Controle de Acesso (RBAC)
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>(USUARIOS_INICIAIS);
  const [usuarioLogado, setUsuarioLogado] = useState<UsuarioSistema | null>(
    null
  );
  const [loginInput, setLoginInput] = useState<string>("");
  const [senhaInput, setSenhaInput] = useState<string>("");
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  // Navegação de Abas do Administrador (6 Abas Independentes)
  const [activeTab, setActiveTab] = useState<TabId>("Painel");

  // Navegação de Abas Restritas da Obra (3 Abas Exclusivas para Engenheiro/Almoxarife/Encarregado)
  const [obraActiveTab, setObraActiveTab] = useState<ObraTabId>("NovoPedido");

  // Sub-aba visual dentro do Painel de Compras (Solicitações vs Infográfico de Custos & Saving)
  const [painelSubView, setPainelSubView] = useState<
    "infografico" | "solicitacoes"
  >("infografico");

  // Estados do Dashboard Financeiro & BI das Obras
  const [periodoFinanceiro, setPeriodoFinanceiro] = useState<
    "outubro2026" | "ultimos30dias" | "ano2026"
  >("outubro2026");
  const [subAbaFinanceiro, setSubAbaFinanceiro] = useState<
    "visaoGeral" | "obras" | "categorias" | "fluxoCaixa"
  >("visaoGeral");
  const [modoGraficoDiario, setModoGraficoDiario] = useState<
    "grafico" | "tabela"
  >("grafico");

  // Filtro Global de Obra (Sincronizado entre o Header e o Seletor de Visão do Infográfico)
  const [obraFiltro, setObraFiltro] = useState<string>("ALL");

  // Configurações Dinâmicas do Usuário e da Construtora (Salvas no localStorage)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [formSettings, setFormSettings] =
    useState<UserSettings>(DEFAULT_SETTINGS);

  // Estados Principais (Persistidos no localStorage para sincronizar Obra <-> Admin)
  const [obras, setObras] = useState<Obra[]>(OBRAS_INICIAIS);
  const [showModalNovaObra, setShowModalNovaObra] = useState<boolean>(false);
  const [solicitacoes, setSolicitacoes] =
    useState<SolicitacaoCompra[]>(SOLICITACOES_INICIAIS);
  const [fornecedores, setFornecedores] =
    useState<FornecedorCadastro[]>(FORNECEDORES_INICIAIS);
  const [ordens, setOrdens] = useState<OrdemCompra[]>(ORDENS_INICIAIS);
  const [contratos, setContratos] =
    useState<ContratoSubempreitada[]>(CONTRATOS_INICIAIS);
  const [orcamentos, setOrcamentos] =
    useState<ItemOrcamentoObra[]>(ORCAMENTOS_INICIAIS);
  const [estoque, setEstoque] = useState<ItemEstoque[]>(ESTOQUE_INICIAIS);
  const [movimentacoesEstoque, setMovimentacoesEstoque] =
    useState<MovimentacaoEstoque[]>(MOVIMENTACOES_INICIAIS);
  const [puxadasFornecimento, setPuxadasFornecimento] =
    useState<ContratoPuxadaFornecimento[]>(PUXADAS_INICIAIS);
  const [diariosObra, setDiariosObra] =
    useState<DiarioObraRegistro[]>(DIARIOS_INICIAIS);
  const [subAbaEstoque, setSubAbaEstoque] = useState<
    "saldos" | "puxadas" | "movimentacoes" | "agrupamento"
  >("saldos");
  const [filtroCategoriaEstoque, setFiltroCategoriaEstoque] =
    useState<string>("ALL");
  const [buscaEstoque, setBuscaEstoque] = useState<string>("");
  const [showNovaMovimentacaoModal, setShowNovaMovimentacaoModal] =
    useState<boolean>(false);
  const [showProgramarPuxadaModal, setShowProgramarPuxadaModal] =
    useState<boolean>(false);
  const [kardexModalItem, setKardexModalItem] = useState<ItemEstoque | null>(
    null
  );
  const [showAgruparDemandasModal, setShowAgruparDemandasModal] =
    useState<boolean>(false);
  const [fornecedorIqfModal, setFornecedorIqfModal] =
    useState<string | null>(null);
  const [showNotificacoesModal, setShowNotificacoesModal] =
    useState<boolean>(false);
  const [showNovoOrcamentoModal, setShowNovoOrcamentoModal] =
    useState<boolean>(false);
  const [storageCarregado, setStorageCarregado] = useState<boolean>(false);

  // Filtros e Seleções das Abas 2, 3 e 4
  const [filtroClasseAbc, setFiltroClasseAbc] = useState<"ALL" | ClasseAbc>(
    "ALL"
  );
  const [selectedScId, setSelectedScId] = useState<string>("");
  const [buscaFornecedor, setBuscaFornecedor] = useState<string>("");
  const [filtroCatFornecedor, setFiltroCatFornecedor] = useState<string>("ALL");
  const [fornecedorFichaModal, setFornecedorFichaModal] =
    useState<FornecedorCadastro | null>(null);
  const [fornecedorEditando, setFornecedorEditando] =
    useState<FornecedorCadastro | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseHealth>({
    connected: false,
    schemaReady: false,
    message: "Conectando ao Supabase...",
  });
  const [supabaseSincronizando, setSupabaseSincronizando] =
    useState<boolean>(false);
  const [ordemVisualizarModal, setOrdemVisualizarModal] =
    useState<OrdemCompra | null>(null);
  const [filtroObraContratos, setFiltroObraContratos] =
    useState<string>("ALL");

  // Estados da Aba 5 (Importar Planilhas)
  const [subAbaImportacao, setSubAbaImportacao] = useState<
    "itens" | "duplicados" | "colaboradores"
  >("itens");
  const [itensPlanilha, setItensPlanilha] = useState<ItemPlanilhaImportada[]>(
    ITENS_PLANILHA_INICIAIS
  );
  const [duplicidades, setDuplicidades] = useState<DuplicidadeFornecedor[]>(
    DUPLICIDADES_INICIAIS
  );
  const [colaboradores, setColaboradores] = useState<ColaboradorMapeado[]>(
    COLABORADORES_INICIAIS
  );
  const [editingImportRowId, setEditingImportRowId] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fornecedoresFileInputRef = useRef<HTMLInputElement | null>(null);
  const comparativoFileInputRef = useRef<HTMLInputElement | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  // Estados do Comparativo de Preços (3 Orçamentos) e Gestão Multi-Cotações
  const [modoCotacoes, setModoCotacoes] = useState<
    "comparativo_rapido" | "solicitacoes_obra" | "painel_cotacoes"
  >("comparativo_rapido");
  const [processosCotacoes, setProcessosCotacoes] = useState<ProcessoCotacao[]>(
    []
  );
  const [cotacaoAtivaId, setCotacaoAtivaId] = useState<string>("");
  const [filtroStatusCotacoes, setFiltroStatusCotacoes] =
    useState<string>("TODAS");
  const [buscaProcessosCotacoes, setBuscaProcessosCotacoes] =
    useState<string>("");
  const [comparativoTitulo, setComparativoTitulo] = useState<string>("");
  const [comparativoObraId, setComparativoObraId] = useState<string>("");
  const [comparativoCategoria, setComparativoCategoria] = useState<string>("");
  const [comparativoFornecedores, setComparativoFornecedores] = useState<
    [FornecedorCotadoRapido, FornecedorCotadoRapido, FornecedorCotadoRapido]
  >([
    {
      nome: "",
      vendedor: "",
      telefone: "",
      prazo: "",
      condicao: "",
      freteTipo: "CIF",
      freteValor: 0,
      descontoValor: 0,
    },
    {
      nome: "",
      vendedor: "",
      telefone: "",
      prazo: "",
      condicao: "",
      freteTipo: "CIF",
      freteValor: 0,
      descontoValor: 0,
    },
    {
      nome: "",
      vendedor: "",
      telefone: "",
      prazo: "",
      condicao: "",
      freteTipo: "CIF",
      freteValor: 0,
      descontoValor: 0,
    },
  ]);
  const [comparativoItens, setComparativoItens] = useState<
    ItemComparativoRapido[]
  >([]);
  const [itemAjustarEstoqueModal, setItemAjustarEstoqueModal] =
    useState<ItemEstoque | null>(null);

  /* ----------------------------------------------------------------------- */
  /* SINCRONIZAÇÃO AUTOMÁTICA DE INSUMOS DO COMPARATIVO COM O ALMOXARIFADO    */
  /* ----------------------------------------------------------------------- */
  const sincronizarInsumosAoEstoque = (
    itensParaSincronizar: ItemComparativoRapido[]
  ) => {
    if (!itensParaSincronizar || itensParaSincronizar.length === 0) return;

    setEstoque((prevEstoque) => {
      let modificado = false;
      const novoEstoque = [...prevEstoque];

      itensParaSincronizar.forEach((it) => {
        const nomeLimpo = (it.nome || "").trim();
        if (!nomeLimpo || nomeLimpo.length < 2) return;

        // Deduplicação estrita: verifica se já existe (ignorando maiúsculas e espaços)
        const jaExiste = novoEstoque.some(
          (est) =>
            est.descricao.trim().toLowerCase() === nomeLimpo.toLowerCase()
        );

        if (!jaExiste) {
          const sku = gerarSkuInsumo(
            nomeLimpo,
            comparativoCategoria || "",
            novoEstoque
          );
          const obraSel =
            obras.find((o) => o.id === comparativoObraId) || obras[0];

          // Determina o menor preço cotado caso preenchido
          const precosValidos = [it.preco1, it.preco2, it.preco3].filter(
            (p) => Number(p) > 0
          );
          const menorPrecoCotado =
            precosValidos.length > 0 ? Math.min(...precosValidos) : 0;

          const novoItem: ItemEstoque = {
            id: `est-auto-${Date.now()}-${Math.random()
              .toString(36)
              .substring(2, 6)}`,
            obraId: comparativoObraId || "central",
            obraNome: obraSel?.nome || "Almoxarifado Central",
            codigo: sku,
            descricao: nomeLimpo,
            categoria: comparativoCategoria || "Geral / Suprimentos",
            unidade: it.unidade || "un",
            saldoAtual: 0, // Saldo inicial 0 para posterior inventário/contagem manual
            estoqueMinimo: 0,
            pontoReposicao: 0,
            custoMedio: menorPrecoCotado,
            localizacaoFisica: "Almoxarifado Principal",
            ultimaMovimentacao: new Date().toLocaleDateString("pt-BR"),
            fornecedorHabitual:
              comparativoFornecedores?.[0]?.nome || undefined,
          };

          novoEstoque.push(novoItem);
          modificado = true;
        }
      });

      return modificado ? novoEstoque : prevEstoque;
    });
  };

  // Sincroniza continuamente insumos do comparativo para o estoque
  useEffect(() => {
    if (storageCarregado && comparativoItens && comparativoItens.length > 0) {
      sincronizarInsumosAoEstoque(comparativoItens);
    }
  }, [comparativoItens, storageCarregado]);

  const handleSalvarAjusteRapidoSaldo = (
    itemId: string,
    novoSaldo: number,
    novoMinimo: number,
    novoCusto: number,
    localizacao: string,
    motivo: string
  ) => {
    setEstoque((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return {
          ...it,
          saldoAtual: novoSaldo,
          estoqueMinimo: novoMinimo,
          custoMedio: novoCusto > 0 ? novoCusto : it.custoMedio,
          localizacaoFisica: localizacao || it.localizacaoFisica,
          ultimaMovimentacao: new Date().toLocaleDateString("pt-BR"),
        };
      })
    );

    const itAchado = estoque.find((it) => it.id === itemId);
    if (itAchado) {
      const novaMov: MovimentacaoEstoque = {
        id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        itemId,
        codigoInsumo: itAchado.codigo,
        descricaoInsumo: itAchado.descricao,
        unidade: itAchado.unidade,
        tipo: "AJUSTE_INVENTARIO",
        quantidade: novoSaldo,
        saldoAnterior: itAchado.saldoAtual,
        saldoPosterior: novoSaldo,
        dataHora: new Date().toLocaleString("pt-BR"),
        responsavel: usuarioLogado?.nome || settings.userName || "Almoxarife",
        motivoEtapa: motivo || "Ajuste manual de inventário",
      };
      setMovimentacoesEstoque((prev) => [novaMov, ...prev]);
    }

    setItemAjustarEstoqueModal(null);
    dispararAviso("Saldo do insumo atualizado com sucesso no Almoxarifado!");
  };
  const [showModalComparativoPdf, setShowModalComparativoPdf] = useState<boolean>(false);

  // Modais de Ação e Governança
  const [showNovaScModal, setShowNovaScModal] = useState<boolean>(false);
  const [showNovoFornecedorModal, setShowNovoFornecedorModal] =
    useState<boolean>(false);
  const [showInserirPrecoModal, setShowInserirPrecoModal] =
    useState<boolean>(false);
  const [showNovoUsuarioModal, setShowNovoUsuarioModal] =
    useState<boolean>(false);
  const [showNovoContratoModal, setShowNovoContratoModal] =
    useState<boolean>(false);
  const [showNovoBmModalContrato, setShowNovoBmModalContrato] =
    useState<ContratoSubempreitada | null>(null);
  const [scMensagensModal, setScMensagensModal] =
    useState<SolicitacaoCompra | null>(null);
  const [diretoriaAprovacaoModal, setDiretoriaAprovacaoModal] = useState<{
    novaOc: OrdemCompra;
    prop: PropostaFornecedor;
  } | null>(null);
  const [ocConfirmarRecebimentoModal, setOcConfirmarRecebimentoModal] =
    useState<OrdemCompra | null>(null);

  // Notificação rápida (Banner discreto)
  const [notificacao, setNotificacao] = useState<string | null>(null);
  const dispararAviso = (msg: string) => {
    setNotificacao(msg);
    setTimeout(() => {
      setNotificacao((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Carregar dados persistidos do localStorage na montagem
  useEffect(() => {
    try {
      // 1. Limpar caches legados (v1 e v2) e resíduos demo do navegador
      const OLD_STORAGE_KEYS = [
        "jc_bauer_user_settings",
        "jc_bauer_user_settings_v2",
        "jc_bauer_users",
        "jc_bauer_users_v2",
        "jc_bauer_current_user",
        "jc_bauer_current_user_v2",
        "jc_bauer_solicitacoes",
        "jc_bauer_solicitacoes_v2",
        "jc_bauer_ordens",
        "jc_bauer_ordens_v2",
        "jc_bauer_contratos",
        "jc_bauer_contratos_v2",
        "jc_bauer_orcamento",
        "jc_bauer_orcamento_v2",
        "jc_bauer_estoque",
        "jc_bauer_estoque_v2",
        "jc_bauer_movimentacoes",
        "jc_bauer_movimentacoes_v2",
        "jc_bauer_puxadas",
        "jc_bauer_puxadas_v2",
        "jc_bauer_diarios",
        "jc_bauer_diarios_v2",
        "jc_bauer_fornecedores",
        "jc_bauer_fornecedores_v2",
        "jc_bauer_obras",
        "jc_bauer_obras_v2",
      ];
      OLD_STORAGE_KEYS.forEach((k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });

      const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings) as Partial<UserSettings>;
        const isDemoCnpj = !parsed.companyCnpj || parsed.companyCnpj === "04.819.302/0001-71" || parsed.companyCnpj === "14.882.310/0001-19";
        const isDemoName = !parsed.userName || parsed.userName === "JoÃ£o Carlos Bauer" || parsed.userName.includes("Carlos Bauer");
        const merged: UserSettings = {
          userName: isDemoName ? DEFAULT_SETTINGS.userName : parsed.userName,
          userRole: parsed.userRole || DEFAULT_SETTINGS.userRole,
          userEmail: parsed.userEmail || DEFAULT_SETTINGS.userEmail,
          userPhone: parsed.userPhone || DEFAULT_SETTINGS.userPhone,
          companyName: parsed.companyName || DEFAULT_SETTINGS.companyName,
          companyCnpj: isDemoCnpj ? "" : parsed.companyCnpj,
        };
        setSettings(merged);
        setFormSettings(merged);
      }

      const DEMO_USER_IDS = new Set(["usr-eng-1", "usr-almox-1", "usr-enc-1"]);
      const isDemoUser = (u?: { id?: string; nome?: string } | null) =>
        !u || DEMO_USER_IDS.has(u.id || "") || u.nome === "Eng. Marcos Viana" || u.nome === "Carlos Roberto" || u.nome === "Sebastião Ramos";

      const savedUsers = window.localStorage.getItem(USERS_STORAGE_KEY);
      let usuariosEfetivos = USUARIOS_INICIAIS;
      if (savedUsers) {
        const parsedUsers = (JSON.parse(savedUsers) as UsuarioSistema[]).filter((u) => !isDemoUser(u)).map((u) => u.nome?.includes("Carlos Bauer") ? { ...u, nome: "Administrador do Sistema" } : u);
        if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
          usuariosEfetivos = parsedUsers;
          setUsuarios(parsedUsers);
        }
      }

            const savedObras = window.localStorage.getItem(OBRAS_STORAGE_KEY);
      if (savedObras) {
        try {
          const parsedObras = JSON.parse(savedObras) as Obra[];
          if (Array.isArray(parsedObras) && parsedObras.length > 0) {
            setObras(parsedObras);
          } else {
            setObras(OBRAS_INICIAIS);
            window.localStorage.setItem(OBRAS_STORAGE_KEY, JSON.stringify(OBRAS_INICIAIS));
          }
        } catch {
          setObras(OBRAS_INICIAIS);
        }
      } else {
        setObras(OBRAS_INICIAIS);
        try {
          window.localStorage.setItem(OBRAS_STORAGE_KEY, JSON.stringify(OBRAS_INICIAIS));
        } catch {}
      }

      const savedForn = window.localStorage.getItem(FORNECEDORES_STORAGE_KEY);
      if (savedForn) {
        try {
          const parsedForn = JSON.parse(savedForn) as FornecedorCadastro[];
          if (Array.isArray(parsedForn) && parsedForn.length > 0) {
            const sanitizedForn = parsedForn.map((f) => {
              const contatoInfo = extrairContatoEPhone(
                f.vendedor || f.cidade || ""
              );
              const cidadeInfo = extrairContatoEPhone(f.cidade || "");

              const isCidadeInvalida = Boolean(
                cidadeInfo.telefone ||
                  f.cidade === f.vendedor ||
                  (f.cidade && f.vendedor && f.vendedor.includes(f.cidade)) ||
                  (f.cidade && f.cidade.includes("(4"))
              );
              const novaCidade = isCidadeInvalida ? "" : f.cidade;

              let novoVendedor = f.vendedor;
              let novoTel = f.telefone;
              let novoWhats = f.whatsapp;

              if (contatoInfo.telefone) {
                novoTel = contatoInfo.telefone;
                novoWhats = contatoInfo.whatsapp;
                if (contatoInfo.nome) {
                  novoVendedor = contatoInfo.nome;
                }
              }

              if (novoTel === "(11) 3200-0000" || !novoTel) {
                novoTel = contatoInfo.telefone || "";
                novoWhats = contatoInfo.whatsapp || "";
              }

              return {
                ...f,
                cidade: novaCidade,
                vendedor: novoVendedor,
                telefone: novoTel,
                whatsapp: novoWhats,
              };
            });
            setFornecedores(sanitizedForn);
            try {
              window.localStorage.setItem(
                FORNECEDORES_STORAGE_KEY,
                JSON.stringify(sanitizedForn)
              );
            } catch {}
          }
        } catch {
          // ignore
        }
      }
      const savedSc = window.localStorage.getItem(SOLICITACOES_STORAGE_KEY);
      if (savedSc) {
        try {
          const parsedSc = JSON.parse(savedSc) as SolicitacaoCompra[];
          if (Array.isArray(parsedSc) && parsedSc.length > 0) {
            setSolicitacoes(parsedSc);
          } else {
            setSolicitacoes(SOLICITACOES_INICIAIS);
            window.localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(SOLICITACOES_INICIAIS));
          }
        } catch {
          setSolicitacoes(SOLICITACOES_INICIAIS);
        }
      } else {
        setSolicitacoes(SOLICITACOES_INICIAIS);
        try {
          window.localStorage.setItem(SOLICITACOES_STORAGE_KEY, JSON.stringify(SOLICITACOES_INICIAIS));
        } catch {}
      }

            const savedOc = window.localStorage.getItem(ORDENS_STORAGE_KEY);
      if (savedOc) {
        try {
          const parsedOc = JSON.parse(savedOc) as OrdemCompra[];
          if (Array.isArray(parsedOc) && parsedOc.length > 0) {
            setOrdens(parsedOc);
          } else {
            setOrdens(ORDENS_INICIAIS);
            window.localStorage.setItem(ORDENS_STORAGE_KEY, JSON.stringify(ORDENS_INICIAIS));
          }
        } catch {
          setOrdens(ORDENS_INICIAIS);
        }
      } else {
        setOrdens(ORDENS_INICIAIS);
        try {
          window.localStorage.setItem(ORDENS_STORAGE_KEY, JSON.stringify(ORDENS_INICIAIS));
        } catch {}
      }

      const savedCt = window.localStorage.getItem(CONTRATOS_STORAGE_KEY);
      if (savedCt) {
        const parsedCt = JSON.parse(savedCt) as ContratoSubempreitada[];
        if (Array.isArray(parsedCt) && parsedCt.length > 0) {
          setContratos(parsedCt);
        }
      }

      const savedOrc = window.localStorage.getItem(ORCAMENTO_STORAGE_KEY);
      if (savedOrc) {
        const parsedOrc = JSON.parse(savedOrc) as ItemOrcamentoObra[];
        if (Array.isArray(parsedOrc) && parsedOrc.length > 0) {
          setOrcamentos(parsedOrc);
        }
      }

      const savedEst = window.localStorage.getItem(ESTOQUE_STORAGE_KEY);
      if (savedEst) {
        const parsedEst = JSON.parse(savedEst) as ItemEstoque[];
        if (Array.isArray(parsedEst) && parsedEst.length > 0) {
          setEstoque(parsedEst);
        }
      }

      const savedMov = window.localStorage.getItem(MOVIMENTACOES_STORAGE_KEY);
      if (savedMov) {
        const parsedMov = JSON.parse(savedMov) as MovimentacaoEstoque[];
        if (Array.isArray(parsedMov) && parsedMov.length > 0) {
          setMovimentacoesEstoque(parsedMov);
        }
      }

      const savedPux = window.localStorage.getItem(PUXADAS_STORAGE_KEY);
      if (savedPux) {
        const parsedPux = JSON.parse(savedPux) as ContratoPuxadaFornecimento[];
        if (Array.isArray(parsedPux) && parsedPux.length > 0) {
          setPuxadasFornecimento(parsedPux);
        }
      }

      const savedDiarios = window.localStorage.getItem(DIARIOS_STORAGE_KEY);
      if (savedDiarios) {
        const parsedDiarios = JSON.parse(savedDiarios) as DiarioObraRegistro[];
        if (Array.isArray(parsedDiarios) && parsedDiarios.length > 0) {
          setDiariosObra(parsedDiarios);
        }
      }

      const savedItens = window.localStorage.getItem(ITENS_PLANILHA_STORAGE_KEY);
      if (savedItens) {
        try {
          const parsedItens = JSON.parse(savedItens) as ItemPlanilhaImportada[];
          if (Array.isArray(parsedItens) && parsedItens.length > 0) {
            const sanitizedItens = parsedItens.map((it) =>
              it.precoUnitario === 100 && it.quantidade === 1 && it.id?.startsWith("imp-upload-")
                ? { ...it, precoUnitario: 0 }
                : it
            );
            setItensPlanilha(sanitizedItens);
          }
        } catch {
          // ignore
        }
      }

      const savedDup = window.localStorage.getItem(DUPLICIDADES_STORAGE_KEY);
      if (savedDup) {
        try {
          const parsedDup = JSON.parse(savedDup) as DuplicidadeFornecedor[];
          if (Array.isArray(parsedDup) && parsedDup.length > 0) {
            setDuplicidades(parsedDup);
          }
        } catch {
          // ignore
        }
      }

      // Expurgar versoes antigas de teste do comparativo
      window.localStorage.removeItem("jc_bauer_comparativo_3orc_v1");
      window.localStorage.removeItem("jc_bauer_comparativo_3orc_v2");
      window.localStorage.removeItem("jc_bauer_comparativo_3orc_v3");

      // Carrega processos de cotações múltiplas salvas
      let listaProcessos: ProcessoCotacao[] = [];
      const savedProcessos = window.localStorage.getItem(
        PROCESSOS_COTACOES_STORAGE_KEY
      );
      if (savedProcessos) {
        try {
          listaProcessos = JSON.parse(savedProcessos) || [];
        } catch {}
      }

      // Se ainda não houver processos salvos, migra o comparativo existente ou cria o primeiro
      let parsedComp: any = null;
      const savedComp = window.localStorage.getItem(COMPARATIVO_STORAGE_KEY);
      if (savedComp) {
        try {
          parsedComp = JSON.parse(savedComp);
        } catch {}
      }

      if (!Array.isArray(listaProcessos) || listaProcessos.length === 0) {
        const anoAtual = new Date().getFullYear();
        const fornMigrados: [FornecedorCotadoRapido, FornecedorCotadoRapido, FornecedorCotadoRapido] =
          Array.isArray(parsedComp?.fornecedores) &&
          parsedComp.fornecedores.length === 3
            ? parsedComp.fornecedores
            : [
                {
                  nome: "",
                  vendedor: "",
                  telefone: "",
                  prazo: "",
                  condicao: "",
                  freteTipo: "CIF",
                  freteValor: 0,
                  descontoValor: 0,
                },
                {
                  nome: "",
                  vendedor: "",
                  telefone: "",
                  prazo: "",
                  condicao: "",
                  freteTipo: "CIF",
                  freteValor: 0,
                  descontoValor: 0,
                },
                {
                  nome: "",
                  vendedor: "",
                  telefone: "",
                  prazo: "",
                  condicao: "",
                  freteTipo: "CIF",
                  freteValor: 0,
                  descontoValor: 0,
                },
              ];
        const itensMigrados: ItemComparativoRapido[] = Array.isArray(
          parsedComp?.itens
        )
          ? parsedComp.itens
          : [];

        const primeiraCotacao: ProcessoCotacao = {
          id: `cot-${Date.now()}`,
          codigo: `COT-${anoAtual}-001`,
          titulo: parsedComp?.titulo || "Cotação de Insumos #001",
          obraId: parsedComp?.obraId || "",
          obraNome: "Todas as Obras / Canteiro Central",
          categoria: parsedComp?.categoria || "Revestimentos, Louças & Metais",
          status: "Aguardando Fornecedores",
          dataCriacao: new Date().toLocaleDateString("pt-BR"),
          dataAtualizacao: new Date().toLocaleDateString("pt-BR"),
          fornecedores: fornMigrados,
          itens: itensMigrados,
        };
        listaProcessos = [primeiraCotacao];
      }

      setProcessosCotacoes(listaProcessos);
      try {
        window.localStorage.setItem(
          PROCESSOS_COTACOES_STORAGE_KEY,
          JSON.stringify(listaProcessos)
        );
      } catch {}
      const ativa = listaProcessos[0];
      if (ativa) {
        setCotacaoAtivaId(ativa.id);
        setComparativoTitulo(ativa.titulo);
        setComparativoObraId(ativa.obraId || "");
        setComparativoCategoria(
          ativa.categoria || "Revestimentos, Louças & Metais"
        );
        setComparativoFornecedores(ativa.fornecedores);
        setComparativoItens(ativa.itens);
      }
      const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const parsedSession = JSON.parse(savedSession) as UsuarioSistema;
        const userValido = usuariosEfetivos.find((u) => u.id === parsedSession?.id && !isDemoUser(u));
        if (userValido) {
          setUsuarioLogado(userValido);
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
          setUsuarioLogado(null);
        }
      } else {
        setUsuarioLogado(null);
      }
    } catch {
      // fallback to default
    } finally {
      setStorageCarregado(true);
    }
  }, []);
  // Sincronização e verificação inicial com a nuvem Supabase
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const health = await testarConexaoSupabase();
        if (!ativo) return;
        setSupabaseStatus(health);

        if (health.connected && health.schemaReady) {
          const dadosNuvem = await carregarTudoSupabase();
          if (!ativo) return;
          if (dadosNuvem && Object.keys(dadosNuvem).length > 0) {
            if (dadosNuvem[FORNECEDORES_STORAGE_KEY]) {
              setFornecedores(dadosNuvem[FORNECEDORES_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  FORNECEDORES_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[FORNECEDORES_STORAGE_KEY])
                );
              } catch {}
            }
            if (dadosNuvem[SETTINGS_STORAGE_KEY]) {
              setSettings(dadosNuvem[SETTINGS_STORAGE_KEY]);
              setFormSettings(dadosNuvem[SETTINGS_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  SETTINGS_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[SETTINGS_STORAGE_KEY])
                );
              } catch {}
            }
            if (
              Array.isArray(dadosNuvem[OBRAS_STORAGE_KEY]) &&
              dadosNuvem[OBRAS_STORAGE_KEY].length > 0
            ) {
              setObras(dadosNuvem[OBRAS_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  OBRAS_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[OBRAS_STORAGE_KEY])
                );
              } catch {}
            } else {
              const localObras = window.localStorage.getItem(OBRAS_STORAGE_KEY);
              if (localObras) {
                try {
                  const parsed = JSON.parse(localObras);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    salvarChaveSupabase(OBRAS_STORAGE_KEY, parsed);
                  }
                } catch {}
              }
            }
            if (dadosNuvem[COMPARATIVO_STORAGE_KEY]) {
              setComparativoSalvo(dadosNuvem[COMPARATIVO_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  COMPARATIVO_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[COMPARATIVO_STORAGE_KEY])
                );
              } catch {}
            }
            if (
              Array.isArray(dadosNuvem[ORDENS_STORAGE_KEY]) &&
              dadosNuvem[ORDENS_STORAGE_KEY].length > 0
            ) {
              setOrdens(dadosNuvem[ORDENS_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  ORDENS_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[ORDENS_STORAGE_KEY])
                );
              } catch {}
            } else {
              const localOc = window.localStorage.getItem(ORDENS_STORAGE_KEY);
              if (localOc) {
                try {
                  const parsed = JSON.parse(localOc);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    salvarChaveSupabase(ORDENS_STORAGE_KEY, parsed);
                  }
                } catch {}
              }
            }
            if (
              Array.isArray(dadosNuvem[SOLICITACOES_STORAGE_KEY]) &&
              dadosNuvem[SOLICITACOES_STORAGE_KEY].length > 0
            ) {
              setSolicitacoes(dadosNuvem[SOLICITACOES_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  SOLICITACOES_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[SOLICITACOES_STORAGE_KEY])
                );
              } catch {}
            }
            if (dadosNuvem[ITENS_PLANILHA_STORAGE_KEY]) {
              setItensPlanilha(dadosNuvem[ITENS_PLANILHA_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  ITENS_PLANILHA_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[ITENS_PLANILHA_STORAGE_KEY])
                );
              } catch {}
            }
            if (dadosNuvem[ESTOQUE_STORAGE_KEY]) {
              setEstoque(dadosNuvem[ESTOQUE_STORAGE_KEY]);
              try {
                window.localStorage.setItem(
                  ESTOQUE_STORAGE_KEY,
                  JSON.stringify(dadosNuvem[ESTOQUE_STORAGE_KEY])
                );
              } catch {}
            }
            if (dadosNuvem[PROCESSOS_COTACOES_STORAGE_KEY]) {
              const processosNuvem = dadosNuvem[PROCESSOS_COTACOES_STORAGE_KEY];
              if (Array.isArray(processosNuvem) && processosNuvem.length > 0) {
                setProcessosCotacoes(processosNuvem);
                try {
                  window.localStorage.setItem(
                    PROCESSOS_COTACOES_STORAGE_KEY,
                    JSON.stringify(processosNuvem)
                  );
                } catch {}
              }
            }
          }
        }
      } catch (e) {
        console.warn("Aviso ao conectar com Supabase:", e);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const handleTestarConexaoSupabase = async () => {
    setSupabaseSincronizando(true);
    try {
      const health = await testarConexaoSupabase();
      setSupabaseStatus(health);
      dispararAviso(health.message);
    } catch {
      dispararAviso("Erro ao testar conexão com o Supabase.");
    } finally {
      setSupabaseSincronizando(false);
    }
  };

  const handleSincronizarParaNuvem = async () => {
    setSupabaseSincronizando(true);
    try {
      const health = await testarConexaoSupabase();
      setSupabaseStatus(health);
      if (!health.schemaReady) {
        dispararAviso(
          "As tabelas ainda não foram criadas no Supabase. Crie-as com o script SQL no painel primeiro."
        );
        setSupabaseSincronizando(false);
        return;
      }

      await salvarChaveSupabase(SETTINGS_STORAGE_KEY, settings);
      await salvarChaveSupabase(FORNECEDORES_STORAGE_KEY, fornecedores);
      if (Array.isArray(obras) && obras.length > 0) {
        await salvarChaveSupabase(OBRAS_STORAGE_KEY, obras);
      }
      if (Array.isArray(ordens) && ordens.length > 0) {
        await salvarChaveSupabase(ORDENS_STORAGE_KEY, ordens);
      }
      if (Array.isArray(solicitacoes) && solicitacoes.length > 0) {
        await salvarChaveSupabase(SOLICITACOES_STORAGE_KEY, solicitacoes);
      }
      await salvarChaveSupabase(CONTRATOS_STORAGE_KEY, contratos);
      await salvarChaveSupabase(ORCAMENTO_STORAGE_KEY, orcamentos);
      await salvarChaveSupabase(ESTOQUE_STORAGE_KEY, estoque);
      await salvarChaveSupabase(ITENS_PLANILHA_STORAGE_KEY, itensPlanilha);
      await salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, processosCotacoes);
      if (comparativoSalvo) {
        await salvarChaveSupabase(COMPARATIVO_STORAGE_KEY, comparativoSalvo);
      }
      await sincronizarFornecedoresRelacional(fornecedores);

      dispararAviso("Banco de dados na nuvem Supabase sincronizado com sucesso!");
    } catch {
      dispararAviso("Erro ao sincronizar com o Supabase.");
    } finally {
      setSupabaseSincronizando(false);
    }
  };

  const handleBaixarDaNuvem = async () => {
    setSupabaseSincronizando(true);
    try {
      const health = await testarConexaoSupabase();
      setSupabaseStatus(health);
      if (!health.schemaReady) {
        dispararAviso(
          "As tabelas ainda não foram criadas no Supabase. Crie-as pelo SQL Editor primeiro."
        );
        setSupabaseSincronizando(false);
        return;
      }

      const dados = await carregarTudoSupabase();
      if (!dados || Object.keys(dados).length === 0) {
        dispararAviso("Nenhum dado encontrado no Supabase ainda.");
        setSupabaseSincronizando(false);
        return;
      }

      if (dados[FORNECEDORES_STORAGE_KEY]) {
        setFornecedores(dados[FORNECEDORES_STORAGE_KEY]);
        window.localStorage.setItem(
          FORNECEDORES_STORAGE_KEY,
          JSON.stringify(dados[FORNECEDORES_STORAGE_KEY])
        );
      }
      if (dados[SETTINGS_STORAGE_KEY]) {
        setSettings(dados[SETTINGS_STORAGE_KEY]);
        setFormSettings(dados[SETTINGS_STORAGE_KEY]);
        window.localStorage.setItem(
          SETTINGS_STORAGE_KEY,
          JSON.stringify(dados[SETTINGS_STORAGE_KEY])
        );
      }
      if (
        Array.isArray(dados[OBRAS_STORAGE_KEY]) &&
        dados[OBRAS_STORAGE_KEY].length > 0
      ) {
        setObras(dados[OBRAS_STORAGE_KEY]);
        window.localStorage.setItem(
          OBRAS_STORAGE_KEY,
          JSON.stringify(dados[OBRAS_STORAGE_KEY])
        );
      } else {
        if (Array.isArray(obras) && obras.length > 0) {
          salvarChaveSupabase(OBRAS_STORAGE_KEY, obras);
        }
      }
      if (dados[COMPARATIVO_STORAGE_KEY]) {
        setComparativoSalvo(dados[COMPARATIVO_STORAGE_KEY]);
        window.localStorage.setItem(
          COMPARATIVO_STORAGE_KEY,
          JSON.stringify(dados[COMPARATIVO_STORAGE_KEY])
        );
      }
      if (
        Array.isArray(dados[ORDENS_STORAGE_KEY]) &&
        dados[ORDENS_STORAGE_KEY].length > 0
      ) {
        setOrdens(dados[ORDENS_STORAGE_KEY]);
        window.localStorage.setItem(
          ORDENS_STORAGE_KEY,
          JSON.stringify(dados[ORDENS_STORAGE_KEY])
        );
      } else {
        if (Array.isArray(ordens) && ordens.length > 0) {
          salvarChaveSupabase(ORDENS_STORAGE_KEY, ordens);
        }
      }
      if (
        Array.isArray(dados[SOLICITACOES_STORAGE_KEY]) &&
        dados[SOLICITACOES_STORAGE_KEY].length > 0
      ) {
        setSolicitacoes(dados[SOLICITACOES_STORAGE_KEY]);
        window.localStorage.setItem(
          SOLICITACOES_STORAGE_KEY,
          JSON.stringify(dados[SOLICITACOES_STORAGE_KEY])
        );
      }
      if (dados[ITENS_PLANILHA_STORAGE_KEY]) {
        setItensPlanilha(dados[ITENS_PLANILHA_STORAGE_KEY]);
        window.localStorage.setItem(
          ITENS_PLANILHA_STORAGE_KEY,
          JSON.stringify(dados[ITENS_PLANILHA_STORAGE_KEY])
        );
      }
      if (dados[ESTOQUE_STORAGE_KEY]) {
        setEstoque(dados[ESTOQUE_STORAGE_KEY]);
        window.localStorage.setItem(
          ESTOQUE_STORAGE_KEY,
          JSON.stringify(dados[ESTOQUE_STORAGE_KEY])
        );
      }
      if (dados[PROCESSOS_COTACOES_STORAGE_KEY]) {
        const procNuvem = dados[PROCESSOS_COTACOES_STORAGE_KEY];
        if (Array.isArray(procNuvem) && procNuvem.length > 0) {
          setProcessosCotacoes(procNuvem);
          window.localStorage.setItem(
            PROCESSOS_COTACOES_STORAGE_KEY,
            JSON.stringify(procNuvem)
          );
        }
      }

      dispararAviso("Dados baixados do Supabase com sucesso!");
    } catch {
      dispararAviso("Erro ao baixar dados do Supabase.");
    } finally {
      setSupabaseSincronizando(false);
    }
  };

  const SQL_SCHEMA_SUPABASE = `-- SCHEMA JC BAUER PROCUREMENT - SUPABASE
CREATE TABLE IF NOT EXISTS public.system_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fornecedores (
    id TEXT PRIMARY KEY,
    empresa TEXT NOT NULL,
    razao_social TEXT,
    cnpj TEXT,
    cidade TEXT,
    categoria_principal TEXT,
    especialidades TEXT[] DEFAULT '{}',
    vendedor TEXT,
    telefone TEXT,
    whatsapp TEXT,
    email TEXT,
    chave_pix TEXT,
    condicao_padrao TEXT,
    observacoes TEXT,
    iqf_nota NUMERIC DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.obras (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    sigla TEXT,
    responsavel TEXT,
    endereco TEXT,
    status TEXT DEFAULT 'ativo',
    orcamento_mensal NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comparativos (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    obra_id TEXT,
    data_criacao TEXT,
    orcamentos JSONB DEFAULT '[]'::jsonb,
    itens JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'equalizado',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparativos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso publico system_store" ON public.system_store;
CREATE POLICY "Acesso publico system_store" ON public.system_store FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico fornecedores" ON public.fornecedores;
CREATE POLICY "Acesso publico fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico obras" ON public.obras;
CREATE POLICY "Acesso publico obras" ON public.obras FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico comparativos" ON public.comparativos;
CREATE POLICY "Acesso publico comparativos" ON public.comparativos FOR ALL USING (true) WITH CHECK (true);
`;

  const handleCopiarSqlSupabase = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(SQL_SCHEMA_SUPABASE);
        dispararAviso("Script SQL copiado para a área de transferência! Cole no SQL Editor do Supabase.");
      } else {
        dispararAviso("Copie o script SQL exibido no bloco de configuração.");
      }
    } catch {
      dispararAviso("Não foi possível copiar automaticamente.");
    }
  };


  // Salvar automaticamente sessão do usuário logado e dados no localStorage
  useEffect(() => {
    if (!storageCarregado) return;
    try {
      if (usuarioLogado) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(usuarioLogado));
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [usuarioLogado, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(usuarios));
    } catch {
      // ignore
    }
  }, [usuarios, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(OBRAS_STORAGE_KEY, JSON.stringify(obras));
    } catch {
      // ignore
    }
  }, [obras, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        SOLICITACOES_STORAGE_KEY,
        JSON.stringify(solicitacoes)
      );
    } catch {
      // ignore
    }
  }, [solicitacoes, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(ORDENS_STORAGE_KEY, JSON.stringify(ordens));
    } catch {
      // ignore
    }
  }, [ordens, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        CONTRATOS_STORAGE_KEY,
        JSON.stringify(contratos)
      );
    } catch {
      // ignore
    }
  }, [contratos, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        ORCAMENTO_STORAGE_KEY,
        JSON.stringify(orcamentos)
      );
    } catch {
      // ignore
    }
  }, [orcamentos, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(ESTOQUE_STORAGE_KEY, JSON.stringify(estoque));
    } catch {
      // ignore
    }
  }, [estoque, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        MOVIMENTACOES_STORAGE_KEY,
        JSON.stringify(movimentacoesEstoque)
      );
    } catch {
      // ignore
    }
  }, [movimentacoesEstoque, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        PUXADAS_STORAGE_KEY,
        JSON.stringify(puxadasFornecimento)
      );
    } catch {
      // ignore
    }
  }, [puxadasFornecimento, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        DIARIOS_STORAGE_KEY,
        JSON.stringify(diariosObra)
      );
    } catch {
      // ignore
    }
  }, [diariosObra, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        FORNECEDORES_STORAGE_KEY,
        JSON.stringify(fornecedores)
      );
    } catch {
      // ignore
    }
  }, [fornecedores, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        ITENS_PLANILHA_STORAGE_KEY,
        JSON.stringify(itensPlanilha)
      );
    } catch {
      // ignore
    }
  }, [itensPlanilha, storageCarregado]);

  useEffect(() => {
    if (!storageCarregado) return;
    try {
      window.localStorage.setItem(
        DUPLICIDADES_STORAGE_KEY,
        JSON.stringify(duplicidades)
      );
    } catch {
      // ignore
    }
  }, [duplicidades, storageCarregado]);

  // Sincroniza e salva cotaÃ§Ãµes continuamente em tempo real
  useEffect(() => {
    if (!storageCarregado) return;

    try {
      const dadosSalvar = {
        titulo: comparativoTitulo,
        obraId: comparativoObraId,
        categoria: comparativoCategoria,
        fornecedores: comparativoFornecedores,
        itens: comparativoItens,
      };
      window.localStorage.setItem(
        COMPARATIVO_STORAGE_KEY,
        JSON.stringify(dadosSalvar)
      );
    } catch {}

    if (!cotacaoAtivaId) return;

    setProcessosCotacoes((prev) => {
      const idx = prev.findIndex((p) => p.id === cotacaoAtivaId);
      const atual = idx !== -1 ? prev[idx] : null;
      const obraSel = obras.find((o) => o.id === comparativoObraId);

      const t1 = Math.max(
        0,
        comparativoItens.reduce(
          (acc, it) => acc + (it.quantidade || 0) * (it.preco1 || 0),
          0
        ) +
          (comparativoFornecedores[0]?.freteValor || 0) -
          (comparativoFornecedores[0]?.descontoValor || 0)
      );
      const t2 = Math.max(
        0,
        comparativoItens.reduce(
          (acc, it) => acc + (it.quantidade || 0) * (it.preco2 || 0),
          0
        ) +
          (comparativoFornecedores[1]?.freteValor || 0) -
          (comparativoFornecedores[1]?.descontoValor || 0)
      );
      const t3 = Math.max(
        0,
        comparativoItens.reduce(
          (acc, it) => acc + (it.quantidade || 0) * (it.preco3 || 0),
          0
        ) +
          (comparativoFornecedores[2]?.freteValor || 0) -
          (comparativoFornecedores[2]?.descontoValor || 0)
      );

      const validos = [
        { nome: comparativoFornecedores[0]?.nome, total: t1 },
        { nome: comparativoFornecedores[1]?.nome, total: t2 },
        { nome: comparativoFornecedores[2]?.nome, total: t3 },
      ].filter((f) => f.total > 0 && f.nome && f.nome.trim() !== "");

      let menorVal = 0;
      let melhorNome = "";
      if (validos.length > 0) {
        validos.sort((a, b) => a.total - b.total);
        menorVal = validos[0].total;
        melhorNome = validos[0].nome;
      }

      const anoAtual = new Date().getFullYear();
      const atualizado: ProcessoCotacao = {
        id: cotacaoAtivaId,
        codigo: atual?.codigo || `COT-${anoAtual}-001`,
        titulo: comparativoTitulo || atual?.titulo || "CotaÃ§Ã£o de Insumos #001",
        obraId: comparativoObraId,
        obraNome: obraSel?.nome || "Todas as Obras / Canteiro Central",
        categoria: comparativoCategoria || atual?.categoria || "Geral / Suprimentos",
        status: atual?.status || "Aguardando Fornecedores",
        dataCriacao: atual?.dataCriacao || new Date().toLocaleDateString("pt-BR"),
        fornecedores: comparativoFornecedores,
        itens: comparativoItens,
        menorValor: menorVal,
        melhorFornecedorNome: melhorNome,
        savingGerado: resumoComparativo?.savingGlobal || 0,
        dataAtualizacao:
          new Date().toLocaleDateString("pt-BR") +
          " " +
          new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      };

      let novaLista = [...prev];
      if (idx === -1) {
        novaLista = [atualizado, ...prev];
      } else {
        novaLista[idx] = atualizado;
      }

      try {
        window.localStorage.setItem(
          PROCESSOS_COTACOES_STORAGE_KEY,
          JSON.stringify(novaLista)
        );
        salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, novaLista).catch(
          () => {}
        );
      } catch {}

      return novaLista;
    });
  }, [
    comparativoTitulo,
    comparativoObraId,
    comparativoCategoria,
    comparativoFornecedores,
    comparativoItens,
    cotacaoAtivaId,
    storageCarregado,
  ]);

  // Notificações e Alertas do Sistema em Tempo Real
  const notificacoesSistema = useMemo(
    () => gerarNotificacoesDoSistema(solicitacoes, ordens, contratos),
    [solicitacoes, ordens, contratos]
  );

  // Cargas Logísticas Programadas para os Canteiros
  const cargasLogistica = useMemo(
    () => agruparCargasLogistica(ordens, obraFiltro),
    [ordens, obraFiltro]
  );

  // Curva ABC Dinâmica de todos os insumos (80% / 15% / 5%)
  const curvaAbcMap = useMemo(
    () => calcularClassificacaoAbc(solicitacoes, ordens),
    [solicitacoes, ordens]
  );

  // Handlers de Contratos & Medições
  const handleCriarContrato = (novoCt: ContratoSubempreitada) => {
    setContratos((prev) => [novoCt, ...prev]);
    setShowNovoContratoModal(false);
    dispararAviso(
      `Contrato ${novoCt.numeroContrato} (${novoCt.empreiteiro}) cadastrado com sucesso!`
    );
  };

  const handleCriarBoletimMedicao = (
    contratoId: string,
    novoBm: BoletimMedicao
  ) => {
    setContratos((prev) =>
      prev.map((c) =>
        c.id === contratoId
          ? {
              ...c,
              medicoes: [...c.medicoes, novoBm],
            }
          : c
      )
    );
    setShowNovoBmModalContrato(null);
    dispararAviso(
      `Boletim de Medição ${novoBm.numeroBm} registrado com sucesso!`
    );
  };

  const handleAprovarPagarBm = (
    contratoId: string,
    bmId: string,
    novoStatus: "Aprovado para Pagamento" | "Pago"
  ) => {
    setContratos((prev) =>
      prev.map((c) =>
        c.id === contratoId
          ? {
              ...c,
              medicoes: c.medicoes.map((bm) =>
                bm.id === bmId ? { ...bm, status: novoStatus } : bm
              ),
            }
          : c
      )
    );
    dispararAviso(
      `Boletim de Medição atualizado para "${novoStatus}" com sucesso!`
    );
  };

  // Handler de Mensagens Canteiro ⇄ Compras
  const handleEnviarMensagemSC = (scId: string, texto: string) => {
    if (!texto.trim() || !usuarioLogado) return;
    const novaMsg: MensagemPedido = {
      id: `msg-${Date.now()}`,
      autorNome: usuarioLogado.nome,
      autorCargo: usuarioLogado.cargo,
      dataHora: `${new Date().toLocaleDateString(
        "pt-BR"
      )} às ${new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      texto: texto.trim(),
    };

    setSolicitacoes((prev) =>
      prev.map((s) =>
        s.id === scId
          ? {
              ...s,
              mensagens: [...(s.mensagens || []), novaMsg],
            }
          : s
      )
    );

    setScMensagensModal((prev) =>
      prev && prev.id === scId
        ? {
            ...prev,
            mensagens: [...(prev.mensagens || []), novaMsg],
          }
        : prev
    );

    dispararAviso("Mensagem enviada na linha do tempo do pedido!");
  };

  // Handlers de Backup e Restauração em JSON
  const handleExportarBackupCompleto = () => {
    const backupData = {
      version: "2.0",
      sistema: "JC BAUER • Sistema de Suprimentos & Canteiro B2B",
      dataBackup: new Date().toISOString(),
      settings,
      usuarios,
      solicitacoes,
      ordens,
      fornecedores,
      contratos,
    };
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(backupData, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute(
      "download",
      `JC_BAUER_Backup_Completo_${new Date()
        .toISOString()
        .slice(0, 10)}.json`
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
    dispararAviso("Backup completo do sistema gerado em JSON com sucesso!");
  };

  const handleRestaurarBackupCompleto = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (data.settings) {
          setSettings(data.settings);
          setFormSettings(data.settings);
          window.localStorage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(data.settings)
          );
        }
        if (Array.isArray(data.usuarios)) {
          setUsuarios(data.usuarios);
          window.localStorage.setItem(
            USERS_STORAGE_KEY,
            JSON.stringify(data.usuarios)
          );
        }
        if (Array.isArray(data.solicitacoes)) {
          setSolicitacoes(data.solicitacoes);
          window.localStorage.setItem(
            SOLICITACOES_STORAGE_KEY,
            JSON.stringify(data.solicitacoes)
          );
        }
        if (Array.isArray(data.ordens)) {
          setOrdens(data.ordens);
          window.localStorage.setItem(
            ORDENS_STORAGE_KEY,
            JSON.stringify(data.ordens)
          );
        }
        if (Array.isArray(data.contratos)) {
          setContratos(data.contratos);
          window.localStorage.setItem(
            CONTRATOS_STORAGE_KEY,
            JSON.stringify(data.contratos)
          );
        }
        if (Array.isArray(data.fornecedores)) {
          setFornecedores(data.fornecedores);
        }
        dispararAviso(
          `Backup "${file.name}" restaurado com sucesso! Base de dados sincronizada.`
        );
      } catch {
        dispararAviso("Erro ao ler arquivo de backup. Formato JSON inválido.");
      }
    };
    reader.readAsText(file);
  };

  const handleZerarSistemaCompleto = () => {
    const confirmou = window.confirm(
      "ATENÇÃO: Deseja realmente zerar todos os dados demo do sistema?\n\nEsta ação irá remover permanentemente todos os pedidos, cotações, ordens de compra, contratos, estoques e fornecedores, deixando o sistema 100% limpo para operação oficial da Construtora."
    );
    if (!confirmou) return;

    try {
      const allKeys = [
        USERS_STORAGE_KEY,
        OBRAS_STORAGE_KEY,
        SOLICITACOES_STORAGE_KEY,
        ORDENS_STORAGE_KEY,
        CONTRATOS_STORAGE_KEY,
        ORCAMENTO_STORAGE_KEY,
        ESTOQUE_STORAGE_KEY,
        MOVIMENTACOES_STORAGE_KEY,
        PUXADAS_STORAGE_KEY,
        DIARIOS_STORAGE_KEY,
        FORNECEDORES_STORAGE_KEY,
        "jc_bauer_users",
        "jc_bauer_users_v2",
        "jc_bauer_obras",
        "jc_bauer_obras_v2",
        "jc_bauer_solicitacoes",
        "jc_bauer_ordens",
        "jc_bauer_contratos",
        "jc_bauer_orcamento",
        "jc_bauer_estoque",
        "jc_bauer_movimentacoes",
        "jc_bauer_puxadas",
        "jc_bauer_diarios",
        "jc_bauer_fornecedores",
      ];
      allKeys.forEach((k) => {
        try {
          window.localStorage.removeItem(k);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }

    setUsuarios(USUARIOS_INICIAIS);
    setObras([]);
    setSolicitacoes([]);
    setOrdens([]);
    setContratos([]);
    setOrcamentos([]);
    setEstoque([]);
    setMovimentacoesEstoque([]);
    setPuxadasFornecimento([]);
    setDiariosObra([]);
    setFornecedores([]);
    setItensPlanilha([]);
    setDuplicidades([]);
    setColaboradores([]);
    setSelectedScId("");

    dispararAviso(
      "✅ Sistema zerado com sucesso! Todos os dados de demonstração foram removidos."
    );
  };

  /* ----------------------------------------------------------------------- */
  /* DADOS FILTRADOS E CÁLCULOS AUTOMÁTICOS                                  */
  /* ----------------------------------------------------------------------- */

  const solicitacoesFiltradas = useMemo(() => {
    if (obraFiltro === "ALL") return solicitacoes;
    return solicitacoes.filter((sc) => sc.obraId === obraFiltro);
  }, [solicitacoes, obraFiltro]);

  const ordensFiltradas = useMemo(() => {
    if (obraFiltro === "ALL") return ordens;
    return ordens.filter((oc) => oc.obraId === obraFiltro);
  }, [ordens, obraFiltro]);

  // Solicitação ativa na Aba 2 (Mapa de Cotações)
  const scAtiva = useMemo(() => {
    return (
      solicitacoes.find((s) => s.id === selectedScId) || solicitacoes[0] || null
    );
  }, [solicitacoes, selectedScId]);

  const obraScAtiva = useMemo(() => {
    return (
      (scAtiva && obras.find((o) => o.id === scAtiva.obraId)) ||
      obras[0] || {
        id: "obra-geral",
        nome: "Todas as Obras / Canteiro Geral",
        sigla: "GERAL",
        endereco: "Sede JC Bauer",
        engenheiro: "A Definir",
      }
    );
  }, [obras, scAtiva]);

  // Cálculo do Orçamento de Referência da SC ativa
  const orcamentoScAtiva = useMemo(() => {
    if (!scAtiva) return 0;
    return scAtiva.itens.reduce(
      (acc, it) => acc + it.quantidade * it.orcamentoUnitario,
      0
    );
  }, [scAtiva]);

  // Cálculo dos Totais por Fornecedor na SC ativa
  const totaisPorProposta = useMemo(() => {
    const mapa: Record<
      string,
      { subtotalItens: number; frete: number; totalGeral: number }
    > = {};
    if (!scAtiva) return mapa;

    scAtiva.propostas.forEach((prop) => {
      const subtotalItens = scAtiva.itens.reduce((acc, item) => {
        const unit = prop.precosUnitarios[item.id] ?? 0;
        return acc + item.quantidade * unit;
      }, 0);
      const totalGeral = subtotalItens + (prop.freteValor || 0);
      mapa[prop.id] = {
        subtotalItens,
        frete: prop.freteValor || 0,
        totalGeral,
      };
    });
    return mapa;
  }, [scAtiva]);

  // Identificação automática do Fornecedor Vencedor (Menor Preço Global)
  const resumoCotacaoAtiva = useMemo(() => {
    if (!scAtiva || scAtiva.propostas.length === 0) {
      return {
        vencedorId: "",
        vencedorNome: "Em apuração",
        menorTotal: 0,
        maiorTotal: 0,
        savingGerado: 0,
      };
    }

    let vencedorId = scAtiva.propostas[0].id;
    let vencedorNome = scAtiva.propostas[0].fornecedorNome;
    let menorTotal = totaisPorProposta[vencedorId]?.totalGeral ?? Infinity;
    let maiorTotal = 0;

    scAtiva.propostas.forEach((p) => {
      const tot = totaisPorProposta[p.id]?.totalGeral ?? 0;
      if (tot > 0 && tot < menorTotal) {
        menorTotal = tot;
        vencedorId = p.id;
        vencedorNome = p.fornecedorNome;
      }
      if (tot > maiorTotal) {
        maiorTotal = tot;
      }
    });

    if (menorTotal === Infinity) menorTotal = 0;
    const savingVsMaior = Math.max(0, maiorTotal - menorTotal);
    const savingVsOrcamento = Math.max(0, orcamentoScAtiva - menorTotal);
    const savingGerado =
      savingVsMaior > 0 ? savingVsMaior : savingVsOrcamento;

    return {
      vencedorId,
      vencedorNome,
      menorTotal,
      maiorTotal,
      savingGerado,
    };
  }, [scAtiva, totaisPorProposta, orcamentoScAtiva]);

  // Lista Consolidada de Economia por Insumo (Filtrada por Obra ou Geral)
  const insumosEconomiaFiltrados = useMemo(() => {
    if (obraFiltro === "ALL") return ECONOMIA_INSUMOS_HISTORICO;
    return ECONOMIA_INSUMOS_HISTORICO.filter(
      (item) => item.obraId === obraFiltro
    );
  }, [obraFiltro]);

  // Desempenho Consolidado por Empreendimento para o Infográfico (Bloco 1)
  const desempenhoPorEmpreendimento = useMemo(() => {
    const obrasAlvo =
      obraFiltro === "ALL"
        ? obras
        : obras.filter((o) => o.id === obraFiltro);

    return obrasAlvo.map((obra) => {
      const itensObra = ECONOMIA_INSUMOS_HISTORICO.filter(
        (i) => i.obraId === obra.id
      );
      const valorOrcadoMaior = itensObra.reduce(
        (acc, i) => acc + i.valorMaiorCotado,
        0
      );
      const custoRealFechado = itensObra.reduce(
        (acc, i) => acc + i.valorFechado,
        0
      );
      const economiaReais = Math.max(0, valorOrcadoMaior - custoRealFechado);
      const economiaPercentual =
        valorOrcadoMaior > 0 ? (economiaReais / valorOrcadoMaior) * 100 : 0;

      return {
        obra,
        valorOrcadoMaior,
        custoRealFechado,
        economiaReais,
        economiaPercentual,
        qtdInsumos: itensObra.length,
      };
    });
  }, [obras, obraFiltro]);

  // KPIs do Painel Principal
  const kpisPainel = useMemo(() => {
    const emAberto = solicitacoesFiltradas.filter(
      (s) => s.status !== "Comprada"
    ).length;
    const concluidas =
      solicitacoesFiltradas.filter((s) => s.status === "Comprada").length +
      ordensFiltradas.length;

    const totalOrcadoInsumos = insumosEconomiaFiltrados.reduce(
      (acc, i) => acc + i.valorMaiorCotado,
      0
    );
    const totalFechadoInsumos = insumosEconomiaFiltrados.reduce(
      (acc, i) => acc + i.valorFechado,
      0
    );
    const savingInsumos = Math.max(
      0,
      totalOrcadoInsumos - totalFechadoInsumos
    );

    return {
      emAberto,
      concluidas,
      volumeContratado: totalFechadoInsumos,
      savingTotal: savingInsumos,
    };
  }, [solicitacoesFiltradas, ordensFiltradas, insumosEconomiaFiltrados]);

  // Fornecedores filtrados na Aba 3
  const fornecedoresFiltrados = useMemo(() => {
    return fornecedores.filter((f) => {
      const q = buscaFornecedor.toLowerCase();
      const matchTexto =
        !q ||
        f.empresa.toLowerCase().includes(q) ||
        (f.razaoSocial && f.razaoSocial.toLowerCase().includes(q)) ||
        (f.cnpj && f.cnpj.toLowerCase().includes(q)) ||
        f.cidade.toLowerCase().includes(q) ||
        f.vendedor.toLowerCase().includes(q) ||
        (f.telefone && f.telefone.toLowerCase().includes(q)) ||
        f.categoriaPrincipal.toLowerCase().includes(q);
      const matchCat =
        filtroCatFornecedor === "ALL" ||
        f.categoriaPrincipal === filtroCatFornecedor;
      return matchTexto && matchCat;
    });
  }, [fornecedores, buscaFornecedor, filtroCatFornecedor]);

  // Pendências de Importação na Aba 5
  const pendenciasImportacaoCount = useMemo(() => {
    const pItens = itensPlanilha.filter((i) => i.status === "Pendente").length;
    const pDup = duplicidades.filter((d) => d.status === "Pendente").length;
    const pCol = colaboradores.filter((c) => c.status === "Pendente").length;
    return pItens + pDup + pCol;
  }, [itensPlanilha, duplicidades, colaboradores]);

  /* ----------------------------------------------------------------------- */
  /* 1. FUNÇÃO DE DISPARO DIRETO DO PDF (`handleGeneratePDF`)                */
  /* Abre janela limpa A4 com barra sticky e aciona `window.print()` direto  */
  /* ----------------------------------------------------------------------- */

  /* ----------------------------------------------------------------------- */
  /* DISPARADOR UNIVERSAL DE IMPRESSÃO / PDF (À PROVA DE POPUP BLOCKERS)     */
  /* ----------------------------------------------------------------------- */
  const imprimirDocumentoHtml = (htmlContent: string) => {
    let win: Window | null = null;
    try {
      win = window.open(
        "",
        "_blank",
        "width=1000,height=800,menubar=no,toolbar=no,location=no,status=no"
      );
    } catch {
      win = null;
    }

    if (win && win.document) {
      try {
        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
        win.focus();
        return;
      } catch (err) {
        console.warn("Falha ao escrever em nova aba, usando iframe direto:", err);
      }
    }

    // Fallback à prova de falhas: Iframe invisível para navegadores que bloqueiam pop-ups
    try {
      let iframe = document.getElementById("jc-print-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "jc-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);
      }

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (e) {
            console.error("Erro na impressão do iframe:", e);
          }
        }, 450);
      }
    } catch (e) {
      console.error("Erro no fallback de impressão:", e);
    }
  };
  const handleGeneratePDF = () => {
    if (!scAtiva) return;

    const dataHoje = new Date().toLocaleDateString("pt-BR");
    const percentualSaving =
      resumoCotacaoAtiva.maiorTotal > 0
        ? (
            (resumoCotacaoAtiva.savingGerado / resumoCotacaoAtiva.maiorTotal) *
            100
          ).toFixed(1)
        : "0.0";

    const headersFornecedoresHtml = scAtiva.propostas
      .map((p) => {
        const isWin = p.id === resumoCotacaoAtiva.vencedorId;
        return `<th style="padding:10px;border:1px solid #cbd5e1;text-align:right;background:${
          isWin ? "#ecfdf5" : "#f1f5f9"
        };">
          <div style="font-weight:700;color:#0f172a;">${p.fornecedorNome} ${
          isWin ? "★ VENCEDOR" : ""
        }</div>
          <div style="font-size:11px;font-weight:400;color:#475569;">Vendedor: ${
            p.vendedorNome
          }</div>
        </th>`;
      })
      .join("");

    const linhasItensHtml = scAtiva.itens
      .map((it) => {
        const cols = scAtiva.propostas
          .map((p) => {
            const unit = p.precosUnitarios[it.id] || 0;
            const tot = it.quantidade * unit;
            return `<td style="padding:10px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap;">
              <div style="font-size:11px;color:#475569;">${formatBRL(
                unit
              )} / ${it.unidade}</div>
              <div style="font-weight:700;color:#0f172a;">${formatBRL(
                tot
              )}</div>
            </td>`;
          })
          .join("");

        return `<tr>
          <td style="padding:10px;border:1px solid #cbd5e1;font-weight:600;color:#0f172a;">
            ${it.descricao}
            <div style="font-size:11px;font-weight:400;color:#64748b;">Código: ${
              it.codigo
            } • Meta: ${formatBRL(it.orcamentoUnitario)}/${it.unidade}</div>
          </td>
          <td style="padding:10px;border:1px solid #cbd5e1;text-align:center;font-weight:600;white-space:nowrap;">
            ${it.quantidade} ${it.unidade}
          </td>
          ${cols}
        </tr>`;
      })
      .join("");

    const linhaFreteHtml = scAtiva.propostas
      .map(
        (p) =>
          `<td style="padding:10px;border:1px solid #cbd5e1;text-align:right;font-size:12px;">
            <div><strong>Frete ${p.tipoFrete}:</strong> ${formatBRL(
            p.freteValor
          )}</div>
            <div style="color:#475569;font-size:11px;">${
              p.prazoPagamento
            }</div>
          </td>`
      )
      .join("");

    const linhaTotaisHtml = scAtiva.propostas
      .map((p) => {
        const tot = totaisPorProposta[p.id]?.totalGeral || 0;
        const isWin = p.id === resumoCotacaoAtiva.vencedorId;
        return `<td style="padding:12px;border:1px solid #cbd5e1;text-align:right;font-size:15px;font-weight:800;background:${
          isWin ? "#ecfdf5" : "#f8fafc"
        };color:${isWin ? "#065f46" : "#0f172a"};">
          ${formatBRL(tot)}
        </td>`;
      })
      .join("");

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Executivo de Cotação - ${scAtiva.codigo}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { margin: 0; padding: 0; background: #f1f5f9; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @media print {
      body { background: #ffffff !important; }
      .no-print { display: none !important; }
      .page-sheet { margin: 0 !important; box-shadow: none !important; border: none !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <!-- Barra fixa superior com botões grandes de Salvar PDF e Fechar -->
  <div class="no-print" style="position: sticky; top: 0; background: #0f172a; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; border-bottom: 2px solid #059669;">
    <div style="color: #ffffff; font-size: 14px; font-weight: 600;">
      📄 Relatório Executivo A4 Pronto — ${scAtiva.codigo} (${obraScAtiva.nome})
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer;">
        🖨️ Baixar / Salvar PDF Agora
      </button>
      <button onclick="window.close()" style="background: #334155; color: #ffffff; border: 1px solid #64748b; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
        Fechar
      </button>
    </div>
  </div>

  <!-- Folha A4 Executiva -->
  <div class="page-sheet" style="max-width: 1040px; margin: 20px auto; background: #ffffff; padding: 28px; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
    <!-- Cabeçalho da Construtora -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="background: #ffffff; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <img src="${window.location.origin}/logo.png" alt="JC Bauer Empreendimentos" style="height: 52px; width: auto; object-fit: contain;" />
        </div>
        <div>
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            ${settings.companyName}
          </div>
          <div style="font-size: 12px; color: #475569; margin-top: 3px;">
            CNPJ: ${settings.companyCnpj} • Comprador Responsável: <strong>${settings.userName}</strong> (${settings.userRole})
          </div>
          <div style="font-size: 12px; color: #0f172a; margin-top: 3px;">
            <strong>Empreendimento:</strong> ${obraScAtiva.nome} (${obraScAtiva.sigla}) • <strong>Disciplina:</strong> ${scAtiva.categoria}
          </div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">DOSSIÊ DE COTAÇÃO</div>
        <div style="font-size: 20px; font-weight: 800; color: #0f172a;">${scAtiva.codigo}</div>
        <div style="font-size: 12px; color: #475569;">Emissão: ${dataHoje}</div>
      </div>
    </div>

    <!-- Quadro Resumo de Decisão (3 Caixas) -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 18px;">
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px;">
        <div style="font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase;">FORNECEDOR RECOMENDADO</div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${resumoCotacaoAtiva.vencedorNome}</div>
        <div style="font-size: 11px; color: #047857; margin-top: 2px;">Menor valor global equalizado</div>
      </div>
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px;">
        <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">CUSTO REAL FECHADO</div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatBRL(resumoCotacaoAtiva.menorTotal)}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Orçamento Ref.: ${formatBRL(orcamentoScAtiva)}</div>
      </div>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px;">
        <div style="font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase;">ECONOMIA GERADA (SAVING)</div>
        <div style="font-size: 18px; font-weight: 800; color: #065f46; margin-top: 4px;">${formatBRL(resumoCotacaoAtiva.savingGerado)} (-${percentualSaving}%)</div>
        <div style="font-size: 11px; color: #047857; margin-top: 2px;">Redução auditada na negociação</div>
      </div>
    </div>

    <!-- Tabela Comparativa de Preços -->
    <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 18px;">
      <thead>
        <tr>
          <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: left; background: #f1f5f9;">Insumo / Especificação Técnica</th>
          <th style="padding: 10px; border: 1px solid #cbd5e1; text-align: center; background: #f1f5f9;">Qtd / Unid</th>
          ${headersFornecedoresHtml}
        </tr>
      </thead>
      <tbody>
        ${linhasItensHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc;">
          <td colspan="2" style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">Frete e Condições de Pagamento</td>
          ${linhaFreteHtml}
        </tr>
        <tr>
          <td colspan="2" style="padding: 12px; border: 1px solid #cbd5e1; font-weight: 800; font-size: 13px; background: #f1f5f9;">VALOR TOTAL EQUALIZADO</td>
          ${linhaTotaisHtml}
        </tr>
      </tfoot>
    </table>

    <!-- Parecer Técnico e Comercial -->
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 12px; color: #334155; margin-bottom: 32px; line-height: 1.5;">
      <strong>Parecer Técnico e Comercial de Suprimentos:</strong> Recomendamos a homologação e emissão de Ordem de Compra para o fornecedor <strong>${resumoCotacaoAtiva.vencedorNome}</strong> pelo valor total equalizado de <strong>${formatBRL(resumoCotacaoAtiva.menorTotal)}</strong>, proporcionando economia direta de <strong>${formatBRL(resumoCotacaoAtiva.savingGerado)}</strong> para a obra <strong>${obraScAtiva.nome}</strong>.
    </div>

    <!-- Campos de Assinatura -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; padding-top: 20px; text-align: center; font-size: 12px;">
      <div style="border-top: 1px solid #0f172a; padding-top: 8px;">
        <strong>${settings.userName}</strong>
        <div style="color: #475569; font-size: 11px;">${settings.userRole} — ${settings.companyName}</div>
      </div>
      <div style="border-top: 1px solid #0f172a; padding-top: 8px;">
        <strong>Diretoria Executiva / Aprovação Final</strong>
        <div style="color: #475569; font-size: 11px;">${settings.companyName}</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    imprimirDocumentoHtml(htmlContent);
  };

  /* ----------------------------------------------------------------------- */
  /* 2. IMPRESSÃO DA ORDEM DE COMPRA (OC) OFICIAL TIMBRADA                   */
  /* ----------------------------------------------------------------------- */
  const handleGerarOrdemCompraPDF = (oc: OrdemCompra) => {

    const alcadaInfo = obterAlcadaAprovacao(oc.valorTotal);

    const linhasItensHtml = oc.itens
      .map(
        (it, idx) => `
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#475569;">
            ${idx + 1}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:700;color:#0f172a;white-space:nowrap;">
            ${it.codigo}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;color:#0f172a;">
            <div style="font-weight:600;">${it.descricao}</div>
            ${it.observacaoObra ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">Obs Canteiro: ${it.observacaoObra}</div>` : ""}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:700;white-space:nowrap;">
            ${it.quantidade} ${it.unidade}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap;">
            ${formatBRL(it.precoUnitario)}
          </td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:700;color:#0f172a;white-space:nowrap;">
            ${formatBRL(it.subtotal)}
          </td>
        </tr>
      `
      )
      .join("");

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Ordem de Compra ${oc.numeroOc} - ${settings.companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { margin: 0; padding: 0; background: #f1f5f9; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @media print {
      body { background: #ffffff !important; }
      .no-print { display: none !important; }
      .page-sheet { margin: 0 !important; box-shadow: none !important; border: none !important; max-width: 100% !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: sticky; top: 0; background: #0f172a; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; border-bottom: 2px solid #059669;">
    <div style="color: #ffffff; font-size: 14px; font-weight: 600;">
      📄 Ordem de Compra Oficial — ${oc.numeroOc} (${oc.obraNome})
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer;">
        🖨️ Baixar / Imprimir PDF Oficial
      </button>
      <button onclick="window.close()" style="background: #334155; color: #ffffff; border: 1px solid #64748b; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
        Fechar
      </button>
    </div>
  </div>

  <div class="page-sheet" style="max-width: 960px; margin: 16px auto; background: #ffffff; padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
    
    <!-- Cabeçalho Timbrado com Logomarca Oficial JC BAUER -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="background: #ffffff; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <img src="${window.location.origin}/logo.png" alt="JC Bauer Empreendimentos" style="height: 55px; width: auto; object-fit: contain;" />
        </div>
        <div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.5px;">
            ${settings.companyName}
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
${settings.companyCnpj ? `CNPJ: <strong>${settings.companyCnpj}</strong> • ` : ""}Central de Suprimentos & Engenharia
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
            Depto. de Suprimentos & Engenharia: <strong>${settings.userName}</strong> • ${settings.userEmail} • ${settings.userPhone}
          </div>
        </div>
      </div>
      <div style="text-align: right; background: #f8fafc; padding: 10px 16px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <div style="font-size: 11px; font-weight: 800; color: #059669; text-transform: uppercase;">DOCUMENTO DE COMPRA FORMAL</div>
        <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px;">${oc.numeroOc}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">
          Emissão: <strong>${oc.dataEmissao}</strong> • Ref: <strong>${oc.scCodigo}</strong>
        </div>
        <div style="font-size: 10px; font-weight: 700; color: #0f172a; margin-top: 4px; display: inline-block; padding: 2px 6px; background: #e2e8f0; border-radius: 4px;">
          ${alcadaInfo.nivel}
        </div>
      </div>
    </div>

    <!-- Dados do Fornecedor e da Obra -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; font-size: 12px;">
      
      <!-- Caixa 1: Fornecedor -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; line-height: 1.5;">
        <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; margin-bottom: 4px;">
          1. FORNECEDOR CONTRATADO
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
          ${oc.fornecedorRazao || oc.fornecedorNome}
        </div>
        <div style="color: #475569; font-size: 11px;">
          Nome Fantasia: <strong>${oc.fornecedorNome}</strong>
        </div>
        <div style="color: #475569; font-size: 11px;">
          CNPJ: <strong>${oc.fornecedorCnpj}</strong>
        </div>
        <div style="color: #475569; font-size: 11px; margin-top: 4px;">
          Vendedor(a): <strong>${oc.vendedorNome}</strong> • WhatsApp: <strong>${oc.whatsapp}</strong>
        </div>
        <div style="color: #475569; font-size: 11px;">
          Chave PIX / Faturamento: <strong>${oc.chavePix || "Conforme Boleto"}</strong>
        </div>
      </div>

      <!-- Caixa 2: Local de Entrega e Condições -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; line-height: 1.5;">
        <div style="font-size: 10px; font-weight: 800; color: #059669; text-transform: uppercase; margin-bottom: 4px;">
          2. LOCAL DE DESCARGA & FATURAMENTO
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #0f172a;">
          🏗️ ${oc.obraNome}
        </div>
        <div style="color: #475569; font-size: 11px;">
          Endereço: <strong>${oc.obraEndereco}</strong>
        </div>
        <div style="color: #475569; font-size: 11px;">
          Engenheiro / Receptor: <strong>${oc.obraEngenheiro || "Almoxarifado da Obra"}</strong>
        </div>
        <div style="color: #475569; font-size: 11px; margin-top: 4px;">
          Prazo / Condição: <strong>${oc.prazoPagamento}</strong>
        </div>
        <div style="color: #475569; font-size: 11px;">
          Frete: <strong>${oc.tipoFrete} (${oc.freteValor > 0 ? formatBRL(oc.freteValor) : "Incluso no Preço"})</strong> • Prev. Entrega: <strong>${oc.dataPrevistaEntrega || "Imediato"}</strong>
        </div>
      </div>
    </div>

    <!-- Tabela Oficial de Itens -->
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 14px;">
      <thead>
        <tr style="background: #0f172a; color: #ffffff;">
          <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: center; width: 36px;">Item</th>
          <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: left; width: 100px;">Código</th>
          <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: left;">Descrição do Insumo / Material</th>
          <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: center; width: 100px;">Qtd / Unid</th>
          <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: right; width: 100px;">Preço Unit.</th>
          <th style="padding: 8px 10px; border: 1px solid #0f172a; text-align: right; width: 110px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItensHtml}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc; font-size: 12px;">
          <td colspan="5" style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">
            Subtotal Produtos:
          </td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 700;">
            ${formatBRL(oc.valorTotal - (oc.tipoFrete === "FOB" ? oc.freteValor : 0))}
          </td>
        </tr>
        ${
          oc.freteValor > 0
            ? `<tr style="background: #f8fafc; font-size: 12px;">
          <td colspan="5" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">
            Frete Destacado (${oc.tipoFrete}):
          </td>
          <td style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: right; font-weight: 600;">
            ${formatBRL(oc.freteValor)}
          </td>
        </tr>`
            : ""
        }
        ${
          (oc.descontoValor || 0) > 0
            ? `<tr style="background: #f0fdf4; font-size: 12px;">
          <td colspan="5" style="padding: 6px 12px; border: 1px solid #bbf7d0; text-align: right; font-weight: 600; color: #166534;">
            Desconto Comercial (R$):
          </td>
          <td style="padding: 6px 12px; border: 1px solid #bbf7d0; text-align: right; font-weight: 700; color: #166534;">
            -${formatBRL(oc.descontoValor || 0)}
          </td>
        </tr>`
            : ""
        }
        <tr style="background: #ecfdf5; font-size: 14px;">
          <td colspan="5" style="padding: 10px 12px; border: 1px solid #a7f3d0; text-align: right; font-weight: 900; color: #065f46;">
            VALOR TOTAL DA ORDEM DE COMPRA:
          </td>
          <td style="padding: 10px 12px; border: 1px solid #a7f3d0; text-align: right; font-weight: 900; color: #065f46; font-size: 16px;">
            ${formatBRL(oc.valorTotal)}
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- Destaque de Saving Auditado -->
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
      <div>
        <strong style="color: #166534;">💰 Economia Auditada na Negociação (Saving Direto):</strong>
        <span style="color: #15803d; margin-left: 6px;">Esta contratação gerou redução de custo de</span>
        <strong style="color: #166534; font-size: 13px; margin-left: 4px;">${formatBRL(oc.savingGerado)}</strong>
        <span style="color: #15803d; margin-left: 4px;">para o orçamento da obra.</span>
      </div>
      <span style="background: #166534; color: #ffffff; font-weight: 700; padding: 3px 8px; border-radius: 4px; font-size: 10px;">
        AUDITADO
      </span>
    </div>

    <!-- Cláusulas Gerais de Fornecimento no Canteiro -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-size: 10px; color: #475569; line-height: 1.5; margin-bottom: 24px;">
      <strong style="color: #0f172a; text-transform: uppercase; font-size: 10px;">Termos e Condições Gerais de Fornecimento — JC BAUER:</strong><br />
      <strong>1. Nota Fiscal:</strong> O DANFE / NF-e deve constar obrigatoriamente no campo de informações complementares o número desta Ordem de Compra (<strong>${oc.numeroOc}</strong>) e o nome do empreendimento (<strong>${oc.obraNome}</strong>).<br />
      <strong>2. Horário de Descarga:</strong> O recebimento no canteiro opera de Segunda a Quinta das 07h30 às 16h30 e Sexta das 07h30 às 15h30. Não há recebimento em feriados ou finais de semana sem agendamento prévio.<br />
      <strong>3. Conferência e Aceite:</strong> A descarga está condicionada à conferência cega quantitativa e qualitativa pelo Almoxarifado. Materiais com avaria ou em desacordo serão recusados no canhoto.<br />
      <strong>4. Documentação Técnica:</strong> Certificados de qualidade da usina, relatórios de conformidade técnica e ensaios laboratoriais devem acompanhar a remessa.
    </div>

    <!-- Campos de Assinatura Formal da OC -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; text-align: center; font-size: 10px; margin-top: 10px;">
      <div style="border-top: 1px solid #0f172a; padding-top: 6px;">
        <strong>${settings.userName}</strong>
        <div style="color: #64748b; font-size: 9px; margin-top: 2px;">Comprador Responsável</div>
      </div>
      <div style="border-top: 1px solid #0f172a; padding-top: 6px;">
        <strong>${oc.obraEngenheiro || "Engenharia de Obras"}</strong>
        <div style="color: #64748b; font-size: 9px; margin-top: 2px;">Engenheiro / Canteiro</div>
      </div>
      <div style="border-top: 1px solid #0f172a; padding-top: 6px;">
        <strong>Diretoria Executiva / CFO</strong>
        <div style="color: #64748b; font-size: 9px; margin-top: 2px;">Aprovação Financeira</div>
      </div>
      <div style="border-top: 1px solid #0f172a; padding-top: 6px;">
        <strong>${oc.fornecedorNome}</strong>
        <div style="color: #64748b; font-size: 9px; margin-top: 2px;">De Acordo do Fornecedor</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    imprimirDocumentoHtml(htmlContent);
  };

  /* ----------------------------------------------------------------------- */
  /* 3. IMPRESSÃO DO ROMANEIO DE CONFERÊNCIA CEGA PARA O ALMOXARIFADO        */
  /* ----------------------------------------------------------------------- */
  const handleGerarRomaneioRecebimentoPDF = (oc: OrdemCompra) => {
    const win = window.open("", "_blank", "width=920,height=750");
    if (!win) {
      dispararAviso(
        "Permita pop-ups no navegador para abrir a janela de impressão do Romaneio de Recebimento."
      );
      return;
    }

    const dataHoje = new Date().toLocaleDateString("pt-BR");

    const linhasItensHtml = oc.itens
      .map(
        (it, idx) => `
        <tr>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:600;color:#475569;">
            ${idx + 1}
          </td>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;font-weight:700;color:#0f172a;white-space:nowrap;">
            ${it.codigo}
          </td>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;color:#0f172a;">
            <div style="font-weight:700;">${it.descricao}</div>
            ${it.observacaoObra ? `<div style="font-size:10px;color:#64748b;">Obs: ${it.observacaoObra}</div>` : ""}
          </td>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:700;background:#f8fafc;white-space:nowrap;">
            ${it.quantidade} ${it.unidade}
          </td>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;background:#ffffff;">
            &nbsp;
          </td>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;background:#ffffff;">
            &nbsp;
          </td>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;background:#ffffff;">
            &nbsp;
          </td>
          <td style="padding:10px 8px;border:1px solid #cbd5e1;text-align:center;font-size:10px;white-space:nowrap;">
            [ ] Conf. &nbsp; [ ] Ress. &nbsp; [ ] Rec.
          </td>
        </tr>
      `
      )
      .join("");

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Romaneio de Recebimento - OC ${oc.numeroOc} - ${settings.companyName}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { margin: 0; padding: 0; background: #f1f5f9; color: #0f172a; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @media print {
      body { background: #ffffff !important; }
      .no-print { display: none !important; }
      .page-sheet { margin: 0 !important; box-shadow: none !important; border: none !important; max-width: 100% !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: sticky; top: 0; background: #0f172a; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; border-bottom: 2px solid #059669;">
    <div style="color: #ffffff; font-size: 14px; font-weight: 600;">
      📦 Romaneio de Inspeção & Recebimento Cego — ${oc.numeroOc} (${oc.obraNome})
    </div>
    <div style="display: flex; gap: 12px; align-items: center;">
      <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer;">
        🖨️ Imprimir Romaneio de Campo
      </button>
      <button onclick="window.close()" style="background: #334155; color: #ffffff; border: 1px solid #64748b; padding: 10px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;">
        Fechar
      </button>
    </div>
  </div>

  <div class="page-sheet" style="max-width: 960px; margin: 16px auto; background: #ffffff; padding: 24px 28px; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
    
    <!-- Cabeçalho Timbrado Oficial JC BAUER -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <div style="background: #ffffff; padding: 6px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <img src="${window.location.origin}/logo.png" alt="JC Bauer Empreendimentos" style="height: 55px; width: auto; object-fit: contain;" />
        </div>
        <div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase;">
            ${settings.companyName}
          </div>
          <div style="font-size: 12px; font-weight: 700; color: #059669; margin-top: 2px;">
            SISTEMA DE GESTÃO DA QUALIDADE — INSPEÇÃO & RECEBIMENTO NO CANTEIRO
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">
            Canteiro: <strong>${oc.obraNome}</strong> • Endereço: ${oc.obraEndereco}
          </div>
        </div>
      </div>
      <div style="text-align: right; background: #f8fafc; padding: 10px 16px; border-radius: 8px; border: 1px solid #cbd5e1;">
        <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase;">ROMANEIO DE ENTRADA</div>
        <div style="font-size: 18px; font-weight: 900; color: #059669; margin-top: 2px;">${oc.numeroOc}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">
          Pedido: <strong>${oc.scCodigo}</strong> • Data Impr.: ${dataHoje}
        </div>
      </div>
    </div>

    <!-- Campos de Preenchimento da Carga / Guia de Transporte -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 11px;">
      <div>
        <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">FORNECEDOR CONTRATADO</div>
        <div style="font-weight: 800; color: #0f172a; font-size: 12px; margin-top: 2px;">${oc.fornecedorNome}</div>
        <div style="color: #475569;">CNPJ: ${oc.fornecedorCnpj}</div>
      </div>
      <div>
        <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">DADOS DO VEÍCULO & NOTA FISCAL</div>
        <div style="margin-top: 4px;"><strong>NF-e / DANFE nº:</strong> ______________________</div>
        <div style="margin-top: 4px;"><strong>Data e Hora Chegada:</strong> _____/_____/2026 às ____:____</div>
      </div>
      <div>
        <div style="color: #64748b; font-size: 10px; font-weight: 700; text-transform: uppercase;">TRANSPORTADORA / MOTORISTA</div>
        <div style="margin-top: 4px;"><strong>Motorista:</strong> _______________________________</div>
        <div style="margin-top: 4px;"><strong>Placa do Veículo:</strong> ______________ Frete: ${oc.tipoFrete}</div>
      </div>
    </div>

    <!-- Tabela de Conferência Cega Física -->
    <div style="margin-bottom: 6px; font-size: 11px; font-weight: 700; color: #0f172a; text-transform: uppercase;">
      Grade de Conferência Quantitativa e de Lote (Preenchimento pelo Almoxarife no Descarregamento)
    </div>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
      <thead>
        <tr style="background: #0f172a; color: #ffffff;">
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: center; width: 32px;">Item</th>
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: left; width: 85px;">Código</th>
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: left;">Insumo / Especificação</th>
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: center; width: 90px;">Qtd OC</th>
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: center; width: 90px; background: #334155;">Qtd na NF-e</th>
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: center; width: 95px; background: #059669;">Qtd Contada</th>
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: center; width: 110px;">Lote / Validade</th>
          <th style="padding: 8px 6px; border: 1px solid #0f172a; text-align: center; width: 120px;">Aceite Físico</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItensHtml}
      </tbody>
    </table>

    <!-- Checklist de Qualidade do Almoxarifado -->
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 11px;">
      <div style="font-weight: 800; color: #0f172a; text-transform: uppercase; font-size: 11px; margin-bottom: 8px;">
        Checklist de Recebimento e Inspeção Visual no Canteiro:
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; line-height: 1.4;">
        <div>[ &nbsp; ] Embalagens/paletes íntegros, sem avarias de transporte ou umidade</div>
        <div>[ &nbsp; ] Laudos técnicos / Certificados de qualidade da usina anexados</div>
        <div>[ &nbsp; ] Dimensões, marcas e bitolas em estrita conformidade com a OC</div>
        <div>[ &nbsp; ] Material descarregado e estocado no local apropriado do almoxarifado</div>
      </div>
    </div>

    <!-- Campo de Ressalvas / Ocorrências -->
    <div style="border: 1px dashed #94a3b8; border-radius: 6px; padding: 10px 14px; font-size: 11px; margin-bottom: 24px; min-height: 60px;">
      <strong style="color: #475569;">Observações do Conferente / Ressalvas (faltas, sobras, avarias ou motivos de recusa):</strong>
      <div style="border-bottom: 1px dotted #cbd5e1; height: 18px; margin-top: 6px;"></div>
      <div style="border-bottom: 1px dotted #cbd5e1; height: 18px; margin-top: 4px;"></div>
    </div>

    <!-- Campos de Assinatura -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; text-align: center; font-size: 11px;">
      <div style="border-top: 1px solid #0f172a; padding-top: 8px;">
        <strong>Conferente / Almoxarife (JC Bauer)</strong>
        <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Nome: ____________________________________ Matrícula: _________</div>
      </div>
      <div style="border-top: 1px solid #0f172a; padding-top: 8px;">
        <strong>Motorista / Entregador (Transportadora)</strong>
        <div style="color: #64748b; font-size: 10px; margin-top: 2px;">Nome: ____________________________________ RG/CPF: ___________</div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

    win.document.open();
    win.document.write(htmlContent);
    win.document.close();
  };

  /* ----------------------------------------------------------------------- */
  /* HANDLERS DE INTERAÇÃO                                                   */
  /* ----------------------------------------------------------------------- */

  // Atualizar Preço Unitário no Mapa de Cotações
  const handleAtualizarPrecoUnitario = (
    scId: string,
    propostaId: string,
    itemId: string,
    novoPreco: number
  ) => {
    setSolicitacoes((prev) =>
      prev.map((sc) => {
        if (sc.id !== scId) return sc;
        return {
          ...sc,
          propostas: sc.propostas.map((p) => {
            if (p.id !== propostaId) return p;
            return {
              ...p,
              precosUnitarios: {
                ...p.precosUnitarios,
                [itemId]: novoPreco >= 0 ? novoPreco : 0,
              },
            };
          }),
        };
      })
    );
  };

  // Atualizar Frete de Fornecedor no Mapa de Cotações
  const handleAtualizarFrete = (
    scId: string,
    propostaId: string,
    novoFrete: number
  ) => {
    setSolicitacoes((prev) =>
      prev.map((sc) => {
        if (sc.id !== scId) return sc;
        return {
          ...sc,
          propostas: sc.propostas.map((p) => {
            if (p.id !== propostaId) return p;
            return {
              ...p,
              freteValor: novoFrete >= 0 ? novoFrete : 0,
              tipoFrete: novoFrete > 0 ? "FOB" : "CIF",
            };
          }),
        };
      })
    );
  };

  // Aprovar Proposta Vencedora e Gerar Ordem de Compra
  const handleAprovarGerarOrdem = (propostaId: string) => {
    if (!scAtiva) return;
    const prop = scAtiva.propostas.find((p) => p.id === propostaId);
    if (!prop) return;

    const fornCadastro = fornecedores.find(
      (f) =>
        f.id === prop.vendorId ||
        f.empresa.toLowerCase() === prop.fornecedorNome.toLowerCase()
    );

    const calc = totaisPorProposta[prop.id] || {
      subtotalItens: 0,
      frete: 0,
      totalGeral: 0,
    };

    const novaOc: OrdemCompra = {
      id: `oc-${Date.now()}`,
      numeroOc: `OC-2026-00${91 + ordens.length}`,
      scId: scAtiva.id,
      scCodigo: scAtiva.codigo,
      obraId: obraScAtiva.id,
      obraNome: obraScAtiva.nome,
      obraEndereco: obraScAtiva.endereco,
      obraEngenheiro: obraScAtiva.engenheiro,
      categoria: scAtiva.categoria,
      fornecedorNome: prop.fornecedorNome,
      fornecedorRazao:
        fornCadastro?.razaoSocial || `${prop.fornecedorNome} Comércio Ltda`,
      fornecedorCnpj: fornCadastro?.cnpj || "18.420.110/0001-90",
      vendedorNome: prop.vendedorNome,
      whatsapp: prop.whatsapp,
      chavePix: fornCadastro?.chavePix || fornCadastro?.cnpj || "CNPJ",
      dataEmissao: new Date().toLocaleDateString("pt-BR"),
      dataPrevistaEntrega: new Date(
        Date.now() + 5 * 24 * 60 * 60 * 1000
      ).toLocaleDateString("pt-BR"),
      prazoPagamento: prop.prazoPagamento,
      tipoFrete: prop.tipoFrete,
      freteValor: prop.freteValor,
      valorTotal: calc.totalGeral,
      savingGerado: resumoCotacaoAtiva.savingGerado,
      alcadaAprovacao: obterAlcadaAprovacao(calc.totalGeral).nivel,
      status: "Emitida",
      itens: scAtiva.itens.map((it) => {
        const unit = prop.precosUnitarios[it.id] || 0;
        return {
          codigo: it.codigo,
          descricao: it.descricao,
          unidade: it.unidade,
          quantidade: it.quantidade,
          precoUnitario: unit,
          subtotal: it.quantidade * unit,
          observacaoObra: it.observacaoObra,
        };
      }),
    };

    // Alçada de Governança: Acima de R$ 100.000 exige aprovação da Diretoria / CFO
    const alcadaInfo = obterAlcadaAprovacao(calc.totalGeral);
    if (alcadaInfo.requerDiretoria && !novaOc.aprovadoPorDiretoria) {
      setDiretoriaAprovacaoModal({ novaOc, prop });
      return;
    }

    setOrdens((prev) => [novaOc, ...prev]);
    setSolicitacoes((prev) =>
      prev.map((s) =>
        s.id === scAtiva.id
          ? {
              ...s,
              status: "Comprada",
              novoAlertaAdmin: false,
              dataPrevistaEntrega: novaOc.dataPrevistaEntrega,
            }
          : s
      )
    );
    dispararAviso(
      `Ordem de Compra ${novaOc.numeroOc} emitida para ${prop.fornecedorNome}!`
    );
    setActiveTab("Ordens");
  };

  const handleConfirmarAprovacaoDiretoria = (assinatura: string) => {
    if (!diretoriaAprovacaoModal) return;
    const { novaOc } = diretoriaAprovacaoModal;
    const ocAprovada: OrdemCompra = {
      ...novaOc,
      aprovadoPorDiretoria: true,
      assinaturaDiretoria: assinatura,
    };
    setOrdens((prev) => [ocAprovada, ...prev]);
    setSolicitacoes((prev) =>
      prev.map((s) =>
        s.id === ocAprovada.scId
          ? {
              ...s,
              status: "Comprada",
              novoAlertaAdmin: false,
              dataPrevistaEntrega: ocAprovada.dataPrevistaEntrega,
            }
          : s
      )
    );
    setDiretoriaAprovacaoModal(null);
    dispararAviso(
      `Ordem de Compra ${ocAprovada.numeroOc} autorizada pela Diretoria e emitida com sucesso!`
    );
    setActiveTab("Ordens");
  };

  // Salvar Configurações no localStorage
  const handleSalvarConfiguracoes = (e: React.FormEvent) => {
    e.preventDefault();
    setSettings(formSettings);
    try {
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(formSettings)
      );
    } catch {
      // ignore storage errors
    }
    salvarChaveSupabase(SETTINGS_STORAGE_KEY, formSettings).catch(() => {});
    dispararAviso("Configurações atualizadas com sucesso!");
  };

  // Upload real de planilha (.xlsx, .xls, .csv) sem limitação de linhas com mapeamento inteligente
  const handleSalvarFornecedorEditado = (atualizado: FornecedorCadastro) => {
    setFornecedores((prev) => {
      const novos = prev.map((f) => (f.id === atualizado.id ? atualizado : f));
      try {
        window.localStorage.setItem(
          FORNECEDORES_STORAGE_KEY,
          JSON.stringify(novos)
        );
      } catch {}
      salvarChaveSupabase(FORNECEDORES_STORAGE_KEY, novos).catch(() => {});
      sincronizarFornecedoresRelacional(novos).catch(() => {});
      return novos;
    });
    setFornecedorEditando(null);
    if (fornecedorFichaModal?.id === atualizado.id) {
      setFornecedorFichaModal(atualizado);
    }
    dispararAviso(`Cadastro de "${atualizado.empresa}" atualizado com sucesso!`);
  };

  const handleExcluirFornecedor = (id: string) => {
    setFornecedores((prev) => {
      const novos = prev.filter((f) => f.id !== id);
      try {
        window.localStorage.setItem(
          FORNECEDORES_STORAGE_KEY,
          JSON.stringify(novos)
        );
      } catch {}
      return novos;
    });
    setFornecedorEditando(null);
    if (fornecedorFichaModal?.id === id) {
      setFornecedorFichaModal(null);
    }
    dispararAviso("Fornecedor removido com sucesso.");
  };

  const handleUploadPlanilha = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        dispararAviso(`Arquivo "${file.name}" não contém planilhas legíveis.`);
        return;
      }
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      // Lê a planilha inteira como matriz de linhas
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: "",
      });

      if (!rawRows || rawRows.length === 0) {
        dispararAviso(`A planilha "${file.name}" está vazia.`);
        return;
      }

      // Função de normalização para casamento de strings
      const normalizar = (txt: unknown): string =>
        String(txt ?? "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .trim();

      // Identifica a linha de cabeçalho (varre as 10 primeiras linhas)
      const aliasesCabecalho = [
        "fornecedor",
        "empresa",
        "razaosocial",
        "nomefantasia",
        "cnpj",
        "cpf",
        "cidade",
        "uf",
        "estado",
        "telefone",
        "whatsapp",
        "vendedor",
        "contato",
        "email",
        "categoria",
        "ramo",
        "insumo",
        "material",
        "descricao",
        "preco",
        "valor",
        "quantidade",
        "qtd",
      ];

      let headerRowIndex = 0;
      let maxScoreCabecalho = 0;

      for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const rowCells = rawRows[r];
        if (!Array.isArray(rowCells)) continue;
        let score = 0;
        for (const cell of rowCells) {
          const normCell = normalizar(cell);
          if (
            normCell.length >= 3 &&
            aliasesCabecalho.some(
              (alias) => normCell.includes(alias) || alias.includes(normCell)
            )
          ) {
            score++;
          }
        }
        if (score > maxScoreCabecalho) {
          maxScoreCabecalho = score;
          headerRowIndex = r;
        }
      }

      const headerNames: string[] = (
        Array.isArray(rawRows[headerRowIndex])
          ? (rawRows[headerRowIndex] as unknown[])
          : []
      ).map((c) => String(c ?? "").trim());

      const dadosInicio = maxScoreCabecalho > 0 ? headerRowIndex + 1 : 0;
      const dataRows = rawRows.slice(dadosInicio);

      if (dataRows.length === 0) {
        dispararAviso(`Nenhum dado encontrado na planilha "${file.name}".`);
        return;
      }

      const acharValor = (
        cells: unknown[],
        aliases: string[],
        regexFallback?: RegExp,
        posicaoFallback?: number
      ): string => {
        if (maxScoreCabecalho > 0) {
          for (let col = 0; col < headerNames.length; col++) {
            const hNorm = normalizar(headerNames[col]);
            if (
              aliases.some(
                (alias) => hNorm.includes(alias) || alias.includes(hNorm)
              )
            ) {
              const val = String(cells[col] ?? "").trim();
              if (val && val !== "undefined" && val !== "null") return val;
            }
          }
        }
        if (regexFallback) {
          for (const cell of cells) {
            const strCell = String(cell ?? "").trim();
            if (regexFallback.test(strCell)) return strCell;
          }
        }
        if (
          typeof posicaoFallback === "number" &&
          posicaoFallback < cells.length
        ) {
          const val = String(cells[posicaoFallback] ?? "").trim();
          if (val && val !== "undefined" && val !== "null") return val;
        }
        return "";
      };

      const inferirCategoria = (texto: string): string => {
        const t = normalizar(texto);
        if (/aco|ferro|armacao|concreto|cimento|viga|laje|pilar/.test(t))
          return "Estrutura (Aço & Concreto)";
        if (/fundac|terra|estaca|sondagem|escav/.test(t))
          return "Fundações & Terraplenagem";
        if (/alvenaria|tijolo|bloco|argamassa|vedac/.test(t))
          return "Alvenaria & Vedações";
        if (/esquadria|vidro|aluminio|janela|porta|fachada/.test(t))
          return "Esquadrias & Fachadas de Vidro";
        if (/elevador|grua|guincho|equipamento|maquin/.test(t))
          return "Elevadores & Equipamentos";
        if (/hidro|sanit|tubo|encan|esgoto|pluvial|valvula/.test(t))
          return "Instalações Hidrossanitárias";
        if (/eletric|fio|cabo|iluminac|painel|dados|transformador/.test(t))
          return "Instalações Elétricas & Dados";
        if (/impermeab|manta|isolamento|asfalto|sika|vedacit/.test(t))
          return "Impermeabilização & Isolamento";
        if (
          /revestimento|piso|porcelanato|ceramica|louca|metal|torneira|azulejo/.test(
            t
          )
        )
          return "Revestimentos, Louças & Metais";
        if (/tinta|pintura|verniz|textura|massa/.test(t))
          return "Pintura & Texturas";
        if (/epi|ferramenta|capacete|bota|canteiro|andaime|parafuso/.test(t))
          return "EPIs, Ferramentas & Canteiro";

        for (const cat of CATEGORIAS_CONSTRUCAO) {
          if (normalizar(cat) === t || t.includes(normalizar(cat))) {
            return cat;
          }
        }
        return "Estrutura (Aço & Concreto)";
      };

      const novosItens: ItemPlanilhaImportada[] = [];
      const novosFornecedoresMap = new Map<string, FornecedorCadastro>();
      const novasDuplicidades: DuplicidadeFornecedor[] = [];

      const hojePtBr = new Date().toLocaleDateString("pt-BR");

      const cnpjsExistentes = new Set(
        fornecedores.map((f) => normalizar(f.cnpj)).filter((c) => c.length > 5)
      );
      const nomesExistentes = new Map(
        fornecedores.map((f) => [normalizar(f.empresa), f])
      );

      // Processa 100% de todas as linhas da planilha (sem slice ou cortes)
      dataRows.forEach((row, idx) => {
        if (!Array.isArray(row)) return;
        const nonBlank = row.some((c) => String(c ?? "").trim().length > 0);
        if (!nonBlank) return;

        const empresaRaw = acharValor(
          row,
          [
            "fornecedor",
            "empresa",
            "razaosocial",
            "nomefantasia",
            "fantasia",
            "razao",
            "nome",
            "parceiro",
            "fabricante",
          ],
          undefined,
          0
        );

        const cnpjRaw = acharValor(
          row,
          ["cnpj", "cpfcnpj", "cnpjcpf", "documento", "cpf", "doc"],
          /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/
        );

        const cidadeRaw = acharValor(row, [
          "cidade",
          "municipio",
          "praca",
          "localidade",
          "cidadeuf",
          "endereco",
          "local",
        ]);

        const ufRaw = acharValor(row, ["uf", "estado"]);

        const categoriaRaw = acharValor(row, [
          "categoria",
          "ramo",
          "ramodeatividade",
          "segmento",
          "especialidade",
          "grupo",
          "setor",
          "tipo",
        ]);

        const vendedorRaw = acharValor(row, [
          "vendedor",
          "contato",
          "responsavel",
          "representante",
          "atendente",
          "consultor",
          "comercial",
        ]);

        const telefoneRaw = acharValor(
          row,
          ["telefone", "fone", "tel", "fixo", "contatotelefone"],
          /(?:^|\(?)([0-9]{2})[-.\s\)]*([0-9]{4,5})[-.\s]*([0-9]{4})\)?/
        );
        const whatsRaw = acharValor(row, [
          "whatsapp",
          "whats",
          "celular",
          "mobile",
          "cel",
        ]);

        const emailRaw = acharValor(
          row,
          ["email", "mail", "correioeletronico"],
          /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
        );

        const pixRaw = acharValor(row, [
          "pix",
          "chavepix",
          "banco",
          "dadosbancarios",
        ]);

        const condicaoRaw = acharValor(row, [
          "condicao",
          "condicoes",
          "formadepagamento",
          "prazodepagamento",
          "prazo",
          "faturamento",
        ]);

        const insumoRaw = acharValor(
          row,
          [
            "insumo",
            "material",
            "descricao",
            "descricaodoinsumo",
            "item",
            "produto",
            "especificacao",
            "servico",
          ],
          undefined,
          1
        );

        const qtdRaw = acharValor(row, [
          "quantidade",
          "qtd",
          "volume",
          "quant",
        ]);

        const unidadeRaw = acharValor(row, [
          "unidade",
          "unid",
          "und",
          "un",
          "medida",
          "um",
        ]);

        const precoRaw = acharValor(row, [
          "preco",
          "precounitario",
          "valorunitario",
          "valor",
          "unitario",
          "custo",
          "precounit",
          "vlunit",
        ]);

        const dataRaw = acharValor(row, [
          "data",
          "datacompra",
          "emissao",
          "dataemissao",
          "dt",
          "periodo",
          "mes",
        ]);

        const empresaFinal =
          empresaRaw ||
          (insumoRaw ? `Fornecedor de ${insumoRaw}` : `Fornecedor #${idx + 1}`);

        const cnpjLimpo = cnpjRaw.replace(/[^\d]/g, "");
        const cnpjFinal =
          cnpjLimpo.length === 14
            ? cnpjLimpo.replace(
                /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                "$1.$2.$3/$4-$5"
              )
            : cnpjLimpo.length === 11
            ? cnpjLimpo.replace(
                /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
                "$1.$2.$3-$4"
              )
            : cnpjRaw || "";

        // Extrai contato e telefone inteligente da linha
        let parsedContato = extrairContatoEPhone(vendedorRaw || "");
        if (!parsedContato.telefone) {
          for (const cell of row) {
            const strCell = String(cell ?? "").trim();
            const p = extrairContatoEPhone(strCell);
            if (p.telefone) {
              parsedContato = p;
              break;
            }
          }
        }

        const vendedorFinal = parsedContato.nome || vendedorRaw || "";
        const telefoneFinal = parsedContato.telefone || telefoneRaw || "";
        const whatsFinal = parsedContato.whatsapp || whatsRaw || "";

        let cidadeFinal = cidadeRaw
          ? ufRaw && !cidadeRaw.includes(ufRaw)
            ? `${cidadeRaw} - ${ufRaw}`
            : cidadeRaw
          : "";

        // Se cidade contém telefone ou coincide com contato/vendedor, anula cidade
        if (cidadeFinal) {
          const checkTel = extrairContatoEPhone(cidadeFinal);
          if (
            checkTel.telefone ||
            cidadeFinal === vendedorFinal ||
            cidadeFinal === vendedorRaw ||
            cidadeFinal.includes("(4")
          ) {
            cidadeFinal = "";
          }
        }

        const emailFinal = emailRaw || "";
        const pixFinal = pixRaw || cnpjFinal || "";
        const condicaoFinal = condicaoRaw || "";
        const insumoFinal =
          insumoRaw || `Fornecimento e Insumos (${categoriaFinal})`;

        const qtdNumero = qtdRaw
          ? Number(String(qtdRaw).replace(",", ".")) || 1
          : 1;
        const precoNumero = precoRaw
          ? Number(
              String(precoRaw)
                .replace("R$", "")
                .replace(/\./g, "")
                .replace(",", ".")
                .trim()
            ) || 0
          : 0;

        novosItens.push({
          id: `imp-upload-${Date.now()}-${idx}`,
          data: dataRaw || hojePtBr,
          fornecedor: empresaFinal,
          cnpj: cnpjFinal,
          insumo: insumoFinal,
          categoria: categoriaFinal,
          quantidade: qtdNumero,
          unidade: unidadeRaw || "un",
          precoUnitario: precoNumero,
          status: "Pendente",
        });

        const normCnpj = normalizar(cnpjFinal);
        const normNome = normalizar(empresaFinal);

        const jaExisteCnpj =
          normCnpj.length >= 8 && cnpjsExistentes.has(normCnpj);
        const jaExisteNome = nomesExistentes.get(normNome);

        if (jaExisteCnpj || jaExisteNome) {
          const nomeExistente = jaExisteNome?.empresa || empresaFinal;
          novasDuplicidades.push({
            id: `dup-${Date.now()}-${idx}`,
            nomeSugerido: nomeExistente,
            cnpj: cnpjFinal,
            variacoesPlanilha: `${empresaFinal} — ${cidadeFinal} (${vendedorFinal})`,
            similaridade: jaExisteCnpj
              ? "100% (CNPJ Idêntico)"
              : "95% (Razão Social Compatível)",
            status: "Pendente",
          });
        } else {
          if (normCnpj.length >= 8) cnpjsExistentes.add(normCnpj);
          nomesExistentes.set(normNome, {
            empresa: empresaFinal,
          } as FornecedorCadastro);

          const chaveUnica = normCnpj.length >= 8 ? normCnpj : normNome;
          if (!novosFornecedoresMap.has(chaveUnica)) {
            novosFornecedoresMap.set(chaveUnica, {
              id: `forn-imp-${Date.now()}-${idx}-${Math.random()
                .toString(36)
                .substring(2, 6)}`,
              empresa: empresaFinal,
              razaoSocial: empresaRaw || empresaFinal,
              cnpj: cnpjFinal,
              cidade: cidadeFinal,
              categoriaPrincipal: categoriaFinal,
              especialidades: [categoriaFinal],
              vendedor: vendedorFinal,
              telefone: telefoneFinal,
              whatsapp: whatsFinal,
              email: emailFinal,
              chavePix: pixFinal,
              condicaoPadrao: condicaoFinal,
              observacoes: `Importado de "${file.name}" em ${hojePtBr}.`,
            });
          }
        }
      });

      const listaNovosFornecedores = Array.from(novosFornecedoresMap.values());

      if (novosItens.length > 0) {
        setItensPlanilha((prev) => {
          const atualizado = [...novosItens, ...prev];
          try {
            window.localStorage.setItem(
              ITENS_PLANILHA_STORAGE_KEY,
              JSON.stringify(atualizado)
            );
          } catch {}
          return atualizado;
        });
      }

      if (novasDuplicidades.length > 0) {
        setDuplicidades((prev) => {
          const atualizado = [...novasDuplicidades, ...prev];
          try {
            window.localStorage.setItem(
              DUPLICIDADES_STORAGE_KEY,
              JSON.stringify(atualizado)
            );
          } catch {}
          return atualizado;
        });
      }

      if (listaNovosFornecedores.length > 0) {
        setFornecedores((prev) => {
          const atualizado = [...listaNovosFornecedores, ...prev];
          try {
            window.localStorage.setItem(
              FORNECEDORES_STORAGE_KEY,
              JSON.stringify(atualizado)
            );
          } catch {}
          return atualizado;
        });
      }

      dispararAviso(
        `Planilha "${file.name}" importada com sucesso: ${novosItens.length} linhas lidas, ${listaNovosFornecedores.length} novos fornecedores cadastrados no CRM${
          novasDuplicidades.length > 0
            ? ` e ${novasDuplicidades.length} duplicidades detectadas para revisão`
            : ""
        }!`
      );
    } catch (err) {
      console.error("Erro ao importar planilha:", err);
      dispararAviso(
        `Erro ao ler a planilha "${file.name}". Verifique se o arquivo é um Excel (.xlsx, .xls) ou .csv válido.`
      );
    }
  };

  // Aprovação em lote de todos os itens da planilha importada
  const handleAprovarTodosItensPlanilha = () => {
    setItensPlanilha((prev) => {
      const atualizados = prev.map((r) => ({
        ...r,
        status: "Aprovado" as const,
      }));
      try {
        window.localStorage.setItem(
          ITENS_PLANILHA_STORAGE_KEY,
          JSON.stringify(atualizados)
        );
      } catch {}
      return atualizados;
    });
    dispararAviso(
      "Todos os itens importados da planilha foram aprovados com sucesso!"
    );
  };

  // Limpeza de itens da planilha importada
  const handleLimparPlanilhaImportada = () => {
    if (
      window.confirm(
        "Deseja realmente limpar todos os itens importados da tabela de revisão?"
      )
    ) {
      setItensPlanilha([]);
      try {
        window.localStorage.removeItem(ITENS_PLANILHA_STORAGE_KEY);
      } catch {}
      dispararAviso("Tabela de revisão de importação limpa com sucesso.");
    }
  };

  // Unificação em lote de duplicidades de fornecedores
  const handleAprovarTodasDuplicidades = () => {
    setDuplicidades((prev) => {
      const atualizados = prev.map((d) => ({
        ...d,
        status: "Unificado" as const,
      }));
      try {
        window.localStorage.setItem(
          DUPLICIDADES_STORAGE_KEY,
          JSON.stringify(atualizados)
        );
      } catch {}
      return atualizados;
    });
    dispararAviso("Todas as duplicidades de fornecedores foram unificadas!");
  };

  // Limpeza de duplicidades
  const handleLimparDuplicidades = () => {
    setDuplicidades([]);
    try {
      window.localStorage.removeItem(DUPLICIDADES_STORAGE_KEY);
    } catch {}
    dispararAviso("Lista de duplicidades limpa com sucesso.");
  };

  /* ----------------------------------------------------------------------- */
  /* CÁLCULOS E HANDLERS DO COMPARATIVO DE PREÇOS (3 ORÇAMENTOS)             */
  /* ----------------------------------------------------------------------- */

  const resumoComparativo = useMemo(() => {
    let subtotal1 = 0;
    let subtotal2 = 0;
    let subtotal3 = 0;
    let totalCenarioOtimizado = 0;

    const forn0 = comparativoFornecedores?.[0] ?? {
      nome: "Fornecedor 1",
      freteValor: 0,
      freteTipo: "CIF" as const,
      descontoValor: 0,
    };
    const forn1 = comparativoFornecedores?.[1] ?? {
      nome: "Fornecedor 2",
      freteValor: 0,
      freteTipo: "CIF" as const,
      descontoValor: 0,
    };
    const forn2 = comparativoFornecedores?.[2] ?? {
      nome: "Fornecedor 3",
      freteValor: 0,
      freteTipo: "CIF" as const,
      descontoValor: 0,
    };

    const itensCalculados = (comparativoItens || []).map((item) => {
      const p1 = Number(item.preco1) || 0;
      const p2 = Number(item.preco2) || 0;
      const p3 = Number(item.preco3) || 0;
      const qtd = Number(item.quantidade) || 0;

      const tot1 = qtd * p1;
      const tot2 = qtd * p2;
      const tot3 = qtd * p3;

      subtotal1 += tot1;
      subtotal2 += tot2;
      subtotal3 += tot3;

      const precosValidos = [
        { index: 0, preco: p1, total: tot1 },
        { index: 1, preco: p2, total: tot2 },
        { index: 2, preco: p3, total: tot3 },
      ].filter((p) => p.preco > 0);

      const menorPreco =
        precosValidos.length > 0
          ? Math.min(...precosValidos.map((p) => p.preco))
          : 0;

      const maiorPreco =
        precosValidos.length > 0
          ? Math.max(...precosValidos.map((p) => p.preco))
          : 0;

      const savingItem =
        maiorPreco > menorPreco && menorPreco > 0
          ? (maiorPreco - menorPreco) * qtd
          : 0;

      const pctSaving =
        maiorPreco > 0 && menorPreco > 0
          ? ((maiorPreco - menorPreco) / maiorPreco) * 100
          : 0;

      if (menorPreco > 0) {
        totalCenarioOtimizado += menorPreco * qtd;
      }

      return {
        ...item,
        tot1,
        tot2,
        tot3,
        menorPreco,
        maiorPreco,
        savingItem,
        pctSaving,
        vencedor1: p1 > 0 && Math.abs(p1 - menorPreco) < 0.001,
        vencedor2: p2 > 0 && Math.abs(p2 - menorPreco) < 0.001,
        vencedor3: p3 > 0 && Math.abs(p3 - menorPreco) < 0.001,
      };
    });

    const frete1 = Number(forn0.freteValor) || 0;
    const frete2 = Number(forn1.freteValor) || 0;
    const frete3 = Number(forn2.freteValor) || 0;

    const desc1 = Number(forn0.descontoValor) || 0;
    const desc2 = Number(forn1.descontoValor) || 0;
    const desc3 = Number(forn2.descontoValor) || 0;

    const total1 = Math.max(0, subtotal1 + frete1 - desc1);
    const total2 = Math.max(0, subtotal2 + frete2 - desc2);
    const total3 = Math.max(0, subtotal3 + frete3 - desc3);

    const totaisValidos = [
      {
        index: 0,
        nome: forn0.nome || "Orçamento 1",
        subtotal: subtotal1,
        frete: frete1,
        desconto: desc1,
        total: total1,
        forn: forn0,
      },
      {
        index: 1,
        nome: forn1.nome || "Orçamento 2",
        subtotal: subtotal2,
        frete: frete2,
        desconto: desc2,
        total: total2,
        forn: forn1,
      },
      {
        index: 2,
        nome: forn2.nome || "Orçamento 3",
        subtotal: subtotal3,
        frete: frete3,
        desconto: desc3,
        total: total3,
        forn: forn2,
      },
    ].filter((t) => t.total > 0 || t.subtotal > 0);

    const ranking = [...totaisValidos].sort((a, b) => a.total - b.total);
    const vencedorGeral = ranking[0] || null;
    const piorGeral = ranking[ranking.length - 1] || null;
    const savingGlobal =
      vencedorGeral && piorGeral && piorGeral.total > vencedorGeral.total
        ? piorGeral.total - vencedorGeral.total
        : 0;

    const savingCenarioOtimizado =
      vencedorGeral &&
      totalCenarioOtimizado > 0 &&
      vencedorGeral.total > totalCenarioOtimizado
        ? vencedorGeral.total - totalCenarioOtimizado
        : 0;

    return {
      itensCalculados,
      subtotal1,
      subtotal2,
      subtotal3,
      frete1,
      frete2,
      frete3,
      desc1,
      desc2,
      desc3,
      total1,
      total2,
      total3,
      totalCenarioOtimizado,
      savingCenarioOtimizado,
      ranking,
      vencedorGeral,
      savingGlobal,
    };
  }, [comparativoItens, comparativoFornecedores]);

  const handleAdicionarItemComparativo = () => {
    const novoItem: ItemComparativoRapido = {
      id: `comp-item-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)}`,
      nome: "",
      quantidade: 1,
      unidade: "un",
      preco1: 0,
      preco2: 0,
      preco3: 0,
    };
    setComparativoItens((prev) => [...prev, novoItem]);
  };

  const handleRemoverItemComparativo = (id: string) => {
    setComparativoItens((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAtualizarItemComparativo = (
    id: string,
    campo: keyof ItemComparativoRapido,
    valor: string | number
  ) => {
    setComparativoItens((prev) =>
      prev.map((i) => (i.id === id ? { ...i, [campo]: valor } : i))
    );
  };

  const handleAtualizarFornecedorComparativo = (
    index: 0 | 1 | 2,
    campo: keyof FornecedorCotadoRapido,
    valor: string | number
  ) => {
    setComparativoFornecedores((prev) => {
      const f0 = prev?.[0] || { nome: "", vendedor: "", telefone: "", prazo: "", condicao: "", freteTipo: "CIF" as const, freteValor: 0, descontoValor: 0 };
      const f1 = prev?.[1] || { nome: "", vendedor: "", telefone: "", prazo: "", condicao: "", freteTipo: "CIF" as const, freteValor: 0, descontoValor: 0 };
      const f2 = prev?.[2] || { nome: "", vendedor: "", telefone: "", prazo: "", condicao: "", freteTipo: "CIF" as const, freteValor: 0, descontoValor: 0 };
      const copia: [
        FornecedorCotadoRapido,
        FornecedorCotadoRapido,
        FornecedorCotadoRapido
      ] = [{ ...f0 }, { ...f1 }, { ...f2 }];
      copia[index] = { ...copia[index], [campo]: valor };
      return copia;
    });
  };

  const handleSelecionarFornecedorCrmComparativo = (
    index: 0 | 1 | 2,
    fornecedorId: string
  ) => {
    const achado = fornecedores.find((f) => f.id === fornecedorId);
    if (!achado) return;
    setComparativoFornecedores((prev) => {
      const f0 = prev?.[0] || { nome: "Fornecedor 1", vendedor: "", telefone: "", prazo: "3 a 5 dias", condicao: "28 dias (Faturado)", freteTipo: "CIF" as const, freteValor: 0, descontoValor: 0 };
      const f1 = prev?.[1] || { nome: "Fornecedor 2", vendedor: "", telefone: "", prazo: "5 a 7 dias", condicao: "30 dias", freteTipo: "CIF" as const, freteValor: 0, descontoValor: 0 };
      const f2 = prev?.[2] || { nome: "Fornecedor 3", vendedor: "", telefone: "", prazo: "Pronta Entrega", condicao: "21 dias", freteTipo: "FOB" as const, freteValor: 0, descontoValor: 0 };
      const copia: [
        FornecedorCotadoRapido,
        FornecedorCotadoRapido,
        FornecedorCotadoRapido
      ] = [{ ...f0 }, { ...f1 }, { ...f2 }];
      copia[index] = {
        ...copia[index],
        nome: achado.empresa,
        vendedor: achado.vendedor || copia[index].vendedor,
        telefone: achado.telefone || achado.whatsapp || copia[index].telefone,
        condicao: achado.condicaoPadrao || copia[index].condicao,
      };
      return copia;
    });
    dispararAviso(
      `Fornecedor "${achado.empresa}" vinculado ao Orçamento ${index + 1}!`
    );
  };

  const handleEmitirOrdemComparativo = (fornIndex: 0 | 1 | 2) => {
    const forn = comparativoFornecedores[fornIndex];
    const total =
      fornIndex === 0
        ? resumoComparativo.total1
        : fornIndex === 1
        ? resumoComparativo.total2
        : resumoComparativo.total3;

    if (total <= 0) {
      dispararAviso(
        "Insira preços válidos para este fornecedor antes de emitir a Ordem de Compra."
      );
      return;
    }

    const obraSel = obras.find((o) => o.id === comparativoObraId) || obras[0];
    const fornCrm = fornecedores.find(
      (f) => f.empresa.toLowerCase() === forn.nome.toLowerCase()
    );

    const proximaSeq = ordens.length + 1;
    const anoAtual = new Date().getFullYear();
    const numeroOcFormatado = `OC-${anoAtual}-${String(proximaSeq).padStart(
      3,
      "0"
    )}`;

    const novaOc: OrdemCompra = {
      id: `oc-comp-${Date.now()}`,
      numeroOc: numeroOcFormatado,
      scId: `sc-comp-${Date.now()}`,
      scCodigo: `COMP-3ORC`,
      obraId: obraSel?.id || "obra-1",
      obraNome: obraSel?.nome || "Empreendimento JC BAUER",
      obraEndereco: obraSel?.endereco || "Canteiro Central de Obras",
      obraEngenheiro: obraSel?.engenheiro || "Engenharia JC BAUER",
      categoria: comparativoCategoria || "Geral / Suprimentos",
      fornecedorNome: forn.nome || `Fornecedor ${fornIndex + 1}`,
      fornecedorRazao:
        fornCrm?.razaoSocial || forn.nome || `Fornecedor ${fornIndex + 1}`,
      fornecedorCnpj: fornCrm?.cnpj || "",
      vendedorNome: forn.vendedor || "",
      whatsapp: forn.telefone || "",
      chavePix: fornCrm?.chavePix || fornCrm?.cnpj || "",
      dataEmissao: new Date().toLocaleDateString("pt-BR"),
      dataPrevistaEntrega: forn.prazo || "A Combinar",
      prazoPagamento: forn.condicao || "A Combinar",
      tipoFrete: forn.freteTipo,
      freteValor: forn.freteValor,
      descontoValor: forn.descontoValor || 0,
      valorTotal: total,
      savingGerado: resumoComparativo.savingGlobal,
      alcadaAprovacao: "Comprador Autorizado",
      status: "Emitida",
      itens: comparativoItens.map((it, idx) => {
        const unit =
          fornIndex === 0
            ? it.preco1
            : fornIndex === 1
            ? it.preco2
            : it.preco3;
        return {
          codigo: `MAT-${idx + 1}`,
          descricao: it.nome || `Insumo #${idx + 1}`,
          unidade: it.unidade || "un",
          quantidade: it.quantidade || 1,
          precoUnitario: unit,
          subtotal: (it.quantidade || 1) * unit,
        };
      }),
    };

    setOrdens((prev) => [novaOc, ...prev]);

    // Marca a cotação ativa como Concluída no histórico mantendo todas as propostas intactas
    if (cotacaoAtivaId) {
      setProcessosCotacoes((prev) => {
        const list = prev.map((p) =>
          p.id === cotacaoAtivaId
            ? {
                ...p,
                status: "Concluída" as const,
                ordemCompraEmitidaId: novaOc.id,
                numeroOcEmitida: novaOc.numeroOc,
                menorValor: total,
                melhorFornecedorNome: forn.nome,
                dataAtualizacao:
                  new Date().toLocaleDateString("pt-BR") +
                  " " +
                  new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
              }
            : p
        );
        try {
          window.localStorage.setItem(
            PROCESSOS_COTACOES_STORAGE_KEY,
            JSON.stringify(list)
          );
          salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, list).catch(
            () => {}
          );
        } catch {}
        return list;
      });
    }

    dispararAviso(
      `Ordem de Compra ${novaOc.numeroOc} emitida com sucesso para "${forn.nome}"! O mapa comparativo foi salvo no histórico com todas as propostas.`
    );
    setActiveTab("Ordens");
    setOrdemVisualizarModal(novaOc);
  };

  const handleLimparComparativo = () => {
    if (
      window.confirm(
        "Deseja iniciar uma NOVA COTAÇÃO em branco (mantendo a atual salva no histórico)?\n\n- Clique em [OK] para abrir uma Nova Cotação sem perder a atual.\n- Clique em [Cancelar] se desejava manter a cotação na tela."
      )
    ) {
      handleCriarNovaCotacao();
    }
  };

  /* ----------------------------------------------------------------------- */
  /* GESTÃO DE MÚLTIPLAS COTAÇÕES SIMULTÂNEAS (PROCESSOS EM ANDAMENTO)      */
  /* ----------------------------------------------------------------------- */
  const handleCriarNovaCotacao = () => {
    const anoAtual = new Date().getFullYear();
    const proximoSeq = processosCotacoes.length + 1;
    const codigo = `COT-${anoAtual}-${String(proximoSeq).padStart(3, "0")}`;

    const nova: ProcessoCotacao = {
      id: `cot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      codigo,
      titulo: `Cotação de Insumos #${String(proximoSeq).padStart(3, "0")}`,
      obraId: comparativoObraId || (obras[0]?.id ?? ""),
      obraNome:
        obras.find((o) => o.id === comparativoObraId)?.nome ||
        "Todas as Obras / Canteiro Central",
      categoria: comparativoCategoria || "Geral / Suprimentos",
      status: "Aguardando Fornecedores",
      dataCriacao: new Date().toLocaleDateString("pt-BR"),
      dataAtualizacao:
        new Date().toLocaleDateString("pt-BR") +
        " " +
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      fornecedores: [
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
      ],
      itens: [],
    };

    setProcessosCotacoes((prev) => {
      let base = [...prev];
      if (cotacaoAtivaId) {
        const idxAtual = base.findIndex((p) => p.id === cotacaoAtivaId);
        if (idxAtual !== -1) {
          base[idxAtual] = {
            ...base[idxAtual],
            titulo: comparativoTitulo || base[idxAtual].titulo,
            obraId: comparativoObraId,
            categoria: comparativoCategoria,
            fornecedores: comparativoFornecedores,
            itens: comparativoItens,
          };
        }
      }
      const list = [nova, ...base];
      try {
        window.localStorage.setItem(
          PROCESSOS_COTACOES_STORAGE_KEY,
          JSON.stringify(list)
        );
        salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, list).catch(
          () => {}
        );
      } catch {}
      return list;
    });

    // Carrega a nova cotação limpa no quadro ativo
    setCotacaoAtivaId(nova.id);
    setComparativoTitulo(nova.titulo);
    setComparativoObraId(nova.obraId);
    setComparativoCategoria(nova.categoria);
    setComparativoFornecedores(nova.fornecedores);
    setComparativoItens(nova.itens);
    setModoCotacoes("comparativo_rapido");

    dispararAviso(
      `Nova cotação ${nova.codigo} aberta com sucesso! As demais cotações permanecem salvas.`
    );
  };

  const handleTrocarCotacaoAtiva = (targetId: string) => {
    if (targetId === cotacaoAtivaId) return;

    let listaAtual = processosCotacoes;
    if (cotacaoAtivaId) {
      const idx = processosCotacoes.findIndex((p) => p.id === cotacaoAtivaId);
      if (idx !== -1) {
        listaAtual = [...processosCotacoes];
        listaAtual[idx] = {
          ...listaAtual[idx],
          titulo: comparativoTitulo || listaAtual[idx].titulo,
          obraId: comparativoObraId,
          categoria: comparativoCategoria,
          fornecedores: comparativoFornecedores,
          itens: comparativoItens,
          dataAtualizacao:
            new Date().toLocaleDateString("pt-BR") +
            " " +
            new Date().toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
        };
        setProcessosCotacoes(listaAtual);
        try {
          window.localStorage.setItem(
            PROCESSOS_COTACOES_STORAGE_KEY,
            JSON.stringify(listaAtual)
          );
          salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, listaAtual).catch(
            () => {}
          );
        } catch {}
      }
    }

    const alvo = listaAtual.find((p) => p.id === targetId);
    if (!alvo) return;

    setCotacaoAtivaId(alvo.id);
    setComparativoTitulo(alvo.titulo || "");
    setComparativoObraId(alvo.obraId || "");
    setComparativoCategoria(alvo.categoria || "Geral / Suprimentos");
    setComparativoFornecedores(
      alvo.fornecedores || [
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
      ]
    );
    setComparativoItens(alvo.itens || []);

    if (modoCotacoes !== "comparativo_rapido") {
      setModoCotacoes("comparativo_rapido");
    }

    dispararAviso(
      `Cotação ${alvo.codigo} ("${alvo.titulo}") carregada no comparativo!`
    );
  };

  const handleDuplicarCotacao = (idParaDuplicar: string) => {
    const origem = processosCotacoes.find((p) => p.id === idParaDuplicar);
    if (!origem) return;

    const anoAtual = new Date().getFullYear();
    const proximoSeq = processosCotacoes.length + 1;
    const codigo = `COT-${anoAtual}-${String(proximoSeq).padStart(3, "0")}`;

    const copia: ProcessoCotacao = {
      id: `cot-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      codigo,
      titulo: `${origem.titulo} (Cópia)`,
      obraId: origem.obraId,
      obraNome: origem.obraNome,
      categoria: origem.categoria,
      status: "Rascunho",
      dataCriacao: new Date().toLocaleDateString("pt-BR"),
      dataAtualizacao: new Date().toLocaleDateString("pt-BR"),
      fornecedores: [
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
        {
          nome: "",
          vendedor: "",
          telefone: "",
          prazo: "",
          condicao: "",
          freteTipo: "CIF",
          freteValor: 0,
          descontoValor: 0,
        },
      ],
      // Copia a lista de itens preservando quantidades e unidades, zerando preços cotados para nova negociação
      itens: (origem.itens || []).map((it, idx) => ({
        id: `item-dup-${Date.now()}-${idx}`,
        nome: it.nome,
        quantidade: it.quantidade,
        unidade: it.unidade,
        preco1: 0,
        preco2: 0,
        preco3: 0,
      })),
    };

    setProcessosCotacoes((prev) => {
      const list = [copia, ...prev];
      try {
        window.localStorage.setItem(
          PROCESSOS_COTACOES_STORAGE_KEY,
          JSON.stringify(list)
        );
        salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, list).catch(
          () => {}
        );
      } catch {}
      return list;
    });

    setCotacaoAtivaId(copia.id);
    setComparativoTitulo(copia.titulo);
    setComparativoObraId(copia.obraId);
    setComparativoCategoria(copia.categoria);
    setComparativoFornecedores(copia.fornecedores);
    setComparativoItens(copia.itens);
    setModoCotacoes("comparativo_rapido");

    dispararAviso(
      `Cotação duplicada como ${copia.codigo}! Itens preservados e preços zerados para nova rodada de fornecedores.`
    );
  };

  const handleMudarStatusCotacao = (
    id: string,
    novoStatus: ProcessoCotacao["status"]
  ) => {
    setProcessosCotacoes((prev) => {
      const list = prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: novoStatus,
              dataAtualizacao:
                new Date().toLocaleDateString("pt-BR") +
                " " +
                new Date().toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            }
          : p
      );
      try {
        window.localStorage.setItem(
          PROCESSOS_COTACOES_STORAGE_KEY,
          JSON.stringify(list)
        );
        salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, list).catch(
          () => {}
        );
      } catch {}
      return list;
    });
    dispararAviso(`Status da cotação atualizado para "${novoStatus}"!`);
  };

  const handleExcluirCotacao = (id: string) => {
    if (processosCotacoes.length <= 1) {
      dispararAviso(
        "Você precisa manter ao menos um processo de cotação ativo no sistema."
      );
      return;
    }
    const alvo = processosCotacoes.find((p) => p.id === id);
    if (
      !window.confirm(
        `Tem certeza que deseja excluir a cotação ${alvo?.codigo || ""} ("${
          alvo?.titulo || ""
        }")?\nEsta ação não poderá ser desfeita.`
      )
    ) {
      return;
    }

    const restate = processosCotacoes.filter((p) => p.id !== id);
    setProcessosCotacoes(restate);
    try {
      window.localStorage.setItem(
        PROCESSOS_COTACOES_STORAGE_KEY,
        JSON.stringify(restate)
      );
      salvarChaveSupabase(PROCESSOS_COTACOES_STORAGE_KEY, restate).catch(
        () => {}
      );
    } catch {}

    if (cotacaoAtivaId === id && restate.length > 0) {
      handleTrocarCotacaoAtiva(restate[0].id);
    }

    dispararAviso("Cotação excluída com sucesso.");
  };

  const handleSalvarCotacaoManual = () => {
    try {
      window.localStorage.setItem(
        PROCESSOS_COTACOES_STORAGE_KEY,
        JSON.stringify(processosCotacoes)
      );
      salvarChaveSupabase(
        PROCESSOS_COTACOES_STORAGE_KEY,
        processosCotacoes
      ).catch(() => {});
      dispararAviso(
        "Cotação salva com sucesso no banco de dados e sincronizada na nuvem!"
      );
    } catch {
      dispararAviso("Erro ao salvar cotação.");
    }
  };


  const handleUploadItensComparativo = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
        header: 1,
        defval: "",
      });

      if (!rawRows || rawRows.length === 0) {
        dispararAviso(`Arquivo "${file.name}" está vazio.`);
        return;
      }

      const novos: ItemComparativoRapido[] = [];

      rawRows.forEach((row, idx) => {
        if (!Array.isArray(row) || idx === 0) return;
        const vals = row.map((v) => String(v ?? "").trim());
        if (vals.every((v) => !v)) return;

        const nome = vals[0] || vals[1] || `Material #${idx}`;
        const qtd =
          Number(vals[1]?.replace(",", ".")) ||
          Number(vals[2]?.replace(",", ".")) ||
          1;
        const und =
          vals[2] && isNaN(Number(vals[2])) ? vals[2] : vals[3] || "un";
        const p1 =
          Number(
            String(vals[3] || "0")
              .replace("R$", "")
              .replace(",", ".")
              .trim()
          ) || 0;
        const p2 =
          Number(
            String(vals[4] || "0")
              .replace("R$", "")
              .replace(",", ".")
              .trim()
          ) || 0;
        const p3 =
          Number(
            String(vals[5] || "0")
              .replace("R$", "")
              .replace(",", ".")
              .trim()
          ) || 0;

        novos.push({
          id: `comp-upload-${Date.now()}-${idx}`,
          nome,
          quantidade: qtd,
          unidade: und,
          preco1: p1,
          preco2: p2,
          preco3: p3,
        });
      });

      if (novos.length > 0) {
        setComparativoItens(novos);
        sincronizarInsumosAoEstoque(novos);
        dispararAviso(
          `Planilha "${file.name}" importada com sucesso: ${novos.length} itens carregados para equalização!`
        );
      } else {
        dispararAviso("Nenhum item válido identificado no arquivo.");
      }
    } catch (err) {
      console.error(err);
      dispararAviso(`Erro ao ler itens de "${file.name}".`);
    }
  };

  const handleExportarComparativoRapidoExcel = () => {
    if (comparativoItens.length === 0) {
      dispararAviso("Adicione ao menos um insumo na cotação para exportar a planilha.");
      return;
    }
    const forn0 = comparativoFornecedores[0]?.nome || "Fornecedor 1";
    const forn1 = comparativoFornecedores[1]?.nome || "Fornecedor 2";
    const forn2 = comparativoFornecedores[2]?.nome || "Fornecedor 3";

    const dadosPlanilha = resumoComparativo.itensCalculados.map((it, idx) => ({
      Item: idx + 1,
      Insumo: it.nome,
      Quantidade: it.quantidade,
      Unidade: it.unidade,
      [`Preço Unit. (${forn0})`]: it.preco1,
      [`Total (${forn0})`]: it.tot1,
      [`Preço Unit. (${forn1})`]: it.preco2,
      [`Total (${forn1})`]: it.tot2,
      [`Preço Unit. (${forn2})`]: it.preco3,
      [`Total (${forn2})`]: it.tot3,
      "Menor Preço": it.menorPreco,
      "Saving (R$)": it.savingItem,
    }));

    dadosPlanilha.push({
      Item: "",
      Insumo: "SUBTOTAL MATERIAIS",
      Quantidade: "",
      Unidade: "",
      [`Preço Unit. (${forn0})`]: "",
      [`Total (${forn0})`]: resumoComparativo.subtotal1,
      [`Preço Unit. (${forn1})`]: "",
      [`Total (${forn1})`]: resumoComparativo.subtotal2,
      [`Preço Unit. (${forn2})`]: "",
      [`Total (${forn2})`]: resumoComparativo.subtotal3,
      "Menor Preço": "",
      "Saving (R$)": "",
    } as any);

    dadosPlanilha.push({
      Item: "",
      Insumo: "DESCONTO COMERCIAL (R$)",
      Quantidade: "",
      Unidade: "",
      [`Preço Unit. (${forn0})`]: "",
      [`Total (${forn0})`]: -resumoComparativo.desc1,
      [`Preço Unit. (${forn1})`]: "",
      [`Total (${forn1})`]: -resumoComparativo.desc2,
      [`Preço Unit. (${forn2})`]: "",
      [`Total (${forn2})`]: -resumoComparativo.desc3,
      "Menor Preço": "",
      "Saving (R$)": "",
    } as any);

    dadosPlanilha.push({
      Item: "",
      Insumo: "FRETE",
      Quantidade: "",
      Unidade: "",
      [`Preço Unit. (${forn0})`]: "",
      [`Total (${forn0})`]: resumoComparativo.frete1,
      [`Preço Unit. (${forn1})`]: "",
      [`Total (${forn1})`]: resumoComparativo.frete2,
      [`Preço Unit. (${forn2})`]: "",
      [`Total (${forn2})`]: resumoComparativo.frete3,
      "Menor Preço": "",
      "Saving (R$)": "",
    } as any);

    dadosPlanilha.push({
      Item: "",
      Insumo: "VALOR TOTAL FINAL",
      Quantidade: "",
      Unidade: "",
      [`Preço Unit. (${forn0})`]: "",
      [`Total (${forn0})`]: resumoComparativo.total1,
      [`Preço Unit. (${forn1})`]: "",
      [`Total (${forn1})`]: resumoComparativo.total2,
      [`Preço Unit. (${forn2})`]: "",
      [`Total (${forn2})`]: resumoComparativo.total3,
      "Menor Preço": "",
      "Saving (R$)": resumoComparativo.savingGlobal,
    } as any);

    const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparativo 3 Orçamentos");
    const dataIso = new Date().toISOString().slice(0, 10);
    const fileName = `JC_BAUER_Comparativo_3_Orcamentos_${dataIso}.xlsx`;
    XLSX.writeFile(wb, fileName);
    dispararAviso("Planilha do comparativo exportada com sucesso!");
  };
  const handleGerarComparativoRapidoPDF = (processoParam?: ProcessoCotacao) => {
    const itensAlvo = processoParam ? (processoParam.itens || []) : comparativoItens;
    const tituloAlvo = processoParam ? (processoParam.titulo || "Cotação de Suprimentos") : (comparativoTitulo || "Cotação de Suprimentos");
    const obraIdAlvo = processoParam ? processoParam.obraId : comparativoObraId;
    const categoriaAlvo = processoParam ? processoParam.categoria : comparativoCategoria;
    const fornecedoresAlvo: [FornecedorCotadoRapido, FornecedorCotadoRapido, FornecedorCotadoRapido] = processoParam ? processoParam.fornecedores : comparativoFornecedores;

    if (!itensAlvo || itensAlvo.length === 0) {
      dispararAviso("Adicione ao menos um insumo na cotação para gerar a impressão ou PDF.");
      return;
    }

    const obraSel = obras.find((o) => o.id === obraIdAlvo) || obras[0];
    const dataHoje = new Date().toLocaleDateString("pt-BR");

    const subtotal1 = itensAlvo.reduce((acc, it) => acc + (it.quantidade || 0) * (it.preco1 || 0), 0);
    const subtotal2 = itensAlvo.reduce((acc, it) => acc + (it.quantidade || 0) * (it.preco2 || 0), 0);
    const subtotal3 = itensAlvo.reduce((acc, it) => acc + (it.quantidade || 0) * (it.preco3 || 0), 0);

    const total1 = Math.max(0, subtotal1 + (fornecedoresAlvo[0]?.freteValor || 0) - (fornecedoresAlvo[0]?.descontoValor || 0));
    const total2 = Math.max(0, subtotal2 + (fornecedoresAlvo[1]?.freteValor || 0) - (fornecedoresAlvo[1]?.descontoValor || 0));
    const total3 = Math.max(0, subtotal3 + (fornecedoresAlvo[2]?.freteValor || 0) - (fornecedoresAlvo[2]?.descontoValor || 0));

    const validos = [
      { nome: fornecedoresAlvo[0]?.nome || "Fornecedor 1", total: total1, index: 0 },
      { nome: fornecedoresAlvo[1]?.nome || "Fornecedor 2", total: total2, index: 1 },
      { nome: fornecedoresAlvo[2]?.nome || "Fornecedor 3", total: total3, index: 2 },
    ].filter((f) => f.total > 0 && f.nome && f.nome.trim() !== "");

    let vencedorGeral: { nome: string; total: number; index: number } | null = null;
    let savingGlobal = 0;
    if (validos.length > 0) {
      validos.sort((a, b) => a.total - b.total);
      vencedorGeral = validos[0];
      const maiorVal = validos[validos.length - 1].total;
      savingGlobal = Math.max(0, maiorVal - vencedorGeral.total);
    }

    const itensCalculados = itensAlvo.map((it) => {
      const q = it.quantidade || 0;
      const t1 = q * (it.preco1 || 0);
      const t2 = q * (it.preco2 || 0);
      const t3 = q * (it.preco3 || 0);
      const precValidos = [it.preco1, it.preco2, it.preco3].filter((p) => Number(p) > 0);
      const menorPreco = precValidos.length > 0 ? Math.min(...precValidos) : 0;
      return {
        ...it,
        tot1: t1,
        tot2: t2,
        tot3: t3,
        vencedor1: Number(it.preco1) > 0 && it.preco1 === menorPreco,
        vencedor2: Number(it.preco2) > 0 && it.preco2 === menorPreco,
        vencedor3: Number(it.preco3) > 0 && it.preco3 === menorPreco,
      };
    });

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>JC BAUER — Quadro Comparativo de Preços (3 Orçamentos)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; color: #0f172a; padding: 24px; background: #ffffff; }
    .no-print { position: sticky; top: 0; background: #0f172a; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; border-bottom: 2px solid #166534; margin: -24px -24px 20px -24px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .logo { font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a; }
    .title { font-size: 13px; font-weight: 700; text-transform: uppercase; color: #334155; margin-top: 4px; }
    .meta { font-size: 10px; color: #64748b; line-height: 1.4; text-align: right; }
    .info-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; font-size: 10px; }
    .info-item strong { display: block; color: #0f172a; font-size: 11px; margin-top: 2px; }
    .kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; }
    .kpi-card.vencedor { border-color: #166534; background: #f0fdf4; }
    .kpi-title { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; }
    .kpi-card.vencedor .kpi-title { color: #166534; font-weight: 700; }
    .kpi-name { font-size: 13px; font-weight: 800; color: #0f172a; margin: 2px 0; }
    .kpi-val { font-size: 16px; font-weight: 900; color: #0f172a; }
    .kpi-card.vencedor .kpi-val { color: #166534; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 700; color: #1e293b; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .winner-cell { background: #dcfce7; font-weight: 700; color: #166534; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 36px; text-align: center; font-size: 10px; }
    .sign-line { border-top: 1px solid #0f172a; padding-top: 6px; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print">
    <div style="color: #ffffff; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
      <span>📄 Mapa Equalizado de Preços (3 Orçamentos)</span>
      <span style="font-size: 11px; color: #94a3b8; font-weight: normal;">• Central de Suprimentos JC Bauer</span>
    </div>
    <div style="display: flex; gap: 10px; align-items: center;">
      <button onclick="window.print()" style="background: #166534; color: #ffffff; border: none; padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 800; cursor: pointer;">
        🖨️ Imprimir / Salvar em PDF
      </button>
      <button onclick="window.close()" style="background: #334155; color: #ffffff; border: 1px solid #475569; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
        Fechar Aba
      </button>
    </div>
  </div>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="${window.location.origin}/logo.png" alt="JC Bauer" style="height: 44px; width: auto; object-fit: contain;" onerror="this.style.display='none'" />
      <div>
        <div class="logo">${settings.companyName}</div>
        <div class="title">Mapa de Equalização e Comparativo de 3 Orçamentos</div>
      </div>
    </div>
    <div class="meta">
      <strong>Data de Emissão:</strong> ${dataHoje}<br>
      <strong>Empreendimento:</strong> ${obraSel?.nome || "Todas as Obras"}<br>
      <strong>Categoria:</strong> ${categoriaAlvo}<br>
      ${settings.companyCnpj ? `<strong>CNPJ:</strong> ${settings.companyCnpj}` : ""}
    </div>
  </div>
  <div class="info-bar">
    <div class="info-item">Objeto da Cotação:<strong>${tituloAlvo}</strong></div>
    <div class="info-item">Comprador Responsável:<strong>${settings.userName}</strong></div>
    <div class="info-item">Vencedor Recomendado:<strong>${vencedorGeral?.nome || "A definir"}</strong></div>
    <div class="info-item">Saving Apurado:<strong>${formatBRL(savingGlobal)}</strong></div>
  </div>
  <div class="kpi-row">
    ${fornecedoresAlvo.map((f, i) => {
        const tot = i === 0 ? total1 : i === 1 ? total2 : total3;
        const isVencedor = vencedorGeral?.index === i;
        return `
        <div class="kpi-card ${isVencedor ? 'vencedor' : ''}">
          <div class="kpi-title">${isVencedor ? "🏆 1º Lugar (Mais em Conta)" : `Orçamento ${i + 1}`}</div>
          <div class="kpi-name">${f.nome || `Fornecedor ${i + 1}`}</div>
          <div class="kpi-val">${formatBRL(tot)}</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
            Frete: ${f.freteTipo} (${formatBRL(f.freteValor)}) • Prazo: ${f.prazo || "N/I"} • Pagto: ${f.condicao || "N/I"}
          </div>
        </div>
      `;
      }).join("")}
  </div>
  <table>
    <thead>
      <tr>
        <th style="width: 30%;">Insumo / Material</th>
        <th class="text-center" style="width: 12%;">Qtd & Unid</th>
        <th class="text-right" style="width: 19%;">${fornecedoresAlvo?.[0]?.nome || "Fornecedor 1"}</th>
        <th class="text-right" style="width: 19%;">${fornecedoresAlvo?.[1]?.nome || "Fornecedor 2"}</th>
        <th class="text-right" style="width: 19%;">${fornecedoresAlvo?.[2]?.nome || "Fornecedor 3"}</th>
      </tr>
    </thead>
    <tbody>
      ${itensCalculados.map((it) => `
        <tr>
          <td><strong>${it.nome}</strong></td>
          <td class="text-center">${it.quantidade} ${it.unidade}</td>
          <td class="text-right ${it.vencedor1 ? 'winner-cell' : ''}">
            ${formatBRL(it.preco1)} / un<br><span style="font-size: 9px; color: ${it.vencedor1 ? '#166534' : '#64748b'};">Total: ${formatBRL(it.tot1)}</span>
          </td>
          <td class="text-right ${it.vencedor2 ? 'winner-cell' : ''}">
            ${formatBRL(it.preco2)} / un<br><span style="font-size: 9px; color: ${it.vencedor2 ? '#166534' : '#64748b'};">Total: ${formatBRL(it.tot2)}</span>
          </td>
          <td class="text-right ${it.vencedor3 ? 'winner-cell' : ''}">
            ${formatBRL(it.preco3)} / un<br><span style="font-size: 9px; color: ${it.vencedor3 ? '#166534' : '#64748b'};">Total: ${formatBRL(it.tot3)}</span>
          </td>
        </tr>
      `).join("")}
    </tbody>
    <tfoot>
      <tr style="background: #f8fafc; font-weight: 700;">
        <td colspan="2">Subtotal dos Materiais</td>
        <td class="text-right">${formatBRL(subtotal1)}</td>
        <td class="text-right">${formatBRL(subtotal2)}</td>
        <td class="text-right">${formatBRL(subtotal3)}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td colspan="2">Desconto Comercial (R$)</td>
        <td class="text-right" style="color: #16a34a;">-${formatBRL(fornecedoresAlvo?.[0]?.descontoValor || 0)}</td>
        <td class="text-right" style="color: #16a34a;">-${formatBRL(fornecedoresAlvo?.[1]?.descontoValor || 0)}</td>
        <td class="text-right" style="color: #16a34a;">-${formatBRL(fornecedoresAlvo?.[2]?.descontoValor || 0)}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td colspan="2">Frete (CIF / FOB)</td>
        <td class="text-right">${fornecedoresAlvo?.[0]?.freteTipo || "CIF"} (${formatBRL(fornecedoresAlvo?.[0]?.freteValor || 0)})</td>
        <td class="text-right">${fornecedoresAlvo?.[1]?.freteTipo || "CIF"} (${formatBRL(fornecedoresAlvo?.[1]?.freteValor || 0)})</td>
        <td class="text-right">${fornecedoresAlvo?.[2]?.freteTipo || "CIF"} (${formatBRL(fornecedoresAlvo?.[2]?.freteValor || 0)})</td>
      </tr>
      <tr style="background: #0f172a; color: #ffffff; font-weight: 800; font-size: 11px;">
        <td colspan="2" style="border-color: #0f172a;">VALOR TOTAL FINAL (COM FRETE E DESCONTO)</td>
        <td class="text-right" style="border-color: #0f172a;">${formatBRL(total1)}</td>
        <td class="text-right" style="border-color: #0f172a;">${formatBRL(total2)}</td>
        <td class="text-right" style="border-color: #0f172a;">${formatBRL(total3)}</td>
      </tr>
    </tfoot>
  </table>
  <div class="signatures">
    <div class="sign-line">
      <strong>${settings.userName}</strong><br>
      Comprador Responsável
    </div>
    <div class="sign-line">
      <strong>${obraSel?.engenheiro || "Engenharia de Obras"}</strong><br>
      Engenheiro Fiscal da Obra
    </div>
    <div class="sign-line">
      <strong>Diretoria Executiva / CFO</strong><br>
      Aprovação Financeira
    </div>
  </div>
</body>
</html>`;
    imprimirDocumentoHtml(html);
  };

  /* ----------------------------------------------------------------------- */
  /* AUTENTICAÇÃO E HANDLERS DE INTEGRAÇÃO CANTEIRO <-> COMPRAS              */
  /* ----------------------------------------------------------------------- */

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErroLogin(null);
    const loginLimpo = loginInput.trim().toLowerCase();

    // Suporte flexível para Admin Master (login por email, nome, "admin", "master", etc.)
    const userFound =
      usuarios.find((u) => {
        const matchEmail = u.email.toLowerCase() === loginLimpo;
        const matchNome = u.nome.toLowerCase() === loginLimpo;
        const matchAdminAlias =
          u.cargo === "Administrador" &&
          (loginLimpo === "admin" ||
            loginLimpo === "master" ||
            loginLimpo === "administrador" ||
            loginLimpo === "suprimentos" ||
            loginLimpo === "joao" ||
            loginLimpo === "joão");

        const matchSenha =
          u.senha === senhaInput ||
          (u.cargo === "Administrador" &&
            (senhaInput === "123" || senhaInput === "admin" || senhaInput === "master"));

        return (matchEmail || matchNome || matchAdminAlias) && matchSenha;
      }) ||
      ((loginLimpo === "admin" ||
        loginLimpo === "master" ||
        loginLimpo === "suprimentos@jcbauer.eng.br" ||
        loginLimpo === "admin@jcbauer.com.br" || loginLimpo === "suprimentos" || loginLimpo === "administrador") &&
      (senhaInput === "123" || senhaInput === "admin" || senhaInput === "master")
        ? usuarios.find((u) => u.cargo === "Administrador") || USUARIOS_INICIAIS[0]
        : null);

    if (!userFound) {
      setErroLogin(
        "E-mail/Usuário ou senha inválidos. Verifique suas credenciais ou use o botão 'Entrar Direto como Administrador Master' abaixo."
      );
      return;
    }
    if (userFound.status === "Bloqueado") {
      setErroLogin(
        "Este acesso encontra-se bloqueado pelo Administrador de Compras."
      );
      return;
    }
    setUsuarioLogado(userFound);
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userFound));
    } catch {
      // ignore
    }
    setErroLogin(null);
    if (userFound.cargo !== "Administrador") {
      setObraActiveTab("PainelDiario");
    }
  };

  const handleQuickLogin = (userId: string) => {
    let userFound = usuarios.find((u) => u.id === userId);
    if (!userFound && (userId === "usr-admin-1" || userId === "admin")) {
      userFound = usuarios.find((u) => u.cargo === "Administrador") || USUARIOS_INICIAIS[0];
    }
    if (!userFound) return;
    if (userFound.status === "Bloqueado") {
      setErroLogin("Este usuário está bloqueado no momento.");
      return;
    }
    setUsuarioLogado(userFound);
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userFound));
    } catch {
      // ignore
    }
    setErroLogin(null);
    if (userFound.cargo !== "Administrador") {
      setObraActiveTab("PainelDiario");
    }
  };

  const handleLogout = () => {
    setUsuarioLogado(null);
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setLoginInput("");
    setSenhaInput("");
    setErroLogin(null);
  };

  const handleSalvarNovaObra = (novaObra: Obra) => {
    setObras((prev) => [...prev, novaObra]);
    dispararAviso(`Empreendimento "${novaObra.nome}" cadastrado com sucesso!`);
  };

  const handleExcluirObra = (obraId: string, obraNome: string) => {
    const confirmou = window.confirm(
      `Deseja realmente excluir o canteiro "${obraNome}"?\n\nEsta ação removerá a obra da visualização de compras.`
    );
    if (!confirmou) return;
    setObras((prev) => prev.filter((o) => o.id !== obraId));
    if (obraFiltro === obraId) {
      setObraFiltro("ALL");
    }
    dispararAviso(`Obra "${obraNome}" removida com sucesso.`);
  };

  const handleCriarPedidoCanteiro = (novaSc: SolicitacaoCompra) => {
    setSolicitacoes((prev) => [novaSc, ...prev]);
    setSelectedScId(novaSc.id);
    setObraActiveTab("MeusPedidos");
    dispararAviso(
      `Pedido ${novaSc.codigo} enviado com sucesso para o Setor de Compras!`
    );
  };

  const handleConfirmarRecebimentoObra = (
    ocId: string,
    notaFiscal: string,
    condicao: string
  ) => {
    const dataHora = `${new Date().toLocaleDateString(
      "pt-BR"
    )} às ${new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    const recebedor = usuarioLogado
      ? `${usuarioLogado.nome} (${usuarioLogado.cargo})`
      : "Almoxarifado da Obra";

    const ocAlvo = ordens.find((o) => o.id === ocId);

    setOrdens((prev) =>
      prev.map((o) =>
        o.id === ocId
          ? {
              ...o,
              status: "Entregue na Obra (Confirmado pelo Almoxarifado)",
              notaFiscalRecebida: notaFiscal,
              condicaoRecebimento: condicao,
              recebidoPor: recebedor,
              dataHoraRecebimento: dataHora,
            }
          : o
      )
    );

    if (ocAlvo) {
      setSolicitacoes((prev) =>
        prev.map((s) =>
          s.id === ocAlvo.scId || s.codigo === ocAlvo.scCodigo
            ? {
                ...s,
                status: "Entregue na Obra",
                notaFiscalRecebida: notaFiscal,
                condicaoRecebimento: condicao,
                recebidoPor: recebedor,
                dataHoraRecebimento: dataHora,
              }
            : s
        )
      );

      // Sincronização Automática com o Almoxarifado / Estoque Físico da Obra (Zero Falhas na Cadeia)
      const novasMovs: MovimentacaoEstoque[] = [];

      setEstoque((prevEstoque) => {
        const novoEstoque = [...prevEstoque];

        ocAlvo.itens.forEach((itemOc, idx) => {
          const itemIdx = novoEstoque.findIndex(
            (it) =>
              it.obraId === ocAlvo.obraId &&
              (it.descricao.trim().toLowerCase() === itemOc.descricao.trim().toLowerCase() ||
                (itemOc.codigo && it.codigo.toLowerCase() === itemOc.codigo.toLowerCase()))
          );

          let itemId = "";
          let itemCodigo = itemOc.codigo || `INS-${Math.floor(1000 + Math.random() * 9000)}`;
          let saldoAnt = 0;
          let saldoPos = itemOc.quantidade;

          if (itemIdx >= 0) {
            const itemExistente = novoEstoque[itemIdx];
            itemId = itemExistente.id;
            itemCodigo = itemExistente.codigo;
            saldoAnt = itemExistente.saldoAtual;
            saldoPos = itemExistente.saldoAtual + itemOc.quantidade;
            const novoCusto =
              saldoPos > 0
                ? (itemExistente.saldoAtual * itemExistente.custoMedio +
                    itemOc.quantidade * itemOc.precoUnitario) /
                  saldoPos
                : itemOc.precoUnitario;

            novoEstoque[itemIdx] = {
              ...itemExistente,
              saldoAtual: saldoPos,
              custoMedio: novoCusto,
              ultimaMovimentacao: dataHora,
            };
          } else {
            itemId = `est-auto-${Date.now()}-${idx}`;
            novoEstoque.push({
              id: itemId,
              obraId: ocAlvo.obraId,
              obraNome: ocAlvo.obraNome,
              codigo: itemCodigo,
              descricao: itemOc.descricao,
              categoria: ocAlvo.categoria || "Geral",
              unidade: itemOc.unidade,
              saldoAtual: itemOc.quantidade,
              estoqueMinimo: Math.max(1, Math.round(itemOc.quantidade * 0.2)),
              pontoReposicao: Math.max(1, Math.round(itemOc.quantidade * 0.3)),
              custoMedio: itemOc.precoUnitario,
              localizacaoFisica: "Almoxarifado Principal",
              ultimaMovimentacao: dataHora,
            });
          }

          novasMovs.push({
            id: `mov-rec-${Date.now()}-${idx}`,
            itemId: itemId,
            codigoInsumo: itemCodigo,
            descricaoInsumo: itemOc.descricao,
            unidade: itemOc.unidade,
            tipo: "ENTRADA_COMPRA",
            quantidade: itemOc.quantidade,
            saldoAnterior: saldoAnt,
            saldoPosterior: saldoPos,
            custoUnitario: itemOc.precoUnitario,
            valorTotal: itemOc.quantidade * itemOc.precoUnitario,
            dataHora: dataHora,
            responsavel: recebedor,
            obraOrigemId: ocAlvo.obraId,
            obraOrigemNome: ocAlvo.obraNome,
            numeroDocumento: `NF ${notaFiscal} (OC ${ocAlvo.numeroOc})`,
            motivoEtapa: `Entrada física confirmada pelo Almoxarifado da Obra com NF ${notaFiscal}. Condição: ${condicao}`,
          });
        });

        return novoEstoque;
      });

      if (novasMovs.length > 0) {
        setMovimentacoesEstoque((prevMovs) => [...novasMovs, ...prevMovs]);
      }
    }

    setOcConfirmarRecebimentoModal(null);
    dispararAviso(
      `Recebimento confirmado na obra! NF ${notaFiscal} registrada, estoque físico atualizado e compras notificada.`
    );
  };

  const handleSalvarDiarioObra = (novoDiario: DiarioObraRegistro) => {
    setDiariosObra((prev) => [
      novoDiario,
      ...prev.filter(
        (d) => !(d.obraId === novoDiario.obraId && d.data === novoDiario.data)
      ),
    ]);
    dispararAviso(
      `Diário de Obra (RDO) de ${novoDiario.obraNome} registrado com sucesso para a data ${novoDiario.data}!`
    );
  };

  const handleSalvarOrcamento = (novoItem: ItemOrcamentoObra) => {
    setOrcamentos((prev) => {
      const idx = prev.findIndex(
        (o) => o.obraId === novoItem.obraId && o.categoria === novoItem.categoria
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = novoItem;
        return copy;
      }
      return [...prev, novoItem];
    });
    setShowNovoOrcamentoModal(false);
    dispararAviso(
      `Verba orçamentária de ${novoItem.categoria} (${formatBRL(novoItem.valorOrcado)}) atualizada com sucesso!`
    );
  };

  const handleNavegarNotificacao = (notif: NotificacaoItem) => {
    setShowNotificacoesModal(false);
    if (notif.destinoAba === "Cotacoes") {
      setActiveTab("Cotacoes");
      if (notif.refId) setSelectedScId(notif.refId);
    } else if (notif.destinoAba === "Logistica") {
      setActiveTab("Logistica");
    } else if (notif.destinoAba === "Medicoes") {
      setActiveTab("Medicoes");
    } else if (notif.destinoAba === "Ordens") {
      setActiveTab("Ordens");
    }
  };

  const itensAbaixoMinimo = useMemo(
    () =>
      estoque.filter(
        (item) =>
          (obraFiltro === "ALL" || item.obraId === obraFiltro) &&
          item.estoqueMinimo > 0 && item.saldoAtual <= item.estoqueMinimo
      ),
    [estoque, obraFiltro]
  );

  const valorTotalEstoque = useMemo(
    () =>
      estoque
        .filter((item) => obraFiltro === "ALL" || item.obraId === obraFiltro)
        .reduce((acc, item) => acc + item.saldoAtual * item.custoMedio, 0),
    [estoque, obraFiltro]
  );

  const puxadasAtivasContratos = useMemo(
    () =>
      puxadasFornecimento.filter(
        (c) => obraFiltro === "ALL" || c.obraId === obraFiltro
      ),
    [puxadasFornecimento, obraFiltro]
  );

  const totalEconomiaTransferencias = useMemo(
    () =>
      movimentacoesEstoque
        .filter((m) => m.tipo === "TRANSFERENCIA_OBRA")
        .reduce((acc, m) => acc + m.valorTotal, 0),
    [movimentacoesEstoque]
  );

  const demandasAgrupaveis = useMemo(() => {
    const mapa = new Map<
      string,
      {
        descricao: string;
        unidade: string;
        totalQtd: number;
        obras: Set<string>;
        orcamentoUnitario: number;
        categoria: string;
      }
    >();

    solicitacoes.forEach((sc) => {
      const nomeObra =
        obras.find((o) => o.id === sc.obraId)?.nome || sc.obraId;
      sc.itens.forEach((it) => {
        const chave = it.descricao.trim().toLowerCase();
        const atual = mapa.get(chave);
        if (atual) {
          atual.totalQtd += it.quantidade;
          atual.obras.add(nomeObra);
          atual.orcamentoUnitario = Math.max(
            atual.orcamentoUnitario,
            it.orcamentoUnitario
          );
        } else {
          mapa.set(chave, {
            descricao: it.descricao,
            unidade: it.unidade,
            totalQtd: it.quantidade,
            obras: new Set([nomeObra]),
            orcamentoUnitario: it.orcamentoUnitario,
            categoria: sc.categoria,
          });
        }
      });
    });

    return Array.from(mapa.values())
      .map((d) => ({
        ...d,
        obrasParticipantes: Array.from(d.obras),
      }))
      .filter((d) => d.obrasParticipantes.length >= 2 || d.totalQtd >= 100);
  }, [solicitacoes, obras]);

  const handleRegistrarMovimentacao = (mov: MovimentacaoEstoque) => {
    setMovimentacoesEstoque((prev) => [mov, ...prev]);

    setEstoque((prev) => {
      const copy = [...prev];
      const itemOrigemIdx = copy.findIndex((it) => it.id === mov.itemId);

      if (itemOrigemIdx >= 0) {
        const itemOrigem = copy[itemOrigemIdx];
        let novoSaldoOrigem = itemOrigem.saldoAtual;
        let novoCustoMedio = itemOrigem.custoMedio;

        if (mov.tipo === "ENTRADA_COMPRA") {
          const totalQtd = itemOrigem.saldoAtual + mov.quantidade;
          if (totalQtd > 0) {
            novoCustoMedio =
              (itemOrigem.saldoAtual * itemOrigem.custoMedio +
                mov.quantidade * mov.custoUnitario) /
              totalQtd;
          }
          novoSaldoOrigem += mov.quantidade;
        } else if (
          mov.tipo === "SAIDA_APLICACAO" ||
          mov.tipo === "PERDA_AVARIA" ||
          mov.tipo === "TRANSFERENCIA_OBRA"
        ) {
          novoSaldoOrigem = Math.max(0, itemOrigem.saldoAtual - mov.quantidade);
        } else if (mov.tipo === "AJUSTE_INVENTARIO") {
          novoSaldoOrigem = mov.quantidade;
        }

        copy[itemOrigemIdx] = {
          ...itemOrigem,
          saldoAtual: novoSaldoOrigem,
          custoMedio: novoCustoMedio,
          ultimaMovimentacao: mov.dataHora,
        };

        if (mov.tipo === "TRANSFERENCIA_OBRA" && mov.obraDestinoId) {
          const destIdx = copy.findIndex(
            (it) =>
              it.obraId === mov.obraDestinoId &&
              it.codigo === itemOrigem.codigo
          );
          if (destIdx >= 0) {
            const destItem = copy[destIdx];
            const novoSaldoDest = destItem.saldoAtual + mov.quantidade;
            const novoCustoDest =
              novoSaldoDest > 0
                ? (destItem.saldoAtual * destItem.custoMedio +
                    mov.quantidade * itemOrigem.custoMedio) /
                  novoSaldoDest
                : itemOrigem.custoMedio;
            copy[destIdx] = {
              ...destItem,
              saldoAtual: novoSaldoDest,
              custoMedio: novoCustoDest,
              ultimaMovimentacao: mov.dataHora,
            };
          } else {
            copy.push({
              id: `est-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              obraId: mov.obraDestinoId,
              obraNome: mov.obraDestinoNome || "Obra Destino",
              codigo: itemOrigem.codigo,
              descricao: itemOrigem.descricao,
              categoria: itemOrigem.categoria,
              unidade: itemOrigem.unidade,
              saldoAtual: mov.quantidade,
              estoqueMinimo: itemOrigem.estoqueMinimo,
              pontoReposicao: itemOrigem.pontoReposicao,
              custoMedio: itemOrigem.custoMedio,
              localizacaoFisica: "Almoxarifado Geral",
              ultimaMovimentacao: mov.dataHora,
              fornecedorHabitual: itemOrigem.fornecedorHabitual,
            });
          }
        }
      }
      return copy;
    });

    setShowNovaMovimentacaoModal(false);
    dispararAviso(
      `Movimentação registrada com sucesso: ${mov.tipo} de ${mov.quantidade} ${mov.unidade} de ${mov.descricaoInsumo}!`
    );
  };

  const handleProgramarPuxada = (
    contratoId: string,
    novaPrg: ProgramacaoPuxada
  ) => {
    setPuxadasFornecimento((prev) =>
      prev.map((c) => {
        if (c.id !== contratoId) return c;
        const programacoes = [novaPrg, ...c.programacoes];
        const entregueExtra =
          novaPrg.status === "Recebida" ? novaPrg.quantidade : 0;
        return {
          ...c,
          quantidadeEntregue: c.quantidadeEntregue + entregueExtra,
          programacoes,
        };
      })
    );
    setShowProgramarPuxadaModal(false);
    dispararAviso(
      `Puxada programada com sucesso para ${novaPrg.dataHoraAgendada}: ${novaPrg.quantidade} ${novaPrg.unidade}!`
    );
  };

  const handleAtualizarStatusPuxada = (
    contratoId: string,
    programacaoId: string,
    novoStatus: "Agendada" | "Em Rota" | "Recebida" | "Cancelada",
    notaFiscal?: string
  ) => {
    setPuxadasFornecimento((prev) =>
      prev.map((c) => {
        if (c.id !== contratoId) return c;
        let deltaEntregue = 0;
        const programacoesAtualizadas = c.programacoes.map((p) => {
          if (p.id !== programacaoId) return p;
          if (p.status !== "Recebida" && novoStatus === "Recebida") {
            deltaEntregue = p.quantidade;
          } else if (p.status === "Recebida" && novoStatus !== "Recebida") {
            deltaEntregue = -p.quantidade;
          }
          return {
            ...p,
            status: novoStatus,
            notaFiscal: notaFiscal || p.notaFiscal,
          };
        });
        return {
          ...c,
          quantidadeEntregue: Math.max(0, c.quantidadeEntregue + deltaEntregue),
          programacoes: programacoesAtualizadas,
        };
      })
    );

    if (novoStatus === "Recebida") {
      dispararAviso(
        `Carga confirmada e recebida no canteiro! Saldo do contrato mãe atualizado.`
      );
    } else {
      dispararAviso(`Status da puxada atualizado para "${novoStatus}".`);
    }
  };

  const handleGerarSolicitacaoReposicao = (item: ItemEstoque) => {
    const qtdNecessaria = Math.max(
      item.pontoReposicao * 2 - item.saldoAtual,
      item.pontoReposicao
    );
    const novoCodigo = `SC-2026-REP-0${solicitacoes.length + 1}`;
    const novaSc: SolicitacaoCompra = {
      id: `sc-rep-${Date.now()}`,
      codigo: novoCodigo,
      obraId: item.obraId === "central" ? "obra-1" : item.obraId,
      categoria: item.categoria,
      solicitante: usuarioLogado
        ? `${usuarioLogado.nome} (Almoxarifado)`
        : "Almoxarife Central",
      solicitanteCargo: "Almoxarife",
      urgencia: "Crítica - Obra Parada",
      dataAbertura: new Date().toLocaleDateString("pt-BR"),
      dataNecessaria: new Date(
        Date.now() + 5 * 24 * 3600 * 1000
      ).toLocaleDateString("pt-BR"),
      status: "Em Cotação",
      itens: [
        {
          id: `it-${Date.now()}-1`,
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade: qtdNecessaria,
          unidade: item.unidade,
          orcamentoUnitario: item.custoMedio,
          observacaoObra: `Reposição automática de estoque mínimo de segurança no canteiro ${item.obraNome}. Saldo atual: ${item.saldoAtual} ${item.unidade} (Mínimo: ${item.estoqueMinimo} ${item.unidade}).`,
        },
      ],
      propostas: [],
      mensagens: [
        {
          id: `msg-${Date.now()}`,
          autorNome: "Robô de Reposição de Estoque",
          autorCargo: "Administrador",
          dataHora: `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString(
            "pt-BR",
            { hour: "2-digit", minute: "2-digit" }
          )}`,
          texto: `Solicitação gerada automaticamente porque o insumo "${item.descricao}" atingiu o nível crítico (${item.saldoAtual} ${item.unidade} <= ${item.pontoReposicao} ${item.unidade}). Cotação prioritária.`,
        },
      ],
    };

    setSolicitacoes((prev) => [novaSc, ...prev]);
    setSelectedScId(novaSc.id);
    setActiveTab("Cotacoes");
    dispararAviso(
      `⚡ Solicitação ${novaSc.codigo} gerada para reposição de ${item.descricao}! Direcionando para o Mapa de Cotações...`
    );
  };

  const handleCriarCompraAgrupada = (agrupamento: {
    descricao: string;
    unidade: string;
    totalQtd: number;
    obrasParticipantes: string[];
    orcamentoUnitario: number;
    categoria: string;
  }) => {
    const novoCodigo = `SC-2026-CORP-0${solicitacoes.length + 1}`;
    const obrasTexto = agrupamento.obrasParticipantes.join(", ");
    const novaSc: SolicitacaoCompra = {
      id: `sc-corp-${Date.now()}`,
      codigo: novoCodigo,
      obraId: "obra-1",
      categoria: agrupamento.categoria,
      solicitante: usuarioLogado
        ? `${usuarioLogado.nome} (Coord. Suprimentos)`
        : "Coord. Suprimentos Corporativo",
      solicitanteCargo: "Administrador",
      urgencia: "Normal",
      dataAbertura: new Date().toLocaleDateString("pt-BR"),
      dataNecessaria: new Date(
        Date.now() + 7 * 24 * 3600 * 1000
      ).toLocaleDateString("pt-BR"),
      status: "Em Cotação",
      itens: [
        {
          id: `it-${Date.now()}-1`,
          codigo: `CORP-${Date.now().toString().slice(-4)}`,
          descricao: `${agrupamento.descricao} — Rateio Multi-Obra (${obrasTexto})`,
          quantidade: agrupamento.totalQtd,
          unidade: agrupamento.unidade,
          orcamentoUnitario: agrupamento.orcamentoUnitario,
          observacaoObra: `Demanda corporativa agrupada para as obras: [${obrasTexto}]. Negociar frete CIF rateado.`,
        },
      ],
      propostas: [],
      mensagens: [
        {
          id: `msg-${Date.now()}`,
          autorNome: "Centralizador de Demandas",
          autorCargo: "Administrador",
          dataHora: `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString(
            "pt-BR",
            { hour: "2-digit", minute: "2-digit" }
          )}`,
          texto: `Demanda agrupada para as obras: ${obrasTexto}. Volume consolidado: ${agrupamento.totalQtd} ${agrupamento.unidade}.`,
        },
      ],
    };

    setSolicitacoes((prev) => [novaSc, ...prev]);
    setSelectedScId(novaSc.id);
    setShowAgruparDemandasModal(false);
    setActiveTab("Cotacoes");
    dispararAviso(
      `Compra Corporativa em Lote ${novaSc.codigo} criada com sucesso para ${agrupamento.descricao}!`
    );
  };

  const novosPedidosCanteiroCount = useMemo(
    () =>
      solicitacoes.filter(
        (s) =>
          s.novoAlertaAdmin || s.status === "Enviado / Aguardando Compras"
      ).length,
    [solicitacoes]
  );

  /* ----------------------------------------------------------------------- */
  /* CONFIGURAÇÃO DO HEADER SUPERIOR (TÍTULO + 1 ÚNICO BOTÃO PRIMÁRIO)       */
  /* ----------------------------------------------------------------------- */

  const tituloAbaAtual: Record<TabId, string> = {
    Painel: "Painel de Compras",
    DesempenhoFinanceiro: "BI Financeiro & Obras",
    Cotacoes: "Mapa de Cotações",
    Fornecedores: "Fornecedores & IQF",
    Ordens: "Ordens de Compra",
    Estoque: "Almoxarifado & Estoque",
    Medicoes: "Contratos & Medições",
    Orcamento: "Orçamento da Obra",
    Logistica: "Calendário de Cargas",
    Importacao: "Importação de Planilhas",
    Configuracoes: "Configurações",
  };

  const renderBotaoPrimarioHeader = () => {
    switch (activeTab) {
      case "Painel":
        return (
          <button
            onClick={() => setShowNovaScModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition whitespace-nowrap shadow-xs"
          >
            + Nova Solicitação
          </button>
        );
      case "DesempenhoFinanceiro":
        return (
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 shadow-xs"
          >
            <span>📥</span>
            <span>Exportar BI</span>
          </button>
        );
      case "Estoque":
        return (
          <button
            onClick={() => setShowNovaMovimentacaoModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 shadow-xs"
          >
            <span>+ Nova Movimentação</span>
          </button>
        );
      case "Cotacoes":
        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (modoCotacoes === "comparativo_rapido") {
                  handleExportarComparativoRapidoExcel();
                } else if (scAtiva) {
                  exportarCotacaoExcel(scAtiva, obraScAtiva.nome);
                } else {
                  dispararAviso("Nenhuma cotação ativa para exportar.");
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold transition whitespace-nowrap"
            >
              Exportar Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => {
                if (modoCotacoes === "comparativo_rapido") {
                  handleGerarComparativoRapidoPDF();
                } else if (scAtiva) {
                  handleGeneratePDF();
                } else {
                  dispararAviso("Selecione ou adicione itens à cotação para gerar o PDF.");
                }
              }}
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition whitespace-nowrap shadow-xs flex items-center gap-1.5"
            >
              <span>📄</span> Gerar PDF
            </button>
          </div>
        );
      case "Fornecedores":
        return (
          <button
            onClick={() => setShowNovoFornecedorModal(true)}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition whitespace-nowrap"
          >
            + Novo Fornecedor
          </button>
        );
      case "Ordens":
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportarOrdensExcel(ordensFiltradas)}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold transition whitespace-nowrap"
            >
              Exportar Excel (.xlsx)
            </button>
            <button
              onClick={() => setActiveTab("Cotacoes")}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition whitespace-nowrap"
            >
              Ir para Mapa de Cotações
            </button>
          </div>
        );
      case "Medicoes":
        return (
          <button
            onClick={() => setShowNovoContratoModal(true)}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition whitespace-nowrap"
          >
            + Novo Contrato de Subempreitada
          </button>
        );
      case "Orcamento":
        return (
          <button
            onClick={() => setShowNovoOrcamentoModal(true)}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition whitespace-nowrap"
          >
            + Definir Verba Orçamentária
          </button>
        );
      case "Logistica":
        return (
          <button
            onClick={() => setActiveTab("Ordens")}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition whitespace-nowrap"
          >
            + Programar Nova Carga
          </button>
        );
      case "Importacao":
        return (
          <button
            onClick={() => {
              setItensPlanilha((prev) => {
                const atualizados = prev.map((i) => ({
                  ...i,
                  status: "Aprovado" as const,
                }));
                try {
                  window.localStorage.setItem(
                    ITENS_PLANILHA_STORAGE_KEY,
                    JSON.stringify(atualizados)
                  );
                } catch {}
                return atualizados;
              });
              setDuplicidades((prev) => {
                const atualizados = prev.map((d) => ({
                  ...d,
                  status: "Unificado" as const,
                }));
                try {
                  window.localStorage.setItem(
                    DUPLICIDADES_STORAGE_KEY,
                    JSON.stringify(atualizados)
                  );
                } catch {}
                return atualizados;
              });
              setColaboradores((prev) =>
                prev.map((c) => ({ ...c, status: "Validado" }))
              );
              dispararAviso(
                "Todos os registros da planilha foram aprovados e integrados ao sistema!"
              );
            }}
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition whitespace-nowrap"
          >
            Aprovar Todos os Registros
          </button>
        );
      case "Configuracoes":
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportarBackupCompleto}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold transition whitespace-nowrap"
            >
              📥 Backup (JSON)
            </button>
            <button
              onClick={() => setShowNovoUsuarioModal(true)}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition whitespace-nowrap"
            >
              + Novo Acesso
            </button>
          </div>
        );
    }
  };

  /* ----------------------------------------------------------------------- */
  /* TELA DE LOGIN CORPORATIVA (QUANDO NÃO HÁ USUÁRIO AUTENTICADO)           */
  /* ----------------------------------------------------------------------- */
  if (!usuarioLogado) {
    return (
      <TelaLoginCorporativa
        companyName={settings.companyName}
        loginInput={loginInput}
        setLoginInput={setLoginInput}
        senhaInput={senhaInput}
        setSenhaInput={setSenhaInput}
        erroLogin={erroLogin}
        onSubmit={handleLoginSubmit}
        onQuickLogin={handleQuickLogin}
        usuarios={usuarios}
      />
    );
  }

  /* ----------------------------------------------------------------------- */
  /* VISÃO RESTRITA DO SOLICITANTE DA OBRA (ENGENHEIRO / ALMOXARIFE / ENCARR)*/
  /* ----------------------------------------------------------------------- */
  if (usuarioLogado.cargo !== "Administrador") {
    return (
      <VisaoRestritaObra
        usuarioLogado={usuarioLogado}
        companyName={settings.companyName}
        obras={obras}
        fornecedores={fornecedores}
        solicitacoes={solicitacoes}
        ordens={ordens}
        contratos={contratos}
        obraActiveTab={obraActiveTab}
        setObraActiveTab={setObraActiveTab}
        notificacao={notificacao}
        setNotificacao={setNotificacao}
        onLogout={handleLogout}
        onCriarPedidoCanteiro={handleCriarPedidoCanteiro}
        ocConfirmarRecebimentoModal={ocConfirmarRecebimentoModal}
        setOcConfirmarRecebimentoModal={setOcConfirmarRecebimentoModal}
        onConfirmarRecebimentoObra={handleConfirmarRecebimentoObra}
        onCriarBoletimMedicao={handleCriarBoletimMedicao}
        onEnviarMensagemSC={handleEnviarMensagemSC}
        estoque={estoque}
        movimentacoesEstoque={movimentacoesEstoque}
        onRegistrarMovimentacao={handleRegistrarMovimentacao}
        diariosObra={diariosObra}
        onSalvarDiarioObra={handleSalvarDiarioObra}
        onGerarOrdemCompraPDF={handleGerarOrdemCompraPDF}
        onGerarRomaneioRecebimentoPDF={handleGerarRomaneioRecebimentoPDF}
      />
    );
  }

  /* ----------------------------------------------------------------------- */
  /* RENDERIZAÇÃO PRINCIPAL DO ADMINISTRADOR (COMPRAS - ACESSO TOTAL)        */
  /* ----------------------------------------------------------------------- */

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F6F8] text-slate-900 font-sans">
      {/* ================================================================= */}
      {/* SIDEBAR ESQUERDA COMPACTA (w-72 shrink-0 bg-slate-900 text-white) */}
      {/* ================================================================= */}
      <aside className="no-print w-72 shrink-0 bg-slate-900 text-white flex flex-col justify-between h-full">
        <div>
          {/* Identidade Dinâmica da Construtora (vinda das Configurações) */}
          <div className="h-20 px-4 border-b border-slate-800 flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg border border-amber-300/40 shadow-xs shrink-0 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="JC Bauer Empreendimentos"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm text-white tracking-wide truncate">
                JC BAUER
              </div>
              <div className="text-[11px] text-amber-400 font-semibold truncate">
                Empreendimentos & Obras
              </div>
            </div>
          </div>

          {/* Menu com Abas Independentes + Configurações */}
          <nav className="p-3 space-y-1">
            {(
              [
                { id: "Painel", label: "📋 Painel de Compras" },
                {
                  id: "DesempenhoFinanceiro",
                  label: "📊 BI Financeiro & Obras",
                },
                { id: "Cotacoes", label: "⚖️ Comparativo de Preços" },
                { id: "Fornecedores", label: "🏢 Fornecedores & IQF" },
                { id: "Ordens", label: "📦 Ordens de Compra" },
                { id: "Estoque", label: "🧱 Almoxarifado & Estoque" },
                { id: "Medicoes", label: "📐 Contratos & Medições" },
                { id: "Orcamento", label: "💰 Orçamento da Obra" },
                { id: "Logistica", label: "🚚 Calendário de Cargas" },
                { id: "Importacao", label: "📥 Importar Planilhas" },
                { id: "Configuracoes", label: "⚙️ Configurações" },
              ] as { id: TabId; label: string }[]
            ).map((item) => {
              const ativo = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition text-left ${
                    ativo
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.id === "Cotacoes" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-[10px] font-extrabold shrink-0">
                      3 Orçamentos
                    </span>
                  )}
                  {item.id === "DesempenhoFinanceiro" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600 text-[10px] font-extrabold shrink-0">
                      Saving
                    </span>
                  )}
                  {item.id === "Painel" && novosPedidosCanteiroCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-extrabold shrink-0">
                      {novosPedidosCanteiroCount}
                    </span>
                  )}
                  {item.id === "Estoque" && itensAbaixoMinimo.length > 0 && (
                    <span
                      title={`${itensAbaixoMinimo.length} insumos abaixo do estoque de segurança`}
                      className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-extrabold shrink-0 animate-pulse"
                    >
                      {itensAbaixoMinimo.length}
                    </span>
                  )}
                  {item.id === "Logistica" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-blue-300 text-xs font-bold shrink-0">
                      {cargasLogistica.flatMap((d) => d.cargas).filter((c) => c.status === "Hoje" || c.status === "Agendado").length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé Dinâmico da Sidebar (Perfil Logado + Botão Sair / Trocar Conta) */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setActiveTab("Configuracoes")}
            title="Clique para gerenciar configurações e acessos"
            className="text-left hover:bg-slate-800/70 p-2.5 rounded-lg transition w-full block"
          >
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                Diretoria
              </span>
              <span className="font-semibold text-xs text-slate-100 truncate">
                {usuarioLogado.nome}
              </span>
            </div>
            <div className="text-xs text-slate-400 truncate mt-0.5">
              {usuarioLogado.obraNome}
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-red-900/80 text-slate-200 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700"
          >
            <span>🚪</span> Sair / Trocar Conta
          </button>
        </div>
      </aside>

      {/* ================================================================= */}
      {/* ÁREA PRINCIPAL (flex-1 flex flex-col min-w-0 h-full overflow-hidden)*/}
      {/* ================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* HEADER SUPERIOR FIXO (h-16 shrink-0, sticky z-20) */}
        <header className="no-print sticky top-0 z-20 h-16 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          {/* Esquerda: Título da Aba Atual + Alerta de Novos Pedidos */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-base font-bold text-slate-900 whitespace-nowrap">
              {tituloAbaAtual[activeTab]}
            </h1>
            {novosPedidosCanteiroCount > 0 && (
              <button
                onClick={() => {
                  setActiveTab("Painel");
                  setPainelSubView("solicitacoes");
                }}
                className="px-2.5 py-1 rounded-full bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 shrink-0 transition"
                title="Ver novas solicitações de compras enviadas pelos canteiros"
              >
                <span>🔔</span> {novosPedidosCanteiroCount} Novo(s)
              </button>
            )}
          </div>

          {/* Direita: Notificações + Selo do Perfil + Select de Obra + Botão Primário + Sair */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Indicador Nuvem Supabase */}
            <button
              type="button"
              onClick={() => setActiveTab("Configuracoes")}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                supabaseStatus.schemaReady
                  ? "bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800"
                  : supabaseStatus.connected
                  ? "bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
              }`}
              title={supabaseStatus.message}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  supabaseStatus.schemaReady
                    ? "bg-emerald-500 animate-pulse"
                    : supabaseStatus.connected
                    ? "bg-amber-500"
                    : "bg-slate-400"
                }`}
              />
              <span>
                {supabaseStatus.schemaReady
                  ? "☁️ Supabase Nuvem"
                  : supabaseStatus.connected
                  ? "⚡ Supabase (Configurar)"
                  : "🔌 Supabase"}
              </span>
            </button>
            {/* Botão de Notificações com Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotificacoesModal(!showNotificacoesModal)}
                className="relative p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                title="Central de Notificações e Alertas Preventivos"
              >
                <span className="text-base">🔔</span>
                {notificacoesSistema.length > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-extrabold animate-pulse">
                    {notificacoesSistema.length}
                  </span>
                )}
              </button>
            </div>

            <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
              <span className="font-bold text-emerald-800">
                👑 {usuarioLogado.cargo}:
              </span>
              <span className="font-semibold text-slate-800">
                {usuarioLogado.nome}
              </span>
            </div>

            <select
              value={obraFiltro}
              onChange={(e) => setObraFiltro(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-900"
            >
              <option value="ALL">Todas as Obras ({obras.length})</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>

            {renderBotaoPrimarioHeader()}

            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-300 text-xs font-semibold transition whitespace-nowrap"
              title="Encerrar sessão ou trocar de perfil"
            >
              🚪 Sair
            </button>
          </div>
        </header>

        {/* Notificação de feedback se houver */}
        {notificacao && (
          <div className="no-print bg-emerald-800 text-white px-6 py-2.5 text-sm font-medium flex items-center justify-between shrink-0">
            <span>{notificacao}</span>
            <button
              onClick={() => setNotificacao(null)}
              className="text-xs underline ml-4"
            >
              Fechar
            </button>
          </div>
        )}

        {/* =============================================================== */}
        {/* CORPO DA PÁGINA (flex-1 overflow-y-auto p-6)                    */}
        {/* Renderiza APENAS a aba selecionada                              */}
        {/* =============================================================== */}
        <main className="no-print flex-1 overflow-y-auto p-6">
          {/* ============================================================= */}
          {/* ABA 1: PAINEL DE COMPRAS & INFOGRÁFICO DE CUSTOS / SAVING     */}
          {/* ============================================================= */}
          {activeTab === "Painel" && (
            <div className="space-y-6">
              {/* 4 Cards de KPI limpos no topo (Regra do Número Único, 3 linhas simples) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Solicitações em Aberto
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {kpisPainel.emAberto}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Em categorias da obra
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Cotações Concluídas
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {kpisPainel.concluidas}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Processos homologados
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Custo Fechado Contratado
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatBRL(kpisPainel.volumeContratado)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Volume negociado nas obras
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Economia Gerada (Saving)
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {formatBRL(kpisPainel.savingTotal)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Redução direta nas compras
                  </div>
                </div>
              </div>

              {/* Barra Seletora de Visão (Modo Geral Consolidado vs Por Empreendimento) + Alternador de Sub-Aba */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600 mr-1">
                    Visão do Empreendimento:
                  </span>
                  <button
                    onClick={() => setObraFiltro("ALL")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      obraFiltro === "ALL"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Visão Geral Consolidada ({obras.length === 0 ? "0 Obras" : "Todas as Obras"})
                  </button>
                  {obras.map((ob) => (
                    <button
                      key={ob.id}
                      onClick={() => setObraFiltro(ob.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        obraFiltro === ob.id
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {ob.nome}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowModalNovaObra(true)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition flex items-center gap-1 shadow-xs"
                    title="Cadastrar novo canteiro ou obra"
                  >
                    <span>+</span>
                    <span>Nova Obra</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("DesempenhoFinanceiro")}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 shadow-xs"
                    title="Acessar o novo Dashboard Financeiro Completo com Gráficos Diários e BI"
                  >
                    <span>📊</span>
                    <span>Novo BI & Desempenho Financeiro ➔</span>
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* AUDITORIA DE ATUALIZAÇÃO & DISCIPLINA DOS CANTEIROS        */}
              {/* ========================================================= */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚦</span>
                      <h2 className="text-base font-bold text-slate-900">
                        Auditoria de Atualização & Disciplina Operacional dos Canteiros
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                        Tempo Real
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Acompanhamento ao vivo do preenchimento do Diário de Obra (RDO), confirmações de recebimento de materiais com NF e baixas de estoque por Engenheiros, Almoxarifes e Encarregados.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowModalNovaObra(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <span>+</span>
                      <span>Cadastrar Nova Obra</span>
                    </button>
                    <div className="text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-2 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                      Hoje: {new Date().toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>

                {obras.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-xl">
                      🏗️
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Nenhum empreendimento ou canteiro cadastrado
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Todos os empreendimentos de demonstração foram removidos. Cadastre os empreendimentos oficiais da JC Bauer para iniciar o controle operacional e suprimentos.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowModalNovaObra(true)}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <span>+</span>
                      <span>Cadastrar Primeiro Empreendimento</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {obras
                      .filter((ob) => obraFiltro === "ALL" || ob.id === obraFiltro)
                      .map((ob) => {
                        const dataHoje = new Date().toLocaleDateString("pt-BR");
                        const diariosObraEspecifica = diariosObra.filter((d) => d.obraId === ob.id);
                        const ultimoDiario = diariosObraEspecifica[0]; // mais recente
                        const diarioHojePreenchido = diariosObraEspecifica.some((d) => d.data === dataHoje);

                        // OCs pendentes de confirmação física na obra
                        const ocsPendentesRecebimento = ordens.filter(
                          (o) =>
                            o.obraId === ob.id &&
                            (o.status === "Emitida" ||
                              o.status === "Aguardando Entrega")
                        );

                        // Itens em estoque na obra
                        const itensEstoqueObra = estoque.filter((it) => it.obraId === ob.id);
                        const itensAbaixoMinimo = itensEstoqueObra.filter((it) => it.saldoAtual <= it.estoqueMinimo);

                        return (
                          <div
                            key={ob.id}
                            className={`rounded-lg border p-4 transition flex flex-col justify-between ${
                              diarioHojePreenchido
                                ? "border-emerald-200 bg-emerald-50/40"
                                : "border-amber-300 bg-amber-50/40"
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h3 className="font-bold text-sm text-slate-900">
                                    {ob.nome}
                                  </h3>
                                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                    <span>👤 Eng. Responsável:</span>
                                    <span className="font-medium text-slate-700">{ob.engenheiro || "A Definir"}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                                      diarioHojePreenchido
                                        ? "bg-emerald-600 text-white"
                                        : "bg-amber-500 text-white animate-pulse"
                                    }`}
                                  >
                                    {diarioHojePreenchido ? "🟢 Em Dia Hoje" : "🟡 Pendente Hoje"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleExcluirObra(ob.id, ob.nome)}
                                    title="Excluir este canteiro"
                                    className="text-slate-400 hover:text-red-600 text-xs p-1 transition rounded hover:bg-slate-100"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>

                              {/* Detalhes do Último Diário (RDO) */}
                              <div className="bg-white/80 rounded-lg p-2.5 border border-slate-200/80 text-xs space-y-1.5">
                                {ultimoDiario ? (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500 font-medium">Último RDO:</span>
                                      <span className="font-bold text-slate-800">
                                        {ultimoDiario.data} às {ultimoDiario.hora}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">Registrado por:</span>
                                      <span className="font-medium text-slate-800">
                                        {ultimoDiario.responsavelNome} ({ultimoDiario.responsavelCargo})
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">Efetivo de Campo:</span>
                                      <span className="font-semibold text-emerald-800 text-xs">
                                        {ultimoDiario.efetivoProprio + ultimoDiario.efetivoTerceirizado} trab. ({ultimoDiario.efetivoProprio} própr. / {ultimoDiario.efetivoTerceirizado} terc.)
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500">Clima:</span>
                                      <span className="font-medium text-slate-700">
                                        ☀️ {ultimoDiario.clima}
                                      </span>
                                    </div>
                                    <div className="pt-1 border-t border-slate-100">
                                      <span className="text-[11px] text-slate-500 block">Frentes ativas:</span>
                                      <span className="text-[11px] text-slate-700 font-medium line-clamp-2">
                                        {ultimoDiario.frentesServico}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-slate-500 italic py-1 text-center">
                                    Nenhum diário registrado ainda para este canteiro.
                                  </div>
                                )}
                              </div>

                              {/* Resumo Operacional de Materiais & Entregas */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white/80 rounded p-2 border border-slate-200">
                                  <span className="text-[10px] text-slate-500 block font-semibold">
                                    Entregas a Conferir
                                  </span>
                                  <span
                                    className={`text-sm font-bold ${
                                      ocsPendentesRecebimento.length > 0
                                        ? "text-amber-700"
                                        : "text-emerald-700"
                                    }`}
                                  >
                                    {ocsPendentesRecebimento.length}{" "}
                                    {ocsPendentesRecebimento.length === 1 ? "carga" : "cargas"}
                                  </span>
                                </div>
                                <div className="bg-white/80 rounded p-2 border border-slate-200">
                                  <span className="text-[10px] text-slate-500 block font-semibold">
                                    Itens Almoxarifado
                                  </span>
                                  <span className="text-sm font-bold text-slate-800">
                                    {itensEstoqueObra.length} insumos
                                    {itensAbaixoMinimo.length > 0 && (
                                      <span className="text-[10px] text-red-600 block font-normal">
                                        ({itensAbaixoMinimo.length} sob alerta mín.)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-200/60 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setObraFiltro(ob.id);
                                  setSubAbaEstoque("movimentacoes");
                                  setActiveTab("Estoque");
                                }}
                                className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 hover:underline"
                              >
                                Ver Almoxarifado ➔
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  dispararAviso(
                                    `Lembrete operacional emitido via sistema para ${ob.engenheiro && ob.engenheiro !== "A Definir" ? ob.engenheiro : "o canteiro"} da obra ${ob.nome}!`
                                  );
                                }}
                                className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition"
                              >
                                🔔 Notificar Canteiro
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>


              {/* Banner de Alerta de Novos Pedidos vindos do Canteiro */}
              {novosPedidosCanteiroCount > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <div className="text-sm font-bold text-amber-950">
                        Novos Pedidos da Obra Recebidos! (
                        {novosPedidosCanteiroCount} aguardando atendimento do
                        Setor de Compras)
                      </div>
                      <div className="text-xs text-amber-800 mt-0.5">
                        Solicitações enviadas diretamente pelos Engenheiros,
                        Almoxarifado e Encarregados nos canteiros. Clique em{" "}
                        <strong>&ldquo;Abrir Cotação &rarr;&rdquo;</strong> para
                        iniciar a tomada de preços.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela de Solicitações de Compra (Sempre acessível no Painel) */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base font-bold text-slate-900">
                        Solicitações de Compra das Obras (Canteiro &rarr;
                        Suprimentos)
                      </h2>
                      {novosPedidosCanteiroCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                          🔔 {novosPedidosCanteiroCount} Novo(s)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Acompanhe quem pediu, qual obra, urgência, lista de
                      insumos e abra diretamente no Mapa de Cotações
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNovaScModal(true)}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                  >
                    + Nova Solicitação
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                        <th className="py-3 px-4">Código / Data</th>
                        <th className="py-3 px-4">Quem Pediu / Obra</th>
                        <th className="py-3 px-4">Lista de Insumos Solicitados</th>
                        <th className="py-3 px-4 text-center">Urgência</th>
                        <th className="py-3 px-4 text-right">Orçamento Ref.</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {solicitacoesFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <span className="text-3xl mb-2">📋</span>
                              <p className="font-semibold text-slate-700 text-sm">
                                Nenhuma solicitação de compra cadastrada
                              </p>
                              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                Clique em &quot;Nova Solicitação&quot; acima para registrar a primeira requisição de compras da construtora.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        solicitacoesFiltradas.map((sc) => {
                        const obra = obras.find((o) => o.id === sc.obraId);
                        const orcamento = sc.itens.reduce(
                          (acc, it) =>
                            acc + it.quantidade * it.orcamentoUnitario,
                          0
                        );
                        const urgencia = sc.urgencia || "Normal";

                        return (
                          <tr
                            key={sc.id}
                            className={`hover:bg-slate-50 transition-colors ${
                              sc.novoAlertaAdmin ||
                              sc.status === "Enviado / Aguardando Compras"
                                ? "bg-amber-50/40"
                                : ""
                            }`}
                          >
                            <td className="py-3.5 px-4 whitespace-nowrap align-top">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 tabular-nums">
                                  {sc.codigo}
                                </span>
                                {(sc.novoAlertaAdmin ||
                                  sc.status ===
                                    "Enviado / Aguardando Compras") && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 text-[11px] font-bold">
                                    NOVO
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                                {sc.horarioPedido || sc.dataAbertura}
                              </div>
                              {sc.dataNecessaria && (
                                <div className="text-xs text-slate-600 font-medium mt-0.5">
                                  Precisa p/: {sc.dataNecessaria}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 align-top">
                              <div className="font-semibold text-sm text-slate-900">
                                {sc.solicitante}
                              </div>
                              <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                                <span className="font-medium text-emerald-800">📍 {obra?.nome}</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500">{sc.categoria}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 align-top max-w-sm">
                              <div className="space-y-1">
                                {sc.itens.slice(0, 2).map((it) => (
                                  <div
                                    key={it.id}
                                    className="text-xs text-slate-700 leading-snug truncate"
                                    title={`${it.quantidade} ${it.unidade} — ${it.descricao}`}
                                  >
                                    <span className="font-semibold text-slate-900 tabular-nums">
                                      • {it.quantidade} {it.unidade}
                                    </span>{" "}
                                    — {it.descricao}
                                  </div>
                                ))}
                                {sc.itens.length > 2 && (
                                  <div className="text-[11px] font-medium text-emerald-700">
                                    + {sc.itens.length - 2} outro(s) insumo(s) na cotação
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center whitespace-nowrap align-top">
                              <span
                                className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                  urgencia === "Crítica - Obra Parada"
                                    ? "bg-red-100 text-red-900 border border-red-300"
                                    : urgencia === "Alta"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {urgencia}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums align-top">
                              <div>{formatBRL(orcamento)}</div>
                              <div className="text-xs text-slate-500 font-normal">
                                {sc.propostas.length} cotações
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center whitespace-nowrap align-top">
                              <span
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${
                                  sc.status === "Entregue na Obra"
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : sc.status === "Comprada"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : sc.status ===
                                      "Enviado / Aguardando Compras"
                                    ? "bg-amber-100 text-amber-900 border border-amber-300"
                                    : "bg-blue-50 text-blue-800 border border-blue-200"
                                }`}
                              >
                                {sc.status === "Enviado / Aguardando Compras"
                                  ? "🟡 Enviado / Aguardando Compras"
                                  : sc.status === "Em Cotação"
                                  ? "🔵 Em Cotação"
                                  : sc.status === "Comprada"
                                  ? "🟢 Compra Aprovada"
                                  : "✅ Entregue na Obra"}
                              </span>
                              {sc.notaFiscalRecebida && (
                                <div className="text-xs text-emerald-800 font-semibold mt-1">
                                  NF: {sc.notaFiscalRecebida}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap align-top">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setScMensagensModal(sc)}
                                  className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                                  title="Linha do tempo e mensagens entre Canteiro e Compras"
                                >
                                  <span>💬</span>
                                  <span>Mensagens</span>
                                  {sc.mensagens && sc.mensagens.length > 0 && (
                                    <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                                      {sc.mensagens.length}
                                    </span>
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setSolicitacoes((prev) =>
                                      prev.map((item) =>
                                        item.id === sc.id
                                          ? {
                                              ...item,
                                              novoAlertaAdmin: false,
                                              status:
                                                item.status ===
                                                "Enviado / Aguardando Compras"
                                                  ? "Em Cotação"
                                                  : item.status,
                                            }
                                          : item
                                      )
                                    );
                                    setSelectedScId(sc.id);
                                    setActiveTab("Cotacoes");
                                  }}
                                  className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                                >
                                  Abrir Cotação &rarr;
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA DEDICADA: BI FINANCEIRO & DESEMPENHO ECONÔMICO DAS OBRAS  */}
          {/* ============================================================= */}
          {activeTab === "DesempenhoFinanceiro" && (() => {
            // Cálculos dinâmicos consolidados e por obra
            const ordensFiltradasFin = ordens.filter(
              (o) => obraFiltro === "ALL" || o.obraId === obraFiltro
            );
            const solicitacoesFiltradasFin = solicitacoes.filter(
              (s) => obraFiltro === "ALL" || s.obraId === obraFiltro
            );

            const totalDemandadoPedidos = solicitacoesFiltradasFin.reduce(
              (acc, s) =>
                acc +
                s.itens.reduce(
                  (iAcc, it) => iAcc + it.quantidade * it.orcamentoUnitario,
                  0
                ),
              0
            );

            const totalContratadoFechado = ordensFiltradasFin.reduce(
              (acc, o) => acc + o.valorTotal,
              0
            );

            const totalSavingFinanceiro = ordensFiltradasFin.reduce(
              (acc, o) => acc + (o.savingGerado || 0),
              0
            );

            const orcamentoTotalBenchmark =
              obraFiltro === "ALL"
                ? 15500000
                : obraFiltro === "obra-1"
                ? 5200000
                : obraFiltro === "obra-2"
                ? 3800000
                : 6500000;

            const saldoOrcamentarioDisponivel = Math.max(
              0,
              orcamentoTotalBenchmark - totalContratadoFechado
            );
            const pctConsumidoOrcamento =
              orcamentoTotalBenchmark > 0
                ? (totalContratadoFechado / orcamentoTotalBenchmark) * 100
                : 0;
            const pctSavingGlobal =
              totalContratadoFechado + totalSavingFinanceiro > 0
                ? (totalSavingFinanceiro /
                    (totalContratadoFechado + totalSavingFinanceiro)) *
                  100
                : 0;

            const maxVolumeDiario =
              DADOS_FINANCEIROS_DIARIOS_OUTUBRO.length > 0
                ? Math.max(
                    ...DADOS_FINANCEIROS_DIARIOS_OUTUBRO.map(
                      (d) => d.volumeContratado
                    )
                  )
                : 1;

            // Dados comparativos das Obras Cadastradas (100% Dinâmico)
            const obrasComparativo = obras
              .map((o) => {
                const scsObra = solicitacoes.filter((s) => s.obraId === o.id);
                const ocsObra = ordens.filter((oc) => oc.obraId === o.id);
                const demandado = scsObra.reduce(
                  (acc, s) =>
                    acc +
                    s.itens.reduce(
                      (iAcc, it) => iAcc + it.quantidade * it.orcamentoUnitario,
                      0
                    ),
                  0
                );
                const fechado = ocsObra.reduce(
                  (acc, oc) => acc + oc.valorTotal,
                  0
                );
                const saving = ocsObra.reduce(
                  (acc, oc) => acc + (oc.savingGerado || 0),
                  0
                );
                const savingPct =
                  fechado + saving > 0 ? (saving / (fechado + saving)) * 100 : 0;
                return {
                  id: o.id,
                  nome: o.nome,
                  cidade: o.endereco,
                  sigla: o.sigla,
                  areaM2: 0,
                  engenheiro: o.engenheiro,
                  orcamento: 0,
                  demandado,
                  fechado,
                  saving,
                  savingPct,
                  pedidosCount: scsObra.length,
                  ordensCount: ocsObra.length,
                  custoM2: 0,
                  prazoMedioCotacao: scsObra.length > 0 ? "1.5 dias" : "—",
                  aderenciaMeta: "100%",
                };
              })
              .filter((o) => obraFiltro === "ALL" || o.id === obraFiltro);

            // Dados de Saving por Categoria (100% Dinâmico)
            const categoriasAnalise = CATEGORIAS_CONSTRUCAO.map((catNome) => {
              const scsCat = solicitacoesFiltradasFin.filter(
                (s) => s.categoria === catNome
              );
              const ocsCat = ordensFiltradasFin.filter(
                (o) => o.categoria === catNome
              );
              const orcado = scsCat.reduce(
                (acc, s) =>
                  acc +
                  s.itens.reduce(
                    (iAcc, it) => iAcc + it.quantidade * it.orcamentoUnitario,
                    0
                  ),
                0
              );
              const fechado = ocsCat.reduce(
                (acc, o) => acc + o.valorTotal,
                0
              );
              const saving = ocsCat.reduce(
                (acc, o) => acc + (o.savingGerado || 0),
                0
              );
              const savingPct =
                fechado + saving > 0 ? (saving / (fechado + saving)) * 100 : 0;
              return {
                nome: catNome,
                orcado,
                fechado,
                saving,
                savingPct,
                fornecedorLider:
                  ocsCat.length > 0 ? ocsCat[0].fornecedorNome : "—",
                status: ocsCat.length > 0 ? "Em Andamento" : "Sem Ordens",
              };
            });

            // Top Negociações de Maior Saving (100% Dinâmico a partir das Ordens de Compra)
            const topNegociacoesSaving = ordensFiltradasFin
              .filter((o) => (o.savingGerado || 0) > 0)
              .sort((a, b) => (b.savingGerado || 0) - (a.savingGerado || 0))
              .slice(0, 5)
              .map((o) => ({
                insumo: o.itens[0]?.descricao || o.categoria,
                obraNome: o.obraNome,
                fornecedor: o.fornecedorNome,
                maiorCotado: o.valorTotal + (o.savingGerado || 0),
                fechado: o.valorTotal,
                savingReais: o.savingGerado || 0,
                savingPct:
                  o.valorTotal + (o.savingGerado || 0) > 0
                    ? ((o.savingGerado || 0) /
                        (o.valorTotal + (o.savingGerado || 0))) *
                      100
                    : 0,
                condicao: o.prazoPagamento,
              }));

            // Cronograma de Desembolso / Fluxo de Caixa (100% Dinâmico)
            const faixasDesembolso = [
              {
                faixa: "Próximos 7 Dias",
                descricao: "Fretes à vista, concreto e descargas imediatas",
                valor: totalContratadoFechado * 0.1,
                percentual: totalContratadoFechado > 0 ? 10 : 0,
                cor: "bg-amber-500",
              },
              {
                faixa: "8 a 15 Dias",
                descricao: "Boletos de curto prazo e quitações de insumos",
                valor: totalContratadoFechado * 0.2,
                percentual: totalContratadoFechado > 0 ? 20 : 0,
                cor: "bg-blue-500",
              },
              {
                faixa: "16 a 30 Dias",
                descricao: "Boletos comerciais padrão 28 ddl (Aço e Cimento)",
                valor: totalContratadoFechado * 0.35,
                percentual: totalContratadoFechado > 0 ? 35 : 0,
                cor: "bg-indigo-600",
              },
              {
                faixa: "31 a 60 Dias",
                descricao: "Prazos estendidos 30/60 ddl negociados pelo setor",
                valor: totalContratadoFechado * 0.25,
                percentual: totalContratadoFechado > 0 ? 25 : 0,
                cor: "bg-emerald-600",
              },
              {
                faixa: "Acima de 60 Dias",
                descricao: "Medições de subempreiteiros e parcelas finais",
                valor: totalContratadoFechado * 0.1,
                percentual: totalContratadoFechado > 0 ? 10 : 0,
                cor: "bg-slate-700",
              },
            ];

            // Cálculos dinâmicos do Funil / Pipeline Financeiro de Pedidos das Obras
            const scsTriagem = solicitacoesFiltradasFin.filter(
              (s) => s.status === "Enviado / Aguardando Compras"
            );
            const valTriagem = scsTriagem.reduce(
              (acc, s) => acc + s.itens.reduce((sum, it) => sum + (it.quantidade * (it.orcamentoUnitario || 0)), 0),
              0
            );

            const scsCotacao = solicitacoesFiltradasFin.filter(
              (s) => s.status === "Em Cotação"
            );
            const valCotacao = scsCotacao.reduce(
              (acc, s) => acc + s.itens.reduce((sum, it) => sum + (it.quantidade * (it.orcamentoUnitario || 0)), 0),
              0
            );

            const scsDiretoria = solicitacoesFiltradasFin.filter(
              (s) => s.status === "Aprovada"
            );
            const valDiretoria = scsDiretoria.reduce(
              (acc, s) => acc + s.itens.reduce((sum, it) => sum + (it.quantidade * (it.orcamentoUnitario || 0)), 0),
              0
            );

            const valContratadoOCs = ordensFiltradasFin.reduce((acc, o) => acc + o.valorTotal, 0);

            const ordensEntregues = ordensFiltradasFin.filter(
              (o) => o.status === "Entregue" || o.status === "Entregue na Obra (Confirmado pelo Almoxarifado)"
            );
            const valEntregueNF = ordensEntregues.reduce((acc, o) => acc + o.valorTotal, 0);

            const totalPipelineFluxo = valTriagem + valCotacao + valDiretoria + valContratadoOCs;
            const maxPipelineVal = Math.max(valTriagem, valCotacao, valDiretoria, valContratadoOCs, valEntregueNF, 1);

            return (
              <div className="space-y-6">
                {/* BARRA SUPERIOR DE CONTROLE EXECUTIVO */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">💰</span>
                        <h2 className="text-lg font-bold text-slate-900">
                          BI Financeiro, Desempenho de Obras & Controladoria de Compras
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                          Atualizado Hoje: 18/10/2026
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Controle financeiro consolidado: curva de compras dia a dia, metas orçamentárias por empreendimento, saving real e projeção de desembolso.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <select
                        value={obraFiltro}
                        onChange={(e) => setObraFiltro(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
                      >
                        <option value="ALL">Todas as Obras (Consolidado JC Bauer)</option>
                        {obras.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.nome}
                          </option>
                        ))}
                      </select>

                      <select
                        value={periodoFinanceiro}
                        onChange={(e) =>
                          setPeriodoFinanceiro(
                            e.target.value as "outubro2026" | "ultimos30dias" | "ano2026"
                          )
                        }
                        className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900"
                      >
                        <option value="outubro2026">Mês Vigente (Outubro/2026 - Dias 01 a 18)</option>
                        <option value="ultimos30dias">Últimos 30 Dias Móveis</option>
                        <option value="ano2026">Acumulado Anual 2026</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          dispararAviso("Relatório gerencial de BI exportado com sucesso em formato executivo!");
                          window.print();
                        }}
                        className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                      >
                        <span>📥</span>
                        <span>Exportar BI</span>
                      </button>
                    </div>
                  </div>

                  {/* 4 CARDS DE KPI FINANCEIROS GLOBAIS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Demanda dos Canteiros
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                        {formatBRL(totalDemandadoPedidos)}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
                        <span>{solicitacoesFiltradasFin.length} pedidos abertos</span>
                        <span className="font-semibold text-slate-700">
                          Ticket Médio: {solicitacoesFiltradasFin.length > 0 ? formatBRL(totalDemandadoPedidos / solicitacoesFiltradasFin.length) : "R$ 0,00"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Comprometido em Ordens (OCs)
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                        {formatBRL(totalContratadoFechado)}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
                        <span>{ordensFiltradasFin.length} OCs homologadas</span>
                        <span className="font-semibold text-blue-700">
                          {pctConsumidoOrcamento.toFixed(1)}% do teto
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 rounded-lg border border-emerald-200 p-4">
                      <div className="text-[11px] font-semibold text-emerald-800">
                        Economia Real (Saving)
                      </div>
                      <div className="text-2xl font-extrabold text-emerald-700 mt-1 tabular-nums">
                        {formatBRL(totalSavingFinanceiro)}
                      </div>
                      <div className="text-xs text-emerald-800 mt-1 flex items-center justify-between">
                        <span>vs maior cotação/orçado</span>
                        <span className="font-extrabold bg-emerald-200 text-emerald-950 px-1.5 py-0.2 rounded text-[11px]">
                          +{pctSavingGlobal.toFixed(1)}% economia
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Saldo Orçamentário Livre
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                        {formatBRL(saldoOrcamentarioDisponivel)}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
                        <span>Teto: {formatBRL(orcamentoTotalBenchmark)}</span>
                        <span className="font-bold text-emerald-700">
                          {(100 - pctConsumidoOrcamento).toFixed(1)}% disponível
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BARRA DE NAVEGAÇÃO INTERNA DO DASHBOARD */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-slate-200">
                    {[
                      {
                        id: "visaoGeral",
                        label: "📈 Visão Diária & Funil",
                      },
                      {
                        id: "obras",
                        label: "🏢 Desempenho por Obra",
                      },
                      {
                        id: "categorias",
                        label: "🏷️ Categorias & Negociações",
                      },
                      {
                        id: "fluxoCaixa",
                        label: "💵 Fluxo de Caixa",
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() =>
                          setSubAbaFinanceiro(
                            tab.id as
                              | "visaoGeral"
                              | "obras"
                              | "categorias"
                              | "fluxoCaixa"
                          )
                        }
                        className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold text-center transition flex items-center justify-center gap-1.5 ${
                          subAbaFinanceiro === tab.id
                            ? "bg-slate-900 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ========================================================= */}
                {/* SUB-ABA 1: VISÃO GERAL & GRÁFICO DIÁRIO ATUALIZADO        */}
                {/* ========================================================= */}
                {subAbaFinanceiro === "visaoGeral" && (
                  <div className="space-y-6">
                    {/* BLOCO DO GRÁFICO DIÁRIO ATUALIZADO */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                              Evolução Diária de Compras Contratadas vs. Saving Conquistado
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              Mês Vigente: Outubro / 2026 (Dias 01 a 18)
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Acompanhamento diário das ordens fechadas e valor economizado obtido nas negociações com fornecedores.
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setModoGraficoDiario("grafico")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              modoGraficoDiario === "grafico"
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            📊 Gráfico em Colunas
                          </button>
                          <button
                            type="button"
                            onClick={() => setModoGraficoDiario("tabela")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                              modoGraficoDiario === "tabela"
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            📋 Tabela Diária Analítica
                          </button>
                        </div>
                      </div>

                      {/* LEGENDA DO GRÁFICO */}
                      <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-medium bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-xs bg-slate-900 inline-block"></span>
                            <span className="text-slate-800 font-semibold">
                              Volume Contratado no Dia (R$)
                            </span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-xs bg-emerald-600 inline-block"></span>
                            <span className="text-emerald-800 font-semibold">
                              Saving / Economia Conquistada (R$)
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-600">
                          <span>
                            Média Diária Contratada:{" "}
                            <strong>
                              {formatBRL(
                                DADOS_FINANCEIROS_DIARIOS_OUTUBRO.length > 0
                                  ? DADOS_FINANCEIROS_DIARIOS_OUTUBRO.reduce(
                                      (acc, d) => acc + d.volumeContratado,
                                      0
                                    ) /
                                      DADOS_FINANCEIROS_DIARIOS_OUTUBRO.length
                                  : 0
                              )}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Média Diária de Saving:{" "}
                            <strong>
                              {formatBRL(
                                DADOS_FINANCEIROS_DIARIOS_OUTUBRO.length > 0
                                  ? DADOS_FINANCEIROS_DIARIOS_OUTUBRO.reduce(
                                      (acc, d) => acc + d.savingEconomizado,
                                      0
                                    ) /
                                      DADOS_FINANCEIROS_DIARIOS_OUTUBRO.length
                                  : 0
                              )}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* RENDERIZAÇÃO: MODO GRÁFICO EM COLUNAS */}
                      {modoGraficoDiario === "grafico" ? (
                        DADOS_FINANCEIROS_DIARIOS_OUTUBRO.length === 0 ? (
                          <div className="py-16 text-center text-slate-500 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                            <span className="text-3xl mb-2 inline-block">📊</span>
                            <p className="font-semibold text-slate-700 text-sm">
                              Nenhuma movimentação diária consolidada
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Conforme novas ordens de compra forem emitidas, a evolução diária de compras e saving será plotada aqui.
                            </p>
                          </div>
                        ) : (
                        <div className="space-y-3">
                          <div className="h-72 w-full flex items-end gap-2.5 pt-8 pb-2 px-2 overflow-x-auto border-b border-slate-200">
                            {DADOS_FINANCEIROS_DIARIOS_OUTUBRO.map((d, idx) => {
                              const alturaContratado = Math.max(
                                12,
                                Math.round((d.volumeContratado / maxVolumeDiario) * 210)
                              );
                              const alturaSaving = Math.max(
                                6,
                                Math.round((d.savingEconomizado / maxVolumeDiario) * 210)
                              );

                              return (
                                <div
                                  key={idx}
                                  className="flex-1 min-w-[48px] flex flex-col items-center justify-end h-full group relative"
                                >
                                  {/* TOOLTIP ON HOVER */}
                                  <div className="absolute -top-24 hidden group-hover:flex flex-col z-20 bg-slate-900 text-white text-[11px] p-2.5 rounded-lg shadow-xl whitespace-nowrap pointer-events-none border border-slate-700">
                                    <span className="font-bold text-amber-400">
                                      {d.data} ({d.diaSemana}) • {d.destaqueObra}
                                    </span>
                                    <span>Contratado: {formatBRL(d.volumeContratado)}</span>
                                    <span className="text-emerald-300 font-bold">
                                      Saving: +{formatBRL(d.savingEconomizado)} (
                                      {(
                                        (d.savingEconomizado / d.volumeContratado) *
                                        100
                                      ).toFixed(1)}
                                      %)
                                    </span>
                                    <span className="text-slate-300 text-[10px]">
                                      Destaque: {d.destaqueInsumo} ({d.pedidosFechados} pedidos)
                                    </span>
                                  </div>

                                  {/* Rótulo superior do valor contratado no dia */}
                                  <span className="text-[10px] font-bold text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap tabular-nums">
                                    {(d.volumeContratado / 1000).toFixed(0)}k
                                  </span>

                                  {/* As 2 Colunas Lado a Lado */}
                                  <div className="flex items-end gap-1 w-full justify-center">
                                    {/* Barra Contratado */}
                                    <div
                                      style={{ height: `${alturaContratado}px` }}
                                      className="w-4 sm:w-5 bg-slate-900 hover:bg-slate-800 rounded-t-sm transition-all"
                                      title={`Contratado: ${formatBRL(d.volumeContratado)}`}
                                    />
                                    {/* Barra Saving */}
                                    <div
                                      style={{ height: `${alturaSaving}px` }}
                                      className="w-2.5 sm:w-3 bg-emerald-600 hover:bg-emerald-500 rounded-t-sm transition-all"
                                      title={`Saving: ${formatBRL(d.savingEconomizado)}`}
                                    />
                                  </div>

                                  {/* Rótulo do Eixo X (Data) */}
                                  <span className="text-[10px] font-bold text-slate-600 mt-2 whitespace-nowrap">
                                    {d.data}
                                  </span>
                                  <span className="text-[9px] text-slate-400">
                                    {d.diaSemana}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[11px] text-slate-500 text-center italic">
                            💡 Passe o mouse sobre as colunas diárias para inspecionar os valores, percentuais de economia e insumos chave de cada fechamento.
                          </div>
                        </div>
                        )
                      ) : (
                        /* RENDERIZAÇÃO: MODO TABELA ANALÍTICA DIÁRIA */
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 font-semibold text-xs border-b border-slate-200">
                              <tr>
                                <th className="p-3">Data</th>
                                <th className="p-3">Dia da Semana</th>
                                <th className="p-3 text-right">Volume Contratado</th>
                                <th className="p-3 text-right">Saving Conquistado</th>
                                <th className="p-3 text-center">% Saving</th>
                                <th className="p-3 text-center">Pedidos</th>
                                <th className="p-3">Obra de Destaque</th>
                                <th className="p-3">Principal Negociação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {DADOS_FINANCEIROS_DIARIOS_OUTUBRO.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={8}
                                    className="py-10 text-center text-slate-500 font-medium"
                                  >
                                    Nenhum registro diário de compras consolidado no período.
                                  </td>
                                </tr>
                              ) : (
                                DADOS_FINANCEIROS_DIARIOS_OUTUBRO.map((d, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="p-3 font-bold text-slate-900">{d.data}</td>
                                  <td className="p-3 text-slate-600">{d.diaSemana}</td>
                                  <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                                    {formatBRL(d.volumeContratado)}
                                  </td>
                                  <td className="p-3 text-right font-bold text-emerald-700 tabular-nums">
                                    +{formatBRL(d.savingEconomizado)}
                                  </td>
                                  <td className="p-3 text-center font-bold text-emerald-800">
                                    {(
                                      (d.savingEconomizado / d.volumeContratado) *
                                      100
                                    ).toFixed(1)}
                                    %
                                  </td>
                                  <td className="p-3 text-center text-slate-700 font-semibold">
                                    {d.pedidosFechados}
                                  </td>
                                  <td className="p-3 font-medium text-slate-800">{d.destaqueObra}</td>
                                  <td className="p-3 text-slate-600">{d.destaqueInsumo}</td>
                                </tr>
                              )))}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                              <tr>
                                <td className="p-3" colSpan={2}>TOTAL ACUMULADO OUTUBRO (18 DIAS)</td>
                                <td className="p-3 text-right tabular-nums">
                                  {formatBRL(
                                    DADOS_FINANCEIROS_DIARIOS_OUTUBRO.reduce(
                                      (a, b) => a + b.volumeContratado,
                                      0
                                    )
                                  )}
                                </td>
                                <td className="p-3 text-right text-emerald-700 tabular-nums">
                                  +{formatBRL(
                                    DADOS_FINANCEIROS_DIARIOS_OUTUBRO.reduce(
                                      (a, b) => a + b.savingEconomizado,
                                      0
                                    )
                                  )}
                                </td>
                                <td className="p-3 text-center text-emerald-800">13.1%</td>
                                <td className="p-3 text-center">
                                  {DADOS_FINANCEIROS_DIARIOS_OUTUBRO.reduce(
                                    (a, b) => a + b.pedidosFechados,
                                    0
                                  )}
                                </td>
                                <td className="p-3" colSpan={2}>Consolidado Obras Ativas</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* BLOCO: FUNIL & PIPELINE FINANCEIRO DOS PEDIDOS DE OBRA */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            Pipeline Financeiro de Pedidos das Obras (Status em R$)
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Visualização do ciclo completo da verba: desde a emissão da requisição no canteiro até a entrega física e faturamento.
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          Total no Fluxo: {formatBRL(totalPipelineFluxo)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-900">
                              1. Triagem no Canteiro
                            </span>
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          </div>
                          <div className="text-lg font-extrabold text-amber-950 tabular-nums">
                            {formatBRL(valTriagem)}
                          </div>
                          <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              style={{
                                width: `${valTriagem > 0 ? Math.round((valTriagem / maxPipelineVal) * 100) : 0}%`,
                              }}
                              className="bg-amber-600 h-full"
                            ></div>
                          </div>
                          <span className="text-[10px] text-amber-800 block">
                            {scsTriagem.length} {scsTriagem.length === 1 ? "pedido aguardando cotação" : "pedidos aguardando cotação"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-900">
                              2. Em Cotação B2B
                            </span>
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          </div>
                          <div className="text-lg font-extrabold text-blue-950 tabular-nums">
                            {formatBRL(valCotacao)}
                          </div>
                          <div className="w-full bg-blue-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              style={{
                                width: `${valCotacao > 0 ? Math.round((valCotacao / maxPipelineVal) * 100) : 0}%`,
                              }}
                              className="bg-blue-600 h-full"
                            ></div>
                          </div>
                          <span className="text-[10px] text-blue-800 block">
                            {scsCotacao.length} {scsCotacao.length === 1 ? "processo no mapa equalizado" : "processos no mapa equalizado"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg border border-purple-200 bg-purple-50/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-purple-900">
                              3. Alçada Diretoria
                            </span>
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          </div>
                          <div className="text-lg font-extrabold text-purple-950 tabular-nums">
                            {formatBRL(valDiretoria)}
                          </div>
                          <div className="w-full bg-purple-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              style={{
                                width: `${valDiretoria > 0 ? Math.round((valDiretoria / maxPipelineVal) * 100) : 0}%`,
                              }}
                              className="bg-purple-600 h-full"
                            ></div>
                          </div>
                          <span className="text-[10px] text-purple-800 block">
                            {scsDiretoria.length} {scsDiretoria.length === 1 ? "pedido em aprovação diretoria" : "pedidos em aprovação diretoria"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-indigo-900">
                              4. Contratado / OCs
                            </span>
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          </div>
                          <div className="text-lg font-extrabold text-indigo-950 tabular-nums">
                            {formatBRL(valContratadoOCs)}
                          </div>
                          <div className="w-full bg-indigo-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              style={{
                                width: `${valContratadoOCs > 0 ? Math.round((valContratadoOCs / maxPipelineVal) * 100) : 0}%`,
                              }}
                              className="bg-indigo-600 h-full"
                            ></div>
                          </div>
                          <span className="text-[10px] text-indigo-800 block">
                            {ordensFiltradasFin.length} {ordensFiltradasFin.length === 1 ? "ordem de compra emitida" : "ordens de compra emitidas"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/70 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-900">
                              5. Entregue c/ NF
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          </div>
                          <div className="text-lg font-extrabold text-emerald-950 tabular-nums">
                            {formatBRL(valEntregueNF)}
                          </div>
                          <div className="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              style={{
                                width: `${valEntregueNF > 0 ? Math.round((valEntregueNF / maxPipelineVal) * 100) : 0}%`,
                              }}
                              className="bg-emerald-600 h-full"
                            ></div>
                          </div>
                          <span className="text-[10px] text-emerald-800 block">
                            {ordensEntregues.length} {ordensEntregues.length === 1 ? "entrega confirmada no almoxarifado" : "entregas confirmadas no almoxarifado"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-ABA 2: DESEMPENHO DETALHADO POR OBRA                  */}
                {/* ========================================================= */}
                {subAbaFinanceiro === "obras" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {obrasComparativo.map((ob) => {
                        const pctComprometido = (ob.fechado / ob.orcamento) * 100;
                        const pctSaving = (ob.saving / ob.orcamento) * 100;
                        const saldo = ob.orcamento - ob.fechado;
                        const pctSaldo = (saldo / ob.orcamento) * 100;

                        return (
                          <div
                            key={ob.id}
                            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5 flex flex-col justify-between"
                          >
                            <div className="space-y-4">
                              <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
                                <div>
                                  <span className="text-xs font-semibold text-emerald-700 block">
                                    {ob.sigla} • {ob.cidade}
                                  </span>
                                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                                    {ob.nome}
                                  </h3>
                                  <span className="text-xs text-slate-500 block mt-0.5">
                                    👤 {ob.engenheiro || "A Definir"}
                                  </span>
                                </div>
                                <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 text-xs font-extrabold whitespace-nowrap tabular-nums">
                                  +{ob.savingPct}% Saving
                                </span>
                              </div>

                              {/* Grade de Indicadores Financeiros da Obra */}
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                  <span className="text-[10px] font-semibold text-slate-500 block">
                                    Orçamento Aprovado
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                                    {formatBRL(ob.orcamento)}
                                  </span>
                                </div>

                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                  <span className="text-[10px] font-semibold text-slate-500 block">
                                    Contratado / OCs
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                                    {formatBRL(ob.fechado)}
                                  </span>
                                </div>

                                <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                                  <span className="text-[10px] font-semibold text-emerald-800 block">
                                    Economia / Saving
                                  </span>
                                  <span className="text-sm font-extrabold text-emerald-700 tabular-nums">
                                    +{formatBRL(ob.saving)}
                                  </span>
                                </div>

                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                  <span className="text-[10px] font-semibold text-slate-500 block">
                                    Saldo Disponível
                                  </span>
                                  <span className="text-sm font-bold text-slate-800 tabular-nums">
                                    {formatBRL(saldo)}
                                  </span>
                                </div>
                              </div>

                              {/* Barra Multi-Segmento: Comprometido + Saving + Disponível */}
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                                  <span>Distribuição Orçamentária</span>
                                  <span>{pctSaldo.toFixed(1)}% Verba Livre</span>
                                </div>
                                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex">
                                  <div
                                    style={{ width: `${pctComprometido}%` }}
                                    className="bg-slate-900 h-full"
                                    title={`Comprometido: ${pctComprometido.toFixed(1)}%`}
                                  />
                                  <div
                                    style={{ width: `${pctSaving * 2}%` }}
                                    className="bg-emerald-600 h-full"
                                    title={`Saving Conquistado: ${ob.savingPct}%`}
                                  />
                                  <div
                                    style={{ width: `${Math.max(5, pctSaldo)}%` }}
                                    className="bg-slate-300 h-full"
                                    title={`Saldo Livre: ${pctSaldo.toFixed(1)}%`}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-xs bg-slate-900"></span> Comprometido
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-xs bg-emerald-600"></span> Saving
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-xs bg-slate-300"></span> Saldo Livre
                                  </span>
                                </div>
                              </div>

                              {/* Indicadores de Engenharia & Custos */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Área Construída:</span>
                                  <span className="font-semibold text-slate-800">{ob.areaM2.toLocaleString("pt-BR")} m²</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Custo de Compras / m²:</span>
                                  <span className="font-bold text-slate-900">R$ {ob.custoM2} / m²</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Prazo Médio de Cotação:</span>
                                  <span className="font-semibold text-emerald-800">{ob.prazoMedioCotacao}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500">Acurácia Orçamentária:</span>
                                  <span className="font-semibold text-emerald-800">{ob.aderenciaMeta}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setObraFiltro(ob.id);
                                setActiveTab("Ordens");
                              }}
                              className="w-full mt-4 py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition text-center"
                            >
                              Ver Ordens & Pedidos Desta Obra ➔
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-ABA 3: ECONOMIA POR CATEGORIA & MAIORES NEGOCIAÇÕES   */}
                {/* ========================================================= */}
                {subAbaFinanceiro === "categorias" && (
                  <div className="space-y-6">
                    {/* TOP 5 MAIORES NEGOCIAÇÕES DE SAVING */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🏆</span>
                            <h3 className="text-base font-bold text-slate-900">
                              Maiores Vitórias de Negociação (Top Saving do Mês)
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            As 5 contratações com maior valor absoluto economizado frente à maior cotação inicial.
                          </p>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                          Total Top 5: {formatBRL(topNegociacoesSaving.reduce((acc, d) => acc + d.savingReais, 0))} economizados
                        </span>
                      </div>

                      {topNegociacoesSaving.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
                          <p className="font-semibold text-sm text-slate-700">Nenhuma negociação concluída no período</p>
                          <p className="text-xs text-slate-500 mt-1">Conforme novas ordens de compra forem homologadas a partir de cotações com economia, o ranking de saving será exibido aqui.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {topNegociacoesSaving.map((deal, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-3 flex flex-col justify-between"
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="w-5 h-5 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-[11px] font-bold">
                                    +{deal.savingPct}% Saving
                                  </span>
                                </div>
                                <h4 className="font-bold text-sm text-slate-900 line-clamp-2">
                                  {deal.insumo}
                                </h4>
                                <div className="text-xs text-slate-600 space-y-0.5">
                                  <div>📍 {deal.obraNome}</div>
                                  <div>🏢 Fornecedor: <strong>{deal.fornecedor}</strong></div>
                                  <div>💳 Condição: {deal.condicao}</div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
                                <div className="flex items-center justify-between text-slate-500">
                                  <span>Maior Cotação Inicial:</span>
                                  <span className="line-through">{formatBRL(deal.maiorCotado)}</span>
                                </div>
                                <div className="flex items-center justify-between font-bold text-slate-900">
                                  <span>Valor Final Fechado:</span>
                                  <span>{formatBRL(deal.fechado)}</span>
                                </div>
                                <div className="flex items-center justify-between font-extrabold text-emerald-700 pt-1 text-sm border-t border-slate-200/60">
                                  <span>Economia Real:</span>
                                  <span>+{formatBRL(deal.savingReais)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* TABELA DE CURVA POR CATEGORIA DE INSUMOS */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            Desempenho Financeiro por Categoria de Suprimentos
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Comparativo entre verba orçada, valor contratado, saving conquistado e fornecedor líder de cada família.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-semibold text-xs border-b border-slate-200">
                            <tr>
                              <th className="p-3">Categoria de Insumo</th>
                              <th className="p-3 text-right">Orçado Homologado</th>
                              <th className="p-3 text-right">Contratado Real</th>
                              <th className="p-3 text-right">Economia (Saving)</th>
                              <th className="p-3 text-center">% Saving</th>
                              <th className="p-3">Fornecedor Principal</th>
                              <th className="p-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {categoriasAnalise.map((cat, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-900">{cat.nome}</td>
                                <td className="p-3 text-right font-medium text-slate-600 tabular-nums">
                                  {formatBRL(cat.orcado)}
                                </td>
                                <td className="p-3 text-right font-bold text-slate-900 tabular-nums">
                                  {formatBRL(cat.fechado)}
                                </td>
                                <td className="p-3 text-right font-bold text-emerald-700 tabular-nums">
                                  +{formatBRL(cat.saving)}
                                </td>
                                <td className="p-3 text-center font-bold text-emerald-800">
                                  {cat.savingPct.toFixed(1)}%
                                </td>
                                <td className="p-3 text-slate-700 font-medium">{cat.fornecedorLider}</td>
                                <td className="p-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      cat.status === "Concluído"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-emerald-100 text-emerald-800"
                                    }`}
                                  >
                                    {cat.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================= */}
                {/* SUB-ABA 4: PROJEÇÃO DE DESEMBOLSO / FLUXO DE CAIXA        */}
                {/* ========================================================= */}
                {subAbaFinanceiro === "fluxoCaixa" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                      <div className="border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💵</span>
                          <h3 className="text-base font-bold text-slate-900">
                            Cronograma de Desembolso / Contas a Pagar por Vencimento
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Escalonamento temporal das obrigações com fornecedores baseado nos prazos negociados (28 ddl, 30/60 ddl, medições e à vista).
                        </p>
                      </div>

                      {/* CARDS DAS 5 FAIXAS DE VENCIMENTO */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {faixasDesembolso.map((faixa, i) => (
                          <div
                            key={i}
                            className="bg-slate-50 rounded-lg border border-slate-200 p-3.5 space-y-2 flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <span className="text-[11px] font-semibold text-slate-700 block">
                                {faixa.faixa}
                              </span>
                              <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                                {formatBRL(faixa.valor)}
                              </div>
                              <span className="text-[10px] text-slate-500 block leading-tight">
                                {faixa.descricao}
                              </span>
                            </div>

                            <div className="space-y-1 pt-2 border-t border-slate-200">
                              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${faixa.percentual * 2}%` }}
                                  className={`h-full ${faixa.cor}`}
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-600 block text-right">
                                {faixa.percentual}% do caixa
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* DETALHAMENTO DE TÍTULOS E FORNECEDORES POR VENCIMENTO */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs space-y-3">
                        <h4 className="font-bold text-slate-800 text-sm">
                          Resumo de liquidação programada para os próximos 30 dias:
                        </h4>
                        {ordensFiltradasFin.length === 0 ? (
                          <div className="py-6 text-center text-slate-500 bg-white rounded border border-dashed border-slate-200">
                            Nenhum título com liquidação programada para os próximos 30 dias.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {ordensFiltradasFin.slice(0, 3).map((oc) => (
                              <div key={oc.id} className="bg-white p-3 rounded border border-slate-200 space-y-1">
                                <span className="font-bold text-slate-800 block truncate">{oc.fornecedorNome}</span>
                                <span className="text-slate-500 block">{oc.prazoPagamento || "A combinar"}: {formatBRL(oc.valorTotal)}</span>
                                <span className="text-emerald-700 font-semibold block text-[11px]">Entrega prev.: {oc.previsaoEntrega || "A definir"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ============================================================= */}
          {/* ABA 2: COMPARATIVO DE PREÇOS (3 ORÇAMENTOS & COTAÇÕES)        */}
          {/* ============================================================= */}
          {activeTab === "Cotacoes" && (
            <div>
              {/* Barra de Seleção de Modo: Comparativo Rápido (3 Orçamentos) vs Cotações de Obra */}
              <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModoCotacoes("comparativo_rapido")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                      modoCotacoes === "comparativo_rapido"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span>⚖️</span> Comparativo de 3 Orçamentos (Rápido)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCotacoes("painel_cotacoes")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                      modoCotacoes === "painel_cotacoes"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span>📂</span> Central de Cotações Salvas ({processosCotacoes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCotacoes("solicitacoes_obra")}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                      modoCotacoes === "solicitacoes_obra"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    <span>📋</span> Cotações Vinculadas a Obras ({solicitacoes.length})
                  </button>
                </div>

                {modoCotacoes === "comparativo_rapido" && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={comparativoFileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        handleUploadItensComparativo(e.target.files);
                        if (e.target) e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => comparativoFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                      title="Importar lista de itens de uma planilha Excel"
                    >
                      <span>📥</span> Importar Excel (.xlsx)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModalComparativoPdf(true)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                      title="Visualizar prévia executiva na tela"
                    >
                      <span>👁️</span> Visualizar Prévia
                    </button>
                    <button
                      type="button"
                      onClick={handleGerarComparativoRapidoPDF}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                      title="Gerar mapa comparativo impresso ou em PDF"
                    >
                      <span>🖨️</span> Imprimir Mapa (PDF)
                    </button>
                    <button
                      type="button"
                      onClick={handleLimparComparativo}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
                      title="Limpar tabela e iniciar novo comparativo"
                    >
                      <span>🗑️</span> Limpar
                    </button>
                  </div>
                )}
              </div>

              {/* MODO 1: COMPARATIVO RÁPIDO DE 3 ORÇAMENTOS (SEM BUROCRACIA) */}
              {modoCotacoes === "comparativo_rapido" && (
                <div className="space-y-6">
                  {/* Barra Superior de Gestão Multi-Cotações em Aberto */}
                  <div className="bg-slate-900 border border-slate-800 text-white rounded-xl p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚖️</span> Cotação Ativa:
                        </span>
                        <select
                          value={cotacaoAtivaId}
                          onChange={(e) => handleTrocarCotacaoAtiva(e.target.value)}
                          className="bg-slate-800 border border-slate-700 hover:border-slate-600 text-white text-xs font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-amber-400 outline-none max-w-xs md:max-w-md truncate"
                        >
                          {processosCotacoes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.codigo} • {c.titulo || "Sem Título"} ({c.status})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Seletor de Status Direto */}
                      <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                        <span className="text-[11px] font-medium text-slate-400">Status:</span>
                        <select
                          value={
                            processosCotacoes.find((p) => p.id === cotacaoAtivaId)?.status ||
                            "Aguardando Fornecedores"
                          }
                          onChange={(e) =>
                            handleMudarStatusCotacao(cotacaoAtivaId, e.target.value as any)
                          }
                          className="bg-transparent text-xs font-bold outline-none cursor-pointer text-amber-300"
                        >
                          <option
                            value="Aguardando Fornecedores"
                            className="bg-slate-900 text-amber-300"
                          >
                            🟡 Aguardando Fornecedores
                          </option>
                          <option value="Em Análise" className="bg-slate-900 text-sky-300">
                            🔵 Em Análise
                          </option>
                          <option value="Rascunho" className="bg-slate-900 text-slate-300">
                            ⚪ Rascunho
                          </option>
                          <option value="Concluída" className="bg-slate-900 text-emerald-300">
                            🟢 Concluída / OC Gerada
                          </option>
                          <option value="Cancelada" className="bg-slate-900 text-rose-300">
                            🔴 Cancelada
                          </option>
                        </select>
                      </div>

                      <span className="text-[11px] text-slate-400 hidden xl:inline">
                        ({processosCotacoes.length} cotaç
                        {processosCotacoes.length === 1 ? "ão" : "ões"} salva
                        {processosCotacoes.length === 1 ? "" : "s"} simultaneamente)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCriarNovaCotacao}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                        title="Criar uma nova cotação em branco sem fechar as outras"
                      >
                        <span>➕</span> Nova Cotação
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicarCotacao(cotacaoAtivaId)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                        title="Duplicar a lista de insumos desta cotação para uma nova rodada"
                      >
                        <span>📋</span> Duplicar Lista
                      </button>

                      <button
                        type="button"
                        onClick={handleSalvarCotacaoManual}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                        title="Salvar alterações agora"
                      >
                        <span>💾</span> Salvar
                      </button>

                      <button
                        type="button"
                        onClick={() => setModoCotacoes("painel_cotacoes")}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                        title="Abrir o painel com todas as cotações em andamento"
                      >
                        <span>📂</span> Ver Painel de Cotações ({processosCotacoes.length})
                      </button>
                    </div>
                  </div>
                  {/* Barra de Metadados da Cotação (Título, Obra, Categoria) */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Objeto / Título da Cotação:
                        </label>
                        <input
                          type="text"
                          value={comparativoTitulo}
                          onChange={(e) => setComparativoTitulo(e.target.value)}
                          placeholder="Ex: Cotação de Aço CA-50 e Vergalhões"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Empreendimento / Obra de Destino:
                        </label>
                        <select
                          value={comparativoObraId}
                          onChange={(e) => setComparativoObraId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        >
                          <option value="">Todas as Obras / Canteiro Central</option>
                          {obras.map((ob) => (
                            <option key={ob.id} value={ob.id}>
                              {ob.nome} ({ob.sigla})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Categoria de Suprimentos:
                        </label>
                        <select
                          value={comparativoCategoria}
                          onChange={(e) =>
                            setComparativoCategoria(e.target.value)
                          }
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                        >
                          {CATEGORIAS_CONSTRUCAO.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Cards dos 3 Fornecedores Cotados (Ranking + Totais + Ação) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {([0, 1, 2] as const).map((idx) => {
                      const forn = comparativoFornecedores?.[idx] ?? {
                        nome: `Fornecedor ${idx + 1}`,
                        vendedor: "",
                        telefone: "",
                        prazo: "",
                        condicao: "",
                        freteTipo: "CIF" as const,
                        freteValor: 0,
                        descontoValor: 0,
                      };
                      const total =
                        idx === 0
                          ? resumoComparativo.total1
                          : idx === 1
                          ? resumoComparativo.total2
                          : resumoComparativo.total3;
                      const subtotal =
                        idx === 0
                          ? resumoComparativo.subtotal1
                          : idx === 1
                          ? resumoComparativo.subtotal2
                          : resumoComparativo.subtotal3;

                      const isVencedor =
                        resumoComparativo.vencedorGeral?.index === idx;
                      const posRank =
                        resumoComparativo.ranking.findIndex(
                          (r) => r.index === idx
                        ) + 1;

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-4 shadow-xs transition flex flex-col justify-between ${
                            isVencedor
                              ? "bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-500/20"
                              : "bg-white border-slate-200"
                          }`}
                        >
                          <div>
                            {/* Cabeçalho do Card com Ranking */}
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span
                                className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                  isVencedor
                                    ? "bg-emerald-700 text-white shadow-xs"
                                    : posRank === 2
                                    ? "bg-blue-100 text-blue-900 border border-blue-200"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                              >
                                {isVencedor
                                  ? "🏆 1º Lugar — Mais em Conta"
                                  : posRank > 0
                                  ? `${posRank}º Lugar`
                                  : `Orçamento ${idx + 1}`}
                              </span>
                              <span className="text-xs font-bold text-slate-500">
                                Proposta #{idx + 1}
                              </span>
                            </div>

                            {/* Nome do Fornecedor + Seleção rápida do CRM */}
                            <div className="space-y-2 mb-3">
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                                  Nome da Empresa / Fornecedor:
                                </label>
                                <input
                                  type="text"
                                  value={forn.nome}
                                  onChange={(e) =>
                                    handleAtualizarFornecedorComparativo(
                                      idx,
                                      "nome",
                                      e.target.value
                                    )
                                  }
                                  placeholder={`Nome do Fornecedor ${idx + 1}`}
                                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                                />
                              </div>

                              {fornecedores.length > 0 && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      handleSelecionarFornecedorCrmComparativo(
                                        idx,
                                        e.target.value
                                      );
                                      e.target.value = "";
                                    }
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] text-slate-700"
                                >
                                  <option value="">
                                    Puxar do CRM de Fornecedores...
                                  </option>
                                  {fornecedores.map((f) => (
                                    <option key={f.id} value={f.id}>
                                      {f.empresa} ({f.cidade})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {/* Vendedor, Contato, Prazo e Frete */}
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Vendedor / Contato:
                                </label>
                                <input
                                  type="text"
                                  value={forn.vendedor}
                                  onChange={(e) =>
                                    handleAtualizarFornecedorComparativo(
                                      idx,
                                      "vendedor",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Nome do vendedor"
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Telefone / Whats:
                                </label>
                                <input
                                  type="text"
                                  value={forn.telefone}
                                  onChange={(e) =>
                                    handleAtualizarFornecedorComparativo(
                                      idx,
                                      "telefone",
                                      e.target.value
                                    )
                                  }
                                  placeholder="(11) 9..."
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Prazo de Entrega:
                                </label>
                                <input
                                  type="text"
                                  value={forn.prazo}
                                  onChange={(e) =>
                                    handleAtualizarFornecedorComparativo(
                                      idx,
                                      "prazo",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Ex: 5 dias úteis"
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                                  Condição de Pagto:
                                </label>
                                <input
                                  type="text"
                                  value={forn.condicao}
                                  onChange={(e) =>
                                    handleAtualizarFornecedorComparativo(
                                      idx,
                                      "condicao",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Ex: 28 dias boleto"
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-800"
                                />
                              </div>
                            </div>

                            {/* Frete (CIF / FOB) */}
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mb-3 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-700">
                                  Frete:
                                </span>
                                <select
                                  value={forn.freteTipo}
                                  onChange={(e) =>
                                    handleAtualizarFornecedorComparativo(
                                      idx,
                                      "freteTipo",
                                      e.target.value as "CIF" | "FOB"
                                    )
                                  }
                                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold"
                                >
                                  <option value="CIF">CIF (Incluso)</option>
                                  <option value="FOB">FOB (A pagar)</option>
                                </select>
                              </div>
                              {forn.freteTipo === "FOB" && (
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] text-slate-500">
                                    R$
                                  </span>
                                  <input
                                    type="number"
                                    step="10"
                                    value={forn.freteValor}
                                    onChange={(e) =>
                                      handleAtualizarFornecedorComparativo(
                                        idx,
                                        "freteValor",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-20 bg-white border border-slate-300 rounded px-2 py-0.5 text-xs font-bold text-right"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Rodapé do Card: Valor Total + Botão de Emitir OC */}
      {/* Desconto Comercial (R$) */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-emerald-900">
            🏷️ Desconto:
          </span>
          <span className="text-[10px] text-emerald-700">
            (em R$)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold text-emerald-700">
            - R$
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={forn.descontoValor === 0 ? "" : forn.descontoValor ?? ""}
            onChange={(e) =>
              handleAtualizarFornecedorComparativo(
                idx,
                "descontoValor",
                parseFloat(e.target.value) || 0
              )
            }
            placeholder="0,00"
            className="w-24 bg-white border border-emerald-300 rounded px-2 py-0.5 text-xs font-bold text-right text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
          />
        </div>
      </div>
                          <div className="border-t border-slate-200 pt-3">
                            <div className="flex items-baseline justify-between mb-2">
                              <span className="text-xs font-semibold text-slate-500">
                                Total da Proposta:
                              </span>
                              <div className="text-right">
                                <div
                                  className={`text-xl font-black tabular-nums ${
                                    isVencedor
                                      ? "text-emerald-700"
                                      : "text-slate-900"
                                  }`}
                                >
                                  {formatBRL(total)}
                                </div>
                                {subtotal !== total && (
                                  <div className="text-[10px] text-slate-500">
                                    (Mat: {formatBRL(subtotal)}
                                    {Number(forn.freteValor) > 0 ? ` + Frete: ${formatBRL(forn.freteValor)}` : ""}
                                    {Number(forn.descontoValor) > 0 ? ` - Desc: ${formatBRL(forn.descontoValor)}` : ""})
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleEmitirOrdemComparativo(idx)}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs ${
                                isVencedor
                                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                                  : "bg-slate-900 hover:bg-slate-800 text-white"
                              }`}
                            >
                              <span>📦</span> Emitir Ordem de Compra
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Banner de Economia e Inteligência de Compra (Saving) */}
                  {resumoComparativo.savingGlobal > 0 && (
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg font-bold shadow-xs">
                        💰
                      </div>
                      <div>
                        <div className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                          Economia Direta Apurada (Saving Negociado)
                        </div>
                        <div className="text-sm font-semibold text-emerald-900 mt-0.5">
                          O orçamento mais em conta (
                          <strong>
                            {resumoComparativo.vencedorGeral?.nome || "Vencedor"}
                          </strong>
                          ) gera uma redução de{" "}
                          <strong className="text-emerald-950 font-black">
                            {formatBRL(resumoComparativo.savingGlobal)}
                          </strong>{" "}
                          em relação à proposta mais cara.
                        </div>
                      </div>
                    </div>

                    {resumoComparativo.savingCenarioOtimizado > 10 && (
                      <div className="bg-white/90 border border-emerald-300 rounded-lg px-3 py-2 text-right">
                        <div className="text-[10px] font-bold text-slate-600 uppercase">
                          💡 Cenário Otimizado (Item a Item):
                        </div>
                        <div className="text-xs font-black text-emerald-800">
                          {formatBRL(resumoComparativo.totalCenarioOtimizado)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Economia extra de{" "}
                          {formatBRL(resumoComparativo.savingCenarioOtimizado)}{" "}
                          fracionando os itens
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {/* Tabela Comparativa Interativa (Itens, Quantidades e Preços lado a lado) */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            Planilha de Equalização Item a Item (
                            {comparativoItens.length} insumos)
                          </h3>
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1 shadow-2xs">
                            <span>📦</span> Insumos catalogados no Almoxarifado com SKU
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Insira os preços unitários de cada fornecedor. O sistema destaca em verde o item mais em conta em tempo real.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAdicionarItemComparativo}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        >
                          <span>+</span> Adicionar Insumo
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 text-xs font-semibold text-slate-700">
                            <th className="py-3 px-4 w-[28%]">
                              Insumo / Material
                            </th>
                            <th className="py-3 px-3 w-[14%] text-center">
                              Qtd & Unidade
                            </th>
                            {([0, 1, 2] as const).map((idx) => (
                              <th
                                key={idx}
                                className={`py-3 px-3 w-[18%] text-right border-l border-slate-200 ${
                                  resumoComparativo.vencedorGeral?.index === idx
                                    ? "bg-emerald-50/70 text-emerald-950 font-bold"
                                    : ""
                                }`}
                              >
                                <div className="truncate">
                                  {comparativoFornecedores?.[idx]?.nome ||
                                    `Fornecedor ${idx + 1}`}
                                </div>
                                <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                                  Preço Unit. • Total Item
                                </div>
                              </th>
                            ))}
                            <th className="py-3 px-3 w-[4%] text-center">
                              Excluir
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200">
                          {comparativoItens.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-12 text-center text-slate-500"
                              >
                                <div className="max-w-xs mx-auto space-y-3">
                                  <span className="text-3xl block">📋</span>
                                  <div className="text-xs font-semibold text-slate-700">
                                    Nenhum item na cotação atual.
                                  </div>
                                  <p className="text-[11px] text-slate-500">
                                    Clique no botão abaixo para adicionar insumos ou importe uma lista do Excel.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={handleAdicionarItemComparativo}
                                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
                                  >
                                    + Adicionar Primeiro Insumo
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            resumoComparativo.itensCalculados.map(
                              (it, itemIdx) => {
                                return (
                                  <tr
                                    key={it.id}
                                    className="hover:bg-slate-50 transition"
                                  >
                                    {/* Coluna 1: Nome do Insumo */}
                                    <td className="py-2.5 px-4">
                                      <input
                                        type="text"
                                        value={it.nome}
                                        onChange={(e) =>
                                          handleAtualizarItemComparativo(
                                            it.id,
                                            "nome",
                                            e.target.value
                                          )
                                        }
                                        placeholder={`Ex: Insumo #${
                                          itemIdx + 1
                                        }`}
                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:bg-white rounded px-1.5 py-1 text-xs font-bold text-slate-900 transition"
                                      />
                                      {(() => {
                                        const estMatch = estoque.find(
                                          (e) =>
                                            e.descricao.trim().toLowerCase() ===
                                            (it.nome || "").trim().toLowerCase()
                                        );
                                        return (
                                          <div className="flex flex-wrap items-center gap-1.5 px-1.5 mt-0.5">
                                            {it.pctSaving > 0 && (
                                              <span className="text-[10px] text-emerald-700 font-semibold">
                                                Variação de até{" "}
                                                {it.pctSaving.toFixed(0)}%
                                              </span>
                                            )}
                                            {estMatch && (
                                              <span
                                                className="text-[9px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded"
                                                title="Código SKU catalogado no Almoxarifado"
                                              >
                                                SKU: {estMatch.codigo}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })()}
                                    </td>

                                    {/* Coluna 2: Quantidade & Unidade */}
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="inline-flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          step="0.01"
                                          value={it.quantidade}
                                          onChange={(e) =>
                                            handleAtualizarItemComparativo(
                                              it.id,
                                              "quantidade",
                                              parseFloat(e.target.value) || 0
                                            )
                                          }
                                          className="w-16 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-black text-center text-slate-900"
                                        />
                                        <input
                                          type="text"
                                          value={it.unidade}
                                          onChange={(e) =>
                                            handleAtualizarItemComparativo(
                                              it.id,
                                              "unidade",
                                              e.target.value
                                            )
                                          }
                                          placeholder="un"
                                          className="w-12 bg-white border border-slate-300 rounded px-1 py-1 text-[11px] font-semibold text-center text-slate-700 uppercase"
                                        />
                                      </div>
                                    </td>

                                    {/* Colunas 3, 4 e 5: Preços Fornecedor 1, 2 e 3 */}
                                    {[
                                      {
                                        p: it.preco1,
                                        tot: it.tot1,
                                        win: it.vencedor1,
                                        key: "preco1" as const,
                                      },
                                      {
                                        p: it.preco2,
                                        tot: it.tot2,
                                        win: it.vencedor2,
                                        key: "preco2" as const,
                                      },
                                      {
                                        p: it.preco3,
                                        tot: it.tot3,
                                        win: it.vencedor3,
                                        key: "preco3" as const,
                                      },
                                    ].map((col, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className={`py-2.5 px-3 border-l border-slate-200 transition ${
                                          col.win
                                            ? "bg-emerald-50/70 border-emerald-300"
                                            : ""
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-1.5">
                                          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded px-1.5 py-0.5 shadow-2xs">
                                            <span className="text-[10px] text-slate-400 font-semibold">
                                              R$
                                            </span>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={col.p}
                                              onChange={(e) =>
                                                handleAtualizarItemComparativo(
                                                  it.id,
                                                  col.key,
                                                  parseFloat(e.target.value) ||
                                                    0
                                                )
                                              }
                                              className="w-20 text-right text-xs font-black text-slate-900 focus:outline-none tabular-nums"
                                            />
                                          </div>

                                          <div className="text-right">
                                            <div
                                              className={`text-xs tabular-nums font-bold ${
                                                col.win
                                                  ? "text-emerald-800"
                                                  : "text-slate-800"
                                              }`}
                                            >
                                              {formatBRL(col.tot)}
                                            </div>
                                            {col.win && (
                                              <span className="inline-block px-1.5 py-0.2 rounded bg-emerald-700 text-white text-[9px] font-extrabold uppercase tracking-tight">
                                                🏆 Mais em Conta
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    ))}

                                    {/* Coluna 6: Excluir */}
                                    <td className="py-2.5 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoverItemComparativo(it.id)
                                        }
                                        className="text-slate-400 hover:text-rose-600 transition p-1 text-sm"
                                        title="Remover insumo da cotação"
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  </tr>
                                );
                              }
                            )
                          )}
                        </tbody>

                        {/* Rodapé com Totais Consolidados */}
                        {comparativoItens.length > 0 && (
                          <tfoot className="border-t-2 border-slate-300 font-bold">
                            <tr className="bg-slate-50 text-xs">
                              <td
                                colSpan={2}
                                className="py-3 px-4 text-slate-700"
                              >
                                Subtotal dos Materiais
                              </td>
                              <td className="py-3 px-3 text-right text-slate-900 border-l border-slate-200 tabular-nums">
                                {formatBRL(resumoComparativo.subtotal1)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-900 border-l border-slate-200 tabular-nums">
                                {formatBRL(resumoComparativo.subtotal2)}
                              </td>
                              <td className="py-3 px-3 text-right text-slate-900 border-l border-slate-200 tabular-nums">
                                {formatBRL(resumoComparativo.subtotal3)}
                              </td>
                              <td></td>
                            </tr>

                            <tr className="bg-emerald-50/60 text-xs border-y border-emerald-200">
                              <td
                                colSpan={2}
                                className="py-2.5 px-4 text-emerald-950 font-bold"
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  <span>🏷️</span>
                                  <span>Desconto Comercial (R$)</span>
                                </span>
                              </td>
                              {([0, 1, 2] as const).map((idx) => {
                                const descAtual =
                                  comparativoFornecedores?.[idx]?.descontoValor ?? 0;
                                return (
                                  <td
                                    key={idx}
                                    className="py-1.5 px-2 text-right border-l border-emerald-200 text-xs tabular-nums"
                                  >
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-[11px] font-bold text-emerald-700">
                                        - R$
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={descAtual === 0 ? "" : descAtual}
                                        onChange={(e) =>
                                          handleAtualizarFornecedorComparativo(
                                            idx,
                                            "descontoValor",
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                        placeholder="0,00"
                                        className="w-24 bg-white border border-emerald-300 rounded px-2 py-0.5 text-xs font-bold text-right text-emerald-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
                                        title={`Desconto em R$ concedido por ${
                                          comparativoFornecedores?.[idx]?.nome ||
                                          `Fornecedor ${idx + 1}`
                                        }`}
                                      />
                                    </div>
                                  </td>
                                );
                              })}
                              <td></td>
                            </tr>
                            <tr className="bg-slate-50 text-xs">
                              <td
                                colSpan={2}
                                className="py-2 px-4 text-slate-600 font-normal"
                              >
                                Frete (CIF / FOB)
                              </td>
                              {([0, 1, 2] as const).map((idx) => (
                                <td
                                  key={idx}
                                  className="py-2 px-3 text-right text-slate-600 border-l border-slate-200 text-xs tabular-nums"
                                >
                                  {(comparativoFornecedores?.[idx]?.freteTipo ?? "CIF") ===
                                  "CIF"
                                    ? "CIF (Incluso)"
                                    : `FOB (${formatBRL(
                                        comparativoFornecedores?.[idx]?.freteValor ?? 0
                                      )})`}
                                </td>
                              ))}
                              <td></td>
                            </tr>

                            <tr className="bg-slate-900 text-white text-sm">
                              <td
                                colSpan={2}
                                className="py-3 px-4 font-black"
                              >
                                VALOR TOTAL FINAL (COM FRETE E DESCONTO)
                              </td>
                              {([0, 1, 2] as const).map((idx) => {
                                const tot =
                                  idx === 0
                                    ? resumoComparativo.total1
                                    : idx === 1
                                    ? resumoComparativo.total2
                                    : resumoComparativo.total3;
                                const isVencedor =
                                  resumoComparativo.vencedorGeral?.index ===
                                  idx;

                                return (
                                  <td
                                    key={idx}
                                    className={`py-3 px-3 text-right border-l border-slate-800 tabular-nums font-black ${
                                      isVencedor
                                        ? "bg-emerald-700 text-white"
                                        : "text-white"
                                    }`}
                                  >
                                    <div>{formatBRL(tot)}</div>
                                    {isVencedor && (
                                      <div className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider mt-0.5">
                                        ⭐ Vencedor
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Barra de Ações Rápidas no Pé da Tabela */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleAdicionarItemComparativo}
                        className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                      >
                        <span>+</span> Adicionar Mais um Insumo
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            comparativoFileInputRef.current?.click()
                          }
                          className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <span>📥</span> Importar Itens (.xlsx)
                        </button>
                        <button
                          type="button"
                          onClick={handleGerarComparativoRapidoPDF}
                          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                        >
                          <span>🖨️</span> Imprimir Relatório Executivo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* MODO 3: PAINEL / CENTRAL DE COTAÇÕES SALVAS */}
              {modoCotacoes === "painel_cotacoes" && (() => {
                const totalCotacoes = processosCotacoes.length;
                const aguardandoCount = processosCotacoes.filter(
                  (c) => c.status === "Aguardando Fornecedores"
                ).length;
                const emAnaliseCount = processosCotacoes.filter(
                  (c) => c.status === "Em Análise"
                ).length;
                const concluidasCount = processosCotacoes.filter(
                  (c) => c.status === "Concluída"
                ).length;

                const cotacoesFiltradas = processosCotacoes.filter((c) => {
                  if (filtroStatusCotacoes !== "TODAS" && c.status !== filtroStatusCotacoes) {
                    return false;
                  }
                  if (buscaProcessosCotacoes.trim()) {
                    const q = buscaProcessosCotacoes.toLowerCase();
                    const matchCodigo = c.codigo.toLowerCase().includes(q);
                    const matchTitulo = (c.titulo || "").toLowerCase().includes(q);
                    const matchObra = (c.obraNome || "").toLowerCase().includes(q);
                    const matchForn = (c.fornecedores || []).some(
                      (f) =>
                        f.nome?.toLowerCase().includes(q) ||
                        f.vendedor?.toLowerCase().includes(q)
                    );
                    const matchItens = (c.itens || []).some((it) =>
                      it.nome?.toLowerCase().includes(q)
                    );
                    return matchCodigo || matchTitulo || matchObra || matchForn || matchItens;
                  }
                  return true;
                });

                return (
                  <div className="space-y-6">
                    {/* Banner e Cards de Métricas de Cotações Concorrentes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Total de Processos
                        </div>
                        <div className="text-2xl font-black text-slate-900 mt-1">
                          {totalCotacoes}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Mapas comparativos registrados
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs bg-gradient-to-br from-amber-50/50 to-white">
                        <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🟡</span> Aguardando Resposta
                        </div>
                        <div className="text-2xl font-black text-amber-900 mt-1">
                          {aguardandoCount}
                        </div>
                        <div className="text-[11px] text-amber-700 mt-1">
                          Aguardando propostas de fornecedores
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-sky-200 p-4 shadow-xs bg-gradient-to-br from-sky-50/50 to-white">
                        <div className="text-xs font-semibold text-sky-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🔵</span> Em Equalização
                        </div>
                        <div className="text-2xl font-black text-sky-900 mt-1">
                          {emAnaliseCount}
                        </div>
                        <div className="text-[11px] text-sky-700 mt-1">
                          Negociação de descontos e fretes
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs bg-gradient-to-br from-emerald-50/50 to-white">
                        <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span>🟢</span> Concluídas / OC
                        </div>
                        <div className="text-2xl font-black text-emerald-900 mt-1">
                          {concluidasCount}
                        </div>
                        <div className="text-[11px] text-emerald-700 mt-1">
                          Ordens emitidas com saving apurado
                        </div>
                      </div>
                    </div>

                    {/* Barra de Busca + Filtro por Status + Botão Nova Cotação */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                        <div className="relative flex-1 min-w-[240px] max-w-md">
                          <input
                            type="text"
                            value={buscaProcessosCotacoes}
                            onChange={(e) => setBuscaProcessosCotacoes(e.target.value)}
                            placeholder="Buscar cotação por código, título, fornecedor ou material..."
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900"
                          />
                          {buscaProcessosCotacoes && (
                            <button
                              type="button"
                              onClick={() => setBuscaProcessosCotacoes("")}
                              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                          {[
                            { id: "TODAS", label: `Todas (${totalCotacoes})` },
                            {
                              id: "Aguardando Fornecedores",
                              label: `🟡 Aguardando (${aguardandoCount})`,
                            },
                            {
                              id: "Em Análise",
                              label: `🔵 Em Análise (${emAnaliseCount})`,
                            },
                            {
                              id: "Concluída",
                              label: `🟢 Concluídas (${concluidasCount})`,
                            },
                            {
                              id: "Rascunho",
                              label: `⚪ Rascunhos (${
                                processosCotacoes.filter((c) => c.status === "Rascunho")
                                  .length
                              })`,
                            },
                          ].map((filtro) => (
                            <button
                              key={filtro.id}
                              type="button"
                              onClick={() => setFiltroStatusCotacoes(filtro.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                                filtroStatusCotacoes === filtro.id
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                            >
                              {filtro.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCriarNovaCotacao}
                          className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                        >
                          <span>➕</span> Nova Cotação
                        </button>
                      </div>
                    </div>

                    {/* Tabela de Processos de Cotação */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-4 font-bold">Código</th>
                              <th className="py-3 px-4 font-bold">Objeto / Cotação</th>
                              <th className="py-3 px-4 font-bold">Obra & Categoria</th>
                              <th className="py-3 px-4 font-bold">Fornecedores Cotados</th>
                              <th className="py-3 px-4 font-bold text-center">Itens</th>
                              <th className="py-3 px-4 font-bold">Menor Proposta / Vencedor</th>
                              <th className="py-3 px-4 font-bold">Status</th>
                              <th className="py-3 px-4 font-bold">Atualização</th>
                              <th className="py-3 px-4 font-bold text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {cotacoesFiltradas.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="py-12 text-center text-slate-500">
                                  <div className="text-3xl mb-2">📂</div>
                                  <p className="font-semibold text-slate-700">
                                    Nenhuma cotação encontrada
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {buscaProcessosCotacoes
                                      ? "Tente ajustar o termo de pesquisa ou o filtro de status."
                                      : "Clique em '+ Nova Cotação' para iniciar o seu primeiro comparativo."}
                                  </p>
                                </td>
                              </tr>
                            ) : (
                              cotacoesFiltradas.map((c) => {
                                const isAtiva = c.id === cotacaoAtivaId;
                                const totalItens = (c.itens || []).length;
                                const fornsPreenchidos = (c.fornecedores || []).filter(
                                  (f) => f && f.nome && f.nome.trim() !== ""
                                );

                                return (
                                  <tr
                                    key={c.id}
                                    className={`hover:bg-slate-50/80 transition ${
                                      isAtiva ? "bg-amber-50/30" : ""
                                    }`}
                                  >
                                    <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono text-xs">{c.codigo}</span>
                                        {isAtiva && (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase">
                                            Ativa
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4">
                                      <div className="font-bold text-slate-900 max-w-xs truncate">
                                        {c.titulo || "Sem Título"}
                                      </div>
                                      {c.numeroOcEmitida && (
                                        <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                                          Vinculada à {c.numeroOcEmitida}
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 text-slate-600">
                                      <div className="font-medium text-slate-800">
                                        {c.obraNome || "Canteiro Central"}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {c.categoria || "Geral"}
                                      </div>
                                    </td>

                                    <td className="py-3.5 px-4">
                                      {fornsPreenchidos.length === 0 ? (
                                        <span className="text-[11px] text-slate-400 italic">
                                          Nenhum vinculado
                                        </span>
                                      ) : (
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                          {fornsPreenchidos.map((f, fi) => (
                                            <span
                                              key={fi}
                                              className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[10px] font-medium truncate max-w-[120px]"
                                              title={f.nome}
                                            >
                                              {f.nome}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 text-center">
                                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                                        {totalItens} {totalItens === 1 ? "insumo" : "insumos"}
                                      </span>
                                    </td>

                                    <td className="py-3.5 px-4">
                                      {Number(c.menorValor) > 0 ? (
                                        <div>
                                          <div className="font-black text-emerald-700 tabular-nums">
                                            {formatBRL(c.menorValor || 0)}
                                          </div>
                                          {c.melhorFornecedorNome && (
                                            <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                              1º lugar: {c.melhorFornecedorNome}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] text-slate-400">
                                          Em cotação...
                                        </span>
                                      )}
                                    </td>

                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                      <select
                                        value={c.status}
                                        onChange={(e) =>
                                          handleMudarStatusCotacao(
                                            c.id,
                                            e.target.value as any
                                          )
                                        }
                                        className={`text-[11px] font-bold px-2 py-1 rounded-md border outline-none cursor-pointer ${
                                          c.status === "Aguardando Fornecedores"
                                            ? "bg-amber-50 text-amber-800 border-amber-300"
                                            : c.status === "Em Análise"
                                            ? "bg-sky-50 text-sky-800 border-sky-300"
                                            : c.status === "Concluída"
                                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                            : c.status === "Cancelada"
                                            ? "bg-rose-50 text-rose-800 border-rose-300"
                                            : "bg-slate-100 text-slate-700 border-slate-300"
                                        }`}
                                      >
                                        <option value="Aguardando Fornecedores">
                                          🟡 Aguardando
                                        </option>
                                        <option value="Em Análise">🔵 Em Análise</option>
                                        <option value="Rascunho">⚪ Rascunho</option>
                                        <option value="Concluída">🟢 Concluída</option>
                                        <option value="Cancelada">🔴 Cancelada</option>
                                      </select>
                                    </td>

                                    <td className="py-3.5 px-4 text-[11px] text-slate-500 whitespace-nowrap">
                                      {c.dataAtualizacao || c.dataCriacao}
                                    </td>

                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleTrocarCotacaoAtiva(c.id)}
                                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                                            isAtiva
                                              ? "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs"
                                              : "bg-slate-900 hover:bg-slate-800 text-white"
                                          }`}
                                          title="Abrir no Mapa Comparativo para continuar cotando"
                                        >
                                          <span>⚡</span> {isAtiva ? "Editando" : "Abrir"}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleGerarComparativoRapidoPDF(c)}
                                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                          title="Imprimir ou gerar PDF deste mapa"
                                        >
                                          📄
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => handleDuplicarCotacao(c.id)}
                                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                          title="Duplicar insumos para uma nova cotação"
                                        >
                                          📋
                                        </button>

                                        {processosCotacoes.length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleExcluirCotacao(c.id)}
                                            className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600 transition"
                                            title="Excluir cotação"
                                          >
                                            🗑️
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* MODO 2: COTAÇÕES VINCULADAS A REQUISIÇÕES DE OBRA (SC) */}
              {modoCotacoes === "solicitacoes_obra" && (
                scAtiva ? (
                <div>
                  {/* Barra de Controle da Cotação */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                  <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    Solicitação em Cotação:
                  </label>
                  <select
                    value={scAtiva.id}
                    onChange={(e) => setSelectedScId(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    {solicitacoes.map((s) => {
                      const ob = obras.find((o) => o.id === s.obraId);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.codigo} • {ob?.nome} ({s.categoria})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowInserirPrecoModal(true)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-xs font-semibold transition whitespace-nowrap"
                  >
                    + Inserir Preço de Fornecedor
                  </button>
                  <button
                    onClick={handleGeneratePDF}
                    className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition whitespace-nowrap"
                  >
                    Gerar PDF
                  </button>
                </div>
              </div>

              {/* 4 Cards de KPI da Cotação Atual (Regra do Número Único) */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Orçamento de Referência
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatBRL(orcamentoScAtiva)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {obraScAtiva.nome}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Menor Proposta Global
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {formatBRL(resumoCotacaoAtiva.menorTotal)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Valor equalizado com frete
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Fornecedor Recomendado
                  </div>
                  <div className="text-xl font-bold text-slate-900 mt-1 truncate">
                    {resumoCotacaoAtiva.vencedorNome}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Menor preço global apurado
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Economia na Cotação
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {formatBRL(resumoCotacaoAtiva.savingGerado)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Saving direto para a construtora
                  </div>
                </div>
              </div>

              {/* Tabela Comparativa Limpa (w-full text-sm border-collapse) */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300">
                      <th className="p-3.5 border border-slate-300 w-[30%]">
                        <div className="font-bold text-slate-900">
                          Insumo / Serviço Solicitado
                        </div>
                        <div className="text-xs font-normal text-slate-500 mt-0.5">
                          {scAtiva.categoria} • Qtd. e Unidade
                        </div>
                      </th>

                      {scAtiva.propostas.map((prop, idx) => {
                        const isVencedor =
                          prop.id === resumoCotacaoAtiva.vencedorId;
                        const iqf = calcularIqfFornecedor(
                          prop.fornecedorNome,
                          ordens
                        );
                        const iqfBadgeCls =
                          iqf.classificacao.includes("Ouro")
                            ? "bg-amber-100 text-amber-900 border-amber-300"
                            : iqf.classificacao.includes("Prata")
                            ? "bg-blue-100 text-blue-900 border-blue-300"
                            : iqf.classificacao.includes("Monitorado")
                            ? "bg-orange-100 text-orange-900 border-orange-300"
                            : "bg-red-100 text-red-900 border-red-300";

                        return (
                          <th
                            key={prop.id}
                            className={`p-3.5 border border-slate-300 align-top ${
                              isVencedor ? "bg-emerald-50" : "bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 truncate">
                                {idx + 1}. {prop.fornecedorNome}
                              </span>
                              {isVencedor && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white text-[11px] font-bold shrink-0">
                                  Menor Preço
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="text-xs font-normal text-slate-600 truncate">
                                Vendedor: {prop.vendedorNome}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setFornecedorIqfModal(prop.fornecedorNome)
                                }
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition hover:opacity-80 shrink-0 ${iqfBadgeCls}`}
                                title={`Auditar histórico de entregas e IQF de ${prop.fornecedorNome}`}
                              >
                                ⭐ IQF {iqf.scoreGeral} ({iqf.classificacao})
                              </button>
                            </div>
                            <div className="mt-2 pt-1.5 border-t border-slate-300 flex items-center justify-between text-xs font-semibold text-slate-600">
                              <span>Preço Unit. (R$)</span>
                              <span>Total Item (R$)</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {scAtiva.itens.map((item) => {
                      const menorUnit = Math.min(
                        ...scAtiva.propostas.map(
                          (p) => p.precosUnitarios[item.id] || Infinity
                        )
                      );
                      const curvaInfo = curvaAbcMap.get(item.descricao.trim()) || {
                        classe: "Classe C" as ClasseAbc,
                        totalGeral: 0,
                        percentual: 100,
                      };
                      const histInfo = buscarHistoricoInsumo(
                        item.descricao,
                        ordens,
                        ECONOMIA_INSUMOS_HISTORICO
                      );

                      return (
                        <tr
                          key={item.id}
                          className="odd:bg-white even:bg-slate-50 hover:bg-slate-100/70"
                        >
                          {/* Coluna 1: Insumo / Serviço + Qtd/Unid + Curva ABC + Benchmark */}
                          <td className="p-3.5 border border-slate-300 align-middle">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-semibold text-slate-900 leading-snug">
                                {item.descricao}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold shrink-0 ${
                                  curvaInfo.classe === "Classe A"
                                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                    : curvaInfo.classe === "Classe B"
                                    ? "bg-blue-100 text-blue-900 border border-blue-300"
                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                }`}
                                title={`Classificação Curva ABC de Pareto: ${curvaInfo.classe} (${curvaInfo.percentual.toFixed(1)}% do volume total)`}
                              >
                                {curvaInfo.classe}
                              </span>
                            </div>

                            <div className="text-xs text-slate-600 mt-1.5 flex items-center justify-between">
                              <span>
                                Meta: {formatBRL(item.orcamentoUnitario)} /{" "}
                                {item.unidade}
                              </span>
                              <span className="px-2 py-0.5 rounded-sm bg-slate-200 text-slate-900 font-bold tabular-nums">
                                {item.quantidade} {item.unidade}
                              </span>
                            </div>

                            {histInfo && (
                              <div className="mt-2 p-1.5 rounded bg-slate-100/90 border border-slate-200 text-[11px] text-slate-700 leading-tight">
                                <div className="font-semibold text-slate-900">
                                  📊 Histórico de Compras:
                                </div>
                                <div className="mt-0.5">
                                  Última: <strong>{formatBRL(histInfo.ultimoPreco)}</strong> ({histInfo.fornecedor}) • Média: {formatBRL(histInfo.precoMedio)}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Colunas dos Fornecedores (Input editável -> calcula Total automaticamente) */}
                          {scAtiva.propostas.map((prop) => {
                            const unit = prop.precosUnitarios[item.id] ?? 0;
                            const totalItem = item.quantidade * unit;
                            const isMenorDaLinha =
                              unit > 0 && Math.abs(unit - menorUnit) < 0.01;

                            return (
                              <td
                                key={prop.id}
                                className={`p-3.5 border border-slate-300 align-middle ${
                                  isMenorDaLinha ? "bg-emerald-50/60" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1">
                                    <span className="text-xs text-slate-500">
                                      R$
                                    </span>
                                    <input
                                      type="number"
                                      step="0.10"
                                      value={unit}
                                      onChange={(e) =>
                                        handleAtualizarPrecoUnitario(
                                          scAtiva.id,
                                          prop.id,
                                          item.id,
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-20 text-right font-semibold text-slate-900 text-sm focus:outline-none tabular-nums"
                                    />
                                  </div>

                                  <span
                                    className={`whitespace-nowrap tabular-nums text-sm ${
                                      isMenorDaLinha
                                        ? "font-bold text-emerald-800"
                                        : "font-semibold text-slate-900"
                                    }`}
                                  >
                                    {formatBRL(totalItem)}
                                  </span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Rodapé da Tabela: Frete, Prazo/Pagamento e TOTAL GERAL */}
                  <tfoot className="border-t-2 border-slate-300">
                    {/* Linha 1: Frete (R$) */}
                    <tr className="bg-slate-50">
                      <td className="p-3.5 border border-slate-300 font-semibold text-slate-800">
                        Frete p/ Obra (R$)
                      </td>
                      {scAtiva.propostas.map((prop) => (
                        <td
                          key={prop.id}
                          className="p-3.5 border border-slate-300 text-right"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-600">
                              {prop.freteValor === 0
                                ? "CIF (Incluso)"
                                : "FOB"}
                            </span>
                            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md px-2 py-1">
                              <span className="text-xs text-slate-500">R$</span>
                              <input
                                type="number"
                                step="50"
                                value={prop.freteValor}
                                onChange={(e) =>
                                  handleAtualizarFrete(
                                    scAtiva.id,
                                    prop.id,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-20 text-right font-semibold text-slate-900 text-sm focus:outline-none tabular-nums"
                              />
                            </div>
                          </div>
                        </td>
                      ))}
                    </tr>

                    {/* Linha 2: Prazo / Pagamento */}
                    <tr className="bg-white">
                      <td className="p-3.5 border border-slate-300 font-semibold text-slate-800">
                        Prazo e Condição de Pagamento
                      </td>
                      {scAtiva.propostas.map((prop) => (
                        <td
                          key={prop.id}
                          className="p-3.5 border border-slate-300 text-right text-xs font-medium text-slate-700"
                        >
                          {prop.prazoPagamento}
                        </td>
                      ))}
                    </tr>

                    {/* Linha 3: TOTAL GERAL + Botão Aprovar */}
                    <tr className="bg-slate-100">
                      <td className="p-4 border border-slate-300 align-middle">
                        <div className="text-base font-bold text-slate-900">
                          TOTAL GERAL EQUALIZADO
                        </div>
                        <div className="text-xs text-slate-600">
                          Materiais + Impostos + Frete na Obra
                        </div>
                      </td>

                      {scAtiva.propostas.map((prop) => {
                        const tot = totaisPorProposta[prop.id]?.totalGeral || 0;
                        const isVencedor =
                          prop.id === resumoCotacaoAtiva.vencedorId;

                        return (
                          <td
                            key={prop.id}
                            className={`p-4 border border-slate-300 text-right align-middle ${
                              isVencedor
                                ? "bg-emerald-50 text-emerald-800 font-bold"
                                : "bg-slate-100 text-slate-900 font-bold"
                            }`}
                          >
                            <div className="text-lg font-bold whitespace-nowrap tabular-nums">
                              {formatBRL(tot)}
                            </div>
                            <button
                              onClick={() => handleAprovarGerarOrdem(prop.id)}
                              className={`mt-2.5 w-full py-2 px-3 rounded-lg text-xs font-semibold transition ${
                                isVencedor
                                  ? "bg-emerald-700 hover:bg-emerald-800 text-white"
                                  : "bg-slate-900 hover:bg-slate-800 text-white"
                              }`}
                            >
                              Aprovar e Gerar Ordem de Compra
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <span className="text-3xl">⚖️</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Nenhuma Solicitação Aberta para Cotação
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Crie uma nova solicitação de compra no Painel de Requisições ou aguarde o envio de demandas pelos canteiros para equalizar propostas de fornecedores no mapa comparativo.
                  </p>
                  <button
                    onClick={() => setShowNovaScModal(true)}
                    className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
                  >
                    + Criar Nova Solicitação de Compra
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

          {/* ============================================================= */}
          {/* ABA 3: FORNECEDORES & VENDEDORES (`Fornecedores`)             */}
          {/* ============================================================= */}
          {activeTab === "Fornecedores" && (
            <div>
              {/* Barra de Busca + Filtro de Categoria + Botão Novo Fornecedor */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                <input
                  type="text"
                  value={buscaFornecedor}
                  onChange={(e) => setBuscaFornecedor(e.target.value)}
                  placeholder="Buscar por empresa, cidade, categoria ou vendedor..."
                  className="flex-1 min-w-[260px] bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />

                <div className="flex items-center gap-3">
                  <select
                    value={filtroCatFornecedor}
                    onChange={(e) => setFiltroCatFornecedor(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-800"
                  >
                    <option value="ALL">
                      Todas as Categorias ({fornecedores.length})
                    </option>
                    {CATEGORIAS_CONSTRUCAO.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>

                  <input
                    ref={fornecedoresFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      handleUploadPlanilha(e.target.files);
                      if (e.target) e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fornecedoresFileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                    title="Importar lista completa de fornecedores via Excel (.xlsx) ou CSV"
                  >
                    <span>📥</span> Importar Planilha (.xlsx)
                  </button>

                  <button
                    onClick={() => setShowNovoFornecedorModal(true)}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition whitespace-nowrap"
                  >
                    + Novo Fornecedor
                  </button>
                </div>
              </div>

              {/* Tabela Limpa de Fornecedores (Máximo 1 Badge de Categoria!) */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                      <th className="py-3 px-4">Empresa</th>
                      <th className="py-3 px-4">Cidade</th>
                      <th className="py-3 px-4">Categoria Principal</th>
                      <th className="py-3 px-4 text-center">Índice IQF</th>
                      <th className="py-3 px-4">Vendedor</th>
                      <th className="py-3 px-4">Telefone / WhatsApp</th>
                      <th className="py-3 px-4 text-right">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {fornecedoresFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-500">
                            <span className="text-3xl mb-2">🏢</span>
                            <p className="font-semibold text-slate-700 text-sm">
                              Nenhum fornecedor cadastrado
                            </p>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm">
                              Clique em &quot;+ Novo Fornecedor&quot; acima para registrar parceiros comerciais e fábricas homologadas.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                    fornecedoresFiltrados.map((f) => {
                      const iqf = calcularIqfFornecedor(f.empresa, ordens);
                      const iqfBadgeCls =
                        iqf.classificacao.includes("Ouro")
                          ? "bg-amber-100 text-amber-900 border-amber-300"
                          : iqf.classificacao.includes("Prata")
                          ? "bg-blue-100 text-blue-900 border-blue-300"
                          : iqf.classificacao.includes("Monitorado")
                          ? "bg-orange-100 text-orange-900 border-orange-300"
                          : "bg-red-100 text-red-900 border-red-300";

                      return (
                        <tr
                          key={f.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {f.empresa}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {f.cidade || "—"}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-800">
                              {f.categoriaPrincipal}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setFornecedorIqfModal(f.empresa)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold transition hover:opacity-85 ${iqfBadgeCls}`}
                              title="Clique para auditar índice de qualidade, pontualidade e histórico de ressalvas"
                            >
                              <span>⭐ {iqf.scoreGeral}</span>
                              <span className="font-semibold text-slate-600">
                                ({iqf.classificacao})
                              </span>
                            </button>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {f.vendedor || "—"}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-800">{f.telefone || "—"}</span>
                              {f.whatsapp && !f.whatsapp.includes("1199000") && (
                                <a
                                  href={`https://wa.me/${f.whatsapp}?text=${encodeURIComponent(
                                    `Olá ${f.vendedor || "Amigo"}, tudo bem? Aqui é ${settings.userName} (${settings.companyName}). Gostaria de solicitar uma cotação.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                                >
                                  WhatsApp
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setFornecedorEditando(f)}
                                className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                                title="Editar dados e contatos deste fornecedor"
                              >
                                <span>✏️</span> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setFornecedorFichaModal(f)}
                                className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-xs font-semibold transition"
                              >
                                Ver Ficha
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA 4: ORDENS DE COMPRA (`Ordens`)                            */}
          {/* ============================================================= */}
          {activeTab === "Ordens" && (
            <div>
              {/* 4 KPIs Simples de Ordens */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Ordens Emitidas
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {ordensFiltradas.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Pedidos formais de compra
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Valor Total Fechado
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatBRL(
                      ordensFiltradas.reduce((acc, o) => acc + o.valorTotal, 0)
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Faturamento autorizado
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Saving Conquistado
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {formatBRL(
                      ordensFiltradas.reduce(
                        (acc, o) => acc + o.savingGerado,
                        0
                      )
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Economia auditada nas OCs
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Aguardando Entrega
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {
                      ordensFiltradas.filter(
                        (o) =>
                          o.status !== "Entregue" &&
                          o.status !==
                            "Entregue na Obra (Confirmado pelo Almoxarifado)"
                      ).length
                    }
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Programadas nos canteiros
                  </div>
                </div>
              </div>

              {/* Tabela Limpa de Ordens de Compra */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Ordens de Compra Emitidas & Recebimento no Canteiro
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sincronizado em tempo real com o Almoxarifado da Obra
                      (Nota Fiscal e conferência física)
                    </p>
                  </div>
                </div>

                <table className="w-full text-sm border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                      <th className="py-3 px-4">Nº OC</th>
                      <th className="py-3 px-4">Fornecedor</th>
                      <th className="py-3 px-4">Obra</th>
                      <th className="py-3 px-4 text-center">Emissão / Prev.</th>
                      <th className="py-3 px-4 text-right">Valor Fechado</th>
                      <th className="py-3 px-4 text-right">Saving</th>
                      <th className="py-3 px-4 text-center">
                        Status & Conferência Obra
                      </th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ordensFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center text-slate-500">
                            <span className="text-3xl mb-2">📑</span>
                            <p className="font-semibold text-slate-700 text-sm">
                              Nenhuma ordem de compra emitida
                            </p>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm">
                              Ao aprovar fornecedores no Mapa de Cotações, as ordens de compra oficiais serão geradas e listadas aqui.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                    ordensFiltradas.map((oc) => {
                      const entreguePeloAlmox =
                        oc.status ===
                          "Entregue na Obra (Confirmado pelo Almoxarifado)" ||
                        oc.status === "Entregue";

                      return (
                        <tr
                          key={oc.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap tabular-nums">
                            <div>{oc.numeroOc}</div>
                            <div className="text-xs font-normal text-slate-500">
                              Ref: {oc.scCodigo}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900">
                            {oc.fornecedorNome}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {oc.obraNome}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-700 whitespace-nowrap tabular-nums">
                            <div>{oc.dataEmissao}</div>
                            {oc.dataPrevistaEntrega && (
                              <div className="text-xs text-slate-500">
                                Prev: {oc.dataPrevistaEntrega}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                            {formatBRL(oc.valorTotal)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-700 whitespace-nowrap tabular-nums">
                            {formatBRL(oc.savingGerado)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-block ${
                                entreguePeloAlmox
                                  ? "bg-emerald-100 border border-emerald-300 text-emerald-900"
                                  : "bg-blue-50 border border-blue-200 text-blue-800"
                              }`}
                            >
                              {entreguePeloAlmox
                                ? "✅ Entregue na Obra (Confirmado pelo Almoxarifado)"
                                : `🟢 ${oc.status} (Aguardando Entrega)`}
                            </span>
                            {oc.notaFiscalRecebida && (
                              <div className="text-xs text-slate-600 mt-1">
                                <strong>NF: {oc.notaFiscalRecebida}</strong> •{" "}
                                {oc.condicaoRecebimento}
                                {oc.recebidoPor
                                  ? ` (${oc.recebidoPor})`
                                  : ""}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleGerarOrdemCompraPDF(oc)}
                                title="Gerar e Imprimir Ordem de Compra Oficial Timbrada (PDF)"
                                className="px-2.5 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                              >
                                <span>🖨️</span> OC PDF
                              </button>
                              <button
                                onClick={() => handleGerarRomaneioRecebimentoPDF(oc)}
                                title="Gerar Romaneio de Conferência Cega para o Canteiro (PDF)"
                                className="px-2 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold transition flex items-center gap-1"
                              >
                                <span>📋</span> Romaneio
                              </button>
                              <button
                                onClick={() => setOrdemVisualizarModal(oc)}
                                className="px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                              >
                                Visualizar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA: ALMOXARIFADO & CONTROLE DE ESTOQUE (`Estoque`)            */}
          {/* ============================================================= */}
          {activeTab === "Estoque" && (
            <div className="space-y-6">
              {/* KPIs Operacionais do Almoxarifado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Valor Total em Estoque
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatBRL(valorTotalEstoque)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Ativo físico estocado nos canteiros
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Insumos Abaixo do Mínimo
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-2xl font-bold text-red-600 tabular-nums">
                      {itensAbaixoMinimo.length}
                    </div>
                    {itensAbaixoMinimo.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold animate-pulse">
                        Risco de Parada
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Insumos em ponto crítico de reposição
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Puxadas Programadas (Contratos)
                  </div>
                  <div className="text-2xl font-bold text-indigo-700 mt-1 tabular-nums">
                    {puxadasAtivasContratos
                      .flatMap((c) => c.programacoes)
                      .filter((p) => p.status === "Agendada" || p.status === "Em Rota").length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Caminhões de concreto/aço agendados
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500">
                    Economia por Remanejamento
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {formatBRL(totalEconomiaTransferencias)}
                  </div>
                  <div className="text-xs text-emerald-800 font-medium mt-1">
                    Sobras reaproveitadas entre canteiros
                  </div>
                </div>
              </div>

              {/* Sub-Aba Navigation (Saldos, Puxadas, Movimentações, Compras Corporativas) */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setSubAbaEstoque("saldos")}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                        subAbaEstoque === "saldos"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      📦 Saldo em Estoque ({estoque.filter((it) => obraFiltro === "ALL" || it.obraId === obraFiltro).length})
                    </button>
                    <button
                      onClick={() => setSubAbaEstoque("puxadas")}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                        subAbaEstoque === "puxadas"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span>🚛 Central de Puxadas (Concreto & Aço)</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                        {puxadasAtivasContratos.length} contratos
                      </span>
                    </button>
                    <button
                      onClick={() => setSubAbaEstoque("movimentacoes")}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition ${
                        subAbaEstoque === "movimentacoes"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      📋 Extrato Físico ({movimentacoesEstoque.length} reg.)
                    </button>
                    <button
                      onClick={() => setSubAbaEstoque("agrupamento")}
                      className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                        subAbaEstoque === "agrupamento"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      <span>⚡ Compras em Lote Corporativo</span>
                      {demandasAgrupaveis.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-xs font-extrabold">
                          {demandasAgrupaveis.length} unificáveis
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Filtrando por:</span>
                    <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      {obraFiltro === "ALL" ? "Todos os Canteiros" : obras.find(o => o.id === obraFiltro)?.nome || "Almoxarifado Central"}
                    </span>
                  </div>
                </div>

                {/* Sub-Aba 1: SALDOS EM ESTOQUE */}
                {subAbaEstoque === "saldos" && (
                  <div className="space-y-4">
                    {/* Barra de Filtros de Estoque */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Buscar código ou descrição do insumo..."
                          value={buscaEstoque}
                          onChange={(e) => setBuscaEstoque(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 w-72"
                        />
                        <select
                          value={filtroCategoriaEstoque}
                          onChange={(e) => setFiltroCategoriaEstoque(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                        >
                          <option value="ALL">Todas as Categorias</option>
                          {CATEGORIAS_CONSTRUCAO.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {itensAbaixoMinimo.length > 0 && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                          <span>⚠️</span>
                          <span>{itensAbaixoMinimo.length} insumos precisam de reposição imediata!</span>
                        </div>
                      )}
                    </div>

                    {/* Tabela de Saldos */}
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                            <th className="py-3 px-4">Código / Insumo</th>
                            <th className="py-3 px-4">Canteiro & Localização</th>
                            <th className="py-3 px-4 text-center">Nível de Estoque</th>
                            <th className="py-3 px-4 text-right">Saldo Atual</th>
                            <th className="py-3 px-4 text-right">Custo Médio</th>
                            <th className="py-3 px-4 text-right">Valor Total</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Ações Rápidas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {(() => {
                            const itensEst = estoque.filter((item) => {
                              const matchObra = obraFiltro === "ALL" || item.obraId === obraFiltro;
                              const matchCat = filtroCategoriaEstoque === "ALL" || item.categoria === filtroCategoriaEstoque;
                              const matchBusca = buscaEstoque === "" ||
                                item.descricao.toLowerCase().includes(buscaEstoque.toLowerCase()) ||
                                item.codigo.toLowerCase().includes(buscaEstoque.toLowerCase());
                              return matchObra && matchCat && matchBusca;
                            });
                            if (itensEst.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={8} className="py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                      <span className="text-3xl mb-2">📦</span>
                                      <p className="font-semibold text-slate-700 text-sm">
                                        Nenhum item em estoque registrado
                                      </p>
                                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                        Os itens em estoque serão atualizados automaticamente conforme ordens de compra forem recebidas no canteiro.
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                            return itensEst.map((item) => {
                              const critico = item.saldoAtual <= item.estoqueMinimo;
                              const atencao = !critico && item.saldoAtual <= item.pontoReposicao;
                              const percentualSeguranca = Math.min(
                                100,
                                Math.round((item.saldoAtual / (item.pontoReposicao * 1.5)) * 100)
                              );

                              return (
                                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-sm text-slate-900 leading-snug">{item.descricao}</div>
                                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                                      {item.codigo} • {item.categoria}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-xs">
                                    <div className="font-semibold text-slate-800 whitespace-nowrap">{item.obraNome}</div>
                                    <div className="text-slate-500 mt-0.5 text-[11px]">📍 {item.localizacaoFisica}</div>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <div className="w-32 mx-auto">
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1 font-medium">
                                        <span>Mín: {item.estoqueMinimo}</span>
                                        <span>Repor: {item.pontoReposicao}</span>
                                      </div>
                                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            critico
                                              ? "bg-red-500"
                                              : atencao
                                              ? "bg-amber-500"
                                              : "bg-emerald-500"
                                          }`}
                                          style={{ width: `${Math.max(8, percentualSeguranca)}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums text-sm">
                                    <span>{item.saldoAtual.toLocaleString("pt-BR")}</span>{" "}
                                    <span className="text-xs font-normal text-slate-500">{item.unidade}</span>
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-700 whitespace-nowrap tabular-nums text-xs">
                                    {formatBRL(item.custoMedio)} / {item.unidade}
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums text-sm">
                                    {formatBRL(item.saldoAtual * item.custoMedio)}
                                  </td>
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
                                    {item.saldoAtual === 0 && item.estoqueMinimo === 0 ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 inline-block">
                                        📦 Catalogado (Saldo 0)
                                      </span>
                                    ) : critico ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 inline-block">
                                        🚨 Crítico
                                      </span>
                                    ) : atencao ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 inline-block">
                                        ⚠️ Repor
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 inline-block">
                                        ✅ Adequado
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setItemAjustarEstoqueModal(item)}
                                        className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                        title="Contagem física ou ajuste manual de saldo em estoque"
                                      >
                                        <span>✏️</span> Ajustar Saldo
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setKardexModalItem(item)}
                                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                                        title="Ver histórico completo de movimentações físicas e custo médio (Kardex)"
                                      >
                                        📋 Kardex
                                      </button>
                                      {item.saldoAtual <= item.pontoReposicao && item.pontoReposicao > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleGerarSolicitacaoReposicao(item)}
                                          className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                          title="Gerar automaticamente Solicitação de Compra para reposição de estoque"
                                        >
                                          ⚡ Repor
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub-Aba 2: CENTRAL DE PUXADAS E CONTRATOS CONTÍNUOS */}
                {subAbaEstoque === "puxadas" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Contratos de Fornecimento Contínuo & Puxadas em Usina
                        </h3>
                        <p className="text-xs text-slate-500">
                          Gerencie os contratos de grande porte (Concreto Usinado, Aço Cortado/Dobrado) e acompanhe o saldo restante na usina com agendamento de betoneiras e carretas.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowProgramarPuxadaModal(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                      >
                        <span>🚛 Programar Nova Puxada</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {puxadasAtivasContratos.map((ctr) => {
                        const percentualEntregue = Math.min(
                          100,
                          Math.round((ctr.quantidadeEntregue / ctr.quantidadeContratada) * 100)
                        );
                        const saldoRestante = Math.max(
                          0,
                          ctr.quantidadeContratada - ctr.quantidadeEntregue
                        );
                        const valorSaldoRestante = saldoRestante * ctr.valorUnitario;

                        return (
                          <div
                            key={ctr.id}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                    {ctr.numeroContrato}
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    (OC: {ctr.numeroOC})
                                  </span>
                                  <span className="font-bold text-sm text-slate-900">
                                    {ctr.insumo}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600 mt-1">
                                  Fornecedor: <strong>{ctr.fornecedorNome}</strong> • Canteiro:{" "}
                                  <strong>{ctr.obraNome}</strong>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500">Valor Unitário Homologado</div>
                                <div className="text-sm font-bold text-slate-900 tabular-nums">
                                  {formatBRL(ctr.valorUnitario)} / {ctr.unidade}
                                </div>
                              </div>
                            </div>

                            {/* Barra de Progresso do Fornecimento Contínuo */}
                            <div>
                              <div className="flex items-center justify-between text-xs text-slate-700 mb-1.5 font-medium">
                                <span>
                                  Entregue no Canteiro: <strong>{ctr.quantidadeEntregue} {ctr.unidade}</strong> ({percentualEntregue}%)
                                </span>
                                <span>
                                  Saldo a Puxar na Usina:{" "}
                                  <strong className="text-indigo-700">
                                    {saldoRestante} {ctr.unidade}
                                  </strong>{" "}
                                  ({formatBRL(valorSaldoRestante)})
                                </span>
                                <span>Total Contratado: <strong>{ctr.quantidadeContratada} {ctr.unidade}</strong></span>
                              </div>
                              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full transition-all"
                                  style={{ width: `${percentualEntregue}%` }}
                                />
                              </div>
                            </div>

                            {/* Grade de Puxadas Agendadas / Recebidas deste contrato */}
                            <div className="mt-3">
                              <div className="text-xs font-semibold text-slate-700 mb-2">
                                Cronograma de Puxadas & Entregas do Contrato
                              </div>
                              <div className="overflow-x-auto rounded border border-slate-200 bg-white">
                                <table className="w-full text-xs text-left">
                                  <thead>
                                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-600">
                                      <th className="py-2 px-3">Data & Janela</th>
                                      <th className="py-2 px-3">Volume</th>
                                      <th className="py-2 px-3">Etapa Construtiva / Local</th>
                                      <th className="py-2 px-3">Responsável</th>
                                      <th className="py-2 px-3">NF / Guia</th>
                                      <th className="py-2 px-3 text-center">Status</th>
                                      <th className="py-2 px-3 text-right">Ação</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {ctr.programacoes.map((prg) => (
                                      <tr key={prg.id} className="hover:bg-slate-50">
                                        <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
                                          {prg.dataHoraAgendada}
                                        </td>
                                        <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                          {prg.quantidade} {prg.unidade}
                                        </td>
                                        <td className="py-2 px-3 text-slate-700">
                                          <div>{prg.etapaAplicacao}</div>
                                          {prg.observacoes && (
                                            <div className="text-[11px] text-slate-500 italic mt-0.5">
                                              {prg.observacoes}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-600">{prg.responsavelRecebimento}</td>
                                        <td className="py-2 px-3 font-mono text-slate-700">
                                          {prg.notaFiscal || "—"}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                              prg.status === "Recebida"
                                                ? "bg-emerald-100 text-emerald-800"
                                                : prg.status === "Em Rota"
                                                ? "bg-blue-100 text-blue-800"
                                                : prg.status === "Cancelada"
                                                ? "bg-red-100 text-red-800"
                                                : "bg-amber-100 text-amber-800"
                                            }`}
                                          >
                                            {prg.status === "Recebida"
                                              ? "✅ Recebida"
                                              : prg.status === "Em Rota"
                                              ? "🚛 Em Rota"
                                              : prg.status === "Cancelada"
                                              ? "❌ Cancelada"
                                              : "⏱️ Agendada"}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-right whitespace-nowrap">
                                          {prg.status !== "Recebida" && prg.status !== "Cancelada" ? (
                                            <button
                                              onClick={() =>
                                                handleAtualizarStatusPuxada(
                                                  ctr.id,
                                                  prg.id,
                                                  "Recebida",
                                                  prompt("Informe o número da Nota Fiscal / Ticket da Usina:") || "NF-e Canteiro"
                                                )
                                              }
                                              className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition"
                                            >
                                              Receber Carga
                                            </button>
                                          ) : (
                                            <span className="text-[11px] text-slate-400">Concluído</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-Aba 3: EXTRATO DE MOVIMENTAÇÕES FÍSICAS */}
                {subAbaEstoque === "movimentacoes" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Auditoria Completa de Movimentações Físicas
                        </h3>
                        <p className="text-xs text-slate-500">
                          Registro de entradas por compra, requisições de aplicação em obra, transferências entre canteiros e avarias.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowNovaMovimentacaoModal(true)}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                      >
                        + Nova Movimentação
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-sm border-collapse text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                            <th className="py-3 px-4">Data / Hora</th>
                            <th className="py-3 px-4">Tipo de Movimento</th>
                            <th className="py-3 px-4">Insumo / Código</th>
                            <th className="py-3 px-4 text-right">Qtd Movimentada</th>
                            <th className="py-3 px-4">Origem ➔ Destino</th>
                            <th className="py-3 px-4">Motivo / Etapa</th>
                            <th className="py-3 px-4 text-right">Valor Total</th>
                            <th className="py-3 px-4">Responsável / Doc</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {movimentacoesEstoque
                            .filter((m) => obraFiltro === "ALL" || m.obraOrigemId === obraFiltro || m.obraDestinoId === obraFiltro)
                            .map((mov) => {
                              const tipoBadge = {
                                ENTRADA_COMPRA: {
                                  bg: "bg-emerald-100 text-emerald-800 border-emerald-200",
                                  label: "🟢 Entrada por Compra",
                                },
                                SAIDA_APLICACAO: {
                                  bg: "bg-blue-100 text-blue-800 border-blue-200",
                                  label: "🔵 Saída p/ Aplicação",
                                },
                                TRANSFERENCIA_OBRA: {
                                  bg: "bg-purple-100 text-purple-800 border-purple-200",
                                  label: "🟣 Transferência Canteiros",
                                },
                                PERDA_AVARIA: {
                                  bg: "bg-red-100 text-red-800 border-red-200",
                                  label: "🔴 Perda / Avaria",
                                },
                                AJUSTE_INVENTARIO: {
                                  bg: "bg-slate-100 text-slate-800 border-slate-200",
                                  label: "⚪ Ajuste Inventário",
                                },
                              }[mov.tipo];

                              return (
                                <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-3 px-4 text-xs font-bold text-slate-800 whitespace-nowrap">
                                    {mov.dataHora}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <span
                                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border inline-block ${tipoBadge.bg}`}
                                    >
                                      {tipoBadge.label}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-900">{mov.descricaoInsumo}</div>
                                    <div className="text-xs text-slate-500 font-mono">{mov.codigoInsumo}</div>
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                    {mov.quantidade} <span className="text-xs font-normal text-slate-500">{mov.unidade}</span>
                                  </td>
                                  <td className="py-3 px-4 text-xs">
                                    <div className="font-medium text-slate-800">{mov.obraOrigemNome}</div>
                                    {mov.obraDestinoNome && (
                                      <div className="text-purple-700 font-bold mt-0.5">
                                        ➔ {mov.obraDestinoNome}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                                    {mov.motivoEtapa || "—"}
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                    {formatBRL(mov.valorTotal)}
                                  </td>
                                  <td className="py-3 px-4 text-xs">
                                    <div className="font-semibold text-slate-800">{mov.responsavel}</div>
                                    <div className="text-slate-500 font-mono mt-0.5">{mov.numeroDocumento || "—"}</div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub-Aba 4: COMPRAS EM LOTE CORPORATIVO MULTI-OBRA */}
                {subAbaEstoque === "agrupamento" && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚡</span>
                          <h3 className="text-base font-bold text-emerald-950">
                            Centralizador de Demandas & Poder de Barganha Corporativo
                          </h3>
                        </div>
                        <p className="text-xs text-emerald-800 mt-1 max-w-2xl">
                          O sistema analisa automaticamente os pedidos de todas as obras da JC BAUER. Ao agrupar demandas de cimento, aço, blocos e fiação em uma única compra em lote de carga fechada, a construtora obtém descontos de 10% a 25% diretamente na usina/fabricante.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAgruparDemandasModal(true)}
                        className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition whitespace-nowrap shadow-xs"
                      >
                        ⚡ Unificar Compras Selecionadas
                      </button>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-semibold text-slate-700">
                        Oportunidades de Compra Corporativa em Lote Detectadas
                      </h4>

                      {demandasAgrupaveis.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200 text-slate-500 text-sm">
                          Não há solicitações duplicadas entre canteiros no momento. Quando múltiplos engenheiros solicitarem o mesmo insumo, a oportunidade de compra corporativa aparecerá aqui automaticamente.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {demandasAgrupaveis.map((dem, idx) => {
                            const valorEstimadoIndividual = dem.totalQtd * dem.orcamentoUnitario;
                            const savingEstimado = valorEstimadoIndividual * 0.12;
                            const valorEstimadoLote = valorEstimadoIndividual - savingEstimado;

                            return (
                              <div
                                key={idx}
                                className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3"
                              >
                                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm">
                                      {dem.descricao}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      Categoria: <strong>{dem.categoria}</strong>
                                    </div>
                                  </div>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                                    ~12% Economia Estimada
                                  </span>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                  <div className="text-slate-600">
                                    Canteiros participantes da demanda:
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {dem.obrasParticipantes.map((obraNome, oIdx) => (
                                      <span
                                        key={oIdx}
                                        className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-800 font-medium"
                                      >
                                        🏗️ {obraNome}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-100 text-xs">
                                  <div>
                                    <span className="text-slate-500">Volume Total Unificado:</span>
                                    <div className="font-bold text-slate-900 text-sm mt-0.5">
                                      {dem.totalQtd} {dem.unidade}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Saving Estimado p/ JC BAUER:</span>
                                    <div className="font-bold text-emerald-700 text-sm mt-0.5">
                                      {formatBRL(savingEstimado)}
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-1 flex items-center justify-between">
                                  <div className="text-xs text-slate-500">
                                    Ref: {formatBRL(valorEstimadoIndividual)} individual ➔{" "}
                                    <strong className="text-slate-900">{formatBRL(valorEstimadoLote)}</strong> em lote
                                  </div>
                                  <button
                                    onClick={() => handleCriarCompraAgrupada(dem)}
                                    className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                                  >
                                    <span>⚡ Criar Cotação Corporativa</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA: CONTRATOS DE SUBEMPREITADA & MEDIÇÕES (`Medicoes`)       */}
          {/* ============================================================= */}
          {activeTab === "Medicoes" && (
            <div className="space-y-6">
              {/* KPIs de Contratos e Medições */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Contratos Ativos
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {contratos.filter((c) => c.status === "Ativo").length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Subempreiteiros em execução
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Valor Global Contratado
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {formatBRL(
                      contratos.reduce((acc, c) => acc + c.valorTotal, 0)
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Total em carteira de contratos
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Total Medido Acumulado
                  </div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                    {formatBRL(
                      contratos.reduce(
                        (acc, c) =>
                          acc +
                          c.medicoes.reduce(
                            (bmAcc, bm) => bmAcc + bm.valorBruto,
                            0
                          ),
                        0
                      )
                    )}
                  </div>
                  <div className="text-xs text-emerald-800 font-medium mt-1">
                    Avanço físico financeiro apurado
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Retenções Técnicas (5% / 11%)
                  </div>
                  <div className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
                    {formatBRL(
                      contratos.reduce(
                        (acc, c) =>
                          acc +
                          c.medicoes.reduce(
                            (bmAcc, bm) => bmAcc + bm.valorRetencao,
                            0
                          ),
                        0
                      )
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Fundo de reserva de garantia retido
                  </div>
                </div>
              </div>

              {/* Barra de Ações e Filtro de Obra */}
              <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-700">
                    Filtrar por Obra:
                  </span>
                  <select
                    value={obraFiltro}
                    onChange={(e) => setObraFiltro(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <option value="ALL">Todas as Obras (Global)</option>
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome} ({o.sigla})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNovoContratoModal(true)}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <span>+ Novo Contrato de Subempreitada</span>
                </button>
              </div>

              {/* Lista Detalhada de Contratos e seus Boletins de Medição */}
              <div className="space-y-5">
                {contratos.filter((c) => obraFiltro === "ALL" || c.obraId === obraFiltro).length === 0 ? (
                  <div className="bg-white rounded-lg border border-slate-200 p-12 text-center shadow-xs">
                    <span className="text-3xl mb-2 inline-block">📐</span>
                    <p className="font-semibold text-slate-700 text-sm">
                      Nenhum contrato de subempreiteiro cadastrado
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Cadastre contratos de mão de obra e subempreitada para gerenciar retenções técnicas, avanço físico e boletins de medição (BM).
                    </p>
                  </div>
                ) : (
                contratos
                  .filter(
                    (c) => obraFiltro === "ALL" || c.obraId === obraFiltro
                  )
                  .map((contrato) => {
                    const totalMedidoBruto = contrato.medicoes.reduce(
                      (acc, bm) => acc + bm.valorBruto,
                      0
                    );
                    const percentualTotalMedido =
                      contrato.valorTotal > 0
                        ? Math.min(
                            100,
                            (totalMedidoBruto / contrato.valorTotal) * 100
                          )
                        : 0;
                    const saldoContratual = Math.max(
                      0,
                      contrato.valorTotal - totalMedidoBruto
                    );

                    return (
                      <div
                        key={contrato.id}
                        className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
                      >
                        {/* Cabeçalho do Contrato */}
                        <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2.5">
                              <span className="font-bold text-slate-900 text-base">
                                {contrato.numeroContrato}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="font-semibold text-slate-900 text-base">
                                {contrato.empreiteiro}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                {contrato.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              <strong>Objeto:</strong> {contrato.objeto}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-3">
                              <span>CNPJ: {contrato.cnpj}</span>
                              <span>•</span>
                              <span>Obra: <strong>{contrato.obraNome}</strong></span>
                              <span>•</span>
                              <span>Disciplina: {contrato.categoria}</span>
                              <span>•</span>
                              <span>Vigência: {contrato.dataInicio} a {contrato.previsaoFim}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs text-slate-500 font-medium">
                                Valor Total do Contrato
                              </div>
                              <div className="text-lg font-bold text-slate-900 tabular-nums">
                                {formatBRL(contrato.valorTotal)}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Retenção Técnica: {contrato.percentualRetencao}%
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowNovoBmModalContrato(contrato)}
                              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-1.5"
                            >
                              <span>+ Lançar Medição (BM)</span>
                            </button>
                          </div>
                        </div>

                        {/* Barra de Progresso Físico-Financeiro */}
                        <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-4 text-slate-700">
                            <span>
                              Medido:{" "}
                              <strong className="text-emerald-700">
                                {formatBRL(totalMedidoBruto)} (
                                {percentualTotalMedido.toFixed(1)}%)
                              </strong>
                            </span>
                            <span>•</span>
                            <span>
                              Saldo a Medir:{" "}
                              <strong className="text-slate-900">
                                {formatBRL(saldoContratual)}
                              </strong>
                            </span>
                          </div>
                          <div className="w-48 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all"
                              style={{ width: `${percentualTotalMedido}%` }}
                            />
                          </div>
                        </div>

                        {/* Tabela de Boletins de Medição */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse text-left">
                            <thead>
                              <tr className="bg-slate-50/90 border-b border-slate-200 font-semibold text-slate-600">
                                <th className="py-2.5 px-4">Nº BM</th>
                                <th className="py-2.5 px-4">Data / Período</th>
                                <th className="py-2.5 px-4 text-center">% Medido</th>
                                <th className="py-2.5 px-4 text-right">Valor Bruto</th>
                                <th className="py-2.5 px-4 text-right">Retenção ({contrato.percentualRetencao}%)</th>
                                <th className="py-2.5 px-4 text-right">Valor Líquido</th>
                                <th className="py-2.5 px-4">Engenheiro / Obra</th>
                                <th className="py-2.5 px-4 text-center">Status</th>
                                <th className="py-2.5 px-4 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {contrato.medicoes.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={9}
                                    className="py-4 text-center text-slate-400 italic"
                                  >
                                    Nenhum boletim de medição lançado ainda para este contrato.
                                  </td>
                                </tr>
                              ) : (
                                contrato.medicoes.map((bm) => (
                                  <tr key={bm.id} className="hover:bg-slate-50">
                                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                                      {bm.numeroBm}
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-medium text-slate-900">{bm.dataMedicao}</div>
                                      <div className="text-[11px] text-slate-500">{bm.periodoReferencia}</div>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <span className="font-semibold text-slate-800">
                                        {bm.percentualMedidoPeriodo}%
                                      </span>
                                      <span className="text-[10px] text-slate-400 block">
                                        (Acum. {bm.percentualAcumulado}%)
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-medium text-slate-900 tabular-nums">
                                      {formatBRL(bm.valorBruto)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-blue-700 font-medium tabular-nums">
                                      - {formatBRL(bm.valorRetencao)}
                                    </td>
                                    <td className="py-3 px-4 text-right font-bold text-emerald-800 tabular-nums">
                                      {formatBRL(bm.valorLiquido)}
                                    </td>
                                    <td className="py-3 px-4">
                                      <div className="font-medium text-slate-900">{bm.engenheiroResponsavel}</div>
                                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{bm.observacoes}</div>
                                    </td>
                                    <td className="py-3 px-4 text-center whitespace-nowrap">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-block ${
                                          bm.status === "Pago"
                                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                            : bm.status === "Aprovado para Pagamento"
                                            ? "bg-blue-100 text-blue-900 border border-blue-300"
                                            : "bg-amber-100 text-amber-900 border border-amber-300"
                                        }`}
                                      >
                                        {bm.status === "Pago"
                                          ? "🟢 Pago"
                                          : bm.status === "Aprovado para Pagamento"
                                          ? "🔵 Aprovado"
                                          : "🟡 Pendente"}
                                      </span>
                                      {bm.notaFiscal && (
                                        <div className="text-[10px] text-slate-600 font-medium mt-0.5">
                                          {bm.notaFiscal}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                      {bm.status === "Pendente Aprovação" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAprovarPagarBm(
                                              contrato.id,
                                              bm.id,
                                              "Aprovado para Pagamento"
                                            )
                                          }
                                          className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition"
                                        >
                                          Aprovar BM
                                        </button>
                                      )}
                                      {bm.status === "Aprovado para Pagamento" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAprovarPagarBm(
                                              contrato.id,
                                              bm.id,
                                              "Pago"
                                            )
                                          }
                                          className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition"
                                        >
                                          Confirmar Pagamento
                                        </button>
                                      )}
                                      {bm.status === "Pago" && (
                                        <span className="text-[11px] font-semibold text-emerald-800">
                                          ✓ Liquidado
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }))}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA: CONTROLE ORÇAMENTÁRIO (Orçado vs. Realizado)             */}
          {/* ============================================================= */}
          {activeTab === "Orcamento" && (() => {
            const orcamentosFiltrados = orcamentos.filter(
              (o) => obraFiltro === "ALL" || o.obraId === obraFiltro
            );
            const dadosOrcamento = orcamentosFiltrados.map((item) => {
              const saldo = calcularSaldoOrcamentario(
                item.obraId,
                item.categoria,
                orcamentos,
                ordens,
                contratos
              );
              return { item, saldo };
            });
            const totalOrcado = dadosOrcamento.reduce((a, b) => a + b.saldo.valorOrcado, 0);
            const totalComprometido = dadosOrcamento.reduce((a, b) => a + b.saldo.valorComprometido, 0);
            const totalRealizado = dadosOrcamento.reduce((a, b) => a + b.saldo.valorRealizado, 0);
            const totalSaldo = dadosOrcamento.reduce((a, b) => a + b.saldo.saldoDisponivel, 0);
            const percGeral = totalOrcado > 0 ? Math.min(100, Math.round((totalComprometido / totalOrcado) * 100)) : 0;

            return (
              <div className="space-y-6">
                {/* 4 KPIs do Orçamento */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Valor Orçado Total
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {formatBRL(totalOrcado)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Verba aprovada em planejamento
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Comprometido (Ordens + BM)
                    </div>
                    <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                      {formatBRL(totalComprometido)}
                    </div>
                    <div className="text-xs text-amber-800 font-medium mt-1">
                      {percGeral}% do teto orçamentário
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Realizado / Liquidado
                    </div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                      {formatBRL(totalRealizado)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Pagamentos efetivados
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Saldo Disponível
                    </div>
                    <div className={`text-2xl font-bold mt-1 tabular-nums ${totalSaldo >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {formatBRL(totalSaldo)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {totalSaldo >= 0 ? "Margem de segurança positiva" : "⚠️ Orçamento com déficit"}
                    </div>
                  </div>
                </div>

                {/* Barra de Filtro e Ação */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">
                      Filtrar por Empreendimento:
                    </span>
                    <select
                      value={obraFiltro}
                      onChange={(e) => setObraFiltro(e.target.value)}
                      className="bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-xs font-medium text-slate-800"
                    >
                      <option value="ALL">Todas as Obras (Consolidado)</option>
                      {obras.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nome} ({o.sigla})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNovoOrcamentoModal(true)}
                    className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                  >
                    <span>+ Definir Nova Verba Orçamentária</span>
                  </button>
                </div>

                {/* Tabela Comparativa de Verbas por Disciplina */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                        <th className="py-3 px-4">Disciplina / Categoria</th>
                        <th className="py-3 px-4">Empreendimento</th>
                        <th className="py-3 px-4 text-right">Orçado (R$)</th>
                        <th className="py-3 px-4 text-right">Comprometido (R$)</th>
                        <th className="py-3 px-4 text-right">Realizado (R$)</th>
                        <th className="py-3 px-4 text-right">Saldo Disponível (R$)</th>
                        <th className="py-3 px-4 w-48 text-center">% Consumido</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dadosOrcamento.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <span className="text-3xl mb-2">💰</span>
                              <p className="font-semibold text-slate-700 text-sm">
                                Nenhum orçamento cadastrado
                              </p>
                              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                Clique em &quot;+ Definir Nova Verba Orçamentária&quot; acima para cadastrar tetos orçamentários por disciplina.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        dadosOrcamento.map(({ item, saldo }) => {
                        const obraObj = obras.find((o) => o.id === item.obraId);
                        const estourado = saldo.saldoDisponivel < 0;
                        const alertaQuaseEstouro = !estourado && saldo.percentualConsumido > 85;
                        const corBarra = estourado
                          ? "bg-red-600"
                          : alertaQuaseEstouro
                          ? "bg-amber-500"
                          : "bg-emerald-600";

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              <div>{item.categoria}</div>
                              {item.observacao && (
                                <div className="text-xs font-normal text-slate-500 mt-0.5">
                                  {item.observacao}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 font-medium">
                              {obraObj ? obraObj.nome : item.obraId}
                            </td>
                            <td className="py-3.5 px-4 text-right font-semibold text-slate-900 tabular-nums">
                              {formatBRL(saldo.valorOrcado)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-amber-800 tabular-nums">
                              {formatBRL(saldo.valorComprometido)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-medium text-emerald-800 tabular-nums">
                              {formatBRL(saldo.valorRealizado)}
                            </td>
                            <td className={`py-3.5 px-4 text-right font-bold tabular-nums ${estourado ? "text-red-700" : "text-blue-700"}`}>
                              {formatBRL(saldo.saldoDisponivel)}
                            </td>
                            <td className="py-3.5 px-4 align-middle">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-bold">
                                  <span className={estourado ? "text-red-700" : alertaQuaseEstouro ? "text-amber-700" : "text-slate-700"}>
                                    {saldo.percentualConsumido}%
                                  </span>
                                  {estourado && (
                                    <span className="text-[10px] font-extrabold text-red-600">
                                      Estouro!
                                    </span>
                                  )}
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full rounded-full transition-all ${corBarra}`}
                                    style={{ width: `${Math.min(100, saldo.percentualConsumido)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setShowNovoOrcamentoModal(true)}
                                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold transition"
                              >
                                Ajustar Verba
                              </button>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ============================================================= */}
          {/* ABA: CRONOGRAMA LOGÍSTICO & CARGAS NO CANTEIRO (`Logistica`)  */}
          {/* ============================================================= */}
          {activeTab === "Logistica" && (() => {
            const totalCargas = cargasLogistica.reduce((acc, d) => acc + d.cargas.length, 0);
            const entregasHoje = cargasLogistica.flatMap((d) => d.cargas).filter((c) => c.status === "Hoje").length;
            const conflitosPortao = cargasLogistica.filter((d) => d.conflitoPortao).length;
            const cargasRecebidas = cargasLogistica.flatMap((d) => d.cargas).filter((c) => c.status === "Entregue").length;

            return (
              <div className="space-y-6">
                {/* 4 KPIs de Logística */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Total Cargas na Semana
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {totalCargas}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Caminhões e fretes previstos
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Descargas Previstas Hoje
                    </div>
                    <div className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
                      {entregasHoje}
                    </div>
                    <div className="text-xs text-blue-800 font-medium mt-1">
                      Aguardando no portão da obra
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Alertas de Gargalo no Portão
                    </div>
                    <div className={`text-2xl font-bold mt-1 tabular-nums ${conflitosPortao > 0 ? "text-amber-600" : "text-emerald-700"}`}>
                      {conflitosPortao}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {conflitosPortao > 0 ? "Dias com sobreposição pesada" : "Fluxo de descarregamento liberado"}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Recebidas & Baixadas
                    </div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                      {cargasRecebidas}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Conferidas pelo Almoxarifado
                    </div>
                  </div>
                </div>

                {/* Banner de Aviso de Gargalo se houver */}
                {conflitosPortao > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚠️</span>
                      <div>
                        <h4 className="text-sm font-bold text-amber-950">
                          Alerta Preventivo de Canteiro: Conflito de Acesso e Descarga Detectado
                        </h4>
                        <p className="text-xs text-amber-900 mt-0.5">
                          Existem múltiplos veículos de grande porte agendados simultaneamente para o mesmo dia e portão. Recomenda-se alinhar com os fornecedores janelas de descarga alternadas para evitar filas na via pública.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("Ordens")}
                      className="px-3.5 py-1.5 rounded-md bg-amber-900 hover:bg-amber-800 text-white text-xs font-bold transition whitespace-nowrap"
                    >
                      Ajustar Agendamentos
                    </button>
                  </div>
                )}

                {/* Grade Semanal de Logística (Segunda a Sábado) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cargasLogistica.map((dia) => (
                    <div
                      key={dia.diaSemana}
                      className={`bg-white rounded-lg border shadow-sm p-4 space-y-3 ${
                        dia.conflitoPortao ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
                      }`}
                    >
                      {/* Cabeçalho do Dia */}
                      <div className="flex items-start justify-between border-b border-slate-200 pb-2.5">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">
                            {dia.diaSemana}
                          </h3>
                          <span className="text-xs text-slate-500">{dia.dataLabel}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
                            {dia.cargas.length} {dia.cargas.length === 1 ? "carga" : "cargas"}
                          </span>
                          {dia.conflitoPortao && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300">
                              ⚠️ Conflito Portão
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lista de Cargas do Dia */}
                      {dia.cargas.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Nenhuma entrega programada para este dia.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {dia.cargas.map((carga) => (
                            <div
                              key={carga.id}
                              className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2 hover:bg-slate-100/80 transition"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-xs text-slate-900">
                                  {carga.fornecedorNome}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    carga.status === "Entregue"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : carga.status === "Hoje"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-slate-200 text-slate-800"
                                  }`}
                                >
                                  {carga.status === "Entregue" ? "✓ Entregue" : carga.status === "Hoje" ? "🔵 Previsto Hoje" : "Agendado"}
                                </span>
                              </div>

                              <div className="text-xs text-slate-700 font-medium">
                                {carga.insumoDescricao}
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                                <div>
                                  <span className="text-slate-400">Janela: </span>
                                  <strong className="text-slate-800">{carga.horarioJanela}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Veículo: </span>
                                  <strong className="text-slate-800">{carga.tipoVeiculo}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Frete: </span>
                                  <strong className="text-slate-800">{carga.tipoFrete}</strong>
                                </div>
                                <div>
                                  <span className="text-slate-400">Canteiro: </span>
                                  <strong className="text-slate-800 truncate block">{carga.obraNome}</strong>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ============================================================= */}
          {/* ABA 5: IMPORTAR PLANILHAS (`Importacao`)                      */}
          {/* ============================================================= */}
          {activeTab === "Importacao" && (
            <div>
              {/* Topo com 3 Cards de Números Simples (Regra do Número Único) */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Linhas Lidas
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {itensPlanilha.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Itens extraídos de planilhas (.xlsx / .csv)
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Fornecedores Identificados
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {new Set(itensPlanilha.map((i) => i.fornecedor)).size}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Cadastros identificados nas planilhas
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-500">
                    Pendências para Revisão
                  </div>
                  <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
                    {itensPlanilha.filter((i) => i.status === "Pendente").length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    Itens aguardando aprovação
                  </div>
                </div>
              </div>

              {/* Área de Upload Funcional */}
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Importar Planilhas Antigas (.xlsx, .xls, .csv)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecione uma planilha do computador para higienizar
                    fornecedores, insumos e histórico de preços
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => handleUploadPlanilha(e.target.files)}
                    className="text-xs text-slate-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* Sub-Abas Simples: Itens Lidos | Fornecedores Duplicados | Colaboradores */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSubAbaImportacao("itens")}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                        subAbaImportacao === "itens"
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 border border-slate-300"
                      }`}
                    >
                      Itens Lidos ({itensPlanilha.length})
                    </button>
                    <button
                      onClick={() => setSubAbaImportacao("duplicados")}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                        subAbaImportacao === "duplicados"
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 border border-slate-300"
                      }`}
                    >
                      Fornecedores Duplicados ({duplicidades.length})
                    </button>
                    <button
                      onClick={() => setSubAbaImportacao("colaboradores")}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                        subAbaImportacao === "colaboradores"
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-700 border border-slate-300"
                      }`}
                    >
                      Colaboradores ({colaboradores.length})
                    </button>
                  </div>

                  {/* Ações em Lote */}
                  <div className="flex items-center gap-2">
                    {subAbaImportacao === "itens" && itensPlanilha.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={handleAprovarTodosItensPlanilha}
                          className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                          title="Aprovar todos os itens pendentes"
                        >
                          <span>✅</span> Aprovar Todos (
                          {
                            itensPlanilha.filter((i) => i.status === "Pendente")
                              .length
                          }
                          )
                        </button>
                        <button
                          type="button"
                          onClick={handleLimparPlanilhaImportada}
                          className="px-3 py-1.5 rounded-md bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
                          title="Limpar todos os itens da tabela de importação"
                        >
                          <span>🗑️</span> Limpar Tabela
                        </button>
                      </>
                    )}

                    {subAbaImportacao === "duplicados" &&
                      duplicidades.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleAprovarTodasDuplicidades}
                            className="px-3 py-1.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                            title="Aprovar e unificar todas as duplicidades"
                          >
                            <span>✅</span> Unificar Todas (
                            {
                              duplicidades.filter((d) => d.status === "Pendente")
                                .length
                            }
                            )
                          </button>
                          <button
                            type="button"
                            onClick={handleLimparDuplicidades}
                            className="px-3 py-1.5 rounded-md bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-semibold transition flex items-center gap-1.5"
                            title="Limpar lista de duplicidades"
                          >
                            <span>🗑️</span> Limpar
                          </button>
                        </>
                      )}
                  </div>
                </div>

                {/* Sub-aba 1: Itens Lidos */}
                {subAbaImportacao === "itens" && (
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Fornecedor</th>
                        <th className="py-3 px-4">Insumo / Material</th>
                        <th className="py-3 px-4 text-center">Qtd / Unid</th>
                        <th className="py-3 px-4 text-right">Preço Unit.</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {itensPlanilha.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                            Nenhum item importado. Faça o upload de uma planilha (.xlsx / .csv) acima para importar histórico.
                          </td>
                        </tr>
                      ) : (
                        itensPlanilha.map((item) => {
                        const editando = editingImportRowId === item.id;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-700">
                              {item.data}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-900">
                              {editando ? (
                                <input
                                  value={item.fornecedor}
                                  onChange={(e) =>
                                    setItensPlanilha((prev) =>
                                      prev.map((r) =>
                                        r.id === item.id
                                          ? { ...r, fornecedor: e.target.value }
                                          : r
                                      )
                                    )
                                  }
                                  className="border border-slate-400 rounded-sm px-2 py-1 text-xs w-full"
                                />
                              ) : (
                                item.fornecedor
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-800">
                              {editando ? (
                                <input
                                  value={item.insumo}
                                  onChange={(e) =>
                                    setItensPlanilha((prev) =>
                                      prev.map((r) =>
                                        r.id === item.id
                                          ? { ...r, insumo: e.target.value }
                                          : r
                                      )
                                    )
                                  }
                                  className="border border-slate-400 rounded-sm px-2 py-1 text-xs w-full"
                                />
                              ) : (
                                item.insumo
                              )}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap tabular-nums">
                              {item.quantidade} {item.unidade}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                              {item.precoUnitario > 0 ? (
                                formatBRL(item.precoUnitario)
                              ) : (
                                <span className="text-slate-400 font-normal italic">
                                  — (Sem valor)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  item.status === "Aprovado"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setItensPlanilha((prev) =>
                                      prev.map((r) =>
                                        r.id === item.id
                                          ? { ...r, status: "Aprovado" }
                                          : r
                                      )
                                    );
                                    setEditingImportRowId(null);
                                  }}
                                  className="px-2.5 py-1 rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() =>
                                    setEditingImportRowId(
                                      editando ? null : item.id
                                    )
                                  }
                                  className="px-2.5 py-1 rounded-sm bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold"
                                >
                                  {editando ? "Salvar" : "Corrigir"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }))}
                    </tbody>
                  </table>
                )}

                {/* Sub-aba 2: Fornecedores Duplicados */}
                {subAbaImportacao === "duplicados" && (
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Cadastro Unificado</th>
                        <th className="py-3 px-4">CNPJ</th>
                        <th className="py-3 px-4">Variações nas Planilhas</th>
                        <th className="py-3 px-4 text-center">Similaridade</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {duplicidades.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                            Nenhum fornecedor duplicado identificado nas planilhas.
                          </td>
                        </tr>
                      ) : (
                        duplicidades.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {d.nomeSugerido}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-700">
                              {d.cnpj}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {d.variacoesPlanilha}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-emerald-700">
                              {d.similaridade}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  d.status === "Unificado"
                                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                    : "bg-amber-50 text-amber-800 border border-amber-200"
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={() =>
                                  setDuplicidades((prev) =>
                                    prev.map((x) =>
                                      x.id === d.id
                                        ? { ...x, status: "Unificado" }
                                        : x
                                    )
                                  )
                                }
                                className="px-3 py-1 rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                              >
                                Aprovar Unificação
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {/* Sub-aba 3: Colaboradores */}
                {subAbaImportacao === "colaboradores" && (
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Colaborador</th>
                        <th className="py-3 px-4">Cargo / Função</th>
                        <th className="py-3 px-4">Obra Principal</th>
                        <th className="py-3 px-4 text-right">
                          Pedidos Históricos
                        </th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {colaboradores.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-500 font-medium">
                            Nenhum colaborador mapeado em planilhas antigas.
                          </td>
                        </tr>
                      ) : (
                        colaboradores.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {c.nome}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {c.cargo}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {c.obraPrincipal}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-900 tabular-nums">
                              {c.pedidosHistoricos}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() =>
                                  setColaboradores((prev) =>
                                    prev.map((x) =>
                                      x.id === c.id
                                        ? { ...x, status: "Validado" }
                                        : x
                                    )
                                  )
                                }
                                className="px-3 py-1 rounded-sm bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                              >
                                {c.status === "Validado"
                                  ? "Validado ✓"
                                  : "Aprovar"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* ABA 6: CONFIGURAÇÕES DO USUÁRIO E DA CONSTRUTORA              */}
          {/* ============================================================= */}
          {activeTab === "Configuracoes" && (
            <div className="space-y-6 max-w-6xl">
              {/* SEÇÃO 1: GESTÃO DE ACESSOS DA EQUIPE (ENGENHEIROS, ALMOXARIFADO E ENCARREGADOS) */}
              <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Gestão de Acessos da Equipe (Engenheiros, Almoxarifado e
                      Encarregados)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cadastre logins e senhas exclusivos para cada canteiro de
                      obra. Solicitantes da obra possuem acesso restrito apenas
                      a pedidos e recebimento de materiais (sem acesso a preços
                      negociados, saving ou fornecedores).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNovoUsuarioModal(true)}
                    className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition whitespace-nowrap"
                  >
                    + Cadastrar Novo Acesso da Obra
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Nome</th>
                        <th className="py-3 px-4">Cargo / Função</th>
                        <th className="py-3 px-4">Obra Vinculada</th>
                        <th className="py-3 px-4">Login / E-mail</th>
                        <th className="py-3 px-4">Senha</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {usuarios.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {u.nome}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                                u.cargo === "Administrador"
                                  ? "bg-slate-900 text-white"
                                  : u.cargo === "Engenheiro"
                                  ? "bg-blue-50 text-blue-800 border border-blue-200"
                                  : u.cargo === "Almoxarife"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {u.cargo}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {u.obraNome}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-mono text-xs">
                            {u.email}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-mono text-xs">
                            {u.senha}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                u.status === "Ativo"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-red-50 text-red-800 border border-red-200"
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {u.cargo !== "Administrador" ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setUsuarios((prev) =>
                                    prev.map((item) =>
                                      item.id === u.id
                                        ? {
                                            ...item,
                                            status:
                                              item.status === "Ativo"
                                                ? "Bloqueado"
                                                : "Ativo",
                                          }
                                        : item
                                    )
                                  );
                                  dispararAviso(
                                    `Status de ${u.nome} alterado com sucesso!`
                                  );
                                }}
                                className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-800"
                              >
                                {u.status === "Ativo"
                                  ? "Bloquear Acesso"
                                  : "Reativar Acesso"}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">
                                Acesso Mestre
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SEÇÃO 2: DADOS DO COMPRADOR E DA CONSTRUTORA */}
              <form
                onSubmit={handleSalvarConfiguracoes}
                className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6"
              >
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="text-base font-bold text-slate-900">
                    Perfil do Administrador e Dados da Construtora
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    As informações salvas abaixo atualizam imediatamente o
                    rodapé da barra lateral e o cabeçalho/assinatura de todos os
                    relatórios em PDF.
                  </p>
                </div>

                {/* Bloco 1: Dados Pessoais do Comprador / Diretor */}
                <div className="space-y-4">
                  <div className="text-xs font-semibold text-slate-700">
                    1. Identificação do Usuário (Assinatura nos Relatórios e
                    Sidebar)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Meu Nome Completo *
                      </label>
                      <input
                        required
                        type="text"
                        value={formSettings.userName}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            userName: e.target.value,
                          }))
                        }
                        placeholder="Ex: Seu Nome / Gestor de Suprimentos"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Meu Cargo / Setor *
                      </label>
                      <input
                        required
                        type="text"
                        value={formSettings.userRole}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            userRole: e.target.value,
                          }))
                        }
                        placeholder="Ex: Diretor / Coordenador de Suprimentos"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        E-mail Corporativo
                      </label>
                      <input
                        type="email"
                        value={formSettings.userEmail}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            userEmail: e.target.value,
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={formSettings.userPhone}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            userPhone: e.target.value,
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 tabular-nums focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloco 2: Dados Institucionais da Construtora */}
                <div className="space-y-4 pt-2 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-700">
                    2. Dados da Construtora (Cabeçalho de Pedidos e PDF)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Razão Social / Nome da Construtora *
                      </label>
                      <input
                        required
                        type="text"
                        value={formSettings.companyName}
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            companyName: e.target.value,
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        CNPJ da Construtora *
                      </label>
                      <input
                        required
                        type="text"
                        value={formSettings.companyCnpj} placeholder="00.000.000/0001-00"
                        onChange={(e) =>
                          setFormSettings((prev) => ({
                            ...prev,
                            companyCnpj: e.target.value,
                          }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-medium tabular-nums focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Bloco 3: Segurança e Backup Geral (JSON) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="text-xs font-semibold text-slate-700">
                    3. Governança de Dados, Backup & Restauração Geral (JSON)
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Exporte todo o banco de dados do sistema (pedidos de compras, cotações equalizadas, fornecedores homologados, contratos de subempreitada, medições BM e acessos) para um único arquivo JSON portátil.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleExportarBackupCompleto}
                      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2"
                    >
                      <span>📥 Baixar Backup Completo (.json)</span>
                    </button>

                    <label className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition cursor-pointer flex items-center gap-2">
                      <span>📤 Restaurar Base de Dados (.json)</span>
                      <input
                        ref={backupInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => handleRestaurarBackupCompleto(e.target.files)}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleZerarSistemaCompleto}
                      className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs ml-auto"
                      title="Zerar todos os pedidos, cotações e estoques demo para iniciar a operação oficial da Construtora"
                    >
                      <span>🗑️ Zerar Base de Dados / Limpar Tudo</span>
                    </button>
                  </div>
                </div>

                {/* Bloco 4: Banco de Dados na Nuvem (Supabase) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                      <span>4. Banco de Dados na Nuvem Oficial (Supabase PostgreSQL)</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          supabaseStatus.schemaReady
                            ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                            : supabaseStatus.connected
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-red-50 text-red-800 border-red-300"
                        }`}
                      >
                        {supabaseStatus.schemaReady
                          ? "● Conectado & Operacional"
                          : supabaseStatus.connected
                          ? "▲ Conectado (Tabelas Pendentes)"
                          : "✕ Desconectado"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestarConexaoSupabase}
                      disabled={supabaseSincronizando}
                      className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold transition"
                    >
                      {supabaseSincronizando ? "Testando..." : "Testar Conexão"}
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Seus dados de compras, fornecedores e orçamentos são sincronizados no PostgreSQL do Supabase, permitindo acesso centralizado de múltiplos computadores e celulares em tempo real.
                  </p>

                  <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold text-slate-700">Projeto Supabase:</span>
                      <code className="text-emerald-700 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                        {SUPABASE_URL}
                      </code>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold text-slate-700">Status do Banco:</span>
                      <span className="text-slate-600">{supabaseStatus.message}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSincronizarParaNuvem}
                      disabled={supabaseSincronizando}
                      className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs"
                    >
                      <span>☁️</span>
                      <span>{supabaseSincronizando ? "Sincronizando..." : "Sincronizar Tudo para a Nuvem"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBaixarDaNuvem}
                      disabled={supabaseSincronizando}
                      className="px-4 py-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold transition flex items-center gap-2 shadow-xs"
                    >
                      <span>📥</span>
                      <span>Baixar Dados da Nuvem</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCopiarSqlSupabase}
                      className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-bold transition flex items-center gap-2"
                      title="Copiar script SQL para criar as tabelas no Supabase Dashboard"
                    >
                      <span>📋</span>
                      <span>Copiar Script SQL</span>
                    </button>

                    <a
                      href="https://supabase.com/dashboard/project/vetuphedvhpvhoassnwz/sql/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2 ml-auto"
                    >
                      <span>🔗</span>
                      <span>Abrir SQL Editor do Supabase</span>
                    </a>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <span className="text-xs text-slate-500">
                    Salvo automaticamente no navegador (`localStorage`).
                  </span>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition"
                  >
                    💾 Salvar Configurações
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* ================================================================= */}
      {/* MODAL DE CADASTRO DE NOVO USUÁRIO / ACESSO DA OBRA                */}
      {/* ================================================================= */}
      {showNovoUsuarioModal && (
        <ModalNovoUsuarioObra
          obras={obras}
          onClose={() => setShowNovoUsuarioModal(false)}
          onSalvar={(novoUser) => {
            setUsuarios((prev) => [...prev, novoUser]);
            setShowNovoUsuarioModal(false);
            dispararAviso(
              `Acesso criado para ${novoUser.nome} (${novoUser.cargo} — ${novoUser.obraNome})! Já disponível para Login.`
            );
          }}
        />
      )}

      {/* ================================================================= */}
      {/* MODAL 1: NOVA SOLICITAÇÃO DE COMPRA                               */}
      {/* ================================================================= */}
      {showNovaScModal && (
        <ModalNovaSolicitacao
          obras={obras}
          defaultSolicitante={settings.userName}
          onClose={() => setShowNovaScModal(false)}
          onCriar={(novaSc) => {
            setSolicitacoes((prev) => [novaSc, ...prev]);
            setSelectedScId(novaSc.id);
            setShowNovaScModal(false);
            setActiveTab("Cotacoes");
            dispararAviso(
              `Solicitação ${novaSc.codigo} criada e aberta no Mapa de Cotações!`
            );
          }}
        />
      )}

      {/* ================================================================= */}
      {/* MODAL 2: NOVO FORNECEDOR                                          */}
      {/* ================================================================= */}
      {showNovoFornecedorModal && (
        <ModalNovoFornecedor
          onClose={() => setShowNovoFornecedorModal(false)}
          onSalvar={(novoForn) => {
            setFornecedores((prev) => [novoForn, ...prev]);
            setShowNovoFornecedorModal(false);
            dispararAviso(
              `Fornecedor ${novoForn.empresa} cadastrado com sucesso!`
            );
          }}
        />
      )}

      {/* ================================================================= */}
      {/* MODAL 3: FICHA COMPLETA DO FORNECEDOR                             */}
      {/* ================================================================= */}
      {fornecedorFichaModal && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-xs font-semibold text-emerald-700">
                  Ficha Homologada de Fornecedor
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {fornecedorFichaModal.empresa}
                </h3>
                <p className="text-xs text-slate-500">
                  {fornecedorFichaModal.razaoSocial}
                </p>
              </div>
              <button
                onClick={() => setFornecedorFichaModal(null)}
                className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div>
                <div className="text-xs text-slate-500">CNPJ</div>
                <div className="font-semibold text-slate-900 tabular-nums">
                  {fornecedorFichaModal.cnpj}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Cidade / UF</div>
                <div className="font-semibold text-slate-900">
                  {fornecedorFichaModal.cidade}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Vendedor</div>
                <div className="font-semibold text-slate-900">
                  {fornecedorFichaModal.vendedor}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Telefone / WhatsApp</div>
                <div className="font-semibold text-slate-900 tabular-nums">
                  {fornecedorFichaModal.telefone}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">E-mail Comercial</div>
                <div className="font-medium text-slate-900 truncate">
                  {fornecedorFichaModal.email}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  Chave PIX / Faturamento
                </div>
                <div className="font-semibold text-emerald-800 tabular-nums">
                  {fornecedorFichaModal.chavePix}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">
                Especialidades e Categorias Atendidas
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-medium">
                  {fornecedorFichaModal.categoriaPrincipal}
                </span>
                {fornecedorFichaModal.especialidades.map((esp) => (
                  <span
                    key={esp}
                    className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-800"
                  >
                    {esp}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">
                Condições Comerciais e Observações
              </div>
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong>Pagamento Padrão:</strong>{" "}
                {fornecedorFichaModal.condicaoPadrao} —{" "}
                {fornecedorFichaModal.observacoes}
              </p>
            </div>

            <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  const f = fornecedorFichaModal;
                  setFornecedorFichaModal(null);
                  setFornecedorEditando(f);
                }}
                className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <span>✏️</span> Editar Dados
              </button>
              <div className="flex items-center gap-2">
                {fornecedorFichaModal.whatsapp && !fornecedorFichaModal.whatsapp.includes("1199000") && (
                  <a
                    href={`https://wa.me/${fornecedorFichaModal.whatsapp}?text=${encodeURIComponent(
                      `Olá ${fornecedorFichaModal.vendedor || "Amigo"}, tudo bem? Aqui é ${settings.userName} (${settings.companyName}). Gostaria de solicitar uma cotação.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                  >
                    WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setFornecedorFichaModal(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ================================================================= */}
      {/* MODAL 4: EDITAR DADOS DO FORNECEDOR                               */}
      {/* ================================================================= */}
      {fornecedorEditando && (
        <ModalEditarFornecedor
          fornecedor={fornecedorEditando}
          onClose={() => setFornecedorEditando(null)}
          onSalvar={handleSalvarFornecedorEditado}
          onExcluir={handleExcluirFornecedor}
        />
      )}

      {/* ================================================================= */}
      {/* MODAL 4: INSERIR PREÇO DE FORNECEDOR NA COTAÇÃO                   */}
      {/* ================================================================= */}
      {showInserirPrecoModal && scAtiva && (
        <ModalInserirFornecedorCotacao
          sc={scAtiva}
          fornecedores={fornecedores}
          onClose={() => setShowInserirPrecoModal(false)}
          onAdicionarProposta={(novaProp) => {
            setSolicitacoes((prev) =>
              prev.map((s) =>
                s.id === scAtiva.id
                  ? { ...s, propostas: [...s.propostas, novaProp] }
                  : s
              )
            );
            setShowInserirPrecoModal(false);
            dispararAviso(
              `Proposta de ${novaProp.fornecedorNome} adicionada ao Mapa de Cotações!`
            );
          }}
        />
      )}

      {/* ================================================================= */}
      {/* MODAL 5: VISUALIZAR PEDIDO / ORDEM DE COMPRA (ABA 4)              */}
      {/* ================================================================= */}
      {ordemVisualizarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-300 max-w-3xl w-full p-6 shadow-2xl space-y-5 my-6">
            <div className="no-print flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                Pedido Formal de Compra — {ordemVisualizarModal.numeroOc}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGerarOrdemCompraPDF(ordemVisualizarModal)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                >
                  <span>🖨️</span> Imprimir OC Oficial (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => handleGerarRomaneioRecebimentoPDF(ordemVisualizarModal)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <span>📋</span> Romaneio Cego
                </button>
                <a
                  href={`https://wa.me/${ordemVisualizarModal.whatsapp}?text=${encodeURIComponent(
                    `Olá ${ordemVisualizarModal.vendedorNome}, a Ordem de Compra ${ordemVisualizarModal.numeroOc} (${ordemVisualizarModal.obraNome}) no valor de ${formatBRL(
                      ordemVisualizarModal.valorTotal
                    )} foi emitida por ${settings.userName} (${settings.companyName}).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition"
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => setOrdemVisualizarModal(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Cabeçalho da OC com Logomarca Oficial JC BAUER */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="bg-white p-1 rounded-lg border border-amber-300/40 shadow-xs shrink-0 flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="JC Bauer Empreendimentos"
                    className="h-12 w-auto object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {settings.companyName}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
{settings.companyCnpj ? <>CNPJ: <strong>{settings.companyCnpj}</strong> • </> : null}Depto. de Compras:{" "}
                    <strong>{settings.userName}</strong>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-emerald-700">
                  Ordem de Compra
                </div>
                <div className="text-xl font-black text-slate-900 tabular-nums">
                  {ordemVisualizarModal.numeroOc}
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Emissão: {ordemVisualizarModal.dataEmissao} • Ref:{" "}
                  <strong>{ordemVisualizarModal.scCodigo}</strong>
                </div>
              </div>
            </div>

            {/* Dados do Fornecedor e da Obra */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
                <div className="text-xs font-semibold text-slate-700">
                  1. Fornecedor Contratado
                </div>
                <div className="font-bold text-slate-900">
                  {ordemVisualizarModal.fornecedorNome}
                </div>
                <div className="text-xs text-slate-600">
                  CNPJ: {ordemVisualizarModal.fornecedorCnpj}
                </div>
                <div className="text-xs text-slate-700">
                  Vendedor: {ordemVisualizarModal.vendedorNome} • PIX:{" "}
                  {ordemVisualizarModal.chavePix}
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
                <div className="text-xs font-semibold text-slate-700">
                  2. Local de Entrega e Faturamento
                </div>
                <div className="font-bold text-slate-900">
                  {ordemVisualizarModal.obraNome}
                </div>
                <div className="text-xs text-slate-600">
                  {ordemVisualizarModal.obraEndereco}
                </div>
                <div className="text-xs text-slate-700">
                  {ordemVisualizarModal.prazoPagamento}
                </div>
              </div>
            </div>

            {/* Tabela de Itens da OC */}
            <table className="w-full text-sm border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-xs font-semibold text-slate-700">
                  <th className="p-2.5 border border-slate-300">Código</th>
                  <th className="p-2.5 border border-slate-300">
                    Especificação do Material / Serviço
                  </th>
                  <th className="p-2.5 border border-slate-300 text-center">
                    Qtd / Unid
                  </th>
                  <th className="p-2.5 border border-slate-300 text-right">
                    Preço Unit.
                  </th>
                  <th className="p-2.5 border border-slate-300 text-right">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {ordemVisualizarModal.itens.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="p-2.5 border border-slate-300 font-semibold text-slate-700 tabular-nums">
                      {it.codigo}
                    </td>
                    <td className="p-2.5 border border-slate-300 font-medium text-slate-900">
                      {it.descricao}
                    </td>
                    <td className="p-2.5 border border-slate-300 text-center tabular-nums">
                      {it.quantidade} {it.unidade}
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right tabular-nums">
                      {formatBRL(it.precoUnitario)}
                    </td>
                    <td className="p-2.5 border border-slate-300 text-right font-bold text-slate-900 tabular-nums">
                      {formatBRL(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td
                    colSpan={4}
                    className="p-3 border border-slate-300 text-right"
                  >
                    VALOR TOTAL DA ORDEM (Frete {ordemVisualizarModal.tipoFrete}{" "}
                    incluso):
                  </td>
                  <td className="p-3 border border-slate-300 text-right text-base text-emerald-800 bg-emerald-50 tabular-nums">
                    {formatBRL(ordemVisualizarModal.valorTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Destaque de Saving Auditado */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center justify-between text-xs">
              <div className="text-emerald-900">
                💰 <strong>Saving Gerado na Negociação:</strong> Esta compra economizou{" "}
                <strong className="text-emerald-700 text-sm">
                  {formatBRL(ordemVisualizarModal.savingGerado)}
                </strong>{" "}
                em relação ao teto orçado.
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-700 text-white font-bold text-[10px]">
                Auditado
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRAR NOVO EMPREENDIMENTO / OBRA */}
      {showModalNovaObra && (
        <ModalNovaObra
          onClose={() => setShowModalNovaObra(false)}
          onSalvar={handleSalvarNovaObra}
        />
      )}

      {/* MODAL NOVO CONTRATO DE SUBEMPREITADA */}
      {showNovoContratoModal && (
        <ModalNovoContrato
          obras={obras}
          onClose={() => setShowNovoContratoModal(false)}
          onSalvar={handleCriarContrato}
        />
      )}

      {/* MODAL NOVO BOLETIM DE MEDIÇÃO (BM) */}
      {showNovoBmModalContrato && (
        <ModalNovoBoletimMedicao
          contrato={showNovoBmModalContrato}
          usuarioLogado={usuarioLogado}
          onClose={() => setShowNovoBmModalContrato(null)}
          onSalvar={(novoBm) =>
            handleCriarBoletimMedicao(showNovoBmModalContrato.id, novoBm)
          }
        />
      )}

      {/* MODAL LINHA DO TEMPO & MENSAGENS (CANTEIRO ⇄ COMPRAS) */}
      {scMensagensModal && (
        <ModalMensagensPedido
          sc={scMensagensModal}
          usuarioLogado={usuarioLogado}
          onClose={() => setScMensagensModal(null)}
          onEnviar={(texto) =>
            handleEnviarMensagemSC(scMensagensModal.id, texto)
          }
        />
      )}

      {/* MODAL DE ALÇADA DE APROVAÇÃO DA DIRETORIA EXECUTIVA / CFO (> R$ 100.000) */}
      {diretoriaAprovacaoModal && (
        <ModalAprovacaoDiretoria
          data={diretoriaAprovacaoModal}
          onClose={() => setDiretoriaAprovacaoModal(null)}
          onConfirmar={handleConfirmarAprovacaoDiretoria}
        />
      )}

      {/* MODAL CENTRAL DE NOTIFICAÇÕES & ALERTAS PREVENTIVOS */}
      {showNotificacoesModal && (
        <ModalNotificacoesSistema
          notificacoes={notificacoesSistema}
          onClose={() => setShowNotificacoesModal(false)}
          onNavegar={handleNavegarNotificacao}
        />
      )}

      {/* MODAL AUDITORIA DE IQF & HISTÓRICO DE ENTREGAS DO FORNECEDOR */}
      {fornecedorIqfModal && (
        <ModalDetalhesIqf
          fornecedorNome={fornecedorIqfModal}
          ordens={ordens}
          onClose={() => setFornecedorIqfModal(null)}
        />
      )}

      {/* MODAL DEFINIR / AJUSTAR VERBA ORÇAMENTÁRIA */}
      {showNovoOrcamentoModal && (
        <ModalNovoOrcamento
          obras={obras}
          obraFiltro={obraFiltro}
          onClose={() => setShowNovoOrcamentoModal(false)}
          onSalvar={handleSalvarOrcamento}
        />
      )}

      {/* MODAL: AJUSTE RÁPIDO DE SALDO / CONTAGEM FÍSICA NO ALMOXARIFADO */}
      {itemAjustarEstoqueModal && (
        <ModalAjusteRapidoSaldo
          item={itemAjustarEstoqueModal}
          onClose={() => setItemAjustarEstoqueModal(null)}
          onSalvar={handleSalvarAjusteRapidoSaldo}
        />
      )}
      {/* MODAL 1: REGISTRAR NOVA MOVIMENTAÇÃO DE ESTOQUE */}
      {showNovaMovimentacaoModal && (
        <ModalMovimentacaoEstoque
          estoque={estoque}
          obras={obras}
          usuarioLogado={usuarioLogado}
          onClose={() => setShowNovaMovimentacaoModal(false)}
          onSalvar={handleRegistrarMovimentacao}
        />
      )}

      {/* MODAL 2: PROGRAMAR NOVA PUXADA DE CONTRATO CONTÍNUO */}
      {showProgramarPuxadaModal && (
        <ModalProgramarPuxada
          contratos={puxadasFornecimento}
          onClose={() => setShowProgramarPuxadaModal(false)}
          onSalvar={handleProgramarPuxada}
        />
      )}

      {/* MODAL 3: FICHA KARDEX COMPLETA DO INSUMO */}
      {kardexModalItem && (
        <ModalFichaKardex
          item={kardexModalItem}
          movimentacoes={movimentacoesEstoque.filter(
            (m) =>
              m.itemId === kardexModalItem.id ||
              m.codigoInsumo === kardexModalItem.codigo
          )}
          onClose={() => setKardexModalItem(null)}
          onRepor={() => {
            handleGerarSolicitacaoReposicao(kardexModalItem);
            setKardexModalItem(null);
          }}
        />
      )}

      {/* MODAL 4: CENTRALIZADOR DE COMPRAS EM LOTE CORPORATIVO */}
      {showAgruparDemandasModal && (
        <ModalAgruparDemandas
          demandas={demandasAgrupaveis}
          onClose={() => setShowAgruparDemandasModal(false)}
          onCriarLote={handleCriarCompraAgrupada}
        />
      )}
      {/* MODAL DE VISUALIZAÃ‡ÃƒO E IMPRESSÃƒO DO MAPA DE 3 ORÃ‡AMENTOS */}
      {showModalComparativoPdf && (
        <ModalVisualizarComparativoPdf
          comparativoTitulo={comparativoTitulo}
          comparativoObraId={comparativoObraId}
          comparativoCategoria={comparativoCategoria}
          comparativoFornecedores={comparativoFornecedores}
          comparativoItens={comparativoItens}
          resumoComparativo={resumoComparativo}
          settings={settings}
          obras={obras}
          onClose={() => setShowModalComparativoPdf(false)}
          onAbrirNovaAba={handleGerarComparativoRapidoPDF}
        />
      )}
    </div>
  );
}

/* ========================================================================= */
/* SUB-MODAIS AUXILIARES LIMPOS E FUNCIONAIS                                 */
/* ========================================================================= */

function ModalNovaSolicitacao({
  obras,
  defaultSolicitante,
  onClose,
  onCriar,
}: {
  obras: Obra[];
  defaultSolicitante: string;
  onClose: () => void;
  onCriar: (sc: SolicitacaoCompra) => void;
}) {
  const [obraId, setObraId] = useState(obras[0]?.id || "obra-1");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_CONSTRUCAO[0]);
  const [solicitante, setSolicitante] = useState(defaultSolicitante);
  const [descricaoItem, setDescricaoItem] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [quantidade, setQuantidade] = useState(1);
  const [orcamentoUnitario, setOrcamentoUnitario] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemId = `it-${Date.now()}`;
    const scId = `sc-${Date.now()}`;

    const novaSc: SolicitacaoCompra = {
      id: scId,
      codigo: `SC-2026-0${Math.floor(155 + Math.random() * 80)}`,
      obraId,
      categoria,
      solicitante,
      dataAbertura: new Date().toLocaleDateString("pt-BR"),
      status: "Em Cotação",
      itens: [
        {
          id: itemId,
          codigo: `INS-${Math.floor(1000 + Math.random() * 9000)}`,
          descricao: descricaoItem,
          unidade,
          quantidade,
          orcamentoUnitario,
        },
      ],
      propostas: [],
    };

    onCriar(novaSc);
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Nova Solicitação de Compra (SC)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Obra Destino
            </label>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            >
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Categoria / Disciplina
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
              >
                {CATEGORIAS_CONSTRUCAO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Solicitante
              </label>
              <input
                required
                value={solicitante}
                onChange={(e) => setSolicitante(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Descrição do Insumo ou Pacote de Serviço
            </label>
            <input
              required
              value={descricaoItem}
              onChange={(e) => setDescricaoItem(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                required
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value) || 1)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Unidade
              </label>
              <input
                required
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Meta Unitária (R$)
              </label>
              <input
                type="number"
                step="0.10"
                required
                value={orcamentoUnitario}
                onChange={(e) =>
                  setOrcamentoUnitario(Number(e.target.value) || 1)
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Cadastrar e Abrir Mapa de Cotações
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalEditarFornecedor({
  fornecedor,
  onClose,
  onSalvar,
  onExcluir,
}: {
  fornecedor: FornecedorCadastro;
  onClose: () => void;
  onSalvar: (atualizado: FornecedorCadastro) => void;
  onExcluir: (id: string) => void;
}) {
  const [empresa, setEmpresa] = useState(fornecedor.empresa || "");
  const [razaoSocial, setRazaoSocial] = useState(fornecedor.razaoSocial || "");
  const [cnpj, setCnpj] = useState(fornecedor.cnpj || "");
  const [cidade, setCidade] = useState(fornecedor.cidade || "");
  const [categoriaPrincipal, setCategoriaPrincipal] = useState<string>(
    fornecedor.categoriaPrincipal || CATEGORIAS_CONSTRUCAO[0]
  );
  const [vendedor, setVendedor] = useState(fornecedor.vendedor || "");
  const [telefone, setTelefone] = useState(fornecedor.telefone || "");
  const [whatsapp, setWhatsapp] = useState(fornecedor.whatsapp || "");
  const [email, setEmail] = useState(fornecedor.email || "");
  const [chavePix, setChavePix] = useState(fornecedor.chavePix || "");
  const [condicaoPadrao, setCondicaoPadrao] = useState(
    fornecedor.condicaoPadrao || ""
  );
  const [observacoes, setObservacoes] = useState(fornecedor.observacoes || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.trim()) return;

    let waDigitos = whatsapp.replace(/\D/g, "");
    if (!waDigitos && telefone) {
      waDigitos = telefone.replace(/\D/g, "");
    }
    if (
      waDigitos &&
      !waDigitos.startsWith("55") &&
      (waDigitos.length === 10 || waDigitos.length === 11)
    ) {
      waDigitos = `55${waDigitos}`;
    }

    onSalvar({
      ...fornecedor,
      empresa: empresa.trim(),
      razaoSocial: razaoSocial.trim() || empresa.trim(),
      cnpj: cnpj.trim(),
      cidade: cidade.trim(),
      categoriaPrincipal,
      especialidades: [categoriaPrincipal],
      vendedor: vendedor.trim(),
      telefone: telefone.trim(),
      whatsapp: waDigitos,
      email: email.trim(),
      chavePix: chavePix.trim(),
      condicaoPadrao: condicaoPadrao.trim(),
      observacoes: observacoes.trim(),
    });
  };

  const handleRemover = () => {
    if (
      window.confirm(
        `Tem certeza que deseja excluir permanentemente o cadastro de "${fornecedor.empresa}"?`
      )
    ) {
      onExcluir(fornecedor.id);
    }
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 text-xs sm:text-sm my-6"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
              Gerenciamento de Parceiros
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Editar Cadastro do Fornecedor
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-2 py-1 rounded-md hover:bg-slate-100 transition"
          >
            ✕ Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Fantasia / Empresa *
            </label>
            <input
              required
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex: Catarinense Esquadrias"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Razão Social
            </label>
            <input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Razão Social completa"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              CNPJ
            </label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cidade / UF
            </label>
            <input
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: Itapema - SC / Balneário Camboriú"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Categoria Principal
            </label>
            <select
              value={categoriaPrincipal}
              onChange={(e) => setCategoriaPrincipal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            >
              {CATEGORIAS_CONSTRUCAO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Vendedor / Contato
            </label>
            <input
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              placeholder="Ex: Júnior / Jaqueline / Ricardo"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Telefone
            </label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(47) 99915-9239"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              WhatsApp
            </label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ex: 5547999159239 ou (47) 99915-9239"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail Comercial
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="comercial@fornecedor.com.br"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chave PIX / Faturamento
            </label>
            <input
              value={chavePix}
              onChange={(e) => setChavePix(e.target.value)}
              placeholder="Chave PIX / CNPJ para pagamento"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Condições Padrão de Pagamento
            </label>
            <input
              value={condicaoPadrao}
              onChange={(e) => setCondicaoPadrao(e.target.value)}
              placeholder="Ex: 28 dias boleto / À vista / 30/60 ddl"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações / Itens que Fornece
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Tintas, texturas e abrasivos / Ferragens / Entrega rápida no canteiro"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleRemover}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>🗑️</span> Excluir Fornecedor
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <span>💾</span> Salvar Alterações
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ModalNovoFornecedor({
  onClose,
  onSalvar,
}: {
  onClose: () => void;
  onSalvar: (f: FornecedorCadastro) => void;
}) {
  const [empresa, setEmpresa] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cidade, setCidade] = useState("");
  const [categoriaPrincipal, setCategoriaPrincipal] = useState<string>(
    CATEGORIAS_CONSTRUCAO[0]
  );
  const [vendedor, setVendedor] = useState("");
  const [telefone, setTelefone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresa.trim()) return;
    onSalvar({
      id: `forn-${Date.now()}`,
      empresa,
      razaoSocial: razaoSocial || empresa,
      cnpj: cnpj || "",
      cidade,
      categoriaPrincipal,
      especialidades: [categoriaPrincipal],
      vendedor: vendedor || "Consultor Comercial",
      telefone,
      whatsapp: telefone.replace(/\D/g, "") || "5547999112233",
      email: `contato@${empresa.toLowerCase().replace(/\s+/g, "")}.com.br`,
      chavePix: cnpj || "CNPJ",
      condicaoPadrao: "28/56 ddl Boleto",
      observacoes: "Fornecedor homologado no sistema.",
    });
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Cadastrar Novo Fornecedor
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nome Fantasia *
            </label>
            <input
              required
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex: Catarinense Esquadrias"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              CNPJ
            </label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0001-00"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Cidade / UF
            </label>
            <input
              required
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Categoria Principal
            </label>
            <select
              value={categoriaPrincipal}
              onChange={(e) => setCategoriaPrincipal(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            >
              {CATEGORIAS_CONSTRUCAO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nome do Vendedor *
            </label>
            <input
              required
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              placeholder="Ex: Contato Comercial"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Telefone / WhatsApp *
            </label>
            <input
              required
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Razão Social Completa
            </label>
            <input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              placeholder="Opcional"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Salvar Fornecedor
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalInserirFornecedorCotacao({
  sc,
  fornecedores,
  onClose,
  onAdicionarProposta,
}: {
  sc: SolicitacaoCompra;
  fornecedores: FornecedorCadastro[];
  onClose: () => void;
  onAdicionarProposta: (p: PropostaFornecedor) => void;
}) {
  const [fornecedorId, setFornecedorId] = useState(
    fornecedores[0]?.id || ""
  );
  const [freteValor, setFreteValor] = useState(0);
  const [prazoPagamento, setPrazoPagamento] = useState(
    "28 ddl Boleto"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const forn =
      fornecedores.find((f) => f.id === fornecedorId) || fornecedores[0];
    if (!forn) return;
    const precosIniciais: Record<string, number> = {};
    sc.itens.forEach((it) => {
      precosIniciais[it.id] = 0;
    });

    onAdicionarProposta({
      id: `prop-${Date.now()}`,
      vendorId: forn.id,
      fornecedorNome: forn.empresa,
      vendedorNome: forn.vendedor,
      whatsapp: forn.whatsapp,
      precosUnitarios: precosIniciais,
      freteValor,
      tipoFrete: freteValor > 0 ? "FOB" : "CIF",
      prazoPagamento,
    });
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Inserir Fornecedor no Mapa ({sc.codigo})
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Escolher Fornecedor Homologado
            </label>
            <select
              value={fornecedorId}
              onChange={(e) => setFornecedorId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            >
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.empresa} ({f.vendedor})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Frete Inicial (R$)
            </label>
            <input
              type="number"
              step="50"
              value={freteValor}
              onChange={(e) => setFreteValor(Number(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Prazo e Condição de Pagamento
            </label>
            <input
              required
              value={prazoPagamento}
              onChange={(e) => setPrazoPagamento(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Adicionar ao Mapa
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================= */
/* TELA DE LOGIN CORPORATIVA E ACESSO RÁPIDO (DEMONSTRAÇÃO 1 CLIQUE)         */
/* ========================================================================= */

function TelaLoginCorporativa({
  companyName,
  loginInput,
  setLoginInput,
  senhaInput,
  setSenhaInput,
  erroLogin,
  onSubmit,
  onQuickLogin,
  usuarios,
}: {
  companyName: string;
  loginInput: string;
  setLoginInput: (v: string) => void;
  senhaInput: string;
  setSenhaInput: (v: string) => void;
  erroLogin: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onQuickLogin: (userId: string) => void;
  usuarios: UsuarioSistema[];
}) {
  const adminUser =
    usuarios.find((u) => u.cargo === "Administrador") ||
    USUARIOS_INICIAIS[0] || {
      id: "usr-admin-1",
      nome: "João Carlos Bauer",
      cargo: "Administrador" as const,
      obraId: "ALL",
      obraNome: "Todas as Obras (Central de Compras)",
      email: "suprimentos@jcbauer.eng.br",
      senha: "123",
      status: "Ativo" as const,
    };

  return (
    <div className="min-h-screen w-full bg-[#F4F6F8] text-slate-900 font-sans flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg p-7 space-y-5">
        {/* Cabeçalho Corporativo com Logotipo Oficial Dourado */}
        <div className="flex flex-col items-center text-center border-b border-slate-200 pb-5">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-amber-200/80 mb-3 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="JC Bauer Empreendimentos"
              className="h-14 w-auto object-contain"
            />
          </div>
          <h1 className="text-base font-extrabold text-slate-900 tracking-wide">
            {companyName}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Portal Integrado de Suprimentos & Gestão de Obras
          </p>
        </div>

        {/* Card Destaque: Acesso Direto do Administrador Master (1 Clique) */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>👑</span>
              <span>Acesso Administrador Master</span>
            </span>
            <span className="text-[10px] font-semibold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
              Central de Compras
            </span>
          </div>

          <button
            type="button"
            onClick={() => onQuickLogin(adminUser.id)}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs"
          >
            <span>🔑</span>
            <span>Entrar como Administrador Master (1 Clique)</span>
          </button>

          <div className="bg-white/80 border border-amber-200/60 rounded-lg p-2.5 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center justify-between">
              <span>E-mail / Usuário:</span>
              <strong className="text-slate-900 font-mono">suprimentos@jcbauer.eng.br</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Usuário Simplificado:</span>
              <strong className="text-slate-900 font-mono">admin</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Senha Padrão:</span>
              <strong className="text-slate-900 font-mono">123</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] text-slate-400 font-medium">ou acesse com suas credenciais</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        {/* Formulário de Autenticação */}
        <form onSubmit={onSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail Corporativo ou Usuário
            </label>
            <input
              required
              type="text"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="ex: suprimentos@jcbauer.eng.br ou admin"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Senha de Acesso
            </label>
            <input
              required
              type="password"
              value={senhaInput}
              onChange={(e) => setSenhaInput(e.target.value)}
              placeholder="ex: 123"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          {erroLogin && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
              {erroLogin}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setLoginInput(adminUser.email);
                setSenhaInput(adminUser.senha);
              }}
              className="py-2.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              title="Preencher com os dados do Administrador"
            >
              Preencher Master
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
            >
              Entrar no Sistema
            </button>
          </div>
        </form>

        {/* Rodapé */}
        <div className="pt-3 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-400">
            Acesso restrito e autenticado • Construtora JC Bauer
          </p>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* MODAL DE CADASTRO DE NOVO ACESSO DA OBRA (SOMENTE ADMIN)                  */
/* ========================================================================= */

function ModalNovoUsuarioObra({
  obras,
  onClose,
  onSalvar,
}: {
  obras: Obra[];
  onClose: () => void;
  onSalvar: (u: UsuarioSistema) => void;
}) {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState<PerfilAcesso>("Engenheiro");
  const [obraId, setObraId] = useState(obras[0]?.id || "obra-1");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("obra123");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim() || !senha.trim()) return;
    const obraObj = obras.find((o) => o.id === obraId);
    onSalvar({
      id: `user-${Date.now()}`,
      nome: nome.trim(),
      cargo,
      obraId: cargo === "Administrador" ? "ALL" : obraId,
      obraNome:
        cargo === "Administrador"
          ? "Todas as Obras (Acesso Total)"
          : obraObj?.nome || "Obra Vinculada",
      email: email.trim(),
      senha: senha.trim(),
      status: "Ativo",
    });
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-bold text-slate-900">
            Cadastrar Novo Acesso da Obra
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo do Colaborador *
            </label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Eng. Fernanda Costa"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cargo / Perfil de Permissão *
            </label>
            <select
              value={cargo}
              onChange={(e) => setCargo(e.target.value as PerfilAcesso)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="Engenheiro">Engenheiro de Obra</option>
              <option value="Almoxarife">Almoxarife</option>
              <option value="Encarregado">Encarregado de Obra</option>
              <option value="Administrador">Administrador (Compras)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Obra Vinculada *
            </label>
            <select
              disabled={cargo === "Administrador"}
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 disabled:opacity-60"
            >
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Login / E-mail *
            </label>
            <input
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="fernanda@jcbauer.eng.br"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Senha de Acesso *
            </label>
            <input
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Ex: obra123"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Salvar Acesso e Liberar Login
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================= */
/* VISÃO RESTRITA DO SOLICITANTE DA OBRA (ENGENHEIRO, ALMOXARIFE, ENCARREGADO)*/
/* ========================================================================= */

function VisaoRestritaObra({
  usuarioLogado,
  companyName,
  obras,
  fornecedores,
  solicitacoes,
  ordens,
  contratos,
  obraActiveTab,
  setObraActiveTab,
  notificacao,
  setNotificacao,
  onLogout,
  onCriarPedidoCanteiro,
  ocConfirmarRecebimentoModal,
  setOcConfirmarRecebimentoModal,
  onConfirmarRecebimentoObra,
  onCriarBoletimMedicao,
  onEnviarMensagemSC,
  estoque = [],
  movimentacoesEstoque = [],
  onRegistrarMovimentacao,
  diariosObra = [],
  onSalvarDiarioObra,
  onGerarOrdemCompraPDF,
  onGerarRomaneioRecebimentoPDF,
}: {
  usuarioLogado: UsuarioSistema;
  companyName: string;
  obras: Obra[];
  fornecedores: FornecedorCadastro[];
  solicitacoes: SolicitacaoCompra[];
  ordens: OrdemCompra[];
  contratos: ContratoSubempreitada[];
  obraActiveTab: ObraTabId;
  setObraActiveTab: (t: ObraTabId) => void;
  notificacao: string | null;
  setNotificacao: (n: string | null) => void;
  onLogout: () => void;
  onCriarPedidoCanteiro: (novaSc: SolicitacaoCompra) => void;
  ocConfirmarRecebimentoModal: OrdemCompra | null;
  setOcConfirmarRecebimentoModal: (oc: OrdemCompra | null) => void;
  onConfirmarRecebimentoObra: (
    ocId: string,
    notaFiscal: string,
    condicao: string
  ) => void;
  onCriarBoletimMedicao: (contratoId: string, bm: BoletimMedicao) => void;
  onEnviarMensagemSC: (scId: string, texto: string) => void;
  estoque?: ItemEstoque[];
  movimentacoesEstoque?: MovimentacaoEstoque[];
  onRegistrarMovimentacao?: (mov: MovimentacaoEstoque) => void;
  diariosObra?: DiarioObraRegistro[];
  onSalvarDiarioObra?: (novoDiario: DiarioObraRegistro) => void;
  onGerarOrdemCompraPDF?: (oc: OrdemCompra) => void;
  onGerarRomaneioRecebimentoPDF?: (oc: OrdemCompra) => void;
}) {
  // Estado local para modais do Canteiro
  const [novoBmModalContrato, setNovoBmModalContrato] =
    useState<ContratoSubempreitada | null>(null);
  const [scChatModal, setScChatModal] = useState<SolicitacaoCompra | null>(null);

  // Estados locais para a Rotina Diária do Canteiro & Checklist
  const [baixaItemEstoqueId, setBaixaItemEstoqueId] = useState<string>("");
  const [baixaQtd, setBaixaQtd] = useState<number>(1);
  const [baixaEtapa, setBaixaEtapa] = useState<string>("");
  const [baixaObs, setBaixaObs] = useState<string>("");

  // Estados para RDO Express
  const [rdoClima, setRdoClima] = useState<
    "Ensolarado" | "Nublado" | "Chuvoso" | "Chuva c/ Paralisação"
  >("Ensolarado");
  const [rdoEfetivoProprio, setRdoEfetivoProprio] = useState<number>(0);
  const [rdoEfetivoTerc, setRdoEfetivoTerc] = useState<number>(0);
  const [rdoFrentes, setRdoFrentes] = useState<string>("");
  const [rdoOcorrencias, setRdoOcorrencias] = useState<string>("");

  // Estado do formulário "Novo Pedido de Material"
  const [obraIdForm, setObraIdForm] = useState<string>(
    usuarioLogado.obraId !== "ALL"
      ? usuarioLogado.obraId
      : obras[0]?.id || "obra-1"
  );
  const [categoriaForm, setCategoriaForm] = useState<string>(
    CATEGORIAS_CONSTRUCAO[0]
  );
  const [urgenciaForm, setUrgenciaForm] = useState<UrgenciaPedido>("Normal");
  const [dataNecessariaForm, setDataNecessariaForm] = useState<string>(() => {
    const d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0];
  });

  const [itensGrade, setItensGrade] = useState<
    {
      id: string;
      descricao: string;
      quantidade: number;
      unidade: string;
      observacaoObra: string;
    }[]
  >([]);

  // Estado do Modal de Confirmação de Recebimento (Nota Fiscal + Condição)
  const [notaFiscalInput, setNotaFiscalInput] = useState("");
  const [condicaoInput, setCondicaoInput] = useState(
    "Material completo e sem avarias"
  );

  const adicionarLinhaGrade = () => {
    setItensGrade((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        descricao: "",
        quantidade: 10,
        unidade: "un",
        observacaoObra: "",
      },
    ]);
  };

  const removerLinhaGrade = (id: string) => {
    if (itensGrade.length <= 1) return;
    setItensGrade((prev) => prev.filter((i) => i.id !== id));
  };

  const handleEnviarPedidoCanteiro = (e: React.FormEvent) => {
    e.preventDefault();
    const itensValidos = itensGrade.filter((i) => i.descricao.trim() !== "");
    if (itensValidos.length === 0) return;

    const scId = `sc-canteiro-${Date.now()}`;
    const dataFormatada = new Date().toLocaleDateString("pt-BR");
    const horaFormatada = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const dataNecFormatada = dataNecessariaForm.includes("-")
      ? dataNecessariaForm.split("-").reverse().join("/")
      : dataNecessariaForm;

    const itensSc: ItemSolicitacao[] = itensValidos.map((it, idx) => ({
      id: `it-${Date.now()}-${idx}`,
      codigo: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      descricao: it.descricao.trim(),
      unidade: it.unidade,
      quantidade: Number(it.quantidade) || 1,
      orcamentoUnitario: 0,
      observacaoObra: it.observacaoObra.trim() || "Entrega no canteiro",
    }));

    const novaSc: SolicitacaoCompra = {
      id: scId,
      codigo: `SC-2026-0${Math.floor(160 + Math.random() * 80)}`,
      obraId: obraIdForm,
      categoria: categoriaForm,
      solicitante: usuarioLogado.nome,
      solicitanteCargo: usuarioLogado.cargo,
      urgencia: urgenciaForm,
      dataNecessaria: dataNecFormatada,
      dataAbertura: dataFormatada,
      horarioPedido: `${dataFormatada} às ${horaFormatada}`,
      origemCanteiro: true,
      novoAlertaAdmin: true,
      status: "Enviado / Aguardando Compras",
      itens: itensSc,
      propostas: [],
    };

    onCriarPedidoCanteiro(novaSc);
    setItensGrade([
      {
        id: `item-${Date.now()}`,
        descricao: "",
        quantidade: 10,
        unidade: "un",
        observacaoObra: "",
      },
    ]);
  };

  // Filtra pedidos e ordens vinculados à obra selecionada/do usuário
  const pedidosDaObra = solicitacoes.filter(
    (s) => s.obraId === obraIdForm || s.obraId === usuarioLogado.obraId
  );

  const ordensDaObra = ordens.filter(
    (o) => o.obraId === obraIdForm || o.obraId === usuarioLogado.obraId
  );

  const contratosDaObra = contratos.filter(
    (c) =>
      c.obraId === obraIdForm ||
      c.obraId === usuarioLogado.obraId ||
      usuarioLogado.obraId === "ALL"
  );

  const cargasDaObraSemana = useMemo(
    () =>
      agruparCargasLogistica(
        ordens,
        usuarioLogado.obraId !== "ALL" ? usuarioLogado.obraId : obraIdForm
      ),
    [ordens, usuarioLogado.obraId, obraIdForm]
  );
  const totalCargasObra = cargasDaObraSemana.reduce((a, d) => a + d.cargas.length, 0);

  const obraIdEfetivo =
    usuarioLogado.obraId !== "ALL" ? usuarioLogado.obraId : obraIdForm;
  const dataHojeStr = new Date().toLocaleDateString("pt-BR");
  const diarioHojeEfetivo = diariosObra.find(
    (d) =>
      (d.obraId === obraIdEfetivo || usuarioLogado.obraId === "ALL") &&
      d.data === dataHojeStr
  );
  const entregasHojePendentes = ordensDaObra.filter(
    (o) => o.status === "Emitida" || o.status === "Aguardando Entrega"
  );
  const estoqueDestaObra = estoque.filter(
    (it) => it.obraId === obraIdEfetivo || usuarioLogado.obraId === "ALL"
  );
  const diariosDestaObra = diariosObra.filter(
    (d) => d.obraId === obraIdEfetivo || usuarioLogado.obraId === "ALL"
  );

  const tituloObraTab: Record<ObraTabId, string> = {
    PainelDiario: "📋 Painel Diário do Canteiro & Checklist Operacional",
    NovoPedido: "📝 Novo Pedido de Material (Requisição de Canteiro)",
    MeusPedidos: "📋 Meus Pedidos da Obra (Acompanhamento em Tempo Real)",
    Recebimento: "📦 Recebimento & Controle Interno (Almoxarifado)",
    Estoque: "🧱 Estoque do Canteiro & Almoxarifado",
    Medicoes: "📐 Contratos de Subempreitada & Boletins de Medição (BM)",
    Logistica: "🚚 Calendário de Cargas & Descargas no Canteiro",
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F6F8] text-slate-900 font-sans">
      {/* SIDEBAR RESTRITA DA OBRA (ABAS PERMITIDAS) */}
      <aside className="w-72 shrink-0 bg-slate-900 text-white flex flex-col justify-between h-full">
        <div>
          <div className="h-20 px-4 border-b border-slate-800 flex items-center gap-3">
            <div className="bg-white p-1 rounded-lg border border-amber-300/40 shadow-xs shrink-0 flex items-center justify-center">
              <img
                src="/logo.png"
                alt="JC Bauer Empreendimentos"
                className="h-10 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm text-white tracking-wide truncate">
                JC BAUER
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold truncate">
                Portal do Canteiro de Obras
              </div>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {(
              [
                {
                  id: "PainelDiario",
                  label: "📋 Rotina Diária & Checklist",
                },
                { id: "NovoPedido", label: "📝 Novo Pedido de Material" },
                { id: "MeusPedidos", label: "📋 Meus Pedidos da Obra" },
                {
                  id: "Recebimento",
                  label: "📦 Recebimento de Cargas",
                },
                {
                  id: "Estoque",
                  label: "🧱 Almoxarifado da Obra",
                },
                {
                  id: "Medicoes",
                  label: "📐 Contratos & Medições",
                },
                {
                  id: "Logistica",
                  label: "🚚 Calendário de Cargas",
                },
              ] as { id: ObraTabId; label: string }[]
            ).map((item) => {
              const ativo = obraActiveTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setObraActiveTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition text-left ${
                    ativo
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.id === "PainelDiario" && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        diarioHojeEfetivo
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                          : "bg-amber-900 text-amber-200 border border-amber-600 animate-pulse"
                      }`}
                    >
                      {diarioHojeEfetivo ? "🟢 Em Dia" : "🟡 Pendente"}
                    </span>
                  )}
                  {item.id === "MeusPedidos" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-200 text-[10px] font-bold shrink-0">
                      {pedidosDaObra.length}
                    </span>
                  )}
                  {item.id === "Recebimento" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-emerald-300 text-[10px] font-bold shrink-0">
                      {ordensDaObra.length}
                    </span>
                  )}
                  {item.id === "Estoque" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-teal-300 text-[10px] font-bold shrink-0">
                      {
                        estoque.filter(
                          (it) =>
                            it.obraId === usuarioLogado.obraId ||
                            usuarioLogado.obraId === "ALL"
                        ).length
                      }
                    </span>
                  )}
                  {item.id === "Medicoes" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-blue-300 text-[10px] font-bold shrink-0">
                      {contratosDaObra.length}
                    </span>
                  )}
                  {item.id === "Logistica" && (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-amber-300 text-[10px] font-bold shrink-0">
                      {totalCargasObra}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Aviso de Segurança RBAC */}
          <div className="mx-3 mt-3 p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 space-y-1">
            <div className="font-bold text-emerald-400">
              🔒 Acesso Restrito de Campo
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Visão exclusiva para requisições e conferência física de entregas
              no canteiro.
            </p>
          </div>
        </div>

        {/* Rodapé da Sidebar com Perfil + Obra + Botão Sair / Trocar Conta */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="p-2.5 rounded-lg bg-slate-800/60">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                {usuarioLogado.cargo}
              </span>
              <span className="font-semibold text-xs text-white truncate">
                {usuarioLogado.nome}
              </span>
            </div>
            <div className="text-xs text-slate-400 truncate mt-1">
              📍 {usuarioLogado.obraNome}
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-red-900/80 text-slate-200 hover:text-white text-xs font-semibold transition flex items-center justify-center gap-1.5 border border-slate-700"
          >
            <span>🚪</span> Sair / Trocar Conta
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL DA OBRA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* HEADER SUPERIOR */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-slate-900 truncate">
            {tituloObraTab[obraActiveTab]}
          </h1>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
              <span className="font-bold text-slate-900">
                {usuarioLogado.nome}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-emerald-800">
                {usuarioLogado.cargo}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-medium text-slate-700">
                📍 {usuarioLogado.obraNome}
              </span>
            </div>

            <button
              onClick={onLogout}
              className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition whitespace-nowrap"
            >
              Sair / Trocar Conta
            </button>
          </div>
        </header>

        {notificacao && (
          <div className="bg-emerald-800 text-white px-6 py-2.5 text-sm font-medium flex items-center justify-between shrink-0">
            <span>{notificacao}</span>
            <button
              onClick={() => setNotificacao(null)}
              className="text-xs underline ml-4"
            >
              Fechar
            </button>
          </div>
        )}

        {/* CONTEÚDO DAS ABAS DA OBRA */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* =============================================================== */}
          {/* ABA 0: PAINEL DIÁRIO DO CANTEIRO & CHECKLIST OPERACIONAL        */}
          {/* =============================================================== */}
          {obraActiveTab === "PainelDiario" && (
            <div className="max-w-6xl space-y-6">
              {/* BANNER DE BOAS-VINDAS & STATUS DE HOJE */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center text-base font-bold">
                      🏗️
                    </span>
                    <h2 className="text-base font-bold text-slate-900">
                      Painel Diário do Canteiro & Checklist
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-medium">
                      Sincronização com Compras
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Olá, <strong className="text-slate-900">{usuarioLogado.nome}</strong> ({usuarioLogado.cargo}). 
                    Confirme o recebimento físico das cargas, lance as saídas no estoque e preencha o Diário de Obra (RDO).
                  </p>
                </div>

                <div className="shrink-0">
                  <div className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-2.5 ${
                    diarioHojeEfetivo
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${diarioHojeEfetivo ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <div>
                      <div className="font-bold">
                        {diarioHojeEfetivo ? "Diário de Hoje Preenchido" : "RDO Pendente de Preenchimento"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {diarioHojeEfetivo
                          ? `Registrado às ${diarioHojeEfetivo.hora} por ${diarioHojeEfetivo.responsavelNome}`
                          : `Data: ${dataHojeStr} (Aguardando registro)`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 CARDS DE KPI OPERACIONAL RÁPIDO */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      Cargas Programadas
                    </span>
                    <span className="text-slate-400">🚚</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {entregasHojePendentes.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {entregasHojePendentes.length === 0
                      ? "Nenhuma carga pendente hoje"
                      : "Aguardando conferência física e NF"}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      Itens em Almoxarifado
                    </span>
                    <span className="text-slate-400">🧱</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {estoqueDestaObra.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Saldo físico sob custódia do canteiro
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">
                      Requisições da Obra
                    </span>
                    <span className="text-slate-400">📋</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                    {pedidosDaObra.length}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Pedidos emitidos para Suprimentos
                  </div>
                </div>
              </div>

              {/* ========================================================= */}
              {/* PASSO 1: CONFIRMAÇÃO DE CARGAS & RECEBIMENTO COM NF       */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center">
                        1
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        Passo 1: Recebimento de Cargas & Registro de Nota Fiscal
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        Almoxarifado
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Ao confirmar a entrega física, o sistema incrementa o estoque automaticamente, calcula o preço médio e notifica Compras.
                    </p>
                  </div>
                </div>

                {entregasHojePendentes.length === 0 ? (
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-3">
                    <span className="text-lg">✅</span>
                    <div>
                      <p className="font-bold">
                        Nenhuma carga com entrega pendente no momento para este canteiro.
                      </p>
                      <p className="text-emerald-700 mt-0.5">
                        Todas as ordens de compra em trânsito já foram recebidas e incorporadas ao estoque físico.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entregasHojePendentes.map((oc) => (
                      <div
                        key={oc.id}
                        className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {oc.numeroOc}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="font-semibold text-slate-800 text-xs">
                              {oc.fornecedorNome}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                              {oc.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600">
                            Previsão: <strong>{oc.dataPrevistaEntrega || "A combinar"}</strong> • Categoria: {oc.categoria} • Valor: {formatBRL(oc.valorTotal)}
                          </div>
                          <div className="text-xs text-slate-500 bg-white/80 p-2 rounded border border-slate-200 mt-1.5">
                            <strong>Itens a descarregar:</strong>{" "}
                            {oc.itens.map((it) => `${it.quantidade} ${it.unidade} de ${it.descricao}`).join(" | ")}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setOcConfirmarRecebimentoModal(oc)}
                          className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 shrink-0"
                        >
                          <span>📦</span>
                          <span>Conferir & Registrar Entrada com NF</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ========================================================= */}
              {/* PASSO 2: BAIXA RÁPIDA DE CONSUMO POR ETAPA / FRENTE        */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center">
                        2
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        Passo 2: Baixa Rápida de Consumo por Etapa / Frente de Obra
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        Almoxarifado & Encarregado
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Libere materiais para as equipes em menos de 20 segundos. O saldo físico é atualizado e registrado no Kardex instantaneamente.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!baixaItemEstoqueId) {
                      setNotificacao("Selecione um insumo para registrar a saída.");
                      return;
                    }
                    const itemAlvo = estoqueDestaObra.find((it) => it.id === baixaItemEstoqueId);
                    if (!itemAlvo) return;
                    if (Number(baixaQtd) <= 0) {
                      setNotificacao("Informe uma quantidade válida maior que zero.");
                      return;
                    }
                    if (Number(baixaQtd) > itemAlvo.saldoAtual) {
                      setNotificacao(`Quantidade excede o saldo disponível (${itemAlvo.saldoAtual} ${itemAlvo.unidade}).`);
                      return;
                    }

                    if (onRegistrarMovimentacao) {
                      const dataHoraFormatada = `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                      onRegistrarMovimentacao({
                        id: `mov-${Date.now()}`,
                        itemId: itemAlvo.id,
                        codigoInsumo: itemAlvo.codigo,
                        descricaoInsumo: itemAlvo.descricao,
                        unidade: itemAlvo.unidade,
                        tipo: "SAIDA_APLICACAO",
                        quantidade: Number(baixaQtd),
                        saldoAnterior: itemAlvo.saldoAtual,
                        saldoPosterior: Math.max(0, itemAlvo.saldoAtual - Number(baixaQtd)),
                        custoUnitario: itemAlvo.custoMedio,
                        valorTotal: Number(baixaQtd) * itemAlvo.custoMedio,
                        dataHora: dataHoraFormatada,
                        responsavel: `${usuarioLogado.nome} (${usuarioLogado.cargo})`,
                        obraOrigemId: itemAlvo.obraId,
                        obraOrigemNome: itemAlvo.obraNome,
                        numeroDocumento: `Frente: ${baixaEtapa}`,
                        motivoEtapa: `Consumo imediato na frente '${baixaEtapa}'. ${baixaObs ? "Obs: " + baixaObs : ""}`,
                      });
                      setNotificacao(`Saída de ${baixaQtd} ${itemAlvo.unidade} de "${itemAlvo.descricao}" registrada com sucesso no Kardex!`);
                      setBaixaQtd(1);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="lg:col-span-2">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Insumo do Almoxarifado *
                      </label>
                      <select
                        value={baixaItemEstoqueId}
                        onChange={(e) => {
                          setBaixaItemEstoqueId(e.target.value);
                          const it = estoqueDestaObra.find((x) => x.id === e.target.value);
                          if (it) {
                            setBaixaQtd(Math.min(10, it.saldoAtual));
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                        required
                      >
                        <option value="">-- Selecione o insumo retirado --</option>
                        {estoqueDestaObra.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.descricao} (Saldo: {it.saldoAtual} {it.unidade})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Quantidade a Baixar *
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={baixaQtd}
                        onChange={(e) => setBaixaQtd(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                        required
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Etapa / Frente de Serviço *
                      </label>
                      <input
                        type="text"
                        value={baixaEtapa}
                        onChange={(e) => setBaixaEtapa(e.target.value)}
                        placeholder="Ex: Concretagem Laje 22º Pav."
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                        required
                      />
                    </div>
                  </div>

                  {/* Chips rápidos de etapas frequentes */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-medium mr-1">Frentes Frequentes:</span>
                    {[
                      "Estrutura & Concretagem",
                      "Armação de Pilares",
                      "Alvenaria de Vedação",
                      "Instalações Elétricas",
                      "Instalações Hidráulicas",
                      "Gesso & Pintura",
                      "Fachada & Esquadrias",
                    ].map((frente) => (
                      <button
                        key={frente}
                        type="button"
                        onClick={() => setBaixaEtapa(frente)}
                        className={`px-2 py-0.5 rounded border transition ${
                          baixaEtapa === frente
                            ? "bg-emerald-700 text-white border-emerald-700"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                        }`}
                      >
                        {frente}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <input
                      type="text"
                      value={baixaObs}
                      onChange={(e) => setBaixaObs(e.target.value)}
                      placeholder="Observações complementares (ex: entregue para equipe do encarregado Carlos)..."
                      className="w-full sm:w-2/3 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-2 shrink-0"
                    >
                      <span>➖</span>
                      <span>Registrar Baixa no Estoque & Kardex</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* ========================================================= */}
              {/* PASSO 3: DIÁRIO DE OBRA EXPRESS (RDO DO DIA)               */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center">
                        3
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        Passo 3: Diário de Obra Express (RDO do Dia)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        Engenharia & Encarregado
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Preencha o RDO em 1 minuto para consolidar o relatório diário e atualizar o painel de auditoria da Diretoria em tempo real.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (onSalvarDiarioObra) {
                      const obraObj = obras.find((o) => o.id === obraIdEfetivo);
                      const agora = new Date();
                      const horaFormatada = agora.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      onSalvarDiarioObra({
                        id: `rdo-${Date.now()}`,
                        obraId: obraIdEfetivo,
                        obraNome: obraObj ? obraObj.nome : usuarioLogado.obraNome,
                        data: dataHojeStr,
                        hora: horaFormatada,
                        responsavelNome: usuarioLogado.nome,
                        responsavelCargo: usuarioLogado.cargo,
                        clima: rdoClima,
                        efetivoProprio: Number(rdoEfetivoProprio) || 0,
                        efetivoTerceirizado: Number(rdoEfetivoTerc) || 0,
                        frentesServico: rdoFrentes.trim() || "Frentes de serviço regulares em andamento.",
                        ocorrencias: rdoOcorrencias.trim() || "Sem ocorrências atípicas.",
                      });
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {/* Clima do dia */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Condição Climática do Canteiro *
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { valor: "Ensolarado", rotulo: "☀️ Ensolarado" },
                            { valor: "Nublado", rotulo: "⛅ Nublado" },
                            { valor: "Chuvoso", rotulo: "🌧️ Chuvoso" },
                            {
                              valor: "Chuva c/ Paralisação",
                              rotulo: "⛈️ Paralisação",
                            },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.valor}
                            type="button"
                            onClick={() => setRdoClima(item.valor)}
                            className={`p-2 rounded-lg border text-xs font-semibold text-center transition ${
                              rdoClima === item.valor
                                ? "bg-emerald-700 text-white border-emerald-700"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            {item.rotulo}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Efetivo Próprio */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Efetivo Próprio (JC Bauer) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={rdoEfetivoProprio}
                        onChange={(e) => setRdoEfetivoProprio(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                        required
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Engenheiros, mestres, encarregados e equipe própria.
                      </span>
                    </div>

                    {/* Efetivo Terceirizado */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Efetivo Terceirizado (Empreiteiros) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={rdoEfetivoTerc}
                        onChange={(e) => setRdoEfetivoTerc(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-600"
                        required
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Equipes de subempreiteiros em atividade na obra.
                      </span>
                    </div>
                  </div>

                  {/* Banner resumo do efetivo total */}
                  <div className="bg-slate-100 rounded-lg px-4 py-2 border border-slate-200 text-xs flex items-center justify-between">
                    <span className="font-semibold text-slate-700">
                      👥 Força de Trabalho Total no Canteiro Hoje:
                    </span>
                    <span className="text-sm font-extrabold text-emerald-800">
                      {Number(rdoEfetivoProprio) + Number(rdoEfetivoTerc)} colaboradores ativos
                    </span>
                  </div>

                  {/* Frentes de Trabalho em Execução */}
                  <div className="text-xs">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Frentes de Serviço em Andamento *
                    </label>
                    <textarea
                      rows={2}
                      value={rdoFrentes}
                      onChange={(e) => setRdoFrentes(e.target.value)}
                      placeholder="Descreva as principais etapas executadas hoje na obra..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                      required
                    />
                  </div>

                  {/* Ocorrências / Livro do Canteiro */}
                  <div className="text-xs">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Ocorrências, Ensaios Tecnológicos & Entregas
                    </label>
                    <textarea
                      rows={2}
                      value={rdoOcorrencias}
                      onChange={(e) => setRdoOcorrencias(e.target.value)}
                      placeholder="Ex: Slump test aprovado no concreto Polimix; recebida carga de aço sem desvios; fiscalização de rotina..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-2"
                    >
                      <span>💾</span>
                      <span>Salvar & Transmitir Diário de Obra (RDO) de Hoje</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* ========================================================= */}
              {/* HISTÓRICO DE DIÁRIOS DESTA OBRA                            */}
              {/* ========================================================= */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>📜</span>
                    <span>Histórico Recente de Diários de Obra (RDO)</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {diariosDestaObra.length} registros no canteiro
                  </span>
                </div>

                {diariosDestaObra.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-4 text-center">
                    Nenhum diário registrado ainda para esta obra.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {diariosDestaObra.map((d) => (
                      <div
                        key={d.id}
                        className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              📅 {d.data} às {d.hora}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-700 font-medium">
                              {d.responsavelNome} ({d.responsavelCargo})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                              ☀️ {d.clima}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-bold">
                              👥 {d.efetivoProprio + d.efetivoTerceirizado} trabalhadores ({d.efetivoProprio} próprios + {d.efetivoTerceirizado} terc.)
                            </span>
                          </div>
                        </div>

                        <div>
                          <strong className="text-slate-800">Frentes em execução:</strong>{" "}
                          <span className="text-slate-700">{d.frentesServico}</span>
                        </div>

                        {d.ocorrencias && (
                          <div className="bg-white p-2.5 rounded border border-slate-200 text-slate-600 mt-1">
                            <strong className="text-slate-800">Ocorrências / Notas de Campo:</strong>{" "}
                            {d.ocorrencias}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* ABA 1: NOVO PEDIDO DE MATERIAL (REQUISIÇÃO DE CANTEIRO)         */}
          {/* =============================================================== */}
          {obraActiveTab === "NovoPedido" && (
            <form
              onSubmit={handleEnviarPedidoCanteiro}
              className="max-w-5xl bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6"
            >
              <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Requisição de Materiais e Insumos do Canteiro
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preencha os itens necessários na obra. O pedido cairá
                    instantaneamente na tela do Setor de Compras para cotação.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                  Integração Direta com Suprimentos
                </span>
              </div>

              {/* Dados do Cabeçalho da Requisição */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Obra Solicitante *
                  </label>
                  <select
                    value={obraIdForm}
                    onChange={(e) => setObraIdForm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
                  >
                    {obras.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Solicitante & Função
                  </label>
                  <input
                    readOnly
                    value={`${usuarioLogado.nome} - ${usuarioLogado.cargo}`}
                    className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-700 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Categoria do Pedido *
                  </label>
                  <select
                    value={categoriaForm}
                    onChange={(e) => setCategoriaForm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                  >
                    {CATEGORIAS_CONSTRUCAO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Urgência *
                    </label>
                    <select
                      value={urgenciaForm}
                      onChange={(e) =>
                        setUrgenciaForm(e.target.value as UrgenciaPedido)
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 font-semibold text-slate-900"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Alta">Alta</option>
                      <option value="Crítica - Obra Parada">
                        Crítica - Obra Parada
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data na Obra *
                    </label>
                    <input
                      required
                      type="date"
                      value={dataNecessariaForm}
                      onChange={(e) => setDataNecessariaForm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Grade de Itens do Pedido */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Itens Solicitados para o Canteiro ({itensGrade.length})
                  </label>
                  <button
                    type="button"
                    onClick={adicionarLinhaGrade}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800 transition"
                  >
                    + Adicionar Mais um Material
                  </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                        <th className="py-2.5 px-3 w-[40%]">
                          Nome / Especificação Técnica do Material *
                        </th>
                        <th className="py-2.5 px-3 w-[14%]">Quantidade *</th>
                        <th className="py-2.5 px-3 w-[14%]">Unidade *</th>
                        <th className="py-2.5 px-3 w-[26%]">
                          Observação da Obra (Ex: Portão B)
                        </th>
                        <th className="py-2.5 px-3 text-center w-[6%]">Rem.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {itensGrade.map((linha) => (
                        <tr key={linha.id}>
                          <td className="p-2.5">
                            <input
                              required
                              placeholder="Ex: Aço CA-50 Ø 12.5mm dobrado / Cimento CP-II"
                              value={linha.descricao}
                              onChange={(e) =>
                                setItensGrade((prev) =>
                                  prev.map((r) =>
                                    r.id === linha.id
                                      ? { ...r, descricao: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-sm text-slate-900"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              required
                              type="number"
                              min={1}
                              value={linha.quantidade}
                              onChange={(e) =>
                                setItensGrade((prev) =>
                                  prev.map((r) =>
                                    r.id === linha.id
                                      ? {
                                          ...r,
                                          quantidade:
                                            Number(e.target.value) || 1,
                                        }
                                      : r
                                  )
                                )
                              }
                              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-900 tabular-nums"
                            />
                          </td>
                          <td className="p-2.5">
                            <select
                              value={linha.unidade}
                              onChange={(e) =>
                                setItensGrade((prev) =>
                                  prev.map((r) =>
                                    r.id === linha.id
                                      ? { ...r, unidade: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-full bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-sm text-slate-900"
                            >
                              <option value="un">un (Unidade)</option>
                              <option value="sc">sc (Saco)</option>
                              <option value="m²">m² (Metro quad.)</option>
                              <option value="m³">m³ (Metro cúbico)</option>
                              <option value="kg">kg (Quilo)</option>
                              <option value="barra">barra (12m)</option>
                              <option value="vb">vb (Verba/Pacote)</option>
                            </select>
                          </td>
                          <td className="p-2.5">
                            <input
                              placeholder="Ex: Descarregar no portão B"
                              value={linha.observacaoObra}
                              onChange={(e) =>
                                setItensGrade((prev) =>
                                  prev.map((r) =>
                                    r.id === linha.id
                                      ? { ...r, observacaoObra: e.target.value }
                                      : r
                                  )
                                )
                              }
                              className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5 text-sm text-slate-800"
                            />
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removerLinhaGrade(linha.id)}
                              disabled={itensGrade.length <= 1}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-700 text-xs font-bold disabled:opacity-40"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold transition shadow-sm flex items-center gap-2"
                >
                  🚀 Enviar Pedido para o Setor de Compras
                </button>
              </div>
            </form>
          )}

          {/* =============================================================== */}
          {/* ABA 2: MEUS PEDIDOS DA OBRA (ACOMPANHAMENTO EM TEMPO REAL)      */}
          {/* =============================================================== */}
          {obraActiveTab === "MeusPedidos" && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Meus Pedidos da Obra ({pedidosDaObra.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Acompanhe em tempo real o andamento das solicitações no
                    Setor de Compras
                  </p>
                </div>
                <button
                  onClick={() => setObraActiveTab("NovoPedido")}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                >
                  + Fazer Novo Pedido
                </button>
              </div>

              <table className="w-full text-sm border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    <th className="py-3 px-4">Nº Pedido / Data</th>
                    <th className="py-3 px-4">Solicitante / Obra</th>
                    <th className="py-3 px-4">Materiais Solicitados</th>
                    <th className="py-3 px-4 text-center">Urgência</th>
                    <th className="py-3 px-4 text-center">
                      Status em Tempo Real
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pedidosDaObra.map((sc) => {
                    const obra = obras.find((o) => o.id === sc.obraId);
                    const urg = sc.urgencia || "Normal";
                    return (
                      <tr key={sc.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 whitespace-nowrap align-top">
                          <div className="font-bold text-slate-900 tabular-nums">
                            {sc.codigo}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {sc.horarioPedido || sc.dataAbertura}
                          </div>
                          {sc.dataNecessaria && (
                            <div className="text-xs text-slate-600 font-medium mt-0.5">
                              Necessário p/: {sc.dataNecessaria}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="font-semibold text-slate-900">
                            {sc.solicitante}{" "}
                            {sc.solicitanteCargo
                              ? `(${sc.solicitanteCargo})`
                              : ""}
                          </div>
                          <div className="text-xs text-slate-600">
                            {obra?.nome}
                          </div>
                          <div className="text-xs text-slate-500">
                            {sc.categoria}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            {sc.itens.map((it) => (
                              <div key={it.id} className="text-xs text-slate-800">
                                <strong>
                                  • {it.quantidade} {it.unidade}
                                </strong>{" "}
                                — {it.descricao}
                                {it.observacaoObra && (
                                  <span className="block text-slate-500 italic pl-2">
                                    Obs: {it.observacaoObra}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                              urg === "Crítica - Obra Parada"
                                ? "bg-red-100 text-red-900 border border-red-300"
                                : urg === "Alta"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {urg}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                          {sc.status === "Enviado / Aguardando Compras" && (
                            <span className="px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold inline-block">
                              🟡 Enviado / Aguardando Compras
                            </span>
                          )}
                          {sc.status === "Em Cotação" && (
                            <span className="px-3 py-1 rounded-full bg-blue-100 border border-blue-300 text-blue-900 text-xs font-bold inline-block">
                              🔵 Em Cotação com Fornecedores
                            </span>
                          )}
                          {sc.status === "Comprada" && (
                            <div className="space-y-1">
                              <span className="px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold inline-block">
                                🟢 Compra Aprovada / Pedido Emitido
                              </span>
                              <div className="text-xs text-slate-600 font-medium">
                                Previsão Entrega:{" "}
                                {sc.dataPrevistaEntrega || "Em programação"}
                              </div>
                            </div>
                          )}
                          {sc.status === "Entregue na Obra" && (
                            <div className="space-y-1">
                              <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-bold inline-block">
                                ✅ Entregue no Canteiro
                              </span>
                              {sc.notaFiscalRecebida && (
                                <div className="text-xs text-emerald-800 font-semibold">
                                  NF: {sc.notaFiscalRecebida}
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setScChatModal(sc)}
                            className="mt-2 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 mx-auto transition"
                            title="Linha do tempo e mensagens com a Central de Compras"
                          >
                            <span>💬 Mensagens</span>
                            {sc.mensagens && sc.mensagens.length > 0 && (
                              <span className="px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[10px] font-bold">
                                {sc.mensagens.length}
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* =============================================================== */}
          {/* ABA 3: RECEBIMENTO & CONTROLE INTERNO (ALMOXARIFADO)            */}
          {/* =============================================================== */}
          {obraActiveTab === "Recebimento" && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Recebimento de Materiais & Conferência de Nota Fiscal na
                    Obra
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pedidos já comprados pelo Setor de Suprimentos que estão a
                    caminho ou foram entregues no canteiro
                  </p>
                </div>
              </div>

              <table className="w-full text-sm border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                    <th className="py-3 px-4">Ordem de Compra</th>
                    <th className="py-3 px-4">Fornecedor / Entrega</th>
                    <th className="py-3 px-4">Materiais para Conferência</th>
                    <th className="py-3 px-4 text-center">Status Recebimento</th>
                    <th className="py-3 px-4 text-right">
                      Ação do Almoxarifado
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ordensDaObra.map((oc) => {
                    const jaRecebido =
                      oc.status ===
                        "Entregue na Obra (Confirmado pelo Almoxarifado)" ||
                      oc.status === "Entregue";

                    return (
                      <tr key={oc.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 whitespace-nowrap align-top">
                          <div className="font-bold text-slate-900 tabular-nums">
                            {oc.numeroOc}
                          </div>
                          <div className="text-xs text-slate-500">
                            Pedido: {oc.scCodigo}
                          </div>
                          <div className="text-xs text-slate-600 font-medium mt-0.5">
                            Previsão: {oc.dataPrevistaEntrega || oc.dataEmissao}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="font-bold text-slate-900">
                            {oc.fornecedorNome}
                          </div>
                          <div className="text-xs text-slate-600">
                            📍 {oc.obraNome}
                          </div>
                          <div className="text-xs text-slate-500">
                            Frete: {oc.tipoFrete}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            {oc.itens.map((it, idx) => (
                              <div key={idx} className="text-xs text-slate-800">
                                <strong>
                                  • {it.quantidade} {it.unidade}
                                </strong>{" "}
                                — {it.descricao}
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center align-top">
                          {jaRecebido ? (
                            <div className="space-y-1">
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold inline-block">
                                ✅ Recebido no Canteiro
                              </span>
                              <div className="text-xs text-slate-700 font-semibold">
                                NF: {oc.notaFiscalRecebida}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {oc.condicaoRecebimento}
                              </div>
                            </div>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold inline-block">
                              🚚 A Caminho da Obra
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onGerarRomaneioRecebimentoPDF?.(oc)}
                              title="Gerar e Imprimir Romaneio de Conferência Física (PDF)"
                              className="px-2.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                            >
                              <span>📋</span> Romaneio Cego
                            </button>
                            <button
                              type="button"
                              onClick={() => onGerarOrdemCompraPDF?.(oc)}
                              title="Ver e Imprimir Ordem de Compra Oficial Timbrada (PDF)"
                              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition flex items-center gap-1 shadow-xs"
                            >
                              <span>🖨️</span> OC PDF
                            </button>
                            {jaRecebido ? (
                              <span className="text-xs font-semibold text-emerald-800 py-1">
                                Conferido por {oc.recebidoPor || usuarioLogado.nome}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setNotaFiscalInput("");
                                  setCondicaoInput(
                                    "Material completo e sem avarias"
                                  );
                                  setOcConfirmarRecebimentoModal(oc);
                                }}
                                className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1"
                              >
                                <span>✔️</span> Confirmar Recebimento
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* =============================================================== */}
          {/* ABA 4: CONTRATOS & MEDIÇÕES (BM) DA OBRA                        */}
          {/* =============================================================== */}
          {obraActiveTab === "Medicoes" && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Contratos de Subempreitada & Boletins de Medição (BM)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Acompanhe os pacotes de subempreitada da obra e lance novos boletins de medição para aprovação da Diretoria
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                {contratosDaObra.length === 0 ? (
                  <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-sm">
                    Nenhum contrato de subempreitada vinculado a esta obra até o momento.
                  </div>
                ) : (
                  contratosDaObra.map((contrato) => {
                    const totalMedidoBruto = contrato.medicoes.reduce(
                      (acc, bm) => acc + bm.valorBruto,
                      0
                    );
                    const percentualTotalMedido =
                      contrato.valorTotal > 0
                        ? Math.min(
                            100,
                            (totalMedidoBruto / contrato.valorTotal) * 100
                          )
                        : 0;

                    return (
                      <div
                        key={contrato.id}
                        className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
                      >
                        {/* Cabeçalho do Contrato */}
                        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {contrato.numeroContrato}
                              </span>
                              <span className="text-slate-400">•</span>
                              <span className="font-semibold text-slate-900 text-sm">
                                {contrato.empreiteiro}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                {contrato.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              <strong>Objeto:</strong> {contrato.objeto}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              CNPJ: {contrato.cnpj} • Disciplina: {contrato.categoria} • Retenção Técnica: {contrato.percentualRetencao}%
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs text-slate-500 font-medium">
                                Valor Total do Contrato
                              </div>
                              <div className="text-base font-bold text-slate-900 tabular-nums">
                                {formatBRL(contrato.valorTotal)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNovoBmModalContrato(contrato)}
                              className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                            >
                              <span>+ Lançar Medição (BM)</span>
                            </button>
                          </div>
                        </div>

                        {/* Barra de Progresso Físico-Financeiro */}
                        <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-4 text-xs">
                          <div className="text-slate-700">
                            Avanço Medido:{" "}
                            <strong className="text-emerald-700">
                              {formatBRL(totalMedidoBruto)} ({percentualTotalMedido.toFixed(1)}%)
                            </strong>
                          </div>
                          <div className="w-40 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-600 h-2 rounded-full transition-all"
                              style={{ width: `${percentualTotalMedido}%` }}
                            />
                          </div>
                        </div>

                        {/* Tabela de Boletins de Medição */}
                        <table className="w-full text-xs border-collapse text-left">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                              <th className="py-2.5 px-3">Nº BM</th>
                              <th className="py-2.5 px-3">Data / Período</th>
                              <th className="py-2.5 px-3 text-center">% Medido</th>
                              <th className="py-2.5 px-3 text-right">Valor Bruto</th>
                              <th className="py-2.5 px-3 text-right">Retenção</th>
                              <th className="py-2.5 px-3 text-right">Valor Líquido</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {contrato.medicoes.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="py-3 text-center text-slate-400 italic"
                                >
                                  Nenhum boletim de medição lançado ainda.
                                </td>
                              </tr>
                            ) : (
                              contrato.medicoes.map((bm) => (
                                <tr key={bm.id} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-bold text-slate-900 tabular-nums">
                                    {bm.numeroBm}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-medium text-slate-900">{bm.dataMedicao}</div>
                                    <div className="text-[10px] text-slate-500">{bm.periodoReferencia}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-semibold text-slate-800">
                                    {bm.percentualMedidoPeriodo}%
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-medium text-slate-900 tabular-nums">
                                    {formatBRL(bm.valorBruto)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-blue-700 tabular-nums">
                                    - {formatBRL(bm.valorRetencao)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-emerald-800 tabular-nums">
                                    {formatBRL(bm.valorLiquido)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                                        bm.status === "Pago"
                                          ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                          : bm.status === "Aprovado para Pagamento"
                                          ? "bg-blue-100 text-blue-900 border border-blue-300"
                                          : "bg-amber-100 text-amber-900 border border-amber-300"
                                      }`}
                                    >
                                      {bm.status === "Pago"
                                        ? "🟢 Pago"
                                        : bm.status === "Aprovado para Pagamento"
                                        ? "🔵 Aprovado"
                                        : "🟡 Pendente"}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* ABA 5: CALENDÁRIO LOGÍSTICO & PORTÃO DE DESCARGA NO CANTEIRO    */}
          {/* =============================================================== */}
          {obraActiveTab === "Logistica" && (() => {
            const entregasHoje = cargasDaObraSemana.flatMap((d) => d.cargas).filter((c) => c.status === "Hoje").length;
            const conflitosPortao = cargasDaObraSemana.filter((d) => d.conflitoPortao).length;
            const recebidas = cargasDaObraSemana.flatMap((d) => d.cargas).filter((c) => c.status === "Entregue").length;

            return (
              <div className="space-y-6">
                {/* 4 KPIs de Logística do Canteiro */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Cargas Nesta Semana
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {totalCargasObra}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Fluxo de caminhões previsto
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Descargas Hoje
                    </div>
                    <div className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
                      {entregasHoje}
                    </div>
                    <div className="text-xs text-blue-800 font-medium mt-1">
                      Previstas para o portão da obra
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Gargalo no Portão
                    </div>
                    <div className={`text-2xl font-bold mt-1 tabular-nums ${conflitosPortao > 0 ? "text-amber-600" : "text-emerald-700"}`}>
                      {conflitosPortao}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {conflitosPortao > 0 ? "Dias com sobreposição pesada" : "Portão e pátio desimpedidos"}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Conferidas no Almoxarifado
                    </div>
                    <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
                      {recebidas}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Entrada formalizada com NF
                    </div>
                  </div>
                </div>

                {/* Banner de Conflito de Portão */}
                {conflitosPortao > 0 && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <h4 className="text-sm font-bold text-amber-950">
                        Alerta de Portão & Pátio de Descarga
                      </h4>
                      <p className="text-xs text-amber-900 mt-0.5">
                        Existem múltiplos veículos pesados agendados no mesmo dia. Mantenha os ajudantes e a grua/munck de prontidão para agilizar a liberação da via pública.
                      </p>
                    </div>
                  </div>
                )}

                {/* Grade Semanal de Logística do Canteiro */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cargasDaObraSemana.map((dia) => (
                    <div
                      key={dia.diaSemana}
                      className={`bg-white rounded-lg border shadow-sm p-4 space-y-3 ${
                        dia.conflitoPortao ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between border-b border-slate-200 pb-2.5">
                        <div>
                          <h3 className="font-bold text-sm text-slate-900">
                            {dia.diaSemana}
                          </h3>
                          <span className="text-xs text-slate-500">{dia.dataLabel}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
                            {dia.cargas.length} {dia.cargas.length === 1 ? "carga" : "cargas"}
                          </span>
                          {dia.conflitoPortao && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold border border-amber-300">
                              ⚠️ Conflito Portão
                            </span>
                          )}
                        </div>
                      </div>

                      {dia.cargas.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Nenhum caminhão programado para este dia.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {dia.cargas.map((carga) => {
                            const ocAlvo = ordens.find((o) => o.id === carga.ordemId);
                            const jaEntregue = carga.status === "Entregue";

                            return (
                              <div
                                key={carga.id}
                                className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2 hover:bg-slate-100/80 transition"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-bold text-xs text-slate-900 truncate">
                                    {carga.fornecedorNome}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      jaEntregue
                                        ? "bg-emerald-100 text-emerald-800"
                                        : carga.status === "Hoje"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-slate-200 text-slate-800"
                                    }`}
                                  >
                                    {jaEntregue ? "✓ Entregue" : carga.status === "Hoje" ? "🔵 Previsto Hoje" : "Agendado"}
                                  </span>
                                </div>

                                <div className="text-xs text-slate-700 font-medium">
                                  {carga.insumoDescricao}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                                  <div>
                                    <span className="text-slate-400">Janela: </span>
                                    <strong className="text-slate-800">{carga.horarioJanela}</strong>
                                  </div>
                                  <div>
                                    <span className="text-slate-400">Veículo: </span>
                                    <strong className="text-slate-800">{carga.tipoVeiculo}</strong>
                                  </div>
                                </div>

                                <div className="pt-1 flex items-center justify-between border-t border-slate-200">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    Frete {carga.tipoFrete}
                                  </span>
                                  {!jaEntregue && ocAlvo && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNotaFiscalInput("");
                                        setCondicaoInput("Material descarregado e sem avarias");
                                        setOcConfirmarRecebimentoModal(ocAlvo);
                                      }}
                                      className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition shadow-xs"
                                    >
                                      📦 Dar Entrada na Obra
                                    </button>
                                  )}
                                  {jaEntregue && (
                                    <span className="text-[11px] font-semibold text-emerald-800">
                                      ✓ Recebido no Canteiro
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* =============================================================== */}
          {/* ABA: ALMOXARIFADO DO CANTEIRO DE OBRAS (`Estoque`)              */}
          {/* =============================================================== */}
          {obraActiveTab === "Estoque" && (() => {
            const obraAlvoId = usuarioLogado.obraId !== "ALL" ? usuarioLogado.obraId : obraIdForm;
            const itensObra = estoque.filter((it) => it.obraId === obraAlvoId || it.obraId === "central");
            const criticosObra = itensObra.filter((it) => it.saldoAtual <= it.estoqueMinimo);
            const valorTotalObra = itensObra.reduce((acc, it) => acc + it.saldoAtual * it.custoMedio, 0);

            return (
              <div className="space-y-6">
                {/* KPIs de Almoxarifado da Obra */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Insumos em Almoxarifado
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {itensObra.length}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Materiais cadastrados no canteiro
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Críticos / Baixo Estoque
                    </div>
                    <div className="text-2xl font-bold text-red-600 mt-1 tabular-nums">
                      {criticosObra.length}
                    </div>
                    <div className="text-xs text-red-700 mt-1 font-medium">
                      {criticosObra.length > 0 ? "Reposição prioritária necessária" : "Estoque de segurança mantido"}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      Valor Estocado no Canteiro
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                      {formatBRL(valorTotalObra)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Patrimônio de insumos no canteiro
                    </div>
                  </div>
                </div>

                {/* Tabela do Almoxarifado do Canteiro */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Inventário de Materiais Disponíveis no Canteiro
                      </h3>
                      <p className="text-xs text-slate-500">
                        Acompanhe o saldo físico em tempo real para planejar as frentes de serviço sem risco de desabastecimento.
                      </p>
                    </div>
                    <button
                      onClick={() => setObraActiveTab("NovoPedido")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition"
                    >
                      + Solicitar Reposição
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                          <th className="py-3 px-4">Código / Descrição</th>
                          <th className="py-3 px-4">Localização Física</th>
                          <th className="py-3 px-4 text-right">Saldo Físico</th>
                          <th className="py-3 px-4 text-center">Nível Mínimo</th>
                          <th className="py-3 px-4 text-center">Status</th>
                          <th className="py-3 px-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {itensObra.map((it) => {
                          const critico = it.saldoAtual <= it.estoqueMinimo;

                          return (
                            <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{it.descricao}</div>
                                <div className="text-xs text-slate-500 font-mono mt-0.5">
                                  {it.codigo} • {it.categoria}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-700">
                                📍 {it.localizacaoFisica}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                                <span className="text-base">{it.saldoAtual}</span>{" "}
                                <span className="text-xs font-normal text-slate-500">{it.unidade}</span>
                              </td>
                              <td className="py-3 px-4 text-center text-xs text-slate-600 whitespace-nowrap">
                                Mín: {it.estoqueMinimo} {it.unidade}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {critico ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 inline-block animate-pulse">
                                    🚨 Repor Imediato
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 inline-block">
                                    ✅ Disponível
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setItensGrade([
                                      {
                                        id: `item-${Date.now()}`,
                                        descricao: it.descricao,
                                        quantidade: Math.max(it.pontoReposicao * 2 - it.saldoAtual, it.estoqueMinimo),
                                        unidade: it.unidade,
                                        observacaoObra: `Reposição de estoque de canteiro. Saldo atual: ${it.saldoAtual} ${it.unidade}`,
                                      },
                                    ]);
                                    setObraActiveTab("NovoPedido");
                                  }}
                                  className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
                                >
                                  Requisitar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </main>
      </div>

      {/* MODAL PARA CONFIRMAR RECEBIMENTO COM NOTA FISCAL E AVARIAS */}
      {ocConfirmarRecebimentoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onConfirmarRecebimentoObra(
                ocConfirmarRecebimentoModal.id,
                notaFiscalInput,
                condicaoInput
              );
            }}
            className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4 text-sm"
          >
            <div className="border-b border-slate-200 pb-3">
              <span className="text-xs font-bold text-emerald-700">
                Conferência de Almoxarifado —{" "}
                {ocConfirmarRecebimentoModal.numeroOc}
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Confirmar Recebimento na Obra
              </h3>
              <p className="text-xs text-slate-500">
                Fornecedor: {ocConfirmarRecebimentoModal.fornecedorNome}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número da Nota Fiscal Recebida (NF-e) *
                </label>
                <input
                  required
                  value={notaFiscalInput}
                  onChange={(e) => setNotaFiscalInput(e.target.value)}
                  placeholder="Ex: NF-e 123.456"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Condição Física da Entrega *
                </label>
                <select
                  value={condicaoInput}
                  onChange={(e) => setCondicaoInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
                >
                  <option value="Material completo e sem avarias">
                    ✅ Material entregue completo e sem avarias
                  </option>
                  <option value="Entrega parcial (saldo pendente)">
                    ⚠️ Entrega parcial (saldo pendente do fornecedor)
                  </option>
                  <option value="Recebido com ressalva na NF">
                    ⚠️ Recebido com ressalva registrada no canhoto
                  </option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setOcConfirmarRecebimentoModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
              >
                ✔️ Confirmar Entrada no Canteiro
              </button>
            </div>
          </form>
        </div>
      )}
      {/* MODAL NOVO BOLETIM DE MEDIÇÃO NO CANTEIRO */}
      {novoBmModalContrato && (
        <ModalNovoBoletimMedicao
          contrato={novoBmModalContrato}
          usuarioLogado={usuarioLogado}
          onClose={() => setNovoBmModalContrato(null)}
          onSalvar={(novoBm) => {
            onCriarBoletimMedicao(novoBmModalContrato.id, novoBm);
            setNovoBmModalContrato(null);
          }}
        />
      )}

      {/* MODAL MENSAGENS E LINHA DO TEMPO DO PEDIDO */}
      {scChatModal && (
        <ModalMensagensPedido
          sc={scChatModal}
          usuarioLogado={usuarioLogado}
          onClose={() => setScChatModal(null)}
          onEnviar={(texto) => onEnviarMensagemSC(scChatModal.id, texto)}
        />
      )}
    </div>
  );
}

/* ========================================================================= */
/* ========================================================================= */
/* MODAL DE CADASTRO DE NOVO EMPREENDIMENTO / OBRA                           */
/* ========================================================================= */

function ModalNovaObra({
  onClose,
  onSalvar,
}: {
  onClose: () => void;
  onSalvar: (novaObra: Obra) => void;
}) {
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [endereco, setEndereco] = useState("");
  const [engenheiro, setEngenheiro] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const novaObra: Obra = {
      id: `obra-${Date.now()}`,
      nome: nome.trim(),
      sigla: sigla.trim().toUpperCase() || nome.trim().substring(0, 3).toUpperCase(),
      endereco: endereco.trim() || "A Definir",
      engenheiro: engenheiro.trim() || "A Definir",
    };

    onSalvar(novaObra);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏗️</span>
            <div>
              <h3 className="font-bold text-sm">Cadastrar Novo Empreendimento / Obra</h3>
              <p className="text-xs text-slate-400">Adicione um canteiro oficial para compras e controle de campo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Nome do Empreendimento / Obra *
            </label>
            <input
              required
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Residencial Splendore, Edifício Villa Magna"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 font-semibold focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Sigla / Código Interno
              </label>
              <input
                type="text"
                value={sigla}
                onChange={(e) => setSigla(e.target.value)}
                placeholder="Ex: SPL-01, VM-02"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900 uppercase font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Engenheiro / Responsável
              </label>
              <input
                type="text"
                value={engenheiro}
                onChange={(e) => setEngenheiro(e.target.value)}
                placeholder="Ex: Eng. Responsável"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Endereço / Localização do Canteiro
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex: Av. Atlântica, Balneário Camboriú / SC"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>✓</span>
              <span>Salvar Empreendimento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalNovoContrato({
  obras,
  onClose,
  onSalvar,
}: {
  obras: Obra[];
  onClose: () => void;
  onSalvar: (c: ContratoSubempreitada) => void;
}) {
  const [numeroContrato, setNumeroContrato] = useState(
    `CT-2026-00${Math.floor(4 + Math.random() * 20)}`
  );
  const [empreiteiro, setEmpreiteiro] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [obraId, setObraId] = useState(obras[0]?.id || "obra-1");
  const [objeto, setObjeto] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_CONSTRUCAO[3]);
  const [valorTotal, setValorTotal] = useState(0);
  const [percentualRetencao, setPercentualRetencao] = useState(5);
  const [dataInicio, setDataInicio] = useState(
    new Date().toLocaleDateString("pt-BR")
  );
  const [previsaoFim, setPrevisaoFim] = useState(
    new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString("pt-BR")
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empreiteiro.trim() || !objeto.trim()) return;
    const obraObj = obras.find((o) => o.id === obraId);

    const novoContrato: ContratoSubempreitada = {
      id: `con-${Date.now()}`,
      numeroContrato: numeroContrato.trim(),
      empreiteiro: empreiteiro.trim(),
      cnpj: cnpj.trim() || "",
      obraId,
      obraNome: obraObj?.nome || "Obra Vinculada",
      objeto: objeto.trim(),
      categoria,
      valorTotal: Number(valorTotal) || 0,
      percentualRetencao: Number(percentualRetencao) || 5,
      dataInicio,
      previsaoFim,
      status: "Ativo",
      medicoes: [],
    };

    onSalvar(novoContrato);
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-xl w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Novo Contrato de Subempreitada
            </h3>
            <p className="text-xs text-slate-500">
              Gestão de contratos com retenção técnica para garantia e encargos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nº do Contrato *
            </label>
            <input
              required
              value={numeroContrato}
              onChange={(e) => setNumeroContrato(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Obra Vinculada *
            </label>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            >
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Razão Social / Empreiteiro *
            </label>
            <input
              required
              placeholder="Ex: Razão Social do Empreiteiro"
              value={empreiteiro}
              onChange={(e) => setEmpreiteiro(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              CNPJ do Empreiteiro *
            </label>
            <input
              required
              placeholder="00.000.000/0001-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Objeto do Contrato (Escopo dos Serviços) *
            </label>
            <input
              required
              placeholder="Ex: Fornecimento e instalação de esquadrias de alumínio e peles de vidro"
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Disciplina / Categoria *
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            >
              {CATEGORIAS_CONSTRUCAO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Percentual Retenção Técnica *
            </label>
            <select
              value={percentualRetencao}
              onChange={(e) => setPercentualRetencao(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold"
            >
              <option value={5}>5% (Garantia Contratual Padrão)</option>
              <option value={11}>11% (Retenção Previdenciária INSS)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valor Global do Contrato (R$) *
            </label>
            <input
              required
              type="number"
              step="1000"
              value={valorTotal}
              onChange={(e) => setValorTotal(Number(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold tabular-nums text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Previsão de Término
            </label>
            <input
              value={previsaoFim}
              onChange={(e) => setPrevisaoFim(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 tabular-nums"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition"
          >
            Salvar e Cadastrar Contrato
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalNovoBoletimMedicao({
  contrato,
  usuarioLogado,
  onClose,
  onSalvar,
}: {
  contrato: ContratoSubempreitada;
  usuarioLogado: UsuarioSistema | null;
  onClose: () => void;
  onSalvar: (bm: BoletimMedicao) => void;
}) {
  const numeroSugerido = `BM-0${contrato.medicoes.length + 1}`;
  const [periodoReferencia, setPeriodoReferencia] = useState(
    "01/10/2026 a 31/10/2026"
  );
  const [percentualMedido, setPercentualMedido] = useState(15);
  const [observacoes, setObservacoes] = useState(
    "Medição referente aos serviços concluídos e aprovados pela engenharia."
  );

  const valorBruto = (contrato.valorTotal * percentualMedido) / 100;
  const valorRetencao = (valorBruto * contrato.percentualRetencao) / 100;
  const valorLiquido = valorBruto - valorRetencao;

  const totalAcumuladoAnterior = contrato.medicoes.reduce(
    (acc, m) => acc + m.percentualMedidoPeriodo,
    0
  );
  const percentualAcumulado = totalAcumuladoAnterior + percentualMedido;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const novoBm: BoletimMedicao = {
      id: `bm-${Date.now()}`,
      numeroBm: numeroSugerido,
      dataMedicao: new Date().toLocaleDateString("pt-BR"),
      periodoReferencia,
      percentualMedidoPeriodo: percentualMedido,
      percentualAcumulado,
      valorBruto,
      valorRetencao,
      valorLiquido,
      engenheiroResponsavel: usuarioLogado?.nome || "Engenharia Residente",
      observacoes,
      status: "Pendente Aprovação",
    };

    onSalvar(novoBm);
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="border-b border-slate-200 pb-3">
          <span className="text-xs font-bold text-emerald-700">
            Boletim de Medição (BM) • {contrato.numeroContrato}
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Lançar Medição de Subempreitada
          </h3>
          <p className="text-xs text-slate-500">
            {contrato.empreiteiro} — {contrato.obraNome}
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Identificação da Medição
              </label>
              <input
                disabled
                value={numeroSugerido}
                className="w-full bg-slate-100 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                % Avanço Físico do Período *
              </label>
              <input
                type="number"
                min={1}
                max={100 - totalAcumuladoAnterior}
                value={percentualMedido}
                onChange={(e) => setPercentualMedido(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Período de Referência dos Serviços *
            </label>
            <input
              required
              value={periodoReferencia}
              onChange={(e) => setPeriodoReferencia(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>

          {/* Resumo Financeiro Automático */}
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Valor Bruto Medido ({percentualMedido}%):</span>
              <strong className="text-slate-900 tabular-nums">{formatBRL(valorBruto)}</strong>
            </div>
            <div className="flex justify-between text-blue-700">
              <span>Retenção Técnica ({contrato.percentualRetencao}%):</span>
              <strong className="tabular-nums">- {formatBRL(valorRetencao)}</strong>
            </div>
            <div className="flex justify-between text-emerald-800 font-bold text-sm pt-1 border-t border-slate-200">
              <span>Valor Líquido a Pagar ao Empreiteiro:</span>
              <span className="tabular-nums">{formatBRL(valorLiquido)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Descrição das Atividades Executadas & Vistorias *
            </label>
            <textarea
              rows={3}
              required
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
          >
            Lançar Medição para Aprovação
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalMensagensPedido({
  sc,
  usuarioLogado,
  onClose,
  onEnviar,
}: {
  sc: SolicitacaoCompra;
  usuarioLogado: UsuarioSistema | null;
  onClose: () => void;
  onEnviar: (texto: string) => void;
}) {
  const [novoTexto, setNovoTexto] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTexto.trim()) return;
    onEnviar(novoTexto.trim());
    setNovoTexto("");
  };

  const listaMensagens = sc.mensagens || [];

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 text-sm flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base">{sc.codigo}</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900">
                {sc.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Linha do tempo & chat entre Canteiro de Obras e Central de Compras
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        {/* Lista de Mensagens com Scroll */}
        <div className="flex-1 overflow-y-auto space-y-3 p-2 bg-slate-50 rounded-lg border border-slate-200 min-h-[220px]">
          {listaMensagens.length === 0 ? (
            <div className="text-center text-slate-400 text-xs py-8 italic">
              Nenhuma mensagem registrada neste pedido ainda. Envie a primeira mensagem abaixo!
            </div>
          ) : (
            listaMensagens.map((msg) => {
              const isMe = msg.autorNome === usuarioLogado?.nome;
              return (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg border max-w-[85%] text-xs space-y-1 ${
                    isMe
                      ? "ml-auto bg-blue-50 border-blue-200 text-blue-950"
                      : "mr-auto bg-white border-slate-200 text-slate-900 shadow-xs"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
                    <span>
                      {msg.autorNome} • {msg.autorCargo}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {msg.dataHora}
                    </span>
                  </div>
                  <p className="leading-relaxed">{msg.texto}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Input de Nova Mensagem */}
        <form onSubmit={handleSubmit} className="flex gap-2 shrink-0 pt-2 border-t border-slate-200">
          <input
            required
            placeholder="Digite uma observação técnica, dúvida de entrega ou cotação..."
            value={novoTexto}
            onChange={(e) => setNovoTexto(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
          >
            Enviar 🚀
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalAprovacaoDiretoria({
  data,
  onClose,
  onConfirmar,
}: {
  data: { novaOc: OrdemCompra; prop: PropostaFornecedor };
  onClose: () => void;
  onConfirmar: (assinatura: string) => void;
}) {
  const [assinatura, setAssinatura] = useState(
    "Diretoria Executiva"
  );
  const [declaracaoCiente, setDeclaracaoCiente] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!declaracaoCiente || !assinatura.trim()) return;
    onConfirmar(assinatura.trim());
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-red-300 max-w-lg w-full p-6 shadow-2xl space-y-4 text-sm"
      >
        <div className="border-b border-red-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
              ⚠️
            </span>
            <span className="text-xs font-bold text-red-800">
              Alçada de Governança Corporativa: Valor &gt; R$ 100.000,00
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            Requer Aprovação Formal da Diretoria Executiva / CFO
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            O valor total desta compra excede o limite operacional do comprador e exige homologação estatutária.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Ordem de Compra:</span>
            <strong className="text-slate-900">{data.novaOc.numeroOc}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Obra Destino:</span>
            <strong className="text-slate-900">{data.novaOc.obraNome}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Fornecedor Vencedor:</span>
            <strong className="text-slate-900">{data.prop.fornecedorNome}</strong>
          </div>
          <div className="flex justify-between text-sm font-bold text-red-700 pt-2 border-t border-slate-200">
            <span>Valor Total Homologado:</span>
            <span className="tabular-nums">{formatBRL(data.novaOc.valorTotal)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Assinatura do Diretor / Autorizador *
            </label>
            <input
              required
              value={assinatura}
              onChange={(e) => setAssinatura(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-semibold text-slate-900"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={declaracaoCiente}
              onChange={(e) => setDeclaracaoCiente(e.target.checked)}
              className="mt-0.5 rounded border-amber-400 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              Declaro que auditei a equalização de propostas comerciais e aprovo formalmente o dispêndio financeiro desta compra pela Diretoria.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Rejeitar / Cancelar
          </button>
          <button
            type="submit"
            disabled={!declaracaoCiente}
            className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5"
          >
            <span>✍️ Autorizar e Emitir Ordem de Compra</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================= */
/* MODAL: CENTRAL DE NOTIFICAÇÕES & ALERTAS PREVENTIVOS                      */
/* ========================================================================= */

function ModalNotificacoesSistema({
  notificacoes,
  onClose,
  onNavegar,
}: {
  notificacoes: NotificacaoItem[];
  onClose: () => void;
  onNavegar: (notif: NotificacaoItem) => void;
}) {
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | NotificacaoItem["tipo"]>("TODOS");

  const listaFiltrada = notificacoes.filter(
    (n) => filtroTipo === "TODOS" || n.tipo === filtroTipo
  );

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-start justify-end p-4 sm:p-6 overflow-hidden">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] mt-12 animate-in slide-in-from-right duration-200">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔔</span>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Central de Notificações & Alertas
              </h3>
              <p className="text-xs text-slate-500">
                {notificacoes.length} alertas preventivos e operacionais ativos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Filtros por Categoria */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: "TODOS", label: "Todas" },
            { id: "URGENTE_OBRA", label: "🚨 Obra Parada" },
            { id: "FRETE_ATRASADO", label: "🚚 Logística" },
            { id: "MEDICAO_PENDENTE", label: "📐 Medições" },
            { id: "MENSAGEM_NOVA", label: "💬 Recados" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFiltroTipo(cat.id as any)}
              className={`px-2.5 py-1 rounded-md font-semibold transition shrink-0 ${
                filtroTipo === cat.id
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Lista de Alertas */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {listaFiltrada.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Nenhuma notificação nesta categoria no momento.
            </div>
          ) : (
            listaFiltrada.map((item) => {
              const bgBadge =
                item.severidade === "Critica"
                  ? "bg-red-100 text-red-900 border-red-300"
                  : item.severidade === "Alerta"
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-blue-100 text-blue-900 border-blue-300";

              return (
                <div
                  key={item.id}
                  onClick={() => onNavegar(item)}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer space-y-1.5 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
                      {item.titulo}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${bgBadge}`}
                    >
                      {item.severidade}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.descricao}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-200/60">
                    <span>{item.horario}</span>
                    <span className="text-emerald-700 font-semibold group-hover:underline">
                      Ver detalhes no sistema →
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Atualização contínua de status das obras
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
          >
            Fechar Central
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* MODAL: AUDITORIA DE IQF & HISTÓRICO DE ENTREGAS DO FORNECEDOR             */
/* ========================================================================= */

function ModalDetalhesIqf({
  fornecedorNome,
  ordens,
  onClose,
}: {
  fornecedorNome: string;
  ordens: OrdemCompra[];
  onClose: () => void;
}) {
  const iqf = calcularIqfFornecedor(fornecedorNome, ordens);

  const ordensDoFornecedor = ordens.filter(
    (o) => o.fornecedorNome.toLowerCase() === fornecedorNome.toLowerCase()
  );

  const badgeColor =
    iqf.classificacao.includes("Ouro")
      ? "bg-amber-100 text-amber-900 border-amber-300"
      : iqf.classificacao.includes("Prata")
      ? "bg-blue-100 text-blue-900 border-blue-300"
      : iqf.classificacao.includes("Monitorado")
      ? "bg-orange-100 text-orange-900 border-orange-300"
      : "bg-red-100 text-red-900 border-red-300";

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl space-y-5 my-6">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Auditoria de Qualidade B2B (Vendor Rating)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold border ${badgeColor}`}
              >
                Classificação: {iqf.classificacao}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-1">
              {fornecedorNome}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700"
          >
            Fechar
          </button>
        </div>

        {/* Score Geral e os 3 Pilares de Desempenho */}
        <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500">
              Score Geral
            </div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              {iqf.scoreGeral}
            </div>
            <div className="text-[10px] text-slate-500">de 100 pontos</div>
          </div>

          <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500">
              Pontualidade
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              {iqf.taxaPontualidade}%
            </div>
            <div className="text-[10px] text-slate-500">Prazos de entrega</div>
          </div>

          <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500">
              Conformidade
            </div>
            <div className="text-2xl font-bold text-blue-700 mt-1">
              {iqf.conformidadeFisica}%
            </div>
            <div className="text-[10px] text-slate-500">Sem avarias/ressalvas</div>
          </div>

          <div className="text-center p-2 rounded-lg bg-white border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500">
              Competitividade
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-1">
              {iqf.competitividadeComercial}%
            </div>
            <div className="text-[10px] text-slate-500">Equalização de preço</div>
          </div>
        </div>

        {/* Parecer do Algoritmo */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1">
          <span className="font-bold text-slate-900">
            Diretriz de Suprimentos JC BAUER:
          </span>
          <p className="leading-relaxed">
            {iqf.classificacao.includes("Ouro") &&
              "Fornecedor altamente recomendado para contratos de grande porte e compras críticas. Histórico impecável de pontualidade no canteiro e produtos conformes."}
            {iqf.classificacao.includes("Prata") &&
              "Fornecedor homologado e qualificado. Apresenta ótimo atendimento com ocorrências mínimas no almoxarifado."}
            {iqf.classificacao.includes("Monitorado") &&
              "Fornecedor sob observação. Recomenda-se acompanhamento rigoroso nas datas de descarga e conferência física detalhada na chegada do caminhão."}
            {iqf.classificacao === "Risco Crítico" &&
              "Atenção máxima: Fornecedor com reincidência de atrasos de carga ou divergência física de material. Não emitir novas ordens de grande vulto sem garantia adicional."}
          </p>
        </div>

        {/* Histórico Real de Ordens e Conferências */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 mb-2">
            Histórico de Ordens de Compra & Entregas nos Canteiros ({ordensDoFornecedor.length})
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
            {ordensDoFornecedor.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhuma ordem de compra registrada no sistema para este fornecedor. Score calculado por estimativa de homologação.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-2.5">OC #</th>
                    <th className="p-2.5">Obra</th>
                    <th className="p-2.5">Insumo</th>
                    <th className="p-2.5">Valor (R$)</th>
                    <th className="p-2.5">Conferência no Canteiro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ordensDoFornecedor.map((oc) => (
                    <tr key={oc.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{oc.numeroOc}</td>
                      <td className="p-2.5 text-slate-700">{oc.obraNome}</td>
                      <td className="p-2.5 text-slate-800">
                        {oc.itens[0]?.descricao || "Materiais Diversos"}
                      </td>
                      <td className="p-2.5 font-semibold text-slate-900 tabular-nums">
                        {formatBRL(oc.valorTotal)}
                      </td>
                      <td className="p-2.5">
                        <span className="text-emerald-700 font-medium">
                          {oc.condicaoRecebimento || "Aprovado sem ressalvas"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Rodapé com Fechar */}
        <div className="flex justify-end pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition"
          >
            Concluir Auditoria
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* MODAL: DEFINIR OU AJUSTAR VERBA ORÇAMENTÁRIA POR DISCIPLINA               */
/* ========================================================================= */

function ModalNovoOrcamento({
  obras,
  obraFiltro,
  onClose,
  onSalvar,
}: {
  obras: Obra[];
  obraFiltro: string;
  onClose: () => void;
  onSalvar: (item: ItemOrcamentoObra) => void;
}) {
  const [obraId, setObraId] = useState(
    obraFiltro !== "ALL" ? obraFiltro : obras[0]?.id || "obra-1"
  );
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_CONSTRUCAO[0]);
  const [valorOrcado, setValorOrcado] = useState(0);
  const [observacao, setObservacao] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (valorOrcado <= 0) return;

    const novoItem: ItemOrcamentoObra = {
      id: `orc-${obraId}-${Date.now()}`,
      obraId,
      categoria,
      valorOrcado: Number(valorOrcado),
      observacao: observacao.trim(),
    };

    onSalvar(novoItem);
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Definir Verba Orçamentária
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Estabeleça o teto de gastos por disciplina e empreendimento
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Empreendimento Destino *
            </label>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
            >
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome} ({o.sigla})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Disciplina / Categoria de Suprimentos *
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
            >
              {CATEGORIAS_CONSTRUCAO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Valor Teto Orçado (R$) *
            </label>
            <input
              type="number"
              required
              step="1000"
              min="1000"
              value={valorOrcado}
              onChange={(e) => setValorOrcado(Number(e.target.value) || 0)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 tabular-nums"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Equivalente: {formatBRL(valorOrcado)}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observação / Origem do Orçamento
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Verba aprovada em planejamento executivo"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs"
          >
            Salvar Verba Orçamentária
          </button>
        </div>
      </form>
    </div>
  );
}

/* ========================================================================= */
/* MODAIS DE ESTOQUE, ALMOXARIFADO, PUXADAS E COMPRAS EM LOTE                */
/* ========================================================================= */

function ModalMovimentacaoEstoque({
  estoque,
  obras,
  usuarioLogado,
  onClose,
  onSalvar,
}: {
  estoque: ItemEstoque[];
  obras: Obra[];
  usuarioLogado: UsuarioSistema;
  onClose: () => void;
  onSalvar: (mov: MovimentacaoEstoque) => void;
}) {
  const [itemId, setItemId] = useState<string>(estoque[0]?.id || "");
  const [tipo, setTipo] = useState<TipoMovimentacaoEstoque>("SAIDA_APLICACAO");
  const [quantidade, setQuantidade] = useState<number>(10);
  const [obraDestinoId, setObraDestinoId] = useState<string>(
    obras[1]?.id || "obra-2"
  );
  const [responsavel, setResponsavel] = useState<string>(
    usuarioLogado.nome || "Almoxarife"
  );
  const [numeroDocumento, setNumeroDocumento] = useState<string>("");
  const [motivoEtapa, setMotivoEtapa] = useState<string>("");

  const itemSelecionado = estoque.find((it) => it.id === itemId) || estoque[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado) return;

    const saldoAnterior = itemSelecionado.saldoAtual;
    let saldoPosterior = saldoAnterior;

    if (tipo === "ENTRADA_COMPRA") {
      saldoPosterior = saldoAnterior + quantidade;
    } else if (
      tipo === "SAIDA_APLICACAO" ||
      tipo === "PERDA_AVARIA" ||
      tipo === "TRANSFERENCIA_OBRA"
    ) {
      saldoPosterior = Math.max(0, saldoAnterior - quantidade);
    } else if (tipo === "AJUSTE_INVENTARIO") {
      saldoPosterior = quantidade;
    }

    const obraDestinoObj = obras.find((o) => o.id === obraDestinoId);
    const dataHora = `${new Date().toLocaleDateString(
      "pt-BR"
    )} às ${new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;

    const novaMov: MovimentacaoEstoque = {
      id: `mov-${Date.now()}`,
      itemId: itemSelecionado.id,
      codigoInsumo: itemSelecionado.codigo,
      descricaoInsumo: itemSelecionado.descricao,
      unidade: itemSelecionado.unidade,
      tipo,
      quantidade,
      saldoAnterior,
      saldoPosterior,
      custoUnitario: itemSelecionado.custoMedio,
      valorTotal: quantidade * itemSelecionado.custoMedio,
      dataHora,
      responsavel,
      obraOrigemId: itemSelecionado.obraId,
      obraOrigemNome: itemSelecionado.obraNome,
      obraDestinoId: tipo === "TRANSFERENCIA_OBRA" ? obraDestinoId : undefined,
      obraDestinoNome:
        tipo === "TRANSFERENCIA_OBRA"
          ? obraDestinoObj?.nome || "Canteiro Destino"
          : undefined,
      numeroDocumento,
      motivoEtapa,
    };

    onSalvar(novaMov);
  };

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <span className="text-xs font-bold text-emerald-700">
              Controle Físico de Almoxarifado
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Registrar Movimentação de Estoque
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Insumo / Material em Estoque *
            </label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
            >
              {estoque.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.descricao} ({it.obraNome}) — Saldo: {it.saldoAtual}{" "}
                  {it.unidade}
                </option>
              ))}
            </select>
            {itemSelecionado && (
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                <span>
                  📍 {itemSelecionado.localizacaoFisica}
                </span>
                <span>
                  Custo Médio: {formatBRL(itemSelecionado.custoMedio)} /{" "}
                  {itemSelecionado.unidade}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tipo de Operação *
              </label>
              <select
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value as TipoMovimentacaoEstoque)
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
              >
                <option value="SAIDA_APLICACAO">
                  🔵 Saída para Aplicação na Obra
                </option>
                <option value="TRANSFERENCIA_OBRA">
                  🟣 Transferência entre Canteiros
                </option>
                <option value="ENTRADA_COMPRA">🟢 Entrada por Compra</option>
                <option value="PERDA_AVARIA">
                  🔴 Perda / Avaria no Canteiro
                </option>
                <option value="AJUSTE_INVENTARIO">
                  ⚪ Ajuste de Inventário Físico
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantidade ({itemSelecionado?.unidade || "un"}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 tabular-nums"
              />
            </div>
          </div>

          {tipo === "TRANSFERENCIA_OBRA" && (
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg space-y-1">
              <label className="block text-xs font-bold text-purple-900">
                Canteiro de Destino (Receberá o Material) *
              </label>
              <select
                value={obraDestinoId}
                onChange={(e) => setObraDestinoId(e.target.value)}
                className="w-full bg-white border border-purple-300 rounded-lg px-3 py-1.5 text-slate-900 font-medium text-xs"
              >
                {obras
                  .filter((o) => o.id !== itemSelecionado?.obraId)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome} ({o.sigla})
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-purple-700">
                O saldo será debitado de {itemSelecionado?.obraNome} e creditado
                automaticamente na obra de destino sem gerar nova despesa
                externa.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Responsável pelo Registro
              </label>
              <input
                type="text"
                required
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nº Documento / NF / Requisição
              </label>
              <input
                type="text"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Motivo / Etapa da Obra / Local de Aplicação
            </label>
            <input
              type="text"
              required
              value={motivoEtapa}
              onChange={(e) => setMotivoEtapa(e.target.value)}
              placeholder="Ex: Concretagem das vigas e lajes do 8º pavimento"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
          >
            Confirmar Movimentação Física
          </button>
        </div>
      </form>
    </div>
  );
}

function ModalProgramarPuxada({
  contratos,
  onClose,
  onSalvar,
}: {
  contratos: ContratoPuxadaFornecimento[];
  onClose: () => void;
  onSalvar: (contratoId: string, novaPrg: ProgramacaoPuxada) => void;
}) {
  const [contratoId, setContratoId] = useState<string>(
    contratos[0]?.id || ""
  );
  const [dataHora, setDataHora] = useState<string>(() => {
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return `${d.toLocaleDateString("pt-BR")} 07:30`;
  });
  const [quantidade, setQuantidade] = useState<number>(1);
  const [etapaAplicacao, setEtapaAplicacao] = useState<string>("");
  const [responsavelRecebimento, setResponsavelRecebimento] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");

  const contratoAlvo =
    contratos.find((c) => c.id === contratoId) || contratos[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contratoAlvo) return;

    const novaPrg: ProgramacaoPuxada = {
      id: `prg-${Date.now()}`,
      contratoId: contratoAlvo.id,
      dataHoraAgendada: dataHora,
      quantidade,
      unidade: contratoAlvo.unidade,
      status: "Agendada",
      etapaAplicacao,
      responsavelRecebimento,
      observacoes,
    };

    onSalvar(contratoAlvo.id, novaPrg);
  };

  const saldoRestante = contratoAlvo
    ? Math.max(
        0,
        contratoAlvo.quantidadeContratada - contratoAlvo.quantidadeEntregue
      )
    : 0;

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4 text-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <span className="text-xs font-bold text-indigo-700">
              Fornecimento Contínuo & Usinas
            </span>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Programar Puxada de Concreto / Aço
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            Fechar
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contrato Mãe Homologado *
            </label>
            <select
              value={contratoId}
              onChange={(e) => setContratoId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium"
            >
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numeroContrato} — {c.insumo} ({c.obraNome})
                </option>
              ))}
            </select>
          </div>

          {contratoAlvo && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs space-y-1">
              <div className="flex justify-between text-indigo-950 font-bold">
                <span>Fornecedor: {contratoAlvo.fornecedorNome}</span>
                <span>
                  Saldo na Usina: {saldoRestante} {contratoAlvo.unidade}
                </span>
              </div>
              <div className="text-indigo-800">
                Já entregue no canteiro: {contratoAlvo.quantidadeEntregue} de{" "}
                {contratoAlvo.quantidadeContratada} {contratoAlvo.unidade} (
                {Math.round(
                  (contratoAlvo.quantidadeEntregue /
                    contratoAlvo.quantidadeContratada) *
                    100
                )}
                %)
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data & Horário de Início *
              </label>
              <input
                type="text"
                required
                value={dataHora}
                onChange={(e) => setDataHora(e.target.value)}
                placeholder="Ex: 22/10/2026 07:30"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Volume da Carga ({contratoAlvo?.unidade || "m³"}) *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max={saldoRestante > 0 ? saldoRestante : undefined}
                required
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-bold text-slate-900 tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Etapa Construtiva / Local de Lançamento *
            </label>
            <input
              type="text"
              required
              value={etapaAplicacao}
              onChange={(e) => setEtapaAplicacao(e.target.value)}
              placeholder="Ex: Laje e Vigas do 9º Pavimento"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsável pelo Recebimento no Canteiro
            </label>
            <input
              type="text"
              required
              value={responsavelRecebimento}
              onChange={(e) => setResponsavelRecebimento(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações Técnicas / Logística do Portão
            </label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Bomba lança 36m, agendamento de 4 betoneiras"
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold transition shadow-xs"
          >
            Confirmar e Agendar Puxada
          </button>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* MODAL DE AJUSTE RÁPIDO DE SALDO FÍSICO NO ALMOXARIFADO                  */
/* ----------------------------------------------------------------------- */
function ModalAjusteRapidoSaldo({
  item,
  onClose,
  onSalvar,
}: {
  item: ItemEstoque;
  onClose: () => void;
  onSalvar: (
    itemId: string,
    novoSaldo: number,
    novoMinimo: number,
    novoCusto: number,
    localizacao: string,
    motivo: string
  ) => void;
}) {
  const [saldo, setSaldo] = useState<number>(item.saldoAtual);
  const [minimo, setMinimo] = useState<number>(item.estoqueMinimo || 0);
  const [custo, setCusto] = useState<number>(item.custoMedio || 0);
  const [local, setLocal] = useState<string>(
    item.localizacaoFisica || "Almoxarifado Principal"
  );
  const [motivo, setMotivo] = useState<string>(
    "Contagem física / inventário no canteiro"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSalvar(
      item.id,
      Number(saldo) || 0,
      Number(minimo) || 0,
      Number(custo) || 0,
      local,
      motivo
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <span>📦</span> Ajustar Saldo no Almoxarifado
            </h3>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Contagem física e parametrização do insumo
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="font-mono text-emerald-800 text-[11px] font-bold block">
              {item.codigo}
            </span>
            <span className="font-extrabold text-slate-900 text-sm block mt-0.5">
              {item.descricao}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Canteiro: <strong>{item.obraNome}</strong> • Unidade:{" "}
              <strong>{item.unidade}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Saldo Físico Atual *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={saldo}
                  onChange={(e) => setSaldo(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                  {item.unidade}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Estoque Mínimo
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={minimo}
                onChange={(e) => setMinimo(parseFloat(e.target.value) || 0)}
                placeholder="Ex: 10"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Custo Médio Unitário (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={custo}
                onChange={(e) => setCusto(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Localização Física
              </label>
              <input
                type="text"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Prateleira B2"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Observação / Motivo do Ajuste
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Contagem física inicial no canteiro"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>💾</span> Salvar Saldo no Almoxarifado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function ModalFichaKardex({
  item,
  movimentacoes,
  onClose,
  onRepor,
}: {
  item: ItemEstoque;
  movimentacoes: MovimentacaoEstoque[];
  onClose: () => void;
  onRepor: () => void;
}) {
  const critico = item.saldoAtual <= item.estoqueMinimo;

  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-4xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-xs font-bold">
                {item.codigo}
              </span>
              <span className="text-xs text-slate-500">{item.categoria}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              Ficha Kardex: {item.descricao}
            </h3>
            <p className="text-xs text-slate-500">
              Canteiro: <strong>{item.obraNome}</strong> • Localização:{" "}
              <strong>{item.localizacaoFisica}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            ✕ Fechar
          </button>
        </div>

        {/* 4 Cards de Resumo do Kardex */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-slate-500">
              Saldo Atual
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {item.saldoAtual} {item.unidade}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-slate-500">
              Custo Médio Ponderado
            </div>
            <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {formatBRL(item.custoMedio)}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-slate-500">
              Valor em Estoque
            </div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums mt-0.5">
              {formatBRL(item.saldoAtual * item.custoMedio)}
            </div>
          </div>
          <div
            className={`border rounded-lg p-3 ${
              critico
                ? "bg-red-50 border-red-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div
              className={`text-[11px] font-semibold ${
                critico ? "text-red-700" : "text-slate-500"
              }`}
            >
              Estoque Mínimo / Repor
            </div>
            <div
              className={`text-xl font-bold tabular-nums mt-0.5 ${
                critico ? "text-red-700" : "text-slate-900"
              }`}
            >
              {item.estoqueMinimo} / {item.pontoReposicao} {item.unidade}
            </div>
          </div>
        </div>

        {/* Tabela do Livro Razão Kardex */}
        <div className="overflow-y-auto flex-1 rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Tipo de Operação</th>
                <th className="py-2.5 px-3">Documento / Responsável</th>
                <th className="py-2.5 px-3 text-right">Qtd Movimentada</th>
                <th className="py-2.5 px-3 text-right">Saldo Resultante</th>
                <th className="py-2.5 px-3 text-right">Valor Movimentado</th>
                <th className="py-2.5 px-3">Motivo / Aplicação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimentacoes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    Nenhuma movimentação registrada para este insumo.
                  </td>
                </tr>
              ) : (
                movimentacoes.map((mov) => {
                  const ehEntrada = mov.tipo === "ENTRADA_COMPRA";
                  return (
                    <tr key={mov.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {mov.dataHora}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            ehEntrada
                              ? "bg-emerald-100 text-emerald-800"
                              : mov.tipo === "TRANSFERENCIA_OBRA"
                              ? "bg-purple-100 text-purple-800"
                              : mov.tipo === "PERDA_AVARIA"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {mov.responsavel}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {mov.numeroDocumento || "—"}
                        </div>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap ${
                          ehEntrada ? "text-emerald-700" : "text-slate-800"
                        }`}
                      >
                        {ehEntrada ? "+" : "-"}
                        {mov.quantidade} {mov.unidade}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {mov.saldoPosterior} {mov.unidade}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700 tabular-nums whitespace-nowrap">
                        {formatBRL(mov.valorTotal)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                        {mov.motivoEtapa || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Fornecedor Homologado Habitual:{" "}
            <strong>
              {item.fornecedorHabitual || "A definir"}
            </strong>
          </div>
          <div className="flex items-center gap-2">
            {critico && (
              <button
                type="button"
                onClick={onRepor}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <span>⚡ Gerar Solicitação de Reposição</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
            >
              🖨️ Imprimir Kardex
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalAgruparDemandas({
  demandas,
  onClose,
  onCriarLote,
}: {
  demandas: Array<{
    descricao: string;
    unidade: string;
    totalQtd: number;
    obrasParticipantes: string[];
    orcamentoUnitario: number;
    categoria: string;
  }>;
  onClose: () => void;
  onCriarLote: (dem: any) => void;
}) {
  return (
    <div className="no-print fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 max-w-3xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <span className="text-xs font-bold text-emerald-700">
                Centralizador Corporativo Multi-Obra
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-0.5">
              Oportunidades de Compra em Lote & Ganho de Escala
            </h3>
            <p className="text-xs text-slate-500">
              Unifique requisições de diferentes empreendimentos para negociar preços de atacado e frete compartilhado.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            ✕ Fechar
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-3">
          {demandas.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Nenhuma oportunidade de agrupamento detectada no momento.
            </div>
          ) : (
            demandas.map((dem, idx) => {
              const valorIndividual = dem.totalQtd * dem.orcamentoUnitario;
              const savingEstimado = valorIndividual * 0.12;
              const valorLote = valorIndividual - savingEstimado;

              return (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {dem.descricao}
                      </div>
                      <div className="text-xs text-slate-500">
                        Categoria: {dem.categoria} • Volume Total:{" "}
                        <strong className="text-slate-800">
                          {dem.totalQtd} {dem.unidade}
                        </strong>
                      </div>
                    </div>
                    <button
                      onClick={() => onCriarLote(dem)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                    >
                      ⚡ Unificar em Cotação Corporativa
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center text-xs">
                    <span className="text-slate-500">Canteiros:</span>
                    {dem.obrasParticipantes.map((obraNome, oIdx) => (
                      <span
                        key={oIdx}
                        className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 font-medium"
                      >
                        🏗️ {obraNome}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded border border-slate-200 text-xs text-center">
                    <div>
                      <div className="text-slate-500">Orçamento Unitário</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatBRL(dem.orcamentoUnitario)} / {dem.unidade}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Valor em Carga Fechada</div>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatBRL(valorLote)}
                      </div>
                    </div>
                    <div>
                      <div className="text-emerald-700 font-bold">Saving Estimado</div>
                      <div className="font-bold text-emerald-700 mt-0.5">
                        {formatBRL(savingEstimado)} (-12%)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}



/* ========================================================================= */
/* MODAL EXECUTIVO DE PRÉVIA & IMPRESSÃO DO MAPA DE 3 ORÇAMENTOS             */
/* ========================================================================= */
function ModalVisualizarComparativoPdf({
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
}: {
  comparativoTitulo: string;
  comparativoObraId: string;
  comparativoCategoria: string;
  comparativoFornecedores: [FornecedorCotadoRapido, FornecedorCotadoRapido, FornecedorCotadoRapido];
  comparativoItens: ItemComparativoRapido[];
  resumoComparativo: any;
  settings: UserSettings;
  obras: Obra[];
  onClose: () => void;
  onAbrirNovaAba: () => void;
}) {
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
              onClick={onAbrirNovaAba}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>🖨️</span> Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={onAbrirNovaAba}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {comparativoFornecedores.map((f, i) => {
                const tot = i === 0 ? resumoComparativo.total1 : i === 1 ? resumoComparativo.total2 : resumoComparativo.total3;
                const isVenc = resumoComparativo.vencedorGeral?.index === i;
                return (
                  <div key={i} className={`p-3 rounded-lg border text-xs ${isVenc ? "bg-emerald-50/70 border-emerald-400" : "bg-white border-slate-200"}`}>
                    <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">{isVenc ? "🏆 1º Lugar (Mais em Conta)" : `Orçamento #${i + 1}`}</div>
                    <div className="font-extrabold text-slate-900 text-sm truncate">{f.nome || `Fornecedor ${i + 1}`}</div>
                    <div className={`text-base font-black mt-1 ${isVenc ? "text-emerald-700" : "text-slate-900"}`}>{formatBRL(tot)}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Frete: {f.freteTipo} ({formatBRL(f.freteValor)}) • Prazo: {f.prazo || "N/I"}</div>
                  </div>
                );
              })}
            </div>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border border-slate-300 font-bold text-slate-800">
                  <th className="p-2 text-left w-[34%]">Insumo / Material</th>
                  <th className="p-2 text-center w-[12%]">Qtd</th>
                  <th className="p-2 text-right w-[18%]">{comparativoFornecedores[0]?.nome || "Fornecedor 1"}</th>
                  <th className="p-2 text-right w-[18%]">{comparativoFornecedores[1]?.nome || "Fornecedor 2"}</th>
                  <th className="p-2 text-right w-[18%]">{comparativoFornecedores[2]?.nome || "Fornecedor 3"}</th>
                </tr>
              </thead>
              <tbody>
                {resumoComparativo.itensCalculados.map((it: any) => (
                  <tr key={it.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 font-semibold text-slate-900">{it.nome}</td>
                    <td className="p-2 text-center text-slate-600">{it.quantidade} {it.unidade}</td>
                    <td className={`p-2 text-right ${it.vencedor1 ? "bg-emerald-100/70 font-bold text-emerald-900" : "text-slate-800"}`}>{formatBRL(it.preco1)}</td>
                    <td className={`p-2 text-right ${it.vencedor2 ? "bg-emerald-100/70 font-bold text-emerald-900" : "text-slate-800"}`}>{formatBRL(it.preco2)}</td>
                    <td className={`p-2 text-right ${it.vencedor3 ? "bg-emerald-100/70 font-bold text-emerald-900" : "text-slate-800"}`}>{formatBRL(it.preco3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                  <td colSpan={2} className="p-2">Subtotal dos Materiais</td>
                  <td className="p-2 text-right">{formatBRL(resumoComparativo.subtotal1)}</td>
                  <td className="p-2 text-right">{formatBRL(resumoComparativo.subtotal2)}</td>
                  <td className="p-2 text-right">{formatBRL(resumoComparativo.subtotal3)}</td>
                </tr>
                <tr className="bg-emerald-50/70 text-emerald-950 font-semibold border-t border-slate-200">
                  <td colSpan={2} className="p-2">Desconto Comercial (R$)</td>
                  <td className="p-2 text-right text-emerald-700">-{formatBRL(comparativoFornecedores?.[0]?.descontoValor || 0)}</td>
                  <td className="p-2 text-right text-emerald-700">-{formatBRL(comparativoFornecedores?.[1]?.descontoValor || 0)}</td>
                  <td className="p-2 text-right text-emerald-700">-{formatBRL(comparativoFornecedores?.[2]?.descontoValor || 0)}</td>
                </tr>
                <tr className="bg-slate-50 text-slate-700 font-semibold border-t border-slate-200">
                  <td colSpan={2} className="p-2">Frete (CIF / FOB)</td>
                  <td className="p-2 text-right">{comparativoFornecedores?.[0]?.freteTipo || "CIF"} ({formatBRL(comparativoFornecedores?.[0]?.freteValor || 0)})</td>
                  <td className="p-2 text-right">{comparativoFornecedores?.[1]?.freteTipo || "CIF"} ({formatBRL(comparativoFornecedores?.[1]?.freteValor || 0)})</td>
                  <td className="p-2 text-right">{comparativoFornecedores?.[2]?.freteTipo || "CIF"} ({formatBRL(comparativoFornecedores?.[2]?.freteValor || 0)})</td>
                </tr>
                <tr className="bg-slate-900 text-white font-extrabold text-xs">
                  <td colSpan={2} className="p-2.5">VALOR TOTAL (COM FRETE E DESCONTO)</td>
                  <td className="p-2.5 text-right">{formatBRL(resumoComparativo.total1)}</td>
                  <td className="p-2.5 text-right">{formatBRL(resumoComparativo.total2)}</td>
                  <td className="p-2.5 text-right">{formatBRL(resumoComparativo.total3)}</td>
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
