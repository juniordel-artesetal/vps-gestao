'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Trash2, X, Tag } from 'lucide-react'
import Link from 'next/link'

interface Promo { id: string; titulo: string; descricao: string | null; cupom: string | null; linkCompra: string | null; prioridade: number; dataInicio: string | null; dataFim: string | null; ativo: boolean; impressoes: number; cliques: number }
const VAZIO = { id: '', titulo: '', descricao: '', cupom: '', linkCompra: '', dataInicio: '', dataFim: '', ativo: true }

export default function PortalPromocoesPage() {
  const router = useRouter()
  const [itens, setItens] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof VAZIO | null>(null)
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/parceiro/promocoes')
    if (res.status === 401) { router.push('/parceiro/login'); return }
    if (res.ok) setItens(await res.json())
    setLoading(false)
  }, [router])
  useEffect(() => { carregar() }, [carregar])
  function aviso(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function salvar() {
    if (!form?.titulo.trim()) { aviso('Título obrigatório.'); return }
    const res = await fetch('/api/parceiro/promocoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { setForm(null); carregar() } else aviso('Erro ao salvar.')
  }
  async function excluir(id: string) {
    if (!confirm('Excluir promoção?')) return
    await fetch(`/api/parceiro/promocoes?id=${id}`, { method: 'DELETE' }); carregar()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/parceiro" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <Tag className="w-6 h-6 text-orange-500" />
          <h1 className="text-xl font-bold">Promoções &amp; cupons</h1>
        </div>
        {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-200 text-sm">{msg}</div>}

        <button onClick={() => setForm({ ...VAZIO })} className="mb-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Nova promoção</button>

        {loading ? <div className="text-gray-500 text-sm">Carregando…</div> : (
          <div className="space-y-2">
            {itens.length === 0 && <div className="p-6 text-gray-500 text-sm text-center bg-gray-900 border border-gray-800 rounded-xl">Nenhuma promoção. Elas entram na fila (rotacionada, teto 2x/dia por assinante). A prioridade é definida pela equipe SOA.</div>}
            {itens.map(p => (
              <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.titulo}</span>
                    {!p.ativo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">pausada</span>}
                    {p.cupom && <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">{p.cupom}</span>}
                  </div>
                  {p.descricao && <p className="text-xs text-gray-400 mt-0.5">{p.descricao}</p>}
                  <div className="text-xs text-gray-500 mt-1">Prioridade {p.prioridade} · {p.impressoes} impressões · {p.cliques} cliques{p.dataFim ? ` · até ${p.dataFim}` : ''}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setForm({ id: p.id, titulo: p.titulo, descricao: p.descricao || '', cupom: p.cupom || '', linkCompra: p.linkCompra || '', dataInicio: p.dataInicio || '', dataFim: p.dataFim || '', ativo: p.ativo })} className="text-gray-400 hover:text-white p-1"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => excluir(p.id)} className="text-gray-400 hover:text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {form && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setForm(null)}>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{form.id ? 'Editar' : 'Nova'} promoção</h3><button onClick={() => setForm(null)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
              <Campo label="Título" value={form.titulo} onChange={v => setForm({ ...form, titulo: v })} />
              <div><label className="text-xs text-gray-400 block mb-1">Descrição</label><textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" /></div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Cupom" value={form.cupom} onChange={v => setForm({ ...form, cupom: v.toUpperCase() })} />
                <Campo label="Link de compra" value={form.linkCompra} onChange={v => setForm({ ...form, linkCompra: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-400 block mb-1">Início</label><input type="date" value={form.dataInicio} onChange={e => setForm({ ...form, dataInicio: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" /></div>
                <div><label className="text-xs text-gray-400 block mb-1">Fim</label><input type="date" value={form.dataFim} onChange={e => setForm({ ...form, dataFim: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Ativa</label>
              <p className="text-[11px] text-gray-500">A prioridade na fila é definida pela equipe SOA (moderação).</p>
              <button onClick={salvar} className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium">Salvar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
    </div>
  )
}
