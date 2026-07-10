'use client'
// app/master/leads/page.tsx — leads capturados (ex.: Mega Artesanal 2026). Só MASTER.
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Download, RefreshCw, Users, Search } from 'lucide-react'

interface Lead {
  id: string; nome: string; origem: string
  telefoneMascarado: string; emailMascarado?: string; codigo?: string | null
  consentimento: boolean; createdAt: string
}

const inp = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500'

// Rótulos amigáveis por origem
const ROTULO_ORIGEM: Record<string, string> = {
  sorteio_megaartesanal2026: 'Lead Sorteio',
  megaartesanal2026: 'Lead Feira',
}
function labelOrigem(o: string) { return ROTULO_ORIGEM[o] || o }

function fmt(d: string) {
  const dt = new Date(d)
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function MasterLeadsPage() {
  const [itens, setItens] = useState<Lead[]>([])
  const [origens, setOrigens] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [origem, setOrigem] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true); setErro(false)
    try {
      const qs = new URLSearchParams()
      if (origem) qs.set('origem', origem)
      if (de) qs.set('de', de)
      if (ate) qs.set('ate', ate)
      const r = await fetch(`/api/leads?${qs.toString()}`)
      if (!r.ok) throw new Error()
      const d = await r.json()
      setItens(d.itens || []); setOrigens(d.origens || [])
    } catch { setErro(true); setItens([]) }
    finally { setLoading(false) }
  }, [origem, de, ate])

  useEffect(() => { carregar() }, [carregar])

  function exportarCsv() {
    const qs = new URLSearchParams({ export: 'csv' })
    if (origem) qs.set('origem', origem)
    if (de) qs.set('de', de)
    if (ate) qs.set('ate', ate)
    window.open(`/api/leads?${qs.toString()}`, '_blank')
  }

  const filtrados = busca.trim()
    ? itens.filter(l => l.nome.toLowerCase().includes(busca.toLowerCase()) || l.telefoneMascarado.includes(busca.trim()))
    : itens

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <a href="/master/marketing" className="text-gray-400 hover:text-white"><ArrowLeft size={18} /></a>
            <div>
              <h1 className="font-semibold flex items-center gap-2"><Users size={18} className="text-orange-400" /> Leads capturados</h1>
              <p className="text-xs text-gray-500">Contatos que pediram o teste (ex.: feiras/campanhas)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={carregar} className="p-2 border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800"><RefreshCw size={15} /></button>
            <button onClick={exportarCsv} className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-medium">
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-44">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome/telefone..." className={inp + ' w-full pl-9'} />
          </div>
          <select value={origem} onChange={e => setOrigem(e.target.value)} className={inp}>
            <option value="">Todas as origens</option>
            {origens.map(o => <option key={o} value={o}>{labelOrigem(o)}</option>)}
          </select>
          <label className="text-xs text-gray-500 flex items-center gap-1">de <input type="date" value={de} onChange={e => setDe(e.target.value)} className={inp + ' py-1'} /></label>
          <label className="text-xs text-gray-500 flex items-center gap-1">até <input type="date" value={ate} onChange={e => setAte(e.target.value)} className={inp + ' py-1'} /></label>
          <span className="text-xs text-gray-500 ml-auto self-center">{filtrados.length} lead{filtrados.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Lista */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                  {['Nome', 'WhatsApp', 'E-mail', 'Código', 'Origem', 'Data'].map(h => <th key={h} className="p-3 text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                ) : erro ? (
                  <tr><td colSpan={6} className="p-8 text-center"><span className="text-red-400">Erro ao carregar.</span> <button onClick={carregar} className="text-orange-400 underline ml-1">tentar de novo</button></td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-600">Nenhum lead ainda</td></tr>
                ) : filtrados.map(l => (
                  <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-3 text-white font-medium">{l.nome}</td>
                    <td className="p-3 font-mono text-gray-300">{l.telefoneMascarado}</td>
                    <td className="p-3 text-gray-400">{l.emailMascarado || '—'}</td>
                    <td className="p-3 font-mono text-orange-300 text-xs">{l.codigo || '—'}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${l.origem === 'sorteio_megaartesanal2026' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-blue-500/15 text-blue-300'}`}>{labelOrigem(l.origem)}</span>
                    </td>
                    <td className="p-3 text-gray-500 whitespace-nowrap text-xs">{fmt(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[11px] text-gray-600 mt-3">O telefone completo só sai no CSV exportado (ação restrita e registrada). Na tela ele aparece mascarado.</p>
      </div>
    </div>
  )
}
