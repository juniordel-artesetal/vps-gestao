// Helpers de imagem do Pessoal (server): valida data URL base64 e serve os bytes.
// As imagens ficam base64 em coluna text (mesmo storage do app); o acesso é gated
// por sessão+userId nas rotas GET, então ninguém abre o comprovante de outra pessoa.
import { NextResponse } from 'next/server'

const RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/
const MAX_BYTES = 2_500_000 // ~2,5MB de base64 (guarda contra payloads absurdos)

/** Normaliza a entrada do body: aceita null/''/data-url. Retorna undefined se o campo não veio,
 *  null para "remover", ou a data URL validada. Lança se for imagem inválida/gigante. */
export function normalizarImagemEntrada(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const s = String(v)
  if (!RE.test(s)) throw new Error('Imagem inválida (esperado data:image;base64)')
  if (s.length > MAX_BYTES) throw new Error('Imagem muito grande')
  return s
}

/** Converte uma data URL em NextResponse com os bytes (Cache-Control private). */
export function serveImagem(dataUrl: string | null | undefined): NextResponse {
  const m = dataUrl ? String(dataUrl).match(RE) : null
  if (!m) return NextResponse.json({ error: 'Sem imagem' }, { status: 404 })
  const bytes = new Uint8Array(Buffer.from(m[2], 'base64'))
  return new NextResponse(bytes, {
    status: 200,
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=3600', 'Content-Length': String(bytes.length) },
  })
}
