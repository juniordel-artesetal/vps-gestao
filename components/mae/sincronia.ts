'use client'
// Sincronização das RECEITAS com o Neon (decisão do Júnior, Sprint 7): base, tema, identidade e presets
// vão para /api/mae/* da conta (workspace). Só JSON — nenhuma arte, imagem ou fonte sai do computador.
// Offline / sem login: tudo continua funcionando na Biblioteca; o painel mostra "não sincronizado".
import { create } from 'zustand'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import type { Preset } from '@/lib/mae/efeitos/presets'
import type { Identidade } from './arquivosMae'

export interface EstadoSync { estado: 'ok' | 'enviando' | 'erro' | 'nunca'; mensagem: string | null; em: number | null }
export const useSync = create<EstadoSync>()(() => ({ estado: 'nunca', mensagem: null, em: null }))

async function chamar<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || `HTTP ${r.status}`)
  return r.json() as Promise<T>
}
async function enviar(url: string, corpo: unknown, rotulo: string): Promise<boolean> {
  useSync.setState({ estado: 'enviando', mensagem: rotulo })
  try {
    await chamar(url, { method: 'PUT', body: JSON.stringify(corpo) })
    useSync.setState({ estado: 'ok', mensagem: `${rotulo} sincronizado`, em: Date.now() })
    return true
  } catch (e) {
    useSync.setState({ estado: 'erro', mensagem: `${rotulo}: não sincronizado (${(e as Error).message}) — está salvo na Biblioteca`, em: Date.now() })
    return false
  }
}

export const sync = {
  salvarBase: (doc: DocTrabalho) => enviar('/api/mae/bases', { doc }, `Base "${doc.name}" v${doc.version}`),
  salvarTema: (doc: DocTema) => enviar('/api/mae/temas', { doc }, `Tema "${doc.name}" v${doc.version}`),
  salvarIdentidade: (i: Identidade) => enviar('/api/mae/identidade', i, 'Identidade'),
  listarBases: () => chamar<{ bases: { id: string; version: number; nome: string }[] }>('/api/mae/bases').then(r => r.bases).catch(() => []),
  listarTemas: () => chamar<{ temas: { id: string; version: number; nome: string; base_id: string }[] }>('/api/mae/temas').then(r => r.temas).catch(() => []),
  abrirBase: (id: string, v?: number) => chamar<{ doc: DocTrabalho }>(`/api/mae/bases/${encodeURIComponent(id)}${v ? `?v=${v}` : ''}`).then(r => r.doc),
  abrirTema: (id: string) => chamar<{ doc: DocTema }>(`/api/mae/temas/${encodeURIComponent(id)}`).then(r => r.doc),
  lerIdentidade: () => chamar<{ identidade: Identidade | null }>('/api/mae/identidade').then(r => r.identidade).catch(() => null),
  presets: {
    listar: () => chamar<{ meus: Preset[]; naty: Preset[] }>('/api/mae/presets'),
    salvar: (p: Preset) => enviar('/api/mae/presets', { preset: p }, `Preset "${p.name}"`),
    excluir: (id: string) => chamar(`/api/mae/presets?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
}
