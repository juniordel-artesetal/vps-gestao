// SOA Edition — utilitários SÓ DE NAVEGADOR: carregar molde, enviar arquivo ao Blob e gerar
// o lote. A geração inteira roda no aparelho da artesã (o servidor não rasteriza lote).
import type { ConfigTemplate, Linha } from './tipos'
import { renderizar, carregarFontes, carregarImagens, type ResolverFonte } from './render'

/** Molde pronto para desenhar + dimensões e tamanho de página para o PDF. */
export interface Molde {
  fonte: HTMLCanvasElement | HTMLImageElement
  largura: number
  altura: number
  pagina: { larguraPt: number; alturaPt: number }
}

/** DPI assumido para molde em imagem ao gerar PDF de impressão. */
const DPI_IMAGEM = 300
/** Maior lado do molde rasterizado a partir de PDF (qualidade de impressão sem estourar memória). */
const MAX_LADO_PDF = 4200

export function ehPdf(mime: string | null | undefined, nome = ''): boolean {
  return mime === 'application/pdf' || /\.pdf$/i.test(nome)
}

/** Lê o molde de um arquivo local ou de uma URL (já no Blob). PDF: 1ª página, via pdf.js. */
export async function carregarMolde(origem: File | string, mime?: string | null): Promise<Molde> {
  const nome = typeof origem === 'string' ? origem : origem.name
  const tipo = typeof origem === 'string' ? mime : origem.type
  if (ehPdf(tipo, nome)) {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = '/estudio/pdf.worker.min.mjs'
    const dados = typeof origem === 'string'
      ? new Uint8Array(await (await fetch(origem)).arrayBuffer())
      : new Uint8Array(await origem.arrayBuffer())
    const doc = await pdfjs.getDocument({ data: dados }).promise
    const pag = await doc.getPage(1)
    const base = pag.getViewport({ scale: 1 }) // em pt
    const escala = Math.min(DPI_IMAGEM / 72, MAX_LADO_PDF / Math.max(base.width, base.height))
    const vp = pag.getViewport({ scale: escala })
    const cv = document.createElement('canvas')
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height)
    await pag.render({ canvasContext: cv.getContext('2d')!, viewport: vp, canvas: cv } as any).promise
    return { fonte: cv, largura: cv.width, altura: cv.height, pagina: { larguraPt: base.width, alturaPt: base.height } }
  }
  const url = typeof origem === 'string' ? origem : URL.createObjectURL(origem)
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = () => rej(new Error('Não consegui abrir essa imagem.'))
    i.src = url
  })
  let w = img.naturalWidth, h = img.naturalHeight
  if (!w || !h) { w = 2000; h = 2000 } // SVG sem dimensões explícitas
  return { fonte: img, largura: w, altura: h, pagina: { larguraPt: (w * 72) / DPI_IMAGEM, alturaPt: (h * 72) / DPI_IMAGEM } }
}

/** Envia o arquivo direto do navegador ao Vercel Blob e registra os metadados. */
export async function enviarArquivo(
  arquivo: File | Blob, nome: string, tipo: 'molde' | 'fonte' | 'gerado' | 'mockup',
  workspaceId: string, extras: { pasta?: string; tags?: string[]; pedidoId?: string | null; meta?: Record<string, unknown> } = {},
): Promise<{ id: string; url: string }> {
  const { upload } = await import('@vercel/blob/client')
  const limpo = nome.normalize('NFC').replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'arquivo'
  const r = await upload(`estudio/${workspaceId}/${tipo}/${limpo}`, arquivo, {
    access: 'public', handleUploadUrl: '/api/estudio/upload',
    contentType: (arquivo as File).type || undefined,
  })
  const res = await fetch('/api/estudio/assets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, nome, url: r.url, mime: (arquivo as File).type || null, tamanhoBytes: arquivo.size, ...extras }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error || 'Falha ao registrar o arquivo')
  return { id: j.id, url: r.url }
}

export type Formato = 'png' | 'jpg' | 'pdf-individual' | 'pdf-unico'

const blobDoCanvas = (cv: HTMLCanvasElement, tipo: string, q?: number) =>
  new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), tipo, q))

/** Cede a vez ao navegador entre um item e outro — a tela não trava e a barra anda. */
const respirar = () => new Promise<void>(r => setTimeout(r, 0))

/**
 * Gera o lote inteiro NO NAVEGADOR. Retorna UM arquivo: PDF único, ou ZIP com os arquivos
 * individuais (nome pela regra). Um item só = o próprio arquivo, sem ZIP.
 */
export async function gerarLote(p: {
  molde: Molde; cfg: ConfigTemplate; linhas: Linha[]; nomes: string[]; formato: Formato
  resolverFonte: ResolverFonte; fundoVariavel?: string | null
  aoProgredir: (feitos: number, total: number) => void; cancelado: () => boolean
}): Promise<{ arquivo: Blob; nome: string }> {
  const { molde, cfg, linhas, nomes, formato } = p
  await carregarFontes(cfg, p.resolverFonte)
  const cache = new Map<string, HTMLImageElement | null>()
  const urlsFoto = cfg.caixas.filter(c => c.tipo === 'imagem').flatMap(c => linhas.map(l => c.texto.replace(/\{([^{}]+)\}/g, (_, k) => l[String(k).trim()] ?? '').trim()))
  await carregarImagens(urlsFoto, cache)

  const cv = document.createElement('canvas')
  const jpg = formato === 'jpg' || formato.startsWith('pdf')
  const desenhar = (l: Linha) => renderizar(cv, molde.fonte, cfg, l, p.resolverFonte, {
    fundo: p.fundoVariavel ? l[p.fundoVariavel] || null : null, fundoBrancoSeTransparente: jpg, imagens: cache,
  })

  if (formato === 'pdf-unico') {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.create()
    for (let i = 0; i < linhas.length; i++) {
      if (p.cancelado()) throw new Error('cancelado')
      desenhar(linhas[i])
      const img = await doc.embedJpg(new Uint8Array(await (await blobDoCanvas(cv, 'image/jpeg', 0.93)).arrayBuffer()))
      doc.addPage([cfg.pagina.larguraPt, cfg.pagina.alturaPt]).drawImage(img, { x: 0, y: 0, width: cfg.pagina.larguraPt, height: cfg.pagina.alturaPt })
      p.aoProgredir(i + 1, linhas.length); await respirar()
    }
    const bytes = await doc.save()
    return { arquivo: new Blob([bytes as BlobPart], { type: 'application/pdf' }), nome: 'artes.pdf' }
  }

  const arquivos: { nome: string; blob: Blob }[] = []
  for (let i = 0; i < linhas.length; i++) {
    if (p.cancelado()) throw new Error('cancelado')
    desenhar(linhas[i])
    let blob: Blob
    if (formato === 'png') blob = await blobDoCanvas(cv, 'image/png')
    else if (formato === 'jpg') blob = await blobDoCanvas(cv, 'image/jpeg', 0.93)
    else {
      const { PDFDocument } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      const img = await doc.embedJpg(new Uint8Array(await (await blobDoCanvas(cv, 'image/jpeg', 0.93)).arrayBuffer()))
      doc.addPage([cfg.pagina.larguraPt, cfg.pagina.alturaPt]).drawImage(img, { x: 0, y: 0, width: cfg.pagina.larguraPt, height: cfg.pagina.alturaPt })
      blob = new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' })
    }
    arquivos.push({ nome: nomes[i], blob })
    p.aoProgredir(i + 1, linhas.length); await respirar()
  }
  if (arquivos.length === 1) return { arquivo: arquivos[0].blob, nome: arquivos[0].nome }
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  for (const a of arquivos) zip.file(a.nome, a.blob)
  return { arquivo: await zip.generateAsync({ type: 'blob', compression: 'STORE' }), nome: 'artes.zip' }
}

/** Baixa um Blob no aparelho (download do próprio navegador da artesã). */
export function baixar(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo)
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
