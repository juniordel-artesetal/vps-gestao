'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Pencil, Trash2, Upload, X, Package } from 'lucide-react'
import Link from 'next/link'

interface Produto { id: string; nome: string; preco: number | null; unidade: string | null; linkCompra: string | null; ativo: boolean; impressoes: number; cliques: number }
const VAZIO = { id: '', nome: '', preco: '', unidade: '', linkCompra: '', ativo: true }

export default function PortalProdutosPage() {
  const router = useRouter()
  const [itens, setItens] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof VAZIO | null>(null)
  const [importar, setImportar] = useState(false)
  const [csv, setCsv] = useState('')
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/parceiro/produtos')
    if (res.status === 401) { router.push('/parceiro/login'); return }
    if (res.ok) setItens(await res.json())
    setLoading(false)
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  function aviso(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function salvar() {
    if (!form?.nome.trim()) { aviso('Nome obrigatório.'); return }
    const res = await fetch('/api/parceiro/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (res.ok) { setForm(null); carregar() } else aviso('Erro ao salvar.')
  }
  async function excluir(id: string) {
    if (!confirm('Excluir este produto?')) return
    await fetch(`/api/parceiro/produtos?id=${id}`, { method: 'DELETE' }); carregar()
  }
  async function importarCsv() {
    // CSV: nome,preco,unidade,linkCompra (1ª linha pode ser cabeçalho)
    const linhas = csv.split('\n').map(l => l.trim()).filter(Boolean)
    const itens = linhas
      .filter((l, i) => !(i === 0 && /nome/i.test(l) && /pre[çc]o/i.test(l)))
      .map(l => { const [nome, preco, unidade, linkCompra] = l.split(/[;,\t]/).map(s => (s || '').trim()); return { nome, preco, unidade, linkCompra } })
      .filter(x => x.nome)
    if (!itens.length) { aviso('Nada para importar.'); return }
    const res = await fetch('/api/parceiro/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itens }) })
    const d = await res.json()
    if (res.ok) { setImportar(false); setCsv(''); aviso(`${d.criados} produto(s) importado(s).`); carregar() } else aviso('Erro no import.')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/parceiro" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
          <Package className="w-6 h-6 text-orange-500" />
          <h1 className="text-xl font-bold">Lista de preços</h1>
        </div>
        {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-200 text-sm">{msg}</div>}

        <div className="flex gap-2 mb-4">
          <button onClick={() => setForm({ ...VAZIO })} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium"><Plus className="w-4 h-4" /> Novo produto</button>
          <button onClick={() => setImportar(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm"><Upload className="w-4 h-4" /> Importar CSV</button>
        </div>

        {loading ? <div className="text-gray-500 text-sm">Carregando…</div> : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {itens.length === 0 ? <div className="p-6 text-gray-500 text-sm text-center">Nenhum produto. Cadastre sua lista de preços — ela aparece nos materiais das artesãs pelo nome.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-800/50 text-gray-400">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold">Produto</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold">Preço</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold">Impr./Cliq.</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold">Ativo</th>
                  <th className="px-4 py-2.5"></th>
                </tr></thead>
                <tbody>{itens.map(p => (
                  <tr key={p.id} className="border-t border-gray-800">
                    <td className="px-4 py-2.5">{p.nome}{p.unidade ? <span className="text-gray-500 text-xs"> /{p.unidade}</span> : ''}</td>
                    <td className="px-4 py-2.5 text-right text-gray-300">{p.preco != null ? `R$ ${Number(p.preco).toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-2.5 text-center text-gray-400 text-xs">{p.impressoes} / {p.cliques}</td>
                    <td className="px-4 py-2.5 text-center">{p.ativo ? '✅' : '—'}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => setForm({ id: p.id, nome: p.nome, preco: p.preco != null ? String(p.preco) : '', unidade: p.unidade || '', linkCompra: p.linkCompra || '', ativo: p.ativo })} className="text-gray-400 hover:text-white mr-2"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => excluir(p.id)} className="text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {form && (
          <Modal onClose={() => setForm(null)} titulo={form.id ? 'Editar produto' : 'Novo produto'}>
            <Campo label="Nome (igual ao material da artesã)" value={form.nome} onChange={v => setForm({ ...form, nome: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Preço" value={form.preco} onChange={v => setForm({ ...form, preco: v })} />
              <Campo label="Unidade" value={form.unidade} onChange={v => setForm({ ...form, unidade: v })} />
            </div>
            <Campo label="Link de compra" value={form.linkCompra} onChange={v => setForm({ ...form, linkCompra: v })} />
            <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
            <button onClick={salvar} className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium">Salvar</button>
          </Modal>
        )}
        {importar && (
          <Modal onClose={() => setImportar(false)} titulo="Importar lista (CSV)">
            <p className="text-xs text-gray-400">Uma linha por produto: <code>nome,preço,unidade,link</code></p>
            <textarea value={csv} onChange={e => setCsv(e.target.value)} rows={8} placeholder={'Cola de EVA 250g,12.90,un,https://loja...\nFeltro cinza,8.50,m,https://loja...'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono" />
            <button onClick={importarCsv} className="w-full py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium">Importar</button>
          </Modal>
        )}
      </div>
    </div>
  )
}

function Modal({ titulo, children, onClose }: { titulo: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{titulo}</h3><button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button></div>
        {children}
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
