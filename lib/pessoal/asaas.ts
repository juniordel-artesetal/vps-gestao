// Caller Asaas do módulo PESSOAL. Isola as credenciais de SANDBOX (teste) das de
// PRODUÇÃO (go-live) para nunca tocar no billing live da plataforma:
//
//   • Se ASAAS_SANDBOX_API_KEY estiver no .env → usa SANDBOX (chave $aact_hmlg_).
//     (ASAAS_SANDBOX_WEBHOOK_TOKEN valida o webhook do Pessoal no sandbox.)
//   • Senão → cai na fundação da plataforma (getCredenciais(), produção).
//
// A API key vai SÓ no header `access_token`, nunca em log/erro/retorno. Reusa a
// redação de segredo e as base URLs da fundação existente.
import { getCredenciais } from '@/lib/pagamento/asaas/config'
import { limparSegredo } from '@/lib/pagamento/asaas/client'
import { BASE_SANDBOX, BASE_PRODUCAO } from '@/lib/pagamento/asaas/tipos'

const TIMEOUT_MS = 20_000

export interface CredsPessoal { apiKey: string | null; webhookToken: string | null; sandbox: boolean; base: string }

/** Resolve credencial/ambiente do Pessoal (sandbox isolado tem precedência). */
export async function credsPessoal(): Promise<CredsPessoal> {
  const sbKey = (process.env.ASAAS_SANDBOX_API_KEY || '').trim()
  if (sbKey) {
    return {
      apiKey: sbKey,
      webhookToken: (process.env.ASAAS_SANDBOX_WEBHOOK_TOKEN || '').trim() || null,
      sandbox: true,
      base: BASE_SANDBOX,
    }
  }
  // Go-live: reusa a conta de produção da plataforma (mesma conta Asaas do SOA / ASAAS_API_KEY).
  // Webhook token: um DEDICADO do Pessoal (ASAAS_PESSOAL_WEBHOOK_TOKEN) se definido — assim o
  // webhook do Pessoal tem auth própria; senão reusa o token da plataforma.
  const p = await getCredenciais()
  const tokenPessoal = (process.env.ASAAS_PESSOAL_WEBHOOK_TOKEN || '').trim() || p.webhookToken
  return { apiKey: p.apiKey, webhookToken: tokenPessoal, sandbox: p.sandbox, base: p.sandbox ? BASE_SANDBOX : BASE_PRODUCAO }
}

export interface RespPessoal<T = unknown> { ok: boolean; erro?: string; dados?: T; status?: number }

function mensagemErro(status: number, corpo: unknown): string {
  const errs = (corpo as { errors?: { description?: string; code?: string }[] })?.errors
  if (Array.isArray(errs) && errs.length) return limparSegredo(errs.map(e => e.description || e.code).filter(Boolean).join('; '))
  if (status === 401) return 'API key do Asaas inválida ou de outro ambiente (sandbox × produção).'
  if (status === 429) return 'Limite de requisições do Asaas atingido. Tente em instantes.'
  return `Asaas respondeu ${status}.`
}

/** Chamada crua à API Asaas para o Pessoal. Nunca vaza a key. */
export async function chamarAsaasPessoal<T = unknown>(
  caminho: string,
  opts: { metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'; corpo?: unknown; creds?: CredsPessoal } = {},
): Promise<RespPessoal<T>> {
  const { metodo = 'GET', corpo } = opts
  const cred = opts.creds ?? await credsPessoal()
  if (!cred.apiKey) return { ok: false, erro: 'Asaas do Pessoal sem API key (defina ASAAS_SANDBOX_API_KEY p/ teste).' }

  const url = `${cred.base}${caminho.startsWith('/') ? caminho : `/${caminho}`}`
  let resp: Response
  try {
    resp = await fetch(url, {
      method: metodo,
      headers: { access_token: cred.apiKey, 'Content-Type': 'application/json', 'User-Agent': 'SOA-Pessoal' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    const msg = (e as Error)?.name === 'TimeoutError' ? 'Asaas não respondeu a tempo.' : 'Falha de conexão com o Asaas.'
    console.error('[PESSOAL-ASAAS]', metodo, caminho, msg)
    return { ok: false, erro: msg }
  }

  const texto = await resp.text()
  let dados: unknown = null
  try { dados = texto ? JSON.parse(texto) : null } catch { /* não-JSON */ }
  if (!resp.ok) {
    const erro = mensagemErro(resp.status, dados)
    console.error('[PESSOAL-ASAAS]', metodo, caminho, resp.status, erro)
    return { ok: false, erro, status: resp.status }
  }
  return { ok: true, dados: dados as T, status: resp.status }
}
