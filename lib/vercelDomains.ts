// Wrapper da Vercel Domains API para o recurso "domínio próprio" da Loja.
// Token/projeto/time SÓ do env (nunca logar). Cada loja = 1 domínio adicionado ao projeto.
//   VERCEL_API_TOKEN   (escopo Domains)
//   VERCEL_PROJECT_ID
//   VERCEL_TEAM_ID     (opcional em contas pessoais)

const API = 'https://api.vercel.com'

function cfg() {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID || ''
  if (!token || !projectId) {
    throw new Error('CONFIG_VERCEL_AUSENTE') // env não configurado — tratado como erro amigável na rota
  }
  return { token, projectId, teamId }
}

function qs(teamId: string) {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''
}

async function chamar(method: string, path: string, body?: any) {
  const { token, teamId } = cfg()
  const sep = path.includes('?') ? '&' : '?'
  const url = `${API}${path}${teamId ? `${sep}teamId=${encodeURIComponent(teamId)}` : ''}`
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

export type RegistroDns = { tipo: string; nome: string; valor: string; descricao: string }

// Sufixos de 2 níveis comuns no Brasil (pra distinguir apex de subdomínio).
const SUFIXOS_2 = new Set([
  'com.br', 'net.br', 'org.br', 'art.br', 'blog.br', 'eco.br', 'loja.br', 'app.br',
  'co.uk', 'com.pt',
])

// Domínio é a raiz registrável (apex) e não um subdomínio? Apex usa registro A; subdomínio usa CNAME.
export function ehApex(dominio: string): boolean {
  const parts = dominio.toLowerCase().split('.')
  const ultimos2 = parts.slice(-2).join('.')
  if (SUFIXOS_2.has(ultimos2)) return parts.length === 3 // ex.: marca.com.br
  return parts.length === 2 // ex.: marca.com
}

// Monta os registros DNS que a artesã deve criar no provedor dela, a partir do domínio
// + eventuais desafios de verificação (TXT) que a Vercel devolve quando o domínio já é
// conhecido por outra conta.
export function registrosDns(dominio: string, verification?: any[]): RegistroDns[] {
  const registros: RegistroDns[] = []
  if (ehApex(dominio)) {
    registros.push({ tipo: 'A', nome: '@', valor: '76.76.21.21', descricao: 'Aponta seu domínio para a hospedagem da loja' })
  } else {
    const sub = dominio.split('.')[0]
    registros.push({ tipo: 'CNAME', nome: sub, valor: 'cname.vercel-dns.com', descricao: `Aponta "${sub}" para a hospedagem da loja` })
  }
  for (const v of verification || []) {
    if (v?.type && v?.value) {
      registros.push({ tipo: String(v.type).toUpperCase(), nome: v.domain || dominio, valor: v.value, descricao: 'Registro de verificação de posse exigido (crie exatamente como está)' })
    }
  }
  return registros
}

// Adiciona o domínio ao projeto. Retorna { verified, verification[] } (ou erro amigável).
export async function vercelAddDomain(dominio: string) {
  const { projectId } = cfg()
  const r = await chamar('POST', `/v10/projects/${projectId}/domains`, { name: dominio })
  if (!r.ok) {
    // Já existe em outro projeto/conta, inválido, ou limite do plano.
    const code = r.data?.error?.code || ''
    if (code === 'domain_already_in_use' || r.status === 409) return { erro: 'DOMINIO_EM_USO', mensagem: 'Este domínio já está em uso em outra conta/projeto.' }
    return { erro: 'FALHA_ADD', mensagem: r.data?.error?.message || 'Não foi possível adicionar o domínio agora.' }
  }
  return { verified: !!r.data?.verified, verification: r.data?.verification || [] }
}

// Consulta o estado do domínio no projeto (verified + verification pendentes).
export async function vercelGetDomain(dominio: string) {
  const { projectId } = cfg()
  const r = await chamar('GET', `/v9/projects/${projectId}/domains/${encodeURIComponent(dominio)}`)
  if (!r.ok) return { erro: 'NAO_ENCONTRADO' }
  return { verified: !!r.data?.verified, verification: r.data?.verification || [] }
}

// Dispara a verificação (a Vercel checa o DNS). Retorna verified true/false.
export async function vercelVerify(dominio: string) {
  const { projectId } = cfg()
  const r = await chamar('POST', `/v9/projects/${projectId}/domains/${encodeURIComponent(dominio)}/verify`)
  if (!r.ok) return { verified: false, verification: r.data?.verification || [] }
  return { verified: !!r.data?.verified, verification: r.data?.verification || [] }
}

// Checa se o DNS já está apontando certo (misconfigured=false quando ok).
export async function vercelConfig(dominio: string) {
  const r = await chamar('GET', `/v6/domains/${encodeURIComponent(dominio)}/config`)
  if (!r.ok) return { misconfigured: true }
  return { misconfigured: !!r.data?.misconfigured }
}

// Remove o domínio do projeto (best-effort; não derruba o fluxo se já não existir).
export async function vercelRemoveDomain(dominio: string) {
  try {
    const { projectId } = cfg()
    await chamar('DELETE', `/v9/projects/${projectId}/domains/${encodeURIComponent(dominio)}`)
  } catch { /* env ausente ou já removido — ignora */ }
}

// Valida o formato do domínio (hostname). Sem protocolo, sem caminho, sem espaços.
export function dominioValido(d: string): boolean {
  const s = String(d || '').toLowerCase().trim()
  if (s.length < 4 || s.length > 253) return false
  if (/[\s/:?#@]/.test(s)) return false
  return /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/.test(s)
}
