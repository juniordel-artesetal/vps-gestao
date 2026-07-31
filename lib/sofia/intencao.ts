// ─────────────────────────────────────────────────────────────────────────────
// CAMADA DE INTENÇÃO DA SOFIA — a IA ENTENDE a pergunta e escolhe a ferramenta +
// FILTROS estruturados. NUNCA busca literal por texto.
//
// A IA recebe: a pergunta + as últimas mensagens (MEMÓRIA) + o contexto real do
// workspace (setores existentes, resumo dos alertas). Devolve SÓ um JSON com a ação
// e os parâmetros. Se estiver ambíguo, devolve uma pergunta curta de esclarecimento
// (nunca "não achei"). O backend é quem executa a query e monta os links reais.
// ─────────────────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.ANTHROPIC_API_KEY_GESTAO! // (é uma chave Google, nome legado)

export type AcaoSofia =
  | 'listar_pedidos' | 'contar_pedidos' | 'localizar_pedido'
  | 'listar_clientes' | 'listar_financeiro' | 'soma_financeiro'
  | 'resumo_financeiro' | 'maiores_despesas' | 'meta' | 'dre' | 'conselho'
  | 'estoque_baixo' | 'alertas' | 'preco_material'
  | 'como_faz' | 'conversa' | 'ambiguo'

export interface Intencao {
  acao: AcaoSofia
  parametros: {
    cliente?: string; produto?: string; numero?: string; setor?: string
    statusPedido?: string; canal?: string; periodo?: 'hoje' | 'amanha' | 'semana' | 'mes'
    semData?: boolean; naoEnviados?: boolean; atrasados?: boolean; ordenar?: 'antigos' | 'recentes'
    agruparSetor?: boolean
    statusFin?: 'vencido' | 'vence_hoje' | 'a_vencer' | 'pago' | 'a_receber' | 'a_pagar'
    termoFinanceiro?: string; material?: string
  }
  clarificar?: string
}

const ACOES: AcaoSofia[] = ['listar_pedidos', 'contar_pedidos', 'localizar_pedido', 'listar_clientes', 'listar_financeiro', 'soma_financeiro', 'resumo_financeiro', 'maiores_despesas', 'meta', 'dre', 'conselho', 'estoque_baixo', 'alertas', 'preco_material', 'como_faz', 'conversa', 'ambiguo']

const SCHEMA = {
  type: 'object',
  properties: {
    acao: { type: 'string', enum: ACOES },
    parametros: {
      type: 'object',
      properties: {
        cliente: { type: 'string' }, produto: { type: 'string' }, numero: { type: 'string' },
        setor: { type: 'string' }, statusPedido: { type: 'string' }, canal: { type: 'string' },
        periodo: { type: 'string', enum: ['hoje', 'amanha', 'semana', 'mes'] },
        semData: { type: 'boolean' }, naoEnviados: { type: 'boolean' }, atrasados: { type: 'boolean' },
        ordenar: { type: 'string', enum: ['antigos', 'recentes'] }, agruparSetor: { type: 'boolean' },
        statusFin: { type: 'string', enum: ['vencido', 'vence_hoje', 'a_vencer', 'pago', 'a_receber', 'a_pagar'] },
        termoFinanceiro: { type: 'string' }, material: { type: 'string' },
      },
    },
    clarificar: { type: 'string' },
  },
  required: ['acao'],
}

export interface ContextoIntencao { setores: string[]; alertasResumo: string }

function systemPrompt(ctx: ContextoIntencao): string {
  const setores = ctx.setores.length ? ctx.setores.join(', ') : '(nenhum setor configurado)'
  return `Você é o CLASSIFICADOR DE INTENÇÃO da Sofia, assistente de uma artesã no sistema SOA. NÃO responda à artesã; apenas devolva um JSON com a AÇÃO e os PARÂMETROS estruturados. Outro sistema executa a busca real.

REGRAS:
- NUNCA use a frase da artesã como termo de busca. Extraia só valores específicos: nome de cliente, nome de produto, número do pedido, nome de material.
- Escolha UMA ação:
  • listar_pedidos / contar_pedidos: sobre pedidos. Use filtros: cliente, produto, numero, statusPedido (ABERTO=aguardando, EM_PRODUCAO=fazendo, PRONTO=prontos p/ enviar, ENVIADO=enviados/saíram, CANCELADO), setor, canal (Shopee, Mercado Livre...), periodo (hoje/amanha/semana/mes sobre a data de envio), semData (sem data de envio), naoEnviados (ainda não saíram), atrasados, ordenar (antigos/recentes). Para "quantos ... por setor" use agruparSetor:true. Para contagem use contar_pedidos; para ver a lista, listar_pedidos.
  • localizar_pedido: quando ela quer ABRIR/saber onde está um pedido específico (por cliente ou número) — ex.: "o pedido da Bruna está em que setor?". Preencha cliente ou numero.
  • listar_clientes: buscar/achar uma cliente (parametro cliente = nome ou telefone).
  • listar_financeiro: contas/lançamentos. statusFin OBRIGATÓRIO: vencido (venceu, atrasada), vence_hoje (vence hoje), a_vencer (vai vencer), a_pagar (a pagar em aberto), a_receber, pago. periodo opcional. termoFinanceiro SÓ para uma conta específica pelo nome (ex.: "conta de luz" → termoFinanceiro:"luz").
  • soma_financeiro: TOTAL de CONTAS/lançamentos a pagar/receber (ex.: "quanto tenho a pagar essa semana" → statusFin:a_pagar, periodo:semana; "quanto vou receber esse mês" → a_receber, mes).
  • resumo_financeiro: análise do MÊS — faturamento/receita, resultado, LUCRO, margem, saldo em caixa, ticket médio, "estou tendo lucro?", "tô no vermelho ou no azul?", "meu negócio está saudável?", "melhorei em relação ao mês passado?", "me dá um resumo financeiro". (É o P&L do mês, não a lista de contas.)
  • maiores_despesas: "onde gasto mais", "com o que mais gastei", "minha maior despesa", "onde vai meu dinheiro".
  • meta: "bati minha meta", "quanto falta pra meta", "como está minha meta do mês".
  • dre: "meu DRE", "meu CMV", "explica meu DRE", "minha margem de contribuição", "meu lucro real", "resultado do mês (detalhado)".
  • conselho: pede orientação/análise proativa — "me dá um conselho (financeiro)", "como melhoro meu lucro/margem", "o que devo priorizar hoje", "vendo mas não sobra dinheiro", "me ajuda a organizar minhas finanças", "meu negócio vai bem?". Responde com base nos dados dela.
  • estoque_baixo: materiais acabando/abaixo do mínimo.
  • preco_material: preço médio/cotação de um material (parametro material).
  • alertas: "o que preciso resolver hoje", "tá tudo certo", resumo do dia.
  • como_faz: "como faço/como funciona" (tutorial). Só quando ela pede COMO fazer algo.
  • conversa: cumprimento, desabafo, agradecimento, papo — sem pedir dado.
  • ambiguo: quando falta informação pra escolher o filtro. Preencha "clarificar" com UMA pergunta curta e gentil (ex.: "Você quer as contas vencidas, as que vencem hoje ou as a vencer? 😊"). NUNCA responda "não achei".
- SINÔNIMOS de setor desta artesã (mapeie o que ela falar para o nome real): ${setores}. Ex.: "em artes"/"na arte" → o setor cujo nome tem "Arte".
- MEMÓRIA: use as mensagens anteriores. Follow-ups como "quais são?", "me mostra elas", "e os prontos?", "e da Ana?", "abre o primeiro" referem-se ao que já foi falado — herde os filtros anteriores trocando só o que mudou. Ignore agradecimentos no meio ("obrigada, e as vencidas?").
- Erros de digitação e linguagem de leiga são normais ("pedidu atrazado" = pedidos atrasados; "conta q venceu" = vencidas). Entenda a intenção.
- Contexto atual de alertas desta artesã: ${ctx.alertasResumo || 'sem alertas'}.

Responda SOMENTE o JSON.`
}

/** Classifica a intenção. Retorna null se a IA falhar (o caller então pede esclarecimento — nunca busca literal). */
export async function classificarIntencao(mensagem: string, historico: any[], ctx: ContextoIntencao): Promise<Intencao | null> {
  if (!GEMINI_API_KEY) return null
  const contents = [
    ...historico.slice(-6).map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: String(h.content || '').slice(0, 500) }] })),
    { role: 'user', parts: [{ text: mensagem }] },
  ]
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt(ctx) }] },
        contents,
        generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    })
    if (!res.ok) { console.error('[SOFIA-INTENCAO] Gemini', res.status); return null }
    const data = await res.json()
    const txt = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!txt) return null
    const obj = JSON.parse(txt)
    if (!ACOES.includes(obj.acao)) return null
    return { acao: obj.acao, parametros: obj.parametros || {}, clarificar: obj.clarificar }
  } catch (e) {
    console.error('[SOFIA-INTENCAO]', (e as Error)?.message)
    return null
  }
}
