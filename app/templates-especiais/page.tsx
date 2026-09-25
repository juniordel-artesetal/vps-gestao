'use client'
// Templates Especiais — acervo curado (atualizado toda semana) para personalizar e gerar no SOA Edition.
// Sem assinatura: miniaturas com cadeado + assinar. Com: busca, categorias, novos da semana, lupa e "Usar".
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Lock, Search, Sparkles, Loader2, X, ZoomIn, Wand2 } from 'lucide-react'

interface Item { id: string; nome: string; categoria: string | null; preview: string | null; versao: number; novo: boolean }
interface Dados {
  ativo: boolean; origem: string | null; status: string | null; venda: boolean; preco: number | null; editor: boolean
  itens: Item[]; termo: { texto: string; versao: string; aceito: boolean }
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function TemplatesEspeciais() {
  const [d, setD] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState('')
  const [soNovos, setSoNovos] = useState(false)
  const [lupa, setLupa] = useState<Item | null>(null)
  const [termoAberto, setTermoAberto] = useState<Item | null>(null)
  const [assinando, setAssinando] = useState(false)
  const [pedeCpf, setPedeCpf] = useState(false)
  const [cpf, setCpf] = useState('')

  const carregar = () => fetch('/api/estudio/especiais').then(r => r.json()).then(x => (x.error ? setErro(x.error) : setD(x))).catch(() => setErro('Não consegui carregar o acervo.'))
  useEffect(() => { carregar() }, [])

  const categorias = useMemo(() => [...new Set((d?.itens || []).map(i => i.categoria || 'Geral'))].sort(), [d])
  const lista = useMemo(() => (d?.itens || []).filter(i =>
    (!cat || (i.categoria || 'Geral') === cat) && (!soNovos || i.novo) &&
    (!busca.trim() || `${i.nome} ${i.categoria}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(busca.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')))), [d, cat, soNovos, busca])

  async function assinar() {
    setAssinando(true); setErro('')
    try {
      const r = await fetch('/api/estudio/especiais/assinatura', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf: pedeCpf ? cpf : undefined }) })
      const j = await r.json()
      if (!r.ok) { if (j.precisaCpf) setPedeCpf(true); throw new Error(j.error || 'Não consegui gerar a assinatura.') }
      if (j.invoiceUrl) window.location.href = j.invoiceUrl
      else carregar()
    } catch (e) { setErro((e as Error).message) } finally { setAssinando(false) }
  }
  async function usar(i: Item) {
    if (!d) return
    if (!d.termo.aceito) { setTermoAberto(i); return }
    if (!d.editor) { setErro('Para personalizar e gerar, você precisa do SOA Edition (o editor e as imagens do dia vêm dele).'); return }
    window.location.href = `/estudio/artes?especial=${encodeURIComponent(i.id)}`
  }
  async function aceitar() {
    if (!d) return
    await fetch('/api/estudio/especiais', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'aceitar-termo', versao: d.termo.versao }) })
    const alvo = termoAberto
    setD({ ...d, termo: { ...d.termo, aceito: true } }); setTermoAberto(null)
    if (alvo) { if (d.editor) window.location.href = `/estudio/artes?especial=${encodeURIComponent(alvo.id)}`; else setErro('Para personalizar e gerar, você precisa do SOA Edition.') }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <Link href="/estudio" className="text-sm text-gray-500 hover:text-orange-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> SOA Edition</Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white inline-flex items-center gap-2"><Sparkles className="w-6 h-6 text-orange-500" /> Templates Especiais</h1>
          <p className="text-sm text-gray-500">Acervo pronto, atualizado toda semana: abra, coloque o nome e a idade e gere — tudo dentro do SOA.</p>
        </div>
        {d && !d.ativo && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900 p-3 space-y-2 min-w-[260px]">
            <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">{d.venda && d.preco ? `${brl(d.preco)}/mês` : 'Em breve'}{d.status === 'INADIMPLENTE' ? ' — fatura em aberto' : ''}</p>
            {pedeCpf && <input value={cpf} onChange={e => setCpf(e.target.value)} inputMode="numeric" placeholder="CPF do titular" className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800" />}
            <button onClick={assinar} disabled={!d.venda || assinando || (pedeCpf && cpf.replace(/\D/g, '').length < 11)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {assinando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} {d.status === 'INADIMPLENTE' || d.status === 'PENDENTE' ? 'Pagar a fatura' : 'Assinar Templates Especiais'}
            </button>
          </div>
        )}
      </div>
      {erro && <p className="text-sm text-red-600">{erro} {!d?.editor && erro.includes('SOA Edition') && <Link href="/soa-edition" className="underline">Conhecer o SOA Edition</Link>}</p>}
      {!d ? <p className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar tema, caixa, festa…" className="w-full border border-gray-200 dark:border-gray-700 rounded-xl pl-8 pr-3 py-2 text-sm bg-white dark:bg-gray-800" /></div>
            <select value={cat} onChange={e => setCat(e.target.value)} className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-800"><option value="">Todas as categorias</option>{categorias.map(c => <option key={c}>{c}</option>)}</select>
            <button onClick={() => setSoNovos(v => !v)} className={`rounded-xl px-3 py-2 text-sm border ${soNovos ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>Novos da semana</button>
          </div>
          {!lista.length ? <p className="text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl p-8 text-center">{d.itens.length ? 'Nada com esse filtro.' : 'O acervo está sendo preparado — volte em breve.'}</p> : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              {lista.map(i => (
                <div key={i.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
                  <button onClick={() => setLupa(i)} className="relative block w-full aspect-square bg-gray-50 dark:bg-gray-800">
                    {i.preview ? <img src={i.preview} alt={i.nome} className={`w-full h-full object-contain ${d.ativo ? '' : 'blur-[1px] opacity-80'}`} /> : null}
                    {!d.ativo && <span className="absolute inset-0 flex items-center justify-center"><Lock className="w-7 h-7 text-white drop-shadow" /></span>}
                    {i.novo && <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold rounded-full bg-orange-500 text-white px-2 py-0.5">novo</span>}
                    <ZoomIn className="absolute bottom-1.5 right-1.5 w-4 h-4 text-gray-400" />
                  </button>
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-medium truncate">{i.nome}</p>
                    <p className="text-[10px] text-gray-400 truncate">{i.categoria || 'Geral'}</p>
                    {d.ativo && <button onClick={() => usar(i)} className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-1.5"><Wand2 className="w-3.5 h-3.5" /> Usar</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {lupa && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setLupa(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 max-w-lg w-full space-y-2" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center"><p className="text-sm font-semibold">{lupa.nome}</p><button onClick={() => setLupa(null)}><X className="w-5 h-5 text-gray-400" /></button></div>
            {lupa.preview && <div className="relative"><img src={lupa.preview} alt={lupa.nome} className={`w-full rounded-xl ${d?.ativo ? '' : 'blur-[2px]'}`} />{!d?.ativo && <Lock className="absolute inset-0 m-auto w-10 h-10 text-white drop-shadow" />}</div>}
            {d?.ativo && <button onClick={() => usar(lupa)} className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2">Usar este template</button>}
          </div>
        </div>
      )}
      {termoAberto && d && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 max-w-md w-full space-y-3">
            <p className="font-semibold">Termo de uso dos Templates Especiais</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{d.termo.texto}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setTermoAberto(null)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm">Agora não</button>
              <button onClick={aceitar} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold">Li e aceito</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
