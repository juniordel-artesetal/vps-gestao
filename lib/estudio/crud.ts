// SOA Edition — CRUD das tabelas da Fase 3 / Método Mãe (mockups, cenas, kits de listagem, moldes de
// caixa, kits de caixas). Uma descrição por recurso; as rotas só repassam. Sempre filtrado pelo
// workspace da sessão. Identificadores de tabela/coluna vêm SÓ desta descrição (constantes); valores
// sempre como parâmetro.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ctxEstudio, gid, urlDoBlob } from './ctx'

type Tipo = 'texto' | 'json' | 'int' | 'url' | 'bool'
interface Recurso {
  tabela: string
  /** Colunas editáveis (além de id/workspaceId/datas). `obrigatoria` só na criação. */
  colunas: Record<string, { tipo: Tipo; obrigatoria?: boolean; max?: number; valores?: string[] }>
  /** Ordem da listagem. */
  ordem: string
  /** Também lista linhas globais aprovadas (acervo curado pelo Master). */
  global?: boolean
}

export const RECURSOS: Record<string, Recurso> = {
  mockups: {
    tabela: 'EstudioMockup', ordem: '"updatedAt" DESC', global: true,
    colunas: {
      nome: { tipo: 'texto', obrigatoria: true, max: 120 },
      tipo: { tipo: 'texto', obrigatoria: true, valores: ['proprio', 'biblioteca', 'caixa'] },
      fotoAssetId: { tipo: 'texto', max: 60 }, produtoRecortadoAssetId: { tipo: 'texto', max: 60 },
      fotoUrl: { tipo: 'url' }, recorteUrl: { tipo: 'url' },
      moldeCaixaId: { tipo: 'texto', max: 60 },
      areaAplicacao: { tipo: 'json' }, sombra: { tipo: 'json' }, luz: { tipo: 'json' }, config: { tipo: 'json' },
      previewUrl: { tipo: 'texto', max: 120_000 },
    },
  },
  cenas: {
    tabela: 'EstudioCena', ordem: '"nome"',
    colunas: {
      nome: { tipo: 'texto', obrigatoria: true, max: 120 },
      fundo: { tipo: 'json', obrigatoria: true }, sombra: { tipo: 'json' }, reflexo: { tipo: 'int' }, luz: { tipo: 'json' }, props: { tipo: 'json' },
      config: { tipo: 'json' },
    },
  },
  'kits-listagem': {
    tabela: 'EstudioKitListagem', ordem: '"nome"',
    colunas: {
      nome: { tipo: 'texto', obrigatoria: true, max: 120 },
      tomadas: { tipo: 'json', obrigatoria: true }, tamanhos: { tipo: 'json', obrigatoria: true }, config: { tipo: 'json' },
    },
  },
  'moldes-caixa': {
    tabela: 'EstudioMoldeCaixa', ordem: '"nome"',
    colunas: {
      nome: { tipo: 'texto', obrigatoria: true, max: 120 },
      tipo: { tipo: 'texto', obrigatoria: true, valores: ['acervo', 'proprio'] },
      acervoId: { tipo: 'texto', max: 60 }, dieLineAssetId: { tipo: 'texto', max: 60 }, dieLineUrl: { tipo: 'url' },
      largura: { tipo: 'int' }, altura: { tipo: 'int' },
      faces: { tipo: 'json', obrigatoria: true }, montagem: { tipo: 'json' },
      model3dUrl: { tipo: 'url' }, faceUV: { tipo: 'json' },
    },
  },
  'kits-caixas': {
    tabela: 'EstudioKit', ordem: '"nome"',
    colunas: { nome: { tipo: 'texto', obrigatoria: true, max: 120 }, moldeIds: { tipo: 'json', obrigatoria: true } },
  },
}

const MAX_JSON = 300_000

/** Valida e converte o corpo em [coluna, valor, cast][] — erro de validação vira mensagem. */
function colunasDo(r: Recurso, b: Record<string, unknown>, criar: boolean): [string, unknown, string][] | string {
  const out: [string, unknown, string][] = []
  for (const [col, def] of Object.entries(r.colunas)) {
    const v = b[col]
    if (v === undefined) { if (criar && def.obrigatoria) return `Campo obrigatório: ${col}`; continue }
    if (v === null) { if (def.obrigatoria) return `Campo obrigatório: ${col}`; out.push([col, null, def.tipo === 'json' ? '::jsonb' : '']); continue }
    if (def.tipo === 'texto') {
      const s = String(v).trim().slice(0, def.max || 500)
      if (def.obrigatoria && !s) return `Campo obrigatório: ${col}`
      if (def.valores && !def.valores.includes(s)) return `Valor inválido: ${col}`
      out.push([col, s, ''])
    } else if (def.tipo === 'url') {
      if (!urlDoBlob(v)) return `Arquivo inválido: ${col}`
      out.push([col, v, ''])
    } else if (def.tipo === 'int') {
      const n = Math.round(Number(v)); if (!Number.isFinite(n) || Math.abs(n) > 1e7) return `Número inválido: ${col}`
      out.push([col, n, '::int'])
    } else if (def.tipo === 'bool') out.push([col, !!v, '::boolean'])
    else {
      const j = JSON.stringify(v)
      if (j.length > MAX_JSON) return `Dados grandes demais: ${col}`
      out.push([col, j, '::jsonb'])
    }
  }
  return out
}

export function rotasColecao(nome: keyof typeof RECURSOS) {
  const r = RECURSOS[nome]
  const cols = ['id', ...Object.keys(r.colunas), ...(r.global ? ['aprovadaGlobal'] : []), '"workspaceId"', 'createdAt'].map(c => (c.startsWith('"') ? c : `"${c}"`))
  return {
    async GET(_req: NextRequest) {
      const c = await ctxEstudio(); if (!c.ok) return c.resp
      const where = r.global ? `("workspaceId"=$1 OR "aprovadaGlobal"=true)` : `"workspaceId"=$1`
      const itens = await prisma.$queryRawUnsafe(`SELECT ${cols.join(',')} FROM "${r.tabela}" WHERE ${where} ORDER BY ${r.ordem} LIMIT 300`, c.workspaceId)
      return NextResponse.json(serialize({ itens }))
    },
    async POST(req: NextRequest) {
      const c = await ctxEstudio(); if (!c.ok) return c.resp
      const b = await req.json().catch(() => ({}))
      const v = colunasDo(r, b, true)
      if (typeof v === 'string') return NextResponse.json({ error: v }, { status: 400 })
      const [n] = await prisma.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*)::int AS n FROM "${r.tabela}" WHERE "workspaceId"=$1`, c.workspaceId)
      if ((n?.n || 0) >= 500) return NextResponse.json({ error: 'Limite de itens atingido — exclua os que não usa.' }, { status: 400 })
      const id = gid()
      const nomes = ['"id"', '"workspaceId"', ...v.map(x => `"${x[0]}"`)]
      const params = [id, c.workspaceId, ...v.map(x => x[1])]
      const ph = params.map((_, i) => `$${i + 1}${i >= 2 ? v[i - 2][2] : ''}`)
      await prisma.$executeRawUnsafe(`INSERT INTO "${r.tabela}" (${nomes.join(',')}) VALUES (${ph.join(',')})`, ...params)
      return NextResponse.json({ id })
    },
  }
}

export function rotasItem(nome: keyof typeof RECURSOS) {
  const r = RECURSOS[nome]
  const temUpdated = nome === 'mockups'
  return {
    async GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const c = await ctxEstudio(); if (!c.ok) return c.resp
      const { id } = await params
      const where = r.global ? `"id"=$1 AND ("workspaceId"=$2 OR "aprovadaGlobal"=true)` : `"id"=$1 AND "workspaceId"=$2`
      const [item] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM "${r.tabela}" WHERE ${where}`, id, c.workspaceId)
      if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
      return NextResponse.json(serialize({ item }))
    },
    async PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const c = await ctxEstudio(); if (!c.ok) return c.resp
      const { id } = await params
      const b = await req.json().catch(() => ({}))
      const v = colunasDo(r, b, false)
      if (typeof v === 'string') return NextResponse.json({ error: v }, { status: 400 })
      if (!v.length) return NextResponse.json({ ok: true })
      const sets = v.map((x, i) => `"${x[0]}"=$${i + 3}${x[2]}`)
      if (temUpdated) sets.push('"updatedAt"=now()')
      const n = await prisma.$executeRawUnsafe(`UPDATE "${r.tabela}" SET ${sets.join(',')} WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId, ...v.map(x => x[1]))
      if (!n) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
      return NextResponse.json({ ok: true })
    },
    async DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
      const c = await ctxEstudio(); if (!c.ok) return c.resp
      const { id } = await params
      await prisma.$executeRawUnsafe(`DELETE FROM "${r.tabela}" WHERE "id"=$1 AND "workspaceId"=$2`, id, c.workspaceId)
      return NextResponse.json({ ok: true })
    },
  }
}
