// Catálogo GLOBAL de canais (a "rotina de atualização" do SOA). Master-only
// (cookie master_token). Ao salvar, marca atualizadoEm=agora → reflete pra todos
// os workspaces que usam o canal (que herdam do catálogo, salvo ajuste próprio).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serialize } from '@/lib/serialize'
import { getCatalogoCanais, atualizarCatalogoCanal } from '@/lib/canaisVenda'

export const dynamic = 'force-dynamic'

async function master(): Promise<boolean> {
  const c = await cookies()
  return c.get('master_token')?.value === process.env.MASTER_SECRET_TOKEN
}

export async function GET() {
  if (!(await master())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  return NextResponse.json(serialize({ canais: await getCatalogoCanais() }))
}

// PUT { canal, nome?, regras?, categorias?, variantes?, pixDias?, cartaoDias?, estrutura?, atualizadoPor? }
export async function PUT(req: NextRequest) {
  if (!(await master())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  if (!b.canal) return NextResponse.json({ error: 'canal é obrigatório' }, { status: 400 })
  if (b.regras && !Array.isArray(b.regras)) return NextResponse.json({ error: 'regras deve ser uma lista' }, { status: 400 })
  await atualizarCatalogoCanal(String(b.canal), {
    nome: b.nome, regras: b.regras, categorias: b.categorias, variantes: b.variantes,
    pixDias: b.pixDias, cartaoDias: b.cartaoDias, estrutura: b.estrutura,
    atualizadoPor: (b.atualizadoPor ? String(b.atualizadoPor) : 'master').slice(0, 60),
  })
  return NextResponse.json(serialize({ ok: true, canais: await getCatalogoCanais() }))
}
