// Handle de pasta FALSO em memória (File System Access API) para testar a Biblioteca MAE no Node.
// Implementa só o que o módulo usa: getDirectoryHandle, getFileHandle, values, createWritable, getFile.

class ArquivoFalso {
  readonly kind = 'file' as const
  conteudo: Blob = new Blob([])
  constructor(readonly name: string) {}
  async getFile(): Promise<File> { return new File([this.conteudo], this.name) }
  async createWritable() {
    const partes: BlobPart[] = []
    return {
      write: async (c: Blob | string) => { partes.push(c) },
      close: async () => { this.conteudo = new Blob(partes) },
    }
  }
}

export class PastaFalsa {
  readonly kind = 'directory' as const
  readonly filhos = new Map<string, PastaFalsa | ArquivoFalso>()
  constructor(readonly name = 'Biblioteca MAE') {}

  async getDirectoryHandle(nome: string, o: { create?: boolean } = {}): Promise<PastaFalsa> {
    const x = this.filhos.get(nome)
    if (x instanceof PastaFalsa) return x
    if (x) throw Object.assign(new Error(`${nome} é arquivo`), { name: 'TypeMismatchError' })
    if (!o.create) throw Object.assign(new Error(`${nome} não existe`), { name: 'NotFoundError' })
    const p = new PastaFalsa(nome); this.filhos.set(nome, p); return p
  }
  async getFileHandle(nome: string, o: { create?: boolean } = {}): Promise<ArquivoFalso> {
    const x = this.filhos.get(nome)
    if (x instanceof ArquivoFalso) return x
    if (x) throw Object.assign(new Error(`${nome} é pasta`), { name: 'TypeMismatchError' })
    if (!o.create) throw Object.assign(new Error(`${nome} não existe`), { name: 'NotFoundError' })
    const a = new ArquivoFalso(nome); this.filhos.set(nome, a); return a
  }
  async *values() { yield* this.filhos.values() }
}

/** O falso no tipo que o módulo espera. */
export const comoHandle = (p: PastaFalsa) => p as unknown as FileSystemDirectoryHandle
