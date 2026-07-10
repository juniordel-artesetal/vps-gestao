# MAPA DO PROJETO — VPS Gestão

> Índice AUTO-GERADO de rotas de API, páginas, componentes, libs e tabelas.
> Gerado em 09/07/2026. Regenerar após adicionar rotas/páginas/tabelas.

**Totais:** 216 rotas de API · 90 páginas · 19 componentes · 26 libs · 104 tabelas

## Rotas de API

| Rota | Métodos |
| --- | --- |
| `/api/auth/[...nextauth]` | — |
| `/api/auth/recuperar-senha` | POST |
| `/api/auth/redefinir-senha` | POST |
| `/api/auth/register` | POST |
| `/api/auth/trocar-senha` | POST |
| `/api/clientes` | GET, POST |
| `/api/clientes/[id]` | GET, PUT, DELETE |
| `/api/clientes/importar` | POST |
| `/api/clientes/lote` | POST |
| `/api/clientes/match` | POST |
| `/api/clientes/visao-geral` | GET |
| `/api/config/campos` | GET, POST |
| `/api/config/campos-estoque` | GET, POST |
| `/api/config/campos-estoque/[id]` | PUT, DELETE |
| `/api/config/campos-pedido` | GET, POST |
| `/api/config/campos-pedido/[id]` | PUT, DELETE |
| `/api/config/campos/[id]` | GET, PUT, DELETE |
| `/api/config/campos/filtros` | GET |
| `/api/config/campos/todos` | GET |
| `/api/config/expedicao` | GET, PUT |
| `/api/config/fluxos` | GET, POST |
| `/api/config/fluxos/[id]` | GET, PUT, DELETE |
| `/api/config/freelancers` | GET, POST |
| `/api/config/freelancers/[id]` | PUT, DELETE |
| `/api/config/freelancers/[id]/historico` | GET |
| `/api/config/geral` | GET, PUT |
| `/api/config/loja` | GET, PUT |
| `/api/config/loja/colecoes` | GET, POST |
| `/api/config/loja/colecoes/[id]` | PUT, DELETE |
| `/api/config/loja/imagens` | GET, POST |
| `/api/config/loja/imagens/[id]` | GET, PUT, DELETE |
| `/api/config/loja/pagamento` | GET, PUT |
| `/api/config/loja/vitrine` | GET |
| `/api/config/loja/vitrine/[id]` | PUT |
| `/api/config/loja/vitrine/variacao/[id]` | PUT |
| `/api/config/marketplace` | GET, PUT |
| `/api/config/producao` | GET, POST |
| `/api/config/producao/[id]` | GET, PUT, DELETE |
| `/api/config/producao/reordenar` | POST |
| `/api/config/usuarios` | GET, POST |
| `/api/config/usuarios/[id]` | PUT, DELETE |
| `/api/dashboard/resultado` | GET |
| `/api/dashboard/resumo` | GET |
| `/api/demandas` | GET, POST |
| `/api/demandas/[id]` | GET, PUT, DELETE |
| `/api/demandas/config` | GET, PUT |
| `/api/demandas/config-pagamento` | GET, POST |
| `/api/demandas/freelancers` | GET, POST |
| `/api/demandas/freelancers/[id]` | PUT, DELETE |
| `/api/demandas/massa` | POST |
| `/api/demandas/precos` | GET, POST |
| `/api/demandas/precos/[id]` | PUT, DELETE |
| `/api/estoque/config` | GET, PUT |
| `/api/estoque/materiais` | GET, POST |
| `/api/estoque/materiais/[materialId]` | GET, PUT, DELETE |
| `/api/estoque/materiais/config` | GET, PUT |
| `/api/estoque/materiais/movimento` | POST |
| `/api/estoque/produtos` | GET, POST |
| `/api/estoque/produtos/[variacaoId]` | GET, PUT, DELETE |
| `/api/estoque/produtos/[variacaoId]/imagem` | GET |
| `/api/estoque/produtos/movimento` | POST |
| `/api/feedback` | GET, POST |
| `/api/feedback/[id]` | GET, PUT |
| `/api/financeiro/categorias` | GET, POST |
| `/api/financeiro/categorias/[id]` | PUT, DELETE |
| `/api/financeiro/fluxo` | GET |
| `/api/financeiro/importacao` | POST |
| `/api/financeiro/lancamentos` | GET, POST |
| `/api/financeiro/lancamentos/[id]` | GET, PUT, DELETE |
| `/api/financeiro/marketplace/baixa` | POST |
| `/api/financeiro/marketplace/pedidos` | GET |
| `/api/financeiro/marketplace/pedidos/[id]` | GET, PUT |
| `/api/financeiro/marketplace/resumo` | GET |
| `/api/financeiro/marketplace/vinculos` | GET, POST |
| `/api/financeiro/metas` | GET, POST |
| `/api/financeiro/resumo` | GET |
| `/api/fornecedores` | GET, POST |
| `/api/fornecedores/[id]` | PUT, DELETE |
| `/api/fornecedores/[id]/compras` | GET, POST |
| `/api/fornecedores/[id]/compras/[compraId]` | PUT, DELETE |
| `/api/gestao/chat` | GET, POST |
| `/api/gestao/chat/titulo` | POST |
| `/api/gestao/contexto` | GET |
| `/api/gestao/conversas` | GET, POST |
| `/api/gestao/conversas/[id]` | GET |
| `/api/gestao/dre` | GET |
| `/api/health` | GET |
| `/api/hotmart/webhook` | POST |
| `/api/importacao/auditoria-ia` | POST |
| `/api/importacao/mapear-ia` | POST |
| `/api/importacao/pedidos` | POST |
| `/api/importacao/pedidos/verificar` | POST |
| `/api/importacao/template` | GET |
| `/api/leads` | GET, POST |
| `/api/loja/[slug]` | GET |
| `/api/loja/[slug]/banner` | GET |
| `/api/loja/[slug]/galeria/[variacaoId]` | GET |
| `/api/loja/[slug]/imagem/[variacaoId]` | GET |
| `/api/loja/[slug]/img/[imagemId]` | GET |
| `/api/loja/[slug]/pagamento` | POST |
| `/api/loja/[slug]/pedido` | POST |
| `/api/marketing/banners` | GET, POST |
| `/api/marketing/banners/[id]` | PUT, DELETE |
| `/api/marketing/noticias` | GET, POST |
| `/api/marketing/noticias/[id]` | PUT, DELETE |
| `/api/marketing/oportunidades` | GET, POST |
| `/api/marketing/oportunidades/[id]` | PUT, DELETE |
| `/api/master/atendimento` | GET |
| `/api/master/atendimento/[id]` | GET |
| `/api/master/auth` | POST |
| `/api/master/chamados/[id]` | POST, PUT |
| `/api/master/dashboard` | GET |
| `/api/master/debug/usuario` | GET |
| `/api/master/error-logs` | GET, DELETE |
| `/api/master/export` | GET |
| `/api/master/feedback/[id]` | POST, PUT |
| `/api/master/impersonar` | POST |
| `/api/master/impersonar/sair` | POST |
| `/api/master/mensagens` | GET, POST |
| `/api/master/parcerias` | GET |
| `/api/master/patrocinados` | GET, POST |
| `/api/master/patrocinados/[id]` | PUT, DELETE |
| `/api/master/patrocinados/relatorio` | GET |
| `/api/master/stars` | GET, POST |
| `/api/master/workspaces` | GET, POST |
| `/api/master/workspaces/[id]` | GET, PUT, PATCH, DELETE |
| `/api/master/workspaces/[id]/usuarios/[userid]` | GET |
| `/api/meta/conversion` | POST |
| `/api/minha-loja/pedidos` | GET |
| `/api/minha-loja/resumo` | GET |
| `/api/notificacoes` | GET |
| `/api/notificacoes/lidas` | POST |
| `/api/onboarding/finalizar` | POST |
| `/api/orcamentos` | GET, POST |
| `/api/orcamentos/[id]` | PUT, DELETE |
| `/api/orcamentos/[id]/gerar-link` | POST |
| `/api/orcamentos/aprovacao/[token]` | GET, POST |
| `/api/pagamento/webhook/[provedor]` | POST |
| `/api/pesquisa-preco` | POST |
| `/api/pesquisa-preco/alertas` | GET, POST, DELETE |
| `/api/pesquisa-preco/clique` | POST |
| `/api/pesquisa-preco/comparar` | GET |
| `/api/pesquisa-preco/snapshot` | GET, POST |
| `/api/precificacao/calcular` | POST |
| `/api/precificacao/canal/tarifas/ml` | GET |
| `/api/precificacao/canal/tarifas/ml/[id]` | PUT, DELETE |
| `/api/precificacao/combos` | GET, POST |
| `/api/precificacao/combos/[id]` | GET, PUT, DELETE |
| `/api/precificacao/config-tributos` | GET, PUT |
| `/api/precificacao/embalagens` | GET, POST |
| `/api/precificacao/embalagens/[id]` | GET, PUT, DELETE |
| `/api/precificacao/materiais` | GET, POST |
| `/api/precificacao/materiais/[id]` | GET, PUT, DELETE |
| `/api/precificacao/materiais/importar` | POST |
| `/api/precificacao/materiais/lote` | POST |
| `/api/precificacao/ncm` | POST |
| `/api/precificacao/produtos` | GET, POST |
| `/api/precificacao/produtos/[id]` | GET, POST, PUT, DELETE |
| `/api/precificacao/produtos/[id]/copiar` | POST |
| `/api/precificacao/produtos/importar` | POST |
| `/api/precificacao/produtos/lote` | POST |
| `/api/precificacao/produtos/massa` | POST |
| `/api/precificacao/variacoes` | GET, POST |
| `/api/precificacao/variacoes/[id]` | GET, PUT, DELETE |
| `/api/precificacao/variacoes/[id]/[historico]` | GET |
| `/api/producao/campos-valores` | GET, POST |
| `/api/producao/demandas` | GET |
| `/api/producao/demandas/[id]` | GET |
| `/api/producao/historico/[pedidoId]` | GET |
| `/api/producao/pedidos` | GET, POST |
| `/api/producao/pedidos/[id]` | GET, PUT, DELETE |
| `/api/producao/pedidos/[id]/pagamento` | GET, PUT |
| `/api/producao/pedidos/consulta` | GET |
| `/api/producao/pedidos/importar` | POST |
| `/api/producao/resumo` | GET |
| `/api/producao/setores` | GET, POST |
| `/api/producao/workflow` | GET, POST, PUT |
| `/api/producao/workflow/[pedidoId]` | GET |
| `/api/stars` | GET, POST |
| `/api/stars/depoimentos` | GET, POST |
| `/api/stars/indicacoes` | GET, POST |
| `/api/stars/indicadores` | GET, POST |
| `/api/stars/pontuar` | POST |
| `/api/stars/resgatar` | GET, POST |
| `/api/stars/saldo` | GET |
| `/api/suporte/chamado` | GET, POST |
| `/api/suporte/chat` | GET, POST |
| `/api/suporte/faq` | GET, POST |
| `/api/suporte/faq/[id]` | GET |
| `/api/suporte/feedback` | GET |
| `/api/suporte/mensagens` | GET, POST |
| `/api/tarefas` | GET, POST |
| `/api/tarefas/[id]` | GET, PUT, DELETE |
| `/api/tarefas/[id]/anexo/[anexoId]` | GET, DELETE |
| `/api/tarefas/[id]/anexos` | POST |
| `/api/tarefas/[id]/checklists` | POST |
| `/api/tarefas/[id]/comentarios` | POST |
| `/api/tarefas/[id]/etiquetas` | POST, DELETE |
| `/api/tarefas/[id]/vinculos` | GET, POST, DELETE |
| `/api/tarefas/agenda` | GET |
| `/api/tarefas/buscar-vinculo` | GET |
| `/api/tarefas/checklists/[checklistId]` | POST, PUT, DELETE |
| `/api/tarefas/checklists/[checklistId]/itens/[itemId]` | PUT, DELETE |
| `/api/tarefas/colunas` | POST |
| `/api/tarefas/colunas/[id]` | PUT, DELETE |
| `/api/tarefas/colunas/reordenar` | POST |
| `/api/tarefas/etiquetas` | GET, POST |
| `/api/tarefas/etiquetas/[id]` | PUT, DELETE |
| `/api/tarefas/feed` | GET |
| `/api/tarefas/minhas` | GET |
| `/api/tarefas/mover` | POST |
| `/api/tarefas/por-referencia` | GET |
| `/api/tarefas/quadros` | GET, POST |
| `/api/tarefas/quadros/[id]` | PUT, DELETE |
| `/api/tarefas/resumo` | GET |
| `/api/telegram/bot` | POST |

## Páginas

- `/`
- `/clientes`
- `/clientes/[id]`
- `/clientes/visao-geral`
- `/config/campos-estoque`
- `/config/campos-pedido`
- `/config/expedicao`
- `/config/fluxos`
- `/config/freelancers`
- `/config/geral`
- `/config/loja`
- `/config/loja/pagamento`
- `/config/loja/vitrine`
- `/config/producao`
- `/config/usuarios`
- `/dashboard`
- `/dashboard/calendario`
- `/dashboard/demandas`
- `/dashboard/estoque`
- `/dashboard/lacos`
- `/dashboard/orcamentos`
- `/dashboard/painel`
- `/dashboard/pedidos`
- `/dashboard/pedidos/[id]`
- `/dashboard/pedidos/[id]/print`
- `/dashboard/pedidos/[id]/qr`
- `/dashboard/pedidos/print`
- `/dashboard/setor/[id]`
- `/demandas`
- `/demandas/config-pagamento`
- `/demandas/freelancers`
- `/demandas/historico`
- `/demandas/precos`
- `/financeiro`
- `/financeiro/categorias`
- `/financeiro/fluxo`
- `/financeiro/lancamentos`
- `/financeiro/marketplace`
- `/financeiro/metas`
- `/gestao`
- `/gestao/dre`
- `/landing`
- `/login`
- `/loja/[slug]`
- `/master`
- `/master/assinantes`
- `/master/atendimento`
- `/master/feedback`
- `/master/leads`
- `/master/login`
- `/master/logs`
- `/master/marketing`
- `/master/parcerias`
- `/master/patrocinados`
- `/megaartesanal`
- `/megaartesanal/sorteio`
- `/minha-loja`
- `/minha-loja/pedidos`
- `/modulos`
- `/obrigado`
- `/orcamento/[token]`
- `/pesquisa-preco`
- `/precificacao`
- `/precificacao/calcular`
- `/precificacao/canais`
- `/precificacao/combos`
- `/precificacao/config-tributos`
- `/precificacao/embalagens`
- `/precificacao/estoque-materiais`
- `/precificacao/fornecedores`
- `/precificacao/materiais`
- `/precificacao/oraculo`
- `/precificacao/produtos`
- `/precificacao/skus`
- `/primeiros-passos`
- `/redefinir-senha`
- `/register`
- `/setup`
- `/stars`
- `/suporte`
- `/suporte/admin/faq`
- `/suporte/feedback`
- `/tarefas`
- `/tarefas/[quadroId]`
- `/tarefas/atividades`
- `/tarefas/calendario`
- `/tarefas/minhas`
- `/tarefas/quadros`
- `/tarefas/quadros/[quadroId]`
- `/trocar-senha`

## Componentes

- `DarkModeToggle.tsx`
- `ImpersonationBanner.tsx`
- `MapeamentoColunas.tsx`
- `MasterVpsStars.tsx`
- `MetaPixel.tsx`
- `ModalImportacao.tsx`
- `ModalImportacaoClientes.tsx`
- `ModalImportacaoFinanceiro.tsx`
- `ModalImportacaoMateriais.tsx`
- `ModalImportacaoProdutos.tsx`
- `NovidadesPopup.tsx`
- `OrdenarPedidos.tsx`
- `OrigemSelect.tsx`
- `ScannerPedido.tsx`
- `SessionProviderWrapper.tsx`
- `Sidebar.tsx`
- `StarsPopup.tsx`
- `StarsWidget.tsx`
- `ThemeLoader.tsx`

## Libs

- `alert.ts` — lib/alert.ts
- `auth.ts`
- `baixarEstoqueMaterial.ts` — lib/baixarEstoqueMaterial.ts
- `canais.ts` — Canais/origens possíveis de um cliente (como ele chegou até a marca).
- `data.ts` — ─────────────────────────────────────────────────────────────
- `dbRetry.ts` — lib/dbRetry.ts
- `errorLog.ts` — lib/errorLog.ts
- `indicePrecos.ts`
- `lojaGaleria.ts`
- `mapeamentoImport.ts` — lib/mapeamentoImport.ts — de-para de colunas para os importadores — VPS-20260630-NQA8
- `margem.ts` — ─────────────────────────────────────────────────────────────
- `marketplaceSchema.ts` — Provisão idempotente das tabelas do módulo "Números do Marketplace".
- `matchVariacao.ts` — ─────────────────────────────────────────────────────────────
- `normNome.ts` — Normalização de nome SÓ para COMPARAR (o nome original é sempre preservado).
- `ordenacaoPedidos.ts`
- `pagamento/index.ts` — Camada genérica provider-agnostic de pagamento.
- `pagamento/mercadopago.ts` — Adaptador Mercado Pago — cobrança PIX na conta DA ARTESÃ (token do workspace).
- `pagamento/pix.ts` — PIX "copia e cola" (BR Code EMV) estático COM valor — sem gateway.
- `precoTecido.ts`
- `prisma.ts`
- `reconciliarVinculos.ts` — lib/reconciliarVinculos.ts — reconciliação idempotente material↔produto — VPS-20260630-NQA8
- `serialize.ts` — ══════════════════════════════════════════════════════════════
- `stars.ts` — lib/stars.ts
- `telegramNotify.ts` — lib/telegramNotify.ts
- `theme.ts`
- `versao.ts` — Versão atual do sistema

## Tabelas do banco (Postgres/Neon)

> `mirror` = presente em `prisma/schema.prisma`. Sem mirror = usada só via SQL raw.

| Tabela | Colunas | No schema.prisma? |
| --- | --- | --- |
| `AiConversa` | 8 | — (raw SQL) |
| `AiUsageLog` | 8 | mirror |
| `CanalTarifaML` | 9 | — (raw SQL) |
| `Cliente` | 17 | — (raw SQL) |
| `ClienteContato` | 7 | — (raw SQL) |
| `ClienteEndereco` | 12 | — (raw SQL) |
| `Demanda` | 22 | mirror |
| `DemandaChecklist` | 6 | mirror |
| `DemandaConfigPagamento` | 6 | — (raw SQL) |
| `DemandaItem` | 7 | mirror |
| `DemandaPedido` | 6 | mirror |
| `DemandaPreco` | 8 | mirror |
| `ErrorLog` | 6 | — (raw SQL) |
| `EstCampoConfig` | 9 | — (raw SQL) |
| `EstCampoValor` | 6 | — (raw SQL) |
| `EstMaterialMovimento` | 12 | — (raw SQL) |
| `EstMaterialSaldo` | 7 | — (raw SQL) |
| `EstProdutoMovimento` | 11 | — (raw SQL) |
| `EstProdutoSaldo` | 7 | — (raw SQL) |
| `EstoqueMaterial` | 11 | — (raw SQL) |
| `EstoqueMaterialMovimento` | 11 | — (raw SQL) |
| `ExpedicaoConfig` | 9 | — (raw SQL) |
| `Feedback` | 12 | — (raw SQL) |
| `FinCategoria` | 6 | mirror |
| `FinLancamento` | 22 | mirror |
| `FinMeta` | 7 | mirror |
| `FluxoModelo` | 7 | — (raw SQL) |
| `FluxoModeloSetor` | 4 | — (raw SQL) |
| `Fornecedor` | 17 | — (raw SQL) |
| `FornecedorCompra` | 9 | — (raw SQL) |
| `Freelancer` | 9 | — (raw SQL) |
| `HotmartEvent` | 9 | — (raw SQL) |
| `ImpersonationLog` | 10 | — (raw SQL) |
| `LacosAjuste` | 7 | mirror |
| `LacosEntrada` | 6 | mirror |
| `Lead` | 10 | mirror |
| `LoginHistory` | 7 | — (raw SQL) |
| `LojaColecao` | 6 | — (raw SQL) |
| `LojaConfig` | 15 | — (raw SQL) |
| `LojaImagem` | 8 | mirror |
| `LojaPagamentoConfig` | 12 | — (raw SQL) |
| `MarketingBanner` | 12 | — (raw SQL) |
| `MarketingNoticia` | 11 | — (raw SQL) |
| `MarketingOportunidade` | 11 | — (raw SQL) |
| `MarketplaceConfig` | 5 | mirror |
| `MarketplaceProdutoVinculo` | 6 | mirror |
| `Notificacao` | 9 | mirror |
| `Orcamento` | 21 | — (raw SQL) |
| `OrcamentoItem` | 11 | — (raw SQL) |
| `Order` | 31 | mirror |
| `Pagamento` | 8 | — (raw SQL) |
| `PedidoCampoConfig` | 11 | — (raw SQL) |
| `PedidoHistorico` | 7 | — (raw SQL) |
| `PedidoMarketplace` | 41 | mirror |
| `PedidoMarketplaceItem` | 13 | mirror |
| `PedidoSetor` | 12 | — (raw SQL) |
| `PesquisaAlerta` | 10 | — (raw SQL) |
| `PesquisaAnuncioEvento` | 5 | — (raw SQL) |
| `PesquisaLog` | 5 | — (raw SQL) |
| `PesquisaPatrocinado` | 15 | — (raw SQL) |
| `PrecCombo` | 11 | mirror |
| `PrecComboItem` | 6 | mirror |
| `PrecConfigTributaria` | 6 | mirror |
| `PrecEmbalagem` | 8 | mirror |
| `PrecEmbalagemItem` | 7 | mirror |
| `PrecKitItem` | 6 | mirror |
| `PrecMaterial` | 15 | mirror |
| `PrecMaterialItem` | 7 | mirror |
| `PrecProduto` | 15 | mirror |
| `PrecVariacao` | 26 | mirror |
| `PrecVariacaoHistorico` | 7 | mirror |
| `PrecoIndiceSnapshot` | 6 | — (raw SQL) |
| `ProcessoConfig` | 8 | mirror |
| `Recebivel` | 9 | mirror |
| `Setor` | 4 | mirror |
| `SetorCampo` | 12 | — (raw SQL) |
| `SetorCampoValor` | 8 | — (raw SQL) |
| `SetorConfig` | 9 | mirror |
| `SuporteChamado` | 18 | — (raw SQL) |
| `SuporteFaq` | 8 | — (raw SQL) |
| `SuporteFeedback` | 17 | — (raw SQL) |
| `SuporteMensagem` | 7 | — (raw SQL) |
| `Tarefa` | 13 | — (raw SQL) |
| `TarefaAnexo` | 6 | — (raw SQL) |
| `TarefaChecklist` | 5 | — (raw SQL) |
| `TarefaChecklistItem` | 6 | — (raw SQL) |
| `TarefaColuna` | 6 | — (raw SQL) |
| `TarefaComentario` | 7 | — (raw SQL) |
| `TarefaEtiqueta` | 5 | — (raw SQL) |
| `TarefaEtiquetaLink` | 4 | — (raw SQL) |
| `TarefaHistorico` | 7 | — (raw SQL) |
| `TarefaQuadro` | 7 | — (raw SQL) |
| `TarefaVinculo` | 7 | — (raw SQL) |
| `User` | 13 | mirror |
| `UserSetor` | 5 | — (raw SQL) |
| `VpsDepoimento` | 7 | — (raw SQL) |
| `VpsIndicacao` | 7 | — (raw SQL) |
| `VpsStars` | 7 | — (raw SQL) |
| `VpsStarsLog` | 7 | — (raw SQL) |
| `VpsStarsPremio` | 9 | — (raw SQL) |
| `VpsStarsResgate` | 7 | — (raw SQL) |
| `WorkItem` | 11 | mirror |
| `Workspace` | 37 | mirror |
| `WorkspaceTheme` | 6 | mirror |
