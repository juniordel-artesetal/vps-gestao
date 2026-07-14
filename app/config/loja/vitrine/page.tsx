'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Store, Plus, Trash2, Star, ImageIcon, ChevronUp, ChevronDown, ArrowLeft, Images } from 'lucide-react'

const MAX_FOTOS = 10

async function comprimirImagem(file: File, MAX = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = () => reject(new Error('img'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('reader'))
    reader.readAsDataURL(file)
  })
}

type Colecao = { id: string; nome: string; ordem: number; ativo: boolean }
type Produto = { id: string; nome: string; lojaColecaoId: string | null; lojaOrdem: number; lojaDestaque: boolean; temImagemLoja: boolean; temImagemProduto: boolean; temPreco: boolean; fotos: number }
type Variacao = { id: string; produtoId: string; label: string; visivelLoja: boolean; temPreco: boolean; fotos: number }
type Img = { id: string; ordem: number; capa: boolean }

const inputSm = 'border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400'

type AtrOpcao = { id: string; valor: string; ordem: number }
type Atributo = { id: string; nome: string; ordem: number; opcoes: AtrOpcao[] }
type VarConfig = { id: string; label: string; visivelLoja: boolean; temPreco: boolean; mapa: Record<string, string> }
type ConfigAtributos = { atributos: Atributo[]; variacoes: VarConfig[]; indicadores: { semMapeamento: number; combosDuplicados: number } }

// ── Gestão de atributos (Fase 2): cria atributos/opções, mapeia variações e assistente ──
function AtributosProduto({ produtoId }: { produtoId: string }) {
  const [cfg, setCfg] = useState<ConfigAtributos | null>(null)
  const [novoAtr, setNovoAtr] = useState('')
  const [novaOpc, setNovaOpc] = useState<Record<string, string>>({})
  const [sugestao, setSugestao] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    try { const d = await (await fetch(`/api/config/loja/atributos?produtoId=${produtoId}`)).json(); setCfg(d) } catch {}
  }
  useEffect(() => { load() }, [produtoId])

  async function addAtributo() {
    const nome = novoAtr.trim(); if (!nome) return
    const r = await fetch('/api/config/loja/atributos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId, nome }) })
    if (!r.ok) { alert((await r.json()).error || 'Erro'); return }
    setNovoAtr(''); load()
  }
  async function delAtributo(id: string) {
    if (!confirm('Remover este atributo e seus mapeamentos?')) return
    await fetch(`/api/config/loja/atributos/${id}?tipo=atributo`, { method: 'DELETE' }); load()
  }
  async function addOpcao(atributoId: string) {
    const valor = (novaOpc[atributoId] || '').trim(); if (!valor) return
    const r = await fetch('/api/config/loja/atributos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atributoId, valor }) })
    if (!r.ok) { alert((await r.json()).error || 'Erro'); return }
    setNovaOpc(o => ({ ...o, [atributoId]: '' })); load()
  }
  async function delOpcao(id: string) {
    await fetch(`/api/config/loja/atributos/${id}?tipo=opcao`, { method: 'DELETE' }); load()
  }
  async function mapear(variacaoId: string, atributoId: string, opcaoId: string) {
    const v = cfg!.variacoes.find(x => x.id === variacaoId)!
    const mapa = { ...v.mapa, [atributoId]: opcaoId || null }
    const r = await fetch('/api/config/loja/variacao-opcoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variacaoId, mapa }) })
    if (!r.ok) { alert((await r.json()).error || 'Erro'); return }
    load()
  }
  async function sugerir() {
    setBusy(true)
    try {
      const d = await (await fetch('/api/config/loja/atributos/sugerir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId }) })).json()
      setSugestao(d)
    } finally { setBusy(false) }
  }
  async function aplicarSugestao() {
    if (!sugestao) return
    setBusy(true)
    try {
      // 1) cria atributos + opções (reaproveita os existentes por nome/valor)
      const atrIdPorNome: Record<string, string> = {}
      const opcIdPor: Record<string, string> = {} // `${nome}|${valor}` → opcaoId
      for (const a of sugestao.atributos as { nome: string; opcoes: string[] }[]) {
        let atrId = cfg?.atributos.find(x => x.nome.toLowerCase() === a.nome.toLowerCase())?.id
        if (!atrId) { const r = await fetch('/api/config/loja/atributos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId, nome: a.nome }) }); const j = await r.json(); if (!r.ok) { alert(j.error); return } atrId = j.id }
        atrIdPorNome[a.nome] = atrId!
        for (const valor of a.opcoes) {
          const r = await fetch('/api/config/loja/atributos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ atributoId: atrId, valor }) })
          const j = await r.json()
          opcIdPor[`${a.nome}|${valor}`] = r.ok ? j.id : ''
        }
      }
      // resolve ids também para opções que já existiam (POST devolveu 409). Recarrega config.
      const cfgAtual: ConfigAtributos = await (await fetch(`/api/config/loja/atributos?produtoId=${produtoId}`)).json()
      const opcIdReal = (nome: string, valor: string) => {
        const atr = cfgAtual.atributos.find(x => x.nome.toLowerCase() === nome.toLowerCase())
        return atr?.opcoes.find(o => o.valor.toLowerCase() === String(valor).toLowerCase())?.id || ''
      }
      // 2) aplica mapeamento por variação
      for (const [variacaoId, m] of Object.entries(sugestao.mapeamento as Record<string, Record<string, string>>)) {
        const mapa: Record<string, string> = {}
        for (const [nomeAtr, valor] of Object.entries(m)) {
          const atrId = cfgAtual.atributos.find(x => x.nome.toLowerCase() === nomeAtr.toLowerCase())?.id
          const opId = opcIdReal(nomeAtr, valor)
          if (atrId && opId) mapa[atrId] = opId
        }
        if (Object.keys(mapa).length) await fetch('/api/config/loja/variacao-opcoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ variacaoId, mapa }) })
      }
      setSugestao(null); load()
    } finally { setBusy(false) }
  }

  if (!cfg) return <p className="text-[11px] text-gray-400">Carregando atributos…</p>

  const podeAddAtr = cfg.atributos.length < 2
  return (
    <div className="space-y-3">
      {/* Atributos + opções */}
      <div className="space-y-2">
        {cfg.atributos.map(a => (
          <div key={a.id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-1">{a.nome}</span>
              <button onClick={() => delAtributo(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {a.opcoes.map(o => (
                <span key={o.id} className="inline-flex items-center gap-1 text-[11px] bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5">
                  {o.valor}<button onClick={() => delOpcao(o.id)} className="text-orange-300 hover:text-red-500">×</button>
                </span>
              ))}
              <input value={novaOpc[a.id] || ''} onChange={e => setNovaOpc(x => ({ ...x, [a.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addOpcao(a.id) }} placeholder="+ opção"
                className={inputSm + ' w-24 !py-0.5 text-[11px]'} />
            </div>
          </div>
        ))}
        {podeAddAtr && (
          <div className="flex gap-2">
            <input value={novoAtr} onChange={e => setNovoAtr(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addAtributo() }}
              placeholder="Novo atributo (ex.: Tamanho, Quantidade)" className={inputSm + ' flex-1'} />
            <button onClick={addAtributo} className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-xs font-semibold">Add</button>
          </div>
        )}
        <button onClick={sugerir} disabled={busy} className="text-xs text-orange-600 hover:underline disabled:opacity-50">✨ Sugerir atributos automaticamente</button>
      </div>

      {/* Rascunho da sugestão */}
      {sugestao && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs">
          <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Sugestão (rascunho — nada foi aplicado)</p>
          {(sugestao.atributos || []).length === 0 ? (
            <p className="text-gray-500">Não consegui reconhecer atributos pelos nomes das variações.</p>
          ) : (
            <>
              {(sugestao.atributos || []).map((a: any) => (
                <p key={a.nome} className="text-gray-600 dark:text-gray-300"><strong>{a.nome}:</strong> {a.opcoes.join(', ')}</p>
              ))}
              {(sugestao.naoReconhecidas || []).length > 0 && <p className="text-amber-600 mt-1">{sugestao.naoReconhecidas.length} variação(ões) sem reconhecimento — mapeie à mão.</p>}
              <div className="flex gap-2 mt-2">
                <button onClick={aplicarSugestao} disabled={busy} className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50">Aplicar sugestão</button>
                <button onClick={() => setSugestao(null)} className="px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-gray-500">Descartar</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Indicadores */}
      {cfg.atributos.length > 0 && (cfg.indicadores.semMapeamento > 0 || cfg.indicadores.combosDuplicados > 0) && (
        <p className="text-[11px] text-amber-600">
          {cfg.indicadores.semMapeamento > 0 && `${cfg.indicadores.semMapeamento} variação(ões) sem mapeamento completo. `}
          {cfg.indicadores.combosDuplicados > 0 && `${cfg.indicadores.combosDuplicados} combinação(ões) duplicada(s).`}
        </p>
      )}

      {/* Mapeamento variação → combinação */}
      {cfg.atributos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-gray-400 text-left">
              <th className="py-1 pr-2">Variação</th>
              {cfg.atributos.map(a => <th key={a.id} className="py-1 px-1">{a.nome}</th>)}
            </tr></thead>
            <tbody>
              {cfg.variacoes.map(v => (
                <tr key={v.id} className="border-t border-gray-50 dark:border-gray-700/50">
                  <td className="py-1 pr-2 text-gray-600 dark:text-gray-300">{v.label}{!v.temPreco && <span className="text-red-400"> (sem preço)</span>}</td>
                  {cfg.atributos.map(a => (
                    <td key={a.id} className="py-1 px-1">
                      <select value={v.mapa[a.id] || ''} onChange={e => mapear(v.id, a.id, e.target.value)} className={inputSm + ' !py-0.5 text-[11px]'}>
                        <option value="">—</option>
                        {a.opcoes.map(o => <option key={o.id} value={o.id}>{o.valor}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Galeria (até 10 fotos) de um dono: produto OU variação ──
function Galeria({ tipo, id, onCount }: { tipo: 'produto' | 'variacao'; id: string; onCount?: (n: number) => void }) {
  const [imgs, setImgs] = useState<Img[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const d = await (await fetch(`/api/config/loja/imagens?tipo=${tipo}&id=${id}`)).json()
      const lista: Img[] = Array.isArray(d.imagens) ? d.imagens : []
      setImgs(lista); onCount?.(lista.length)
    } catch { /* silencioso */ }
  }
  useEffect(() => { load() }, [tipo, id])

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (imgs.length >= MAX_FOTOS) { alert(`Máximo de ${MAX_FOTOS} fotos.`); return }
    setBusy(true)
    try {
      const b64 = await comprimirImagem(file, 500)
      const r = await fetch('/api/config/loja/imagens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, id, imagem: b64 }) })
      if (!r.ok) alert((await r.json()).error || 'Erro ao enviar a foto')
      else await load()
    } catch { alert('Não consegui processar a imagem.') }
    finally { setBusy(false) }
  }
  async function remover(imgId: string) {
    await fetch(`/api/config/loja/imagens/${imgId}`, { method: 'DELETE' }); load()
  }
  async function definirCapa(imgId: string) {
    await fetch(`/api/config/loja/imagens/${imgId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capa: true }) }); load()
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2">
        {imgs.map(im => (
          <div key={im.id} className="relative group">
            <img src={`/api/config/loja/imagens/${im.id}`} alt="" className={`w-14 h-14 object-cover rounded-lg border ${im.capa ? 'border-orange-400 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-600'}`} />
            {im.capa && <span className="absolute -top-1 -left-1 text-[8px] font-bold bg-orange-500 text-white px-1 rounded-full">capa</span>}
            <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg transition">
              {!im.capa && <button onClick={() => definirCapa(im.id)} title="Definir como capa" className="text-white hover:text-orange-300"><Star size={13} /></button>}
              <button onClick={() => remover(im.id)} title="Remover" className="text-white hover:text-red-300"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {imgs.length < MAX_FOTOS && (
          <label className={`w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer text-gray-400 hover:text-orange-500 hover:border-orange-400 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
            {busy ? '...' : <Plus size={16} />}
            <input type="file" accept="image/*" className="hidden" onChange={upload} />
          </label>
        )}
      </div>
      <p className="text-[10px] text-gray-400 mt-1">{imgs.length}/{MAX_FOTOS} fotos</p>
    </div>
  )
}

export default function VitrinePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [colecoes, setColecoes] = useState<Colecao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [variacoes, setVariacoes] = useState<Variacao[]>([])
  const [novaColecao, setNovaColecao] = useState('')
  const [ok, setOk] = useState('')
  const [expandido, setExpandido] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/modulos')
      else carregar()
    }
  }, [status])

  async function carregar() {
    try {
      const d = await (await fetch('/api/config/loja/vitrine')).json()
      setColecoes(Array.isArray(d.colecoes) ? d.colecoes : [])
      setProdutos(Array.isArray(d.produtos) ? d.produtos : [])
      setVariacoes(Array.isArray(d.variacoes) ? d.variacoes : [])
    } finally { setLoading(false) }
  }

  function flash(m: string) { setOk(m); setTimeout(() => setOk(''), 1800) }

  // ── Coleções ──
  async function addColecao() {
    if (!novaColecao.trim()) return
    await fetch('/api/config/loja/colecoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: novaColecao.trim() }) })
    setNovaColecao(''); carregar(); flash('Coleção criada')
  }
  async function renomearColecao(c: Colecao, nome: string) {
    setColecoes(cs => cs.map(x => x.id === c.id ? { ...x, nome } : x))
    await fetch(`/api/config/loja/colecoes/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome }) })
  }
  async function moverColecao(c: Colecao, dir: -1 | 1) {
    const idx = colecoes.findIndex(x => x.id === c.id)
    const j = idx + dir
    if (j < 0 || j >= colecoes.length) return
    const outro = colecoes[j]
    await Promise.all([
      fetch(`/api/config/loja/colecoes/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordem: outro.ordem }) }),
      fetch(`/api/config/loja/colecoes/${outro.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordem: c.ordem }) }),
    ])
    carregar()
  }
  async function removerColecao(c: Colecao) {
    if (!confirm(`Remover a coleção "${c.nome}"? Os produtos ficam sem coleção.`)) return
    await fetch(`/api/config/loja/colecoes/${c.id}`, { method: 'DELETE' })
    carregar(); flash('Coleção removida')
  }

  // ── Produtos ──
  async function setProduto(prodId: string, patch: Partial<Produto> & { imagemLoja?: string | null }) {
    setProdutos(ps => ps.map(p => p.id === prodId ? { ...p, ...patch, ...(patch.imagemLoja !== undefined ? { temImagemLoja: !!patch.imagemLoja } : {}) } as Produto : p))
    await fetch(`/api/config/loja/vitrine/${prodId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
  }
  async function subirImagemLoja(prodId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try { const b64 = await comprimirImagem(file, 400); await setProduto(prodId, { imagemLoja: b64 }); flash('Imagem da loja salva') }
    catch { alert('Não consegui processar a imagem.') }
  }

  // ── Variações ──
  async function toggleVariacao(v: Variacao) {
    const novo = !v.visivelLoja
    setVariacoes(vs => vs.map(x => x.id === v.id ? { ...x, visivelLoja: novo } : x))
    await fetch(`/api/config/loja/vitrine/variacao/${v.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visivelLoja: novo }) })
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto p-6">
        <a href="/config/loja" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"><ArrowLeft size={12} /> Voltar para a loja</a>
        <div className="flex items-center gap-2 mb-1">
          <Store className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Gestão da Vitrine</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Coleções, ordem, destaques, quais configurações vão à loja e a galeria de fotos.</p>
        {ok && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 mb-4 text-sm text-green-700">✓ {ok}</div>}

        {/* Coleções */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Coleções</p>
          <div className="flex gap-2 mb-3">
            <input value={novaColecao} onChange={e => setNovaColecao(e.target.value)} placeholder="Nova coleção (ex: Lançamentos)" className={inputSm + ' flex-1'} />
            <button onClick={addColecao} className="px-3 py-1 bg-orange-500 text-white rounded-lg text-sm font-semibold flex items-center gap-1"><Plus size={14} /> Criar</button>
          </div>
          {colecoes.length === 0 ? <p className="text-xs text-gray-400">Nenhuma coleção ainda. Sem coleção, os produtos aparecem em "Produtos".</p> : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {colecoes.map((c, i) => (
                <div key={c.id} className="flex items-center gap-2 py-2">
                  <div className="flex flex-col">
                    <button onClick={() => moverColecao(c, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronUp size={12} /></button>
                    <button onClick={() => moverColecao(c, 1)} disabled={i === colecoes.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20"><ChevronDown size={12} /></button>
                  </div>
                  <input value={c.nome} onChange={e => renomearColecao(c, e.target.value)} className={inputSm + ' flex-1'} />
                  <button onClick={() => removerColecao(c)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Produtos */}
        <div data-tour="vitrine-produtos" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Produtos na loja ({produtos.length})</p>
          <p className="text-[11px] text-gray-400 mb-3">Clique em <span className="font-semibold text-orange-500">Fotos e configurações</span> em cada produto para escolher quais configurações (variações) aparecem na loja e subir as fotos (até {MAX_FOTOS} por produto e por configuração).</p>
          {produtos.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum produto marcado como "Na loja". Marque em Precificação → Produtos.</p>
          ) : (
            <div className="space-y-3">
              {produtos.map(p => {
                const vars = variacoes.filter(v => v.produtoId === p.id)
                const visiveis = vars.filter(v => v.visivelLoja && v.temPreco).length
                const aberto = !!expandido[p.id]
                return (
                  <div key={p.id} className="pb-3 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-white flex-1 min-w-[140px]">
                        {p.nome}
                        {!p.temPreco && <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-200" title="Defina um preço de venda em Precificação → Produtos">⚠ Sem preço</span>}
                        {p.temPreco && vars.length > 0 && (
                          <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${visiveis === 0 ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                            {visiveis}/{vars.length} config. na loja
                          </span>
                        )}
                      </span>
                      <select value={p.lojaColecaoId || ''} onChange={e => setProduto(p.id, { lojaColecaoId: e.target.value || null })} className={inputSm}>
                        <option value="">Sem coleção</option>
                        {colecoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      <input type="number" value={p.lojaOrdem} onChange={e => setProduto(p.id, { lojaOrdem: Number(e.target.value) || 0 })} title="Ordem" className={inputSm + ' w-16'} />
                      <button onClick={() => setProduto(p.id, { lojaDestaque: !p.lojaDestaque })} title="Destaque"
                        className={`p-1.5 rounded-lg border ${p.lojaDestaque ? 'bg-amber-50 border-amber-300 text-amber-500' : 'border-gray-200 text-gray-300'}`}>
                        <Star size={14} fill={p.lojaDestaque ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => setExpandido(s => ({ ...s, [p.id]: !aberto }))}
                        title="Escolher configurações na loja e subir fotos"
                        className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition ${aberto ? 'bg-orange-500 border-orange-500 text-white' : 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'}`}>
                        <Images size={14} /> Fotos e configurações {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {aberto && (
                      <div className="mt-3 ml-1 pl-3 border-l-2 border-orange-100 dark:border-orange-900/40 space-y-3">
                        {/* Galeria do produto */}
                        <div>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold text-gray-500">Galeria do produto (até {MAX_FOTOS})</p>
                            <label title="Imagem simples da loja (legado — usada só se não houver galeria)"
                              className={`text-[10px] flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded border ${p.temImagemLoja ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-gray-200 text-gray-400 hover:text-orange-500'}`}>
                              <ImageIcon size={11} /> {p.temImagemLoja ? 'imagem simples ✓' : 'imagem simples'}
                              <input type="file" accept="image/*" className="hidden" onChange={e => subirImagemLoja(p.id, e)} />
                            </label>
                          </div>
                          <Galeria tipo="produto" id={p.id} />
                        </div>
                        {/* Variações: visibilidade + galeria */}
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 mb-1">Configurações (variações) na loja</p>
                          {vars.length === 0 ? (
                            <p className="text-[11px] text-gray-400">Este produto não tem variações com preço.</p>
                          ) : (
                            <div className="space-y-2">
                              {vars.map(v => (
                                <div key={v.id} className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-2">
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer flex-1">
                                      <input type="checkbox" checked={v.visivelLoja} disabled={!v.temPreco} onChange={() => toggleVariacao(v)} className="accent-orange-500 w-3.5 h-3.5" />
                                      {v.label}
                                      {!v.temPreco && <span className="text-[10px] text-red-400">(sem preço)</span>}
                                    </label>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${v.visivelLoja ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                                      {v.visivelLoja ? 'na loja' : 'oculta'}
                                    </span>
                                  </div>
                                  <div className="pl-5">
                                    <p className="text-[10px] text-gray-400">Fotos desta configuração (opcional — senão usa a galeria do produto)</p>
                                    <Galeria tipo="variacao" id={v.id} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Opções de compra (atributos) — 1 card por produto na loja */}
                        {vars.length > 1 && (
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 mb-1">Opções de compra (Tamanho, Quantidade…)</p>
                            <p className="text-[10px] text-gray-400 mb-2">Com atributos, este produto vira <strong>1 card só</strong> na loja, com seletor. Sem atributos, cada configuração continua um card.</p>
                            <AtributosProduto produtoId={p.id} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-3">Menor número = aparece primeiro. Fallback da foto: variação → produto → estoque → padrão. A 1ª foto vira a capa; clique na ★ para trocar.</p>
        </div>
      </div>
    </div>
  )
}
