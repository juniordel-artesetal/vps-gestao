# Método Mãe (MAE) — monetização no Asaas

Construído em 12/10/2026, **desligado** até o lançamento: as telas mostram "em breve" até as envs abaixo serem configuradas e um novo deploy ser feito. Mesmo modelo do lançamento do SOA Design.

## Decisões do Júnior

**Preços:** os 4 ficam em env e nunca no código.

| Produto | Para quem | Mensal | Anual |
| --- | --- | --- | --- |
| Add-on | quem já assina o SOA | `MAE_ADDON_MENSAL` = 39,90 | `MAE_ADDON_ANUAL` = 383,00 |
| Standalone | só o MAE, sem o SOA | `MAE_STANDALONE_MENSAL` = 59,90 | `MAE_STANDALONE_ANUAL` = 503,00 |

- **Anual em até 12× no cartão, com os juros pagos pelo cliente:**
  - usa a mesma tabela Price do anual do SOA (`TAXA_PARCELAMENTO_ANUAL`), então 12× do add-on dá 12 × R$ 38,21 = R$ 458,52;
  - o item do checkout já vai com o total com juros; o Asaas só divide;
  - **não ligar** "repassar juros ao cliente" no Asaas.
- **Economia do anual** (calculada a partir da config): add-on 20%, standalone 30%.
- **Trial de 7 dias com cartão:**
  - o cartão é validado por uma pré-autorização de R$ 5, liberada na hora (a mesma do SOA);
  - a 1ª cobrança vem no fim do teste;
  - o trial vale só na primeira vez: quem já testou começa pagando.
- **A Edição em massa vem inteira no MAE:** pedidos, ações em massa e lote de impressão. Deixa de existir o add-on "massa" separado.
- **SOA Design:** desliga no lançamento do MAE.
  - Some do menu, do Hub e da venda; as telas `/estudio/*` e `/soa-edition` levam ao MAE.
  - Quem assinava o SOA Design vira **cortesia do MAE** até o Júnior decidir a cobrança.
  - As assinaturas `EDMOD:` no Asaas **não são canceladas nem estornadas** automaticamente; isso é decisão financeira do Júnior.
- **Standalone** vê só o MAE e a Minha assinatura (nada do ERP nem do SOA Design).
- **Add-on depende do SOA ativo:** se a conta é cortada pela régua do SOA, a conta toda bloqueia, como já acontece hoje.

## Como funciona

**Acesso:**
- Colunas no `Workspace` (migração aditiva `scripts/migrar-mae-assinatura.mjs`, aplicada em 12/10): `moduloMae`, `moduloMaeOrigem` (asaas | cortesia), `moduloMaeCiclo` (mensal | anual), `moduloMaePlano` (addon | standalone) e `moduloMaeAte` (acesso até).
- Tabela `MaeAssinatura`: o vínculo com o Asaas, uma por workspace.
- O acesso vale até `moduloMaeAte`:
  - no trial: até o fim do teste;
  - pago: até o próximo vencimento + 5 dias de carência;
  - vencido sem pagar: acaba sozinho na carência (sem cron);
  - cancelado: até o fim do período pago;
  - estorno ou chargeback: corta no dia.
- Cortesia é imune a tudo isso.
- A regra está em `lib/mae/assinatura/precos.ts` (`acessoMae`) e entra no `addonsDaConta`, que é o que libera o editor e a massa.

**Checkout:**
- Asaas hospedado, só cartão, assinatura recorrente MONTHLY ou YEARLY.
- `externalReference` = `MAEA:<ws>`. O prefixo `MAE:` continua sendo da Loja da Naty.
- Sem cobrança dupla: com trial ou assinatura ativa, não abre outro checkout; inadimplente é levada à fatura em aberto.
- Código: `lib/mae/assinatura/servidor.ts`.

**Webhook** (`lib/pagamento/asaas/webhook.ts`):
- `CHECKOUT_PAID`/`EXPIRED` do MAE são tratados antes dos do SOA.
- Cobranças da assinatura do MAE (que o checkout envia **sem** `externalReference`) são reconhecidas pela subscription ou pelo checkout gravados em `MaeAssinatura`. Elas **não** viram `AsaasCobranca`, acesso ou comissão da plataforma.
- `SUBSCRIPTION_DELETED` do MAE fica só no MAE.

**Standalone:**
- Cadastro em `/mae/cadastro`, que cria a conta com `moduloMaePlano='standalone'`, `assinaturaOrigem='mae'` (fora da régua do SOA) e `profileCompleto=true`.
- No login, a sessão ganha `soMae`:
  - o middleware leva qualquer área do ERP/SOA Design para `/estudio/mae`, e `/assinatura` para `/mae/assinatura`;
  - o menu mostra só o grupo do MAE;
  - os pedidos vêm da planilha da Shopee ou do cadastro manual (Lote 7).

**Telas:**
- `/mae/assinatura`: planos, parcelas, economia e status.
- No Hub de Módulos, card "Método Mãe" com "Ativar · R$ 39,90/mês".
- No menu, "Assinatura do Método Mãe" / "Minha assinatura".

**Master:** `POST /api/master/mae/cortesia { email | workspaceId, on }`. As contas beta (`MAE_BETA_WORKSPACES`) continuam isentas.

## Checklist do lançamento

1. Na Vercel (produção), configurar:
   - `MAE_ADDON_MENSAL=39.90`
   - `MAE_ADDON_ANUAL=383.00`
   - `MAE_STANDALONE_MENSAL=59.90`
   - `MAE_STANDALONE_ANUAL=503.00`
   - `MAE_VENDA_ATIVO=on`
2. Fazer um novo deploy (as envs entram no build e no middleware).
3. No mesmo dia: o SOA Design some do menu e do Hub, e quem assinava passa a ver o MAE como cortesia.
4. Decidir as assinaturas `EDMOD:` do SOA Design que ainda cobram R$ 29,90 no Asaas: cancelar, migrar ou manter. Nada é automático.
5. Teste real com cartão: um add-on mensal, um anual em 12× e uma conta standalone. Conferir:
   - o trial;
   - a pré-autorização liberada;
   - a 1ª cobrança no 7º dia;
   - o webhook ativando o acesso.

## E-mails e cancelamento (12/10/2026)

**E-mails** (Resend, `lib/mae/assinatura/emails.ts`):
- Todos são idempotentes: cada um reivindica a sua marca em `MaeAssinatura` antes de enviar (`emailInicioEm`, `emailFimTrialEm`, `emailAtrasoVenc` por vencimento, `emailCanceladaEm`).
- Os e-mails:
  - boas-vindas da conta standalone (no cadastro);
  - início do teste (no `CHECKOUT_PAID`);
  - aviso de que o teste termina em até 2 dias (cron diário `/api/cron/mae-assinatura`, 9h de Brasília);
  - pagamento não aprovado (um por vencimento, com o "acesso até");
  - assinatura cancelada (pela tela ou no Asaas).
- Vão para a ADMIN da conta.

**Cancelar pela tela:** botão "Cancelar assinatura" em `/mae/assinatura`, com confirmação; rota `POST /api/mae/assinatura/cancelar`, só ADMIN.
- Apaga no Asaas a assinatura gravada e qualquer outra viva com `MAEA:<ws>` (no trial a subscription ainda não chegou ao banco).
- Nada é estornado. O acesso segue até o fim do teste ou do período pago.
- Se o Asaas recusar, nada é marcado.

**Reassinar** depois de cancelar: abre um checkout novo, sem 2º trial. A 1ª cobrança cai no fim do acesso que ainda resta, para não cobrar duas vezes o mesmo período.

## Fora do pacote

- **Limite de cobrança da massa:** não há; a massa é ilimitada no plano. Seria uma decisão comercial nova.
