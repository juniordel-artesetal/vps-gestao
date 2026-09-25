// SOA Edition — OCR ASSISTENTE: recebe a arte (JPEG reduzido, ≤ 1600 px) e devolve onde há texto,
// com nome/idade chutados. Só SUGERE — a artesã confirma e o campo nasce posicionado. Limite de
// leituras por login/dia (custo da visão). A chave fica só no servidor.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio } from '@/lib/estudio/ctx'
import { detectarTextos, ocrDisponivel } from '@/lib/estudio/ocr'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const LIMITE_DIA = 60

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  if (!ocrDisponivel()) return NextResponse.json({ error: 'Leitura de texto indisponível neste ambiente.' }, { status: 503 })
  const b = await req.json().catch(() => ({}))
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.imagem || ''))
  if (!m) return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 })
  if (m[2].length > 3_500_000) return NextResponse.json({ error: 'Imagem grande demais — reduza antes de enviar.' }, { status: 413 })
  const [u] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `INSERT INTO "EstudioOcrUso" ("userId","data","n") VALUES ($1, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 1)
     ON CONFLICT ("userId","data") DO UPDATE SET "n" = "EstudioOcrUso"."n" + 1 RETURNING "n"`, c.userId)
  if ((u?.n || 0) > LIMITE_DIA) return NextResponse.json({ error: `Limite de ${LIMITE_DIA} leituras de texto por dia atingido — continua amanhã.` }, { status: 429 })
  try {
    const textos = await detectarTextos(m[2], m[1])
    return NextResponse.json({ textos })
  } catch (e) {
    console.error('[ESTUDIO-OCR]', (e as Error).message)
    return NextResponse.json({ error: 'Não consegui ler os textos agora. Tente de novo.' }, { status: 502 })
  }
}
