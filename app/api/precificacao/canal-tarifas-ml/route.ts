import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureCanalTarifaML } from '@/lib/canalTarifasMlSchema'

function serialize(obj: any): any {
  if (typeof obj === 'bigint') return Number(obj)
  if (obj && typeof obj.toNumber === 'function') return parseFloat(String(obj))
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}

const gerarId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

// ── GET — tarifas ML salvas do workspace (vazio ⇒ o cliente usa os padrões embutidos)
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const workspaceId = session.user.workspaceId

  try {
    await ensureCanalTarifaML()
    const rows = await prisma.$queryRaw`
      SELECT "id", "pesoMin", "pesoMax", "precoMin", "precoMax", "taxaFixa"
      FROM "CanalTarifaML"
      WHERE "workspaceId" = ${workspaceId} AND "ativo" = true
      ORDER BY "pesoMin" ASC, "precoMin" ASC
    ` as any[]
    return NextResponse.json({ tarifas: serialize(rows), isDefault: rows.length === 0 })
  } catch (e) {
    console.error('[CANAL-TARIFAS-ML][GET]', e)
    return NextResponse.json({ error: 'Erro ao carregar tarifas' }, { status: 500 })
  }
}

// ── POST — action:'update' (salvar tabela) | action:'seed' (restaurar padrões)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR')
    return NextResponse.json({ error: 'Sem permissão para alterar tarifas' }, { status: 403 })
  const workspaceId = session.user.workspaceId

  let body: any
  try { body = await req.json() } catch { body = {} }
  const action = body?.action

  try {
    await ensureCanalTarifaML()

    // Restaurar padrões: remove as customizações do workspace → GET volta vazio → cliente usa os padrões oficiais (março/2026)
    if (action === 'seed') {
      await prisma.$executeRaw`DELETE FROM "CanalTarifaML" WHERE "workspaceId" = ${workspaceId}`
      return NextResponse.json({ ok: true, mensagem: 'Valores padrão do ML restaurados.' })
    }

    if (action === 'update') {
      const tarifas = Array.isArray(body?.tarifas) ? body.tarifas : null
      if (!tarifas || tarifas.length === 0)
        return NextResponse.json({ error: 'Nenhuma tarifa recebida para salvar.' }, { status: 400 })

      // Validação: normaliza e rejeita valores inválidos com mensagem clara
      const linhas: { id: string; pesoMin: number; pesoMax: number; precoMin: number; precoMax: number | null; taxaFixa: number }[] = []
      for (const t of tarifas) {
        const pesoMin  = Number(t.pesoMin)
        const pesoMax  = Number(t.pesoMax)
        const precoMin = Number(t.precoMin)
        const precoMax = t.precoMax === null || t.precoMax === undefined || t.precoMax === '' ? null : Number(t.precoMax)
        const taxaFixa = Number(t.taxaFixa)
        if (![pesoMin, pesoMax, precoMin].every(Number.isFinite) || (precoMax !== null && !Number.isFinite(precoMax)))
          return NextResponse.json({ error: 'Faixa de peso/preço inválida em uma das linhas.' }, { status: 400 })
        if (!Number.isFinite(taxaFixa) || taxaFixa < 0)
          return NextResponse.json({ error: 'Taxa fixa inválida (use um número maior ou igual a zero).' }, { status: 400 })
        linhas.push({ id: gerarId(), pesoMin, pesoMax, precoMin, precoMax, taxaFixa })
      }

      // Substituição atômica: apaga as tarifas do workspace e reinsere (idempotente)
      const ops: any[] = [
        prisma.$executeRaw`DELETE FROM "CanalTarifaML" WHERE "workspaceId" = ${workspaceId}`,
      ]
      for (const l of linhas) {
        ops.push(prisma.$executeRaw`
          INSERT INTO "CanalTarifaML" ("id", "workspaceId", "pesoMin", "pesoMax", "precoMin", "precoMax", "taxaFixa", "ativo")
          VALUES (${l.id}, ${workspaceId}, ${l.pesoMin}, ${l.pesoMax}, ${l.precoMin}, ${l.precoMax}, ${l.taxaFixa}, true)
        `)
      }
      await prisma.$transaction(ops)

      return NextResponse.json({ ok: true, mensagem: `${linhas.length} tarifas salvas com sucesso.` })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('[CANAL-TARIFAS-ML][POST]', e)
    return NextResponse.json({ error: 'Erro ao salvar as tarifas. Tente novamente.' }, { status: 500 })
  }
}
