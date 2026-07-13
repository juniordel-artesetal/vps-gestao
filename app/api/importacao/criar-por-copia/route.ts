import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normNome } from '@/lib/normNome'
import { indexarVariacoes, extrairQtdPacote } from '@/lib/matchVariacao'
import { copiarProduto } from '@/lib/copiarProduto'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Resolve a variação de um produto pelo nome (fallback: primeira). Reusa matchVariacao.
async function resolverVariacaoDoProduto(produtoId: string, nome: string): Promise<string | null> {
  const vars = await prisma.$queryRaw`
    SELECT v."id", v."nome", p."nome" AS "produtoNome", v."isKit", v."qtdKit"
    FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
    WHERE v."produtoId" = ${produtoId} AND COALESCE(v."precoVenda",0) > 0
  ` as any[]
  if (vars.length === 0) return null
  if (vars.length === 1) return vars[0].id
  const r = indexarVariacoes(vars).resolver(nome)
  return r.status === 'match' ? r.variacaoId : vars[0].id
}

async function salvarDePara(workspaceId: string, canal: string, nome: string, variacaoId: string) {
  const chave = normNome(nome)
  if (!chave) return
  try {
    await prisma.$executeRaw`
      INSERT INTO "MarketplaceProdutoVinculo" ("id","workspaceId","canal","chaveExterna","variacaoId","createdAt")
      VALUES (${gerarId()}, ${workspaceId}, ${canal}, ${chave}, ${variacaoId}, NOW())
      ON CONFLICT ("workspaceId","canal","chaveExterna") DO UPDATE SET "variacaoId" = EXCLUDED."variacaoId"`
  } catch (e) { console.warn('[criar-por-copia depara]', e) }
}

// POST { baseId, nome, canal? } — cria o produto copiando o "irmão" (baseId), com o NOME
// da planilha, vincula (de-para) e devolve o variacaoId. Anti-duplicação: se já existir
// produto com esse nome (normalizado), NÃO cria — vincula ao existente e avisa.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    const workspaceId = session.user.workspaceId
    const { baseId, nome, canal } = await req.json()
    const nomeLimpo = String(nome || '').trim()
    const canalFinal = String(canal || 'shopee').trim().slice(0, 40) || 'shopee'
    if (!baseId || !nomeLimpo) return NextResponse.json({ error: 'Base e nome são obrigatórios' }, { status: 400 })

    // Base pertence ao workspace?
    const [base] = await prisma.$queryRaw`SELECT "id" FROM "PrecProduto" WHERE "id" = ${baseId} AND "workspaceId" = ${workspaceId} LIMIT 1` as any[]
    if (!base) return NextResponse.json({ error: 'Produto base não encontrado' }, { status: 404 })

    // ── Anti-duplicação: já existe produto com esse nome (normalizado)? ──
    const chaveAlvo = normNome(nomeLimpo)
    const existentes = await prisma.$queryRaw`
      SELECT p."id", p."nome" FROM "PrecProduto" p
      WHERE p."workspaceId" = ${workspaceId} AND p."ativo" = true
        AND EXISTS (SELECT 1 FROM "PrecVariacao" v WHERE v."produtoId" = p."id" AND COALESCE(v."precoVenda",0) > 0)
    ` as { id: string; nome: string }[]
    const jaExiste = existentes.find(p => normNome(p.nome) === chaveAlvo)
    if (jaExiste) {
      const vid = await resolverVariacaoDoProduto(jaExiste.id, nomeLimpo)
      if (vid) await salvarDePara(workspaceId, canalFinal, nomeLimpo, vid)
      return NextResponse.json({ ok: true, jaExistia: true, produtoId: jaExiste.id, variacaoId: vid })
    }

    // ── Copia fiel (materiais/preço), só o nome muda. qtdKit vem da quantidade do PACOTE
    //    embutida no nome da planilha (",42"/"36 unidades"); sem isso, herda o da base. ──
    const qtdPacote = extrairQtdPacote(nomeLimpo)
    const copia = await copiarProduto({ workspaceId, baseId, novoNome: nomeLimpo, qtdKitOverride: qtdPacote })
    if (!copia) return NextResponse.json({ error: 'Não foi possível copiar' }, { status: 500 })

    const variacaoId = await resolverVariacaoDoProduto(copia.novoProdutoId, nomeLimpo)
    if (variacaoId) await salvarDePara(workspaceId, canalFinal, nomeLimpo, variacaoId)

    return NextResponse.json({ ok: true, jaExistia: false, produtoId: copia.novoProdutoId, variacaoId })
  } catch (e) {
    console.error('[importacao/criar-por-copia POST]', e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
