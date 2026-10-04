// Biblioteca MAE — ler e gravar arquivos na pasta LOCAL da usuária (File System Access API).
// Nada vai ao servidor. Toda função recebe o handle da raiz, então nos testes entra um handle falso.

/** Caminho relativo → segmentos seguros. Recusa absoluto, "..", "." e nomes inválidos no Windows. */
export function normalizarCaminho(caminho: string): string[] {
  const c = String(caminho ?? '').replace(/\\/g, '/').trim()
  if (!c) throw new Error('Caminho vazio')
  if (/^([a-zA-Z]:|\/)/.test(c)) throw new Error(`Caminho absoluto não é permitido: ${c}`)
  const partes = c.split('/').filter(s => s !== '')
  for (const s of partes) {
    if (s === '.' || s === '..') throw new Error(`Caminho não pode sair da Biblioteca: ${c}`)
    if (/[<>:"|?*\u0000-\u001f]/.test(s)) throw new Error(`Nome com caractere inválido: ${s}`)
    if (/[. ]$/.test(s)) throw new Error(`Nome não pode terminar com ponto ou espaço: ${s}`)
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(s)) throw new Error(`Nome reservado do Windows: ${s}`)
  }
  if (!partes.length) throw new Error('Caminho vazio')
  return partes
}

async function pastaDe(raiz: FileSystemDirectoryHandle, segmentos: string[], criar: boolean): Promise<FileSystemDirectoryHandle> {
  let d = raiz
  for (const s of segmentos) d = await d.getDirectoryHandle(s, { create: criar })
  return d
}

/** Grava (cria ou substitui) um arquivo; cria as pastas do caminho se faltarem. */
export async function gravar(raiz: FileSystemDirectoryHandle, caminho: string, conteudo: Blob | string): Promise<void> {
  const partes = normalizarCaminho(caminho)
  const pasta = await pastaDe(raiz, partes.slice(0, -1), true)
  const arq = await pasta.getFileHandle(partes[partes.length - 1], { create: true })
  const w = await arq.createWritable()
  try { await w.write(conteudo) } finally { await w.close() }
}

/** Lê um arquivo da Biblioteca (erro "NotFoundError" se não existir). */
export async function ler(raiz: FileSystemDirectoryHandle, caminho: string): Promise<File> {
  const partes = normalizarCaminho(caminho)
  const pasta = await pastaDe(raiz, partes.slice(0, -1), false)
  return (await pasta.getFileHandle(partes[partes.length - 1])).getFile()
}

export interface Entrada { nome: string; tipo: 'arquivo' | 'pasta' }

/** Lista o conteúdo de uma pasta da Biblioteca ("" = raiz), em ordem alfabética (pt-BR). */
export async function listar(raiz: FileSystemDirectoryHandle, caminho = ''): Promise<Entrada[]> {
  const pasta = caminho ? await pastaDe(raiz, normalizarCaminho(caminho), false) : raiz
  const out: Entrada[] = []
  for await (const h of pasta.values()) out.push({ nome: h.name, tipo: h.kind === 'directory' ? 'pasta' : 'arquivo' })
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/** SHA-256 em hex (a receita guarda o hash para achar o arquivo se for movido ou renomeado). */
export async function sha256(conteudo: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  const buf = conteudo instanceof Blob ? await conteudo.arrayBuffer() : conteudo
  const dig = await crypto.subtle.digest('SHA-256', buf as BufferSource)
  return Array.from(new Uint8Array(dig), b => b.toString(16).padStart(2, '0')).join('')
}
