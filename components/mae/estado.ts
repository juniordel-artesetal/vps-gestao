'use client'
// Estado da TELA do Método MAE (fora do histórico): modo (base / tema / imagem), passo do assistente,
// parte ativa, face de contexto, camada do tema selecionada e a escolha "Todas × Só nesta caixa".
import { create } from 'zustand'
import type { Identidade } from './arquivosMae'
import type { InfoTexto } from '@/lib/mae/texto/noTexto'

export type ModoEditor = 'base' | 'tema' | 'imagem'
export const PASSOS = ['Moldes', 'Pranchetas', 'Faces', 'Partes', 'Enquadramento', 'Nome e textos', 'Identidade', 'Arte inteligente', 'Salvar'] as const
export type Escopo = 'parte' | 'face'

export interface EstadoEditor {
  modo: ModoEditor
  /** Passo do assistente da base (1 a 9). */
  passo: number
  parteAtiva: string | null
  /** Face clicada (contexto de "Só nesta caixa" e do enquadramento). */
  face: string | null
  /** Camada do tema selecionada. */
  camada: string | null
  /** Escolha "Todas as FRENTES" × "Só nesta caixa" (null = perguntar). */
  escopo: Escopo | null
  lembrarEscopo: boolean
  /** Ação esperando a resposta "Todas × Só nesta caixa". */
  pergunta: { aplicar: (e: Escopo) => void; parte: string } | null
  /** Papel quadriculado de teste nas faces das partes (modo base). */
  grade: boolean
  /** Passo 6 e 7: o que o próximo clique numa face/molde posiciona. */
  posicionar: { tipo: 'texto'; variavel: string } | { tipo: 'logo' | 'qr' } | null
  slot: string | null
  /** Lote 1: logo ou QR selecionado no passo Identidade (caixa de transformação). */
  identSel: { moldeId: string; k: 'logo' | 'qr' } | null
  /** Lote 1: prancheta selecionada (menu rápido: girar, redimensionar, duplicar, excluir). */
  prancheta: string | null
  /** Lote 2 (item 16): menu do botão direito sobre um elemento do tema (posição na tela + camada). */
  /** Menu do botão direito sobre um objeto do tema. Lote 10 (item 152): `texto` = id da posição (aí `camada` = ''). */
  menuCamada: { x: number; y: number; camada: string; texto?: string } | null
  /** Lote 10 (item 153): aviso rápido no palco (ex.: "Espelhar não vale para texto."), some sozinho. */
  avisoRapido: string | null
  /** Lote 9 (itens 137/148): camada do tema copiada (Ctrl+C / Ctrl+X) — com o ajuste "só nesta caixa" dela, se tiver. */
  areaCamada: { camada: unknown; ajuste: unknown | null; parte?: string | null } | null
  /** Lote 9 (item 145): o ESTILO copiado (Ctrl+Alt+C) — vale entre caixas e entre temas (fica no editor). */
  estiloCopiado: import('@/lib/mae/editor/estiloCopiado').EstiloCopiado | null
  /** Lote 9 (item 145): a janela "Colar estilo…" (escolher o que colar) aberta. */
  colarEstiloAberto: boolean
  /** Lote 9 (item 147): o estilo de texto em edição quando NÃO é o do texto selecionado (frase, idade do bloco).
   *  null = o do texto selecionado. A barra de cima, o painel Texto e o Camadas leem daqui (antes cada um tinha o seu). */
  variavelTexto: string | null
  /** Lote 9 (item 142): GRUPO selecionado na arte/Camadas (move, gira e redimensiona junto). */
  grupoSel: string | null
  /** Lote 9 (item 142): itens a mais na seleção (Shift + clique na arte, Ctrl + clique no Camadas) — para agrupar. */
  multiSel: { tipo: 'camada' | 'texto'; id: string }[]
  /** Lote 9 (item 142): onde cada "logo atrás do nome" (opção que saiu) é desenhada hoje — para converter em elemento. */
  logosTexto: { slotId: string; artboardId: string; matrix: [number, number, number, number, number, number] }[]
  /** Lote 9 (item 148): lista de atalhos ("?") aberta. */
  atalhos: boolean
  /** Lote 2 (item 24): função aberta na barra de ícones da esquerda (null = painel fechado). */
  funcao: string | null
  /** Lote 3 (item 36): pedido de um botão da barra do topo para um painel ('abrir-tema', 'abrir-design'…). */
  pedidoTopo: string | null
  /** Lote 3 (item 34): várias partes selecionadas no Tema (Ctrl+clique, retângulo, Ctrl+A); [] = só a ativa. */
  partesSel: string[]
  /** Última prévia: quanto levou (ms) desde a mudança e quando terminou (performance.now()). */
  /** Lote 9 (item 135): tempo total + quebra (recalcular a arte na tela × desenhar no motor) e quantas foram redesenhadas. */
  previa: { ms: number; em: number; folhas: number; resolverMs?: number; desenhoMs?: number; redesenhadas?: number } | null
  /** Identidade do Ateliê lida da Biblioteca (logo, QR, @). */
  identidade: Identidade
  /** Resultado da última diagramação dos textos (avisos do auto-ajuste, fonte substituta). */
  textos: InfoTexto[]
  /** Editor de imagem (Sprint 13): página (prancheta) em edição; null = a primeira. */
  pagina: string | null
  /** Lote 6 (item 104): face que acende na arte (passar o mouse no "juntar com…"). */
  realce: string | null
  /** Lote 8 (item 122): prévia da fonte (passar o mouse na lista) — só de tela, fora do histórico. */
  /** Lote 9 (itens 135/136): camada sendo ARRASTADA na arte — some das pranchetas e a foto dela segue o mouse; depois
   *  de soltar (`soltou`), a foto fica no lugar novo até a prévia chegar (sem piscar). */
  arrastando: { camada: string; soltou: boolean; soltouEm?: number } | null
  previaFonte: { variavel: string; font: { postscriptName: string; family?: string; source: 'local' | 'google'; url?: string } } | null
  set: (p: Partial<EstadoEditor>) => void
}

const lembrado = (): Escopo | null => { try { const v = localStorage.getItem('mae:escopo'); return v === 'parte' || v === 'face' ? v : null } catch { return null } }

export const useEditor = create<EstadoEditor>()(set => ({
  modo: 'base', passo: 1, parteAtiva: null, face: null, camada: null,
  escopo: lembrado(), lembrarEscopo: lembrado() !== null, pergunta: null,
  grade: true, posicionar: null, slot: null, identSel: null, prancheta: null, menuCamada: null, avisoRapido: null, areaCamada: null, estiloCopiado: null, colarEstiloAberto: false, atalhos: false, variavelTexto: null, grupoSel: null, multiSel: [], logosTexto: [], funcao: null, pedidoTopo: null, partesSel: [], previa: null, identidade: {}, textos: [], pagina: null, realce: null, arrastando: null, previaFonte: null,
  set: p => set(p),
}))

/** Executa uma edição vinculada respeitando a escolha (pergunta se ainda não houver). */
export function comEscopo(nomeParte: string, aplicar: (e: Escopo) => void, forcar?: Escopo) {
  const st = useEditor.getState()
  if (forcar) return aplicar(forcar)
  if (!st.face) return aplicar('parte')
  if (st.escopo) return aplicar(st.escopo)
  st.set({ pergunta: { aplicar, parte: nomeParte } })
}

export function responderEscopo(e: Escopo, lembrar: boolean) {
  const st = useEditor.getState()
  const p = st.pergunta
  st.set({ pergunta: null, escopo: lembrar ? e : st.escopo, lembrarEscopo: lembrar })
  try { if (lembrar) localStorage.setItem('mae:escopo', e) } catch { /* sem armazenamento */ }
  p?.aplicar(e)
}

/** Lote 9 (item 148): teclas seguradas agora (Espaço = mão: arrastar move a vista, mesmo em cima de um objeto). */
export const teclasMae = { espaco: false }

/** Lote 10 (item 153): mostra um aviso rápido no palco por ~2,5 s. */
let tAviso: ReturnType<typeof setTimeout> | null = null
export function avisar(msg: string) {
  useEditor.getState().set({ avisoRapido: msg })
  if (tAviso) clearTimeout(tAviso)
  tAviso = setTimeout(() => { if (useEditor.getState().avisoRapido === msg) useEditor.getState().set({ avisoRapido: null }) }, 2500)
}
