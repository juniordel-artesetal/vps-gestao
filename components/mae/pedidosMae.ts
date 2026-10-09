'use client'
// PEDIDOS → ARTE no navegador (Sprint 12): conversa com /api/mae/{pedidos,vinculos,addons}, acha o tema de
// cada pedido, abre tema + base (da Biblioteca; se não estiverem neste computador, da nuvem), gera a arte
// com o MESMO exportador do painel e registra no card (status + nome do arquivo + versão do tema).
import { create } from 'zustand'
import { camposDoPedido, variaveis, alvosDoPedido, alertasDaLinha, type AlvoPedido, type CamposMae, type TemaAchado, type TemaLista, type Vinculo, type ArteRegistro } from '@/lib/mae/pedidos/pedidos'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { listarBases, listarTemas, type Identidade, versaoBasesSalvas } from './arquivosMae'
import { sync, type MarcaRegistro } from './sincronia'
import { exportar, type OpcoesExportar, type ResultadoExportar } from './exportarMae'

export type PosicaoPedido = { dx?: number; dy?: number; scale?: number; rotationDeg?: number; lines?: 1 | 2 }
export type TrocaPedido = { letra: string; so?: 'inicial' | 'todas'; fonte?: { postscriptName: string; family?: string; source?: 'local' | 'google'; url?: string }; gid?: number; escala?: number; baselineMm?: number; espacoMm?: number }
export interface PedidoApi {
  id: string; numero: string; cliente: string | null; status: string; criado: string
  /** Lote 5 (item 78): a observação do pedido no SOA. */
  observacoes?: string | null
  campos: Record<string, string>
  /** Lote 5 (item 79): peças da linha (`quantidade`), kits vendidos (`qtdVendida`) e peças do kit da Precificação. */
  itens: { nome: string; variacaoId: string | null; produtoId: string | null; produto?: string | null; variacao?: string | null; quantidade?: number | null; qtdVendida?: number | null; pecasKit?: number | null }[]
  artes: ArteRegistro[]
  /** Lote 1: tamanho do texto só deste pedido (NOME, IDADE, HASHTAG, ARROBA → fator). Lote 5: quantidades por
   *  caixa (por produto), posições ajustadas (botão Ajustar) e o formato da idade só deste pedido. */
  ajustes?: { escalas?: Record<string, number>; linhas?: Record<string, '1' | '2'>; quantidades?: Record<string, Record<string, number>>; posicoes?: Record<string, PosicaoPedido>; formatoIdade?: 'anos' | 'aninhos' | 'numero' | null; trocas?: Record<string, TrocaPedido[]> }
}
export interface EstadoAddon { ativo: boolean; origem: string | null; preco: number | null }
export interface Addons { addons: { criacao: EstadoAddon; massa: EstadoAddon }; ehNaty: boolean }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw Object.assign(new Error(j?.error || `HTTP ${r.status}`), { status: r.status })
  return j as T
}
export const apiMae = {
  addons: () => api<Addons>('/api/mae/addons'),
  pedidos: () => api<{ pedidos: PedidoApi[] }>('/api/mae/pedidos').then(r => r.pedidos),
  pedido: (id: string) => api<{ pedidos: PedidoApi[] }>(`/api/mae/pedidos?id=${encodeURIComponent(id)}`).then(r => r.pedidos[0]),
  registrarArte: (a: { orderId: string; themeId: string; themeVersion: number; variaveis: Record<string, string>; status: 'gerada' | 'revisar' | 'erro'; arquivo: string | null }) => api('/api/mae/pedidos/arte', { method: 'POST', body: JSON.stringify(a) }),
  vinculos: () => api<{ vinculos: (Vinculo & { id: string; produto: string | null; variacao: string | null })[] }>('/api/mae/vinculos').then(r => r.vinculos),
  vincular: (v: Vinculo) => api('/api/mae/vinculos', { method: 'PUT', body: JSON.stringify(v) }),
  /** Tamanho do texto só neste pedido (null tira o ajuste). */
  ajustarPedido: (id: string, escalas: Record<string, number | null>) => api<{ escalas: Record<string, number> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, escalas }) }),
  /** Lote 4 (item 50): nome composto em 1 ou 2 linhas só neste pedido (null = automático). */
  linhasPedido: (id: string, linhas: Record<string, '1' | '2' | null>) => api<{ linhas: Record<string, '1' | '2'> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, linhas }) }),
  /** Lote 4 (item 43): NOME, IDADE e TEMA preenchidos na lista — gravados no pedido (campo que o ateliê usa).
   *  Lote 5 (item 77): também a FRASE e os campos extras. */
  salvarCampos: (id: string, campos: Record<string, string>) => api<{ campos: Record<string, string> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, campos }) }),
  /** Lote 5 (item 79): quantidade de cada caixa, por produto (null tira as de um produto). */
  quantidades: (id: string, quantidades: Record<string, Record<string, number> | null>) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, quantidades }) }),
  /** Lote 5 (item 59): posição ajustada só neste pedido ({ '*': null } tira todas). */
  posicoes: (id: string, posicoes: Record<string, PosicaoPedido | null>) => api<{ posicoes: Record<string, PosicaoPedido> }>('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, posicoes }) }),
  /** Lote 5 (item 62): formato da idade só neste pedido (null = o do tema). */
  formatoIdade: (id: string, formatoIdade: 'anos' | 'aninhos' | 'numero' | null) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, formatoIdade }) }),
  /** Lote 5 (item 75): letra trocada só neste pedido, por variável (null tira). */
  trocas: (id: string, trocas: Record<string, TrocaPedido[] | null>) => api('/api/mae/pedidos', { method: 'PATCH', body: JSON.stringify({ id, trocas }) }),
}

// ── temas e bases: Biblioteca primeiro, nuvem depois ─────────────────────────────────────────────
export interface TemaDisponivel extends TemaLista { doc?: DocTema; baseId?: string }

export async function temasDisponiveis(raiz: FileSystemDirectoryHandle | null): Promise<TemaDisponivel[]> {
  const out = new Map<string, TemaDisponivel>()
  if (raiz) for (const t of await listarTemas(raiz).catch(() => [])) out.set(t.doc.id, { id: t.doc.id, name: t.doc.name ?? t.doc.id, version: t.doc.version, doc: t.doc, baseId: t.doc.baseId, ...(t.doc.produto ? { produto: t.doc.produto } : {}) })
  for (const t of await sync.listarTemas()) if (!out.has(t.id) || (out.get(t.id)!.version < t.version)) out.set(t.id, { ...(out.get(t.id) ?? {}), id: t.id, name: t.nome, version: t.version, baseId: t.base_id, doc: out.get(t.id)?.version === t.version ? out.get(t.id)!.doc : undefined })
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const cacheBases = new Map<string, DocTrabalho>()
let cacheDaVersao = -1
export async function abrirTemaEBase(raiz: FileSystemDirectoryHandle | null, t: TemaDisponivel): Promise<{ tema: DocTema; base: DocTrabalho }> {
  // Lote 5 (item 58): base salva depois de entrar aqui (ex.: NOME colocado em todas as páginas) → relê
  if (cacheDaVersao !== versaoBasesSalvas) { cacheBases.clear(); cacheDaVersao = versaoBasesSalvas }
  const tema = t.doc ?? await sync.abrirTema(t.id)
  const chave = `${tema.baseId}@${tema.baseVersion}`
  let base = cacheBases.get(chave)
  if (!base && raiz) {
    const locais = (await listarBases(raiz).catch(() => [])).filter(b => b.doc.id === tema.baseId)
    base = (locais.find(b => b.doc.version === tema.baseVersion) ?? locais.sort((a, b) => b.doc.version - a.doc.version)[0])?.doc
  }
  if (!base) base = await sync.abrirBase(tema.baseId, tema.baseVersion).catch(() => sync.abrirBase(tema.baseId))
  if (!base) throw new Error(`A base do tema "${tema.name}" não está neste computador nem na nuvem.`)
  cacheBases.set(chave, base)
  return { tema, base }
}

// ── linha de um pedido (tema achado, variáveis, alertas) ─────────────────────────────────────────
export interface LinhaPedido {
  pedido: PedidoApi; campos: CamposMae
  /** O tema do 1º produto (o da linha); com vários produtos, cada um tem o seu em `alvos`. */
  tema: TemaAchado | null
  /** Lote 4 (item 44): um alvo por PRODUTO do pedido (Kit Festa + Sacola P = 2 arquivos). */
  alvos: AlvoPedido[]
  /** Valores editados na linha (NOME, IDADE, HASHTAG e — Lote 5 — FRASE e campos extras). */
  editadas: Partial<Record<string, string>>
  alertas: string[]
  /** Lote 1: tamanho do texto só deste pedido. */
  escalas?: Record<string, number>
  /** Lote 4 (item 50): nome composto em 1 ou 2 linhas só deste pedido. */
  linhas?: Record<string, '1' | '2'>
  /** Lote 5 (item 79): quantidades por caixa (por produto) salvas no pedido. */
  quantidades?: Record<string, Record<string, number>>
  /** Lote 5 (item 59): posições ajustadas só neste pedido. */
  posicoes?: Record<string, PosicaoPedido>
  /** Lote 5 (item 62): formato da idade só neste pedido. */
  formatoIdade?: 'anos' | 'aninhos' | 'numero' | null
  /** Lote 5 (item 75): letras trocadas só neste pedido. */
  trocas?: Record<string, TrocaPedido[]>
}
export function linhaDoPedido(p: PedidoApi, temas: TemaDisponivel[], vinc: Vinculo[], apelidos: Record<string, string> = {}): LinhaPedido {
  const campos = camposDoPedido(p.campos)
  return comAlvos({ pedido: p, campos, tema: null, alvos: [], editadas: {}, alertas: [], escalas: p.ajustes?.escalas ?? {}, linhas: p.ajustes?.linhas ?? {},
    quantidades: p.ajustes?.quantidades ?? {}, posicoes: p.ajustes?.posicoes ?? {}, formatoIdade: p.ajustes?.formatoIdade ?? null, trocas: p.ajustes?.trocas ?? {} }, temas, vinc, apelidos)
}
/** Acha de novo o tema de cada produto da linha (depois de editar o TEMA ou criar um vínculo). */
export function comAlvos(l: LinhaPedido, temas: TemaLista[], vinc: Vinculo[], apelidos: Record<string, string>): LinhaPedido {
  const alvos = alvosDoPedido(l.pedido.itens, vinc, temas, l.campos.TEMA, apelidos)
  const tema = alvos.find(a => a.tema)?.tema ?? null
  return { ...l, alvos, tema, alertas: alertasLinha({ ...l, alvos, tema }) }
}
/** Alertas da linha + "tema não encontrado (Sacola P)" quando só um dos produtos ficou sem tema. */
export function alertasLinha(l: Pick<LinhaPedido, 'campos' | 'tema' | 'editadas' | 'alvos'>): string[] {
  const a = alertasDaLinha(l.campos, l.tema, l.editadas)
  if (l.tema && l.alvos.length > 1) for (const x of l.alvos) if (!x.tema) a.push(`tema não encontrado (${x.produto.slice(0, 30)})`)
  return a
}
/** Lote 4 (item 43): produto(s) e variação da linha, para a usuária saber qual é o tema. */
export function produtoEVariacao(l: LinhaPedido): { produto: string; variacao: string } {
  const produto = l.alvos.map(a => a.produto).filter(Boolean).join(' + ')
  const variacao = l.alvos.map(a => a.variacao).filter(Boolean).join(' + ') || l.campos.extras['VARIAÇÃO'] || l.campos.extras['VARIACAO'] || ''
  return { produto, variacao }
}
/** Valores do pedido (NOME, IDADE, HASHTAG…) + o tamanho só deste pedido (`_ESCALA_<VAR>`, lido pelo resolver). */
export const valoresDaLinha = (l: LinhaPedido, tema?: DocTema | null): Record<string, string> => ({
  ...variaveis(l.campos, tema?.hashtag?.middle ?? 'faz', l.editadas),
  ...Object.fromEntries(Object.entries(l.escalas ?? {}).map(([k, v]) => [`_ESCALA_${k}`, String(v)])),
  ...Object.fromEntries(Object.entries(l.linhas ?? {}).map(([k, v]) => [`_LINHAS_${k}`, v])),
  // Lote 5: posição ajustada só neste pedido (59), formato da idade (62), campo vazio some no arquivo (77)
  ...Object.fromEntries(Object.entries(l.posicoes ?? {}).map(([k, v]) => [`_POS_${k}`, JSON.stringify(v)])),
  ...(l.formatoIdade ? { _FORMATO_IDADE: l.formatoIdade } : {}),
  ...Object.fromEntries(Object.entries(l.trocas ?? {}).map(([k, v]) => [`_TROCAS_${k}`, JSON.stringify(v)])),
  _PEDIDO: '1',
})

/** Opções da geração do pedido: impressão em PDF, tudo junto (1 arquivo por pedido), com as do painel. */
export function opcoesDoPedido(base: Partial<OpcoesExportar>, valores: Record<string, string>, pasta?: string): OpcoesExportar {
  return { tipo: 'impressao', aprovacao: 'folha', formato: 'pdf', agrupar: 'tudo', linhas: false, linhasOriginais: true, svg: false, dxf: false, ...base, valores, ...(pasta ? { pasta } : {}) }
}

/** Gera a arte do pedido e registra no card. Devolve o resultado da exportação. */
export async function gerarArteDoPedido(o: {
  raiz: FileSystemDirectoryHandle; pedido: PedidoApi; tema: DocTema; base: DocTrabalho; identidade: Identidade; marcas: MarcaRegistro[]
  opcoes: OpcoesExportar; aoProgredir?: (t: string) => void; registrar?: boolean
}): Promise<ResultadoExportar> {
  const r = await exportar({ raiz: o.raiz, doc: o.base, tema: o.tema, identidade: o.identidade, marcas: o.marcas, aoProgredir: o.aoProgredir }, o.opcoes)
  if (o.registrar !== false) {
    const principal = r.arquivos.find(a => a.endsWith('.pdf')) ?? r.arquivos[0] ?? null
    await apiMae.registrarArte({ orderId: o.pedido.id, themeId: o.tema.id, themeVersion: o.tema.version, variaveis: o.opcoes.valores, status: r.revisar ? 'revisar' : 'gerada', arquivo: principal }).catch(e => console.warn('[MAE] registrar arte', e))
  }
  return r
}

// ── pedido aberto no editor ("Gerar arte" do card) ───────────────────────────────────────────────
export interface EstadoPedidoAberto {
  pedido: PedidoApi | null; valores: Record<string, string>; origemTema: string | null; aviso: string | null
  /** Lote 5 (item 59): botão "Ajustar" da edição em massa — os textos se mexem SÓ neste pedido; o tema fica travado. */
  ajustar?: boolean
}
export const usePedidoAberto = create<EstadoPedidoAberto>()(() => ({ pedido: null, valores: {}, origemTema: null, aviso: null, ajustar: false }))

/** Lote 5 (item 59): posição/tamanho/giro/linhas de um texto SÓ neste pedido (grava no pedido, sem mexer no tema). */
let timerPos: ReturnType<typeof setTimeout> | null = null
const pendentes: Record<string, PosicaoPedido | null> = {}
export function ajustarTextoDoPedido(slotId: string, f: (a: PosicaoPedido) => void) {
  const st = usePedidoAberto.getState()
  if (!st.pedido) return
  const atual: PosicaoPedido = (() => { try { return JSON.parse(st.valores[`_POS_${slotId}`] ?? '{}') } catch { return {} } })()
  f(atual)
  usePedidoAberto.setState(s => ({ valores: { ...s.valores, [`_POS_${slotId}`]: JSON.stringify(atual) } }))
  pendentes[slotId] = atual
  const id = st.pedido.id
  if (timerPos) clearTimeout(timerPos)
  timerPos = setTimeout(() => { const p = { ...pendentes }; for (const k of Object.keys(pendentes)) delete pendentes[k]; void apiMae.posicoes(id, p).catch(() => null) }, 500)
}
