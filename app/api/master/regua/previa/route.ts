// Master — PRÉVIA DA RÉGUA (somente leitura): quem o corte pegaria AGORA, já com a trava da Hotmart
// consultada ao vivo. Nada é gravado, nenhum e-mail sai. É a lista que se revisa ANTES de REGUA_CORTE=on.
// Auth: header x-master-token ou cookie master_token (= MASTER_SECRET_TOKEN).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { decidir } from '@/lib/assinatura/regua'
import { carregarLinhasRegua } from '@/lib/assinatura/reguaLinhas'
import { conferirPaganteExterno } from '@/lib/assinatura/pagante'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function verificarMaster(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

export async function GET(req: NextRequest) {
  if (!(await verificarMaster(req))) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const hoje = new Date()
  const linhas = await carregarLinhasRegua()
  const devedores: Record<string, unknown>[] = [], protegidos: Record<string, unknown>[] = []
  for (const l of linhas) {
    const d = decidir(l, hoje)
    const vetadoNaRegua = /CORTE VETADO/.test(d.motivo)
    if (!d.cortar && !vetadoNaRegua) continue
    const [w] = await prisma.$queryRaw`SELECT "nome" FROM "Workspace" WHERE "id" = ${l.workspaceId}` as { nome: string }[]
    const base = { workspaceId: l.workspaceId, nome: w?.nome ?? null, status: l.assinaturaStatus, motivo: d.motivo }
    if (vetadoNaRegua) { protegidos.push({ ...base, por: 'régua' }); continue }
    const ext = await conferirPaganteExterno(l.workspaceId)
    if (ext.protege) protegidos.push({ ...base, por: ext.motivo, hotmart: ext.hotmart })
    else devedores.push({ ...base, hotmart: ext.hotmart })
  }
  return NextResponse.json(serialize({
    geradoEm: hoje.toISOString(),
    corteLigado: (process.env.REGUA_CORTE ?? '').trim().toLowerCase() === 'on',
    devedores, protegidos,
  }))
}
