// Lote 21 (item 256): BUSCA DE FUNÇÃO — "o que você quer fazer?". Um índice dos controles do editor (rótulo + sinônimos
// do jeito que a artesã fala → a função da barra e o controle na tela). Digitar "acento", "contorno", "laço", "2 linhas"
// acha o controle; escolher abre a função, a sub-aba e o bloco dele e destaca o controle. Puro (sem DOM).

export interface EntradaBusca {
  rotulo: string
  /** Palavras que a artesã usa para isso (sem acento não importa). */
  sinonimos: string[]
  modo: 'base' | 'tema'
  /** Função da barra de ícones que mostra o controle. */
  funcao: string
  /** Passo da base (funções da base com passo). */
  passo?: number
  /** Seletor do controle na tela (null = só abrir a função). */
  alvo: string | null
}

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** Os controles de dentro dos painéis (as funções da barra entram sozinhas, pelo nome e pela frase). */
export const CONTROLES: EntradaBusca[] = [
  // ── Texto ──
  { rotulo: 'Fonte e tamanho do nome', sinonimos: ['fonte', 'letra', 'tipografia', 'tamanho do nome', 'tamanho da letra', 'font'], modo: 'tema', funcao: 'texto', alvo: '[data-estilo-texto]' },
  { rotulo: 'Cor do nome', sinonimos: ['cor do texto', 'cor da letra', 'cor do nome', 'colorir nome'], modo: 'tema', funcao: 'texto', alvo: '[data-cor-texto]' },
  { rotulo: 'Cor por letra', sinonimos: ['arco iris', 'colorido', 'cada letra uma cor', 'letras coloridas', 'letras brincando'], modo: 'tema', funcao: 'texto', alvo: '[data-cor-por-letra]' },
  { rotulo: 'Acentos (fonte sem acento)', sinonimos: ['acento', 'acento falso', 'til', 'cedilha', 'ç', 'á', 'ã', 'montar acento'], modo: 'tema', funcao: 'texto', alvo: '[data-montar-acentos-caixa]' },
  { rotulo: 'Trocar letra (glifos e alternativas)', sinonimos: ['glifo', 'alternativa', 'letra diferente', 'swash', 'letra enfeitada', 'trocar letra', 'rabinho'], modo: 'tema', funcao: 'texto', alvo: '[data-trocar-letra]' },
  { rotulo: 'Contorno, sombra e brilho do nome', sinonimos: ['contorno', 'borda', 'stroke', 'sombra', 'brilho', 'efeito', '3d', 'glitter', 'neon', 'relevo'], modo: 'tema', funcao: 'texto', alvo: '[data-add-efeito]' },
  { rotulo: 'Estilos prontos (Loja da Naty e meus)', sinonimos: ['preset', 'estilo pronto', 'loja da naty', 'meus estilos', 'salvar estilo'], modo: 'tema', funcao: 'texto', alvo: '[data-presets]' },
  { rotulo: 'Copiar e colar estilo do texto', sinonimos: ['copiar estilo', 'colar estilo', 'mesmo estilo'], modo: 'tema', funcao: 'texto', alvo: '[data-copiar-estilo]' },
  { rotulo: 'Faixa atrás do nome', sinonimos: ['faixa', 'tarja', 'fundo do texto', 'fundo atras do nome', 'retangulo atras'], modo: 'tema', funcao: 'texto', alvo: '[data-fundo-texto]' },
  { rotulo: 'Papel dentro do texto', sinonimos: ['textura no texto', 'papel no nome', 'preencher com papel', 'glitter dentro'], modo: 'tema', funcao: 'texto', alvo: '[data-abrir-preencher-papel]' },
  { rotulo: 'Laço / enfeite preso ao nome', sinonimos: ['laco', 'enfeite', 'coroa', 'orelha', 'hello kitty', 'elemento no nome', 'enfeite na letra'], modo: 'tema', funcao: 'texto', alvo: '[data-abrir-enfeite]' },
  { rotulo: 'Nome em 2 linhas (composto)', sinonimos: ['2 linhas', 'duas linhas', 'nome composto', 'quebrar nome', 'uma linha', '1 linha', 'entrelinha'], modo: 'tema', funcao: 'texto', alvo: '[data-modo-nome]' },
  { rotulo: 'Nome, idade e hashtag de prévia', sinonimos: ['nome de teste', 'idade de teste', 'previa', 'amostra', 'hashtag'], modo: 'tema', funcao: 'texto', alvo: '[data-amostra]' },
  { rotulo: 'Área do nome (onde o nome cabe)', sinonimos: ['area do nome', 'caixa do nome', 'nome nao cabe', 'nome pequeno', 'encolher nome', 'caber'], modo: 'tema', funcao: 'texto', alvo: '[data-area-do-nome]' },
  { rotulo: 'Testar nome longo', sinonimos: ['nome longo', 'nome grande', 'testar nome'], modo: 'tema', funcao: 'texto', alvo: '[data-testar-nome]' },
  { rotulo: 'Formato da idade', sinonimos: ['idade', 'anos', '1 ano', 'formato da idade'], modo: 'tema', funcao: 'texto', alvo: '[data-formato-idade]' },
  // ── Papéis, cor, transição, moldurinha, formas ──
  { rotulo: 'Aplicar papel sem arrastar (pincel e tela cheia)', sinonimos: ['pincel', 'aplicar papel', 'tela cheia', 'buscar papel', 'ampliar papeis', 'trocar papel'], modo: 'tema', funcao: 'papeis', alvo: '[data-abrir-cheia]' },
  { rotulo: 'Adicionar papel à Biblioteca', sinonimos: ['novo papel', 'subir papel', 'importar papel', 'adicionar papel'], modo: 'tema', funcao: 'papeis', alvo: '[data-adicionar-arquivo]' },
  { rotulo: 'Cor lisa na parte', sinonimos: ['cor lisa', 'pintar parte', 'hexa', 'conta gotas', 'cor de fundo'], modo: 'tema', funcao: 'cor', alvo: '[data-painel-cor]' },
  { rotulo: 'Transição entre papéis', sinonimos: ['degrade', 'transicao', 'mesclar papeis', 'esfumar', 'sumir suave'], modo: 'tema', funcao: 'transicao', alvo: '[data-painel-transicao]' },
  { rotulo: 'Transição com cor', sinonimos: ['transicao com cor', 'degrade de cor', 'cor para cor'], modo: 'tema', funcao: 'transicao', alvo: '[data-transicao-cor]' },
  { rotulo: 'Moldurinha / pesponto', sinonimos: ['moldurinha', 'pesponto', 'bordinha', 'costura', 'tracejado', 'moldura'], modo: 'tema', funcao: 'moldurinha', alvo: '[data-painel-molduras]' },
  { rotulo: 'Camadas da parte (ordem, ocultar, travar)', sinonimos: ['camada', 'ordem', 'trazer para frente', 'mandar para tras', 'ocultar', 'travar', 'cadeado'], modo: 'tema', funcao: 'partes', alvo: null },
]

/** Busca no índice (só as entradas do modo aberto). As funções da barra entram pelo nome e pela frase. */
export function buscarFuncao(termo: string, funcoes: { id: string; nome: string; frase: string; passo?: number }[], modo: 'base' | 'tema', max = 8): EntradaBusca[] {
  const q = norm(termo)
  if (q.length < 2) return []
  const tokens = q.split(' ')
  const todas: EntradaBusca[] = [
    ...CONTROLES.filter(c => c.modo === modo && funcoes.some(f => f.id === c.funcao)),
    ...funcoes.map(f => ({ rotulo: f.nome, sinonimos: [f.frase], modo, funcao: f.id, passo: f.passo, alvo: null })),
  ]
  const pontos = (e: EntradaBusca) => {
    const r = norm(e.rotulo), sins = e.sinonimos.map(norm)
    if (r === q || sins.includes(q)) return 100
    if (r.startsWith(q) || sins.some(s => s.startsWith(q))) return 80
    // cada palavra digitada aparece no rótulo ou num sinônimo
    const texto = [r, ...sins].join(' | ')
    if (!tokens.every(t => texto.includes(t))) return 0
    return (r.includes(q) ? 60 : 40) + (e.alvo ? 5 : 0)
  }
  return todas.map(e => ({ e, p: pontos(e) })).filter(x => x.p > 0).sort((a, b) => b.p - a.p).slice(0, max).map(x => x.e)
}
