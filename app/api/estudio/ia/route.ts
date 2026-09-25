// SOA Edition — FERRAMENTAS DE IA DE IMAGEM (remover fundo, apagar objeto, expandir, ampliar, fundo por tema).
// Cada chamada custa 1 imagem da cota do login e é DEBITADA ANTES de chamar a IA (o servidor é a
// autoridade). Se a IA falhar — ou não entregar trabalho de IA (upscale → fallbackLocal) — o PRÓPRIO
// servidor estorna aquele débito. Falha da IA responde 200 { ok:false, falhou:true } (fail-open: a tela
// avisa e as ferramentas manuais seguem). Limite extra de chamadas de IA por login/dia (custo).
// As chaves ficam só no servidor; o GET informa apenas QUAIS provedores existem (booleanos).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ctxEstudio, gid } from '@/lib/estudio/ctx'
import { autorizarItens, estornarAutorizacao, statusCota } from '@/lib/estudio/cota'
import {
  OPS_IA, type OpIA, type ImagemB64, type ResultadoIA, provedoresIA, mockup3dDisponivel,
  removerFundo, apagarObjeto, expandirImagem, ampliarImagem, gerarFundoTema,
} from '@/lib/estudio/ia'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LIMITE_IA_DIA = 80
/** ~6 MB de base64 por imagem. Atenção: a Vercel recusa corpo > 4,5 MB — o cliente deve reduzir antes (≤ 2048 px). */
const MAX_B64 = 6_000_000
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
const ID = /^[a-z0-9]{8,40}$/

function dataUrl(v: unknown, soPng = false): ImagemB64 | null | 'grande' {
  const m = DATA_URL.exec(String(v || ''))
  if (!m || (soPng && m[1] !== 'image/png')) return null
  if (m[2].length > MAX_B64) return 'grande'
  return { mime: m[1], base64: m[2] }
}

export async function GET() {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  return NextResponse.json({ ...provedoresIA(), mockup3d: mockup3dDisponivel() })
}

export async function POST(req: NextRequest) {
  const c = await ctxEstudio(); if (!c.ok) return c.resp
  const b = await req.json().catch(() => ({}))
  const op = String(b.op || '')

  // Fluxo C (mockup 3D por API externa) — só atrás de flag; provedor ainda não implementado. Nada é debitado.
  if (op === 'mockup-3d') {
    if (!mockup3dDisponivel()) return NextResponse.json({ error: 'Em breve' }, { status: 501 })
    return NextResponse.json({ error: 'Mockup 3D com IA ainda não tem provedor configurado.' }, { status: 501 })
  }
  if (!OPS_IA.includes(op as OpIA)) return NextResponse.json({ error: 'Operação inválida' }, { status: 400 })

  // ── Validação (antes de qualquer débito).
  let imagem: ImagemB64 | null = null, mascara: ImagemB64 | null = null
  let tema = '', proporcao: '1:1' | '4:5' = '1:1'
  if (op === 'fundo-tema') {
    tema = String(b.tema || '').replace(/\s+/g, ' ').trim()
    if (!tema || tema.length > 60) return NextResponse.json({ error: 'Informe o tema (até 60 caracteres).' }, { status: 400 })
    if (b.proporcao === '4:5') proporcao = '4:5'
  } else {
    const i = dataUrl(b.imagem)
    if (i === 'grande') return NextResponse.json({ error: 'Imagem grande demais — reduza antes de enviar.' }, { status: 413 })
    if (!i) return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 })
    imagem = i
    if (op === 'apagar') {
      const m = dataUrl(b.mascara, true)
      if (m === 'grande') return NextResponse.json({ error: 'Máscara grande demais.' }, { status: 413 })
      if (!m) return NextResponse.json({ error: 'Marque a área a apagar (máscara PNG).' }, { status: 400 })
      mascara = m
    }
  }

  const prov = provedoresIA()
  const atendido = prov.gemini || (op === 'remover-fundo' && prov.removeBg) || (op === 'upscale' && prov.replicate)
  if (!atendido) return NextResponse.json({ error: 'IA de imagem indisponível neste ambiente.' }, { status: 503 })

  // ── Limite de chamadas de IA por login/dia (conta tentativas, como o OCR).
  const [u] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `INSERT INTO "EstudioIaUso" ("userId","data","n") VALUES ($1, (now() AT TIME ZONE 'America/Sao_Paulo')::date, 1)
     ON CONFLICT ("userId","data") DO UPDATE SET "n" = "EstudioIaUso"."n" + 1 RETURNING "n"`, c.userId)
  if ((u?.n || 0) > LIMITE_IA_DIA) return NextResponse.json({ error: `Limite de ${LIMITE_IA_DIA} usos de IA por dia atingido — continua amanhã.` }, { status: 429 })

  // ── Débito de 1 imagem ANTES de chamar a IA.
  const lote = ('ia' + gid()).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40)
  if (!ID.test(lote)) return NextResponse.json({ error: 'Falha interna ao autorizar' }, { status: 500 })
  const chave = `${lote}:0`
  const aut = await autorizarItens(c.workspaceId, c.userId, lote, chave, 1)
  if (!aut.ok) {
    return NextResponse.json({
      error: `Suas imagens de hoje acabaram (faltam ${aut.faltam}). Compre um pacote de ${aut.status.imagensPorPacote} ou continue amanhã.`,
      faltam: aut.faltam, cota: aut.status,
    }, { status: 402 })
  }

  /** Devolve o débito desta chamada e o status atualizado da cota. Erro no estorno não derruba a resposta. */
  const estornar = async () => {
    try { await estornarAutorizacao(c.userId, chave) } catch (e) { console.error('[ESTUDIO-IA] estorno', (e as Error).message) }
    try { return await statusCota(c.workspaceId, c.userId) } catch { return aut.status }
  }

  let r: ResultadoIA
  try {
    if (op === 'remover-fundo') r = await removerFundo(imagem!)
    else if (op === 'apagar') r = await apagarObjeto(imagem!, mascara!)
    else if (op === 'expandir') r = await expandirImagem(imagem!)
    else if (op === 'upscale') r = await ampliarImagem(imagem!)
    else r = await gerarFundoTema(tema, proporcao)
  } catch (e) {
    const mensagem = (e as Error)?.message || 'A IA falhou agora. Tente de novo.'
    console.error('[ESTUDIO-IA]', op, mensagem)
    return NextResponse.json({ ok: false, falhou: true, mensagem, custo: 0, cota: await estornar() })
  }

  if (r.tipo === 'fallbackLocal') {
    // Nenhum trabalho de IA entregue → não cobra.
    return NextResponse.json({ ok: true, fallbackLocal: true, mensagem: r.motivo, custo: 0, cota: await estornar() })
  }
  if (r.tipo === 'mascaras') {
    return NextResponse.json({ ok: true, mascaras: r.mascaras, provedor: r.provedor, custo: 1, cota: aut.status })
  }
  return NextResponse.json({
    ok: true, imagem: `data:${r.imagem.mime};base64,${r.imagem.base64}`, provedor: r.provedor, custo: 1, cota: aut.status,
  })
}
