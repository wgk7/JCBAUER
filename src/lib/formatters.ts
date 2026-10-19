import { PurchaseRequest, Vendor, VendorContact, PurchaseOrder, Project } from "@/types/procurement";

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatNumber(value: number, decimals = 2): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return "-";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function buildWhatsAppQuoteRequestUrl(
  contact: VendorContact,
  vendor: Vendor,
  sc: PurchaseRequest,
  project?: Project
): string {
  const cleanPhone = contact.whatsapp.replace(/\D/g, "");
  const itemsLines = sc.items
    .map(
      (item, idx) =>
        `${idx + 1}. *${item.descricao}* — Qtd: *${item.quantidade} ${item.unidade}* (${item.codigo_insumo})`
    )
    .join("\n");

  const text = [
    `Olá *${contact.nome_vendedor}* (${vendor.nome_fantasia}), tudo bem?`,
    ``,
    `Aqui é do setor de Suprimentos da *JC BAUER Construtora*.`,
    `Solicitamos cotação prioritária referente à requisição *${sc.numero_sc}*:`,
    `🏗️ *Obra:* ${project ? project.nome : "JC BAUER"}`,
    `📍 *Entrega:* ${project ? project.endereco : "Canteiro de Obra"}`,
    `📅 *Data Limite:* ${formatDateBR(sc.data_limite_entrega)}`,
    ``,
    `*RELAÇÃO DE INSUMOS:*`,
    itemsLines,
    ``,
    `Favor informar: Preço Unitário, Marca, Alíquota IPI/ST, Condição de Pagamento (Boleto) e Tipo de Frete (CIF/FOB).`,
  ].join("\n");

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppPurchaseOrderUrl(
  oc: PurchaseOrder,
  vendor: Vendor,
  contact: VendorContact,
  sc?: PurchaseRequest,
  project?: Project
): string {
  const cleanPhone = contact.whatsapp.replace(/\D/g, "");
  const text = [
    `✅ *ORDEM DE COMPRA EMITIDA — ${oc.numero_oc}*`,
    `Construtora: *JC BAUER ENGENHARIA & INCORPORAÇÕES*`,
    ``,
    `Olá *${contact.nome_vendedor}* (${vendor.nome_fantasia}), sua proposta para a *${sc?.numero_sc || "SC"}* foi *APROVADA*!`,
    ``,
    `📦 *Resumo do Pedido:*`,
    `• Obra: *${project?.nome || "JC BAUER"}*`,
    `• Endereço de Entrega: ${project?.endereco || "-"}`,
    `• Valor Total Fechado: *${formatBRL(oc.valor_total)}*`,
    `• Condição de Faturamento: *${oc.condicao_fechada}*`,
    `• Frete: *${oc.tipo_frete}*`,
    `• Previsão de Entrega no Canteiro: *${formatDateBR(oc.previsao_entrega)}*`,
    ``,
    `Por favor, responda com *"DE ACORDO ${oc.numero_oc}"* para liberarmos o agendamento de descarga no almoxarifado da obra.`,
  ].join("\n");

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
