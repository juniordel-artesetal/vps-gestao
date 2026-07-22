// Textos dos avisos — PLACEHOLDERS.
//
// ⚠️ NADA AQUI É COPY FINAL. Os textos são do Júnior e do Diretor: este é o
//    primeiro contato automático do SOA falando de dinheiro com um público leigo,
//    e tom errado gera cancelamento em vez de pagamento. O que existe aqui é a
//    ESTRUTURA — assunto, variáveis disponíveis e canal — para a copy ser
//    encaixada sem mexer em lógica.
//
// Variáveis disponíveis em TODOS os pontos: nome, workspaceNome, linkAssinatura.
// As específicas estão em `variaveis` de cada ponto.
import type { TipoAviso } from './regua'

export interface PontoDeContato {
  tipo: TipoAviso
  /** Quando dispara, em português, para a tabela de revisão da copy. */
  momento: string
  canal: 'email'
  /** Placeholder — a copy final substitui. */
  assunto: string
  /** Variáveis além das comuns. */
  variaveis: string[]
  /** O que este contato precisa conseguir. Guia para quem escrever. */
  objetivo: string
}

export const PONTOS: Record<TipoAviso, PontoDeContato> = {
  TRIAL_D3: {
    tipo: 'TRIAL_D3', momento: '3 dias antes de o teste acabar', canal: 'email',
    assunto: '[PLACEHOLDER] Faltam 3 dias de teste',
    variaveis: ['diasRestantes', 'planoMensal', 'planoAnual'],
    objetivo: 'Converter sem pressão: mostrar o que ela já construiu no SOA.',
  },
  TRIAL_D1: {
    tipo: 'TRIAL_D1', momento: '1 dia antes de o teste acabar', canal: 'email',
    assunto: '[PLACEHOLDER] Seu teste acaba amanhã',
    variaveis: ['planoMensal', 'planoAnual'],
    objetivo: 'Urgência gentil; deixar claro que nada será apagado.',
  },
  TRIAL_FIM: {
    tipo: 'TRIAL_FIM', momento: 'no dia em que o teste acaba', canal: 'email',
    assunto: '[PLACEHOLDER] Seu teste terminou — seus dados continuam aqui',
    variaveis: ['diasDeCarencia'],
    objetivo: 'Tranquilizar: ainda há 7 dias de acesso para decidir.',
  },
  TRIAL_POS_D3: {
    tipo: 'TRIAL_POS_D3', momento: '3 dias após o fim do teste', canal: 'email',
    assunto: '[PLACEHOLDER] Ainda dá tempo de continuar',
    variaveis: ['diasAteCorte'],
    objetivo: 'Lembrar sem culpar; reforçar que os dados estão intactos.',
  },
  TRIAL_POS_D6: {
    tipo: 'TRIAL_POS_D6', momento: '6 dias após o fim — véspera do corte', canal: 'email',
    assunto: '[PLACEHOLDER] Amanhã seu acesso será pausado',
    variaveis: ['diasAteCorte'],
    objetivo: 'Último aviso. Dizer "pausado", não "cancelado" — nada se perde.',
  },
  INAD_D0: {
    tipo: 'INAD_D0', momento: 'no dia do vencimento não pago', canal: 'email',
    assunto: '[PLACEHOLDER] Não conseguimos confirmar seu pagamento',
    variaveis: ['valor', 'vencimento', 'invoiceUrl'],
    objetivo: 'Assumir que pode ser problema do cartão, não descuido dela.',
  },
  INAD_D3: {
    tipo: 'INAD_D3', momento: '3 dias após o vencimento', canal: 'email',
    assunto: '[PLACEHOLDER] Seu pagamento ainda está pendente',
    variaveis: ['valor', 'diasAteCorte', 'invoiceUrl'],
    objetivo: 'Facilitar a ação: link direto, sem burocracia.',
  },
  INAD_D6: {
    tipo: 'INAD_D6', momento: '6 dias após o vencimento — véspera do corte', canal: 'email',
    assunto: '[PLACEHOLDER] Amanhã seu acesso será pausado',
    variaveis: ['valor', 'invoiceUrl'],
    objetivo: 'Último aviso, mesmo tom do trial: pausa, não perda.',
  },
  RENOV_ANUAL_D7: {
    tipo: 'RENOV_ANUAL_D7', momento: '7 dias antes da renovação anual', canal: 'email',
    assunto: '[PLACEHOLDER] Sua assinatura anual renova em 7 dias',
    variaveis: ['valor', 'proximoVencimento', 'ehParcelado', 'valorParcela'],
    objetivo: 'Evitar susto e chargeback: avisar ANTES de cobrar valor alto.',
  },
  PARCELA_FALHOU: {
    tipo: 'PARCELA_FALHOU', momento: 'quando uma parcela do anual 12x não entra', canal: 'email',
    assunto: '[PLACEHOLDER] Uma parcela não foi paga',
    variaveis: ['numeroParcela', 'totalParcelas', 'valorParcela', 'invoiceUrl'],
    objetivo: 'Explicar que é só uma parcela, não a assinatura inteira.',
  },
  CORTE: {
    tipo: 'CORTE', momento: 'no dia do corte (trial+7 ou vencimento+7)', canal: 'email',
    assunto: '[PLACEHOLDER] Seu acesso foi pausado',
    variaveis: ['linkAssinatura'],
    objetivo: 'Acolher e mostrar o caminho de volta. Dados intactos, um clique.',
  },
}

export const LISTA_PONTOS = Object.values(PONTOS)

/** Corpo provisório. Substituir INTEIRO pela copy do Júnior/Diretor. */
export function montarEmail(ponto: PontoDeContato, vars: Record<string, unknown>): { assunto: string; html: string } {
  const linhas = Object.entries(vars).map(([k, v]) => `<li><strong>${k}</strong>: ${String(v)}</li>`).join('')
  return {
    assunto: ponto.assunto,
    html: `<div style="font-family:sans-serif">
      <p><em>[PLACEHOLDER — copy pendente do Júnior/Diretor]</em></p>
      <p><strong>${ponto.tipo}</strong> — ${ponto.momento}</p>
      <p>Objetivo: ${ponto.objetivo}</p>
      <ul>${linhas}</ul>
    </div>`,
  }
}
