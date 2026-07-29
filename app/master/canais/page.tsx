'use client'
// app/master/canais/page.tsx — Catálogo GLOBAL de canais (a "rotina de atualização" do SOA).
// Master-only (cookie master_token via middleware). O Master mantém as taxas por regra
// (faixa de preço / categoria) e ao salvar marca "atualizado em" — reflete pra todos que usam.
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Info, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface Regra { precoAte?: number | null; categoria?: string | null; variante?: string | null; taxaPercent: number; taxaFixa: number; label?: string }
interface Canal {
  canal: string; nome: string; regras: Regra[]; categorias: string[]; variantes: string[]
  pixDias: number; cartaoDias: number; estrutura: string | null
  atualizadoEm: string | null; atualizadoPor: string | null
}

const brDate = (s: string | null) => s ? s.split('-').reverse().slice(0, 2).join('/') : '—'
const condLabel = (r: Regra) => r.label || [
  r.precoAte != null ? `até R$${r.precoAte}` : null,
  r.categoria ? `categoria: ${r.categoria}` : null,
  r.variante ? r.variante : null,
].filter(Boolean).join(' · ') || 'Padrão'

export default function MasterCanaisPage() {
  const router = useRouter()
  const [canais, setCanais] = useState<Canal[]>([])
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const aviso = (tipo: 'ok' | 'erro', texto: string) => { setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 5000) }

  const carregar = useCallback(async () => {
    const res = await fetch('/api/master/canais-catalogo')
    if (res.status === 401) { router.push('/master/login'); return }
    if (res.ok) { const d = await res.json(); setCanais(d.canais ?? []) }
    setCarregando(false)
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  function editarRegra(ci: number, ri: number, campo: 'taxaPercent' | 'taxaFixa', valor: string) {
    setCanais(prev => prev.map((c, i) => i !== ci ? c : {
      ...c, regras: c.regras.map((r, j) => j !== ri ? r : { ...r, [campo]: valor === '' ? 0 : parseFloat(valor) || 0 }),
    }))
  }
  function editarPrazo(ci: number, campo: 'pixDias' | 'cartaoDias', valor: string) {
    setCanais(prev => prev.map((c, i) => i !== ci ? c : { ...c, [campo]: valor === '' ? 0 : parseInt(valor) || 0 }))
  }

  async function salvar(c: Canal) {
    setOcupado(c.canal)
    const res = await fetch('/api/master/canais-catalogo', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal: c.canal, regras: c.regras, pixDias: c.pixDias, cartaoDias: c.cartaoDias }),
    })
    setOcupado('')
    if (res.ok) { const d = await res.json(); setCanais(d.canais ?? []); aviso('ok', `${c.nome} atualizado — reflete pra quem usa.`) }
    else aviso('erro', 'Não consegui salvar. Tente de novo.')
  }

  if (carregando) return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Carregando…</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/master" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-2xl font-bold">Catálogo de canais</h1>
          <button onClick={carregar} className="ml-auto text-gray-400 hover:text-white" title="Recarregar"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-6 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          Taxas mantidas centralmente pelo SOA. Ao salvar, a data de atualização muda e a taxa reflete
          para todas as artesãs que usam o canal (salvo as que fizeram ajuste próprio). Marketplaces mudam
          taxa com frequência — revise ao ver anúncio de mudança.
        </p>

        {msg && <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-700/50' : 'bg-red-900/30 text-red-300 border border-red-700/50'}`}>{msg.texto}</div>}

        <div className="space-y-5">
          {canais.map((c, ci) => (
            <div key={c.canal} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold">{c.nome}</h2>
                <span className="text-xs text-gray-500">atualizado em <b className="text-gray-300">{brDate(c.atualizadoEm)}</b>{c.atualizadoPor ? ` · ${c.atualizadoPor}` : ''}</span>
              </div>
              {c.estrutura && <p className="text-xs text-gray-500 mb-3">{c.estrutura}</p>}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-500 text-left">
                    <th className="py-1 pr-2">Regra</th><th className="py-1 px-2 w-28">Comissão %</th><th className="py-1 px-2 w-28">Taxa fixa R$</th>
                  </tr></thead>
                  <tbody>
                    {c.regras.map((r, ri) => (
                      <tr key={ri} className="border-t border-gray-800">
                        <td className="py-1.5 pr-2 text-gray-300">{condLabel(r)}</td>
                        <td className="py-1.5 px-2">
                          <input type="number" step="any" value={r.taxaPercent} onChange={e => editarRegra(ci, ri, 'taxaPercent', e.target.value)}
                            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
                        </td>
                        <td className="py-1.5 px-2">
                          <input type="number" step="0.01" value={r.taxaFixa} onChange={e => editarRegra(ci, ri, 'taxaFixa', e.target.value)}
                            className="w-24 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-4 mt-3">
                <label className="text-xs text-gray-400 flex items-center gap-2">Prazo Pix (D+)
                  <input type="number" value={c.pixDias} onChange={e => editarPrazo(ci, 'pixDias', e.target.value)} className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm" /></label>
                <label className="text-xs text-gray-400 flex items-center gap-2">Prazo cartão (D+)
                  <input type="number" value={c.cartaoDias} onChange={e => editarPrazo(ci, 'cartaoDias', e.target.value)} className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-sm" /></label>
                <button onClick={() => salvar(c)} disabled={ocupado === c.canal}
                  className="ml-auto flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition">
                  <Save className="w-4 h-4" /> {ocupado === c.canal ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
