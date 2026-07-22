// Copy da régua — RASCUNHO v1 do Diretor, pendente de revisão do Júnior.
//
// Princípios que a copy segue (e que qualquer edição futura deve manter):
//   • "acesso PAUSADO", nunca "cancelado" ou "bloqueado" — nada é apagado, e a
//     palavra certa é a diferença entre a artesã voltar e desistir;
//   • falta de pagamento é hipótese de problema no cartão, nunca descuido dela;
//   • um único link por e-mail;
//   • frases curtas, sem jargão.
//
// ⚠️ O 12x AINDA NÃO EXISTE. A copy de conversão menciona o parcelado, mas ele
//    depende da Opção D (bloqueada no conflito de PCI). Por isso o texto do 12x
//    fica atrás da condicional `temParcelado`, alimentada por PARCELADO_ATIVO:
//    prometer no e-mail uma forma de pagamento que a tela não oferece é a receita
//    para a artesã clicar, não achar, e desistir.
import type { TipoAviso } from './regua'
import { renderizar, paraHtml, type Variaveis } from './template'

/** Vira `true` quando a Opção D (anual 12x tokenizado) entrar no ar. */
export const PARCELADO_ATIVO = false

export interface PontoDeContato {
  tipo: TipoAviso
  momento: string
  canal: 'email'
  assunto: string
  corpo: string
  /** Variáveis além das comuns (nome, workspaceNome, linkAssinatura). */
  variaveis: string[]
  objetivo: string
}

const ASSINATURA = 'Equipe SOA'   // (?) Júnior avalia assinar como pessoa

export const PONTOS: Record<TipoAviso, PontoDeContato> = {

  TRIAL_D3: {
    tipo: 'TRIAL_D3', momento: '3 dias antes de o teste acabar', canal: 'email',
    variaveis: ['diasRestantes', 'planoMensal', 'planoAnual', 'temParcelado', 'planoParcelado'],
    objetivo: 'Converter sem pressão: mostrar o que ela já construiu no SOA.',
    assunto: '{{nome}}, faltam 3 dias do seu teste — e seu ateliê já está organizado 💛',
    corpo: `Oi, {{nome}}!

Seu período de teste do SOA termina em {{diasRestantes}} dias — e a gente espera que o {{workspaceNome}} já esteja mais leve de organizar por aqui.

Para continuar depois do teste, é só escolher seu plano:

Mensal — R$ {{planoMensal}}/mês{{#temParcelado}}
Anual — R$ {{planoAnual}} à vista ou 12x de R$ {{planoParcelado}}{{/temParcelado}}{{^temParcelado}}
Anual — R$ {{planoAnual}}{{/temParcelado}}

👉 Escolher meu plano: {{linkAssinatura}}

Qualquer dúvida, é só responder este e-mail. A gente responde de verdade. 😊

${ASSINATURA}`,
  },

  TRIAL_D1: {
    tipo: 'TRIAL_D1', momento: '1 dia antes de o teste acabar', canal: 'email',
    variaveis: ['planoMensal', 'planoAnual', 'temParcelado', 'planoParcelado'],
    objetivo: 'Urgência gentil; deixar claro que nada será apagado.',
    assunto: 'Seu teste termina amanhã, {{nome}}',
    corpo: `Oi, {{nome}}!

Amanhã termina seu período de teste do SOA. Tudo o que você organizou no {{workspaceNome}} — pedidos, produção, clientes — continua guardadinho.

Para não parar o ritmo, escolha seu plano hoje:

👉 {{linkAssinatura}}

Mensal R$ {{planoMensal}} ou Anual R$ {{planoAnual}}{{#temParcelado}} (à vista ou 12x de R$ {{planoParcelado}}){{/temParcelado}}. Leva menos de 2 minutos.

${ASSINATURA}`,
  },

  TRIAL_FIM: {
    tipo: 'TRIAL_FIM', momento: 'no dia em que o teste acaba', canal: 'email',
    variaveis: ['diasDeCarencia'],
    objetivo: 'Tranquilizar: ainda há dias de acesso para decidir.',
    assunto: 'Seu teste terminou — mas calma, você ainda tem uns dias 💛',
    corpo: `Oi, {{nome}}!

Seu período de teste do SOA terminou hoje. Mas respira: você ainda tem {{diasDeCarencia}} dias de acesso para escolher seu plano com calma.

Nada foi apagado e nada vai ser. Seu ateliê continua aqui, do jeitinho que você deixou.

👉 Escolher meu plano: {{linkAssinatura}}

${ASSINATURA}`,
  },

  TRIAL_POS_D3: {
    tipo: 'TRIAL_POS_D3', momento: '3 dias após o fim do teste', canal: 'email',
    variaveis: ['diasAteCorte'],
    objetivo: 'Lembrar sem culpar; abrir conversa para tirar dúvida de decisão.',
    assunto: '{{nome}}, seu ateliê está sentindo sua falta',
    corpo: `Oi, {{nome}}!

Só passando para lembrar: seu acesso ao SOA continua liberado por mais {{diasAteCorte}} dias, esperando você escolher um plano.

Se ficou alguma dúvida sobre o SOA — se ele serve para o seu jeito de produzir, qual plano compensa mais — responde este e-mail que a gente te ajuda a decidir. Sem compromisso.

👉 {{linkAssinatura}}

${ASSINATURA}`,
  },

  TRIAL_POS_D6: {
    tipo: 'TRIAL_POS_D6', momento: '6 dias após o fim — véspera do corte', canal: 'email',
    // Nenhuma além das comuns: a copy diz "amanhã", que é mais direto que "faltam
    // N dias" na véspera. Declarar variável que o texto não usa mascara erro real.
    variaveis: [],
    objetivo: 'Último aviso. "Pausado", não "cancelado" — nada se perde.',
    assunto: 'Amanhã seu acesso será pausado, {{nome}}',
    corpo: `Oi, {{nome}}.

Amanhã o seu acesso ao SOA será pausado — pausado mesmo, não cancelado: seus pedidos, clientes e produção ficam guardados em segurança, esperando você.

Para continuar sem interrupção, escolha seu plano ainda hoje:

👉 {{linkAssinatura}}

E se o SOA não fez sentido para você neste momento, tudo bem também — a porta fica aberta. 💛

${ASSINATURA}`,
  },

  INAD_D0: {
    tipo: 'INAD_D0', momento: 'no dia do vencimento não pago', canal: 'email',
    variaveis: ['valor', 'vencimento', 'invoiceUrl'],
    objetivo: 'Assumir que pode ser problema do cartão, não descuido dela.',
    assunto: 'O pagamento da sua assinatura não passou — deve ser coisa do cartão',
    corpo: `Oi, {{nome}}!

O pagamento da sua assinatura do SOA (R$ {{valor}}, vencimento {{vencimento}}) não foi aprovado. Isso acontece — geralmente é o limite do cartão, o cartão que venceu, ou o banco travando por segurança.

Seu acesso continua normal. Para regularizar, é só pagar por aqui:

👉 {{invoiceUrl}}

Se precisar trocar o cartão ou tiver qualquer dúvida, responde este e-mail.

${ASSINATURA}`,
  },

  INAD_D3: {
    tipo: 'INAD_D3', momento: '3 dias após o vencimento', canal: 'email',
    variaveis: ['valor', 'diasAteCorte', 'invoiceUrl'],
    objetivo: 'Facilitar a ação: link direto, sem burocracia.',
    assunto: '{{nome}}, seu pagamento ainda não entrou ({{diasAteCorte}} dias para regularizar)',
    corpo: `Oi, {{nome}}!

O pagamento de R$ {{valor}} da sua assinatura ainda não entrou. Seu acesso segue liberado por mais {{diasAteCorte}} dias.

Regularizar leva 1 minuto:

👉 {{invoiceUrl}}

Se algo estiver dificultando — cartão, valor, qualquer coisa — fala com a gente. Sempre dá para resolver junto.

${ASSINATURA}`,
  },

  INAD_D6: {
    tipo: 'INAD_D6', momento: '6 dias após o vencimento — véspera do corte', canal: 'email',
    variaveis: ['valor', 'invoiceUrl'],
    objetivo: 'Último aviso, mesmo tom do trial: pausa, não perda.',
    assunto: 'Amanhã seu acesso será pausado — resolve em 1 minuto?',
    corpo: `Oi, {{nome}}.

Amanhã seu acesso ao SOA será pausado por falta do pagamento de R$ {{valor}}. Nada será apagado — seu ateliê fica guardado esperando você.

Para continuar sem interrupção:

👉 {{invoiceUrl}}

Se o pagamento já foi feito e você recebeu este e-mail, nos avise respondendo aqui — a gente confere na hora.

${ASSINATURA}`,
  },

  RENOV_ANUAL_D7: {
    tipo: 'RENOV_ANUAL_D7', momento: '7 dias antes da renovação anual', canal: 'email',
    variaveis: ['valor', 'proximoVencimento', 'ehParcelado', 'valorParcela'],
    objetivo: 'Evitar susto e chargeback: avisar ANTES de cobrar valor alto.',
    assunto: 'Sua assinatura anual do SOA renova em 7 dias',
    corpo: `Oi, {{nome}}!

Passando para avisar com antecedência, como você merece: sua assinatura anual do SOA renova no dia {{proximoVencimento}}.

{{#ehParcelado}}Valor: 12x de R$ {{valorParcela}} no cartão, como no ano passado.{{/ehParcelado}}{{^ehParcelado}}Valor: R$ {{valor}} à vista, como no ano passado.{{/ehParcelado}}

Não precisa fazer nada — a renovação é automática. Se quiser trocar de plano ou conversar antes, é só responder este e-mail.

Obrigado por mais um ano organizando seu ateliê com a gente. 💛

${ASSINATURA}`,
  },

  PARCELA_FALHOU: {
    tipo: 'PARCELA_FALHOU', momento: 'quando uma parcela do anual 12x não entra', canal: 'email',
    variaveis: ['numeroParcela', 'totalParcelas', 'valorParcela', 'invoiceUrl'],
    objetivo: 'Explicar que é só uma parcela, não a assinatura inteira.',
    assunto: 'Uma parcela da sua assinatura não passou no cartão',
    corpo: `Oi, {{nome}}!

A parcela {{numeroParcela}} de {{totalParcelas}} da sua assinatura anual (R$ {{valorParcela}}) não foi aprovada no cartão. Sua assinatura continua ativa — é só essa parcela que precisa de atenção.

Geralmente é o limite do mês ou o banco travando por segurança. Para resolver:

👉 {{invoiceUrl}}

Qualquer dúvida, responde aqui que a gente ajuda.

${ASSINATURA}`,
  },

  CORTE: {
    tipo: 'CORTE', momento: 'no dia do corte (trial+7 ou vencimento+7)', canal: 'email',
    variaveis: [],
    objetivo: 'Acolher e mostrar o caminho de volta. Dados intactos, um clique.',
    assunto: 'Seu acesso foi pausado — e voltar é simples 💛',
    corpo: `Oi, {{nome}}.

Seu acesso ao SOA foi pausado hoje. A gente queria muito que não tivesse chegado a esse ponto — mas queremos que você saiba duas coisas:

Nada foi apagado. Seus pedidos, clientes, produção e histórico do {{workspaceNome}} estão guardados em segurança.

Voltar leva 1 minuto. Assim que o pagamento entrar, seu acesso reabre sozinho, com tudo no lugar:

👉 {{linkAssinatura}}

E se você decidiu parar por agora, tudo bem — a porta fica aberta, e seu ateliê estará aqui se você voltar.

${ASSINATURA}`,
  },
}

export const LISTA_PONTOS = Object.values(PONTOS)

export function montarEmail(ponto: PontoDeContato, vars: Variaveis): { assunto: string; html: string; texto: string } {
  const completas: Variaveis = { ...vars, temParcelado: PARCELADO_ATIVO }
  const texto = renderizar(ponto.corpo, completas)
  return {
    assunto: renderizar(ponto.assunto, completas),
    html: paraHtml(texto),
    texto,
  }
}
