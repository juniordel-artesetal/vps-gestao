// Match-or-create de cliente no CRM a partir de dados digitados (orçamento/pedido).
// Reaproveita a MESMA lógica de dedupe do /api/clientes/match (por nome normalizado,
// desempate por telefone/e-mail). Só age quando o módulo Clientes está ligado.
// Nunca duplica: se achar equivalente, devolve o id existente; senão, cria.
import { prisma } from '@/lib/prisma'
import { normNome, soDigitos } from '@/lib/normNome'

function novoId() { return Math.random().toString(36).slice(2) + Date.now().toString(36) }

/**
 * Garante um Cliente no CRM para os dados informados e devolve o clienteId.
 * Retorna null quando não se aplica (módulo Clientes off ou sem nome).
 */
export async function garantirClienteCrm(
  workspaceId: string,
  dados: { nome?: string | null; telefone?: string | null; email?: string | null; origem?: string },
): Promise<string | null> {
  const nome = String(dados.nome ?? '').trim()
  if (!nome) return null

  // Só auto-cria/vincula quando a artesã usa o módulo Clientes.
  const [ws] = await prisma.$queryRaw`
    SELECT COALESCE("moduloClientes", false) AS "on" FROM "Workspace" WHERE "id" = ${workspaceId} LIMIT 1
  ` as { on: boolean }[]
  if (!ws?.on) return null

  const nomeN = normNome(nome)
  const tel = soDigitos(dados.telefone)
  const email = String(dados.email ?? '').trim().toLowerCase()

  // Candidatos ativos (mesma base do /api/clientes/match).
  const clientes = await prisma.$queryRaw`
    SELECT "id","nome","telefone","email" FROM "Cliente"
    WHERE "workspaceId" = ${workspaceId} AND "ativo" = true
  ` as { id: string; nome: string; telefone: string | null; email: string | null }[]

  const mesmoNome = clientes.filter(c => normNome(c.nome) === nomeN)
  if (mesmoNome.length === 1) return mesmoNome[0].id
  if (mesmoNome.length > 1) {
    // Vários com o mesmo nome → desempata por telefone, depois e-mail; senão reusa
    // o primeiro (não duplica; a artesã pode organizar depois na aba Clientes).
    const porTel = tel ? mesmoNome.filter(c => soDigitos(c.telefone) === tel) : []
    if (porTel.length >= 1) return porTel[0].id
    const porEmail = email ? mesmoNome.filter(c => String(c.email ?? '').trim().toLowerCase() === email) : []
    if (porEmail.length >= 1) return porEmail[0].id
    return mesmoNome[0].id
  }

  // Nenhum equivalente → cria o cliente no CRM com os dados informados.
  const id = novoId()
  await prisma.$executeRaw`
    INSERT INTO "Cliente" ("id","workspaceId","nome","email","telefone","origem","ativo","createdAt","updatedAt")
    VALUES (${id}, ${workspaceId}, ${nome}, ${email || null}, ${dados.telefone ? String(dados.telefone).trim() : null}, ${dados.origem ?? 'orcamento'}, true, NOW(), NOW())
  `
  return id
}
