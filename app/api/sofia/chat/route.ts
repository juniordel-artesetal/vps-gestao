import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { recuperarConhecimento, montarContextoConhecimento } from '@/lib/suporte/recuperar'
import { calcularIndice } from '@/lib/indicePrecos'
import { SOFIA_TOM } from '@/lib/sofia/persona'
import { REGUA_RESPOSTA } from '@/lib/suporte/regua'
import { getMenuPos } from '@/lib/sofia/menuPos'
import { menuPosLabel, ehHorizontal } from '@/lib/sofia/menuPosTipos'
import { buscarPedidos, contarPedidos, buscarClientes, buscarFinanceiro, somaFinanceiro, buscarEstoqueBaixo, type RespostaBusca, type FiltrosPedido } from '@/lib/sofia/ferramentas'
import { classificarIntencao, type Intencao } from '@/lib/sofia/intencao'
import { calcularAlertas } from '@/lib/sofia/alertas'
import { resumoFinanceiro, maioresDespesas, metaDoMes, dreResumo, gerarConselhos } from '@/lib/sofia/ferramentasFinanceiro'

async function listarSetores(workspaceId: string): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw`SELECT "nome" FROM "SetorConfig" WHERE "workspaceId" = ${workspaceId} AND "ativo" = true ORDER BY "ordem" ASC` as { nome: string }[]
    return rows.map(r => r.nome)
  } catch { return [] }
}
const filtrosPedido = (p: Intencao['parametros']): FiltrosPedido => ({ cliente: p.cliente, produto: p.produto, numero: p.numero, statusPedido: p.statusPedido, setor: p.setor, canal: p.canal, periodo: p.periodo, semData: p.semData, naoEnviados: p.naoEnviados, atrasados: p.atrasados, ordenar: p.ordenar })
const rotuloPeriodo = (p?: string): string => (p === 'hoje' ? 'de hoje' : p === 'amanha' ? 'de amanhã' : p === 'semana' ? 'da semana' : p === 'mes' ? 'do mês' : '')
const rotuloFin = (s?: string): string => (s === 'vencido' ? 'contas vencidas' : s === 'vence_hoje' ? 'contas que vencem hoje' : s === 'a_vencer' ? 'contas a vencer' : s === 'a_pagar' ? 'contas a pagar' : s === 'a_receber' ? 'valores a receber' : s === 'pago' ? 'lançamentos pagos' : 'lançamentos')
function descFiltro(p: Intencao['parametros']): string {
  const parts: string[] = []
  if (p.cliente) parts.push('de ' + p.cliente)
  if (p.setor) parts.push('em ' + p.setor)
  if (p.canal) parts.push('do ' + p.canal)
  if (p.atrasados) parts.push('atrasados')
  if (p.periodo) parts.push(rotuloPeriodo(p.periodo))
  return parts.length ? ' ' + parts.join(' ') : ''
}

export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.ANTHROPIC_API_KEY_GESTAO!
const LIMITE_DIARIO = 150
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })

// Detecta um tour sugerível a partir da pergunta (para o botão "Quer que eu te mostre?").
function tourSugerido(msg: string): string | null {
  const m = msg.toLowerCase()
  if (/(precific|quanto cobrar|preç[oa] do (meu )?produto|margem|calcular preç|cadastr\w* (um |uma )?(produto|material|insumo)|criar (um )?produto)/.test(m)) return 'precificar_produto'
  if (/(loja|vitrine|vender online|catálogo|catalogo)/.test(m)) return 'montar_loja'
  // Produção ANTES de criar-pedido — senão "mover um pedido de setor" cairia em criar.
  if (/(mov\w+|acompanh\w+).*(setor|pedido|produç)|como.*(produç|acompanh)|andamento|painel de produç|kanban/.test(m)) return 'acompanhar_producao'
  // Pedido: menção a pedido/encomenda com verbo de criar/como.
  if (/(pedido|encomenda)/.test(m) && /(nov[oa]|criar|cria|fazer|faç|cadastr|montar|primeiro|registr|como|inserir|lançar|lancar)/.test(m)) return 'criar_primeiro_pedido'
  return null
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
    // maxOutputTokens generoso + thinkingBudget:0 — sem isso o Gemini 2.5 gasta parte do
    // orçamento "pensando" e CORTA respostas longas (passo a passo) no meio. A resposta é
    // ancorada na base de conhecimento, então não precisa de raciocínio extra.
    body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { temperature: 0.35, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } } }),
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
    let resultados: RespostaBusca['itens'] | undefined
    let verTodos: string | undefined
    let alertas: Awaited<ReturnType<typeof calcularAlertas>> | undefined

    // ── CAMADA DE INTENÇÃO: a IA entende a pergunta e escolhe a ferramenta+filtros.
    // NUNCA busca literal. O backend executa e monta os links reais.
    let intencao: Awaited<ReturnType<typeof classificarIntencao>> = null
    let alertasAtuais: Awaited<ReturnType<typeof calcularAlertas>> = []
    if (!imagemBase64 && mensagem?.trim()) {
      try {
        const setores = await listarSetores(workspaceId)
        alertasAtuais = await calcularAlertas(workspaceId)
        intencao = await classificarIntencao(mensagem, historico, { setores, alertasResumo: alertasAtuais.map(a => a.texto).join('; ') })
      } catch (e) { console.error('[SOFIA INTENCAO]', (e as Error)?.message) }
      usouIA = true // a classificação é uma chamada ao modelo
    }
    const acao = intencao?.acao
    const p = intencao?.parametros || {}

    if (!imagemBase64 && acao && acao !== 'como_faz' && acao !== 'conversa') {
      try {
        if (acao === 'ambiguo') {
          resposta = intencao!.clarificar || 'Me conta um pouquinho mais? 😊 Você quer ver pedidos, financeiro, clientes ou estoque?'
        } else if (acao === 'alertas') {
          if (alertasAtuais.length === 0) resposta = 'Tá tudo em dia por aqui, amiga! 🧡 Nenhum pedido atrasado nem conta vencida. Bora produzir? 💪'
          else { resposta = 'Olha o que merece sua atenção agora 👇'; alertas = alertasAtuais }
        } else if (acao === 'preco_material') {
          const termo = (p.material || '').trim()
          if (!termo) resposta = 'Me diz o nome do material que você quer o preço (ex.: "papel offset 240", "feltro") 😊'
          else {
            const idx = await calcularIndice(termo)
            if (idx.suficiente) {
              const conf = idx.confiabilidade === 'alta' ? 'com bastante gente na conta' : idx.confiabilidade === 'media' ? 'com uma amostra boa' : 'ainda com poucas fontes, então olha com carinho'
              resposta = `Sobre **${termo}**, olha o que o pessoal tá pagando (${conf}):\n\n• Faixa mais comum: **${brl(idx.faixaMin)} a ${brl(idx.faixaMax)}**\n• Mais barato: ${brl(idx.menor)}\n• Média: ${brl(idx.medio)}\n\nSão preços da comunidade, anônimos e somados 🧡`
            } else resposta = `Ainda não tenho gente suficiente cadastrando "${termo}" pra te dar um preço confiável, amiga — não quero te passar número furado. Quer tentar com outro nome?`
          }
        } else if (acao === 'estoque_baixo') {
          const r = await buscarEstoqueBaixo(workspaceId)
          if (r.total === 0) resposta = 'Seus materiais estão tranquilos, nada abaixo do mínimo! 🧡'
          else { resposta = `Olha os materiais que estão acabando 👇`; resultados = r.itens }
        } else if (acao === 'listar_clientes') {
          const r = await buscarClientes(workspaceId, p.cliente || '')
          if (r.total === 0) resposta = `Não achei nenhuma cliente com esse nome, amiga 😔 Quer tentar escrever de outro jeito?`
          else { resposta = `Encontrei ${r.total} cliente(s) 🧡 É só clicar 👇`; resultados = r.itens; verTodos = r.verTodos }
        } else if (acao === 'soma_financeiro') {
          const s = await somaFinanceiro(workspaceId, { statusFin: p.statusFin, periodo: p.periodo })
          resposta = `Você tem **${brl(s.soma)}** em ${rotuloFin(p.statusFin)}${p.periodo ? ' ' + rotuloPeriodo(p.periodo) : ''} (${s.total} lançamento(s)). Quer ver a lista? 👇`
          if (s.total > 0) { const r = await buscarFinanceiro(workspaceId, { statusFin: p.statusFin, periodo: p.periodo }); resultados = r.itens; verTodos = r.verTodos }
        } else if (acao === 'listar_financeiro') {
          const r = await buscarFinanceiro(workspaceId, { statusFin: p.statusFin, periodo: p.periodo, termo: p.termoFinanceiro })
          if (r.total === 0) resposta = `Não encontrei ${rotuloFin(p.statusFin)}${p.termoFinanceiro ? ` com "${p.termoFinanceiro}"` : ''}, amiga 😔`
          else { resposta = `Achei ${r.total} ${rotuloFin(p.statusFin)} 💰 Olha aqui 👇`; resultados = r.itens; verTodos = r.verTodos }
        } else if (acao === 'resumo_financeiro') {
          const r = await resumoFinanceiro(workspaceId)
          if (r.receita <= 0 && r.despesa <= 0) {
            resposta = 'Ainda não vi movimento financeiro esse mês, amiga. Quando você concluir pedidos (a receita entra) ou lançar despesas, eu te mostro tudo aqui 🧡'
          } else {
            const sinal = r.resultado >= 0 ? 'no **azul** 💙' : 'no **vermelho** ❤️‍🩹'
            const interp = r.receita <= 0
              ? 'Ainda não teve receita recebida esse mês — só despesas por enquanto.'
              : r.margem >= 20 ? `Sua margem tá em **${r.margem}%** — saudável, parabéns! 🧡`
              : r.margem >= 10 ? `Sua margem tá em **${r.margem}%** — dá pra melhorar, fica de olho nos custos 👀`
              : `Sua margem tá em **${r.margem}%** — tá apertada, vale revisar custos e preço 💛`
            const vsAnt = r.mesAnterior.receita > 0
              ? `\n• Mês passado o resultado foi ${brl(r.mesAnterior.resultado)} ${r.resultado >= r.mesAnterior.resultado ? '(você melhorou! 🎉)' : '(deu uma caída)'}`
              : ''
            resposta = `Olha seu mês, amiga 👇\n\n• Faturamento recebido: **${brl(r.receita)}**\n• Despesas pagas: **${brl(r.despesa)}**\n• Resultado: **${brl(r.resultado)}** — você tá ${sinal}\n• A receber: ${brl(r.aReceber)} · A pagar: ${brl(r.aPagar)}\n• Saldo em caixa: **${brl(r.saldoCaixa)}**${vsAnt}\n\n${interp}`
          }
          resultados = [{ id: 'fin', titulo: 'Abrir a Visão Geral do Financeiro', link: '/financeiro' }]
        } else if (acao === 'maiores_despesas') {
          const d = await maioresDespesas(workspaceId)
          if (d.length === 0) resposta = 'Não vi despesas pagas esse mês ainda, amiga 🧡'
          else {
            const linhas = d.map(x => `• ${x.categoria}: **${brl(x.total)}** (${x.pct}%)`).join('\n')
            resposta = `É aqui que seu dinheiro tá indo esse mês 👇\n\n${linhas}\n\nSe alguma te surpreendeu, vale investigar 💛`
            resultados = [{ id: 'dre', titulo: 'Ver despesas no DRE', link: '/gestao/dre' }]
          }
        } else if (acao === 'meta') {
          const m = await metaDoMes(workspaceId)
          if (!m.temMeta) { resposta = 'Você ainda não definiu a meta de receita desse mês, amiga. Quer cadastrar? Aí eu te acompanho rumo a ela 🎯'; resultados = [{ id: 'meta', titulo: 'Definir minha meta', link: '/financeiro/metas' }] }
          else {
            const emoji = m.pct >= 100 ? '🎉 bateu a meta!' : m.pct >= 70 ? '💪 quase lá!' : 'dá pra chegar 💛'
            resposta = `Sua meta do mês é **${brl(m.metaReceita)}** e você já fez **${brl(m.realizado)}** — isso é **${m.pct}%** da meta. ${m.pct >= 100 ? emoji : `Faltam **${brl(m.falta)}** — ${emoji}`}`
            resultados = [{ id: 'meta', titulo: 'Ver minhas metas', link: '/financeiro/metas' }]
          }
        } else if (acao === 'dre') {
          const r = await dreResumo(workspaceId)
          if (r.receita <= 0 && r.despesaTotal <= 0) resposta = 'Ainda não tenho movimento esse mês pra montar seu DRE, amiga 🧡'
          else {
            const interp = r.receita <= 0 ? 'Sem receita recebida ainda esse mês.'
              : r.cmvPct >= 45 ? `Seu custo de material (CMV) tá em **${r.cmvPct}%** — pesado; vale pesquisar preço.`
              : `Seu CMV tá em **${r.cmvPct}%** e sua margem de contribuição em **${r.contribuicaoPct}%** — boa base!`
            resposta = `Teu resultado do mês, em linguagem de artesã 👇\n\n• Faturamento: **${brl(r.receita)}**\n• Custo do material (CMV): **${brl(r.cmv)}** (${r.cmvPct}%)\n• Margem de contribuição: **${brl(r.contribuicao)}** (${r.contribuicaoPct}%)\n• Todas as despesas: ${brl(r.despesaTotal)}\n• Resultado: **${brl(r.resultado)}** (margem ${r.margem}%)\n\n${interp}`
            resultados = [{ id: 'dre', titulo: 'Abrir o DRE completo', link: '/gestao/dre' }]
          }
        } else if (acao === 'conselho') {
          const cs = await gerarConselhos(workspaceId)
          if (cs.length === 0) {
            resposta = 'Olhei suas contas e tá tudo caminhando bem, amiga! 🧡 Nada de margem caindo, CMV alto ou caixa apertado. Continua assim 💪 Se quiser, te mostro um resumo do mês.'
            resultados = [{ id: 'fin', titulo: 'Ver meu resumo financeiro', link: '/financeiro' }]
          } else {
            resposta = `Amiga, olhei seus números e te trouxe uns pontos pra cuidar 👇\n\n${cs.map(c => `• ${c.texto}`).join('\n\n')}`
            resultados = cs.filter(c => c.link).map((c, i) => ({ id: 'c' + i, titulo: 'Ver isso', link: c.link! }))
          }
        } else if (acao === 'contar_pedidos') {
          const c = await contarPedidos(workspaceId, filtrosPedido(p), !!p.agruparSetor)
          if (c.porSetor?.length) {
            const linhas = c.porSetor.map(x => `• ${x.setor}: ${x.n}`).join('\n')
            resposta = `Você tem **${c.total}** pedido(s), distribuídos assim:\n${linhas}`
          } else resposta = `Você tem **${c.total}** pedido(s)${descFiltro(p)}. 🧡`
          if (c.total > 0 && !p.agruparSetor) { const r = await buscarPedidos(workspaceId, filtrosPedido(p)); resultados = r.itens; verTodos = r.verTodos }
        } else if (acao === 'localizar_pedido') {
          const r = await buscarPedidos(workspaceId, { cliente: p.cliente, numero: p.numero })
          if (r.total === 0) resposta = `Não encontrei esse pedido, amiga 😔 Quer que eu procure por outro nome ou número?`
          else if (r.itens.length === 1) {
            const it = r.itens[0]
            resposta = `O pedido${p.cliente ? ' da ' + p.cliente : ''} (${it.titulo.split(' · ')[0]}) está no setor **${it.setor || '—'}** 🧡`
            resultados = r.itens
          } else { resposta = `Achei ${r.total} pedidos — olha o setor de cada um 👇`; resultados = r.itens; verTodos = r.verTodos }
        } else { // listar_pedidos
          const r = await buscarPedidos(workspaceId, filtrosPedido(p))
          if (r.total === 0) resposta = `Não encontrei pedidos com esse filtro, amiga 😔 Quer tentar de outro jeito?`
          else { resposta = `Achei ${r.total} pedido(s)${descFiltro(p)}! 🧡 👇`; resultados = r.itens; verTodos = r.verTodos }
        }
      } catch (e) {
        console.error('[SOFIA DISPATCH]', (e as Error)?.message)
        resposta = 'Tentei buscar mas deu um probleminha aqui 😅 Tenta de novo? Se quiser, você acha tudo em Produção → Pedidos.'
      }
    }
    // ── COMO FAZ / CONVERSA / PRINT (IA + recuperação da base) ──
    else {
      usouIA = true
      let contexto = ''
      try { contexto = montarContextoConhecimento(await recuperarConhecimento(mensagem || 'ajuda com o que aparece na tela', 6)) } catch {}
      const lgpd = imagemBase64 ? '\n\nA usuária enviou um print da tela. Descreva só o que for útil pra ajudar; NUNCA repita dados pessoais que aparecerem (nomes de clientes, telefone, e-mail, CPF, endereço). Oriente o próximo passo.' : ''
      // Sofia ciente do LAYOUT: sabe onde a artesã pôs o menu e cita a posição REAL na orientação.
      let layout = ''
      try {
        const pos = await getMenuPos(session.user.id)
        const forma = ehHorizontal(pos) ? 'uma barra horizontal' : 'uma barra vertical na lateral'
        layout = `\n\nLAYOUT DA USUÁRIA (use na fala): O menu de navegação dela está posicionado ${menuPosLabel(pos)} — ${forma}. O módulo em que ela está agora fica DESTACADO em laranja nesse menu (com o item ativo realçado). Sempre que apontar onde algo fica, refira-se à posição REAL do menu (ex.: "olha ali no menu ${menuPosLabel(pos)}, tá destacado 🧡") e ao destaque do módulo ativo. NUNCA diga "menu à esquerda" se o menu dela não está à esquerda.`
      } catch {}
      const sys = `${SOFIA_TOM}\n${REGUA_RESPOSTA}${lgpd}${layout}${contexto}`
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

    return NextResponse.json({ resposta, tourId, resultados, verTodos, alertas })
  } catch (err: any) {
    console.error('[SOFIA CHAT]', err?.message ?? err)
    return NextResponse.json({ error: 'Deu um probleminha aqui 😅 Tenta de novo em instantes.' }, { status: 500 })
  }
}
