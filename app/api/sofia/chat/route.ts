import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recuperarConhecimento, montarContextoConhecimento } from '@/lib/suporte/recuperar'
import { calcularIndice } from '@/lib/indicePrecos'
import { SOFIA_TOM } from '@/lib/sofia/persona'

export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.ANTHROPIC_API_KEY_GESTAO!
const LIMITE_DIARIO = 150
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

// Detecta um tour sugerível a partir da pergunta (para o botão "Quer que eu te mostre?").
function tourSugerido(msg: string): string | null {
  const m = msg.toLowerCase()
  if (/(precific|quanto cobrar|preç[oa] do (meu )?produto|margem|calcular preç)/.test(m)) return 'precificar_produto'
  if (/(loja|vitrine|vender online|catálogo|catalogo)/.test(m)) return 'montar_loja'
  if (/(primeiro pedido|criar (um )?pedido|como faço (um )?pedido|montar pedido)/.test(m)) return 'criar_primeiro_pedido'
  return null
}

// É pergunta de PREÇO DE MATERIAL? extrai o termo do material.
function extrairPrecoMaterial(msg: string): string | null {
  const m = msg.toLowerCase()
  if (!/(preç|quanto custa|valor médio|valor medio|quanto (tá|ta|está|esta)|cotaç)/.test(m)) return null
  // remove os gatilhos e devolve o restante como termo do material
  let termo = msg
    .replace(/.*?(preço médio do|preço médio da|preço médio de|preço do|preço da|preço de|quanto custa o|quanto custa a|quanto custa|valor médio do|valor médio da|valor médio de|quanto (tá|ta|está|esta) o|quanto (tá|ta|está|esta) a|cotação do|cotação da)\s*/i, '')
    .replace(/[?!.]+$/g, '')
    .trim()
  // se não sobrou material específico, não trata como preço
  if (!termo || termo.length < 3 || /^(hoje|agora|isso|meu|minha)/i.test(termo)) return null
  return termo
}

async function chamarGemini(systemPrompt: string, historico: any[], mensagem: string, imagemBase64?: string): Promise<string | null> {
  const contents = [
    ...historico.slice(-6).map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
    {
      role: 'user',
      parts: [
        ...(imagemBase64 ? [{ inline_data: { mime_type: 'image/jpeg', data: imagemBase64.replace(/^data:image\/[a-z]+;base64,/, '') } }] : []),
        { text: mensagem },
      ],
    },
  ]
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 1500 } }),
  })
  if (!res.ok) { console.error('[SOFIA] Gemini', res.status); return null }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const workspaceId = session.user.workspaceId
    const hoje = new Date().toISOString().slice(0, 10)

    // Cap diário (compartilha o AiUsageLog)
    let calls = 0, logExiste = false
    try {
      const logs = await prisma.$queryRaw`SELECT id, calls FROM "AiUsageLog" WHERE "workspaceId" = ${workspaceId} AND "data"::text = ${hoje} LIMIT 1` as any[]
      calls = Number(logs[0]?.calls ?? 0); logExiste = logs.length > 0
    } catch {}
    if (calls >= LIMITE_DIARIO) return NextResponse.json({ error: 'Ufa, muita conversa por hoje! 😅 A gente continua amanhã. Se for urgente, abre um chamado no Suporte.' }, { status: 429 })

    const { mensagem, historico = [], imagemBase64 } = await req.json()
    if (!mensagem?.trim() && !imagemBase64) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

    let resposta = ''
    let tourId: string | null = null
    let usouIA = false

    // ── PREÇO DE MATERIAL (sem IA — direto do índice anônimo) ──
    const termoPreco = !imagemBase64 ? extrairPrecoMaterial(mensagem) : null
    if (termoPreco) {
      const idx = await calcularIndice(termoPreco)
      if (idx.suficiente) {
        const conf = idx.confiabilidade === 'alta' ? 'com bastante gente na conta' : idx.confiabilidade === 'media' ? 'com uma amostra boa' : 'ainda com poucas fontes, então olha com carinho'
        resposta = `Sobre **${termoPreco}**, olha o que o pessoal tá pagando (${conf}):\n\n• Faixa mais comum: **${brl(idx.faixaMin)} a ${brl(idx.faixaMax)}**\n• Mais barato encontrado: ${brl(idx.menor)}\n• Média: ${brl(idx.medio)}\n\nSão preços da comunidade, sempre anônimos e somados 🧡 Se quiser, dá pra acompanhar esse material no Assistente de Compras e eu te aviso quando cair.`
      } else if (idx.motivo === 'amostra_insuficiente') {
        resposta = `Ainda não tenho gente suficiente cadastrando "${termoPreco}" pra te dar um preço confiável, amiga — não quero te passar número furado. Conforme mais artesãs cadastram, isso melhora. Quer tentar com outro nome pro material?`
      } else {
        resposta = 'Me diz o nome do material que você quer saber o preço (ex.: "papel offset 240", "feltro", "cola branca") que eu procuro pra você 😊'
      }
    }
    // ── DADOS SIMPLES read-only do workspace ──
    else if (!imagemBase64 && /(quantos pedidos|meus pedidos|pedidos (de )?hoje|pedidos abertos|pedidos em aberto)/i.test(mensagem)) {
      try {
        const [ab] = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "Order" WHERE "workspaceId" = ${workspaceId} AND "status" = 'ABERTO'` as any[]
        const [prod] = await prisma.$queryRaw`SELECT COUNT(*)::int AS n FROM "Order" WHERE "workspaceId" = ${workspaceId} AND "status" ILIKE 'em%produ%'` as any[]
        resposta = `Agora você tem **${Number(ab?.n) || 0} pedido(s) em aberto** e **${Number(prod?.n) || 0} em produção**. Quer que eu te leve pra lista? É em Produção → Pedidos 😊`
      } catch {
        resposta = 'Consegui não puxar esse número agora. Dá uma olhada em Produção → Pedidos que lá aparece tudo certinho.'
      }
    }
    // ── USO / DÚVIDA / PRINT (IA + recuperação da base) ──
    else {
      usouIA = true
      let contexto = ''
      try { contexto = montarContextoConhecimento(await recuperarConhecimento(mensagem || 'ajuda com o que aparece na tela', 6)) } catch {}
      const lgpd = imagemBase64 ? '\n\nA usuária enviou um print da tela. Descreva só o que for útil pra ajudar; NUNCA repita dados pessoais que aparecerem (nomes de clientes, telefone, e-mail, CPF, endereço). Oriente o próximo passo.' : ''
      const sys = `${SOFIA_TOM}${lgpd}${contexto}`
      const r = await chamarGemini(sys, historico, mensagem || 'Me ajuda com o que está aparecendo neste print, por favor.', imagemBase64)
      resposta = r ?? 'Deu um probleminha aqui pra pensar 😅 Tenta de novo? Se persistir, abre um chamado no Suporte que a equipe te ajuda.'
      tourId = !imagemBase64 ? tourSugerido(mensagem) : null
    }

    // Conta o uso só quando bateu no modelo
    if (usouIA) {
      try {
        if (logExiste) await prisma.$executeRaw`UPDATE "AiUsageLog" SET "calls" = "calls" + 1 WHERE "workspaceId" = ${workspaceId} AND "data"::text = ${hoje}`
        else await prisma.$executeRaw`INSERT INTO "AiUsageLog" ("id","userId","workspaceId","data","calls") VALUES (${Math.random().toString(36).slice(2) + Date.now().toString(36)}, ${session.user.id}, ${workspaceId}, ${hoje}::date, 1)`
      } catch {}
    }

    return NextResponse.json({ resposta, tourId })
  } catch (err: any) {
    console.error('[SOFIA CHAT]', err?.message ?? err)
    return NextResponse.json({ error: 'Deu um probleminha aqui 😅 Tenta de novo em instantes.' }, { status: 500 })
  }
}
