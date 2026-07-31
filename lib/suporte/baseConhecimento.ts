// Base de conhecimento do suporte — gerada A PARTIR DAS TELAS REAIS em produção.
// Fonte da regeneração idempotente de SuporteConhecimento (upsert por slug).
// Cobre SÓ o que está em produção. Ao subir novos módulos, adicionar entradas e regerar.

import { EntradaConhecimento } from './tipos'
import { ENTRADAS as fPrecificacao } from './base/precificacao'
import { ENTRADAS as fProducao } from './base/producao'
import { ENTRADAS as fFinanceiro } from './base/financeiro'
import { ENTRADAS as fLoja } from './base/loja'
import { ENTRADAS as fClientesTarefas } from './base/clientes-tarefas'
import { ENTRADAS as fConfigDemandas } from './base/config-demandas'
import { ENTRADAS as fCompras } from './base/compras'

// Entradas moderadas antigas — mantidas para cobertura granular (ex.: importação passo a passo).
// Os fragmentos gold-standard SOBRESCREVEM por slug quando há colisão.
const ANTIGAS: EntradaConhecimento[] = [
  // ───────────────────────── CLIENTES ─────────────────────────
  {
    slug: 'clientes-lista', modulo: 'Clientes', tela: 'Lista de Clientes', caminho: 'Clientes → Clientes',
    palavrasChave: 'clientes, lista de clientes, buscar cliente, procurar, filtrar, ordenar, ativos, inativos, importado, valor total, paginação',
    conteudo: 'O que faz: mostra todos os clientes cadastrados com telefone, e-mail, quantos pedidos fez e o valor total gasto; no topo os cartões "Total de clientes" e "Ativos".\nComo usar:\n1. No menu, abra Clientes → Clientes.\n2. Use a busca (nome, e-mail, telefone).\n3. Filtre por status (Todos/Ativos/Inativos) e ordene (Nome, Mais pedidos, Maior valor, Mais recentes).\n4. Clique no nome para abrir a ficha.\nDúvidas: "importado" = veio de planilha; a coluna "importados" (amarelo) são pedidos da planilha antiga, diferente de "Pedidos" (registrados no SOA). Mostra 30 por página.',
  },
  {
    slug: 'clientes-cadastrar', modulo: 'Clientes', tela: 'Cadastrar/editar cliente', caminho: 'Clientes → Clientes → "Novo cliente"',
    palavrasChave: 'novo cliente, cadastrar, adicionar cliente, editar, contato, endereço, cpf, cnpj, origem, principal, observações',
    conteudo: 'O que faz: janela para cadastrar/editar cliente com nome, documento, origem, e-mail, telefone, contatos, endereços e observações.\nComo usar:\n1. Clique "Novo cliente" (ou no lápis para editar).\n2. Preencha o Nome (único obrigatório).\n3. Opcional: documento, origem, e-mail, telefone.\n4. Em "Contatos adicionais"/"Endereços", clique "+ Contato"/"+ Endereço" e marque um como "principal".\n5. Salvar.\nDúvidas: sem nome não salva. Só um contato/endereço pode ser principal.',
  },
  {
    slug: 'clientes-massa', modulo: 'Clientes', tela: 'Ações em massa (ativar/inativar/excluir)', caminho: 'Clientes → Clientes → caixinhas de seleção',
    palavrasChave: 'selecionar vários, ações em massa, ativar lote, inativar, excluir vários, apagar clientes, marcar todos',
    conteudo: 'O que faz: seleciona vários clientes e aplica Ativar, Inativar ou Excluir de uma vez.\nComo usar:\n1. Marque a caixinha de cada cliente (ou "Selecionar todos desta página").\n2. Na barra laranja, clique Ativar/Inativar/Excluir e confirme.\nDúvidas: Excluir NÃO apaga os pedidos (só desvincula), mas é definitivo. Inativar preserva tudo e só tira das listas ativas. Trocar de página limpa a seleção.',
  },
  {
    slug: 'clientes-importar', modulo: 'Clientes', tela: 'Importar clientes de planilha', caminho: 'Clientes → Clientes → "Importar planilha"',
    palavrasChave: 'importar clientes, planilha, xlsx, excel, csv, modelo, baixar modelo, duplicados, mapear colunas, migrar',
    conteudo: 'O que faz: cadastra vários clientes de uma planilha (.xlsx/.xls/.csv), até 2000 por vez; se as colunas forem diferentes, uma IA ajuda a mapear.\nComo usar:\n1. Clique "Importar planilha".\n2. "Baixar modelo" (colunas: Nome, Email, Telefone, Cidade, Último pedido, Status, Total de pedidos, Finalizados, Em aberto).\n3. Arraste o arquivo; confira o mapeamento sugerido e "Continuar".\n4. Na prévia veja novos x já existentes e "Importar".\nDúvidas: não duplica (detecta por e-mail, ou nome+telefone). Só o Nome é obrigatório.',
  },
  {
    slug: 'clientes-ficha', modulo: 'Clientes', tela: 'Ficha do cliente (dados, contatos, endereços)', caminho: 'Clientes → Clientes → clicar no cliente',
    palavrasChave: 'ficha, dados do cliente, editar, contatos, endereços, tags, etiquetas, observações, cliente ativo, whatsapp, instagram',
    conteudo: 'O que faz: ficha completa em abas. Em Dados edita nome, documento, origem, contato, tags e observações e marca "Cliente ativo". Em Contatos/Endereços adiciona vários (marcando principal).\nComo usar:\n1. Clique no cliente.\n2. Aba Dados: edite e use tags (etiquetas livres, ex.: vip, atacado).\n3. Abas Contatos/Endereços: "Adicionar".\n4. Salvar (topo).',
  },
  {
    slug: 'clientes-historico', modulo: 'Clientes', tela: 'Histórico e resumo do cliente', caminho: 'Clientes → cliente → abas Histórico e Resumo',
    palavrasChave: 'histórico do cliente, pedidos do cliente, resumo, métricas, ticket médio, valor total, histórico importado, financeiro do cliente',
    conteudo: 'O que faz: aba Histórico lista os pedidos do cliente; aba Resumo traz total de pedidos, valor, ticket médio, primeiro/último pedido, o histórico importado da planilha e o financeiro vinculado.\nDúvidas: "Métricas do SOA (ao vivo)" vêm dos pedidos no sistema; "Histórico importado" é um retrato da planilha antiga (não se misturam). O bloco financeiro só aparece se houver lançamentos vinculados ao cliente.',
  },
  {
    slug: 'clientes-visao-geral', modulo: 'Clientes', tela: 'Visão Geral (relatório de clientes)', caminho: 'Clientes → Visão Geral',
    palavrasChave: 'visão geral, relatório de clientes, dashboard, ranking, top clientes, melhores clientes, por origem, exportar csv, ticket médio',
    conteudo: 'O que faz: painel com total, ativos, inativos, novos no mês, pedidos vinculados, total em vendas e ticket médio; ranking de melhores clientes e distribuição por origem.\nComo usar:\n1. Clientes → Visão Geral.\n2. Veja os cartões e o "Top clientes por valor" (clicável).\n3. "Exportar relatório (CSV)" baixa a lista completa (abre no Excel).',
  },
  {
    slug: 'clientes-ativar', modulo: 'Clientes', tela: 'Liberar o módulo Clientes', caminho: 'Config → Geral (módulos)',
    palavrasChave: 'módulo clientes, ativar, liberar, permissão, operador, sem acesso, menu sumiu',
    conteudo: 'O que faz: o menu Clientes só aparece se o módulo estiver ligado; operadoras não têm acesso.\nDúvidas: "Sumiu o menu Clientes" → módulo desligado em Config → Geral, ou seu usuário é Operadora (é redirecionada).',
  },

  // ───────────────────────── LOJA VIRTUAL ─────────────────────────
  {
    slug: 'loja-ativar', modulo: 'Loja', tela: 'Ativar a Loja Virtual', caminho: 'Config → Geral → Módulos',
    palavrasChave: 'ativar loja, ligar módulo, habilitar loja virtual, minha loja não aparece, chavinha, módulos',
    conteudo: 'O que faz: liga a Loja Virtual, fazendo "Minha Loja" aparecer no menu.\nComo usar:\n1. Config → Geral → Módulos.\n2. Ligue "Minha Loja" (chavinha laranja) e salve. (Ao salvar a loja pela 1ª vez o módulo também é marcado disponível.)\nDúvidas: só ADMIN ativa. O link público só funciona com o módulo ligado E a loja marcada como "ativa".',
  },
  {
    slug: 'loja-configurar', modulo: 'Loja', tela: 'Configurar a Loja (link, logo, frete, catálogo)', caminho: 'Config → Loja Virtual',
    palavrasChave: 'configurar loja, link da loja, endereço, slug, logo, cor, whatsapp, frete, retirada, entrega, fonte do catálogo, salvar loja',
    conteudo: 'O que faz: tela central da loja (liga/desliga, link, logo, cor, banner, textos, WhatsApp, fonte do catálogo e frete).\nComo usar:\n1. Ligue "Loja ativa".\n2. Escreva o "Link da loja" (minúsculas, números, hífen) → vira seudominio/loja/seu-link.\n3. Suba logo, cor, descrição, boas-vindas, WhatsApp.\n4. Fonte do catálogo: Produtos da Precificação (visíveis), Estoque a Pronta Entrega (com saldo) ou Ambos.\n5. Frete: Só retirada, Grátis ou Fixo (valor).\n6. "Salvar loja".\nDúvidas: link é único (se já usado, escolha outro). Nenhum produto? confira a fonte e marque produtos "visível na loja".',
  },
  {
    slug: 'loja-link', modulo: 'Loja', tela: 'Link público da loja', caminho: 'Config → Loja Virtual → Link da loja',
    palavrasChave: 'link da loja, copiar link, divulgar, endereço, url, compartilhar, ver loja',
    conteudo: 'O que faz: mostra o endereço público (seudominio/loja/seu-link) para copiar e divulgar.\nComo usar:\n1. Preencha "Link da loja".\n2. Clique "Copiar" ou "Ver loja".\n3. Cole no Instagram/WhatsApp/bio.\nDúvidas: pode mudar o link depois (links antigos param). "Loja indisponível" = módulo desligado ou loja inativa.',
  },
  {
    slug: 'loja-banner', modulo: 'Loja', tela: 'Banner/capa da loja', caminho: 'Config → Loja Virtual → Banner/capa',
    palavrasChave: 'banner, capa, imagem do topo, faixa, cabeçalho, cortada, tamanho',
    conteudo: 'O que faz: imagem larga no topo da loja pública.\nComo usar:\n1. "Subir banner" (imagem horizontal, recomendado 1000×208 px — otimizada sozinha).\n2. Veja a prévia e "Salvar loja". Trocar/Remover disponíveis.\nDúvidas: imagens altas têm topo/base cortados (deixe o conteúdo no centro).',
  },
  {
    slug: 'loja-colecoes', modulo: 'Loja', tela: 'Coleções da vitrine', caminho: 'Config → Loja Virtual → Gerenciar vitrine → Coleções',
    palavrasChave: 'coleções, categorias, agrupar produtos, ordem, renomear categoria, vitrine',
    conteudo: 'O que faz: cria categorias (coleções) para agrupar produtos na loja.\nComo usar:\n1. Em "Gerenciar vitrine", digite o nome e "Criar".\n2. Setas para ordenar; clique no nome para renomear; lixeira para remover.\n3. Nos produtos, escolha a coleção de cada um.\nDúvidas: remover a coleção não apaga produtos (viram "Outros").',
  },
  {
    slug: 'loja-produtos-vitrine', modulo: 'Loja', tela: 'Produtos na vitrine (ordem, destaque)', caminho: 'Config → Loja Virtual → Gerenciar vitrine → Produtos',
    palavrasChave: 'produtos na loja, ordem, destaque, estrela, coleção, visível na loja, sem preço, primeiro',
    conteudo: 'O que faz: lista os produtos "visíveis na loja" e define coleção, ordem e destaque.\nComo usar:\n1. Em Precificação → Produtos, marque "visível na loja".\n2. Em Gerenciar vitrine: escolha coleção, defina Ordem (menor = primeiro) e clique na estrela ★ para destaque.\n3. "Fotos e configurações" abre galeria/variações.\nDúvidas: "⚠ Sem preço" → defina preço em Precificação, senão não vende.',
  },
  {
    slug: 'loja-visibilidade-variacao', modulo: 'Loja', tela: 'Visibilidade por configuração (variação)', caminho: 'Config → Loja Virtual → Gerenciar vitrine → produto → Fotos e configurações',
    palavrasChave: 'variação na loja, configuração, esconder variação, ocultar tamanho, visível, mostrar opção',
    conteudo: 'O que faz: escolhe quais variações (configurações) de um produto aparecem à venda.\nComo usar:\n1. No produto, "Fotos e configurações".\n2. Em "Configurações (variações) na loja", marque as que devem aparecer.\nDúvidas: variação sem preço fica bloqueada "(sem preço)" — ajuste na Precificação. Para esconder um tamanho, desmarque a caixinha.',
  },
  {
    slug: 'loja-galeria', modulo: 'Loja', tela: 'Galeria de fotos (produto e variação)', caminho: 'Config → Loja Virtual → Gerenciar vitrine → produto → Galeria',
    palavrasChave: 'galeria, fotos, imagens, capa, foto principal, trocar capa, 10 fotos, imagem da variação',
    conteudo: 'O que faz: até 10 fotos por produto e 10 por variação; a 1ª é a capa.\nComo usar:\n1. "Fotos e configurações" → "Galeria do produto" → + para subir (comprimidas sozinhas).\n2. Passe o mouse e clique na ★ para definir capa, ou lixeira para remover.\nDúvidas: ordem de exibição na loja: variação → produto → estoque → padrão.',
  },
  {
    slug: 'loja-atributos', modulo: 'Loja', tela: 'Opções de compra / atributos (Tamanho, Quantidade)', caminho: 'Config → Loja Virtual → Gerenciar vitrine → produto → Opções de compra',
    palavrasChave: 'atributos, opções de compra, tamanho, quantidade, seletor, combinação, um card só, sugerir atributos, mapear',
    conteudo: 'O que faz: cria atributos (ex.: Tamanho, Quantidade) e mapeia cada variação a uma combinação → o produto vira 1 card com seletor na loja.\nComo usar:\n1. No produto com várias variações, "Opções de compra".\n2. Crie até 2 atributos e as opções.\n3. Na tabela, mapeie cada variação; ou "✨ Sugerir atributos" e "Aplicar sugestão".\nDúvidas: sem atributos, cada variação é um card. A sugestão é rascunho até aplicar.',
  },
  {
    slug: 'loja-pagamento', modulo: 'Loja', tela: 'Formas de pagamento (PIX, Link, Mercado Pago)', caminho: 'Config → Loja Virtual → Formas de pagamento',
    palavrasChave: 'pagamento, pix, copia e cola, chave pix, link de pagamento, mercado pago, access token, webhook, automático, comprovante',
    conteudo: 'O que faz: define como a cliente paga; o dinheiro cai direto na conta da artesã. Sem configurar, o valor é combinado por fora.\nComo usar:\n1. PIX (sua chave): chave + nome + cidade → gera copia-e-cola; confirmação manual (cliente envia comprovante e você marca pago).\n2. Link: cole um link de qualquer serviço; confirmação manual.\n3. Mercado Pago: Access Token + ativar + cadastrar a URL de webhook → confirma automático.\n4. "Salvar pagamento".\nDúvidas: só o Mercado Pago confirma sozinho. O token nunca aparece na loja.',
  },
  {
    slug: 'loja-publica', modulo: 'Loja', tela: 'Loja pública (como a cliente compra)', caminho: 'seudominio/loja/seu-link',
    palavrasChave: 'loja pública, carrinho, comprar, checkout, cliente, esgotado, retirada, entrega, finalizar pedido, promoção',
    conteudo: 'O que faz: vitrine online onde a cliente busca, filtra por categoria, vê fotos, monta carrinho e envia o pedido (paga na hora se houver pagamento online).\nComo funciona: cliente escolhe opções (Tamanho/Quantidade), adiciona ao carrinho, informa nome e WhatsApp, escolhe retirada/entrega e envia.\nDúvidas: itens a pronta entrega respeitam o saldo (sem saldo = Esgotado). Não precisa criar conta. O preço é sempre validado no servidor (com promoção).',
  },
  {
    slug: 'loja-pedidos', modulo: 'Loja', tela: 'Pedidos da Loja', caminho: 'Minha Loja → Pedidos da Loja',
    palavrasChave: 'pedidos da loja, pedidos online, aguardando, pago, canal loja, produção, comprovante',
    conteudo: 'O que faz: lista os pedidos feitos pela loja (filtro por status de pagamento); ao clicar abre o pedido na Produção.\nDúvidas: os pedidos entram automaticamente na Produção com canal "Loja" e status ABERTO. "Aguardando" = pagamento pendente (PIX/Link manuais) → você marca como pago. O cliente é casado por nome/telefone ou criado (origem "Loja Virtual").',
  },
  {
    slug: 'loja-visao-geral', modulo: 'Loja', tela: 'Visão Geral da Minha Loja', caminho: 'Minha Loja',
    palavrasChave: 'visão geral, painel da loja, faturamento, ticket médio, mais vendidos, últimos pedidos, período',
    conteudo: 'O que faz: painel com faturamento pago, nº de pedidos, ticket médio, aguardando pagamento, últimos pedidos e mais vendidos no período (7/30/90 dias ou 1 ano).\nDúvidas: "Faturamento pago" conta só pagos; "Aguardando pgto" mostra o que falta pagar.',
  },

  // ───────────────────────── TAREFAS ─────────────────────────
  {
    slug: 'tarefas-ativar', modulo: 'Tarefas', tela: 'Ativar o módulo de Tarefas', caminho: 'Config → Geral',
    palavrasChave: 'ativar tarefas, ligar módulo, habilitar kanban, sumiu o menu tarefas, quadro',
    conteudo: 'O que faz: liga os quadros estilo Kanban; sem ativar, o menu "Tarefas" não aparece.\nComo usar:\n1. Config → Geral → item "Tarefas".\n2. Ligue a chave (laranja) e salve.\nDúvidas: "Não acho o menu" → ligue em Config → Geral. Operadoras não criam quadros.',
  },
  {
    slug: 'tarefas-visao-geral', modulo: 'Tarefas', tela: 'Visão Geral (painel)', caminho: 'Tarefas → Visão Geral',
    palavrasChave: 'visão geral, resumo, painel, atrasadas, vencidas, urgentes, prazo próximo, por responsável, por status',
    conteudo: 'O que faz: resumo com total, prazos vencidos, prazos próximos (7 dias), urgentes, tarefas por coluna e por responsável, e lista de atrasadas.\nComo usar: escolha o período; veja os cartões e gráficos; clique numa atrasada para ir ao quadro.',
  },
  {
    slug: 'tarefas-quadros', modulo: 'Tarefas', tela: 'Criar e gerenciar Quadros', caminho: 'Tarefas → Quadros',
    palavrasChave: 'quadro, criar quadro, novo painel, board, cor, excluir quadro, editar',
    conteudo: 'O que faz: quadros são painéis para organizar tarefas; cada um já nasce com colunas.\nComo usar:\n1. "Novo quadro", nome e cor, "Criar quadro" (vem com A Fazer, Em andamento, Revisão, Concluídas).\n2. Passe o mouse para "Editar" ou "Excluir".\nDúvidas: excluir o quadro apaga todas as tarefas dele (pede confirmação).',
  },
  {
    slug: 'tarefas-colunas', modulo: 'Tarefas', tela: 'Colunas do quadro', caminho: 'Tarefas → Quadros → abrir quadro',
    palavrasChave: 'coluna, etapa, status, criar coluna, renomear, excluir coluna',
    conteudo: 'O que faz: as colunas são as etapas (A Fazer → Em andamento → Concluídas). Pode criar, renomear e excluir.\nComo usar: "+ Coluna" para criar; clique no nome para renomear; lixeira para excluir.\nDúvidas: coluna com tarefas dentro não pode ser excluída (mova ou apague as tarefas antes).',
  },
  {
    slug: 'tarefas-cards', modulo: 'Tarefas', tela: 'Criar tarefas e arrastar cards (Kanban)', caminho: 'Tarefas → Quadros → abrir quadro',
    palavrasChave: 'card, tarefa, arrastar, mover, kanban, nova tarefa, reordenar, buscar, filtro',
    conteudo: 'O que faz: cada tarefa é um card numa coluna; arraste entre colunas para mudar a etapa.\nComo usar:\n1. Na coluna, "+ Nova tarefa" e o título.\n2. Arraste o card (no celular, segure um instante antes).\n3. Busca e filtros (Prioridade, Responsável, Etiqueta) no topo.\nDúvidas: a busca procura por título e nome do cliente.',
  },
  {
    slug: 'tarefas-detalhes', modulo: 'Tarefas', tela: 'Detalhes do card', caminho: 'Tarefas → Quadros → abrir card',
    palavrasChave: 'detalhes, abrir card, prioridade, urgente, prazo, cliente, responsável, descrição, salvar automático',
    conteudo: 'O que faz: no card você define título, prioridade, prazo, cliente, responsável e descrição — salva sozinho.\nDúvidas: não precisa clicar em salvar. Prazo vermelho = atrasado. Definir "Responsável" faz a tarefa aparecer em "Minhas Tarefas" da pessoa. Setas ← → pulam para o próximo card da coluna.',
  },
  {
    slug: 'tarefas-etiquetas', modulo: 'Tarefas', tela: 'Etiquetas do card', caminho: 'Tarefas → card → Etiquetas',
    palavrasChave: 'etiqueta, tag, rótulo, cor, classificar, filtrar por etiqueta, criar etiqueta',
    conteudo: 'O que faz: etiquetas coloridas para classificar cards e filtrar.\nComo usar: no card, "Gerenciar" → marque as etiquetas; para criar, digite o nome e "Criar" (cor automática).\nDúvidas: a lista de etiquetas é da conta e vale em todos os quadros.',
  },
  {
    slug: 'tarefas-checklist', modulo: 'Tarefas', tela: 'Checklist do card', caminho: 'Tarefas → card → Checklists',
    palavrasChave: 'checklist, lista de itens, subtarefa, progresso, concluir item',
    conteudo: 'O que faz: lista de subtarefas com barra de progresso.\nComo usar: "+ Checklist" → digite itens (Enter) → marque ao concluir (barra verde avança). O "3/5" no card = concluídos/total.',
  },
  {
    slug: 'tarefas-anexos', modulo: 'Tarefas', tela: 'Anexos / artes no card', caminho: 'Tarefas → card → Artes/imagens',
    palavrasChave: 'anexo, imagem, foto, arte, referência, anexar, upload',
    conteudo: 'O que faz: anexa fotos/artes ao card (reduzidas automaticamente).\nComo usar: "Anexar" → escolha imagens → miniaturas em grade (X para remover). O número no clipe = quantos anexos.',
  },
  {
    slug: 'tarefas-comentarios', modulo: 'Tarefas', tela: 'Comentários e menção @', caminho: 'Tarefas → card → Comentários',
    palavrasChave: 'comentário, recado, mencionar, menção, arroba, notificação, sino, avisar equipe',
    conteudo: 'O que faz: recados no card; digitando @ menciona alguém da equipe, que recebe notificação no sino.\nComo usar: escreva a mensagem; @ + escolha o nome; "Enviar". A pessoa recebe "fulano mencionou você" com link.\nDúvidas: só vê pessoas do mesmo workspace no @.',
  },
  {
    slug: 'tarefas-vinculos', modulo: 'Tarefas', tela: 'Vincular tarefa a pedido/pagamento', caminho: 'Tarefas → card → Vínculos',
    palavrasChave: 'vínculo, vincular, pedido, pagamento, associar, atalho',
    conteudo: 'O que faz: liga o card a um pedido ou pagamento, criando atalho clicável.\nComo usar: "+ Pedido"/"+ Pagamento" → busque (número, destinatário, provedor) → clique para vincular (X remove).',
  },
  {
    slug: 'tarefas-minhas', modulo: 'Tarefas', tela: 'Minhas Tarefas', caminho: 'Tarefas → Minhas Tarefas',
    palavrasChave: 'minhas tarefas, atribuídas a mim, responsável, minhas pendências',
    conteudo: 'O que faz: lista só as tarefas em que você é responsável, de todos os quadros (quadro, coluna, cliente, prazo).\nDúvidas: vazio? abra um card e escolha seu nome em "Responsável".',
  },
  {
    slug: 'tarefas-calendario', modulo: 'Tarefas', tela: 'Calendário de Tarefas', caminho: 'Tarefas → Calendário',
    palavrasChave: 'calendário, agenda, prazo, data de entrega, mês, vencimento',
    conteudo: 'O que faz: mostra as tarefas no calendário mensal, no dia do prazo, coloridas pela cor do quadro.\nDúvidas: só entram tarefas com prazo (data) definido. "+N" num dia = mais tarefas.',
  },
  {
    slug: 'tarefas-atividades', modulo: 'Tarefas', tela: 'Atividades (histórico)', caminho: 'Tarefas → Atividades',
    palavrasChave: 'atividades, histórico, feed, o que mudou, quem mexeu, log, movimentação',
    conteudo: 'O que faz: feed do que aconteceu nas tarefas (criou, moveu, editou, comentou, etiqueta/checklist/vínculo), com data e hora. Clique num evento para ir ao quadro.',
  },

  // ───────────────────── ASSISTENTE DE COMPRAS ─────────────────────
  {
    slug: 'assistente-ativar', modulo: 'Assistente de Compras', tela: 'Ativar o Assistente de Compras', caminho: 'Config → Geral → Módulos → Assistente de Compras',
    palavrasChave: 'ativar, ligar, habilitar, assistente de compras, sumiu do menu, preço de mercado',
    conteudo: 'O que faz: liga o módulo que pesquisa a faixa de preço de mercado dos materiais (dados anônimos da comunidade).\nComo usar: Config → Geral → Módulos → ligue "Assistente de Compras (IA)" e salve → aparece "Assistente de Compras → Pesquisar preço".\nDúvidas: a pesquisa é grátis; só o resumo escrito pela IA tem limite diário.',
  },
  {
    slug: 'assistente-pesquisar', modulo: 'Assistente de Compras', tela: 'Pesquisar preço de mercado', caminho: 'Assistente de Compras → Pesquisar preço',
    palavrasChave: 'pesquisar preço, preço de mercado, quanto custa, faixa de preço, menor preço, preço médio, cotação, comparar preço',
    conteudo: 'O que faz: você digita um material (ex.: cola branca, feltro) e vê a faixa de mercado (menor, médio e faixa sugerida), com dados anônimos e agregados.\nComo usar:\n1. Digite o material e "Pesquisar".\n2. Veja a "Faixa sugerida" e Menor/Médio/Fontes.\n3. Confira a confiabilidade (baixa/média/alta — mais artesãs = mais confiável).\nDúvidas: faixa sugerida = onde a maioria paga (ignora extremos). Os valores vêm de muitas artesãs, sempre anônimos.',
  },
  {
    slug: 'assistente-privacidade', modulo: 'Assistente de Compras', tela: 'Dados anônimos / dados insuficientes', caminho: 'Assistente de Compras → Pesquisar preço',
    palavrasChave: 'anônimo, privacidade, meus dados aparecem, dados insuficientes, amostra, comunidade, agregado',
    conteudo: 'O que faz: os preços são sempre somados de várias artesãs e sem nome; a faixa só aparece com amostra mínima (pelo menos 4 artesãs).\nDúvidas: "As outras veem meu preço?" Não. "Deu dados insuficientes?" ainda faltam artesãs com esse material — tente mais tarde.',
  },
  {
    slug: 'assistente-meus-precos', modulo: 'Assistente de Compras', tela: 'Meus preços vs mercado', caminho: 'Assistente de Compras → Pesquisar preço → Ver meus preços vs mercado',
    palavrasChave: 'meus preços, comparar meus materiais, economizar, pagando caro, acima do mercado, onde economizo',
    conteudo: 'O que faz: compara seus materiais cadastrados com a faixa de mercado e mostra onde você paga acima da média (para economizar).\nComo usar: "Ver meus preços vs mercado" → lista "Onde você pode economizar" (seu preço, mercado e +X%).\nDúvidas: só entram materiais ativos, com preço > 0 e amostra suficiente.',
  },
  {
    slug: 'assistente-seguir', modulo: 'Assistente de Compras', tela: 'Seguir material (alerta no sino)', caminho: 'Assistente de Compras → Pesquisar preço → Seguir preço',
    palavrasChave: 'seguir material, alerta de preço, avisar quando cair, notificação, sino, bom momento de comprar, monitorar preço',
    conteudo: 'O que faz: você segue um material e é avisada no sino quando o preço médio cair.\nComo usar: pesquise e "Seguir preço deste material" (vira "Seguindo"); quando cair (mais de 3%) chega a notificação "Bom momento".\nDúvidas: no máx. 1 aviso/dia por material.',
  },
  {
    slug: 'assistente-evolucao', modulo: 'Assistente de Compras', tela: 'Histórico e evolução (30 dias)', caminho: 'Assistente de Compras → Pesquisar preço',
    palavrasChave: 'evolução, histórico, gráfico, tendência, subindo, caindo, estável, últimos 30 dias',
    conteudo: 'O que faz: gráfico da evolução do preço médio nos últimos 30 dias e a tendência (subindo/caindo/estável).\nDúvidas: só aparece com histórico de 2+ dias. "Caindo" costuma ser bom momento de comprar.',
  },
  {
    slug: 'assistente-onde-comprar', modulo: 'Assistente de Compras', tela: 'Onde comprar (fornecedores/lojas)', caminho: 'Assistente de Compras → Pesquisar preço → Onde comprar',
    palavrasChave: 'onde comprar, fornecedor, loja, patrocinado, mais barato, indicação de loja',
    conteudo: 'O que faz: sugere onde comprar — lojas parceiras (selo "Patrocinado") e fornecedores da comunidade com preço médio.\nDúvidas: um fornecedor só aparece se usado por 2+ artesãs (anonimato).',
  },

  // ───────────────────────── IMPORTAÇÃO ─────────────────────────
  {
    slug: 'import-planilha', modulo: 'Importação', tela: 'Importar planilha de pedidos', caminho: 'Produção → Pedidos → Importar planilha',
    palavrasChave: 'importar pedidos, planilha, subir pedidos em massa, xlsx, csv, exportação shopee, modelo, template, 500 pedidos',
    conteudo: 'O que faz: cria vários pedidos de um arquivo .xlsx/.xls/.csv, aceitando o modelo do sistema OU a exportação crua da Shopee.\nComo usar:\n1. Pedidos → "Importar planilha".\n2. Baixe o modelo SOA e preencha, OU exporte da Shopee (Meus Pedidos → Exportar → "A Enviar").\n3. Arraste o arquivo.\n4. Confira o preview e confirme.\nDúvidas: máx. 500 por importação; não precisa converter a planilha da Shopee.',
  },
  {
    slug: 'import-deteccao', modulo: 'Importação', tela: 'Detecção automática Shopee x Template VPS', caminho: 'Produção → Pedidos → Importar planilha',
    palavrasChave: 'detecção automática, formato, shopee ou vps, reconhecer planilha, cabeçalho, colunas',
    conteudo: 'O que faz: descobre sozinho se é planilha Shopee ou modelo do sistema e mapeia as colunas.\nDúvidas: colunas como "ID do pedido"/"Nome do destinatário" ligam o modo Shopee. Colunas suas fora das universais viram campos personalizados do pedido.',
  },
  {
    slug: 'import-preview', modulo: 'Importação', tela: 'Preview antes de importar (sempre manual)', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'prévia, preview, conferir antes, revisar, confirmação manual, linhas x pedidos',
    conteudo: 'O que faz: prévia de todos os pedidos lidos (agrupados por número); nada é gravado sem confirmação.\nDúvidas: a importação nunca é automática. O preview mostra "X linhas → Y pedidos" (linhas do mesmo número viram 1 pedido).',
  },
  {
    slug: 'import-existentes', modulo: 'Importação', tela: 'Pedidos que já existem (pular/adicionar/substituir)', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'pedido repetido, duplicado, já existe, pular, adicionar, substituir, reimportar, mesclar',
    conteudo: 'O que faz: detecta números já no sistema e você escolhe: Pular (ignora), Adicionar (junta produtos novos) ou Substituir (apaga e recria). Padrão = Pular.\nDúvidas: reimportar não duplica (o que já existe é ignorado por padrão).',
  },
  {
    slug: 'import-multiplos', modulo: 'Importação', tela: 'Vários produtos no mesmo pedido (agrupar/separar)', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'vários produtos, agrupar, separar, dividir pedido, p1 p2, multi-item',
    conteudo: 'O que faz: quando um pedido tem vários produtos, você decide 1 pedido com tudo ou vários separados (recebem sufixo -p1, -p2).\nDúvidas: agrupar não dobra o valor (soma o valor de cada linha).',
  },
  {
    slug: 'import-pecas-kit', modulo: 'Importação', tela: 'Quantidade de peças por kit', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'peças, quantidade, kit, número no nome, vírgula 10, variação com quantidade, não localizada, calcular peças',
    conteudo: 'O que faz: descobre as peças reais lendo o número embutido no nome/variação da Shopee (ex.: ",10") e, quando o produto casa com um kit da Precificação, multiplica unidades × peças por kit.\nDúvidas: quando casa na Precificação usa as unidades pedidas SEM o sufixo (nunca soma os dois). O valor da linha fica intacto. Se não localizar, mostra "⚠ não localizada" e você digita.',
  },
  {
    slug: 'import-vinculo-assistido', modulo: 'Importação', tela: 'Vínculo assistido de produto + de-para', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'vincular produto, de-para, ligar nome ao cadastro, não reconhecido, salvar vínculo, precificação',
    conteudo: 'O que faz: lista nomes não reconhecidos e você liga cada um ao produto da Precificação; o de-para fica salvo e as próximas importações vinculam sozinhas.\nDúvidas: não precisa vincular toda vez; vincular não muda quantidade nem valor.',
  },
  {
    slug: 'import-criar-copia', modulo: 'Importação', tela: 'Criar produto por cópia', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'criar por cópia, copiar produto, produto igual, trocar tema, novo produto, sugestão de base',
    conteudo: 'O que faz: para um nome não reconhecido, cria o produto na Precificação copiando um "irmão" (muda só o tema) e já vincula.\nComo usar: "✚ criar copiando um produto igual" → escolha a base sugerida → "Criar e vincular".',
  },
  {
    slug: 'import-cliente', modulo: 'Importação', tela: 'Vincular comprador a cliente', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'cliente, comprador, vincular cliente, criar cliente, módulo clientes',
    conteudo: 'O que faz: com o módulo Clientes ativo, oferece ligar cada comprador a um cliente existente ou criar novo.\nDúvidas: só aparece com o módulo Clientes ativado; não cria repetido (dedupe pelo nome no lote).',
  },
  {
    slug: 'import-auditoria', modulo: 'Importação', tela: 'Relatório de auditoria (Shopee)', caminho: 'Produção → Pedidos → Importar planilha → Preview',
    palavrasChave: 'auditoria, relatório, resumo antes de confirmar, taxas, líquido, alertas, cancelamento, ticket médio',
    conteudo: 'O que faz: só nas planilhas Shopee, mostra um resumo executivo antes de gravar (bruto, frete, descontos, taxas, líquido estimado, ticket médio) e alertas.\nDúvidas: valores são somados por pedido (não por linha), senão o faturamento dobraria.',
  },

  // ───────────────────── FINANCEIRO: NÚMEROS DO MARKETPLACE ─────────────────────
  {
    slug: 'mkt-ativar', modulo: 'Financeiro', tela: 'Ativar "Números do Marketplace"', caminho: 'Financeiro → Números do Marketplace',
    palavrasChave: 'números do marketplace, ativar módulo, shopee, opt-in, previsão, não mexe no caixa',
    conteudo: 'O que faz: liga o painel de gestão dos pedidos de marketplace (Shopee): previsão de recebimento, taxas, líquido e margem. Não lança nada no caixa.\nComo usar: acesse e uma administradora clica "Ativar módulo"; com planilhas Shopee importadas, os números aparecem.',
  },
  {
    slug: 'mkt-taxas', modulo: 'Financeiro', tela: 'Taxas e líquido estimado', caminho: 'Financeiro → Números do Marketplace',
    palavrasChave: 'taxas, comissão, líquido estimado, bruto, frete, desconto, ticket médio, estimado, repasse',
    conteudo: 'O que faz: mostra nº de pedidos, venda bruta, total de taxas (com % do bruto), líquido estimado, frete, descontos e ticket médio no período.\nDúvidas: o líquido é ESTIMADO (a Shopee não informa o repasse real).',
  },
  {
    slug: 'mkt-previsao', modulo: 'Financeiro', tela: 'Previsão de recebimento + baixa em lote', caminho: 'Financeiro → Números do Marketplace',
    palavrasChave: 'previsão de recebimento, recebível, dar baixa, recebido, previsto, a confirmar, fora do caixa, lote',
    conteudo: 'O que faz: agrupa pedidos por estado do recebível (Aguardando envio, Previsto, A confirmar, Recebido, Cancelado) e permite marcar Recebido em lote por período. Nunca lança no caixa.\nDúvidas: dar baixa só muda o estado (não cria lançamento). Só administradora dá baixa.',
  },
  {
    slug: 'mkt-margem', modulo: 'Financeiro', tela: 'Margem real por pedido', caminho: 'Financeiro → Números do Marketplace',
    palavrasChave: 'margem real, lucro por pedido, custo, cobertura, ranking, melhor margem, pior margem, vincular',
    conteudo: 'O que faz: calcula a margem real de cada pedido (líquido estimado − custo dos produtos vinculados à Precificação) e faz o ranking.\nDúvidas: sem vincular o produto à Precificação não há custo (aparece "vincular"). "Cobertura" = % de pedidos com todos os itens vinculados.',
  },

  // ───────────────────── NOVOS EM PRODUÇÃO (core recente) ─────────────────────
  {
    slug: 'orcamento-desconto-frete', modulo: 'Orçamentos', tela: 'Desconto por produto e frete no orçamento', caminho: 'Produção → Orçamentos → Novo/editar orçamento',
    palavrasChave: 'orçamento, desconto, frete, desconto por produto, subtotal, total, breakdown, página do cliente, aprovar',
    conteudo: 'O que faz: no orçamento você dá desconto por item (em R$ ou %) e informa o frete; o total é recalculado (Subtotal − Desconto + Frete) e aparece também na página pública que a cliente abre.\nComo usar:\n1. Em cada item, preencha o campo Desconto (escolha R$ ou %).\n2. No resumo, informe o Frete.\n3. O Total ao vivo já mostra Subtotal · Desconto · Frete · Total.\n4. Ao a cliente aprovar, vira pedido com o valor final.\nDúvidas: o desconto e o frete aparecem no link público; o item com desconto mostra o preço cheio riscado.',
  },
  {
    slug: 'orcamento-basico', modulo: 'Orçamentos', tela: 'Criar orçamento e link de aprovação', caminho: 'Produção → Orçamentos',
    palavrasChave: 'orçamento, criar orçamento, link público, aprovar, cliente aprova, vira pedido, políticas',
    conteudo: 'O que faz: cria orçamentos com produtos, campos personalizados e políticas da empresa e gera um link público para a cliente aprovar; ao aprovar, vira pedido automaticamente.\nStatus: PENDENTE, APROVADO, RECUSADO, EXPIRADO.',
  },
  {
    slug: 'prec-tecido-m2', modulo: 'Precificação', tela: 'Tecido por metro → preço por m²', caminho: 'Precificação → Materiais (unidade m²)',
    palavrasChave: 'tecido, metro, m2, metro quadrado, costura, preço por m2, largura do tecido, retalho, calcular por medidas',
    conteudo: 'O que faz: cadastra o tecido do jeito que se compra (por metro) e o sistema calcula o preço por m².\nComo usar:\n1. No material, escolha a unidade "m²".\n2. Informe o preço por metro e a largura do tecido (ou o preço do rolo e os metros) — ele calcula o preço/m² (ex.: 9,50 ÷ 1,40 = R$ 6,79/m²).\n3. No item do produto, use "calcular por medidas": digite altura × largura da peça → a área (Qtd usada) é preenchida e mostra o custo do retalho.',
  },
  {
    slug: 'prec-mao-obra', modulo: 'Precificação', tela: 'Mão de obra na precificação', caminho: 'Precificação → Produtos → variação → Mão de Obra',
    palavrasChave: 'mão de obra, custo por hora, minutos, calculadora, tempo de produção, valor da hora',
    conteudo: 'O que faz: soma o custo do seu tempo ao preço do produto.\nComo usar: na variação, seção "Mão de Obra" → marque "Adicionar custo" → clique no 🧮 → informe R$/hora e os minutos → calcula automaticamente e soma ao custo.',
  },
  {
    slug: 'painel-resultado-vendas', modulo: 'Precificação', tela: 'Resultado das vendas (painel)', caminho: 'Visão Geral (painel inicial)',
    palavrasChave: 'resultado das vendas, lucro, margem, vendas, taxas, custo de materiais, cobertura, estimado, painel',
    conteudo: 'O que faz: na Visão Geral, estima Vendas, Taxas (impostos), Custo de materiais e Lucro do mês (com gráfico), a partir da sua precificação — é ESTIMATIVA, não é o caixa (o Financeiro é o dinheiro real).\nDúvidas: mostra a % de cobertura (itens ligados à Precificação). Para um item entrar no custo, escolha o produto pela Precificação ao montar o pedido (ou use "Vincular pedidos à Precificação").',
  },
  {
    slug: 'vincular-pedidos-lote', modulo: 'Precificação', tela: 'Vincular pedidos à Precificação em lote', caminho: 'Precificação → Produtos → Vincular pedidos à Precificação',
    palavrasChave: 'vincular pedidos em lote, precificação, de-para, resultado das vendas, corrigir peças, kit, faturamento, aplicar',
    conteudo: 'O que faz: lista os nomes de produto dos pedidos ainda não ligados (com quantos pedidos cada um) e vincula todos de uma vez; passam a contar no "Resultado das vendas" e as próximas importações vinculam sozinhas.\nComo usar: aceite a sugestão ou escolha a variação (ou crie por cópia); opcional "corrigir peças pelo kit"; "Aplicar (N)".\nDúvidas: vincular não muda o valor dos pedidos (há um porteiro que confere o faturamento).',
  },

  // ───────────────────────── PRODUÇÃO (core) ─────────────────────────
  {
    slug: 'producao-criar-pedido', modulo: 'Produção', tela: 'Criar um pedido', caminho: 'Produção → Pedidos → "+ Novo pedido"',
    palavrasChave: 'criar pedido, novo pedido, cadastrar pedido, adicionar pedido, produto, quantidade, valor, canal, kit, peças por kit',
    conteudo: 'O que faz: cria um pedido novo com status ABERTO.\nComo usar:\n1. Produção → Pedidos → "+ Novo pedido".\n2. Preencha número, destinatário/cliente, produto(s), quantidade, valor, canal e data de envio.\n3. "+ Adicionar produto" para vários itens.\n4. Kits: "Qtd. de SKUs" (quantos kits), "Peças por kit" (fixo) e "Total de peças" (calculado).\n5. Salvar.\nDúvidas: campos personalizados aparecem se configurados em Config → Campos do Pedido.',
  },
  {
    slug: 'producao-workflow-setores', modulo: 'Produção', tela: 'Workflow de produção (Iniciar/Concluir/Devolver)', caminho: 'Produção → setores (cards do pedido)',
    palavrasChave: 'workflow, setor, iniciar, concluir, devolver, avançar, próximo setor, expedição, enviado, fluxo de produção, em produção',
    conteudo: 'Como funciona:\n1. Pedido ABERTO → "Iniciar" em um setor → entra no 1º setor e vira EM PRODUÇÃO.\n2. Em cada setor, "Concluir" avança ao próximo.\n3. "Devolver" volta ao setor anterior (escolhe o destino e o motivo, obrigatório).\n4. O último setor com "expedi" no nome vira ENVIADO automaticamente ao concluir.\nStatus são FIXOS (ABERTO, EM PRODUÇÃO, CONCLUÍDO, ENVIADO, CANCELADO) — não se criam status.',
  },
  {
    slug: 'producao-mover-setor', modulo: 'Produção', tela: 'Mover pedido entre setores (pedido preso)', caminho: 'Produção → abrir pedido → Fluxo de Produção → "Mover para outro setor"',
    palavrasChave: 'pedido preso, travado, não sai do setor, não avança, prontos, mover pedido, mudar de setor, setor excluído, mover para outro setor',
    conteudo: 'O que faz: move o pedido para outro setor manualmente — resolve pedidos que ficaram "presos" (ex.: quando o setor onde estavam foi excluído).\nComo usar:\n1. Abra o pedido.\n2. No painel "Fluxo de Produção", clique "Mover para outro setor".\n3. Selecione o setor correto e "Mover".\nDica: nunca exclua um setor que tenha pedidos dentro — mova-os antes (renomear o setor é seguro).',
  },
  {
    slug: 'producao-cancelar-excluir', modulo: 'Produção', tela: 'Cancelar ou excluir um pedido', caminho: 'Produção → Pedidos',
    palavrasChave: 'cancelar pedido, excluir pedido, apagar pedido, deletar, remover, status cancelado, irreversível',
    conteudo: 'Cancelar (recomendado): abra o pedido → "Cancelar pedido" (ou Editar → Status → Cancelado). Mantém o histórico.\nExcluir: na lista, marque o pedido → barra laranja → "Excluir X"; ou na tela do pedido, "Excluir pedido" (só ADMIN). É irreversível.\nDica: prefira Cancelar para preservar o histórico.',
  },
  {
    slug: 'producao-painel-geral', modulo: 'Produção', tela: 'Painel Geral e Calendário', caminho: 'Produção → Painel Geral / Calendário',
    palavrasChave: 'painel geral, cards, aguardando, fazendo agora, prontos, enviados, por setor, calendário, datas de envio',
    conteudo: 'Painel Geral: cards clicáveis Aguardando, Fazendo agora, Prontos, Enviados e Total, mais "Pedidos por Setor" (clique filtra a lista).\nCalendário: visão mensal/semanal/diária das datas de envio; cada evento abre o pedido.',
  },
  {
    slug: 'config-setores', modulo: 'Config', tela: 'Setores de produção (criar/editar/excluir)', caminho: 'Config → Produção',
    palavrasChave: 'setores, criar setor, editar setor, excluir setor, reordenar, fluxo, expedição, etapas da produção',
    conteudo: 'O que faz: você cria os setores do jeito do seu negócio (ex.: Arte, Corte, Montagem, Embalagem, Expedição) — criar, editar (nome, ícone, cor), reordenar e excluir.\nImportante: o setor com "expedi" no nome dispara o status ENVIADO ao concluir.\n⚠️ NÃO exclua um setor com pedidos dentro (eles ficam presos). Mova os pedidos antes; renomear é seguro.',
  },
  {
    slug: 'config-campos-pedido', modulo: 'Config', tela: 'Campos personalizados do pedido', caminho: 'Config → Campos do Pedido',
    palavrasChave: 'campos personalizados, campo extra, tema, cor, personagem, nome da criança, tamanho, imagem, lista, data',
    conteudo: 'O que faz: cria campos extras que aparecem em todos os pedidos. Tipos: texto, número, lista (dropdown), data e imagem (PNG/JPG até 1MB).\nExemplos: Tema, Cor, Personagem, Nome da criança, Tamanho. Pode reordenar e ativar/desativar cada campo.',
  },
  {
    slug: 'financeiro-lancamentos', modulo: 'Financeiro', tela: 'Lançamentos (receitas e despesas)', caminho: 'Financeiro → Lançamentos',
    palavrasChave: 'lançamento, receita, despesa, entrada, saída, conta a pagar, conta a receber, recorrente, parcelado, pago, pendente',
    conteudo: 'O que faz: registra receitas (entra) e despesas (sai), com categoria, valor, data, canal e status (Pendente/Pago).\nRecorrência (diária/semanal/mensal/anual) gera lançamentos futuros; parcelamento até 24x gera uma entrada por parcela.\nExcluir recorrente: escolha "só este", "este e os próximos pendentes" ou "todos".',
  },
  {
    slug: 'estoque-materiais-produtos', modulo: 'Estoque', tela: 'Estoque de materiais e de produtos (ativar)', caminho: 'Config → Geral → Módulos → Estoque de Produtos',
    palavrasChave: 'estoque, ativar estoque, saldo, entrada, saída, estoque mínimo, alerta, materiais, produtos prontos, pronta entrega',
    conteudo: 'O que faz: controla o saldo de materiais e de produtos prontos, com alerta de estoque mínimo.\nComo ativar: Config → Geral → Módulos → ligue "Estoque de Produtos" e salve. Aparece em Precificação → Estoque de Materiais e em Produção → Estoque de Produtos. Se não aparecer, recarregue (F5).\nSim, o sistema TEM estoque (é um módulo opcional).',
  },
  {
    slug: 'config-geral', modulo: 'Config', tela: 'Configurações gerais (ateliê, tema, módulos)', caminho: 'Config → Geral',
    palavrasChave: 'configurações, config geral, logo, cor, tema, nome do ateliê, módulos, ativar módulo, instagram, cnpj, senha',
    conteudo: 'O que faz: nome do ateliê, logo, cor do tema (8 opções), dados da proprietária (Instagram, WhatsApp, e-mail, cidade, CNPJ), link da loja e os Módulos do sistema (Estoque, Clientes, Loja, Tarefas, Assistente de Compras, Demandas). Salvar no botão laranja no rodapé.',
  },
  {
    slug: 'suporte-central', modulo: 'Suporte', tela: 'Central de Suporte (chamado, FAQ, feedback)', caminho: 'Menu → Suporte',
    palavrasChave: 'suporte, ajuda, chamado, abrir chamado, faq, feedback, sugestão, bug, elogio, telegram',
    conteudo: 'O que faz: FAQ, chat de suporte, abrir chamado (com print) e enviar feedback (sugestão, bug ou elogio). Também há bot no Telegram.\nComo usar: se a dúvida não for resolvida aqui, clique em "Abrir chamado" e descreva o problema (pode anexar uma foto).',
  },
]

// Fragmentos gold-standard (padrão-ouro, 8 seções + faq), gerados das telas reais.
const FRAGMENTOS: EntradaConhecimento[] = [
  ...fPrecificacao, ...fProducao, ...fFinanceiro, ...fLoja, ...fClientesTarefas, ...fConfigDemandas, ...fCompras,
]

// Dedupe por slug: os fragmentos (mais ricos) vencem as entradas antigas.
const _mapa = new Map<string, EntradaConhecimento>()
for (const e of ANTIGAS) _mapa.set(e.slug, e)
for (const e of FRAGMENTOS) _mapa.set(e.slug, e)
export const BASE_CONHECIMENTO: EntradaConhecimento[] = [..._mapa.values()]
