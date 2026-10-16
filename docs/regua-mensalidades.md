# Régua das mensalidades + Pix Automático (16/10/2026)

Pedido do Júnior: e-mails programados para **todas as soluções mensais** (SOA, Método Mãe, Pessoal, Marketplaces).
São lembretes de 5 dias antes até o dia do vencimento e cobrança o mês todo se não pagar. O acesso é bloqueado depois
de 3 dias de atraso. O Pix Automático vale para o mensal do MAE e do SOA.

## Calendário (`lib/cobranca/reguaMensal.ts`, cron diário às 9h de Brasília: `/api/cron/regua-mensal`)

| Quando | E-mail |
| --- | --- |
| 5, 3 e 1 dia antes, e no dia | Lembrete com o link de pagar. No **cartão**, que cobra sozinho, só 5 dias antes e no dia, com o texto "automático, nada a fazer". |
| D+1 | "O pagamento não entrou." O acesso continua. |
| D+3 | "Último dia." Amanhã o acesso é pausado. |
| D+4 | **Acesso pausado.** O e-mail avisa que nada foi apagado. |
| D+7, D+10 … D+28 | Cobrança a cada 3 dias. |
| Depois do mês | Cobrança semanal (D+35, D+42…), até pagar ou cancelar. |

- A verdade é o **Asaas**: a régua lista as cobranças PENDENTES (que vencem em até 5 dias) e VENCIDAS das assinaturas. Cada uma é ligada ao produto e à conta pelo nosso banco.
- Sai **um e-mail por pessoa por dia**, juntando os produtos. O assunto é o do item mais grave.
- O botão "Pagar agora" é `www.usesoa.com.br/api/cobranca/fatura?p=…&t=…`. O link é assinado e abre a fatura do Asaas. Se a cobrança já foi paga, leva à página da assinatura.
- É idempotente: cada item grava `AssinaturaAviso` (`MENSAL:<cobrança>:<etapa>`, dia).
- **Ficam de fora:**
  - a Hotmart, que tem régua própria;
  - os planos anuais;
  - o teste grátis, que tem os avisos do trial;
  - quem tem liberação manual;
  - as cortesias;
  - quem está **em dia**: uma cobrança antiga vencida de quem já pagou as seguintes não gera cobrança.
- **Bloqueio em 3 dias:** `DIAS_CARENCIA` (SOA), `CARENCIA_DIAS_MAE` e `CARENCIA_DIAS` (Pessoal) agora valem 3 (antes 7, 5 e 5). No Marketplaces, que não tinha carência, a régua pausa o módulo no D+4, e o pagamento religa.
- A régua antiga do SOA (`regua.ts`) não manda mais os e-mails de atraso da **mensalidade**, para não chegarem em dobro. Ela segue para o anual. O MAE deixou de mandar o "não conseguimos cobrar" no webhook.
- **Desligar:** `REGUA_MENSAL=off` na Vercel. Com isso, a régua antiga do SOA volta a mandar os avisos de atraso.
- **Prévia sem enviar nada:** `GET /api/cron/regua-mensal?seco=1` com o `CRON_SECRET`.

**Prévia em produção (16/10, só leitura):**
- 172 das 204 cobranças vivas foram reconhecidas.
- 48 e-mails sairiam no dia: 9 lembretes, 3 de D+1, 3 de último dia, 4 de pausa e 30 de cobrança.
- Com a tolerância de 3 dias, **13 contas do SOA** (4 a 7 dias de atraso) e **2 do Pessoal** perdem o acesso assim que o deploy entra.

## Pix Automático pelo link de pagamento (`lib/pagamento/asaas/linkPixAuto.ts`)

- A API de autorizações (`/pix/automatic/authorizations`) dá **403** na nossa conta.
- Em produção, o Asaas aceita um **link de pagamento** com PIX + RECURRENT + MONTHLY.
- Conferido em produção (link de teste criado e apagado): o link guarda o `externalReference`.
- **MAE mensal:** em Minha assinatura, a cliente escolhe "Cartão" ou "Pix Automático". O site de vendas tem "Mensal sem cartão: no Pix Automático" (`/mae/pagar?…&metodo=pix`).
  - O link leva `MAEA:<ws>`, e o id do link vai para `MaeAssinatura.checkoutId`.
  - O webhook reconhece o pagamento por esses dois caminhos.
- **SOA mensal:** a opção "Pix Automático", que já existia na tela e dava erro, agora abre o link.
  - O vínculo fica em `AsaasPixAutoAutorizacao` (`plink:<id>`).
  - O 1º Pix pago ativa a conta.
  - Se ela tinha uma assinatura no cartão (recusado), essa assinatura é **encerrada** no Asaas, para não haver cobrança dupla. Isso não cancela a conta.
- **Desligar:** `PIX_AUTO=off`.
- **A confirmar:** o 1º pagamento real. É preciso conferir que o webhook liga a conta, o que pode ser visto em `[ASAAS-WH] pix-auto (link) ativado` / `[MAE ASSINATURA] pago`.

## Convite para o Pix Automático (16/10/2026, pedido do Júnior)

**Quem recebe:** quem paga o SOA mensal no **Pix avulso** (62 assinantes, 57 a R$ 29,90). Na véspera do vencimento (D-1), o lembrete vira um convite para cadastrar o Pix Automático. O botão leva a `/assinatura/pix-automatico`, que pede login se for preciso.

**Valor:**
- O valor continua **o mesmo** da assinatura atual (grandfather).
- A mensalidade em aberto é paga pelo 1º Pix Automático.
- O Pix avulso pendente e a assinatura antiga são apagados no Asaas, sem cobrança dupla, e isso não cancela a conta.

**Quando a troca é recusada:**
- **Na rota:** para quem paga no cartão, para quem já pagou o mês e no teste grátis.
- **No convite:** o Pessoal (Pix/indefinido, 16 assinaturas) ainda não tem Pix Automático e fica de fora.

**Prévia em produção:** 3 convites em 16/10 e 3 em 17/10.
