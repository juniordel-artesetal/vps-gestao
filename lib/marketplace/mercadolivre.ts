// Adapter Mercado Livre — STUB. ML tem API pública (será o 1º real amanhã).
const MSG = 'Aguardando integração do Mercado Livre'
export async function conectar() { console.log('[ml] conectar (stub)'); return { ok: false, pendente: true, erro: MSG } }
export async function importarPedidos() { console.log('[ml] importarPedidos (stub)'); return { ok: false, pendente: true, pedidos: [] } }
export async function syncEstoque() { console.log('[ml] syncEstoque (stub)'); return { ok: false, pendente: true } }
export async function gerarEtiqueta() { console.log('[ml] gerarEtiqueta (stub)'); return { ok: false, pendente: true, url: null, erro: MSG } }
