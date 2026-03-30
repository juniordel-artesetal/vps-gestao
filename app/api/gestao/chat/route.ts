// app/api/gestao/chat/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const LIMITE_DIARIO = 150

function calcularTaxaCanal(canal: string, subOpcao: string, preco: number): { taxaPct: number; taxaFixa: number } {
  switch (canal) {
    case 'shopee':
    case 'shopee_ate79': {
      const pct = preco <= 79.99 ? 20 : 14
      const fixa = preco <= 79.99 ? 4 : preco <= 99.99 ? 16 : preco <= 199.99 ? 20 : 26
      return { taxaPct: pct, taxaFixa: fixa }
    }
    case 'mercado_livre':
      return subOpcao === 'premium' ? { taxaPct: 17, taxaFixa: preco < 79 ? 6 : 0 } : { taxaPct: 12, taxaFixa: preco < 79 ? 6 : 0 }
    case 'amazon':       return { taxaPct: 12, taxaFixa: 2 }
    case 'tiktok':
    case 'tiktok_shop':  return { taxaPct: 6, taxaFixa: preco < 79 ? 2 : 0 }
    case 'elo7':
      return subOpcao === 'maxima' ? { taxaPct: 20, taxaFixa: 3.99 } : { taxaPct: 18, taxaFixa: 3.99 }
    case 'magalu':       return { taxaPct: 10, taxaFixa: 0 }
    case 'direta':
    case 'venda_direta': return { taxaPct: 3, taxaFixa: 0 }
    default:             return { taxaPct: 20, taxaFixa: 4 }
  }
}

function fmtR(n: number) {
  return 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const workspaceId = session.user.workspaceId
  const userId = session.user.id || session.user.email || 'admin'
  const body = await req.json()
  const { contexto, mensagem, historico = [], ano, mes } = body

  // ── Verificar limite diário
  const hoje = new Date().toISOString().split('T')[0]
  let usageRow: any = null
  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT * FROM "AiUsageLog" WHERE "userId"=${userId} AND data=${hoje}::date LIMIT 1
    `
    usageRow = rows[0] || null
  } catch { /* tabela pode não existir */ }

  if (usageRow && usageRow.calls >= LIMITE_DIARIO) {
    return NextResponse.json({
      error: `Limite diário de ${LIMITE_DIARIO} análises atingido. Tente novamente amanhã.`,
      limitAtingido: true,
    }, { status: 429 })
  }

  // ── Cache para primeira mensagem
  const cacheKey = `${ano}-${mes}`
  if (usageRow?.cacheKey === cacheKey && usageRow?.cacheDate === hoje && historico.length === 0) {
    try {
      const cached = JSON.parse(usageRow.cacheResult || '{}')
      if (cached.content) return NextResponse.json({ ...cached, fromCache: true })
    } catch { /* cache inválido */ }
  }

  // ── Preparar dados do contexto
  const fin     = contexto?.financeiro || {}
  const finAnt  = contexto?.mesAnterior || {}
  const periodo = `${MESES[(mes || 1) - 1]} ${ano}`
  const nomeNegocio = contexto?.workspace?.nome || 'Negócio'
  const segmento    = contexto?.workspace?.segmento || 'artesanato'
  const colaboradores = contexto?.workspace?.colaboradores || 'não informado'

  // Calcular comparativo com mês anterior
  const varReceita = finAnt.totalReceita > 0
    ? ((fin.totalReceita - finAnt.totalReceita) / finAnt.totalReceita * 100).toFixed(1)
    : null
  const varDespesa = finAnt.totalDespesa > 0
    ? ((fin.totalDespesa - finAnt.totalDespesa) / finAnt.totalDespesa * 100).toFixed(1)
    : null
  const varResultado = finAnt.resultado !== 0
    ? ((fin.resultado - finAnt.resultado) / Math.abs(finAnt.resultado) * 100).toFixed(1)
    : null

  // Calcular ponto de equilíbrio real
  const totalFixos = (contexto?.despesasCat || [])
    .reduce((s: number, d: any) => s + (d.total || 0), 0)
  const margemContribuicaoMedia = fin.totalReceita > 0
    ? ((fin.totalReceita - fin.totalDespesa) / fin.totalReceita * 100).toFixed(1)
    : 0
  const pontoEquilibrio = fin.margem > 0
    ? (totalFixos / (fin.margem / 100)).toFixed(2)
    : null

  // Produtos com análise completa de margem
  const produtosComTaxa = (contexto?.produtos || []).map((p: any) => {
    const { taxaPct, taxaFixa } = calcularTaxaCanal(p.canal, p.subOpcao, p.precoVenda || 0)
    const taxaTotal   = ((p.precoVenda || 0) * taxaPct / 100) + taxaFixa
    const impostosVal = (p.precoVenda || 0) * ((p.impostos || 0) / 100)
    const lucroLiq    = (p.precoVenda || 0) - (p.custoTotal || 0) - taxaTotal - impostosVal
    const margemLiq   = p.precoVenda > 0 ? (lucroLiq / p.precoVenda * 100) : 0
    const status      = margemLiq >= 25 ? '🟢' : margemLiq >= 15 ? '🟡' : '🔴'
    return { ...p, taxaPct, taxaFixa, taxaTotal, lucroLiq, margemLiq, status }
  })

  // ── System Prompt inteligente e consultivo
  const systemPrompt = `Você é uma consultora financeira especialista em negócios de artesanato, ateliês e marketplaces brasileiros (Shopee, Mercado Livre, Elo7, TikTok Shop, Amazon, Magalu).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE DO NEGÓCIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Nome: ${nomeNegocio}
• Segmento: ${segmento}
• Colaboradores: ${colaboradores}
• Regime tributário: ${contexto?.tributo?.regime || 'MEI'} (alíquota ${contexto?.tributo?.aliquotaPadrao || 0}% sobre faturamento)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DADOS FINANCEIROS — ${periodo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REALIZADO NO MÊS:
• Receita: ${fmtR(fin.totalReceita)} ${varReceita ? `(${Number(varReceita) >= 0 ? '+' : ''}${varReceita}% vs mês anterior)` : ''}
• Despesa: ${fmtR(fin.totalDespesa)} ${varDespesa ? `(${Number(varDespesa) >= 0 ? '+' : ''}${varDespesa}% vs mês anterior)` : ''}
• Resultado líquido: ${fmtR(fin.resultado)} ${varResultado ? `(${Number(varResultado) >= 0 ? '+' : ''}${varResultado}% vs mês anterior)` : ''}
• Margem líquida: ${fin.margem || 0}%
• Pedidos realizados: ${fin.qtdPedidos || 0}
• Ticket médio: ${fmtR(fin.ticketMedio || 0)}

PENDÊNCIAS:
• A receber: ${fmtR(fin.aReceber || 0)}
• A pagar: ${fmtR(fin.aPagar || 0)}

MÊS ANTERIOR (${finAnt.totalReceita !== undefined ? MESES[(mes - 2 + 12) % 12] : 'sem dados'}):
• Receita: ${fmtR(finAnt.totalReceita || 0)}
• Despesa: ${fmtR(finAnt.totalDespesa || 0)}
• Resultado: ${fmtR(finAnt.resultado || 0)}

${contexto?.meta ? `METAS DO MÊS:
• Meta receita: ${fmtR(contexto.meta.metaReceita || 0)} → ${fin.totalReceita > 0 && contexto.meta.metaReceita > 0 ? ((fin.totalReceita / contexto.meta.metaReceita) * 100).toFixed(0) + '% atingido' : 'sem dados'}
• Meta despesa: ${fmtR(contexto.meta.metaDespesa || 0)}
• Meta lucro: ${fmtR(contexto.meta.metaLucro || 0)} → ${fin.resultado > 0 && contexto.meta.metaLucro > 0 ? ((fin.resultado / contexto.meta.metaLucro) * 100).toFixed(0) + '% atingido' : 'sem dados'}` : 'Sem metas definidas para este mês.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANÁLISE DE CUSTOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESPESAS POR CATEGORIA:
${(contexto?.despesasCat || []).map((d: any) => {
  const pct = fin.totalDespesa > 0 ? ((d.total / fin.totalDespesa) * 100).toFixed(1) : '0'
  return `• ${d.categoria || 'Sem categoria'}: ${fmtR(d.total)} (${pct}% das despesas)`
}).join('\n') || '• Nenhuma despesa categorizada'}

PONTO DE EQUILÍBRIO ESTIMADO: ${pontoEquilibrio ? fmtR(Number(pontoEquilibrio)) + '/mês' : 'Insuficiente para calcular'}
${pontoEquilibrio && fin.totalReceita > 0 ? `→ ${fin.totalReceita >= Number(pontoEquilibrio) ? '✅ Acima do ponto de equilíbrio' : '⚠️ Abaixo do ponto de equilíbrio — negócio operando no prejuízo'}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUTOS E MARGENS (Top ${produtosComTaxa.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${produtosComTaxa.length > 0 ? produtosComTaxa.map((p: any) =>
  `${p.status} ${p.produto}
   Canal: ${p.canal} | Preço: ${fmtR(p.precoVenda)} | Custo: ${fmtR(p.custoTotal)}
   Taxa canal: ${p.taxaPct}% + ${fmtR(p.taxaFixa)} | Impostos: ${p.impostos}%
   Lucro líquido: ${fmtR(p.lucroLiq)} | Margem: ${p.margemLiq.toFixed(1)}%`
).join('\n\n') : 'Nenhum produto com preço cadastrado'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TENDÊNCIA (últimos meses)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${(contexto?.tendencia || []).map((t: any) =>
  `• ${MESES[t.mes-1]}/${t.ano}: Receita ${fmtR(t.receita)} | Despesa ${fmtR(t.despesa)} | Resultado ${fmtR(t.receita - t.despesa)}`
).join('\n') || '• Sem histórico disponível'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMO VOCÊ DEVE RESPONDER:
1. SEMPRE use os números reais acima — nunca invente valores, nunca peça dados que já existem aqui
2. Tom CONSULTIVO: explique o PORQUÊ de cada número, não apenas o QUE
3. Compare com mês anterior quando relevante e explique a variação
4. Calcule ponto de equilíbrio, margem de contribuição e projeções usando os dados reais
5. Diagnóstico automático: 🟢 margem ≥ 25% | 🟡 15–24% | 🔴 < 15%
6. Se os números forem ruins, seja honesta mas construtiva — aponte o problema e sugira ação específica
7. Use formatação clara: ### para títulos de seção, **negrito** para valores importantes, - para listas
8. Finalize com 1–2 ações práticas e prioritárias para o mês
9. Linguagem simples — a cliente é empreendedora, não contadora
10. Nunca recomende abandonar canais atuais sem dados concretos que justifiquem`

  const messages = [...historico, { role: 'user', content: mensagem }]

  const apiKey = process.env.ANTHROPIC_API_KEY_GESTAO
  if (!apiKey) return NextResponse.json({ error: 'Chave da IA não configurada no servidor.' }, { status: 500 })

  const geminiMessages = messages.map((m: any) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: geminiMessages,
        generationConfig: { maxOutputTokens: 2000, temperature: 0.4 },
      }),
    }
  )

  if (!response.ok) {
    console.error('Gemini error:', await response.text())
    return NextResponse.json({ error: 'Erro ao chamar a IA. Tente novamente.' }, { status: 500 })
  }

  const data = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Não foi possível gerar a análise.'
  const result = { content, historico: [...messages, { role: 'assistant', content }] }

  // ── Salvar uso
  try {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const novoCalls = (usageRow?.calls || 0) + 1
    const cacheResult = historico.length === 0 ? JSON.stringify(result) : (usageRow?.cacheResult || null)
    if (usageRow) {
      await prisma.$executeRaw`
        UPDATE "AiUsageLog" SET calls=${novoCalls}, "cacheKey"=${cacheKey}, "cacheResult"=${cacheResult}, "cacheDate"=${hoje}::date
        WHERE "userId"=${userId} AND data=${hoje}::date
      `
    } else {
      await prisma.$executeRaw`
        INSERT INTO "AiUsageLog"("id","userId","workspaceId","data","calls","cacheKey","cacheResult","cacheDate")
        VALUES(${id},${userId},${workspaceId},${hoje}::date,1,${cacheKey},${cacheResult},${hoje}::date)
      `
    }
  } catch (e) { console.error('Usage log error:', e) }

  return NextResponse.json(result)
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const userId = session.user.id || session.user.email || 'admin'
  const hoje   = new Date().toISOString().split('T')[0]

  try {
    const rows: any[] = await prisma.$queryRaw`
      SELECT calls FROM "AiUsageLog" WHERE "userId"=${userId} AND data=${hoje}::date LIMIT 1
    `
    return NextResponse.json({ calls: rows[0]?.calls || 0, limite: LIMITE_DIARIO })
  } catch {
    return NextResponse.json({ calls: 0, limite: LIMITE_DIARIO })
  }
}
