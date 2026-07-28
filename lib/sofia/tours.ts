// Tours guiados da Sofia — spotlight (driver.js) + navegação entre telas.
// Cada passo: pagina (rota), seletor (data-tour), texto (voz da Sofia), e navegar? (troca de página).
// RESILIENTE: se o elemento não existir na página, o passo vira um balão centralizado (sem quebrar).

export interface PassoTour {
  pagina?: string        // rota onde o passo acontece (se muda de tela)
  seletor?: string       // [data-tour="..."] — se ausente/não achado, balão centralizado
  titulo?: string
  texto: string
}

export interface Tour {
  id: string
  nome: string
  passos: PassoTour[]
}

export const TOURS: Record<string, Tour> = {
  criar_primeiro_pedido: {
    id: 'criar_primeiro_pedido',
    nome: 'Criar seu primeiro pedido',
    passos: [
      { pagina: '/dashboard/pedidos', seletor: '[data-tour="novo-pedido"]', titulo: 'Novo pedido', texto: 'Todo pedido começa aqui. Clica em "Novo pedido" que eu te acompanho 😊' },
      { seletor: '[data-tour="pedido-cliente"]', titulo: 'Quem vai receber', texto: 'Primeiro, quem vai receber — o nome da cliente ou destinatário.' },
      { seletor: '[data-tour="pedido-produto-select"]', titulo: 'O pulo do gato', texto: 'O pulo do gato: escolha o produto em "Selecionar da Precificação". Assim eu já trago as peças e calculo seu lucro ✨' },
      { seletor: '[data-tour="pedido-qtd"]', titulo: 'Quantidade', texto: 'Coloque a quantidade — o valor se ajusta sozinho.' },
      { seletor: '[data-tour="pedido-salvar"]', titulo: 'Salvar', texto: 'Prontinho, é só salvar. Parabéns pelo seu primeiro pedido! 🎉' },
    ],
  },
  precificar_produto: {
    id: 'precificar_produto',
    nome: 'Precificar um produto',
    passos: [
      { pagina: '/precificacao/materiais', seletor: '[data-tour="novo-material"]', titulo: 'Comece pelos materiais', texto: 'Preço bom começa pelos materiais. Bora cadastrar um? (Tecido? Escolhe m² que eu te ajudo com a conta.)' },
      { pagina: '/precificacao/produtos', seletor: '[data-tour="novo-produto"]', titulo: 'Agora o produto', texto: 'Agora o produto — o preço vive nas variações.' },
      { seletor: '[data-tour="produto-custo"]', titulo: 'Custos', texto: 'Some materiais, mão de obra e embalagem. O sistema calcula, relaxa.' },
      { seletor: '[data-tour="produto-canal-taxa"]', titulo: 'Canal e taxa', texto: 'Escolha o canal e a taxa (%). É daqui que sai o preço com a sua margem.' },
      { seletor: '[data-tour="produto-margem"]', titulo: 'Sua margem', texto: 'Olha sua margem real aí 💚 Agora você vende sabendo que ganha.' },
    ],
  },
  acompanhar_producao: {
    id: 'acompanhar_producao',
    nome: 'Acompanhar a produção',
    passos: [
      { pagina: '/dashboard/pedidos', seletor: '[data-tour="pedidos-status"]', titulo: 'Seus pedidos por etapa', texto: 'Aqui ficam todos os seus pedidos. Por este filtro você vê por etapa: aberto, em produção, pronto e enviado 😊' },
      { seletor: '[data-tour="novo-pedido"]', titulo: 'Sempre à mão', texto: 'E o "Novo pedido" fica sempre aqui do lado quando entrar encomenda nova.' },
      { titulo: 'Setor a setor', texto: 'Clica num pedido pra ver os detalhes e ir movendo ele pelos seus setores (Arte, Impressão, Montagem…) até sair. Você acompanha tudo por aqui 💛' },
    ],
  },
  montar_loja: {
    id: 'montar_loja',
    nome: 'Montar sua loja',
    passos: [
      { pagina: '/config/loja', seletor: '[data-tour="loja-link"]', titulo: 'Seu link', texto: 'Sua loja tem um link só seu. Vamos deixar com a sua cara — logo e cor.' },
      { seletor: '[data-tour="loja-frete-ativar"]', titulo: 'Frete e ativar', texto: 'Defina o frete e ative. Dá pra desativar quando quiser, fica tranquila.' },
      { pagina: '/config/loja/vitrine', seletor: '[data-tour="vitrine-produtos"]', titulo: 'Vitrine', texto: 'Escolha os produtos da vitrine — e capricha nas fotos (até 10).' },
      { seletor: '[data-tour="vitrine-variacoes"]', titulo: 'Opções', texto: 'Se tem tamanho/quantidade, monte as opções — o preço muda sozinho pra cliente, tipo Shopee 😍' },
      { titulo: 'No ar!', texto: 'Pronto — sua loja tá no ar! É só mandar o link pras clientes. Arrasou! 🎉' },
    ],
  },
}

export function getTour(id: string): Tour | null {
  return TOURS[id] || null
}
