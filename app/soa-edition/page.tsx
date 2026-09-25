'use client'
// SOA Edition — assinatura do módulo: status, assinar/renovar (R$ 29,90/mês), uso do dia e
// pacotes de excedente. Separa com clareza o que é RECORRENTE (assinatura) do que é AVULSO (pacote).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, WandSparkles, Layers, Palette, SlidersHorizontal, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import CotaBarra from '@/components/estudio/CotaBarra'

interface Status {
  ativo: boolean; origem: 'asaas' | 'cortesia' | null; status: string | null; valor: number | null
  proximoVencimento: string | null; venda: boolean; preco: number | null
  cota: { cotaDiaria: number; imagensPorPacote: number; precoPacote: number | null }
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (s: string | null) => (s ? s.split('-').reverse().join('/') : '—')

export default function SoaEdition() {
  const [st, setSt] = useState<Status | null>(null)
  const [cpf, setCpf] = useState('')
  const [pedeCpf, setPedeCpf] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [fatura, setFatura] = useState<string | null | undefined>(undefined)

  const carregar = () => fetch('/api/estudio/assinatura').then(r => r.json()).then(setSt).catch(() => setErro('Não consegui carregar.'))
  useEffect(() => { carregar() }, [])
  useEffect(() => { const f = () => { if (document.visibilityState === 'visible') carregar() }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f) }, [])

  async function assinar() {
    setEnviando(true); setErro('')
    try {
      const r = await fetch('/api/estudio/assinatura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf: pedeCpf ? cpf : undefined }) })
      const j = await r.json()
      if (!r.ok) { if (j.precisaCpf) setPedeCpf(true); throw new Error(j.error || 'Não consegui gerar a assinatura.') }
      if (j.jaAtiva) { carregar(); return }
      setFatura(j.invoiceUrl ?? null)
      if (j.invoiceUrl) window.open(j.invoiceUrl, '_blank', 'noopener')
    } catch (e) { setErro((e as Error).message) } finally { setEnviando(false) }
  }

  if (!st) return <div className="p-6 flex items-center gap-2 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /> Carregando…</div>
  const inadimplente = !st.ativo && st.status === 'INADIMPLENTE'
  const recursos = [
    { i: Layers, t: 'Edição em massa', d: 'Molde + lista de nomes (ou direto do pedido) → todas as artes de uma vez.' },
    { i: WandSparkles, t: 'Tema pronto no pedido', d: 'O pedido com tema já existente sai com a arte pronta para imprimir.' },
    { i: Palette, t: 'Editor de imagem', d: 'Camadas, objeto inteligente, perspectiva, máscaras e tamanhos de cada marketplace.' },
    { i: SlidersHorizontal, t: 'Ações em lote', d: 'Recorte, tamanho, ajustes e marca d’água em até 50 fotos por vez.' },
  ]

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SOA Edition</h1>
        <p className="text-sm text-gray-500">Suas artes personalizadas em lote — sem refazer uma por uma.</p>
      </div>

      {/* ASSINATURA (recorrente) */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Assinatura do módulo · mensal</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-0.5">
              {st.ativo ? (st.origem === 'cortesia' ? 'Cortesia' : 'Ativa') : inadimplente ? 'Pagamento pendente' : 'Não assinada'}
            </p>
          </div>
          {st.ativo
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-2.5 py-1"><CheckCircle2 className="w-3.5 h-3.5" /> Liberado</span>
            : inadimplente && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-semibold px-2.5 py-1"><AlertTriangle className="w-3.5 h-3.5" /> Bloqueado</span>}
        </div>

        {st.ativo && st.origem === 'asaas' && (
          <p className="text-sm text-gray-600 dark:text-gray-300">{brl(st.valor || st.preco || 0)}/mês · próximo vencimento {dataBR(st.proximoVencimento)}</p>
        )}
        {st.ativo && st.origem === 'cortesia' && <p className="text-sm text-gray-600 dark:text-gray-300">Seu ateliê usa o SOA Edition como cortesia — sem mensalidade.</p>}
        {inadimplente && <p className="text-sm text-gray-600 dark:text-gray-300">A mensalidade venceu e o módulo foi pausado. <b>Seus moldes, templates, designs e créditos estão guardados</b> — pague a fatura e tudo volta na hora.</p>}

        {!st.ativo && (
          <>
            {!inadimplente && (
              <div className="grid sm:grid-cols-2 gap-3">
                {recursos.map(r => (
                  <div key={r.t} className="flex gap-2.5">
                    <r.i className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div><p className="text-sm font-medium text-gray-900 dark:text-white">{r.t}</p><p className="text-xs text-gray-500">{r.d}</p></div>
                  </div>
                ))}
              </div>
            )}
            {!st.venda ? (
              <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">A assinatura abre em breve.</p>
            ) : fatura !== undefined ? (
              <div className="space-y-2">
                <p className="text-sm text-gray-700 dark:text-gray-200">Pronto! Assim que o pagamento for confirmado, o módulo libera sozinho.</p>
                {fatura && <a href={fatura} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white">Abrir fatura (Pix ou cartão)</a>}
                <button onClick={carregar} className="block text-xs text-gray-500 hover:underline">Já paguei — atualizar</button>
              </div>
            ) : (
              <div className="space-y-2 max-w-sm">
                <p className="text-sm text-gray-700 dark:text-gray-200"><b className="text-xl text-gray-900 dark:text-white">{brl(st.preco!)}</b>/mês · inclui {st.cota.cotaDiaria} imagens por dia para cada login</p>
                {pedeCpf && <input value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="CPF do titular" className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />}
                <button onClick={assinar} disabled={enviando || (pedeCpf && cpf.replace(/\D/g, '').length < 11)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {enviando && <Loader2 className="w-4 h-4 animate-spin" />} {inadimplente ? 'Pagar a fatura em aberto' : `Assinar SOA Edition (${brl(st.preco!)}/mês)`}
                </button>
              </div>
            )}
          </>
        )}
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        {st.ativo && <Link href="/estudio" className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:underline">Abrir o SOA Edition <ArrowRight className="w-4 h-4" /></Link>}
      </section>

      {/* USO e EXCEDENTE (avulso) */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Uso do dia e pacotes extras · avulso</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Cada login tem {st.cota.cotaDiaria} imagens por dia (volta à meia-noite). Passou disso, dá para comprar
            {st.cota.precoPacote !== null ? <> pacotes de {st.cota.imagensPorPacote} por <b>{brl(st.cota.precoPacote)}</b></> : <> pacotes de {st.cota.imagensPorPacote} (em breve)</>}
            {' '}— cobrança única, sem mensalidade, e os créditos não vencem.
          </p>
        </div>
        {st.ativo ? <CotaBarra /> : <p className="text-xs text-gray-400">Disponível com o módulo ativo.</p>}
      </section>
    </div>
  )
}
