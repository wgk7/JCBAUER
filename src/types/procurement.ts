export type ProjectStatus = "ativo" | "concluido";

/**
 * Taxonomia Oficial das 11 Disciplinas e Categorias da Construção Civil
 */
export type InsumoCategory =
  | "Fundações & Terraplenagem"
  | "Estrutura"
  | "Alvenaria, Vedações & Fachada Leve"
  | "Envoltória, Vidros & Esquadrias"
  | "Mobilidade Vertical & Equipamentos Maiores"
  | "Instalações Hidrossanitárias & Gás"
  | "Instalações Elétricas, Telecom & Segurança"
  | "Impermeabilização & Químicos"
  | "Acabamentos Nobres"
  | "Pinturas & Tratamentos"
  | "Canteiro, EPIs & Locações Diversas";

export type EqualizationMode = "INSUMOS" | "PACOTE_TECNICO";

export type UnidadeMedida =
  | "m³"
  | "kg"
  | "barra"
  | "sc"
  | "un"
  | "vb"
  | "m"
  | "rl"
  | "lt"
  | "m²"
  | "cj";

export type HomologationStatus = "Em Análise" | "Homologado" | "Bloqueado";

export type PurchaseRequestStatus =
  | "Rascunho"
  | "Em Cotação"
  | "Aguardando Aprovação"
  | "Aprovada"
  | "Recusada"
  | "Comprada";

export type QuotationStatus =
  | "Em preenchimento"
  | "Equalizada"
  | "Vencedora"
  | "Desclassificada";

export type PurchaseOrderStatus =
  | "Emitida"
  | "Aguardando Entrega"
  | "Parcialmente Entregue"
  | "Finalizada"
  | "Cancelada";

export interface CategoryTaxonomyMeta {
  categoria: InsumoCategory;
  codigo: string;
  modoPadrao: EqualizationMode;
  subcategorias: string[];
  descricaoCurta: string;
}

export interface Project {
  id: string;
  nome: string;
  codigo_sigla: string;
  endereco: string;
  responsavel_obra: string;
  status: ProjectStatus;
  orcamento_mensal?: number;
}

export interface ItemCatalog {
  id: string;
  codigo_insumo: string;
  descricao: string;
  categoria: InsumoCategory;
  subcategoria?: string;
  unidade_medida: UnidadeMedida;
  preco_referencia: number; // SINAPI / Orçamento Executivo
  norma_tecnica?: string;
  modalidade_sugerida?: EqualizationMode;
}

export interface VendorEvaluation {
  id: string;
  data: string;
  numero_oc: string;
  pontualidade: number; // 1-5
  conformidade_material: number; // 1-5
  atendimento_comercial: number; // 1-5
  comentario: string;
  avaliador: string;
}

export interface VendorContact {
  id: string;
  vendor_id: string;
  nome_vendedor: string;
  cargo: string;
  whatsapp: string;
  telefone: string;
  email: string;
  chave_pix: string;
  notas_negociacao: string;
}

export interface Vendor {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  cidade_uf: string;
  categorias_atendidas: InsumoCategory[];
  tags_especialidade: string[];
  status_homologacao: HomologationStatus;
  score_avaliacao: number; // 1 a 5 estrelas
  condicoes_pagamento_padrao: string;
  contacts: VendorContact[];
  avaliacoes: VendorEvaluation[];
}

export interface RequestItem {
  id: string;
  sc_id: string;
  item_catalog_id: string;
  codigo_insumo: string;
  descricao: string;
  categoria: InsumoCategory;
  quantidade: number;
  unidade: UnidadeMedida;
  preco_orcado_unit: number; // Meta/Orçamento da Obra
  observacao_tecnica: string;
}

export interface PurchaseRequest {
  id: string;
  numero_sc: string;
  project_id: string;
  categoria_principal: InsumoCategory;
  modalidade: EqualizationMode;
  solicitante: string;
  data_abertura: string;
  data_limite_entrega: string;
  prioridade: "Normal" | "Alta" | "Crítica";
  status: PurchaseRequestStatus;
  observacoes: string;
  etapa_obra: string;
  items: RequestItem[];
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  request_item_id: string;
  preco_unitario: number;
  aliquota_ipi_icms: number; // percentual ex: 5.0
  valor_total_item: number;
  marca_oferecida: string;
  prazo_item_dias: number;
}

/**
 * Dados Contratuais para MODO B: Pacotes Técnicos & Contratos Sob Medida
 */
export interface TechnicalPackageDetails {
  valor_fornecimento_material: number;
  valor_mao_de_obra_instalacao: number;
  valor_art_rrt_projetos: number;
  prazo_fabricacao_engenharia_dias: number;
  prazo_montagem_canteiro_dias: number;
  condicao_medicao_desembolso: string;
  garantia_anos: number;
  detalhe_garantia: string;
  assistencia_tecnica_local: string;
  escopo_incluso: string;
  ressalvas_aditivos: string;
  cumpre_integralmente_escopo: boolean;
}

export interface Quotation {
  id: string;
  sc_id: string;
  vendor_id: string;
  vendor_contact_id: string;
  data_envio: string;
  data_retorno: string;
  prazo_entrega_dias: number;
  condicao_pagamento: string; // ex: 28/42 ddl, à vista, 30% sinal + medições
  tipo_frete: "CIF" | "FOB";
  valor_frete: number;
  desconto_negociado: number;
  status: QuotationStatus;
  observacao_fornecedor?: string;
  items: QuotationItem[];
  pacote_tecnico?: TechnicalPackageDetails;
}

export interface AuditLogEntry {
  data_hora: string;
  usuario: string;
  acao: string;
  detalhe: string;
}

export interface PurchaseOrder {
  id: string;
  numero_oc: string;
  sc_id: string;
  quotation_id: string;
  vendor_id: string;
  vendor_contact_id: string;
  project_id: string;
  data_emissao: string;
  valor_total: number;
  valor_orcado_referencia: number;
  valor_maior_cotado: number;
  valor_saving_orcamento: number;
  valor_saving_negociacao: number;
  condicao_fechada: string;
  tipo_frete: "CIF" | "FOB";
  valor_frete: number;
  previsao_entrega: string;
  status: PurchaseOrderStatus;
  de_acordo_fornecedor: boolean;
  historico_auditoria: AuditLogEntry[];
}
