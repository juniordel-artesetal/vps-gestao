// Helpers de imagem do Pessoal (server): valida data URL base64 e serve os bytes.
// As imagens ficam base64 em coluna text (mesmo storage do app); o acesso é gated
// por sessão+userId nas rotas GET, então ninguém abre o comprovante de outra pessoa.
import { NextResponse } from 'next/server'

// Entrada: exige data:image/*;base64 (uploads do navegador já vêm assim).
const RE_ENTRADA = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/
// Serviço: aceita QUALQUER mime declarado (o Telegram grava application/octet-stream);
// o content-type real é resolvido por sniff dos magic bytes.
const RE_SERVE = /^data:([^;]+);base64,([\s\S]+)$/
const MAX_BYTES = 2_500_000 // ~2,5MB de base64 (guarda contra payloads absurdos)

/** Normaliza a entrada do body: aceita null/''/data-url. Retorna undefined se o campo não veio,
 *  null para "remover", ou a data URL validada. Lança se for imagem inválida/gigante. */
export function normalizarImagemEntrada(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  const s = String(v)
  if (!RE_ENTRADA.test(s)) throw new Error('Imagem inválida (esperado data:image;base64)')
  if (s.length > MAX_BYTES) throw new Error('Imagem muito grande')
  return s
}

/** Detecta o content-type de imagem pelos magic bytes (independe do mime gravado). */
export function sniffMimeImagem(bytes: Uint8Array): string {
  const b = bytes
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return '' // desconhecido
}

/** Converte uma data URL em NextResponse com os bytes (Cache-Control private).
 *  Resolve o content-type por sniff (corrige comprovantes do Telegram gravados como octet-stream). */
export function serveImagem(dataUrl: string | null | undefined): NextResponse {
  const m = dataUrl ? String(dataUrl).match(RE_SERVE) : null
  if (!m) return NextResponse.json({ error: 'Sem imagem' }, { status: 404 })
  let buf: Buffer
  try { buf = Buffer.from(m[2], 'base64') } catch { return NextResponse.json({ error: 'Sem imagem' }, { status: 404 }) }
  if (!buf.length) return NextResponse.json({ error: 'Sem imagem' }, { status: 404 })
  const bytes = new Uint8Array(buf)
  const declarado = m[1]
  const mime = sniffMimeImagem(bytes) || (declarado.startsWith('image/') ? declarado : 'image/jpeg')
  return new NextResponse(bytes, {
    status: 200,
    headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600', 'Content-Length': String(bytes.length) },
  })
}
