// SOA Edition — análise da FONTE fora da tela principal: valida o arquivo, lê o nome real da família (tabela
// "name" do OpenType) e calcula a impressão digital (SHA-256) para não instalar a mesma fonte duas vezes.
import { analisarFonteBuffer } from './fonteInfo'

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
  const w = self as unknown as Worker
  try { w.postMessage({ ok: true, info: await analisarFonteBuffer(e.data) }) }
  catch (err) { w.postMessage({ ok: false, erro: (err as Error)?.message || 'Fonte inválida' }) }
}
