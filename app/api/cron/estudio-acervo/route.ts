// Cron SEMANAL — sincroniza o acervo dos Templates Especiais (Drive da Naty). Só INGERE: o que é novo ou
// mudou entra como pendente de curadoria; nada é publicado sem aprovação no Master.
import { NextRequest, NextResponse } from 'next/server'
import { sincronizarAcervo, statusAcervo } from '@/lib/estudio/acervoDrive'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const segredo = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || new URL(req.url).searchParams.get('secret')
  if (!process.env.CRON_SECRET || segredo !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const st = await statusAcervo()
  if (!st.configurado || !st.conectado || !st.pastaId) return NextResponse.json({ ok: true, pulado: 'acervo não conectado' })
  try { return NextResponse.json({ ok: true, ...(await sincronizarAcervo('cron')) }) }
  catch (e) { console.error('[CRON-ACERVO]', (e as Error).message); return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }) }
}
