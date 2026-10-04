// Fontes LOCAIS (Local Font Access API): lista as fontes instaladas no computador, inclusive as
// compradas (Creative Fabrica…). Nenhuma fonte vai ao servidor; o tema guarda só o postscriptName.

/** O que o navegador devolve por fonte (subconjunto de FontData). */
export interface FonteLocal { family: string; fullName: string; postscriptName: string; style: string; blob?: () => Promise<Blob> }

export interface FamiliaFonte { family: string; estilos: { fullName: string; postscriptName: string; style: string }[] }

export type ResultadoFontes =
  | { ok: true; familias: FamiliaFonte[]; total: number }
  | { ok: false; motivo: 'sem-suporte' | 'negada' | 'erro'; mensagem: string }

type ConsultaFontes = () => Promise<FonteLocal[]>

/** Agrupa por família, em ordem alfabética (pt-BR); estilos sem repetição de postscriptName. */
export function agruparPorFamilia(fontes: FonteLocal[]): FamiliaFonte[] {
  const mapa = new Map<string, FamiliaFonte>()
  for (const f of fontes) {
    const fam = mapa.get(f.family) ?? { family: f.family, estilos: [] }
    if (!fam.estilos.some(e => e.postscriptName === f.postscriptName)) fam.estilos.push({ fullName: f.fullName, postscriptName: f.postscriptName, style: f.style })
    mapa.set(f.family, fam)
  }
  return [...mapa.values()].sort((a, b) => a.family.localeCompare(b.family, 'pt-BR'))
}

function consultaDoNavegador(): ConsultaFontes | null {
  const w = globalThis as unknown as { queryLocalFonts?: ConsultaFontes }
  return typeof w.queryLocalFonts === 'function' ? () => w.queryLocalFonts!() : null
}

/** Lista as fontes instaladas (pede a permissão "fontes locais" na primeira vez). */
export async function listarFontes(consulta: ConsultaFontes | null = consultaDoNavegador()): Promise<ResultadoFontes> {
  if (!consulta) return { ok: false, motivo: 'sem-suporte', mensagem: 'Este navegador não lista as fontes do computador. Use o Chrome ou o Edge.' }
  try {
    const fontes = await consulta()
    const familias = agruparPorFamilia(fontes)
    return { ok: true, familias, total: fontes.length }
  } catch (e) {
    const nome = (e as { name?: string })?.name
    if (nome === 'NotAllowedError' || nome === 'SecurityError') {
      return { ok: false, motivo: 'negada', mensagem: 'A permissão para ler as fontes foi negada. Libere em "Fontes" nas configurações do site (cadeado ao lado do endereço).' }
    }
    return { ok: false, motivo: 'erro', mensagem: (e as Error)?.message || 'Não consegui ler as fontes do computador.' }
  }
}

/** Arquivo binário de uma fonte instalada (usado pelo texto na Sprint 7). */
export async function arquivoDaFonte(postscriptName: string, consulta: ConsultaFontes | null = consultaDoNavegador()): Promise<Blob | null> {
  if (!consulta) return null
  const f = (await consulta()).find(x => x.postscriptName === postscriptName)
  return f?.blob ? f.blob() : null
}
