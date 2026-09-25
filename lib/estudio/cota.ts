// SOA Edition — cota de geração por LOGIN (userId), não por workspace.
//
//   disponível = max(0, cotaDiária − geradasHoje) + saldoDeCréditos
//
// A geração roda no navegador, então o controle é por RESERVA: antes de gerar o cliente reserva
// N imagens (debita primeiro a cota do dia, depois os créditos comprados); ao terminar informa
// quantas saíram de fato e o resto volta (créditos primeiro, na ordem inversa do débito).
// Reserva que nunca é fechada (aba fechada no meio) conta como usada — lado conservador.
//
// Tudo numa transação com trava de linha (FOR UPDATE): duas abas gerando ao mesmo tempo não
// passam do limite nem gastam o mesmo crédito duas vezes.
import { prisma } from '@/lib/prisma'
import { ensureEstudioSchema } from './schema'

/** Cota diária grátis padrão por login. Ponto único — planos/cortesia podem mudar em cotaDiaria(). */
export const COTA_DIARIA_PADRAO = 300
/** Imagens por pacote avulso. */
export const IMAGENS_POR_PACOTE = 50

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
/** "Hoje" no fuso de São Paulo — a cota vira à meia-noite de Brasília, não de UTC. */
const HOJE_SP = `(now() AT TIME ZONE 'America/Sao_Paulo')::date`

/**
 * Cota diária do login. Hoje é o padrão (ou ESTUDIO_COTA_DIARIA no ambiente); é aqui que
 * entra a cota por plano/cortesia quando existir — o resto do módulo só chama esta função.
 */
export async function cotaDiaria(_workspaceId: string, _userId: string): Promise<number> {
  const env = Number(process.env.ESTUDIO_COTA_DIARIA)
  return Number.isFinite(env) && env > 0 ? Math.floor(env) : COTA_DIARIA_PADRAO
}

/**
 * Preço do pacote de 50 (R$). [DECISÃO DO JÚNIOR] — vem de ESTUDIO_PACOTE_PRECO.
 * Sem valor definido → null = compra DESLIGADA (a tela avisa e a API recusa).
 */
export function precoPacote(): number | null {
  const raw = (process.env.ESTUDIO_PACOTE_PRECO || '').trim().replace(',', '.')
  const v = Number(raw)
  return raw && Number.isFinite(v) && v >= 5 ? Math.round(v * 100) / 100 : null
}

export interface StatusCota {
  cotaDiaria: number
  geradasHoje: number
  restanteHoje: number
  saldoCreditos: number
  disponivel: number
  imagensPorPacote: number
  precoPacote: number | null
}

export async function statusCota(workspaceId: string, userId: string): Promise<StatusCota> {
  await ensureEstudioSchema()
  const cota = await cotaDiaria(workspaceId, userId)
  const [r] = await prisma.$queryRawUnsafe<{ geradas: number | null; saldo: number | null }[]>(
    `SELECT (SELECT "geradas" FROM "EstudioUsoDiario" WHERE "userId"=$1 AND "data"=${HOJE_SP}) AS geradas,
            (SELECT "saldo" FROM "EstudioCredito" WHERE "userId"=$1) AS saldo`, userId)
  const geradasHoje = Number(r?.geradas) || 0
  const saldoCreditos = Number(r?.saldo) || 0
  const restanteHoje = Math.max(0, cota - geradasHoje)
  return {
    cotaDiaria: cota, geradasHoje, restanteHoje, saldoCreditos,
    disponivel: restanteHoje + saldoCreditos, imagensPorPacote: IMAGENS_POR_PACOTE, precoPacote: precoPacote(),
  }
}

export type ResultadoReserva =
  | { ok: true; reservaId: string; doDia: number; doCredito: number; status: StatusCota }
  | { ok: false; faltam: number; status: StatusCota }

/** Reserva `qtd` imagens para um lote. Não passa do disponível (bloqueia e diz quanto falta). */
export async function reservarCota(workspaceId: string, userId: string, qtd: number): Promise<ResultadoReserva> {
  await ensureEstudioSchema()
  const n = Math.max(1, Math.floor(qtd))
  const cota = await cotaDiaria(workspaceId, userId)
  const r = await prisma.$transaction(async tx => {
    // Garante as linhas (dia + crédito) e trava as duas até o fim da transação.
    await tx.$executeRawUnsafe(
      `INSERT INTO "EstudioUsoDiario" ("id","workspaceId","userId","data","geradas") VALUES ($1,$2,$3,${HOJE_SP},0)
       ON CONFLICT ("userId","data") DO NOTHING`, gid(), workspaceId, userId)
    await tx.$executeRawUnsafe(
      `INSERT INTO "EstudioCredito" ("id","workspaceId","userId","saldo") VALUES ($1,$2,$3,0)
       ON CONFLICT ("userId") DO NOTHING`, gid(), workspaceId, userId)
    const [d] = await tx.$queryRawUnsafe<{ geradas: number }[]>(
      `SELECT "geradas" FROM "EstudioUsoDiario" WHERE "userId"=$1 AND "data"=${HOJE_SP} FOR UPDATE`, userId)
    const [c] = await tx.$queryRawUnsafe<{ saldo: number }[]>(
      `SELECT "saldo" FROM "EstudioCredito" WHERE "userId"=$1 FOR UPDATE`, userId)
    const geradas = Number(d?.geradas) || 0, saldo = Number(c?.saldo) || 0
    const restante = Math.max(0, cota - geradas)
    if (n > restante + saldo) return { ok: false as const, faltam: n - (restante + saldo), geradas, saldo }
    const doDia = Math.min(n, restante), doCredito = n - doDia
    const reservaId = gid()
    if (doDia) await tx.$executeRawUnsafe(
      `UPDATE "EstudioUsoDiario" SET "geradas"="geradas"+$2, "atualizadoEm"=now() WHERE "userId"=$1 AND "data"=${HOJE_SP}`, userId, doDia)
    if (doCredito) {
      await tx.$executeRawUnsafe(`UPDATE "EstudioCredito" SET "saldo"="saldo"-$2, "atualizadoEm"=now() WHERE "userId"=$1`, userId, doCredito)
      await tx.$executeRawUnsafe(
        `INSERT INTO "EstudioCreditoMov" ("id","workspaceId","userId","delta","motivo","ref") VALUES ($1,$2,$3,$4,'consumo',$5)`,
        gid(), workspaceId, userId, -doCredito, reservaId)
    }
    await tx.$executeRawUnsafe(
      `INSERT INTO "EstudioCotaReserva" ("id","workspaceId","userId","data","doDia","doCredito") VALUES ($1,$2,$3,${HOJE_SP},$4,$5)`,
      reservaId, workspaceId, userId, doDia, doCredito)
    return { ok: true as const, reservaId, doDia, doCredito, geradas: geradas + doDia, saldo: saldo - doCredito }
  })
  const status: StatusCota = {
    cotaDiaria: cota, geradasHoje: r.geradas, restanteHoje: Math.max(0, cota - r.geradas), saldoCreditos: r.saldo,
    disponivel: Math.max(0, cota - r.geradas) + r.saldo, imagensPorPacote: IMAGENS_POR_PACOTE, precoPacote: precoPacote(),
  }
  return r.ok ? { ok: true, reservaId: r.reservaId, doDia: r.doDia, doCredito: r.doCredito, status } : { ok: false, faltam: r.faltam, status }
}

/**
 * Fecha a reserva com o número de artes que saíram de fato. O que sobrou volta — primeiro
 * para os créditos (foram os últimos a sair), depois para a cota do dia da reserva. Idempotente:
 * reserva já fechada não devolve de novo.
 */
export async function fecharReserva(workspaceId: string, userId: string, reservaId: string, gerados: number): Promise<{ devolvidos: number }> {
  await ensureEstudioSchema()
  return prisma.$transaction(async tx => {
    const [rv] = await tx.$queryRawUnsafe<{ doDia: number; doCredito: number; data: Date }[]>(
      `SELECT "doDia","doCredito","data" FROM "EstudioCotaReserva"
       WHERE "id"=$1 AND "userId"=$2 AND "workspaceId"=$3 AND "status"='aberta' FOR UPDATE`, reservaId, userId, workspaceId)
    if (!rv) return { devolvidos: 0 }
    const total = rv.doDia + rv.doCredito
    const feitos = Math.min(total, Math.max(0, Math.floor(gerados)))
    const sobra = total - feitos
    const voltaCredito = Math.min(sobra, rv.doCredito), voltaDia = sobra - voltaCredito
    if (voltaDia) await tx.$executeRawUnsafe(
      `UPDATE "EstudioUsoDiario" SET "geradas"=GREATEST(0,"geradas"-$3), "atualizadoEm"=now() WHERE "userId"=$1 AND "data"=$2::date`,
      userId, rv.data, voltaDia)
    if (voltaCredito) {
      await tx.$executeRawUnsafe(`UPDATE "EstudioCredito" SET "saldo"="saldo"+$2, "atualizadoEm"=now() WHERE "userId"=$1`, userId, voltaCredito)
      await tx.$executeRawUnsafe(
        `INSERT INTO "EstudioCreditoMov" ("id","workspaceId","userId","delta","motivo","ref") VALUES ($1,$2,$3,$4,'devolucao',$5)`,
        gid(), workspaceId, userId, voltaCredito, reservaId)
    }
    await tx.$executeRawUnsafe(
      `UPDATE "EstudioCotaReserva" SET "status"='fechada', "gerados"=$2, "fechadaEm"=now() WHERE "id"=$1`, reservaId, feitos)
    return { devolvidos: sobra }
  })
}
