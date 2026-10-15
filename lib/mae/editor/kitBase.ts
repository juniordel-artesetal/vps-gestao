// Lote 14 (item 189): BASE DE PEÇAS SOB MEDIDA — o KIT é feito de FOLHAS (Folha 1 × 2 + Folha 2 × 3); cada folha diz
// as peças que leva (Livros 9×5 × 4 + Caderno 7×3 × 6) e o MAE distribui (orientação automática, espaço, margem e a
// área da marca de registro), ou segue o gabarito/faca de corte enviado (travado). O kit é UM produto do SOA (grupo
// implícito, sem tela de grupos). Puro.
import type { DocTrabalho, FolhaMontada } from '../schema'
import type { Ret } from '../apliques/empacotar'
import { organizarFolha, sobrepostas, tamanhoPeca, vagasDoKitNaFolha, type PecaNaFolha } from './folhaMontada'
import { medidaDe } from '../medidas/pecas'

type Doc = DocTrabalho
type Grupo = NonNullable<Doc['grupos']>[number]
export const ID_KIT = 'g_kit'

export const ehBaseMedida = (d: Pick<Doc, 'tipo'>) => d.tipo === 'medida'

/** O grupo do kit (o produto do SOA desta base): o `g_kit` ou, numa base antiga com um grupo só, esse grupo. */
export function grupoDoKit(d: Pick<Doc, 'grupos'>): Grupo | null {
  return d.grupos?.find(g => g.id === ID_KIT) ?? (d.grupos?.length === 1 ? d.grupos[0] : null)
}

/** Mantém o grupo do kit em dia: todas as peças e todas as folhas, na ordem (Folha 1, Folha 2…). */
export function sincronizarKit(d: Doc): void {
  if (!ehBaseMedida(d)) return
  let g = grupoDoKit(d)
  if (!g) { g = { id: ID_KIT, nome: (d.name || 'Kit').slice(0, 80), moldes: [] }; (d.grupos ??= []).push(g) }
  g.moldes = d.molds.map(m => m.id)
  g.folhas = (d.folhas ?? []).map(f => f.id)
  delete g.folhaId
}

/** Peças pedidas da folha (as novas) — ou, numa folha antiga, as que já estão nela contadas por peça. */
export function pedidasDa(f: Pick<FolhaMontada, 'pedidas' | 'pecas'>): { moldeId: string; qtd: number }[] {
  if (f.pedidas?.length) return f.pedidas
  const c = new Map<string, number>()
  for (const p of f.pecas) c.set(p.moldeId, (c.get(p.moldeId) ?? 0) + 1)
  return [...c].map(([moldeId, qtd]) => ({ moldeId, qtd }))
}

/**
 * Monta a folha pelas peças pedidas: orientação automática (retrato × paisagem — a que coloca mais; empate: a de
 * agora) ou a fixa. `cabemAte` = com um tipo de peça só, quantas caberiam (o "cabem até 14").
 */
export function montarFolhaDoKit(f: FolhaMontada, moldes: Doc['molds'], zonasPara: (w: number, h: number) => Ret[]): { widthMm: number; heightMm: number; pecas: PecaNaFolha[]; ficaram: number; cabemAte: number | null } {
  const menor = Math.min(f.widthMm, f.heightMm), maior = Math.max(f.widthMm, f.heightMm)
  const atual: [number, number] = [f.widthMm, f.heightMm]
  const opcoes: [number, number][] = f.orientacao === 'retrato' ? [[menor, maior]] : f.orientacao === 'paisagem' ? [[maior, menor]] : [atual, [atual[1], atual[0]]]
  const pedidas = pedidasDa(f).map(p => ({ moldeId: p.moldeId, quantidade: p.qtd }))
  let melhor: { widthMm: number; heightMm: number; pecas: PecaNaFolha[]; ficaram: number } | null = null
  for (const [w, h] of opcoes) {
    const r = organizarFolha({ widthMm: w, heightMm: h, espacoMm: f.espacoMm, margemMm: f.margemMm }, pedidas, moldes, zonasPara(w, h))
    if (!melhor || r.pecas.length > melhor.pecas.length) melhor = { widthMm: w, heightMm: h, ...r }
  }
  const m = melhor ?? { widthMm: f.widthMm, heightMm: f.heightMm, pecas: [], ficaram: 0 }
  const cabemAte = pedidas.length === 1
    ? organizarFolha({ widthMm: m.widthMm, heightMm: m.heightMm, espacoMm: f.espacoMm, margemMm: f.margemMm }, [{ moldeId: pedidas[0].moldeId }], moldes, zonasPara(m.widthMm, m.heightMm)).pecas.length
    : null
  return { ...m, cabemAte }
}

const toca = (a: Ret, b: Ret) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
/**
 * Validações da folha (189.9): peça maior que a folha, peças sobrepostas, peça na área da marca de registro, furo
 * fora da peça, peça fora da folha. Frases prontas para a tela.
 */
export function validarFolha(f: FolhaMontada, moldes: Doc['molds'], zonas: Ret[]): string[] {
  const out: string[] = []
  for (const p of pedidasDa(f)) {
    const m = moldes.find(x => x.id === p.moldeId); if (!m) continue
    const t = tamanhoPeca(m, 0)
    const cabe = (t.w <= f.widthMm - 2 * f.margemMm && t.h <= f.heightMm - 2 * f.margemMm) || (t.h <= f.widthMm - 2 * f.margemMm && t.w <= f.heightMm - 2 * f.margemMm)
    if (!cabe) out.push(`"${m.name}" (${Math.round(t.w)} × ${Math.round(t.h)} mm) é maior que a folha.`)
    const med = medidaDe(m)
    if (med?.furo) {
      const r = med.furo.diametroMm / 2, cx = med.furo.x * med.larguraMm, cy = med.furo.y * med.alturaMm
      if (cx - r < 0 || cy - r < 0 || cx + r > med.larguraMm || cy + r > med.alturaMm) out.push(`O furo de "${m.name}" passa da borda da peça.`)
    }
  }
  const sob = sobrepostas(f, moldes)
  if (sob.length) out.push(`${sob.length} peça(s) se sobrepondo.`)
  let naMarca = 0, fora = 0
  for (const p of f.pecas) {
    const m = moldes.find(x => x.id === p.moldeId); if (!m) continue
    const t = tamanhoPeca(m, p.rot as 0 | 90), r = { x: p.xMm, y: p.yMm, w: t.w, h: t.h }
    if (zonas.some(z => toca(r, z))) naMarca++
    if (r.x < -0.01 || r.y < -0.01 || r.x + r.w > f.widthMm + 0.01 || r.y + r.h > f.heightMm + 0.01) fora++
  }
  if (naMarca) out.push(`${naMarca} peça(s) invadindo a área da marca de registro.`)
  if (fora) out.push(`${fora} peça(s) fora da folha: arraste para dentro ou diminua a quantidade.`)
  return out
}

/** "Este kit = 5 folhas impressas (Folha 1 × 2 · Folha 2 × 3)". */
export function resumoDoKit(folhas: Pick<FolhaMontada, 'nome' | 'impressoes'>[]): string {
  const n = folhas.reduce((s, f) => s + Math.max(1, f.impressoes ?? 1), 0)
  if (!folhas.length) return 'Nenhuma folha ainda.'
  return `Este kit = ${n} folha${n === 1 ? '' : 's'} impressa${n === 1 ? '' : 's'} (${folhas.map(f => `${f.nome} × ${Math.max(1, f.impressoes ?? 1)}`).join(' · ')})`
}

/** Lote 16 (item 206): o nome curto da peça ("Nutella · Corpo" → "Corpo"). */
const nomeCurto = (n: string) => n.split('·').pop()!.trim() || n

/**
 * Lote 16 (item 206): "Este kit = 3 folhas (Corpo 7 + 3 · Tampa 10)" — o KIT DE N PEÇAS: cada folha pela capacidade
 * dela (a última com o resto).
 */
export function resumoComposicao(folhas: Pick<FolhaMontada, 'nome' | 'pecas'>[], composicao: { moldeId: string; qtd: number }[] | undefined, moldes: Pick<Doc['molds'][number], 'id' | 'name'>[], kits = 1): string {
  if (!folhas.length) return 'Nenhuma folha ainda.'
  let total = 0
  const partes = folhas.filter(f => f.pecas.length).map(f => {
    const cap = f.pecas.length, n = vagasDoKitNaFolha(f, composicao, kits), cheias = Math.floor(n / cap), resto = n % cap
    total += cheias + (resto ? 1 : 0)
    const ids = [...new Set(f.pecas.map(p => p.moldeId))]
    const nome = ids.length === 1 ? nomeCurto(moldes.find(m => m.id === ids[0])?.name ?? f.nome) : f.nome
    return `${nome} ${[...Array(cheias).fill(cap), ...(resto ? [resto] : [])].join(' + ') || '0'}`
  })
  return `${kits > 1 ? `${kits} kits` : 'Este kit'} = ${total} folha${total === 1 ? '' : 's'} (${partes.join(' · ')})`
}

/** Lote 17 (item 211): "1 corpo"/"15 corpos" (nome curto da peça, em minúsculas). */
const daPeca = (nome: string, n: number) => { const c = nomeCurto(nome).toLowerCase(); return `${n} ${n === 1 ? c : /[aeiouáéíóú]$/.test(c) ? `${c}s` : /r$|z$/.test(c) ? `${c}es` : `${c}s`}` }
/** Lote 17 (item 211): "Na folha cabem 7 corpos e 12 tampas". */
export function capacidadeDasFolhas(folhas: Pick<FolhaMontada, 'pecas'>[], moldes: Pick<Doc['molds'][number], 'id' | 'name'>[]): string {
  const cap = new Map<string, number>()
  for (const f of folhas) { const porMolde = new Map<string, number>(); for (const p of f.pecas) porMolde.set(p.moldeId, (porMolde.get(p.moldeId) ?? 0) + 1); for (const [m, n] of porMolde) cap.set(m, Math.max(cap.get(m) ?? 0, n)) }
  const partes = [...cap].map(([m, n]) => daPeca(moldes.find(x => x.id === m)?.name ?? 'peça', n))
  return partes.length ? `Na folha cabem ${partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}` : partes[0]}` : ''
}
/**
 * Lote 17 (item 211): o resumo com a conta de um pedido — "1 unidade = 1 corpo + 1 tampa · um pedido de 15 = 5 folhas
 * (corpo 7 + 7 + 1 · tampa 12 + 3)".
 */
export function resumoDoPedido(folhas: Pick<FolhaMontada, 'nome' | 'pecas'>[], composicao: { moldeId: string; qtd: number }[] | undefined, moldes: Pick<Doc['molds'][number], 'id' | 'name'>[], unidades = 15): string {
  const ids = [...new Set(folhas.flatMap(f => f.pecas.map(p => p.moldeId)))]
  const un = ids.map(id => daPeca(moldes.find(m => m.id === id)?.name ?? 'peça', composicao?.find(c => c.moldeId === id)?.qtd ?? 1)).join(' + ')
  const conta = resumoComposicao(folhas, composicao, moldes, unidades).replace(/^.*? = /, '')
  return `1 unidade = ${un} · um pedido de ${unidades} = ${conta.replace(/\(([^)]*)\)/, (_, x: string) => `(${x.replace(/(^|· )(\S+)/g, (_m: string, a: string, b: string) => a + b.toLowerCase())})`)}`
}

/** "1 pedido de 2 kits = 10 folhas" ou, por peças, "96 tags = 4 folhas". */
export function exemploDoPedido(folhas: Pick<FolhaMontada, 'pecas' | 'impressoes'>[], contagem: 'kit' | 'pecas', nomePeca = 'peças'): string {
  const porKit = folhas.reduce((s, f) => s + Math.max(1, f.impressoes ?? 1), 0)
  if (!folhas.length) return ''
  if (contagem === 'pecas' && folhas.length === 1) {
    const cap = Math.max(1, folhas[0].pecas.length), n = cap * 4
    return `${n} ${nomePeca} = ${Math.ceil(n / cap)} folhas`
  }
  // Lote 16 (item 206): por peças com várias folhas = kits inteiros (as peças de 1 kit somam todas as folhas)
  if (contagem === 'pecas') {
    const porKitPecas = folhas.reduce((s, f) => s + f.pecas.length * Math.max(1, f.impressoes ?? 1), 0) || 1, kits = Math.ceil(96 / porKitPecas)
    return `96 ${nomePeca} ÷ ${porKitPecas} por kit = ${kits} kits = ${kits * porKit} folhas`
  }
  return `1 pedido de 2 kits = ${2 * porKit} folhas`
}
