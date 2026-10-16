// mae-vínculo — OPERAÇÕES DO TEMA (Sprint 6), puras, rodando dentro da receita do Immer:
// papel/elemento na parte, trocar o papel, ordem, "Só nesta caixa" (ajuste local por propriedade),
// "Voltar ao padrão", "Desvincular" (vira exclusivo da face) e camada só de uma face (Alt).
import { SCHEMA_VERSION, type DocTema } from '../schema'
import { ehCamadaDePapel, type AjusteLocal, type CamadaImagemTema, type Transf } from './resolver'
import { degradeDaTransicao, geoElementoTransicao, TRANSICAO_PADRAO, type Transicao } from './transicao'
type Camada = Tema['partContent'][string][number]
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
/** Lote 6 (item 83): a COR sólida mais de cima entre os papéis do fundo (é ela que esconde o papel). */
function corDeCima(lista: Camada[]): number {
  let fim = 0
  while (fim < lista.length && ehCamadaDePapel(lista[fim])) fim++
  for (let i = fim - 1; i >= 0; i--) if (lista[i].type === 'solid') return i
  return -1
}

/** Lote 16 (item 204): o nome do ARQUIVO vira nome da camada — cortado no limite do schema (80). */
const curto = (n?: string) => (n ? n.slice(0, 80) : n)

export function colocarPapel(t: Tema, partId: string, a: ArquivoImagem, empilhar = false): string {
  const lista = (t.partContent[partId] ??= [])
  // Lote 6 (item 83): parte com COR sólida (mesmo pintada por cima de outro papel) → o papel TROCA a cor
  const iCor = empilhar ? -1 : corDeCima(lista as Camada[])
  if (iCor >= 0) {
    const id = lista[iCor].id
    lista[iCor] = { id, type: 'image', anchor: 'paper', path: a.path, sha256: a.sha256, aspect: a.aspect, name: curto(a.nome) ?? 'Papel', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } } as CamadaImagemTema
    return id
  }
  const fundo = lista[0]
  if (empilhar && fundo) {
    let i = 0
    while (i < lista.length && ehCamadaDePapel(lista[i])) i++   // Lote 5 (item 71): cor sólida também é papel
    const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: 'paper', path: a.path, sha256: a.sha256, aspect: a.aspect, name: curto(a.nome) ?? 'Papel', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } }
    lista.splice(i, 0, c)
    return c.id
  }
  if (fundo && fundo.type === 'image' && fundo.anchor === 'paper') {
    Object.assign(fundo, { path: a.path, sha256: a.sha256, aspect: a.aspect, name: curto(a.nome) ?? fundo.name })
    return fundo.id
  }
  // Lote 5 (item 71): fundo de COR sólida → o papel SUBSTITUI a cor (antes entrava por baixo dela e sumia)
  if (fundo && ehCamadaDePapel(fundo)) {
    lista[0] = { id: fundo.id, type: 'image', anchor: 'paper', path: a.path, sha256: a.sha256, aspect: a.aspect, name: curto(a.nome) ?? 'Papel', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } } as CamadaImagemTema
    return fundo.id
  }
  const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: 'paper', path: a.path, sha256: a.sha256, aspect: a.aspect, name: curto(a.nome) ?? 'Papel', transform: { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0 } }
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
  c.name = `Transição: ${curto(a.nome) ?? a.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'papel'}`
  ajustarTransicao(t, id, tr)
  return id
}

/** Muda direção/posição/suavidade de uma transição: refaz o degradê da máscara (o pincel pintado fica). */
export function ajustarTransicao(t: Tema, layerId: string, tr: Partial<Transicao>): void {
  const a = acharCamadaTema(t, layerId)
  if (!a) return
  const novo: Transicao = { ...TRANSICAO_PADRAO, ...(a.c.transition ?? {}), ...tr }
  a.c.transition = novo
  // Lote 21 (item 250): ELEMENTO — a posição e a máscara acompanham a transição (no quadrado do elemento)
  if (novo.elemA) {
    const g = geoElementoTransicao(novo, a.c.aspect ?? 1, novo.elemA)
    a.c.transform = { ...(a.c.transform ?? {}), ...g.transform } as never
    a.c.mask = { enabled: true, invert: false, featherMm: 0, ...(a.c.mask ?? {}), gradient: g.gradient }
    return
  }
  a.c.mask = { enabled: true, invert: false, featherMm: 0, ...(a.c.mask ?? {}), gradient: degradeDaTransicao(novo) }
}

/**
 * Lote 21 (item 250): transição com COR — uma cor lisa entra por cima do papel atual com o mesmo degradê. Com `corDeBaixo`
 * é COR PARA COR: o fundo vira essa cor (sem papel) e a outra entra por cima com o degradê.
 */
export function criarTransicaoCor(t: Tema, alvo: { partId: string } | { faceId: string }, cor: string, tr: Transicao, corDeBaixo?: string): string {
  if (corDeBaixo) colocarCor(t, alvo, corDeBaixo)
  const id = colocarCor(t, alvo, cor, true)
  const c = acharCamadaTema(t, id)!.c
  c.name = corDeBaixo ? `Transição: ${corDeBaixo} → ${cor}` : `Transição: cor ${cor}`
  ajustarTransicao(t, id, { ...tr, elemA: undefined })
  return id
}

/**
 * Lote 21 (item 250): transição com ELEMENTO (ondas, nuvens, grama, flores): o elemento entra preso ao lado de onde a
 * transição vem, com a borda suave na posição dela. `A` = largura ÷ altura da face (proporção da parte).
 */
export function criarTransicaoElemento(t: Tema, alvo: { partId: string } | { faceId: string }, a: ArquivoImagem, tr: Transicao, A: number): string {
  const id = 'faceId' in alvo ? colocarNaFace(t, alvo.faceId, a, 'face') : colocarElemento(t, alvo.partId, a)
  const c = acharCamadaTema(t, id)!.c
  c.name = `Transição: ${curto(a.nome) ?? a.path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'elemento'}`
  ajustarTransicao(t, id, { ...tr, elemA: A > 0 ? A : 1 })
  return id
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
  // Lote 6 (item 83): a cor guarda o papel que ela substituiu (o "Remover cor" volta para ele)
  const antes = fundo && fundo.type === 'image' ? JSON.parse(JSON.stringify(fundo)) : fundo && fundo.type === 'solid' ? (fundo as { antes?: unknown }).antes : undefined
  if (!empilhar && fundo && ehCamadaDePapel(fundo)) lista[0] = { ...c, id: fundo.id, ...(antes ? { antes } : {}) } as never
  else if (empilhar) { let i = 0; while (i < lista.length && ehCamadaDePapel(lista[i])) i++; lista.splice(i, 0, c) }
  else lista.unshift(c)
  lembrarCor(t, cor)
  return (!empilhar && fundo && ehCamadaDePapel(fundo)) ? fundo.id : c.id
}

/**
 * Lote 6 (item 83): "Remover cor" — tira as cores sólidas do fundo da parte (ou da caixa); a que tinha
 * substituído um papel devolve ele no lugar.
 */
export function removerCor(t: Tema, alvo: Alvo): boolean {
  const lista = listaDoAlvo(t, alvo)
  let mudou = false
  for (let i = lista.length - 1; i >= 0; i--) {
    const c = lista[i] as Camada & { antes?: Camada }
    if (c.type !== 'solid' || !ehCamadaDePapel(c)) continue
    if (c.antes) lista[i] = { ...(c.antes as Camada), id: c.id } as never
    else lista.splice(i, 1)
    mudou = true
  }
  return mudou
}

/**
 * Lote 6 (item 84): papel solto no CARTÃO da parte vale para TODAS as faces dela — tira os papéis de fundo "só
 * desta caixa" (as transições ficam) que escondiam o papel da parte. Devolve quantas caixas tinham papel próprio.
 */
export function liberarPapeisDasCaixas(t: Tema, faceIds: string[]): number {
  let n = 0
  for (const f of faceIds) {
    const l = t.faceContent?.[f]
    if (!l?.length) continue
    const resto = l.filter(c => !(ehCamadaDePapel(c) && !(c as { transition?: unknown }).transition))
    if (resto.length !== l.length) { n++; if (resto.length) t.faceContent[f] = resto; else delete t.faceContent[f] }
  }
  return n
}

/** Paleta do tema: a cor usada vai para o começo (sem repetir), no máximo 24. */
export function lembrarCor(t: Tema, cor: string): void {
  const k = cor.toLowerCase()
  t.palette = [k, ...(t.palette ?? []).filter(x => x.toLowerCase() !== k)].slice(0, 24)
}

/** Moldurinha: camada no topo da parte (ou só da caixa). Várias = moldura dupla. */
export function criarMoldura(t: Tema, alvo: Alvo, p: { offsetMm: number; widthMm: number; dash: { onMm: number; offMm: number } | null; cornerMm: number; color: string }, nome = 'Moldurinha',
  extras?: { effects?: unknown[]; porFace?: boolean }): string {
  // Lote 10 (item 154): o preset traz também os efeitos e o "em cada face"
  const c = { id: gid('l'), type: 'frame' as const, name: nome, ...p, ...(extras?.effects?.length ? { effects: JSON.parse(JSON.stringify(extras.effects)) } : {}), ...(extras?.porFace ? { porFace: true } : {}) }
  listaDoAlvo(t, alvo).push(c)
  lembrarCor(t, p.color)
  return c.id
}

/** Elemento (âncora "face") entra no TOPO da parte, no meio da face, com metade da largura. */
export function colocarElemento(t: Tema, partId: string, a: ArquivoImagem, pos?: { x: number; y: number }): string {
  const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: 'face', path: a.path, sha256: a.sha256, aspect: a.aspect, name: curto(a.nome) ?? 'Elemento', transform: { x: pos?.x ?? 0.5, y: pos?.y ?? 0.5, scale: 0.5, rotationDeg: 0 } }
  ;(t.partContent[partId] ??= []).push(c)
  return c.id
}

/**
 * Camada só desta face (Alt, ou "Só nesta caixa"): não entra no vínculo. Papel vai para baixo dos papéis da
 * caixa — com `empilhar`, POR CIMA deles (transição). Na folha, os papéis da caixa ficam logo acima dos
 * papéis da parte e abaixo dos elementos (resolver).
 */
export function colocarNaFace(t: Tema, faceId: string, a: ArquivoImagem, ancora: 'paper' | 'face', pos?: { x: number; y: number }, empilhar = false): string {
  const c: CamadaImagemTema = { id: gid('l'), type: 'image', anchor: ancora, path: a.path, sha256: a.sha256, aspect: a.aspect, name: curto(a.nome) ?? (ancora === 'paper' ? 'Papel' : 'Elemento'), transform: { x: pos?.x ?? 0.5, y: pos?.y ?? 0.5, scale: ancora === 'paper' ? 1 : 0.5, rotationDeg: 0 } }
  const lista = ((t.faceContent ??= {})[faceId] ??= [])
  if (ancora === 'paper') {
    if (empilhar) { let i = 0; while (i < lista.length && ehCamadaDePapel(lista[i])) i++; lista.splice(i, 0, c) }
    // Lote 6 (item 83): a cor de cima (mesmo sobre outro papel) é a que o papel troca
    else if (corDeCima(lista as Camada[]) >= 0) { const i = corDeCima(lista as Camada[]); c.id = lista[i].id; lista[i] = c }
    // Lote 5 (item 71): papel novo na caixa TROCA o papel/cor de fundo dela (antes entrava por baixo e sumia)
    else if (lista[0] && ehCamadaDePapel(lista[0])) { c.id = lista[0].id; lista[0] = c }
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
export function editarNaParte(t: Tema, layerId: string, p: { transform?: Partial<Transf>; visible?: boolean; path?: string; sha256?: string; aspect?: number; anchor?: 'paper' | 'face'; name?: string; repeat?: AjusteLocal['repeat']; opacity?: number }): void {
  if (p.transform?.scale !== undefined) { const a0 = acharCamadaTema(t, layerId); if (a0) marcarRefEstilos(a0.c as never) }
  const a = acharCamadaTema(t, layerId)
  if (!a) return
  const { transform, repeat, opacity, ...resto } = p
  if (transform) a.c.transform = { x: 0.5, y: 0.5, scale: 1, rotationDeg: 0, ...(a.c.transform ?? {}), ...transform }
  // Lote 5 (item 70): repetição (null = preencher) e opacidade (1 = sem)
  if (repeat === null) delete a.c.repeat
  else if (repeat) a.c.repeat = { ...(a.c.repeat ?? {}), ...repeat } as never
  if (opacity !== undefined) { if (opacity >= 0.995) delete (a.c as { opacity?: number }).opacity; else (a.c as { opacity?: number }).opacity = opacity }
  Object.assign(a.c, resto)
}

/** "Só nesta caixa": grava só as propriedades mudadas, para a face. O resto continua vinculado. */
export function ajustarSoNaFace(t: Tema, faceId: string, layerId: string, p: AjusteLocal): void {
  if (p.transform?.scale !== undefined) { const a0 = acharCamadaTema(t, layerId); if (a0) marcarRefEstilos(a0.c as never) }
  const porFace = ((t.localOverrides ??= {})[faceId] ??= {}) as Record<string, AjusteLocal>
  const aj = (porFace[layerId] ??= {})
  if (p.transform) aj.transform = { ...(aj.transform ?? {}), ...p.transform }
  if (p.visible !== undefined) aj.visible = p.visible
  if (p.path) { aj.path = p.path; aj.sha256 = p.sha256; aj.aspect = p.aspect }
  if (p.repeat !== undefined) aj.repeat = p.repeat === null ? null : { ...(aj.repeat ?? acharCamadaTema(t, layerId)?.c.repeat ?? { sizeMm: 40 }), ...p.repeat }
  if (p.opacity !== undefined) aj.opacity = p.opacity
  if (p.effects !== undefined) aj.effects = JSON.parse(JSON.stringify(p.effects))
}

/** Propriedades com ajuste local nesta face (para o ícone e o "Voltar ao padrão"). */
export function propriedadesAjustadas(t: Tema | null | undefined, faceId: string, layerId: string): string[] {
  const aj = ((t?.localOverrides ?? {})[faceId] ?? {})[layerId] as AjusteLocal | undefined
  if (!aj) return []
  return [...Object.keys(aj.transform ?? {}).map(k => `transform.${k}`), ...(aj.visible !== undefined ? ['visible'] : []), ...(aj.path ? ['path'] : []), ...(aj.repeat !== undefined ? ['repeat'] : []), ...(aj.opacity !== undefined ? ['opacity'] : []), ...(aj.effects !== undefined ? ['effects'] : [])]
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
  else if (prop === 'repeat') delete aj.repeat
  else if (prop === 'opacity') delete aj.opacity
  else if (prop === 'effects') delete aj.effects
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

/**
 * Lote 9 (item 137): DUPLICA uma camada do tema — cópia independente (tamanho, giro, espelho, efeitos próprios),
 * logo acima da original, na MESMA lista (da parte ou só da caixa), deslocada um pouco (`desloc`, fração da face).
 * Os ajustes "só nesta caixa" da original vão junto (a cópia aparece no mesmo lugar dela em cada caixa, deslocada).
 * Devolve o id da cópia.
 */
export function duplicarCamadaTema(t: Tema, layerId: string, desloc = 0.04): string | null {
  const a = acharCamadaTema(t, layerId)
  if (!a) return null
  const c = JSON.parse(JSON.stringify(a.c)) as CamadaImagemTema
  c.id = gid('l')
  if (c.name) c.name = `${c.name} (cópia)`.slice(0, 120)
  const mover = (tr: { x?: number; y?: number } | undefined) => tr ? { ...tr, x: Math.round(((tr.x ?? 0.5) + desloc) * 1000) / 1000, y: Math.round(((tr.y ?? 0.5) + desloc) * 1000) / 1000 } : tr
  const papel = (c as { anchor?: string }).anchor === 'paper'
  if (!papel && desloc) (c as { transform?: object }).transform = mover((c as { transform?: { x?: number; y?: number } }).transform ?? { x: 0.5, y: 0.5 })
  a.lista.splice(a.i + 1, 0, c)
  for (const aj of Object.values(t.localOverrides ?? {})) {
    const o = (aj as Record<string, { transform?: { x?: number; y?: number } }>)[layerId]
    if (!o) continue
    const copia = JSON.parse(JSON.stringify(o))
    if (!papel && desloc && copia.transform && (copia.transform.x !== undefined || copia.transform.y !== undefined)) copia.transform = mover(copia.transform)
    ;(aj as Record<string, unknown>)[c.id] = copia
  }
  return c.id
}

/** Lote 9 (itens 137/148): cola uma camada copiada (Ctrl+C) na lista da parte de destino — cópia nova, independente. */
export function colarCamadaTema(t: Tema, partId: string, c0: CamadaImagemTema, ajuste?: { faceId: string; aj: unknown } | null): string {
  const c = JSON.parse(JSON.stringify(c0)) as CamadaImagemTema
  c.id = gid('l')
  const lista = (t.partContent[partId] ??= [])
  if ((c as { anchor?: string }).anchor === 'paper') { let i = 0; while (i < lista.length && ehCamadaDePapel(lista[i])) i++; lista.splice(i, 0, c) } else lista.push(c)
  if (ajuste?.aj) ((t.localOverrides ??= {})[ajuste.faceId] ??= {})[c.id] = JSON.parse(JSON.stringify(ajuste.aj)) as never
  return c.id
}

/**
 * Lote 14 (item 197): antes de mudar o TAMANHO de uma camada com estilos, guarda a escala em que eles foram feitos —
 * daí em diante a arte escala os estilos junto (contorno, sombra, brilho, traço da forma). Sem estilos: nada a guardar.
 */
export function marcarRefEstilos(c: { effects?: unknown[]; stroke?: unknown; transform?: { scale?: number }; efeitosRef?: number; escalarEstilos?: boolean }): void {
  if (c.efeitosRef !== undefined || c.escalarEstilos === false) return
  if (!(c.effects?.length) && !c.stroke) return
  c.efeitosRef = c.transform?.scale ?? 1
}
/** O mesmo para o texto numa caixa (textSlotAdjust): a escala atual vira a referência dos estilos dele. */
export function marcarRefTexto(a: { scale?: number; efeitosRef?: number }): void {
  if (a.efeitosRef === undefined) a.efeitosRef = a.scale ?? 1
}
