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
}
export type Prazo = 'atrasados' | 'hoje' | 'amanha'
export interface Filtros {
  busca?: string
  temas?: string[]; produtos?: string[]; status?: string[]; canais?: string[]; lojas?: string[]
  prazo?: Prazo | null
  semTema?: boolean; comObs?: boolean; ajustado?: boolean
  letraFaltando?: boolean
}
export const FILTROS_VAZIOS: Filtros = {}

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
  (fs.busca?.trim() ? 1 : 0) + (fs.temas?.length ?? 0) + (fs.produtos?.length ?? 0) + (fs.status?.length ?? 0) + (fs.canais?.length ?? 0) + (fs.lojas?.length ?? 0) + (fs.prazo ? 1 : 0) + (fs.semTema ? 1 : 0) + (fs.comObs ? 1 : 0) + (fs.ajustado ? 1 : 0) + (fs.letraFaltando ? 1 : 0)

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
