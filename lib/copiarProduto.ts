import { prisma } from '@/lib/prisma'

// Cópia fiel de um produto da Precificação (variações + materiais + qtdKit + custos +
// preço), trocando apenas o NOME. Fonte única usada pela rota "copiar" e pela criação
// por cópia na importação. Só dentro do MESMO workspace. NUNCA SELECT *.
function gid() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

// qtdKitOverride (opcional): quando a planilha traz a quantidade do pacote (ex.: "36 unidades",
// ",42"), grava esse qtdKit (e isKit=true) na cópia — em vez de herdar o da base. Sem override,
// a cópia é 100% fiel à base (qtdKit/isKit inclusive).
export async function copiarProduto(opts: { workspaceId: string; baseId: string; novoNome: string; qtdKitOverride?: number | null }):
  Promise<{ novoProdutoId: string; variacaoIds: string[]; nome: string } | null> {
  const { workspaceId, baseId, novoNome } = opts
  const override = opts.qtdKitOverride != null && Number(opts.qtdKitOverride) > 0 ? Math.floor(Number(opts.qtdKitOverride)) : null

  const [orig] = await prisma.$queryRaw`
    SELECT "id","nome","sku","categoria" FROM "PrecProduto"
    WHERE "id" = ${baseId} AND "workspaceId" = ${workspaceId} LIMIT 1
  ` as any[]
  if (!orig) return null

  const nome = String(novoNome || '').trim() || `${orig.nome} (cópia)`
  const novoProdutoId = gid()
  await prisma.$executeRaw`
    INSERT INTO "PrecProduto" ("id","workspaceId","nome","sku","categoria","ativo","createdAt","updatedAt")
    VALUES (${novoProdutoId}, ${workspaceId}, ${nome}, ${orig.sku ? orig.sku + '-copia' : null}, ${orig.categoria ?? null}, true, NOW(), NOW())
  `

  const variacoes = await prisma.$queryRaw`
    SELECT "id","nome","tipo","isKit","canal","subOpcao","qtdKit",
           "custoMaterial","custoMaoObra","custoEmbalagem","custoArte","custoTotal",
           "impostos","precoVenda","emPromo","descontoPct","precoPromocional","peso"
    FROM "PrecVariacao" WHERE "produtoId" = ${baseId}
  ` as any[]

  const variacaoIds: string[] = []
  for (const v of variacoes) {
    const novaVarId = gid()
    variacaoIds.push(novaVarId)
    await prisma.$executeRaw`
      INSERT INTO "PrecVariacao" (
        "id","produtoId","nome","tipo","isKit","canal","subOpcao","qtdKit",
        "custoMaterial","custoMaoObra","custoEmbalagem","custoArte","custoTotal",
        "impostos","precoVenda","emPromo","descontoPct","precoPromocional","metaVendas","peso"
      ) VALUES (
        ${novaVarId}, ${novoProdutoId},
        ${v.nome ?? null}, ${v.tipo ?? 'UNITARIO'}, ${override != null ? true : (v.isKit ?? false)},
        ${v.canal ?? 'shopee'}, ${v.subOpcao ?? 'classico'}, ${override != null ? override : Number(v.qtdKit ?? 1)},
        ${Number(v.custoMaterial ?? 0)}, ${Number(v.custoMaoObra ?? 0)},
        ${Number(v.custoEmbalagem ?? 0)}, ${Number(v.custoArte ?? 0)},
        ${Number(v.custoTotal ?? 0)}, ${Number(v.impostos ?? 0)},
        ${Number(v.precoVenda ?? 0)}, ${v.emPromo ?? false},
        ${v.descontoPct ? Number(v.descontoPct) : null},
        ${v.precoPromocional ? Number(v.precoPromocional) : null},
        null, ${v.peso ? Number(v.peso) : null}
      )
    `
    const materiais = await prisma.$queryRaw`
      SELECT "materialId","nomeMaterial","qtdUsada","custoUnit","rendimento"
      FROM "PrecMaterialItem" WHERE "variacaoId" = ${v.id}
    ` as any[]
    for (const m of materiais) {
      await prisma.$executeRaw`
        INSERT INTO "PrecMaterialItem" ("id","variacaoId","materialId","nomeMaterial","qtdUsada","custoUnit","rendimento")
        VALUES (${gid()}, ${novaVarId}, ${m.materialId ?? null}, ${m.nomeMaterial ?? ''}, ${Number(m.qtdUsada ?? 0)}, ${Number(m.custoUnit ?? 0)}, ${Number(m.rendimento ?? 1)})
      `
    }
  }

  return { novoProdutoId, variacaoIds, nome }
}
