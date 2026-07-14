// Fonte ÚNICA dos depoimentos das landings (/30dias, /15dias, futuras). Não duplicar em página.
// Para ADICIONAR um depoimento em texto: inclua no array DEPOIMENTOS_TEXTO.
// Para um depoimento em imagem (print): solte o arquivo em /public e cite em DEPOIMENTOS_IMG.

export interface DepoimentoTexto {
  nome: string
  contexto?: string   // cidade/nicho, se houver
  texto: string
  foto?: string       // caminho em /public, opcional
}

export const DEPOIMENTOS_IMG: string[] = [
  '/depoimento-1.jpeg',
  '/depoimento-2.jpeg',
  '/depoimento-3.jpeg',
]

export const DEPOIMENTOS_TEXTO: DepoimentoTexto[] = [
  // { nome: 'Rebecca B.', contexto: 'Ateliê · Cidade', texto: '...', foto: '/depoimentos/rebecca.jpeg' },
  // { nome: 'David S.',   contexto: 'Ateliê · Cidade', texto: '...' },
]
