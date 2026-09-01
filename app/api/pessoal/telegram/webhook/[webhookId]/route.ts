// Webhook do bot PRÓPRIO de cada usuário. Roteado pelo webhookId (aleatório, não-adivinhável).
// Resolve o userId pelo webhookId, valida o secret (derivado do token dela) e a assinatura ATIVA.
// Roteia a intenção: DESPESA/RECEITA (finanças) · TAREFA · NOTA. Cada webhookId mexe SÓ na conta do dono.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from '@/lib/pessoal/schema'
import { assinaturaAtiva } from '@/lib/pessoal/assinatura'
import { decryptToken } from '@/lib/pagamento/asaas/cripto'
import { enviarMensagem, parseLancamentoIA, parseTarefaIA, classificarIntencaoIA, secretDoWebhook, baixarFotoBase64, type IntencaoTG } from '@/lib/pessoal/telegram'

export const dynamic = 'force-dynamic'
const fmt = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }
function hojeISO() { return new Date().toISOString().slice(0, 10) }
const brDate = (s?: string | null) => { if (!s) return null; const [y, m, d] = s.slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : null }
const PRIO_LABEL: Record<string, string> = { ALTA: 'alta', MEDIA: 'média', BAIXA: 'baixa' }

// Verbos que FORÇAM finanças (a pessoa decide o tipo pela palavra).
const VERBOS_FIN = /\b(gastei|paguei|comprei|torrei|recebi|ganhei|entrou|caiu|recebo|gasto)\b/i
// Resposta que escolhe o tipo (usada quando o bot perguntou por estar ambíguo).
function tipoEscolhido(t: string): IntencaoTG | null {
  const s = t.toLowerCase().trim()
  if (/^(1|gasto|despesa|paguei|comprei|gastei)$/.test(s)) return 'despesa'
  if (/^(2|receita|recebi|entrada|ganhei)$/.test(s)) return 'receita'
  if (/^(3|tarefa)$/.test(s)) return 'tarefa'
  if (/^(4|nota)$/.test(s)) return 'nota'
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ webhookId: string }> }) {
  const { webhookId } = await params
  await ensurePessoalTables()

  const [link] = await prisma.$queryRaw`
    SELECT "id","userId","botTokenCriptografado","status",
           "pendenteTexto","pendenteImagem", ("pendenteEm" > NOW() - INTERVAL '15 minutes') AS "pendenteAtivo"
    FROM "PessoalTelegramLink" WHERE "webhookId" = ${webhookId} LIMIT 1
  ` as { id: string; userId: string; botTokenCriptografado: string | null; status: string; pendenteTexto: string | null; pendenteImagem: string | null; pendenteAtivo: boolean }[]
  if (!link) return NextResponse.json({ ok: true })

  const token = decryptToken(link.botTokenCriptografado)
  if (!token) return NextResponse.json({ ok: true })
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
      await enviarMensagem(token, chatId, '✅ <b>Conectado à sua conta!</b>\n💸 Gasto: <i>"gastei 20 no mercado no pix"</i>\n✅ Tarefa: <i>"tarefa: pagar aluguel dia 5"</i>\n📝 Nota: <i>"nota: senha do wifi 1234"</i>\nPergunte à vontade: <i>"quanto tenho guardado?"</i>, <i>"o que vence?"</i>, <i>"minhas tarefas"</i>.\nComandos: /saldo /contas /hoje /tarefas /notas /ajuda /desconectar')
      return NextResponse.json({ ok: true })
    }

    if (link.status !== 'ATIVO') { await enviarMensagem(token, chatId, 'Quase lá! Toque /start aqui pra confirmar a conexão com a sua conta.'); return NextResponse.json({ ok: true }) }
    if (!(await assinaturaAtiva(userId))) { await enviarMensagem(token, chatId, '⚠️ Sua assinatura do Pessoal está inativa. Regularize no SOA.'); return NextResponse.json({ ok: true }) }

    // Baixa a foto (maior variante ≤2MB) uma vez, se houver.
    async function fotoBase64(): Promise<string | null> {
      if (!fotos || !fotos.length) return null
      const escolha = [...fotos].reverse().find((p: any) => (p.file_size || 0) <= 2_000_000) || fotos[fotos.length - 1]
      return await baixarFotoBase64(token!, escolha.file_id)
    }
    async function limparPendente() {
      await prisma.$executeRaw`UPDATE "PessoalTelegramLink" SET "pendenteTexto"=NULL, "pendenteImagem"=NULL, "pendenteEm"=NULL WHERE "id"=${link.id}`
    }

    const cmd = texto.toLowerCase()

    // ── Comandos exatos ──────────────────────────────────────────────────────
    if (cmd === '/ajuda' || cmd === '/help') {
      await enviarMensagem(token, chatId, '📖 <b>Como usar</b>\n💸 <b>Gasto/receita</b>: <i>"paguei 89,90 de luz"</i>, <i>"recebi 1500 salário"</i>\n✅ <b>Tarefa</b>: <i>"tarefa: ligar pro dentista amanhã"</i> ou /tarefa\n📝 <b>Nota</b>: <i>"nota: ideia de bolo de cenoura"</i> ou /nota\n📷 Foto com legenda vira comprovante (gasto) ou anexo (tarefa/nota).\n\n🔎 <b>Perguntas</b> (sem barra): <i>"quanto tenho guardado?"</i>, <i>"o que vence?"</i>, <i>"minhas tarefas"</i>, <i>"o que lancei hoje?"</i>.\n/saldo /contas /hoje /tarefas /notas /desconectar')
      return NextResponse.json({ ok: true })
    }
    if (cmd === '/desconectar') {
      await prisma.$executeRaw`DELETE FROM "PessoalTelegramLink" WHERE "id" = ${link.id}`
      await enviarMensagem(token, chatId, '🔌 Desconectado. Reconecte pelo SOA quando quiser.')
      return NextResponse.json({ ok: true })
    }
    // /saldo + linguagem natural de CONSULTA (não confundir com "guardei 100 na caixinha" = criar).
    const querSaldo = cmd === '/saldo' || cmd === 'saldo' || cmd === 'saldo?' || cmd === 'caixinhas'
      || cmd === 'caixinha' || /quanto\s+(eu\s+)?tenho\s+guardado/.test(cmd) || /\bmeu\s+saldo\b/.test(cmd)
    if (querSaldo) {
      const [r] = await prisma.$queryRaw`
        SELECT COALESCE(SUM(CASE WHEN "tipo"='RECEITA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS rec,
               COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS desp
        FROM "PessoalLancamento" WHERE "userId"=${userId}
          AND EXTRACT(YEAR FROM "data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "data")=EXTRACT(MONTH FROM CURRENT_DATE)
      ` as any[]
      // Caixinhas (reservas) — saldo pela SOMA DOS MOVIMENTOS (fonte da verdade, = a tela).
      const caixinhas = await prisma.$queryRaw`
        SELECT c."nome",
          COALESCE(SUM(CASE WHEN m."tipo"='DEPOSITO' THEN m."valor" WHEN m."tipo"='RETIRADA' THEN -m."valor" ELSE 0 END),0)::float AS saldo
        FROM "PessoalCaixinha" c
        LEFT JOIN "PessoalCaixinhaMov" m ON m."caixinhaId"=c."id" AND m."userId"=c."userId"
        WHERE c."userId"=${userId} GROUP BY c."id", c."nome" ORDER BY saldo DESC, c."nome"
      ` as { nome: string; saldo: number }[]
      const totalGuardado = caixinhas.reduce((s, c) => s + (Number(c.saldo) || 0), 0)

      let texto = `💰 <b>Este mês</b>\nReceitas: ${fmt(r.rec)}\nDespesas: ${fmt(r.desp)}\nResultado: <b>${fmt(r.rec - r.desp)}</b>`
      if (caixinhas.length) {
        texto += `\n\n🐷 <b>Guardado nas caixinhas</b>\n`
          + caixinhas.map(c => `• ${c.nome}: ${fmt(c.saldo)}`).join('\n')
          + `\n<b>Total guardado: ${fmt(totalGuardado)}</b>`
      }
      await enviarMensagem(token, chatId, texto)
      return NextResponse.json({ ok: true })
    }
    // Contas a vencer (despesas em aberto). VERBOS_FIN barra "paguei…"=criar.
    const querContas = !VERBOS_FIN.test(texto) && (
      cmd === '/contas' || cmd === 'contas'
      || /\bcontas?\s+(a\s+|pra\s+|para\s+)?(vencer|pagar|vencendo|vencidas?|atrasadas?)\b/.test(cmd)
      || /\bo que\s+(eu\s+)?(tenho\s+)?(a|pra|para)\s+pagar\b/.test(cmd)
      || /\b(a vencer|vencendo|vencimentos?|a pagar)\b/.test(cmd)
    )
    if (querContas) {
      const rows = await prisma.$queryRaw`
        SELECT "descricao", "valor"::float AS valor, "data", ("data" < CURRENT_DATE) AS atrasada
        FROM "PessoalLancamento"
        WHERE "userId"=${userId} AND "tipo"='DESPESA' AND "status" IN ('PENDENTE','PARCIAL')
          AND "data" <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY "data" ASC, "createdAt" ASC LIMIT 20
      ` as { descricao: string; valor: number; data: string; atrasada: boolean }[]
      if (!rows.length) { await enviarMensagem(token, chatId, '🎉 Nenhuma conta a vencer nos próximos 30 dias.'); return NextResponse.json({ ok: true }) }
      const total = rows.reduce((s, r) => s + (Number(r.valor) || 0), 0)
      const atrasadas = rows.filter(r => r.atrasada).length
      const linhas = rows.map(r => `${r.atrasada ? '🔴' : '📅'} ${fmt(r.valor)} · ${r.descricao}${r.data ? ` · ${brDate(r.data)}${r.atrasada ? ' (venceu)' : ''}` : ''}`)
      let out = `📌 <b>Contas a vencer</b> (30 dias)\n${linhas.join('\n')}\n<b>Total em aberto: ${fmt(total)}</b>`
      if (atrasadas) out += `\n⚠️ ${atrasadas} atrasada(s).`
      await enviarMensagem(token, chatId, out)
      return NextResponse.json({ ok: true })
    }
    // Consulta do dia. Barra verbos/valores p/ não confundir com "gastei 20 hoje"=criar.
    const querHoje = !VERBOS_FIN.test(texto) && !/\d/.test(cmd) && (
      cmd === '/hoje' || cmd === 'hoje' || cmd === 'hoje?'
      || /\b(o que|oq)\b.*\bhoje\b/.test(cmd) || /\b(gastos|resumo|lançamentos|lancamentos)\s+de\s+hoje\b/.test(cmd)
    )
    if (querHoje) {
      const rows = await prisma.$queryRaw`
        SELECT "tipo","descricao","valor"::float AS valor FROM "PessoalLancamento"
        WHERE "userId"=${userId} AND "data"=CURRENT_DATE ORDER BY "createdAt" DESC LIMIT 20
      ` as any[]
      if (!rows.length) { await enviarMensagem(token, chatId, 'Nada lançado hoje ainda. 🙂'); return NextResponse.json({ ok: true }) }
      await enviarMensagem(token, chatId, `📅 <b>Hoje</b>\n${rows.map((l: any) => `${l.tipo === 'RECEITA' ? '➕' : '➖'} ${fmt(l.valor)} · ${l.descricao}`).join('\n')}`)
      return NextResponse.json({ ok: true })
    }
    const querTarefas = !cmd.includes(':') && (
      cmd === '/tarefas' || cmd === 'tarefas'
      || /\bminhas?\s+tarefas?\b/.test(cmd) || /\btarefas?\s+(pendentes?|atrasadas?|de hoje)\b/.test(cmd)
      || /\bo que\s+(eu\s+)?(tenho\s+)?(pra|para)\s+fazer\b/.test(cmd)
    )
    if (querTarefas) {
      const rows = await prisma.$queryRaw`
        SELECT "titulo","prazo","prioridade","status", ("prazo" IS NOT NULL AND "prazo" < CURRENT_DATE) AS atrasada
        FROM "PessoalTarefa" WHERE "userId"=${userId} AND "status"<>'CONCLUIDA'
        ORDER BY ("prazo" IS NULL) ASC, "prazo" ASC, "createdAt" DESC LIMIT 15
      ` as any[]
      if (!rows.length) { await enviarMensagem(token, chatId, 'Sem tarefas pendentes. 🎉'); return NextResponse.json({ ok: true }) }
      const linhas = rows.map((t: any) => `${t.atrasada ? '🔴' : '•'} ${t.titulo}${t.prazo ? ` · ${brDate(t.prazo)}` : ''}${t.atrasada ? ' (atrasada)' : ''}`)
      await enviarMensagem(token, chatId, `✅ <b>Tarefas pendentes</b>\n${linhas.join('\n')}`)
      return NextResponse.json({ ok: true })
    }
    const querNotas = !cmd.includes(':') && (
      cmd === '/notas' || cmd === 'notas'
      || /\bminhas?\s+notas?\b/.test(cmd) || /\bver\s+(as\s+)?notas?\b/.test(cmd)
    )
    if (querNotas) {
      const rows = await prisma.$queryRaw`
        SELECT "titulo", LEFT(COALESCE("conteudo",''),80) AS trecho, "fixada"
        FROM "PessoalNota" WHERE "userId"=${userId} ORDER BY "fixada" DESC, "updatedAt" DESC LIMIT 8
      ` as any[]
      if (!rows.length) { await enviarMensagem(token, chatId, 'Nenhuma nota ainda. 📝'); return NextResponse.json({ ok: true }) }
      const linhas = rows.map((n: any) => `${n.fixada ? '📌' : '•'} <b>${n.titulo || 'Sem título'}</b>${n.trecho ? ` — ${n.trecho}` : ''}`)
      await enviarMensagem(token, chatId, `📝 <b>Suas notas</b>\n${linhas.join('\n')}`)
      return NextResponse.json({ ok: true })
    }

    // ── Criadores por tipo (escopo userId) ───────────────────────────────────
    async function criarTarefa(txt: string, imagem: string | null) {
      const corpo = txt.trim()
      if (!corpo && !imagem) { await enviarMensagem(token!, chatId, 'Escreva a tarefa, ex.: <i>"tarefa: pagar aluguel dia 5"</i>.'); return }
      const t = (corpo ? await parseTarefaIA(corpo, hojeISO()) : null) || { titulo: (corpo || 'Tarefa').slice(0, 120), prazo: null as string | null, prioridade: 'MEDIA' as const }
      const id = gid()
      await prisma.$executeRaw`
        INSERT INTO "PessoalTarefa" ("id","userId","titulo","descricao","prazo","prioridade","status","imagem","createdAt")
        VALUES (${id}, ${userId}, ${t.titulo}, ${null}, ${t.prazo}::date, ${t.prioridade}, 'PENDENTE', ${imagem}, NOW())
      `
      const extras = [t.prazo ? `vence ${brDate(t.prazo)}` : null, t.prioridade === 'ALTA' ? 'prioridade alta' : null, imagem ? '📎 imagem' : null].filter(Boolean).join(' · ')
      await enviarMensagem(token!, chatId, `✅ <b>Tarefa:</b> ${t.titulo}${extras ? `\n${extras}` : ''}`)
    }
    async function criarNota(txt: string, imagem: string | null) {
      const corpo = txt.trim()
      if (!corpo && !imagem) { await enviarMensagem(token!, chatId, 'Escreva a nota, ex.: <i>"nota: senha do wifi 1234"</i>.'); return }
      const linhas = corpo.split('\n')
      const titulo = (linhas[0] || '').slice(0, 60).trim() || null
      const conteudo = linhas.length > 1 ? linhas.slice(1).join('\n').trim() : (corpo.length > 60 ? corpo : null)
      const id = gid()
      await prisma.$executeRaw`
        INSERT INTO "PessoalNota" ("id","userId","titulo","conteudo","cor","fixada","imagem","createdAt","updatedAt")
        VALUES (${id}, ${userId}, ${titulo}, ${conteudo}, '#ffffff', false, ${imagem}, NOW(), NOW())
      `
      await enviarMensagem(token!, chatId, `📝 <b>Nota salva${titulo ? `:</b> ${titulo}` : '</b>'}${imagem ? '\n📎 imagem anexada' : ''}`)
    }
    async function criarLancamento(txt: string, imagem: string | null, temFoto: boolean) {
      const cats = await prisma.$queryRaw`SELECT "id","nome","tipo" FROM "PessoalCategoria" WHERE "userId"=${userId}` as { id: string; nome: string; tipo: string }[]
      const contasDb = await prisma.$queryRaw`SELECT "id","nome" FROM "PessoalConta" WHERE "userId"=${userId} AND "ativo"=true` as { id: string; nome: string }[]
      const parsed = await parseLancamentoIA(txt, cats.map(c => c.nome), contasDb.map(c => c.nome), hojeISO())
      if (!parsed) { await enviarMensagem(token!, chatId, 'Não entendi o valor. Ex.: <i>"gastei 20 no mercado"</i>.'); return }

      let categoriaId: string | null = null
      if (parsed.categoria) {
        const alvo = parsed.categoria.toLowerCase()
        const achou = cats.find(c => c.tipo === parsed.tipo && (c.nome.toLowerCase() === alvo || c.nome.toLowerCase().includes(alvo) || alvo.includes(c.nome.toLowerCase())))
        if (achou) categoriaId = achou.id
        else { categoriaId = gid(); await prisma.$executeRaw`INSERT INTO "PessoalCategoria" ("id","userId","nome","tipo","icone","createdAt") VALUES (${categoriaId}, ${userId}, ${parsed.categoria.slice(0, 40)}, ${parsed.tipo}, ${parsed.tipo === 'RECEITA' ? '💰' : '💸'}, NOW())` }
      }
      let contaId: string | null = null, contaNome: string | null = null
      if (parsed.conta) {
        const alvo = parsed.conta.toLowerCase()
        const achou = contasDb.find(c => c.nome.toLowerCase() === alvo || c.nome.toLowerCase().includes(alvo) || alvo.includes(c.nome.toLowerCase()))
        if (achou) { contaId = achou.id; contaNome = achou.nome }
        else { contaId = gid(); contaNome = parsed.conta.slice(0, 40); await prisma.$executeRaw`INSERT INTO "PessoalConta" ("id","userId","nome","tipo","createdAt") VALUES (${contaId}, ${userId}, ${contaNome}, 'CORRENTE', NOW())` }
      }
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
      await prisma.$executeRaw`
        INSERT INTO "PessoalLancamento" ("id","userId","tipo","categoriaId","contaId","descricao","valor","data","metodo","comprovante","origem","status","createdAt")
        VALUES (${gid()}, ${userId}, ${parsed.tipo}, ${categoriaId}, ${contaId}, ${parsed.descricao}, ${parsed.valor}, ${data}::date, ${metodo}, ${imagem}, 'TELEGRAM', 'PAGO', NOW())
      `
      const [mes] = await prisma.$queryRaw`
        SELECT COALESCE(SUM(CASE WHEN "tipo"='DESPESA' AND "status"='PAGO' THEN "valor" ELSE 0 END),0)::float AS desp
        FROM "PessoalLancamento" WHERE "userId"=${userId}
          AND EXTRACT(YEAR FROM "data")=EXTRACT(YEAR FROM CURRENT_DATE) AND EXTRACT(MONTH FROM "data")=EXTRACT(MONTH FROM CURRENT_DATE)
      ` as any[]
      const detalhe = [parsed.categoria || 'sem categoria', contaNome, metodo && ({ PIX: 'Pix', CARTAO: 'Cartão', DINHEIRO: 'Dinheiro', BOLETO: 'Boleto', TED: 'TED' } as any)[metodo]].filter(Boolean).join(' · ')
      const anexo = temFoto ? (imagem ? '\n📎 Comprovante anexado.' : '\n⚠️ Não consegui salvar a foto (muito grande?).') : ''
      await enviarMensagem(token!, chatId, `✅ ${parsed.tipo === 'RECEITA' ? 'Receita' : 'Gasto'} de <b>${fmt(parsed.valor)}</b> · ${detalhe}${anexo}\n${parsed.tipo === 'DESPESA' ? `Gastos do mês: <b>${fmt(mes.desp)}</b>` : ''}`.trim())
    }
    async function despachar(tipo: IntencaoTG, corpo: string, imagem: string | null, temFoto: boolean) {
      if (tipo === 'tarefa') return criarTarefa(corpo, imagem)
      if (tipo === 'nota') return criarNota(corpo, imagem)
      return criarLancamento(corpo, imagem, temFoto) // despesa/receita → parse decide o tipo pelo verbo
    }

    // ── Resolução de PENDÊNCIA (o bot perguntou o tipo) ──────────────────────
    if (link.pendenteTexto && link.pendenteAtivo) {
      const escolha = tipoEscolhido(texto)
      if (escolha) {
        await limparPendente()
        await despachar(escolha, link.pendenteTexto, link.pendenteImagem, !!link.pendenteImagem)
        return NextResponse.json({ ok: true })
      }
      await limparPendente() // não escolheu → descarta e processa a mensagem nova normalmente
    }

    // ── Prefixos que FORÇAM o tipo (tarefa/nota) ─────────────────────────────
    const mForce = texto.match(/^\s*(?:\/(tarefa|nota)\b|(tarefa|nota)\s*:)\s*([\s\S]*)$/i)
    if (mForce) {
      const tipo = (mForce[1] || mForce[2]).toLowerCase() === 'tarefa' ? 'tarefa' : 'nota'
      await despachar(tipo, (mForce[3] || '').trim(), await fotoBase64(), !!fotos)
      return NextResponse.json({ ok: true })
    }
    // Comando desconhecido (barra) que não caiu em nada acima.
    if (cmd.startsWith('/')) { await enviarMensagem(token, chatId, 'Comando não reconhecido. /ajuda'); return NextResponse.json({ ok: true }) }

    // ── Verbos financeiros forçam finanças ───────────────────────────────────
    if (VERBOS_FIN.test(texto)) { await criarLancamento(texto, await fotoBase64(), !!fotos); return NextResponse.json({ ok: true }) }

    // Foto sem legenda → sem como classificar; pede o contexto.
    if (fotos && !texto) { await enviarMensagem(token, chatId, '📎 Recebi a foto! Me diga o que é na legenda: um gasto (<i>"gastei 20…"</i>), uma <i>tarefa:</i> ou uma <i>nota:</i>.'); return NextResponse.json({ ok: true }) }

    // ── Classificação por IA ─────────────────────────────────────────────────
    const intent = await classificarIntencaoIA(texto)
    if (intent && intent !== 'ambiguo') { await despachar(intent, texto, await fotoBase64(), !!fotos); return NextResponse.json({ ok: true }) }

    // Ambíguo → guarda e PERGUNTA o tipo.
    const img = await fotoBase64()
    await prisma.$executeRaw`UPDATE "PessoalTelegramLink" SET "pendenteTexto"=${texto}, "pendenteImagem"=${img}, "pendenteEm"=NOW() WHERE "id"=${link.id}`
    await enviarMensagem(token, chatId, '🤔 Não entendi o que é. Responda:\n<b>1</b>) 💸 gasto  <b>2</b>) 💰 receita  <b>3</b>) ✅ tarefa  <b>4</b>) 📝 nota')
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PESSOAL-TG] webhook:', (e as Error)?.message)
    return NextResponse.json({ ok: true })
  }
}
