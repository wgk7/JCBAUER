// src/types/jcBauer.ts
// Tipos unificados do ERP JC BAUER — Compras, Canteiro, Almoxarifado e BI Financeiro

export type TabId =
  | "Telao"
  | "Painel"
  | "DesempenhoFinanceiro"
  | "Cotacoes"
  | "Concreteiras"
  | "ComprasColetivas"
  | "Fornecedores"
  | "Ordens"
  | "Estoque"
  | "Medicoes"
  | "Orcamento"
  | "Logistica"
  | "Importacao"
  | "Configuracoes";

export type ObraTabId =
  | "PainelDiario"
  | "NovoPedido"
  | "MeusPedidos"
  | "Recebimento"
  | "Estoque"
  | "Medicoes"
  | "Logistica";

export type PerfilAcesso =
  | "Administrador"
  | "Engenheiro"
  | "Almoxarife"
  | "Encarregado";

export type UrgenciaPedido = "Normal" | "Alta" | "Crítica - Obra Parada";

export type ClasseAbc = "Classe A" | "Classe B" | "Classe C";

export type NivelAlcada =
  | "Comprador Autorizado"
  | "Gerência de Obras"
  | "Diretoria Executiva / CFO";

export interface MensagemPedido {
  id: string;
  autorNome: string;
  autorCargo: PerfilAcesso;
  dataHora: string;
  texto: string;
}

export interface UsuarioSistema {
  id: string;
  nome: string;
  cargo: PerfilAcesso;
  obraId: string;
  obraNome: string;
  email: string;
  senha: string;
  status: "Ativo" | "Bloqueado";
}

export interface UserSettings {
  userName: string;
  userRole: string;
  userEmail: string;
  userPhone: string;
  companyName: string;
  companyCnpj: string;
}

export interface Obra {
  id: string;
  nome: string;
  sigla: string;
  endereco: string;
  engenheiro: string;
}

export interface ItemSolicitacao {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  orcamentoUnitario: number;
  observacaoObra?: string;
}

export interface PropostaFornecedor {
  id: string;
  vendorId: string;
  fornecedorNome: string;
  vendedorNome: string;
  whatsapp: string;
  precosUnitarios: Record<string, number>;
  freteValor: number;
  tipoFrete: "CIF" | "FOB";
  prazoPagamento: string;
}

export interface SolicitacaoCompra {
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
    | "Não Aprovada / Recusada"
    | "Comprada"
    | "Entregue na Obra";
  dataPrevistaEntrega?: string;
  motivoRecusa?: string;
  observacoesEntrega?: string;
  notaFiscalRecebida?: string;
  condicaoRecebimento?: string;
  recebidoPor?: string;
  dataHoraRecebimento?: string;
  mensagens?: MensagemPedido[];
  itens: ItemSolicitacao[];
  propostas: PropostaFornecedor[];
}

export interface FornecedorCadastro {
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

export interface OrdemCompra {
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
  janelaEntrega?: string;
  veiculoEntrega?: string;
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

export interface BoletimMedicao {
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

export interface ContratoSubempreitada {
  id: string;
  numeroContrato: string;
  empreiteiro: string;
  cnpj: string;
  obraId: string;
  obraNome: string;
  objeto: string;
  categoria: string;
  valorTotal: number;
  percentualRetencao: number;
  dataInicio: string;
  previsaoFim: string;
  status: "Ativo" | "Concluído" | "Suspenso";
  medicoes: BoletimMedicao[];
}

export interface ItemEconomiaInsumo {
  id: string;
  insumo: string;
  categoria: string;
  obraId: string;
  obraNome: string;
  fornecedorVencedor: string;
  valorMaiorCotado: number;
  valorFechado: number;
}

export interface ItemPlanilhaImportada {
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

export interface DuplicidadeFornecedor {
  id: string;
  nomeSugerido: string;
  cnpj: string;
  variacoesPlanilha: string;
  similaridade: string;
  status: "Pendente" | "Unificado";
}

export interface ColaboradorMapeado {
  id: string;
  nome: string;
  cargo: string;
  obraPrincipal: string;
  pedidosHistoricos: number;
  status: "Validado" | "Pendente";
}

export interface IqfFornecedor {
  scoreGeral: number;
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

export interface ItemOrcamentoObra {
  id: string;
  obraId: string;
  obraNome?: string;
  categoria: string;
  valorOrcado: number;
  observacao?: string;
}

export interface NotificacaoItem {
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

export interface CargaItemLogistica {
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
  dataEntregaISO?: string;
  dataPrevistaTexto?: string;
}

export interface DiaLogisticaSemana {
  diaSemana: string;
  dataLabel: string;
  dataISO?: string;
  conflitoPortao: boolean;
  cargas: CargaItemLogistica[];
}

export type CargaLogistica = DiaLogisticaSemana;

export type TipoMovimentacaoEstoque =
  | "ENTRADA_COMPRA"
  | "SAIDA_APLICACAO"
  | "TRANSFERENCIA_OBRA"
  | "PERDA_AVARIA"
  | "AJUSTE_INVENTARIO";

export interface ItemEstoque {
  id: string;
  obraId: string;
  obraNome: string;
  codigo: string;
  sku?: string;
  descricao: string;
  categoria: string;
  unidade: string;
  saldoAtual: number;
  quantidadeAEntrar?: number;
  previsaoEntrega?: string;
  dataUltimaEntrada?: string;
  quantidadeUltimaEntrada?: number;
  notaFiscalUltimaEntrada?: string;
  fornecedorUltimaEntrada?: string;
  estoqueMinimo: number;
  pontoReposicao: number;
  custoMedio: number;
  localizacaoFisica: string;
  ultimaMovimentacao: string;
  fornecedorHabitual?: string;
}

export interface MovimentacaoEstoque {
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
  numeroDocumento?: string;
  motivoEtapa?: string;
}

export interface ProgramacaoPuxada {
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

export interface ContratoPuxadaFornecimento {
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

export interface DiarioObraRegistro {
  id: string;
  obraId: string;
  obraNome: string;
  data: string;
  hora: string;
  responsavelNome: string;
  responsavelCargo: PerfilAcesso;
  clima: "Ensolarado" | "Nublado" | "Chuvoso" | "Chuva c/ Paralisação";
  efetivoProprio: number;
  efetivoTerceirizado: number;
  frentesServico: string;
  ocorrencias?: string;
}

export interface RegistroDiarioFinanceiro {
  data: string;
  diaSemana: string;
  volumeContratado: number;
  savingEconomizado: number;
  pedidosFechados: number;
  destaqueObra: string;
  destaqueInsumo: string;
}

export interface ItemComparativoRapido {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  preco1: number;
  preco2: number;
  preco3: number;
  preco4?: number;
  preco5?: number;
  preco6?: number;
  precos?: number[];
}

export interface FornecedorCotadoRapido {
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
  codigo: string;
  titulo: string;
  obraId: string;
  obraNome: string;
  categoria: string;
  solicitacaoOrigemId?: string;
  solicitanteNome?: string;
  urgencia?: UrgenciaPedido;
  status:
    | "Aguardando Fornecedores"
    | "Em Análise"
    | "Rascunho"
    | "Concluída"
    | "Cancelada";
  dataCriacao: string;
  dataAtualizacao: string;
  fornecedores: FornecedorCotadoRapido[];
  itens: ItemComparativoRapido[];
  savingGerado?: number;
  menorValor?: number;
  melhorFornecedorNome?: string;
  observacoes?: string;
  ordemCompraEmitidaId?: string;
  numeroOcEmitida?: string;
}

export interface SlumpOpcaoConcreto {
  id: string;
  descricao: string;
  unidade: string;
}

export interface ConcreteiraCotada {
  id: string;
  nome: string;
  contatoNome: string;
  telefone?: string;
  precosSlumps: Record<string, number>;
  precoBomba: number;
}

export interface DadosCotacaoConcreto {
  obraId: string;
  obraNome: string;
  obraNomeCustom?: string;
  elemento: string;
  volumeM3: number;
  volumeBombaM3: number;
  nomeBomba?: string;
  descricaoBomba?: string;
  undBomba?: string;
  slumpSelecionadoId: string;
  incluirBombaNoTotal: boolean;
  slumps: SlumpOpcaoConcreto[];
  concreteiras: ConcreteiraCotada[];
}

export interface ItemCompraColetiva {
  id: string;
  descricao: string;
  categoria: string;
  unidade: string;
  demandasPorObra: Record<string, number>;
  precoReferenciaVarejo: number;
  precosFornecedores: Record<string, number>;
}

export interface FornecedorLoteColetivo {
  id: string;
  nome: string;
  contato: string;
  telefone: string;
  condicaoPagamento: string;
  tipoFrete: "CIF" | "FOB";
  valorFreteTotal: number;
}

export interface LoteCompraColetiva {
  id: string;
  titulo: string;
  dataCriacao: string;
  status: "Em Negociação" | "Aprovado" | "OCs Emitidas";
  fornecedorVencedorId?: string;
  obrasParticipantes: { id: string; nome: string }[];
  itens: ItemCompraColetiva[];
  fornecedores: FornecedorLoteColetivo[];
}

/* ========================================================================= */
/* TIPOS PARA O PORTAL DO FORNECEDOR (ITEM 2 - COTAÇÕES ONLINE)              */
/* ========================================================================= */

export interface ItemPropostaFornecedorOnline {
  itemId: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  marca?: string;
  prazoEntregaDias?: number;
  observacao?: string;
  subtotal: number;
}

export interface PropostaFornecedorOnline {
  id: string;
  cotacaoId: string;
  fornecedorIndex: number;
  fornecedorNome: string;
  vendedorNome: string;
  telefoneWhatsapp: string;
  cnpj?: string;
  tipoFrete: "CIF" | "FOB";
  freteValor: number;
  condicaoPagamento: string;
  prazoEntregaGeral: string;
  chavePix?: string;
  observacoesGerais?: string;
  dataEnvio: string;
  itens: ItemPropostaFornecedorOnline[];
  valorTotalInsumos: number;
  valorTotalProposta: number;
  statusEnvio: "Submetida" | "Em Rascunho";
}
