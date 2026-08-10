// Adapter Shopee — STUB. Depende da aprovação do ISV (Open Platform).
const MSG = 'Aguardando integração da Shopee (ISV)'
export async function conectar() { console.log('[shopee] conectar (stub)'); return { ok: false, pendente: true, erro: MSG } }
export async function importarPedidos() { console.log('[shopee] importarPedidos (stub)'); return { ok: false, pendente: true, pedidos: [] } }
export async function syncEstoque() { console.log('[shopee] syncEstoque (stub)'); return { ok: false, pendente: true } }
export async function gerarEtiqueta() { console.log('[shopee] gerarEtiqueta (stub)'); return { ok: false, pendente: true, url: null, erro: MSG } }
