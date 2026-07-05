import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularIndice, upsertSnapshot, avaliarAlertasParaNorm } from '@/lib/indicePrecos'
import { normNome } from '@/lib/normNome'

export const dynamic = 'force-dynamic'

function serialize(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (obj instanceof Date) return obj.toISOString()
  if (obj && typeof obj.toNumber === 'function') return obj.toNumber()
  if (Array.isArray(obj)) return obj.map(serialize)
  if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, serialize(v)]))
  return obj
}
function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
const CAP_DIARIO = 40

async function sintetizarIA(idx: any, tendencia: string | null): Promise<{ resumo: string; dica: string } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY_GESTAO
  if (!apiKey) return null
  const sys = `Você ajuda uma artesã a interpretar o preço de mercado de um material. Receberá ESTATÍSTICAS já calculadas (não invente números fora delas). Responda em JSON {"resumo": "...", "dica": "..."} em português do Brasil, tom simples e acolhedor. "resumo": 1 frase sobre a faixa de preço. "dica": 1 frase curta se é bom momento de comprar, com base na tendência informada (não afirme tendência se ela for "sem histórico").`
  const dados = `Material: ${idx.termo}. Menor: ${brl(idx.menor)}. Médio: ${brl(idx.medio)}. Faixa sugerida: ${brl(idx.faixaMin)}–${brl(idx.faixaMax)} por ${idx.unidade || 'unidade'}. Fontes: ${idx.nFontes}. Confiabilidade: ${idx.confiabilidade}. Tendência: ${tendencia || 'sem histórico suficiente'}.`
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: dados }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.4, responseMimeType: 'application/json' },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const j = JSON.parse(txt)
    if (j && typeof j.resumo === 'string') return { resumo: j.resumo, dica: String(j.dica || '') }
  } catch { }
  return null
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Módulo gated
  const [ws] = await prisma.$queryRaw`SELECT "moduloAssistenteCompras" FROM "Workspace" WHERE "id"=${session.user.workspaceId} LIMIT 1` as any[]
  if (!ws?.moduloAssistenteCompras) return NextResponse.json({ error: 'Módulo não ativado' }, { status: 403 })

  const { query } = await req.json()
  if (!query?.trim()) return NextResponse.json({ error: 'Informe o material' }, { status: 400 })

  const idx = await calcularIndice(String(query))
  if (!idx.suficiente) {
    return NextResponse.json({ suficiente: false, motivo: idx.motivo, nFontes: idx.nFontes || 0, termo: String(query).trim() })
  }

  const qn = idx.normNome
  const hoje = new Date().toISOString().split('T')[0]

  // Snapshot do dia (constrói histórico próprio) + avalia alertas oportunisticamente
  await upsertSnapshot(qn, idx.medio, idx.menor, idx.nFontes)
  try { await avaliarAlertasParaNorm(qn) } catch { }
  // Evolução (últimos 30 dias) — só honesta, a partir dos snapshots
  const snaps = await prisma.$queryRaw`
    SELECT TO_CHAR("data",'YYYY-MM-DD') AS "data", "precoMedio"::float AS "precoMedio"
    FROM "PrecoIndiceSnapshot" WHERE "normNome"=${qn} AND "data" >= CURRENT_DATE - 30 ORDER BY "data" ASC
  ` as any[]
  const evolucao = snaps.map((s: any) => ({ data: s.data, precoMedio: Number(s.precoMedio) }))
  let tendencia: string | null = null
  if (evolucao.length >= 2) {
    const ini = evolucao[0].precoMedio, fim = evolucao[evolucao.length - 1].precoMedio
    tendencia = fim > ini * 1.03 ? 'subindo' : fim < ini * 0.97 ? 'caindo' : 'estavel'
  }

  // IA com cap diário (o índice em si é grátis; só a síntese consome IA)
  const userId = session.user.id
  let ia: { resumo: string; dica: string } | null = null
  try {
    const [uso] = await prisma.$queryRaw`SELECT "calls" FROM "AiUsageLog" WHERE "userId"=${userId} AND "data"=${hoje}::date LIMIT 1` as any[]
    const calls = Number(uso?.calls || 0)
    if (calls < CAP_DIARIO) {
      ia = await sintetizarIA(idx, tendencia)
      if (ia) {
        if (uso) await prisma.$executeRaw`UPDATE "AiUsageLog" SET "calls"=${calls + 1} WHERE "userId"=${userId} AND "data"=${hoje}::date`
        else await prisma.$executeRaw`INSERT INTO "AiUsageLog" ("id","userId","workspaceId","data","calls") VALUES (${novoId()}, ${userId}, ${session.user.workspaceId}, ${hoje}::date, 1)`
      }
    }
  } catch { }
  if (!ia) {
    // Fallback honesto (sem IA)
    ia = {
      resumo: `A maioria paga entre ${brl(idx.faixaMin)} e ${brl(idx.faixaMax)} por ${idx.unidade || 'unidade'}.`,
      dica: tendencia === 'caindo' ? 'O preço médio vem caindo — pode ser um bom momento.' : tendencia === 'subindo' ? 'O preço médio vem subindo ultimamente.' : '',
    }
  }

  // Patrocinados (casados por palavra-chave) — conta impressão
  let patrocinados: any[] = []
  try {
    const todos = await prisma.$queryRaw`
      SELECT "id","nome","link","precoExibido","palavrasChave" FROM "PesquisaPatrocinado" WHERE "ativo"=true ORDER BY "prioridade" DESC, "createdAt" DESC LIMIT 30
    ` as any[]
    const casa = todos.filter((p: any) => {
      const kws = String(p.palavrasChave || '').split(/[,;\n]+/).map((k: string) => normNome(k)).filter(Boolean)
      return kws.length === 0 ? false : kws.some((k: string) => qn.includes(k) || k.includes(qn))
    }).slice(0, 3)
    for (const p of casa) await prisma.$executeRaw`UPDATE "PesquisaPatrocinado" SET "impressoes"="impressoes"+1 WHERE "id"=${p.id}`
    patrocinados = casa.map((p: any) => ({ id: p.id, nome: p.nome, link: p.link, precoExibido: p.precoExibido }))
  } catch { }

  return NextResponse.json(serialize({
    suficiente: true,
    termo: idx.termo,
    unidade: idx.unidade,
    menor: idx.menor,
    medio: idx.medio,
    faixaMin: idx.faixaMin,
    faixaMax: idx.faixaMax,
    nFontes: idx.nFontes,
    nAmostras: idx.nAmostras,
    confiabilidade: idx.confiabilidade,
    tendencia,
    evolucao,
    ia,
    ondeComprar: idx.ondeComprar,
    patrocinados,
  }))
}
