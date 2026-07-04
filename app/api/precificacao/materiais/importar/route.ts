// app/api/precificacao/materiais/importar/route.ts — Importador de materiais + auto-vínculo — VPS-20260630-NQA8
// Recebe linhas JÁ PARSEADAS do .xlsx (parse é client-side no modal).
// Vínculo cria PrecMaterialItem com qtdUsada=0 (a definir) → NÃO altera custoTotal.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { normNome } from '@/lib/normNome'
import { reconciliarVinculosMateriais } from '@/lib/reconciliarVinculos'

export const dynamic = 'force-dynamic'

const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const limpar = (v: any) => { const s = String(v ?? '').trim(); return s === '' || s === '-' ? '' : s }

// "R$ 11,43 / m²" (com \xa0) → { preco: 11.43, unidade: 'm²' }
function parsePreco(raw: any): { preco: number | null; unidade: string } {
  const s = String(raw ?? '').replace(/ /g, ' ').trim()
  if (!s || s === '-') return { preco: null, unidade: 'unidade' }
  const barra = s.indexOf('/')
  const valPart = (barra >= 0 ? s.slice(0, barra) : s).replace(/r\$/i, '').replace(/\s/g, '').trim()
  const uni = barra >= 0 ? s.slice(barra + 1).trim() : ''
  const norm = valPart.includes(',') ? valPart.replace(/\./g, '').replace(',', '.') : valPart
  const preco = parseFloat(norm)
  return { preco: isNaN(preco) ? null : preco, unidade: uni || 'unidade' }
}

function mapearMaterial(row: Record<string, any>) {
  const { preco, unidade } = parsePreco(row['Valor de repasse'])
  const pecasRaw = limpar(row['Peças que fazem uso'])
  return {
    nome: limpar(row['Nome']),
    descricao: limpar(row['Descrição']) || null,
    precoUnidade: preco,
    unidade,
    fornecedor: limpar(row['Fornecedores']) || null,
    pecas: pecasRaw ? pecasRaw.split(',').map(x => x.trim()).filter(Boolean) : [],
    pecasRaw: pecasRaw || null, // texto cru → persistido em PrecMaterial.pecasImportadas
  }
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

    const workspaceId = session.user.workspaceId
    const body = await req.json()
    const linhas: Record<string, any>[] = Array.isArray(body?.linhas) ? body.linhas : []
    if (linhas.length === 0) return NextResponse.json({ error: 'Nenhuma linha recebida' }, { status: 400 })
    if (linhas.length > 5000) return NextResponse.json({ error: 'Máximo de 5000 materiais por importação' }, { status: 400 })

    // ── Estado atual do workspace ──
    const matExist = await prisma.$queryRaw`
      SELECT "id","nome" FROM "PrecMaterial" WHERE "workspaceId" = ${workspaceId}
    ` as { id: string; nome: string }[]
    const matPorNome = new Map<string, string>(matExist.map(m => [normNome(m.nome), m.id]))

    // Produto → variação padrão (prefere canal 'direta', senão menor qtdKit)
    const prodVars = await prisma.$queryRaw`
      SELECT p."id" AS pid, p."nome" AS pnome, v."id" AS vid, v."canal" AS canal, COALESCE(v."qtdKit",1)::int AS qtdkit
      FROM "PrecProduto" p JOIN "PrecVariacao" v ON v."produtoId" = p."id"
      WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
    ` as { pid: string; pnome: string; vid: string; canal: string | null; qtdkit: number }[]
    const melhorPorProd = new Map<string, { vid: string; score: number; qtdkit: number; pnome: string }>()
    for (const r of prodVars) {
      const score = String(r.canal || '').toLowerCase() === 'direta' ? 0 : 1
      const cur = melhorPorProd.get(r.pid)
      if (!cur || score < cur.score || (score === cur.score && r.qtdkit < cur.qtdkit)) {
        melhorPorProd.set(r.pid, { vid: r.vid, score, qtdkit: r.qtdkit, pnome: r.pnome })
      }
    }
    const varPorProdutoNome = new Map<string, string>()
    for (const v of melhorPorProd.values()) {
      const k = normNome(v.pnome)
      if (!varPorProdutoNome.has(k)) varPorProdutoNome.set(k, v.vid)
    }

    // Pares (variação, material) já existentes → dedup de vínculo
    const itensExist = await prisma.$queryRaw`
      SELECT mi."variacaoId" AS vid, mi."materialId" AS mid
      FROM "PrecMaterialItem" mi
      JOIN "PrecVariacao" v ON v."id" = mi."variacaoId"
      JOIN "PrecProduto" p ON p."id" = v."produtoId"
      WHERE p."workspaceId" = ${workspaceId}
    ` as { vid: string; mid: string }[]
    const paresExist = new Set(itensExist.map(x => `${x.vid}|${x.mid}`))

    // ── Resolve materiais (cria novos; reaproveita existentes por nome) ──
    const novosMateriais: any[] = []
    const atualizarPecas: { id: string; pecas: string }[] = [] // materiais existentes que recebem pecasImportadas
    const erros: any[] = []
    let materiaisPulados = 0
    const materialIdPorNome = new Map<string, { id: string; nome: string; preco: number }>()

    for (let i = 0; i < linhas.length; i++) {
      const m = mapearMaterial(linhas[i])
      if (!m.nome) { erros.push({ linha: i + 2, erro: 'Nome do material vazio' }); continue }
      const k = normNome(m.nome)
      if (materialIdPorNome.has(k)) continue // repetido na própria planilha
      const preco = m.precoUnidade ?? 0
      if (matPorNome.has(k)) {
        materiaisPulados++
        const eid = matPorNome.get(k)!
        materialIdPorNome.set(k, { id: eid, nome: m.nome, preco })
        if (m.pecasRaw) atualizarPecas.push({ id: eid, pecas: m.pecasRaw })
      } else {
        const id = novoId()
        matPorNome.set(k, id)
        materialIdPorNome.set(k, { id, nome: m.nome, preco })
        novosMateriais.push({
          id, nome: m.nome, descricao: m.descricao, unidade: m.unidade,
          preco: m.precoUnidade ?? 0, fornecedor: m.fornecedor, pecasRaw: m.pecasRaw,
        })
        if (m.precoUnidade === null) erros.push({ linha: i + 2, erro: `"${m.nome}": preço inválido — material criado sem preço` })
      }
    }

    // ── Resolve vínculos (qtd 0). Produtos não encontrados vão para revisão ──
    const vinculos: any[] = []
    const naoEncontrados = new Set<string>()
    const seenPar = new Set<string>()
    for (let i = 0; i < linhas.length; i++) {
      const m = mapearMaterial(linhas[i])
      if (!m.nome || m.pecas.length === 0) continue
      const mat = materialIdPorNome.get(normNome(m.nome))
      if (!mat) continue
      for (const peca of m.pecas) {
        const vid = varPorProdutoNome.get(normNome(peca))
        if (!vid) { naoEncontrados.add(peca); continue }
        const par = `${vid}|${mat.id}`
        if (paresExist.has(par) || seenPar.has(par)) continue
        seenPar.add(par)
        vinculos.push({ id: novoId(), variacaoId: vid, materialId: mat.id, nomeMaterial: mat.nome, custoUnit: mat.preco })
      }
    }

    // ── Modo verificar: só resumo para o preview ──
    if (body?.verificar) {
      return NextResponse.json({
        materiaisNovos: novosMateriais.length,
        materiaisPulados,
        vinculosPrevistos: vinculos.length,
        produtosNaoEncontrados: Array.from(naoEncontrados).sort(),
      })
    }

    // ── Commit: materiais em LOTE (com pecasImportadas persistido) ──
    for (const c of chunk(novosMateriais, 200)) {
      const vals = c.map(m => Prisma.sql`(${m.id}, ${workspaceId}, ${m.nome}, ${m.descricao}, ${m.unidade}, ${m.preco}, 1, ${m.preco}, ${m.fornecedor}, ${m.pecasRaw}, true, NOW(), NOW())`)
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "PrecMaterial" ("id","workspaceId","nome","descricao","unidade","precoPacote","qtdPacote","precoUnidade","fornecedor","pecasImportadas","ativo","createdAt","updatedAt")
        VALUES ${Prisma.join(vals)}`)
    }
    // Atualiza pecasImportadas de materiais já existentes citados na planilha
    for (const a of atualizarPecas) {
      await prisma.$executeRaw`UPDATE "PrecMaterial" SET "pecasImportadas" = ${a.pecas} WHERE "id" = ${a.id} AND "workspaceId" = ${workspaceId}`
    }

    // ── Reconciliação idempotente (cria PrecMaterialItem qtd 0; independe de ordem) ──
    const rec = await reconciliarVinculosMateriais(workspaceId)

    return NextResponse.json({
      ok: true,
      materiaisInseridos: novosMateriais.length,
      materiaisPulados,
      vinculosCriados: rec.vinculosCriados,
      produtosNaoEncontrados: rec.produtosNaoEncontrados,
      erros: erros.length,
      detalhes: { erros },
    })
  } catch (err) {
    console.error('[POST materiais/importar]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
