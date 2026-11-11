import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export interface ItemExtraido {
  codigo?: string;
  nome: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  precoTotal: number;
  confianca?: number;
}

export interface DadosExtraidos {
  fornecedorNome?: string;
  freteTipo: "CIF" | "FOB";
  freteValor: number;
  prazo: string;
  condicao: string;
  descontoValor: number;
  itens: ItemExtraido[];
  textoCompleto: string;
}

// Limpa e normaliza texto removendo acentos
function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Converte string monetária brasileira para número float (ex: "1.250,50" -> 1250.50)
function parseMoedaBR(str: string): number {
  if (!str) return 0;
  const limpo = str.replace(/[^\d.,]/g, "").trim();
  if (!limpo) return 0;

  if (limpo.includes(",") && limpo.includes(".")) {
    // Ex: 1.250,50
    return parseFloat(limpo.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (limpo.includes(",")) {
    // Ex: 1250,50
    return parseFloat(limpo.replace(",", ".")) || 0;
  }
  return parseFloat(limpo) || 0;
}

// Extrai dados comerciais gerais (frete, prazo, pagamento, desconto, fornecedor)
function extrairCondicoesComerciais(texto: string): {
  freteTipo: "CIF" | "FOB";
  freteValor: number;
  prazo: string;
  condicao: string;
  descontoValor: number;
  fornecedorNome?: string;
} {
  let freteTipo: "CIF" | "FOB" = "CIF";
  let freteValor = 0;
  let prazo = "";
  let condicao = "";
  let descontoValor = 0;
  let fornecedorNome: string | undefined = undefined;

  // Frete
  if (/(?:cif|incluso|gratis|gratuito|por nossa conta|entregue|frete\s*incluso)/i.test(texto)) {
    freteTipo = "CIF";
    freteValor = 0;
  } else if (/(?:fob|retira|por conta do cliente|sem frete)/i.test(texto)) {
    freteTipo = "FOB";
  }

  const matchValorFrete = texto.match(
    /(?:frete|transporte)[\s:]*(?:de|R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{1,2})/i
  );
  if (matchValorFrete && matchValorFrete[1]) {
    const v = parseMoedaBR(matchValorFrete[1]);
    if (v > 0) {
      freteTipo = "FOB";
      freteValor = v;
    }
  }

  // Prazo de Entrega
  const matchPrazo = texto.match(
    /(?:prazo\s*de\s*entrega|prazo)[\s:]*([^\n,.;]+?(?:dias|ddl|horas|hrs|imediato|pronta entrega|semana))/i
  );
  if (matchPrazo && matchPrazo[1]) {
    prazo = matchPrazo[1].trim();
  } else {
    const matchPrazoSimples = texto.match(
      /(\d+\s*(?:a\s*\d+)?\s*(?:dias|ddl)|pronta entrega|imediato)/i
    );
    if (matchPrazoSimples && matchPrazoSimples[1]) {
      prazo = matchPrazoSimples[1].trim();
    }
  }

  // Condição de Pagamento
  const matchPagto = texto.match(
    /(?:condicao\s*de\s*pagamento|pagamento|condicao|faturamento)[\s:]*([^\n\r,.;]+?(?:dias|ddl|vista|boleto|pix|14|28|30|60))/i
  );
  if (matchPagto && matchPagto[1]) {
    condicao = matchPagto[1].trim();
  } else {
    const textoSemCnpj = texto.replace(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\/\d{4}/g, "");
    const matchPagtoSimples = textoSemCnpj.match(
      /(\d+\s*(?:dias|ddl)|\b(?:14|21|28|30|45|60)\s*\/\s*(?:28|35|42|60|90)\b|a vista|à vista|boleto\s*\d+\s*dias|pix)/i
    );
    if (matchPagtoSimples && matchPagtoSimples[1]) {
      condicao = matchPagtoSimples[1].trim();
    }
  }

  // Desconto
  const matchDesc = texto.match(
    /desconto[\s:]*(?:de|R\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{1,2})/i
  );
  if (matchDesc && matchDesc[1]) {
    descontoValor = parseMoedaBR(matchDesc[1]);
  }

  // Fornecedor / Razão Social (captura apenas na mesma linha)
  const matchForn = texto.match(
    /(?:denominacao|denominação|fornecedor|empresa|razao\s*social|vendedor|emitente)[\t ]*[:=-]?[\t ]*([^\r\n,.;]{3,60})/i
  );
  if (matchForn && matchForn[1]) {
    const fn = matchForn[1].trim();
    if (!/^(cnpj|cpf|data|orcamento|pedido|numero|fone|tel|jc\s*bauer)/i.test(fn)) {
      fornecedorNome = fn;
    }
  }

  return { freteTipo, freteValor, prazo, condicao, descontoValor, fornecedorNome };
}

const isUnit = (t: string) =>
  /^(un|und|unid|unidade|pc|pç|peca|peça|m|mt|mts|metro|metros|kg|kilo|kilos|cx|caixa|caixas|sc|saco|sacos|rl|rolo|rolos|br|barra|barras|l|lt|lts|litro|litros|m2|m²|m3|m³|par|pares|jg|jogo|ct|cento|mil|kit|fd|fardo|pr|tb|tubo)$/i.test(
    (t || "").replace(/[^\w]/g, "")
  );

// Parser especializado em linhas de ERP / DAV / Orçamentos com conferência matemática Qtd * Unit ≈ Total
function parseLinhaERP(linha: string): ItemExtraido | null {
  const tokens = linha.trim().split(/\s+/);
  if (tokens.length < 3) return null;
  const n = tokens.length;

  // Tenta várias configurações de final de linha comuns em ERPs brasileiros
  const configs = [
    // Formato 0 (DAV com Unidade no final): [nome...] [qtd] [unit] [total] [und]
    {
      qtdIdx: n - 4,
      unitIdx: n - 3,
      totIdx: n - 2,
      undIdx: isUnit(tokens[n - 1]) ? n - 1 : -1,
      nameEnd: isUnit(tokens[n - 1]) ? n - 4 : -1,
    },
    // Formato 1: [nome...] [qtd] [unit] [total] (com unidade antes se houver)
    {
      qtdIdx: n - 3,
      unitIdx: n - 2,
      totIdx: n - 1,
      undIdx: isUnit(tokens[n - 4]) ? n - 4 : -1,
      nameEnd: isUnit(tokens[n - 4]) ? n - 4 : n - 3,
    },
    // Formato 2: [nome...] [qtd] [und] [unit] [total]
    { qtdIdx: n - 4, undIdx: n - 3, unitIdx: n - 2, totIdx: n - 1, nameEnd: n - 4 },
    // Formato 3: [nome...] [und] [qtd] [unit] [total]
    { undIdx: n - 4, qtdIdx: n - 3, unitIdx: n - 2, totIdx: n - 1, nameEnd: n - 4 },
    // Formato 4: [nome...] [qtd] [und] [unit] [desc] [total]
    { qtdIdx: n - 5, undIdx: n - 4, unitIdx: n - 3, descIdx: n - 2, totIdx: n - 1, nameEnd: n - 5 },
    // Formato 5: [nome...] [qtd] [unit] [desc] [total]
    {
      qtdIdx: n - 4,
      unitIdx: n - 3,
      descIdx: n - 2,
      totIdx: n - 1,
      undIdx: isUnit(tokens[n - 5]) ? n - 5 : -1,
      nameEnd: isUnit(tokens[n - 5]) ? n - 5 : n - 4,
    },
  ];

  for (const c of configs) {
    if (c.qtdIdx < 0 || c.unitIdx < 0 || c.totIdx < 0 || c.nameEnd < 0) continue;
    const vQtd = parseMoedaBR(tokens[c.qtdIdx]);
    const vUnit = parseMoedaBR(tokens[c.unitIdx]);
    const vTot = parseMoedaBR(tokens[c.totIdx]);

    if (vQtd > 0 && vUnit > 0 && vTot > 0) {
      const calcTot = vQtd * vUnit;
      const diff = Math.abs(calcTot - vTot);
      // Margem de tolerância para arredondamentos monetários ou centavos
      if (diff < (vTot * 0.08 + 1.0) || diff < 0.5) {
        let und = "un";
        if (c.undIdx >= 0 && tokens[c.undIdx]) und = tokens[c.undIdx].toLowerCase();

        const nameTokens = tokens.slice(0, c.nameEnd);
        // Remove item sequencial no início se existir (ex: '1', '01')
        if (/^\d{1,3}$/.test(nameTokens[0])) {
          nameTokens.shift();
        }
        // Identifica código do produto se presente (ex: '0000017320')
        let codigo: string | undefined = undefined;
        if (/^\d{3,15}$/.test(nameTokens[0])) {
          codigo = nameTokens.shift();
        }

        let nome = nameTokens
          .join(" ")
          .replace(/^[\s\-–—:;*•.,]+|[\s\-–—:;*•.,]+$/g, "")
          .trim();

        // Se o nome vier no padrão "009304 - DUALE-UP...", separa código e nome
        const matchCodHifen = nome.match(/^(\d{3,15})\s*[-–—]\s*(.+)$/);
        if (matchCodHifen) {
          if (!codigo) codigo = matchCodHifen[1];
          nome = matchCodHifen[2].trim();
        }

        if (nome.length >= 2 && !/^(item|codigo|descricao|total|valor|subtotal|produto)/i.test(normalizar(nome))) {
          return {
            codigo,
            nome,
            quantidade: vQtd,
            unidade: und,
            precoUnitario: vUnit,
            precoTotal: vTot,
            confianca: 0.98,
          };
        }
      }
    }
  }

  return null;
}

// Extrai insumos a partir de planilhas Excel (XLSX, XLS, CSV)
function extrairItensDeExcel(workbook: XLSX.WorkBook): ItemExtraido[] {
  const itens: ItemExtraido[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
    if (!rows || rows.length < 2) continue;

    // Tenta encontrar a linha do cabeçalho
    let colDesc = -1;
    let colQtd = -1;
    let colUnd = -1;
    let colUnit = -1;
    let colTotal = -1;
    let colCodigo = -1;
    let headerRowIdx = -1;

    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;

      row.forEach((cellVal: any, cIdx: number) => {
        const h = normalizar(String(cellVal || ""));
        if (!h) return;

        if (colDesc === -1 && /(descricao|material|insumo|produto|item|discriminacao|servico|nome)/i.test(h)) {
          colDesc = cIdx;
        } else if (colQtd === -1 && /(qtd|quantidade|quant|qtde)/i.test(h)) {
          colQtd = cIdx;
        } else if (colUnd === -1 && /(und|unidade|unid|un|medida)/i.test(h)) {
          colUnd = cIdx;
        } else if (colUnit === -1 && /(preco unit|vl unit|unitario|vlr unit|r\$ unit|preco|unit)/i.test(h) && !/(total)/i.test(h)) {
          colUnit = cIdx;
        } else if (colTotal === -1 && /(vl total|total|preco total|vlr total|subtotal)/i.test(h)) {
          colTotal = cIdx;
        } else if (colCodigo === -1 && /(codigo|cod|referencia|ref|sku)/i.test(h)) {
          colCodigo = cIdx;
        }
      });

      if (colDesc !== -1 && (colUnit !== -1 || colTotal !== -1)) {
        headerRowIdx = r;
        break;
      }
    }

    // Se encontrou cabeçalho estruturado
    if (headerRowIdx !== -1 && colDesc !== -1) {
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        const desc = String(row[colDesc] || "").trim();
        if (!desc || desc.length < 2) continue;
        if (/^(total|subtotal|observac|prazo|frete|condic|impostos|valor total)/i.test(normalizar(desc))) continue;

        let qtd = colQtd !== -1 ? parseMoedaBR(String(row[colQtd] || "")) : 1;
        if (qtd <= 0) qtd = 1;

        let und = colUnd !== -1 ? String(row[colUnd] || "").trim() : "un";
        if (!und) und = "un";

        let unit = colUnit !== -1 ? parseMoedaBR(String(row[colUnit] || "")) : 0;
        let total = colTotal !== -1 ? parseMoedaBR(String(row[colTotal] || "")) : 0;

        if (unit <= 0 && total > 0 && qtd > 0) {
          unit = Math.round((total / qtd) * 100) / 100;
        }
        if (total <= 0 && unit > 0 && qtd > 0) {
          total = Math.round(unit * qtd * 100) / 100;
        }

        if (unit > 0 || total > 0) {
          itens.push({
            codigo: colCodigo !== -1 ? String(row[colCodigo] || "").trim() : undefined,
            nome: desc,
            quantidade: qtd,
            unidade: und,
            precoUnitario: unit,
            precoTotal: total,
            confianca: 0.95,
          });
        }
      }
    } else {
      // Heurística de fallback em linhas genéricas da planilha
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (!Array.isArray(row)) continue;

        let textoCandidato = "";
        let numeros: number[] = [];

        row.forEach((cellVal: any) => {
          const str = String(cellVal || "").trim();
          if (!str) return;

          const num = parseMoedaBR(str);
          if (num > 0 && !isNaN(num)) {
            numeros.push(num);
          } else if (str.length > textoCandidato.length && !/^\d+$/.test(str)) {
            textoCandidato = str;
          }
        });

        if (textoCandidato.length >= 3 && numeros.length >= 1) {
          if (/^(total|subtotal|orcamento|proposta|cliente|data|cnpj|valor)/i.test(normalizar(textoCandidato))) {
            continue;
          }

          let unit = numeros[0];
          let qtd = 1;
          let total = unit;

          if (numeros.length >= 3) {
            qtd = numeros[0] > 0 ? numeros[0] : 1;
            unit = numeros[1];
            total = numeros[2];
          } else if (numeros.length === 2) {
            unit = Math.min(numeros[0], numeros[1]);
            total = Math.max(numeros[0], numeros[1]);
            qtd = unit > 0 ? Math.round(total / unit) || 1 : 1;
          }

          if (unit > 0) {
            itens.push({
              nome: textoCandidato,
              quantidade: qtd,
              unidade: "un",
              precoUnitario: unit,
              precoTotal: total,
              confianca: 0.8,
            });
          }
        }
      }
    }

    if (itens.length > 0) break;
  }

  return itens;
}

function decodePdfOctal(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

// Extrator PDF nativo com Node zlib (Zero dependências externas, 100% compatível com Vercel Serverless)
function extrairTextoPDFNativo(buffer: Buffer): string {
  try {
    const zlib = require("zlib");
    const content = buffer.toString("latin1");
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match: RegExpExecArray | null;
    const allLines: string[] = [];

    while ((match = streamRegex.exec(content)) !== null) {
      const rawStream = Buffer.from(match[1], "latin1");
      try {
        const decompressed = zlib.inflateSync(rawStream).toString("latin1");
        if (!decompressed.includes("BT")) continue;

        const pageBlocks: { x: number; y: number; text: string }[] = [];
        // Varredura sequencial exata de comandos de posição Td e comandos de texto Tj/'/"
        const tokenRegex = /(?:([-\d.]+)\s+([-\d.]+)\s+Td)|\(([^)]*)\)\s*(?:Tj|'|")/g;
        let currX = 0;
        let currY = 0;
        let tm: RegExpExecArray | null;

        while ((tm = tokenRegex.exec(decompressed)) !== null) {
          if (tm[1] !== undefined && tm[2] !== undefined) {
            currX = parseFloat(tm[1]);
            currY = parseFloat(tm[2]);
          } else if (tm[3] !== undefined) {
            const text = decodePdfOctal(tm[3]);
            if (text.trim()) {
              pageBlocks.push({ x: currX, y: currY, text: text.trim() });
            }
          }
        }

        const rowGroups: { y: number; items: { x: number; text: string }[] }[] = [];
        for (const b of pageBlocks) {
          let g = rowGroups.find((gr) => Math.abs(gr.y - b.y) <= 3.5);
          if (!g) {
            g = { y: b.y, items: [] };
            rowGroups.push(g);
          }
          g.items.push(b);
        }

        rowGroups.sort((a, b) => b.y - a.y);
        const pl = rowGroups
          .map((g) => {
            g.items.sort((a, b) => a.x - b.x);
            return g.items.map((i) => i.text).join(" ").trim();
          })
          .filter((l) => l.length > 0);

        allLines.push(...pl);
      } catch {}
    }

    return allLines.join("\n");
  } catch (err) {
    console.warn("Erro no extrator PDF nativo:", err);
    return "";
  }
}

// Extrai insumos a partir de linhas de texto (PDF, Word, WhatsApp, TXT)
function extrairItensDeTexto(textoBruto: string): ItemExtraido[] {
  const itens: ItemExtraido[] = [];
  const linhas = textoBruto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Palavras que indicam linhas de controle ou cabeçalhos que devem ser ignoradas
  const stopWords = /^(total|subtotal|valor\s*total|valor\s*dos\s*produtos|valor\s*do\s*orcamento|valor\s*da\s*nota|base\s*de\s*calculo|icms|ipi|iss|desconto|frete|prazo|condicao|forma\s*de\s*pagamento|pagamento|atenciosamente|orcamento|proposta|validade|cliente|emitente|cnpj|cpf|telefone|endereco|banco|chave\s*pix|dados\s*bancarios|pagina|pag\.|documento\s*auxiliar|numero:)/i;

  for (const linha of linhas) {
    const linhaNorm = normalizar(linha);
    if (stopWords.test(linhaNorm)) continue;
    if (linha.length < 5) continue;
    if (/\b(?:cnpj|cpf|inscricao|inscrição|ie|im|telefone|fone|email|e-mail|endereco|endereço|destinatario|destinatário|estabelecimento|emissao|emissão|denominacao|denominação)\b/i.test(linhaNorm)) {
      continue;
    }

    // 1. Tenta extrair pelo parser especializado de ERP / DAV
    const itemERP = parseLinhaERP(linha);
    if (itemERP) {
      itens.push(itemERP);
      continue;
    }

    // 2. Tenta extrair pelo padrão comum brasileiro (WhatsApp / Orçamento Livre)
    const matchesValores = linha.match(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})/g);
    if (!matchesValores || matchesValores.length === 0) continue;

    const valoresNum = matchesValores
      .map(parseMoedaBR)
      .filter((n) => n > 0 && !isNaN(n));

    if (valoresNum.length === 0) continue;

    // Busca padrões de quantidade e unidade na linha (ex: "100 m", "50 un", "10 pç", "2 cx", "5 sc", "15 kg", "12 m2")
    const matchQtdUnd = linha.match(
      /(\d+(?:[.,]\d+)?)\s*(un|und|unid|pc|pç|peca|m|mt|metro|metros|kg|kilo|kilos|cx|caixa|sc|saco|sacos|rolo|rolos|br|barra|barras|l|lt|litro|litros|m2|m²|m3|m³)\b/i
    );

    let qtd = 1;
    let und = "un";

    if (matchQtdUnd) {
      qtd = parseMoedaBR(matchQtdUnd[1]) || 1;
      und = matchQtdUnd[2].toLowerCase();
    } else {
      const matchQtdSolta = linha.match(/^(\d+(?:[.,]\d+)?)\s*[-xX*]?\s+([A-Za-z])/);
      if (matchQtdSolta) {
        qtd = parseMoedaBR(matchQtdSolta[1]) || 1;
      }
    }

    // Identifica Preço Unitário vs Preço Total
    let unit = valoresNum[0];
    let total = valoresNum[valoresNum.length - 1];

    if (valoresNum.length >= 2) {
      if (qtd > 1) {
        const candidatoUnit = valoresNum.find((v) => Math.abs(v * qtd - total) < (total * 0.05 + 1));
        if (candidatoUnit) {
          unit = candidatoUnit;
        } else {
          unit = Math.min(...valoresNum);
          total = Math.max(...valoresNum);
        }
      } else {
        unit = valoresNum[0];
        total = valoresNum[1];
      }
    } else {
      total = Math.round(unit * qtd * 100) / 100;
    }

    // Extrai o nome do material limpando preços, códigos e termos da linha
    let nomeMaterial = linha;

    // Remove códigos iniciais tipo "01. ", "001 - ", "Item 1: "
    nomeMaterial = nomeMaterial.replace(/^(?:item\s*\d+|[\d]{1,8}[\s.-]+)/i, "");

    // Remove menções de preços da descrição
    nomeMaterial = nomeMaterial.replace(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}/g, " ");
    nomeMaterial = nomeMaterial.replace(/(?:R\$\s*)?\d+[.,]\d{2}/g, " ");
    nomeMaterial = nomeMaterial.replace(/\b(?:unit|unitario|total|cada|unid)\b/gi, " ");

    // Remove menção da quantidade se já detectada
    if (matchQtdUnd) {
      nomeMaterial = nomeMaterial.replace(matchQtdUnd[0], " ");
    }

    // Limpa pontuações sobressalentes
    nomeMaterial = nomeMaterial
      .replace(/[|;:=]/g, " ")
      .replace(/^[\s\-–—:;*•.,]+|[\s\-–—:;*•.,]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (nomeMaterial.length >= 3 && unit > 0 && !stopWords.test(normalizar(nomeMaterial))) {
      itens.push({
        nome: nomeMaterial,
        quantidade: qtd,
        unidade: und,
        precoUnitario: unit,
        precoTotal: total,
        confianca: 0.85,
      });
    }
  }

  return itens;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let textoCompleto = "";
    let nomeArquivo = "arquivo";
    let itensDetectados: ItemExtraido[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const textoManual = (formData.get("texto") as string) || "";

      if (textoManual.trim()) {
        textoCompleto = textoManual;
      }

      if (file) {
        nomeArquivo = file.name;
        const ext = file.name.split(".").pop()?.toLowerCase();
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (ext === "pdf") {
          // 1. Extração Nativa de PDF com Node zlib (Zero dependências externas, 100% garantido no Vercel)
          const textoNativo = extrairTextoPDFNativo(buffer);
          if (textoNativo && textoNativo.trim().length > 30) {
            textoCompleto = textoNativo;
            itensDetectados = extrairItensDeTexto(textoNativo);
          }

          // 2. Se a extração nativa não pegou itens, utiliza pdfjs com worker em memória
          if (itensDetectados.length === 0) {
            try {
              const [pdfjs] = await Promise.all([
                import("pdfjs-dist/legacy/build/pdf.mjs"),
                import("pdfjs-dist/legacy/build/pdf.worker.mjs").catch(() => null),
              ]);

              const loadingTask = pdfjs.getDocument({
                data: new Uint8Array(arrayBuffer),
                useSystemFonts: true,
                disableFontFace: true,
                isEvalSupported: false,
              });
              const pdfDoc = await loadingTask.promise;
              let pdfText = "";

              for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();

                const rowGroups: { y: number; items: { x: number; text: string }[] }[] = [];
                for (const item of textContent.items) {
                  const str = (item as any)?.str || "";
                  if (!str.trim()) continue;
                  const transform = (item as any)?.transform || [];
                  const x = transform[4] !== undefined ? transform[4] : 0;
                  const y = transform[5] !== undefined ? Math.round(transform[5]) : 0;

                  let group = rowGroups.find((g) => Math.abs(g.y - y) <= 3.5);
                  if (!group) {
                    group = { y, items: [] };
                    rowGroups.push(group);
                  }
                  group.items.push({ x, text: str });
                }

                rowGroups.sort((a, b) => b.y - a.y);

                const pageLines = rowGroups
                  .map((g) => {
                    g.items.sort((a, b) => a.x - b.x);
                    return g.items.map((it) => it.text).join(" ").trim();
                  })
                  .filter((l) => l.length > 0);

                if (pageLines.length > 0) {
                  pdfText += pageLines.join("\n") + "\n";
                } else {
                  const fallbackLine = textContent.items.map((item: any) => item.str).join(" ");
                  pdfText += fallbackLine + "\n";
                }
              }

              if (pdfText.trim().length > 0) {
                textoCompleto = pdfText;
                itensDetectados = extrairItensDeTexto(pdfText);
              }
            } catch (pdfErr) {
              console.error("Aviso ao tentar motor secundário PDF:", pdfErr);
            }
          }
        } else if (ext === "docx" || ext === "doc") {
          // Extrai texto de documento Word usando mammoth
          try {
            const mammoth = require("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            textoCompleto = result.value || "";
            itensDetectados = extrairItensDeTexto(textoCompleto);
          } catch (docErr) {
            console.error("Erro ao ler Word:", docErr);
            const fallback = buffer.toString("utf-8").replace(/<[^>]*>/g, " ");
            textoCompleto = fallback;
            itensDetectados = extrairItensDeTexto(fallback);
          }
        } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
          // Extrai dados e tabelas estruturadas de Excel via SheetJS
          try {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            itensDetectados = extrairItensDeExcel(workbook);

            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            textoCompleto = XLSX.utils.sheet_to_csv(firstSheet);
          } catch (xlErr) {
            console.error("Erro ao ler Excel:", xlErr);
          }
        } else {
          // Arquivo de texto puro (.txt)
          textoCompleto = buffer.toString("utf-8");
          itensDetectados = extrairItensDeTexto(textoCompleto);
        }
      }
    } else {
      // JSON body com texto colado do WhatsApp ou envio como texto
      try {
        const rawBody = await req.text();
        try {
          const json = JSON.parse(rawBody);
          textoCompleto = json.texto || "";
        } catch {
          textoCompleto = rawBody;
        }
      } catch (err) {
        console.warn("Falha ao ler corpo da requisição:", err);
      }

      if (textoCompleto) {
        itensDetectados = extrairItensDeTexto(textoCompleto);
      }
    }

    // Se nenhum item foi extraído diretamente de estrutura de tabela, tenta pelo texto total
    if (itensDetectados.length === 0 && textoCompleto.trim().length > 0) {
      itensDetectados = extrairItensDeTexto(textoCompleto);
    }

    const condicoes = extrairCondicoesComerciais(textoCompleto);

    const resposta: DadosExtraidos = {
      fornecedorNome: condicoes.fornecedorNome,
      freteTipo: condicoes.freteTipo,
      freteValor: condicoes.freteValor,
      prazo: condicoes.prazo,
      condicao: condicoes.condicao,
      descontoValor: condicoes.descontoValor,
      itens: itensDetectados,
      textoCompleto: textoCompleto,
    };

    return NextResponse.json({
      sucesso: true,
      nomeArquivo,
      totalItensDetectados: itensDetectados.length,
      dados: resposta,
    });
  } catch (error: any) {
    console.error("Erro na API /api/extrair-cotacao:", error);
    return NextResponse.json(
      {
        sucesso: false,
        erro: error.message || "Erro ao processar o arquivo",
      },
      { status: 500 }
    );
  }
}
