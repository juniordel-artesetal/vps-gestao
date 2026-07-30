# MAPA DO PROJETO — VPS Gestão

> Índice AUTO-GERADO de rotas de API, páginas, componentes, libs e tabelas.
> Gerado em 13/07/2026. Regenerar após adicionar rotas/páginas/tabelas.

**Totais:** 224 rotas de API · 91 páginas · 19 componentes · 29 libs · 107 tabelas

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
| `/api/config/loja/atributos` | GET, POST |
| `/api/config/loja/atributos/[id]` | PUT, DELETE |
| `/api/config/loja/atributos/sugerir` | POST |
| `/api/config/loja/colecoes` | GET, POST |
| `/api/config/loja/colecoes/[id]` | PUT, DELETE |
| `/api/config/loja/imagens` | GET, POST |
| `/api/config/loja/imagens/[id]` | GET, PUT, DELETE |
| `/api/config/loja/pagamento` | GET, PUT |
| `/api/config/loja/variacao-opcoes` | POST |
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
| `/api/importacao/criar-por-copia` | POST |
| `/api/importacao/depara` | GET, POST |
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
| `/api/precificacao/canal-tarifas-ml` | GET, POST |
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
| `/api/precificacao/produtos/sugerir-base` | GET |
| `/api/precificacao/variacoes` | GET, POST |
| `/api/precificacao/variacoes/[id]` | GET, PUT, DELETE |
| `/api/precificacao/variacoes/[id]/[historico]` | GET |
| `/api/precificacao/vincular-pedidos` | GET, POST |
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
- `/precificacao/vincular-pedidos`
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
- `copiarProduto.ts`
- `data.ts` — ─────────────────────────────────────────────────────────────
- `dbRetry.ts` — lib/dbRetry.ts
- `errorLog.ts` — lib/errorLog.ts
- `indicePrecos.ts`
- `lojaAtributos.ts`
- `lojaGaleria.ts`
- `mapeamentoImport.ts` — lib/mapeamentoImport.ts — de-para de colunas para os importadores — VPS-20260630-NQA8
- `margem.ts` — ─────────────────────────────────────────────────────────────
- `marketplaceSchema.ts` — Provisão idempotente das tabelas do módulo "Números do Marketplace".
- `matchVariacao.ts` — ─────────────────────────────────────────────────────────────
- `normNome.ts` — Normalização de nome SÓ para COMPARAR (o nome original é sempre preservado).
- `orcamentoTotal.ts` — cálculo único do total do orçamento (item = qtd×valorUnit − desconto R$/%; total = Σ itens + frete). Servidor e cliente batem — VPS-20260711-Z4RC
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
| `CanalVenda` | 16 | — (raw SQL) — canais de venda do workspace (habilitar gerenciado + ajuste OU custom) |
| `CatalogoCanal` | 13 | — (raw SQL, GLOBAL) — catálogo de taxas mantido no Master (faixa/categoria) |
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
| `LojaAtributo` | 6 | mirror |
| `LojaAtributoOpcao` | 5 | mirror |
| `LojaColecao` | 6 | — (raw SQL) |
| `LojaConfig` | 15 | — (raw SQL) |
| `LojaImagem` | 8 | mirror |
| `LojaPagamentoConfig` | 12 | — (raw SQL) |
| `LojaVariacaoOpcao` | 5 | mirror |
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
| `PrecCombo` | 15 | mirror (+ visivelLoja/lojaColecaoId/lojaOrdem/lojaDestaque via raw SQL) |
| `PrecComboItem` | 6 | mirror |
| `PrecConfigTributaria` | 6 | mirror |
| `PrecCustosFixos` | 13 | — (raw SQL) — custos fixos & rateio por workspace (2º modelo de precificação) |
| `PrecEmbalagem` | 8 | mirror |
| `PrecEmbalagemItem` | 7 | mirror |
| `PrecKitItem` | 6 | mirror |
| `PrecMaterial` | 15 | mirror |
| `PrecMaterialItem` | 7 | mirror |
| `PrecProduto` | 15 | mirror |
| `PrecVariacao` | 27 | mirror |
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

---

## Sofia 2.0 — busca em linguagem natural + alertas (atualização manual)

Braço direito da artesã. **Anti-alucinação:** todo id/link vem do BANCO; a IA só interpreta a intenção. Todas as ferramentas são READ-ONLY e escopadas por `workspaceId` da sessão.

- `lib/sofia/ferramentas.ts` — buscas read-only: `buscarPedidos` (cliente/produto/número/status/período → `/dashboard/pedidos/{id}`), `buscarClientes` (→ `/clientes/{id}`, **LGPD: só nome+contadores, nunca CPF/e-mail/telefone**), `buscarProdutosMateriais` (→ `/precificacao/...`), `buscarFinanceiro` (→ `/financeiro/lancamentos`).
- `lib/sofia/roteador.ts` — interpreta a pergunta (determinístico) e escolhe a ferramenta+parâmetros; frases da persona; `ehPerguntaAlertas`.
- `lib/sofia/alertas.ts` + `app/api/sofia/alertas/route.ts` — motor de alertas grounded no real (pedidos atrasados, contas vencidas/hoje, estoque baixo), mesma regra do sino (`lib/statusPedido`, `/api/notificacoes`); só dispara o que existe.
- `app/api/sofia/chat/route.ts` — novos ramos (sem IA/sem custo): BUSCA e ALERTAS antes do fallback de IA; resposta agora inclui `resultados`/`verTodos`/`alertas`.
- `components/SofiaWidget.tsx` — renderiza lista clicável de resultados + alertas; badge de alertas no botão flutuante.

---

## Reengajamento por e-mail (retenção) — atualização manual

Motor ÚNICO de alertas (`lib/sofia/alertas.ts`) alimenta a Sofia (login) E o e-mail — nunca divergem.

- `lib/reengajamento.ts` — `listarCandidatas` (aplica INATIVIDADE=4d, LACUNA=7d, COOLDOWN=4d, opt-out; consome `calcularAlertas`), `montarEmail` (voz da Sofia; alertas+CTAs deep-link absolutos ou "senti sua falta" leve; opt-out no rodapé), `executarReengajamento({dryRun})` (dry-run por padrão até `REENGAJAMENTO_ATIVO=on`), `tokenOptOut`, `emailReengajamentoRecente`.
- `app/api/cron/reengajamento/route.ts` — cron (vercel.json `0 12 * * 1-5` = 9h BRT dias úteis), CRON_SECRET, `?dryRun=1`.
- `app/api/reengajamento/optout/route.ts` — opt-out público por token (HMAC).
- Tabelas: `ReengajamentoEnvio` (log/cooldown), `ReengajamentoOptOut`.
- Coerência: `/api/sofia/alertas` devolve `emailRecente`; o widget abre com "Vi que te mandei um e-mail — bora resolver?".
- LGPD: só agregados da própria artesã; nunca CPF/endereço. Rollout: DRY-RUN (flag off) por padrão.

---

## Sofia — camada de intenção (substitui a busca literal) — atualização manual

A busca literal por palavra-chave (LIKE da frase crua) foi **eliminada** (`lib/sofia/roteador.ts` removido).

- `lib/sofia/intencao.ts` — `classificarIntencao`: a IA (Gemini, JSON estruturado) entende a pergunta e devolve `{acao, parametros, clarificar}`. Conhece os SETORES reais da artesã (mapeia "artes"→"Arte"), a semântica financeira (vencido/vence_hoje/a_vencer/a_pagar/a_receber/pago), status de pedido, período, e usa MEMÓRIA (histórico) para follow-ups ("me mostra elas", "e as vencidas?"). Ambíguo → pergunta curta, nunca "não achei".
- `lib/sofia/ferramentas.ts` — enriquecido: filtro por setor (JOIN na view `PedidoSetorAtual`→`SetorConfig`), setor atual no resultado, `contarPedidos` (+ porSetor), `buscarFinanceiro` semântico, `somaFinanceiro`, `buscarEstoqueBaixo`, período/canal/naoEnviados.
- `app/api/sofia/chat/route.ts` — dispatch por `acao`; `localizar_pedido` responde o setor real + link (sem tutorial); backend executa e monta os links reais; a IA redige por cima. Nunca ecoa a frase como termo de busca.

---

## Sofia — tour guiado por intenção (PARTE 3) — atualização manual

Ao perguntar "como faço X", a Sofia responde em texto E oferece um tour guiado na tela (engine driver.js já existente em `components/SofiaTour.tsx` + `lib/sofia/tours.ts`).

- `tourSugerido` (chat) mapeia a intenção "como faço" → tourId de forma robusta: novo/criar pedido → `criar_primeiro_pedido`; cadastrar produto/material → `precificar_produto`; acompanhar/mover produção → `acompanhar_producao`; loja/vitrine → `montar_loja`. Intenção sem tour → só texto.
- Tours = lista de passos `{ pagina, seletor (data-tour), titulo, texto }`; resiliente (passo sem âncora vira balão centralizado). Novo tour `acompanhar_producao`.
- Âncoras `data-tour` adicionadas no fluxo de novo pedido (`app/dashboard/pedidos`): `pedido-cliente`, `pedido-produto-select`, `pedido-qtd`, `pedido-salvar`, `pedidos-status` (+ `novo-pedido`/`novo-produto`/loja já existentes). Para adicionar um tour novo: 1 entrada em `TOURS` + `data-tour` nos alvos.

---

## Asaas — Pix vira ASSINATURA recorrente (correção) — atualização manual

O Pix nativo criava COBRANÇA AVULSA (POST /payments) → não recorria, não aparecia em "Assinaturas".
Corrigido: `lib/assinatura/pix.ts` (`gerarPixDaAssinatura`) agora cria ASSINATURA via `criarAssinatura`
(POST /v3/subscriptions, billingType PIX, cycle MONTHLY) + snapshot do split na AsaasAssinatura +
guard anti-duplicata (reusa assinatura viva) + `sincronizarCobrancasDaAssinatura` p/ o QR da 1ª cobrança.
O Asaas passa a gerar a cobrança Pix de cada ciclo sozinho (a artesã paga o QR). Cartão já era assinatura
(checkout hospedado RECURRENT, que tokeniza com segurança — PCI no lado do Asaas). Endpoint de assinatura
direta com cartão já existia em `/api/assinatura/assinar`. Acompanhamento via webhooks de COBRANÇA.

---

## Campanha de migração dos 130 (Hotmart→Asaas) — atualização manual

Motor de campanha nível Master. ENVIO REAL TRAVADO até existir o checkout Asaas com cupom
(`CAMPANHA_MIGRACAO_ATIVO=on` + `CAMPANHA_ASAAS_LINK`); sem isso, roda só em DRY-RUN.

- Tabelas: `CampanhaMigracao` (estado pendente/cancelou_hotmart/assinou_asaas/migrada/optout/expirada, cupomAplicadoEm) + `CampanhaMigracaoEnvio` (idempotência 1/dia).
- `lib/campanha/cadencia.ts` — D1–7 diário, D8–14 dia sim/não, D15–28 semanal, >D28 expira.
- `lib/campanha/validacao.ts` — a "inteligência": Asaas (assinatura ativa por e-mail) + Hotmart (`assinaturasPorEmail`, sem ativa=cancelada) → migrada; estados parciais.
- `lib/campanha/emails.ts` — fluxo (cancelar Hotmart + assinar Asaas com cupom), falta_assinar, falta_cancelar, migrada; opt-out (token HMAC); link do Asaas via env.
- `lib/campanha/cupom.ts` — cupom R$20 server-side: whitelist (os 130) + uso único + 1ª assinatura.
- `lib/campanha/seed.ts` — importa o CSV (`CAMPANHA_MIGRACAO_130.csv`) como pendente.
- `lib/campanha/regua.ts` + `app/api/cron/campanha-migracao` (vercel.json 0 11 * * *) — validação + cadência + envio gateado.
- `app/api/campanha/optout` (público) · `app/api/master/campanha` (GET stats · POST semear/dryrun).

## Campanha migração — UX (amostras, pop-up, página /migrar) — atualização manual
- `/api/master/campanha` acao 'amostras' → envia 1 de cada tipo pra juniordel@gmail.com com [AMOSTRA] (não toca na lista).
- Pop-up guiado `components/MigracaoPopup.tsx` + `/api/campanha/meu-status` (gate CAMPANHA_POPUP_ATIVO): passos sincronizados ao estado (cancelou Hotmart ✓ / assinou Asaas ✓), voz Equipe SOA. Montado no app/layout.
- Página `/migrar` + `/api/campanha/migrar`: cria assinatura CARTÃO (29,90) e aplica cupom R$20 na 1ª cobrança (1º mês 9,90) server-side (whitelist, uso único). Cartão via página hospedada do Asaas. É o CAMPANHA_ASAAS_LINK interno.
- Caminho Hotmart corrigido: consumer.hotmart.com → SOA → Configurar pagamento → Cancelar → confirmar (não reembolsa; crédito vem no 1º mês).

## Canais de venda com taxas (flag `moduloCanais` / `canaisLancaFinanceiro` — OFF por padrão)
- `lib/canaisVendaCalc.ts` (PURO, sem prisma) = FONTE ÚNICA importável no client: regras por faixa (Shopee/TikTok), categoria + Clássico/Premium (ML/Amazon), flat; `escolherRegra`, `resolverTaxaLocal`, `calcularLiquido`. `lib/canaisVenda.ts` reexporta + camada de banco (`resolverTaxa`/`criarResolvedorTaxa`).
- **Preço sugerido do produto usa a taxa da fonte única**: com `moduloCanais` ON e canal resolvível, `precificacao/produtos` calcula com a taxa do CatalogoCanal/CanalVenda (faixa/categoria + variante do produto Clássico/Premium + ajuste + Master), não mais a `getTaxa()` hardcoded. ML pelo catálogo usa %+fixo direto (solver de peso só no legado). Canal fora do catálogo (magalu/direta) ou flag OFF → getTaxa legado.
- Tabelas: `CatalogoCanal` (GLOBAL, mantido no Master, com `atualizadoEm`) + `CanalVenda` (workspace: habilitar gerenciado c/ ajuste opcional OU custom). Flags em `Workspace.moduloCanais` e `Workspace.canaisLancaFinanceiro`.
- Master: `/master/canais` + `/api/master/canais-catalogo` (GET/PUT) — a "rotina de atualização"; reflete pra quem usa.
- Artesã: `/precificacao/meus-canais` + `/api/precificacao/canais-venda` (habilitar/ajuste/custom/flags + simulador "quanto sobra por canal"). Aviso de responsabilidade sempre visível. Preço por canal usa `PrecVariacao.canal` existente.
- Concluir pedido (flag `canaisLancaFinanceiro` ON): `app/api/producao/workflow` posta receita PREVISTA líquida (bruto − taxa) na data de recebimento (Pix D+0/cartão D+2); confirmação em massa via `/api/financeiro/lancamentos/confirmar-massa`. Flag OFF = comportamento atual (PAGO bruto) intacto.
- `/api/dashboard/resultado` subtrai `taxasCanal` no lucro quando `moduloCanais` ON.

## Custos fixos & rateio — 2º modelo de precificação (opcional, PrecCustosFixos.ativo = flag)
- Hoje a precificação mostra só **margem de contribuição** (preço − variáveis). Este módulo, quando a artesã liga, rateia os **custos fixos do mês** (aluguel, energia, pró-labore…) por peça → **lucro real**.
- `lib/custosFixos.ts` — tabela `PrecCustosFixos` (por workspace) + 4 métodos de rateio: `unidades` (F÷peças), `horas` (F÷horas × horas da peça), `faturamento` (F÷faturamento = % no denominador), `manual` (R$/peça). `ratearCustoFixo`, `custoFixoDaVenda`, `lucroReal`.
- `/precificacao/custos-fixos` + `/api/precificacao/custos-fixos` (GET config + sugestão do DRE + POST simular; PUT salvar): ativar, custos fixos itemizados (com "puxar do Financeiro"), escolher método (explicação+simulação), % perda.
- `/api/dashboard/resultado`: card **"Lucro real"** = contribuição − custos fixos do mês, quando ativo (`usaCustoFixo`). Link de descoberta em Precificação → Produtos.
- **Preço sugerido embute o custo fixo** (quando ativo): `lib/custosFixosCalc.ts` (puro) é a FONTE ÚNICA — o preço sugerido em Produtos, o simulador e o Resultado usam a mesma `ratearCustoFixo`. unidades/horas/manual → R$ no custo; faturamento → % no denominador. Flag OFF = idêntico ao atual.
- **Campo tempo por peça**: `PrecVariacao.tempoMinutos` (ADD COLUMN idempotente via `lib/precVariacaoTempo.ts`), opcional; usado no rateio por horas e para refinar mão de obra (calculadora grava o tempo). Método `horas` sem tempo → avisa (não ignora). Tooltip: o preço com custo fixo depende do volume estimado.

## Combos ↔ Loja ↔ Pedido/Orçamento (David)
- `lib/comboExpandir.ts` (puro, FONTE ÚNICA): combo = **1 linha de preço** (`precoCombo`) + **componentes** (valor 0) para produção/estoque. `expandirCombo`/`pecasDoCombo`. Total não infla; nada se perde (padrão dos kits).
- **Publicar na Loja**: `PrecCombo.visivelLoja` (+ `lojaColecaoId/lojaOrdem/lojaDestaque`, ADD COLUMN idempotente via `lib/precComboLoja.ts`). Toggle na tela de Combos → `PATCH /api/precificacao/combos/[id]`.
- **Storefront** (`api/loja/[slug]`): branch `tipo:'combo'` (card "De X por Y", imagem do 1º componente). Página pública: card + carrinho com id sintético `combo:<id>`. `loja/[slug]/pedido`: resolve o combo SERVER-SIDE (preço confiável = `precoCombo`) + expande componentes + `Order.valor` → checkout/pagamento fluem sozinhos.
- **Pedido/Orçamento**: GET de combos liberado p/ não-ADMIN. A tela de Pedidos expande os componentes em `camposExtras.produtos[]` ao salvar (peças contadas). Orçamento já selecionava o combo pelo `precoCombo`.
- Taxa de canal aplicada na conclusão (via `canaisLancaFinanceiro`, canal 'Loja'/'Venda Direta').

## Taxas de marketplace: monitoramento semanal por consulta (Shopee, TikTok, ML)
- **Fonte única da taxa** = registro do canal em `CatalogoCanal.regras`, lido por `resolverTaxaLocal`/`escolherRegra` (propaga p/ precificação, simulador, Resultado). O monitoramento NÃO altera preço — só alerta o Master, que revisa e edita o catálogo pelo PUT existente.
- **Monitoramento por CONSULTA** (`lib/canaisMonitor.ts`) — Shopee, TikTok Shop **e Mercado Livre**: tabelas `CanalMonitor` (canal, urlFonte, ultimaVerificacao, hashConteudo, ultimoStatus) e `CanalRevisao` (alerta pendente/resolvido). `verificarCanais()` baixa a página da fonte, compara hash com o último → se mudou, cria REVISÃO pendente. Cron `/api/cron/canais-taxa` (vercel.json `0 8 * * 1`), gate `CANAIS_MONITOR_ATIVO=on` (senão só verifica). `?simular=shopee|tiktokshop|mercadolivre|all`; `?dryRun=1`.
- **URL da fonte editável pelo Master**: `atualizarUrlFonte(canal,url)` (reseta hash/estado → nova linha de base, sem falso alarme). POST `/api/master/canais-revisoes {acao:'salvarUrl',canal,url}`; UI em `/master/canais`.
- **Master**: `/api/master/canais-revisoes` (GET pendentes + monitores; POST `resolver`/`verificarAgora`/`salvarUrl`). Card **"Taxas a revisar (N)"** no dashboard (`/api/master/dashboard?secao=stats` → `taxas_a_revisar`) + painel em `/master/canais` com URL editável, "verificado em DD/MM" e "Verificar agora".
- **ML por API oficial — FUTURO (dormente)**: `lib/mlTaxas.ts` (Listing Prices → `MLTaxaCache` → reescreve `CatalogoCanal.mercadolivre`) e rota `/api/cron/ml-taxas` estão prontos, mas SEM cron ativo. Para ligar: env `ML_ACCESS_TOKEN` (+`ML_SITE_ID`) e re-adicionar o cron no vercel.json. Sem token = fallback (não faz nada).
- Ajuste da artesã (`CanalVenda.overridePercent/overrideFixa`) preservado em todos os caminhos.

## Integração Mercado Livre por conta (OAuth) — taxas reais + sync de pedidos
- **Conexão por workspace** (`lib/mercadolivre/conta.ts`): OAuth authorization code. Tabela `MLConexao` (workspaceId UNIQUE, sellerId, nickname, accessTokenCripto, refreshTokenCripto, tokenExpiraEm, conectado). Tokens **criptografados** (`lib/mercadolivre/cripto.ts`, AES-256-GCM, chave `ML_TOKEN_KEY`||NEXTAUTH_SECRET). `getAccessTokenValido()` renova antes de expirar e **salva o refresh_token rotacionado**. State HMAC carrega o workspaceId (CSRF). Envs: `ML_CLIENT_ID/_CLIENT_SECRET/_REDIRECT_URI`.
- **Rotas** `/api/integracoes/ml/`: `conectar` (redirect ao ML, ADMIN), `callback` (valida state→workspaceId, troca code→tokens), `status`, `desconectar`, `sincronizar` (taxa+pedidos), `webhook` (notificações orders_v2/payments, idempotente, responde 200). UI `/integracoes` (Config→Integrações no menu).
- **Taxa real** (`lib/mercadolivre/taxas.ts`): `refreshTaxasML(ws)` consulta Listing Prices (Bearer do seller) → guarda regras por workspace em `MLTaxaWorkspace` (depende da reputação da conta). `taxaMLWorkspace(ws)` p/ a precificação preferir sobre o catálogo. Sem conexão → fallback catálogo.
- **Pedidos/repasse** (`lib/mercadolivre/pedidos.ts`): `sincronizarPedidosML(ws)` → `GET /orders/search?seller=` → upsert `PedidoMarketplace`/`PedidoMarketplaceItem` (canal 'mercadolivre') idempotente por (workspaceId,canal,idExterno). **Nova coluna `PedidoMarketplaceItem.saleFee`** (comissão real por item). `comissaoLiquida`=Σsale_fee, `liquidoEstimado`=total−Σsale_fee. `MarketplaceConfig.CANAIS` inclui 'mercadolivre'.
- **Pré-requisito (Júnior)**: criar o app/OAuth no ML e por `ML_CLIENT_ID/_CLIENT_SECRET/_REDIRECT_URI` (+`ML_TOKEN_KEY`) no ambiente. Sem isso, a tela mostra "não liberado" e tudo cai no fallback. **Fase 2** (a fazer com conta viva): ligar `taxaMLWorkspace` na leitura da precificação (produtos/simulador) e exibir os pedidos ML na tela "Números do Marketplace" + Recebível/receita líquida.
