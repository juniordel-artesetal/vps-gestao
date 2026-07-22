// A RÉGUA — que aviso cada workspace merece hoje, e quem deve ser cortada.
//
// Função PURA de propósito: a régua é a peça que decide cortar o acesso de alguém
// que paga, então precisa ser exercitável com datas forjadas, sem banco e sem
// e-mail. Quem aplica os efeitos é o job (app/api/cron/assinaturas).
//
// Espelha lib/assinatura: DIAS_CARENCIA de 7 dias vale tanto para trial quanto
// para inadimplência — "nunca assinou" e "assinou e atrasou" seguem o mesmo
// caminho, o que simplifica o código e a conversa com a artesã.
import { DIAS_CARENCIA } from './index'

/** Pontos de contato da régua. O texto de cada um vem do Júnior/Diretor. */
export type TipoAviso =
  // ── Checkout abandonado — o furo mais provável do funil de entrada
  | 'CHECKOUT_ABANDONADO_1H'    // 1h depois de criar a conta sem concluir
  | 'CHECKOUT_ABANDONADO_23H'   // véspera de o link morrer (expira em 24h)
  // ── Trial: converter antes de acabar
  | 'TRIAL_D3'          // faltam 3 dias
  | 'TRIAL_D1'          // falta 1 dia
  | 'TRIAL_FIM'         // acabou hoje
  // ── Trial: carência antes do corte
  | 'TRIAL_POS_D3'      // 3 dias depois do fim
  | 'TRIAL_POS_D6'      // 6 dias depois — véspera do corte
  // ── Inadimplência de cobrança já emitida
  | 'INAD_D0'           // venceu hoje
  | 'INAD_D3'
  | 'INAD_D6'           // véspera do corte
  // ── Renovação anual: aviso ANTES de cobrar valor alto
  | 'RENOV_ANUAL_D7'
  // ── Parcela do anual 12x que não entrou
  | 'PARCELA_FALHOU'
  // ── Corte efetivo (e-mail + mudança de estado)
  | 'CORTE'

export interface LinhaRegua {
  workspaceId: string
  assinaturaOrigem: string | null
  assinaturaStatus: string | null
  liberacaoManual: boolean
  ativo: boolean
  /** Fim do trial. */
  trialAte: Date | null
  /** Vencimento da cobrança em aberto / fim do período pago. */
  assinaturaExpira: Date | null
  /** Próxima cobrança da assinatura (para o aviso anual). */
  proximoVencimento?: Date | null
  ciclo?: string | null
  /** Há parcela do 12x em atraso? */
  parcelaFalhou?: boolean
  /** Quando o checkout foi criado — base dos avisos de abandono. */
  checkoutCriadoEm?: Date | null
  /** 'cartao' | 'pix' — muda o PAPEL dos avisos de fim de trial. */
  metodoEscolhido?: string | null
  /** 'mensal' | 'anual' — usado no texto dos avisos de abandono. */
  planoEscolhido?: string | null
}

export interface Decisao {
  workspaceId: string
  avisos: TipoAviso[]
  cortar: boolean
  /** Por que — para log, prova e a tela do Master. */
  motivo: string
}

/** Horas cheias desde `data`. O abandono se mede em horas: o link vive 24h. */
export function horasDesde(data: Date, agora = new Date()): number {
  return Math.floor((agora.getTime() - new Date(data).getTime()) / 3_600_000)
}

/** Dias inteiros de hoje até `data` (positivo = futuro). */
export function diasAte(data: Date | null | undefined, hoje = new Date()): number | null {
  if (!data) return null
  const a = new Date(hoje); a.setHours(0, 0, 0, 0)
  const b = new Date(data); b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Decide os avisos e o corte de UMA workspace.
 *
 * Ordem das guardas importa: `liberacaoManual` e origem são checadas ANTES de
 * qualquer cálculo de data, para que nenhuma conta protegida ou de outro caminho
 * apareça sequer como candidata.
 */
export function decidir(l: LinhaRegua, hoje = new Date()): Decisao {
  const nada = (motivo: string): Decisao => ({ workspaceId: l.workspaceId, avisos: [], cortar: false, motivo })

  // 1) Trava do Master vence tudo — nem avisa, nem corta.
  if (l.liberacaoManual) return nada('liberação manual do Master')

  // 2) Só o caminho Asaas. Hotmart e contas antigas seguem intocadas.
  if (l.assinaturaOrigem !== 'asaas') return nada(`origem '${l.assinaturaOrigem}' — fora da régua`)

  // 3) Já cortada ou cancelada: não há o que avisar de novo.
  if (l.assinaturaStatus === 'CORTADA' || l.assinaturaStatus === 'CANCELADA') {
    return nada(`já em ${l.assinaturaStatus}`)
  }

  const avisos: TipoAviso[] = []
  let cortar = false
  let motivo = 'sem ação'

  // ── CHECKOUT ABANDONADO ──────────────────────────────────────────────────
  // Em HORAS, não em dias: o link do Asaas morre em 24h, então uma régua diária
  // avisaria depois de o link já ter expirado. NUNCA corta — a conta fica lá,
  // sem acesso, e ela pode voltar e gerar um link novo quando quiser.
  if (l.assinaturaStatus === 'AGUARDANDO_PAGAMENTO' && l.checkoutCriadoEm) {
    const h = horasDesde(l.checkoutCriadoEm, hoje)
    if (h >= 1 && h < 2) { avisos.push('CHECKOUT_ABANDONADO_1H'); motivo = 'checkout aberto há 1h sem concluir' }
    else if (h >= 23 && h < 24) { avisos.push('CHECKOUT_ABANDONADO_23H'); motivo = 'link expira em 1h' }
    return { workspaceId: l.workspaceId, avisos, cortar: false, motivo }
  }

  // ── TRIAL ────────────────────────────────────────────────────────────────
  //
  // O PAPEL destes avisos muda com o método, e a diferença é séria:
  //   CARTÃO → o cartão já está cadastrado e a cobrança sai sozinha. D-3 e D-1
  //            viram AVISO DE COBRANÇA — obrigação anti-chargeback, não cortesia.
  //            E TRIAL_FIM não existe: não há decisão para ela tomar.
  //   PIX    → ela precisa pagar a fatura na mão. Seguem sendo conversão.
  const noCartao = l.metodoEscolhido === 'cartao'
  if (l.assinaturaStatus === 'TRIAL' && l.trialAte) {
    const d = diasAte(l.trialAte, hoje)!      // >0 futuro, 0 hoje, <0 passado
    if (d === 3) { avisos.push('TRIAL_D3'); motivo = 'trial acaba em 3 dias' }
    else if (d === 1) { avisos.push('TRIAL_D1'); motivo = 'trial acaba amanhã' }
    else if (d === 0 && !noCartao) { avisos.push('TRIAL_FIM'); motivo = 'trial acabou hoje' }
    else if (d === -3) { avisos.push('TRIAL_POS_D3'); motivo = 'trial vencido há 3 dias' }
    else if (d === -6) { avisos.push('TRIAL_POS_D6'); motivo = 'trial vencido há 6 dias — véspera do corte' }
    else if (d <= -(DIAS_CARENCIA + 1)) {
      // Dia 21 = trial (14) + carência (7). Só corta DEPOIS do último dia.
      cortar = true; avisos.push('CORTE')
      motivo = `trial vencido há ${-d} dias — carência esgotada`
    }
  }

  // ── INADIMPLÊNCIA ────────────────────────────────────────────────────────
  if (l.assinaturaStatus === 'INADIMPLENTE' && l.assinaturaExpira) {
    const d = diasAte(l.assinaturaExpira, hoje)
    if (d === 0) { avisos.push('INAD_D0'); motivo = 'cobrança venceu hoje' }
    else if (d === -3) { avisos.push('INAD_D3'); motivo = 'cobrança vencida há 3 dias' }
    else if (d === -6) { avisos.push('INAD_D6'); motivo = 'vencida há 6 dias — véspera do corte' }
    else if (d !== null && d <= -(DIAS_CARENCIA + 1)) {
      cortar = true; avisos.push('CORTE')
      motivo = `cobrança vencida há ${-d} dias — carência esgotada`
    }
  }

  // ── RENOVAÇÃO ANUAL — avisar ANTES de cobrar valor alto ──────────────────
  // Cobrança de centenas de reais sem aviso vira chargeback e rancor, mesmo de
  // quem pretendia continuar.
  if (l.assinaturaStatus === 'ATIVA' && l.ciclo === 'YEARLY' && diasAte(l.proximoVencimento, hoje) === 7) {
    avisos.push('RENOV_ANUAL_D7')
    motivo = 'renovação anual em 7 dias'
  }

  // ── PARCELA DO 12x QUE NÃO ENTROU ────────────────────────────────────────
  // Não é inadimplência da assinatura: o parcelamento segue vivo, só uma parcela
  // falhou. Merece texto próprio e NÃO dispara corte por si só.
  if (l.parcelaFalhou) {
    avisos.push('PARCELA_FALHOU')
    if (motivo === 'sem ação') motivo = 'parcela do anual 12x não foi paga'
  }

  return { workspaceId: l.workspaceId, avisos, cortar, motivo }
}
