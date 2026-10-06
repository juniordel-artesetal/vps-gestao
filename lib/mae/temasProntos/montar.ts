// mae-temas-prontos — TEMAS PRONTOS (Lote 2, item 26): a aluna já tem a arte pronta (um PDF por kit, uma
// caixa por página; PNG/JPG também) e só quer pôr NOME, IDADE e HASHTAG em massa. Reaproveita base + tema:
// cada PÁGINA vira uma prancheta do tamanho dela, com um "molde" retangular (uma face, uma parte com o nome
// da página) e o tema põe a própria página como PAPEL dessa parte. As posições de texto nascem na 1ª página
// (a usuária ajusta). Na exportação, base pronta = sem sobra e sem linhas (a arte já vem fechada). Puro.
import { SCHEMA_VERSION, type DocTema, type DocTrabalho } from '../schema'
import { facesParaReceita } from '../editor/moldes'
import { atribuirFace, novaParte } from '../vinculo/partes'
import { organizarPranchetas } from '../editor/pranchetas'
import { colocarPapel, novoTema, type ArquivoImagem } from '../vinculo/tema'
import type { Pt } from '../faces/geometria'
import { chaveTema } from '../pedidos/pedidos'

export interface PaginaPronta {
  /** Nome da caixa/página (vira o nome da prancheta, do molde e da parte): "CAIXA MILK", "TOPO"… */
  nome: string
  wMm: number
  hMm: number
  /** A imagem da página na Biblioteca (o papel do tema). */
  imagem: ArquivoImagem
}
export interface ArquivoPronto { path: string; sha256: string; kind: 'pdf' | 'png' | 'jpg' }

const gid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`
const ret = (w: number, h: number): Pt[] => [[0, 0], [w, 0], [w, h], [0, h]]

/** Nome do tema a partir do arquivo ("Fazendinha.pdf" → "Fazendinha") — é o que o campo TEMA do pedido procura. */
export const nomeDoArquivo = (path: string) => (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '').trim() || 'Tema'

/** Caixas de texto padrão (normalizadas na face da 1ª página): NOME no meio, IDADE embaixo, HASHTAG no rodapé. */
export const TEXTOS_PADRAO = [
  { variable: 'NOME', box: { x: 0.1, y: 0.38, w: 0.8, h: 0.16 }, sizePt: 36 },
  { variable: 'IDADE', box: { x: 0.3, y: 0.56, w: 0.4, h: 0.1 }, sizePt: 24 },
  { variable: 'HASHTAG', box: { x: 0.12, y: 0.84, w: 0.76, h: 0.07 }, sizePt: 14 },
] as const

export function montarTemaPronto(o: { nome: string; arquivo: ArquivoPronto; paginas: PaginaPronta[] }): { base: DocTrabalho; tema: DocTema } {
  if (!o.paginas.length) throw new Error('O arquivo não tem páginas.')
  const nome = o.nome.trim().slice(0, 120) || nomeDoArquivo(o.arquivo.path)
  const base: DocTrabalho = {
    schemaVersion: SCHEMA_VERSION, type: 'base', id: gid('base'), version: 1, name: nome, units: 'mm',
    smartArt: { overflowMm: 10 }, artboards: [], molds: [], parts: [], textSlots: [],
    pronto: { path: o.arquivo.path, sha256: o.arquivo.sha256 },
  }
  const partes: string[] = []
  o.paginas.forEach((p, i) => {
    const abId = gid('ab'), mId = gid('m')
    const nomePg = p.nome.trim().slice(0, 60) || `PÁGINA ${i + 1}`
    base.artboards.push({ id: abId, widthMm: p.wMm, heightMm: p.hMm, name: nomePg.slice(0, 80) })
    base.molds.push({
      id: mId, name: nomePg, artboardId: abId,
      source: { path: o.arquivo.path, sha256: o.arquivo.sha256, widthMm: p.wMm, heightMm: p.hMm, kind: o.arquivo.kind, ...(o.arquivo.kind === 'pdf' ? { page: i + 1 } : {}) },
      transform: { xMm: 0, yMm: 0, rotationDeg: 0 },
      faces: facesParaReceita(mId, [{ poligono: ret(p.wMm, p.hMm), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }]) as DocTrabalho['molds'][number]['faces'],
    })
    const partId = novaParte(base, nomePg)
    atribuirFace(base, partId, base.molds[i].faces[0].id)
    partes.push(partId)
  })
  organizarPranchetas(base, 'grade')
  const face1 = base.molds[0].faces[0].id
  for (const t of TEXTOS_PADRAO) {
    base.textSlots.push({ id: gid(`ts_${t.variable.toLowerCase()}`), variable: t.variable, faceId: face1, box: { ...t.box },
      single: { lines: 1, sizePt: t.sizePt }, compound: { lines: 2, sizePt: Math.round(t.sizePt * 0.8), lineHeight: 0.9 }, autoFit: { minScale: 0.6 } })
  }
  const tema = novoTema({ nome, baseId: base.id, baseVersion: base.version })
  o.paginas.forEach((p, i) => { colocarPapel(tema, partes[i], p.imagem) })
  return { base, tema }
}

export { chaveTema }

/** Apelidos guardados na Biblioteca (`Temas/apelidos.json`): chave do campo TEMA → id do tema. */
export type Apelidos = Record<string, string>
export const ARQ_APELIDOS = 'Temas/apelidos.json'
export function lerApelidos(texto: string | null | undefined): Apelidos {
  try {
    const j = JSON.parse(texto ?? '{}')
    return j && typeof j === 'object' && !Array.isArray(j) ? Object.fromEntries(Object.entries(j).filter(([k, v]) => typeof v === 'string' && k)) as Apelidos : {}
  } catch { return {} }
}
export function lembrarApelido(a: Apelidos, campoTema: string, themeId: string): Apelidos {
  const k = chaveTema(campoTema)
  return k ? { ...a, [k]: themeId } : a
}

/** Arquivos de arte pronta na pasta Temas/ (PDF, PNG, JPG) — os .mae-tema.json ficam de fora. */
export const ehArquivoPronto = (nome: string) => /\.(pdf|png|jpe?g)$/i.test(nome)
