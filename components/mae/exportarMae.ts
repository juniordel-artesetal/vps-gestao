'use client'
// EXPORTAÇÃO (Sprint 9) — o "coração usável": a MESMA resolução do vínculo e o MESMO motor da tela geram
//   • ARTE PRA APROVAÇÃO: JPG 150 dpi, recorte exato pela face, com contorno (numa folha só ou por molde);
//   • ARTE PRA IMPRESSÃO: sobra (sangria) + papel de fundo nas abas; por cima, em VETOR, identidade, linhas e
//     marca de registro; PDF (por molde, por prancheta ou tudo junto) ou PNG 300 dpi; linhas em SVG/DXF.
// Tudo no computador: lê da Biblioteca, grava em Exportações/AAAA-MM-DD/. Nada vai ao servidor.
import { resolverPrancheta } from '@/lib/mae/vinculo/resolver'
import { linhasDaPrancheta, linhasDoMolde, deslocar, nosDasLinhas, linhasSvg, linhasDxf, caixaDoMolde, type Linhas } from '@/lib/mae/exportar/linhas'
import { conflitosComMarca, encaixeNaMarca, type Encaixe } from '@/lib/mae/exportar/marca'
import { nomeExportacao, nomeLivre, pastaExportacao } from '@/lib/mae/exportar/nomes'
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
  sobraMm: number
  /** Imprimir as linhas de corte/dobra por cima (ou ocultar). */
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
}

export interface Contexto {
  raiz: FileSystemDirectoryHandle
  doc: DocTrabalho
  tema: DocTema
  identidade: Identidade
  marcas: MarcaRegistro[]
  aoProgredir?: (texto: string) => void
}

/** `revisar` = algum texto pediu revisão (nome longo além do auto-ajuste, fonte substituta…). */
export interface ResultadoExportar { pasta: string; arquivos: string[]; alertas: string[]; revisar: boolean }

const base = { visible: true, locked: true, opacity: 1, fill: 1, blendMode: 'normal' as const, clip: false }

/** Quadrado [0,1]² → retângulo da logo/QR na folha, girado em volta do centro (Lote 1). */
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
        matrix: matrizIdentidade(pos, arq.aspect || 1, m.transform.xMm, m.transform.yMm) })
    }
  }
  return out
}

/** Regiões de impressão (anéis das formas das faces) — para checar conflito com a marca. */
const regioes = (nos: NoCamada[]): Pt[][] => nos.flatMap(n => n.type === 'shape' && n.id.endsWith(':forma') ? [n.rings[0] as Pt[]] : [])

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

export async function exportar(ctx: Contexto, o: OpcoesExportar): Promise<ResultadoExportar> {
  const { raiz, doc, tema, identidade, marcas } = ctx
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
    const n = nomeLivre(nomeExportacao({ tema: nomeTema, nome: nomeVar, molde, data: agora, extensao: ext }), existentes)
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
    ...resolverPrancheta(doc, ab.id, { tema, texto: { fontes: registroFontes, valores, aoDiagramar: i => { if (i.revisar || i.substituta) revisar = true; if (i.aviso) avisosTexto.add(i.aviso) } }, modo, sobraMm: o.sobraMm }),
    ...extras,
  ]
  const renderizar = async (ab: Prancheta, layers: NoCamada[]): Promise<Blob> => {
    const p: Prancheta = { ...ab, layers }
    const falta = await garantirArquivos(p, raiz)
    if (falta.length) alertas.push(`${falta.length} arquivo(s) da arte não estão na Biblioteca (prancheta "${ab.name ?? ab.id}") — saíram em branco. Reconecte a pasta ou troque a imagem.`)
    const r = await motorDaPagina().render(p, k, '#ffffff', 'png')
    if (!r.png) throw new Error('O motor não devolveu a imagem.')
    return r.png
  }
  const comArte = doc.artboards.filter(ab => doc.molds.some(m => m.artboardId === ab.id && m.faces.length))
  if (!comArte.length) throw new Error('Nenhuma prancheta tem molde com faces — monte a base antes de exportar.')

  // ── APROVAÇÃO ──────────────────────────────────────────────────────────────────────────────────
  if (o.tipo === 'aprovacao') {
    const renders: { ab: Prancheta; png: Blob }[] = []
    for (const [i, ab] of comArte.entries()) {
      passo(`Desenhando a prancheta ${i + 1} de ${comArte.length}…`)
      const extras = [...nosIdentidade(doc, ab.id, identidade), ...nosDasLinhas(linhasDaPrancheta(doc, ab.id), { cor: '#1f2937', corDobra: '#6b7280', larguraMm: 0.3 })]
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
    passo(`Desenhando a prancheta ${i + 1} de ${comArte.length} a ${DPI_IMPRESSAO} dpi…`)
    const moldes = doc.molds.filter(m => m.artboardId === ab.id && m.faces.length)
    // linhas: detectadas, ou a página original dos moldes em PDF (vetor exato do arquivo)
    let linhas: Linhas | null = null
    const moldesPdf: MoldePdf[] = []
    if (o.linhas) {
      linhas = { corte: [], dobra: [] }
      for (const m of moldes) {
        const pdf = o.formato === 'pdf' && o.linhasOriginais && (m.source.kind === 'pdf' || /\.pdf$/i.test(m.source.path))
        if (pdf) {
          try {
            const bytes = await bytesDe(m.source.path)
            if ((await sha256(bytes)) !== m.source.sha256) throw new Error('mudou')
            moldesPdf.push({ bytes, pagina: m.source.page ?? 1, crop: m.source.crop, xMm: m.transform.xMm, yMm: m.transform.yMm })
            continue
          } catch { alertas.push(`O PDF original do molde "${m.name}" não está na Biblioteca (ou mudou) — usei as linhas detectadas.`) }
        }
        const l = deslocar(linhasDoMolde(m.faces as never), m.transform.xMm, m.transform.yMm)
        linhas.corte.push(...l.corte); linhas.dobra.push(...l.dobra)
      }
    }
    const pngExtras = o.formato === 'png' ? [...nosIdentidade(doc, ab.id, identidade), ...(linhas ? nosDasLinhas(linhas, { larguraMm: 0.25 }) : [])] : []
    const layers = camadas(ab, pngExtras)
    const png = await renderizar(ab, layers)
    // marca de registro da prancheta
    const marca = marcas.find(mc => mc.id === ab.registrationPresetId) ?? null
    let marcaPdf: PaginaPdf['marca'] = null, encaixe: Encaixe | undefined, pagW = ab.widthMm, pagH = ab.heightMm
    if (marca) {
      try {
        const bytes = await bytesDe(marca.path)
        if ((await sha256(bytes)) !== marca.sha256) alertas.push(`O arquivo da marca "${marca.nome}" mudou desde que foi cadastrado — confira a marca antes de imprimir.`)
        const t = await tamanhoDaPagina(bytes, marca.pagina)
        encaixe = encaixeNaMarca(ab.widthMm, ab.heightMm, t.wMm, t.hMm)
        pagW = t.wMm; pagH = t.hMm
        marcaPdf = { bytes, pagina: marca.pagina }
        if (encaixe.diferente) alertas.push(`A prancheta "${nomeFolha(ab, i)}" (${ab.widthMm.toFixed(0)} × ${ab.heightMm.toFixed(0)} mm) tem tamanho diferente da marca "${marca.nome}" (${t.wMm.toFixed(0)} × ${t.hMm.toFixed(0)} mm) — a arte foi centralizada; confira o encaixe.`)
        else if (encaixe.girar) alertas.push(`Prancheta "${nomeFolha(ab, i)}" em paisagem e marca "${marca.nome}" em retrato: a arte entrou girada 90° na folha da marca.`)
        const conf = conflitosComMarca(marca.zonas, regioes(layers).map(r => r.map(([x, y]) => (encaixe!.girar ? [ab.heightMm - y + encaixe!.dx, x + encaixe!.dy] : [x + encaixe!.dx, y + encaixe!.dy]) as Pt)))
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
          logo.push({ bytes: b, tipo: /\.jpe?g$/i.test(identidade.logo.path) ? 'jpg' : 'png', xMm: pl.xMm + m.transform.xMm, yMm: pl.yMm + m.transform.yMm, wMm: pl.wMm, hMm: pl.wMm / (identidade.logo.aspect || 1), rotationDeg: pl.rotationDeg })
        } catch { alertas.push('A logo da Identidade não está na Biblioteca — saiu sem logo.') }
      }
      if (pq && identidade.qr?.link) qr.push({ texto: identidade.qr.link, xMm: pq.xMm + m.transform.xMm, yMm: pq.yMm + m.transform.yMm, ladoMm: pq.wMm, rotationDeg: pq.rotationDeg })
      else if (pq && identidade.qr) {
        try { logo.push({ bytes: await bytesDe(identidade.qr.path), tipo: 'png', xMm: pq.xMm + m.transform.xMm, yMm: pq.yMm + m.transform.yMm, wMm: pq.wMm, hMm: pq.wMm, rotationDeg: pq.rotationDeg }) } catch { /* sem QR */ }
      }
    }
    paginas.push({ ab, i, png, pagina: {
      larguraMm: pagW, alturaMm: pagH, encaixe, marca: marcaPdf,
      arte: { bytes: new Uint8Array(await png.arrayBuffer()), tipo: 'png', larguraMm: ab.widthMm, alturaMm: ab.heightMm },
      linhas, moldesPdf, identidade: { qr, logo },
    } })
    // só as linhas, para a máquina de corte
    if (o.svg || o.dxf) {
      const l = linhasDaPrancheta(doc, ab.id)
      if (o.svg) await salvar(nomeDe(`${nomeFolha(ab, i)}-linhas`, 'svg'), linhasSvg(l, ab.widthMm, ab.heightMm))
      if (o.dxf) await salvar(nomeDe(`${nomeFolha(ab, i)}-linhas`, 'dxf'), linhasDxf(l, ab.heightMm))
    }
  }

  passo('Montando os arquivos…')
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
    await salvar(nomeDe('impressao', 'pdf'), new Blob([await montarPdf(paginas.map(p => p.pagina), titulo) as BlobPart], { type: 'application/pdf' }))
  } else if (o.agrupar === 'prancheta') {
    for (const p of paginas) await salvar(nomeDe(nomeFolha(p.ab, p.i), 'pdf'), new Blob([await montarPdf([p.pagina], titulo) as BlobPart], { type: 'application/pdf' }))
  } else {
    for (const p of paginas) for (const m of doc.molds.filter(mm => mm.artboardId === p.ab.id && mm.faces.length)) {
      const r = caixaDoMolde(doc, m.id, o.sobraMm + 3)!
      const recorte = await recortar(p.png, r, k, 'image/png', DPI_IMPRESSAO)
      const pg: PaginaPdf = {
        larguraMm: r.w, alturaMm: r.h,
        arte: { bytes: new Uint8Array(await recorte.arrayBuffer()), tipo: 'png', larguraMm: r.w, alturaMm: r.h },
        linhas: p.pagina.linhas ? deslocar(linhasDoMolde(m.faces as never), m.transform.xMm - r.x, m.transform.yMm - r.y) : null,
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
