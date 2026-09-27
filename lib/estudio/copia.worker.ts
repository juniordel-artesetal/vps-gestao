// SOA Design — CÓPIA DE TRABALHO de imagem pesada fora da tela: decodifica, reduz para o teto de impressão
// (~300 dpi no tamanho real; área/lado máximos) e codifica (JPEG de alta qualidade; PNG/WebP se tiver transparência).
// A página não congela enquanto uma foto de 40–100 MB é preparada para subir.
self.onmessage = async (e: MessageEvent<{ arquivo: File; maxArea: number; maxLado: number; maxBytes: number }>) => {
  const w = self as unknown as Worker
  try {
    const { arquivo, maxArea, maxLado, maxBytes } = e.data
    const bmp0 = await createImageBitmap(arquivo)
    const W = bmp0.width, H = bmp0.height
    const k = Math.min(1, Math.sqrt(maxArea / (W * H)), maxLado / Math.max(W, H))
    const w2 = Math.max(1, Math.round(W * k)), h2 = Math.max(1, Math.round(H * k))
    const bmp = k < 1 ? await createImageBitmap(bmp0, { resizeWidth: w2, resizeHeight: h2, resizeQuality: 'high' }) : bmp0
    if (bmp !== bmp0) bmp0.close()
    const cv = new OffscreenCanvas(w2, h2), g = cv.getContext('2d', { willReadFrequently: true })!
    g.drawImage(bmp, 0, 0); bmp.close()
    // transparência? (só PNG/WebP podem ter) — amostra em grade
    let alfa = false
    if (arquivo.type !== 'image/jpeg') {
      const passo = Math.max(1, Math.floor(Math.min(w2, h2) / 200))
      for (let y = 0; y < h2 && !alfa; y += passo) { const l = g.getImageData(0, y, w2, 1).data; for (let x = 3; x < l.length; x += 4 * passo) if (l[x] < 250) { alfa = true; break } }
    }
    let blob: Blob, mime: string
    if (!alfa) { blob = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.92 }); mime = 'image/jpeg' }
    else {
      blob = await cv.convertToBlob({ type: 'image/png' }); mime = 'image/png'
      if (blob.size > maxBytes) { blob = await cv.convertToBlob({ type: 'image/webp', quality: 0.95 }); mime = 'image/webp' }
    }
    w.postMessage({ ok: true, blob, mime, origW: W, origH: H })
  } catch (err) { w.postMessage({ ok: false, erro: (err as Error)?.message || 'imagem ilegível' }) }
}
