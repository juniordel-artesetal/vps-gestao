// Camada de logística — ponto único de entrada. Resolve a FONTE (transportadora
// via Melhor Envio; marketplace via stub) e despacha cotação/etiqueta/impressão/rastreio.
// Novos provedores de transportadora (SuperFrete) entram sem refatorar as telas.
import * as melhorenvio from './melhorenvio'
import * as marketplace from './marketplace'
import { getAccessTokenValido } from './melhorenvio'
import {
  CotacaoOpcao, EnderecoLog, Pacote, FonteEnvio,
  ResultadoEtiqueta, ResultadoImpressao, ResultadoRastreio,
} from './tipos'

export * from './tipos'
export { canalEhMarketplace } from './marketplace'
export { credenciaisConfiguradas, authorizeUrl } from './melhorenvio'

// Fonte da etiqueta a partir do canal do pedido.
export function fonteDoCanal(canal: string | null | undefined): FonteEnvio {
  return marketplace.canalEhMarketplace(canal) ? 'marketplace' : 'transportadora'
}

// COTAÇÃO (só transportadora tem cotação nossa). Precisa de token válido do workspace.
export async function cotar(workspaceId: string, cepOrigem: string, cepDestino: string, pacotes: Pacote[]): Promise<{
  ok: boolean; opcoes: CotacaoOpcao[]; erro?: string
}> {
  const access = await getAccessTokenValido(workspaceId)
  if (!access) return { ok: false, opcoes: [], erro: 'Conta de transportadora não conectada' }
  const opcoes = await melhorenvio.cotar(access, cepOrigem, cepDestino, pacotes)
  return { ok: true, opcoes }
}

// COMPRAR + GERAR etiqueta (transportadora). Marketplace não compra — vem do canal.
export async function comprarEtiqueta(workspaceId: string, p: {
  servicoId: string
  remetente: EnderecoLog
  destinatario: EnderecoLog
  pacote: Pacote
  produtos: { nome: string; quantidade: number; valorUnitario: number }[]
}): Promise<ResultadoEtiqueta> {
  const access = await getAccessTokenValido(workspaceId)
  if (!access) return { ok: false, erro: 'Conta de transportadora não conectada' }
  return melhorenvio.comprarEtiqueta(access, p)
}

// IMPRESSÃO UNIFICADA — resolve pela fonte do envio já criado.
export async function imprimir(workspaceId: string, envio: {
  fonte: FonteEnvio; provedor: string | null; provedorEnvioId: string | null; etiquetaUrl?: string | null
}): Promise<ResultadoImpressao> {
  if (envio.fonte === 'marketplace') {
    return marketplace.imprimir(envio.provedor || 'marketplace', envio.provedorEnvioId || '')
  }
  if (envio.etiquetaUrl) return { ok: true, url: envio.etiquetaUrl }
  const access = await getAccessTokenValido(workspaceId)
  if (!access) return { ok: false, erro: 'Conta de transportadora não conectada' }
  if (!envio.provedorEnvioId) return { ok: false, erro: 'Envio sem identificador do provedor' }
  return melhorenvio.imprimirPorId(access, envio.provedorEnvioId)
}

// RASTREIO — resolve pela fonte.
export async function rastrear(workspaceId: string, envio: {
  fonte: FonteEnvio; provedor: string | null; provedorEnvioId: string | null
}): Promise<ResultadoRastreio> {
  if (envio.fonte === 'marketplace') {
    return marketplace.rastrear(envio.provedor || 'marketplace', envio.provedorEnvioId || '')
  }
  const access = await getAccessTokenValido(workspaceId)
  if (!access) return { ok: false, erro: 'Conta de transportadora não conectada' }
  if (!envio.provedorEnvioId) return { ok: false, erro: 'Envio sem identificador do provedor' }
  return melhorenvio.rastrearPorId(access, envio.provedorEnvioId)
}
