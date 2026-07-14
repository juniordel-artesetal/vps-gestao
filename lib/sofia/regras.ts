// Dicas proativas da Sofia — regras DETERMINÍSTICAS avaliadas por rota + estado do workspace.
// Sem dado pessoal. A Sofia SUGERE, nunca bloqueia. Máx. 1 dica por contexto; a mais relevante.
// Regras de estado de FORMULÁRIO (produto texto livre, m² sem largura) são de página e entram
// quando as telas puderem reportar o estado; aqui ficam as regras data-driven (server-side).
import { prisma } from '@/lib/prisma'

export interface DicaSofia {
  id: string
  texto: string
  cta?: { label: string; href: string }
  tourId?: string
}

async function existe(sql: Promise<any[]>): Promise<boolean> {
  try { const r = await sql; return Array.isArray(r) && r.length > 0 } catch { return false }
}

// Avalia a dica mais relevante para a rota atual (ou null). Idempotência/"não repetir"
// é tratada pelo chamador (SofiaConfig.dicasVistas).
export async function avaliarContexto(rota: string, workspaceId: string): Promise<DicaSofia | null> {
  const r = rota || ''

  // 7. Conta vazia — sem nenhum produto cadastrado (primeiro passo)
  if (r.startsWith('/dashboard') || r.startsWith('/precificacao/produtos') || r === '/modulos') {
    const temProduto = await existe(prisma.$queryRaw`SELECT 1 FROM "PrecProduto" WHERE "workspaceId" = ${workspaceId} LIMIT 1` as any)
    if (!temProduto) {
      return {
        id: 'conta_vazia_primeiro_produto',
        texto: 'Bora dar o primeiro passo, querida? Cadastrar seu primeiro produto leva uns 2 minutinhos — e a partir dele o sistema já calcula seu preço e seu lucro. Quero te acompanhar?',
        tourId: 'precificar_produto',
      }
    }
  }

  // 3. Pedidos presos em "Prontos" e nenhum setor de Expedição marcado
  if (r.startsWith('/dashboard')) {
    const temConcluido = await existe(prisma.$queryRaw`
      SELECT 1 FROM "Order" WHERE "workspaceId" = ${workspaceId} AND "status" ILIKE 'conclu%' LIMIT 1` as any)
    if (temConcluido) {
      const temExpedicao = await existe(prisma.$queryRaw`
        SELECT 1 FROM "SetorConfig" WHERE "workspaceId" = ${workspaceId} AND COALESCE("ehExpedicao", false) = true LIMIT 1` as any)
      if (!temExpedicao) {
        return {
          id: 'pedidos_presos_sem_expedicao',
          texto: 'Achei pedidos parados em "Prontos" e nenhum setor de Expedição marcado — por isso eles não saem sozinhos como "Enviado". Quer que eu te leve pra ajeitar? É rapidinho.',
          cta: { label: 'Ir para Config → Produção', href: '/config/producao' },
        }
      }
    }
    // 4. Cobertura do "Resultado das vendas" baixa — pedidos sem vínculo à Precificação
    const semVinculo = await existe(prisma.$queryRaw`
      SELECT 1 FROM "Order"
      WHERE "workspaceId" = ${workspaceId} AND "status" <> 'CANCELADO'
        AND ("camposExtras" IS NULL OR "camposExtras" NOT LIKE '%variacaoId%')
      LIMIT 1` as any)
    if (semVinculo) {
      return {
        id: 'cobertura_resultado_baixa',
        texto: 'Seu painel de lucro tá incompleto porque alguns pedidos não estão ligados aos seus produtos da Precificação. Te levo pra vincular tudo de uma vez? Assim o resultado fica certinho.',
        cta: { label: 'Vincular pedidos', href: '/precificacao/vincular-pedidos' },
      }
    }
  }

  // 6. Material com estoque no mínimo ou abaixo
  if (r.startsWith('/precificacao/materiais') || r.startsWith('/precificacao/estoque') || r.startsWith('/dashboard/estoque')) {
    try {
      const [baixo] = await prisma.$queryRaw`
        SELECT m."nome" AS "nome"
        FROM "EstMaterialSaldo" es JOIN "PrecMaterial" m ON m."id" = es."materialId"
        WHERE es."workspaceId" = ${workspaceId} AND es."estoqueMinimo" IS NOT NULL AND es."saldoAtual" <= es."estoqueMinimo"
        ORDER BY es."saldoAtual" ASC LIMIT 1` as any[]
      if (baixo?.nome) {
        return {
          id: 'estoque_material_baixo',
          texto: `Seu "${baixo.nome}" tá acabando 📉 Quer registrar uma compra pra não faltar no meio de um pedido?`,
          cta: { label: 'Abrir estoque de materiais', href: '/precificacao/estoque-materiais' },
        }
      }
    } catch {}
  }

  // 9. Precificação sem nenhum canal de venda cadastrado (preço sai sem a taxa certa)
  if (r.startsWith('/precificacao')) {
    const temProdutoP = await existe(prisma.$queryRaw`SELECT 1 FROM "PrecProduto" WHERE "workspaceId" = ${workspaceId} LIMIT 1` as any)
    if (temProdutoP) {
      const temCanal = await existe(prisma.$queryRaw`SELECT 1 FROM "PrecCanal" WHERE "workspaceId" = ${workspaceId} LIMIT 1` as any)
      if (!temCanal) {
        return {
          id: 'precificacao_sem_canais',
          texto: 'Vi que você já tem produto, mas ainda não cadastrou nenhum canal de venda (Shopee, Elo7, Venda Direta…). Sem o canal e a taxa dele, o preço sai sem contar o que a plataforma fica. Quer configurar? É rapidinho.',
          cta: { label: 'Canais de Venda', href: '/precificacao/canais' },
        }
      }
    }
  }

  // 10. Produção sem setores configurados (o fluxo não anda)
  if (r.startsWith('/dashboard') || r.startsWith('/config/producao')) {
    const temSetor = await existe(prisma.$queryRaw`SELECT 1 FROM "Setor" WHERE "workspaceId" = ${workspaceId} LIMIT 1` as any)
    if (!temSetor) {
      return {
        id: 'producao_sem_setores',
        texto: 'Sua produção ainda não tem setores (as etapas por onde o pedido passa, tipo Corte → Montagem → Expedição). Sem eles, o pedido não tem por onde andar. Quer que eu te leve pra criar os seus?',
        cta: { label: 'Configurar setores', href: '/config/producao' },
      }
    }
  }

  // 5. Loja ativa mas vitrine vazia (nenhuma variação visível)
  if (r.startsWith('/minha-loja') || r.startsWith('/config/loja')) {
    const lojaAtiva = await existe(prisma.$queryRaw`SELECT 1 FROM "LojaConfig" WHERE "workspaceId" = ${workspaceId} AND "ativo" = true LIMIT 1` as any)
    if (lojaAtiva) {
      const temVitrine = await existe(prisma.$queryRaw`
        SELECT 1 FROM "PrecVariacao" v JOIN "PrecProduto" p ON p."id" = v."produtoId"
        WHERE p."workspaceId" = ${workspaceId} AND COALESCE(v."visivelLoja", false) = true LIMIT 1` as any)
      if (!temVitrine) {
        return {
          id: 'loja_ativa_sem_vitrine',
          texto: 'Sua loja tá no ar, mas a vitrine tá vazia 🛒 Quer que eu te mostre como escolher os produtos que vão aparecer pra cliente?',
          cta: { label: 'Montar a vitrine', href: '/config/loja/vitrine' },
          tourId: 'montar_loja',
        }
      }
    }
  }

  return null
}
