// Lista as assinaturas Hotmart (do cache) cruzadas por e-mail com a usuária do SOA.
// Só Master. Mostra acesso no SOA + flag liberacaoManual. Sem SELECT *.
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export const dynamic = 'force-dynamic'

async function ehMaster(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

// Buckets de status (Hotmart usa ACTIVE/DELAYED/OVERDUE/CANCELLED_*/INACTIVE/STARTED...)
function bucket(status: string | null): 'ATIVO' | 'ATRASO' | 'CANCELADO' | 'OUTRO' {
  const s = (status ?? '').toUpperCase()
  if (s === 'ACTIVE') return 'ATIVO'
  if (s === 'DELAYED' || s === 'OVERDUE') return 'ATRASO'
  if (s.startsWith('CANCELLED') || s.startsWith('CANCELED') || s === 'INACTIVE') return 'CANCELADO'
  return 'OUTRO'
}
// Está na faixa dos R$49,90 (pra destacar a coorte a migrar)?
function ehQuarentaNove(valor: number | null): boolean {
  if (valor == null) return false
  return valor >= 49 && valor < 50
}

export async function GET(_req: NextRequest) {
  if (!await ehMaster()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // DISTINCT ON (codigo): se o e-mail casar com vários usuários/workspaces, prefere o workspace ATIVO.
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT ON (ha."codigo")
      ha."codigo", ha."email", ha."nomeAssinante", ha."planoId", ha."planoNome",
      ha."status", ha."valor", ha."moeda", ha."adesao", ha."proximaCobranca", ha."atualizadoEm",
      w."id" AS "soaWorkspaceId", w."nome" AS "soaNome", w."ativo" AS "soaAtivo",
      w."liberacaoManual" AS "soaLiberacao"
    FROM "HotmartAssinatura" ha
    LEFT JOIN "User" u      ON LOWER(u."email") = LOWER(ha."email")
    LEFT JOIN "Workspace" w ON w."id" = u."workspaceId"
    ORDER BY ha."codigo", (w."ativo" = true) DESC NULLS LAST
  ` as any[]

  // Totais
  const totais = { total: rows.length, ativas: 0, atraso: 0, canceladas: 0, em4990: 0, semMatch: 0, migrar: 0 }
  const lista = rows.map(r => {
    const b = bucket(r.status)
    const em4990 = ehQuarentaNove(r.valor != null ? Number(r.valor) : null)
    const matched = !!r.soaWorkspaceId
    if (b === 'ATIVO') totais.ativas++
    if (b === 'ATRASO') totais.atraso++
    if (b === 'CANCELADO') totais.canceladas++
    if (em4990) totais.em4990++
    if (!matched) totais.semMatch++
    // Coorte "migrar p/ 29,90": em 49,90 e/ou em atraso, e não cancelada
    const migrar = (em4990 || b === 'ATRASO') && b !== 'CANCELADO'
    if (migrar) totais.migrar++
    return {
      ...r,
      valor: r.valor != null ? Number(r.valor) : null,
      bucket: b,
      em4990,
      matched,
      migrar,
    }
  })

  return NextResponse.json({ totais, lista: serialize(lista) })
}
