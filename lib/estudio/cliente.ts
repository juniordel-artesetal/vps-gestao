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
/** Teto de pixels do molde rasterizado (≈16 MP): o Safari do iPhone recusa canvas maior que isso.
 *  A4 a 300 dpi (8,7 MP) cabe inteiro; A3 fica em ~290 dpi. */
const MAX_AREA_PX = 16_000_000
const MAX_LADO_PX = 8000

const blobDoCanvas = (cv: HTMLCanvasElement, tipo: string, q?: number) =>
  new Promise<Blob>((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), tipo, q))

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
    const escala = Math.min(DPI_IMAGEM / 72, MAX_LADO_PX / Math.max(base.width, base.height), Math.sqrt(MAX_AREA_PX / (base.width * base.height)))
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

/** Teto do Blob por arquivo (espelha /api/estudio/upload). */
export const MAX_BYTES_BLOB = 25 * 1024 * 1024
/** Imagem até este tamanho sobe como veio; acima (ou PDF), sobe a cópia comprimida. */
const SOBE_COMO_VEIO = 8 * 1024 * 1024

export interface MoldePreparado {
  molde: Molde
  /** Arquivo que vai para o Blob: o próprio (leve) ou a cópia achatada/comprimida. */
  copia: Blob
  nomeCopia: string
  mimeCopia: string
  comprimido: boolean
  dpi: number
}

/** O molde tem transparência? (amostra em grade — suficiente para decidir PNG × JPEG) */
function temTransparencia(cv: HTMLCanvasElement): boolean {
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  const passo = Math.max(1, Math.floor(Math.min(cv.width, cv.height) / 200))
  for (let y = 0; y < cv.height; y += passo) {
    const linha = ctx.getImageData(0, y, cv.width, 1).data
    for (let x = 3; x < linha.length; x += 4 * passo) if (linha[x] < 250) return true
  }
  return false
}

/**
 * Prepara o molde para guardar: PDF (ex.: exportado do Photoshop, centenas de MB) ou imagem
 * pesada é ACHATADO na resolução de impressão (~300 dpi no tamanho real) e reencodado — sem
 * transparência vira JPEG de alta qualidade; com transparência, PNG (ou WebP se o PNG passar do
 * teto). O original nunca vai para o Blob: se ela quiser guardá-lo, vai para o Drive DELA.
 */
export async function prepararMolde(f: File): Promise<MoldePreparado> {
  const original = await carregarMolde(f)
  const imagem = /^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type)
  const cabe = original.largura * original.altura <= MAX_AREA_PX && Math.max(original.largura, original.altura) <= MAX_LADO_PX
  if (imagem && cabe && f.size <= SOBE_COMO_VEIO) {
    return { molde: original, copia: f, nomeCopia: f.name, mimeCopia: f.type, comprimido: false, dpi: DPI_IMAGEM }
  }

  // Imagem gigante: reamostra para o teto de pixels mantendo o TAMANHO FÍSICO (página em pt).
  const k = Math.min(1, Math.sqrt(MAX_AREA_PX / (original.largura * original.altura)), MAX_LADO_PX / Math.max(original.largura, original.altura))
  const cv = document.createElement('canvas')
  cv.width = Math.round(original.largura * k); cv.height = Math.round(original.altura * k)
  const g = cv.getContext('2d')!
  g.imageSmoothingQuality = 'high'
  g.drawImage(original.fonte, 0, 0, cv.width, cv.height)
  const molde: Molde = { fonte: cv, largura: cv.width, altura: cv.height, pagina: original.pagina }
  const dpi = Math.round((molde.largura / molde.pagina.larguraPt) * 72)
  const base = f.name.replace(/\.[^.]+$/, '')
  let copia: Blob, mime: string
  if (!temTransparencia(cv)) { copia = await blobDoCanvas(cv, 'image/jpeg', 0.92); mime = 'image/jpeg' }
  else {
    copia = await blobDoCanvas(cv, 'image/png'); mime = 'image/png'
    if (copia.size > MAX_BYTES_BLOB) { copia = await blobDoCanvas(cv, 'image/webp', 0.95); mime = 'image/webp' }
  }
  if (copia.size > MAX_BYTES_BLOB) throw new Error('Mesmo comprimido, o molde passou de 25 MB. Exporte em tamanho menor.')
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp'
  return { molde, copia, nomeCopia: `${base}.${ext}`, mimeCopia: mime, comprimido: true, dpi }
}

/** Cópia de um canvas para guardar como molde (JPEG sem transparência; PNG/WebP com). */
export async function copiaDoCanvas(cv: HTMLCanvasElement, nome: string): Promise<{ blob: Blob; nome: string; mime: string }> {
  const base = nome.replace(/\.[^.]+$/, '')
  if (!temTransparencia(cv)) return { blob: await blobDoCanvas(cv, 'image/jpeg', 0.92), nome: `${base}.jpg`, mime: 'image/jpeg' }
  let blob = await blobDoCanvas(cv, 'image/png'), mime = 'image/png'
  if (blob.size > MAX_BYTES_BLOB) { blob = await blobDoCanvas(cv, 'image/webp', 0.95); mime = 'image/webp' }
  return { blob, nome: `${base}.${mime === 'image/png' ? 'png' : 'webp'}`, mime }
}

/** Envia o arquivo direto do navegador ao Vercel Blob e registra os metadados. */
export async function enviarArquivo(
  arquivo: File | Blob, nome: string, tipo: 'molde' | 'fonte' | 'gerado' | 'mockup' | 'imagem',
  workspaceId: string, extras: { pasta?: string; tags?: string[]; pedidoId?: string | null; meta?: Record<string, unknown>; lote?: string } = {},
): Promise<{ id: string; url: string }> {
  const { upload } = await import('@vercel/blob/client')
  const limpo = nome.normalize('NFC').replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'arquivo'
  const r = await upload(`estudio/${workspaceId}/${tipo}/${limpo}`, arquivo, {
    access: 'public', handleUploadUrl: '/api/estudio/upload',
    contentType: (arquivo as File).type || undefined,
    // Arte gerada leva o lote: o servidor só aceita se ele autorizou esse lote.
    clientPayload: extras.lote ? JSON.stringify({ lote: extras.lote }) : undefined,
  })
  const res = await fetch('/api/estudio/assets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, nome, url: r.url, mime: (arquivo as File).type || null, tamanhoBytes: arquivo.size, ...extras }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error || 'Falha ao registrar o arquivo')
  return { id: j.id, url: r.url }
}

/** Só sobe o binário ao Blob (sem criar registro) — usado para trocar o arquivo-fonte de um asset. */
export async function enviarSoBlob(arquivo: Blob, nome: string, tipo: string, workspaceId: string): Promise<string> {
  const { upload } = await import('@vercel/blob/client')
  const limpo = nome.normalize('NFC').replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'arquivo'
  const r = await upload(`estudio/${workspaceId}/${tipo}/${limpo}`, arquivo, {
    access: 'public', handleUploadUrl: '/api/estudio/upload', contentType: (arquivo as File).type || undefined,
  })
  return r.url
}

export type Formato = 'png' | 'jpg' | 'pdf-individual' | 'pdf-unico'


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
  /** Autorização do servidor para a arte i (obrigatória: sem ela a arte não é desenhada). */
  autorizar: (i: number) => Promise<void>
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
      await p.autorizar(i)
      await p.autorizar(i)
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

// ── COTA ───────────────────────────────────────────────────────────────────────
export interface Cota {
  cotaDiaria: number; geradasHoje: number; restanteHoje: number; saldoCreditos: number
  disponivel: number; imagensPorPacote: number; precoPacote: number | null
}

/** Erro de cota: o lote pede mais do que o login tem hoje (+ créditos). */
export class SemCota extends Error {
  cota: Cota | null
  faltam: number
  constructor(msg: string, cota: Cota | null, faltam: number) { super(msg); this.cota = cota; this.faltam = faltam }
}

/** Saldo atual do login (para avisar ANTES de começar um lote que não cabe). */
export async function consultarCota(): Promise<Cota | null> {
  try { const r = await fetch('/api/estudio/cota'); return r.ok ? await r.json() : null } catch { return null }
}

/** Antes de começar: o lote cabe no saldo? (senão nem começa e a tela oferece o pacote) */
export async function exigirSaldo(total: number): Promise<void> {
  const c = await consultarCota()
  if (c && c.disponivel < total) {
    throw new SemCota(`Você tem ${c.disponivel} imagem(ns) disponível(is) e isto pede ${total}.`, c, total - c.disponivel)
  }
}

const LEVA = 5
const idLote = () => (Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-z0-9]/g, '').slice(0, 30)

/**
 * Pede ao SERVIDOR autorização para cada leva de até 5 artes do lote — o servidor confere o saldo
 * no banco e debita na hora (débito definitivo). A próxima leva é pedida enquanto a atual ainda
 * está sendo desenhada (não atrasa). Mesma chave em reenvio = sem débito duplo.
 */
export class Autorizador {
  readonly lote = idLote()
  private liberados = 0
  private pendente: Promise<void> | null = null
  constructor(private total: number) {}

  /** Quantas artes o servidor já liberou (e cobrou) neste lote. */
  get autorizados() { return this.liberados }

  private async pedir(): Promise<void> {
    const inicio = this.liberados
    const qtd = Math.min(LEVA, this.total - inicio)
    if (qtd <= 0) return
    const corpo = JSON.stringify({ lote: this.lote, chave: `${this.lote}:${inicio}`, quantidade: qtd })
    let ultimoErro: Error | null = null
    for (let t = 0; t < 3; t++) {
      try {
        const r = await fetch('/api/estudio/cota/autorizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo })
        const j = await r.json().catch(() => ({}))
        if (r.status === 402) throw new SemCota(j.error || 'Suas imagens de hoje acabaram.', j.cota ?? null, Number(j.faltam) || qtd)
        if (!r.ok) throw new Error(j.error || 'O servidor não autorizou a geração.')
        this.liberados = inicio + Number(j.autorizados || qtd)
        return
      } catch (e) {
        if (e instanceof SemCota) throw e
        ultimoErro = e as Error
        await new Promise(res => setTimeout(res, 600 * (t + 1))) // rede instável: mesma chave, sem débito duplo
      }
    }
    throw ultimoErro || new Error('Sem conexão para autorizar a geração.')
  }

  /** Garante autorização para a arte i (0-based) antes de desenhá-la. */
  async garantir(i: number): Promise<void> {
    while (this.liberados <= i) {
      if (!this.pendente) this.pendente = this.pedir().finally(() => { this.pendente = null })
      await this.pendente
    }
    // Pré-busca: faltando 2 para acabar a leva liberada, já pede a próxima.
    if (!this.pendente && this.liberados - i <= 2 && this.liberados < this.total) {
      this.pendente = this.pedir().finally(() => { this.pendente = null })
      this.pendente.catch(() => {}) // o erro reaparece no próximo garantir()
    }
  }
}

// ── GOOGLE DRIVE DELA ─────────────────────────────────────────────────────────
const PEDACO = 16 * 256 * 1024 // 4 MB (múltiplo de 256 KB, como o Google exige)

/** Envio direto navegador → Google (sessão aberta pelo servidor). Rejeita se o navegador não conseguir (CORS). */
function putDireto(url: string, arquivo: Blob, aoProgredir?: (p: number) => void): Promise<{ id: string }> {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest()
    x.open('PUT', url)
    x.upload.onprogress = e => { if (e.lengthComputable) aoProgredir?.(e.loaded / e.total) }
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) { try { res(JSON.parse(x.responseText)) } catch { rej(new Error('resposta')) } }
      else rej(new Error(`drive ${x.status}`))
    }
    x.onerror = () => rej(new Error('rede'))
    x.send(arquivo)
  })
}

/** Plano B: pedaços de 4 MB repassados pelo SOA (cada um cabe no limite da função). */
async function putEmPedacos(url: string, arquivo: Blob, aoProgredir?: (p: number) => void): Promise<{ id: string }> {
  const total = arquivo.size
  for (let ini = 0; ini < total; ini += PEDACO) {
    const fim = Math.min(total, ini + PEDACO)
    const r = await fetch('/api/estudio/drive/pedaco', {
      method: 'PUT', headers: { 'x-sessao': url, 'x-content-range': `bytes ${ini}-${fim - 1}/${total}` }, body: arquivo.slice(ini, fim),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'Falha ao enviar para o Drive.')
    aoProgredir?.(fim / total)
    if (j.id) return { id: j.id }
  }
  throw new Error('O Drive não confirmou o arquivo.')
}

/**
 * Envia um arquivo para o Google Drive DA ARTESÃ (pasta "SOA Edition"). `registrar` guarda o link
 * na biblioteca como 'original' (só o link; o binário fica no Drive dela).
 */
export async function enviarProDrive(
  arquivo: Blob, nome: string,
  op: { registrar?: boolean; pasta?: string; copiaAssetId?: string | null; aoProgredir?: (p: number) => void } = {},
): Promise<{ link: string; assetId: string | null }> {
  const s = await fetch('/api/estudio/drive/sessao', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, mime: (arquivo as File).type || 'application/octet-stream', tamanho: arquivo.size }),
  })
  const sj = await s.json().catch(() => ({}))
  if (!s.ok) throw new Error(sj.error || 'Não consegui abrir o envio para o Drive.')
  let enviado: { id: string }
  try { enviado = await putDireto(sj.uploadUrl, arquivo, op.aoProgredir) }
  catch (e) {
    if ((e as Error).message.startsWith('drive 4')) throw new Error('O Google recusou o arquivo.')
    enviado = await putEmPedacos(sj.uploadUrl, arquivo, op.aoProgredir)
  }
  const c = await fetch('/api/estudio/drive/confirmar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: enviado.id, registrar: !!op.registrar, nome, pasta: op.pasta, copiaAssetId: op.copiaAssetId ?? null }),
  })
  const cj = await c.json().catch(() => ({}))
  if (!c.ok) throw new Error(cj.error || 'O Drive não confirmou o arquivo.')
  return cj
}
