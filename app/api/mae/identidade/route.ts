// Método MAE — Identidade do Ateliê no Neon (mae_identity): nome do arquivo + hash da logo e do QR
// (os arquivos ficam na Biblioteca), link do QR e @. Cadastro único por conta.
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { contaMae, lerJson } from '@/lib/mae/servidor/acesso'

const Arquivo = z.object({ path: z.string().min(1).max(500), sha256: z.string().min(4).max(64), aspect: z.number().positive().optional() })
const Identidade = z.object({ logo: Arquivo.optional(), qr: Arquivo.extend({ link: z.string().max(500).optional() }).optional(), arroba: z.string().max(80).optional() })

export async function GET() {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  try {
    const [l] = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM mae_identity WHERE workspace_id = ${c.workspaceId}`
    if (!l) return NextResponse.json({ identidade: null })
    const s = serialize(l)
    return NextResponse.json({ identidade: {
      ...(s.logo_arquivo ? { logo: { path: s.logo_arquivo, sha256: s.logo_sha256, aspect: s.logo_aspect ?? undefined } } : {}),
      ...(s.qr_arquivo ? { qr: { path: s.qr_arquivo, sha256: s.qr_sha256, link: s.qr_link ?? undefined } } : {}),
      ...(s.arroba ? { arroba: s.arroba } : {}),
      atualizadoEm: s.atualizado_em,
    } })
  } catch (e) {
    console.error('[MAE IDENTIDADE GET]', e)
    return NextResponse.json({ error: 'Erro ao ler a identidade' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const c = await contaMae(); if (c instanceof NextResponse) return c
  let i
  try {
    const r = Identidade.safeParse(await lerJson(req, 50_000))
    if (!r.success) return NextResponse.json({ error: 'Identidade inválida' }, { status: 400 })
    i = r.data
  } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }
  try {
    await prisma.$executeRaw`
      INSERT INTO mae_identity (workspace_id, logo_arquivo, logo_sha256, logo_aspect, qr_link, qr_arquivo, qr_sha256, arroba, atualizado_em)
      VALUES (${c.workspaceId}, ${i.logo?.path ?? null}, ${i.logo?.sha256 ?? null}, ${i.logo?.aspect ?? null}, ${i.qr?.link ?? null}, ${i.qr?.path ?? null}, ${i.qr?.sha256 ?? null}, ${i.arroba ?? null}, now())
      ON CONFLICT (workspace_id) DO UPDATE SET logo_arquivo = EXCLUDED.logo_arquivo, logo_sha256 = EXCLUDED.logo_sha256, logo_aspect = EXCLUDED.logo_aspect,
        qr_link = EXCLUDED.qr_link, qr_arquivo = EXCLUDED.qr_arquivo, qr_sha256 = EXCLUDED.qr_sha256, arroba = EXCLUDED.arroba, atualizado_em = now()`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[MAE IDENTIDADE PUT]', e)
    return NextResponse.json({ error: 'Erro ao salvar a identidade' }, { status: 500 })
  }
}
