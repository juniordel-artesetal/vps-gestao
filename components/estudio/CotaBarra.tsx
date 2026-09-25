'use client'
// SOA Edition — "X de 300 imagens hoje" + créditos comprados + comprar pacote de 50 (Asaas avulso).
// A cota é por LOGIN. O crédito só entra quando o Asaas confirma o pagamento (webhook).
import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, ShoppingCart, X, Sparkles } from 'lucide-react'
import type { Cota } from '@/lib/estudio/cliente'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function CotaBarra({ atualizar, faltam, onCota }: {
  /** Mude este número para recarregar (ex.: depois de gerar um lote). */
  atualizar?: number
  /** Quando o lote foi bloqueado por cota: quantas imagens faltaram (abre a compra em destaque). */
  faltam?: number
  onCota?: (c: Cota) => void
}) {
  const [cota, setCota] = useState<Cota | null>(null)
  const [aberto, setAberto] = useState(false)
  const [pacotes, setPacotes] = useState(1)
  const [cpf, setCpf] = useState('')
  const [pedeCpf, setPedeCpf] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [fatura, setFatura] = useState<string | null>(null)

  const onCotaRef = useRef(onCota)
  useEffect(() => { onCotaRef.current = onCota })
  const carregar = useCallback(async () => {
    const r = await fetch('/api/estudio/cota').catch(() => null)
    if (!r?.ok) return
    const d = await r.json()
    setCota(d); onCotaRef.current?.(d)
  }, [])
  useEffect(() => { carregar() }, [carregar, atualizar])
  useEffect(() => {
    if (faltam && faltam > 0 && cota) { setPacotes(Math.max(1, Math.ceil(faltam / cota.imagensPorPacote))); setAberto(true) }
  }, [faltam, cota])
  // Volta da fatura (outra aba) → recarrega o saldo.
  useEffect(() => { const f = () => { if (document.visibilityState === 'visible') carregar() }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f) }, [carregar])

  async function comprar() {
    setEnviando(true); setErro('')
    try {
      const r = await fetch('/api/estudio/compra', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pacotes, cpf: pedeCpf ? cpf : undefined }) })
      const j = await r.json()
      if (!r.ok) { if (j.precisaCpf) setPedeCpf(true); throw new Error(j.error || 'Não consegui gerar a cobrança.') }
      setFatura(j.invoiceUrl)
      if (j.invoiceUrl) window.open(j.invoiceUrl, '_blank', 'noopener')
    } catch (e) { setErro((e as Error).message) } finally { setEnviando(false) }
  }

  if (!cota) return null
  const usado = Math.min(cota.geradasHoje, cota.cotaDiaria)
  const pct = Math.round((usado / Math.max(1, cota.cotaDiaria)) * 100)
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-xs">
        <div className="flex-1 min-w-[180px]">
          <div className="flex justify-between text-gray-600 dark:text-gray-300 mb-1">
            <span><b className="tabular-nums">{usado}</b> de <span className="tabular-nums">{cota.cotaDiaria}</span> imagens hoje</span>
            {cota.saldoCreditos > 0 && <span className="text-emerald-700 dark:text-emerald-400 font-medium tabular-nums">+{cota.saldoCreditos} em créditos</span>}
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className={`h-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <button onClick={() => setAberto(true)} className="inline-flex items-center gap-1 rounded-lg border border-orange-300 text-orange-700 dark:text-orange-300 px-2.5 py-1 hover:bg-orange-50 dark:hover:bg-orange-950/30">
          <ShoppingCart className="w-3.5 h-3.5" /> Comprar {cota.imagensPorPacote} imagens{cota.precoPacote !== null ? ` por ${brl(cota.precoPacote)}` : ''}
        </button>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAberto(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-orange-500" /> Mais imagens</h3>
              <button onClick={() => setAberto(false)} aria-label="Fechar"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            {!!faltam && faltam > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
                Faltaram <b>{faltam}</b> imagem(ns) para este lote. Você tem {cota.disponivel} disponível(is) agora.
              </p>
            )}
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Todo dia você tem <b>{cota.cotaDiaria} imagens grátis</b>. Os pacotes são usados só depois que elas acabam e não vencem.
            </p>
            {cota.precoPacote === null ? (
              <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">A compra de pacotes abre em breve. Amanhã a cota do dia volta inteira.</p>
            ) : fatura !== null ? (
              <div className="space-y-2 text-sm">
                <p className="text-gray-700 dark:text-gray-200">Cobrança gerada. Assim que o pagamento for confirmado, as imagens entram no seu saldo.</p>
                {fatura && <a href={fatura} target="_blank" rel="noopener noreferrer" className="block text-center rounded-lg bg-orange-500 text-white font-semibold py-2">Abrir fatura (Pix ou cartão)</a>}
                <button onClick={() => { setFatura(null); carregar() }} className="w-full text-xs text-gray-500 hover:underline">Já paguei — atualizar saldo</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm text-gray-700 dark:text-gray-200">Pacotes de {cota.imagensPorPacote}</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPacotes(p => Math.max(1, p - 1))} className="w-7 h-7 rounded border border-gray-200 dark:border-gray-700">−</button>
                    <span className="w-8 text-center tabular-nums">{pacotes}</span>
                    <button onClick={() => setPacotes(p => Math.min(20, p + 1))} className="w-7 h-7 rounded border border-gray-200 dark:border-gray-700">+</button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 flex justify-between"><span>{pacotes * cota.imagensPorPacote} imagens</span><b className="tabular-nums">{brl(pacotes * cota.precoPacote)}</b></p>
                {pedeCpf && (
                  <input value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="CPF do titular"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
                )}
                {erro && <p className="text-xs text-red-600">{erro}</p>}
                <button onClick={comprar} disabled={enviando} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 text-sm disabled:opacity-50">
                  {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Gerar cobrança
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
