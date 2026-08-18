// Gera lib/seed/catalogoSegmentos.ts a partir dos arquivos lib/seed/segmentos/*.json.
// Cada arquivo = 1 segmento (id = value canônico de Workspace.segmento; idSeed guarda o id original do seed).
// Uso: node scripts/gerarCatalogoSegmentos.mjs
// Acumulável: salve cada lote como arquivos .json na pasta e rode de novo. Trunca 1 segmento? só refaz esse.
// Valida estrutura + conta segmentos/materiais/produtos. NÃO transcreve à mão — serializa com fidelidade.
import fs from 'node:fs'
import path from 'node:path'

const PASTA = path.resolve('lib/seed/segmentos')
if (!fs.existsSync(PASTA)) { console.error('❌ Pasta não existe:', PASTA); process.exit(1) }

const arquivos = fs.readdirSync(PASTA).filter(f => f.endsWith('.json')).sort()
if (arquivos.length === 0) { console.error('❌ Nenhum .json em', PASTA); process.exit(1) }

const problemas = []
let totMat = 0, totProd = 0
const vistos = new Set()
const catalogo = []

for (const f of arquivos) {
  const p = path.join(PASTA, f)
  let s
  try { s = JSON.parse(fs.readFileSync(p, 'utf8')) }
  catch (e) { problemas.push(`❌ JSON inválido: ${f} — ${e.message}`); continue }

  if (!s.id || !s.nome) { problemas.push(`❌ ${f}: falta id/nome`); continue }
  if (vistos.has(s.id)) { problemas.push(`❌ id duplicado "${s.id}" (${f}) — ignorado`); continue }
  vistos.add(s.id)

  const materiais = (s.materiais || []).map(m => ({ nome: String(m.nome), unidade: String(m.unidade || 'un') }))
  const produtos = (s.produtos || []).map(pr => ({
    nome: String(pr.nome), categoria: String(pr.categoria || 'Geral'),
    materiais: (pr.materiais || []).map(it => ({ nome: String(it.nome), qtd: Number(it.qtd) || 0 })),
  }))
  totMat += materiais.length; totProd += produtos.length

  // Sanidade: todo material citado em produto deve existir na lista de materiais do segmento (aviso, não erro).
  const nomesMat = new Set(materiais.map(m => m.nome.toLowerCase()))
  for (const pr of produtos) for (const it of pr.materiais)
    if (!nomesMat.has(it.nome.toLowerCase())) problemas.push(`  ⚠ ${s.id} / "${pr.nome}": material "${it.nome}" fora da lista do segmento (será criado mesmo assim)`)

  catalogo.push({
    id: String(s.id),
    idSeed: s.idSeed ? String(s.idSeed) : String(s.id),
    nome: String(s.nome),
    icone: String(s.icone || '📦'),
    setores: (s.setores || []).map(String),
    materiais, produtos,
  })
}

const cabecalho = `// Catálogo de onboarding por segmento (SEM preços): materiais + produtos com composição
// (vínculo material→produto) já montada. A artesã só preenche os valores dela.
// GERADO por scripts/gerarCatalogoSegmentos.mjs a partir de lib/seed/segmentos/*.json — NÃO editar à mão.
// id = value canônico de Workspace.segmento / /setup / config. idSeed = id original do seed (traço).

export interface MaterialSeed { nome: string; unidade: string }
export interface ItemComposicao { nome: string; qtd: number }
export interface ProdutoSeed { nome: string; categoria: string; materiais: ItemComposicao[] }
export interface SegmentoSeed { id: string; idSeed: string; nome: string; icone: string; setores: string[]; materiais: MaterialSeed[]; produtos: ProdutoSeed[] }

export const CATALOGO_SEGMENTOS: SegmentoSeed[] = ${JSON.stringify(catalogo, null, 2)}

export const SEGMENTO_POR_ID: Record<string, SegmentoSeed> =
  Object.fromEntries(CATALOGO_SEGMENTOS.map(s => [s.id, s]))

export function resumoSegmentos(): { id: string; nome: string; icone: string; produtos: number; materiais: number }[] {
  return CATALOGO_SEGMENTOS.map(s => ({ id: s.id, nome: s.nome, icone: s.icone, produtos: s.produtos.length, materiais: s.materiais.length }))
}
`

const destino = path.resolve('lib/seed/catalogoSegmentos.ts')
fs.writeFileSync(destino, cabecalho)
console.log(`✅ Gerado ${destino}`)
console.log(`   Segmentos: ${catalogo.length} · Materiais: ${totMat} · Produtos: ${totProd}`)
console.log('   IDs:', catalogo.map(s => `${s.id}${s.idSeed !== s.id ? ` (seed:${s.idSeed})` : ''}`).join(', '))
if (problemas.length) { console.log(`\n⚠ Avisos/erros (${problemas.length}):`); console.log(problemas.slice(0, 40).join('\n')) }
