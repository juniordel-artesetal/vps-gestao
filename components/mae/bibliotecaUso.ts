'use client'
// Lote 18 (item 228): APAGAR DA BIBLIOTECA SEM ESTRAGAR TEMA — antes de apagar um papel/elemento, mostra "usado em N
// temas"; o arquivo em uso sai da lista mas fica GUARDADO em .guardados/<sha> (os temas continuam achando pelo sha);
// o que nenhum tema usa vai para Lixeira/Arquivos.
import { gravar, ler, remover, sha256, caminhoGuardado } from '@/lib/mae/biblioteca/arquivos'
import { listarTemas } from './arquivosMae'

/** Os temas que usam cada arquivo da Biblioteca (pelo caminho). */
export async function usoDosArquivos(raiz: FileSystemDirectoryHandle): Promise<Map<string, string[]>> {
  const uso = new Map<string, string[]>()
  for (const t of await listarTemas(raiz).catch(() => [])) {
    const json = JSON.stringify(t.doc)
    for (const m of json.matchAll(/"path":"([^"]+)"/g)) {
      const p = m[1]
      const l = uso.get(p) ?? []
      const nome = t.doc.name ?? t.doc.id
      if (!l.includes(nome)) uso.set(p, [...l, nome])
    }
  }
  return uso
}

/** Apaga da lista: em uso → .guardados/<sha>; sem uso → Lixeira/Arquivos/. */
export async function apagarArquivo(raiz: FileSystemDirectoryHandle, path: string, emUso: boolean): Promise<'guardado' | 'lixeira'> {
  const f = await ler(raiz, path)
  if (emUso) await gravar(raiz, caminhoGuardado(await sha256(f), path), f)
  else await gravar(raiz, `Lixeira/Arquivos/${path.replace(/\//g, '__')}`, f)
  await remover(raiz, path)
  return emUso ? 'guardado' : 'lixeira'
}

