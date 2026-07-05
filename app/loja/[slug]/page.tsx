'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShoppingBag, Plus, Minus, X, Store, MapPin, CheckCircle2 } from 'lucide-react'

type Item = {
  variacaoId: string; nome: string; variacao: string | null; descricao: string | null
  preco: number; precoOriginal: number | null; emPromo: boolean; temImagem: boolean
  saldo: number | null; fonte: string
}
type Loja = {
  slug: string; nome: string; logo: string | null; corPrimaria: string; descricao: string | null
  whatsapp: string | null; instagram: string | null; cidade: string | null; estado: string | null
  freteTipo: string; freteValor: number
}

const brl = (n: number) => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function LojaPublicaPage() {
  const params = useParams()
  const slug = String(params?.slug || '')

  const [loading, setLoading] = useState(true)
  const [disponivel, setDisponivel] = useState(true)
  const [loja, setLoja] = useState<Loja | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ numero: string; total: number } | null>(null)
  const [form, setForm] = useState({ nome: '', telefone: '', entrega: false, endereco: '', observacoes: '' })

  useEffect(() => {
    fetch(`/api/loja/${slug}`).then(async r => {
      if (!r.ok) { setDisponivel(false); setLoading(false); return }
      const d = await r.json()
      if (!d.disponivel) { setDisponivel(false); setLoading(false); return }
      setLoja(d.loja); setItens(d.itens || []); setLoading(false)
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
      setSucesso({ numero: d.numero, total: d.total })
      setCart({}); setCheckout(false); setCarrinhoAberto(false)
    } finally { setEnviando(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  if (!disponivel || !loja) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <Store className="w-12 h-12 text-gray-300 mb-3" />
      <h1 className="text-lg font-semibold text-gray-700">Loja indisponível</h1>
      <p className="text-sm text-gray-400 mt-1">Esta loja não existe ou está fora do ar no momento.</p>
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header / branding */}
      <div className="text-white" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}dd)` }}>
        <div className="max-w-4xl mx-auto px-4 py-8 flex items-center gap-4">
          {loja.logo && <img src={loja.logo} alt={loja.nome} className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40" />}
          <div>
            <h1 className="text-2xl font-bold">{loja.nome}</h1>
            {loja.descricao && <p className="text-sm text-white/90 mt-0.5 max-w-lg">{loja.descricao}</p>}
            {(loja.cidade || loja.estado) && <p className="text-xs text-white/70 mt-1 flex items-center gap-1"><MapPin size={11} /> {[loja.cidade, loja.estado].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>
      </div>

      {/* Catálogo */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {itens.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">Ainda não há produtos disponíveis nesta loja.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {itens.map(item => {
              const qtd = cart[item.variacaoId] || 0
              return (
                <div key={item.variacaoId} className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {item.temImagem ? (
                      <img loading="lazy" src={`/api/loja/${slug}/imagem/${item.variacaoId}`} alt={item.nome} className="w-full h-full object-cover" />
                    ) : <ShoppingBag className="w-8 h-8 text-gray-300" />}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">{item.nome}</p>
                    {item.variacao && <p className="text-xs text-gray-400 mt-0.5">{item.variacao}</p>}
                    <div className="mt-1.5 mb-2">
                      {item.emPromo && item.precoOriginal ? (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-base font-bold" style={{ color: cor }}>{brl(item.preco)}</span>
                          <span className="text-xs text-gray-400 line-through">{brl(item.precoOriginal)}</span>
                        </div>
                      ) : <span className="text-base font-bold" style={{ color: cor }}>{brl(item.preco)}</span>}
                      {item.saldo != null && <span className="block text-[10px] text-gray-400">{item.saldo} a pronta entrega</span>}
                    </div>
                    <div className="mt-auto">
                      {qtd === 0 ? (
                        <button onClick={() => add(item.variacaoId)}
                          className="w-full py-1.5 rounded-lg text-white text-xs font-semibold" style={{ backgroundColor: cor }}>
                          Adicionar
                        </button>
                      ) : (
                        <div className="flex items-center justify-between">
                          <button onClick={() => sub(item.variacaoId)} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center"><Minus size={13} /></button>
                          <span className="text-sm font-semibold">{qtd}</span>
                          <button onClick={() => add(item.variacaoId)} disabled={item.saldo != null && qtd >= item.saldo}
                            className="w-7 h-7 rounded-lg text-white flex items-center justify-center disabled:opacity-40" style={{ backgroundColor: cor }}><Plus size={13} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Barra do carrinho */}
      {totalItens > 0 && !carrinhoAberto && (
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
              {!checkout ? (
                itensCarrinho.map(i => (
                  <div key={i.variacaoId} className="flex items-center gap-3">
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
          </div>
        </div>
      )}
    </div>
  )
}
