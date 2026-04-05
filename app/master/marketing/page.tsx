'use client'
// app/master/marketing/page.tsx
// Tela de gestão de marketing — controla o que aparece na tela das usuárias

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Image, Newspaper, Tag, Plus, Trash2, Eye, EyeOff,
  Save, X, Upload, Clock, ArrowUp, ArrowDown,
  CheckCircle, AlertCircle, ArrowLeft, ExternalLink
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────
interface Banner {
  id: string; titulo: string | null; imagem: string
  link: string | null; linkexterno: boolean
  ativo: boolean; ordem: number; tempoExibicao: number
}
interface Noticia {
  id: string; emoji: string; titulo: string
  descricao: string | null; link: string | null
  linkTexto: string; ativo: boolean; ordem: number
}
interface Oportunidade {
  id: string; titulo: string; descricao: string | null
  link: string | null; linkTexto: string
  cor: string; ativo: boolean; ordem: number
}

const ic = 'w-full border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-800 text-white placeholder-gray-500'

const CORES = [
  { id: 'orange', label: 'Laranja', cls: 'from-orange-500 to-amber-500' },
  { id: 'purple', label: 'Roxo',    cls: 'from-purple-500 to-indigo-600' },
  { id: 'green',  label: 'Verde',   cls: 'from-green-500 to-teal-600' },
  { id: 'blue',   label: 'Azul',    cls: 'from-blue-500 to-cyan-600' },
]
const COR_MAP: Record<string, string> = { orange:'from-orange-500 to-amber-500', purple:'from-purple-500 to-indigo-600', green:'from-green-500 to-teal-600', blue:'from-blue-500 to-cyan-600' }

type Secao = 'banners' | 'mercado' | 'oportunidades'

// ─── Helpers ──────────────────────────────────────────────────
function Msg({ msg }: { msg: { txt: string; ok: boolean } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 mb-4 ${msg.ok ? 'bg-green-900/30 border border-green-700 text-green-300' : 'bg-red-900/30 border border-red-700 text-red-300'}`}>
      {msg.ok ? <CheckCircle size={14}/> : <AlertCircle size={14}/>} {msg.txt}
    </div>
  )
}

function Toggle({ ativo, onChange }: { ativo: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} title={ativo ? 'Desativar' : 'Ativar'}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${ativo ? 'bg-green-500' : 'bg-gray-600'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${ativo ? 'translate-x-5' : 'translate-x-0.5'}`}/>
    </button>
  )
}

// ─── Página principal ─────────────────────────────────────────
export default function MarketingPage() {
  const [secao, setSecao] = useState<Secao>('banners')
  const [banners,   setBanners]   = useState<Banner[]>([])
  const [noticias,  setNoticias]  = useState<Noticia[]>([])
  const [ops,       setOps]       = useState<Oportunidade[]>([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState<{ txt: string; ok: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Forms
  const [showForm, setShowForm] = useState(false)
  const [formB, setFormB] = useState({ titulo: '', imagem: '', link: '', linkexterno: true, ativo: true, ordem: 0, tempoExibicao: 5 })
  const [formN, setFormN] = useState({ emoji: '📰', titulo: '', descricao: '', link: '', linkTexto: 'Saiba mais →', ativo: true, ordem: 0 })
  const [formO, setFormO] = useState({ titulo: '', descricao: '', link: '', linkTexto: 'Saiba mais →', cor: 'orange', ativo: true, ordem: 0 })

  function feedback(txt: string, ok: boolean) {
    setMsg({ txt, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [b, n, o] = await Promise.all([
        fetch('/api/marketing/banners').then(r => r.json()).catch(() => []),
        fetch('/api/marketing/noticias').then(r => r.json()).catch(() => []),
        fetch('/api/marketing/oportunidades').then(r => r.json()).catch(() => []),
      ])
      setBanners(Array.isArray(b) ? b : [])
      setNoticias(Array.isArray(n) ? n : [])
      setOps(Array.isArray(o) ? o : [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function handleImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { feedback('Imagem máx. 3MB', false); return }
    const reader = new FileReader()
    reader.onload = ev => setFormB(p => ({ ...p, imagem: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  // ── CRUD genérico ─────────────────────────────────────────
  async function put(url: string, body: any) {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) throw new Error((await res.json()).error || 'Erro')
  }
  async function del(url: string) {
    await fetch(url, { method: 'DELETE' })
  }

  async function toggleAtivo(url: string, ativo: boolean, reload: () => void) {
    try { await put(url, { ativo: !ativo }); reload() }
    catch (e: any) { feedback(e.message, false) }
  }

  async function moverOrdem(url: string, ordemAtual: number, direcao: 'up' | 'down', reload: () => void) {
    const novaOrdem = direcao === 'up' ? ordemAtual - 1 : ordemAtual + 1
    try { await put(url, { ordem: novaOrdem }); reload() }
    catch {}
  }

  async function excluir(url: string, reload: () => void) {
    if (!confirm('Excluir este item?')) return
    await del(url); reload()
    feedback('Removido', true)
  }

  // ── Salvar banner ─────────────────────────────────────────
  async function salvarBanner() {
    if (!formB.imagem) { feedback('Selecione uma imagem', false); return }
    try {
      const res = await fetch('/api/marketing/banners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formB) })
      if (!res.ok) throw new Error((await res.json()).error)
      setFormB({ titulo: '', imagem: '', link: '', linkexterno: true, ativo: true, ordem: 0, tempoExibicao: 5 })
      setShowForm(false); feedback('Banner adicionado!', true); carregar()
    } catch (e: any) { feedback(e.message, false) }
  }

  // ── Salvar notícia ────────────────────────────────────────
  async function salvarNoticia() {
    if (!formN.titulo.trim()) { feedback('Título obrigatório', false); return }
    try {
      const res = await fetch('/api/marketing/noticias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formN) })
      if (!res.ok) throw new Error((await res.json()).error)
      setFormN({ emoji: '📰', titulo: '', descricao: '', link: '', linkTexto: 'Saiba mais →', ativo: true, ordem: 0 })
      setShowForm(false); feedback('Notícia adicionada!', true); carregar()
    } catch (e: any) { feedback(e.message, false) }
  }

  // ── Salvar oportunidade ───────────────────────────────────
  async function salvarOportunidade() {
    if (!formO.titulo.trim()) { feedback('Título obrigatório', false); return }
    try {
      const res = await fetch('/api/marketing/oportunidades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formO) })
      if (!res.ok) throw new Error((await res.json()).error)
      setFormO({ titulo: '', descricao: '', link: '', linkTexto: 'Saiba mais →', cor: 'orange', ativo: true, ordem: 0 })
      setShowForm(false); feedback('Oportunidade adicionada!', true); carregar()
    } catch (e: any) { feedback(e.message, false) }
  }

  const SECOES: { id: Secao; label: string; icon: any; count: number }[] = [
    { id: 'banners',       label: 'Banners',         icon: Image,     count: banners.length },
    { id: 'mercado',       label: 'Novidades do Artesanato', icon: Newspaper, count: noticias.length },
    { id: 'oportunidades', label: 'Oportunidades e Descontos', icon: Tag, count: ops.length },
  ]

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <a href="/master" className="text-gray-400 hover:text-white transition">
            <ArrowLeft size={18}/>
          </a>
          <div>
            <h1 className="text-xl font-bold text-white">Gestão de Marketing</h1>
            <p className="text-sm text-gray-400 mt-0.5">Edite aqui o que aparece na tela de módulos das assinantes</p>
          </div>
        </div>

        <Msg msg={msg} />

        {/* ── Abas de seção ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {SECOES.map(s => (
            <button key={s.id} onClick={() => { setSecao(s.id); setShowForm(false) }}
              className={`flex items-center gap-3 p-4 rounded-2xl border transition text-left ${
                secao === s.id
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-gray-800 bg-gray-900 hover:border-gray-700'
              }`}>
              <s.icon size={20} className={secao === s.id ? 'text-orange-400' : 'text-gray-500'}/>
              <div>
                <p className={`text-sm font-semibold ${secao === s.id ? 'text-orange-400' : 'text-gray-300'}`}>{s.label}</p>
                <p className="text-xs text-gray-500">{s.count} item{s.count !== 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            SEÇÃO: BANNERS
        ══════════════════════════════════════════════════════ */}
        {secao === 'banners' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Banners</h2>
                <p className="text-xs text-gray-400 mt-0.5">Aparecem como carrossel de imagens abaixo dos módulos. Clicáveis com link.</p>
              </div>
              <button onClick={() => setShowForm(v => !v)}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                <Plus size={14}/> Adicionar banner
              </button>
            </div>

            {/* Formulário novo banner */}
            {showForm && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-white">Novo banner</p>
                  <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-500 hover:text-white"/></button>
                </div>
                <div className="space-y-3">
                  {/* Upload */}
                  {formB.imagem ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <img src={formB.imagem} className="w-full h-40 object-cover rounded-xl"/>
                      <button onClick={() => setFormB(p => ({ ...p, imagem: '' }))}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg">
                        <X size={12}/>
                      </button>
                      <span className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">✓ Imagem carregada</span>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full h-32 border-2 border-dashed border-gray-700 hover:border-orange-500 rounded-xl flex flex-col items-center justify-center gap-2 transition cursor-pointer">
                      <Upload size={24} className="text-gray-500"/>
                      <span className="text-sm text-gray-400">Clique para fazer upload da imagem</span>
                      <span className="text-xs text-gray-600">JPG, PNG ou GIF — máx. 3MB — Recomendado: 1200×400px</span>
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImagem} className="hidden"/>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Título (opcional)</label>
                      <input value={formB.titulo} onChange={e => setFormB(p => ({ ...p, titulo: e.target.value }))} className={ic} placeholder="Ex: Black Friday Artesã"/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1 flex items-center gap-1"><Clock size={10}/> Duração (segundos)</label>
                      <input type="number" min={2} max={30} value={formB.tempoExibicao} onChange={e => setFormB(p => ({ ...p, tempoExibicao: Number(e.target.value) }))} className={ic}/>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 block mb-1">Link ao clicar (opcional)</label>
                      <input value={formB.link} onChange={e => setFormB(p => ({ ...p, link: e.target.value }))} className={ic} placeholder="https://hotmart.com/... ou link interno"/>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                      <input type="checkbox" checked={formB.ativo} onChange={e => setFormB(p => ({ ...p, ativo: e.target.checked }))} className="accent-orange-500 w-4 h-4"/>
                      Ativo (visível para assinantes)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                      <input type="checkbox" checked={formB.linkexterno} onChange={e => setFormB(p => ({ ...p, linkexterno: e.target.checked }))} className="accent-orange-500 w-4 h-4"/>
                      Abrir link em nova aba
                    </label>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                    <button onClick={salvarBanner} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold">Salvar banner</button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de banners */}
            {loading ? <p className="text-gray-500 text-sm text-center py-8">Carregando...</p> :
             banners.length === 0 && !showForm ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <Image size={36} className="text-gray-700 mx-auto mb-3"/>
                <p className="text-gray-400 text-sm font-medium">Nenhum banner cadastrado</p>
                <p className="text-gray-600 text-xs mt-1">Clique em "Adicionar banner" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {banners.map((b, idx) => (
                  <div key={b.id} className={`bg-gray-900 border rounded-2xl overflow-hidden transition ${!b.ativo ? 'border-gray-800 opacity-50' : 'border-gray-700'}`}>
                    <div className="flex gap-4 p-4 items-center">
                      {/* Preview */}
                      <div className="w-32 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gray-800">
                        {b.imagem && <img src={b.imagem} className="w-full h-full object-cover"/>}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{b.titulo || <span className="text-gray-500 italic font-normal">Sem título</span>}</p>
                        {b.link && <p className="text-xs text-blue-400 flex items-center gap-1 mt-0.5 truncate"><ExternalLink size={10}/>{b.link}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Clock size={10}/>{b.tempoExibicao}s</span>
                          <span>Ordem: {b.ordem}</span>
                          <span className={b.ativo ? 'text-green-400' : 'text-gray-600'}>{b.ativo ? '● Visível' : '○ Oculto'}</span>
                        </div>
                      </div>
                      {/* Controles */}
                      <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                        <Toggle ativo={b.ativo} onChange={() => toggleAtivo(`/api/marketing/banners/${b.id}`, b.ativo, carregar)}/>
                        <div className="flex gap-1">
                          <button onClick={() => moverOrdem(`/api/marketing/banners/${b.id}`, b.ordem, 'up', carregar)} disabled={idx === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-20"><ArrowUp size={13}/></button>
                          <button onClick={() => moverOrdem(`/api/marketing/banners/${b.id}`, b.ordem, 'down', carregar)} disabled={idx === banners.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-20"><ArrowDown size={13}/></button>
                          <button onClick={() => excluir(`/api/marketing/banners/${b.id}`, carregar)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 size={13}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SEÇÃO: NOVIDADES DO ARTESANATO
        ══════════════════════════════════════════════════════ */}
        {secao === 'mercado' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Novidades do Artesanato</h2>
                <p className="text-xs text-gray-400 mt-0.5">Aparecem na coluna direita da tela de módulos. Notícias, tendências e dicas do mercado.</p>
              </div>
              <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                <Plus size={14}/> Adicionar notícia
              </button>
            </div>

            {/* Formulário */}
            {showForm && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-white">Nova notícia</p>
                  <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-500 hover:text-white"/></button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Emoji</label>
                      <input value={formN.emoji} onChange={e => setFormN(p => ({ ...p, emoji: e.target.value }))} className={ic + ' text-center text-xl'} maxLength={2}/>
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-gray-400 block mb-1">Título *</label>
                      <input value={formN.titulo} onChange={e => setFormN(p => ({ ...p, titulo: e.target.value }))} className={ic} placeholder="Ex: Artesanato cresce 34% no e-commerce"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descrição (opcional)</label>
                    <textarea value={formN.descricao} onChange={e => setFormN(p => ({ ...p, descricao: e.target.value }))} className={ic + ' resize-none'} rows={2} placeholder="Detalhes da notícia..."/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Link (opcional)</label>
                      <input value={formN.link} onChange={e => setFormN(p => ({ ...p, link: e.target.value }))} className={ic} placeholder="https://..."/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Texto do link</label>
                      <input value={formN.linkTexto} onChange={e => setFormN(p => ({ ...p, linkTexto: e.target.value }))} className={ic} placeholder="Saiba mais →"/>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input type="checkbox" checked={formN.ativo} onChange={e => setFormN(p => ({ ...p, ativo: e.target.checked }))} className="accent-orange-500 w-4 h-4"/>
                    Ativo (visível para assinantes)
                  </label>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                    <button onClick={salvarNoticia} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold">Salvar notícia</button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista */}
            {loading ? <p className="text-gray-500 text-sm text-center py-8">Carregando...</p> :
             noticias.length === 0 && !showForm ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <Newspaper size={36} className="text-gray-700 mx-auto mb-3"/>
                <p className="text-gray-400 text-sm font-medium">Nenhuma notícia cadastrada</p>
                <p className="text-gray-600 text-xs mt-1">Clique em "Adicionar notícia" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {noticias.map((n, idx) => (
                  <div key={n.id} className={`bg-gray-900 border rounded-2xl p-4 transition ${!n.ativo ? 'border-gray-800 opacity-50' : 'border-gray-700'}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">{n.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{n.titulo}</p>
                        {n.descricao && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.descricao}</p>}
                        {n.link && (
                          <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                            <ExternalLink size={10}/>{n.link}
                            <span className="text-orange-400 ml-1">— {n.linkTexto}</span>
                          </p>
                        )}
                        <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${n.ativo ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                          {n.ativo ? '● Visível' : '○ Oculto'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                        <Toggle ativo={n.ativo} onChange={() => toggleAtivo(`/api/marketing/noticias/${n.id}`, n.ativo, carregar)}/>
                        <div className="flex gap-1">
                          <button onClick={() => moverOrdem(`/api/marketing/noticias/${n.id}`, n.ordem, 'up', carregar)} disabled={idx === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-20"><ArrowUp size={13}/></button>
                          <button onClick={() => moverOrdem(`/api/marketing/noticias/${n.id}`, n.ordem, 'down', carregar)} disabled={idx === noticias.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-20"><ArrowDown size={13}/></button>
                          <button onClick={() => excluir(`/api/marketing/noticias/${n.id}`, carregar)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 size={13}/></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            SEÇÃO: OPORTUNIDADES E DESCONTOS
        ══════════════════════════════════════════════════════ */}
        {secao === 'oportunidades' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-white">Oportunidades e Descontos</h2>
                <p className="text-xs text-gray-400 mt-0.5">Aparecem na coluna esquerda. Use para promoções de parceiros, cursos, links de afiliado.</p>
              </div>
              <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
                <Plus size={14}/> Adicionar oportunidade
              </button>
            </div>

            {/* Formulário */}
            {showForm && (
              <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-white">Nova oportunidade</p>
                  <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-500 hover:text-white"/></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Título *</label>
                    <input value={formO.titulo} onChange={e => setFormO(p => ({ ...p, titulo: e.target.value }))} className={ic} placeholder="Ex: 20% OFF na Ladeira Bijuterias"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Descrição</label>
                    <textarea value={formO.descricao} onChange={e => setFormO(p => ({ ...p, descricao: e.target.value }))} className={ic + ' resize-none'} rows={2} placeholder="Detalhes da oferta, validade, condições..."/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Link (afiliado, site parceiro...)</label>
                      <input value={formO.link} onChange={e => setFormO(p => ({ ...p, link: e.target.value }))} className={ic} placeholder="https://hotmart.com/..."/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Texto do botão</label>
                      <input value={formO.linkTexto} onChange={e => setFormO(p => ({ ...p, linkTexto: e.target.value }))} className={ic} placeholder="Quero o desconto →"/>
                    </div>
                  </div>
                  {/* Cor do card */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-2">Cor do card</label>
                    <div className="flex gap-2 flex-wrap">
                      {CORES.map(c => (
                        <button key={c.id} type="button" onClick={() => setFormO(p => ({ ...p, cor: c.id }))}
                          className={`px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r ${c.cls} transition ${formO.cor === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : 'opacity-60 hover:opacity-90'}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                    {/* Preview */}
                    <div className={`mt-3 rounded-xl p-3 bg-gradient-to-r ${COR_MAP[formO.cor]}`}>
                      <p className="text-xs font-bold text-white">{formO.titulo || 'Título do card'}</p>
                      {formO.descricao && <p className="text-xs text-white/80 mt-0.5">{formO.descricao}</p>}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-300">
                    <input type="checkbox" checked={formO.ativo} onChange={e => setFormO(p => ({ ...p, ativo: e.target.checked }))} className="accent-orange-500 w-4 h-4"/>
                    Ativo (visível para assinantes)
                  </label>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-700 text-gray-400 py-2 rounded-xl text-sm hover:bg-gray-800">Cancelar</button>
                    <button onClick={salvarOportunidade} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-semibold">Salvar oportunidade</button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista */}
            {loading ? <p className="text-gray-500 text-sm text-center py-8">Carregando...</p> :
             ops.length === 0 && !showForm ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
                <Tag size={36} className="text-gray-700 mx-auto mb-3"/>
                <p className="text-gray-400 text-sm font-medium">Nenhuma oportunidade cadastrada</p>
                <p className="text-gray-600 text-xs mt-1">Clique em "Adicionar oportunidade" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ops.map((o, idx) => {
                  const cor = CORES.find(c => c.id === o.cor) || CORES[0]
                  return (
                    <div key={o.id} className={`rounded-2xl p-4 bg-gradient-to-r ${cor.cls} relative ${!o.ativo ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white">{o.titulo}</p>
                          {o.descricao && <p className="text-xs text-white/80 mt-0.5 leading-relaxed">{o.descricao}</p>}
                          {o.link && <p className="text-xs text-white/60 mt-1 flex items-center gap-1 truncate"><ExternalLink size={10}/>{o.link}</p>}
                          <span className="inline-block mt-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">{o.linkTexto}</span>
                          <span className={`inline-block ml-2 text-xs px-2 py-0.5 rounded-full ${o.ativo ? 'bg-white/20 text-white' : 'bg-black/20 text-white/50'}`}>
                            {o.ativo ? '● Visível' : '○ Oculto'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                          <Toggle ativo={o.ativo} onChange={() => toggleAtivo(`/api/marketing/oportunidades/${o.id}`, o.ativo, carregar)}/>
                          <div className="flex gap-1">
                            <button onClick={() => moverOrdem(`/api/marketing/oportunidades/${o.id}`, o.ordem, 'up', carregar)} disabled={idx === 0} className="p-1 text-white/50 hover:text-white disabled:opacity-20"><ArrowUp size={13}/></button>
                            <button onClick={() => moverOrdem(`/api/marketing/oportunidades/${o.id}`, o.ordem, 'down', carregar)} disabled={idx === ops.length - 1} className="p-1 text-white/50 hover:text-white disabled:opacity-20"><ArrowDown size={13}/></button>
                            <button onClick={() => excluir(`/api/marketing/oportunidades/${o.id}`, carregar)} className="p-1 text-white/50 hover:text-red-300"><Trash2 size={13}/></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-xs font-semibold text-gray-400 mb-3">📍 Onde cada conteúdo aparece na tela das assinantes</p>
          <div className="grid grid-cols-3 gap-4 text-xs text-gray-500">
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-orange-400 font-semibold mb-1">🖼️ Banners</p>
              <p>Carrossel de imagens abaixo dos módulos. Cada imagem aparece pelo tempo configurado e pode ter link clicável.</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-orange-400 font-semibold mb-1">📰 Novidades</p>
              <p>Lista de cards na coluna direita da tela. Use para tendências, dicas de mercado e notícias do artesanato.</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-orange-400 font-semibold mb-1">🏷️ Oportunidades</p>
              <p>Cards coloridos na coluna esquerda. Ideal para promoções de parceiros, cursos e links de afiliado.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
