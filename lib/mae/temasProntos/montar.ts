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
import { caixaPadrao } from '../editor/textosReplicar'
import { nomeDeCaixa } from '../exportar/planejar'

export interface PaginaPronta {
  /** Nome da caixa/página (vira o nome da prancheta, do molde e da parte): "CAIXA MILK", "TOPO"… */
  nome: string
  wMm: number
  hMm: number
  /** A imagem da página na Biblioteca (o papel do tema). */
  imagem: ArquivoImagem
  /** Lote 23 (item 267): o arquivo DESTA página (vários PNG, um por página) — sem isto, o arquivo do tema. */
  fonte?: ArquivoPronto
  /** Página do PDF de `fonte` (1 = a primeira). */
  paginaPdf?: number
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

export function montarTemaPronto(o: { nome: string; produto?: string; arquivo: ArquivoPronto; paginas: PaginaPronta[] }): { base: DocTrabalho; tema: DocTema } {
  if (!o.paginas.length) throw new Error('O arquivo não tem páginas.')
  const nome = o.nome.trim().slice(0, 120) || nomeDoArquivo(o.arquivo.path)
  const produto = (o.produto ?? '').trim().slice(0, 80)
  const base: DocTrabalho = {
    schemaVersion: SCHEMA_VERSION, type: 'base', id: gid('base'), version: 1, name: produto ? `${produto} · ${nome}`.slice(0, 120) : nome, units: 'mm',
    smartArt: { overflowMm: 10 }, artboards: [], molds: [], parts: [], textSlots: [],
    pronto: { path: o.arquivo.path, sha256: o.arquivo.sha256 },
  }
  const partes = o.paginas.map((p, i) => criarPagina(base, p, i, o.arquivo))
  organizarPranchetas(base, 'grade')
  const face1 = base.molds[0].faces[0].id
  for (const t of TEXTOS_PADRAO) {
    // Lote 13 (item 185): a área nasce do tamanho de um nome (mm), não de 80% da página
    base.textSlots.push({ id: gid(`ts_${t.variable.toLowerCase()}`), variable: t.variable, faceId: face1, box: caixaPadrao(t.variable, t.box, o.paginas[0].wMm, o.paginas[0].hMm),
      single: { lines: 1, sizePt: t.sizePt }, compound: { lines: 2, sizePt: Math.round(t.sizePt * 0.8), lineHeight: 0.9 }, autoFit: { minScale: 0.6 } })
  }
  const tema = novoTema({ nome, baseId: base.id, baseVersion: base.version })
  if (produto) tema.produto = produto
  o.paginas.forEach((p, i) => { colocarPapel(tema, partes[i], p.imagem) })
  return { base, tema }
}

export { chaveTema }

/** Uma página do tema pronto na base: prancheta do tamanho dela + "molde" retangular + parte com o nome. Devolve a parte. */
function criarPagina(base: DocTrabalho, p: PaginaPronta, i: number, arquivo: ArquivoPronto): string {
  const abId = gid('ab'), mId = gid('m')
  const nomePg = p.nome.trim().slice(0, 60) || `PÁGINA ${i + 1}`
  const f = p.fonte ?? arquivo
  base.artboards.push({ id: abId, widthMm: p.wMm, heightMm: p.hMm, name: nomePg.slice(0, 80) })
  base.molds.push({
    id: mId, name: nomePg, artboardId: abId,
    source: { path: f.path, sha256: f.sha256, widthMm: p.wMm, heightMm: p.hMm, kind: f.kind, ...(f.kind === 'pdf' ? { page: p.paginaPdf ?? (p.fonte ? 1 : i + 1) } : {}) },
    transform: { xMm: 0, yMm: 0, rotationDeg: 0 },
    faces: facesParaReceita(mId, [{ poligono: ret(p.wMm, p.hMm), tipos: ['cut', 'cut', 'cut', 'cut'], furo: false }]) as DocTrabalho['molds'][number]['faces'],
  })
  const partId = novaParte(base, nomePg)
  atribuirFace(base, partId, base.molds[base.molds.length - 1].faces[0].id)
  return partId
}

/**
 * Lote 23 (item 267): "+ Adicionar página" num tema pronto que já existe — as páginas novas viram pranchetas NA MESMA
 * base (nunca base nova). Devolve as partes novas, na ordem, para o tema receber o papel de cada uma.
 */
export function adicionarPaginasNaBase(base: DocTrabalho, paginas: PaginaPronta[]): string[] {
  if (!paginas.length) return []
  const arq = base.pronto ? { path: base.pronto.path, sha256: base.pronto.sha256, kind: 'png' as const } : paginas[0].fonte!
  const n0 = base.artboards.length
  const partes = paginas.map((p, k) => criarPagina(base, { ...p, nome: p.nome.trim() || `PÁGINA ${n0 + k + 1}` }, n0 + k, p.fonte ?? arq))
  organizarPranchetas(base, 'grade')
  return partes
}
/** O papel das páginas novas no tema (mesma ordem de `adicionarPaginasNaBase`). */
export function papelDasPaginasNovas(tema: DocTema, partes: string[], paginas: PaginaPronta[]): void {
  partes.forEach((id, k) => { if (paginas[k]) colocarPapel(tema, id, paginas[k].imagem) })
}

/** Lote 23 (item 267): "Trocar o arquivo" de uma página — o molde aponta para o arquivo novo. Devolve a parte (o tema troca o papel). */
export function trocarArquivoNaBase(base: DocTrabalho, artboardId: string, p: Pick<PaginaPronta, 'fonte' | 'paginaPdf'>): string | null {
  const m = base.molds.find(x => x.artboardId === artboardId)
  if (!m || !p.fonte) return null
  m.source = { ...m.source, path: p.fonte.path, sha256: p.fonte.sha256, kind: p.fonte.kind, ...(p.fonte.kind === 'pdf' ? { page: p.paginaPdf ?? 1 } : {}) }
  if (p.fonte.kind !== 'pdf') delete (m.source as { page?: number }).page
  const face = m.faces[0]?.id
  return base.parts.find(pt => pt.instances.some(i => i.faceId === face))?.id ?? null
}

/** Ordem "humana" dos arquivos (pagina-2 antes de pagina-10). Puro. */
export const ordemDosArquivos = (paths: string[]) => [...paths].sort((a, b) => (a.split('/').pop() ?? a).localeCompare(b.split('/').pop() ?? b, 'pt-BR', { numeric: true, sensitivity: 'base' }))

/**
 * O PNG entra no tamanho REAL (pelos dpi do arquivo). Se ele ficar perto de uma folha padrão sem bater com ela (ex.: A4
 * salvo a 72 dpi vira 793 mm; ou 209 × 296 mm), sugere ajustar à folha. Puro.
 */
export function folhaParecida(wMm: number, hMm: number): { nome: string; wMm: number; hMm: number } | null {
  const FOLHAS: [string, number, number][] = [['A3', 297, 420], ['A4', 210, 297], ['A5', 148, 210], ['A6', 105, 148]]
  let melhor: { nome: string; wMm: number; hMm: number; dif: number } | null = null
  for (const [nome, a, b] of FOLHAS) for (const [w, h] of wMm >= hMm ? [[b, a]] : [[a, b]]) {
    const dif = Math.max(Math.abs(wMm - w) / w, Math.abs(hMm - h) / h)
    if (!melhor || dif < melhor.dif) melhor = { nome: `${nome} ${w > h ? 'paisagem' : 'retrato'}`, wMm: w, hMm: h, dif }
  }
  if (!melhor) return null
  const proporcao = Math.abs(wMm / hMm - melhor.wMm / melhor.hMm) / (melhor.wMm / melhor.hMm)
  const exato = Math.abs(wMm - melhor.wMm) <= 1.5 && Math.abs(hMm - melhor.hMm) <= 1.5
  // mesma proporção da folha (só a escala/dpi errou) ou até 10% de diferença → sugere; já bate → nada
  return !exato && (melhor.dif <= 0.1 || proporcao <= 0.02) ? { nome: melhor.nome, wMm: melhor.wMm, hMm: melhor.hMm } : null
}

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

/** Lote 4 (item 44): produto sugerido pelo caminho — `Temas/Sacola P/Ursinha.pdf` → "Sacola P". */
export const produtoDoCaminho = (path: string) => { const p = path.split('/'); return p.length >= 3 && p[0] === 'Temas' && p[1] !== 'paginas' ? p[1] : '' }

// ── Lote 14 (item 194): TEMA PRONTO NUMA BASE QUE JÁ EXISTE ─────────────────────────────────────────────────────────

/** O nome que a prancheta mostra (o dela, ou os moldes nela) — para casar com o nome da página. */
export const nomeDaPrancheta = (d: Pick<DocTrabalho, 'molds'>, ab: { id: string; name?: string }) => ab.name || d.molds.filter(m => m.artboardId === ab.id).map(m => m.name).join(' + ')

/**
 * Cada PÁGINA vai para a prancheta de MESMO NOME (comparado sem acento, maiúsculas, "_molde", "_MR"…: PIRAMIDE = PIRÂMIDE;
 * "Mesma caixa que…" também vale). Nunca encaixa errado: página sem prancheta, prancheta sem página e tamanho
 * diferente (mais de 1,5 mm) viram aviso.
 */
export function casarPaginas(paginas: { nome: string; wMm: number; hMm: number }[], base: Pick<DocTrabalho, 'artboards' | 'molds'>, escolhas: Record<number, string | null> = {}): {
  pares: { pagina: number; artboardId: string; nome: string }[]; semPrancheta: number[]; semPagina: string[]; tamanhoDiferente: { pagina: number; nome: string; pagMm: string; abMm: string }[]
  /** Lote 19 (item 240): as caixas da base (para o seletor "Esta página é a caixa:") e a de cada página. */
  caixas: { artboardId: string; nome: string; wMm: number; hMm: number }[]; daPagina: Record<number, string | null>
} {
  const chave = (s: string) => nomeDeCaixa(s)
  const comMolde = base.artboards.filter(a => base.molds.some(m => m.artboardId === a.id))
  const livres = comMolde.map(a => ({ a, chaves: [nomeDaPrancheta(base, a), (a as { mesmaCaixa?: string }).mesmaCaixa ?? ''].filter(Boolean).map(chave) }))
  const pares: { pagina: number; artboardId: string; nome: string }[] = [], semPrancheta: number[] = [], tamanhoDiferente: { pagina: number; nome: string; pagMm: string; abMm: string }[] = []
  const usados = new Set<string>()
  const perto = (p: { wMm: number; hMm: number }, a: { widthMm: number; heightMm: number }, tol: number) =>
    (Math.abs(p.wMm - a.widthMm) <= tol && Math.abs(p.hMm - a.heightMm) <= tol) || (Math.abs(p.wMm - a.heightMm) <= tol && Math.abs(p.hMm - a.widthMm) <= tol)
  // 1º a escolha da usuária; 2º o nome; 3º base de UMA caixa só (liga sozinha); 4º o tamanho (uma caixa livre só, ±5 mm)
  const decidido = new Map<number, string | null>()
  paginas.forEach((_, i) => { if (i in escolhas) { decidido.set(i, escolhas[i]); if (escolhas[i]) usados.add(escolhas[i]!) } })
  paginas.forEach((p, i) => {
    if (decidido.has(i)) return
    const k = chave(p.nome)
    const ach = livres.find(l => !usados.has(l.a.id) && k && l.chaves.includes(k))
    if (ach) { decidido.set(i, ach.a.id); usados.add(ach.a.id) }
  })
  if (comMolde.length === 1 && paginas.length >= 1 && ![...decidido.values()].some(Boolean) && !(0 in escolhas)) { decidido.set(0, comMolde[0].id); usados.add(comMolde[0].id) }
  paginas.forEach((p, i) => {
    if (decidido.has(i)) return
    const c = livres.filter(l => !usados.has(l.a.id) && perto(p, l.a, 5))
    if (c.length === 1) { decidido.set(i, c[0].a.id); usados.add(c[0].a.id) }
  })
  paginas.forEach((p, i) => {
    const id = decidido.get(i) ?? null
    const ach = id ? livres.find(l => l.a.id === id) : undefined
    if (!ach) { semPrancheta.push(i); return }
    usados.add(ach.a.id)
    const nome = nomeDaPrancheta(base, ach.a)
    pares.push({ pagina: i, artboardId: ach.a.id, nome })
    const igual = (x: number, y: number) => Math.abs(x - y) <= 1.5
    if (!(igual(p.wMm, ach.a.widthMm) && igual(p.hMm, ach.a.heightMm)) && !(igual(p.wMm, ach.a.heightMm) && igual(p.hMm, ach.a.widthMm)))
      tamanhoDiferente.push({ pagina: i, nome, pagMm: `${Math.round(p.wMm)} × ${Math.round(p.hMm)}`, abMm: `${Math.round(ach.a.widthMm)} × ${Math.round(ach.a.heightMm)}` })
  })
  const semPagina = comMolde.filter(a => !usados.has(a.id)).map(a => nomeDaPrancheta(base, a))
  const caixas = comMolde.map(a => ({ artboardId: a.id, nome: nomeDaPrancheta(base, a), wMm: a.widthMm, hMm: a.heightMm }))
  return { pares, semPrancheta, semPagina, tamanhoDiferente, caixas, daPagina: Object.fromEntries(paginas.map((_, i) => [i, decidido.get(i) ?? null])) }
}

/** O tema pronto na base que já existe: a página de cada prancheta casada; herda da base os produtos e as quantidades. */
export function temaProntoNaBase(o: { nome: string; produto?: string; base: Pick<DocTrabalho, 'id' | 'version'>; paginas: { artboardId: string; imagem: ArquivoImagem; ajuste?: 'esticar' | 'preencher' | 'caber' }[]; semMarca?: boolean }): DocTema {
  const tema = novoTema({ nome: o.nome.trim().slice(0, 120) || 'Tema pronto', baseId: o.base.id, baseVersion: o.base.version })
  if (o.produto?.trim()) tema.produto = o.produto.trim().slice(0, 80)
  ;(tema as DocTema & { paginasProntas?: Record<string, unknown> }).paginasProntas = Object.fromEntries(o.paginas.map(p => [p.artboardId, { path: p.imagem.path, sha256: p.imagem.sha256, ...(p.imagem.aspect ? { aspect: p.imagem.aspect } : {}), ...(p.ajuste && p.ajuste !== 'esticar' ? { ajuste: p.ajuste } : {}) }]))
  if (o.semMarca) (tema as DocTema & { semMarca?: boolean }).semMarca = true
  return tema
}

/**
 * Migração: um tema pronto ANTIGO (base própria, uma prancheta por página) → a página de cada prancheta da base antiga
 * (o papel da parte dela no tema). Devolve as páginas com o nome e o tamanho, prontas para casar com a base nova.
 */
export function paginasDoTemaAntigo(baseAntiga: DocTrabalho, temaAntigo: DocTema): { nome: string; wMm: number; hMm: number; imagem: ArquivoImagem }[] {
  const out: { nome: string; wMm: number; hMm: number; imagem: ArquivoImagem }[] = []
  for (const ab of baseAntiga.artboards) {
    const m = baseAntiga.molds.find(x => x.artboardId === ab.id); if (!m) continue
    const face = m.faces.find(f => !f.hole); if (!face) continue
    const parte = baseAntiga.parts.find(p => p.instances.some(i => i.faceId === face.id)); if (!parte) continue
    const papel = (temaAntigo.partContent[parte.id] ?? []).find(c => (c as { type?: string }).type === 'image' && (c as { path?: string }).path) as { path: string; sha256?: string; aspect?: number } | undefined
    if (!papel?.sha256) continue
    out.push({ nome: nomeDaPrancheta(baseAntiga, ab), wMm: ab.widthMm, hMm: ab.heightMm, imagem: { path: papel.path, sha256: papel.sha256, aspect: papel.aspect ?? ab.widthMm / ab.heightMm, nome: nomeDaPrancheta(baseAntiga, ab) } })
  }
  return out
}

// ── Lote 16 (item 205): TEMA PRONTO NUMA BASE DE PEÇAS SOB MEDIDA — uma arte por peça ───────────────────────────────

type MoldeB = DocTrabalho['molds'][number]
const medidaDoMolde = (m: MoldeB) => (m as MoldeB & { medida?: { larguraMm: number; alturaMm: number } }).medida ?? null
/** As peças sob medida da base (as que recebem uma arte cada). */
export const pecasDaBase = (b: Pick<DocTrabalho, 'molds'>) => b.molds.filter(m => m.source.kind === 'medida' && medidaDoMolde(m))
/** "200 × 35 mm" ou, redonda, "Ø 57 mm". */
export function rotuloDaMedida(m: MoldeB): string {
  const md = medidaDoMolde(m) as { larguraMm: number; alturaMm: number; forma?: string } | null
  if (!md) return ''
  const f = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',')
  return md.forma === 'circulo' && Math.abs(md.larguraMm - md.alturaMm) < 0.05 ? `Ø ${f(md.larguraMm)} mm` : `${f(md.larguraMm)} × ${f(md.alturaMm)} mm`
}
/** Proporção (largura ÷ altura) da peça e se a arte tem outra (mais de 3%: aviso + preencher / caber). */
export function proporcaoDiferente(m: MoldeB, aspect: number): boolean {
  const md = medidaDoMolde(m)
  if (!md || !(aspect > 0)) return false
  const a = md.larguraMm / md.alturaMm
  return Math.abs(a - aspect) / a > 0.03 && Math.abs(a - 1 / aspect) / a > 0.03
}
/**
 * "Nunca criar base nova quando já existe": a 1ª base de peças com uma peça da medida da arte (±1,5 mm, em pé ou
 * deitada) → { base, peça } para perguntar.
 */
export function pecaComAMedida(bases: Pick<DocTrabalho, 'id' | 'name' | 'molds' | 'tipo'>[], wMm: number, hMm: number): { baseId: string; baseNome: string; pecaId: string; pecaNome: string } | null {
  const igual = (x: number, y: number) => Math.abs(x - y) <= 1.5
  for (const b of bases) {
    if (b.tipo !== 'medida') continue
    for (const m of pecasDaBase(b)) {
      const md = medidaDoMolde(m)!
      if ((igual(md.larguraMm, wMm) && igual(md.alturaMm, hMm)) || (igual(md.larguraMm, hMm) && igual(md.alturaMm, wMm)))
        return { baseId: b.id, baseNome: b.name, pecaId: m.id, pecaNome: m.name }
    }
  }
  return null
}
/**
 * O tema pronto na base de peças: a arte de cada peça (em todas as cópias dela nas folhas), preencher ou caber.
 * As peças sem arte ficam como estão (fundo da base). Herda da base os produtos e as quantidades.
 */
export function temaProntoNasPecas(o: { nome: string; produto?: string; base: Pick<DocTrabalho, 'id' | 'version'>; pecas: { moldeId: string; imagem: ArquivoImagem; ajuste?: 'preencher' | 'caber' }[]; semMarca?: boolean }): DocTema {
  if (!o.pecas.length) throw new Error('Escolha a arte de pelo menos uma peça.')
  const tema = novoTema({ nome: o.nome.trim().slice(0, 120) || 'Tema pronto', baseId: o.base.id, baseVersion: o.base.version })
  if (o.produto?.trim()) tema.produto = o.produto.trim().slice(0, 80)
  ;(tema as DocTema & { pecasProntas?: Record<string, unknown> }).pecasProntas = Object.fromEntries(o.pecas.map(p => [p.moldeId,
    { path: p.imagem.path, sha256: p.imagem.sha256, aspect: p.imagem.aspect && p.imagem.aspect > 0 ? p.imagem.aspect : 1, ...(p.ajuste === 'caber' ? { ajuste: 'caber' as const } : {}) }]))
  if (o.semMarca) (tema as DocTema & { semMarca?: boolean }).semMarca = true
  return tema
}
