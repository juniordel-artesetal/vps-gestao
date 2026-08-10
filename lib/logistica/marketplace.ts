// Adaptador de MARKETPLACE (Shopee/ML/TikTok) — STUB.
// A etiqueta é gerada pelo próprio marketplace e puxada via a "Integração de Lojas"
// (Shopee API/ISV), que ainda NÃO existe. A interface já está pronta: quando a
// integração entrar, estes métodos passam a puxar etiqueta/rastreio reais.
import { CotacaoOpcao, ResultadoEtiqueta, ResultadoImpressao, ResultadoRastreio } from './tipos'

const MSG = 'Aguardando a Integração de Lojas (Shopee/ML). A etiqueta é emitida pelo próprio marketplace.'

// Marketplace normalmente não usa cotação nossa (o frete é do canal).
export async function cotar(): Promise<CotacaoOpcao[]> {
  return []
}

export async function gerarEtiqueta(provedor: string, referencia: string): Promise<ResultadoEtiqueta> {
  // Aponta pra camada de Integração de Lojas (lib/marketplace) — hoje stub.
  try {
    const mkt = await import('@/lib/marketplace')
    const chave = (provedor || '').toLowerCase()
    const alvo = chave.includes('shopee') ? 'shopee' : chave.includes('tiktok') ? 'tiktok' : chave.includes('mercado') || chave === 'ml' ? 'mercadolivre' : null
    if (alvo) {
      const r = await mkt.gerarEtiqueta(alvo as any, referencia)
      return { ok: r.ok, pendente: r.pendente, etiquetaUrl: r.url ?? null, erro: r.erro ?? MSG }
    }
  } catch {}
  return { ok: false, pendente: true, erro: MSG }
}

export async function imprimir(_provedor: string, _referencia: string): Promise<ResultadoImpressao> {
  return { ok: false, pendente: true, erro: MSG }
}

export async function rastrear(_provedor: string, _referencia: string): Promise<ResultadoRastreio> {
  return { ok: false, pendente: true, erro: MSG }
}

// Canais considerados marketplace (a etiqueta vem do próprio canal).
const CANAIS_MARKETPLACE = ['shopee', 'mercado livre', 'mercadolivre', 'ml', 'tiktok', 'shein', 'amazon']
export function canalEhMarketplace(canal: string | null | undefined): boolean {
  const c = (canal || '').trim().toLowerCase()
  return CANAIS_MARKETPLACE.some(m => c === m || c.includes(m))
}
