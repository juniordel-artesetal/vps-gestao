// mae-pedidos — BUSCA E FILTROS da edição em massa (Lote 7, item 116). Puro: a tela descreve cada linha num
// `Filtravel` e estas funções filtram, ordenam pela urgência e montam as opções dos chips.

export interface Filtravel {
  numero: string; cliente: string; nome: string
  /** TEMA do pedido no SOA (campo) e o nome do tema MAE ligado. */
  temaSoa: string; temaMae: string
  produto: string; status: string; canal: string; loja: string
  /** AAAA-MM-DD (data limite de envio) ou ''. */
  dataEnvio: string
  temTema: boolean; comObs: boolean; ajustado: boolean
  /** Lote 13 (item 180): o nome/hashtag usa letra que a fonte do tema não tem. */
  letraFaltando?: boolean
  /** Lote 13 (item 183): pedido sem nome (e não está aguardando) · a cliente ainda não mandou os dados. */
  semNome?: boolean; aguardando?: boolean
}
export type Prazo = 'atrasados' | 'hoje' | 'amanha'
export interface Filtros {
  busca?: string
  temas?: string[]; produtos?: string[]; status?: string[]; canais?: string[]; lojas?: string[]
  prazo?: Prazo | null
  semTema?: boolean; comObs?: boolean; ajustado?: boolean
  letraFaltando?: boolean
  semNome?: boolean; aguardando?: boolean
  /**
   * Lote 13 (item 182): DATA DE ENVIO (data limite de postagem) — sempre RELATIVA a hoje (dias), para o filtro salvo
   * não vencer no dia seguinte: hoje = 0..0, até amanhã = 0..1 + atrasados, próximos 7 dias = 0..6.
   */
  envio?: { de: number; ate: number; atrasados?: boolean; rotulo?: string } | null
}
export const FILTROS_VAZIOS: Filtros = {}

/** Lote 13 (item 182): dias entre duas datas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  const d = (s: string) => { const [y, m, dd] = s.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  return Math.round((d(b) - d(a)) / 86_400_000)
}
/** Lote 13 (item 182): os atalhos do calendário (relativos a hoje). "Esta semana" vai até domingo. */
export function presetEnvio(qual: 'hoje' | 'amanha' | 'atrasados' | 'semana' | '7dias', hoje: string): NonNullable<Filtros['envio']> {
  if (qual === 'hoje') return { de: 0, ate: 0, rotulo: 'Despacha hoje' }
  if (qual === 'amanha') return { de: 0, ate: 1, atrasados: true, rotulo: 'Até amanhã' }
  if (qual === 'atrasados') return { de: -3650, ate: -1, rotulo: 'Atrasados' }
  if (qual === '7dias') return { de: 0, ate: 6, rotulo: 'Próximos 7 dias' }
  const [y, m, d] = hoje.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()   // 0 = domingo
  return { de: 0, ate: dow === 0 ? 0 : 7 - dow, rotulo: 'Esta semana' }
}
/** Lote 13 (item 182): o período do filtro em datas de hoje. */
export function periodoEnvio(e: NonNullable<Filtros['envio']>, hoje: string): { de: string; ate: string } {
  return { de: diaMais(hoje, e.de), ate: diaMais(hoje, e.ate) }
}
/** Lote 13 (item 182): quantos pedidos por dia (para o calendário). */
export function contarPorDia(fs: Filtravel[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of fs) if (f.dataEnvio) out[f.dataEnvio] = (out[f.dataEnvio] ?? 0) + 1
  return out
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** AAAA-MM-DD de hoje + n dias (data local). */
export function diaMais(hoje: string, n: number): string {
  const [a, m, d] = hoje.split('-').map(Number)
  const x = new Date(a, m - 1, d + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export const hojeLocal = (agora = new Date()) => `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`

/** Situação do prazo de envio: atrasado · hoje · amanhã · depois · sem data. */
export function situacaoPrazo(dataEnvio: string, hoje: string): 'atrasado' | 'hoje' | 'amanha' | 'depois' | 'sem' {
  if (!dataEnvio) return 'sem'
  if (dataEnvio < hoje) return 'atrasado'
  if (dataEnvio === hoje) return 'hoje'
  return dataEnvio === diaMais(hoje, 1) ? 'amanha' : 'depois'
}

/** "Despacha hoje" = hoje; "até amanhã" = atrasados + hoje + amanhã; "atrasados" = antes de hoje. */
function passaPrazo(dataEnvio: string, prazo: Prazo, hoje: string): boolean {
  const s = situacaoPrazo(dataEnvio, hoje)
  if (prazo === 'atrasados') return s === 'atrasado'
  if (prazo === 'hoje') return s === 'hoje'
  return s === 'atrasado' || s === 'hoje' || s === 'amanha'
}

/** A busca única: nº do pedido, cliente, aniversariante (NOME) e tema (do SOA ou do MAE). */
export function bateBusca(f: Filtravel, busca: string): boolean {
  const termos = norm(busca).replace(/^#/, '').split(/\s+/).filter(Boolean)
  if (!termos.length) return true
  const alvo = norm([f.numero, f.cliente, f.nome, f.temaSoa, f.temaMae].join(' '))
  return termos.every(t => alvo.includes(t))
}

const temUm = (lista: string[] | undefined, v: string) => !lista?.length || lista.some(x => norm(x) === norm(v))

/** Os filtros combinados (E entre categorias; OU dentro de cada categoria). */
export function passa(f: Filtravel, fs: Filtros, hoje: string): boolean {
  if (fs.busca && !bateBusca(f, fs.busca)) return false
  if (!temUm(fs.temas, f.temaSoa || f.temaMae)) return false
  if (!temUm(fs.produtos, f.produto)) return false
  if (!temUm(fs.status, f.status)) return false
  if (!temUm(fs.canais, f.canal)) return false
  if (!temUm(fs.lojas, f.loja)) return false
  if (fs.prazo && !passaPrazo(f.dataEnvio, fs.prazo, hoje)) return false
  if (fs.semTema && f.temTema) return false
  if (fs.comObs && !f.comObs) return false
  if (fs.ajustado && !f.ajustado) return false
  if (fs.letraFaltando && !f.letraFaltando) return false
  if (fs.semNome && !f.semNome) return false
  if (fs.aguardando && !f.aguardando) return false
  if (fs.envio) {
    const { de, ate } = periodoEnvio(fs.envio, hoje)
    const d = f.dataEnvio
    const dentro = !!d && d >= de && d <= ate
    const atrasado = !!d && d < hoje && !!fs.envio.atrasados
    if (!dentro && !atrasado) return false
  }
  return true
}

export function filtrar<T>(linhas: T[], fs: Filtros, de: (l: T) => Filtravel, hoje: string): T[] {
  return linhas.filter(l => passa(de(l), fs, hoje))
}

/** Do mais urgente para o menos: data de envio crescente; sem data no fim; empate mantém a ordem de antes. */
export function ordenarPorUrgencia<T>(linhas: T[], de: (l: T) => Filtravel): T[] {
  return linhas.map((l, i) => ({ l, i, d: de(l).dataEnvio || '9999-99-99' })).sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.i - b.i)).map(x => x.l)
}

/** Opções dos chips, tiradas das próprias linhas (sem vazios, sem repetir, em ordem alfabética). */
export function opcoesDosFiltros(fs: Filtravel[]): { temas: string[]; produtos: string[]; status: string[]; canais: string[]; lojas: string[] } {
  const u = (xs: string[]) => [...new Map(xs.filter(x => x.trim()).map(x => [norm(x), x.trim()])).values()].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return { temas: u(fs.map(f => f.temaSoa || f.temaMae)), produtos: u(fs.map(f => f.produto)), status: u(fs.map(f => f.status)), canais: u(fs.map(f => f.canal)), lojas: u(fs.map(f => f.loja)) }
}

/** Quantos filtros estão ligados (para o "Limpar filtros"). */
export const nFiltros = (fs: Filtros) =>
  (fs.busca?.trim() ? 1 : 0) + (fs.temas?.length ?? 0) + (fs.produtos?.length ?? 0) + (fs.status?.length ?? 0) + (fs.canais?.length ?? 0) + (fs.lojas?.length ?? 0) + (fs.prazo ? 1 : 0) + (fs.semTema ? 1 : 0) + (fs.comObs ? 1 : 0) + (fs.ajustado ? 1 : 0) + (fs.letraFaltando ? 1 : 0) + (fs.semNome ? 1 : 0) + (fs.aguardando ? 1 : 0) + (fs.envio ? 1 : 0)

// ── filtros salvos (Biblioteca: Pedidos/filtros.json) ─────────────────────────────────────────
export const ARQ_FILTROS = 'Pedidos/filtros.json'
export interface FiltroSalvo { nome: string; filtros: Filtros }
export function lerFiltrosSalvos(txt: string | null | undefined): FiltroSalvo[] {
  try {
    const j = JSON.parse(txt ?? '[]')
    return Array.isArray(j) ? j.filter(x => x && typeof x.nome === 'string' && x.filtros && typeof x.filtros === 'object').slice(0, 50) : []
  } catch { return [] }
}
/** Guarda (ou troca, pelo nome) um filtro. */
export function guardarFiltro(lista: FiltroSalvo[], nome: string, filtros: Filtros): FiltroSalvo[] {
  const n = nome.trim().slice(0, 60)
  if (!n) return lista
  return [...lista.filter(x => norm(x.nome) !== norm(n)), { nome: n, filtros: { ...filtros, busca: filtros.busca?.trim() || undefined } }]
}
