'use client'
// Sincronização das RECEITAS com o Neon (decisão do Júnior, Sprint 7): base, tema, identidade e presets
// vão para /api/mae/* da conta (workspace). Só JSON — nenhuma arte, imagem ou fonte sai do computador.
// Offline / sem login: tudo continua funcionando na Biblioteca; o painel mostra "não sincronizado".
import { create } from 'zustand'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Preset } from '@/lib/mae/efeitos/presets'
import type { Identidade } from './arquivosMae'

/** Marca de registro (Sprint 9): o PDF fica na Biblioteca; a nuvem guarda só a receita. */
export interface MarcaRegistro { id: string; nome: string; path: string; sha256: string; wMm: number; hMm: number; pagina: number; zonas: { x: number; y: number; w: number; h: number }[] }

/** Um envio que ainda não chegou ao servidor (Lote 10, item 150). */
export interface Pendente { chave: string; url: string; corpo: string; rotulo: string; tentativas: number; motivo: string | null; status: number | null; em: number }
export interface EstadoSync {
  estado: 'ok' | 'enviando' | 'erro' | 'nunca'
  mensagem: string | null
  em: number | null
  /** Lote 10 (item 150): o que ainda não subiu, com o motivo em português (o topo mostra + "Tentar de novo"). */
  pendentes: { rotulo: string; motivo: string | null }[]
}
export const useSync = create<EstadoSync>()(() => ({ estado: 'nunca', mensagem: null, em: null, pendentes: [] }))

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || `HTTP ${r.status}`)
  return r.json() as Promise<T>
}
// ── Lote 10 (item 150): FILA de envio — o que falha fica guardado (IndexedDB) e é tentado de novo sozinho ─────────
// (5 s, 30 s, 2 min e depois a cada 2 min; também ao voltar a conexão ou a aba). O topo mostra o que não subiu e o
// motivo, com "Tentar de novo". Antes, uma falha deixava "☁ não sincronizado" preso, sem motivo nem nova tentativa.
const fila = new Map<string, Pendente>()
let timer: ReturnType<typeof setTimeout> | null = null
let rodando = false
const ESPERAS = [5_000, 30_000, 120_000]

/** O motivo da falha, em português, pelo status do servidor (ou falta de conexão). */
export function motivoDaFalha(status: number | null, erroServidor?: string | null): string {
  if (status === null) return 'sem conexão com o servidor'
  if (status === 401) return 'sua sessão expirou — entre de novo no SOA (o trabalho está salvo neste computador)'
  if (status === 403) return erroServidor || 'o Método MAE não está liberado nesta conta'
  if (status === 413) return 'o arquivo ficou grande demais para enviar'
  if (status === 400) return `o servidor recusou${erroServidor ? `: ${erroServidor}` : ''}`
  if (status === 429) return 'muitos envios seguidos — tentando de novo em instantes'
  return `o servidor falhou (código ${status})`
}
const atualizarEstado = () => {
  const p = [...fila.values()]
  const pendentes = p.map(x => ({ rotulo: x.rotulo, motivo: x.motivo }))
  useSync.setState(p.some(x => x.motivo)
    ? { estado: 'erro', mensagem: p.map(x => `${x.rotulo}: ${x.motivo}`).join(' · '), pendentes, em: Date.now() }
    : { pendentes })
}
async function persistir(p: Pendente | null, chave: string) {
  try {
    const { idb } = await import('./rascunhos')
    if (p) await idb('readwrite', s => s.put(p), 'fila'); else await idb('readwrite', s => s.delete(chave), 'fila')
  } catch { /* sem IndexedDB: fica só na memória */ }
}
async function tentarUm(p: Pendente): Promise<boolean> {
  let status: number | null = null, erroServidor: string | null = null
  try {
    const r = await fetch(p.url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: p.corpo })
    if (r.ok) {
      fila.delete(p.chave); void persistir(null, p.chave)
      useSync.setState({ estado: 'ok', mensagem: `${p.rotulo} sincronizado`, em: Date.now() })
      return true
    }
    status = r.status
    erroServidor = (await r.json().catch(() => null))?.error ?? null
  } catch { /* rede */ }
  p.tentativas++; p.status = status; p.motivo = motivoDaFalha(status, erroServidor)
  console.warn('[MAE] não sincronizou', p.rotulo, status, erroServidor)
  void persistir(p, p.chave)
  return false
}
async function processar() {
  if (rodando) return
  rodando = true
  if (timer) { clearTimeout(timer); timer = null }
  try {
    for (const p of [...fila.values()]) {
      useSync.setState({ estado: 'enviando', mensagem: p.rotulo })
      await tentarUm(p)
    }
  } finally {
    rodando = false
    atualizarEstado()
    if (fila.size) {
      const t = Math.min(...[...fila.values()].map(p => ESPERAS[Math.min(Math.max(p.tentativas, 1) - 1, ESPERAS.length - 1)]))
      timer = setTimeout(() => { void processar() }, t)
    }
  }
}
/** "Tentar de novo" (botão do topo) — e ao voltar a conexão/aba. */
export function tentarDeNovo() { void processar() }

/** Coloca o envio na fila (o mais novo do mesmo item substitui o antigo) e tenta já. */
async function enviar(url: string, corpo: unknown, rotulo: string, chave = `${url}|${rotulo}`): Promise<boolean> {
  const p: Pendente = { chave, url, corpo: JSON.stringify(corpo), rotulo, tentativas: 0, motivo: null, status: null, em: Date.now() }
  fila.set(chave, p)
  void persistir(p, chave)
  await processar()
  return !fila.has(chave)
}

let iniciada = false
/** Liga a fila (uma vez, no editor): retoma o que ficou pendente de outra vez e escuta conexão/aba. */
export function iniciarFilaDeEnvio(): () => void {
  if (!iniciada) {
    iniciada = true
    void import('./rascunhos').then(({ idb }) => idb<Pendente[]>('readonly', s => s.getAll(), 'fila')).then(ps => {
      for (const p of ps ?? []) if (!fila.has(p.chave)) fila.set(p.chave, p)
      if (fila.size) void processar()
    }).catch(() => null)
  }
  const voltou = () => { if (fila.size && document.visibilityState !== 'hidden') void processar() }
  window.addEventListener('online', voltou); document.addEventListener('visibilitychange', voltou)
  return () => { window.removeEventListener('online', voltou); document.removeEventListener('visibilitychange', voltou) }
}

export const sync = {
  salvarBase: (doc: DocTrabalho) => enviar('/api/mae/bases', { doc }, `Base "${doc.name}" v${doc.version}`, `base:${doc.id}:${doc.version}`),
  salvarTema: (doc: DocTema) => enviar('/api/mae/temas', { doc }, `Tema "${doc.name}" v${doc.version}`, `tema:${doc.id}:${doc.version}`),
  salvarIdentidade: (i: Identidade) => enviar('/api/mae/identidade', i, 'Identidade', 'identidade'),
  listarBases: () => chamar<{ bases: { id: string; version: number; nome: string }[] }>('/api/mae/bases').then(r => r.bases).catch(() => []),
  listarTemas: () => chamar<{ temas: { id: string; version: number; nome: string; base_id: string }[] }>('/api/mae/temas').then(r => r.temas).catch(() => []),
  /** Lote 3 (item 35): exclui a base na nuvem (todas as versões). 409 = usada por temas. */
  excluirBase: async (id: string): Promise<{ ok: boolean; erro?: string }> => {
    const r = await fetch(`/api/mae/bases/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null)
    if (!r) return { ok: false, erro: 'sem conexão' }
    if (r.ok || r.status === 404) return { ok: true }
    return { ok: false, erro: (await r.json().catch(() => null))?.error ?? `HTTP ${r.status}` }
  },
  abrirBase: (id: string, v?: number) => chamar<{ doc: DocTrabalho }>(`/api/mae/bases/${encodeURIComponent(id)}${v ? `?v=${v}` : ''}`).then(r => r.doc),
  abrirTema: (id: string, v?: number) => chamar<{ doc: DocTema }>(`/api/mae/temas/${encodeURIComponent(id)}${v ? `?v=${v}` : ''}`).then(r => r.doc),
  /** Proteção contra perda: as versões do tema salvas na nuvem (mais nova primeiro). */
  versoesTema: (id: string) => chamar<{ versoes: { versao: number; em: string }[] }>(`/api/mae/temas/${encodeURIComponent(id)}?versoes=1`).then(r => r.versoes),
  lerIdentidade: () => chamar<{ identidade: Identidade | null }>('/api/mae/identidade').then(r => r.identidade).catch(() => null),
  marcas: {
    listar: () => chamar<{ marcas: MarcaRegistro[] }>('/api/mae/marcas').then(r => r.marcas),
    salvar: (m: MarcaRegistro) => enviar('/api/mae/marcas', { marca: m }, `Marca "${m.nome}"`, `marca:${m.id}`),
    excluir: (id: string) => chamar(`/api/mae/marcas?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  presets: {
    listar: () => chamar<{ meus: Preset[]; naty: Preset[] }>('/api/mae/presets'),
    salvar: (p: Preset) => enviar('/api/mae/presets', { preset: p }, `Preset "${p.name}"`, `preset:${p.id}`),
    excluir: (id: string) => chamar(`/api/mae/presets?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
}
