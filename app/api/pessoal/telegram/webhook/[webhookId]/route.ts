// Webhook do bot PRÓPRIO de cada usuário. Roteado pelo webhookId (aleatório, não-adivinhável).
// Resolve o userId pelo webhookId, valida o secret (derivado do token dela) e a assinatura ATIVA.
// Cada webhookId mexe SÓ na conta do dono. Sempre 200 (Telegram reenvia em não-2xx).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from '@/lib/pessoal/schema'
import { assinaturaAtiva } from '@/lib/pessoal/assinatura'
import { decryptToken } from '@/lib/pagamento/asaas/cripto'
import { enviarMensagem, parseLancamentoIA, secretDoWebhook, baixarFotoBase64 } from '@/lib/pessoal/telegram'

export const dynamic = 'force-dynamic'
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function hojeISO() { return new Date().toISOString().slice(0, 10) }

export async function POST(req: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
  await ensurePessoalTables()

  // Resolve o dono pelo webhookId.
  const [link] = await prisma.$queryRaw`
    SELECT "id","userId","botTokenCriptografado","status" FROM "PessoalTelegramLink" WHERE "webhookId" = ${webhookId} LIMIT 1
  ` as { id: string; userId: string; botTokenCriptografado: string | null; status: string }[]
  if (!link) return NextResponse.json({ ok: true })   // rota desconhecida — ignora silenciosamente

  const token = decryptToken(link.botTokenCriptografado)
  if (!token) return NextResponse.json({ ok: true })

  // Valida o secret do Telegram (derivado do webhookId + token). Fail closed.
  if (req.headers.get('x-telegram-bot-api-secret-token') !== secretDoWebhook(webhookId, token)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const up = await req.json().catch(() => null) as any
  const msg = up?.message
  const chatId = msg?.chat?.id
  const fotos = Array.isArray(msg?.photo) ? msg.photo : null
  const texto = (msg?.text || msg?.caption || '').trim()
  if (!chatId || (!texto && !fotos)) return NextResponse.json({ ok: true })
  const userId = link.userId

  try {
    // /start → confirma o vínculo (grava o chat + ATIVO).
    if (texto.startsWith('/start')) {
      await prisma.$executeRaw`
        UPDATE "PessoalTelegramLink" SET "telegramChatId" = ${String(chatId)}, "telegramUsername" = ${msg?.from?.username ?? null},
          "status" = 'ATIVO', "ativo" = true, "vinculadoEm" = NOW() WHERE "id" = ${link.id}
      `
      await enviarMensagem(token, chatId, '✅ <b>Conectado à sua conta!</b>\nMande seus gastos: <i>"gastei 20 no mercado no pix"</i>.\nComandos: /saldo /hoje /ajuda /desconectar')
      return NextResponse.json({ ok: true })
    }

    // Demais mensagens: precisa estar ATIVO + assinatura ATIVA.
    if (link.status !== 'ATIVO') { await enviarMensagem(token, chatId, 'Quase lá! Toque /start aqui pra confirmar a conexão com a sua conta.'); return NextResponse.json({ ok: true }) }
    if (!(await assinaturaAtiva(userId))) { await enviarMensagem(token, chatId, '⚠️ Sua assinatura do Pessoal está inativa. Regularize no SOA.'); return NextResponse.json({ ok: true }) }

    const cmd = texto.toLowerCase()
    if (cmd === '/ajuda' || cmd === '/help') {
      await enviarMensagem(token, chatId, '📖 <b>Como usar</b>\n• Mande um gasto/receita: <i>"paguei 89,90 de luz"</i>, <i>"recebi 1500 salário"</i>.\n• 📷 Mande a <b>foto do comprovante</b> com a legenda (ex.: <i>"gastei 20 no mercado"</i>) — anexo automático.\n• /saldo — resumo do mês\n• /hoje — lançamentos de hoje\n• /desconectar')
      return NextResponse.json({ ok: true })
    }
    if (cmd === '/desconectar') {
      await prisma.$executeRaw`DELETE FROM "PessoalTelegramLink" WHERE "id" = ${link.id}`
      await enviarMensagem(token, chatId, '🔌 Desconectado. Reconecte pelo SOA quando quiser.')
      return NextResponse.json({ ok: true })
    }
    if (cmd === '/saldo') {
      const [r] = await prisma.$queryRaw`
        SELECT COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS rec,
               COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS desp
        FROM "PessoalLancamento" WHERE "userId"=${userId}
          AND EXTRACT(YEAR FROM "data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "data")=EXTRACT(MONTH FROM CURRENT_DATE)
      ` as any[]
      await enviarMensagem(token, chatId, `💰 <b>Este mês</b>\nReceitas: ${fmt(r.rec)}\nDespesas: ${fmt(r.desp)}\nResultado: <b>${fmt(r.rec - r.desp)}</b>`)
      return NextResponse.json({ ok: true })
    }
    if (cmd === '/hoje') {
      const rows = await prisma.$queryRaw`
        SELECT "tipo","descricao","valor"::float AS valor FROM "PessoalLancamento"
        WHERE "userId"=${userId} AND "data"=CURRENT_DATE ORDER BY "createdAt" DESC LIMIT 20
      ` as any[]
      if (!rows.length) { await enviarMensagem(token, chatId, 'Nada lançado hoje ainda. 🙂'); return NextResponse.json({ ok: true }) }
      await enviarMensagem(token, chatId, `📅 <b>Hoje</b>\n${rows.map((l: any) => `${l.tipo === 'RECEITA' ? '➕' : '➖'} ${fmt(l.valor)} · ${l.descricao}`).join('\n')}`)
      return NextResponse.json({ ok: true })
    }
    if (cmd.startsWith('/')) { await enviarMensagem(token, chatId, 'Comando não reconhecido. /ajuda'); return NextResponse.json({ ok: true }) }
    if (fotos && !texto) { await enviarMensagem(token, chatId, '📎 Recebi a foto! Me conta o que foi junto, ex.: <i>"gastei 20 no mercado"</i> (na legenda da foto).'); return NextResponse.json({ ok: true }) }

    // Lançamento por linguagem natural.
    const cats = await prisma.$queryRaw`SELECT "id","nome","tipo" FROM "PessoalCategoria" WHERE "userId"=${userId}` as { id: string; nome: string; tipo: string }[]
    const contasDb = await prisma.$queryRaw`SELECT "id","nome" FROM "PessoalConta" WHERE "userId"=${userId} AND "ativo"=true` as { id: string; nome: string }[]
    const parsed = await parseLancamentoIA(texto, cats.map(c => c.nome), contasDb.map(c => c.nome), hojeISO())
    if (!parsed) { await enviarMensagem(token, chatId, 'Não entendi o valor. Ex.: <i>"gastei 20 no mercado"</i>.'); return NextResponse.json({ ok: true }) }

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

    // Conta: fuzzy-match nas do usuário; cria se não existir.
    let contaId: string | null = null
    let contaNome: string | null = null
    if (parsed.conta) {
      const alvo = parsed.conta.toLowerCase()
      const achou = contasDb.find(c => c.nome.toLowerCase() === alvo || c.nome.toLowerCase().includes(alvo) || alvo.includes(c.nome.toLowerCase()))
      if (achou) { contaId = achou.id; contaNome = achou.nome }
      else {
        contaId = gid(); contaNome = parsed.conta.slice(0, 40)
        await prisma.$executeRaw`INSERT INTO "PessoalConta" ("id","userId","nome","tipo","createdAt") VALUES (${contaId}, ${userId}, ${contaNome}, 'CORRENTE', NOW())`
      }
    }

    // Método de pagamento (PIX|CARTAO|DINHEIRO|BOLETO|TED) a partir da "forma".
    const METODOS = ['PIX', 'CARTAO', 'DINHEIRO', 'BOLETO', 'TED']
    let metodo: string | null = null
    if (parsed.forma) {
      const f = parsed.forma.toLowerCase()
      if (f.includes('pix')) metodo = 'PIX'
      else if (f.includes('cart') || f.includes('cred') || f.includes('déb') || f.includes('deb')) metodo = 'CARTAO'
      else if (f.includes('dinh') || f.includes('espéc') || f.includes('espec')) metodo = 'DINHEIRO'
      else if (f.includes('bol')) metodo = 'BOLETO'
      else if (f.includes('ted') || f.includes('doc') || f.includes('transf')) metodo = 'TED'
      else if (METODOS.includes(parsed.forma.toUpperCase())) metodo = parsed.forma.toUpperCase()
    }
    const data = parsed.data || hojeISO()
    // Comprovante: se veio foto, baixa a maior variante dentro do limite e anexa.
    let comprovante: string | null = null
    if (fotos && fotos.length) {
      const escolha = [...fotos].reverse().find((p: any) => (p.file_size || 0) <= 2_000_000) || fotos[fotos.length - 1]
      comprovante = await baixarFotoBase64(token, escolha.file_id)
    }
    await prisma.$executeRaw`
      INSERT INTO "PessoalLancamento" ("id","userId","tipo","categoriaId","contaId","descricao","valor","data","metodo","comprovante","origem","status","createdAt")
      VALUES (${gid()}, ${userId}, ${parsed.tipo}, ${categoriaId}, ${contaId}, ${parsed.descricao}, ${parsed.valor}, ${data}::date, ${metodo}, ${comprovante}, 'TELEGRAM', 'PAGO', NOW())
    `
    const [mes] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS desp
      FROM "PessoalLancamento" WHERE "userId"=${userId}
        AND EXTRACT(YEAR FROM "data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "data")=EXTRACT(MONTH FROM CURRENT_DATE)
    ` as any[]
    const detalhe = [parsed.categoria || 'sem categoria', contaNome, metodo && ({ PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro', BOLETO: 'Boleto', TED: 'TED' } as any)[metodo]].filter(Boolean).join(' · ')
    const anexo = fotos ? (comprovante ? '\n📎 Comprovante anexado.' : '\n⚠️ Não consegui salvar a foto (muito grande?).') : ''
    await enviarMensagem(token, chatId, `✅ ${parsed.tipo === 'RECEITA' ? 'Receita' : 'Gasto'} de <b>${fmt(parsed.valor)}</b> · ${detalhe}${anexo}\n${parsed.tipo === 'DESPESA' ? `Gastos do mês: <b>${fmt(mes.desp)}</b>` : ''}`.trim())
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PESSOAL-TG] webhook:', (e as Error)?.message)
    return NextResponse.json({ ok: true })
  }
}
