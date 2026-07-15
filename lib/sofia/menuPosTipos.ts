// Tipos e helpers PUROS da preferência de posição do menu (sem prisma) — seguros para
// importar tanto no cliente quanto no servidor. A leitura no banco fica em `menuPos.ts`.

export type MenuPos = 'left' | 'right' | 'top' | 'bottom'

export const MENU_POS_VALIDOS: MenuPos[] = ['left', 'right', 'top', 'bottom']

// Default = ESQUERDA (comportamento atual). Qualquer valor inválido cai no default.
export function normalizarPos(v: unknown): MenuPos {
  return typeof v === 'string' && (MENU_POS_VALIDOS as string[]).includes(v) ? (v as MenuPos) : 'left'
}

// Rótulo em português brasileiro, do jeito que a Sofia fala ("no menu à esquerda").
export function menuPosLabel(pos: MenuPos): string {
  switch (pos) {
    case 'right':  return 'à direita'
    case 'top':    return 'em cima (no topo)'
    case 'bottom': return 'embaixo (no rodapé)'
    default:       return 'à esquerda'
  }
}

// É um menu horizontal (barra em cima/embaixo)?
export function ehHorizontal(pos: MenuPos): boolean {
  return pos === 'top' || pos === 'bottom'
}
