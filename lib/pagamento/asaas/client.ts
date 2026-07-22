// Cliente HTTP do Asaas. ÚNICO lugar do sistema que toca a API key.
//
// Regras não negociáveis:
//   - A key vai no header `access_token` e NUNCA em log, erro, URL ou retorno.
//   - Erro do Asaas ({errors:[{code,description}]}) vira mensagem limpa em PT.
//   - Timeout curto: webhook/rota nunca fica pendurada esperando o provedor.
//   - Sandbox e produção são resolvidos pela config, jamais hardcoded na chamada.
import { getCredenciais } from './config'
import { BASE_SANDBOX, BASE_PRODUCAO } from './tipos'
import type { ResultadoAsaas } from './tipos'

const TIMEOUT_MS = 20_000
const UA = 'SOA-VPS-Gestao'

/** Sanitiza qualquer texto que vá para log/banco: remove o que parecer uma API key
 *  do Asaas ($aact_...) caso o provedor ecoe a credencial numa mensagem de erro. */
export function limparSegredo(texto: string): string {
  return String(texto).replace(/\$aact_[A-Za-z0-9+/=_-]+/g, '[REDACTED]')
}

function baseUrl(sandbox: boolean): string {
  return sandbox ? BASE_SANDBOX : BASE_PRODUCAO
}

/** Traduz o corpo de erro do Asaas numa frase única. */
function mensagemDeErro(status: number, corpo: unknown): string {
  const errs = (corpo as { errors?: { description?: string; code?: string }[] })?.errors
  if (Array.isArray(errs) && errs.length) {
    return limparSegredo(errs.map(e => e.description || e.code).filter(Boolean).join('; '))
  }
  if (status === 401) return 'API key do Asaas inválida ou de outro ambiente (sandbox × produção).'
  if (status === 429) return 'Limite de requisições do Asaas atingido. Tente em instantes.'
  return `Asaas respondeu ${status}.`
}

/**
 * Chamada crua à API. Resolve credencial/ambiente sozinha.
 *
 * `exigirAtivo=false` permite o TESTE DE CONEXÃO rodar com o módulo ainda
 * desligado (feature flag default OFF) — é justamente como se liga com segurança.
 */
export async function chamarAsaas<T = unknown>(
  caminho: string,
  opts: {
    metodo?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    corpo?: unknown
    exigirAtivo?: boolean
  } = {},
): Promise<ResultadoAsaas<T>> {
  const { metodo = 'GET', corpo, exigirAtivo = true } = opts
  const cred = await getCredenciais()

  if (!cred.apiKey) {
    return { ok: false, pendente: true, erro: 'Asaas sem API key configurada (Master → Asaas).' }
  }
  if (exigirAtivo && !cred.ativo) {
    return { ok: false, pendente: true, erro: 'Módulo Asaas desligado.' }
  }

  const url = `${baseUrl(cred.sandbox)}${caminho.startsWith('/') ? caminho : `/${caminho}`}`

  let resp: Response
  try {
    resp = await fetch(url, {
      method: metodo,
      headers: {
        access_token: cred.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': UA,
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    // Falha de rede/timeout — nunca inclui a key (ela só existia no header).
    const msg = (e as Error)?.name === 'TimeoutError'
      ? 'Asaas não respondeu a tempo.'
      : 'Falha de conexão com o Asaas.'
    console.error('[ASAAS]', metodo, caminho, msg)
    return { ok: false, pendente: true, erro: msg }
  }

  const texto = await resp.text()
  let dados: unknown = null
  try { dados = texto ? JSON.parse(texto) : null } catch { /* resposta não-JSON */ }

  if (!resp.ok) {
    const erro = mensagemDeErro(resp.status, dados)
    console.error('[ASAAS]', metodo, caminho, resp.status, erro)
    return { ok: false, pendente: false, erro }
  }

  return { ok: true, pendente: false, dados: dados as T }
}
