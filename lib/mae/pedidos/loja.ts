// mae-pedidos — LOJA DA NATY (Sprint 12), parte pura: o pack de tema encaixa na base da aluna pelo NOME
// das partes (FRENTE, FUNDO, ALÇA… são padronizados; os ids mudam de base para base). Reescreve os
// caminhos dos arquivos para `Packs Naty/<pack>/` e avisa as partes da base que o pack não cobre.
import type { DocTema } from '../schema'
import { norm } from './pedidos'

export interface ArquivoPack { path: string; url: string; sha256: string }
export interface InfoPack {
  /** partId do pack → nome da parte (FRENTE…). */
  partes: Record<string, string>
  arquivos: ArquivoPack[]
  precoCentavos: number | null
  descricao?: string
}

export const slugPack = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'pack'
export const caminhoNoPack = (pack: string, path: string) => `Packs Naty/${slugPack(pack)}/${path}`

/**
 * Tema do pack → tema na base da aluna: partContent re-chaveado pelos ids das partes dela (casando o
 * nome), caminhos para Packs Naty/, faceContent/ajustes locais descartados (são da base da Naty).
 */
export function aplicarPack(pack: DocTema, info: InfoPack, base: { id: string; version: number; parts: { id: string; name: string; instances: unknown[] }[] }, novoId: string): { tema: DocTema; semConteudo: string[]; naoUsadas: string[] } {
  const nomePack = pack.name ?? pack.id
  const porNome = new Map(base.parts.map(p => [norm(p.name), p.id]))
  const partContent: DocTema['partContent'] = {}
  const naoUsadas: string[] = []
  const mover = <T extends { path?: string }>(c: T): T => (c.path ? { ...c, path: caminhoNoPack(nomePack, c.path) } : c)
  for (const [pid, camadas] of Object.entries(pack.partContent)) {
    const nome = info.partes[pid] ?? pid
    const destino = porNome.get(norm(nome))
    if (!destino) { naoUsadas.push(nome); continue }
    partContent[destino] = camadas.map(c => mover(c as { path?: string }) as typeof c)
  }
  const semConteudo = base.parts.filter(p => p.instances.length && !partContent[p.id]?.length).map(p => p.name)
  const tema: DocTema = {
    ...pack, id: novoId, version: 1, baseId: base.id, baseVersion: base.version,
    partContent, faceContent: {}, localOverrides: {},
    ...(pack.overflowFill ? { overflowFill: { ...pack.overflowFill, path: caminhoNoPack(nomePack, pack.overflowFill.path) } } : {}),
  }
  return { tema, semConteudo, naoUsadas }
}

/** Mensagens da spec: "o pack não tem ALÇA, escolha um papel". */
export const avisosDoPack = (semConteudo: string[]) => semConteudo.map(n => `o pack não tem ${n}, escolha um papel`)

/** Arquivos que um tema usa (para publicar o pack). */
export function arquivosDoTema(t: DocTema): string[] {
  const s = new Set<string>()
  for (const c of [...Object.values(t.partContent).flat(), ...Object.values(t.faceContent ?? {}).flat()]) {
    if (c.type === 'image') { s.add(c.path); if (c.mask?.raster) s.add(c.mask.raster.path) }
  }
  if (t.overflowFill) s.add(t.overflowFill.path)
  return [...s]
}
