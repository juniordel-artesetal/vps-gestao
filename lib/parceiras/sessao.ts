// Resolve o parceiroId da sessão nas DUAS formas (dual-identidade):
//   (a) sessão de PARCEIRA PURA (role='parceira') → parceiroId direto.
//   (b) sessão de ARTESÃ logada → Parceiro vinculado pelo userId (mesma pessoa).
// Assim o painel /parceira funciona tanto para a parceira pura quanto para a
// artesã que também é parceira, sem expulsar a artesã de /modulos.
import { prisma } from '@/lib/prisma'

export async function resolverParceiroDaSessao(session: any): Promise<string | null> {
  const role = session?.user?.role
  const pid = session?.user?.parceiroId
  if (role === 'parceira' && pid) return pid
  const userId = session?.user?.id
  if (!userId) return null
  try {
    const [p] = await prisma.$queryRaw`SELECT "id" FROM "Parceiro" WHERE "userId" = ${userId} LIMIT 1` as { id: string }[]
    return p?.id ?? null
  } catch { return null }
}

export interface VinculoParceira { vinculada: boolean; status: string | null; aprovada: boolean; completo: boolean }

/** Status do vínculo de parceira de uma ARTESÃ logada (para o botão em /modulos). */
export async function vinculoDaArtesa(userId: string): Promise<VinculoParceira> {
  try {
    const [p] = await prisma.$queryRaw`
      SELECT "status", ("senhaCripto" IS NOT NULL) AS "temSenha", ("cupom" IS NOT NULL) AS "temCodigo"
      FROM "Parceiro" WHERE "userId" = ${userId} LIMIT 1
    ` as { status: string; temSenha: boolean; temCodigo: boolean }[]
    if (!p) return { vinculada: false, status: null, aprovada: false, completo: false }
    return { vinculada: true, status: p.status, aprovada: p.status === 'aprovada', completo: p.temSenha && p.temCodigo }
  } catch { return { vinculada: false, status: null, aprovada: false, completo: false } }
}
