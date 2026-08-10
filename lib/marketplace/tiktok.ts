// Adapter TikTok Shop — STUB. Depende da aprovação do ISV.
const MSG = 'Aguardando integração do TikTok Shop (ISV)'
export async function conectar() { console.log('[tiktok] conectar (stub)'); return { ok: false, pendente: true, erro: MSG } }
export async function importarPedidos() { console.log('[tiktok] importarPedidos (stub)'); return { ok: false, pendente: true, pedidos: [] } }
export async function syncEstoque() { console.log('[tiktok] syncEstoque (stub)'); return { ok: false, pendente: true } }
export async function gerarEtiqueta() { console.log('[tiktok] gerarEtiqueta (stub)'); return { ok: false, pendente: true, url: null, erro: MSG } }
