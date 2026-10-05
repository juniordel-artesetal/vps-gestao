// mae-vínculo — OPERAÇÕES DO TEMA (Sprint 6), puras, rodando dentro da receita do Immer:
// papel/elemento na parte, trocar o papel, ordem, "Só nesta caixa" (ajuste local por propriedade),
// "Voltar ao padrão", "Desvincular" (vira exclusivo da face) e camada só de uma face (Alt).
import { SCHEMA_VERSION, type DocTema } from '../schema'
import { ehCamadaDePapel, type AjusteLocal, type CamadaImagemTema, type Transf } from './resolver'
import { degradeDaTransicao, TRANSICAO_PADRAO, type Transicao } from './transicao'
export { ehCamadaDePapel }

type Tema = DocTema
const gid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`

export function novoTema(o: { nome: string; baseId: string; baseVersion: number }): Tema {
  return {
    schemaVersion: SCHEMA_VERSION, type: 'theme', id: gid('th'), version: 1, name: o.nome.slice(0, 120) || 'Novo tema',
    baseId: o.baseId, baseVersion: o.baseVersion, partContent: {}, localOverrides: {}, faceContent: {}, hashtag: { middle: 'faz' },
    textStyles: {}, sample: { NOME: 'Maria Júlia', IDADE: '1' }, palette: [],
  }
}

export interface ArquivoImagem { path: string; sha256: string; aspect: number; nome?: string }

/**
 * Papel (âncora "papel") vai para o FUNDO da parte; se já há papel no fundo, troca a imagem dele.
 * `empilhar` (Shift ao soltar, Sprint 10): entra como mais um papel POR CIMA dos papéis do fundo — é como
 * se monta a transição entre dois papéis com máscara em degradê.
 */
export function colocarPapel(t: Tema, partId: string, a: ArquivoImagem, empilhar = false): string {
  const lista = (t.partContent[partId] ??= [])
  const fundo = lista[0]
  if (empilhar && fundo) {
    let i = 0
    while (i < lista.length && lista[i].type === 'image' && lista[i].anchor === 'paper') i++
    const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: 'paper', path: a.path, sha256: a.sha256, aspect: a.aspect, name: a.nome ?? 'Papel', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } }
    lista.splice(i, 0, c)
    return c.id
  }
  if (fundo && fundo.type === 'image' && fundo.anchor === 'paper') {
    Object.assign(fundo, { path: a.path, sha256: a.sha256, aspect: a.aspect, name: a.nome ?? fundo.name })
    return fundo.id
  }
  const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: 'paper', path: a.path, sha256: a.sha256, aspect: a.aspect, name: a.nome ?? 'Papel', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } }
  lista.unshift(c)
  return c.id
}

/**
 * TRANSIÇÃO (Lote 1): o 2º papel entra por cima dos papéis (da parte ou só da caixa) com a máscara em
 * degradê da direção/posição/suavidade escolhidas. Devolve o id da camada nova.
 */
export function criarTransicao(t: Tema, alvo: { partId: string } | { faceId: string }, a: ArquivoImagem, tr: Transicao): string {
  const id = 'faceId' in alvo ? colocarNaFace(t, alvo.faceId, a, 'paper', undefined, true) : colocarPapel(t, alvo.partId, a, true)
  const c = acharCamadaTema(t, id)!.c
  c.name = `Transição: ${a.nome ?? a.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'papel'}`
  ajustarTransicao(t, id, tr)
  return id
}

/** Muda direção/posição/suavidade de uma transição: refaz o degradê da máscara (o pincel pintado fica). */
export function ajustarTransicao(t: Tema, layerId: string, tr: Partial<Transicao>): void {
  const a = acharCamadaTema(t, layerId)
  if (!a) return
  const novo: Transicao = { ...TRANSICAO_PADRAO, ...(a.c.transition ?? {}), ...tr }
  a.c.transition = novo
  a.c.mask = { enabled: true, invert: false, featherMm: 0, ...(a.c.mask ?? {}), gradient: degradeDaTransicao(novo) }
}

// ── Lote 1: COR SÓLIDA (item 7) e MOLDURINHA (item 6) ──────────────────────────────────────────────
type Alvo = { partId: string } | { faceId: string }
const listaDoAlvo = (t: Tema, alvo: Alvo) => 'faceId' in alvo ? ((t.faceContent ??= {})[alvo.faceId] ??= []) : (t.partContent[alvo.partId] ??= [])

/**
 * Cor como preenchimento: funciona como um papel. Sem `empilhar`, TROCA o papel de fundo (imagem ou cor) da
 * parte/caixa pela cor; com `empilhar`, entra por cima dos papéis. A cor vai para a paleta do tema.
 */
export function colocarCor(t: Tema, alvo: Alvo, cor: string, empilhar = false): string {
  const lista = listaDoAlvo(t, alvo)
  const c = { id: gid('l'), type: 'solid' as const, anchor: 'paper' as const, color: cor, name: `Cor ${cor}`, transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } }
  const fundo = lista[0]
  if (!empilhar && fundo && ehCamadaDePapel(fundo)) lista[0] = { ...c, id: fundo.id }
  else if (empilhar) { let i = 0; while (i < lista.length && ehCamadaDePapel(lista[i])) i++; lista.splice(i, 0, c) }
  else lista.unshift(c)
  lembrarCor(t, cor)
  return (!empilhar && fundo && ehCamadaDePapel(fundo)) ? fundo.id : c.id
}

/** Paleta do tema: a cor usada vai para o começo (sem repetir), no máximo 24. */
export function lembrarCor(t: Tema, cor: string): void {
  const k = cor.toLowerCase()
  t.palette = [k, ...(t.palette ?? []).filter(x => x.toLowerCase() !== k)].slice(0, 24)
}

/** Moldurinha: camada no topo da parte (ou só da caixa). Várias = moldura dupla. */
export function criarMoldura(t: Tema, alvo: Alvo, p: { offsetMm: number; widthMm: number; dash: { onMm: number; offMm: number } | null; cornerMm: number; color: string }, nome = 'Moldurinha'): string {
  const c = { id: gid('l'), type: 'frame' as const, name: nome, ...p }
  listaDoAlvo(t, alvo).push(c)
  lembrarCor(t, p.color)
  return c.id
}

/** Elemento (âncora "face") entra no TOPO da parte, no meio da face, com metade da largura. */
export function colocarElemento(t: Tema, partId: string, a: ArquivoImagem, pos?: { x: number; y: number }): string {
  const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: 'face', path: a.path, sha256: a.sha256, aspect: a.aspect, name: a.nome ?? 'Elemento', transform: { x: pos?.x ?? 0.5, y: pos?.y ?? 0.5, scale: 0.5, rotationDeg: 0 } }
  ;(t.partContent[partId] ??= []).push(c)
  return c.id
}

/**
 * Camada só desta face (Alt, ou "Só nesta caixa"): não entra no vínculo. Papel vai para baixo dos papéis da
 * caixa — com `empilhar`, POR CIMA deles (transição). Na folha, os papéis da caixa ficam logo acima dos
 * papéis da parte e abaixo dos elementos (resolver).
 */
export function colocarNaFace(t: Tema, faceId: string, a: ArquivoImagem, ancora: 'paper' | 'face', pos?: { x: number; y: number }, empilhar = false): string {
  const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: ancora, path: a.path, sha256: a.sha256, aspect: a.aspect, name: a.nome ?? (ancora === 'paper' ? 'Papel' : 'Elemento'), transform: { x: pos?.x ?? 0.5, y: pos?.y ?? 0.5, scale: ancora === 'paper' ? 1 : 0.5, rotationDeg: 0 } }
  const lista = ((t.faceContent ??= {})[faceId] ??= [])
  if (ancora === 'paper') {
    if (empilhar) { let i = 0; while (i < lista.length && ehCamadaDePapel(lista[i])) i++; lista.splice(i, 0, c) }
    else lista.unshift(c)
  } else lista.push(c)
  return c.id
}



export function acharCamadaTema(t: Tema, layerId: string): { lista: CamadaImagemTema[]; i: number; c: CamadaImagemTema; partId?: string; faceId?: string } | null {
  for (const [partId, l] of Object.entries(t.partContent)) { const i = l.findIndex(c => c.id === layerId); if (i >= 0) return { lista: l as CamadaImagemTema[], i, c: l[i] as CamadaImagemTema, partId } }
  for (const [faceId, l] of Object.entries(t.faceContent ?? {})) { const i = l.findIndex(c => c.id === layerId); if (i >= 0) return { lista: l as CamadaImagemTema[], i, c: l[i] as CamadaImagemTema, faceId } }
  return null
}

/** Edição VINCULADA: vale para todas as faces da parte (a camada da parte muda). */
export function editarNaParte(t: Tema, layerId: string, p: { transform?: Partial<Transf>; visible?: boolean; path?: string; sha256?: string; aspect?: number; anchor?: 'paper' | 'face'; name?: string }): void {
  const a = acharCamadaTema(t, layerId)
  if (!a) return
  const { transform, ...resto } = p
  if (transform) a.c.transform = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0, ...(a.c.transform ?? {}), ...transform }
  Object.assign(a.c, resto)
}

/** "Só nesta caixa": grava só as propriedades mudadas, para a face. O resto continua vinculado. */
export function ajustarSoNaFace(t: Tema, faceId: string, layerId: string, p: AjusteLocal): void {
  const porFace = ((t.localOverrides ??= {})[faceId] ??= {}) as Record<string, AjusteLocal>
  const aj = (porFace[layerId] ??= {})
  if (p.transform) aj.transform = { ...(aj.transform ?? {}), ...p.transform }
  if (p.visible !== undefined) aj.visible = p.visible
  if (p.path) { aj.path = p.path; aj.sha256 = p.sha256; aj.aspect = p.aspect }
}

/** Propriedades com ajuste local nesta face (para o ícone e o "Voltar ao padrão"). */
export function propriedadesAjustadas(t: Tema | null | undefined, faceId: string, layerId: string): string[] {
  const aj = ((t?.localOverrides ?? {})[faceId] ?? {})[layerId] as AjusteLocal | undefined
  if (!aj) return []
  return [...Object.keys(aj.transform ?? {}).map(k => `transform.${k}`), ...(aj.visible !== undefined ? ['visible'] : []), ...(aj.path ? ['path'] : [])]
}

/** "Voltar ao padrão" de UMA propriedade (ou de todas, sem `prop`). */
export function voltarAoPadrao(t: Tema, faceId: string, layerId: string, prop?: string): void {
  const porFace = (t.localOverrides ?? {})[faceId] as Record<string, AjusteLocal> | undefined
  const aj = porFace?.[layerId]
  if (!porFace || !aj) return
  if (!prop) delete porFace[layerId]
  else if (prop.startsWith('transform.')) { if (aj.transform) { delete (aj.transform as Record<string, unknown>)[prop.slice(10)]; if (!Object.keys(aj.transform).length) delete aj.transform } }
  else if (prop === 'visible') delete aj.visible
  else if (prop === 'path') { delete aj.path; delete aj.sha256; delete aj.aspect }
  if (!Object.keys(aj).length) delete porFace[layerId]
  if (!Object.keys(porFace).length) delete (t.localOverrides as Record<string, unknown>)[faceId]
}

/** "Desvincular": a camada (com os ajustes desta face) vira exclusiva da face; some do vínculo ali. */
export function desvincular(t: Tema, faceId: string, layerId: string, efetivaNaFace: CamadaImagemTema): string {
  const copia: CamadaImagemTema = { ...JSON.parse(JSON.stringify(efetivaNaFace)), id: gid('l') }
  ;((t.faceContent ??= {})[faceId] ??= []).push(copia)
  voltarAoPadrao(t, faceId, layerId)
  ajustarSoNaFace(t, faceId, layerId, { visible: false })
  return copia.id
}

export function removerCamadaTema(t: Tema, layerId: string): void {
  const a = acharCamadaTema(t, layerId)
  if (!a) return
  a.lista.splice(a.i, 1)
  for (const porFace of Object.values(t.localOverrides ?? {})) delete (porFace as Record<string, unknown>)[layerId]
}

export function moverCamadaTema(t: Tema, layerId: string, dir: 1 | -1): void {
  const a = acharCamadaTema(t, layerId)
  if (!a) return
  const j = a.i + dir
  if (j < 0 || j >= a.lista.length) return
  const [c] = a.lista.splice(a.i, 1)
  a.lista.splice(j, 0, c)
}
