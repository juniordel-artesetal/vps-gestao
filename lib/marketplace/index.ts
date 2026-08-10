// Camada de Integração de Lojas (marketplaces) — STUB (scaffold).
// Interface única; adapters por marketplace (Mercado Livre real 1º amanhã; Shopee/TikTok
// dependem de ISV). Hoje tudo retorna "aguardando integração". Nenhuma chamada externa.
import * as mercadolivre from './mercadolivre'
import * as shopee from './shopee'
import * as tiktok from './tiktok'

export type Marketplace = 'mercadolivre' | 'shopee' | 'tiktok'

export const MARKETPLACES: { key: Marketplace; nome: string; status: string }[] = [
  { key: 'mercadolivre', nome: 'Mercado Livre', status: 'API pública (1º a integrar)' },
  { key: 'shopee', nome: 'Shopee', status: 'Depende do ISV' },
  { key: 'tiktok', nome: 'TikTok Shop', status: 'Depende do ISV' },
]

export interface AdapterMarketplace {
  conectar(config: any): Promise<{ ok: boolean; pendente: boolean; erro?: string }>
  importarPedidos(config: any): Promise<{ ok: boolean; pendente: boolean; pedidos: any[] }>
  syncEstoque(config: any, direcao: 'puxar' | 'duplo'): Promise<{ ok: boolean; pendente: boolean }>
  gerarEtiqueta(referencia: string): Promise<{ ok: boolean; pendente: boolean; url?: string | null; erro?: string }>
}

function adapter(mkt: Marketplace): AdapterMarketplace {
  switch (mkt) {
    case 'mercadolivre': return mercadolivre
    case 'shopee': return shopee
    case 'tiktok': return tiktok
    default: return mercadolivre
  }
}

export async function conectar(mkt: Marketplace, config: any) { return adapter(mkt).conectar(config) }
export async function importarPedidos(mkt: Marketplace, config: any) { return adapter(mkt).importarPedidos(config) }
export async function syncEstoque(mkt: Marketplace, config: any, direcao: 'puxar' | 'duplo') { return adapter(mkt).syncEstoque(config, direcao) }
// Usado pela camada de logística (etiqueta de marketplace aponta pra cá).
export async function gerarEtiqueta(mkt: Marketplace, referencia: string) { return adapter(mkt).gerarEtiqueta(referencia) }
