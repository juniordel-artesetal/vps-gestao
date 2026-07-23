// Copy da régua — v2 FINAL, aprovada pelo Júnior (assinatura "Equipe SOA").
// Fonte: COPY_REGUA_ASSINATURA_SOA_v2.md (commitado junto, como documentação).
//
// Princípios que a copy segue (e que qualquer edição futura deve manter):
//   • "acesso PAUSADO", nunca "cancelado" ou "bloqueado" — nada é apagado, e a
//     palavra certa é a diferença entre a artesã voltar e desistir;
//   • falta de pagamento é hipótese de problema no cartão, nunca descuido dela;
//   • um único link por e-mail, e sempre para a TELA ({{linkAssinatura}}), nunca
//     para o link perecível da fatura;
//   • frases curtas, sem jargão.
//
// PAPÉIS POR MÉTODO (a diferença da v2): no fim do trial, o cartão recebe um
// AVISO DE COBRANÇA (a cobrança sai sozinha — avisar antes é anti-chargeback),
// e o Pix recebe um CONVITE de conversão (ele precisa pagar na mão). Por isso
// TRIAL_D3 e TRIAL_D1 trazem as duas versões atrás de {{#ehCartao}}/{{^ehCartao}}.
// TRIAL_FIM/POS são só do Pix — a régua nunca os manda para cartão.
//
// ⚠️ O 12x AINDA NÃO EXISTE. A menção ao parcelado (só na renovação anual) fica
//    atrás da condicional `ehParcelado`, alimentada por PARCELADO_ATIVO: prometer
//    no e-mail uma forma que a tela não oferece é a receita para a artesã clicar,
//    não achar, e desistir.
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

const ASSINATURA = 'Equipe SOA'   // decisão do Júnior (v2)

export const PONTOS: Record<TipoAviso, PontoDeContato> = {

  // ── Funil de entrada: ela criou a conta e parou no pagamento ──────────────
  CHECKOUT_ABANDONADO_1H: {
    tipo: 'CHECKOUT_ABANDONADO_1H', momento: '1h após criar a conta sem concluir o pagamento', canal: 'email',
    variaveis: [],
    objetivo: 'Resgatar sem cobrar: talvez tenha caído a internet, talvez tenha dúvida.',
    assunto: '{{nome}}, seu SOA está quase pronto — falta só um passo',
    corpo: `Oi, {{nome}}!

Sua conta no SOA já está criada e o {{workspaceNome}} te esperando. Falta só escolher como pagar depois dos seus **14 dias grátis** — e aí o teste começa na hora:

👉 {{linkAssinatura}}

Leva menos de 2 minutos. Hoje você não paga nada.

${ASSINATURA}`,
  },

  CHECKOUT_ABANDONADO_23H: {
    tipo: 'CHECKOUT_ABANDONADO_23H', momento: '23h após — o link expira em 1h', canal: 'email',
    variaveis: [],
    objetivo: 'Última chamada, sem drama: o teste só começa quando ela concluir.',
    assunto: 'Seus 14 dias grátis continuam te esperando',
    corpo: `Oi, {{nome}}!

Passando para lembrar: seus 14 dias grátis do SOA ainda não começaram a contar — eles só começam quando você concluir o cadastro do pagamento. Ou seja: você não perdeu nada. 😊

👉 {{linkAssinatura}}

Qualquer dúvida sobre planos ou sobre o SOA, é só responder.

${ASSINATURA}`,
  },

  CHECKOUT_ABANDONADO_D2: {
    tipo: 'CHECKOUT_ABANDONADO_D2', momento: '2 dias após — o link já morreu', canal: 'email',
    variaveis: ['segmento'],
    objetivo: 'Resgate: convencer a voltar, ancorando no segmento dela.',
    assunto: 'Seu ateliê organizado está a 2 minutos de distância',
    corpo: `Oi, {{nome}}!

Você criou sua conta no SOA há dois dias — e a organização que você foi buscar continua aqui, pronta: pedidos, produção, clientes, tudo num lugar só, feito para {{segmento}}.

Seus 14 dias grátis começam quando você quiser:

👉 {{linkAssinatura}}

Se travou em alguma coisa ou ficou com dúvida, responde este e-mail — a gente te ajuda pessoalmente.

${ASSINATURA}`,
  },

  CHECKOUT_ABANDONADO_D6: {
    tipo: 'CHECKOUT_ABANDONADO_D6', momento: '6 dias após — último toque', canal: 'email',
    variaveis: [],
    objetivo: 'Último contato. Porta aberta, sem insistência — e sem sumir de vez.',
    assunto: 'A porta fica aberta, {{nome}} 💛',
    corpo: `Oi, {{nome}}.

Este é nosso último lembrete — prometemos não encher sua caixa de entrada.

Sua conta no SOA continua criada, e seus 14 dias grátis continuam disponíveis quando você quiser começar:

👉 {{linkAssinatura}}

Se o momento não é agora, tudo bem. Quando o ateliê apertar e você precisar de organização, estaremos aqui.

${ASSINATURA}`,
  },

  // ── Fim do trial: cartão = aviso de cobrança / Pix = convite de conversão ──
  TRIAL_D3: {
    tipo: 'TRIAL_D3', momento: '3 dias antes de o teste acabar', canal: 'email',
    variaveis: ['ehCartao', 'dataCobranca', 'valor'],
    // ⚠️ NO CARTÃO este e-mail é AVISO DE COBRANÇA, não convite: a cobrança sai
    // sozinha. Avisar antes deixa de ser cortesia e vira obrigação — cobrar sem
    // aviso é a receita do chargeback, que custa caro e mancha a conta.
    objetivo: 'Cartão: avisar que vamos cobrar. Pix: converter sem pressão.',
    assunto: '{{#ehCartao}}Seus 14 dias grátis terminam em 3 dias — sua assinatura começa dia {{dataCobranca}}{{/ehCartao}}{{^ehCartao}}Faltam 3 dias do seu teste — seu Pix já está pronto 💛{{/ehCartao}}',
    corpo: `Oi, {{nome}}!
{{#ehCartao}}
Esperamos que estes dias com o SOA já tenham deixado o {{workspaceNome}} mais organizado. 💛

Um aviso transparente, do jeito que você merece: seu período grátis termina em 3 dias, e no dia **{{dataCobranca}}** faremos a primeira cobrança de **R$ {{valor}}** no cartão que você cadastrou — aí sua assinatura começa oficialmente.

Não precisa fazer nada. Se quiser trocar de plano ou conversar antes, é só responder este e-mail ou acessar: {{linkAssinatura}}{{/ehCartao}}{{^ehCartao}}
Seu período de teste do SOA termina em 3 dias. Para continuar sem interrupção, é só pagar seu primeiro Pix de **R$ {{valor}}** — leva menos de um minuto:

👉 {{linkAssinatura}}

Tudo o que você organizou no {{workspaceNome}} continua aqui, do jeitinho que você deixou.{{/ehCartao}}

${ASSINATURA}`,
  },

  TRIAL_D1: {
    tipo: 'TRIAL_D1', momento: '1 dia antes de o teste acabar', canal: 'email',
    variaveis: ['ehCartao', 'valor'],
    objetivo: 'Cartão: lembrar da cobrança de amanhã. Pix: urgência gentil.',
    assunto: '{{#ehCartao}}Amanhã sua assinatura do SOA começa (R$ {{valor}} no seu cartão){{/ehCartao}}{{^ehCartao}}Seu teste termina amanhã, {{nome}} — garanta sua vaga com um Pix{{/ehCartao}}',
    corpo: `Oi, {{nome}}!
{{#ehCartao}}
Lembrete rápido e sem pegadinha: **amanhã** termina seu período grátis e faremos a cobrança de **R$ {{valor}}** no seu cartão. Sua assinatura segue automática a partir daí.

Se quiser ajustar qualquer coisa antes — plano, forma de pagamento, ou cancelar — este é o momento: {{linkAssinatura}}

Bom trabalho no ateliê hoje! 💛{{/ehCartao}}{{^ehCartao}}
Amanhã termina seu período grátis. Seu Pix de **R$ {{valor}}** está pronto, esperando só o seu toque:

👉 {{linkAssinatura}}

Qualquer dúvida antes de decidir, responde este e-mail — a gente responde de verdade. 😊{{/ehCartao}}

${ASSINATURA}`,
  },

  TRIAL_FIM: {
    tipo: 'TRIAL_FIM', momento: 'no dia em que o teste acaba (só Pix)', canal: 'email',
    variaveis: ['diasDeCarencia'],
    objetivo: 'Tranquilizar: ainda há dias de acesso para pagar com calma.',
    assunto: 'Seu teste terminou — mas calma, você ainda tem {{diasDeCarencia}} dias 💛',
    corpo: `Oi, {{nome}}!

Seu período de teste terminou hoje. Mas respira: **seu acesso continua liberado por mais {{diasDeCarencia}} dias** para você pagar com calma.

Nada foi apagado e nada vai ser. Seu Pix está aqui:

👉 {{linkAssinatura}}

${ASSINATURA}`,
  },

  TRIAL_POS_D3: {
    tipo: 'TRIAL_POS_D3', momento: '3 dias após o fim do teste (só Pix)', canal: 'email',
    variaveis: ['diasAteCorte'],
    objetivo: 'Lembrar sem culpar; abrir conversa para tirar dúvida de decisão.',
    assunto: '{{nome}}, seu ateliê está sentindo sua falta',
    corpo: `Oi, {{nome}}!

Seu acesso ao SOA segue liberado por mais {{diasAteCorte}} dias, esperando seu primeiro pagamento.

Se ficou alguma dúvida — se o SOA serve para o seu jeito de produzir, qual plano compensa — responde este e-mail que a gente te ajuda a decidir. Sem compromisso.

👉 {{linkAssinatura}}

${ASSINATURA}`,
  },

  TRIAL_POS_D6: {
    tipo: 'TRIAL_POS_D6', momento: '6 dias após o fim — véspera do corte (só Pix)', canal: 'email',
    variaveis: [],
    objetivo: 'Último aviso. "Pausado", não "cancelado" — nada se perde.',
    assunto: 'Amanhã seu acesso será pausado, {{nome}}',
    corpo: `Oi, {{nome}}.

Amanhã o seu acesso ao SOA será **pausado** — pausado, não cancelado: seus pedidos, clientes e produção ficam guardados em segurança, esperando você.

Para continuar sem interrupção, seu Pix está a um toque:

👉 {{linkAssinatura}}

E se o SOA não fez sentido neste momento, tudo bem também — a porta fica aberta. 💛

${ASSINATURA}`,
  },

  // ── Inadimplência (os dois métodos) ───────────────────────────────────────
  INAD_D0: {
    tipo: 'INAD_D0', momento: 'no dia do vencimento não pago', canal: 'email',
    variaveis: ['valor', 'vencimento'],
    objetivo: 'Assumir que pode ser problema do cartão, não descuido dela.',
    assunto: 'O pagamento da sua assinatura não entrou — deve ser coisa boba',
    corpo: `Oi, {{nome}}!

O pagamento da sua assinatura (R$ {{valor}}, vencimento {{vencimento}}) não foi aprovado. Isso acontece — geralmente é limite do cartão, cartão vencido ou o banco travando por segurança.

**Seu acesso continua normal.** Para regularizar:

👉 {{linkAssinatura}}

Se precisar de ajuda, responde este e-mail.

${ASSINATURA}`,
  },

  INAD_D3: {
    tipo: 'INAD_D3', momento: '3 dias após o vencimento', canal: 'email',
    variaveis: ['valor', 'diasAteCorte'],
    objetivo: 'Facilitar a ação: link direto, sem burocracia.',
    assunto: '{{nome}}, faltam {{diasAteCorte}} dias para regularizar sua assinatura',
    corpo: `Oi, {{nome}}!

O pagamento de R$ {{valor}} ainda não entrou. Seu acesso segue liberado por mais {{diasAteCorte}} dias — regularizar leva 1 minuto:

👉 {{linkAssinatura}}

Se algo estiver dificultando — cartão, valor, qualquer coisa — fala com a gente. Sempre dá para resolver junto.

${ASSINATURA}`,
  },

  INAD_D6: {
    tipo: 'INAD_D6', momento: '6 dias após o vencimento — véspera do corte', canal: 'email',
    variaveis: ['valor'],
    objetivo: 'Último aviso, mesmo tom do trial: pausa, não perda.',
    assunto: 'Amanhã seu acesso será pausado — resolve em 1 minuto?',
    corpo: `Oi, {{nome}}.

Amanhã seu acesso será pausado por falta do pagamento de R$ {{valor}}. Nada será apagado — seu ateliê fica guardado esperando você.

👉 {{linkAssinatura}}

Se você já pagou e recebeu este e-mail, nos avise respondendo aqui — conferimos na hora.

${ASSINATURA}`,
  },

  // ── Renovação e parcelas ──────────────────────────────────────────────────
  RENOV_ANUAL_D7: {
    tipo: 'RENOV_ANUAL_D7', momento: '7 dias antes da renovação anual', canal: 'email',
    variaveis: ['proximoVencimento', 'ehParcelado', 'valorParcela', 'valor'],
    objetivo: 'Evitar susto e chargeback: avisar ANTES de cobrar valor alto.',
    assunto: 'Sua assinatura anual do SOA renova em 7 dias',
    corpo: `Oi, {{nome}}!

Avisando com antecedência, como você merece: sua assinatura anual renova no dia **{{proximoVencimento}}**.

{{#ehParcelado}}Como no ano passado: 12x de R$ {{valorParcela}} no seu cartão.{{/ehParcelado}}{{^ehParcelado}}Valor: R$ {{valor}}, como no ano passado.{{/ehParcelado}}

Não precisa fazer nada — a renovação é automática. Quer trocar de plano ou conversar antes? Responde este e-mail.

Obrigado por mais um ano organizando seu ateliê com a gente. 💛

${ASSINATURA}`,
  },

  PARCELA_FALHOU: {
    tipo: 'PARCELA_FALHOU', momento: 'quando uma parcela do anual 12x não entra', canal: 'email',
    variaveis: ['numeroParcela', 'totalParcelas', 'valorParcela'],
    objetivo: 'Explicar que é só uma parcela, não a assinatura inteira.',
    assunto: 'Uma parcela da sua assinatura não passou no cartão',
    corpo: `Oi, {{nome}}!

A parcela {{numeroParcela}} de {{totalParcelas}} da sua assinatura anual (R$ {{valorParcela}}) não foi aprovada. **Sua assinatura continua ativa** — é só essa parcela que precisa de atenção.

Geralmente é o limite do mês ou o banco travando por segurança:

👉 {{linkAssinatura}}

${ASSINATURA}`,
  },

  // ── Corte ─────────────────────────────────────────────────────────────────
  CORTE: {
    tipo: 'CORTE', momento: 'no dia do corte (trial+7 ou vencimento+7)', canal: 'email',
    variaveis: [],
    objetivo: 'Acolher e mostrar o caminho de volta. Dados intactos, um clique.',
    assunto: 'Seu acesso foi pausado — e voltar é simples 💛',
    corpo: `Oi, {{nome}}.

Seu acesso ao SOA foi pausado hoje. Queríamos muito que não tivesse chegado a esse ponto — mas você precisa saber de duas coisas:

**Nada foi apagado.** Pedidos, clientes, produção e histórico do {{workspaceNome}} estão guardados em segurança.

**Voltar leva 1 minuto.** Assim que o pagamento entrar, seu acesso reabre sozinho, com tudo no lugar:

👉 {{linkAssinatura}}

E se você decidiu parar por agora, tudo bem — a porta fica aberta.

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
