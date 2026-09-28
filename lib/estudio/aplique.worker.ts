// SOA Design — Web Worker do MOTOR DE APLIQUES: silhueta, expansão, pintura e contornos fora da tela
// (a página não trava enquanto gera as camadas de 50 personagens).
import { processar, type EntradaNucleo } from './apliqueNucleo'

self.onmessage = (e: MessageEvent<EntradaNucleo & { id: number }>) => {
  const w = self as unknown as Worker
  try {
    const r = processar(e.data)
    const transf: Transferable[] = []
    for (const c of r.camadas) { transf.push(c.alfa.buffer); if (c.rgba) transf.push(c.rgba.buffer) }
    w.postMessage({ id: e.data.id, ok: true, r }, transf)
  } catch (err) { w.postMessage({ id: e.data.id, ok: false, erro: (err as Error)?.message || 'falha no aplique' }) }
}
