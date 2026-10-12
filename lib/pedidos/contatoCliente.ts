// Contato do cliente no PEDIDO (chamado VPS-20261011-L7VR): o pedido vindo de orçamento não mostrava o
// WhatsApp de quem pediu. Ordem: WhatsApp do ORÇAMENTO que virou o pedido → contato do checkout da Loja
// (camposExtras.contato) → telefone do cadastro do cliente.
//
// O SQL (contatoClienteSql.ts) só traz o do orçamento e o do cadastro: "camposExtras" é TEXT, e `::jsonb` numa linha com JSON
// inválido derrubaria a lista inteira — o da Loja é lido aqui, em JS, com try.
/** Telefone final da linha (orçamento → Loja → cadastro). */
export function telefoneDoPedido(r: { contatoOrcamento?: string | null; contatoCadastro?: string | null; camposExtras?: unknown }): string | null {
  if (r.contatoOrcamento) return r.contatoOrcamento
  let loja: string | null = null
  try {
    const e = typeof r.camposExtras === 'string' ? JSON.parse(r.camposExtras) : r.camposExtras
    const c = e && typeof e === 'object' ? (e as { contato?: unknown }).contato : null
    if (typeof c === 'string' && c.trim()) loja = c.trim()
  } catch { /* camposExtras inválido: ignora */ }
  return loja ?? r.contatoCadastro ?? null
}

/** Link do WhatsApp (wa.me) para um telefone brasileiro, com ou sem o 55. */
export function linkWhatsapp(tel: string): string {
  const d = tel.replace(/\D/g, '')
  return `https://wa.me/${d.length >= 12 && d.startsWith('55') ? d : `55${d}`}`
}
