// Captura de telas da conta DEMO para o carrossel "Veja por dentro" do site.
// Loga com a conta demo, força DARK, viewport desktop @2x, percorre as rotas e salva
// PNGs em public/telas/ + um public/telas/manifest.json que o carrossel lê.
//
// Uso:
//   npm i -D playwright   &&   npx playwright install chromium
//   DEMO_LOGIN_PASS='...' BASE_URL='http://localhost:3000' npm run telas
//
// 🔐 A SENHA vem só do env DEMO_LOGIN_PASS (o Júnior seta na máquina dele). NUNCA é
//    hardcoded, commitada nem logada. O e-mail demo pode ficar aqui (não é segredo).
import { chromium, type Page } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const EMAIL = process.env.DEMO_LOGIN_EMAIL || 'natielle.1986@gmail.com'
const SENHA = process.env.DEMO_LOGIN_PASS || ''
const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
const OUT_DIR = path.join(process.cwd(), 'public', 'telas')

if (!SENHA) {
  console.error('\n❌ Defina a senha da conta demo em DEMO_LOGIN_PASS (variável de ambiente).')
  console.error("   Ex.: DEMO_LOGIN_PASS='suasenha' npm run telas\n")
  process.exit(1)
}

// Rotas a capturar: {rota, modulo, titulo}. arquivo é derivado da rota (estável).
type Rota = { rota: string; modulo: string; titulo: string; espera?: string }
const ROTAS: Rota[] = [
  { rota: '/dashboard',                    modulo: 'Visão Geral',   titulo: 'Painel completo' },
  { rota: '/dashboard/pedidos',            modulo: 'Produção',      titulo: 'Pedidos' },
  { rota: '/dashboard/painel',             modulo: 'Produção',      titulo: 'Painel de produção' },
  { rota: '/dashboard/calendario',         modulo: 'Calendário',    titulo: 'Calendário de envios' },
  { rota: '/dashboard/orcamentos',         modulo: 'Orçamentos',    titulo: 'Orçamentos' },
  { rota: '/precificacao',                 modulo: 'Precificação',  titulo: 'Precificação' },
  { rota: '/precificacao/materiais',       modulo: 'Precificação',  titulo: 'Materiais' },
  { rota: '/precificacao/embalagens',      modulo: 'Precificação',  titulo: 'Embalagens' },
  { rota: '/precificacao/produtos',        modulo: 'Precificação',  titulo: 'Produtos' },
  { rota: '/precificacao/combos',          modulo: 'Precificação',  titulo: 'Combos' },
  { rota: '/precificacao/meus-canais',     modulo: 'Precificação',  titulo: 'Canais de venda' },
  { rota: '/precificacao/calcular',        modulo: 'Precificação',  titulo: 'Calculadora' },
  { rota: '/precificacao/custos-fixos',    modulo: 'Precificação',  titulo: 'Custos fixos' },
  { rota: '/financeiro',                   modulo: 'Financeiro',    titulo: 'Visão geral' },
  { rota: '/financeiro/lancamentos',       modulo: 'Financeiro',    titulo: 'Entradas e Saídas' },
  { rota: '/financeiro/fluxo',             modulo: 'Financeiro',    titulo: 'Caixa Diário' },
  { rota: '/financeiro/metas',             modulo: 'Financeiro',    titulo: 'Metas' },
  { rota: '/financeiro/marketplace',       modulo: 'Financeiro',    titulo: 'Marketplace' },
  { rota: '/gestao',                       modulo: 'Análise do Negócio', titulo: 'Análise com IA' },
  { rota: '/compras',                      modulo: 'Compras',       titulo: 'Compras' },
  { rota: '/minha-loja',                   modulo: 'Minha Loja',    titulo: 'Minha Loja' },
  { rota: '/clientes',                     modulo: 'Clientes',      titulo: 'Clientes' },
  { rota: '/tarefas',                      modulo: 'Tarefas',       titulo: 'Tarefas' },
  { rota: '/dashboard/estoque',            modulo: 'Estoque',       titulo: 'Estoque de produtos' },
  { rota: '/precificacao/estoque-materiais', modulo: 'Estoque',     titulo: 'Estoque de materiais' },
  { rota: '/pessoal',                      modulo: 'Meu Pessoal',   titulo: 'Meu Pessoal' },
  { rota: '/pessoal/financeiro/caixinhas', modulo: 'Meu Pessoal',   titulo: 'Caixinhas' },
  { rota: '/pessoal/financeiro/lancamentos', modulo: 'Meu Pessoal', titulo: 'Lançamentos pessoais' },
  { rota: '/pessoal/tarefas',              modulo: 'Meu Pessoal',   titulo: 'Agenda e tarefas' },
  { rota: '/pessoal/notas',                modulo: 'Meu Pessoal',   titulo: 'Notas' },
  { rota: '/config/geral',                 modulo: 'Configurações', titulo: 'Configurações' },
]

const slug = (r: string) => r.replace(/^\//, '').replace(/\//g, '-').replace(/[^\w-]/g, '') || 'home'

// Curadoria de PRIVACIDADE: só telas SEM PII de terceiros entram por padrão. As rotas com
// lista de clientes/pedidos/orçamentos/agenda/dados pessoais ficam de fora (nomes de clientes
// não são mascaráveis com segurança). INCLUDE_PII=1 força capturar todas (uso interno).
const SEGURAS = new Set<string>([
  '/dashboard', '/precificacao', '/precificacao/materiais', '/precificacao/embalagens',
  '/precificacao/produtos', '/precificacao/combos', '/precificacao/meus-canais',
  '/precificacao/calcular', '/precificacao/custos-fixos', '/precificacao/estoque-materiais',
  '/dashboard/estoque', '/financeiro', '/financeiro/metas', '/financeiro/fluxo',
  '/gestao', '/pessoal/financeiro/caixinhas',
])
const incluirPII = process.env.INCLUDE_PII === '1'

// Mascara PII antes do print: CPF/telefone/e-mail (regex) + borra colunas de nome/cliente
// (por cabeçalho da tabela) e elementos com atributo/classe de cliente. Roda no contexto da página.
async function redigirPII(page: Page) {
  await page.evaluate(() => {
    // Remove popups/modais em overlay (Novidades, Enquete, Promo…) que cobrem a tela.
    document.querySelectorAll<HTMLElement>('body *').forEach(el => {
      const s = getComputedStyle(el)
      if (s.position !== 'fixed') return
      const r = el.getBoundingClientRect()
      const z = Number(s.zIndex) || 0
      if (r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.8 && z >= 40) el.remove()
    })
    const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
    const TEL = /\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g
    const MAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    for (const n of nodes) {
      const t = n.nodeValue
      if (!t) continue
      const novo = t.replace(CPF, '•••.•••.•••-••').replace(TEL, '(••) •••••-••••').replace(MAIL, '•••@•••')
      if (novo !== t) n.nodeValue = novo
    }
    const PII_COL = /cliente|destinat|nome|telefone|whats|cpf|e-?mail/i
    document.querySelectorAll('table').forEach(tbl => {
      const ths = Array.from(tbl.querySelectorAll('thead th, thead td'))
      ths.forEach((th, idx) => {
        if (PII_COL.test(th.textContent || '')) {
          tbl.querySelectorAll('tbody tr').forEach(tr => {
            const c = tr.children[idx] as HTMLElement | undefined
            if (c) { c.style.filter = 'blur(5px)'; c.style.userSelect = 'none' }
          })
        }
      })
    })
    document.querySelectorAll<HTMLElement>('[data-cliente],[class*="cliente-nome"],[class*="destinatario"]').forEach(el => { el.style.filter = 'blur(5px)' })
  })
}

async function fazerLogin(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(EMAIL)
  await page.locator('input[type="password"]').first().fill(SENHA) // valor nunca é logado
  await Promise.all([
    page.waitForURL(u => !/\/login/.test(u.toString()), { timeout: 30_000 }).catch(() => {}),
    page.locator('button[type="submit"]').first().click(),
  ])
  await page.waitForTimeout(2500)
  if (/\/login/.test(page.url())) throw new Error('Login falhou (verifique DEMO_LOGIN_PASS e se a conta está ativa).')
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1512, height: 900 },
    deviceScaleFactor: 2,
  })
  // Força DARK: cookie lido server-side + classe no <html> antes de cada navegação.
  await context.addCookies([{ name: 'dark-mode', value: 'true', url: BASE }])
  await context.addInitScript(() => { try { document.documentElement.classList.add('dark') } catch {} })

  const page = await context.newPage()
  console.log(`▶ Login como ${EMAIL} em ${BASE} …`)
  await fazerLogin(page)
  console.log('✓ Logado. Capturando telas (dark, 1512×900 @2x)…\n')

  const manifest: { arquivo: string; modulo: string; titulo: string; rota: string }[] = []
  const falhas: string[] = []

  for (const r of ROTAS) {
    if (!incluirPII && !SEGURAS.has(r.rota)) { console.log(`  ⏭ pulou (PII/curadoria) ${r.rota}`); continue }
    const arquivo = `${slug(r.rota)}.png`
    try {
      const resp = await page.goto(`${BASE}${r.rota}`, { waitUntil: 'networkidle', timeout: 30_000 })
      if (resp && resp.status() >= 400) throw new Error(`HTTP ${resp.status()}`)
      if (/\/login/.test(page.url())) throw new Error('redirecionou pro login (sem permissão?)')
      await page.waitForTimeout(1800) // deixa os dados carregarem
      if (r.espera) await page.locator(r.espera).first().waitFor({ timeout: 5000 }).catch(() => {})
      await redigirPII(page) // 🔒 mascara CPF/telefone/e-mail + borra nomes/clientes antes do print
      await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: false })
      manifest.push({ arquivo: `/telas/${arquivo}`, modulo: r.modulo, titulo: r.titulo, rota: r.rota })
      console.log(`  ✓ ${r.modulo} · ${r.titulo}  →  telas/${arquivo}`)
    } catch (e) {
      falhas.push(`${r.rota} (${(e as Error).message})`)
      console.log(`  ⚠ pulou ${r.rota}: ${(e as Error).message}`)
    }
  }

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await browser.close()
  console.log(`\n✅ ${manifest.length} telas salvas em public/telas/ + manifest.json`)
  if (falhas.length) console.log(`⚠ ${falhas.length} rota(s) puladas:\n   ${falhas.join('\n   ')}`)
  console.log('\n👉 Revise os prints (sem PII real) antes de publicar. O carrossel do site lê o manifest.json.')
}

main().catch(err => { console.error('\n❌ Erro:', err?.message || err); process.exit(1) })
