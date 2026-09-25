// SOA Edition — cota de geração por LOGIN (userId), não por workspace. O SERVIDOR é a autoridade.
//
//   disponível = max(0, cotaDiária − geradasHoje) + saldoDeCréditos     (sempre lido do BANCO)
//
// A arte é desenhada no navegador, mas nenhuma arte sai sem AUTORIZAÇÃO prévia do servidor: antes
// de cada leva pequena (até 5 artes) o cliente pede autorização; o servidor confere o saldo no
// banco e DEBITA na hora — primeiro a cota do dia, depois os créditos comprados. O débito é
// definitivo: não existe "devolução" baseada no número que o navegador informa (era o furo do
// modelo anterior — bastava dizer "gerei 0" para recuperar tudo). Cancelar no meio custa no
// máximo a leva em andamento.
//
// Idempotência: cada autorização tem uma CHAVE (lote + posição). Reenviar a mesma chave (rede
// instável, duplo clique) devolve a mesma autorização sem debitar de novo (índice único).
// Tudo numa transação com trava de linha (FOR UPDATE): duas abas não passam do limite nem gastam
// o mesmo crédito duas vezes. A cota vira à meia-noite de Brasília, calculada no banco.
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

/** Maior leva autorizada de uma vez. */
export const MAX_POR_AUTORIZACAO = 5

export type ResultadoAutorizacao =
  | { ok: true; autorizados: number; repetida: boolean; status: StatusCota }
  | { ok: false; faltam: number; status: StatusCota }

/**
 * Autoriza (e DEBITA) `qtd` artes do lote. `chave` identifica esta leva: repetir a chave devolve a
 * mesma autorização sem novo débito. Sem saldo suficiente → nada é debitado.
 */
export async function autorizarItens(workspaceId: string, userId: string, lote: string, chave: string, qtd: number): Promise<ResultadoAutorizacao> {
  await ensureEstudioSchema()
  const n = Math.max(1, Math.min(MAX_POR_AUTORIZACAO, Math.floor(qtd)))
  const cota = await cotaDiaria(workspaceId, userId)
  const r = await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(
      `INSERT INTO "EstudioUsoDiario" ("id","workspaceId","userId","data","geradas") VALUES ($1,$2,$3,${HOJE_SP},0)
       ON CONFLICT ("userId","data") DO NOTHING`, gid(), workspaceId, userId)
    await tx.$executeRawUnsafe(
      `INSERT INTO "EstudioCredito" ("id","workspaceId","userId","saldo") VALUES ($1,$2,$3,0)
       ON CONFLICT ("userId") DO NOTHING`, gid(), workspaceId, userId)
    // Trava as linhas de saldo ANTES de olhar a chave: duas requisições com a mesma chave ficam em fila.
    const [d] = await tx.$queryRawUnsafe<{ geradas: number }[]>(
      `SELECT "geradas" FROM "EstudioUsoDiario" WHERE "userId"=$1 AND "data"=${HOJE_SP} FOR UPDATE`, userId)
    const [c] = await tx.$queryRawUnsafe<{ saldo: number }[]>(`SELECT "saldo" FROM "EstudioCredito" WHERE "userId"=$1 FOR UPDATE`, userId)
    const geradas = Number(d?.geradas) || 0, saldo = Number(c?.saldo) || 0
    const [ja] = await tx.$queryRawUnsafe<{ n: number }[]>(
      `SELECT ("doDia" + "doCredito")::int AS n FROM "EstudioCotaReserva" WHERE "userId"=$1 AND "chave"=$2`, userId, chave)
    if (ja) return { ok: true as const, autorizados: ja.n, repetida: true, geradas, saldo }
    const restante = Math.max(0, cota - geradas)
    if (n > restante + saldo) return { ok: false as const, faltam: n - (restante + saldo), geradas, saldo }
    const doDia = Math.min(n, restante), doCredito = n - doDia
    const id = gid()
    if (doDia) await tx.$executeRawUnsafe(
      `UPDATE "EstudioUsoDiario" SET "geradas"="geradas"+$2, "atualizadoEm"=now() WHERE "userId"=$1 AND "data"=${HOJE_SP}`, userId, doDia)
    if (doCredito) {
      await tx.$executeRawUnsafe(`UPDATE "EstudioCredito" SET "saldo"="saldo"-$2, "atualizadoEm"=now() WHERE "userId"=$1`, userId, doCredito)
      await tx.$executeRawUnsafe(
        `INSERT INTO "EstudioCreditoMov" ("id","workspaceId","userId","delta","motivo","ref") VALUES ($1,$2,$3,$4,'consumo',$5)`,
        gid(), workspaceId, userId, -doCredito, id)
    }
    await tx.$executeRawUnsafe(
      `INSERT INTO "EstudioCotaReserva" ("id","workspaceId","userId","data","doDia","doCredito","status","gerados","fechadaEm","lote","chave")
       VALUES ($1,$2,$3,${HOJE_SP},$4,$5,'fechada',$6,now(),$7,$8)`,
      id, workspaceId, userId, doDia, doCredito, n, lote, chave)
    return { ok: true as const, autorizados: n, repetida: false, geradas: geradas + doDia, saldo: saldo - doCredito }
  })
  const status: StatusCota = {
    cotaDiaria: cota, geradasHoje: r.geradas, restanteHoje: Math.max(0, cota - r.geradas), saldoCreditos: r.saldo,
    disponivel: Math.max(0, cota - r.geradas) + r.saldo, imagensPorPacote: IMAGENS_POR_PACOTE, precoPacote: precoPacote(),
  }
  return r.ok ? { ok: true, autorizados: r.autorizados, repetida: r.repetida, status } : { ok: false, faltam: r.faltam, status }
}

/** Quantas artes o SERVIDOR autorizou neste lote (nas últimas 36 h). Base para aceitar gravações do lote. */
export async function autorizadosNoLote(userId: string, lote: string): Promise<number> {
  if (!lote) return 0
  await ensureEstudioSchema()
  const [r] = await prisma.$queryRawUnsafe<{ n: number }[]>(
    `SELECT COALESCE(SUM("doDia" + "doCredito"),0)::int AS n FROM "EstudioCotaReserva"
     WHERE "userId"=$1 AND "lote"=$2 AND "createdAt" > now() - interval '36 hours'`, userId, lote)
  return Number(r?.n) || 0
}
