'use client'
// Master — publicar Ofertas & Cupons (vitrine em Compras → Ofertas & Cupons).
import { useEffect, useState, useCallback } from 'react'
import { Tag, Plus, Pencil, Trash2, ExternalLink, Image as ImageIcon, X, Eye, EyeOff } from 'lucide-react'

interface Promo {
  id: string; parceiroNome: string; titulo: string; descricao: string | null
  desconto: string | null; cupom: string | null; linkCompra: string | null
  prioridade: number; ativo: boolean; temImagem: boolean
  dataInicio: string | null; dataFim: string | null; impressoes: number; cliques: number
}

// Compressão client-side (mesmo padrão do estoque): logo até 400px, JPEG 0.8.
function comprimir(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const MAX = 400
        let w = img.width, h = img.height
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = reject
      img.src = String(reader.result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const VAZIO = { parceiroNome: '', titulo: '', descricao: '', desconto: '', cupom: '', linkCompra: '', prioridade: '0', ativo: true, dataInicio: '', dataFim: '' }
const inp = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500'

export default function MasterPromocoesPage() {
  const [lista, setLista] = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<any>(VAZIO)
  const [imagem, setImagem] = useState<string | null>(null)   // nova logo (data URL) ou null
  const [imagemTocada, setImagemTocada] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/master/promocoes')
      if (r.ok) setLista((await r.json()).promocoes || [])
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const feedback = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 2500) }

  function novo() { setEditId(null); setForm(VAZIO); setImagem(null); setImagemTocada(false); setModal(true) }
  function editar(p: Promo) {
    setEditId(p.id)
    setForm({
      parceiroNome: p.parceiroNome, titulo: p.titulo, descricao: p.descricao || '', desconto: p.desconto || '',
      cupom: p.cupom || '', linkCompra: p.linkCompra || '', prioridade: String(p.prioridade ?? 0),
      ativo: p.ativo, dataInicio: p.dataInicio || '', dataFim: p.dataFim || '',
    })
    setImagem(p.temImagem ? `/api/promocoes/imagem?id=${p.id}` : null)
    setImagemTocada(false)
    setModal(true)
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    try { setImagem(await comprimir(f)); setImagemTocada(true) }
    catch { feedback('Não consegui processar a imagem.') }
  }

  async function salvar() {
    if (!form.parceiroNome.trim()) return feedback('Informe o parceiro')
    if (!form.titulo.trim())       return feedback('Informe o título')
    setSalvando(true)
    try {
      const payload: any = { ...form, prioridade: Number(form.prioridade) || 0 }
      // imagem: só envia se foi trocada nesta edição (nova data URL) — evita reenviar base64 à toa
      if (imagemTocada) payload.imagem = imagem && imagem.startsWith('data:') ? imagem : null
      const url = editId ? `/api/master/promocoes/${editId}` : '/api/master/promocoes'
      const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { setModal(false); feedback(editId ? 'Oferta atualizada' : 'Oferta publicada'); carregar() }
      else { const er = await res.json().catch(() => ({})); feedback(er.error || 'Erro ao salvar') }
    } finally { setSalvando(false) }
  }

  async function toggleAtivo(p: Promo) {
    await fetch(`/api/master/promocoes/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !p.ativo }) })
    carregar()
  }
  async function remover(p: Promo) {
    if (!confirm(`Excluir a oferta "${p.titulo}"?`)) return
    await fetch(`/api/master/promocoes/${p.id}`, { method: 'DELETE' })
    feedback('Oferta excluída'); carregar()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <a href="/master/marketing" className="text-gray-400 hover:text-white text-sm">← Marketing</a>
            <span className="text-gray-600">/</span>
            <h1 className="text-lg font-bold flex items-center gap-2"><Tag size={18} className="text-orange-400" /> Ofertas &amp; Cupons</h1>
          </div>
          <button onClick={novo} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl">
            <Plus size={15} /> Nova oferta
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-4">Publica ofertas de parceiros de insumos. Aparecem para as artesãs em <b>Compras → Ofertas &amp; Cupons</b>.</p>

        {msg && <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-sm rounded-xl px-4 py-2.5 mb-4">{msg}</div>}

        {loading ? <p className="text-gray-500 text-sm py-10 text-center">Carregando…</p> : lista.length === 0 ? (
          <div className="border border-gray-800 rounded-2xl p-10 text-center text-gray-500 text-sm">Nenhuma oferta ainda. Clique em “Nova oferta”.</div>
        ) : (
          <div className="space-y-2">
            {lista.map(p => (
              <div key={p.id} className={`bg-gray-900 border rounded-2xl p-3.5 flex items-center gap-3 ${p.ativo ? 'border-gray-800' : 'border-gray-800/60 opacity-60'}`}>
                <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {p.temImagem
                    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`/api/promocoes/imagem?id=${p.id}`} alt="" className="max-h-12 max-w-full object-contain" />
                    : <ImageIcon size={18} className="text-gray-600" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{p.titulo}</span>
                    {p.desconto && <span className="text-[10px] font-bold bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded-full">{p.desconto}</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {p.parceiroNome} · ordem {p.prioridade} · {p.cliques} cliques
                    {p.dataFim && ` · até ${p.dataFim.split('-').reverse().join('/')}`}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleAtivo(p)} title={p.ativo ? 'Desativar' : 'Ativar'} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white">
                    {p.ativo ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                  <button onClick={() => editar(p)} title="Editar" className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"><Pencil size={15} /></button>
                  <button onClick={() => remover(p)} title="Excluir" className="p-1.5 rounded-lg hover:bg-red-900/30 text-gray-400 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="font-semibold">{editId ? 'Editar oferta' : 'Nova oferta'}</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto">
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0">
                  <label className="text-xs text-gray-400 block mb-1">Logo</label>
                  <label className="w-20 h-20 rounded-xl bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center cursor-pointer overflow-hidden hover:border-orange-500">
                    {imagem
                      ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={imagem} alt="" className="max-h-20 max-w-full object-contain" />
                      : <ImageIcon size={22} className="text-gray-600" />}
                    <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                  </label>
                  {imagem && <button onClick={() => { setImagem(null); setImagemTocada(true) }} className="text-[11px] text-red-400 mt-1">remover</button>}
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Parceiro *</label>
                    <input value={form.parceiroNome} onChange={e => setForm((f: any) => ({ ...f, parceiroNome: e.target.value }))} className={inp} placeholder="Ex.: Loja do Artesão" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Desconto (badge)</label>
                    <input value={form.desconto} onChange={e => setForm((f: any) => ({ ...f, desconto: e.target.value }))} className={inp} placeholder="Ex.: -20% · Frete grátis" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Título / chamada *</label>
                <input value={form.titulo} onChange={e => setForm((f: any) => ({ ...f, titulo: e.target.value }))} className={inp} placeholder="Ex.: 20% OFF em fitas de cetim" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))} className={inp + ' resize-none'} rows={2} placeholder="Detalhes da oferta…" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Link de compra (URL)</label>
                <input value={form.linkCompra} onChange={e => setForm((f: any) => ({ ...f, linkCompra: e.target.value }))} className={inp} placeholder="https://…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Cupom (opcional)</label>
                  <input value={form.cupom} onChange={e => setForm((f: any) => ({ ...f, cupom: e.target.value }))} className={inp} placeholder="Ex.: ARTESA20" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ordem (maior = topo)</label>
                  <input type="number" value={form.prioridade} onChange={e => setForm((f: any) => ({ ...f, prioridade: e.target.value }))} className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Válido de (opcional)</label>
                  <input type="date" value={form.dataInicio} onChange={e => setForm((f: any) => ({ ...f, dataInicio: e.target.value }))} className={inp} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Válido até (opcional)</label>
                  <input type="date" value={form.dataFim} onChange={e => setForm((f: any) => ({ ...f, dataFim: e.target.value }))} className={inp} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.ativo} onChange={e => setForm((f: any) => ({ ...f, ativo: e.target.checked }))} className="accent-orange-500" />
                Ativa (visível para as artesãs)
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                <button onClick={salvar} disabled={salvando} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {salvando ? 'Salvando…' : editId ? 'Salvar' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
