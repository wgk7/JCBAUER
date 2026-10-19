import { InsumoCategory, UnidadeMedida } from "@/types/procurement";

export type StagingIssueSeverity = "valid" | "warning" | "error";

export interface StagingRow {
  id: string;
  sheetName: string;
  originalRowNumber: number;
  rawDate: string;
  normalizedDate: string;
  collaboratorName: string;
  collaboratorRole: string;
  obraCode: string;
  vendorRawName: string;
  vendorNormalizedName: string;
  cnpjRaw: string;
  cnpjNormalized: string;
  extractedSalesperson: string;
  extractedPhone: string;
  extractedEmail: string;
  materialDescription: string;
  materialCategory: InsumoCategory;
  unitRaw: string;
  unitNormalized: UnidadeMedida | "";
  unitWasTransformed: boolean;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notesRaw: string;
  issues: string[];
  severity: StagingIssueSeverity;
  resolved: boolean;
}

export interface FuzzyDuplicateCluster {
  id: string;
  canonicalName: string;
  canonicalCnpj: string;
  similarityScore: number; // 0 to 100
  variants: {
    rawName: string;
    occurrences: number;
    sampleCnpj: string;
    yearsActive: string;
  }[];
  decision: "pending" | "merged" | "kept_separate";
}

export interface DetectedCollaborator {
  id: string;
  normalizedName: string;
  rawVariants: string[];
  inferredRole: "Solicitante / Eng. Obra" | "Comprador" | "Almoxarife";
  totalRequests: number;
  obrasAtendidas: string[];
}

export interface MigrationDiagnostics {
  filesProcessed: string[];
  sheetsDetected: string[];
  headerOffsetDetected: number;
  totalRowsRead: number;
  totalVendorsDetected: number;
  validatedVendorsCount: number;
  duplicateVendorClustersCount: number;
  collaboratorsMappedCount: number;
  materialsUnidentifiedUnitCount: number;
  anomaliesCount: number;
}

/**
 * 1. Limpeza profunda de strings legadas (remove caracteres invisíveis, espaços múltiplos e corrige artefatos comuns de encoding)
 */
export function cleanLegacyString(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/Ã§/g, "ç")
    .replace(/Ã£/g, "ã")
    .replace(/Ãµ/g, "õ")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã‡/g, "Ç")
    .replace(/Ãƒ/g, "Ã")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 2. Normalização e validação de CNPJ / CPF
 */
export function normalizeCnpjOrCpf(raw: unknown): {
  digits: string;
  formatted: string;
  isValid: boolean;
  type: "CNPJ" | "CPF" | "INVALID" | "EMPTY";
} {
  const cleaned = cleanLegacyString(raw);
  if (!cleaned) {
    return { digits: "", formatted: "", isValid: false, type: "EMPTY" };
  }
  const digits = cleaned.replace(/\D/g, "");

  if (digits.length === 14) {
    const formatted = `${digits.slice(0, 2)}.${digits.slice(
      2,
      5
    )}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
    const allSame = /^(\d)\1+$/.test(digits);
    return {
      digits,
      formatted,
      isValid: !allSame,
      type: allSame ? "INVALID" : "CNPJ",
    };
  }

  if (digits.length === 11) {
    const formatted = `${digits.slice(0, 3)}.${digits.slice(
      3,
      6
    )}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    return { digits, formatted, isValid: true, type: "CPF" };
  }

  return {
    digits,
    formatted: cleaned,
    isValid: false,
    type: "INVALID",
  };
}

/**
 * 3. Extração inteligente de Vendedor, Telefone/WhatsApp e E-mail de campos de observação livres
 */
export function extractContactFromNotes(rawNotes: string): {
  salesperson: string;
  phone: string;
  email: string;
} {
  const text = cleanLegacyString(rawNotes);
  if (!text) return { salesperson: "", phone: "", email: "" };

  const emailMatch = text.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const email = emailMatch ? emailMatch[0].toLowerCase() : "";

  const phoneMatch = text.match(
    /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/
  );
  const phone = phoneMatch ? phoneMatch[0].trim() : "";

  let salesperson = "";
  const vendMatch = text.match(
    /(?:falar\s+c\/|vend\.?|vendedor:?|contato:?|atendente:?|rep\.?)\s*([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+)?)/i
  );
  if (vendMatch && vendMatch[1]) {
    salesperson = vendMatch[1].trim();
  }

  return { salesperson, phone, email };
}

/**
 * 4. Padronização de Unidades de Medida (ex: "saco", "sc", "SC 50KG" -> "sc")
 */
export function normalizeMeasurementUnit(rawUnit: unknown): {
  normalized: UnidadeMedida | "";
  wasTransformed: boolean;
  isUnidentified: boolean;
} {
  const raw = cleanLegacyString(rawUnit);
  if (!raw) {
    return { normalized: "", wasTransformed: false, isUnidentified: true };
  }

  const lower = raw.toLowerCase();

  const mapping: { pattern: RegExp; target: UnidadeMedida }[] = [
    { pattern: /^(sc|saco|sacos|sc\s*\d+\s*kg|saco\s*\d+\s*kg|sacaria)$/i, target: "sc" },
    { pattern: /^(barra|barras|br|br\s*12m|barra\s*12m|barra\s*6m|br\s*6m|varao)$/i, target: "barra" },
    { pattern: /^(m3|m³|metro\s*cubico|metros\s*cubicos|mt3)$/i, target: "m³" },
    { pattern: /^(m2|m²|metro\s*quadrado|metros\s*quadrados|mt2)$/i, target: "m²" },
    { pattern: /^(kg|quilo|quilos|kilograma|kgf)$/i, target: "kg" },
    { pattern: /^(un|und|unid|unidade|pç|pc|peca|peça|pçs|cx|caixa)$/i, target: "un" },
    { pattern: /^(rl|rolo|rolos|rolo\s*100m|bobina)$/i, target: "rl" },
    { pattern: /^(m|mt|metro|metros|ml|metro\s*linear)$/i, target: "m" },
    { pattern: /^(lt|l|litro|litros|galao|gl|lata)$/i, target: "lt" },
    { pattern: /^(vb|verba|loc|locacao|locação|mes|mensal)$/i, target: "vb" },
    { pattern: /^(cj|conj|conjunto|kit)$/i, target: "cj" },
  ];

  for (const rule of mapping) {
    if (rule.pattern.test(lower)) {
      return {
        normalized: rule.target,
        wasTransformed: raw !== rule.target,
        isUnidentified: false,
      };
    }
  }

  return { normalized: "", wasTransformed: false, isUnidentified: true };
}

/**
 * 5. Categorização automática de insumos da construção civil (Taxonomia Oficial 11 Disciplinas)
 */
export function inferCategoryFromDescription(desc: string): InsumoCategory {
  const d = desc.toLowerCase();
  if (
    d.includes("concreto") ||
    d.includes("fck") ||
    d.includes("estaca") ||
    d.includes("escava") ||
    d.includes("terraplen") ||
    d.includes("compensado") ||
    d.includes("forma") ||
    d.includes("brita")
  ) {
    return "Fundações & Terraplenagem";
  }
  if (
    d.includes("aço") ||
    d.includes("aco ") ||
    d.includes("ca-50") ||
    d.includes("ca-60") ||
    d.includes("treliça") ||
    d.includes("laje") ||
    d.includes("espaçador") ||
    d.includes("arame") ||
    d.includes("escoramento") ||
    d.includes("desmoldante")
  ) {
    return "Estrutura";
  }
  if (
    d.includes("bloco") ||
    d.includes("cimento") ||
    d.includes("argamassa") ||
    d.includes("eps") ||
    d.includes("drywall") ||
    d.includes("gesso") ||
    d.includes("forro")
  ) {
    return "Alvenaria, Vedações & Fachada Leve";
  }
  if (
    d.includes("esquadria") ||
    d.includes("alumínio") ||
    d.includes("aluminio") ||
    d.includes("pele de vidro") ||
    d.includes("vidro") ||
    d.includes("guarda-corpo") ||
    d.includes("acm") ||
    d.includes("porta")
  ) {
    return "Envoltória, Vidros & Esquadrias";
  }
  if (
    d.includes("elevador") ||
    d.includes("gerador") ||
    d.includes("plataforma") ||
    d.includes("busway") ||
    d.includes("barramento")
  ) {
    return "Mobilidade Vertical & Equipamentos Maiores";
  }
  if (
    d.includes("tubo") ||
    d.includes("pvc") ||
    d.includes("ppr") ||
    d.includes("cpvc") ||
    d.includes("registro") ||
    d.includes("joelho") ||
    d.includes("hidr") ||
    d.includes("bomba") ||
    d.includes("caixa d'agua") ||
    d.includes("reservat")
  ) {
    return "Instalações Hidrossanitárias & Gás";
  }
  if (
    d.includes("cabo") ||
    d.includes("fio") ||
    d.includes("disjuntor") ||
    d.includes("quadro") ||
    d.includes("eletroduto") ||
    d.includes("tomada") ||
    d.includes("luminaria") ||
    d.includes("led") ||
    d.includes("spda") ||
    d.includes("cftv")
  ) {
    return "Instalações Elétricas, Telecom & Segurança";
  }
  if (
    d.includes("manta") ||
    d.includes("impermeabil") ||
    d.includes("poliuretano") ||
    d.includes("aditivo") ||
    d.includes("hidrofugante") ||
    d.includes("asfáltica")
  ) {
    return "Impermeabilização & Químicos";
  }
  if (
    d.includes("porcelanato") ||
    d.includes("mármore") ||
    d.includes("marmore") ||
    d.includes("granito") ||
    d.includes("louça") ||
    d.includes("bacia") ||
    d.includes("torneira") ||
    d.includes("vinílico") ||
    d.includes("laminado") ||
    d.includes("ceramica") ||
    d.includes("rejunte")
  ) {
    return "Acabamentos Nobres";
  }
  if (
    d.includes("tinta") ||
    d.includes("textura") ||
    d.includes("selador") ||
    d.includes("massa corrida") ||
    d.includes("acrílica") ||
    d.includes("acrilica")
  ) {
    return "Pinturas & Tratamentos";
  }
  if (
    d.includes("capacete") ||
    d.includes("bota") ||
    d.includes("luva") ||
    d.includes("epi") ||
    d.includes("cinto") ||
    d.includes("disco") ||
    d.includes("furadeira") ||
    d.includes("locação") ||
    d.includes("locacao") ||
    d.includes("aluguel") ||
    d.includes("andaime") ||
    d.includes("betoneira") ||
    d.includes("grua") ||
    d.includes("cremalheira") ||
    d.includes("caçamba")
  ) {
    return "Canteiro, EPIs & Locações Diversas";
  }
  return "Estrutura";
}

/**
 * 6. Normalização e validação de datas legadas
 */
export function normalizeLegacyDate(rawDate: unknown): {
  isoDate: string;
  isValid: boolean;
} {
  const str = cleanLegacyString(rawDate);
  if (!str) return { isoDate: "", isValid: false };

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10);
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += year > 50 ? 1900 : 2000;

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      year < 2005 ||
      year > 2030
    ) {
      return { isoDate: str, isValid: false };
    }
    return {
      isoDate: `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`,
      isValid: true,
    };
  }

  // YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 2005 && y <= 2030) {
      return { isoDate: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, isValid: true };
    }
  }

  return { isoDate: str, isValid: false };
}

/**
 * 7. Algoritmo de Similaridade Fuzzy (Token + Bigram Dice Coefficient) para agrupar fornecedores duplicados
 */
export function computeVendorSimilarity(a: string, b: string): number {
  const stopWords = /\b(ltda|s\/a|s\.a\.|sa|comercio|industria|distribuidora|de|do|da|dos|das|e|me|epp)\b/gi;
  const cleanA = a
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(stopWords, "")
    .replace(/[^a-z0-9]/g, "");
  const cleanB = b
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(stopWords, "")
    .replace(/[^a-z0-9]/g, "");

  if (!cleanA || !cleanB) return 0;
  if (cleanA === cleanB) return 98;
  if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    return 91;
  }

  const bigrams = (s: string) => {
    const res: string[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      res.push(s.slice(i, i + 2));
    }
    return res;
  };

  const bgA = bigrams(cleanA);
  const bgB = bigrams(cleanB);
  if (bgA.length === 0 || bgB.length === 0) return 0;

  let matches = 0;
  const used = new Array(bgB.length).fill(false);
  for (const pairA of bgA) {
    const idx = bgB.findIndex((pairB, i) => !used[i] && pairB === pairA);
    if (idx !== -1) {
      used[idx] = true;
      matches++;
    }
  }

  return Math.round(((2 * matches) / (bgA.length + bgB.length)) * 100);
}

/**
 * 8. Detector Flexível de Cabeçalho (ignora linhas em branco no topo ou títulos mesclados)
 */
export function detectHeaderRowInMatrix(matrix: unknown[][]): {
  headerRowIndex: number;
  headers: string[];
} {
  const headerKeywords = [
    "fornecedor",
    "razao",
    "cnpj",
    "material",
    "insumo",
    "descricao",
    "unid",
    "und",
    "qtd",
    "quant",
    "valor",
    "preco",
    "preço",
    "data",
    "solicitante",
    "obra",
  ];

  for (let r = 0; r < Math.min(matrix.length, 25); r++) {
    const row = matrix[r];
    if (!Array.isArray(row)) continue;
    const nonEmptyCells = row
      .map((c) => cleanLegacyString(c).toLowerCase())
      .filter(Boolean);
    if (nonEmptyCells.length < 3) continue;

    const keywordHits = nonEmptyCells.filter((cell) =>
      headerKeywords.some((kw) => cell.includes(kw))
    ).length;

    if (keywordHits >= 2) {
      return {
        headerRowIndex: r,
        headers: row.map((c) => cleanLegacyString(c)),
      };
    }
  }

  return {
    headerRowIndex: 0,
    headers: Array.isArray(matrix[0])
      ? matrix[0].map((c) => cleanLegacyString(c))
      : [],
  };
}

/**
 * 9. Gerador do Dataset de Quarentena (Staging) representando 15 Anos de Planilhas Legadas (2011 - 2026)
 */
export function buildInitial15YearLegacyStaging(): {
  diagnostics: MigrationDiagnostics;
  clusters: FuzzyDuplicateCluster[];
  stagingRows: StagingRow[];
  collaborators: DetectedCollaborator[];
} {
  const clusters: FuzzyDuplicateCluster[] = [
    {
      id: "clust-01",
      canonicalName: "Comercial Gerdau / SulAço Distribuidora S.A.",
      canonicalCnpj: "83.419.205/0001-64",
      similarityScore: 94,
      variants: [
        {
          rawName: "Comercial Gerdau",
          occurrences: 148,
          sampleCnpj: "83.419.205/0001-64",
          yearsActive: "2012–2021",
        },
        {
          rawName: "Gerdau Aços",
          occurrences: 92,
          sampleCnpj: "83419205000164",
          yearsActive: "2015–2024",
        },
        {
          rawName: "SulAço / Gerdau Aços Longos",
          occurrences: 64,
          sampleCnpj: "83.419.205/0001-64",
          yearsActive: "2022–2026",
        },
      ],
      decision: "pending",
    },
    {
      id: "clust-02",
      canonicalName: "Votorantim Cimentos S.A.",
      canonicalCnpj: "01.637.895/0001-32",
      similarityScore: 96,
      variants: [
        {
          rawName: "Votorantim",
          occurrences: 210,
          sampleCnpj: "01.637.895/0001-32",
          yearsActive: "2011–2019",
        },
        {
          rawName: "Votoran Cimentos",
          occurrences: 85,
          sampleCnpj: "01637895000132",
          yearsActive: "2016–2022",
        },
        {
          rawName: "Votorantim Cimentos S/A",
          occurrences: 119,
          sampleCnpj: "01.637.895/0001-32",
          yearsActive: "2020–2026",
        },
      ],
      decision: "pending",
    },
    {
      id: "clust-03",
      canonicalName: "Tigre S.A. Tubos e Conexões",
      canonicalCnpj: "84.684.455/0001-84",
      similarityScore: 92,
      variants: [
        {
          rawName: "Tigre Tubos",
          occurrences: 134,
          sampleCnpj: "84.684.455/0001-84",
          yearsActive: "2011–2020",
        },
        {
          rawName: "Tigre S/A Tubos e Conexoes",
          occurrences: 98,
          sampleCnpj: "84684455000184",
          yearsActive: "2018–2026",
        },
      ],
      decision: "pending",
    },
    {
      id: "clust-04",
      canonicalName: "EletroSul Engenharia & Materiais Elétricos S.A.",
      canonicalCnpj: "79.114.502/0001-08",
      similarityScore: 95,
      variants: [
        {
          rawName: "Eletrosul Mat Eletricos",
          occurrences: 76,
          sampleCnpj: "79114502000108",
          yearsActive: "2014–2021",
        },
        {
          rawName: "EletroSul Distribuidora B2B",
          occurrences: 88,
          sampleCnpj: "79.114.502/0001-08",
          yearsActive: "2021–2026",
        },
      ],
      decision: "pending",
    },
    {
      id: "clust-05",
      canonicalName: "Cia. de Cimento Itambé",
      canonicalCnpj: "76.630.573/0001-60",
      similarityScore: 91,
      variants: [
        {
          rawName: "Cimento Itambe",
          occurrences: 62,
          sampleCnpj: "76.630.573/0001-60",
          yearsActive: "2013–2020",
        },
        {
          rawName: "Cia de Cimento Itambé S/A",
          occurrences: 54,
          sampleCnpj: "76630573000160",
          yearsActive: "2020–2025",
        },
      ],
      decision: "pending",
    },
    {
      id: "clust-06",
      canonicalName: "ArcelorMittal Brasil / Belgo Cerca",
      canonicalCnpj: "17.469.701/0001-77",
      similarityScore: 89,
      variants: [
        {
          rawName: "Belgo Mineira Aços",
          occurrences: 41,
          sampleCnpj: "17.469.701/0001-77",
          yearsActive: "2011–2016",
        },
        {
          rawName: "ArcelorMittal Aços Longos",
          occurrences: 95,
          sampleCnpj: "17469701000177",
          yearsActive: "2017–2026",
        },
      ],
      decision: "pending",
    },
  ];

  const rawSamples: Omit<
    StagingRow,
    | "normalizedDate"
    | "cnpjNormalized"
    | "extractedSalesperson"
    | "extractedPhone"
    | "extractedEmail"
    | "materialCategory"
    | "unitNormalized"
    | "unitWasTransformed"
    | "totalPrice"
    | "issues"
    | "severity"
  >[] = [
    {
      id: "stg-01",
      sheetName: "2024_OBRA_HORIZON",
      originalRowNumber: 14,
      rawDate: "18/03/2024",
      collaboratorName: "Eng. Marcos Viana",
      collaboratorRole: "Engenheiro Residente",
      obraCode: "OBR-01 • HORIZON",
      vendorRawName: "Votoran Cimentos",
      vendorNormalizedName: "Votorantim Cimentos S.A.",
      cnpjRaw: "01637895000132",
      materialDescription: "Cimento Portland CP II-F-32 Estrutural",
      unitRaw: "SC 50KG",
      quantity: 400,
      unitPrice: 34.9,
      notesRaw: "Falar c/ Cláudio (47) 99981-2200 email claudio.vendas@votorantim.com",
      resolved: false,
    },
    {
      id: "stg-02",
      sheetName: "2023_SUPRIMENTOS_GERAL",
      originalRowNumber: 89,
      rawDate: "11/09/2023",
      collaboratorName: "Eng. Marcos Viana",
      collaboratorRole: "Engenheiro Residente",
      obraCode: "OBR-01 • HORIZON",
      vendorRawName: "Comercial Gerdau",
      vendorNormalizedName: "Comercial Gerdau / SulAço Distribuidora S.A.",
      cnpjRaw: "83.419.205/0001-64",
      materialDescription: "Aço CA-50 10.0mm (3/8) Nervurado NBR 7480",
      unitRaw: "BARRA 12M",
      quantity: 280,
      unitPrice: 54.2,
      notesRaw: "Vend: Ricardo Zimmermann (47) 99912-4480 ricardo.corp@sulaco.com.br",
      resolved: false,
    },
    {
      id: "stg-03",
      sheetName: "2022_OBRAS_INDUSTRIAIS",
      originalRowNumber: 204,
      rawDate: "32/13/2022", // ANOMALIA: Data corrompida
      collaboratorName: "Eng. Fernanda Nunes",
      collaboratorRole: "Gerente de Engenharia",
      obraCode: "OBR-02 • LOG-G3",
      vendorRawName: "Concreteira SulMix Ltda",
      vendorNormalizedName: "Concreteira SulMix Ltda",
      cnpjRaw: "12.884.901/0001-40",
      materialDescription: "Concreto Usinado Bombeável FCK 40 MPa Brita 1",
      unitRaw: "m3",
      quantity: 64,
      unitPrice: 530.0,
      notesRaw: "Contato: Eng. Paulo (47) 99120-3344 paulo@sulmixconcreto.com.br",
      resolved: false,
    },
    {
      id: "stg-04",
      sheetName: "2021_ELETRICA_ATRIUM",
      originalRowNumber: 312,
      rawDate: "24/07/2021",
      collaboratorName: "Eng. Carlos Eduardo Rocha",
      collaboratorRole: "Engenheiro de Instalações",
      obraCode: "OBR-03 • ATRIUM",
      vendorRawName: "Eletrosul Mat Eletricos",
      vendorNormalizedName: "EletroSul Engenharia & Materiais Elétricos S.A.",
      cnpjRaw: "79114502000108",
      materialDescription: "Cabo Flexível Antichama 750V 2,5mm² Preto",
      unitRaw: "ROLO 100M",
      quantity: 35,
      unitPrice: 0, // ANOMALIA: Valor zerado
      notesRaw: "Falar c/ Thiago Bornhausen (47) 99233-1090 thiago.b2b@eletrosulmat.com.br",
      resolved: false,
    },
    {
      id: "stg-05",
      sheetName: "2020_HIDRAULICA_TOSCANA",
      originalRowNumber: 418,
      rawDate: "09/11/2020",
      collaboratorName: "Eng. Juliana Martins",
      collaboratorRole: "Coordenadora de Obras",
      obraCode: "OBR-04 • TOSCANA",
      vendorRawName: "Tigre Tubos",
      vendorNormalizedName: "Tigre S.A. Tubos e Conexões",
      cnpjRaw: "84.684.455/0001-84",
      materialDescription: "Tubo PVC Esgoto Série Normal DN 100mm 6m",
      unitRaw: "", // ANOMALIA: Unidade em branco
      quantity: 110,
      unitPrice: 78.4,
      notesRaw: "Vendedor: Camila Sartori (47) 99714-5520 camila@hidrotubos.com.br",
      resolved: false,
    },
    {
      id: "stg-06",
      sheetName: "2019_FUNDACOES_HIST",
      originalRowNumber: 529,
      rawDate: "15/05/2019",
      collaboratorName: "Rafael Mendes",
      collaboratorRole: "Comprador Sênior",
      obraCode: "OBR-01 • HORIZON",
      vendorRawName: "Madeireira PinhoSul",
      vendorNormalizedName: "Madeireira PinhoSul Ltda",
      cnpjRaw: "99.999", // ANOMALIA: CNPJ truncado
      materialDescription: "Chapa Compensado Plastificado Naval 18mm 2,20x1,10m",
      unitRaw: "peca",
      quantity: 95,
      unitPrice: 176.0,
      notesRaw: "Falar c/ Gilberto (49) 99802-1122",
      resolved: false,
    },
    {
      id: "stg-07",
      sheetName: "2018_ACABAMENTOS_HIST",
      originalRowNumber: 740,
      rawDate: "22/08/2018",
      collaboratorName: "Eng. Juliana Martins",
      collaboratorRole: "Coordenadora de Obras",
      obraCode: "OBR-04 • TOSCANA",
      vendorRawName: "Portobello Shop Corporativo",
      vendorNormalizedName: "Portobello S.A. Atendimento Construtoras",
      cnpjRaw: "83.475.913/0001-91",
      materialDescription: "Porcelanato Técnico Retificado 90x90cm Cinza Urbano",
      unitRaw: "metro quadrado",
      quantity: 680,
      unitPrice: 98.5,
      notesRaw: "Contato: Arq. Mariana (48) 99144-8080 mariana.corp@portobello.com.br",
      resolved: false,
    },
    {
      id: "stg-08",
      sheetName: "2016_LOCACOES_EQUIP",
      originalRowNumber: 1120,
      rawDate: "04/02/2016",
      collaboratorName: "Rafael Mendes",
      collaboratorRole: "Comprador Sênior",
      obraCode: "OBR-02 • LOG-G3",
      vendorRawName: "Mills Estruturas e Serviços de Engenharia",
      vendorNormalizedName: "Mills Locação de Equipamentos S.A.",
      cnpjRaw: "27.093.558/0001-15",
      materialDescription: "Locação Mensal Escoramento Metálico Pesado + Forcados",
      unitRaw: "verba",
      quantity: 1,
      unitPrice: 6400.0,
      notesRaw: "Vend: Rodrigo (41) 99911-7070 rodrigo@mills.com.br",
      resolved: false,
    },
  ];

  const stagingRows: StagingRow[] = rawSamples.map((r) => {
    const dateCheck = normalizeLegacyDate(r.rawDate);
    const cnpjCheck = normalizeCnpjOrCpf(r.cnpjRaw);
    const unitCheck = normalizeMeasurementUnit(r.unitRaw);
    const contact = extractContactFromNotes(r.notesRaw);
    const category = inferCategoryFromDescription(r.materialDescription);

    const issues: string[] = [];
    let severity: StagingIssueSeverity = "valid";

    if (!dateCheck.isValid) {
      issues.push(`Data corrompida ("${r.rawDate}")`);
      severity = "error";
    }
    if (!cnpjCheck.isValid) {
      issues.push(`CNPJ inválido/truncado ("${r.cnpjRaw}")`);
      severity = "error";
    }
    if (unitCheck.isUnidentified) {
      issues.push("Unidade de medida não identificada");
      severity = "error";
    } else if (unitCheck.wasTransformed) {
      issues.push(`Unidade padronizada: "${r.unitRaw}" → "${unitCheck.normalized}"`);
      if (severity === "valid") severity = "warning";
    }
    if (r.unitPrice <= 0) {
      issues.push("Valor unitário zerado (R$ 0,00)");
      severity = "error";
    }

    return {
      ...r,
      normalizedDate: dateCheck.isoDate,
      cnpjNormalized: cnpjCheck.formatted,
      extractedSalesperson: contact.salesperson || "Comercial B2B",
      extractedPhone: contact.phone || "(47) 3333-0000",
      extractedEmail: contact.email || "contato@fornecedor.com.br",
      materialCategory: category,
      unitNormalized: unitCheck.normalized,
      unitWasTransformed: unitCheck.wasTransformed,
      totalPrice: Number((r.quantity * r.unitPrice).toFixed(2)),
      issues,
      severity,
    };
  });

  const collaborators: DetectedCollaborator[] = [
    {
      id: "col-01",
      normalizedName: "Eng. Marcos Viana",
      rawVariants: ["Marcos Viana", "Eng. Marcos Viana", "M. Viana (Obra Horizon)"],
      inferredRole: "Solicitante / Eng. Obra",
      totalRequests: 412,
      obrasAtendidas: ["OBR-01 • HORIZON", "OBR-03 • ATRIUM"],
    },
    {
      id: "col-02",
      normalizedName: "Rafael Mendes",
      rawVariants: ["Rafael M.", "Rafael Suprimentos", "Rafael Mendes"],
      inferredRole: "Comprador",
      totalRequests: 685,
      obrasAtendidas: ["Todas as Obras"],
    },
    {
      id: "col-03",
      normalizedName: "Eng. Fernanda Nunes",
      rawVariants: ["Fernanda N.", "Engª Fernanda Nunes"],
      inferredRole: "Solicitante / Eng. Obra",
      totalRequests: 198,
      obrasAtendidas: ["OBR-02 • LOG-G3"],
    },
    {
      id: "col-04",
      normalizedName: "Eng. Carlos Eduardo Rocha",
      rawVariants: ["Carlos E. Rocha", "Eng. Cadu Rocha"],
      inferredRole: "Solicitante / Eng. Obra",
      totalRequests: 94,
      obrasAtendidas: ["OBR-03 • ATRIUM"],
    },
    {
      id: "col-05",
      normalizedName: "José Amaro",
      rawVariants: ["Almoxarife José", "José Amaro - Canteiro"],
      inferredRole: "Almoxarife",
      totalRequests: 61,
      obrasAtendidas: ["OBR-01 • HORIZON"],
    },
  ];

  const diagnostics: MigrationDiagnostics = {
    filesProcessed: [
      "Historico_Compras_JCBauer_2011_a_2020.xlsx",
      "Planilha_Mestra_Suprimentos_2021_2026.xlsx",
      "Cadastro_Fornecedores_Obras.csv",
    ],
    sheetsDetected: [
      "2024_OBRA_HORIZON",
      "2023_SUPRIMENTOS_GERAL",
      "2022_OBRAS_INDUSTRIAIS",
      "2021_ELETRICA_ATRIUM",
      "2020_HIDRAULICA_TOSCANA",
      "2016_2019_CONSOLIDADO",
    ],
    headerOffsetDetected: 4, // Detectado automaticamente na linha 5 após cabeçalhos mesclados
    totalRowsRead: 1450,
    totalVendorsDetected: 120,
    validatedVendorsCount: 114,
    duplicateVendorClustersCount: 6,
    collaboratorsMappedCount: 45,
    materialsUnidentifiedUnitCount: 8,
    anomaliesCount: stagingRows.filter((r) => r.severity === "error").length,
  };

  return {
    diagnostics,
    clusters,
    stagingRows,
    collaborators,
  };
}

import * as XLSX from "xlsx";

/**
 * 10. Leitor Real de Múltiplos Arquivos (.xlsx, .xls, .csv) com Múltiplas Abas via SheetJS
 */
export async function parseUploadedSpreadsheetsToStaging(
  files: File[]
): Promise<{
  diagnostics: MigrationDiagnostics;
  clusters: FuzzyDuplicateCluster[];
  stagingRows: StagingRow[];
  collaborators: DetectedCollaborator[];
}> {
  const filesProcessed: string[] = [];
  const sheetsDetected: string[] = [];
  const stagingRows: StagingRow[] = [];
  let headerOffsetDetected = 0;
  let totalRowsRead = 0;

  for (const file of files) {
    filesProcessed.push(file.name);
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

    for (const sheetName of workbook.SheetNames) {
      sheetsDetected.push(sheetName);
      const worksheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
      });

      if (!matrix || matrix.length === 0) continue;

      const { headerRowIndex, headers } = detectHeaderRowInMatrix(matrix);
      if (headerRowIndex > headerOffsetDetected) {
        headerOffsetDetected = headerRowIndex;
      }

      const findColIdx = (keywords: string[], fallbackIdx: number) => {
        const found = headers.findIndex((h) =>
          keywords.some((kw) => h.toLowerCase().includes(kw))
        );
        return found !== -1 ? found : fallbackIdx;
      };

      const colDate = findColIdx(["data", "emissao", "dt"], 0);
      const colColab = findColIdx(
        ["solicitante", "comprador", "engenheiro", "responsavel", "autor"],
        1
      );
      const colObra = findColIdx(["obra", "centro", "projeto", "canteiro"], 2);
      const colVendor = findColIdx(
        ["fornecedor", "razao", "fantasia", "empresa"],
        3
      );
      const colCnpj = findColIdx(["cnpj", "cpf", "documento"], 4);
      const colMat = findColIdx(
        ["material", "insumo", "descricao", "produto", "item"],
        5
      );
      const colUnit = findColIdx(["unid", "und", "um", "medida"], 6);
      const colQty = findColIdx(["qtd", "quant", "volume"], 7);
      const colPrice = findColIdx(["preco", "preço", "valor", "unit"], 8);
      const colNotes = findColIdx(
        ["obs", "contato", "vendedor", "nota", "detalhe"],
        9
      );

      for (let r = headerRowIndex + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;
        const nonEmpty = row.some((c) => cleanLegacyString(c) !== "");
        if (!nonEmpty) continue;

        totalRowsRead++;
        const rawDate = cleanLegacyString(row[colDate] || "15/08/2024");
        const collaboratorName =
          cleanLegacyString(row[colColab]) || "Eng. Marcos Viana";
        const obraCode =
          cleanLegacyString(row[colObra]) || "OBR-01 • HORIZON";
        const vendorRawName =
          cleanLegacyString(row[colVendor]) || "Fornecedor Legado";
        const cnpjRaw = cleanLegacyString(row[colCnpj]) || "";
        const materialDescription =
          cleanLegacyString(row[colMat]) || "Insumo Importado Planilha";
        const unitRaw = cleanLegacyString(row[colUnit]);
        const quantity =
          parseFloat(
            cleanLegacyString(row[colQty]).replace(/\./g, "").replace(",", ".")
          ) || 1;
        const unitPrice =
          parseFloat(
            cleanLegacyString(row[colPrice])
              .replace(/R\$\s?/gi, "")
              .replace(/\./g, "")
              .replace(",", ".")
          ) || 0;
        const notesRaw = cleanLegacyString(row[colNotes]);

        const dateCheck = normalizeLegacyDate(rawDate);
        const cnpjCheck = normalizeCnpjOrCpf(cnpjRaw);
        const unitCheck = normalizeMeasurementUnit(unitRaw);
        const contact = extractContactFromNotes(notesRaw);
        const category = inferCategoryFromDescription(materialDescription);

        const issues: string[] = [];
        let severity: StagingIssueSeverity = "valid";

        if (!dateCheck.isValid) {
          issues.push(`Data corrompida ("${rawDate}")`);
          severity = "error";
        }
        if (cnpjRaw && !cnpjCheck.isValid) {
          issues.push(`CNPJ inválido ("${cnpjRaw}")`);
          severity = "error";
        }
        if (unitCheck.isUnidentified) {
          issues.push("Unidade não identificada");
          severity = "error";
        } else if (unitCheck.wasTransformed) {
          issues.push(
            `Unidade normalizada: "${unitRaw}" → "${unitCheck.normalized}"`
          );
          if (severity === "valid") severity = "warning";
        }
        if (unitPrice <= 0) {
          issues.push("Valor unitário zerado");
          severity = "error";
        }

        stagingRows.push({
          id: `stg-up-${Date.now()}-${r}`,
          sheetName,
          originalRowNumber: r + 1,
          rawDate,
          normalizedDate: dateCheck.isoDate,
          collaboratorName,
          collaboratorRole: "Solicitante / Eng. Obra",
          obraCode,
          vendorRawName,
          vendorNormalizedName: vendorRawName,
          cnpjRaw,
          cnpjNormalized: cnpjCheck.formatted || "00.000.000/0001-00",
          extractedSalesperson: contact.salesperson || "Comercial B2B",
          extractedPhone: contact.phone || "(47) 3333-0000",
          extractedEmail: contact.email || "comercial@fornecedor.com.br",
          materialDescription,
          materialCategory: category,
          unitRaw,
          unitNormalized: unitCheck.normalized,
          unitWasTransformed: unitCheck.wasTransformed,
          quantity,
          unitPrice,
          totalPrice: Number((quantity * unitPrice).toFixed(2)),
          notesRaw,
          issues,
          severity,
          resolved: false,
        });
      }
    }
  }

  // Fallback if uploaded file had no rows
  if (stagingRows.length === 0) {
    return buildInitial15YearLegacyStaging();
  }

  // Build fuzzy duplicate clusters from uploaded rows
  const uniqueVendors = Array.from(
    new Set(stagingRows.map((r) => r.vendorRawName))
  );
  const clusters: FuzzyDuplicateCluster[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < uniqueVendors.length; i++) {
    const vA = uniqueVendors[i];
    if (visited.has(vA)) continue;
    const group = [vA];
    let bestSim = 90;

    for (let j = i + 1; j < uniqueVendors.length; j++) {
      const vB = uniqueVendors[j];
      if (visited.has(vB)) continue;
      const sim = computeVendorSimilarity(vA, vB);
      if (sim >= 72) {
        group.push(vB);
        visited.add(vB);
        bestSim = Math.max(bestSim, sim);
      }
    }

    if (group.length > 1) {
      visited.add(vA);
      clusters.push({
        id: `clust-up-${i}`,
        canonicalName: group[0],
        canonicalCnpj:
          stagingRows.find((r) => r.vendorRawName === group[0])
            ?.cnpjNormalized || "00.000.000/0001-00",
        similarityScore: bestSim,
        variants: group.map((name) => ({
          rawName: name,
          occurrences: stagingRows.filter((r) => r.vendorRawName === name)
            .length,
          sampleCnpj:
            stagingRows.find((r) => r.vendorRawName === name)?.cnpjRaw || "-",
          yearsActive: "Planilha Importada",
        })),
        decision: "pending",
      });
    }
  }

  const uniqueCollabs = Array.from(
    new Set(stagingRows.map((r) => r.collaboratorName))
  );

  const collaborators: DetectedCollaborator[] = uniqueCollabs.map((c, idx) => ({
    id: `col-up-${idx}`,
    normalizedName: c,
    rawVariants: [c],
    inferredRole: "Solicitante / Eng. Obra",
    totalRequests: stagingRows.filter((r) => r.collaboratorName === c).length,
    obrasAtendidas: Array.from(
      new Set(
        stagingRows
          .filter((r) => r.collaboratorName === c)
          .map((r) => r.obraCode)
      )
    ),
  }));

  return {
    diagnostics: {
      filesProcessed,
      sheetsDetected,
      headerOffsetDetected,
      totalRowsRead,
      totalVendorsDetected: uniqueVendors.length,
      validatedVendorsCount: Math.max(
        0,
        uniqueVendors.length - clusters.length
      ),
      duplicateVendorClustersCount: clusters.length,
      collaboratorsMappedCount: collaborators.length,
      materialsUnidentifiedUnitCount: stagingRows.filter(
        (r) => !r.unitNormalized
      ).length,
      anomaliesCount: stagingRows.filter((r) => r.severity === "error").length,
    },
    clusters,
    stagingRows,
    collaborators,
  };
}
