## Fase 0 — Motor de assinatura Asaas (SOA)

Constrói o motor de pagamento/assinatura sobre o Asaas como adapter agnóstico de
provedor: assinaturas SOA, split de comissão de parceiro e base para o checkout da
Loja Virtual. **29 commits**, sandbox-first, tudo atrás da flag `ASSINATURA_NOVO_CADASTRO`
(OFF = nada muda em produção).

> 🚧 **RASCUNHO.** Só promover para "pronto para revisão" quando os 3 itens do placar
> abaixo estiverem verdes. O Diretor faz a revisão final antes do merge do Júnior.

### O que entra
- **Fundação Asaas** (`lib/pagamento/asaas/`): adapter, webhook idempotente, cripto
  própria, mascaramento LGPD, retenção de payload. Chave nunca em log/output.
- **Máquina de estados** (`lib/assinatura/`): `AGUARDANDO_PAGAMENTO → TRIAL → ATIVA →
  INADIMPLENTE → CORTADA/CANCELADA`; só age em `origem='asaas'` (Hotmart intocada).
- **Portão de entrada**: o método de pagamento é a porta. Cadastro → plano+CPF →
  Pix nativo na nossa tela **ou** cartão em popup (checkout hospedado, fora do escopo PCI).
- **Trial de 14 dias** concedido no portão (QR Pix gerado ou checkout de cartão concluído).
- **Split de comissão**: 30% mensal / 40% anual, por parceiro, com guarda de estouro
  calibrada pelas taxas **reais de produção** (`GET /myAccount/fees`, 23/07/2026).
- **Régua de avisos** (job diário): 15 pontos de contato, render à prova de `{{buraco}}`.
- **Avisos internos** para a equipe (`contato@usesoa.com.br`) em novo trial e conversão.
- **Master**: painel de assinantes, leads (quem parou no portão), cancelamento.
- **Landing atrás da flag**: OFF = CTAs Hotmart byte a byte; ON = CTAs → `/register`.

### Placar para promover a "pronto para revisão"
- [x] **Copy v2 implementada** — os 15 textos de `COPY_REGUA_ASSINATURA_SOA_v2.md`
  (assinatura "Equipe SOA"), com papel por método (cartão = aviso de cobrança / Pix =
  convite), os 4 de abandono reescritos e negrito no HTML. `provar-copy` verde.
- [x] **Fix do `/register`** — conta `AGUARDANDO_PAGAMENTO` vai para `/assinatura`, não `/setup`.
- [x] **CTAs da landing atrás da flag** `ASSINATURA_NOVO_CADASTRO` + trial "14 dias grátis".
- [x] **As 8 provas de preview verdes** (deploy `9141603`, flag ON):
  `provar-portao`, `provar-pix-nativo`, `provar-segmento`, `provar-acesso-webhook`,
  `provar-cancelamento`, `provar-bloqueio-preview`, `provar-assinar-preview`,
  `provar-split-aceito`. **8/8 ✅** (`provar-funil-completo` aposentado — superado
  por `provar-portao`).

### Registrado para o merge / go-live (fora desta branch ou de config)
- `lib/parceiros/concederTrial`: mesmo bug `date + bigint` (falta `::int`) + `GREATEST` — merge-obrigatório.
- Checklist Resend (remetente/domínio) + `CRON_SECRET` na Vercel.
- Risco aceito "QR gerado = trial" (abuso possível, registrado no CHECKLIST_GOLIVE).
- Asaas produção: `bankAccountInfo = PENDING` — bloqueia **saque**, não cobrança (ação do Júnior no painel).

### Garantias
- Prisma raw-only, multi-tenant por `workspaceId`, `serialize()` nos retornos.
- CPF nunca persistido/logado/em payload de IA. Webhook idempotente por `eventoId`.
- Nenhuma escrita em produção nesta branch; nenhum push de dinheiro automático.
