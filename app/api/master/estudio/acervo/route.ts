// Master — acervo dos Templates Especiais (Drive da Naty): status da conexão, pasta, sincronizar agora,
// lista para curadoria (pendentes/publicados/…) e últimas sincronizações.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { ensureEspeciais, ACERVO_WS } from '@/lib/estudio/especiais'
import { statusAcervo, definirPasta, desconectarAcervo, sincronizarAcervo } from '@/lib/estudio/acervoDrive'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!(await ehMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEspeciais()
  const status = await statusAcervo()
  const itens = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","status","categoria","versao","driveFileId","arquivoUrl","arquivoNome","moldeUrl","preview","processado","publicadoEm","semanaNovo","createdAt",
            ("config" ->> 'caixas') IS NOT NULL AS "temCampos"
     FROM "EstudioTemplate" WHERE "workspaceId"=$1 AND COALESCE("status",'') <> 'substituido'
     ORDER BY CASE "status" WHEN 'pendente_curadoria' THEN 0 WHEN 'publicado' THEN 1 ELSE 2 END, "createdAt" DESC LIMIT 500`, ACERVO_WS)
  const syncs = await prisma.$queryRawUnsafe(`SELECT * FROM "EstudioAcervoSync" ORDER BY "executadoEm" DESC LIMIT 10`)
  return NextResponse.json(serialize({ status, itens, syncs }))
}

export async function POST(req: NextRequest) {
  if (!(await ehMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  try {
    if (b.acao === 'pasta') { await definirPasta(String(b.pastaId || '')); return NextResponse.json({ ok: true }) }
    if (b.acao === 'desconectar') { await desconectarAcervo(); return NextResponse.json({ ok: true }) }
    if (b.acao === 'sync') return NextResponse.json({ ok: true, ...(await sincronizarAcervo('manual')) })
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
