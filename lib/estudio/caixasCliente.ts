// SOA Edition — lado do navegador do MÉTODO MÃE: carregar moldes (acervo/próprio), gerar o kit de caixas
// em massa (PDF por pedido/arte + folha de apliques PNG transparente) com cota autorizada no servidor.
import { carregarMolde as abrirArquivo } from './cliente'
import { acervoCaixa } from './caixasAcervo'
import { DPI_IMPRESSAO, carregarImagensTema, dieLineDoAcervo, folhaApliques, nomeDaRegra, renderMoldeTema, type Imagens } from './caixas'
import type { MoldeCaixa, MoldeCaixaDef, TemaCaixas } from './caixasTipos'
import type { Linha } from './tipos'
import { FONTES_NATIVAS } from '@/components/estudio/fontesNativas'

export interface MoldeCarregado {
  molde: MoldeCaixa
  def: MoldeCaixaDef | null
  /** Imagem do molde (linhas) na resolução de impressão. */
  dieLine: HTMLCanvasElement
  W: number
  H: number
  /** Página do PDF em pt. */
  paginaPt: { w: number; h: number }
}

type Linhao = Record<string, unknown>
const json = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)

export function moldeDaLinha(r: Linhao): MoldeCaixa {
  return {
    id: String(r.id), nome: String(r.nome), tipo: r.tipo === 'acervo' ? 'acervo' : 'proprio', acervoId: (r.acervoId as string) || null,
    dieLineAssetId: (r.dieLineAssetId as string) || null, dieLineUrl: (r.dieLineUrl as string) || null,
    largura: Number(r.largura) || 0, altura: Number(r.altura) || 0,
    faces: (json(r.faces) as MoldeCaixa['faces']) || [], montagem: (json(r.montagem) as MoldeCaixa['montagem']) || null,
  }
}

export async function listarMoldes(): Promise<MoldeCaixa[]> {
  const r = await fetch('/api/estudio/moldes-caixa').then(x => x.json()).catch(() => ({}))
  return ((r.itens || []) as Linhao[]).map(moldeDaLinha)
}

/** Coloca um modelo do acervo nos moldes do workspace (faces e montagem já mapeadas). */
export async function adicionarDoAcervo(def: MoldeCaixaDef): Promise<string> {
  const r = await fetch('/api/estudio/moldes-caixa', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: def.nome, tipo: 'acervo', acervoId: def.id, faces: def.faces, montagem: def.montagem, largura: Math.round((def.larguraMm / 25.4) * DPI_IMPRESSAO), altura: Math.round((def.alturaMm / 25.4) * DPI_IMPRESSAO) }),
  }).then(x => x.json())
  if (!r.id) throw new Error(r.error || 'Não consegui adicionar o molde.')
  return r.id
}

const cacheMolde = new Map<string, Promise<MoldeCarregado>>()
/** Abre o molde na resolução de impressão (acervo: SVG a 300 dpi; próprio: o arquivo que ela subiu). */
export function carregarMoldeCaixa(m: MoldeCaixa): Promise<MoldeCarregado> {
  const chave = `${m.id}:${m.dieLineUrl || m.acervoId}`
  let p = cacheMolde.get(chave)
  if (!p) {
    p = (async () => {
      const def = m.acervoId ? acervoCaixa(m.acervoId) || null : null
      if (def) {
        const c = await dieLineDoAcervo(def)
        return { molde: m, def, dieLine: c, W: c.width, H: c.height, paginaPt: { w: (def.larguraMm / 25.4) * 72, h: (def.alturaMm / 25.4) * 72 } }
      }
      if (!m.dieLineUrl) throw new Error(`O molde "${m.nome}" está sem arquivo.`)
      const ab = await abrirArquivo(m.dieLineUrl)
      const c = document.createElement('canvas'); c.width = ab.largura; c.height = ab.altura
      c.getContext('2d')!.drawImage(ab.fonte, 0, 0)
      return { molde: m, def: null, dieLine: c, W: c.width, H: c.height, paginaPt: { w: ab.pagina.larguraPt, h: ab.pagina.alturaPt } }
    })()
    p.catch(() => cacheMolde.delete(chave))
    cacheMolde.set(chave, p)
  }
  return p
}

/** Montagem 3D do molde (acervo: a do modelo; próprio: a salva ao mapear as faces). */
export const montagemDe = (mc: MoldeCarregado) => mc.def?.montagem || mc.molde.montagem || null

export const resolverFonteNativa = (id: string) => FONTES_NATIVAS.find(f => f.id === id)?.familia || FONTES_NATIVAS[0].familia

export async function carregarFontesTema(tema: TemaCaixas): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return
  const fams = new Set(tema.elementos.filter(e => e.texto).map(e => resolverFonteNativa(e.texto!.fonte)))
  await Promise.all([...fams].flatMap(f => [document.fonts.load(`400 40px ${f}`), document.fonts.load(`700 40px ${f}`)].map(p => p.catch(() => []))))
}

export const temAplique = (tema: TemaCaixas) => tema.elementos.some(e => e.aplique)

/** Quantas imagens da cota o kit consome: 1 por página de caixa + 1 pela folha de apliques (por nome). */
export const custoKit = (tema: TemaCaixas, nMoldes: number, nLinhas: number) => nLinhas * (nMoldes + (temAplique(tema) ? 1 : 0))

async function jpg(c: HTMLCanvasElement): Promise<Uint8Array> {
  const b = await new Promise<Blob>((res, rej) => c.toBlob(x => (x ? res(x) : rej(new Error('imagem'))), 'image/jpeg', 0.93))
  return new Uint8Array(await b.arrayBuffer())
}
async function png(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((res, rej) => c.toBlob(x => (x ? res(x) : rej(new Error('imagem'))), 'image/png'))
}

export type FormatoKit = 'pdf-por-nome' | 'pdf-unico' | 'png'

export interface SaidaKit { arquivo: Blob; nome: string; arquivos: { caminho: string; blob: Blob }[] }

/**
 * Gera o kit de caixas para cada nome: páginas das caixas (PDF no tamanho real do molde) + folha de
 * apliques (PNG transparente). Cada imagem é autorizada (e debitada) pelo servidor antes de desenhar.
 */
export async function gerarKitCaixas(p: {
  tema: TemaCaixas; temaNome: string; moldes: MoldeCarregado[]; linhas: Linha[]; formato: FormatoKit; pasta: string
  autorizar: (i: number) => Promise<void>; aoProgredir?: (feitos: number, total: number) => void; cancelado?: () => boolean
}): Promise<SaidaKit> {
  const imgs: Imagens = new Map()
  await carregarImagensTema(p.tema, imgs)
  await carregarFontesTema(p.tema)
  const { PDFDocument } = await import('pdf-lib')
  const aplique = temAplique(p.tema)
  const total = custoKit(p.tema, p.moldes.length, p.linhas.length)
  const pre = p.pasta ? `${p.pasta}/` : ''
  const arquivos: { caminho: string; blob: Blob }[] = []
  const unico = p.formato === 'pdf-unico' ? await PDFDocument.create() : null
  let i = 0
  for (const linha of p.linhas) {
    const base = nomeDaRegra(p.tema.regraNome, { tema: p.temaNome, nome: linha.nome || '', idade: linha.idade || '' })
    const doc = p.formato === 'pdf-por-nome' ? await PDFDocument.create() : null
    for (const mc of p.moldes) {
      if (p.cancelado?.()) throw new Error('cancelado')
      await p.autorizar(i)
      const c = renderMoldeTema({ molde: mc.molde, dieLine: mc.dieLine, W: mc.W, H: mc.H, tema: p.tema, linha, fonte: resolverFonteNativa, imgs })
      if (p.formato === 'png') arquivos.push({ caminho: `${pre}${nomeDaRegra(p.tema.regraNome + '_{molde}', { tema: p.temaNome, nome: linha.nome || '', idade: linha.idade || '', molde: mc.molde.nome })}.png`, blob: await png(c) })
      else {
        const alvo = (doc || unico)!
        const im = await alvo.embedJpg(await jpg(c))
        alvo.addPage([mc.paginaPt.w, mc.paginaPt.h]).drawImage(im, { x: 0, y: 0, width: mc.paginaPt.w, height: mc.paginaPt.h })
      }
      i++; p.aoProgredir?.(i, total); await new Promise(r => setTimeout(r, 0))
    }
    if (doc) arquivos.push({ caminho: `${pre}${base}.pdf`, blob: new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' }) })
    if (aplique) {
      await p.autorizar(i)
      const folhas = folhaApliques({ moldes: p.moldes.map(m => ({ molde: m.molde, W: m.W, H: m.H })), tema: p.tema, linha, fonte: resolverFonteNativa, imgs })
      for (let k = 0; k < folhas.length; k++) arquivos.push({ caminho: `${pre}${base}_apliques${folhas.length > 1 ? `_${k + 1}` : ''}.png`, blob: await png(folhas[k]) })
      i++; p.aoProgredir?.(i, total)
    }
  }
  if (unico) arquivos.unshift({ caminho: `${pre}${nomeDaRegra('{tema}', { tema: p.temaNome, nome: '', idade: '' })}_kit.pdf`, blob: new Blob([(await unico.save()) as BlobPart], { type: 'application/pdf' }) })
  if (arquivos.length === 1) return { arquivo: arquivos[0].blob, nome: arquivos[0].caminho.split('/').pop()!, arquivos }
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const a of arquivos) zip.file(a.caminho, a.blob)
  return { arquivo: await zip.generateAsync({ type: 'blob', compression: 'STORE' }), nome: `${nomeDaRegra('{tema}', { tema: p.temaNome, nome: '', idade: '' })}.zip`, arquivos }
}

/** Temas de kit de caixas salvos (EstudioTemplate com config.tipo = 'kit-caixas'). */
export async function listarTemasCaixas(): Promise<{ id: string; nome: string; temaNome: string | null; updatedAt: string }[]> {
  const r = await fetch('/api/estudio/templates?tipo=kit-caixas').then(x => x.json()).catch(() => ({}))
  return r.templates || []
}

export async function abrirTemaCaixas(id: string): Promise<{ id: string; nome: string; temaNome: string | null; tema: TemaCaixas }> {
  const d = await fetch(`/api/estudio/templates/${id}`).then(r => r.json())
  if (!d.template) throw new Error(d.error || 'Tema não encontrado.')
  const cfg = json(d.template.config) as TemaCaixas
  if (cfg?.tipo !== 'kit-caixas') throw new Error('Este template não é de kit de caixas.')
  return { id, nome: d.template.nome, temaNome: d.template.temaNome || null, tema: cfg }
}
