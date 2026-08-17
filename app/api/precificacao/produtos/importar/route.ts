// app/api/precificacao/produtos/importar/route.ts — Importador de produtos + reconciliação de vínculos — VPS-20260630-NQA8
// Cria PrecProduto + PrecVariacao (canal 'direta', custos 0) e roda a reconciliação
// idempotente material↔produto (via PrecMaterial.pecasImportadas). Parse xlsx é client-side.
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { normNome } from '@/lib/normNome'
import { reconciliarVinculosMateriais } from '@/lib/reconciliarVinculos'
import { parsePrecoImport } from '@/lib/mapeamentoImport'

export const dynamic = 'force-dynamic'

const novoId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const limpar = (v: any) => { const s = String(v ?? '').trim(); return s === '' || s === '-' ? '' : s }
function chunk<T>(arr: T[], n: number): T[][] {
  const o: T[][] = []
  for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n))
  return o
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
    if (linhas.length > 5000) return NextResponse.json({ error: 'Máximo de 5000 produtos por importação' }, { status: 400 })

    const existProd = await prisma.$queryRaw`
      SELECT "id","nome" FROM "PrecProduto" WHERE "workspaceId" = ${workspaceId}
    ` as { id: string; nome: string }[]
    const prodPorNome = new Set(existProd.map(p => normNome(p.nome)))

    const novos: { id: string; nome: string; descricao: string | null; preco: number }[] = []
    const erros: any[] = []
    const semPreco: { linha: number; nome: string; valor: string }[] = []
    let produtosPulados = 0
    const seen = new Set<string>()

    for (let i = 0; i < linhas.length; i++) {
      const nome = limpar(linhas[i]['Nome'])
      if (!nome) { erros.push({ linha: i + 2, erro: 'Nome do produto vazio' }); continue }
      const k = normNome(nome)
      if (seen.has(k)) continue // repetido na própria planilha
      seen.add(k)
      if (prodPorNome.has(k)) { produtosPulados++; continue }
      const preco = parsePrecoImport(linhas[i]['Preço'])
      // Sem preço NÃO descarta o produto (ele entra com 0), mas é REPORTADO — nada em silêncio.
      if (preco <= 0) semPreco.push({ linha: i + 2, nome, valor: String(linhas[i]['Preço'] ?? '').trim() })
      novos.push({ id: novoId(), nome, descricao: limpar(linhas[i]['Descrição']) || null, preco })
    }

    if (body?.verificar) {
      return NextResponse.json({
        produtosNovos: novos.length, produtosPulados, semNome: erros.length,
        semPreco: semPreco.length, semPrecoLista: semPreco.slice(0, 50),
      })
    }

    // ── Commit: PrecProduto + PrecVariacao (canal direta) em LOTE ──
    for (const c of chunk(novos, 200)) {
      const vals = c.map(p => Prisma.sql`(${p.id}, ${workspaceId}, ${p.nome}, ${p.descricao}, true, NOW(), NOW())`)
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "PrecProduto" ("id","workspaceId","nome","descricao","ativo","createdAt","updatedAt")
        VALUES ${Prisma.join(vals)}`)
    }
    const varRows = novos.map(p => ({ vid: novoId(), pid: p.id, preco: p.preco }))
    for (const c of chunk(varRows, 200)) {
      // custos ficam no default 0 (custoTotal=0). Só preço na variação padrão.
      const vals = c.map(v => Prisma.sql`(${v.vid}, ${v.pid}, 'UNITARIO', 'direta', 'classico', 1, ${v.preco}, NOW(), NOW())`)
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "PrecVariacao" ("id","produtoId","tipo","canal","subOpcao","qtdKit","precoVenda","createdAt","updatedAt")
        VALUES ${Prisma.join(vals)}`)
    }

    // ── Reconciliação idempotente (agora que os produtos existem) ──
    const rec = await reconciliarVinculosMateriais(workspaceId)

    return NextResponse.json({
      ok: true,
      produtosInseridos: novos.length,
      produtosPulados,
      semNome: erros.length,
      semPreco: semPreco.length,
      vinculosCriados: rec.vinculosCriados,
      produtosNaoEncontrados: rec.produtosNaoEncontrados,
      detalhes: { erros, semPreco: semPreco.slice(0, 100) },
    })
  } catch (err) {
    console.error('[POST produtos/importar]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
