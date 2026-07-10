'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShoppingBag, Plus, Minus, X, Store, MapPin, CheckCircle2, Search, SlidersHorizontal, Copy, Check, QrCode, ExternalLink, Upload } from 'lucide-react'

// Compressão client-side (400px / JPEG 70%) — comprovante de pagamento
async function comprimirImagem(file: File, MAX = 800): Promise<string> {
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

const METODO_LABEL: Record<string, string> = { pix: 'PIX', link: 'Link de pagamento', mercadopago: 'PIX (Mercado Pago)' }

type Item = {
  variacaoId: string; nome: string; variacao: string | null; descricao: string | null
  preco: number; precoOriginal: number | null; emPromo: boolean; temImagem: boolean
  saldo: number | null; fonte: string; colecaoId: string | null; ordem: number; destaque: boolean
  esgotado?: boolean; rastreiaEstoque?: boolean
}
type Colecao = { id: string; nome: string; ordem: number }
type Loja = {
  slug: string; nome: string; logo: string | null; corPrimaria: string; descricao: string | null
  textoBoasVindas: string | null; temBanner: boolean
  whatsapp: string | null; instagram: string | null; cidade: string | null; estado: string | null
  freteTipo: string; freteValor: number; metodosPagamento: string[]
}

const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LojaPublicaPage() {
  const params = useParams()
  const slug = String(params?.slug || '')

  const [loading, setLoading] = useState(true)
  const [disponivel, setDisponivel] = useState(true)
  const [loja, setLoja] = useState<Loja | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [colecoes, setColecoes] = useState<Colecao[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ numero: string; total: number } | null>(null)
  const [form, setForm] = useState({ nome: '', telefone: '', entrega: false, endereco: '', observacoes: '' })
  // Pagamento (Fase 3)
  const [pagamento, setPagamento] = useState<{ numero: string; total: number } | null>(null)
  const [pagData, setPagData] = useState<{ tipo: string; copiaECola?: string | null; qrBase64?: string | null; url?: string | null } | null>(null)
  const [pagLoading, setPagLoading] = useState(false)
  const [pagErro, setPagErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [comprovanteEnviado, setComprovanteEnviado] = useState(false)
  // Vitrine (e-commerce)
  const [filtro, setFiltro] = useState<string>('todos')     // 'todos' | 'destaques' | 'sem' | colecaoId
  const [busca, setBusca] = useState('')
  const [ordenacao, setOrdenacao] = useState<'relevancia' | 'preco_asc' | 'preco_desc'>('relevancia')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [detalhe, setDetalhe] = useState<Item | null>(null)
  // Galeria do detalhe (ids de imagem servidos sob demanda)
  const [galeria, setGaleria] = useState<string[]>([])
  const [imgAtiva, setImgAtiva] = useState(0)

  useEffect(() => {
    setGaleria([]); setImgAtiva(0)
    if (!detalhe) return
    let cancel = false
    fetch(`/api/loja/${slug}/galeria/${detalhe.variacaoId}`)
      .then(r => r.ok ? r.json() : { imagens: [] })
      .then(d => { if (!cancel) setGaleria(Array.isArray(d.imagens) ? d.imagens : []) })
      .catch(() => {})
    return () => { cancel = true }
  }, [detalhe, slug])

  useEffect(() => {
    fetch(`/api/loja/${slug}`).then(async r => {
      if (!r.ok) { setDisponivel(false); setLoading(false); return }
      const d = await r.json()
      if (!d.disponivel) { setDisponivel(false); setLoading(false); return }
      setLoja(d.loja); setItens(d.itens || []); setColecoes(d.colecoes || []); setLoading(false)
    }).catch(() => { setDisponivel(false); setLoading(false) })
  }, [slug])

  const cor = loja?.corPrimaria || '#f97316'
  const podeEntrega = loja ? loja.freteTipo !== 'retirada' : false
  const freteAplicado = form.entrega && loja?.freteTipo === 'fixo' ? (loja?.freteValor || 0) : 0

  const itensCarrinho = useMemo(
    () => itens.filter(i => (cart[i.variacaoId] || 0) > 0).map(i => ({ ...i, qtd: cart[i.variacaoId] })),
    [itens, cart]
  )
  const subtotal = itensCarrinho.reduce((s, i) => s + i.preco * i.qtd, 0)
  const totalItens = itensCarrinho.reduce((s, i) => s + i.qtd, 0)
  const total = subtotal + freteAplicado

  const add = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const sub = (id: string) => setCart(c => { const n = (c[id] || 0) - 1; const nc = { ...c }; if (n <= 0) delete nc[id]; else nc[id] = n; return nc })

  const semColecao = (i: Item) => !i.colecaoId || !colecoes.some(c => c.id === i.colecaoId)

  // Categorias (menu lateral) com contagem
  const categorias = useMemo(() => {
    const cats: { key: string; nome: string; count: number }[] = [{ key: 'todos', nome: 'Todos os produtos', count: itens.length }]
    const nDest = itens.filter(i => i.destaque).length
    if (nDest > 0) cats.push({ key: 'destaques', nome: '★ Destaques', count: nDest })
    for (const c of colecoes) {
      const n = itens.filter(i => i.colecaoId === c.id).length
      if (n > 0) cats.push({ key: c.id, nome: c.nome, count: n })
    }
    const nSem = itens.filter(semColecao).length
    if (nSem > 0 && colecoes.length > 0) cats.push({ key: 'sem', nome: 'Outros', count: nSem })
    return cats
  }, [itens, colecoes])

  // Lista filtrada + ordenada
  const listaFiltrada = useMemo(() => {
    let list = itens
    if (filtro === 'destaques') list = list.filter(i => i.destaque)
    else if (filtro === 'sem') list = list.filter(semColecao)
    else if (filtro !== 'todos') list = list.filter(i => i.colecaoId === filtro)
    const q = busca.trim().toLowerCase()
    if (q) list = list.filter(i => i.nome.toLowerCase().includes(q) || (i.descricao || '').toLowerCase().includes(q))
    if (ordenacao === 'preco_asc') list = [...list].sort((a, b) => a.preco - b.preco)
    else if (ordenacao === 'preco_desc') list = [...list].sort((a, b) => b.preco - a.preco)
    return list
  }, [itens, colecoes, filtro, busca, ordenacao])

  const imgUrl = (id: string) => `/api/loja/${slug}/imagem/${id}`

  // Card de produto — clicável (abre detalhe) + botão adicionar
  const renderCard = (item: Item) => {
    const qtd = cart[item.variacaoId] || 0
    return (
      <div key={item.variacaoId} className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition group">
        <button onClick={() => setDetalhe(item)} className="text-left">
          <div className="aspect-square bg-gray-100 flex items-center justify-center relative">
            {item.destaque && <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white z-10" style={{ backgroundColor: cor }}>★ Destaque</span>}
            {item.esgotado ? (
              <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-700 text-white z-10">Esgotado</span>
            ) : item.emPromo && item.precoOriginal && (
              <span className="absolute top-1.5 right-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500 text-white z-10">
                -{Math.round((1 - item.preco / item.precoOriginal) * 100)}%
              </span>
            )}
            {item.temImagem ? (
              <img loading="lazy" src={imgUrl(item.variacaoId)} alt={item.nome} className={`w-full h-full object-cover group-hover:scale-[1.02] transition ${item.esgotado ? 'opacity-50' : ''}`} />
            ) : <ShoppingBag className="w-8 h-8 text-gray-300" />}
          </div>
        </button>
        <div className="p-3 flex flex-col flex-1">
          <button onClick={() => setDetalhe(item)} className="text-left">
            <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2 hover:text-gray-600">{item.nome}</p>
            {item.variacao && <p className="text-xs text-gray-400 mt-0.5">{item.variacao}</p>}
            {item.descricao && <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{item.descricao}</p>}
          </button>
          <div className="mt-2 mb-2">
            {item.emPromo && item.precoOriginal ? (
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold" style={{ color: cor }}>{brl(item.preco)}</span>
                <span className="text-xs text-gray-400 line-through">{brl(item.precoOriginal)}</span>
              </div>
            ) : <span className="text-lg font-bold" style={{ color: cor }}>{brl(item.preco)}</span>}
            {item.saldo != null && !item.esgotado && <span className="block text-[10px] text-gray-400">{item.saldo} a pronta entrega</span>}
          </div>
          <div className="mt-auto">
            {item.esgotado ? (
              <button disabled className="w-full py-2 rounded-lg text-gray-400 bg-gray-100 text-xs font-semibold cursor-not-allowed">Esgotado</button>
            ) : qtd === 0 ? (
              <button onClick={() => add(item.variacaoId)} className="w-full py-2 rounded-lg text-white text-xs font-semibold flex items-center justify-center gap-1" style={{ backgroundColor: cor }}>
                <ShoppingBag size={13} /> Adicionar
              </button>
            ) : (
              <div className="flex items-center justify-between">
                <button onClick={() => sub(item.variacaoId)} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center"><Minus size={14} /></button>
                <span className="text-sm font-semibold">{qtd}</span>
                <button onClick={() => add(item.variacaoId)} disabled={item.saldo != null && qtd >= item.saldo} className="w-8 h-8 rounded-lg text-white flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: cor }}><Plus size={14} /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  async function enviar() {
    setErro('')
    if (!form.nome.trim()) return setErro('Informe seu nome.')
    if (!form.telefone.trim()) return setErro('Informe seu WhatsApp.')
    if (form.entrega && !form.endereco.trim()) return setErro('Informe o endereço de entrega.')
    setEnviando(true)
    try {
      const res = await fetch(`/api/loja/${slug}/pedido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome, telefone: form.telefone, entrega: form.entrega,
          endereco: form.endereco, observacoes: form.observacoes,
          itens: itensCarrinho.map(i => ({ variacaoId: i.variacaoId, quantidade: i.qtd })),
        }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.error || 'Erro ao enviar o pedido.'); return }
      setCart({}); setCheckout(false); setCarrinhoAberto(false)
      // Se a loja tem pagamento online, vai para o passo de pagamento; senão, sucesso.
      if ((loja?.metodosPagamento?.length || 0) > 0) {
        setPagamento({ numero: d.numero, total: d.total }); setPagData(null); setComprovanteEnviado(false); setPagErro('')
      } else {
        setSucesso({ numero: d.numero, total: d.total })
      }
    } finally { setEnviando(false) }
  }

  async function iniciarPagamento(metodo: string) {
    if (!pagamento) return
    setPagLoading(true); setPagErro('')
    try {
      const res = await fetch(`/api/loja/${slug}/pagamento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: pagamento.numero, metodo }),
      })
      const d = await res.json()
      if (!res.ok) { setPagErro(d.error || 'Não foi possível iniciar o pagamento.'); return }
      setPagData({ tipo: d.tipo, copiaECola: d.copiaECola, qrBase64: d.qrBase64, url: d.url })
      if (d.tipo === 'link' && d.url) window.open(d.url, '_blank')
    } finally { setPagLoading(false) }
  }

  async function enviarComprovante(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !pagamento) return
    try {
      const b64 = await comprimirImagem(file)
      await fetch(`/api/loja/${slug}/pagamento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: pagamento.numero, comprovante: b64 }),
      })
      setComprovanteEnviado(true)
    } catch { setPagErro('Não consegui enviar o comprovante.') }
  }

  const copiarPix = (txt: string) => navigator.clipboard.writeText(txt).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  if (!disponivel || !loja) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <Store className="w-12 h-12 text-gray-300 mb-3" />
      <h1 className="text-lg font-semibold text-gray-700">Loja indisponível</h1>
      <p className="text-sm text-gray-400 mt-1">Esta loja não existe ou está fora do ar no momento.</p>
    </div>
  )

  if (pagamento && !sucesso) return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 mt-6 overflow-hidden">
        <div className="p-5 text-white" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}dd)` }}>
          <p className="text-xs text-white/80">Pedido {pagamento.numero}</p>
          <h1 className="text-lg font-bold">Pagamento · {brl(pagamento.total)}</h1>
        </div>
        <div className="p-5 space-y-4">
          {pagErro && <p className="text-sm text-red-500">{pagErro}</p>}

          {!pagData ? (
            <>
              <p className="text-sm text-gray-600">Como você quer pagar?</p>
              {loja.metodosPagamento.map(mtd => (
                <button key={mtd} onClick={() => iniciarPagamento(mtd)} disabled={pagLoading}
                  className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 hover:border-orange-300 disabled:opacity-50">
                  <span className="text-sm font-medium text-gray-800">{METODO_LABEL[mtd] || mtd}</span>
                  <span className="text-orange-500">→</span>
                </button>
              ))}
            </>
          ) : pagData.tipo === 'link' ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-600">Você foi levado à página de pagamento. Se não abriu, use o botão abaixo.</p>
              {pagData.url && <a href={pagData.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: cor }}><ExternalLink size={14} /> Abrir pagamento</a>}
            </div>
          ) : (
            <div className="space-y-3">
              {pagData.qrBase64 && (
                <div className="flex justify-center"><img src={pagData.qrBase64} alt="QR PIX" className="w-44 h-44" /></div>
              )}
              {pagData.copiaECola && (
                <div>
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><QrCode size={12} /> PIX copia e cola</p>
                  <div className="flex gap-2">
                    <input readOnly value={pagData.copiaECola} className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-xs text-gray-600 bg-gray-50" />
                    <button onClick={() => copiarPix(pagData.copiaECola!)} className="px-3 rounded-lg text-white text-xs font-semibold flex items-center gap-1" style={{ backgroundColor: cor }}>{copiado ? <><Check size={12} /> </> : <><Copy size={12} /></>}Copiar</button>
                  </div>
                </div>
              )}
              {pagData.tipo === 'mercadopago' ? (
                <p className="text-xs text-center text-gray-500">Assim que o pagamento cair, a loja confirma automaticamente. 💚</p>
              ) : (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-2">Depois de pagar, envie o comprovante (opcional):</p>
                  {comprovanteEnviado ? (
                    <p className="text-sm text-green-600 flex items-center gap-1"><Check size={14} /> Comprovante enviado!</p>
                  ) : (
                    <label className="inline-flex items-center gap-2 text-sm border border-gray-200 rounded-lg px-3 py-2 cursor-pointer hover:border-orange-300">
                      <Upload size={14} /> Anexar comprovante
                      <input type="file" accept="image/*" className="hidden" onChange={enviarComprovante} />
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          <button onClick={() => setSucesso(pagamento)} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            {pagData ? 'Já paguei / Concluir' : 'Pagar depois'}
          </button>
        </div>
      </div>
    </div>
  )

  if (sucesso) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <CheckCircle2 className="w-14 h-14 mb-3" style={{ color: cor }} />
      <h1 className="text-xl font-bold text-gray-800">Pedido enviado! 🎉</h1>
      <p className="text-sm text-gray-500 mt-2">Seu pedido <strong>{sucesso.numero}</strong> foi recebido por {loja.nome}.</p>
      <p className="text-sm text-gray-500">Total: <strong>{brl(sucesso.total)}</strong> — o pagamento é combinado direto com a loja.</p>
      {loja.whatsapp && (
        <a href={`https://wa.me/55${loja.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
          className="mt-5 px-5 py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: cor }}>
          Falar no WhatsApp
        </a>
      )}
      <button onClick={() => setSucesso(null)} className="mt-3 text-sm text-gray-400 hover:text-gray-600">Voltar à loja</button>
    </div>
  )

  const tituloSecao = categorias.find(c => c.key === filtro)?.nome || 'Produtos'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar (sticky) ── */}
      <header className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            {loja.logo && <img src={loja.logo} alt={loja.nome} className="w-9 h-9 rounded-lg object-cover" />}
            <span className="font-bold text-gray-800 text-sm sm:text-base truncate max-w-[38vw]">{loja.nome}</span>
          </div>
          <div className="flex-1 hidden sm:block">
            <div className="relative max-w-lg mx-auto">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="busque um produto"
                className="w-full bg-gray-100 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: cor }} />
            </div>
          </div>
          <button onClick={() => setCarrinhoAberto(true)} className="relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100">
            <ShoppingBag size={20} className="text-gray-700" />
            {totalItens > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: cor }}>{totalItens}</span>}
          </button>
        </div>
        {/* Busca mobile */}
        <div className="sm:hidden px-4 pb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="busque um produto"
              className="w-full bg-gray-100 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none" />
          </div>
        </div>
      </header>

      {/* Banner / capa */}
      {loja.temBanner && (
        <div className="w-full overflow-hidden">
          <img src={`/api/loja/${slug}/banner`} alt="" className="w-full h-36 md:h-52 object-cover" />
        </div>
      )}

      {/* Hero / boas-vindas */}
      {(loja.descricao || loja.textoBoasVindas || loja.cidade) && (
        <div className="text-white" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}dd)` }}>
          <div className="max-w-6xl mx-auto px-4 py-5">
            {loja.descricao && <p className="text-sm text-white/95 max-w-2xl">{loja.descricao}</p>}
            {loja.textoBoasVindas && <p className="text-sm text-white/85 mt-1 max-w-2xl">{loja.textoBoasVindas}</p>}
            {(loja.cidade || loja.estado) && <p className="text-xs text-white/70 mt-1.5 flex items-center gap-1"><MapPin size={11} /> {[loja.cidade, loja.estado].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
      )}

      {/* ── Corpo: sidebar + grade ── */}
      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6 items-start">

        {/* Sidebar categorias (desktop) */}
        <aside className="hidden md:block w-52 flex-shrink-0">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Categorias</p>
          <ul className="space-y-0.5">
            {categorias.map(c => (
              <li key={c.key}>
                <button onClick={() => setFiltro(c.key)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm transition ${filtro === c.key ? 'font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
                  style={filtro === c.key ? { backgroundColor: `${cor}18`, color: cor } : {}}>
                  <span className="truncate">{c.nome}</span>
                  <span className="text-xs text-gray-400 ml-2">({c.count})</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conteúdo principal */}
        <main className="flex-1 min-w-0">
          {/* Barra: título + contagem + filtro mobile + ordenação */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{tituloSecao}</h2>
              <p className="text-xs text-gray-400">{listaFiltrada.length} produto{listaFiltrada.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setFiltrosAbertos(true)} className="md:hidden flex items-center gap-1 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5">
                <SlidersHorizontal size={14} /> Categorias
              </button>
              <select value={ordenacao} onChange={e => setOrdenacao(e.target.value as any)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none">
                <option value="relevancia">Ordenar: relevância</option>
                <option value="preco_asc">Menor preço</option>
                <option value="preco_desc">Maior preço</option>
              </select>
            </div>
          </div>

          {itens.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">Ainda não há produtos disponíveis nesta loja.</p>
          ) : listaFiltrada.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-16">Nenhum produto encontrado{busca ? ` para "${busca}"` : ''}.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {listaFiltrada.map(renderCard)}
            </div>
          )}
        </main>
      </div>

      {/* Drawer categorias (mobile) */}
      {filtrosAbertos && (
        <div className="fixed inset-0 z-50 md:hidden bg-black/40" onClick={() => setFiltrosAbertos(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-800">Categorias</p>
              <button onClick={() => setFiltrosAbertos(false)} className="text-gray-400"><X size={18} /></button>
            </div>
            <ul className="space-y-0.5">
              {categorias.map(c => (
                <li key={c.key}>
                  <button onClick={() => { setFiltro(c.key); setFiltrosAbertos(false) }}
                    className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm ${filtro === c.key ? 'font-semibold' : 'text-gray-600'}`}
                    style={filtro === c.key ? { backgroundColor: `${cor}18`, color: cor } : {}}>
                    <span className="truncate">{c.nome}</span><span className="text-xs text-gray-400 ml-2">({c.count})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Modal detalhe do produto */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setDetalhe(null)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl max-h-[92vh] flex flex-col rounded-t-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative">
              <div className="aspect-video sm:aspect-[16/10] bg-gray-100 flex items-center justify-center">
                {galeria.length > 0 ? (
                  <img src={`/api/loja/${slug}/img/${galeria[imgAtiva] || galeria[0]}`} alt={detalhe.nome} className="w-full h-full object-contain" />
                ) : detalhe.temImagem ? (
                  <img src={imgUrl(detalhe.variacaoId)} alt={detalhe.nome} className="w-full h-full object-contain" />
                ) : <ShoppingBag className="w-12 h-12 text-gray-300" />}
              </div>
              <button onClick={() => setDetalhe(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow"><X size={16} /></button>
            </div>
            {galeria.length > 1 && (
              <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
                {galeria.map((gid, i) => (
                  <button key={gid} onClick={() => setImgAtiva(i)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${i === imgAtiva ? '' : 'border-transparent opacity-70'}`}
                    style={i === imgAtiva ? { borderColor: cor } : undefined}>
                    <img src={`/api/loja/${slug}/img/${gid}`} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="p-5 overflow-y-auto">
              <h3 className="text-lg font-bold text-gray-800">{detalhe.nome}</h3>
              {detalhe.variacao && <p className="text-sm text-gray-400 mt-0.5">{detalhe.variacao}</p>}
              <div className="mt-2 flex items-baseline gap-2">
                {detalhe.emPromo && detalhe.precoOriginal ? (
                  <><span className="text-2xl font-bold" style={{ color: cor }}>{brl(detalhe.preco)}</span><span className="text-sm text-gray-400 line-through">{brl(detalhe.precoOriginal)}</span></>
                ) : <span className="text-2xl font-bold" style={{ color: cor }}>{brl(detalhe.preco)}</span>}
              </div>
              {detalhe.saldo != null && <p className="text-xs text-gray-400 mt-1">{detalhe.saldo} unidade(s) a pronta entrega</p>}
              {detalhe.descricao && <p className="text-sm text-gray-600 leading-relaxed mt-3 whitespace-pre-line">{detalhe.descricao}</p>}
            </div>
            <div className="border-t border-gray-100 p-4">
              {detalhe.esgotado ? (
                <button disabled className="w-full py-3 rounded-xl text-gray-400 bg-gray-100 text-sm font-semibold cursor-not-allowed">Esgotado</button>
              ) : (cart[detalhe.variacaoId] || 0) === 0 ? (
                <button onClick={() => add(detalhe.variacaoId)} className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: cor }}>
                  <ShoppingBag size={15} /> Adicionar ao carrinho
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 justify-center border border-gray-200 rounded-xl py-2">
                    <button onClick={() => sub(detalhe.variacaoId)} className="w-8 h-8 flex items-center justify-center"><Minus size={16} /></button>
                    <span className="text-base font-semibold w-6 text-center">{cart[detalhe.variacaoId]}</span>
                    <button onClick={() => add(detalhe.variacaoId)} disabled={detalhe.saldo != null && (cart[detalhe.variacaoId] || 0) >= detalhe.saldo} className="w-8 h-8 flex items-center justify-center disabled:opacity-40"><Plus size={16} /></button>
                  </div>
                  <button onClick={() => { setDetalhe(null); setCarrinhoAberto(true) }} className="flex-1 py-3 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: cor }}>Ver carrinho</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra flutuante do carrinho */}
      {totalItens > 0 && !carrinhoAberto && !detalhe && (
        <button onClick={() => setCarrinhoAberto(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 px-6 py-3 rounded-full text-white text-sm font-semibold shadow-lg flex items-center gap-2"
          style={{ backgroundColor: cor }}>
          <ShoppingBag size={16} /> {totalItens} {totalItens === 1 ? 'item' : 'itens'} · {brl(subtotal)}
        </button>
      )}

      {/* Painel carrinho / checkout */}
      {carrinhoAberto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl max-h-[90vh] flex flex-col rounded-t-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">{checkout ? 'Seus dados' : 'Seu carrinho'}</h2>
              <button onClick={() => { setCarrinhoAberto(false); setCheckout(false) }} className="text-gray-400"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {itensCarrinho.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Seu carrinho está vazio.</p>
              ) : !checkout ? (
                itensCarrinho.map(i => (
                  <div key={i.variacaoId} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {i.temImagem ? <img src={imgUrl(i.variacaoId)} alt="" className="w-full h-full object-cover" /> : <ShoppingBag className="w-5 h-5 text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 line-clamp-1">{i.nome}</p>
                      <p className="text-xs text-gray-400">{brl(i.preco)} cada</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => sub(i.variacaoId)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center"><Minus size={12} /></button>
                      <span className="text-sm w-5 text-center">{i.qtd}</span>
                      <button onClick={() => add(i.variacaoId)} className="w-7 h-7 rounded-lg text-white flex items-center justify-center" style={{ backgroundColor: cor }}><Plus size={12} /></button>
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome *"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" style={{ ['--tw-ring-color' as any]: cor }} />
                  <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="Seu WhatsApp *"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                  {podeEntrega && (
                    <div className="flex gap-2">
                      <button onClick={() => setForm(f => ({ ...f, entrega: false }))}
                        className={`flex-1 py-2 rounded-lg text-sm border ${!form.entrega ? 'text-white' : 'text-gray-600 border-gray-200'}`}
                        style={!form.entrega ? { backgroundColor: cor, borderColor: cor } : {}}>Retirada</button>
                      <button onClick={() => setForm(f => ({ ...f, entrega: true }))}
                        className={`flex-1 py-2 rounded-lg text-sm border ${form.entrega ? 'text-white' : 'text-gray-600 border-gray-200'}`}
                        style={form.entrega ? { backgroundColor: cor, borderColor: cor } : {}}>
                        Entrega{loja.freteTipo === 'fixo' ? ` (${brl(loja.freteValor)})` : loja.freteTipo === 'gratis' ? ' (grátis)' : ''}
                      </button>
                    </div>
                  )}
                  {form.entrega && (
                    <textarea value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} rows={2}
                      placeholder="Endereço de entrega *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                  )}
                  <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2}
                    placeholder="Observações (opcional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2" />
                  {erro && <p className="text-xs text-red-500">{erro}</p>}
                </>
              )}
            </div>

            {itensCarrinho.length > 0 && (
              <div className="border-t border-gray-100 p-5 space-y-2">
                <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
                {checkout && freteAplicado > 0 && <div className="flex justify-between text-sm text-gray-500"><span>Frete</span><span>{brl(freteAplicado)}</span></div>}
                <div className="flex justify-between text-base font-bold text-gray-800"><span>Total</span><span>{brl(checkout ? total : subtotal)}</span></div>
                {!checkout ? (
                  <button onClick={() => setCheckout(true)} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: cor }}>
                    Continuar
                  </button>
                ) : (
                  <button onClick={enviar} disabled={enviando} className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: cor }}>
                    {enviando ? 'Enviando...' : 'Enviar pedido'}
                  </button>
                )}
                <p className="text-[10px] text-center text-gray-400">Sem pagamento online — o valor é combinado direto com a loja.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
