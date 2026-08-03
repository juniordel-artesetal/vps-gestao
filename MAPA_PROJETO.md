# MAPA DO PROJETO — VPS Gestão

> Índice AUTO-GERADO de rotas de API, páginas, componentes, libs e tabelas.
> Gerado em 30/07/2026, 22:36:44. Regenerar após adicionar rotas/páginas/tabelas.

**Totais:** 280 rotas de API · 115 páginas · 25 componentes · 108 libs · 145 tabelas

## Rotas de API
- /api/assinatura/assinar  [POST]
- /api/assinatura/cancelar  [POST]
- /api/assinatura/checkout  [POST]
- /api/assinatura/pix  [POST]
- /api/assinatura  [GET]
- /api/assinatura/status  [GET]
- /api/auth/[...nextauth]  []
- /api/auth/recuperar-senha  [POST]
- /api/auth/redefinir-senha  [POST]
- /api/auth/register  [POST]
- /api/auth/trocar-senha  [POST]
- /api/campanha/meu-status  [GET]
- /api/campanha/migrar  [GET, POST]
- /api/campanha/optout  [GET]
- /api/clientes/[id]  [GET, PUT, DELETE]
- /api/clientes/importar  [POST]
- /api/clientes/lote  [POST]
- /api/clientes/match  [POST]
- /api/clientes  [GET, POST]
- /api/clientes/visao-geral  [GET]
- /api/compras/historico  [GET]
- /api/compras/mercado  [POST]
- /api/compras  [GET, POST]
- /api/config/asaas/eventos  [GET, POST]
- /api/config/asaas  [GET, PUT, DELETE]
- /api/config/asaas/testar  [POST]
- /api/config/campos-estoque/[id]  [PUT, DELETE]
- /api/config/campos-estoque  [GET, POST]
- /api/config/campos-pedido/[id]  [PUT, DELETE]
- /api/config/campos-pedido  [GET, POST]
- /api/config/campos/[id]  [GET, PUT, DELETE]
- /api/config/campos/filtros  [GET]
- /api/config/campos  [GET, POST]
- /api/config/campos/todos  [GET]
- /api/config/expedicao  [GET, PUT]
- /api/config/fluxos/[id]  [GET, PUT, DELETE]
- /api/config/fluxos  [GET, POST]
- /api/config/freelancers/[id]/historico  [GET]
- /api/config/freelancers/[id]  [PUT, DELETE]
- /api/config/freelancers  [GET, POST]
- /api/config/geral  [GET, PUT]
- /api/config/loja/atributos/[id]  [PUT, DELETE]
- /api/config/loja/atributos  [GET, POST]
- /api/config/loja/atributos/sugerir  [POST]
- /api/config/loja/colecoes/[id]  [PUT, DELETE]
- /api/config/loja/colecoes  [GET, POST]
- /api/config/loja/imagens/[id]  [GET, PUT, DELETE]
- /api/config/loja/imagens  [GET, POST]
- /api/config/loja/pagamento  [GET, PUT]
- /api/config/loja  [GET, PUT]
- /api/config/loja/variacao-opcoes  [POST]
- /api/config/loja/vitrine/[id]  [PUT]
- /api/config/loja/vitrine  [GET]
- /api/config/loja/vitrine/variacao/[id]  [PUT]
- /api/config/marketplace  [GET, PUT]
- /api/config/producao/[id]  [GET, PUT, DELETE]
- /api/config/producao/reordenar  [POST]
- /api/config/producao  [GET, POST]
- /api/config/usuarios/[id]  [PUT, DELETE]
- /api/config/usuarios  [GET, POST]
- /api/creditos/consumir  [POST]
- /api/creditos/grant  [POST]
- /api/creditos/pacotes  [GET]
- /api/creditos  [GET]
- /api/cron/assinaturas  [POST]
- /api/cron/campanha-migracao  []
- /api/cron/canais-taxa  []
- /api/cron/ml-taxas  []
- /api/cron/reengajamento  []
- /api/dashboard/resultado  [GET]
- /api/dashboard/resumo  [GET]
- /api/demandas/[id]  [GET, PUT, DELETE]
- /api/demandas/config-pagamento  [GET, POST]
- /api/demandas/config  [GET, PUT]
- /api/demandas/freelancers/[id]  [PUT, DELETE]
- /api/demandas/freelancers  [GET, POST]
- /api/demandas/massa  [POST]
- /api/demandas/precos/[id]  [PUT, DELETE]
- /api/demandas/precos  [GET, POST]
- /api/demandas  [GET, POST]
- /api/estoque/config  [GET, PUT]
- /api/estoque/materiais/[materialId]  [GET, PUT, DELETE]
- /api/estoque/materiais/config  [GET, PUT]
- /api/estoque/materiais/movimento  [POST]
- /api/estoque/materiais  [GET, POST]
- /api/estoque/produtos/[variacaoId]/imagem  [GET]
- /api/estoque/produtos/[variacaoId]  [GET, PUT, DELETE]
- /api/estoque/produtos/movimento  [POST]
- /api/estoque/produtos  [GET, POST]
- /api/feedback/[id]  [GET, PUT]
- /api/feedback  [GET, POST]
- /api/financeiro/categorias/[id]  [PUT, DELETE]
- /api/financeiro/categorias  [GET, POST]
- /api/financeiro/fluxo  [GET]
- /api/financeiro/importacao  [POST]
- /api/financeiro/lancamentos/[id]  [GET, PUT, DELETE]
- /api/financeiro/lancamentos/confirmar-massa  [GET, POST]
- /api/financeiro/lancamentos  [GET, POST]
- /api/financeiro/marketplace/baixa  [POST]
- /api/financeiro/marketplace/pedidos/[id]  [GET, PUT]
- /api/financeiro/marketplace/pedidos  [GET]
- /api/financeiro/marketplace/resumo  [GET]
- /api/financeiro/marketplace/vinculos  [GET, POST]
- /api/financeiro/metas  [GET, POST]
- /api/financeiro/resumo  [GET]
- /api/fornecedores/[id]/compras/[compraId]  [PUT, DELETE]
- /api/fornecedores/[id]/compras  [GET, POST]
- /api/fornecedores/[id]  [PUT, DELETE]
- /api/fornecedores  [GET, POST]
- /api/gestao/chat  [GET, POST]
- /api/gestao/chat/titulo  [POST]
- /api/gestao/contexto  [GET]
- /api/gestao/conversas/[id]  [GET]
- /api/gestao/conversas  [GET, POST]
- /api/gestao/dre  [GET]
- /api/health  [GET]
- /api/hotmart/webhook  [POST]
- /api/importacao/auditoria-ia  [POST]
- /api/importacao/criar-por-copia  [POST]
- /api/importacao/depara  [GET, POST]
- /api/importacao/mapear-ia  [POST]
- /api/importacao/pedidos  [POST]
- /api/importacao/pedidos/verificar  [POST]
- /api/importacao/template  [GET]
- /api/integracoes/ml/callback  [GET]
- /api/integracoes/ml/conectar  [GET]
- /api/integracoes/ml/desconectar  [POST]
- /api/integracoes/ml/sincronizar  [POST]
- /api/integracoes/ml/status  [GET]
- /api/integracoes/ml/webhook  [GET, POST]
- /api/leads  [GET, POST]
- /api/loja/[slug]/banner  [GET]
- /api/loja/[slug]/galeria/[variacaoId]  [GET]
- /api/loja/[slug]/imagem/[variacaoId]  [GET]
- /api/loja/[slug]/img/[imagemId]  [GET]
- /api/loja/[slug]/pagamento  [POST]
- /api/loja/[slug]/pedido  [POST]
- /api/loja/[slug]  [GET]
- /api/marketing/banners/[id]  [PUT, DELETE]
- /api/marketing/banners  [GET, POST]
- /api/marketing/noticias/[id]  [PUT, DELETE]
- /api/marketing/noticias  [GET, POST]
- /api/marketing/oportunidades/[id]  [PUT, DELETE]
- /api/marketing/oportunidades  [GET, POST]
- /api/master/assinaturas  [GET, POST]
- /api/master/atendimento/[id]  [GET]
- /api/master/atendimento  [GET]
- /api/master/auth  [POST]
- /api/master/campanha  [GET, POST]
- /api/master/canais-catalogo  [GET, PUT]
- /api/master/canais-revisoes  [GET, POST]
- /api/master/chamados/[id]  [POST, PUT]
- /api/master/dashboard  [GET]
- /api/master/debug/usuario  [GET]
- /api/master/error-logs  [GET, DELETE]
- /api/master/export  [GET]
- /api/master/feedback/[id]  [POST, PUT]
- /api/master/google-drive/callback  [GET]
- /api/master/google-drive/config  [GET, DELETE]
- /api/master/google-drive/iniciar  [GET]
- /api/master/hotmart/assinaturas  [GET]
- /api/master/hotmart/sync  [GET, POST]
- /api/master/impersonar  [POST]
- /api/master/impersonar/sair  [POST]
- /api/master/liberacoes  [GET, DELETE]
- /api/master/mensagens  [GET, POST]
- /api/master/parceiros/[id]  [POST]
- /api/master/parceiros  [GET]
- /api/master/parcerias  [GET]
- /api/master/patrocinados/[id]  [PUT, DELETE]
- /api/master/patrocinados/relatorio  [GET]
- /api/master/patrocinados  [GET, POST]
- /api/master/promocoes/[id]  [PUT, DELETE]
- /api/master/promocoes  [GET, POST]
- /api/master/suporte/regenerar  [GET, POST]
- /api/master/workspaces/[id]  [GET, PUT, PATCH, DELETE]
- /api/master/workspaces/[id]/usuarios/[userid]  [GET]
- /api/master/workspaces  [GET, POST]
- /api/meta/conversion  [POST]
- /api/minha-loja/pedidos  [GET]
- /api/minha-loja/resumo  [GET]
- /api/notificacoes/lidas  [POST]
- /api/notificacoes  [GET]
- /api/onboarding/finalizar  [POST]
- /api/orcamentos/[id]/gerar-link  [POST]
- /api/orcamentos/[id]  [PUT, DELETE]
- /api/orcamentos/aprovacao/[token]  [GET, POST]
- /api/orcamentos  [GET, POST]
- /api/pagamento/webhook/[provedor]  [POST]
- /api/parceira/candidatar  [POST]
- /api/parceira/dashboard  [GET]
- /api/parceira/meu-vinculo  [GET]
- /api/parceira/onboarding  [GET, POST]
- /api/parceira/wallet  [POST]
- /api/pesquisa-preco/alertas  [GET, POST, DELETE]
- /api/pesquisa-preco/clique  [POST]
- /api/pesquisa-preco/comparar  [GET]
- /api/pesquisa-preco  [POST]
- /api/pesquisa-preco/snapshot  []
- /api/precificacao/calcular  [POST]
- /api/precificacao/canais-venda  [GET, POST, PUT, DELETE]
- /api/precificacao/canal-tarifas-ml  [GET, POST]
- /api/precificacao/combos/[id]  [GET, PUT, PATCH, DELETE]
- /api/precificacao/combos  [GET, POST]
- /api/precificacao/config-tributos  [GET, PUT]
- /api/precificacao/custos-fixos  [GET, POST, PUT]
- /api/precificacao/embalagens/[id]  [GET, PUT, DELETE]
- /api/precificacao/embalagens  [GET, POST]
- /api/precificacao/materiais/[id]  [GET, PUT, DELETE]
- /api/precificacao/materiais/importar  [POST]
- /api/precificacao/materiais/lote  [POST]
- /api/precificacao/materiais  [GET, POST]
- /api/precificacao/ncm  [POST]
- /api/precificacao/produtos/[id]/copiar  [POST]
- /api/precificacao/produtos/[id]  [GET, POST, PUT, DELETE]
- /api/precificacao/produtos/importar  [POST]
- /api/precificacao/produtos/lote  [POST]
- /api/precificacao/produtos/massa  [POST]
- /api/precificacao/produtos  [GET, POST]
- /api/precificacao/produtos/sugerir-base  [GET]
- /api/precificacao/variacoes/[id]/[historico]  [GET]
- /api/precificacao/variacoes/[id]  [GET, PUT, DELETE]
- /api/precificacao/variacoes  [GET, POST]
- /api/precificacao/vincular-pedidos  [GET, POST]
- /api/producao/campos-valores  [GET, POST]
- /api/producao/demandas/[id]  [GET]
- /api/producao/demandas  [GET]
- /api/producao/historico/[pedidoId]  [GET]
- /api/producao/pedidos/[id]/pagamento  [GET, PUT]
- /api/producao/pedidos/[id]  [GET, PUT, DELETE]
- /api/producao/pedidos/consulta  [GET]
- /api/producao/pedidos/importar  [POST]
- /api/producao/pedidos  [GET, POST]
- /api/producao/resumo  [GET]
- /api/producao/setores  [GET, POST]
- /api/producao/workflow/[pedidoId]  [GET]
- /api/producao/workflow  [GET, POST, PUT]
- /api/promocoes/clique  [GET]
- /api/promocoes/imagem  [GET]
- /api/promocoes/listar  [GET]
- /api/promocoes/servir  [GET]
- /api/reengajamento/optout  [GET]
- /api/sofia/alertas  [GET]
- /api/sofia/chat  [POST]
- /api/sofia/config  [GET, PUT]
- /api/sofia/contexto  [GET]
- /api/suporte/anexo-video  [GET, POST]
- /api/suporte/anexo/[id]  [GET]
- /api/suporte/chamado  [GET, POST]
- /api/suporte/chat  [GET, POST]
- /api/suporte/faq/[id]  [GET]
- /api/suporte/faq  [GET, POST]
- /api/suporte/feedback  [GET]
- /api/suporte/mensagens  [GET, POST]
- /api/tarefas/[id]/anexo/[anexoId]  [GET, DELETE]
- /api/tarefas/[id]/anexos  [POST]
- /api/tarefas/[id]/checklists  [POST]
- /api/tarefas/[id]/comentarios  [POST]
- /api/tarefas/[id]/etiquetas  [POST, DELETE]
- /api/tarefas/[id]  [GET, PUT, DELETE]
- /api/tarefas/[id]/vinculos  [GET, POST, DELETE]
- /api/tarefas/agenda  [GET]
- /api/tarefas/buscar-vinculo  [GET]
- /api/tarefas/checklists/[checklistId]/itens/[itemId]  [PUT, DELETE]
- /api/tarefas/checklists/[checklistId]  [POST, PUT, DELETE]
- /api/tarefas/colunas/[id]  [PUT, DELETE]
- /api/tarefas/colunas/reordenar  [POST]
- /api/tarefas/colunas  [POST]
- /api/tarefas/etiquetas/[id]  [PUT, DELETE]
- /api/tarefas/etiquetas  [GET, POST]
- /api/tarefas/feed  [GET]
- /api/tarefas/minhas  [GET]
- /api/tarefas/mover  [POST]
- /api/tarefas/por-referencia  [GET]
- /api/tarefas/quadros/[id]  [PUT, DELETE]
- /api/tarefas/quadros  [GET, POST]
- /api/tarefas/resumo  [GET]
- /api/tarefas  [GET, POST]
- /api/telegram/bot  [POST]
- /api/webhooks/asaas  [POST]

## Páginas
- /15dias
- /30dias
- /assinatura/concluido
- /assinatura
- /clientes/[id]
- /clientes
- /clientes/visao-geral
- /compras/historico
- /compras
- /compras/visao
- /config/campos-estoque
- /config/campos-pedido
- /config/expedicao
- /config/fluxos
- /config/freelancers
- /config/geral
- /config/loja/pagamento
- /config/loja
- /config/loja/vitrine
- /config/producao
- /config/usuarios
- /creditos/historico
- /creditos
- /creditos/saldos
- /dashboard/calendario
- /dashboard/demandas
- /dashboard/estoque
- /dashboard/lacos
- /dashboard/orcamentos
- /dashboard
- /dashboard/painel
- /dashboard/pedidos/[id]
- /dashboard/pedidos/[id]/print
- /dashboard/pedidos/[id]/qr
- /dashboard/pedidos
- /dashboard/pedidos/print
- /dashboard/setor/[id]
- /demandas/config-pagamento
- /demandas/freelancers
- /demandas/historico
- /demandas
- /demandas/precos
- /financeiro/categorias
- /financeiro/fluxo
- /financeiro/lancamentos
- /financeiro/marketplace
- /financeiro/metas
- /financeiro
- /gestao/dre
- /gestao
- /integracoes
- /landing
- /login
- /loja/[slug]
- /master/asaas
- /master/assinantes
- /master/assinaturas
- /master/atendimento
- /master/canais
- /master/feedback
- /master/google-drive
- /master/hotmart
- /master/leads
- /master/login
- /master/logs
- /master/marketing
- /master
- /master/parceiros
- /master/parcerias
- /master/patrocinados
- /master/promocoes
- /megaartesanal
- /megaartesanal/sorteio
- /migrar
- /minha-loja
- /minha-loja/pedidos
- /modulos
- /obrigado
- /orcamento/[token]
- /
- /parceira/candidatar
- /parceira
- /pesquisa-preco
- /precificacao/calcular
- /precificacao/canais
- /precificacao/combos
- /precificacao/config-tributos
- /precificacao/custos-fixos
- /precificacao/embalagens
- /precificacao/estoque-materiais
- /precificacao/fornecedores
- /precificacao/materiais
- /precificacao/meus-canais
- /precificacao/oraculo
- /precificacao
- /precificacao/produtos
- /precificacao/skus
- /precificacao/vincular-pedidos
- /primeiros-passos
- /promocoes
- /redefinir-senha
- /register
- /seja-parceira
- /setup
- /suporte/admin/faq
- /suporte/feedback
- /suporte
- /tarefas/[quadroId]
- /tarefas/atividades
- /tarefas/calendario
- /tarefas/minhas
- /tarefas
- /tarefas/quadros/[quadroId]
- /tarefas/quadros
- /trocar-senha

## Componentes
- components/AppShell.tsx
- components/AppShellClient.tsx
- components/CanalBadge.tsx
- components/DarkModeToggle.tsx
- components/GuardaAssinatura.tsx
- components/ImpersonationBanner.tsx
- components/LandingTrial.tsx
- components/MapeamentoColunas.tsx
- components/MenuPosContext.tsx
- components/MetaPixel.tsx
- components/MigracaoPopup.tsx
- components/ModalImportacao.tsx
- components/ModalImportacaoClientes.tsx
- components/ModalImportacaoFinanceiro.tsx
- components/ModalImportacaoMateriais.tsx
- components/ModalImportacaoProdutos.tsx
- components/NovidadesPopup.tsx
- components/OrdenarPedidos.tsx
- components/OrigemSelect.tsx
- components/ScannerPedido.tsx
- components/SessionProviderWrapper.tsx
- components/Sidebar.tsx
- components/SofiaTour.tsx
- components/SofiaWidget.tsx
- components/ThemeLoader.tsx

## Libs
- lib/alert.ts
- lib/assinatura/acesso.ts
- lib/assinatura/anomalia.ts
- lib/assinatura/avisos.ts
- lib/assinatura/cancelar.ts
- lib/assinatura/checkout.ts
- lib/assinatura/cpf.ts
- lib/assinatura/index.ts
- lib/assinatura/notificaInterna.ts
- lib/assinatura/parceiro.ts
- lib/assinatura/pix.ts
- lib/assinatura/planos.ts
- lib/assinatura/regua.ts
- lib/assinatura/template.ts
- lib/auth.ts
- lib/baixarEstoqueMaterial.ts
- lib/campanha/cadencia.ts
- lib/campanha/cupom.ts
- lib/campanha/emails.ts
- lib/campanha/identidade.ts
- lib/campanha/regua.ts
- lib/campanha/seed.ts
- lib/campanha/validacao.ts
- lib/canais.ts
- lib/canaisMonitor.ts
- lib/canaisVenda.ts
- lib/canaisVendaCalc.ts
- lib/canalTarifasMlSchema.ts
- lib/canalVisual.ts
- lib/comboExpandir.ts
- lib/compras.ts
- lib/copiarProduto.ts
- lib/creditos.ts
- lib/custosFixos.ts
- lib/custosFixosCalc.ts
- lib/data.ts
- lib/dbRetry.ts
- lib/depoimentos.ts
- lib/errorLog.ts
- lib/finContas.ts
- lib/googledrive/cripto.ts
- lib/googledrive/index.ts
- lib/hotmart/index.ts
- lib/indicePrecos.ts
- lib/landingMeta.ts
- lib/lojaAtributos.ts
- lib/lojaGaleria.ts
- lib/mapeamentoImport.ts
- lib/margem.ts
- lib/marketplaceSchema.ts
- lib/matchVariacao.ts
- lib/mercadolivre/conta.ts
- lib/mercadolivre/cripto.ts
- lib/mercadolivre/pedidos.ts
- lib/mercadolivre/taxas.ts
- lib/mlTaxas.ts
- lib/normNome.ts
- lib/orcamentoTotal.ts
- lib/ordenacaoPedidos.ts
- lib/pagamento/asaas/client.ts
- lib/pagamento/asaas/config.ts
- lib/pagamento/asaas/cripto.ts
- lib/pagamento/asaas/index.ts
- lib/pagamento/asaas/mascarar.ts
- lib/pagamento/asaas/tipos.ts
- lib/pagamento/asaas/webhook.ts
- lib/pagamento/index.ts
- lib/pagamento/mercadopago.ts
- lib/pagamento/pix.ts
- lib/parceiras/atribuicao.ts
- lib/parceiras/candidatura.ts
- lib/parceiras/emails.ts
- lib/parceiras/notificacoes.ts
- lib/parceiras/onboarding.ts
- lib/parceiras/resumoSemanal.ts
- lib/parceiras/sessao.ts
- lib/parceiras/split.ts
- lib/parceiros/distribuidores.ts
- lib/precComboLoja.ts
- lib/precVariacaoTempo.ts
- lib/precoTecido.ts
- lib/prisma.ts
- lib/promocoesSchema.ts
- lib/reconciliarVinculos.ts
- lib/reengajamento.ts
- lib/segmentos.ts
- lib/serialize.ts
- lib/sofia/alertas.ts
- lib/sofia/ferramentas.ts
- lib/sofia/intencao.ts
- lib/sofia/menuPos.ts
- lib/sofia/menuPosTipos.ts
- lib/sofia/persona.ts
- lib/sofia/regras.ts
- lib/sofia/tours.ts
- lib/statusPedido.ts
- lib/suporte/base/clientes-tarefas.ts
- lib/suporte/base/config-demandas.ts
- lib/suporte/base/financeiro.ts
- lib/suporte/base/loja.ts
- lib/suporte/base/precificacao.ts
- lib/suporte/base/producao.ts
- lib/suporte/baseConhecimento.ts
- lib/suporte/recuperar.ts
- lib/suporte/regua.ts
- lib/suporte/tipos.ts
- lib/theme.ts
- lib/versao.ts

## Tabelas do banco (Postgres/Neon)
- AiConversa
- AiUsageLog
- AsaasAssinatura
- AsaasCliente
- AsaasCobranca
- AsaasConfig
- AsaasWebhookEvento
- AssinaturaAviso
- CampanhaMigracao
- CampanhaMigracaoEnvio
- CanalMonitor
- CanalRevisao
- CanalTarifaML
- CanalVenda
- CatalogoCanal
- Cliente
- ClienteContato
- ClienteEndereco
- CompraItem
- CreditoMovimento
- CreditoPacote
- CreditoSaldo
- Demanda
- DemandaChecklist
- DemandaConfigPagamento
- DemandaItem
- DemandaPedido
- DemandaPreco
- DistribuidorProduto
- DistribuidorPromocao
- Envio
- ErrorLog
- EstCampoConfig
- EstCampoValor
- EstMaterialMovimento
- EstMaterialSaldo
- EstProdutoMovimento
- EstProdutoSaldo
- EstoqueMaterial
- EstoqueMaterialMovimento
- ExpedicaoConfig
- Feedback
- FinCategoria
- FinLancamento
- FinMeta
- FluxoModelo
- FluxoModeloSetor
- Fornecedor
- FornecedorCompra
- Freelancer
- GoogleDriveConfig
- HotmartAssinatura
- HotmartEvent
- ImpersonationLog
- IntegracaoLoja
- LacosAjuste
- LacosEntrada
- Lead
- LoginHistory
- LogisticaConfig
- LojaAtributo
- LojaAtributoOpcao
- LojaColecao
- LojaConfig
- LojaImagem
- LojaPagamentoConfig
- LojaVariacaoOpcao
- MLConexao
- MLTaxaCache
- MLTaxaWorkspace
- MarketingBanner
- MarketingNoticia
- MarketingOportunidade
- MarketplaceConfig
- MarketplaceProdutoVinculo
- Notificacao
- Orcamento
- OrcamentoItem
- Order
- Pagamento
- Parceiro
- ParceiroAuth
- ParceiroAviso
- ParceiroClique
- ParceiroComissao
- PedidoCampoConfig
- PedidoHistorico
- PedidoMarketplace
- PedidoMarketplaceItem
- PedidoSetor
- PesquisaAlerta
- PesquisaAnuncioEvento
- PesquisaLog
- PesquisaPatrocinado
- PrecCombo
- PrecComboItem
- PrecConfigTributaria
- PrecCustosFixos
- PrecEmbalagem
- PrecEmbalagemItem
- PrecKitItem
- PrecMaterial
- PrecMaterialItem
- PrecProduto
- PrecVariacao
- PrecVariacaoHistorico
- PrecoIndiceSnapshot
- ProcessoConfig
- PromocaoExibicao
- Recebivel
- ReengajamentoEnvio
- ReengajamentoOptOut
- Setor
- SetorCampo
- SetorCampoValor
- SetorConfig
- SofiaConfig
- SuporteChamado
- SuporteConhecimento
- SuporteFaq
- SuporteFeedback
- SuporteMensagem
- Tarefa
- TarefaAnexo
- TarefaChecklist
- TarefaChecklistItem
- TarefaColuna
- TarefaComentario
- TarefaEtiqueta
- TarefaEtiquetaLink
- TarefaHistorico
- TarefaQuadro
- TarefaVinculo
- User
- UserSetor
- VpsDepoimento
- VpsIndicacao
- VpsStars
- VpsStarsLog
- VpsStarsPremio
- VpsStarsResgate
- WhatsappConfig
- WorkItem
- Workspace
- WorkspaceTheme

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

## Plano de contas gerenciais (conta > subconta) — Tacianne
- **Hierarquia em FinCategoria** (`lib/finContas.ts`): colunas aditivas `parentId` (null=conta, setado=subconta), `padrao`, `ordem`, `grupoDRE`; flag `Workspace.moduloContasGerenciais`. `semearPlanoContas(ws)` semeia o plano padrão idempotente (5 contas / 14 subcontas: RECEITAS operacionais/não-op; DESPESAS Custo da mercadoria/Administrativas/Financeiras) e liga o módulo. `listarPlano(ws,tipo?)` devolve árvore. `setModulo`/`moduloAtivo`.
- **Rota** `/api/financeiro/categorias`: `GET ?arvore=1` → {contas[], modulo}; `POST {acao:'semear'}` (semeia+ativa), `{acao:'modulo',ativo}`, ou cria conta/subconta (`parentId` valida pai mesmo tipo, herda grupoDRE). Flat GET mantido (compat).
- **Lançamento** (`app/financeiro/lancamentos`): quando o módulo está on, o select de categoria vira **Conta + Subconta** (categoriaId = subconta, ou "conta toda"); senão mantém o select flat. Lançamentos antigos (categoria flat / nome livre) continuam válidos.
- **DRE** (`/api/gestao/dre`): novo `porConta[]` (conta→subcontas com totais) agrupando por `parentId`+`grupoDRE`; CMV vem do `grupoDRE='cmv'` quando o plano existe (senão heurística de palavra-chave antiga). Lançamento sem categoria fica fora do agrupamento (não quebra).
- Tela de categorias: banner "Criar plano padrão" enquanto não há hierarquia.

## Pedido de compra (contas a pagar + custo do material + estoque) — Tacianne
- **1 ação → 3 efeitos** (`lib/compras.ts`, idempotente por referência=compraId). Tabela `CompraItem` (linhas ligadas a `PrecMaterial`) + `FornecedorCompra.status` (cabeçalho reusado) + flag `Workspace.moduloCompras`.
- `concluirPedidoCompra(ws, {fornecedorId, data, itens[], darEntrada, contasPagar})`:
  - (a) **Contas a pagar**: `FinLancamento` DESPESA/PENDENTE, `data`=vencimento, parcelas (valor/N, `recorrenciaId`, vencimentos +i meses), `categoriaId` do plano de contas, `referencia`=compraId (não duplica).
  - (b) **Custo do material** (opcional por item): atualiza `PrecMaterial.precoUnidade`=precoPacote/qtdPacote e faz **resync (delta)** em `PrecMaterialItem.custoUnit` + `PrecVariacao.custoMaterial/custoTotal` — reflete nos produtos que usam o material, preservando mão de obra. (`resyncCustoMaterial`.)
  - (c) **Estoque**: `darEntradaEstoqueMaterial` (tipo `ENTRADA_COMPRA`, un = pacotes×un/pacote) em `EstMaterialSaldo`/`EstMaterialMovimento`, **idempotente por (referencia, materialId)**.
- Rota `/api/compras`: GET {modulo}; POST `{acao:'ativar'}` ou pedido de compra (ADMIN). Tela `/compras` (fragmentação pacote/unidade; pergunta "custo mudou R$X→R$Y?" por item; vencimento/forma/parcelas). Atalho na home do Financeiro.
- Recusar a atualização de custo → só gera contas a pagar (+estoque se marcado). Snapshot do custo NÃO propagava sozinho; o resync é a peça nova.

## Lojas no nível do PRODUTO (propaga/precifica por canal) — Tacianne
- Botão **"🏪 Lojas"** no card do produto (`app/precificacao/produtos/page.tsx`) abre o modal (reaproveita o "criar em massa", que estava órfão) **pré-marcando os canais atuais** do produto.
- **Aplicar lojas**: para cada loja marcada × cada **variante-base** (agrupada por `nome`+`qtdKit`), cria a config daquele canal se faltar. `precoParaCanal()`: quando a base tem preço, **preserva o líquido (take-home) do marketplace e reajusta pela taxa do canal alvo** (mesma ordem de grandeza do original, POR KIT — nunca preço por unidade); sem preço-base → sugerido saudável 30%. Preserva impostos/desconto/promoção. Loja **desmarcada → remove** as configs (com confirmação).
- Reusa `POST /api/precificacao/variacoes` (copia nome/peso/embalagemIds/custosAdicionais/tempoMinutos/materiais) e `DELETE /variacoes/[id]` em lote (Promise.all). Idempotente: re-marcar o canal atual não duplica. Aditivo — não quebra quem já configurou por variação.

## Selo/legenda do canal (CanalBadge) — consistente no sistema
- `lib/canalVisual.ts` `canalVisual(canal, sub?, labelCustom?)` → `{ label, emoji, classe }` (cores Tailwind ESTÁTICAS, dark-aware). Robusto a slug ('shopee','ml','tiktok'…) e nome completo ('Mercado Livre','Venda Direta'). Canal custom → nome + cinza.
- `components/CanalBadge.tsx` — badge colorido (ícone + nome). Usado em: tabela de configs e editor da precificação (`app/precificacao/produtos/page.tsx`, nova coluna "Canal") e na lista de pedidos (`app/dashboard/pedidos/page.tsx`). Filtro por canal já existia (fCanal). Só visual — não muda cálculo.

## Multi-canal: consistência do preço + peso do ML (fix)
- **Causa**: no editor, ML no solver legado SEM peso → `solvePrecoML` retorna `custo/denom` sem a taxa fixa (peso×preço) → sugestões minúsculas (ex.: kit48 R$0,83/1,10/1,62). A lista usava `getTaxa` (ML fixo=0), divergindo do editor.
- **Fix (fonte única `taxaDoCanal`)**: peso-aware — catálogo/CanalVenda quando módulo on; ML legado com peso → `lookupTaxaFixaML(peso, preco)`. Usada na LISTA (lucro), no EDITOR (sugestões) e na propagação.
- **ML sem peso → SEGURA a sugestão** (`mlSemPeso` → baixo/saudável/alto = null, cards mostram "—" + aviso "cadastre o peso"), em vez de preço quebrado. Com peso → taxa fixa real por faixa → preço coerente (kit48 saudável ~R$13,13). Shopee/TikTok não dependem de peso — intactos.

## Importação financeira: corrige criação de categoria + idempotência (fix)
- **Causa (bug latente, NÃO regressão do plano de contas)**: em `/api/financeiro/importacao`, ao criar categoria nova, o INSERT referenciava `createdAt`/`updatedAt` — colunas que `FinCategoria` NUNCA teve → `column "createdAt" does not exist` → toda linha com categoria nova caía no catch (erro silencioso). Presente desde o commit original da importação.
- **Fix**: INSERT de `FinCategoria` sem `createdAt`/`updatedAt` (alinha com a tabela; parentId/padrao/ordem/grupoDRE têm default). `categoriaId` já era nullable → conta gerencial é OPCIONAL na importação. Idempotência: dedup por (workspaceId, tipo, data, valor, descrição) → re-import não duplica (conta "duplicados"). Resposta e modal mostram **Importados · Já existiam · Erros · Total** (sem descarte silencioso).

## Importação financeira (fix 2): formato Entrada/Saída + navegação de mês
- **Diagnóstico**: workspace da Tacianne com 0 lançamentos (importava mas nada entrava). Mecanismo OK (outros workspaces importaram). Duas causas: (a) planilha "entrada e saída" costuma ter colunas SEPARADAS Entrada/Saída (sem coluna Tipo) → `map['tipo']` vazio → toda linha caía em "Tipo inválido"; (b) quando importa em outro mês, a tela (que abre no mês atual) não mostrava → parecia "sumiu".
- **Fix (a)**: `/api/financeiro/importacao` aceita o formato fluxo de caixa — colunas Entrada/Saída (ou receita/despesa, crédito/débito) derivam tipo+valor quando não há coluna Tipo. Formato clássico (Tipo+Valor) intacto.
- **Fix (b)**: resposta traz `primeiroMes`/`meses`; após importar, a tela de Lançamentos **navega até o 1º mês importado** e o modal mostra "importados em: [meses]". Nada some silenciosamente.

## Módulo COMPRAS (Supply) — grupo próprio no menu
- **Grupo "Compras"** no Sidebar (gated por `moduloCompras`, lido de `/api/compras`): **Fornecedores · Pesquisar preço · Pedido de compra · Histórico de compras**. Fornecedores saiu da Precificação; "Pesquisar preço" saiu de "Assistente de Compras" (grupo removido) — só mudou o lugar do menu (rotas `/precificacao/fornecedores` e `/pesquisa-preco` intactas; vínculo material↔fornecedor preservado). Card "Compras" no hub `/modulos`.
- **Histórico** `/compras/historico` + `/api/compras/historico`: itens comprados (fornecedor, material, qtd, preço/un, subtotal, data) com filtros (fornecedor/material/período), **evolução de preço por material** (subiu/baixou), **resumo** (total, top fornecedores/materiais) e vínculo às **contas a pagar** (FinLancamento por referencia=compraId, pendente/quitado).
- **Comparação de mercado ("boa compra")**: `/api/compras/mercado` (reusa `calcularIndice` do índice crowd) → no Pedido de compra e no Histórico, compara o preço/un pago com o mercado: "Boa compra ✅ / Na média / Acima da média ⚠️".
- Integração intacta (mesma lib `lib/compras.ts`): estoque (entrada), financeiro (contas a pagar), precificação (custo do material + resync).

## Reorg de menu (Michelle) + Compras Visão geral
- **Financeiro** reúne a gestão: Visão Geral · Entradas e Saídas · Caixa Diário · Metas · Categorias · (Números do Marketplace, se ativo) · **DRE** (`/gestao/dre`, mesma tela) · **Análise IA** (`/gestao`, movida do topo — grupo "Análise do Negócio" removido).
- **Créditos** ocultado do menu por padrão (grupo mantém-se no código; `hidden: !mostrarCreditos`). Reversível pela flag `moduloCreditos` (lida via `config/geral` GET com `to_jsonb` tolerante — não quebra se a coluna não existir). Feature/dados intactos.
- **Compras** ganhou **Visão geral** (`/compras/visao`): volume comprado no período, nº de compras/itens, fornecedor top, material que mais pesa, ranking por fornecedor/material e evolução de preço — período selecionável (30/90/365 dias/tudo). Reusa `/api/compras/historico` (fonte única, sem duplicar query). **Ofertas & Cupons** (`/promocoes`) movida pra dentro de Compras; grupo "ofertas" standalone fica como fallback só quando o módulo Compras está OFF.
- Telas `/promocoes` e `/creditos` (+ APIs, `lib/creditos`, `lib/parceiros/distribuidores`) trazidas pro branch de deploy (tabelas já existentes no Neon).

## Ofertas & Cupons — vitrine de parceiros (publicação Master + Compras)
- **Publicação (Master)**: `/master/promocoes` (+ `/api/master/promocoes` GET/POST, `/api/master/promocoes/[id]` PUT/DELETE) — cria/edita/publica oferta com **logo** (upload+compressão client-side, coluna `imagem`, on-demand), **desconto** (badge), título, descrição, link, cupom, ativo, ordem (prioridade), validade (dataInicio/dataFim). Guarda master via cookie `master_token`. Digita o **nome do parceiro** → find-or-create leve de `Parceiro` (tipo='distribuidor', status='aprovada'). Link no header do `/master/marketing`.
- **Vitrine (artesã)**: `/promocoes` (em Compras → Ofertas & Cupons) — grid **3/2/1** de cards: logo, badge de desconto, título, descrição, "Aproveitar oferta" (nova aba, rel nofollow, clique contado via `/api/promocoes/clique`), "copiar cupom". Só ativas e no período; ordenadas por prioridade. `/api/promocoes/listar` expõe `desconto`; `/api/promocoes/imagem?id=` serve a logo on-demand.
- Schema: `lib/promocoesSchema.ts` (`ensurePromocoesSchema` — ADD COLUMN IF NOT EXISTS "desconto"). Reusa `DistribuidorPromocao`/`Parceiro` existentes (não duplica).

## Sofia 3.0 — expert financeira + domínio das novidades (atualização manual)
- **Ferramentas financeiras** (`lib/sofia/ferramentasFinanceiro.ts`, read-only, workspace-scoped, regra realizada=PAGO que reconcilia com a Visão Geral): `resumoFinanceiro` (P&L do mês + mês anterior + saldo caixa + ticket), `maioresDespesas`, `metaDoMes`, `dreResumo` (CMV/margem de contribuição), `gerarConselhos` (proativos, base no dado real; nunca promete resultado).
- **Intenção** (`lib/sofia/intencao.ts`): novas ações `resumo_financeiro`, `maiores_despesas`, `meta`, `dre`, `conselho`. Fix crítico: `thinkingConfig.thinkingBudget=0` (o Gemini 2.5 gastava tokens pensando e estourava antes do JSON → intenção null intermitente) + extração tolerante de JSON + 1 retry.
- **Dispatch** (`app/api/sofia/chat/route.ts`): responde número real + 1 frase de interpretação + deep-link (via `resultados`).
- **KB** (`lib/suporte/base/compras.ts`): módulo Compras (visão geral, pedido 3-em-1, histórico, ofertas) no padrão-ouro; regenerar via `/api/master/suporte/regenerar`.
- **Bateria versionada**: `scripts/bateria-sofia.mjs` (49 casos de roteamento; rodar a cada evolução). `AUDITORIA_FUNCIONALIDADES.md` = pente-fino das novidades.

## Marketplace → Fluxo de caixa (recebível vira receita líquida) — fix
- **Problema:** módulo Marketplace ativo criava só `Recebivel` (previsão), nunca `FinLancamento` → dinheiro invisível no fluxo de caixa. (Repro: 22 workspaces ativos, todos com 0 FinLancamento p/ pedidos com recebível.)
- **Fix** (`lib/marketplace/recebivelFluxo.ts`): `sincronizarReceitaRecebivel(ws, orderId)` espelha o recebível no caixa — **previsto** (enviado, com data) → RECEITA **PENDENTE** na data prevista, valor = **líquido** (`valorLiquidoEstimado` = venda − taxas); **recebido** (baixa) → o MESMO lançamento vira **PAGO**. Idempotente por `referencia=orderId` + marcador `[mkt-auto]`.
- **Gatilhos**: workflow (`Recebivel→previsto`), baixa em lote (`→recebido`, RETURNING orderId), PUT manual `marketplace/pedidos/[id]`. **Fonte única / anti-duplicidade**: o `[saldo-auto]` do workflow NÃO cria receita quando o pedido tem recebível.
- **Backfill** disponível (`backfillReceitasRecebivel`) mas **não** aplicado ao histórico (decisão: só daqui pra frente). Reconcilia com Visão Geral/Entradas e Saídas.

## Copiar embalagem (espelha copiar produto)
- **POST `/api/precificacao/embalagens/[id]/copiar`**: duplica `PrecEmbalagem` + `PrecEmbalagemItem` (nome "X (cópia)"), escopado ao workspace, cópia independente. Botão "📋 Copiar" em cada embalagem (ao lado de Editar/Excluir), espelhando o copiar de produto.
