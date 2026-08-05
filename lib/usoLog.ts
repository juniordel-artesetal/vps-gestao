// Tracking LEVE de uso por módulo, por workspace. Sem dado pessoal — só agregado:
// um bucket por (workspaceId, módulo, DIA), com contador. Um dia de uso do
// Financeiro = 1 linha que incrementa; nunca uma linha por clique. Alimenta o
// Master → Assinantes (módulo mais usado, dias ativos, histórico de consumo).
import { prisma } from '@/lib/prisma'

let schemaOk = false
export async function ensureUsoLogSchema() {
  if (schemaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UsoLog" (
      "id"          text PRIMARY KEY,
      "workspaceId" text NOT NULL,
      "modulo"      text NOT NULL,
      "dia"         date NOT NULL,
      "acessos"     integer NOT NULL DEFAULT 1,
      "createdAt"   timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt"   timestamptz NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "UsoLog_ws_mod_dia" ON "UsoLog" ("workspaceId","modulo","dia")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "UsoLog_ws_dia" ON "UsoLog" ("workspaceId","dia")`)
  schemaOk = true
}

// Mapa rota → módulo (rótulo amigável). O 1º segmento define o módulo; alguns casos
// específicos (orçamentos vive sob /dashboard) têm regra própria.
const MAPA: Record<string, string> = {
  dashboard: 'Produção',
  precificacao: 'Precificação',
  financeiro: 'Financeiro',
  gestao: 'Gestão/DRE',
  compras: 'Compras',
  clientes: 'Clientes',
  tarefas: 'Tarefas',
  demandas: 'Demandas',
  'minha-loja': 'Loja',
  loja: 'Loja',
  'pesquisa-preco': 'Assistente de Compras',
  promocoes: 'Promoções',
  creditos: 'Créditos',
  integracoes: 'Integrações',
  suporte: 'Suporte',
  config: 'Configurações',
  stars: 'Stars',
  parceiro: 'Parceria',
  orcamentos: 'Orçamentos',
}

/** Rótulo do módulo a partir do pathname. Retorna null quando não é área rastreável. */
export function moduloDaRota(pathname: string): string | null {
  const limpo = (pathname || '').split('?')[0].replace(/^\/+/, '')
  const segs = limpo.split('/').filter(Boolean)
  if (segs.length === 0) return null
  // Caso específico: orçamentos ficam sob /dashboard/orcamentos
  if (segs[0] === 'dashboard' && segs[1] === 'orcamentos') return MAPA.orcamentos
  return MAPA[segs[0]] ?? null
}

function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

/** Registra 1 uso do módulo hoje (idempotente por dia — incrementa o contador). */
export async function registrarUso(workspaceId: string, modulo: string): Promise<void> {
  if (!workspaceId || !modulo) return
  await ensureUsoLogSchema()
  await prisma.$executeRaw`
    INSERT INTO "UsoLog" ("id","workspaceId","modulo","dia","acessos")
    VALUES (${gid()}, ${workspaceId}, ${modulo}, CURRENT_DATE, 1)
    ON CONFLICT ("workspaceId","modulo","dia")
    DO UPDATE SET "acessos" = "UsoLog"."acessos" + 1, "updatedAt" = NOW()
  `
}
