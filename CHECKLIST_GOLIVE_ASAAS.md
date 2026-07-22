# CHECKLIST DE GO-LIVE — motor de pagamento Asaas

Tudo que separa o **preview** (validado em 22/07/2026, sandbox + branch Neon `dev-asaas`)
da **produção**. Nada aqui roda sozinho: cada item é decisão do Júnior.

> **Estado hoje:** fundação provada ponta a ponta no sandbox — conexão, cliente,
> cobrança PIX, assinatura, webhook idempotente com evento REAL do Asaas
> (`PAYMENT_RECEIVED` → `AsaasCobranca RECEIVED`, processado em 1 segundo).
> Em produção **nada existe ainda**: `AsaasConfig` vazia, tabelas não criadas,
> módulo sem flag.

---

## 1. Banco de produção

- [ ] Rodar a migração apontando para produção:
      `node --env-file=.env scripts/migrar-asaas-fundacao.mjs` (dry-run primeiro)
      depois `--apply`. São 13 passos aditivos (`CREATE TABLE IF NOT EXISTS` /
      `ADD COLUMN IF NOT EXISTS`), em transação única.
- [ ] **Conferir o host antes do `--apply`.** Sem `.env.local`, o `.env` aponta para
      produção — que é o desejado AQUI, e o oposto do que era no desenvolvimento.
      Confirmar `ep-lively-firefly-*` de propósito, e só então aplicar.
- [ ] Validar que as 5 tabelas existem: `AsaasConfig`, `AsaasWebhookEvento`,
      `AsaasCliente`, `AsaasAssinatura`, `AsaasCobranca`.

## 2. Envs na Vercel (escopo **Production**)

- [ ] `ASAAS_API_KEY` — chave de **produção** (prefixo **sem** `_hmlg_`).
      ⚠️ O código resolve o ambiente pelo prefixo: uma chave de homologação em
      produção iria para `api-sandbox` silenciosamente, e nada seria cobrado de verdade.
- [ ] `ASAAS_TOKEN_KEY` — **ainda não existe em Production** (só em Preview, por
      decisão de 22/07). Criar no go-live.
- [ ] Marcar as duas como **Sensitive**.
- [ ] Já criadas em Production em 22/07 (nada a fazer): `LOGISTICA_TOKEN_KEY`,
      `GOOGLE_DRIVE_TOKEN_KEY`.

⚠️ **Ordem importa:** criar `ASAAS_TOKEN_KEY` DEPOIS de já haver credencial gravada
na `AsaasConfig` de produção torna essa credencial ilegível (a cripto cai no
fallback `LOGISTICA_TOKEN_KEY` enquanto a específica não existe). Crie a env
**antes** de salvar qualquer chave pela tela — ou regrave a chave depois.

## 3. Webhook de produção

- [ ] Gerar um `authToken` **NOVO** em `/master/asaas` de produção. Não reaproveitar
      o do preview: ele já circulou em script e em URL de teste.
- [ ] Cadastrar no painel de produção do Asaas (ou via
      `scripts/cadastrar-webhook-asaas.mjs`, ajustando a base para produção)
      apontando para `https://usesoa.com.br/api/webhooks/asaas`.
- [ ] **SEM `?x-vercel-protection-bypass=`** — o domínio de produção não tem
      Deployment Protection. O bypass é exclusivo do preview.
- [ ] Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`,
      `PAYMENT_REFUNDED`, `PAYMENT_DELETED`, `PAYMENT_CHARGEBACK_REQUESTED`.
- [ ] `sendType: SEQUENTIALLY`.
- [ ] Depois do primeiro evento real, conferir `AsaasWebhookEvento.processadoEm`.
      ⚠️ 15 falhas consecutivas **pausam a fila inteira** no Asaas.

## 4. Taxas reais na guarda de estouro

`lib/pagamento/asaas/index.ts → TAXA_ESTIMADA` está marcada `(?)` — é estimativa
conservadora, não a taxa negociada.

**Dado real colhido no sandbox em 22/07:** cobrança PIX de R$ 5,00 → `netValue`
R$ 4,01, ou seja **taxa PIX de R$ 0,99** (a estimativa usa R$ 1,99).

- [ ] Confirmar no painel do Asaas as taxas do plano contratado (PIX, boleto,
      cartão) e atualizar `TAXA_ESTIMADA`, removendo o `(?)`.
- [ ] Reavaliar: a estimativa atual erra para o lado **seguro** (subestima o
      líquido, então recusa split que caberia). Corrigir deixa a guarda menos
      restritiva — reconferir com os percentuais reais de comissão dos parceiros.

## 5. Flag do módulo

- [ ] Em produção o módulo **nasce OFF** (`AsaasConfig.ativo = false`). Com ele
      desligado, webhooks são **guardados sem processar** — não se perdem, mas
      também não têm efeito.
- [ ] Ligar só depois de: migração aplicada, envs criadas, teste de conexão OK
      (o kill-switch da tela fica desabilitado até o teste passar) e webhook
      cadastrado.
- [ ] Se chegarem eventos com a flag OFF, usar **"Reprocessar pendentes"** em
      `/master/asaas` depois de ligar — senão viram órfãos (o Asaas não reenvia
      depois do nosso 200).

## 6. Encerrar o ambiente de preview

Quando a `feat/pagamento-asaas` for mergeada e a branch morrer:

- [ ] Remover o webhook do preview no sandbox:
      `node --env-file=.env --env-file=.env.local scripts/cadastrar-webhook-asaas.mjs --remover ee5a8968-a373-42e7-a5a2-24c1db74bbcc`
      (a URL do preview deixa de existir e o Asaas acumularia falhas até pausar a fila).
- [ ] Limpar os dados de teste do banco dev:
      `scripts/disparar-webhook-simulado.mjs --limpar`.
- [ ] Avaliar desligar o Protection Bypass for Automation:
      `vercel project protection disable vps-gestao --protection-bypass`.
      O secret circulou em URL de webhook — se ficar ligado, rotacione.
- [ ] Sandbox do Asaas: sobraram 2 clientes (`cus_000008455662`, `cus_000008455768`)
      e 2 cobranças de R$ 5. As assinaturas de teste já foram canceladas em 22/07.

## 7. Pendências abertas

- [ ] **`TICKET_CRIPTO_GUARDA.md`** (raiz, não commitado) — `temChaveCripto()` existe
      e ninguém a chama; sem a env, a conexão falha **em silêncio**. Aprovado como
      ticket separado, a executar depois desta fase.
- [ ] **Split em assinatura é template com `fixedValue`** — mudar o valor do plano
      **não** recalcula a comissão das cobranças futuras. Ao permitir troca/reajuste
      de plano, atualizar o split junto (`PUT /v3/subscriptions/{id}`) e revalidar
      com `montarSplitComissao()`. Registrado em `lib/pagamento/asaas/index.ts`.
- [ ] **Onboarding do `walletId`** de influenciadores/afiliados — sem wallet não há
      split (não é erro: simplesmente não há repasse).
- [ ] **Assinaturas**: decisão vigente é Asaas **só para novos cadastros**; a base
      atual segue na Hotmart. A convivência das duas fontes ainda não foi modelada.
- [ ] **Payout avulso** é stub de propósito (`pagarComissao`) — transferência move
      dinheiro real e é ação manual do Júnior, não do sistema.
- [ ] **Hardening: bloqueio de acesso só no layout** (decisão do Diretor, 22/07). Quem
      está com a assinatura suspensa é redirecionada pelo layout autenticado, mas as
      ~130 rotas de API continuam respondendo se chamadas diretamente. Risco baixo (o
      produto é a interface; exige alguém deliberadamente montando requisições), custo
      alto agora (guarda em 130 rotas ou um wrapper novo). Reavaliar se surgir abuso.
- [ ] **Rollout da revalidação de sessão** (`ASSINATURA_REVALIDACAO=on` em Production).
      Toca o login de todos os workspaces: é o que faz o corte valer para quem já está
      logado, tanto no caminho Asaas quanto no da Hotmart. Ligar é decisão explícita do
      Júnior, depois de provado no preview. Reverter = remover a env e redeployar.
      ⚠️ Efeito colateral desejado: cortes da Hotmart, que hoje só valem no próximo
      login, passam a valer em até 15 minutos.

## 8. Não esquecer

- [ ] Nenhuma credencial em chat, log, commit ou payload de IA.
- [ ] CPF nunca persistido nem logado; o payload do webhook é mascarado antes do
      JSONB (cpfCnpj, e-mail, telefone; cartão removido).
- [ ] Payload expurgado após 90 dias; a linha do evento fica para sempre (a
      idempotência depende do `eventoId` existir).
