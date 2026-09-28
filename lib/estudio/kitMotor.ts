// SOA Design — KIT COMPOSER (Fases 4/5 da spec): KitTemplate (slots → faca) · KitInstancia (tema: slot → caixa viva) ·
// Composição (posições normalizadas por slot) · Cena · Output · ExportPreset. Pipeline:
//   BoxInstance → (caixa renderizada) → Composição (kit) → Cena → Output (tamanho/formato do preset)
// Tudo por REFERÊNCIA: o kit consome as caixas vivas direto (nada é baixado e reenviado).
// GRAFO DE DEPENDÊNCIAS: caixa = hash(instância + snapshot da faca/mockup + arte + apliques); kit = hash(composição +
// hashes das caixas); saída = hash(kit|caixa + cena + tamanho + formato). Caches em cascata: mudou o Cubo → só o Cubo e
// os kits que o usam re-renderizam; Milk/Pirâmide/… vêm do cache. VERSÃO: o projeto guarda o SNAPSHOT dos templates que
// usou (faca, mockup, kit, composição) — editar um template não mexe em projeto antigo; atualizar é opt-in.
import { renderInstancia, type BoxInstancia, type BoxTemplate, type ApliquePronto } from './caixaViva'
import { prepararSalvo, type MockupPronto } from './mockupCliente'
import { produtoRecortado } from './saidaMockup'
import { renderCena, novoCanvas, carregarImagem, aparar } from './mockup'
import { gerarAplique, type ConfigAplique } from './aplique'
import { hashTexto } from './matcher'
import type { ConfigCena } from './mockupTipos'
import type { MockupAreas } from './mockupFoto'

export interface KitSlot { id: string; name: string; boxTemplateId: string; required: boolean; aliases: string[]; order: number }
export interface KitTemplate { id: string; nome: string; slots: KitSlot[]; versao: number; config: Record<string, unknown> }
export interface PosicaoSlot { x: number; y: number; escala: number; rot: number; z: number; oculto?: boolean; bloqueado?: boolean }
export interface Composicao { id: string; kitTemplateId: string; nome: string; posicoes: Record<string, PosicaoSlot>; versao: number; config: { proporcao?: number } }
export interface SnapKit { kitVersao: number; slots: KitSlot[]; comps: Record<string, { versao: number; nome: string; posicoes: Record<string, PosicaoSlot>; config: Composicao['config'] }> }
export interface KitInstancia { id: string; tema: string; kitTemplateId: string; slots: Record<string, string>; composicoes: { composicaoId: string; ajustes?: Record<string, Partial<PosicaoSlot>> }[]; config: { snap?: SnapKit } & Record<string, unknown> }
/** Snapshot guardado na caixa viva: a faca e o mockup NA VERSÃO em que ela foi feita. */
export interface SnapCaixa { tpl?: { versao: number; regioes: BoxTemplate['regioes']; largura: number; altura: number }; mockup?: Record<string, unknown> & { versao?: number } }

export type TipoOutput = 'kit' | 'individual' | 'composicao'
export interface TamanhoExport { rotulo: string; largura: number; altura: number }
export interface ExportPreset { id: string; nome: string; tamanhos: TamanhoExport[]; qualidade: number; formato: 'jpg' | 'png'; outputsIncluidos: TipoOutput[]; cenaDefault: string | null; fabrica?: boolean }
/** Presets de fábrica — NÃO presos a um marketplace (ela ajusta/copia). */
export const PRESETS_EXPORT_PADRAO: ExportPreset[] = [
  { id: 'fx-shopee', nome: 'Shopee', tamanhos: [{ rotulo: 'quadrada', largura: 1000, altura: 1000 }], qualidade: 92, formato: 'jpg', outputsIncluidos: ['kit', 'individual'], cenaDefault: 'liso-branco', fabrica: true },
  { id: 'fx-instagram', nome: 'Instagram', tamanhos: [{ rotulo: 'feed 4x5', largura: 1080, altura: 1350 }, { rotulo: 'quadrada', largura: 1080, altura: 1080 }], qualidade: 95, formato: 'jpg', outputsIncluidos: ['kit', 'composicao'], cenaDefault: 'fx-estudio-rosa', fabrica: true },
  { id: 'fx-ml', nome: 'Mercado Livre', tamanhos: [{ rotulo: 'quadrada', largura: 1200, altura: 1200 }], qualidade: 92, formato: 'jpg', outputsIncluidos: ['kit', 'individual'], cenaDefault: 'liso-branco', fabrica: true },
  { id: 'fx-elo7', nome: 'Elo7', tamanhos: [{ rotulo: 'quadrada', largura: 1000, altura: 1000 }], qualidade: 92, formato: 'jpg', outputsIncluidos: ['kit', 'individual', 'composicao'], cenaDefault: 'fx-estudio-branco', fabrica: true },
  { id: 'fx-pinterest', nome: 'Pinterest', tamanhos: [{ rotulo: 'vertical 2x3', largura: 1000, altura: 1500 }], qualidade: 92, formato: 'jpg', outputsIncluidos: ['kit'], cenaDefault: 'fx-ceu-algodao', fabrica: true },
]

/**
 * Disposição inicial: caixas lado a lado, cabendo na tela, com a ALTURA REAL de cada modelo (a Milk de 12 cm fica
 * maior que o Cubo de 8 cm) e as bases no mesmo chão. `alturas` = cm da caixa montada (da faca), quando houver.
 */
export function posicoesPadrao(slots: KitSlot[], alturas: Record<string, number> = {}): Record<string, PosicaoSlot> {
  const n = slots.length, out: Record<string, PosicaoSlot> = {}
  const ordem = [...slots].sort((a, b) => a.order - b.order)
  const cols = n <= 4 ? n : Math.ceil(n / 2), linhas = n <= 4 ? 1 : 2
  const amax = Math.max(1, ...ordem.map(s => alturas[s.id] || 0))
  const base = Math.min(0.62, 0.8 / linhas, 0.95 / cols)
  ordem.forEach((s, i) => {
    const col = i % cols, lin = Math.floor(i / cols)
    const esc = base * (alturas[s.id] ? Math.max(0.45, alturas[s.id] / amax) : 1)
    const chao = linhas === 1 ? 0.82 : 0.47 + lin * 0.45
    out[s.id] = { x: (col + 0.5) / cols, y: chao - esc / 2, escala: esc, rot: 0, z: lin * 10 + i }
  })
  return out
}
export const posicaoEfetiva = (comp: { posicoes: Record<string, PosicaoSlot> }, ajustes: Record<string, Partial<PosicaoSlot>> | undefined, slotId: string): PosicaoSlot | null => {
  const p = comp.posicoes[slotId]; if (!p) return null
  return { ...p, ...(ajustes?.[slotId] || {}) }
}

// ── caches (LRU simples) ───────────────────────────────────────────────────────────────────────────────────────
class LRU<V> {
  private m = new Map<string, V>()
  constructor(private max: number) {}
  get(k: string) { const v = this.m.get(k); if (v !== undefined) { this.m.delete(k); this.m.set(k, v) } return v }
  set(k: string, v: V) { this.m.delete(k); this.m.set(k, v); while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string) }
  has(k: string) { return this.m.has(k) }
  delete(k: string) { this.m.delete(k) }
}
export interface ApliqueRef { id: string; pngUrl: string | null; config: ConfigAplique }
export type Res = 'previa' | 'alta'

export class MotorKit {
  tpls = new Map<string, BoxTemplate>()
  mockupsRow = new Map<string, Record<string, unknown>>()
  apliques = new Map<string, ApliqueRef>()
  /** arte local (lote sem salvar): url → File */
  artesLocais = new Map<string, Blob>()
  private planos = new Map<string, Promise<HTMLCanvasElement>>()
  private smarts = new Map<string, Promise<MockupPronto | null>>()
  private apliquesProntos = new Map<string, Promise<ApliquePronto | null>>()
  private caixas = new LRU<Promise<HTMLCanvasElement>>(80)
  private kits = new LRU<Promise<HTMLCanvasElement>>(40)
  private bases = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
  stats = { caixaRender: 0, caixaCache: 0, kitRender: 0, kitCache: 0 }

  /** Atualiza o que o motor conhece (templates/mockups/apliques). Os caches continuam: só o que mudou muda de hash. */
  definir(p: { tpls: BoxTemplate[]; mockups: Record<string, unknown>[]; apliques: ApliqueRef[] }) {
    this.tpls = new Map(p.tpls.map(t => [t.id, t])); this.mockupsRow = new Map(p.mockups.map(m => [String(m.id), m])); this.apliques = new Map(p.apliques.map(a => [a.id, a]))
  }

  /** faca e mockup que valem para ESTA caixa: o snapshot (versão em que foi feita) ou, sem snapshot, o atual */
  tplDe(inst: BoxInstancia): BoxTemplate | null {
    const live = this.tpls.get(inst.boxTemplateId); const s = (inst.config as { snap?: SnapCaixa }).snap
    if (!live) return null
    return s?.tpl ? { ...live, regioes: s.tpl.regioes, largura: s.tpl.largura, altura: s.tpl.altura } : live
  }
  mockupRowDe(inst: BoxInstancia): Record<string, unknown> | null {
    const s = (inst.config as { snap?: SnapCaixa }).snap
    return s?.mockup || (inst.mockupId ? this.mockupsRow.get(inst.mockupId) || null : null)
  }
  hashCaixa(inst: BoxInstancia): string {
    const tpl = this.tplDe(inst), row = this.mockupRowDe(inst)
    const aps = inst.apliques.map(a => { const r = this.apliques.get(a.apliqueId); return [a, r ? hashTexto(JSON.stringify([r.pngUrl, r.config])) : null] })
    return hashTexto(JSON.stringify(['caixa-v1', inst.artworkUrl, inst.faces, aps, tpl ? [tpl.id, tpl.regioes] : null, row ? [row.id, row.fotoUrl, row.areaAplicacao, row.config] : null]))
  }
  private plano(url: string | null): Promise<HTMLCanvasElement | null> {
    if (!url) return Promise.resolve(null)
    let p = this.planos.get(url)
    if (!p) {
      const local = this.artesLocais.get(url)
      p = (async () => { const u = local ? URL.createObjectURL(local) : url; try { const im = await carregarImagem(u); const k = Math.min(1, 3000 / Math.max(im.naturalWidth, im.naturalHeight)), c = novoCanvas(im.naturalWidth * k, im.naturalHeight * k); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); return c } finally { if (local) URL.revokeObjectURL(u) } })()
      this.planos.set(url, p); p.catch(() => this.planos.delete(url))
      if (this.planos.size > 120) this.planos.delete(this.planos.keys().next().value as string)
    }
    return p
  }
  private smart(row: Record<string, unknown>): Promise<MockupPronto | null> {
    const k = hashTexto(JSON.stringify([row.id, row.fotoUrl, row.areaAplicacao, row.config]))
    let p = this.smarts.get(k)
    if (!p) { p = prepararSalvo(row).catch(() => null); this.smarts.set(k, p) }
    return p
  }
  private aplique(id: string, res: Res): Promise<ApliquePronto | null> {
    const r = this.apliques.get(id)
    if (!r?.pngUrl) return Promise.resolve(null)
    const k = `${id}|${res}|${hashTexto(JSON.stringify(r.config))}`
    let p = this.apliquesProntos.get(k)
    if (!p) { p = (async () => { const im = await carregarImagem(r.pngUrl!); return { composto: (await gerarAplique(im, r.config, { maxLado: res === 'alta' ? 1800 : 700 })).composto } })().catch(() => null); this.apliquesProntos.set(k, p) }
    return p
  }
  /** A caixa pronta (produto recortado, fundo transparente) — do cache se nada mudou. */
  caixa(inst: BoxInstancia, res: Res): Promise<HTMLCanvasElement> {
    const k = `${this.hashCaixa(inst)}|${res}`
    const c = this.caixas.get(k)
    if (c) { this.stats.caixaCache++; return c }
    this.stats.caixaRender++
    const p = (async () => {
      const tpl = this.tplDe(inst), row = this.mockupRowDe(inst)
      if (!tpl) throw new Error('faca não encontrada')
      if (!row) throw new Error('a faca não tem mockup (gere o “mockup 3D” na faca)')
      const m = await this.smart(row)
      if (!m?.smart) throw new Error('mockup inválido')
      const plan = await this.plano(inst.artworkUrl)
      const aps = new Map<string, ApliquePronto>()
      for (const a of inst.apliques) { const x = await this.aplique(a.apliqueId, res); if (x) aps.set(a.apliqueId, x) }
      let base: HTMLCanvasElement | undefined
      if (res === 'previa') { base = this.bases.get(m.smart.foto); if (!base) { const k2 = Math.min(1, 900 / Math.max(m.smart.foto.width, m.smart.foto.height)); base = novoCanvas(m.smart.foto.width * k2, m.smart.foto.height * k2); base.getContext('2d')!.drawImage(m.smart.foto, 0, 0, base.width, base.height); this.bases.set(m.smart.foto, base) } }
      const out = renderInstancia({ inst, tpl, plan, mockup: m.smart, apliques: aps, base })
      return produtoRecortado(m.smart.cfg as MockupAreas, out) || aparar(out)
    })()
    this.caixas.set(k, p); p.catch(() => this.caixas.delete(k))   // falha não fica no cache: o "tentar de novo" refaz
    return p
  }
  hashKit(comp: { id?: string; posicoes: Record<string, PosicaoSlot>; config?: Composicao['config'] }, ajustes: Record<string, Partial<PosicaoSlot>> | undefined, caixas: Record<string, BoxInstancia | undefined>): string {
    return hashTexto(JSON.stringify(['kit-v1', comp.posicoes, comp.config, ajustes || {}, Object.entries(caixas).sort().map(([s, i]) => [s, i ? this.hashCaixa(i) : null])]))
  }
  /** O kit (fundo transparente) na composição, a partir das caixas — só re-renderiza se algo dele mudou. */
  kit(comp: { posicoes: Record<string, PosicaoSlot>; config?: Composicao['config'] }, ajustes: Record<string, Partial<PosicaoSlot>> | undefined, caixas: Record<string, BoxInstancia | undefined>, res: Res): Promise<HTMLCanvasElement> {
    const k = `${this.hashKit(comp, ajustes, caixas)}|${res}`
    const c = this.kits.get(k)
    if (c) { this.stats.kitCache++; return c }
    this.stats.kitRender++
    const p = (async () => {
      const prop = comp.config?.proporcao || 1
      const W = res === 'alta' ? 2400 : 900, H = Math.round(W / prop)
      // desenha com MARGEM (nada é cortado se a caixa passar da moldura) e recorta no conteúdo — a cena posiciona o conjunto
      const mg = 0.35, out = novoCanvas(W * (1 + 2 * mg), H * (1 + 2 * mg)), g = out.getContext('2d')!
      g.translate(W * mg, H * mg)
      const itens = Object.entries(caixas).map(([sid, inst]) => ({ sid, inst, pos: posicaoEfetiva(comp, ajustes, sid) })).filter(x => x.inst && x.pos && !x.pos.oculto).sort((a, b) => a.pos!.z - b.pos!.z)
      for (const it of itens) {
        const cv = await this.caixa(it.inst!, res).catch(e => { throw new Error(`caixa “${it.sid}”: ${(e as Error).message}`) })
        const p = it.pos!, h = p.escala * H, w = h * (cv.width / cv.height)
        g.save(); g.translate(p.x * W, p.y * H); g.rotate((p.rot * Math.PI) / 180)
        // sombra de contato de cada caixa no chão
        const gr = g.createRadialGradient(0, h / 2, 0, 0, h / 2, w * 0.55); gr.addColorStop(0, 'rgba(0,0,0,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.save(); g.scale(1, 0.18); g.fillStyle = gr; g.beginPath(); g.arc(0, (h / 2) / 0.18, w * 0.55, 0, Math.PI * 2); g.fill(); g.restore()
        g.imageSmoothingQuality = 'high'; g.drawImage(cv, -w / 2, -h / 2, w, h)
        g.restore()
      }
      return aparar(out)
    })()
    this.kits.set(k, p); p.catch(() => this.kits.delete(k))
    return p
  }
}

/** Saída final: o produto (caixa ou kit, transparente) na cena, no tamanho pedido. */
export function naCena(produto: HTMLCanvasElement, cena: ConfigCena | null, W: number, H: number, img?: (u: string) => HTMLImageElement | undefined, ajuste?: { altura?: number; cy?: number }): HTMLCanvasElement {
  if (!cena) { const out = novoCanvas(W, H), g = out.getContext('2d')!, k = Math.min(W / produto.width, H / produto.height) * 0.92; g.drawImage(produto, (W - produto.width * k) / 2, (H - produto.height * k) / 2, produto.width * k, produto.height * k); return out }
  const c = ajuste ? { ...cena, produto: { ...cena.produto, altura: ajuste.altura ?? cena.produto.altura, cy: ajuste.cy ?? cena.produto.cy } } : cena
  return renderCena(produto, c, W, H, img)
}

/** O snapshot das versões atuais (ao criar um tema ou quando ela aceita atualizar). */
export function snapKit(kit: KitTemplate, comps: Composicao[]): SnapKit {
  return { kitVersao: kit.versao || 1, slots: kit.slots, comps: Object.fromEntries(comps.map(c => [c.id, { versao: c.versao || 1, nome: c.nome, posicoes: c.posicoes, config: c.config }])) }
}
export function snapCaixa(tpl: BoxTemplate & { versao?: number }, mockupRow: Record<string, unknown> | null): SnapCaixa {
  return { tpl: { versao: tpl.versao || 1, regioes: tpl.regioes, largura: tpl.largura, altura: tpl.altura }, mockup: mockupRow ? { id: mockupRow.id, tipo: mockupRow.tipo, nome: mockupRow.nome, fotoUrl: mockupRow.fotoUrl, areaAplicacao: mockupRow.areaAplicacao, config: mockupRow.config, versao: Number(mockupRow.versao) || 1 } : undefined }
}
/** Há versão mais nova dos templates que este tema usa? (atualizar é opt-in) */
export function versoesNovas(ki: KitInstancia, kit: KitTemplate | undefined, comps: Composicao[]): string[] {
  const s = ki.config.snap, out: string[] = []
  if (!s || !kit) return out
  if ((kit.versao || 1) > s.kitVersao) out.push(`kit v${s.kitVersao} → v${kit.versao}`)
  for (const c of comps) { const v = s.comps[c.id]; if (v && (c.versao || 1) > v.versao) out.push(`${c.nome} v${v.versao} → v${c.versao}`) }
  return out
}
