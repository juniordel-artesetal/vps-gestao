// mae-pedidos — PEDIDOS → ARTE (Sprint 12). Puro: lê os campos TEMA, NOME, IDADE (e extras) do pedido,
// calcula as variáveis (HASHTAG), acha o tema (vínculo produto/variação ↔ tema, senão o nome do campo
// TEMA), roda a FILA de geração e resume o status do card. Sem banco e sem navegador.
import { hashtag } from '../texto/diagramar'

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Nomes de campo aceitos (a usuária cria os campos nos produtos dela; o tutorial ensina TEMA, NOME e
 * IDADE, mas campos antigos do SOA Design — "Nome da criança", "Idade da criança" — também valem).
 */
const ALIASES: Record<'TEMA' | 'NOME' | 'IDADE', string[]> = {
  TEMA: ['tema', 'tema da festa', 'tema do kit'],
  NOME: ['nome', 'nome da crianca', 'nome do aniversariante', 'nome personalizado', 'nome na arte'],
  IDADE: ['idade', 'idade da crianca', 'anos', 'idade do aniversariante'],
}
export const OBRIGATORIOS = ['TEMA', 'NOME', 'IDADE'] as const

export interface CamposMae { TEMA?: string; NOME?: string; IDADE?: string; extras: Record<string, string> }

/** Campos do pedido (camposExtras achatado) → TEMA/NOME/IDADE + extras (FRASE, DATA DA FESTA…, em MAIÚSCULAS). */
export function camposDoPedido(campos: Record<string, string>): CamposMae {
  const out: CamposMae = { extras: {} }
  for (const [k, v0] of Object.entries(campos)) {
    const v = String(v0 ?? '').trim()
    if (!v) continue
    const n = norm(k)
    const qual = (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).find(q => ALIASES[q].includes(n))
    if (qual) { if (!out[qual]) out[qual] = v }
    else out.extras[k.toUpperCase().trim()] = v
  }
  return out
}

/** Quais dos obrigatórios faltam (para a geração em massa: "faltam dados"). */
export const faltando = (c: CamposMae): string[] => OBRIGATORIOS.filter(k => !c[k]?.trim())

/** Variáveis da arte: NOME, IDADE, HASHTAG (calculada, ou a editada) + extras. Edições da linha vencem. */
export function variaveis(c: CamposMae, meio = 'faz', editadas: Partial<Record<string, string>> = {}): Record<string, string> {
  const nome = (editadas.NOME ?? c.NOME ?? '').trim(), idade = (editadas.IDADE ?? c.IDADE ?? '').trim()
  const v: Record<string, string> = { ...c.extras, NOME: nome, IDADE: idade }
  v.HASHTAG = (editadas.HASHTAG ?? '').trim() || hashtag(nome, idade, meio)
  for (const [k, x] of Object.entries(editadas)) if (x !== undefined && !['NOME', 'IDADE', 'HASHTAG'].includes(k)) v[k] = x
  return v
}

export interface ItemPedido { variacaoId?: string | null; produtoId?: string | null; nome?: string }
export interface Vinculo { produtoId: string; variacaoId: string | null; themeId: string }
export interface TemaLista { id: string; name: string; version: number }
export type OrigemTema = 'variacao' | 'produto' | 'campo' | 'manual'
export interface TemaAchado { themeId: string; origem: OrigemTema }

/**
 * Tema do pedido: 1º vínculo da VARIAÇÃO, 2º vínculo do PRODUTO (sem variação), 3º o campo TEMA
 * comparado com os nomes dos temas (sem acento/maiúscula/espaço extra). Vários itens com temas
 * diferentes: vale o primeiro item que tiver vínculo.
 */
export function acharTema(itens: ItemPedido[], vinculos: Vinculo[], temas: TemaLista[], campoTema?: string): TemaAchado | null {
  const existe = (id: string) => temas.some(t => t.id === id)
  for (const it of itens) {
    const v = it.variacaoId ? vinculos.find(x => x.variacaoId === it.variacaoId && existe(x.themeId)) : undefined
    if (v) return { themeId: v.themeId, origem: 'variacao' }
  }
  for (const it of itens) {
    const v = it.produtoId ? vinculos.find(x => x.produtoId === it.produtoId && !x.variacaoId && existe(x.themeId)) : undefined
    if (v) return { themeId: v.themeId, origem: 'produto' }
  }
  if (campoTema?.trim()) {
    const alvo = norm(campoTema)
    const t = temas.find(x => norm(x.name) === alvo)
    if (t) return { themeId: t.id, origem: 'campo' }
  }
  return null
}

/** Pasta do pedido no lote: Exportações/AAAA-MM-DD/<pedido>_<nome>/ (nome seguro no Windows). */
export function pastaDoPedido(pastaDia: string, numero: string, nome: string): string {
  const s = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `${pastaDia}/${s(numero) || 'pedido'}_${s(nome) || 'sem-nome'}`
}

// ── fila de geração ─────────────────────────────────────────────────────────────────────────────
export type StatusGeracao = 'gerada' | 'aviso' | 'erro'
export interface ResultadoItem<R> { id: string; status: StatusGeracao; valor?: R; mensagem?: string; avisos?: string[] }

/**
 * Fila no computador: um pedido por vez (o motor e a memória agradecem), na ordem dada, com progresso;
 * erro num pedido não para a fila; `cancelar()` para depois do item atual. Determinística.
 */
export async function rodarFila<T extends { id: string }, R>(
  itens: T[],
  tarefa: (item: T, i: number) => Promise<{ valor: R; avisos?: string[] }>,
  o: { aoProgredir?: (feitos: number, total: number, atual: T | null) => void; cancelado?: () => boolean } = {},
): Promise<ResultadoItem<R>[]> {
  const out: ResultadoItem<R>[] = []
  for (let i = 0; i < itens.length; i++) {
    if (o.cancelado?.()) break
    o.aoProgredir?.(i, itens.length, itens[i])
    try {
      const r = await tarefa(itens[i], i)
      out.push({ id: itens[i].id, status: r.avisos?.length ? 'aviso' : 'gerada', valor: r.valor, avisos: r.avisos })
    } catch (e) {
      out.push({ id: itens[i].id, status: 'erro', mensagem: (e as Error)?.message || String(e) })
    }
  }
  o.aoProgredir?.(out.length, itens.length, null)
  return out
}

export function resumo<R>(rs: ResultadoItem<R>[]): Record<StatusGeracao, number> {
  return { gerada: rs.filter(r => r.status === 'gerada').length, aviso: rs.filter(r => r.status === 'aviso').length, erro: rs.filter(r => r.status === 'erro').length }
}

// ── status do card ──────────────────────────────────────────────────────────────────────────────
export type StatusArte = 'nao_gerada' | 'gerada' | 'revisar'
export interface ArteRegistro { status: string; arquivo: string | null; themeId: string; themeVersion: number; criadoEm: string; variaveis?: Record<string, string> }

/** Status do card = o da geração mais recente; o histórico fica (gerar de novo cria outro registro). */
export function statusDoCard(artes: ArteRegistro[]): { status: StatusArte; ultima: ArteRegistro | null; historico: ArteRegistro[] } {
  const h = [...artes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  const u = h[0] ?? null
  const status: StatusArte = !u ? 'nao_gerada' : u.status === 'gerada' ? 'gerada' : u.status === 'revisar' ? 'revisar' : 'nao_gerada'
  return { status, ultima: u, historico: h }
}

/** Avisos da linha antes de gerar (a geração ainda pode achar outros, como "nome longo" no auto-ajuste). */
export function alertasDaLinha(c: CamposMae, tema: TemaAchado | null, editadas: Partial<Record<string, string>> = {}): string[] {
  const a: string[] = []
  const f = faltando({ ...c, NOME: editadas.NOME ?? c.NOME, IDADE: editadas.IDADE ?? c.IDADE, TEMA: c.TEMA ?? (tema ? 'ok' : undefined) })
  if (f.length) a.push(`faltam dados (${f.join(', ')})`)
  if (!tema) a.push('tema não encontrado')
  const nome = (editadas.NOME ?? c.NOME ?? '').trim()
  if (nome.length > 16) a.push('nome longo')
  return a
}
