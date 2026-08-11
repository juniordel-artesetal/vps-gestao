// Enquetes/pesquisas para as assinantes. Master cria; a artesã responde por um
// pop-up in-app (1x, não intrusivo); o Master vê resultados agregados.
// Sem dado pessoal além do vínculo por workspace; respostas agregadas.
import { prisma } from '@/lib/prisma'

export type TipoPergunta = 'multipla' | 'escala' | 'texto'
export interface Pergunta {
  id: string
  texto: string
  tipo: TipoPergunta
  opcoes?: string[]   // só para 'multipla'
}
export type Publico = 'todas' | 'ativas' | 'inativas'

let schemaOk = false
export async function ensureEnquetesSchema() {
  if (schemaOk) return
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Enquete" (
      "id"          text PRIMARY KEY,
      "titulo"      text NOT NULL,
      "descricao"   text,
      "perguntas"   jsonb NOT NULL,
      "publico"     text NOT NULL DEFAULT 'todas',
      "planos"      text,                      -- CSV de planos; null = qualquer
      "modulo"      text,                      -- módulo mais usado exigido; null = qualquer
      "canalPopup"  boolean NOT NULL DEFAULT true,
      "canalEmail"  boolean NOT NULL DEFAULT false,
      "ativo"       boolean NOT NULL DEFAULT true,
      "createdAt"   timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt"   timestamptz NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EnqueteResposta" (
      "id"          text PRIMARY KEY,
      "enqueteId"   text NOT NULL,
      "workspaceId" text NOT NULL,
      "usuarioNome" text,
      "respostas"   jsonb NOT NULL,
      "createdAt"   timestamptz NOT NULL DEFAULT NOW()
    )
  `)
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "EnqueteResposta_uniq" ON "EnqueteResposta" ("enqueteId","workspaceId")`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EnqueteResposta_enq" ON "EnqueteResposta" ("enqueteId")`)
  schemaOk = true
}

export function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Valida/normaliza as perguntas vindas do Master (nunca confiar no client).
export function normalizarPerguntas(input: any): Pergunta[] {
  if (!Array.isArray(input)) return []
  const out: Pergunta[] = []
  for (const p of input) {
    const texto = String(p?.texto || '').trim()
    const tipo: TipoPergunta = p?.tipo === 'escala' ? 'escala' : p?.tipo === 'texto' ? 'texto' : 'multipla'
    if (!texto) continue
    const perg: Pergunta = { id: String(p?.id || gid()).slice(0, 40), texto: texto.slice(0, 300), tipo }
    if (tipo === 'multipla') {
      const opcoes = Array.isArray(p?.opcoes)
        ? p.opcoes.map((o: any) => String(o || '').trim()).filter(Boolean).slice(0, 12)
        : []
      if (opcoes.length < 2) continue // múltipla precisa de ao menos 2 opções
      perg.opcoes = opcoes
    }
    out.push(perg)
    if (out.length >= 20) break
  }
  return out
}
