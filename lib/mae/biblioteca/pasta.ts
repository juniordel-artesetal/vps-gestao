// Biblioteca MAE — escolher a pasta, lembrar dela entre sessões e reconfirmar a permissão.
// O handle da pasta fica no IndexedDB do navegador (o Chrome/Edge permite guardar o handle);
// a cada sessão a permissão é reconfirmada com UM clique (requestPermission exige gesto da usuária).
import { criarEstrutura } from './estrutura'

const DB = 'mae-biblioteca', LOJA = 'handles', CHAVE = 'raiz'

function abrirDb(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => erro(r.error)
  })
}
async function idb<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrirDb()
  try {
    return await new Promise<T>((ok, erro) => {
      const req = fn(db.transaction(LOJA, modo).objectStore(LOJA))
      req.onsuccess = () => ok(req.result as T)
      req.onerror = () => erro(req.error)
    })
  } finally { db.close() }
}

export type Permissao = 'granted' | 'prompt' | 'denied'

/** Abre o seletor de pasta, guarda o handle e cria a estrutura da Biblioteca. */
export async function escolherPasta(): Promise<FileSystemDirectoryHandle> {
  const raiz = await window.showDirectoryPicker({ id: 'biblioteca-mae', mode: 'readwrite', startIn: 'documents' })
  // Sem IndexedDB (aba anônima, armazenamento bloqueado) a pasta vale só nesta sessão — não é erro.
  try { await idb('readwrite', s => s.put(raiz, CHAVE)) } catch (e) { console.warn('[MAE] pasta não lembrada entre sessões:', (e as Error)?.message) }
  await criarEstrutura(raiz)
  return raiz
}

/** A pasta escolhida antes (ou null). Não pede permissão — só devolve o handle guardado. */
export async function pastaSalva(): Promise<FileSystemDirectoryHandle | null> {
  try { return (await idb<FileSystemDirectoryHandle | undefined>('readonly', s => s.get(CHAVE))) ?? null } catch { return null }
}

export async function permissao(raiz: FileSystemDirectoryHandle): Promise<Permissao> {
  return raiz.queryPermission({ mode: 'readwrite' })
}

/** Reconfirma o acesso (tem de ser chamado num clique). Garante a estrutura se ficou liberado. */
export async function reconectar(raiz: FileSystemDirectoryHandle): Promise<Permissao> {
  const p = await raiz.requestPermission({ mode: 'readwrite' })
  if (p === 'granted') await criarEstrutura(raiz)
  return p
}

/** Esquece a pasta (a usuária quer escolher outra). Não apaga nada do disco. */
export async function esquecerPasta(): Promise<void> {
  await idb('readwrite', s => s.delete(CHAVE))
}
