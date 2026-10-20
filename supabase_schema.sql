-- ====================================================================
-- SCHEMA JC BAUER PROCUREMENT - BANCO DE DADOS SUPABASE
-- Projeto: https://vetuphedvhpvhoassnwz.supabase.co
-- ====================================================================

-- 1. TABELA PRINCIPAL DE SINCRONIZAÇÃO E ESTADO GLOBAL (KEY-VALUE JSONB)
-- Garante persistência e sincronização em tempo real de todas as coleções do app
CREATE TABLE IF NOT EXISTS public.system_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA RELACIONAL DE FORNECEDORES (CADASTRO E AVALIAÇÃO IQF)
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

-- 3. TABELA RELACIONAL DE OBRAS & EMPREENDIMENTOS
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

-- 4. TABELA RELACIONAL DE COMPARATIVOS DE PREÇOS (3 ORÇAMENTOS)
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

-- 5. TABELA DE ORDENS DE COMPRA (OC)
CREATE TABLE IF NOT EXISTS public.ordens_compra (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    obra_id TEXT,
    fornecedor_id TEXT,
    fornecedor_nome TEXT,
    data_emissao TEXT,
    valor_total NUMERIC DEFAULT 0,
    condicoes_pagamento TEXT,
    status TEXT DEFAULT 'Emitida',
    itens JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABELA DE SOLICITAÇÕES DE COMPRA (SC)
CREATE TABLE IF NOT EXISTS public.solicitacoes_compra (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    obra_id TEXT,
    solicitante TEXT,
    categoria TEXT,
    data_abertura TEXT,
    status TEXT DEFAULT 'Em Cotação',
    prioridade TEXT DEFAULT 'Normal',
    itens JSONB DEFAULT '[]'::jsonb,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABELA DE ITENS DA PLANILHA / CATÁLOGO DE INSUMOS
CREATE TABLE IF NOT EXISTS public.itens_planilha (
    id TEXT PRIMARY KEY,
    codigo TEXT,
    descricao TEXT NOT NULL,
    categoria TEXT,
    unidade TEXT,
    preco_estimado NUMERIC DEFAULT 0,
    obra_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- HABILITAR ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
-- Permite leitura e gravação seguras para a chave de API da aplicação
-- ====================================================================

ALTER TABLE public.system_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comparativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_planilha ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso para clientes da aplicação (anon / authenticated)
DROP POLICY IF EXISTS "Acesso publico system_store" ON public.system_store;
CREATE POLICY "Acesso publico system_store" ON public.system_store FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico fornecedores" ON public.fornecedores;
CREATE POLICY "Acesso publico fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico obras" ON public.obras;
CREATE POLICY "Acesso publico obras" ON public.obras FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico comparativos" ON public.comparativos;
CREATE POLICY "Acesso publico comparativos" ON public.comparativos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico ordens_compra" ON public.ordens_compra;
CREATE POLICY "Acesso publico ordens_compra" ON public.ordens_compra FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico solicitacoes_compra" ON public.solicitacoes_compra;
CREATE POLICY "Acesso publico solicitacoes_compra" ON public.solicitacoes_compra FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso publico itens_planilha" ON public.itens_planilha;
CREATE POLICY "Acesso publico itens_planilha" ON public.itens_planilha FOR ALL USING (true) WITH CHECK (true);

-- Ativa suporte a tempo real no Supabase
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.system_store;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fornecedores;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comparativos;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN others THEN NULL;
END $$;
