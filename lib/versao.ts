// Versão atual do sistema
// Atualizar aqui a cada nova versão
export const VERSAO_ATUAL = '1.15.0'

export interface Novidade {
  emoji: string
  titulo: string
  descricao: string
}

export interface Release {
  versao: string
  data: string
  destaque: string
  novidades: Novidade[]
}

// Histórico de versões — adicionar nova entrada no topo
export const CHANGELOG: Release[] = [
  {
    versao: '1.15.0',
    data: '04/07/2026',
    destaque: 'Importadores aceitam QUALQUER planilha: a IA mapeia as colunas para você',
    novidades: [
      {
        emoji: '✨',
        titulo: 'Mapeamento de colunas por IA',
        descricao: 'Nos importadores de Produtos, Materiais e Clientes: se a planilha vier em um formato diferente do modelo, a IA lê o cabeçalho e uma amostra e propõe automaticamente para onde vai cada coluna. Você confere e ajusta o de-para antes de importar (a IA nunca grava sozinha). Se a planilha já estiver no formato do modelo, nada muda. E se a IA estiver indisponível, você faz o mapeamento manualmente — o fluxo nunca trava.',
      },
    ],
  },
  {
    versao: '1.14.0',
    data: '04/07/2026',
    destaque: 'Ações em massa e filtros detalhados em Materiais e Produtos',
    novidades: [
      {
        emoji: '☑️',
        titulo: 'Selecionar vários e agir de uma vez',
        descricao: 'Em Precificação → Materiais e Produtos você marca vários itens e faz de uma vez: ativar, inativar, excluir, ajustar o preço por um percentual e editar em massa (fornecedor/unidade nos materiais, categoria nos produtos). O ajuste de preço não altera o custo dos produtos.',
      },
      {
        emoji: '🔎',
        titulo: 'Filtros detalhados',
        descricao: 'Filtre materiais por fornecedor, unidade, faixa de preço, sem preço e com/sem vínculo a produto. Filtre produtos por categoria, canal, com/sem materiais e pendências (materiais com quantidade "a definir" ou margem negativa) — perfeito para revisar o que veio da importação.',
      },
    ],
  },
  {
    versao: '1.13.0',
    data: '04/07/2026',
    destaque: 'Importar produtos por planilha — e o vínculo com os materiais se resolve sozinho, em qualquer ordem',
    novidades: [
      {
        emoji: '📦',
        titulo: 'Importador de produtos',
        descricao: 'Em Precificação → Produtos há o botão "Importar produtos": baixe o modelo (Nome, Descrição, Preço), preencha e importe. Cada produto entra com uma configuração "Direta" com o preço informado. Linhas sem nome são ignoradas e reportadas.',
      },
      {
        emoji: '🔀',
        titulo: 'Vínculo material↔produto em qualquer ordem',
        descricao: 'Não importa se você importa primeiro os materiais ou os produtos: o sistema guarda a referência "Peças que fazem uso" dos materiais e, ao final de cada importação, reconcilia os vínculos automaticamente — sem duplicar e sem alterar o custo (a quantidade entra como "a definir").',
      },
    ],
  },
  {
    versao: '1.12.0',
    data: '04/07/2026',
    destaque: 'Importar materiais por planilha, já vinculando cada material aos produtos que o usam',
    novidades: [
      {
        emoji: '🧵',
        titulo: 'Importador de materiais + vínculo automático',
        descricao: 'Em Precificação → Materiais há o botão "Importar materiais": baixe o modelo, preencha (Nome, Descrição, Valor de repasse, Fornecedores e "Peças que fazem uso") e importe. Além de criar os materiais, o sistema já vincula cada um aos produtos citados que existem no sistema — com quantidade "a definir", então o custo não muda até você informar a quantidade de cada material no produto. Produtos citados que não existem aparecem numa lista para revisão.',
      },
    ],
  },
  {
    versao: '1.11.0',
    data: '04/07/2026',
    destaque: 'Importação de pedidos agora sugere vincular cada comprador a um cliente (com confirmação)',
    novidades: [
      {
        emoji: '🔗',
        titulo: 'Vincular clientes na importação de pedidos',
        descricao: 'Com o módulo Clientes ativo, ao importar pedidos (Shopee ou template) aparece um passo extra: para cada comprador, o sistema sugere vincular a um cliente existente (quando o nome bate) ou criar um cliente novo — e você confirma ou ajusta antes de gravar. Nomes ambíguos ficam como "Não vincular" por segurança. Compradores repetidos na mesma planilha viram um único cliente.',
      },
    ],
  },
  {
    versao: '1.10.0',
    data: '04/07/2026',
    destaque: 'Pedido preenche destinatário e endereço automaticamente pelo cliente selecionado',
    novidades: [
      {
        emoji: '🏠',
        titulo: 'Endereço do pedido preenchido pelo cliente',
        descricao: 'Ao escolher o cliente no pedido, o destinatário e o endereço são preenchidos sozinhos a partir do cadastro (endereço principal). Se o cliente tiver mais de um endereço, você escolhe qual usar. Ao editar um pedido já preenchido, nada é sobrescrito sozinho — há o botão "Usar endereço do cliente". Os campos continuam editáveis e o que você digita no pedido não altera o cadastro do cliente.',
      },
    ],
  },
  {
    versao: '1.9.0',
    data: '04/07/2026',
    destaque: 'Financeiro por cliente: vincule lançamentos a um cliente e veja quanto ele já pagou e o que está em aberto',
    novidades: [
      {
        emoji: '💰',
        titulo: 'Vincular lançamento a um cliente',
        descricao: 'Ao criar ou editar um lançamento no Financeiro, você pode escolher o cliente (opcional). Também dá para filtrar os lançamentos por cliente na lista. O campo só aparece com o módulo Clientes ativo e não muda nada em lançamentos sem cliente.',
      },
      {
        emoji: '📊',
        titulo: 'Financeiro na ficha do cliente',
        descricao: 'A ficha do cliente ganhou a seção "Financeiro do cliente": total recebido, total em aberto e a lista dos lançamentos vinculados — separado do histórico de pedidos e do histórico importado.',
      },
    ],
  },
  {
    versao: '1.8.0',
    data: '04/07/2026',
    destaque: 'Importação de clientes por planilha — a mesma tela de importar pedidos, agora para clientes',
    novidades: [
      {
        emoji: '📥',
        titulo: 'Importar clientes por planilha (sem perda de dados)',
        descricao: 'No módulo Clientes há um botão "Importar planilha" igual ao dos pedidos: baixe o modelo, preencha e faça upload. Todas as colunas da planilha viram campos próprios do cliente — nome, e-mail, telefone, cidade/UF e o histórico (último pedido, status, total, finalizados e em aberto), que aparece na ficha em "Histórico importado", separado das métricas ao vivo do sistema. O sistema mostra uma prévia, avisa quais já existem (e serão ignorados) e importa o restante.',
      },
    ],
  },
  {
    versao: '1.7.0',
    data: '04/07/2026',
    destaque: 'Novo módulo de Clientes (CRM): cadastro com contatos, endereços, histórico de compras e resumo financeiro',
    novidades: [
      {
        emoji: '👥',
        titulo: 'Módulo de Clientes (CRM)',
        descricao: 'Agora você pode cadastrar seus clientes com vários contatos (telefone, e-mail, WhatsApp, Instagram) e endereços, marcando um como principal. O módulo já vem ativado e o menu "Clientes" aparece na Produção — se preferir, dá para desligá-lo em Configurações → Geral.',
      },
      {
        emoji: '🧾',
        titulo: 'Histórico de compras e resumo',
        descricao: 'Na ficha de cada cliente você vê todos os pedidos vinculados a ele, com total de pedidos, valor total, ticket médio e datas do primeiro e último pedido — tudo calculado automaticamente.',
      },
      {
        emoji: '🔗',
        titulo: 'Vínculo de cliente no pedido',
        descricao: 'Ao criar ou editar um pedido, escolha o cliente no seletor "Cliente (CRM)". O pedido passa a aparecer no histórico dele. O campo é opcional e só aparece com o módulo ativado.',
      },
    ],
  },
  {
    versao: '1.6.0',
    data: '26/05/2026',
    destaque: 'Foto e descrição do produto no orçamento, medida em centímetros e nome da configuração nos canais',
    novidades: [
      {
        emoji: '📸',
        titulo: 'Foto do produto no orçamento',
        descricao: 'Agora você pode adicionar uma foto em cada produto, e ela aparece no orçamento que a cliente recebe. Vá em Precificação → Produtos → Editar, escolha a foto no campo "Foto do produto" e salve. A imagem é otimizada automaticamente, sem se preocupar com o tamanho.',
      },
      {
        emoji: '📝',
        titulo: 'Descrição do produto',
        descricao: 'No mesmo cadastro do produto há um campo de Descrição para detalhar como o produto é feito, se tem camadas, do que é composto... Essa descrição também aparece para a cliente no orçamento, ajudando a fechar mais vendas.',
      },
      {
        emoji: '📏',
        titulo: 'Medida em centímetros nos materiais',
        descricao: 'A lista de unidades dos materiais agora tem centímetros. Perfeito para medir fitas e acabamentos — por exemplo, 50cm de fita de cetim em uma caixa milk. Disponível em Precificação → Materiais ao escolher a unidade.',
      },
      {
        emoji: '🏷️',
        titulo: 'Nome da configuração nos Canais',
        descricao: 'Na tela de Precificação → Canais, o nome de cada configuração agora aparece em destaque junto aos preços. Quem trabalha com várias configurações do mesmo produto (4x0, 4x4, cores ou acabamentos diferentes) identifica de relance qual preço é de qual, sem cruzar valores na mão.',
      },
      {
        emoji: '✨',
        titulo: 'Melhorias de exibição',
        descricao: 'Ajustamos a lista de pedidos para que a coluna de Status e Ações apareça sempre por completo, sem cortes.',
      },
    ],
  },
  {
    versao: '1.5.0',
    data: '09/04/2026',
    destaque: 'Edição rápida nos setores, mover pedidos e correções na precificação',
    novidades: [
      {
        emoji: '✏️',
        titulo: 'Edição rápida no setor',
        descricao: 'Edite qualquer pedido direto no card do setor sem precisar abrir a tela do pedido. Clique no lápis e altere destinatário, canal, data de envio, prioridade, campos personalizados e imagem do modelo.',
      },
      {
        emoji: '🔀',
        titulo: 'Mover pedido entre setores',
        descricao: 'Transfira um pedido para qualquer setor da linha de produção com um clique — tanto pelo card do setor quanto pela tela do pedido. O pedido precisa estar iniciado para ser movido.',
      },
      {
        emoji: '🖼️',
        titulo: 'Miniatura de imagem na lista de pedidos',
        descricao: 'O campo imagem agora aparece como uma miniatura discreta na lista de pedidos. Clique na foto para ampliar em tela cheia.',
      },
      {
        emoji: '🖨️',
        titulo: 'Impressão com imagem corrigida',
        descricao: 'A imagem do modelo agora aparece corretamente ao imprimir a ficha do pedido, sem mostrar o código da imagem.',
      },
      {
        emoji: '💰',
        titulo: 'Outros Custos na Precificação corrigido',
        descricao: 'O campo Outros Custos agora salva e recarrega corretamente ao editar uma configuração de produto. Valores adicionados não somem mais.',
      },
      {
        emoji: '📦',
        titulo: 'Embalagens e Rendimento estáveis',
        descricao: 'Corrigimos o bug que fazia embalagens e rendimento dos materiais sumirem ao reeditar uma configuração. Suas configurações agora são preservadas com segurança.',
      },
    ],
  },
  {
    versao: '1.4.0',
    data: '07/04/2026',
    destaque: 'Chat de suporte ao vivo, imagem nos pedidos e calculadora de mão de obra',
    novidades: [
      {
        emoji: '💬',
        titulo: 'Chat de suporte ao vivo',
        descricao: 'Troque mensagens em tempo real com a equipe VPS direto no sistema. Abra um chamado, acompanhe respostas e continue a conversa sem sair do suporte.',
      },
      {
        emoji: '🔔',
        titulo: 'Meus Chamados e Feedbacks',
        descricao: 'Veja todos os seus chamados e feedbacks abertos com histórico completo de respostas da equipe. Chamados concluídos podem ser reabertos com nova mensagem.',
      },
      {
        emoji: '✅',
        titulo: 'Retorno por e-mail ao concluir',
        descricao: 'Ao concluir um chamado ou feedback, você recebe automaticamente um e-mail com a resposta e solução da equipe VPS.',
      },
      {
        emoji: '📸',
        titulo: 'Imagem nos pedidos',
        descricao: 'Anexe a arte ou referência visual em cada pedido com o novo campo personalizado tipo Imagem. Clique na miniatura para visualizar em tela cheia.',
      },
      {
        emoji: '🧮',
        titulo: 'Calculadora de mão de obra',
        descricao: 'Calcule o custo da sua hora de trabalho direto na precificação. Informe o valor por hora e os minutos que leva — o sistema calcula e soma ao custo do produto automaticamente.',
      },
      {
        emoji: '🏷️',
        titulo: 'Tarifas Mercado Livre por peso',
        descricao: 'Cálculo correto das novas tarifas do ML com tabela por peso × faixa de preço. Configure sua tabela em Precificação → Canais → Tarifas ML.',
      },
    ],
  },
  {
    versao: '1.3.0',
    data: '05/04/2026',
    destaque: 'Workflow de produção, filtros avançados e melhorias operacionais',
    novidades: [
      {
        emoji: '🔄',
        titulo: 'Workflow por setor',
        descricao: 'Cada pedido agora passa por Iniciar → Concluir em cada setor. O pedido avança automaticamente para o próximo setor e conclui ao sair do último.',
      },
      {
        emoji: '⚡',
        titulo: 'Ações em massa nos setores',
        descricao: 'Selecione vários pedidos e aplique Iniciar, Concluir, Devolver, Responsável, Data de envio, Campos personalizados e Freelancer de uma vez.',
      },
      {
        emoji: '🔍',
        titulo: 'Filtros avançados',
        descricao: 'Filtro de freelancer em Pedidos e em todos os Setores. Campos personalizados também aparecem como filtro em cada setor.',
      },
      {
        emoji: '👤',
        titulo: 'Freelancer visível nos pedidos',
        descricao: 'A freelancer vinculada aparece destacada no card do pedido e no setor de produção, facilitando o acompanhamento.',
      },
      {
        emoji: '⚙️',
        titulo: 'Config Geral aprimorada',
        descricao: 'Upload de logo do ateliê, segmento do negócio obrigatório com 17 opções, e toggles para ativar Estoque e Demandas na sidebar.',
      },
      {
        emoji: '🏭',
        titulo: 'Fornecedor direto no Material',
        descricao: 'Cadastre um novo fornecedor sem sair do formulário de material — popup inline com retorno automático.',
      },
      {
        emoji: '📊',
        titulo: 'Margem de produtos corrigida',
        descricao: 'O percentual de margem exibido na lista de produtos agora reflete corretamente o valor definido no cadastro.',
      },
    ],
  },
  {
    versao: '1.2.0',
    data: '31/03/2026',
    destaque: 'Impressão de pedidos, Fornecedores e melhorias gerais',
    novidades: [
      {
        emoji: '🖨️',
        titulo: 'Impressão de pedidos',
        descricao: 'Imprima a ficha de qualquer pedido com todos os dados, fluxo de setores e demandas de freelancer. Também é possível imprimir vários pedidos de uma vez.',
      },
      {
        emoji: '🏭',
        titulo: 'Módulo de Fornecedores',
        descricao: 'Cadastre seus fornecedores, registre compras, acompanhe o histórico e avalie cada fornecedor com estrelas.',
      },
      {
        emoji: '👥',
        titulo: 'Gestão de Usuárias',
        descricao: 'Adicione colaboradoras ao sistema com controle de permissões (Admin, Delegadora, Operadora), veja último login e IP de acesso.',
      },
      {
        emoji: '📦',
        titulo: 'Estoque de Materiais',
        descricao: 'Ative o controle de estoque de matérias-primas com alertas de saldo mínimo e integração com os materiais da Precificação.',
      },
      {
        emoji: '🔔',
        titulo: 'Notificações de estoque',
        descricao: 'O sino de notificações agora alerta também sobre materiais zerados ou abaixo do mínimo configurado.',
      },
      {
        emoji: '🗂️',
        titulo: 'Melhorias no módulo de Pedidos',
        descricao: 'Busca aprimorada com filtros por setor, prioridade e datas. Campos personalizados filtráveis e ações em massa mais rápidas.',
      },
    ],
  },
  {
    versao: '1.1.0',
    data: '30/03/2026',
    destaque: 'Lançamento comercial do VPS Gestão',
    novidades: [
      {
        emoji: '🛒',
        titulo: 'Compra automática via Hotmart',
        descricao: 'Ao comprar, sua conta é criada automaticamente e você recebe o acesso por e-mail.',
      },
      {
        emoji: '🤖',
        titulo: 'Bot Telegram com IA',
        descricao: 'Tire dúvidas sobre o sistema a qualquer hora diretamente no Telegram.',
      },
      {
        emoji: '🌙',
        titulo: 'Modo escuro',
        descricao: 'Ative o dark mode pelo menu lateral para proteger seus olhos.',
      },
      {
        emoji: '🎨',
        titulo: 'Tema de cores personalizável',
        descricao: 'Escolha a cor do sistema em Configurações → Geral.',
      },
      {
        emoji: '🔔',
        titulo: 'Notificações inteligentes',
        descricao: 'Alertas de pedidos atrasados, contas a vencer e recebimentos pendentes.',
      },
      {
        emoji: '👑',
        titulo: 'Painel Master Admin',
        descricao: 'Gestão completa de workspaces, usuários e chamados de suporte.',
      },
    ],
  },
  {
    versao: '1.0.0',
    data: '29/03/2026',
    destaque: 'Versão inicial do sistema',
    novidades: [
      {
        emoji: '📦',
        titulo: 'Módulo de Produção',
        descricao: 'Gerencie pedidos e acompanhe a produção pelos seus setores.',
      },
      {
        emoji: '💰',
        titulo: 'Módulo de Precificação',
        descricao: 'Calcule o preço certo para cada canal de venda.',
      },
      {
        emoji: '💳',
        titulo: 'Módulo Financeiro',
        descricao: 'Controle receitas, despesas e metas mensais.',
      },
      {
        emoji: '🧠',
        titulo: 'IA de Gestão',
        descricao: 'Converse com IA que conhece os dados reais do seu negócio.',
      },
    ],
  },
]
