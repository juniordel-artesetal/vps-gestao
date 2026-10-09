'use client'
// EXPORTAÇÃO (Sprint 9) — o "coração usável": a MESMA resolução do vínculo e o MESMO motor da tela geram
//   • ARTE PRA APROVAÇÃO: JPG 150 dpi, recorte exato pela face, com contorno (numa folha só ou por molde);
//   • ARTE PRA IMPRESSÃO: sobra (sangria) + papel de fundo nas abas; por cima, em VETOR, identidade, linhas e
//     marca de registro; PDF (por molde, por prancheta ou tudo junto) ou PNG 300 dpi; linhas em SVG/DXF.
// Tudo no computador: lê da Biblioteca, grava em Exportações/AAAA-MM-DD/. Nada vai ao servidor.
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { linhasDaPrancheta, linhasDoMoldeNaFolha, deslocar, nosDasLinhas, linhasSvg, linhasDxf, caixaDoMolde, type Linhas } from '@/lib/mae/exportar/linhas'
import { giroDo, paraFolha } from '@/lib/mae/editor/giroMolde'
import { conflitosComMarca, marcaNaFolha, zonasNaFolha } from '@/lib/mae/exportar/marca'
import { marcaDaPrancheta } from './marcasMae'
import { nomeExportacao, nomeLivre, nomeTemaPronto, pastaExportacao } from '@/lib/mae/exportar/nomes'
import { comPhys, jpgComDpi } from '@/lib/mae/exportar/png'
import { gravar, ler, listar, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { pxPorMm } from '@/lib/mae/render'
import type { DocTema, DocTrabalho, NoCamada, NoImagem, Prancheta } from '@/lib/mae/schema'
import type { Pt } from '@/lib/mae/faces/geometria'
import type { MoldePdf, PaginaPdf } from '@/lib/mae/exportar/pdf'
import { garantirArquivos, motorDaPagina } from './motorEditor'
import { garantirFontesDoTema, registroFontes } from './fontesTexto'
import type { Identidade } from './arquivosMae'
import type { MarcaRegistro } from './sincronia'

export const DPI_APROVACAO = 150
export const DPI_IMPRESSAO = 300

export interface OpcoesExportar {
  tipo: 'aprovacao' | 'impressao'
  /** Aprovação: tudo numa imagem só, ou uma imagem por molde. */
  aprovacao: 'folha' | 'molde'
  formato: 'pdf' | 'png'
  /** Impressão: um arquivo por molde, por prancheta, ou tudo junto (PDF de várias páginas). */
  agrupar: 'molde' | 'prancheta' | 'tudo'
  /** Lote 5 (item 63): padrão = a sobra da BASE (Arte inteligente) — uma fonte só. */
  sobraMm?: number
  /** Imprimir as linhas de corte/dobra por cima (ou ocultar). Lote 5 (item 68): padrão DESLIGADO. */
  linhas: boolean
  /** Moldes em PDF: desenhar a página ORIGINAL do molde (vetor exato) em vez das linhas detectadas. */
  linhasOriginais: boolean
  svg: boolean
  dxf: boolean
  /** Valores das variáveis (NOME, IDADE…). */
  valores: Record<string, string>
  /** Pasta de saída (padrão: Exportações/AAAA-MM-DD). A edição em massa usa uma por pedido. */
  pasta?: string
  /** Impressão: gerar também as folhas de apliques 3D quando o tema usa apliques (padrão: sim). */
  apliques?: boolean
  /** Número do pedido (edição em massa): desempata o nome do arquivo dos temas prontos. */
  pedido?: string
  /**
   * Lote 5 (item 79): quantas cópias de cada folha (prancheta) no PDF — "Já sair na quantidade do pedido".
   * Sem isto (ou "1 de cada"), uma de cada. 0 = a folha não sai.
   */
  copias?: Record<string, number>
  /** Lote 5 (itens 60/72): edição em massa — `Nome_Idadeanos_Tema_<sufixo>.pdf` (ex.: `Kit12`). */
  sufixoArquivo?: string
}

export interface Contexto {
  raiz: FileSystemDirectoryHandle
  doc: DocTrabalho
  tema: DocTema
  identidade: Identidade
  marcas: MarcaRegistro[]
  aoProgredir?: (texto: string) => void
  /** Lote 2 (item 18): barra de progresso — prancheta atual de quantas. */
  aoProgresso?: (feitos: number, total: number) => void
}

/** `revisar` = algum texto pediu revisão (nome longo além do auto-ajuste, fonte substituta…). */
export interface ResultadoExportar { pasta: string; arquivos: string[]; alertas: string[]; revisar: boolean }

const base = { visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false }

/** Quadrado [0,1]² → retângulo da logo/QR na folha, girado em volta do centro (Lote 1). */
/** Lote 4 (item 41): logo/QR do molde na folha — o centro acompanha o giro do molde e o giro soma. */
export function identidadeNaFolha(m: DocTrabalho['molds'][number], pos: { xMm: number; yMm: number; wMm: number; rotationDeg?: number }, hMm: number): { xMm: number; yMm: number; wMm: number; rotationDeg: number } {
  const [cx, cy] = paraFolha(m, [pos.xMm + pos.wMm / 2, pos.yMm + hMm / 2])
  return { xMm: cx - pos.wMm / 2, yMm: cy - hMm / 2, wMm: pos.wMm, rotationDeg: (pos.rotationDeg ?? 0) + giroDo(m) }
}

export function matrizIdentidade(pos: { xMm: number; yMm: number; wMm: number; rotationDeg?: number }, aspect: number, ox = 0, oy = 0): [number, number, number, number, number, number] {
  const w = pos.wMm, h = w / aspect, t = ((pos.rotationDeg ?? 0) * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t)
  const cx = pos.xMm + ox + w / 2, cy = pos.yMm + oy + h / 2
  return [w * c, w * s, -h * s, h * c, cx - (w / 2) * c + (h / 2) * s, cy - (w / 2) * s - (h / 2) * c]
}

/** "@ateliê" (com @) a partir da Identidade — a variável ARROBA das posições de texto. */
export const arrobaDe = (id: Identidade): string | undefined => {
  const a = (id.arroba ?? '').trim()
  return a ? (a.startsWith('@') ? a : `@${a}`) : undefined
}

/** Logo e QR da identidade como camadas raster (aprovação e PNG); no PDF eles vão em vetor/embutidos. */
function nosIdentidade(doc: DocTrabalho, abId: string, id: Identidade): NoImagem[] {
  const out: NoImagem[] = []
  for (const m of doc.molds) {
    if (m.artboardId !== abId) continue
    for (const k of ['logo', 'qr'] as const) {
      const pos = m.identity?.[k], arq = id[k]
      if (!pos || !arq?.sha256) continue
      out.push({ ...base, id: `ident:${m.id}:${k}`, name: k, type: 'image', src: { path: arq.path, sha256: arq.sha256 }, xMm: 0, yMm: 0, wMm: 1, hMm: 1, rotationDeg: 0,
        matrix: matrizIdentidade(identidadeNaFolha(m, pos, pos.wMm / (arq.aspect || 1)), arq.aspect || 1) })
    }
  }
  return out
}

/** Regiões de impressão (anéis das formas das faces) — para checar conflito com a marca. */
const regioes = (nos: NoCamada[]): Pt[][] => nos.flatMap(n => n.type === 'shape' && n.id.endsWith(':forma') ? [n.rings[0] as Pt[]] : [])

/** PNG (fundo branco) → JPG de alta qualidade (0,92) para ir dentro do PDF. */
async function paraJpg(png: Blob): Promise<Uint8Array> {
  const bm = await createImageBitmap(png)
  const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d')!
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, bm.width, bm.height); g.drawImage(bm, 0, 0); bm.close()
  return new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer())
}

async function blobPara(c: OffscreenCanvas, tipo: 'image/png' | 'image/jpeg', dpi: number): Promise<Blob> {
  const b = await c.convertToBlob(tipo === 'image/jpeg' ? { type: tipo, quality: 0.92 } : { type: tipo })
  const u = new Uint8Array(await b.arrayBuffer())
  return new Blob([(tipo === 'image/png' ? comPhys(u, dpi) : jpgComDpi(u, dpi)) as BlobPart], { type: tipo })
}

/** Recorta (mm) um render da prancheta. */
async function recortar(png: Blob, r: { x: number; y: number; w: number; h: number }, k: number, tipo: 'image/png' | 'image/jpeg', dpi: number): Promise<Blob> {
  const bmp = await createImageBitmap(png)
  const c = new OffscreenCanvas(Math.max(1, Math.round(r.w * k)), Math.max(1, Math.round(r.h * k)))
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
  g.drawImage(bmp, -Math.round(r.x * k), -Math.round(r.y * k))
  bmp.close()
  return blobPara(c, tipo, dpi)
}

/** Lote 4 (item 49): um aviso com o lugar do problema (para o "Ir até"). */
export interface AvisoExportar { grupo: 'texto' | 'marca'; texto: string; artboardId?: string; slotId?: string }

/**
 * Lote 4 (item 49): avisos ANTES de exportar, sem gerar arquivo — nome/idade/hashtag que passaram da face (o
 * mesmo diagramador da exportação) e prancheta sem marca de registro. A janela agrupa e tem "Ir até".
 */
export function checarAntes(o: { doc: DocTrabalho; tema: DocTema; valores: Record<string, string>; semMarca: { id: string; nome: string }[] }): AvisoExportar[] {
  const out: AvisoExportar[] = []
  const vistos = new Set<string>()
  for (const ab of o.doc.artboards) {
    if (!o.doc.molds.some(m => m.artboardId === ab.id && m.faces.length)) continue
    resolverPrancheta(o.doc, ab.id, { tema: o.tema, texto: { fontes: registroFontes, valores: { ...(o.tema.sample ?? {}), ...o.valores }, aoDiagramar: i => {
      if (!i.aviso || vistos.has(`${i.slotId}`)) return
      vistos.add(`${i.slotId}`)
      out.push({ grupo: 'texto', texto: i.aviso, artboardId: ab.id, slotId: i.slotId })
    } }, modo: 'tela' })
  }
  for (const s of o.semMarca) out.push({ grupo: 'marca', texto: `A prancheta ${s.nome} está sem marca de registro (print & cut sem marca não corta).`, artboardId: s.id })
  return out
}

/** Resumo do topo: "3 nomes passaram da face · 1 prancheta sem marca". */
export function resumoAvisos(av: AvisoExportar[]): string {
  const t = av.filter(a => a.grupo === 'texto').length, m = av.filter(a => a.grupo === 'marca').length
  return [t ? `${t} ${t === 1 ? 'texto passou' : 'textos passaram'} da face` : '', m ? `${m} ${m === 1 ? 'prancheta' : 'pranchetas'} sem marca` : ''].filter(Boolean).join(' · ')
}

export async function exportar(ctx: Contexto, o0: OpcoesExportar): Promise<ResultadoExportar> {
  const { raiz, doc, tema, identidade, marcas } = ctx
  // Lote 2 (item 26): tema PRONTO = a arte já vem fechada → sem sobra, sem linhas de corte/dobra
  const pronto = !!doc.pronto
  const o: OpcoesExportar & { sobraMm: number } = pronto ? { ...o0, sobraMm: 0, linhas: false, linhasOriginais: false, svg: false, dxf: false }
    : { ...o0, sobraMm: o0.sobraMm ?? doc.smartArt?.overflowMm ?? 10 }
  const passo = (t: string) => ctx.aoProgredir?.(t)
  const alertas: string[] = []
  const arquivos: string[] = []
  const agora = new Date()
  const pasta = o.pasta ?? pastaExportacao(agora)
  let revisar = false
  const avisosTexto = new Set<string>()
  const existentes = new Set((await listar(raiz, pasta).catch(() => [])).map(e => e.nome))
  const nomeTema = tema.name ?? 'tema'
  const arroba = arrobaDe(identidade)
  const valores: Record<string, string> = { ...(tema.sample ?? {}), ...(arroba ? { ARROBA: arroba } : {}), ...o.valores }
  const nomeVar = valores.NOME ?? ''
  const nomeDe = (molde: string, ext: string) => {
    // Lote 5 (item 60): na edição em massa todo tema usa `Nome_Idadeanos_Tema[_Kit12]` (antes só os prontos)
    const n = nomeLivre(pronto || o.pedido
      ? nomeTemaPronto({ nome: nomeVar, idade: valores.IDADE, tema: nomeTema, caixa: molde === 'impressao' ? undefined : molde, data: agora, extensao: ext, pedido: o.pedido, existentes, sufixo: o.sufixoArquivo })
      : nomeExportacao({ tema: nomeTema, nome: nomeVar, molde, data: agora, extensao: ext }), existentes)
    existentes.add(n)
    return n
  }
  const salvar = async (nome: string, b: Blob | string) => { const c = `${pasta}/${nome}`; await gravar(raiz, c, b); arquivos.push(c) }
  // nome da folha: o dela, ou os moldes que estão nela (MILK, MILK+CUBO…), ou folha-N
  const nomeFolha = (ab: Prancheta, i: number) => ab.name || doc.molds.filter(m => m.artboardId === ab.id && m.faces.length).map(m => m.name).join('+') || (doc.artboards.length > 1 ? `folha-${i + 1}` : 'folha')

  passo('Carregando as fontes do tema…')
  await garantirFontesDoTema(tema, raiz)

  const modo = o.tipo === 'aprovacao' ? 'aprovacao' : 'impressao'
  const k = pxPorMm(o.tipo === 'aprovacao' ? DPI_APROVACAO : DPI_IMPRESSAO)
  const camadas = (ab: Prancheta, extras: NoCamada[]): NoCamada[] => [
    // Lote 4 (item 47): na impressão o aplique 3D sai só nas folhas de aplique, nunca na caixa
    // Lote 4 (item 21): linhas e identidade logo depois das faces — o elemento "pode vazar" fica por cima da linha
    ...resolverPrancheta(doc, ab.id, { tema, texto: { fontes: registroFontes, valores, aoDiagramar: i => { if (i.revisar || i.substituta) revisar = true; if (i.aviso) avisosTexto.add(i.aviso) } }, modo, sobraMm: o.sobraMm, semApliques: modo === 'impressao', depoisDasFaces: extras }),
  ]
  const renderizar = async (ab: Prancheta, layers: NoCamada[], fundo: string | null = '#ffffff'): Promise<Blob> => {
    const p: Prancheta = { ...ab, layers }
    const falta = await garantirArquivos(p, raiz)
    if (falta.length) alertas.push(`${falta.length} arquivo(s) da arte não estão na Biblioteca (prancheta "${ab.name ?? ab.id}") — saíram em branco. Reconecte a pasta ou troque a imagem.`)
    const r = await motorDaPagina().render(p, k, fundo, 'png')
    if (!r.png) throw new Error('O motor não devolveu a imagem.')
    return r.png
  }
  const comArte = doc.artboards.filter(ab => doc.molds.some(m => m.artboardId === ab.id && m.faces.length))
  if (!comArte.length) throw new Error('Nenhuma prancheta tem molde com faces — monte a base antes de exportar.')

  // ── APROVAÇÃO ──────────────────────────────────────────────────────────────────────────────────
  if (o.tipo === 'aprovacao') {
    const renders: { ab: Prancheta; png: Blob }[] = []
    for (const [i, ab] of comArte.entries()) {
      passo(`Gerando ${nomeFolha(ab, i)}… ${i + 1} de ${comArte.length}`); ctx.aoProgresso?.(i, comArte.length)
      const extras = [...nosIdentidade(doc, ab.id, identidade), ...(pronto ? [] : nosDasLinhas(linhasDaPrancheta(doc, ab.id), { cor: '#1f2937', corDobra: '#6b7280', larguraMm: 0.3 }))]
      renders.push({ ab, png: await renderizar(ab, camadas(ab, extras)) })
    }
    if (o.aprovacao === 'folha') {
      // todas as pranchetas, uma embaixo da outra, numa imagem só
      const gap = 8
      const W = Math.max(...renders.map(r => r.ab.widthMm)), H = renders.reduce((s, r) => s + r.ab.heightMm, 0) + gap * (renders.length - 1)
      const c = new OffscreenCanvas(Math.round(W * k), Math.round(H * k))
      const g = c.getContext('2d')!
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
      let y = 0
      for (const r of renders) { const b = await createImageBitmap(r.png); g.drawImage(b, 0, Math.round(y * k)); b.close(); y += r.ab.heightMm + gap }
      await salvar(nomeDe('aprovacao', 'jpg'), await blobPara(c, 'image/jpeg', DPI_APROVACAO))
    } else {
      for (const r of renders) for (const m of doc.molds.filter(mm => mm.artboardId === r.ab.id && mm.faces.length)) {
        const cx = caixaDoMolde(doc, m.id, 3)!
        await salvar(nomeDe(`${m.name}-aprovacao`, 'jpg'), await recortar(r.png, cx, k, 'image/jpeg', DPI_APROVACAO))
      }
    }
    alertas.unshift(...avisosTexto)
    return { pasta, arquivos, alertas, revisar }
  }

  // ── IMPRESSÃO ──────────────────────────────────────────────────────────────────────────────────
  const { montarPdf, tamanhoDaPagina } = await import('@/lib/mae/exportar/pdf')
  const bytesDe = async (path: string) => new Uint8Array(await (await ler(raiz, path)).arrayBuffer())
  const paginas: { ab: Prancheta; i: number; pagina: PaginaPdf; png: Blob }[] = []
  let avisouMolde = false
  for (const [i, ab] of comArte.entries()) {
    passo(`Gerando ${nomeFolha(ab, i)}… ${i + 1} de ${comArte.length}`); ctx.aoProgresso?.(i, comArte.length)
    const moldes = doc.molds.filter(m => m.artboardId === ab.id && m.faces.length)
    // linhas: detectadas, ou a página original dos moldes em PDF (vetor exato do arquivo)
    let linhas: Linhas | null = null
    const moldesPdf: MoldePdf[] = []
    if (o.linhas) {
      linhas = { corte: [], dobra: [] }
      for (const m of moldes) {
        // molde girado (Lote 4, item 41): as linhas detectadas (vetor das faces) giram junto; o PDF original não
        const pdf = o.formato === 'pdf' && o.linhasOriginais && giroDo(m) === 0 && (m.source.kind === 'pdf' || /\.pdf$/i.test(m.source.path))
        if (pdf) {
          try {
            const bytes = await bytesDe(m.source.path)
            if ((await sha256(bytes)) !== m.source.sha256) throw new Error('mudou')
            moldesPdf.push({ bytes, pagina: m.source.page ?? 1, crop: m.source.crop, xMm: m.transform.xMm, yMm: m.transform.yMm })
            continue
          } catch { alertas.push(`O PDF original do molde "${m.name}" não está na Biblioteca (ou mudou) — usei as linhas detectadas.`) }
        }
        const l = linhasDoMoldeNaFolha(m)
        linhas.corte.push(...l.corte); linhas.dobra.push(...l.dobra)
      }
    }
    const pngExtras = o.formato === 'png' ? [...nosIdentidade(doc, ab.id, identidade), ...(linhas ? nosDasLinhas(linhas, { larguraMm: 0.25 }) : [])] : []
    const layers = camadas(ab, pngExtras)
    const png = await renderizar(ab, layers)
    // Lote 4 (item 21): no PDF as linhas vão em vetor por cima da arte — os elementos "pode vazar" saem numa
    // camada transparente desenhada DEPOIS das linhas (inteiros, por cima da linha do molde)
    const vazados = layers.filter(n => n.id.endsWith(':vaza'))
    const sobreLinhas = o.formato === 'pdf' && vazados.length && (linhas || moldesPdf.length)
      ? { bytes: new Uint8Array(await (await renderizar(ab, vazados, null)).arrayBuffer()), larguraMm: ab.widthMm, alturaMm: ab.heightMm }
      : undefined
    // marca de registro da prancheta
    // Lote 2: a página é SEMPRE a prancheta (tamanho e orientação); a marca entra por cima (girada se precisar)
    const marca = marcaDaPrancheta(ab, marcas)
    let marcaPdf: PaginaPdf['marca'] = null
    const pagW = ab.widthMm, pagH = ab.heightMm
    if (!marca && ab.registrationPresetId) alertas.push(`A marca da prancheta "${nomeFolha(ab, i)}" não foi encontrada na lista de marcas — saiu sem marca. Escolha a marca de novo no painel Exportar.`)
    if (marca) {
      try {
        const bytes = await bytesDe(marca.path)
        if ((await sha256(bytes)) !== marca.sha256) alertas.push(`O arquivo da marca "${marca.nome}" mudou desde que foi cadastrado — confira a marca antes de imprimir.`)
        const t = await tamanhoDaPagina(bytes, marca.pagina)
        const enc = marcaNaFolha(ab.widthMm, ab.heightMm, t.wMm, t.hMm)
        marcaPdf = { bytes, pagina: marca.pagina, girar: enc.girar, dx: enc.dx, dy: enc.dy }
        if (enc.diferente) alertas.push(`⚠️ A prancheta "${nomeFolha(ab, i)}" (${ab.widthMm.toFixed(0)} × ${ab.heightMm.toFixed(0)} mm) tem tamanho diferente da marca "${marca.nome}" (${t.wMm.toFixed(0)} × ${t.hMm.toFixed(0)} mm) — a marca foi centralizada; confira o encaixe.`)
        else if (enc.girar) alertas.push(`⚠️ Prancheta "${nomeFolha(ab, i)}" em ${ab.widthMm > ab.heightMm ? 'paisagem' : 'retrato'} e marca "${marca.nome}" em ${t.wMm > t.hMm ? 'paisagem' : 'retrato'}: a página saiu na orientação da prancheta e a MARCA foi girada para caber (o molde não gira). Se a máquina pedir, use a marca na mesma orientação.`)
        const conf = conflitosComMarca(zonasNaFolha(marca.zonas, enc, t.hMm), regioes(layers))
        if (conf.length) alertas.push(`A arte da prancheta "${nomeFolha(ab, i)}" entra em ${conf.length} área(s) da marca de registro — a câmera da máquina pode não ler a marca. Afaste o molde dos cantos ou diminua a sobra.`)
      } catch { alertas.push(`A marca "${marca.nome}" não está na Biblioteca (Marcas de registro/) — exportei sem marca.`) }
    }
    if (o.agrupar === 'molde' && marca && !avisouMolde) { alertas.push('Por molde, o arquivo sai SEM marca de registro (a marca vale para a folha inteira). Para print & cut, exporte por prancheta.'); avisouMolde = true }
    // identidade em vetor/embutida (PDF)
    const qr: NonNullable<PaginaPdf['identidade']>['qr'] = [], logo: NonNullable<PaginaPdf['identidade']>['logo'] = []
    if (o.formato === 'pdf') for (const m of moldes) {
      const pl = m.identity?.logo, pq = m.identity?.qr
      if (pl && identidade.logo) {
        try {
          const b = await bytesDe(identidade.logo.path)
          const hL = pl.wMm / (identidade.logo.aspect || 1), f = identidadeNaFolha(m, pl, hL)
          logo.push({ bytes: b, tipo: /\.jpe?g$/i.test(identidade.logo.path) ? 'jpg' : 'png', xMm: f.xMm, yMm: f.yMm, wMm: pl.wMm, hMm: hL, rotationDeg: f.rotationDeg })
        } catch { alertas.push('A logo da Identidade não está na Biblioteca — saiu sem logo.') }
      }
      const fq = pq ? identidadeNaFolha(m, pq, pq.wMm) : null
      if (pq && fq && identidade.qr?.link) qr.push({ texto: identidade.qr.link, xMm: fq.xMm, yMm: fq.yMm, ladoMm: pq.wMm, rotationDeg: fq.rotationDeg })
      else if (pq && fq && identidade.qr) {
        try { logo.push({ bytes: await bytesDe(identidade.qr.path), tipo: 'png', xMm: fq.xMm, yMm: fq.yMm, wMm: pq.wMm, hMm: pq.wMm, rotationDeg: fq.rotationDeg }) } catch { /* sem QR */ }
      }
    }
    paginas.push({ ab, i, png, pagina: {
      larguraMm: pagW, alturaMm: pagH, marca: marcaPdf, ...(sobreLinhas ? { sobreLinhas } : {}),
      // JPG de alta qualidade dentro do PDF (fundo branco): o mesmo resultado na impressão, arquivo ~10× menor
      arte: o.formato === 'pdf' ? { bytes: await paraJpg(png), tipo: 'jpg', larguraMm: ab.widthMm, alturaMm: ab.heightMm } : { bytes: new Uint8Array(await png.arrayBuffer()), tipo: 'png', larguraMm: ab.widthMm, alturaMm: ab.heightMm },
      linhas, moldesPdf, identidade: { qr, logo },
    } })
    // só as linhas, para a máquina de corte
    if (o.svg || o.dxf) {
      const l = linhasDaPrancheta(doc, ab.id)
      if (o.svg) await salvar(nomeDe(`${nomeFolha(ab, i)}-linhas`, 'svg'), linhasSvg(l, ab.widthMm, ab.heightMm))
      if (o.dxf) await salvar(nomeDe(`${nomeFolha(ab, i)}-linhas`, 'dxf'), linhasDxf(l, ab.heightMm))
    }
  }

  passo('Montando os arquivos…'); ctx.aoProgresso?.(comArte.length, comArte.length)
  const copiasDe = (abId: string) => { const n = o.copias?.[abId]; return n === undefined ? 1 : Math.max(0, Math.min(999, Math.round(n))) }
  const titulo = `${nomeTema}${nomeVar ? ` · ${nomeVar}` : ''}`
  if (o.formato === 'png') {
    for (const p of paginas) {
      if (o.agrupar === 'molde') {
        for (const m of doc.molds.filter(mm => mm.artboardId === p.ab.id && mm.faces.length))
          await salvar(nomeDe(m.name, 'png'), await recortar(p.png, caixaDoMolde(doc, m.id, o.sobraMm + 3)!, k, 'image/png', DPI_IMPRESSAO))
      } else {
        const u = new Uint8Array(await p.png.arrayBuffer())
        await salvar(nomeDe(nomeFolha(p.ab, p.i), 'png'), new Blob([comPhys(u, DPI_IMPRESSAO) as BlobPart], { type: 'image/png' }))
      }
    }
  } else if (o.agrupar === 'tudo') {
    // Lote 5 (item 79): cada folha repetida na quantidade dela (o MESMO objeto de página → a imagem é embutida 1×)
    const repetidas = paginas.flatMap(p => Array.from({ length: copiasDe(p.ab.id) }, () => p.pagina))
    await salvar(nomeDe('impressao', 'pdf'), new Blob([await montarPdf(repetidas.length ? repetidas : paginas.map(p => p.pagina), titulo) as BlobPart], { type: 'application/pdf' }))
  } else if (o.agrupar === 'prancheta') {
    for (const p of paginas) {
      const n = copiasDe(p.ab.id)
      if (!n) continue
      await salvar(nomeDe(nomeFolha(p.ab, p.i), 'pdf'), new Blob([await montarPdf(Array.from({ length: n }, () => p.pagina), titulo) as BlobPart], { type: 'application/pdf' }))
    }
  } else {
    for (const p of paginas) for (const m of doc.molds.filter(mm => mm.artboardId === p.ab.id && mm.faces.length)) {
      const r = caixaDoMolde(doc, m.id, o.sobraMm + 3)!
      const recorte = await recortar(p.png, r, k, 'image/jpeg', DPI_IMPRESSAO)
      const pg: PaginaPdf = {
        larguraMm: r.w, alturaMm: r.h,
        arte: { bytes: new Uint8Array(await recorte.arrayBuffer()), tipo: 'jpg', larguraMm: r.w, alturaMm: r.h },
        linhas: p.pagina.linhas ? deslocar(linhasDoMoldeNaFolha(m), -r.x, -r.y) : null,
        moldesPdf: (p.pagina.moldesPdf ?? []).filter(x => x.xMm === m.transform.xMm && x.yMm === m.transform.yMm).map(x => ({ ...x, xMm: x.xMm - r.x, yMm: x.yMm - r.y })),
        identidade: {
          qr: (p.pagina.identidade?.qr ?? []).map(x => ({ ...x, xMm: x.xMm - r.x, yMm: x.yMm - r.y })).filter(x => x.xMm >= 0 && x.yMm >= 0 && x.xMm < r.w && x.yMm < r.h),
          logo: (p.pagina.identidade?.logo ?? []).map(x => ({ ...x, xMm: x.xMm - r.x, yMm: x.yMm - r.y })).filter(x => x.xMm >= 0 && x.yMm >= 0 && x.xMm < r.w && x.yMm < r.h),
        },
      }
      if (pg.moldesPdf?.length) pg.linhas = null
      await salvar(nomeDe(m.name, 'pdf'), new Blob([await montarPdf([pg], titulo) as BlobPart], { type: 'application/pdf' }))
    }
  }
  // apliques 3D: as duas folhas (impressos e silhuetas), cada uma com a sua marca
  if (o.apliques !== false && tema.appliques?.enabled) {
    passo('Apliques 3D: silhuetas e folhas…')
    const { gerarFolhasDeApliques } = await import('./apliquesMae')
    const s = await gerarFolhasDeApliques(raiz, doc, tema, marcas, qual => nomeDe(qual, 'png'))
    for (const a of s.arquivos) await salvar(a.nome, a.blob)
    alertas.push(...s.avisos)
  }
  alertas.unshift(...avisosTexto)
  return { pasta, arquivos, alertas, revisar }
}
