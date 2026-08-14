// Compressão de imagem client-side (mesmo padrão do resto do app: canvas → JPEG),
// para não inchar o banco. Comprovantes usam um lado maior (legibilidade de recibo).
export async function comprimirImagem(file: File, max = 900, q = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Imagem inválida'))
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > h) { if (w > max) { h = Math.round(h * max / w); w = max } }
        else { if (h > max) { w = Math.round(w * max / h); h = max } }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas indisponível'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', q))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
