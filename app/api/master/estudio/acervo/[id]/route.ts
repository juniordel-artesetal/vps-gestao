// Master — curadoria de UM template especial: gravar o processamento (feito no navegador pelo roteador
// de camadas), aprovar/publicar, reprovar, despublicar (takedown), categoria. Tudo auditado.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { urlDoBlob } from '@/lib/estudio/ctx'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { ensureEspeciais, ACERVO_WS, auditar } from '@/lib/estudio/especiais'

export const dynamic = 'force-dynamic'

const semanaISO = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia)
  const ano = t.getUTCFullYear(), sem = Math.ceil(((t.getTime() - Date.UTC(ano, 0, 1)) / 86400000 + 1) / 7)
  return `${ano}-W${String(sem).padStart(2, '0')}`
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const { id } = await params
  const auditoria = await prisma.$queryRawUnsafe(`SELECT "acao","por","nota","em" FROM "EstudioAcervoAuditoria" WHERE "templateId"=$1 ORDER BY "em" DESC LIMIT 50`, id)
  return NextResponse.json(serialize({ auditoria }))
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await ehMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  await ensureEspeciais()
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const por = String(b.por || 'master').slice(0, 80)
  const [t] = await prisma.$queryRawUnsafe<{ id: string; status: string | null; processado: boolean; driveFileId: string | null }[]>(
    `SELECT "id","status","processado","driveFileId" FROM "EstudioTemplate" WHERE "id"=$1 AND "workspaceId"=$2`, id, ACERVO_WS)
  if (!t) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  if (b.acao === 'processado') {
    if (!urlDoBlob(b.moldeUrl) || !b.config || typeof b.config !== 'object' || !Array.isArray(b.config.caixas)) return NextResponse.json({ error: 'Processamento inválido' }, { status: 400 })
    const cfg = JSON.stringify(b.config)
    if (cfg.length > 300_000) return NextResponse.json({ error: 'Configuração grande demais' }, { status: 400 })
    await prisma.$executeRawUnsafe(
      `UPDATE "EstudioTemplate" SET "moldeUrl"=$3, "config"=$4::jsonb, "preview"=$5, "processado"=true, "updatedAt"=now(),
         "nome"=COALESCE(NULLIF($6,''),"nome"), "temaNome"=COALESCE(NULLIF($6,''),"temaNome")
       WHERE "id"=$1 AND "workspaceId"=$2`,
      id, ACERVO_WS, b.moldeUrl, cfg, typeof b.preview === 'string' ? b.preview.slice(0, 300_000) : null, typeof b.nome === 'string' ? b.nome.trim().slice(0, 120) : '')
    await auditar(id, 'processar', por, `${b.config.caixas.length} campo(s)`)
    return NextResponse.json({ ok: true })
  }
  if (b.acao === 'aprovar') {
    if (!t.processado) return NextResponse.json({ error: 'Processe o template antes de aprovar.' }, { status: 400 })
    // a versão anterior do mesmo arquivo sai do ar (quem já salvou trabalho segue com a dela)
    if (t.driveFileId) await prisma.$executeRawUnsafe(
      `UPDATE "EstudioTemplate" SET "status"='substituido', "updatedAt"=now() WHERE "workspaceId"=$1 AND "driveFileId"=$2 AND "id"<>$3 AND "status"='publicado'`, ACERVO_WS, t.driveFileId, id)
    await prisma.$executeRawUnsafe(
      `UPDATE "EstudioTemplate" SET "status"='publicado', "publicadoEm"=now(), "semanaNovo"=$3, "updatedAt"=now() WHERE "id"=$1 AND "workspaceId"=$2`, id, ACERVO_WS, semanaISO())
    await auditar(id, 'aprovar', por, typeof b.nota === 'string' ? b.nota : 'conferido: genérico/autoral, sem personagem/marca de terceiro')
    return NextResponse.json({ ok: true })
  }
  if (b.acao === 'reprovar' || b.acao === 'despublicar') {
    await prisma.$executeRawUnsafe(`UPDATE "EstudioTemplate" SET "status"=$3, "updatedAt"=now() WHERE "id"=$1 AND "workspaceId"=$2`, id, ACERVO_WS, b.acao === 'reprovar' ? 'reprovado' : 'despublicado')
    await auditar(id, b.acao, por, typeof b.nota === 'string' ? b.nota : null)
    return NextResponse.json({ ok: true })
  }
  if (b.acao === 'categoria' && typeof b.categoria === 'string') {
    await prisma.$executeRawUnsafe(`UPDATE "EstudioTemplate" SET "categoria"=$3, "updatedAt"=now() WHERE "id"=$1 AND "workspaceId"=$2`, id, ACERVO_WS, b.categoria.trim().slice(0, 80))
    await auditar(id, 'categoria', por, b.categoria.trim().slice(0, 80))
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
