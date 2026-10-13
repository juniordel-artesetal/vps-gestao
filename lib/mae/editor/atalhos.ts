// MAE — ATALHOS DE TECLADO (Lote 9, item 148): FONTE ÚNICA. Daqui saem o teclado do editor (EditorMae), os
// rótulos dos menus/dicas e a lista do "?". Padrão Photoshop sempre que existe equivalente (quem usa o MAE vem dele).
// Puro: `atalhoDoEvento` só traduz a tecla na AÇÃO; quem decide se ela vale no momento (aba, seleção) é o editor.
//   Regras: nada dispara num campo de digitação (o editor filtra); tudo que altera entra no Ctrl+Z.

export type AcaoAtalho =
  | 'desfazer' | 'refazer' | 'salvar' | 'salvarComo'
  | 'copiar' | 'recortar' | 'colar' | 'duplicar'
  | 'copiarEstilo' | 'colarEstilo'
  | 'excluir' | 'selecionarTudo' | 'desselecionar'
  | 'espelharH' | 'espelharV'
  | 'frente' | 'tras' | 'topo' | 'fundo'
  | 'agrupar' | 'desagrupar' | 'mascaraCorte'
  | 'cadeado' | 'olho'
  | 'zoomMais' | 'zoomMenos' | 'ajustar' | 'tamanhoReal'
  | 'ajuda'

export interface Atalho {
  acao: AcaoAtalho
  /** Como aparece para a usuária (menus, dicas, lista do "?"). */
  teclas: string
  rotulo: string
  grupo: 'Geral' | 'Editar' | 'Camadas' | 'Vista'
  /** Exemplo do evento (para os testes e para conferir a tabela). */
  ex: { key: string; code?: string; ctrl?: boolean; shift?: boolean; alt?: boolean }
}

export const ATALHOS: Atalho[] = [
  { acao: 'desfazer', teclas: 'Ctrl+Z', rotulo: 'Desfazer', grupo: 'Geral', ex: { key: 'z', ctrl: true } },
  { acao: 'refazer', teclas: 'Ctrl+Shift+Z ou Ctrl+Y', rotulo: 'Refazer', grupo: 'Geral', ex: { key: 'y', ctrl: true } },
  { acao: 'salvar', teclas: 'Ctrl+S', rotulo: 'Salvar (a base, o tema ou o design aberto)', grupo: 'Geral', ex: { key: 's', ctrl: true } },
  { acao: 'salvarComo', teclas: 'Ctrl+Shift+S', rotulo: 'Salvar como… (cópia com outro nome)', grupo: 'Geral', ex: { key: 'S', ctrl: true, shift: true } },
  { acao: 'ajuda', teclas: '?', rotulo: 'Lista de atalhos', grupo: 'Geral', ex: { key: '?', shift: true } },
  { acao: 'copiar', teclas: 'Ctrl+C', rotulo: 'Copiar o objeto', grupo: 'Editar', ex: { key: 'c', code: 'KeyC', ctrl: true } },
  { acao: 'recortar', teclas: 'Ctrl+X', rotulo: 'Recortar o objeto', grupo: 'Editar', ex: { key: 'x', code: 'KeyX', ctrl: true } },
  { acao: 'colar', teclas: 'Ctrl+V', rotulo: 'Colar (na mesma posição, na caixa de destino)', grupo: 'Editar', ex: { key: 'v', code: 'KeyV', ctrl: true } },
  { acao: 'duplicar', teclas: 'Ctrl+J ou Alt + arrastar', rotulo: 'Duplicar', grupo: 'Editar', ex: { key: 'j', code: 'KeyJ', ctrl: true } },
  { acao: 'copiarEstilo', teclas: 'Ctrl+Alt+C', rotulo: 'Copiar estilo', grupo: 'Editar', ex: { key: 'c', code: 'KeyC', ctrl: true, alt: true } },
  { acao: 'colarEstilo', teclas: 'Ctrl+Alt+V', rotulo: 'Colar estilo', grupo: 'Editar', ex: { key: 'v', code: 'KeyV', ctrl: true, alt: true } },
  { acao: 'excluir', teclas: 'Delete ou Backspace', rotulo: 'Excluir', grupo: 'Editar', ex: { key: 'Delete' } },
  { acao: 'selecionarTudo', teclas: 'Ctrl+A', rotulo: 'Selecionar tudo', grupo: 'Editar', ex: { key: 'a', ctrl: true } },
  { acao: 'desselecionar', teclas: 'Ctrl+D', rotulo: 'Desselecionar', grupo: 'Editar', ex: { key: 'd', ctrl: true } },
  { acao: 'espelharH', teclas: 'Shift+H', rotulo: 'Espelhar na horizontal', grupo: 'Editar', ex: { key: 'H', shift: true } },
  { acao: 'espelharV', teclas: 'Shift+V', rotulo: 'Espelhar na vertical', grupo: 'Editar', ex: { key: 'V', shift: true } },
  { acao: 'frente', teclas: 'Ctrl+]', rotulo: 'Trazer para frente', grupo: 'Camadas', ex: { key: ']', ctrl: true } },
  { acao: 'tras', teclas: 'Ctrl+[', rotulo: 'Enviar para trás', grupo: 'Camadas', ex: { key: '[', ctrl: true } },
  { acao: 'topo', teclas: 'Ctrl+Shift+]', rotulo: 'Trazer para o topo', grupo: 'Camadas', ex: { key: '}', ctrl: true, shift: true } },
  { acao: 'fundo', teclas: 'Ctrl+Shift+[', rotulo: 'Enviar para o fundo', grupo: 'Camadas', ex: { key: '{', ctrl: true, shift: true } },
  { acao: 'agrupar', teclas: 'Ctrl+G', rotulo: 'Agrupar', grupo: 'Camadas', ex: { key: 'g', code: 'KeyG', ctrl: true } },
  { acao: 'desagrupar', teclas: 'Ctrl+Shift+G', rotulo: 'Desagrupar', grupo: 'Camadas', ex: { key: 'G', code: 'KeyG', ctrl: true, shift: true } },
  { acao: 'mascaraCorte', teclas: 'Ctrl+Alt+G', rotulo: 'Máscara de corte', grupo: 'Camadas', ex: { key: 'g', code: 'KeyG', ctrl: true, alt: true } },
  { acao: 'cadeado', teclas: 'Ctrl+/', rotulo: 'Travar / destravar (cadeado)', grupo: 'Camadas', ex: { key: '/', code: 'Slash', ctrl: true } },
  { acao: 'olho', teclas: 'Ctrl+,', rotulo: 'Ocultar / mostrar (olho)', grupo: 'Camadas', ex: { key: ',', code: 'Comma', ctrl: true } },
  { acao: 'zoomMais', teclas: 'Ctrl + +', rotulo: 'Aproximar (também Ctrl + roda do mouse)', grupo: 'Vista', ex: { key: '=', ctrl: true } },
  { acao: 'zoomMenos', teclas: 'Ctrl + −', rotulo: 'Afastar', grupo: 'Vista', ex: { key: '-', ctrl: true } },
  { acao: 'ajustar', teclas: 'Ctrl+0', rotulo: 'Ajustar à tela', grupo: 'Vista', ex: { key: '0', ctrl: true } },
  { acao: 'tamanhoReal', teclas: 'Ctrl+1', rotulo: 'Tamanho real', grupo: 'Vista', ex: { key: '1', ctrl: true } },
]

/** Atalhos sem tecla própria (gestos), só para a lista do "?". */
export const GESTOS: { teclas: string; rotulo: string; grupo: Atalho['grupo'] }[] = [
  { teclas: 'Clicar e arrastar', rotulo: 'Selecionar e mover direto na arte', grupo: 'Editar' },
  { teclas: 'Alt + clique', rotulo: 'Pegar a camada de baixo (sob o cursor)', grupo: 'Camadas' },
  { teclas: 'Setas / Shift + setas', rotulo: 'Mover fino / 10×', grupo: 'Editar' },
  { teclas: 'Alças + Shift', rotulo: 'Girar de 15° em 15°', grupo: 'Editar' },
  { teclas: 'Alças + Alt', rotulo: 'Redimensionar a partir do centro', grupo: 'Editar' },
  { teclas: 'Ctrl + clique / Ctrl + arrastar', rotulo: 'Selecionar várias partes', grupo: 'Editar' },
  { teclas: 'Espaço + arrastar', rotulo: 'Mão (mover a vista)', grupo: 'Vista' },
  { teclas: 'Tab', rotulo: 'Esconder / mostrar os painéis', grupo: 'Vista' },
]

export interface EventoTecla { key: string; code?: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean }

/** Ctrl+] / Ctrl+[ pela TECLA digitada (no ABNT2 a posição física é outra); com Shift o navegador manda } e {. */
function colchete(e: EventoTecla): 'sobe' | 'desce' | null {
  if (e.key === ']' || e.key === '}') return 'sobe'
  if (e.key === '[' || e.key === '{') return 'desce'
  if (e.code === 'BracketRight' && !e.key.match(/^[a-zA-Z0-9]$/)) return 'sobe'
  if (e.code === 'BracketLeft' && !e.key.match(/^[a-zA-Z0-9]$/)) return 'desce'
  return null
}

/** A AÇÃO da tecla (ou null). Letras pela tecla física (`code`) com Ctrl+Alt (o AltGr do Windows troca a letra). */
export function atalhoDoEvento(e: EventoTecla): AcaoAtalho | null {
  const ctrl = !!(e.ctrlKey || e.metaKey), sh = !!e.shiftKey, alt = !!e.altKey
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const letra = (l: string) => k === l || e.code === `Key${l.toUpperCase()}`
  if (ctrl) {
    if (alt && letra('c')) return 'copiarEstilo'
    if (alt && letra('v')) return 'colarEstilo'
    if (alt && letra('g')) return 'mascaraCorte'
    if (alt) return null
    if (letra('z')) return sh ? 'refazer' : 'desfazer'
    if (letra('y')) return 'refazer'
    if (letra('s')) return sh ? 'salvarComo' : 'salvar'
    if (letra('g')) return sh ? 'desagrupar' : 'agrupar'
    if (sh) {
      const c = colchete(e)
      return c === 'sobe' ? 'topo' : c === 'desce' ? 'fundo' : null
    }
    if (letra('c')) return 'copiar'
    if (letra('x')) return 'recortar'
    if (letra('v')) return 'colar'
    if (letra('j')) return 'duplicar'
    if (letra('a')) return 'selecionarTudo'
    if (letra('d')) return 'desselecionar'
    if (k === '/' || e.code === 'Slash' || e.code === 'IntlRo') return 'cadeado'
    if (k === ',' || e.code === 'Comma') return 'olho'
    if (k === '=' || k === '+') return 'zoomMais'
    if (k === '-') return 'zoomMenos'
    if (k === '0') return 'ajustar'
    if (k === '1') return 'tamanhoReal'
    const c = colchete(e)
    return c === 'sobe' ? 'frente' : c === 'desce' ? 'tras' : null
  }
  if (alt) return null
  if (k === 'Delete' || k === 'Backspace') return 'excluir'
  if (sh && letra('h')) return 'espelharH'
  if (sh && letra('v')) return 'espelharV'
  if (k === '?') return 'ajuda'
  return null
}

/** As teclas de uma ação (menus e dicas mostram sempre a mesma coisa que o teclado faz). */
export const teclasDe = (a: AcaoAtalho): string => ATALHOS.find(x => x.acao === a)?.teclas ?? ''

// ── Lote 10 (item 153): O QUE VALE PARA CADA OBJETO ──────────────────────────────────────────────────────────────
// Nenhum atalho ou item de menu pode "não fazer nada": se a ação não serve para o objeto selecionado, o menu não
// mostra o item e o atalho avisa ("Espelhar não vale para texto"). Ações fora desta tabela (desfazer, zoom, salvar…)
// valem sempre. Os testes (atalhos.test.ts + fabtest/ui_mae_menus.mts) percorrem esta tabela.
export type TipoObjeto = 'texto' | 'elemento' | 'aplique' | 'forma' | 'papel' | 'cor' | 'moldurinha' | 'grupo'
export const TIPOS_OBJETO: TipoObjeto[] = ['texto', 'elemento', 'aplique', 'forma', 'papel', 'cor', 'moldurinha', 'grupo']
export const NOME_TIPO: Record<TipoObjeto, string> = { texto: 'texto', elemento: 'elemento', aplique: 'aplique', forma: 'forma', papel: 'papel', cor: 'cor sólida', moldurinha: 'moldurinha', grupo: 'grupo' }
const CAMADAS: TipoObjeto[] = ['elemento', 'aplique', 'forma', 'papel', 'cor', 'moldurinha']
const TODOS: TipoObjeto[] = [...CAMADAS, 'texto', 'grupo']
export const CAPACIDADE: Partial<Record<AcaoAtalho, TipoObjeto[]>> = {
  copiar: [...CAMADAS, 'texto'], recortar: [...CAMADAS, 'texto'], duplicar: [...CAMADAS, 'texto'],
  espelharH: ['elemento', 'aplique', 'forma'], espelharV: ['elemento', 'aplique', 'forma'],
  frente: [...CAMADAS, 'texto'], tras: [...CAMADAS, 'texto'], topo: [...CAMADAS, 'texto'], fundo: [...CAMADAS, 'texto'],
  mascaraCorte: CAMADAS,
  cadeado: TODOS, olho: TODOS, copiarEstilo: TODOS, colarEstilo: TODOS, excluir: TODOS,
}
/** A ação serve para este tipo de objeto? (fora da tabela: sempre) */
export function vale(acao: AcaoAtalho, tipo: TipoObjeto | null): boolean {
  const l = CAPACIDADE[acao]
  return !l || !tipo || l.includes(tipo)
}
/** "Espelhar na horizontal não vale para texto." */
export function avisoNaoVale(acao: AcaoAtalho, tipo: TipoObjeto): string {
  const r = ATALHOS.find(a => a.acao === acao)?.rotulo ?? acao
  return `${r} não vale para ${NOME_TIPO[tipo]}.`
}
