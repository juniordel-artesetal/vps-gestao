// ══════════════════════════════════════════════════════════════
// Destino: app/api/notificacoes/route.ts
// Instrução: Adicionar o bloco abaixo DENTRO do GET handler,
//            logo após os alertas de lançamentos financeiros
//            e antes do return final.
// ══════════════════════════════════════════════════════════════
//
// BUSCAR no arquivo a linha que monta o array de notificações
// e adicionar este bloco ANTES do return:

// ── Estoque de Materiais — zerados e abaixo do mínimo ─────────
const estoqueBaixo = await prisma.$queryRaw`
  SELECT
    em."materialNome",
    em."saldo",
    em."minimo",
    em."unidade"
  FROM "EstoqueMaterial" em
  WHERE em."workspaceId" = ${workspaceId}
    AND em."ativo" = true
    AND em."minimo" IS NOT NULL
    AND em."saldo" <= em."minimo"
  ORDER BY em."saldo" ASC
  LIMIT 5
` as any[]

for (const e of estoqueBaixo) {
  const saldo  = Number(e.saldo)
  const minimo = Number(e.minimo)
  const zerado = saldo <= 0

  notificacoes.push({
    tipo:      zerado ? 'estoque_zerado' : 'estoque_baixo',
    urgencia:  zerado ? 'critica' : 'alta',
    titulo:    zerado
      ? `Estoque zerado: ${e.materialNome}`
      : `Estoque baixo: ${e.materialNome}`,
    descricao: zerado
      ? `Sem unidades em estoque.`
      : `Saldo: ${saldo.toLocaleString('pt-BR')} ${e.unidade || ''} (mínimo: ${minimo.toLocaleString('pt-BR')})`,
    href: '/precificacao/estoque-materiais',
  })
}

// ══════════════════════════════════════════════════════════════
// ATENÇÃO: O nome da tabela pode variar.
// Verifique no banco do Neon qual é o nome exato da tabela
// de estoque de materiais (ex: EstoqueMaterial, MatEstoque, etc)
// e ajuste a query acima.
// ══════════════════════════════════════════════════════════════
