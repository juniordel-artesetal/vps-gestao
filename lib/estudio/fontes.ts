// SOA Edition — FONTES da artesã: um lugar só para registrar (com cache — cada família é baixada e registrada UMA
// vez por sessão, não a cada abertura/seleção) e para analisar a fonte importada (em Web Worker: valida, lê o nome
// real e a impressão digital, sem travar a tela). O arquivo sobe direto do navegador para o Blob (lib/estudio/cliente).
import { analisarFonteBuffer, type InfoFonte } from './fonteInfo'

export type { InfoFonte }
const registradas = new Map<string, Promise<boolean>>()

/**
 * Registra a família no navegador (FontFace). Idempotente: a mesma família nunca é baixada/registrada duas vezes.
 * `fonte` = URL (Blob) ou bytes. Devolve false se a fonte não carregar (não lança).
 */
export function registrarFonte(familia: string, fonte: string | ArrayBuffer | ArrayBufferView, prazoMs = 20_000): Promise<boolean> {
  const ja = registradas.get(familia)
  if (ja) return ja
  const p = (async () => {
    try {
      const ff = new FontFace(familia, typeof fonte === 'string' ? `url(${JSON.stringify(fonte)})` : (fonte as BufferSource))
      await Promise.race([ff.load(), new Promise((_, rej) => setTimeout(() => rej(new Error('prazo')), prazoMs))])
      document.fonts.add(ff)
      return true
    } catch {
      registradas.delete(familia)   // deixa tentar de novo depois
      return false
    }
  })()
  registradas.set(familia, p)
  return p
}
export const fonteRegistrada = (familia: string) => registradas.has(familia)

/** Nome estável da família no navegador: pela impressão digital → a mesma fonte = a mesma família (sem duplicar). */
export const familiaDoArquivo = (info: InfoFonte) => `SOA_${info.hash.slice(0, 12)}`
/** Nome para mostrar na lista ("Montserrat Bold"), com o nome do arquivo como reserva. */
export const nomeDaFonte = (info: InfoFonte, arquivo: string) => {
  const base = info.familia ? (info.estilo && !/^(regular|normal|book|roman)$/i.test(info.estilo) ? `${info.familia} ${info.estilo}` : info.familia) : info.completo
  return (base || arquivo.replace(/\.(ttf|otf|ttc|woff2?)$/i, '')).slice(0, 80)
}

/** Analisa a fonte num Web Worker (cai para a página se o worker não subir). Lança erro claro se não for fonte. */
export function analisarFonte(buf: ArrayBuffer): Promise<InfoFonte> {
  return new Promise((res, rej) => {
    let w: Worker
    const naPagina = () => analisarFonteBuffer(buf).then(res, rej)
    try { w = new Worker(new URL('./fonte.worker.ts', import.meta.url), { type: 'module' }) } catch { naPagina(); return }
    const t = setTimeout(() => { w.terminate(); naPagina() }, 8000)
    w.onmessage = e => { clearTimeout(t); w.terminate(); const m = e.data as { ok: boolean; info?: InfoFonte; erro?: string }; if (m.ok && m.info) res(m.info); else rej(new Error(m.erro || 'Fonte inválida')) }
    w.onerror = () => { clearTimeout(t); w.terminate(); naPagina() }
    w.postMessage(buf.slice(0))
  })
}

export const EXTENSOES_FONTE = /\.(ttf|otf|ttc|woff2?)$/i
export const ACCEPT_FONTE = '.ttf,.otf,.ttc,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2'
