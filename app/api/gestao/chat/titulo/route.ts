// app/api/gestao/chat/titulo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ titulo: 'Nova conversa' })

  const { mensagem } = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY_GESTAO
  if (!apiKey) return NextResponse.json({ titulo: mensagem?.slice(0, 40) || 'Nova conversa' })

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `Crie um título curto (máximo 5 palavras, sem aspas, sem pontuação final) para uma análise financeira que começou com: "${mensagem?.slice(0, 150)}"` }]
          }],
          generationConfig: { maxOutputTokens: 15, temperature: 0.3 },
        }),
      }
    )
    const data = await res.json()
    const titulo = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Análise financeira'
    return NextResponse.json({ titulo })
  } catch {
    return NextResponse.json({ titulo: mensagem?.slice(0, 40) || 'Nova conversa' })
  }
}
