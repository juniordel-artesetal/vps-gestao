# PLANO DE IMPLEMENTAÇÃO — Assinatura Asaas (novos cadastros)

**Status:** plano para aprovação. **Nada codado.**
**Base:** `PROPOSTA_ASSINATURA_ASAAS.md` + decisões do Diretor de 22/07/2026.
**Branch:** `feat/pagamento-asaas` (2 commits, `acef8b1` no origin).

Decisões incorporadas: preço **R$ 29,90/mês** · revalidação no JWT a cada **15 min**,
atrás de flag própria OFF · cartão **só no dia 14**, nunca no nosso servidor · cliente e
assinatura Asaas nascem **na tela de pagamento**, não no cadastro · trial gerido por nós
via `trialAte`, **o maior vence** · assinante pode cancelar (mantém acesso até o fim do
período pago) · cortada vê **tela de regularização**, dados intactos · falha de cartão
segue a mesma régua · reembolso/chargeback só acompanham via webhook.

---

## 0. DUAS CONSEQUÊNCIAS DA DECISÃO (3) — decidir antes da Etapa 1

### 0.1 🟠 Trial que expira sem nunca ter assinado

Se a assinatura só nasce na tela de pagamento, quem **nunca abriu essa tela** chega ao
dia 14 **sem cobrança nenhuma no Asaas**. Não há `PAYMENT_OVERDUE`, e a régua dos 7 dias
— ancorada no vencimento — fica sem âncora. É um caminho paralelo ao da inadimplência.

**Proposta:** tratar o fim do trial como um vencimento nosso e reusar a mesma régua —
avisos em D-3/D-1 (antes) e D+3/D+6 (depois), corte no **dia 21**. Na prática o trial
vira "14 dias + 7 de carência", coerente com o tratamento de quem assinou e atrasou.
**Alternativa:** corte seco no dia 14, mandando direto para a tela de regularização.
👉 **Decisão (A)**.

### 0.2 🟠 Onde o bloqueio é aplicado

A revalidação no JWT marca o estado, mas alguém precisa **agir** sobre ele:

- **(a) Só no layout autenticado** (server component): uma checagem, redireciona para a
  tela de regularização. Simples, cobre a experiência inteira. Uma API chamada
  diretamente por alguém determinado continuaria respondendo.
- **(b) Layout + guarda nas rotas de API**: fecha o buraco, mas espalha checagem por
  ~130 rotas ou exige um wrapper novo.

**Proposta: (a)**. O produto é a interface; o risco de alguém cortado ficar chamando API
crua é baixo, e (b) custa caro em superfície de mudança. 👉 **Decisão (B)**.

### 0.3 Bloqueio é redirect, não logout

O JWT marca `acessoBloqueado`; o layout **redireciona** para a tela de regularização em
vez de deslogar. Ela continua autenticada, vê o próprio nome, os dados estão lá, e o
botão de pagar está na frente. Deslogar seria hostil e derrubaria a conversão de volta —
e a decisão do Diretor pede tom acolhedor.

---

## ETAPA 1 — Máquina de estados + revalidação no JWT (flag OFF)

**Objetivo:** ter uma fonte única de verdade sobre "esta workspace tem acesso?", e fazer
o corte valer para quem já está logado. Sem nada disso, o resto é decorativo.

**Muda:**
- `scripts/migrar-assinatura-estados.mjs` **(novo)** — `Workspace.assinaturaOrigem`
  (`'hotmart'`|`'asaas'`|`null`) + `Workspace.revalidacaoAtiva` (flag, default `false`).
  Backfill: `'hotmart'` onde `hotmartSubId IS NOT NULL`. Aditivo e idempotente.
- `lib/assinatura/index.ts` **(novo)** — fonte única:
  `estadoDaAssinatura(workspaceId)` → `{ status, temAcesso, diasRestantes, motivo }`.
  Lê `assinaturaStatus`, `trialAte`, `assinaturaExpira`, `ativo`, `liberacaoManual`.
  **`liberacaoManual = true` ⇒ `temAcesso: true`, sempre.**
- `lib/auth.ts` — no callback `jwt`, a cada **15 min** (mesmo padrão do `lastPing`,
  linhas 84-90), consulta o estado e grava `token.acessoBloqueado`. **Só roda com a flag
  ligada**; desligada, o comportamento é byte-a-byte o de hoje.
- `types/next-auth.d.ts` — expõe `acessoBloqueado` na sessão.

**Não muda:** webhook Hotmart, middleware, `authorize()`.

**Como provo:** no preview, com banco dev, criando workspaces de teste nos dois caminhos
(um `assinaturaOrigem='hotmart'` com `ativo=false`, outro `'asaas'` com `assinaturaStatus
='CORTADA'`) e verificando que (i) com a flag OFF nada muda, (ii) com a flag ON o token
passa a carregar `acessoBloqueado` em ≤15 min, (iii) `liberacaoManual` sobrepõe os dois.

> ⚠️ Esta etapa toca o login dos 186 workspaces. Fica **atrás de flag OFF**, e ligar em
> produção é decisão explícita do Júnior no go-live.

---

## ETAPA 2 — Tela de regularização + faixa de aviso

**Objetivo:** dar destino a quem está bloqueado, antes de existir qualquer bloqueio real.
Vem **antes** do que bloqueia, para nunca haver janela em que alguém é cortado e cai numa
tela que não existe.

**Muda:**
- `app/assinatura/page.tsx` **(nova)** — estado da assinatura, dias restantes, e o botão
  de pagar. É também a tela de regularização de quem foi cortada. Tom SOA: acolhedor,
  deixa claro que **nada foi apagado**.
- `app/api/assinatura/route.ts` **(nova)** — `GET` devolve o estado (via `lib/assinatura`)
  e o `invoiceUrl` pendente, se houver. `workspaceId` sempre da sessão.
- Layout autenticado — faixa de aviso em `TRIAL` (últimos 3 dias) e `INADIMPLENTE`.
- Layout autenticado — redirect para `/assinatura` quando `acessoBloqueado` (Decisão B).

**Como provo:** preview, forçando cada estado no banco dev e conferindo o que aparece.

---

## ETAPA 3 — Assinar: cliente + assinatura Asaas nascem aqui

**Objetivo:** a artesã sai do trial e vira pagante, sem que cartão algum toque em nós.

**Muda:**
- `app/api/assinatura/assinar/route.ts` **(nova)** — recebe CPF, chama `garantirCliente()`
  e `criarAssinatura()` (`MONTHLY`, R$ 29,90, `CREDIT_CARD`, `nextDueDate` = fim do
  trial ou hoje+1 se já passou), aplica `montarSplitComissao()` se houver parceiro,
  vincula `AsaasAssinatura.workspaceId`, grava `assinaturaOrigem='asaas'`, devolve o
  `invoiceUrl`. Tudo gated por flag.
- `app/assinatura/page.tsx` — passo de CPF + redirect para o `invoiceUrl` do Asaas.

**Regras:** CPF **nunca** persistido (vai ao Asaas e morre ali) e nunca logado. Cartão
não passa por aqui em hipótese alguma — quem coleta é a página do Asaas.

**Como provo:** sandbox, ponta a ponta: assinar → `invoiceUrl` → pagar no painel →
webhook → estado vira `ATIVA`.

---

## ETAPA 4 — Webhook liga cobrança ↔ acesso

**Objetivo:** o pagamento passa a mexer no acesso. Hoje o webhook só atualiza a cobrança.

**Muda:**
- `lib/pagamento/asaas/webhook.ts` → `aplicarEvento()` passa a atualizar `Workspace`
  quando a cobrança tem `subscriptionId` vinculado a uma workspace:
  - `RECEIVED`/`CONFIRMED` → `assinaturaStatus='ATIVA'`, `assinaturaExpira`=próximo
    vencimento, `ativo=true`;
  - `OVERDUE` → `'INADIMPLENTE'` (**não corta aqui** — quem corta é o job);
  - `REFUNDED`/`CHARGEBACK_REQUESTED` → registra e acompanha o status.
  - **Nunca** mexe em workspace com `assinaturaOrigem='hotmart'`.

**Como provo:** o `disparar-webhook-simulado.mjs` já existe — estendo com os quatro
eventos e confiro o `Workspace` resultante.

---

## ETAPA 5 — Job diário: avisos e corte

**Objetivo:** o relógio. O Asaas avisa no vencimento, não sete dias depois.

**Muda:**
- `app/api/cron/assinaturas/route.ts` **(nova)** — protegida por `CRON_SECRET`.
  Avisos escalonados por Resend (D-3, D-1, D+0, D+3, D+6) e corte no dia 7
  (ou 21 do trial, conforme Decisão A). Idempotente por (workspace, tipo, dia).
  **`liberacaoManual` bloqueia o corte.** Nunca toca workspace Hotmart.
- `vercel.json` — entrada de cron, 1×/dia.
- `lib/assinatura/emails.ts` **(novo)** — textos, tom SOA.

**Como provo:** rodo o job manualmente no preview com datas forjadas no banco dev e
confiro transições + idempotência (rodar 2× não manda e-mail repetido).

---

## ETAPA 6 — Cadastro com trial de 14 dias

**Objetivo:** ligar o cadastro novo à máquina de estados. Deixado para o fim de
propósito: é o único ponto que afeta **todo mundo que se cadastra**, e só entra quando
tudo que vem depois já está provado.

**Muda:**
- `app/api/auth/register/route.ts` — grava `trialAte = hoje + 14` **pelo maior valor**
  (`GREATEST`), preservando os 30 dias do parceiro; `assinaturaStatus='TRIAL'`,
  `assinaturaOrigem='asaas'`. Gated por flag; com ela OFF, o cadastro é o de hoje.
- `app/register/page.tsx` — texto do trial ("14 dias grátis, sem cartão agora").

---

## ETAPA 7 — Master + cancelamento

- `app/api/master/assinaturas-asaas/route.ts` + aba no Master (espelha o painel Hotmart).
- Cancelamento pela assinante (`DELETE /v3/subscriptions/{id}`), mantendo acesso até o
  fim do período pago; Master pode sempre.

---

## ORDEM E POR QUÊ

```
1 estados + JWT ──► 2 tela ──► 3 assinar ──► 4 webhook ──► 5 job ──► 6 cadastro ──► 7 master
   (flag OFF)      (destino)   (vira        (pagamento     (relógio)  (liga o       (gestão)
                                pagante)     mexe no                   funil)
                                             acesso)
```

Cada etapa é commitável e provável sozinha. A ordem evita janelas incoerentes: a **tela
de destino existe antes do bloqueio** (2 antes de 5), o **pagamento funciona antes de o
corte existir** (3 e 4 antes de 5), e o **cadastro só passa a criar trial quando todo o
ciclo já foi provado** (6 por último).

Toda etapa nasce com **flag OFF**. Nenhuma altera o caminho Hotmart.

---

## RISCOS

1. **Etapa 1 toca o login de todo mundo.** Mitigado por flag OFF + prova no preview nos
   dois caminhos. Ligar em produção é decisão do Júnior.
2. **Custo da revalidação:** 1 query a cada 15 min por usuária ativa. Com 186 workspaces
   é irrelevante; fica registrado caso a base cresça muito.
3. **Trial repetido sem CPF** (pendência já registrada pelo Diretor): sem CPF no
   cadastro, nada impede criar contas novas para reiniciar o trial. Não bloqueia agora.
4. **Duas fontes de verdade convivendo** (Hotmart e Asaas). Mitigado por
   `assinaturaOrigem` e pela regra de que cada caminho só mexe no que é seu.
5. **E-mails de cobrança** são o primeiro contato automático do SOA com dinheiro. Tom
   errado gera cancelamento. Sugiro você revisar os textos da Etapa 5 antes de subirem.

---

## DECISÕES PENDENTES

- **(A)** Trial expirado sem assinatura: corte no dia **21** (14 + 7 de carência, mesma
  régua) ou no dia **14** seco? — §0.1, recomendo 21.
- **(B)** Bloqueio só no layout, ou também nas rotas de API? — §0.2, recomendo só layout.
- **(C)** Confirmar o intervalo de 15 min como o certo para a revalidação (é o tempo
  máximo que alguém cortada segue navegando).
