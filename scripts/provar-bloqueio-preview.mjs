// ─────────────────────────────────────────────────────────────────────────────
// PROVA ponta a ponta do bloqueio, com SESSÃO REAL no preview.
//
// Faz login de verdade pelo NextAuth (credentials), navega numa área autenticada
// e confere se o redirect para /assinatura acontece — ou não — conforme o estado.
// É a prova que fecha a Etapa 2: o bloqueio só vale se atravessar sessão real.
//
// USO:
//   PREVIEW_URL=https://<preview>.vercel.app \
//   node --env-file=.env --env-file=.env.local scripts/provar-bloqueio-preview.mjs
//
// Requer ASSINATURA_REVALIDACAO=on no ambiente Preview da Vercel.
// ⚠️ Cria e apaga workspaces/usuárias "wsteste_". Aborta se o banco for produção.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const BASE = (process.env.PREVIEW_URL || '').replace(/\/+$/, '')
const BYPASS = (process.env.VERCEL_BYPASS_SECRET || '').trim()
const SENHA = 'Teste@' + Math.random().toString(36).slice(2, 10)

let falhas = 0
const checar = (nome, ok, det = '') => {
  if (!ok) falhas++
  console.log(`  ${ok ? '✅' : '❌'} ${nome}${det ? ` — ${det}` : ''}`)
}

const url = (p) => `${BASE}${p}${BYPASS ? (p.includes('?') ? '&' : '?') + 'x-vercel-protection-bypass=' + BYPASS : ''}`
const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Cookie jar mínimo — o NextAuth encadeia csrf → session e precisa dos dois. */
function jar() {
  const c = new Map()
  return {
    guardar(resp) {
      for (const [k, v] of resp.headers) {
        if (k.toLowerCase() !== 'set-cookie') continue
        for (const parte of v.split(/,(?=[^;]+=)/)) {
          const [nome, valor] = parte.split(';')[0].split('=')
          if (nome && valor !== undefined) c.set(nome.trim(), valor.trim())
        }
      }
    },
    header() { return [...c].map(([k, v]) => `${k}=${v}`).join('; ') },
    tem(sub) { return [...c.keys()].some(k => k.includes(sub)) },
  }
}

/** Login real pelo NextAuth. Devolve o jar com a sessão, ou null. */
async function logar(email, senha) {
  const j = jar()
  const r1 = await fetch(url('/api/auth/csrf'), { headers: { cookie: j.header() } })
  j.guardar(r1)
  const { csrfToken } = await r1.json()
  if (!csrfToken) return null

  const corpo = new URLSearchParams({ email, senha, csrfToken, callbackUrl: `${BASE}/dashboard`, json: 'true' })
  const r2 = await fetch(url('/api/auth/callback/credentials'), {
    method: 'POST',
    headers: { cookie: j.header(), 'content-type': 'application/x-www-form-urlencoded' },
    body: corpo.toString(),
    redirect: 'manual',
  })
  j.guardar(r2)
  return j.tem('session-token') ? j : null
}

/** Navega numa área autenticada e diz para onde foi. */
async function navegar(j, rota) {
  const r = await fetch(url(rota), { headers: { cookie: j.header() }, redirect: 'manual' })
  const destino = r.headers.get('location') || ''
  return { status: r.status, destino, redirecionou: r.status >= 300 && r.status < 400 }
}

const CASOS = [
  { chave: 'asaas_cortada', origem: 'asaas', status: 'CORTADA', liberacao: false, bloqueiaEsperado: true,
    nome: 'ASAAS cortada → deve ser bloqueada' },
  { chave: 'asaas_ativa', origem: 'asaas', status: 'ATIVA', liberacao: false, bloqueiaEsperado: false,
    nome: 'ASAAS ativa → acesso normal' },
  { chave: 'hotmart_cortada', origem: 'hotmart', status: 'CORTADA', liberacao: false, bloqueiaEsperado: false,
    nome: 'HOTMART com status CORTADA → NÃO bloqueada (caminho intocado)' },
  { chave: 'asaas_liberada', origem: 'asaas', status: 'CORTADA', liberacao: true, bloqueiaEsperado: false,
    nome: 'ASAAS cortada + liberacaoManual → trava do Master vence' },
]

async function main() {
  console.log('\n=== PROVA DO BLOQUEIO — sessão real no preview ===\n')
  if (!BASE) { console.error('❌ Falta PREVIEW_URL\n'); process.exitCode = 1; return }

  const host = (() => { try { return new URL(process.env.DATABASE_URL).host } catch { return '' } })()
  console.log(`Banco:   ${host}`)
  console.log(`Preview: ${BASE}\n`)
  if (host.includes('ep-lively-firefly')) { console.error('❌ PRODUÇÃO — abortando\n'); process.exitCode = 1; return }

  const marca = Date.now().toString(36)
  const hash = await bcrypt.hash(SENHA, 10)
  const criados = []

  try {
    for (const c of CASOS) {
      const ws = `wsteste_${c.chave}_${marca}`
      const email = `${c.chave}.${marca}@teste-soa.local`
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Workspace" ("id","nome","slug","plano","ativo","assinaturaStatus","assinaturaOrigem","liberacaoManual")
         VALUES ($1,$2,$3,'TRIAL',true,$4,$5,$6)`,
        ws, 'Teste ' + c.chave, ws, c.status, c.origem, c.liberacao)
      await prisma.$executeRawUnsafe(
        `INSERT INTO "User" ("id","workspaceId","nome","email","senha","role","ativo")
         VALUES ($1,$2,'Teste',$3,$4,'ADMIN',true)`,
        gerarId(), ws, email, hash)
      criados.push({ ...c, ws, email })
    }
    console.log(`${criados.length} workspaces de teste criadas\n`)

    for (const c of criados) {
      const j = await logar(c.email, SENHA)
      if (!j) { checar(c.nome, false, 'login falhou'); continue }

      const r = await navegar(j, '/dashboard')
      const foiParaAssinatura = r.destino.includes('/assinatura')
      const ok = c.bloqueiaEsperado ? foiParaAssinatura : !foiParaAssinatura
      checar(c.nome, ok, `status=${r.status} destino=${r.destino || '(nenhum, renderizou)'}`)

      // Quem está bloqueada precisa CONSEGUIR abrir a tela de regularização.
      if (c.bloqueiaEsperado) {
        const t = await navegar(j, '/assinatura')
        checar('  ↳ /assinatura é alcançável (sem laço de redirect)',
          !(t.redirecionou && t.destino.includes('/assinatura')), `status=${t.status} destino=${t.destino || '(renderizou)'}`)
        const api = await fetch(url('/api/assinatura'), { headers: { cookie: j.header() } })
        const d = await api.json().catch(() => ({}))
        checar('  ↳ /api/assinatura responde com o estado',
          api.status === 200 && d?.estado?.temAcesso === false, `temAcesso=${d?.estado?.temAcesso} motivo=${d?.estado?.motivo}`)
      }
    }
  } finally {
    console.log('\n[limpeza]')
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "workspaceId" LIKE 'wsteste_%'`)
    await prisma.$executeRawUnsafe(`DELETE FROM "Workspace" WHERE "id" LIKE 'wsteste_%'`)
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM "Workspace" WHERE "id" LIKE 'wsteste_%'`)
    console.log(`  🧹 removidas (restantes: ${n})`)
  }

  console.log(`\n${falhas === 0 ? '✅ TODAS as provas passaram' : `❌ ${falhas} falha(s)`}\n`)
  process.exitCode = falhas === 0 ? 0 : 1
}

main()
  .catch(e => { console.error('\n❌ Erro:', e.message, '\n'); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
