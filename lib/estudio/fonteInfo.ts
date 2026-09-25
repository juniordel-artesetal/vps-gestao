// SOA Edition — leitura do cabeçalho de FONTE (TTF, OTF, TTC, WOFF; WOFF2 só valida): sem dependência externa.
// Roda no Web Worker (fonte.worker.ts) e, se não houver worker, na própria página.

export interface InfoFonte {
  formato: 'ttf' | 'otf' | 'ttc' | 'woff' | 'woff2'
  /** família (nome tipográfico, ex.: "Montserrat") */
  familia: string | null
  /** estilo (ex.: "Bold Italic") */
  estilo: string | null
  /** nome completo (ex.: "Montserrat Bold Italic") */
  completo: string | null
  /** SHA-256 do arquivo (hex) — a mesma fonte instalada de novo é reconhecida */
  hash: string
}

const tag = (d: DataView, o: number) => String.fromCharCode(d.getUint8(o), d.getUint8(o + 1), d.getUint8(o + 2), d.getUint8(o + 3))

/** Tabela "name" → família/estilo/nome completo (prefere Windows Unicode inglês; cai no Mac Roman). */
function lerNomes(d: DataView, base: number): { familia: string | null; estilo: string | null; completo: string | null } {
  const count = d.getUint16(base + 2), strOff = base + d.getUint16(base + 4)
  const achados = new Map<number, { pri: number; txt: string }>()
  for (let i = 0; i < count; i++) {
    const r = base + 6 + i * 12
    if (r + 12 > d.byteLength) break
    const plat = d.getUint16(r), enc = d.getUint16(r + 2), lang = d.getUint16(r + 4), id = d.getUint16(r + 6), len = d.getUint16(r + 8), off = d.getUint16(r + 10)
    if (![1, 2, 4, 16, 17].includes(id)) continue
    const ini = strOff + off
    if (ini + len > d.byteLength) continue
    let txt = ''
    if (plat === 3 || plat === 0) { for (let j = 0; j + 1 < len; j += 2) txt += String.fromCharCode(d.getUint16(ini + j)) }
    else if (plat === 1 && enc === 0) { for (let j = 0; j < len; j++) txt += String.fromCharCode(d.getUint8(ini + j)) }
    else continue
    txt = txt.replace(/\0/g, '').trim()
    if (!txt) continue
    const pri = (plat === 3 ? 2 : plat === 0 ? 1 : 0) + (lang === 0x409 || lang === 0 ? 1 : 0)
    const ja = achados.get(id)
    if (!ja || pri > ja.pri) achados.set(id, { pri, txt })
  }
  return {
    familia: achados.get(16)?.txt || achados.get(1)?.txt || null,
    estilo: achados.get(17)?.txt || achados.get(2)?.txt || null,
    completo: achados.get(4)?.txt || null,
  }
}

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const buf = await new Response(new Blob([dados as BlobPart]).stream().pipeThrough(ds)).arrayBuffer()
  return new Uint8Array(buf)
}

export async function analisarFonteBuffer(buf: ArrayBuffer): Promise<InfoFonte> {
  if (buf.byteLength < 64) throw new Error('Arquivo vazio ou cortado — não é uma fonte.')
  const d = new DataView(buf)
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('')
  const mag = tag(d, 0)
  const vazio = { familia: null, estilo: null, completo: null }
  if (mag === 'wOF2') return { formato: 'woff2', ...vazio, hash }
  if (mag === 'wOFF') {
    const n = d.getUint16(12)
    for (let i = 0; i < n; i++) {
      const r = 44 + i * 20
      if (tag(d, r) !== 'name') continue
      const off = d.getUint32(r + 4), comp = d.getUint32(r + 8), orig = d.getUint32(r + 12)
      let t: Uint8Array = new Uint8Array(buf, off, comp)
      if (comp < orig) t = await inflar(t)
      return { formato: 'woff', ...lerNomes(new DataView(t.buffer, t.byteOffset, t.byteLength), 0), hash }
    }
    return { formato: 'woff', ...vazio, hash }
  }
  let base = 0, formato: InfoFonte['formato']
  if (mag === 'ttcf') { formato = 'ttc'; base = d.getUint32(12) }
  else if (mag === 'OTTO') formato = 'otf'
  else if (d.getUint32(0) === 0x00010000 || mag === 'true') formato = 'ttf'
  else throw new Error('Este arquivo não é uma fonte (.ttf, .otf, .woff). Confira se não é um .zip ou um arquivo renomeado.')
  const n = d.getUint16(base + 4)
  if (!n || n > 200) throw new Error('Fonte corrompida (tabela de conteúdo inválida).')
  for (let i = 0; i < n; i++) {
    const r = base + 12 + i * 16
    if (r + 16 > d.byteLength) break
    if (tag(d, r) === 'name') {
      const off = d.getUint32(r + 8)
      if (off + 6 > d.byteLength) break
      return { formato, ...lerNomes(d, off), hash }
    }
  }
  return { formato, ...vazio, hash }
}
