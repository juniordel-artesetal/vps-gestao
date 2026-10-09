'use client'
'use no memo'
// PAINEL DE FUNÇÕES (Lote 2, item 24) — padrão Photoshop/Canva: uma BARRA DE ÍCONES fixa na esquerda (uma
// função por ícone); o clique abre ao lado SÓ o painel daquela função (clicar de novo fecha), com o ícone
// ativo destacado e a dica de cada um. O painel da DIREITA fica com as PROPRIEDADES do que está selecionado.
// Os painéis existentes (Base, Tema, Exportar…) continuam um componente só: cada parte deles fica dentro de
// <Secao ids={[…]}>, que aparece quando a função dela está aberta. O MAE lembra o último painel por aba.
import { createContext, useContext, useEffect, type ReactNode } from 'react'
import OpcoesFerramenta from './OpcoesFerramenta'
import { FileUp, LayoutGrid, Shapes, Puzzle, Crop, Type, IdCard, Wand2, Save, Crosshair, Image as ImagemIc, Sticker, Palette, Layers, Frame, Blend, Box, Printer, Store, FileImage, Square, FolderTree, Grid3x3 } from 'lucide-react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useEditor, type ModoEditor } from './estado'

export interface Funcao { id: string; nome: string; frase: string; Icone: typeof FileUp; passo?: number }

export const FUNCOES: Record<Exclude<ModoEditor, 'imagem'>, Funcao[]> = {
  base: [
    { id: 'passo-1', passo: 1, nome: 'Moldes', frase: 'Importe os moldes (PDF, SVG, DXF, imagem), a lista e a posição na prancheta.', Icone: FileUp },
    { id: 'folhas', passo: 1, nome: 'Folhas de impressão', frase: 'Peças pequenas (rótulo, adesivo, etiqueta) montadas numa folha, com a marca de registro.', Icone: Grid3x3 },
    { id: 'grupos', passo: 1, nome: 'Grupos de produto', frase: 'Base de portfólio: cada grupo de moldes é um produto do SOA (Kit Festa, Sacola P, Tag…).', Icone: FolderTree },
    { id: 'passo-2', passo: 2, nome: 'Pranchetas', frase: 'As folhas da área de trabalho: tamanho, orientação e posição.', Icone: LayoutGrid },
    { id: 'passo-3', passo: 3, nome: 'Faces', frase: 'As faces de cada molde (laço, dividir, unir, furos).', Icone: Shapes },
    { id: 'passo-4', passo: 4, nome: 'Partes', frase: 'Agrupe as faces iguais (FRENTE, LATERAL…) para a arte valer em todas.', Icone: Puzzle },
    { id: 'passo-5', passo: 5, nome: 'Enquadramento', frase: 'Como a arte da parte cabe em cada face.', Icone: Crop },
    { id: 'passo-6', passo: 6, nome: 'Nome e textos', frase: 'Onde ficam NOME, IDADE, HASHTAG e @ em cada molde.', Icone: Type },
    { id: 'passo-7', passo: 7, nome: 'Identidade', frase: 'Logo, QR e @ do ateliê nos moldes.', Icone: IdCard },
    { id: 'passo-8', passo: 8, nome: 'Arte inteligente', frase: 'Sobra da impressão e o papel das abas.', Icone: Wand2 },
    { id: 'marcas', nome: 'Marca de registro', frase: 'A marca da máquina de corte em cada prancheta.', Icone: Crosshair },
    { id: 'passo-9', passo: 9, nome: 'Salvar', frase: 'Dê nome e salve a base na Biblioteca.', Icone: Save },
  ],
  tema: [
    { id: 'papeis', nome: 'Papéis', frase: 'Os papéis de fundo — arraste para uma parte ou face.', Icone: ImagemIc },
    { id: 'elementos', nome: 'Elementos', frase: 'Os elementos com fundo transparente.', Icone: Sticker },
    { id: 'cor', nome: 'Cor', frase: 'Preencha a parte com uma cor lisa (hexa, conta-gotas, paleta).', Icone: Palette },
    { id: 'partes', nome: 'Camadas', frase: 'As partes do kit e as camadas de cada uma.', Icone: Layers },
    { id: 'texto', nome: 'Texto', frase: 'Fonte, tamanho, estilos e efeitos do nome, idade e hashtag.', Icone: Type },
    { id: 'moldurinha', nome: 'Moldurinha', frase: 'Bordinha interna na face (contínua ou pesponto).', Icone: Frame },
    { id: 'transicao', nome: 'Transição', frase: 'O 2º papel aparece por cima e some suavemente.', Icone: Blend },
    { id: 'formas', nome: 'Formas', frase: 'Retângulo, elipse, polígono, estrela, coração, linha e caneta.', Icone: Square },
    { id: 'apliques', nome: 'Apliques 3D', frase: 'Folhas de impressos e silhuetas dos apliques.', Icone: Box },
    { id: 'marcas', nome: 'Marca de registro', frase: 'A marca da máquina de corte em cada prancheta.', Icone: Crosshair },
    { id: 'exportar', nome: 'Exportar', frase: 'Arte pra aprovação e arquivo pra impressão.', Icone: Printer },
    { id: 'pronto', nome: 'Tema pronto', frase: 'Já tem a arte pronta (PDF/PNG)? Cadastre e ponha nome, idade e hashtag em massa.', Icone: FileImage },
    { id: 'loja', nome: 'Loja da Naty', frase: 'Packs de temas prontos.', Icone: Store },
  ],
}

const CHAVE = (m: string) => `mae:funcao:${m}`
const PADRAO: Record<string, string> = { base: 'passo-1', tema: 'partes' }
/** "Painel clássico" (tudo empilhado, como antes) — só para quem prefere (e para os testes antigos). */
export const painelClassico = () => { try { return localStorage.getItem('mae:painel-classico') === '1' } catch { return false } }

/** Lado do painel onde a seção está: funções (esquerda), propriedades (direita) ou tudo (clássico). */
export type Lado = 'funcoes' | 'propriedades' | 'tudo'
const LadoCtx = createContext<Lado>('tudo')
export const LadoPainel = ({ lado, children }: { lado: Lado; children: ReactNode }) => <LadoCtx.Provider value={lado}>{children}</LadoCtx.Provider>
export const useLado = () => useContext(LadoCtx)

/**
 * Parte de um painel ligada a funções. `ids` = funções em que ela aparece ('*' = sempre, no lado das
 * funções); `props` = ela é PROPRIEDADE da seleção (vai para a direita).
 */
export function Secao({ ids, props, children }: { ids?: string[]; props?: boolean; children: ReactNode }) {
  const lado = useLado()
  const funcao = useEditor(s => s.funcao)
  if (lado === 'tudo') return <>{children}</>
  if (props) return lado === 'propriedades' ? <>{children}</> : null
  if (lado !== 'funcoes') return null
  if (!ids || ids.includes('*') || (funcao && ids.includes(funcao))) return <>{children}</>
  return null
}

/** A barra de ícones da esquerda (Base e Tema). */
export function BarraFuncoes({ modo }: { modo: Exclude<ModoEditor, 'imagem'> }) {
  const funcao = useEditor(s => s.funcao)
  // ao entrar na aba: o último painel aberto nela (ou o padrão)
  useEffect(() => {
    let f: string | null = PADRAO[modo]
    try { const v = localStorage.getItem(CHAVE(modo)); if (v !== null) f = v || null } catch { /* sem storage */ }
    const fn = FUNCOES[modo].find(x => x.id === f)
    useEditor.getState().set({ funcao: fn ? fn.id : null, ...(fn?.passo ? { passo: fn.passo } : {}) })
  }, [modo])
  const abrir = (fn: Funcao) => {
    const nova = funcao === fn.id ? null : fn.id
    useEditor.getState().set({ funcao: nova, ...(nova && fn.passo ? { passo: fn.passo } : {}) })
    try { localStorage.setItem(CHAVE(modo), nova ?? '') } catch { /* sem storage */ }
  }
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-2 overflow-y-auto" data-barra-funcoes>
      {FUNCOES[modo].map(fn => (
        <button key={fn.id} onClick={() => abrir(fn)} aria-label={fn.nome} aria-pressed={funcao === fn.id}
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${funcao === fn.id ? 'bg-orange-500 text-white shadow' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700 dark:text-gray-300'}`}
          title={`${fn.nome} — ${fn.frase}`} data-funcao={fn.id}>
          <fn.Icone className="w-4.5 h-4.5" />
        </button>
      ))}
    </nav>
  )
}

/**
 * Lote 4 (item 39): BARRA DE OPÇÕES no topo (padrão Photoshop) — a ferramenta escolhida, a dica dela e as
 * opções rápidas: no Tema, com uma camada selecionada, "Todas as caixas da parte × Só nesta caixa".
 */
export function BarraOpcoes({ modo }: { modo: Exclude<ModoEditor, 'imagem'> }) {
  const funcao = useEditor(s => s.funcao)
  const camada = useEditor(s => s.camada)
  const escopo = useEditor(s => s.escopo)
  // Lote 5 (item 69): o nome da caixa (molde) que está sendo editada sozinha
  const faceCtx = useEditor(s => s.face)
  const caixa = useMaeDoc(s => faceCtx ? s.hist.atual.molds.find(m => m.faces.some(f => f.id === faceCtx))?.name ?? null : null)
  const fn = FUNCOES[modo].find(x => x.id === funcao)
  const b = (on: boolean) => `rounded-md border px-2 py-0.5 text-[11px] ${on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 dark:border-gray-700 hover:border-orange-400'}`
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 px-3 py-1 text-[11px] text-gray-600 dark:text-gray-300 min-h-[30px]" data-barra-opcoes>
      {fn ? <><fn.Icone className="w-3.5 h-3.5 text-orange-500 shrink-0" /><b className="text-gray-800 dark:text-gray-100 shrink-0" title={fn.frase}>{fn.nome}</b></>
        : <span className="text-gray-400">Escolha uma ferramenta na barra da esquerda.</span>}
      {/* as opções principais da ferramenta / do que está selecionado */}
      <span className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
      <OpcoesFerramenta modo={modo} />
      {modo === 'tema' && (camada || (escopo === 'face' && caixa)) && (
        <span className="ml-auto flex items-center gap-1" data-opcoes-escopo>
          {escopo === 'face' && caixa
            ? <b className="rounded-md bg-amber-100 text-amber-900 px-2 py-0.5" data-editando-so>Editando só: {caixa}</b>
            : <span>Editar em:</span>}
          <button className={b(escopo !== 'face')} onClick={() => useEditor.getState().set({ escopo: 'parte' })}>Todas as caixas da parte</button>
          <button className={b(escopo === 'face')} onClick={() => useEditor.getState().set({ escopo: 'face' })}>Só nesta caixa</button>
        </span>
      )}
      <span className={`${modo === 'tema' && (camada || (escopo === 'face' && caixa)) ? '' : 'ml-auto'} text-gray-400 hidden 2xl:inline`}>Tab: esconder/mostrar os painéis</span>
    </div>
  )
}

/** Nome da função aberta (cabeçalho do painel). */
export function TituloFuncao({ modo }: { modo: Exclude<ModoEditor, 'imagem'> }) {
  const funcao = useEditor(s => s.funcao)
  const fn = FUNCOES[modo].find(x => x.id === funcao)
  if (!fn) return null
  return <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white" data-titulo-funcao><fn.Icone className="w-4 h-4 text-orange-500" /> {fn.nome}</p>
}
