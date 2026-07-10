import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

// POST { produtoId } — assistente heurístico. Lê os NOMES das variações e SUGERE atributos
// (Tamanho por dimensão "10x10cm"; Quantidade por número/"50 unidades"), opções e o
// mapeamento — em RASCUNHO. Não grava nada; a artesã revisa e confirma. Sem IA/preço.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const { produtoId } = await req.json()

    const [prod] = await prisma.$queryRaw`SELECT "id" FROM "PrecProduto" WHERE "id" = ${produtoId} AND "workspaceId" = ${workspaceId} LIMIT 1` as any[]
    if (!prod) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })

    const variacoes = await prisma.$queryRaw`
      SELECT v."id",
             COALESCE(NULLIF(v."nome",''),
                      NULLIF(TRIM(CONCAT_WS(' · ', NULLIF(v."tipo",'Padrão'), NULLIF(v."subOpcao",'Padrão'))), ''),
                      'Padrão') AS "label"
      FROM "PrecVariacao" v WHERE v."produtoId" = ${produtoId} ORDER BY v."tipo" ASC
    ` as any[]

    // Ordem preservada de aparição, para as opções saírem numa ordem natural
    const tamanhos: string[] = []
    const quantidades: string[] = []
    const mapeamento: Record<string, { Tamanho?: string; Quantidade?: string }> = {}
    const naoReconhecidas: string[] = []

    for (const v of variacoes) {
      const label = String(v.label || '')
      const m: { Tamanho?: string; Quantidade?: string } = {}

      // Dimensão: "10x10cm", "15 X 15 cm", "10x10"
      const dim = label.match(/(\d+)\s*[xX]\s*(\d+)\s*(cm|mm|m)?/)
      if (dim) {
        const val = `${dim[1]}x${dim[2]}${(dim[3] || 'cm').toLowerCase()}`
        m.Tamanho = val
        if (!tamanhos.includes(val)) tamanhos.push(val)
      }

      // Quantidade: "50 unidades", "100 un", "200 folhas", ou número solto que NÃO seja da dimensão
      let qtd: string | null = null
      const qMatch = label.match(/(\d+)\s*(unidades?|un\.?|p[çc]s?|pe[çc]as?|folhas?)/i)
      if (qMatch) qtd = qMatch[1]
      else {
        // número solto (sem ser parte de uma dimensão NxN)
        const semDim = dim ? label.replace(dim[0], ' ') : label
        const num = semDim.match(/\b(\d{1,5})\b/)
        if (num) qtd = num[1]
      }
      if (qtd) {
        m.Quantidade = qtd
        if (!quantidades.includes(qtd)) quantidades.push(qtd)
      }

      if (m.Tamanho || m.Quantidade) mapeamento[v.id] = m
      else naoReconhecidas.push(label)
    }

    // Ordena quantidades numericamente
    quantidades.sort((a, b) => Number(a) - Number(b))

    const atributos: { nome: string; opcoes: string[] }[] = []
    if (tamanhos.length > 0) atributos.push({ nome: 'Tamanho', opcoes: tamanhos })
    if (quantidades.length > 0) atributos.push({ nome: 'Quantidade', opcoes: quantidades })

    return NextResponse.json(serialize({
      atributos,
      mapeamento,        // { variacaoId: { Tamanho?, Quantidade? } } — por NOME (rascunho)
      naoReconhecidas,
      totalVariacoes: variacoes.length,
    }))
  } catch (e) {
    console.error('[config/loja/atributos/sugerir POST]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
