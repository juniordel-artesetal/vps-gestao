// O Método MAE só roda no Chrome e no Edge (desktop): as duas APIs locais só existem lá.

export interface Suporte { ok: boolean; faltando: string[] }

export const MENSAGEM_NAVEGADOR = 'Use o Chrome ou o Edge para o Método MAE.'

export function suportaMae(win: object = globalThis): Suporte {
  const faltando: string[] = []
  if (!('showDirectoryPicker' in win)) faltando.push('pasta local (File System Access)')
  if (!('queryLocalFonts' in win)) faltando.push('fontes do computador (Local Font Access)')
  return { ok: faltando.length === 0, faltando }
}
