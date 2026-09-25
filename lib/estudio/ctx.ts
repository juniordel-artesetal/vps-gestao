// Contexto de acesso das rotas do SOA Edition: sessão + ADMIN + módulo ligado + schema.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { estudioLiberado } from '@/lib/estudio/modulo'
import { ensureEstudioSchema } from '@/lib/estudio/schema'

export type CtxEstudio = { ok: true; workspaceId: string } | { ok: false; resp: NextResponse }

export async function ctxEstudio(): Promise<CtxEstudio> {
  const session = await getServerSession(authOptions)
  if (!session) return { ok: false, resp: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  if (session.user.role !== 'ADMIN') return { ok: false, resp: NextResponse.json({ error: 'Sem permissão' }, { status: 403 }) }
  const workspaceId = session.user.workspaceId
  if (!(await estudioLiberado(workspaceId))) return { ok: false, resp: NextResponse.json({ error: 'Módulo indisponível' }, { status: 404 }) }
  await ensureEstudioSchema()
  return { ok: true, workspaceId }
}

/** Armazenamento (Vercel Blob) configurado neste ambiente? */
export function storageConfigurado(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN
}

export const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

/** Só aceitamos URLs do próprio Vercel Blob (evita gravar link arbitrário como "arquivo"). */
export function urlDoBlob(u: unknown): u is string {
  if (typeof u !== 'string') return false
  try { return new URL(u).hostname.endsWith('.blob.vercel-storage.com') } catch { return false }
}
