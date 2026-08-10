# PROPOSTA — Assinatura Asaas para novos cadastros

**Status:** proposta para revisão do Diretor. **Nada implementado.**
**Data:** 22/07/2026 · Branch `feat/pagamento-asaas` · Fundação do motor já provada em sandbox.

Decisões de produto já fechadas (não reabertas aqui): Asaas só para novos cadastros ·
mesmo preço da Hotmart · só cartão de crédito · trial de 14 dias com acesso imediato ·
corte 7 dias após vencimento · comissão de afiliado recorrente via split `fixedValue`.

---

## 1. ACHADOS DA INVESTIGAÇÃO

### 1.1 🔴 O corte de acesso hoje só vale no login

Esta é a descoberta que mais afeta o desenho. `Workspace.ativo` é o **único** portão, e
ele é consultado **num lugar só**: o `authorize()` de `lib/auth.ts:19-27`, que roda
apenas no **login**.

```sql
WHERE u."email" = ${email} AND u."ativo" = true AND w."ativo" = true
```

Não há checagem em `middleware.ts` (que só protege `/master`), nem nos layouts, nem nas
rotas de API. A sessão é **JWT sem `maxAge`** (`lib/auth.ts:111`), ou seja, o padrão do
NextAuth: **30 dias**.

**Consequência:** marcar `ativo = false` não desconecta ninguém. Uma assinante já logada
continua usando o sistema por até 30 dias depois do corte. Hoje isso passa despercebido
porque o corte da Hotmart é raro e a maioria refaz login com frequência — mas um corte
por inadimplência, que é justamente o que vamos automatizar, seria **inócuo na prática**.

Sem resolver isto, todo o resto da inadimplência é decorativo. Ver decisão **(1)**.

### 1.2 Colunas que já existem e ninguém usa

| Coluna | Estado real |
|---|---|
| `Workspace.assinaturaStatus` | gravada `'TRIAL'` no cadastro · **nunca lida** |
| `Workspace.assinaturaExpira` | existe · **nunca escrita nem lida** |
| `Workspace.trialAte` | escrita por `lib/parceiros` (trial de 30d) · **nunca lida** · 0 linhas preenchidas em produção |
| `Workspace.hotmart{Email,SubId,ProdutoId}` | vínculo com a Hotmart |

Ou seja: **o vocabulário de assinatura já está no banco, mas não está ligado a nada.**
A proposta reaproveita `assinaturaStatus` e `assinaturaExpira` em vez de criar colunas
novas, e trata `trialAte` como legado do módulo de parceiros (mantido, não reutilizado —
semântica diferente: lá é brinde de parceiro, aqui é trial de assinatura).

### 1.3 Fluxo atual de cadastro

`app/api/auth/register/route.ts` cria `Workspace` (`plano: 'TRIAL'`, `ativo: true`,
`assinaturaStatus: 'TRIAL'`) + `User` ADMIN + tema, e opcionalmente atribui a parceiro.
**Não fala com nenhum meio de pagamento.** Quem vem da Hotmart entra por outro caminho:
o webhook (`app/api/hotmart/webhook/route.ts:156-216`) cria a conta e liga/desliga
`ativo` conforme o evento, respeitando `liberacaoManual` (trava anti-corte, 26 workspaces).

**Isso é bom para nós:** o caminho Asaas pode nascer no `register` sem tocar em uma
linha do webhook Hotmart.

### 1.4 Números de produção (22/07/2026)

282 workspaces · 186 ativos · 95 inativos · 26 com `liberacaoManual`.

### 1.5 Preço vigente

**R$ 29,90/mês.** A landing usa R$ 49,90 riscado como âncora; a coorte 49,90→29,90 é a
migração em curso no painel Hotmart. ⚠️ **Júnior confirma** antes de virar constante.

---

## 2. COLETA DO CARTÃO — comparação de superfície PCI

| Opção | Cartão passa por nós? | Recorrência | Observação |
|---|---|---|---|
| **A.** `POST /v3/subscriptions` com objeto `creditCard` completo | ❌ **SIM** | sim | Número e CVV atravessam nosso servidor. **Descartada.** |
| **B.** Tokenização (`/v3/creditCard/tokenizeCreditCard`) | ❌ **SIM** | sim | O endpoint é server-to-server e exige a API key — não dá para chamar do browser sem expor a chave. Só troca *onde* o dado passa, não *se* passa. **Descartada.** |
| **C.** Asaas Checkout (`POST /v3/checkouts`, `chargeTypes: RECURRENT`) | ✅ **NÃO** | sim | Página hospedada pelo Asaas. Suporta `splits` e `callback` (`successUrl`/`expiredUrl`). ⚠️ Expira em no máx. **1440 min (24h)** (`minutesToExpire`). |
| **D.** Assinatura sem cartão + `invoiceUrl` da 1ª cobrança | ✅ **NÃO** | sim | Cria a assinatura com `nextDueDate` futuro; o Asaas gera a fatura com página própria. A artesã paga lá no dia 14 e o Asaas guarda o cartão para as renovações. Sem prazo de expiração. |

### Recomendação: **D como padrão, C como alternativa**

A doc do Asaas confirma que, numa assinatura, **"o cartão não é cobrado no momento da
criação (exceto quando o primeiro vencimento é a data atual)"** — ele é apenas validado.
Isso encaixa exatamente no trial: criamos a assinatura no cadastro com
`nextDueDate = hoje + 14`, ninguém é cobrado, e a artesã entra no sistema na hora.

**Por que D e não C:**
- **Zero atrito no cadastro.** O público é leigo em tecnologia; pedir cartão antes de a
  pessoa ver o produto derruba conversão no momento mais frágil.
- **O checkout expira em 24h.** Se a artesã abandonar e voltar depois, o link morreu —
  precisaríamos de uma rota que recria o checkout, e de uma tela explicando por que o
  link não funciona mais. Complexidade que não paga.
- **D não perde a recorrência:** quando ela paga a primeira fatura no cartão, o Asaas
  passa a cobrar automaticamente nos ciclos seguintes.

**O custo de D:** o cartão não é validado no cadastro, então só descobrimos que ela não
vai pagar no dia 14. Em troca, ganhamos 14 dias de uso do produto para convencê-la — que
é o propósito do trial. Ver decisão **(2)**.

⚠️ **A verificar em sandbox antes de implementar:** se `subscription.nextDueDate` do
Checkout (opção C) aceita data futura. A doc não diz. **(?)** — só importa se você
preferir C.

🔒 **Em nenhuma das opções recomendadas** número, CVV ou validade tocam nosso banco ou
log. Se o Asaas devolver bandeira e últimos 4 dígitos, guardamos só isso, para a artesã
reconhecer o cartão na tela.

---

## 3. FLUXO DESENHADO

```
CADASTRO (/register)
  │  cria Workspace (ativo=true, assinaturaStatus=TRIAL, assinaturaExpira=hoje+14)
  │  cria cliente no Asaas (garantirCliente) — CPF exigido pelo Asaas, não persistido
  │  cria assinatura MONTHLY, nextDueDate = hoje+14, billingType=CREDIT_CARD
  │  split de comissão do parceiro, se houver (montarSplitComissao)
  ▼
TRIAL (14 dias)  ── acesso liberado desde o primeiro minuto
  │  D-3 e D-1: e-mail Resend "sua assinatura começa em X dias"
  ▼
DIA 14 — Asaas gera a 1ª cobrança
  │  e-mail com o invoiceUrl (a artesã cadastra o cartão na página do Asaas)
  ├──► PAYMENT_RECEIVED/CONFIRMED (webhook — JÁ FUNCIONA)
  │       assinaturaStatus=ATIVA · assinaturaExpira=próximo vencimento · ativo=true
  │       accrual de comissão do parceiro (lib/parceiros, já pronto)
  │       ▼
  │    RENOVAÇÃO MENSAL automática (cartão salvo) → volta ao mesmo ponto
  │
  └──► PAYMENT_OVERDUE (webhook)
          assinaturaStatus=INADIMPLENTE · marca vencimento
          D+0, D+3, D+6: avisos por e-mail (Resend)
          ▼
       DIA 7 sem pagar  ── quem corta é o job diário, não o webhook
          assinaturaStatus=CORTADA · ativo=false
          ⚠️ liberacaoManual=true IGNORA o corte (trava do Master, já existe)
          ▼
       PAGOU DEPOIS → PAYMENT_RECEIVED reativa: ATIVA + ativo=true
```

---

## 4. MÁQUINA DE ESTADOS

`Workspace.assinaturaStatus` (coluna que já existe):

| Estado | Significado | Acesso | Quem escreve |
|---|---|---|---|
| `TRIAL` | 14 dias, nunca pagou | ✅ | `/register` |
| `ATIVA` | em dia | ✅ | webhook `PAYMENT_RECEIVED`/`CONFIRMED` |
| `INADIMPLENTE` | venceu, dentro dos 7 dias | ✅ (com avisos) | webhook `PAYMENT_OVERDUE` |
| `CORTADA` | 7 dias sem pagar | ❌ | job diário |
| `CANCELADA` | cancelamento explícito | ❌ | tela/Master |

**Transições — onde cada uma acontece:**

| De → Para | Gatilho | Onde |
|---|---|---|
| `TRIAL` → `ATIVA` | 1ª cobrança paga | webhook (pronto) |
| `TRIAL` → `INADIMPLENTE` | 1ª cobrança venceu | webhook (pronto) |
| `ATIVA` → `INADIMPLENTE` | renovação venceu | webhook (pronto) |
| `INADIMPLENTE` → `ATIVA` | pagou | webhook (pronto) |
| `INADIMPLENTE` → `CORTADA` | 7 dias vencido | **job diário** (novo) |
| `CORTADA` → `ATIVA` | pagou depois | webhook (pronto) |
| qualquer → `CANCELADA` | pedido de cancelamento | tela / Master |

**Por que o corte é job e não webhook:** o Asaas manda `PAYMENT_OVERDUE` **no dia do
vencimento**, não sete dias depois. Não existe evento "7 dias em atraso". Alguém tem que
olhar o relógio — e esse alguém é um job diário. É também ele que dispara os avisos
escalonados.

**Regra de ouro das transições:** `liberacaoManual = true` **bloqueia qualquer corte**,
exatamente como já faz no webhook da Hotmart (`app/api/hotmart/webhook/route.ts:200-208`).

---

## 5. MUDANÇAS — o mínimo possível

### 5.1 Tabelas

**Nenhuma tabela nova.** Reaproveitando o que existe:

| Coluna | Mudança |
|---|---|
| `Workspace.assinaturaStatus` | passa a ser **lida** (hoje só escrita) |
| `Workspace.assinaturaExpira` | passa a ser escrita/lida (hoje inerte) |
| `Workspace.assinaturaOrigem` | **NOVA** — `'hotmart'` \| `'asaas'` \| `null`. Sem ela não dá para saber quem manda no acesso de cada workspace |
| `AsaasAssinatura` | já existe (fundação); ganha `workspaceId` como vínculo real |
| `AsaasCobranca` | já existe |

Backfill: `assinaturaOrigem = 'hotmart'` onde `hotmartSubId IS NOT NULL`; o resto fica
`null` (não mexe em ninguém).

### 5.2 Rotas

| Rota | Mudança |
|---|---|
| `app/api/auth/register/route.ts` | **alterada** — cria assinatura Asaas ao final, **gated por flag e em try/catch**: se o Asaas falhar, a conta é criada mesmo assim (mesmo padrão da atribuição de parceiro, linha 76) |
| `app/api/webhooks/asaas/route.ts` | **alterada** — `aplicarEvento` passa a mexer em `Workspace` além de `AsaasCobranca` |
| `app/api/assinatura/route.ts` | **nova** — status da assinatura da artesã (dias restantes, próximo vencimento, `invoiceUrl` pendente) |
| `app/api/cron/assinaturas/route.ts` | **nova** — job diário: avisos + corte no dia 7 |
| `app/api/master/assinaturas-asaas/route.ts` | **nova** — visão do Master (espelha o painel Hotmart) |

**Intocados:** `app/api/hotmart/webhook/route.ts`, `lib/auth.ts` (salvo a decisão 1),
`middleware.ts`, e todo o resto do sistema.

### 5.3 Telas

| Tela | Mudança |
|---|---|
| `app/register/page.tsx` | texto do trial ("14 dias grátis, sem cartão agora") |
| `app/assinatura/page.tsx` | **nova** — status, dias restantes, botão pagar (`invoiceUrl`), histórico |
| Faixa de aviso no layout | **nova** — visível em `INADIMPLENTE` e nos últimos dias de `TRIAL` |
| `app/master/*` | aba de assinaturas Asaas |

### 5.4 Job diário

Vercel Cron (`vercel.json`), 1×/dia. Protegido por `CRON_SECRET`. Idempotente por
(workspace, tipo de aviso, dia) para não mandar o mesmo e-mail duas vezes se rodar de novo.

---

## 6. RISCOS E DECISÕES

**(1) 🔴 O corte precisa valer para quem já está logado.** Hoje não vale — JWT de 30
dias, `ativo` só checado no login (§1.1). Três saídas:
   - **(a)** checagem no `middleware.ts` consultando o banco → correto, mas põe uma
     query em toda navegação;
   - **(b)** `maxAge` curto na sessão (ex.: 24h) → força relogin diário, revalidando
     naturalmente. Simples, mas incomoda todo mundo;
   - **(c)** checagem no callback `jwt` a cada N minutos (padrão do `lastPing`, que já
     existe em `lib/auth.ts:84-90`) → custo baixo, corte com atraso de minutos.
   **Recomendo (c)**, reaproveitando um mecanismo que já está lá.
   ⚠️ Isto afeta **também os cortes da Hotmart**, que hoje têm o mesmo furo. Corrigir
   melhora as duas frentes — mas é mudança em caminho de produção, e por isso é decisão
   sua, não minha.

**(2) Cartão no cadastro ou no dia 14?** §2 recomenda dia 14 (opção D). Se preferir
validar o cartão logo no cadastro (opção C, Asaas Checkout), diga — muda o fluxo e traz
o problema das 24h de expiração.

**(3) CPF no cadastro.** O Asaas **exige `cpfCnpj`** para criar cliente. Hoje o
`/register` não pede CPF. Opções: pedir no cadastro (mais atrito, e é dado sensível) ou
adiar a criação do cliente Asaas para a tela de pagamento. Recomendo **adiar**: cria-se
o workspace e o trial na hora, e o cliente/assinatura no Asaas quando ela for pagar.
⚠️ Isso muda o §3 (a assinatura não nasce no cadastro) — precisa do seu aval.

**(4) Trial de parceiro × trial de assinatura.** `lib/parceiros` dá 30 dias via
`trialAte`; a proposta usa 14 via `assinaturaExpira`. Quem entra por cupom de parceiro
fica com quantos dias? Recomendo **o maior dos dois**, mas é decisão comercial.

**(5) Quem cancela?** A artesã pode cancelar sozinha na tela, ou só via suporte? Se
sozinha, precisa de `DELETE /v3/subscriptions/{id}` e uma tela de confirmação.

**(6) O que ela vê quando é cortada?** Tela de "assinatura suspensa" com botão de
pagamento, ou bloqueio seco no login? A primeira converte mais; a segunda é o
comportamento atual da Hotmart.

**(7) Falha de cartão na renovação** (expirado, cancelado, sem limite) não é
inadimplência por descuido. Vale um texto de e-mail diferente e um caminho para trocar
o cartão? O Asaas tem página própria para isso **(?)** — a verificar.

**(8) Reembolso/chargeback.** `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED` já são
recebidos pelo webhook, mas hoje só atualizam a cobrança. Devem cortar acesso na hora?
E a comissão do parceiro, já paga por split — como se estorna?

---

## 7. O QUE JÁ ESTÁ PRONTO (não precisa ser feito de novo)

- Adapter, cliente HTTP, cripto, config Master, tela de conexão.
- Webhook idempotente, autenticado, com mascaramento LGPD e expurgo de 90 dias.
- `criarAssinatura()` com split-template, `garantirCliente()`, `criarCobranca()`.
- Guarda de estouro do split.
- Accrual de comissão de parceiro (`lib/parceiros`), inclusive a regra recorrente.
- Provado em sandbox com evento real: `PAYMENT_RECEIVED` → `AsaasCobranca RECEIVED` em 1s.

**O que falta é a ponte entre a cobrança e o acesso** — e a decisão (1) é o alicerce dela.
