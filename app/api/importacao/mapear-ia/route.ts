// app/api/importacao/mapear-ia/route.ts — mapeamento de colunas por IA (Gemini) — VPS-20260630-NQA8
// A IA SÓ SUGERE o de-para (coluna da planilha -> campo do sistema). Só uma amostra
// é enviada. Falha/indisponibilidade -> retorna {} (o modal cai no mapeamento manual).
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CAMPOS_IMPORT } from '@/lib/mapeamentoImport'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (session.user.role === 'OPERADOR') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { entidade, headers, amostra } = await req.json()
  const campos = CAMPOS_IMPORT[entidade as keyof typeof CAMPOS_IMPORT]
  if (!campos) return NextResponse.json({ error: 'Entidade inválida' }, { status: 400 })
  const cols: string[] = Array.isArray(headers) ? headers.filter((h: any) => typeof h === 'string') : []
  if (cols.length === 0) return NextResponse.json({ mapeamento: {} })

  const apiKey = process.env.ANTHROPIC_API_KEY_GESTAO
  if (!apiKey) return NextResponse.json({ mapeamento: {} }) // sem IA -> manual

  const amostraLimit = (Array.isArray(amostra) ? amostra : []).slice(0, 15)
  const prompt = `Você mapeia colunas de uma planilha para os campos de um sistema.
CAMPOS DO SISTEMA (destino):
${campos.map(c => `- "${c.campo}"${c.obrig ? ' (obrigatório)' : ''}: ${c.desc}`).join('\n')}

COLUNAS DA PLANILHA (origem):
${JSON.stringify(cols)}

AMOSTRA (primeiras linhas):
${JSON.stringify(amostraLimit).slice(0, 4000)}

Responda APENAS um JSON: para cada CAMPO DO SISTEMA, o nome EXATO da coluna da planilha que melhor corresponde, ou null se nenhuma servir. Use somente nomes de coluna que existem na lista de origem. Formato: {"NomeDoCampo": "NomeDaColuna" | null, ...}`

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 800 },
        }),
      }
    )
    if (!resp.ok) { console.error('mapear-ia gemini:', await resp.text()); return NextResponse.json({ mapeamento: {} }) }
    const data = await resp.json()
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    let bruto: Record<string, any> = {}
    try { bruto = JSON.parse(txt) } catch { bruto = {} }
    // Validação: só aceita mapeamentos para campos válidos e colunas existentes
    const mapeamento: Record<string, string> = {}
    for (const c of campos) {
      const v = bruto[c.campo]
      if (typeof v === 'string' && cols.includes(v)) mapeamento[c.campo] = v
    }
    return NextResponse.json({ mapeamento })
  } catch (e) {
    console.error('[mapear-ia]', e)
    return NextResponse.json({ mapeamento: {} })
  }
}
