// scripts/gerar-mapa.cjs
// Regenera MAPA_PROJETO.md — índice auto-gerado de rotas de API, páginas,
// componentes, libs e tabelas do banco. Uso: node scripts/gerar-mapa.cjs
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const ROOT = path.resolve(__dirname, '..')
const prisma = new PrismaClient()

function walk(dir, filter, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(full, filter, out) }
    else if (filter(full)) out.push(full)
  }
  return out
}
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/')

// ── Rotas de API ──────────────────────────────────────────────
const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
function rotasApi() {
  const files = walk(path.join(ROOT, 'app', 'api'), f => f.endsWith(path.sep + 'route.ts') || f.endsWith('/route.ts'))
  return files.map(f => {
    const rota = '/' + rel(f).replace(/^app\//, '').replace(/\/route\.ts$/, '')
    const txt = fs.readFileSync(f, 'utf8')
    const m = METODOS.filter(x =>
      new RegExp(`export\\s+async\\s+function\\s+${x}\\b`).test(txt) ||
      new RegExp(`export\\s+(const|function)\\s+${x}\\b`).test(txt))
    return { rota, metodos: m.length ? m.join(', ') : '—' }
  }).sort((a, b) => a.rota.localeCompare(b.rota))
}

// ── Páginas ───────────────────────────────────────────────────
function paginas() {
  const files = walk(path.join(ROOT, 'app'), f => f.endsWith(path.sep + 'page.tsx') || f.endsWith('/page.tsx'))
  return files.map(f => {
    let r = '/' + rel(f).replace(/^app\//, '').replace(/\/page\.tsx$/, '').replace(/^app$/, '')
    r = r.replace(/\/page\.tsx$/, '')
    if (r === '/' + rel(f).replace(/^app\//, '')) r = '/'
    r = ('/' + rel(f).replace(/^app\//, '').replace(/page\.tsx$/, '')).replace(/\/$/, '')
    if (r === '') r = '/'
    return r
  }).sort((a, b) => a.localeCompare(b))
}

// ── Componentes (nível raiz de components/) ───────────────────
function componentes() {
  const dir = path.join(ROOT, 'components')
  return fs.readdirSync(dir).filter(n => n.endsWith('.tsx')).sort((a, b) => a.localeCompare(b))
}

// ── Libs ──────────────────────────────────────────────────────
function primeiraDescricao(f) {
  const linhas = fs.readFileSync(f, 'utf8').split(/\r?\n/)
  for (const l of linhas) {
    const t = l.trim()
    if (t === '') continue
    const m = t.match(/^\/\/\s?(.*)$/)
    if (m && m[1].trim()) return m[1].trim()
    return null // primeira linha não-vazia não é comentário
  }
  return null
}
function libs() {
  const files = walk(path.join(ROOT, 'lib'), f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
  return files.map(f => {
    const nome = rel(f).replace(/^lib\//, '')
    return { nome, desc: primeiraDescricao(f) }
  }).sort((a, b) => a.nome.localeCompare(b.nome))
}

// ── Tabelas do banco ──────────────────────────────────────────
function modelosPrisma() {
  try {
    const txt = fs.readFileSync(path.join(ROOT, 'prisma', 'schema.prisma'), 'utf8')
    const set = new Set()
    const re = /^\s*model\s+(\w+)\s*\{/gm
    let m; while ((m = re.exec(txt))) set.add(m[1])
    // Também respeita @@map("nome_real")
    const reMap = /@@map\("([^"]+)"\)/g
    while ((m = reMap.exec(txt))) set.add(m[1])
    return set
  } catch { return new Set() }
}
async function tabelas() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT t.table_name AS nome, COUNT(c.column_name)::int AS colunas
    FROM information_schema.tables t
    JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT LIKE '\\_prisma%'
    GROUP BY t.table_name
    ORDER BY t.table_name
  `)
  const mirror = modelosPrisma()
  return rows.map(r => ({ nome: r.nome, colunas: Number(r.colunas), mirror: mirror.has(r.nome) }))
}

;(async () => {
  const api = rotasApi()
  const pgs = paginas()
  const comps = componentes()
  const lbs = libs()
  const tbs = await tabelas()

  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dataGer = `${dd}/${mm}/${now.getFullYear()}`

  const L = []
  L.push('# MAPA DO PROJETO — VPS Gestão', '')
  L.push('> Índice AUTO-GERADO de rotas de API, páginas, componentes, libs e tabelas.')
  L.push(`> Gerado em ${dataGer}. Regenerar após adicionar rotas/páginas/tabelas.`, '')
  L.push(`**Totais:** ${api.length} rotas de API · ${pgs.length} páginas · ${comps.length} componentes · ${lbs.length} libs · ${tbs.length} tabelas`, '')

  L.push('## Rotas de API', '', '| Rota | Métodos |', '| --- | --- |')
  for (const r of api) L.push(`| \`${r.rota}\` | ${r.metodos} |`)
  L.push('')

  L.push('## Páginas', '')
  for (const p of pgs) L.push(`- \`${p}\``)
  L.push('')

  L.push('## Componentes', '')
  for (const c of comps) L.push(`- \`${c}\``)
  L.push('')

  L.push('## Libs', '')
  for (const l of lbs) L.push(`- \`${l.nome}\`${l.desc ? ` — ${l.desc}` : ''}`)
  L.push('')

  L.push('## Tabelas do banco (Postgres/Neon)', '')
  L.push('> `mirror` = presente em `prisma/schema.prisma`. Sem mirror = usada só via SQL raw.', '')
  L.push('| Tabela | Colunas | No schema.prisma? |', '| --- | --- | --- |')
  for (const t of tbs) L.push(`| \`${t.nome}\` | ${t.colunas} | ${t.mirror ? 'mirror' : '— (raw SQL)'} |`)
  L.push('')

  fs.writeFileSync(path.join(ROOT, 'MAPA_PROJETO.md'), L.join('\n'), 'utf8')
  console.log(`MAPA_PROJETO.md gerado: ${api.length} rotas, ${pgs.length} páginas, ${comps.length} componentes, ${lbs.length} libs, ${tbs.length} tabelas`)
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
