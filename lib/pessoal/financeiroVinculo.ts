// Vínculo Financeiro (ateliê) → item PESSOAL (tarefa/agenda e/ou nota) do usuário que salva.
// A flag no lançamento cria/atualiza/remove um item pessoal AUTOMÁTICO e IDEMPOTENTE por
// (userId, origemTipo='financeiro', origemId=FinLancamento.id). Calendário e Tarefa são a
// MESMA PessoalTarefa: uma tarefa COM prazo já aparece na agenda — por isso 1 flag "agenda".
// Best-effort: NUNCA lança (não pode derrubar o salvamento do lançamento) — loga e segue.
import { prisma } from '@/lib/prisma'
import { ensurePessoalTables } from './schema'
import { assinaturaAtiva } from './assinatura'

const ORIGEM = 'financeiro'
const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const brl = (n: number) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export async function sincronizarVinculoPessoal(p: {
  userId: string; lancamentoId: string
  descricao: string; valor: number; data: string | null; tipo: string
  agenda: boolean; nota: boolean
}): Promise<void> {
  try {
    // Sem o add-on Pessoal ativo → não cria nada (a flag nem deveria ter aparecido).
    if (!(await assinaturaAtiva(p.userId))) return
    await ensurePessoalTables()

    const titulo = `${String(p.descricao || '').trim()} — ${brl(p.valor)}`.slice(0, 200)
    const dataDate = p.data && /^\d{4}-\d{2}-\d{2}/.test(String(p.data)) ? String(p.data).slice(0, 10) : null

    // ── TAREFA / AGENDA (PessoalTarefa com prazo = já aparece no calendário) ──
    const [t] = await prisma.$queryRaw`
      SELECT "id" FROM "PessoalTarefa"
      WHERE "userId" = ${p.userId} AND "origemTipo" = ${ORIGEM} AND "origemId" = ${p.lancamentoId} LIMIT 1
    ` as { id: string }[]
    if (p.agenda) {
      if (t) {
        await prisma.$executeRaw`UPDATE "PessoalTarefa" SET "titulo" = ${titulo}, "prazo" = ${dataDate}::date WHERE "id" = ${t.id}`
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PessoalTarefa" ("id","userId","titulo","prazo","status","origemTipo","origemId")
          VALUES (${gid()}, ${p.userId}, ${titulo}, ${dataDate}::date, 'PENDENTE', ${ORIGEM}, ${p.lancamentoId})`
      }
    } else if (t) {
      await prisma.$executeRaw`DELETE FROM "PessoalTarefa" WHERE "id" = ${t.id}`
    }

    // ── NOTA ──
    const corpo = `${p.tipo === 'RECEITA' ? 'A receber' : 'A pagar'}: ${brl(p.valor)}${dataDate ? ` · vencimento ${dataDate}` : ''}`
    const [n] = await prisma.$queryRaw`
      SELECT "id" FROM "PessoalNota"
      WHERE "userId" = ${p.userId} AND "origemTipo" = ${ORIGEM} AND "origemId" = ${p.lancamentoId} LIMIT 1
    ` as { id: string }[]
    if (p.nota) {
      if (n) {
        await prisma.$executeRaw`UPDATE "PessoalNota" SET "titulo" = ${p.descricao}, "conteudo" = ${corpo}, "resumo" = ${corpo}, "updatedAt" = NOW() WHERE "id" = ${n.id}`
      } else {
        await prisma.$executeRaw`
          INSERT INTO "PessoalNota" ("id","userId","titulo","conteudo","resumo","origemTipo","origemId")
          VALUES (${gid()}, ${p.userId}, ${p.descricao}, ${corpo}, ${corpo}, ${ORIGEM}, ${p.lancamentoId})`
      }
    } else if (n) {
      await prisma.$executeRaw`DELETE FROM "PessoalNota" WHERE "id" = ${n.id}`
    }
  } catch (e) {
    console.error('[pessoal-vinculo] sincronizar falhou (ignorado):', (e as Error)?.message)
  }
}

// Remove os itens pessoais vinculados quando o lançamento é excluído.
export async function removerVinculoPessoal(userId: string, lancamentoId: string): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM "PessoalTarefa" WHERE "userId" = ${userId} AND "origemTipo" = ${ORIGEM} AND "origemId" = ${lancamentoId}`
    await prisma.$executeRaw`DELETE FROM "PessoalNota"   WHERE "userId" = ${userId} AND "origemTipo" = ${ORIGEM} AND "origemId" = ${lancamentoId}`
  } catch (e) {
    console.error('[pessoal-vinculo] remover falhou (ignorado):', (e as Error)?.message)
  }
}
