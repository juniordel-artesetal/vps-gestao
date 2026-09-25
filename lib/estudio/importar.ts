// SOA Edition — IMPORTAÇÃO RÁPIDA de imagem para o editor (só navegador).
//
// Antes: subia o arquivo inteiro (até dezenas de MB) ANTES de mostrar, e o Fabric abria a imagem
// em resolução nativa → lento. Agora:
//   1. decodifica fora da thread principal (createImageBitmap) e gera um PROXY ≤ 2000 px → a camada
//      aparece na hora;
//   2. em segundo plano: sobe o proxy (leve, para abrir rápido depois) e o original em alta (cópia
//      comprimida a ~300 dpi se passar do teto do Blob) — a exportação usa o original.
import { criarProxy } from './camadas'
import { carregarMolde, prepararMolde, enviarArquivo, enviarSoBlob, ehPdf, MAX_BYTES_BLOB } from './cliente'

export interface Importada {
  proxy: HTMLCanvasElement
  largura: number
  altura: number
  /** URL local do original (object URL) — vale até o envio terminar. */
  urlLocal: string
  /** Sobe proxy + original e registra na biblioteca. */
  enviar: (workspaceId: string, extras?: { pasta?: string; tipo?: 'imagem' | 'molde' }) => Promise<{ id: string; url: string; proxyUrl: string }>
}

const semExt = (n: string) => n.replace(/\.[^.]+$/, '')
const blobDe = (c: HTMLCanvasElement, tipo: string, q?: number) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Falha ao gerar a imagem'))), tipo, q))

export async function importarImagem(f: File): Promise<Importada> {
  let original: Blob = f
  let proxy: HTMLCanvasElement, largura: number, altura: number
  if (ehPdf(f.type, f.name)) {
    // PDF precisa ser rasterizado (≈300 dpi) — é o único caso que não abre instantâneo.
    const m = await carregarMolde(f)
    const p = await criarProxy(m.fonte instanceof HTMLCanvasElement ? m.fonte : m.fonte)
    proxy = p.proxy; largura = m.largura; altura = m.altura
    const prep = await prepararMolde(f)
    original = prep.copia
  } else {
    const p = await criarProxy(f)
    proxy = p.proxy; largura = p.largura; altura = p.altura
  }
  const urlLocal = URL.createObjectURL(original)

  async function enviar(workspaceId: string, extras: { pasta?: string; tipo?: 'imagem' | 'molde' } = {}) {
    const tipo = extras.tipo || 'imagem'
    const proxyBlob = await blobDe(proxy, 'image/webp', 0.86).catch(() => blobDe(proxy, 'image/png'))
    const proxyUrl = await enviarSoBlob(proxyBlob, `proxy-${semExt(f.name)}.webp`, tipo, workspaceId)
    let copia = original, nome = f.name
    const muitoGrande = original.size > MAX_BYTES_BLOB || largura * altura > 16_000_000
    if (muitoGrande && !ehPdf(f.type, f.name)) { const prep = await prepararMolde(f); copia = prep.copia; nome = prep.nomeCopia }
    const up = await enviarArquivo(copia, nome, tipo, workspaceId, { pasta: extras.pasta || 'Imagens', meta: { largura, altura, proxyUrl } })
    return { id: up.id, url: up.url, proxyUrl }
  }
  return { proxy, largura, altura, urlLocal, enviar }
}
