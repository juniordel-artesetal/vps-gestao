// Versão atual do sistema
// Atualizar aqui a cada nova versão
export const VERSAO_ATUAL = '1.1.0'

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
    versao: '1.1.0',
    data: '30/03/2026',
    destaque: 'Lançamento comercial do VPS Gestão',
    novidades: [
      { emoji: '🛒', titulo: 'Compra automática via Hotmart', descricao: 'Ao comprar, sua conta é criada automaticamente e você recebe o acesso por e-mail.' },
      { emoji: '🤖', titulo: 'Bot Telegram com IA', descricao: 'Tire dúvidas sobre o sistema a qualquer hora diretamente no Telegram.' },
      { emoji: '🌙', titulo: 'Modo escuro', descricao: 'Ative o dark mode pelo menu lateral para proteger seus olhos.' },
      { emoji: '🎨', titulo: 'Tema de cores personalizável', descricao: 'Escolha a cor do sistema em Configurações → Geral.' },
      { emoji: '🔔', titulo: 'Notificações inteligentes', descricao: 'Alertas de pedidos atrasados, contas a vencer e recebimentos pendentes.' },
      { emoji: '👑', titulo: 'Painel Master Admin', descricao: 'Gestão completa de workspaces, usuários e chamados de suporte.' },
    ],
  },
  {
    versao: '1.0.0',
    data: '29/03/2026',
    destaque: 'Versão inicial do sistema',
    novidades: [
      { emoji: '📦', titulo: 'Módulo de Produção', descricao: 'Gerencie pedidos e acompanhe a produção pelos seus setores.' },
      { emoji: '💰', titulo: 'Módulo de Precificação', descricao: 'Calcule o preço certo para cada canal de venda.' },
      { emoji: '💳', titulo: 'Módulo Financeiro', descricao: 'Controle receitas, despesas e metas mensais.' },
      { emoji: '🧠', titulo: 'IA de Gestão', descricao: 'Converse com IA que conhece os dados reais do seu negócio.' },
    ],
  },
]
