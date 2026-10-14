'use client'
// MAE — RASCUNHO AUTOMÁTICO (proteção contra perda, 12/10/2026). A Naty perdeu o TRANSFORMERS inteiro com um erro
// na página: o editor só gravava quando ela clicava em Salvar. Agora o trabalho NÃO SALVO (base e tema) fica:
//   • NESTE COMPUTADOR (IndexedDB): 2 s depois de cada mudança;
//   • NO SERVIDOR (mae_rascunhos): a cada ~30 s, ao trocar de aba e ao fechar/recarregar a página (keepalive);
//   • na hora, se uma ferramenta der erro (ProtecaoErro / window.onerror).
// Ao reabrir, "Recuperar trabalho não salvo?" (RecuperarRascunhos). Salvar de verdade apaga o rascunho.
// Só a RECEITA (JSON) — imagens continuam na Biblioteca, por caminho + hash; nada é recodificado.
import { create } from 'zustand'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { alteradoDesde } from '@/lib/mae/editor/linhaDoTempo'
import { explicarRecusa } from '@/lib/mae/erros'

export type TipoRascunho = 'base' | 'tema'
export interface Rascunho { chave: string; tipo: TipoRascunho; id: string; nome: string; versao: number; doc: DocTema | DocTrabalho; editadoEm: number; onde: 'local' | 'nuvem' }
type Doc = DocTema | DocTrabalho

// ── estado mostrado no topo ("Salvo há X s" / "Salvando…" / "Sem conexão — salvo neste computador") ──────────
// Lote 16 (item 203): 'recusado' = o servidor RESPONDEU e recusou (4xx) — não é falta de conexão; `motivo` em português
export interface EstadoSalvamento { estado: 'salvo' | 'salvando' | 'offline' | 'recusado' | 'nada'; em: number | null; pendente: boolean; motivo?: string | null }
export const useSalvamento = create<EstadoSalvamento>()(() => ({ estado: 'nada', em: null, pendente: false, motivo: null }))

// ── IndexedDB (uma loja, chave "tipo:id") ─────────────────────────────────────────────────────────────────────
// Lote 10 (item 150): 2ª loja "fila" = envios ao servidor que ainda não deram certo (sincronia.ts)
const BANCO = 'mae-rascunhos', LOJA = 'docs'
let banco: Promise<IDBDatabase> | null = null
function abrir(): Promise<IDBDatabase> {
  if (banco) return banco
  banco = new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 2)
    r.onupgradeneeded = () => {
      for (const l of [LOJA, 'fila']) if (!r.result.objectStoreNames.contains(l)) r.result.createObjectStore(l, { keyPath: 'chave' })
    }
    r.onsuccess = () => ok(r.result)
    r.onerror = () => { banco = null; erro(r.error) }
  })
  return banco
}
/** Uma operação no IndexedDB do MAE (loja `docs` = rascunhos; `fila` = envios pendentes). */
export async function idb<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest, loja = LOJA): Promise<T> {
  const db = await abrir()
  return new Promise((ok, erro) => { const t = db.transaction(loja, modo); const q = f(t.objectStore(loja)); q.onsuccess = () => ok(q.result as T); q.onerror = () => erro(q.error) })
}
const chaveDe = (tipo: TipoRascunho, id: string) => `${tipo}:${id}`

// ── o documento aberto de cada tipo, e se tem alteração não salva ─────────────────────────────────────────────
function abertoDe(tipo: TipoRascunho): { doc: Doc; alterado: boolean } | null {
  if (tipo === 'tema') {
    const s = useMaeTema.getState(); if (!s.hist) return null
    return { doc: s.hist.atual, alterado: alteradoDesde(s.hist as never, s.marca) }
  }
  const m = useMaeDoc.getState()
  const h = m.contexto === 'base' ? m.hist : m.guardados.base?.hist, marca = m.contexto === 'base' ? m.marca : m.guardados.base?.marca ?? null
  if (!h) return null
  return { doc: h.atual, alterado: alteradoDesde(h as never, marca) }
}

// ── o motor ───────────────────────────────────────────────────────────────────────────────────────────────────
const TIPOS: TipoRascunho[] = ['tema', 'base']
const gravadoLocal = new Map<TipoRascunho, Doc>()      // último doc gravado neste computador
const enviadoNuvem = new Map<TipoRascunho, Doc>()      // último doc enviado ao servidor
const editadoEm = new Map<TipoRascunho, number>()
let timerLocal: ReturnType<typeof setTimeout> | null = null
const LIMITE_KEEPALIVE = 60_000                        // o navegador só garante keepalive até ~64 KB

async function gravarLocal(): Promise<void> {
  if (timerLocal) { clearTimeout(timerLocal); timerLocal = null }
  for (const tipo of TIPOS) {
    const a = abertoDe(tipo)
    if (!a?.alterado || gravadoLocal.get(tipo) === a.doc) continue
    const d = a.doc as { id: string; name?: string; version: number }
    const em = editadoEm.get(tipo) ?? Date.now()
    const r: Omit<Rascunho, 'onde'> = { chave: chaveDe(tipo, d.id), tipo, id: d.id, nome: d.name ?? d.id, versao: d.version, doc: a.doc, editadoEm: em }
    try { await idb('readwrite', s => s.put(JSON.parse(JSON.stringify(r)))); gravadoLocal.set(tipo, a.doc) } catch (e) { console.error('[MAE] rascunho local', e) }
  }
}

/**
 * Envia ao servidor o que mudou desde o último envio.
 *   'normal'     → fetch comum, mostra "Salvando…" no topo;
 *   'escondendo' → trocou de aba: a página continua viva — fetch comum (a base de 200 KB vai inteira);
 *   'fechando'   → fechar/recarregar: fetch keepalive (sobrevive à página), que o navegador limita a ~64 KB —
 *                  o que passar disso fica no rascunho deste computador (gravado no mesmo instante).
 */
export async function enviarNuvem(modo: 'normal' | 'escondendo' | 'fechando' = 'normal'): Promise<void> {
  const fechando = modo === 'fechando'
  const pend = TIPOS.map(tipo => ({ tipo, a: abertoDe(tipo) })).filter(x => x.a?.alterado && enviadoNuvem.get(x.tipo) !== x.a.doc)
  if (!pend.length) return
  if (!fechando) useSalvamento.setState({ estado: 'salvando' })
  let falhou = false, recusado: string | null = null
  for (const { tipo, a } of pend) {
    const corpo = JSON.stringify({ tipo, doc: a!.doc, editadoEm: editadoEm.get(tipo) ?? Date.now() })
    if (fechando && corpo.length > LIMITE_KEEPALIVE) continue      // grande demais para o "fechar": fica o local
    try {
      const r = await fetch('/api/mae/rascunhos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corpo, keepalive: fechando || (modo === 'escondendo' && corpo.length <= LIMITE_KEEPALIVE) })
      // Lote 16 (item 203): o servidor RESPONDEU e recusou (4xx) → mostra o motivo; o MESMO doc não é reenviado a
      // cada 30 s (só quando mudar ou em "Tentar de novo"). 408/429 = passageiro → como falta de conexão.
      if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
        const j = await r.json().catch(() => null) as { error?: string; detalhes?: unknown } | null
        recusado = r.status === 401 ? 'sua sessão expirou — entre de novo no SOA'
          : j?.detalhes ? explicarRecusa(j.detalhes) : (j?.error ?? `código ${r.status}`)
        enviadoNuvem.set(tipo, a!.doc)
        continue
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      enviadoNuvem.set(tipo, a!.doc)
    } catch { falhou = true }
  }
  if (recusado) { useSalvamento.setState({ estado: 'recusado', motivo: recusado, em: Date.now() }); return }
  if (!fechando) useSalvamento.setState(falhou ? { estado: 'offline', em: Date.now(), motivo: null } : { estado: 'salvo', em: Date.now(), pendente: false, motivo: null })
  else if (!falhou) useSalvamento.setState({ estado: 'salvo', em: Date.now(), motivo: null })
}

/** Lote 16 (item 203): "Tentar de novo" do aviso de recusa — reenvia mesmo o doc que já foi recusado. */
export function reenviarRascunho(): void { enviadoNuvem.clear(); void enviarNuvem() }

/** Grava e ESPERA terminar (antes de recarregar a página por versão nova — Lote 10, item 161). */
export async function gravarJa(): Promise<void> {
  await gravarLocal()
  await enviarNuvem('escondendo')
}

/** Grava JÁ (erro numa ferramenta, trocar de aba, fechar a página). */
export function gravarAgora(modo: 'normal' | 'escondendo' | 'fechando' = 'normal'): void {
  void gravarLocal()
  void enviarNuvem(modo)
}

/** Apaga o rascunho (a usuária salvou de verdade, ou escolheu "Não salvar"/"Descartar"). */
export async function descartarRascunho(tipo: TipoRascunho, id: string, nuvem = true): Promise<void> {
  try { await idb('readwrite', s => s.delete(chaveDe(tipo, id))) } catch { /* sem IndexedDB */ }
  if (nuvem) await fetch(`/api/mae/rascunhos?tipo=${tipo}&id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)
  const a = abertoDe(tipo)
  if (a && (a.doc as { id: string }).id === id) { gravadoLocal.delete(tipo); enviadoNuvem.delete(tipo) }
}
/** Chamado depois de um Salvar de verdade. */
export function salvoDeVerdade(tipo: TipoRascunho, id: string): void {
  void descartarRascunho(tipo, id)
  useSalvamento.setState({ estado: 'salvo', em: Date.now(), pendente: false, motivo: null })
}

/** Liga o rascunho automático (uma vez, no editor). Devolve o desligar. */
export function iniciarRascunhoAutomatico(): () => void {
  let ultimo: Partial<Record<TipoRascunho, Doc>> = {}
  const mudou = () => {
    let algum = false
    for (const tipo of TIPOS) {
      const a = abertoDe(tipo)
      if (!a || ultimo[tipo] === a.doc) continue
      ultimo = { ...ultimo, [tipo]: a.doc }
      if (a.alterado) { editadoEm.set(tipo, Date.now()); algum = true }
    }
    if (!algum) return
    useSalvamento.setState({ pendente: true })
    if (timerLocal) clearTimeout(timerLocal)
    timerLocal = setTimeout(() => { void gravarLocal() }, 2000)
  }
  const d1 = useMaeTema.subscribe(mudou), d2 = useMaeDoc.subscribe(mudou)
  const intervalo = setInterval(() => { void enviarNuvem() }, 30_000)
  const escondeu = () => { if (document.visibilityState === 'hidden') gravarAgora('escondendo') }
  const fechando = () => gravarAgora('fechando')
  const erro = () => gravarAgora()
  document.addEventListener('visibilitychange', escondeu)
  window.addEventListener('pagehide', fechando)
  window.addEventListener('beforeunload', fechando)
  window.addEventListener('error', erro)
  window.addEventListener('unhandledrejection', erro)
  return () => {
    d1(); d2(); clearInterval(intervalo)
    document.removeEventListener('visibilitychange', escondeu)
    window.removeEventListener('pagehide', fechando); window.removeEventListener('beforeunload', fechando)
    window.removeEventListener('error', erro); window.removeEventListener('unhandledrejection', erro)
  }
}

// ── recuperar ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Todos os rascunhos (deste computador e do servidor), o mais novo de cada documento. */
export async function listarRascunhos(): Promise<Rascunho[]> {
  const out = new Map<string, Rascunho>()
  try { for (const r of await idb<Omit<Rascunho, 'onde'>[]>('readonly', s => s.getAll())) out.set(r.chave, { ...r, onde: 'local' }) } catch { /* sem IndexedDB */ }
  try {
    const r = await fetch('/api/mae/rascunhos')
    if (r.ok) {
      const { rascunhos } = await r.json() as { rascunhos: { tipo: TipoRascunho; id: string; nome: string; versao: number; editadoEm: string }[] }
      for (const x of rascunhos) {
        const chave = chaveDe(x.tipo, x.id), em = new Date(x.editadoEm).getTime()
        if ((out.get(chave)?.editadoEm ?? 0) >= em) continue
        const d = await fetch(`/api/mae/rascunhos?tipo=${x.tipo}&id=${encodeURIComponent(x.id)}`).then(q => (q.ok ? q.json() : null)).catch(() => null) as { doc: Doc } | null
        if (d?.doc) out.set(chave, { chave, tipo: x.tipo, id: x.id, nome: x.nome, versao: x.versao, doc: d.doc, editadoEm: em, onde: 'nuvem' })
      }
    }
  } catch { /* offline: fica o deste computador */ }
  return [...out.values()].sort((a, b) => b.editadoEm - a.editadoEm)
}

/** Marca de "não salvo" (fora do histórico): o documento recuperado fica com alteração pendente até Salvar. */
export const NAO_SALVO = { label: 'Trabalho recuperado', patches: [], inversos: [] }
