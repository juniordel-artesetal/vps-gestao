// Master — CURADORIA DO ACERVO DE CENAS do SOA Design (fotos de fundo autorais/licenciadas). A foto sobe ao Blob
// (aqui no servidor — binário nunca no Neon) e vira uma cena GLOBAL (workspace do acervo). Publicar = aparece para
// TODOS os ateliês na aba Cenas. Regra de IP: só com a origem declarada (autoral ou licença comercial conferida).
// Master-only: cookie master_token ou header x-master-token (nunca NextAuth).
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import { ensureEstudioSchema } from '@/lib/estudio/schema'
import { ehMaster } from '@/lib/estudio/masterAuth'
import { ACERVO_WS } from '@/lib/estudio/especiais'
import { gid } from '@/lib/estudio/ctx'

export const dynamic = 'force-dynamic'
const CATEGORIAS = ['Festa infantil', 'Céu e nuvens', 'Clean e estúdio', 'Temáticos', 'Sazonais']
const DATA = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
const naoAut = () => NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

export async function GET(req: NextRequest) {
  if (!(await ehMaster(req))) return naoAut()
  await ensureEstudioSchema()
  const cenas = await prisma.$queryRawUnsafe(
    `SELECT "id","nome","fundo","config","categoria","tags","aprovadaGlobal","createdAt" FROM "EstudioCena" WHERE "workspaceId"=$1 ORDER BY "createdAt" DESC LIMIT 300`, ACERVO_WS)
  return NextResponse.json(serialize({ cenas, categorias: CATEGORIAS }))
}

/** Nova cena: { nome, categoria, tags[], imagem (data URL ≤ ~4 MB), origem (autoral/licença), altura, cy, publicar } */
export async function POST(req: NextRequest) {
  if (!(await ehMaster(req))) return naoAut()
  await ensureEstudioSchema()
  const b = await req.json().catch(() => ({}))
  const nome = String(b.nome || '').trim().slice(0, 120)
  const categoria = CATEGORIAS.includes(b.categoria) ? b.categoria : null
  const origem = String(b.origem || '').trim().slice(0, 300)
  const m = DATA.exec(String(b.imagem || ''))
  if (!nome || !categoria) return NextResponse.json({ error: 'Nome e categoria são obrigatórios.' }, { status: 400 })
  if (origem.length < 5) return NextResponse.json({ error: 'Declare a origem da imagem (autoral ou licença comercial) — regra de IP.' }, { status: 400 })
  if (!m) return NextResponse.json({ error: 'Imagem inválida.' }, { status: 400 })
  const buf = Buffer.from(m[2], 'base64')
  if (buf.length > 6_000_000) return NextResponse.json({ error: 'Imagem grande demais (reduza para até 2400 px).' }, { status: 413 })
  const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg'
  const slug = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) || 'cena'
  const blob = await put(`estudio/${ACERVO_WS}/cenas/${slug}.${ext}`, buf, { access: 'public', addRandomSuffix: true, contentType: m[1] })
  const tags = Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20) : []
  const altura = Math.max(0.2, Math.min(0.9, Number(b.altura) || 0.46)), cy = Math.max(0.2, Math.min(0.9, Number(b.cy) || 0.6))
  const id = gid()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EstudioCena" ("id","workspaceId","nome","fundo","sombra","reflexo","luz","props","config","categoria","tags","aprovadaGlobal")
     VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb,'[]'::jsonb,$8::jsonb,$9,$10::jsonb,$11)`,
    id, ACERVO_WS, nome, JSON.stringify({ tipo: 'foto', url: blob.url }), JSON.stringify({ contato: 78, projetada: 6, suavidade: 80 }),
    Math.max(0, Math.min(60, Number(b.reflexo) || 0)), JSON.stringify({ direcao: 60, intensidade: 8 }),
    JSON.stringify({ produto: { cx: 0.5, cy, altura }, origem, curadoriaEm: new Date().toISOString() }), categoria, JSON.stringify(tags), !!b.publicar)
  return NextResponse.json({ id, url: blob.url })
}

/** { id, publicar?, nome?, categoria?, tags? } */
export async function PUT(req: NextRequest) {
  if (!(await ehMaster(req))) return naoAut()
  await ensureEstudioSchema()
  const b = await req.json().catch(() => ({}))
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  if (typeof b.publicar === 'boolean') await prisma.$executeRawUnsafe(`UPDATE "EstudioCena" SET "aprovadaGlobal"=$3 WHERE "id"=$1 AND "workspaceId"=$2`, b.id, ACERVO_WS, b.publicar)
  if (typeof b.nome === 'string' && b.nome.trim()) await prisma.$executeRawUnsafe(`UPDATE "EstudioCena" SET "nome"=$3 WHERE "id"=$1 AND "workspaceId"=$2`, b.id, ACERVO_WS, b.nome.trim().slice(0, 120))
  if (CATEGORIAS.includes(b.categoria)) await prisma.$executeRawUnsafe(`UPDATE "EstudioCena" SET "categoria"=$3 WHERE "id"=$1 AND "workspaceId"=$2`, b.id, ACERVO_WS, b.categoria)
  if (Array.isArray(b.tags)) await prisma.$executeRawUnsafe(`UPDATE "EstudioCena" SET "tags"=$3::jsonb WHERE "id"=$1 AND "workspaceId"=$2`, b.id, ACERVO_WS, JSON.stringify(b.tags.map((t: unknown) => String(t).slice(0, 40)).slice(0, 20)))
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!(await ehMaster(req))) return naoAut()
  await ensureEstudioSchema()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })
  await prisma.$executeRawUnsafe(`DELETE FROM "EstudioCena" WHERE "id"=$1 AND "workspaceId"=$2`, id, ACERVO_WS)
  return NextResponse.json({ ok: true })
}
