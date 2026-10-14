// Lote 13 (item 181): BUSCA RÁPIDA DE TEMA (estilo Ctrl+P) — puro. Acha por qualquer pedaço do nome, sem acento,
// maiúscula, "_" ou "-" ("masha sem" acha "MASHA E O URSO_SEM NOME_KIT FESTA"); campo vazio = os recentes.

/** "MASHA E O URSO_SEM NOME" → "masha e o urso sem nome". */
export const normalizarBusca = (s: string) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-.()[\]/\\]+/g, ' ').replace(/\s+/g, ' ').trim()

export interface ItemBusca { id: string; name: string; baseId?: string | null; arquivado?: boolean }

/**
 * Resultado da busca (até `max`): cada palavra digitada tem que aparecer no nome. Ordem: começa com a busca, depois
 * os recentes, depois alfabética. Vazio = os `vazio` recentes (completa com a ordem alfabética). Arquivado nunca entra.
 */
export function buscarTemas<T extends ItemBusca>(lista: T[], q: string, o: { recentes?: string[]; baseId?: string | null; soDaBase?: boolean; max?: number; vazio?: number; prioridade?: string[] } = {}): T[] {
  const rec = o.recentes ?? []
  let l = lista.filter(t => !t.arquivado)
  if (o.soDaBase && o.baseId) l = l.filter(t => t.baseId === o.baseId)
  const termos = normalizarBusca(q).split(' ').filter(Boolean)
  const posRec = (id: string) => { const i = rec.indexOf(id); return i < 0 ? 999 : i }
  const posPri = (id: string) => (o.prioridade?.includes(id) ? 0 : 1)
  if (!termos.length) {
    const n = o.vazio ?? 5
    return [...l].sort((a, b) => posPri(a.id) - posPri(b.id) || posRec(a.id) - posRec(b.id) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, n)
  }
  const achados = l.map(t => ({ t, n: normalizarBusca(t.name) })).filter(x => termos.every(p => x.n.includes(p)))
  const comeca = (n: string) => (n.startsWith(termos[0]) || n.includes(` ${termos[0]}`) ? 0 : 1)
  return achados
    .sort((a, b) => posPri(a.t.id) - posPri(b.t.id) || comeca(a.n) - comeca(b.n) || posRec(a.t.id) - posRec(b.t.id) || a.t.name.localeCompare(b.t.name, 'pt-BR'))
    .slice(0, o.max ?? 8).map(x => x.t)
}

/** "editado há 2 h", "há 3 dias", "agora". */
export function editadoHa(em: string | number | Date | null | undefined, agora = Date.now()): string {
  if (!em) return ''
  const s = Math.max(0, (agora - new Date(em).getTime()) / 1000)
  if (!Number.isFinite(s)) return ''
  if (s < 90) return 'editado agora'
  if (s < 3600) return `editado há ${Math.round(s / 60)} min`
  if (s < 86_400) return `editado há ${Math.round(s / 3600)} h`
  const d = Math.round(s / 86_400)
  return `editado há ${d} dia${d === 1 ? '' : 's'}`
}

// recentes (os temas abertos por último) — a mesma lista do "Abrir tema"
export const CHAVE_RECENTES = 'mae:temas-recentes'
export const recentesTemas = (): string[] => { try { return JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? '[]') } catch { return [] } }
export const lembrarTemaRecente = (id: string) => { try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify([id, ...recentesTemas().filter(x => x !== id)].slice(0, 12))) } catch { /* sem storage */ } }
