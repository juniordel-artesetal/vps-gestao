'use client'
// PEDIDOS → ARTE no navegador (Sprint 12): conversa com /api/mae/{pedidos,vinculos,addons}, acha o tema de
// cada pedido, abre tema + base (da Biblioteca; se não estiverem neste computador, da nuvem), gera a arte
// com o MESMO exportador do painel e registra no card (status + nome do arquivo + versão do tema).
import { create } from 'zustand'
import { camposDoPedido, variaveis, acharTema, alertasDaLinha, type CamposMae, type TemaAchado, type TemaLista, type Vinculo, type ArteRegistro } from '@/lib/mae/pedidos/pedidos'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { listarBases, listarTemas, type Identidade } from './arquivosMae'
import { sync, type MarcaRegistro } from './sincronia'
import { exportar, type OpcoesExportar, type ResultadoExportar } from './exportarMae'

export interface PedidoApi {
  id: string; numero: string; cliente: string | null; status: string; criado: string
  campos: Record<string, string>
  itens: { nome: string; variacaoId: string | null; produtoId: string | null }[]
  artes: ArteRegistro[]
  /** Lote 1: tamanho do texto só deste pedido (NOME, IDADE, HASHTAG, ARROBA → fator). */
  ajustes?: { escalas?: Record<string, number> }
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
}

// ── temas e bases: Biblioteca primeiro, nuvem depois ─────────────────────────────────────────────
export interface TemaDisponivel extends TemaLista { doc?: DocTema; baseId?: string }

export async function temasDisponiveis(raiz: FileSystemDirectoryHandle | null): Promise<TemaDisponivel[]> {
  const out = new Map<string, TemaDisponivel>()
  if (raiz) for (const t of await listarTemas(raiz).catch(() => [])) out.set(t.doc.id, { id: t.doc.id, name: t.doc.name ?? t.doc.id, version: t.doc.version, doc: t.doc, baseId: t.doc.baseId })
  for (const t of await sync.listarTemas()) if (!out.has(t.id) || (out.get(t.id)!.version < t.version)) out.set(t.id, { ...(out.get(t.id) ?? {}), id: t.id, name: t.nome, version: t.version, baseId: t.base_id, doc: out.get(t.id)?.version === t.version ? out.get(t.id)!.doc : undefined })
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name))
}

const cacheBases = new Map<string, DocTrabalho>()
export async function abrirTemaEBase(raiz: FileSystemDirectoryHandle | null, t: TemaDisponivel): Promise<{ tema: DocTema; base: DocTrabalho }> {
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
  tema: TemaAchado | null
  editadas: Partial<Record<'NOME' | 'IDADE' | 'HASHTAG', string>>
  alertas: string[]
  /** Lote 1: tamanho do texto só deste pedido. */
  escalas?: Record<string, number>
}
export function linhaDoPedido(p: PedidoApi, temas: TemaDisponivel[], vinc: Vinculo[], apelidos: Record<string, string> = {}): LinhaPedido {
  const campos = camposDoPedido(p.campos)
  const tema = acharTema(p.itens, vinc, temas, campos.TEMA, apelidos)
  return { pedido: p, campos, tema, editadas: {}, alertas: alertasDaLinha(campos, tema), escalas: p.ajustes?.escalas ?? {} }
}
/** Valores do pedido (NOME, IDADE, HASHTAG…) + o tamanho só deste pedido (`_ESCALA_<VAR>`, lido pelo resolver). */
export const valoresDaLinha = (l: LinhaPedido, tema?: DocTema | null): Record<string, string> => ({
  ...variaveis(l.campos, tema?.hashtag?.middle ?? 'faz', l.editadas),
  ...Object.fromEntries(Object.entries(l.escalas ?? {}).map(([k, v]) => [`_ESCALA_${k}`, String(v)])),
})

/** Opções da geração do pedido: impressão em PDF, tudo junto (1 arquivo por pedido), com as do painel. */
export function opcoesDoPedido(base: Partial<OpcoesExportar>, valores: Record<string, string>, pasta?: string): OpcoesExportar {
  return { tipo: 'impressao', aprovacao: 'folha', formato: 'pdf', agrupar: 'tudo', sobraMm: 10, linhas: true, linhasOriginais: true, svg: false, dxf: false, ...base, valores, ...(pasta ? { pasta } : {}) }
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
export interface EstadoPedidoAberto { pedido: PedidoApi | null; valores: Record<string, string>; origemTema: string | null; aviso: string | null }
export const usePedidoAberto = create<EstadoPedidoAberto>()(() => ({ pedido: null, valores: {}, origemTema: null, aviso: null }))
