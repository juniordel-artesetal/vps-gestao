// Método MAE — ASSINATURA no Asaas (add-on do SOA e standalone), mensal ou anual (até 12× com juros do cliente).
//
// Mesmo PORTÃO do SOA (lib/assinatura/checkout.ts): checkout HOSPEDADO do Asaas, só cartão, assinatura
// recorrente (MONTHLY/YEARLY) com a 1ª cobrança no fim do TRIAL de 7 dias; no CHECKOUT_PAID o cartão é validado
// (pré-autorização de R$ 5 liberada na hora) e o trial começa. externalReference "MAEA:<ws>" (≠ "MAE:", que é a
// Loja da Naty). As cobranças das assinaturas do checkout chegam SEM externalReference — o vínculo é pelo
// checkoutSession/subscription gravados em "MaeAssinatura".
//
// ACESSO = Workspace.moduloMae + moduloMaeAte (acesso até): trial → fim do trial; pago → próximo vencimento +
// carência de 3 dias; vencido sem pagar → expira sozinho na carência (sem cron); cancelado → vale até o fim do
// período pago. Cortesia (moduloMaeOrigem='cortesia') é imune. SEM COBRANÇA DUPLA: quem já tem assinatura viva
// (trial/ativa/inadimplente) não abre outro checkout.
import { prisma } from '@/lib/prisma'
import { chamarAsaas } from '@/lib/pagamento/asaas/client'
import { OFERTA_ALUNAS, alunasAberta, precosAlunas, nomeDoItemAlunas, descricaoDoItemAlunas, marcaCheckoutAlunas, MARCA_COMPRA_ALUNAS, DIA_MARCA_ALUNAS, type OfertaMae } from './alunas'
import { PLANO_COMBO, cobrancaCombo, jaPagaSoa, nomeDoItemCombo, descricaoDoItemCombo } from './combo'
import { encerrarAssinaturasTrocadasPorPixAuto } from '@/lib/pagamento/asaas/pixAutomatico'
import { criarLinkPixAuto, apagarLinkPixAuto, ehLinkDePagamento, pixAutoLigado } from '@/lib/pagamento/asaas/linkPixAuto'
import { temAcesso } from '@/lib/assinatura'
import { validarCartaoDoCheckout } from '@/lib/assinatura/validacaoCartao'
import { emailInicioTesteMae, emailCanceladaMae } from './emails'
import { precosMae, vendaMaeAtiva, cobrancaMae, refAssinaturaMae, ehRefAssinaturaMae, TRIAL_DIAS_MAE, CARENCIA_DIAS_MAE, somarDias, proximoDoCiclo, hojeSP, acessoMae, type PlanoMaeVenda, type CicloMae, type EstadoMaeConta } from './precos'

const gid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const data = (d: Date | string | null | undefined) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10)) : null)

export type StatusMae = 'AGUARDANDO_PAGAMENTO' | 'TRIAL' | 'ATIVA' | 'INADIMPLENTE' | 'CANCELADA'
export interface AssinaturaMae {
  id: string; workspaceId: string; plano: PlanoMaeVenda; ciclo: CicloMae; parcelas: number; valor: number; status: StatusMae
  checkoutId: string | null; checkoutLink: string | null; subscriptionId: string | null
  trialAte: string | null; trialUsado: boolean; proximoVencimento: string | null
}

// ── leitura ─────────────────────────────────────────────────────────────────────────────────────
/** Entitlement da conta (colunas do Workspace via to_jsonb: tolerante a ambiente sem a migração). */
export async function estadoMaeDaConta(ws: string): Promise<EstadoMaeConta & { plano: PlanoMaeVenda | null; ciclo: CicloMae | null }> {
  try {
    const [w] = await prisma.$queryRaw<{ j: Record<string, unknown> }[]>`SELECT to_jsonb(w) AS j FROM "Workspace" w WHERE w."id" = ${ws} LIMIT 1`
    const j = w?.j ?? {}
    return {
      moduloMae: j.moduloMae === true, origem: (j.moduloMaeOrigem as string) ?? null, ate: data(j.moduloMaeAte as string | null),
      soaDesign: j.moduloEstudio === true,
      plano: j.moduloMaePlano === 'standalone' ? 'standalone' : j.moduloMaePlano === 'addon' ? 'addon' : null,
      ciclo: j.moduloMaeCiclo === 'anual' ? 'anual' : j.moduloMaeCiclo === 'mensal' ? 'mensal' : null,
    }
  } catch (e) {
    console.error('[MAE ASSINATURA] estado', (e as Error).message)
    return { moduloMae: false, origem: null, ate: null, soaDesign: false, plano: null, ciclo: null }
  }
}
/** Acesso pago/cortesia/SOA Design (ver acessoMae). */
export async function origemAcessoMae(ws: string) { return acessoMae(await estadoMaeDaConta(ws), hojeSP()) }

export async function assinaturaMaeDaConta(ws: string): Promise<AssinaturaMae | null> {
  try {
    const [a] = await prisma.$queryRaw<(Omit<AssinaturaMae, 'trialAte' | 'proximoVencimento' | 'valor'> & { trialAte: Date | null; proximoVencimento: Date | null; valor: unknown })[]>`
      SELECT "id","workspaceId","plano","ciclo","parcelas","valor","status","checkoutId","checkoutLink","subscriptionId","trialAte","trialUsado","proximoVencimento"
      FROM "MaeAssinatura" WHERE "workspaceId" = ${ws} LIMIT 1`
    return a ? { ...a, valor: Number(a.valor), trialAte: data(a.trialAte), proximoVencimento: data(a.proximoVencimento) } : null
  } catch { return null }
}

/**
 * Plano de venda da conta: standalone (conta só-MAE, marcada no cadastro) ou add-on (assinante do SOA).
 * Lançamento (16/10/2026): a conta com o SOA INATIVO (cortada, cancelada, teste vencido) também pode assinar SÓ o
 * Método Mãe — vira standalone (preço do só-MAE; depois de pago ela enxerga só o MAE, ver liberaSoMae).
 * Quem já tem plano gravado (comprou antes) mantém o dele.
 */
/**
 * Nome do item no checkout do Asaas — no MÁXIMO 30 caracteres (o Asaas recusa o checkout acima disso).
 * Diz o plano da pessoa: "MAE p/ assinante SOA · mensal" (soma ao SOA) ou "Método Mãe · mensal" (só o MAE).
 */
export function nomeDoItemMae(plano: PlanoMaeVenda, ciclo: CicloMae): string {
  return `${plano === 'standalone' ? 'Método Mãe' : 'MAE p/ assinante SOA'} · ${ciclo}`.slice(0, 30)
}
const brlTxt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ')
/** Descrição do plano na página de pagamento do Asaas (no MÁXIMO 150 caracteres). */
export function descricaoDoItemMae(plano: PlanoMaeVenda, ciclo: CicloMae, c: { parcelas: number; valorParcela: number; total: number }): string {
  const quem = plano === 'standalone' ? 'Método Mãe (sem o SOA)' : 'Método Mãe p/ quem assina o SOA, à parte do SOA'
  const preco = ciclo === 'mensal' ? `${brlTxt(c.total)}/mês. Cancele quando quiser.`
    : c.parcelas > 1 ? `1 ano em ${c.parcelas}x de ${brlTxt(c.valorParcela)} (total ${brlTxt(c.total)} c/ juros). Escolha ${c.parcelas}x no parcelamento.`
      : `1 ano por ${brlTxt(c.total)} à vista, no Pix ou no cartão.`
  return `${quem}: ${preco}`.slice(0, 150)
}

/**
 * Até quando vale o pagamento: o próximo vencimento do ciclo. Na compra PARCELADA (anual em N×) cada parcela tem o seu
 * vencimento (um por mês): o ano conta a partir da 1ª parcela — sem isto, a 12ª daria quase 2 anos de acesso.
 */
export function proximoDoPagamento(venc: string, ciclo: CicloMae, parcela?: number | null): string {
  if (ciclo === 'anual' && parcela && parcela > 1) {
    const [a, m, d] = venc.split('-').map(Number)
    const primeira = new Date(Date.UTC(a, m - 1 - (parcela - 1), d)).toISOString().slice(0, 10)
    return proximoDoCiclo(primeira, 'anual')
  }
  return proximoDoCiclo(venc, ciclo)
}

export function planoPeloEstado(planoGravado: PlanoMaeVenda | null, soaAtivo: boolean): PlanoMaeVenda {
  if (planoGravado) return planoGravado
  return soaAtivo ? 'addon' : 'standalone'
}
export async function planoDeVenda(ws: string, estado?: Awaited<ReturnType<typeof estadoMaeDaConta>>): Promise<PlanoMaeVenda> {
  const e = estado ?? await estadoMaeDaConta(ws)
  if (e.plano) return e.plano
  return planoPeloEstado(null, await temAcesso(ws))
}
/**
 * A conta com o SOA sem acesso continua entrando para usar SÓ o Método Mãe que ela assinou (standalone + acesso do
 * MAE vivo). Usado no login e na revalidação da sessão: não bloqueia e marca soMae (só o MAE no menu/middleware).
 */
export async function liberaSoMae(ws: string): Promise<boolean> {
  const e = await estadoMaeDaConta(ws)
  return e.plano === 'standalone' && acessoMae(e, hojeSP()) !== null
}

// ── checkout ────────────────────────────────────────────────────────────────────────────────────
export type ResultadoCheckoutMae = { ok: true; link: string; reaproveitado?: boolean } | { ok: false; erro: string; status: number }

/**
 * Abre o checkout do Método Mãe. Sem cobrança dupla: assinatura viva → não abre outro (inadimplente → leva à
 * fatura em aberto). Trial de 7 dias só na PRIMEIRA vez (quem já testou começa pagando).
 */
export async function criarCheckoutMae(p: { workspaceId: string; ciclo: CicloMae; parcelas?: number; baseUrl: string; metodo?: 'cartao' | 'pix'; oferta?: OfertaMae }): Promise<ResultadoCheckoutMae> {
  if (!vendaMaeAtiva() || !precosMae()) return { ok: false, erro: 'O Método Mãe ainda não está à venda.', status: 400 }
  const estado = await estadoMaeDaConta(p.workspaceId)
  if (estado.moduloMae && estado.origem === 'cortesia') return { ok: false, erro: 'Esta conta já tem o Método Mãe liberado.', status: 400 }
  const plano: PlanoMaeVenda = await planoDeVenda(p.workspaceId, estado)
  // Plano Alunas VPS (16/10/2026): preço próprio, com validade, uma compra por conta (ver ./alunas.ts). É para quem
  // NÃO assina o SOA: a assinante do SOA que vier pelo link entra no preço de assinante (add-on, R$ 39,90) — mais barato.
  // SOA + MAE para quem ainda NÃO paga o SOA (em teste, atrasada, cancelada com acesso…): o PACOTE numa cobrança só —
  // nunca o MAE de R$ 39,90 sem o SOA pago (16/10/2026)
  if (plano === 'addon' && p.oferta !== OFERTA_ALUNAS && !(await contaJaPagaSoa(p.workspaceId)))
    return criarCheckoutCombo({ workspaceId: p.workspaceId, ciclo: p.ciclo, parcelas: p.parcelas, baseUrl: p.baseUrl, metodo: p.metodo })
  const pedeAlunas = p.oferta === OFERTA_ALUNAS
  const alunas = pedeAlunas && (plano !== 'addon' || !(await contaJaPagaSoa(p.workspaceId)))
  const precos = (alunas ? precosAlunas() : precosMae())!
  if (alunas && !alunasAberta()) return { ok: false, erro: 'O link do Plano Alunas venceu em 31/10/2026.', status: 400 }
  if (alunas && await jaComprouAlunas(p.workspaceId)) return { ok: false, erro: 'Esta conta já comprou pelo Plano Alunas — o link vale uma compra por conta.', status: 400 }
  const nomeItem = (pl: PlanoMaeVenda, c: CicloMae) => (alunas ? nomeDoItemAlunas(c) : nomeDoItemMae(pl, c))
  const descItem = (pl: PlanoMaeVenda, c: CicloMae, x: { parcelas: number; valorParcela: number; total: number }) => (alunas ? descricaoDoItemAlunas(c, x) : descricaoDoItemMae(pl, c, x))
  const retorno = pedeAlunas ? '/mae/alunas' : '/mae/assinatura'
  const atual = await assinaturaMaeDaConta(p.workspaceId)
  if (atual && (atual.status === 'TRIAL' || atual.status === 'ATIVA')) return { ok: false, erro: 'O Método Mãe já está ativo nesta conta.', status: 400 }
  if (atual?.status === 'INADIMPLENTE' && atual.subscriptionId) {
    const f = await faturaEmAberto(atual.subscriptionId)
    if (f) return { ok: true, link: f, reaproveitado: true }
  }
  // checkout ainda válido (24 h) com as MESMAS escolhas → reaproveita o link (não cria outra assinatura)
  const cobr = cobrancaMae(precos, plano, p.ciclo, p.parcelas ?? 1)
  // MENSAL NO PIX AUTOMÁTICO (16/10/2026): link de pagamento do Asaas (Pix recorrente — ela autoriza no app do banco)
  const pixAuto = p.ciclo === 'mensal' && p.metodo === 'pix'
  if (pixAuto && !pixAutoLigado()) return { ok: false, erro: 'O Pix Automático está indisponível no momento. Use o cartão.', status: 400 }
  if (atual?.status === 'AGUARDANDO_PAGAMENTO' && atual.checkoutLink && atual.ciclo === p.ciclo && atual.parcelas === cobr.parcelas && atual.plano === plano
      && ehLinkDePagamento(atual.checkoutLink) === pixAuto && Math.abs(atual.valor - cobr.total) < 0.01)
    return { ok: true, link: atual.checkoutLink, reaproveitado: true }
  if (pixAuto) {
    const l = await criarLinkPixAuto({
      nome: nomeItem(plano, 'mensal'), descricao: `${descItem(plano, 'mensal', cobr)} Pix Automático: autorize uma vez no app do banco.`.slice(0, 150),
      valor: cobr.total, externalReference: refAssinaturaMae(p.workspaceId), sucesso: `${p.baseUrl}${retorno}?pago=1`,
    })
    if (!l.ok) { console.error(`[MAE ASSINATURA] link Pix Automático falhou ws=${p.workspaceId}: ${l.erro}`); return { ok: false, erro: l.erro, status: 502 } }
    // o link anterior (se era um link de Pix) não pode mais ser pago
    if (atual?.status === 'AGUARDANDO_PAGAMENTO' && ehLinkDePagamento(atual.checkoutLink)) await apagarLinkPixAuto(atual.checkoutId)
    await gravarAguardando(p.workspaceId, plano, 'mensal', cobr.parcelas, cobr.total, l.id, l.url)
    if (alunas) await marcarCheckoutAlunas(p.workspaceId, l.id)
    console.log(`[MAE ASSINATURA] link Pix Automático ws=${p.workspaceId} ${plano}/mensal total=${cobr.total}`)
    return { ok: true, link: l.url }
  }

  const comTrial = TRIAL_DIAS_MAE > 0 && !atual?.trialUsado
  // sem trial: a 1ª cobrança é hoje — ou, se ela cancelou e ainda tem acesso pago, no fim desse acesso (não paga
  // duas vezes o mesmo período)
  const hoje = hojeSP()
  const primeira = comTrial ? somarDias(hoje, TRIAL_DIAS_MAE) : estado.moduloMae && estado.origem === 'asaas' && estado.ate && estado.ate > hoje ? estado.ate : hoje
  // Pente-fino 16/10/2026 (testado no SANDBOX do Asaas):
  //  • o nome do item tem no MÁXIMO 30 caracteres ("SOA — Método Mãe (add-on) mensal" tinha 32 → o Asaas RECUSAVA o checkout);
  //  • assinatura RECORRENTE não parcela: `maxInstallmentCount` é ignorado (o checkout volta com installment: null) e o
  //    Asaas cobra o TOTAL de uma vez (caso real 8GF7). O anual PARCELADO vai como compra parcelada de verdade
  //    (DETACHED + INSTALLMENT, `installment.maxInstallmentCount` = as parcelas escolhidas na nossa tela) — o item já é o
  //    total com juros da tabela Price; não renova sozinho (no fim do ano, renovar). Mensal e anual 1× seguem recorrentes.
  const nome = nomeItem(plano, p.ciclo)
  const parcelado = p.ciclo === 'anual' && cobr.parcelas > 1
  // Decisão do Júnior (16/10): ANUAL À VISTA = Pix ou cartão 1× (compra avulsa — o Asaas não aceita Pix em recorrente;
  // não renova sozinho); ANUAL EM N× = cartão com juros; MENSAL = só cartão (recorrente). Nunca boleto.
  const anual = p.ciclo === 'anual'
  const corpo: Record<string, unknown> = {
    billingTypes: anual && !parcelado ? ['CREDIT_CARD', 'PIX'] : ['CREDIT_CARD'],
    chargeTypes: parcelado ? ['DETACHED', 'INSTALLMENT'] : anual ? ['DETACHED'] : ['RECURRENT'], minutesToExpire: 1440,
    callback: { successUrl: `${p.baseUrl}${retorno}?pago=1`, cancelUrl: `${p.baseUrl}${retorno}`, expiredUrl: `${p.baseUrl}${retorno}` },
    // o item JÁ é o total com juros (tabela Price) — NÃO ligar "repassar juros ao cliente" no Asaas
    items: [{ name: nome, description: descItem(plano, p.ciclo, cobr), quantity: 1, value: cobr.total }],
    externalReference: refAssinaturaMae(p.workspaceId),
    ...(parcelado ? { installment: { maxInstallmentCount: cobr.parcelas } } : anual ? {} : { subscription: { cycle: 'MONTHLY', nextDueDate: primeira } }),
  }
  const r = await chamarAsaas<{ id?: string; link?: string }>('/checkouts', { metodo: 'POST', corpo })
  if (!r.ok || !r.dados?.id || !r.dados?.link) {
    console.error(`[MAE ASSINATURA] checkout falhou ws=${p.workspaceId}: ${r.erro}`)
    return { ok: false, erro: r.erro || 'Não consegui abrir a página de pagamento.', status: 502 }
  }
  await gravarAguardando(p.workspaceId, plano, p.ciclo, cobr.parcelas, cobr.total, r.dados.id, r.dados.link)
  if (alunas) await marcarCheckoutAlunas(p.workspaceId, r.dados.id)
  console.log(`[MAE ASSINATURA] checkout ws=${p.workspaceId} ${plano}/${p.ciclo} ${cobr.parcelas}x total=${cobr.total} trial=${comTrial}`)
  return { ok: true, link: r.dados.link }
}

// ── Plano Alunas: o checkout aberto pelo link e a compra paga (uma por conta) ─────────────────────────────────────
async function marcarCheckoutAlunas(ws: string, checkoutId: string) {
  await prisma.$executeRaw`
    INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt","enviadoEm")
    VALUES (${gid()}, ${ws}, ${marcaCheckoutAlunas(checkoutId)}, ${DIA_MARCA_ALUNAS}::date, NOW(), NOW())
    ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING`.catch(e => console.error('[MAE ALUNAS] marca do checkout', (e as Error).message))
}
export async function jaComprouAlunas(ws: string): Promise<boolean> {
  const [x] = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok FROM "AssinaturaAviso" WHERE "workspaceId" = ${ws} AND "tipo" = ${MARCA_COMPRA_ALUNAS} LIMIT 1`.catch(() => [])
  return !!x
}
/** Pagamento confirmado: se a compra veio do link do Plano Alunas, a conta fica marcada (o link não vale de novo). */
async function marcarCompraAlunasSeFor(ws: string, checkoutId: string | null) {
  if (!checkoutId) return
  const [x] = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok FROM "AssinaturaAviso" WHERE "workspaceId" = ${ws} AND "tipo" = ${marcaCheckoutAlunas(checkoutId)} LIMIT 1`.catch(() => [])
  if (!x) return
  await prisma.$executeRaw`
    INSERT INTO "AssinaturaAviso" ("id","workspaceId","tipo","dia","createdAt","enviadoEm")
    VALUES (${gid()}, ${ws}, ${MARCA_COMPRA_ALUNAS}, ${DIA_MARCA_ALUNAS}::date, NOW(), NOW())
    ON CONFLICT ("workspaceId","tipo","dia") DO NOTHING`.catch(() => {})
  console.log(`[MAE ALUNAS] compra pelo Plano Alunas ws=${ws}`)
}

/** Grava (ou troca) a tentativa de compra aguardando o pagamento — checkout hospedado ou link do Pix Automático. */
async function gravarAguardando(ws: string, plano: PlanoMaeVenda, ciclo: CicloMae, parcelas: number, total: number, checkoutId: string, link: string) {
  await prisma.$executeRaw`
    INSERT INTO "MaeAssinatura" ("id","workspaceId","plano","ciclo","parcelas","valor","status","checkoutId","checkoutLink","createdAt","updatedAt")
    VALUES (${gid()}, ${ws}, ${plano}, ${ciclo}, ${parcelas}, ${total}, 'AGUARDANDO_PAGAMENTO', ${checkoutId}, ${link}, NOW(), NOW())
    ON CONFLICT ("workspaceId") DO UPDATE SET "plano" = EXCLUDED."plano", "ciclo" = EXCLUDED."ciclo", "parcelas" = EXCLUDED."parcelas",
      "valor" = EXCLUDED."valor", "status" = 'AGUARDANDO_PAGAMENTO', "checkoutId" = EXCLUDED."checkoutId", "checkoutLink" = EXCLUDED."checkoutLink",
      "subscriptionId" = NULL, "proximoVencimento" = NULL, "canceladaEm" = NULL, "updatedAt" = NOW()`
}

// ── PACOTE SOA + MÉTODO MÃE numa cobrança única (ver ./combo.ts) ──────────────────────────────────────────────────
/** A conta já paga o SOA? (então o MAE é à parte, R$ 39,90 — o SOA dela já é cobrado) */
export async function contaJaPagaSoa(ws: string): Promise<boolean> {
  const [w] = await prisma.$queryRaw<{ assinaturaStatus: string | null; liberacaoManual: boolean | null }[]>`
    SELECT "assinaturaStatus", "liberacaoManual" FROM "Workspace" WHERE "id" = ${ws} LIMIT 1`.catch(() => [])
  return !!w && jaPagaSoa(w)
}

/**
 * Checkout do PACOTE (um item só: SOA + Método Mãe). Só para quem ainda NÃO paga o SOA (sem conta, em teste, cortada,
 * cancelada, aguardando). Mensal = cartão recorrente (ou Pix Automático); anual = à vista Pix/cartão ou N× no cartão.
 * Ao pagar, o webhook libera o SOA e o MAE juntos e encerra a assinatura antiga do SOA (sem cobrança dupla).
 */
export async function criarCheckoutCombo(p: { workspaceId: string; ciclo: CicloMae; parcelas?: number; baseUrl: string; metodo?: 'cartao' | 'pix' }): Promise<ResultadoCheckoutMae> {
  const precos = precosMae()
  if (!vendaMaeAtiva() || !precos) return { ok: false, erro: 'O Método Mãe ainda não está à venda.', status: 400 }
  // quem JÁ PAGA o SOA nunca entra no pacote: a assinatura dela não muda e o MAE é cobrado à parte (R$ 39,90)
  if (await contaJaPagaSoa(p.workspaceId)) return { ok: false, erro: 'Você já assina o SOA: o Método Mãe é uma cobrança à parte, de R$ 39,90/mês.', status: 409 }
  const estado = await estadoMaeDaConta(p.workspaceId)
  if (estado.moduloMae && estado.origem === 'cortesia') return { ok: false, erro: 'Esta conta já tem o Método Mãe liberado.', status: 400 }
  const atual = await assinaturaMaeDaConta(p.workspaceId)
  if (atual && (atual.status === 'TRIAL' || atual.status === 'ATIVA')) return { ok: false, erro: 'O Método Mãe já está ativo nesta conta.', status: 400 }
  if (atual?.status === 'INADIMPLENTE' && atual.subscriptionId) { const f = await faturaEmAberto(atual.subscriptionId); if (f) return { ok: true, link: f, reaproveitado: true } }
  const cobr = cobrancaCombo(precos, p.ciclo, p.parcelas ?? 1)
  const pixAuto = p.ciclo === 'mensal' && p.metodo === 'pix' && pixAutoLigado()
  const plano = PLANO_COMBO as unknown as PlanoMaeVenda
  if (atual?.status === 'AGUARDANDO_PAGAMENTO' && atual.checkoutLink && (atual.plano as string) === PLANO_COMBO && atual.ciclo === p.ciclo && atual.parcelas === cobr.parcelas
      && ehLinkDePagamento(atual.checkoutLink) === pixAuto && Math.abs(atual.valor - cobr.total) < 0.01)
    return { ok: true, link: atual.checkoutLink, reaproveitado: true }
  if (pixAuto) {
    const l = await criarLinkPixAuto({ nome: nomeDoItemCombo('mensal'), descricao: `${descricaoDoItemCombo('mensal', cobr)} Pix Automático.`.slice(0, 150),
      valor: cobr.total, externalReference: refAssinaturaMae(p.workspaceId), sucesso: `${p.baseUrl}/mae/assinatura?pago=1` })
    if (!l.ok) return { ok: false, erro: l.erro, status: 502 }
    if (atual?.status === 'AGUARDANDO_PAGAMENTO' && ehLinkDePagamento(atual.checkoutLink)) await apagarLinkPixAuto(atual.checkoutId)
    await gravarAguardando(p.workspaceId, plano, 'mensal', 1, cobr.total, l.id, l.url)
    console.log(`[MAE COMBO] link Pix Automático ws=${p.workspaceId} total=${cobr.total}`)
    return { ok: true, link: l.url }
  }
  const anual = p.ciclo === 'anual', parcelado = anual && cobr.parcelas > 1
  const corpo: Record<string, unknown> = {
    billingTypes: anual && !parcelado ? ['CREDIT_CARD', 'PIX'] : ['CREDIT_CARD'],
    chargeTypes: parcelado ? ['DETACHED', 'INSTALLMENT'] : anual ? ['DETACHED'] : ['RECURRENT'], minutesToExpire: 1440,
    callback: { successUrl: `${p.baseUrl}/mae/assinatura?pago=1`, cancelUrl: `${p.baseUrl}/mae`, expiredUrl: `${p.baseUrl}/mae` },
    items: [{ name: nomeDoItemCombo(p.ciclo), description: descricaoDoItemCombo(p.ciclo, cobr), quantity: 1, value: cobr.total }],
    externalReference: refAssinaturaMae(p.workspaceId),
    ...(parcelado ? { installment: { maxInstallmentCount: cobr.parcelas } } : anual ? {} : { subscription: { cycle: 'MONTHLY', nextDueDate: hojeSP() } }),
  }
  const r = await chamarAsaas<{ id?: string; link?: string }>('/checkouts', { metodo: 'POST', corpo })
  if (!r.ok || !r.dados?.id || !r.dados?.link) { console.error(`[MAE COMBO] checkout falhou ws=${p.workspaceId}: ${r.erro}`); return { ok: false, erro: r.erro || 'Não consegui abrir a página de pagamento.', status: 502 } }
  await gravarAguardando(p.workspaceId, plano, p.ciclo, cobr.parcelas, cobr.total, r.dados.id, r.dados.link)
  console.log(`[MAE COMBO] checkout ws=${p.workspaceId} ${p.ciclo} ${cobr.parcelas}x total=${cobr.total}`)
  return { ok: true, link: r.dados.link }
}

/** Pacote pago: o SOA fica ATIVO (até o próximo vencimento) e a assinatura antiga do SOA (ex.: a do teste) é encerrada. */
async function soaDoComboPago(ws: string, ate: string) {
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "assinaturaStatus" = 'ATIVA', "assinaturaOrigem" = 'asaas', "ativo" = true,
      "assinaturaExpira" = GREATEST(COALESCE("assinaturaExpira", ${ate}::date), ${ate}::date), "updatedAt" = NOW()
    WHERE "id" = ${ws} AND "liberacaoManual" IS NOT TRUE`
  const n = await encerrarAssinaturasTrocadasPorPixAuto(ws, '__combo__')
  console.log(`[MAE COMBO] pago ws=${ws} → SOA + MAE ativos até ${ate}${n ? ` · ${n} assinatura(s) antiga(s) do SOA encerrada(s)` : ''}`)
}

async function faturaEmAberto(sub: string): Promise<string | null> {
  const r = await chamarAsaas<{ data?: { status?: string; invoiceUrl?: string }[] }>(`/subscriptions/${sub}/payments?limit=10`, { exigirAtivo: false })
  return (r.dados?.data ?? []).find(x => ['OVERDUE', 'PENDING'].includes(String(x.status)))?.invoiceUrl ?? null
}

// ── webhook ─────────────────────────────────────────────────────────────────────────────────────
async function linhaPorCheckout(checkoutId: string) {
  const [a] = await prisma.$queryRaw<{ id: string; workspaceId: string; status: string; plano: string; ciclo: string; trialUsado: boolean }[]>`
    SELECT "id","workspaceId","status","plano","ciclo","trialUsado" FROM "MaeAssinatura" WHERE "checkoutId" = ${checkoutId} LIMIT 1`.catch(() => [])
  return a ?? null
}

/** Entitlement no Workspace (cortesia é imune). */
async function darAcesso(ws: string, plano: string, ciclo: string, ate: string) {
  await prisma.$executeRaw`
    UPDATE "Workspace" SET "moduloMae" = true, "moduloMaeOrigem" = 'asaas', "moduloMaePlano" = ${plano}, "moduloMaeCiclo" = ${ciclo},
      "moduloMaeAte" = GREATEST(COALESCE("moduloMaeAte", ${ate}::date), ${ate}::date), "updatedAt" = NOW()
    WHERE "id" = ${ws} AND COALESCE("moduloMaeOrigem", '') <> 'cortesia'`
}

/** CHECKOUT_PAID de um checkout do MAE: valida o cartão e começa o trial (ou o acesso, sem trial). false = não é do MAE. */
export async function concluirCheckoutMae(checkoutId: string): Promise<boolean> {
  const a = await linhaPorCheckout(checkoutId)
  if (!a) return false
  if (a.status !== 'AGUARDANDO_PAGAMENTO') return true   // webhook repetido
  // anual (compra avulsa — Pix pode "fechar" o checkout antes de ser pago): espera o PAYMENT_CONFIRMED/RECEIVED;
  // a assinatura segue AGUARDANDO_PAGAMENTO (a recuperação de vendas lembra quem não pagou o Pix)
  if (a.ciclo === 'anual') {
    await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "checkoutLink" = NULL WHERE "id" = ${a.id} AND "status" = 'AGUARDANDO_PAGAMENTO'`
    return true
  }
  const comTrial = TRIAL_DIAS_MAE > 0 && !a.trialUsado
  // sem teste, a 1ª cobrança já é no checkout: a reserva de R$ 5 (validar o cartão) só existe com o teste
  const v = comTrial ? await validarCartaoDoCheckout(a.workspaceId, checkoutId, refAssinaturaMae(a.workspaceId)) : { libera: true }
  if (!v.libera) {
    await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "checkoutLink" = NULL, "updatedAt" = NOW() WHERE "id" = ${a.id}`
    console.log(`[MAE ASSINATURA] cartão recusado ws=${a.workspaceId}`)
    return true
  }
  const hoje = hojeSP()
  if (comTrial) {
    const fim = somarDias(hoje, TRIAL_DIAS_MAE)
    await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "status" = 'TRIAL', "trialAte" = ${fim}::date, "trialUsado" = true, "checkoutLink" = NULL, "updatedAt" = NOW() WHERE "id" = ${a.id} AND "status" = 'AGUARDANDO_PAGAMENTO'`
    await darAcesso(a.workspaceId, a.plano, a.ciclo, fim)
    console.log(`[MAE ASSINATURA] trial até ${fim} ws=${a.workspaceId}`)
    await emailInicioTesteMae(a.workspaceId)
  } else {
    // sem teste (não há teste grátis, ou já testou): a 1ª cobrança é hoje — o acesso vem com o pagamento; até lá, 1 dia de cortesia
    await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "status" = 'ATIVA', "checkoutLink" = NULL, "updatedAt" = NOW() WHERE "id" = ${a.id} AND "status" = 'AGUARDANDO_PAGAMENTO'`
    await darAcesso(a.workspaceId, a.plano, a.ciclo, somarDias(hoje, 1))
  }
  return true
}

export async function encerrarCheckoutMae(checkoutId: string): Promise<boolean> {
  const a = await linhaPorCheckout(checkoutId)
  if (!a) return false
  // (sem mexer no updatedAt: ele marca o INÍCIO da tentativa — a recuperação de vendas conta a partir dele)
  await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "checkoutLink" = NULL WHERE "id" = ${a.id} AND "status" = 'AGUARDANDO_PAGAMENTO'`
  return true
}

interface PagamentoAsaas { id?: string; subscription?: string; externalReference?: string; checkoutSession?: string; paymentLink?: string; dueDate?: string; customer?: string; installment?: string | null; installmentNumber?: number | null }

/** A cobrança é de uma assinatura do MAE? (ref "MAEA:", ou subscription/checkout gravados em MaeAssinatura) */
export async function linhaDoPagamentoMae(pag: PagamentoAsaas): Promise<{ id: string; workspaceId: string; plano: string; ciclo: string; status: string; subscriptionId: string | null } | null> {
  const ws = ehRefAssinaturaMae(pag.externalReference) ? String(pag.externalReference).slice(5) : null
  const rs = await prisma.$queryRaw<{ id: string; workspaceId: string; plano: string; ciclo: string; status: string; subscriptionId: string | null }[]>`
    SELECT "id","workspaceId","plano","ciclo","status","subscriptionId" FROM "MaeAssinatura"
    WHERE ("subscriptionId" IS NOT NULL AND "subscriptionId" = ${pag.subscription ?? null})
       OR ("checkoutId" IS NOT NULL AND "checkoutId" = ${pag.checkoutSession ?? null})
       OR ("checkoutId" IS NOT NULL AND "checkoutId" = ${pag.paymentLink ?? null})
       OR "workspaceId" = ${ws}
    LIMIT 1`.catch(() => [])
  return rs[0] ?? null
}

/**
 * Evento de cobrança de uma assinatura do MAE. Pago → ATIVA, acesso até o próximo vencimento + carência;
 * vencido → INADIMPLENTE (o acesso acaba sozinho na carência); estorno/chargeback → corta hoje.
 */
export async function aplicarPagamentoMae(evento: string, pag: PagamentoAsaas): Promise<boolean> {
  const a = await linhaDoPagamentoMae(pag)
  if (!a) return false
  if (pag.subscription && !a.subscriptionId) await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "subscriptionId" = ${pag.subscription}, "customerId" = COALESCE("customerId", ${pag.customer ?? null}), "updatedAt" = NOW() WHERE "id" = ${a.id}`
  const venc = pag.dueDate ?? hojeSP()
  if (evento === 'PAYMENT_RECEIVED' || evento === 'PAYMENT_CONFIRMED') {
    const prox = proximoDoPagamento(venc, a.ciclo === 'anual' ? 'anual' : 'mensal', pag.installmentNumber)
    await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "status" = 'ATIVA', "proximoVencimento" = GREATEST(COALESCE("proximoVencimento", ${prox}::date), ${prox}::date), "updatedAt" = NOW() WHERE "id" = ${a.id} AND "status" <> 'CANCELADA'`
    const combo = a.plano === PLANO_COMBO
    // pacote: o acesso do MAE é o de quem tem o SOA (addon) e o SOA fica ativo junto
    if (a.status !== 'CANCELADA') await darAcesso(a.workspaceId, combo ? 'addon' : a.plano, a.ciclo, somarDias(prox, CARENCIA_DIAS_MAE))
    if (combo && a.status !== 'CANCELADA') await soaDoComboPago(a.workspaceId, prox)
    await marcarCompraAlunasSeFor(a.workspaceId, (await assinaturaMaeDaConta(a.workspaceId))?.checkoutId ?? pag.checkoutSession ?? pag.paymentLink ?? null).catch(() => {})
    console.log(`[MAE ASSINATURA] pago ws=${a.workspaceId} → acesso até ${somarDias(prox, CARENCIA_DIAS_MAE)}`)
  } else if (evento === 'PAYMENT_OVERDUE') {
    await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "status" = 'INADIMPLENTE', "updatedAt" = NOW() WHERE "id" = ${a.id} AND "status" IN ('TRIAL','ATIVA')`
    // carência de 3 dias a partir do vencimento não pago (inclusive o do fim do trial); um evento atrasado de um
    // ciclo antigo nunca encurta um acesso já pago adiante (GREATEST)
    await prisma.$executeRaw`UPDATE "Workspace" SET "moduloMaeAte" = GREATEST(COALESCE("moduloMaeAte", ${somarDias(venc, CARENCIA_DIAS_MAE)}::date), ${somarDias(venc, CARENCIA_DIAS_MAE)}::date), "updatedAt" = NOW()
      WHERE "id" = ${a.workspaceId} AND COALESCE("moduloMaeOrigem", '') <> 'cortesia'`
    console.log(`[MAE ASSINATURA] vencida ws=${a.workspaceId} (carência até ${somarDias(venc, CARENCIA_DIAS_MAE)})`)
    // pacote: o SOA atrasa junto (a carência de 3 dias do SOA conta do vencimento)
    if (a.plano === PLANO_COMBO) await prisma.$executeRaw`UPDATE "Workspace" SET "assinaturaStatus" = 'INADIMPLENTE', "assinaturaExpira" = ${venc}::date, "updatedAt" = NOW() WHERE "id" = ${a.workspaceId} AND "assinaturaStatus" = 'ATIVA' AND "assinaturaOrigem" = 'asaas' AND "liberacaoManual" IS NOT TRUE`
    // os e-mails de atraso/bloqueio/cobrança saem da régua das mensalidades (lib/cobranca/reguaMensal.ts)
  } else if (evento === 'PAYMENT_REFUNDED' || evento === 'PAYMENT_CHARGEBACK_REQUESTED') {
    await prisma.$executeRaw`UPDATE "Workspace" SET "moduloMaeAte" = ${hojeSP()}::date, "updatedAt" = NOW() WHERE "id" = ${a.workspaceId} AND COALESCE("moduloMaeOrigem", '') <> 'cortesia'`
    console.log(`[MAE ASSINATURA] ${evento} ws=${a.workspaceId} → acesso cortado`)
    if (a.plano === PLANO_COMBO) await prisma.$executeRaw`UPDATE "Workspace" SET "assinaturaStatus" = 'CORTADA', "updatedAt" = NOW() WHERE "id" = ${a.workspaceId} AND "assinaturaOrigem" = 'asaas' AND "liberacaoManual" IS NOT TRUE`
  }
  return true
}

/** Assinatura encerrada no Asaas (cancelada/inativada): vale até o fim do período pago. false = não é do MAE. */
export async function aplicarFimAssinaturaMae(sub: string): Promise<boolean> {
  const [a] = await prisma.$queryRaw<{ id: string; workspaceId: string; plano: string }[]>`SELECT "id","workspaceId","plano" FROM "MaeAssinatura" WHERE "subscriptionId" = ${sub} LIMIT 1`.catch(() => [])
  if (!a) return false
  // pacote cancelado: o SOA também (vale até o fim do período pago — assinaturaExpira)
  if (a.plano === PLANO_COMBO) await prisma.$executeRaw`UPDATE "Workspace" SET "assinaturaStatus" = 'CANCELADA', "updatedAt" = NOW() WHERE "id" = ${a.workspaceId} AND "assinaturaOrigem" = 'asaas' AND "liberacaoManual" IS NOT TRUE`
  await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = COALESCE("canceladaEm", NOW()), "canceladaPor" = COALESCE("canceladaPor", 'asaas'), "updatedAt" = NOW() WHERE "id" = ${a.id}`
  console.log(`[MAE ASSINATURA] encerrada no Asaas ws=${a.workspaceId} (acesso até o fim do período pago)`)
  await emailCanceladaMae(a.workspaceId, (await estadoMaeDaConta(a.workspaceId)).ate)
  return true
}

/**
 * CANCELAR PELA TELA (pedido da própria assinante; nada é estornado): apaga no Asaas a(s) assinatura(s) viva(s) do
 * MAE — a gravada e qualquer outra com "MAEA:<ws>" (no trial a subscription ainda não chegou ao nosso banco) — e
 * marca CANCELADA. O acesso segue até o fim do teste/período pago. Se o Asaas recusar, NADA é marcado.
 */
export async function cancelarAssinaturaMae(ws: string, por: string): Promise<{ ok: true; acessoAte: string | null } | { ok: false; erro: string }> {
  const a = await assinaturaMaeDaConta(ws)
  if (!a || a.status === 'CANCELADA') return { ok: false, erro: 'Não há assinatura do Método Mãe para cancelar.' }
  const ids = new Set<string>(a.subscriptionId ? [a.subscriptionId] : [])
  if (a.status !== 'AGUARDANDO_PAGAMENTO') {
    const r = await chamarAsaas<{ data?: { id: string }[] }>(`/subscriptions?externalReference=${encodeURIComponent(refAssinaturaMae(ws))}&status=ACTIVE&limit=20`)
    if (!r.ok) return { ok: false, erro: 'Não consegui falar com o Asaas agora — tente de novo em instantes.' }
    for (const s of r.dados?.data ?? []) ids.add(s.id)
  }
  for (const id of ids) {
    const d = await chamarAsaas(`/subscriptions/${id}`, { metodo: 'DELETE' })
    // 404 = já não existe lá (cancelada antes) — segue
    if (!d.ok && d.status !== 404) { console.error(`[MAE ASSINATURA] cancelar ws=${ws} sub=${id}: ${d.erro}`); return { ok: false, erro: 'O Asaas não confirmou o cancelamento — tente de novo em instantes.' } }
  }
  await prisma.$executeRaw`UPDATE "MaeAssinatura" SET "status" = 'CANCELADA', "canceladaEm" = NOW(), "canceladaPor" = ${por.slice(0, 120)}, "checkoutLink" = NULL, "updatedAt" = NOW() WHERE "id" = ${a.id}`
  const ate = a.status === 'AGUARDANDO_PAGAMENTO' ? null : (await estadoMaeDaConta(ws)).ate
  console.log(`[MAE ASSINATURA] cancelada pela tela ws=${ws} (${ids.size} assinatura(s) no Asaas) acesso até ${ate ?? '-'}`)
  if (a.status !== 'AGUARDANDO_PAGAMENTO') await emailCanceladaMae(ws, ate)
  return { ok: true, acessoAte: ate }
}

// ── cortesia (Master) ───────────────────────────────────────────────────────────────────────────
export async function definirCortesiaMae(ws: string, ativo: boolean): Promise<void> {
  if (ativo) await prisma.$executeRaw`UPDATE "Workspace" SET "moduloMae" = true, "moduloMaeOrigem" = 'cortesia', "moduloMaeAte" = NULL, "updatedAt" = NOW() WHERE "id" = ${ws}`
  else await prisma.$executeRaw`UPDATE "Workspace" SET "moduloMae" = false, "moduloMaeOrigem" = NULL, "updatedAt" = NOW() WHERE "id" = ${ws} AND "moduloMaeOrigem" = 'cortesia'`
}
