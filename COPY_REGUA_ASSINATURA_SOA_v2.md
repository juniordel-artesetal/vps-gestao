# Copy da Régua de Assinatura — SOA · v2 FINAL para aprovação do Júnior

**Mudanças da v1 → v2:** papéis por método (cartão = aviso de cobrança obrigatório anti-chargeback; Pix = conversão manual); 4 e-mails de checkout abandonado (novos); renovação anual com variante parcelada; e-mails apontam sempre para a TELA (`{{linkAssinatura}}`), nunca para link perecível.

**⚠️ Decisão pendente do Júnior:** a assinatura dos e-mails. Está como `{{assinatura}}` — escolha: **"Equipe SOA"** ou **nome de gente** (recomendação minha e do dev: nome pessoal, ex. "Naty do SOA" — converte mais e os e-mails convidam a responder). Uma palavra sua define.

Variáveis por e-mail conforme implementado. Em todos: `{{nome}}`, `{{workspaceNome}}`, `{{linkAssinatura}}`.

---

## BLOCO A — Fim do trial · CARTÃO (aviso de cobrança automática)

### A1. TRIAL_D3 (cartão)
**Assunto:** Seus 14 dias grátis terminam em 3 dias — sua assinatura começa dia {{dataCobranca}}

Oi, {{nome}}!

Esperamos que estes dias com o SOA já tenham deixado o {{workspaceNome}} mais organizado. 💛

Um aviso transparente, do jeito que você merece: seu período grátis termina em 3 dias, e no dia **{{dataCobranca}}** faremos a primeira cobrança de **R$ {{valor}}** no cartão que você cadastrou — aí sua assinatura começa oficialmente.

Não precisa fazer nada. Se quiser trocar de plano ou conversar antes, é só responder este e-mail ou acessar: {{linkAssinatura}}

{{assinatura}}

### A2. TRIAL_D1 (cartão)
**Assunto:** Amanhã sua assinatura do SOA começa (R$ {{valor}} no seu cartão)

Oi, {{nome}}!

Lembrete rápido e sem pegadinha: **amanhã** termina seu período grátis e faremos a cobrança de **R$ {{valor}}** no seu cartão. Sua assinatura segue automática a partir daí.

Se quiser ajustar qualquer coisa antes — plano, forma de pagamento, ou cancelar — este é o momento: {{linkAssinatura}}

Bom trabalho no ateliê hoje! 💛

{{assinatura}}

---

## BLOCO B — Fim do trial · PIX (conversão manual)

### B1. TRIAL_D3 (Pix)
**Assunto:** Faltam 3 dias do seu teste — seu Pix já está pronto 💛

Oi, {{nome}}!

Seu período de teste do SOA termina em 3 dias. Para continuar sem interrupção, é só pagar seu primeiro Pix de **R$ {{valor}}** — leva menos de um minuto:

👉 {{linkAssinatura}}

Tudo o que você organizou no {{workspaceNome}} continua aqui, do jeitinho que você deixou.

{{assinatura}}

### B2. TRIAL_D1 (Pix)
**Assunto:** Seu teste termina amanhã, {{nome}} — garanta sua vaga com um Pix

Oi, {{nome}}!

Amanhã termina seu período grátis. Seu Pix de **R$ {{valor}}** está pronto, esperando só o seu toque:

👉 {{linkAssinatura}}

Qualquer dúvida antes de decidir, responde este e-mail — a gente responde de verdade. 😊

{{assinatura}}

### B3. TRIAL_FIM (Pix)
**Assunto:** Seu teste terminou — mas calma, você ainda tem {{diasDeCarencia}} dias 💛

Oi, {{nome}}!

Seu período de teste terminou hoje. Mas respira: **seu acesso continua liberado por mais {{diasDeCarencia}} dias** para você pagar com calma.

Nada foi apagado e nada vai ser. Seu Pix está aqui:

👉 {{linkAssinatura}}

{{assinatura}}

### B4. TRIAL_POS_D3 (Pix)
**Assunto:** {{nome}}, seu ateliê está sentindo sua falta

Oi, {{nome}}!

Seu acesso ao SOA segue liberado por mais {{diasAteCorte}} dias, esperando seu primeiro pagamento.

Se ficou alguma dúvida — se o SOA serve para o seu jeito de produzir, qual plano compensa — responde este e-mail que a gente te ajuda a decidir. Sem compromisso.

👉 {{linkAssinatura}}

{{assinatura}}

### B5. TRIAL_POS_D6 (Pix)
**Assunto:** Amanhã seu acesso será pausado, {{nome}}

Oi, {{nome}}.

Amanhã o seu acesso ao SOA será **pausado** — pausado, não cancelado: seus pedidos, clientes e produção ficam guardados em segurança, esperando você.

Para continuar sem interrupção, seu Pix está a um toque:

👉 {{linkAssinatura}}

E se o SOA não fez sentido neste momento, tudo bem também — a porta fica aberta. 💛

{{assinatura}}

---

## BLOCO C — Inadimplência (os dois métodos)

### C1. INAD_D0
**Assunto:** O pagamento da sua assinatura não entrou — deve ser coisa boba

Oi, {{nome}}!

O pagamento da sua assinatura (R$ {{valor}}, vencimento {{vencimento}}) não foi aprovado. Isso acontece — geralmente é limite do cartão, cartão vencido ou o banco travando por segurança.

**Seu acesso continua normal.** Para regularizar:

👉 {{linkAssinatura}}

Se precisar de ajuda, responde este e-mail.

{{assinatura}}

### C2. INAD_D3
**Assunto:** {{nome}}, faltam {{diasAteCorte}} dias para regularizar sua assinatura

Oi, {{nome}}!

O pagamento de R$ {{valor}} ainda não entrou. Seu acesso segue liberado por mais {{diasAteCorte}} dias — regularizar leva 1 minuto:

👉 {{linkAssinatura}}

Se algo estiver dificultando — cartão, valor, qualquer coisa — fala com a gente. Sempre dá para resolver junto.

{{assinatura}}

### C3. INAD_D6
**Assunto:** Amanhã seu acesso será pausado — resolve em 1 minuto?

Oi, {{nome}}.

Amanhã seu acesso será pausado por falta do pagamento de R$ {{valor}}. Nada será apagado — seu ateliê fica guardado esperando você.

👉 {{linkAssinatura}}

Se você já pagou e recebeu este e-mail, nos avise respondendo aqui — conferimos na hora.

{{assinatura}}

---

## BLOCO D — Renovação e parcelas

### D1. RENOV_ANUAL_D7
**Assunto:** Sua assinatura anual do SOA renova em 7 dias

Oi, {{nome}}!

Avisando com antecedência, como você merece: sua assinatura anual renova no dia **{{proximoVencimento}}**.

{{#ehParcelado}}Como no ano passado: 12x de R$ {{valorParcela}} no seu cartão.{{/ehParcelado}}
{{^ehParcelado}}Valor: R$ {{valor}}, como no ano passado.{{/ehParcelado}}

Não precisa fazer nada — a renovação é automática. Quer trocar de plano ou conversar antes? Responde este e-mail.

Obrigado por mais um ano organizando seu ateliê com a gente. 💛

{{assinatura}}

### D2. PARCELA_FALHOU
**Assunto:** Uma parcela da sua assinatura não passou no cartão

Oi, {{nome}}!

A parcela {{numeroParcela}} de {{totalParcelas}} da sua assinatura anual (R$ {{valorParcela}}) não foi aprovada. **Sua assinatura continua ativa** — é só essa parcela que precisa de atenção.

Geralmente é o limite do mês ou o banco travando por segurança:

👉 {{linkAssinatura}}

{{assinatura}}

---

## BLOCO E — Checkout abandonado (leads)

### E1. CHECKOUT_ABANDONADO_1H
**Assunto:** {{nome}}, seu SOA está quase pronto — falta só um passo

Oi, {{nome}}!

Sua conta no SOA já está criada e o {{workspaceNome}} te esperando. Falta só escolher como pagar depois dos seus **14 dias grátis** — e aí o teste começa na hora:

👉 {{linkAssinatura}}

Leva menos de 2 minutos. Hoje você não paga nada.

{{assinatura}}

### E2. CHECKOUT_ABANDONADO_23H
**Assunto:** Seus 14 dias grátis continuam te esperando

Oi, {{nome}}!

Passando para lembrar: seus 14 dias grátis do SOA ainda não começaram a contar — eles só começam quando você concluir o cadastro do pagamento. Ou seja: você não perdeu nada. 😊

👉 {{linkAssinatura}}

Qualquer dúvida sobre planos ou sobre o SOA, é só responder.

{{assinatura}}

### E3. CHECKOUT_ABANDONADO_D2
**Assunto:** Seu ateliê organizado está a 2 minutos de distância

Oi, {{nome}}!

Você criou sua conta no SOA há dois dias — e a organização que você foi buscar continua aqui, pronta: pedidos, produção, clientes, tudo num lugar só, feito para {{segmento}}.

Seus 14 dias grátis começam quando você quiser:

👉 {{linkAssinatura}}

Se travou em alguma coisa ou ficou com dúvida, responde este e-mail — a gente te ajuda pessoalmente.

{{assinatura}}

### E4. CHECKOUT_ABANDONADO_D6
**Assunto:** A porta fica aberta, {{nome}} 💛

Oi, {{nome}}.

Este é nosso último lembrete — prometemos não encher sua caixa de entrada.

Sua conta no SOA continua criada, e seus 14 dias grátis continuam disponíveis quando você quiser começar:

👉 {{linkAssinatura}}

Se o momento não é agora, tudo bem. Quando o ateliê apertar e você precisar de organização, estaremos aqui.

{{assinatura}}

---

## BLOCO F — Corte

### F1. CORTE
**Assunto:** Seu acesso foi pausado — e voltar é simples 💛

Oi, {{nome}}.

Seu acesso ao SOA foi pausado hoje. Queríamos muito que não tivesse chegado a esse ponto — mas você precisa saber de duas coisas:

**Nada foi apagado.** Pedidos, clientes, produção e histórico do {{workspaceNome}} estão guardados em segurança.

**Voltar leva 1 minuto.** Assim que o pagamento entrar, seu acesso reabre sozinho, com tudo no lugar:

👉 {{linkAssinatura}}

E se você decidiu parar por agora, tudo bem — a porta fica aberta.

{{assinatura}}

---

### Para aprovar, Júnior:
1. **`{{assinatura}}`** — "Equipe SOA" ou nome de gente? (recomendo nome)
2. Leia os assuntos em sequência — são eles que decidem a abertura.
3. Qualquer frase que não soe como você falaria com uma aluna, me devolve que eu ajusto.
