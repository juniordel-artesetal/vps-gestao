import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY    = process.env.ANTHROPIC_API_KEY_GESTAO!
const TELEGRAM_TOKEN    = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API      = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`

// System prompt de suporte (mesmo da página web)
const SYSTEM_PROMPT = `Você é a assistente de suporte do VPS Gestão — um sistema ERP para artesãs e pequenos ateliês.

Seu papel é ajudar as usuárias a operarem o sistema passo a passo, com linguagem simples e acolhedora. Você está respondendo via Telegram.

MÓDULOS DO SISTEMA:
- Dashboard Geral: visão consolidada de KPIs de produção, financeiro e precificação
- Produção: pedidos, setores configuráveis, visão de andamento, campos personalizados
- Precificação: materiais, embalagens, produtos, variações, combos, canais de venda, calculadora, oráculo contábil
- Financeiro: lançamentos de receitas/despesas, recorrência, parcelamento, fluxo de caixa, metas, categorias
- Análise de Gestão: chat com IA usando dados reais do negócio
- Configurações: setores, campos de pedido, usuários e perfis, tema de cor

CANAIS DE VENDA: Shopee, Mercado Livre, Elo7, TikTok Shop, Amazon, Magalu e Venda Direta.

REGRAS:
1. Seja sempre gentil, paciente e acolhedora
2. Use linguagem simples — a usuária pode não ter familiaridade com tecnologia
3. Liste etapas numeradas quando for um processo
4. Informe o caminho exato (ex: "Vá em Precificação → Materiais")
5. Se não souber a resposta com certeza, oriente a acessar a Central de Suporte em: vps-gestao.natycostapro.com.br/suporte
6. Nunca invente funcionalidades
7. Respostas curtas — máximo 150 palavras (Telegram prefere mensagens concisas)
8. Use emojis com moderação para deixar a conversa mais amigável`

async function enviarMensagem(chatId: number, texto: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: texto,
      parse_mode: 'HTML',
    }),
  })
}

async function enviarTyping(chatId: number) {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json()

    // Ignorar se não for mensagem de texto
    const message = update?.message
    if (!message?.text) return NextResponse.json({ ok: true })

    const chatId = message.chat.id
    const texto  = message.text.trim()
    const nome   = message.from?.first_name ?? 'Usuária'

    // Resposta para /start
    if (texto === '/start') {
      await enviarMensagem(chatId,
        `Olá, ${nome}! 👋 Sou a assistente do <b>VPS Gestão</b>.\n\n` +
        `Pode me perguntar qualquer coisa sobre o sistema — estou aqui para te ajudar passo a passo! 🧡\n\n` +
        `Ex: <i>Como crio um novo pedido?</i>`
      )
      return NextResponse.json({ ok: true })
    }

    // Resposta para /ajuda
    if (texto === '/ajuda' || texto === '/help') {
      await enviarMensagem(chatId,
        `Posso te ajudar com:\n\n` +
        `📦 <b>Produção</b> — pedidos, setores\n` +
        `💰 <b>Precificação</b> — materiais, produtos, preços\n` +
        `💳 <b>Financeiro</b> — lançamentos, metas\n` +
        `🤖 <b>IA de Gestão</b> — como usar\n` +
        `⚙️ <b>Configurações</b> — usuários, setores\n\n` +
        `Só me perguntar! 😊`
      )
      return NextResponse.json({ ok: true })
    }

    // Mostrar "digitando..." enquanto chama a IA
    await enviarTyping(chatId)

    // Chamar Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: texto }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
        }),
      }
    )

    if (!geminiRes.ok) {
      await enviarMensagem(chatId,
        `Ops! Tive um problema ao processar sua dúvida. 😕\n\n` +
        `Tente novamente ou acesse a Central de Suporte:\n` +
        `👉 vps-gestao.natycostapro.com.br/suporte`
      )
      return NextResponse.json({ ok: true })
    }

    const geminiData = await geminiRes.json()
    const resposta   = geminiData.candidates?.[0]?.content?.parts?.[0]?.text

    if (resposta) {
      // Limpar markdown pesado que não funciona bem no Telegram
      const respostaLimpa = resposta
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')  // **bold** → <b>bold</b>
        .replace(/\*(.*?)\*/g, '<i>$1</i>')       // *italic* → <i>italic</i>
        .replace(/#{1,3}\s/g, '')                  // remover ### headers
        .trim()

      await enviarMensagem(chatId, respostaLimpa)
    } else {
      await enviarMensagem(chatId,
        `Não consegui gerar uma resposta. 😕\n\n` +
        `Tente reformular sua pergunta ou acesse:\n` +
        `👉 vps-gestao.natycostapro.com.br/suporte`
      )
    }

    return NextResponse.json({ ok: true })

  } catch (err: any) {
    console.error('[TELEGRAM BOT] Erro:', err?.message ?? err)
    return NextResponse.json({ ok: true }) // Retorna 200 para o Telegram não reenviar
  }
}
