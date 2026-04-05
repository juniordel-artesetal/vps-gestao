// Versão atual do sistema
// Atualizar aqui a cada nova versão
export const VERSAO_ATUAL = '1.3.0'

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
