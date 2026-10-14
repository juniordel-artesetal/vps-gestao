'use client'
// Ponte editor ↔ moldes (Sprints 3+4): importar (copiar para a Biblioteca, preparar, detectar faces,
// organizar nas pranchetas), detectar de novo, ferramentas manuais e o estado das ferramentas.
// As máscaras e prévias ficam só em memória (cache por molde); a receita guarda caminho, hash,
// recorte, calibração e as faces.
import { fechar as fecharMascara, type Mascara } from '@/lib/mae/faces/raster'
import { dentro, centroide } from '@/lib/mae/faces/geometria'
import { create } from 'zustand'
import type { Draft } from 'immer'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useEditor } from './estado'
import { gravar, ler, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { analisarArquivo, prepararFonte, fecharPadraoMm, limiarPadrao, type FonteMolde, type FontePreparada } from '@/lib/mae/importacao/navegador'
import { PX_POR_MM_DETECCAO } from '@/lib/mae/importacao/preparar'
import { detectarNoWorker } from '@/lib/mae/faces/cliente'
import { facesDaReceita, facesParaReceita, organizar } from '@/lib/mae/editor/moldes'
import { areaUtil, centralizarGrupo } from '@/lib/mae/editor/alinhamento'
import type { FaceEdit } from '@/lib/mae/faces/ferramentas'
import type { Pt } from '@/lib/mae/faces/geometria'
import type { DocTrabalho } from '@/lib/mae/schema'
import { pareceArte, AVISO_ARTE_COMO_MOLDE } from '@/lib/mae/editor/diagnostico'

type Molde = DocTrabalho['molds'][number]

// ── cache em memória (por molde) ─────────────────────────────────────────────────────────────────
const cache = new Map<string, FontePreparada>()
export const preparadoDe = (moldeId: string) => cache.get(moldeId)

// ── estado das ferramentas (fora do histórico) ───────────────────────────────────────────────────
export type Modo = 'selecionar' | 'medir' | 'laco' | 'dividir' | 'unir'
export interface EstadoMoldes {
  modo: Modo
  ima: boolean
  /** Face selecionada (molde + face). */
  face: { moldeId: string; faceId: string } | null
  /** Pontos da ferramenta em andamento: laço/dividir (mm do molde) ou medir (mm da prancheta). */
  pontos: Pt[]
  moldeDosPontos: string | null
  medida: { a: Pt; b: Pt; mm: number; artboardId: string } | null
  /** Sobe quando o cache muda (prévia/máscara carregada) para a tela redesenhar. */
  versao: number
  ocupado: string | null
  aviso: string | null
  /** Lote 2 (item 15): moldes selecionados (clique; Shift+clique soma) — alinhar, distribuir, setas. */
  sel: string[]
  /** Lote 6 (item 84): clicou numa área do molde que NÃO é face (linha aberta) — aviso + "Criar face aqui". */
  semFace: { moldeId: string; ponto: Pt; previa?: Pt[]; msg?: string } | null
  set: (p: Partial<EstadoMoldes>) => void
}
export const useMoldes = create<EstadoMoldes>()(set => ({
  modo: 'selecionar', ima: true, face: null, pontos: [], moldeDosPontos: null, medida: null, versao: 0, ocupado: null, aviso: null, sel: [], semFace: null,
  set: p => set(p),
}))
const sinaliza = () => useMoldes.setState(s => ({ versao: s.versao + 1 }))

const aplicar = (label: string, receita: (d: Draft<DocTrabalho>) => void) => useMaeDoc.getState().aplicar(label, receita)
const gid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`
const r3 = (v: number) => Math.round(v * 1000) / 1000

/** Copia o arquivo para Bases/moldes/ (mesmo nome com conteúdo diferente ganha o começo do hash). */
async function guardarNaBiblioteca(raiz: FileSystemDirectoryHandle, arquivo: File): Promise<{ path: string; sha: string }> {
  const sha = await sha256(arquivo)
  const ponto = arquivo.name.lastIndexOf('.')
  const base = (ponto > 0 ? arquivo.name.slice(0, ponto) : arquivo.name).replace(/[<>:"|?*\\/]/g, '_').replace(/[. ]+$/, '') || 'molde'
  const ext = ponto > 0 ? arquivo.name.slice(ponto).toLowerCase() : ''
  let path = `Bases/moldes/${base}${ext}`
  const existente = await ler(raiz, path).catch(() => null)
  if (existente) {
    if ((await sha256(existente)) === sha) return { path, sha }
    path = `Bases/moldes/${base}-${sha.slice(0, 8)}${ext}`
  }
  await gravar(raiz, path, arquivo)
  return { path, sha }
}

function calibracaoDe(f: FonteMolde, extra: { metodo?: 'dpi' | 'width' | 'measure'; escala?: number }): NonNullable<Molde['source']['calibration']> {
  if (f.tipo === 'png' || f.tipo === 'jpg') return { method: extra.metodo ?? 'width', pxPerMm: r3(f.larguraPx! / f.larguraMm) }
  if (f.tipo === 'dxf') return { method: 'vector', mmPerUnit: f.mmPorUnidade ?? 1, ...(extra.escala && extra.escala !== 1 ? { scale: r3(extra.escala) } : {}) }
  return { method: 'vector', ...(extra.escala && extra.escala !== 1 ? { scale: r3(extra.escala) } : {}) }
}

export interface FonteConfirmada { fonte: FonteMolde; metodo?: 'dpi' | 'width' | 'measure'; escala?: number }

/** Importa as fontes já confirmadas: Biblioteca → preparar → faces (Worker) → organizar → receita. */
/** Amostra reduzida da imagem → parece arte colorida? (falha de leitura = não avisa) */
async function arteComoMolde(arq: Blob): Promise<boolean> {
  try {
    const bmp = await createImageBitmap(arq)
    const k = Math.min(1, 160 / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k))
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true })!
    g.drawImage(bmp, 0, 0, w, h); bmp.close()
    return pareceArte(g.getImageData(0, 0, w, h).data)
  } catch { return false }
}

export async function importarMoldes(itens: FonteConfirmada[], raiz: FileSystemDirectoryHandle): Promise<string[]> {
  const st = useMoldes.getState()
  const novos: Molde[] = []
  const erros: string[] = []
  for (const [i, it] of itens.entries()) {
    const f = it.fonte
    st.set({ ocupado: `Lendo ${f.nome} (${i + 1}/${itens.length})…` })
    try {
      // Lote 14 (item 193): PNG/JPG colorido como molde = provavelmente a ARTE (o molde é só o contorno de corte)
      if ((f.tipo === 'png' || f.tipo === 'jpg') && await arteComoMolde(f.arquivo)) erros.push(`${f.nome}: ${AVISO_ARTE_COMO_MOLDE}`)
      const { path, sha } = await guardarNaBiblioteca(raiz, f.arquivo)
      const prep = await prepararFonte(f)
      st.set({ ocupado: `Detectando as faces de ${f.nome}…` })
      const fecharMm = fecharPadraoMm(f.tipo)
      const det = await detectarNoWorker(prep.linhas, { pxPorMm: prep.pxPorMm, fecharMm, dobras: prep.dobras })
      const id = gid('m')
      cache.set(id, prep)
      novos.push({
        id, name: f.nome.slice(0, 120), artboardId: '', transform: { xMm: 0, yMm: 0, rotationDeg: 0 },
        source: {
          path, sha256: sha, widthMm: prep.recorte.wMm, heightMm: prep.recorte.hMm, kind: f.tipo,
          ...(f.pagina ? { page: f.pagina } : {}), crop: prep.recorte, calibration: calibracaoDe(f, it),
        },
        detection: { closeMm: fecharMm, threshold: limiarPadrao(f.tipo) },
        faces: facesParaReceita(id, det.faces),
      })
    } catch (e) { erros.push((e as Error)?.message || `${f.nome}: falhou`) }
  }
  if (novos.length) {
    const doc = useMaeDoc.getState().hist.atual
    const vazia = (abId: string) => !doc.molds.some(m => m.artboardId === abId) && !doc.artboards.find(a => a.id === abId)?.layers?.length
    // Lote 6 (item 114): a importação vai para a PRANCHETA SELECIONADA (ela é a primeira a ser tentada)
    const selAb = useEditor.getState().prancheta
    const ordem = [...doc.artboards].sort((a, b) => (a.id === selAb ? -1 : b.id === selAb ? 1 : 0))
    const org = organizar(ordem, doc.molds, novos.map(m => ({ wMm: m.source.widthMm, hMm: m.source.heightMm ?? m.source.widthMm })), vazia, () => gid('ab'))
    novos.forEach((m, k) => { m.artboardId = org.posicoes[k].artboardId; m.transform = { xMm: org.posicoes[k].xMm, yMm: org.posicoes[k].yMm, rotationDeg: 0 } })
    // Lote 2 (item 15): numa folha que estava vazia, os moldes novos entram CENTRALIZADOS (como bloco)
    for (const p of org.pranchetas) {
      const nela = novos.filter(m => m.artboardId === p.id)
      if (!nela.length || doc.molds.some(m => m.artboardId === p.id)) continue
      const caixas = nela.map(m => ({ x: m.transform.xMm, y: m.transform.yMm, w: m.source.widthMm, h: m.source.heightMm ?? m.source.widthMm }))
      const dl = centralizarGrupo(caixas, areaUtil(p.widthMm, p.heightMm))
      for (const m of nela) m.transform = { ...m.transform, xMm: r3(m.transform.xMm + dl.dx), yMm: r3(m.transform.yMm + dl.dy) }
    }
    aplicar(novos.length === 1 ? `Importar molde ${novos[0].name}` : `Importar ${novos.length} moldes`, d => {
      for (const p of org.pranchetas) {
        const ab = d.artboards.find(a => a.id === p.id)
        if (ab) { ab.widthMm = p.widthMm; ab.heightMm = p.heightMm }
        else d.artboards.push({ id: p.id, widthMm: p.widthMm, heightMm: p.heightMm })
      }
      d.molds.push(...(novos as Draft<Molde>[]))
    })
  }
  st.set({ ocupado: null, aviso: erros.length ? erros.join(' · ') : null })
  sinaliza()
  return erros
}

/**
 * Recarrega a máscara/prévia de um molde a partir do arquivo na Biblioteca (depois de abrir a base ou
 * recarregar a página). Confere o hash: arquivo trocado = "arquivo não encontrado".
 */
export async function garantirPreparado(m: Molde, raiz: FileSystemDirectoryHandle | null): Promise<FontePreparada | null> {
  const ja = cache.get(m.id)
  if (ja) return ja
  if (!raiz) return null
  const arq = await ler(raiz, m.source.path).catch(() => null)
  if (!arq || (await sha256(arq)) !== m.source.sha256) return null
  const fontes = await analisarArquivo(new File([arq], m.source.path.split('/').pop()!, { type: arq.type }))
  const f = fontes[(m.source.page ?? 1) - 1] ?? fontes[0]
  const c = m.source.calibration
  if ((f.tipo === 'png' || f.tipo === 'jpg') && c?.pxPerMm) { f.larguraMm = f.larguraPx! / c.pxPerMm; f.alturaMm = f.alturaPx! / c.pxPerMm }
  if (f.tipo === 'dxf' && c?.mmPerUnit && !f.mmPorUnidade) { f.larguraMm *= c.mmPerUnit; f.alturaMm *= c.mmPerUnit }
  if (c?.scale) { f.larguraMm *= c.scale; f.alturaMm *= c.scale }
  const prep = await prepararFonte(f, m.detection?.threshold)
  cache.set(m.id, prep)
  sinaliza()
  return prep
}

/** Detecta as faces de novo com outro "Fechar pontilhado" (substitui as faces do molde). */
export async function detectarDeNovo(moldeId: string, fecharMm: number): Promise<void> {
  const prep = cache.get(moldeId)
  if (!prep) return
  useMoldes.getState().set({ ocupado: 'Detectando as faces…' })
  try {
    const det = await detectarNoWorker(prep.linhas, { pxPorMm: prep.pxPorMm, fecharMm, dobras: prep.dobras })
    aplicar(`Detectar faces (fechar ${String(fecharMm).replace('.', ',')} mm)`, d => {
      const m = d.molds.find(x => x.id === moldeId)
      if (!m) return
      m.faces = facesParaReceita(moldeId, det.faces) as Draft<Molde['faces']>
      m.detection = { closeMm: fecharMm, threshold: m.detection?.threshold ?? 240 }
    })
    useMoldes.getState().set({ face: null })
  } finally { useMoldes.getState().set({ ocupado: null }) }
}

/**
 * Lote 6 (item 84): o ponto está numa área FECHADA pelas linhas do molde (fechando frestas de até 1,5 mm)? Inunda a
 * partir dele: se chega na borda do desenho, está FORA do molde (canto do retângulo) e não é "face faltando".
 */
const fechadas = new Map<string, Mascara>()
export function areaDentroDoMolde(moldeId: string, p: Pt): boolean {
  const prep = cache.get(moldeId)
  if (!prep) return false
  let m = fechadas.get(moldeId)
  if (!m) { m = fecharMascara(prep.linhas, Math.round(1.5 * prep.pxPorMm)); fechadas.set(moldeId, m) }
  const x0 = Math.round(p[0] * prep.pxPorMm), y0 = Math.round(p[1] * prep.pxPorMm)
  if (x0 <= 0 || y0 <= 0 || x0 >= m.w - 1 || y0 >= m.h - 1 || m.d[y0 * m.w + x0]) return false
  const visto = new Uint8Array(m.w * m.h), fila = new Int32Array(m.w * m.h)
  let ini = 0, fim = 0
  fila[fim++] = y0 * m.w + x0; visto[y0 * m.w + x0] = 1
  while (ini < fim) {
    const i = fila[ini++], x = i % m.w, y = (i - x) / m.w
    if (x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1) return false
    for (const j of [i - 1, i + 1, i - m.w, i + m.w]) if (!visto[j] && !m.d[j]) { visto[j] = 1; fila[fim++] = j }
  }
  return true
}

/**
 * Lote 6 (item 84): "CRIAR FACE AQUI" — a área clicada não virou face porque a linha do molde tem uma fresta. Detecta
 * de novo com o "Fechar pontilhado" cada vez maior até achar a MENOR região em volta do ponto que não engole nenhuma
 * face que já existe, e acrescenta só ela (as outras faces ficam como estão). Devolve a fresta fechada (mm) ou null.
 */
export async function criarFaceAqui(moldeId: string, p: Pt): Promise<number | null> {
  const prep = cache.get(moldeId)
  const m = useMaeDoc.getState().hist.atual.molds.find(x => x.id === moldeId)
  if (!prep || !m) return null
  useMoldes.getState().set({ ocupado: 'Procurando a linha aberta…' })
  try {
    const existentes = m.faces.filter(f => !f.hole).map(f => f.polygonMm as Pt[])
    const areaMolde = (m.source.widthMm || 1) * (m.source.heightMm || m.source.widthMm || 1)
    for (const fecharMm of [0.5, 0.9, 1.4, 2, 3, 4.5]) {
      const det = await detectarNoWorker(prep.linhas, { pxPorMm: prep.pxPorMm, fecharMm, dobras: prep.dobras })
      const alvo = det.faces.filter(f => !f.furo && dentro(p, f.poligono) && f.areaMm2 < areaMolde * 0.8)
        .filter(f => !existentes.some(e => dentro(centroide(e), f.poligono)))
        .sort((a, b) => a.areaMm2 - b.areaMm2)[0]
      if (!alvo) continue
      const ok = editarFaces(moldeId, 'Criar face aqui', fs => [...fs, { poligono: alvo.poligono, tipos: alvo.tipos, furo: false, manual: true }])
      return ok ? fecharMm : null
    }
    return null
  } finally { useMoldes.getState().set({ ocupado: null }) }
}

/** Aplica uma edição de faces (ferramenta manual) num molde, pelo histórico. */
export function editarFaces(moldeId: string, label: string, editar: (faces: FaceEdit[]) => FaceEdit[] | null): boolean {
  const m = useMaeDoc.getState().hist.atual.molds.find(x => x.id === moldeId)
  if (!m) return false
  const novas = editar(facesDaReceita(m.faces))
  if (!novas) return false
  aplicar(label, d => {
    const dm = d.molds.find(x => x.id === moldeId)
    if (dm) dm.faces = facesParaReceita(moldeId, novas) as Draft<Molde['faces']>
  })
  return true
}

export function excluirMolde(moldeId: string) {
  aplicar('Excluir molde', d => { d.molds = d.molds.filter(m => m.id !== moldeId) })
  cache.delete(moldeId)
  useMoldes.getState().set({ face: null })
}

export const PX_MM_DETECCAO = PX_POR_MM_DETECCAO

/** Lote 2 (item 15): move os moldes (mm, na prancheta). `juntar` agrupa no Ctrl+Z (setas seguidas = 1 passo). */
export function moverMoldes(label: string, deltas: Map<string, { dx: number; dy: number }>, juntar?: string): void {
  if (![...deltas.values()].some(d => d.dx || d.dy)) return
  useMaeDoc.getState().aplicar(label, d => {
    for (const m of d.molds) {
      const dl = deltas.get(m.id)
      if (dl) { m.transform.xMm = Math.round((m.transform.xMm + dl.dx) * 100) / 100; m.transform.yMm = Math.round((m.transform.yMm + dl.dy) * 100) / 100 }
    }
  }, juntar)
}

/**
 * Lote 6 (item 95): lê o ARQUIVO DE CORTE da plotter (Silhouette: SVG/DXF/PDF com as peças e as marcas) — devolve o
 * tamanho da página e a caixa de cada contorno fechado, em mm da página. As vagas do gabarito saem daqui.
 */
export async function lerGabaritoDaPlotter(arquivo: File): Promise<{ wMm: number; hMm: number; contornos: { x: number; y: number; w: number; h: number }[] }> {
  const fontes = await analisarArquivo(arquivo)
  const f = fontes[0]
  if (!f) throw new Error('O arquivo não tem página.')
  if (!(f.larguraMm > 0 && f.alturaMm > 0)) throw new Error('O arquivo não informa o tamanho da folha (confira a unidade).')
  const prep = await prepararFonte(f)
  const det = await detectarNoWorker(prep.linhas, { pxPorMm: prep.pxPorMm, fecharMm: 0.3, dobras: null })
  const contornos = det.faces.filter(x => !x.furo).map(x => {
    const xs = x.poligono.map(p => p[0]), ys = x.poligono.map(p => p[1])
    const x0 = Math.min(...xs), y0 = Math.min(...ys)
    return { x: r3(prep.recorte.xMm + x0), y: r3(prep.recorte.yMm + y0), w: r3(Math.max(...xs) - x0), h: r3(Math.max(...ys) - y0) }
  })
  return { wMm: r3(f.larguraMm), hMm: r3(f.alturaMm), contornos }
}
