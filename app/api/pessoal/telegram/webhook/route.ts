// Webhook do bot dedicado do PESSOAL. Chamada externa: auth = secret token do Telegram
// (header x-telegram-bot-api-secret-token). Sempre responde 200 (o Telegram reenvia em não-2xx).
// Segurança: só chat VINCULADO + assinatura ATIVA; cada chat mexe SÓ na própria conta.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from '@/lib/pessoal/schema'
import { assinaturaAtiva } from '@/lib/pessoal/assinatura'
import { webhookSecret, enviarMensagem, parseLancamentoIA } from '@/lib/pessoal/telegram'

export const dynamic = 'force-dynamic'
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function hojeISO() { return new Date().toISOString().slice(0, 10) }

export async function POST(req: NextRequest) {
  // 1) Auth — secret do Telegram. Fail closed.
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const up = await req.json().catch(() => null) as any
  const msg = up?.message
  const chatId = msg?.chat?.id
  const texto = (msg?.text || '').trim()
  if (!chatId || !texto) return NextResponse.json({ ok: true })

  try {
    await ensurePessoalTables()

    // 2) /start <CÓDIGO> → vincula (não exige estar vinculado ainda).
    if (texto.startsWith('/start')) {
      const codigo = texto.split(/\s+/)[1]?.toUpperCase()
      if (!codigo) { await enviarMensagem(chatId, 'Oi! 👋 Para conectar, gere o código no SOA em <b>Pessoal → Conectar meu Telegram</b> e toque no link.'); return NextResponse.json({ ok: true }) }
      const [link] = await prisma.$queryRaw`
        SELECT "id","userId" FROM "PessoalTelegramLink"
        WHERE "codigo" = ${codigo} AND "expiraEm" > NOW() LIMIT 1
      ` as any[]
      if (!link) { await enviarMensagem(chatId, '❌ Código inválido ou expirado. Gere um novo no SOA.'); return NextResponse.json({ ok: true }) }
      // Consome o código, grava o chat, ativa. Um chat por conta.
      await prisma.$executeRaw`
        UPDATE "PessoalTelegramLink"
        SET "telegramChatId" = ${String(chatId)}, "telegramUsername" = ${msg?.from?.username ?? null},
            "status" = 'ATIVO', "ativo" = true, "codigo" = NULL, "expiraEm" = NULL, "vinculadoEm" = NOW()
        WHERE "id" = ${link.id}
      `
      await enviarMensagem(chatId, '✅ <b>Telegram vinculado!</b>\nAgora é só mandar seus gastos: <i>"gastei 20 no mercado no pix"</i>.\nComandos: /saldo /hoje /ajuda /desvincular')
      return NextResponse.json({ ok: true })
    }

    // 3) Demais mensagens — exigem vínculo ATIVO.
    const [link] = await prisma.$queryRaw`
      SELECT "id","userId" FROM "PessoalTelegramLink"
      WHERE "telegramChatId" = ${String(chatId)} AND "status" = 'ATIVO' LIMIT 1
    ` as { id: string; userId: string }[]
    if (!link) { await enviarMensagem(chatId, 'Este chat não está conectado. Gere o código no SOA em <b>Pessoal → Conectar meu Telegram</b>.'); return NextResponse.json({ ok: true }) }
    const userId = link.userId

    // Assinatura ATIVA (mesma regra do gate).
    if (!(await assinaturaAtiva(userId))) { await enviarMensagem(chatId, '⚠️ Sua assinatura do Pessoal está inativa. Regularize no SOA para continuar.'); return NextResponse.json({ ok: true }) }

    // Comandos
    const cmd = texto.toLowerCase()
    if (cmd === '/ajuda' || cmd === '/help') {
      await enviarMensagem(chatId, '📖 <b>Como usar</b>\n• Mande um gasto/receita em texto: <i>"paguei 89,90 de luz"</i>, <i>"recebi 1500 salário"</i>.\n• /saldo — resumo do mês\n• /hoje — lançamentos de hoje\n• /desvincular — desconectar este chat')
      return NextResponse.json({ ok: true })
    }
    if (cmd === '/desvincular') {
      await prisma.$executeRaw`DELETE FROM "PessoalTelegramLink" WHERE "id" = ${link.id}`
      await enviarMensagem(chatId, '🔌 Desvinculado. Quando quiser, reconecte pelo SOA.')
      return NextResponse.json({ ok: true })
    }
    if (cmd === '/saldo') {
      const [r] = await prisma.$queryRaw`
        SELECT COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS rec,
               COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS desp
        FROM "PessoalLancamento" WHERE "userId"=${userId}
          AND EXTRACT(YEAR FROM "data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "data")=EXTRACT(MONTH FROM CURRENT_DATE)
      ` as any[]
      await enviarMensagem(chatId, `💰 <b>Este mês</b>\nReceitas: ${fmt(r.rec)}\nDespesas: ${fmt(r.desp)}\nResultado: <b>${fmt(r.rec - r.desp)}</b>`)
      return NextResponse.json({ ok: true })
    }
    if (cmd === '/hoje') {
      const rows = await prisma.$queryRaw`
        SELECT "tipo","descricao","valor"::float AS valor FROM "PessoalLancamento"
        WHERE "userId"=${userId} AND "data"=CURRENT_DATE ORDER BY "createdAt" DESC LIMIT 20
      ` as any[]
      if (!rows.length) { await enviarMensagem(chatId, 'Nada lançado hoje ainda. 🙂'); return NextResponse.json({ ok: true }) }
      const linhas = rows.map((l: any) => `${l.tipo === 'RECEITA' ? '➕' : '➖'} ${fmt(l.valor)} · ${l.descricao}`).join('\n')
      await enviarMensagem(chatId, `📅 <b>Hoje</b>\n${linhas}`)
      return NextResponse.json({ ok: true })
    }
    if (cmd.startsWith('/')) { await enviarMensagem(chatId, 'Comando não reconhecido. /ajuda'); return NextResponse.json({ ok: true }) }

    // 4) Lançamento por linguagem natural.
    const cats = await prisma.$queryRaw`SELECT "id","nome","tipo" FROM "PessoalCategoria" WHERE "userId"=${userId}` as { id: string; nome: string; tipo: string }[]
    const parsed = await parseLancamentoIA(texto, cats.map(c => c.nome), hojeISO())
    if (!parsed) { await enviarMensagem(chatId, 'Não consegui entender o valor. Tente ex.: <i>"gastei 20 no mercado"</i>.'); return NextResponse.json({ ok: true }) }

    // Casa categoria (fuzzy: mesmo tipo + nome contém). Cria se não existir.
    let categoriaId: string | null = null
    if (parsed.categoria) {
      const alvo = parsed.categoria.toLowerCase()
      const achou = cats.find(c => c.tipo === parsed.tipo && (c.nome.toLowerCase() === alvo || c.nome.toLowerCase().includes(alvo) || alvo.includes(c.nome.toLowerCase())))
      if (achou) categoriaId = achou.id
      else {
        categoriaId = gid()
        await prisma.$executeRaw`INSERT INTO "PessoalCategoria" ("id","userId","nome","tipo","icone","createdAt") VALUES (${categoriaId}, ${userId}, ${parsed.categoria.slice(0, 40)}, ${parsed.tipo}, ${parsed.tipo === 'RECEITA' ? '💰' : '💸'}, NOW())`
      }
    }
    // Forma de pagamento/origem → campos do ateliê (canal + observações), já que é réplica.
    const canal = parsed.forma || null
    const obs = parsed.forma ? `via ${parsed.forma}` : null
    const data = parsed.data || hojeISO()
    await prisma.$executeRaw`
      INSERT INTO "PessoalLancamento" ("id","userId","tipo","categoriaId","descricao","valor","data","canal","observacoes","origem","status","createdAt")
      VALUES (${gid()}, ${userId}, ${parsed.tipo}, ${categoriaId}, ${parsed.descricao}, ${parsed.valor}, ${data}::date, ${canal}, ${obs}, 'TELEGRAM', 'PAGO', NOW())
    `
    const [mes] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS desp
      FROM "PessoalLancamento" WHERE "userId"=${userId}
        AND EXTRACT(YEAR FROM "data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "data")=EXTRACT(MONTH FROM CURRENT_DATE)
    ` as any[]
    const catNome = parsed.categoria || 'sem categoria'
    await enviarMensagem(chatId, `✅ ${parsed.tipo === 'RECEITA' ? 'Receita' : 'Gasto'} de <b>${fmt(parsed.valor)}</b> · ${catNome}\n${parsed.tipo === 'DESPESA' ? `Gastos do mês: <b>${fmt(mes.desp)}</b>` : ''}`.trim())
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PESSOAL-TG] webhook:', (e as Error)?.message)
    return NextResponse.json({ ok: true })
  }
}
