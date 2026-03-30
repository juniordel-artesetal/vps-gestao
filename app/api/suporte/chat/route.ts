import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const GEMINI_API_KEY = process.env.ANTHROPIC_API_KEY_GESTAO!
const LIMITE_DIARIO  = 150

// ── GET — retorna uso do dia
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const hoje = new Date().toISOString().slice(0, 10)
    const logs = await prisma.$queryRaw`
      SELECT calls FROM "AiUsageLog"
      WHERE "workspaceId" = ${session.user.workspaceId}
        AND "data"::text = ${hoje}
      LIMIT 1
    ` as any[]

    return NextResponse.json({ usados: Number(logs[0]?.calls ?? 0), limite: LIMITE_DIARIO })
  } catch {
    return NextResponse.json({ usados: 0, limite: LIMITE_DIARIO })
  }
}

// ── POST — envia mensagem para IA de suporte
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const workspaceId = session.user.workspaceId
    const hoje        = new Date().toISOString().slice(0, 10)

    // Verificar limite diário
    let calls = 0
    let logExiste = false
    try {
      const logs = await prisma.$queryRaw`
        SELECT id, calls FROM "AiUsageLog"
        WHERE "workspaceId" = ${workspaceId}
          AND "data"::text = ${hoje}
        LIMIT 1
      ` as any[]
      calls     = Number(logs[0]?.calls ?? 0)
      logExiste = logs.length > 0
    } catch {
      // AiUsageLog pode não existir — continua sem limite
    }

    if (calls >= LIMITE_DIARIO) {
      return NextResponse.json(
        { error: 'Limite diário de análises atingido. Tente novamente amanhã.' },
        { status: 429 }
      )
    }

    const { mensagem, historico = [] } = await req.json()
    if (!mensagem?.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })
    }

    // Buscar FAQs relevantes (opcional — não quebra se tabela não existir)
    let contextoFaq = ''
    try {
      const termo = mensagem.slice(0, 60)
      const faqs  = await prisma.$queryRaw`
        SELECT categoria, pergunta, resposta
        FROM "SuporteFaq"
        WHERE "ativo" = true
          AND (
            LOWER("pergunta") LIKE LOWER(${`%${termo}%`})
            OR LOWER("resposta") LIKE LOWER(${`%${termo}%`})
          )
        LIMIT 5
      ` as any[]

      if (faqs.length > 0) {
        contextoFaq = '\n\nFAQs relevantes:\n' +
          faqs.map((f: any) => `P: ${f.pergunta}\nR: ${f.resposta}`).join('\n\n')
      }
    } catch {
      // Tabela SuporteFaq ainda não existe — ignora e continua
    }

    // System prompt de suporte
    const systemPrompt = `Você é a assistente de suporte do VPS Gestão — um sistema ERP para artesãs e pequenos ateliês.

Seu papel é ajudar as usuárias a operarem o sistema passo a passo, com linguagem simples e acolhedora.

MÓDULOS DO SISTEMA:
- Dashboard Geral: visão consolidada de KPIs de produção, financeiro e precificação
- Produção: pedidos, setores configuráveis, visão de andamento, campos personalizados
- Precificação: materiais, embalagens, produtos, variações, combos, canais de venda, calculadora, oráculo contábil
- Financeiro: lançamentos de receitas/despesas, recorrência, parcelamento, fluxo de caixa, metas, categorias
- Análise de Gestão: chat com IA usando dados reais do negócio (limite 150/dia)
- Configurações: setores, campos de pedido, usuários e perfis, tema de cor

CANAIS DE VENDA: Shopee, Mercado Livre, Elo7, TikTok Shop, Amazon, Magalu e Venda Direta.

REGRAS:
1. Seja sempre gentil, paciente e acolhedora
2. Use linguagem simples — a usuária pode não ter familiaridade com tecnologia
3. Liste etapas numeradas quando for um processo
4. Informe o caminho exato (ex: "Vá em Precificação → Materiais")
5. Se não souber com certeza, sugira abrir um chamado
6. Nunca invente funcionalidades que não existem
7. Respostas objetivas — máximo 200 palavras${contextoFaq}`

    // Montar histórico para Gemini
    const messages = [
      ...historico.slice(-6).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: mensagem }] },
    ]

    // Chamar Gemini 2.5 Flash
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages,
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text()
      console.error('[SUPORTE CHAT] Gemini erro:', geminiRes.status, errBody)
      return NextResponse.json({ error: 'Erro ao consultar IA. Tente novamente.' }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const resposta   = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
      ?? 'Não consegui gerar uma resposta. Tente novamente ou abra um chamado.'

    // Atualizar contador de uso (silencioso — não quebra o fluxo)
    try {
      if (logExiste) {
        await prisma.$executeRaw`
          UPDATE "AiUsageLog" SET "calls" = "calls" + 1
          WHERE "workspaceId" = ${workspaceId} AND "data"::text = ${hoje}
        `
      } else {
        const logId = Math.random().toString(36).slice(2) + Date.now().toString(36)
        await prisma.$executeRaw`
          INSERT INTO "AiUsageLog" ("id","userId","workspaceId","data","calls")
          VALUES (${logId}, ${session.user.id}, ${workspaceId}, ${hoje}::date, 1)
        `
      }
    } catch {
      // Ignora erro de log — não bloqueia a resposta
    }

    return NextResponse.json({ resposta, usados: calls + 1, limite: LIMITE_DIARIO })

  } catch (err: any) {
    console.error('[SUPORTE CHAT] Erro geral:', err?.message ?? err)
    return NextResponse.json(
      { error: 'Erro interno. Tente novamente.' },
      { status: 500 }
    )
  }
}
