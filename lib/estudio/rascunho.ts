// SOA Edition — RASCUNHO LOCAL (IndexedDB) do que a artesã está criando: se a rede cair, a aba fechar ou o
// navegador travar, o trabalho fica guardado neste aparelho e é oferecido de volta ao reabrir.
// Só JSON (camadas, campos, lista) — binário nunca: imagem vive no Blob e aqui só vai a referência.
// Tudo é tolerante a falha: sem IndexedDB (aba anônima, bloqueio) o editor segue normal, só sem a rede de segurança.

export interface Rascunho<T = unknown> {
  chave: string
  dados: T
  /** quando foi guardado aqui (ms) */
  em: number
  /** true = o servidor já tem esta versão (não precisa oferecer restauração) */
  sincronizado: boolean
}

const BANCO = 'soa-estudio', LOJA = 'rascunhos'
let aberto: Promise<IDBDatabase | null> | null = null

function abrir(): Promise<IDBDatabase | null> {
  if (aberto) return aberto
  aberto = new Promise(res => {
    try {
      if (typeof indexedDB === 'undefined') return res(null)
      const r = indexedDB.open(BANCO, 1)
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(LOJA)) r.result.createObjectStore(LOJA, { keyPath: 'chave' }) }
      r.onsuccess = () => res(r.result)
      r.onerror = () => res(null)
      r.onblocked = () => res(null)
    } catch { res(null) }
  })
  return aberto
}

async function operar<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await abrir()
  if (!db) return null
  return new Promise(res => {
    try {
      const req = f(db.transaction(LOJA, modo).objectStore(LOJA))
      req.onsuccess = () => res((req.result as T) ?? null)
      req.onerror = () => res(null)
    } catch { res(null) }
  })
}

/** Chave por login + tela + documento (outro login no mesmo aparelho não vê o rascunho). */
export const chaveRascunho = (userId: string | undefined, tipo: string, id: string) => `${userId || 'anon'}:${tipo}:${id}`

export async function guardarRascunho<T>(chave: string, dados: T, sincronizado = false): Promise<void> {
  await operar('readwrite', s => s.put({ chave, dados, em: Date.now(), sincronizado } satisfies Rascunho<T>))
}
export async function lerRascunho<T>(chave: string): Promise<Rascunho<T> | null> {
  return operar<Rascunho<T>>('readonly', s => s.get(chave))
}
/** Servidor confirmou: o rascunho continua (vale como cópia), mas não é mais "não salvo". */
export async function marcarSincronizado(chave: string, ate: number): Promise<void> {
  const r = await lerRascunho(chave)
  if (r && r.em <= ate && !r.sincronizado) await operar('readwrite', s => s.put({ ...r, sincronizado: true }))
}
export async function apagarRascunho(chave: string): Promise<void> {
  await operar('readwrite', s => s.delete(chave))
}

/** Espera com recuo exponencial para re-tentar salvar: 2 s, 4 s, 8 s… até 60 s. */
export const recuo = (tentativa: number) => Math.min(60_000, 2000 * 2 ** Math.max(0, tentativa))

/** Erro de rede (sem conexão / servidor inalcançável), diferente de erro de validação. */
export const ehErroDeRede = (e: unknown) => (typeof navigator !== 'undefined' && navigator.onLine === false) || e instanceof TypeError || (e as Error)?.name === 'AbortError'
