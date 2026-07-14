import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { BASE_CONHECIMENTO } from '@/lib/suporte/baseConhecimento'

export const dynamic = 'force-dynamic'

function gerarId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// Dúvidas comuns → SuporteFaq (idempotente por pergunta). Cobre os temas de maior atrito.
const FAQ_SEED: { categoria: string; pergunta: string; resposta: string }[] = [
  { categoria: 'Loja', pergunta: 'Como monto minha loja virtual?', resposta: 'Ative em Config → Geral → Módulos (ligue "Minha Loja"). Depois vá em Config → Loja Virtual: ligue "Loja ativa", escolha o Link da loja, suba logo/banner, defina a fonte do catálogo e o frete, e clique em "Salvar loja". Marque os produtos como "visível na loja" em Precificação → Produtos. Copie o link e divulgue.' },
  { categoria: 'Produção', pergunta: 'Por que meu pedido fica preso em Prontos (não sai do setor)?', resposta: 'Geralmente o setor onde ele está foi excluído, deixando o pedido "preso". Abra o pedido → painel "Fluxo de Produção" → "Mover para outro setor" → escolha o setor certo → Mover. Dica: nunca exclua um setor que tenha pedidos dentro; mova-os antes.' },
  { categoria: 'Precificação', pergunta: 'Como precifico tecido por metro quadrado (m²)?', resposta: 'Em Precificação → Materiais, escolha a unidade "m²" e informe o preço por metro e a largura do tecido (ou o preço do rolo e os metros). O sistema calcula o preço/m². No produto, use "calcular por medidas" (altura × largura) para preencher a área usada e ver o custo do retalho.' },
  { categoria: 'Importação', pergunta: 'Como importo meus pedidos da Shopee?', resposta: 'Em Produção → Pedidos → "Importar planilha". Exporte da Shopee (Meus Pedidos → Exportar → "A Enviar") e suba o arquivo — o sistema detecta o formato Shopee sozinho. Confira o preview (é sempre manual) e confirme. Limite de 500 por importação.' },
  { categoria: 'Financeiro', pergunta: 'Onde vejo meu lucro?', resposta: 'Na Visão Geral, o painel "Resultado das vendas" estima Vendas, Taxas, Custo de materiais e Lucro do mês (a partir da sua precificação — é estimativa, não o caixa). O caixa real está no Financeiro. Para os pedidos entrarem no cálculo, vincule-os à Precificação (ou use "Vincular pedidos à Precificação").' },
  { categoria: 'Orçamentos', pergunta: 'Como dou desconto e frete no orçamento?', resposta: 'Ao montar o orçamento, cada item tem o campo Desconto (em R$ ou %) e no resumo você informa o Frete. O Total mostra Subtotal · Desconto · Frete · Total, e isso aparece na página que a cliente abre. Ao aprovar, vira pedido com o valor final.' },
  { categoria: 'Clientes', pergunta: 'Como cadastro ou importo meus clientes?', resposta: 'Ative o módulo em Config → Geral. Em Clientes → Clientes use "Novo cliente" (só o Nome é obrigatório) ou "Importar planilha" (baixe o modelo; ele não duplica). Veja os números em Clientes → Visão Geral.' },
  { categoria: 'Tarefas', pergunta: 'Como uso o quadro de Tarefas (Kanban)?', resposta: 'Ative em Config → Geral. Em Tarefas → Quadros crie um quadro (já vem com colunas), depois "+ Nova tarefa" na coluna e arraste os cards entre colunas. No card você põe prazo, responsável, etiquetas, checklist, fotos e comentários (@ menciona a equipe).' },
  { categoria: 'Assistente de Compras', pergunta: 'Como sei se estou pagando caro num material?', resposta: 'Ative o Assistente de Compras em Config → Geral. Em Assistente de Compras → Pesquisar preço, digite o material para ver a faixa de mercado, ou use "Ver meus preços vs mercado" para ver onde você paga acima da média. Você também pode "Seguir" um material e ser avisada no sino quando o preço cair.' },
  { categoria: 'Produção', pergunta: 'Posso criar status de pedido personalizados?', resposta: 'Não. Os status são fixos: ABERTO, EM PRODUÇÃO, CONCLUÍDO, ENVIADO e CANCELADO. O que você personaliza são os SETORES (Config → Produção) — as etapas por onde o pedido passa. O setor com "expedi" no nome envia o pedido automaticamente ao ser concluído.' },
  { categoria: 'Estoque', pergunta: 'O sistema tem controle de estoque?', resposta: 'Sim. Ative em Config → Geral → Módulos ("Estoque de Produtos"). Você controla materiais (Precificação → Estoque de Materiais) e produtos prontos (Produção → Estoque de Produtos), com saldo e alerta de estoque mínimo. Se não aparecer após salvar, recarregue a página (F5).' },
  { categoria: 'Financeiro', pergunta: 'Os "Números do Marketplace" mexem no meu caixa?', resposta: 'Não. É só previsão e análise dos pedidos da Shopee (taxas, líquido estimado, margem, previsão de recebimento). Nunca cria lançamento no Financeiro. Ative em Financeiro → Números do Marketplace (só administradora).' },
]

// Master (cookie master_token OU header x-master-token = MASTER_SECRET_TOKEN)
async function autorizado(req: NextRequest): Promise<boolean> {
  const seg = process.env.MASTER_SECRET_TOKEN
  if (!seg) return false
  if (req.headers.get('x-master-token') === seg) return true
  const c = await cookies()
  return c.get('master_token')?.value === seg
}

// GET — status: quantas entradas há na base.
export async function GET(req: NextRequest) {
  if (!await autorizado(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const [row] = await prisma.$queryRaw`SELECT COUNT(*)::int AS "total" FROM "SuporteConhecimento" WHERE "ativo" = true` as any[]
  return NextResponse.json({ totalAtivo: Number(row?.total || 0), naBase: BASE_CONHECIMENTO.length })
}

// POST — (re)gera a base de conhecimento (upsert por slug, idempotente).
// Desativa entradas antigas que saíram da base e reativa/atualiza as atuais.
export async function POST(req: NextRequest) {
  if (!await autorizado(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let inseridos = 0, atualizados = 0
  const slugsAtuais: string[] = []

  for (const e of BASE_CONHECIMENTO) {
    slugsAtuais.push(e.slug)
    const [ex] = await prisma.$queryRaw`SELECT "id" FROM "SuporteConhecimento" WHERE "slug" = ${e.slug} LIMIT 1` as any[]
    if (ex) {
      await prisma.$executeRaw`
        UPDATE "SuporteConhecimento"
        SET "modulo" = ${e.modulo}, "titulo" = ${e.titulo}, "caminho" = ${e.caminho},
            "conteudo" = ${e.conteudo}, "palavrasChave" = ${e.palavrasChave},
            "ativo" = true, "updatedAt" = NOW()
        WHERE "slug" = ${e.slug}
      `
      atualizados++
    } else {
      await prisma.$executeRaw`
        INSERT INTO "SuporteConhecimento" ("id","slug","modulo","titulo","caminho","conteudo","palavrasChave","ativo","createdAt","updatedAt")
        VALUES (${gerarId()}, ${e.slug}, ${e.modulo}, ${e.titulo}, ${e.caminho}, ${e.conteudo}, ${e.palavrasChave}, true, NOW(), NOW())
      `
      inseridos++
    }
  }

  // Desativa o que saiu da base (não apaga — preserva histórico)
  const desativados = await prisma.$executeRaw`
    UPDATE "SuporteConhecimento" SET "ativo" = false, "updatedAt" = NOW()
    WHERE "slug" IS NOT NULL AND NOT ("slug" = ANY(${slugsAtuais}::text[])) AND "ativo" = true
  `

  // FAQ (idempotente por pergunta): FAQ_SEED curado + as perguntas de cada entrada da base
  const faqTodas = [
    ...FAQ_SEED,
    ...BASE_CONHECIMENTO.flatMap((e: any) => (Array.isArray(e.faq) ? e.faq.map((f: any) => ({ categoria: e.modulo || 'Geral', pergunta: f.pergunta, resposta: f.resposta })) : [])),
  ].filter(f => f && f.pergunta && f.resposta)

  let faqNovas = 0
  for (const f of faqTodas) {
    const [ex] = await prisma.$queryRaw`SELECT "id" FROM "SuporteFaq" WHERE "pergunta" = ${f.pergunta} LIMIT 1` as any[]
    if (ex) {
      await prisma.$executeRaw`UPDATE "SuporteFaq" SET "categoria" = ${f.categoria}, "resposta" = ${f.resposta}, "ativo" = true WHERE "id" = ${ex.id}`
    } else {
      await prisma.$executeRaw`
        INSERT INTO "SuporteFaq" ("id","categoria","pergunta","resposta","ordem","ativo","createdAt")
        VALUES (${gerarId()}, ${f.categoria}, ${f.pergunta}, ${f.resposta}, 0, true, NOW())
      `
      faqNovas++
    }
  }

  return NextResponse.json({ ok: true, inseridos, atualizados, desativados: Number(desativados) || 0, total: BASE_CONHECIMENTO.length, faqNovas })
}
