'use client'
// Lote 9 (itens 135/136): a FOTO de uma camada para o arraste na arte — a imagem do elemento/papel numa versão
// reduzida (proxy), lida da Biblioteca uma vez e guardada. Durante o arraste a camada sai das pranchetas e a foto
// segue o mouse (60 quadros por segundo, sem redesenhar nada); efeitos, recorte e avisos voltam ao soltar.
import { useEffect, useState } from 'react'
import { ler } from '@/lib/mae/biblioteca/arquivos'
import { useBiblioteca } from '@/lib/mae/editor/loja'

const LARGURA_FOTO = 640
const fotos = new Map<string, Promise<ImageBitmap | null>>()

/** A foto (proxy) do arquivo da camada; `null` se não deu para ler. Guardada pelo sha256. */
export function fotoDoArquivo(raiz: FileSystemDirectoryHandle | null, caminho: string, sha256: string): Promise<ImageBitmap | null> {
  let p = fotos.get(sha256)
  if (!p) {
    p = (async () => {
      if (!raiz) return null
      try {
        const f = await ler(raiz, caminho)
        return await createImageBitmap(f, { resizeWidth: LARGURA_FOTO, resizeQuality: 'medium' })
      } catch { return null }
    })()
    fotos.set(sha256, p)
    void p.then(b => { if (!b) fotos.delete(sha256) })
  }
  return p
}

/** A foto da camada selecionada (carrega ao selecionar, para já estar pronta quando o arraste começar). */
export function useFotoCamada(src: { path?: string; sha256?: string } | null): ImageBitmap | null {
  const raiz = useBiblioteca(s => s.raiz)
  const [foto, setFoto] = useState<{ sha: string; b: ImageBitmap } | null>(null)
  const sha = src?.sha256, caminho = src?.path
  useEffect(() => {
    if (!sha || !caminho) return
    let vivo = true
    void fotoDoArquivo(raiz, caminho, sha).then(b => { if (vivo && b) setFoto({ sha, b }) })
    return () => { vivo = false }
  }, [raiz, caminho, sha])
  return foto && foto.sha === sha ? foto.b : null
}
