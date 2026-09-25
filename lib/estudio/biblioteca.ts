// SOA Edition — BIBLIOTECA NATIVA do editor: elementos/adesivos, molduras (frames), grades de fotos e
// templates do nicho (festa, papelaria, tags). 🔒 100% AUTORAL: tudo desenhado aqui em código (formas
// e SVG próprios) com as 8 fontes OFL nativas — nenhuma arte, personagem ou marca de terceiros.
import { FabricObject, Group, Rect, Ellipse, Polygon, Path, Textbox, Circle, Gradient, StaticCanvas, Point, loadSVGFromString, util } from 'fabric'
import { pontosEstrela, pontosCoracao, pontosPoligono, novoIdCamada, soa, serializar, criarCamadaImagem, type Soa, type DesignJson } from './camadas'
import { FONTES_NATIVAS } from '@/components/estudio/fontesNativas'

const fonte = (id: string) => FONTES_NATIVAS.find(f => f.id === id)?.familia || FONTES_NATIVAS[0].familia
const marcar = <T extends FabricObject>(o: T, nome: string, tipo: Soa['soaTipo'], extra: Partial<Soa> = {}): T =>
  Object.assign(o, { soaId: novoIdCamada(), soaNome: nome, soaTipo: tipo, ...extra } satisfies Soa)

// ── ELEMENTOS / ADESIVOS (SVG autorais, 200×200) ────────────────────────────────
export interface Elemento { id: string; nome: string; svg: string }
const svg = (corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${corpo}</svg>`
export const ELEMENTOS: Elemento[] = [
  { id: 'brilho', nome: 'Brilho', svg: svg('<path fill="#f5c542" d="M100 10 C108 70 130 92 190 100 C130 108 108 130 100 190 C92 130 70 108 10 100 C70 92 92 70 100 10Z"/>') },
  { id: 'brilhos', nome: 'Brilhos', svg: svg('<path fill="#f5c542" d="M70 30 C75 70 90 85 130 90 C90 95 75 110 70 150 C65 110 50 95 10 90 C50 85 65 70 70 30Z"/><path fill="#fb923c" d="M150 110 C153 135 162 144 187 147 C162 150 153 159 150 184 C147 159 138 150 113 147 C138 144 147 135 150 110Z"/>') },
  { id: 'balao-fala', nome: 'Balão de fala', svg: svg('<path fill="#ffffff" stroke="#1f2937" stroke-width="6" d="M30 25 H170 A22 22 0 0 1 192 47 V117 A22 22 0 0 1 170 139 H85 L50 175 V139 H30 A22 22 0 0 1 8 117 V47 A22 22 0 0 1 30 25Z"/>') },
  { id: 'nuvem', nome: 'Nuvem', svg: svg('<path fill="#e0f2fe" d="M55 150 A35 35 0 0 1 50 80 A45 45 0 0 1 130 60 A38 38 0 0 1 175 110 A30 30 0 0 1 160 150 Z"/>') },
  { id: 'laco', nome: 'Laço', svg: svg('<path fill="#ec4899" d="M100 100 C70 55 20 45 18 85 C16 125 70 120 100 100Z"/><path fill="#ec4899" d="M100 100 C130 55 180 45 182 85 C184 125 130 120 100 100Z"/><path fill="#db2777" d="M100 100 L75 170 L92 162 L100 180 L108 162 L125 170Z"/><circle cx="100" cy="100" r="16" fill="#be185d"/>') },
  { id: 'balao-festa', nome: 'Balão de festa', svg: svg('<ellipse cx="100" cy="80" rx="55" ry="68" fill="#f97316"/><path fill="#ea580c" d="M92 146 L108 146 L100 158Z"/><path fill="none" stroke="#9ca3af" stroke-width="3" d="M100 158 C90 175 110 180 100 198"/><ellipse cx="80" cy="55" rx="10" ry="18" fill="#ffffff" opacity="0.45"/>') },
  { id: 'coroa', nome: 'Coroa', svg: svg('<path fill="#f5c542" stroke="#b45309" stroke-width="4" d="M20 150 L30 60 L70 100 L100 40 L130 100 L170 60 L180 150Z"/><circle cx="30" cy="58" r="9" fill="#f5c542"/><circle cx="100" cy="38" r="9" fill="#f5c542"/><circle cx="170" cy="58" r="9" fill="#f5c542"/>') },
  { id: 'arco-iris', nome: 'Arco-íris', svg: svg('<path fill="none" stroke="#f87171" stroke-width="16" d="M20 160 A80 80 0 0 1 180 160"/><path fill="none" stroke="#fbbf24" stroke-width="16" d="M38 160 A62 62 0 0 1 162 160"/><path fill="none" stroke="#34d399" stroke-width="16" d="M56 160 A44 44 0 0 1 144 160"/><path fill="none" stroke="#60a5fa" stroke-width="16" d="M74 160 A26 26 0 0 1 126 160"/>') },
  { id: 'selo', nome: 'Selo', svg: svg(`<polygon fill="#f97316" points="${Array.from({ length: 32 }, (_, i) => { const r = i % 2 ? 80 : 95, a = (i * Math.PI) / 16; return `${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}` }).join(' ')}"/><circle cx="100" cy="100" r="66" fill="none" stroke="#ffffff" stroke-width="4" stroke-dasharray="6 6"/>`) },
  { id: 'etiqueta', nome: 'Etiqueta (tag)', svg: svg('<path fill="#fde68a" stroke="#b45309" stroke-width="4" d="M60 30 H180 V170 H60 L15 100Z"/><circle cx="48" cy="100" r="10" fill="#ffffff" stroke="#b45309" stroke-width="4"/>') },
  { id: 'faixa', nome: 'Faixa', svg: svg('<path fill="#be185d" d="M5 80 L35 80 L35 130 L5 130 L20 105Z"/><path fill="#be185d" d="M195 80 L165 80 L165 130 L195 130 L180 105Z"/><rect x="25" y="65" width="150" height="55" fill="#ec4899"/>') },
  { id: 'folha', nome: 'Folhinha', svg: svg('<path fill="#86efac" d="M30 170 C30 80 90 30 175 25 C170 110 120 170 30 170Z"/><path fill="none" stroke="#16a34a" stroke-width="4" d="M30 170 C80 120 120 80 165 35"/>') },
  { id: 'confete', nome: 'Confete', svg: svg('<rect x="30" y="30" width="16" height="30" rx="4" fill="#f97316" transform="rotate(25 38 45)"/><circle cx="120" cy="40" r="9" fill="#60a5fa"/><rect x="150" y="90" width="14" height="28" rx="4" fill="#ec4899" transform="rotate(-30 157 104)"/><circle cx="60" cy="130" r="8" fill="#fbbf24"/><rect x="95" y="140" width="14" height="28" rx="4" fill="#34d399" transform="rotate(60 102 154)"/><circle cx="170" cy="170" r="7" fill="#a78bfa"/>') },
  { id: 'coracoes', nome: 'Corações', svg: svg('<path fill="#f472b6" d="M70 150 C20 110 20 60 55 55 C70 53 70 65 70 70 C70 65 70 53 85 55 C120 60 120 110 70 150Z"/><path fill="#fb7185" d="M145 110 C115 85 115 55 137 52 C145 51 145 58 145 62 C145 58 145 51 153 52 C175 55 175 85 145 110Z"/>') },
  { id: 'estrelinhas', nome: 'Estrelinhas', svg: svg(`<polygon fill="#fbbf24" points="${pontosEstrela(90, 90).map(p => `${(p.x + 60).toFixed(1)},${(p.y + 70).toFixed(1)}`).join(' ')}"/><polygon fill="#f97316" points="${pontosEstrela(50, 50).map(p => `${(p.x + 150).toFixed(1)},${(p.y + 140).toFixed(1)}`).join(' ')}"/>`) },
]

/** Elemento vira um grupo editável (cor ajustável no painel). */
export async function criarElemento(e: Elemento, lado: number): Promise<FabricObject> {
  const { objects, options } = await loadSVGFromString(e.svg)
  const objs = objects.filter(Boolean) as FabricObject[]
  const g = util.groupSVGElements(objs, options) as FabricObject
  const k = lado / Math.max(g.width || 200, g.height || 200)
  g.set({ scaleX: k, scaleY: k })
  return marcar(g, e.nome, g instanceof Group ? 'grupo' : 'forma')
}

// ── MOLDURAS (frames) e GRADES DE FOTOS ───────────────────────────────────────
export type FormaMoldura = 'retangulo' | 'arredondado' | 'circulo' | 'arco' | 'coracao' | 'estrela' | 'hexagono'
export const MOLDURAS: { id: FormaMoldura; nome: string }[] = [
  { id: 'arredondado', nome: 'Arredondada' }, { id: 'circulo', nome: 'Círculo' }, { id: 'arco', nome: 'Arco' },
  { id: 'coracao', nome: 'Coração' }, { id: 'estrela', nome: 'Estrela' }, { id: 'hexagono', nome: 'Hexágono' }, { id: 'retangulo', nome: 'Retângulo' },
]
const estiloMoldura = { fill: 'rgba(148,163,184,0.18)', stroke: '#94a3b8', strokeWidth: 2, strokeDashArray: [8, 6], strokeUniform: true }

/** Moldura: área com forma onde a foto entra RECORTADA (não sai na exportação quando vazia). */
export function criarMoldura(forma: FormaMoldura, w: number, h: number): FabricObject {
  let o: FabricObject
  const b = { ...estiloMoldura }
  if (forma === 'circulo') o = new Ellipse({ ...b, rx: w / 2, ry: h / 2 })
  else if (forma === 'coracao') o = new Polygon(pontosCoracao(w, h), b)
  else if (forma === 'estrela') o = new Polygon(pontosEstrela(w, h), b)
  else if (forma === 'hexagono') o = new Polygon(pontosPoligono(6, w, h), b)
  else if (forma === 'arco') o = new Path(`M 0 ${h} L 0 ${w / 2} A ${w / 2} ${w / 2} 0 0 1 ${w} ${w / 2} L ${w} ${h} Z`, b)
  else o = new Rect({ ...b, width: w, height: h, ...(forma === 'arredondado' ? { rx: Math.min(w, h) * 0.08, ry: Math.min(w, h) * 0.08 } : {}) })
  return marcar(o, `Moldura (${MOLDURAS.find(m => m.id === forma)?.nome || forma})`, 'forma', { soaArea: true, soaMoldura: true })
}

export interface Grade { id: string; nome: string; celulas: { x: number; y: number; w: number; h: number }[] }
export const GRADES: Grade[] = [
  { id: '2h', nome: '2 lado a lado', celulas: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
  { id: '2v', nome: '2 empilhadas', celulas: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }] },
  { id: '3c', nome: '3 colunas', celulas: [0, 1, 2].map(i => ({ x: i / 3, y: 0, w: 1 / 3, h: 1 })) },
  { id: '4', nome: '2 × 2', celulas: [0, 1, 2, 3].map(i => ({ x: (i % 2) / 2, y: Math.floor(i / 2) / 2, w: 0.5, h: 0.5 })) },
  { id: '1+2', nome: '1 grande + 2', celulas: [{ x: 0, y: 0, w: 0.62, h: 1 }, { x: 0.62, y: 0, w: 0.38, h: 0.5 }, { x: 0.62, y: 0.5, w: 0.38, h: 0.5 }] },
  { id: '9', nome: '3 × 3', celulas: Array.from({ length: 9 }, (_, i) => ({ x: (i % 3) / 3, y: Math.floor(i / 3) / 3, w: 1 / 3, h: 1 / 3 })) },
]
/** Grade de fotos: uma moldura por célula, com espaçamento (gap em % do lado menor). */
export function criarGrade(g: Grade, area: { x: number; y: number; w: number; h: number }, gap: number): FabricObject[] {
  return g.celulas.map((c, i) => {
    const x = area.x + c.x * area.w + gap / 2, y = area.y + c.y * area.h + gap / 2
    const w = c.w * area.w - gap, h = c.h * area.h - gap
    const m = criarMoldura('arredondado', w, h)
    m.set({ left: x, top: y, originX: 'left', originY: 'top' }); m.setCoords()
    soa(m).soaNome = `Foto ${i + 1}`
    return m
  })
}

// ── TEMPLATES (autorais, do nicho) ─────────────────────────────────────────────
export interface Modelo { id: string; nome: string; categoria: string; largura: number; altura: number; fundo: string; montar: () => Promise<FabricObject[]> }

const texto = (t: string, o: { x: number; y: number; w: number; tam: number; cor: string; fonte: string; negrito?: boolean; nome?: string; alinhar?: string }) => {
  const tb = new Textbox(t, { left: o.x, top: o.y, width: o.w, fontSize: o.tam, fill: o.cor, fontFamily: fonte(o.fonte), fontWeight: o.negrito ? 'bold' : 'normal', textAlign: (o.alinhar || 'center') as 'center', originX: 'center', originY: 'center' })
  return marcar(tb, o.nome || t.slice(0, 20), 'texto', { soaFonte: o.fonte })
}
const elem = async (id: string, lado: number, x: number, y: number, ang = 0) => {
  const e = await criarElemento(ELEMENTOS.find(z => z.id === id)!, lado)
  e.set({ left: x, top: y, originX: 'center', originY: 'center', angle: ang }); e.setCoords()
  return e
}
const grad = (w: number, h: number, c1: string, c2: string) => new Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: 0, y2: h }, colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }] })

export const MODELOS: Modelo[] = [
  {
    id: 'tag-lembrancinha', nome: 'Tag de lembrancinha', categoria: 'Festa', largura: 600, altura: 900, fundo: '#fff7ed',
    montar: async () => {
      const cartao = marcar(new Rect({ left: 300, top: 470, width: 520, height: 780, rx: 40, ry: 40, fill: '#ffffff', stroke: '#fdba74', strokeWidth: 6, originX: 'center', originY: 'center' }), 'Cartão', 'forma')
      const furo = marcar(new Circle({ left: 300, top: 140, radius: 22, fill: '#fff7ed', stroke: '#fdba74', strokeWidth: 5, originX: 'center', originY: 'center' }), 'Furo', 'forma')
      const foto = criarMoldura('circulo', 300, 300); foto.set({ left: 300, top: 400, originX: 'center', originY: 'center' })
      return [cartao, furo, foto,
        await elem('brilhos', 120, 470, 250, 10), await elem('laco', 150, 300, 230),
        texto('Maria Eduarda', { x: 300, y: 640, w: 480, tam: 64, cor: '#9a3412', fonte: 'pacifico', nome: 'Nome' }),
        texto('5 aninhos', { x: 300, y: 720, w: 400, tam: 40, cor: '#ea580c', fonte: 'fredoka', negrito: true, nome: 'Idade' }),
        texto('Obrigada por vir!', { x: 300, y: 790, w: 440, tam: 30, cor: '#78716c', fonte: 'poppins', nome: 'Mensagem' })]
    },
  },
  {
    id: 'convite-aniversario', nome: 'Convite de aniversário', categoria: 'Festa', largura: 1080, altura: 1350, fundo: '#fdf2f8',
    montar: async () => {
      const fundo = marcar(new Rect({ left: 0, top: 0, width: 1080, height: 1350, fill: grad(1080, 1350, '#fdf2f8', '#fce7f3') }), 'Fundo', 'forma')
      return [fundo,
        await elem('balao-festa', 260, 170, 250, -12), await elem('balao-festa', 220, 910, 230, 14), await elem('confete', 300, 540, 170),
        texto('Venha comemorar', { x: 540, y: 470, w: 900, tam: 64, cor: '#be185d', fonte: 'dancing', nome: 'Chamada' }),
        texto('SOFIA', { x: 540, y: 620, w: 900, tam: 180, cor: '#db2777', fonte: 'fredoka', negrito: true, nome: 'Nome' }),
        texto('faz 7 anos', { x: 540, y: 770, w: 800, tam: 60, cor: '#9d174d', fonte: 'baloo', nome: 'Idade' }),
        marcar(new Rect({ left: 540, top: 1030, width: 820, height: 260, rx: 36, ry: 36, fill: '#ffffff', opacity: 0.85, originX: 'center', originY: 'center' }), 'Caixa', 'forma'),
        texto('Sábado, 12 de outubro · 15h', { x: 540, y: 990, w: 760, tam: 42, cor: '#831843', fonte: 'poppins', negrito: true, nome: 'Data' }),
        texto('Rua das Flores, 123 — Salão Alegria', { x: 540, y: 1070, w: 760, tam: 34, cor: '#9d174d', fonte: 'poppins', nome: 'Local' })]
    },
  },
  {
    id: 'etiqueta-redonda', nome: 'Etiqueta redonda', categoria: 'Papelaria', largura: 800, altura: 800, fundo: '',
    montar: async () => {
      const disco = marcar(new Circle({ left: 400, top: 400, radius: 380, fill: '#ecfccb', stroke: '#65a30d', strokeWidth: 10, originX: 'center', originY: 'center' }), 'Disco', 'forma')
      const anel = marcar(new Circle({ left: 400, top: 400, radius: 330, fill: 'transparent', stroke: '#65a30d', strokeWidth: 4, strokeDashArray: [14, 10], originX: 'center', originY: 'center' }), 'Pontilhado', 'forma')
      return [disco, anel, await elem('folha', 140, 400, 210),
        texto('Feito com amor', { x: 400, y: 380, w: 560, tam: 70, cor: '#3f6212', fonte: 'greatvibes', nome: 'Frase' }),
        texto('ATELIÊ DA ANA', { x: 400, y: 500, w: 560, tam: 48, cor: '#4d7c0f', fonte: 'poppins', negrito: true, nome: 'Marca' })]
    },
  },
  {
    id: 'post-promocao', nome: 'Post de promoção', categoria: 'Loja', largura: 1080, altura: 1080, fundo: '#111827',
    montar: async () => {
      const selo = await elem('selo', 380, 800, 290, 12)
      return [selo,
        texto('-20%', { x: 800, y: 290, w: 300, tam: 96, cor: '#ffffff', fonte: 'fredoka', negrito: true, nome: 'Desconto' }),
        texto('PROMOÇÃO', { x: 430, y: 560, w: 800, tam: 140, cor: '#f97316', fonte: 'fredoka', negrito: true, nome: 'Título' }),
        texto('em toda a papelaria personalizada', { x: 540, y: 690, w: 900, tam: 46, cor: '#f3f4f6', fonte: 'poppins', nome: 'Subtítulo' }),
        marcar(new Rect({ left: 540, top: 880, width: 560, height: 110, rx: 55, ry: 55, fill: '#f97316', originX: 'center', originY: 'center' }), 'Botão', 'forma'),
        texto('Peça pelo direct', { x: 540, y: 880, w: 520, tam: 44, cor: '#ffffff', fonte: 'poppins', negrito: true, nome: 'Chamada' })]
    },
  },
  {
    id: 'cartao-agradecimento', nome: 'Cartão de agradecimento', categoria: 'Loja', largura: 1200, altura: 800, fundo: '#fffbeb',
    montar: async () => [
      marcar(new Rect({ left: 600, top: 400, width: 1120, height: 720, rx: 28, ry: 28, fill: 'transparent', stroke: '#f59e0b', strokeWidth: 6, originX: 'center', originY: 'center' }), 'Borda', 'forma'),
      await elem('coracoes', 170, 1030, 150, 10),
      texto('Obrigada pela compra!', { x: 600, y: 330, w: 1000, tam: 96, cor: '#b45309', fonte: 'dancing', negrito: true, nome: 'Título' }),
      texto('Cada peça foi feita à mão, com carinho, pensando em você.', { x: 600, y: 470, w: 860, tam: 38, cor: '#78350f', fonte: 'poppins', nome: 'Mensagem' }),
      texto('— Ana', { x: 600, y: 600, w: 400, tam: 54, cor: '#92400e', fonte: 'greatvibes', nome: 'Assinatura' })],
  },
  {
    id: 'story-lancamento', nome: 'Story de lançamento', categoria: 'Loja', largura: 1080, altura: 1920, fundo: '#fff7ed',
    montar: async () => {
      const foto = criarMoldura('arco', 820, 1000); foto.set({ left: 540, top: 820, originX: 'center', originY: 'center' })
      return [foto, await elem('brilho', 160, 900, 330, 0),
        texto('NOVIDADE', { x: 540, y: 200, w: 900, tam: 110, cor: '#ea580c', fonte: 'fredoka', negrito: true, nome: 'Título' }),
        texto('Coleção Primavera', { x: 540, y: 1450, w: 900, tam: 80, cor: '#9a3412', fonte: 'dancing', nome: 'Coleção' }),
        texto('Arraste para cima e confira', { x: 540, y: 1700, w: 900, tam: 44, cor: '#78716c', fonte: 'poppins', nome: 'Chamada' })]
    },
  },
  {
    id: 'colagem-4', nome: 'Colagem 4 fotos', categoria: 'Fotos', largura: 1080, altura: 1080, fundo: '#ffffff',
    montar: async () => criarGrade(GRADES.find(g => g.id === '4')!, { x: 30, y: 30, w: 1020, h: 1020 }, 24),
  },
]

// ── montar designs a partir de templates ─────────────────────────────────────────
/** Monta o template numa prancheta e devolve o JSON do design (para criar um design novo). */
export async function jsonDoModelo(m: Modelo): Promise<{ json: DesignJson; assetIds: string[] }> {
  const tmp = new StaticCanvas(document.createElement('canvas'), { width: m.largura, height: m.altura, enableRetinaScaling: false })
  tmp.backgroundColor = m.fundo
  for (const o of await m.montar()) tmp.add(o)
  const r = serializar(tmp, [])
  void tmp.dispose()
  return r
}

/** Miniatura (data URL) do template — renderizada no navegador, nada guardado. */
export async function miniaturaModelo(m: Modelo, lado = 220): Promise<string> {
  const k = lado / Math.max(m.largura, m.altura)
  const tmp = new StaticCanvas(document.createElement('canvas'), { width: m.largura, height: m.altura, enableRetinaScaling: false })
  tmp.backgroundColor = m.fundo || '#ffffff'
  for (const o of await m.montar()) tmp.add(o)
  const url = tmp.toDataURL({ format: 'jpeg', quality: 0.8, multiplier: k })
  void tmp.dispose()
  return url
}

/**
 * Template da EDIÇÃO EM MASSA → design de camadas: o molde vira objeto inteligente (fundo) e cada
 * caixa de campo vira um texto no mesmo lugar, com as {variáveis}.
 */
export async function jsonDeTemplateMassa(templateId: string): Promise<{ nome: string; largura: number; altura: number; json: DesignJson; assetIds: string[] }> {
  const d = await fetch(`/api/estudio/templates/${templateId}`).then(r => r.json())
  const t = d.template
  if (!t?.moldeUrl) throw new Error('Este template está sem molde.')
  const cfg = t.config as { largura: number; altura: number; caixas: { tipo: string; texto: string; x: number; y: number; w: number; h: number; fonte: string; tamanho: number; cor: string; alinhamento: string; negrito: boolean; italico: boolean }[]; fontesUsuario?: { id: string; familia: string; url: string }[] }
  const W = cfg.largura, H = cfg.altura
  const k = Math.min(1, 4000 / Math.max(W, H))
  const L = Math.round(W * k), A = Math.round(H * k)
  const tmp = new StaticCanvas(document.createElement('canvas'), { width: L, height: A, enableRetinaScaling: false })
  const molde = await criarCamadaImagem(t.moldeUrl, t.moldeAssetId || null, 'Molde', { largura: L, altura: A })
  molde.set({ scaleX: L / molde.width, scaleY: A / molde.height }); molde.setPositionByOrigin(new Point(L / 2, A / 2), 'center', 'center')
  tmp.add(molde)
  for (const cx of cfg.caixas || []) {
    if (cx.tipo !== 'texto') continue
    const u = cx.fonte.startsWith('u:') ? cfg.fontesUsuario?.find(f => `u:${f.id}` === cx.fonte) : null
    const tb = new Textbox(cx.texto, {
      left: cx.x * k, top: cx.y * k, width: cx.w * k, fontSize: cx.tamanho * k, fill: cx.cor,
      fontFamily: u ? u.familia : fonte(cx.fonte), fontWeight: cx.negrito ? 'bold' : 'normal', fontStyle: cx.italico ? 'italic' : 'normal', textAlign: (cx.alinhamento || 'center') as 'center',
    })
    tmp.add(marcar(tb, cx.texto.slice(0, 24) || 'Texto', 'texto', { soaFonte: u ? `u:${u.id}` : cx.fonte }))
  }
  const r = serializar(tmp, (cfg.fontesUsuario || []).filter(f => f.url))
  void tmp.dispose()
  return { nome: t.nome, largura: L, altura: A, ...r }
}
