// src/lib/supabase.ts
// Integração oficial com banco de dados Supabase para JC Bauer Empreendimentos & Obras

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://vetuphedvhpvhoassnwz.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_tsBEF9j8kYzaoQvhL-PXXA_ig6kakut";

const getHeaders = (extraHeaders?: Record<string, string>) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  ...extraHeaders,
});

export interface SupabaseHealth {
  connected: boolean;
  schemaReady: boolean;
  message: string;
}

/**
 * Testa conectividade e existência da tabela de sincronização no Supabase
 */
export async function testarConexaoSupabase(): Promise<SupabaseHealth> {
  try {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!authRes.ok) {
      return {
        connected: false,
        schemaReady: false,
        message: `Falha de conexão com Supabase (HTTP ${authRes.status})`,
      };
    }

    // Testa se a tabela system_store já foi criada no banco
    const storeRes = await fetch(
      `${SUPABASE_URL}/rest/v1/system_store?select=key&limit=1`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );

    if (storeRes.ok) {
      return {
        connected: true,
        schemaReady: true,
        message: "Conectado ao Supabase com tabelas ativas!",
      };
    }

    if (storeRes.status === 404) {
      return {
        connected: true,
        schemaReady: false,
        message:
          "Conectado ao Supabase! As tabelas precisam ser criadas pelo SQL Editor.",
      };
    }

    return {
      connected: true,
      schemaReady: false,
      message: `Conectado ao Supabase (status tabelas: HTTP ${storeRes.status})`,
    };
  } catch (err: any) {
    return {
      connected: false,
      schemaReady: false,
      message: `Erro ao conectar: ${err?.message || "Sem resposta do servidor"}`,
    };
  }
}

/**
 * Carrega todos os registros de sincronização da tabela system_store
 */
export async function carregarTudoSupabase(): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/system_store?select=key,value`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );

    if (!res.ok) return null;

    const rows: { key: string; value: any }[] = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const data: Record<string, any> = {};
    for (const r of rows) {
      if (r && r.key) {
        data[r.key] = r.value;
      }
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Salva ou atualiza uma chave e seu valor no system_store do Supabase (Upsert)
 */
export async function salvarChaveSupabase(
  key: string,
  value: any
): Promise<boolean> {
  try {
    const payload = [
      {
        key,
        value,
        updated_at: new Date().toISOString(),
      },
    ];

    const res = await fetch(`${SUPABASE_URL}/rest/v1/system_store`, {
      method: "POST",
      headers: getHeaders({
        Prefer: "resolution=merge-duplicates",
      }),
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sincroniza fornecedores na tabela relacional pública 'fornecedores'
 */
export async function sincronizarFornecedoresRelacional(
  fornecedores: any[]
): Promise<boolean> {
  if (!Array.isArray(fornecedores) || fornecedores.length === 0) return true;

  try {
    const rows = fornecedores.map((f) => ({
      id: f.id,
      empresa: f.empresa || "",
      razao_social: f.razaoSocial || f.empresa || "",
      cnpj: f.cnpj || "",
      cidade: f.cidade || "",
      categoria_principal: f.categoriaPrincipal || "Geral",
      especialidades: Array.isArray(f.especialidades) ? f.especialidades : [],
      vendedor: f.vendedor || "",
      telefone: f.telefone || "",
      whatsapp: f.whatsapp || "",
      email: f.email || "",
      chave_pix: f.chavePix || "",
      condicao_padrao: f.condicaoPadrao || "",
      observacoes: f.observacoes || "",
      updated_at: new Date().toISOString(),
    }));

    const res = await fetch(`${SUPABASE_URL}/rest/v1/fornecedores`, {
      method: "POST",
      headers: getHeaders({
        Prefer: "resolution=merge-duplicates",
      }),
      body: JSON.stringify(rows),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Carrega fornecedores diretamente da tabela relacional 'fornecedores'
 */
export async function carregarFornecedoresRelacional(): Promise<any[] | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/fornecedores?select=*&order=empresa.asc`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );

    if (!res.ok) return null;

    const rows: any[] = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    return rows.map((r) => ({
      id: r.id,
      empresa: r.empresa,
      razaoSocial: r.razao_social || r.empresa,
      cnpj: r.cnpj || "",
      cidade: r.cidade || "",
      categoriaPrincipal: r.categoria_principal || "Geral",
      especialidades: r.especialidades || [],
      vendedor: r.vendedor || "",
      telefone: r.telefone || "",
      whatsapp: r.whatsapp || "",
      email: r.email || "",
      chavePix: r.chave_pix || "",
      condicaoPadrao: r.condicao_padrao || "",
      observacoes: r.observacoes || "",
    }));
  } catch {
    return null;
  }
}

/**
 * Salva a proposta comercial preenchida pelo fornecedor via Portal Online
 */
export async function salvarPropostaFornecedor(
  cotacaoId: string,
  fornIdx: number,
  proposta: any
): Promise<boolean> {
  const chave = `jc_proposta_${cotacaoId}_forn_${fornIdx}`;
  return salvarChaveSupabase(chave, proposta);
}

/**
 * Carrega todas as propostas submetidas por fornecedores para uma cotação
 */
export async function carregarPropostasCotacao(
  cotacaoId: string
): Promise<Record<number, any>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/system_store?key=like.jc_proposta_${cotacaoId}_forn_*&select=key,value`,
      {
        method: "GET",
        headers: getHeaders(),
      }
    );
    if (!res.ok) return {};
    const rows = await res.json();
    if (!Array.isArray(rows)) return {};
    const resultado: Record<number, any> = {};
    for (const r of rows) {
      if (r?.key && r?.value) {
        const parts = r.key.split("_forn_");
        if (parts.length === 2) {
          const idx = parseInt(parts[1], 10);
          if (!isNaN(idx)) {
            resultado[idx] = r.value;
          }
        }
      }
    }
    return resultado;
  } catch {
    return {};
  }
}

