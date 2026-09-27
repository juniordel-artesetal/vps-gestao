// SOA Design — VINCULAÇÃO SEMÂNTICA arte ↔ área do mockup (determinística, sem IA).
// "sereia_milk_frente.png" → área "frente" do mockup Milk, tema "sereia". Casa pela IDENTIDADE da face (nome da área +
// sinônimos), nunca pela posição. Artes do mesmo tema viram UMA foto; só o que não casou com segurança vira exceção
// (a tela de conferência mostra só essas).

export interface AreaVinculo { id: string; nome: string; oculta?: boolean }
export interface ArteVinculo { id: string; nome: string }
export interface GrupoVinculo {
  id: string
  /** Tema (o que sobra do nome do arquivo sem a face e sem o nome do mockup). */
  tema: string
  /** Arte de cada área (id da arte) — só o que casou pelo nome. */
  porArea: Record<string, string>
  /** Arte "sem face" do tema: vai nas áreas que não têm arte própria. */
  principal: string | null
  /** Pendências (área sem arte, face ambígua, duas artes na mesma face…). Vazio = casou sozinho. */
  avisos: string[]
  /** 0…1 — menor confiança entre os casamentos do grupo. */
  confianca: number
}

/** sem acento, minúsculas, só letras/números separados por espaço */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').replace(/[^a-z0-9]+/g, ' ').trim()
const tokens = (s: string) => normalizar(s).split(' ').filter(Boolean)

/** Sinônimos de cada face (a classe) e dos lados (modificador). */
const CLASSES: Record<string, string[]> = {
  frente: ['frente', 'front', 'frontal', 'capa', 'principal'],
  verso: ['verso', 'tras', 'traseira', 'traseiro', 'back', 'costas', 'atras', 'fundos'],
  lateral: ['lateral', 'laterais', 'lado', 'lados', 'lat', 'side'],
  alca: ['alca', 'alcas', 'handle', 'puxador'],
  tampa: ['tampa', 'topo', 'top', 'lid', 'tampo', 'cima'],
  fundo: ['fundo', 'base', 'bottom'],
  aba: ['aba', 'abas', 'flap'],
}
const MODS: Record<string, string[]> = { esquerda: ['esquerda', 'esq', 'left'], direita: ['direita', 'dir', 'right'] }
const classeDe = (t: string) => Object.keys(CLASSES).find(k => CLASSES[k].includes(t)) || null
const modDe = (t: string) => Object.keys(MODS).find(k => MODS[k].includes(t)) || null
const RUIDO = new Set(['arte', 'artes', 'mockup', 'final', 'ok', 'copia', 'copy', 'png', 'jpg', 'jpeg', 'img', 'imagem', 'face', 'area'])

interface Identidade { classe: string | null; mod: string | null; num: string | null; toks: string[] }
function identidade(nome: string): Identidade {
  const t = tokens(nome)
  return { classe: t.map(classeDe).find(Boolean) || null, mod: t.map(modDe).find(Boolean) || null, num: t.find(x => /^\d+$/.test(x)) || null, toks: t }
}
/** A sequência `agulha` aparece contígua em `palheiro`? devolve o índice inicial ou -1 */
function contem(palheiro: string[], agulha: string[]): number {
  if (!agulha.length) return -1
  for (let i = 0; i + agulha.length <= palheiro.length; i++) if (agulha.every((a, k) => palheiro[i + k] === a)) return i
  return -1
}

export interface Casamento { areaId: string | null; confianca: number; usados: Set<number>; ambigua?: string[]; /** mesma face em mais de uma área ("lateral" → as duas laterais) */ todas?: string[] }
/** Qual área este arquivo é? (confiança 1 = nome exato; 0,8 = sinônimo; ambíguo quando duas empatam) */
export function casarArte(nomeArquivo: string, areas: AreaVinculo[]): Casamento {
  const ft = tokens(nomeArquivo)
  const fClasseIdx = ft.findIndex(t => !!classeDe(t)), fModIdx = ft.findIndex(t => !!modDe(t))
  const fClasse = fClasseIdx >= 0 ? classeDe(ft[fClasseIdx]) : null, fMod = fModIdx >= 0 ? modDe(ft[fModIdx]) : null
  const notas: { id: string; s: number; usados: Set<number> }[] = []
  for (const a of areas) {
    if (a.oculta) continue
    const ai = identidade(a.nome)
    const exato = contem(ft, ai.toks)
    if (exato >= 0 && ai.toks.some(t => !/^\d+$/.test(t))) { notas.push({ id: a.id, s: 1, usados: new Set(ai.toks.map((_, k) => exato + k)) }); continue }
    if (!ai.classe || ai.classe !== fClasse) continue
    let s = 0.8
    const usados = new Set([fClasseIdx])
    if (ai.mod) { if (fMod === ai.mod) { s += 0.1; usados.add(fModIdx) } else if (fMod) continue }
    else if (fMod) s -= 0.1
    if (ai.num) { const i = ft.indexOf(ai.num); if (i >= 0) { s += 0.05; usados.add(i) } }
    notas.push({ id: a.id, s, usados })
  }
  if (!notas.length) return { areaId: null, confianca: 0, usados: new Set(fClasseIdx >= 0 ? [fClasseIdx] : []) }
  notas.sort((x, y) => y.s - x.s)
  const top = notas.filter(n => Math.abs(n.s - notas[0].s) < 1e-6)
  // "lateral" sem lado num mockup com 2 laterais → a mesma arte nas duas (é o uso comum); empate de nome exato = ambíguo
  if (top.length > 1 && top[0].s < 1) return { areaId: top[0].id, confianca: top[0].s, usados: top[0].usados, todas: top.map(n => n.id) }
  if (top.length > 1) return { areaId: top[0].id, confianca: 0.5, usados: top[0].usados, ambigua: top.map(n => n.id) }
  return { areaId: notas[0].id, confianca: notas[0].s, usados: notas[0].usados }
}

/** Tema do arquivo = o nome sem a face, sem o nome do mockup e sem ruído. */
export function temaDoArquivo(nomeArquivo: string, usados: Set<number>, nomeMockup: string): string {
  const ft = tokens(nomeArquivo), mk = new Set(tokens(nomeMockup))
  const resto = ft.filter((t, i) => !usados.has(i) && !mk.has(t) && !RUIDO.has(t) && !modDe(t))
  return resto.join(' ')
}

/**
 * Agrupa as artes por tema e liga cada uma à sua área. Regras:
 * - mockup de 1 área: cada arte é uma foto (nada a conferir);
 * - arte com face no nome → vai naquela área do grupo do tema;
 * - arte sem face: se o tema tem artes com face, ela vira a "principal" (preenche as áreas que faltam);
 *   senão é uma foto sozinha (a mesma arte em todas as áreas — o uso de sempre).
 */
export function agruparArtes(artes: ArteVinculo[], areas: AreaVinculo[], nomeMockup: string): GrupoVinculo[] {
  const vis = areas.filter(a => !a.oculta)
  const nomeArea = (id: string) => areas.find(a => a.id === id)?.nome || id
  if (vis.length <= 1) return artes.map(a => ({ id: `g_${a.id}`, tema: temaDoArquivo(a.nome, new Set(), nomeMockup) || a.nome, porArea: vis[0] ? { [vis[0].id]: a.id } : {}, principal: null, avisos: [], confianca: 1 }))
  const porTema = new Map<string, { casadas: { arte: ArteVinculo; c: Casamento }[]; soltas: ArteVinculo[] }>()
  for (const a of artes) {
    const c = casarArte(a.nome, vis)
    const tema = temaDoArquivo(a.nome, c.usados, nomeMockup)
    const g = porTema.get(tema) || { casadas: [], soltas: [] }
    if (c.areaId) g.casadas.push({ arte: a, c }); else g.soltas.push(a)
    porTema.set(tema, g)
  }
  const out: GrupoVinculo[] = []
  for (const [tema, g] of porTema) {
    if (!g.casadas.length) {
      // nenhuma arte com face: cada uma é uma foto (a arte vai em todas as áreas)
      for (const a of g.soltas) out.push({ id: `g_${a.id}`, tema: g.soltas.length > 1 || !tema ? `${tema ? `${tema} · ` : ''}${a.nome}` : tema, porArea: {}, principal: a.id, avisos: [], confianca: 1 })
      continue
    }
    const porArea: Record<string, string> = {}, avisos: string[] = []
    let confianca = 1
    for (const { arte, c } of g.casadas) {
      confianca = Math.min(confianca, c.confianca)
      if (c.ambigua) avisos.push(`“${arte.nome}” pode ser ${c.ambigua.map(nomeArea).join(' ou ')} — confira.`)
      for (const id of c.todas || [c.areaId!]) {
        if (porArea[id]) { if (!c.todas) avisos.push(`Duas artes para ${nomeArea(id)}: “${artes.find(x => x.id === porArea[id])?.nome}” e “${arte.nome}”.`); continue }
        porArea[id] = arte.id
      }
    }
    let principal: string | null = null
    if (g.soltas.length === 1) principal = g.soltas[0].id
    else if (g.soltas.length > 1) avisos.push(`Artes sem face no nome: ${g.soltas.map(s => `“${s.nome}”`).join(', ')} — escolha onde entram.`)
    if (!principal) for (const a of vis) if (!porArea[a.id]) avisos.push(`${a.nome}: sem arte.`)
    out.push({ id: `t_${tema || '_'}`, tema: tema || '(sem tema)', porArea, principal, avisos, confianca })
  }
  // exceções primeiro
  return out.sort((a, b) => (b.avisos.length ? 1 : 0) - (a.avisos.length ? 1 : 0) || a.tema.localeCompare(b.tema))
}
