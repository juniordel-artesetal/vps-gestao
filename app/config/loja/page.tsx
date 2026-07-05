'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Store, ExternalLink, Copy, Check, ImageIcon, Trash2 } from 'lucide-react'

// Compressão client-side (JPEG 70%) — padrão do sistema. max ajustável (banner maior).
async function comprimirImagem(file: File, MAX = 400): Promise<string> {
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

const inputClass = 'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400'

export default function ConfigLojaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [logoAtual, setLogoAtual] = useState<string | null>(null) // do branding/config
  const [logoNovo, setLogoNovo] = useState<string>('')            // upload novo
  const [logoAcao, setLogoAcao] = useState<'manter' | 'nova' | 'remover'>('manter')
  const [temBanner, setTemBanner] = useState(false)
  const [bannerNovo, setBannerNovo] = useState<string>('')
  const [bannerAcao, setBannerAcao] = useState<'manter' | 'nova' | 'remover'>('manter')

  const [form, setForm] = useState({
    slug: '', ativo: false, descricao: '', textoBoasVindas: '', whatsapp: '', corPrimaria: '#f97316',
    freteTipo: 'retirada', freteValor: '', fonteCatalogo: 'precificacao',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/modulos')
      else carregar()
    }
  }, [status])

  async function carregar() {
    try {
      const res = await fetch('/api/config/loja')
      const data = await res.json()
      const c = data.config
      const b = data.branding || {}
      if (c) {
        setForm({
          slug: c.slug || '', ativo: !!c.ativo, descricao: c.descricao || '', textoBoasVindas: c.textoBoasVindas || '',
          whatsapp: c.whatsapp || b.whatsapp || '', corPrimaria: c.corPrimaria || b.corPrimaria || '#f97316',
          freteTipo: c.freteTipo || 'retirada', freteValor: c.freteValor ? String(c.freteValor) : '',
          fonteCatalogo: c.fonteCatalogo || 'precificacao',
        })
        setLogoAtual(c.logo || b.logo || null)
        setTemBanner(!!c.temBanner)
      } else {
        setForm(f => ({ ...f, slug: b.slugSugerido || '', whatsapp: b.whatsapp || '', corPrimaria: b.corPrimaria || '#f97316' }))
        setLogoAtual(b.logo || null)
      }
    } finally { setLoading(false) }
  }

  async function selecionarLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try { setLogoNovo(await comprimirImagem(file)); setLogoAcao('nova') }
    catch { setErro('Não consegui processar a imagem.') }
  }

  async function selecionarBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try { setBannerNovo(await comprimirImagem(file, 1000)); setBannerAcao('nova') }
    catch { setErro('Não consegui processar a imagem.') }
  }

  async function salvar() {
    setSalvando(true); setErro(''); setOk('')
    try {
      const logoPayload = logoAcao === 'nova' ? logoNovo : logoAcao === 'remover' ? null : undefined
      const bannerPayload = bannerAcao === 'nova' ? bannerNovo : bannerAcao === 'remover' ? null : undefined
      const res = await fetch('/api/config/loja', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          freteValor: form.freteTipo === 'fixo' ? Number(form.freteValor) || 0 : 0,
          ...(logoPayload !== undefined ? { logo: logoPayload } : {}),
          ...(bannerPayload !== undefined ? { bannerImagem: bannerPayload } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
      setOk('Loja salva com sucesso!'); setTimeout(() => setOk(''), 3000)
      if (logoAcao === 'nova') { setLogoAtual(logoNovo); setLogoNovo(''); setLogoAcao('manter') }
      if (logoAcao === 'remover') { setLogoAtual(null); setLogoAcao('manter') }
      if (bannerAcao === 'nova') { setTemBanner(true); setBannerNovo(''); setBannerAcao('manter') }
      if (bannerAcao === 'remover') { setTemBanner(false); setBannerAcao('manter') }
    } finally { setSalvando(false) }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const link = form.slug ? `${baseUrl}/loja/${form.slug}` : ''
  const logoPreview = logoAcao === 'nova' && logoNovo ? logoNovo : (logoAcao !== 'remover' ? logoAtual : null)

  function copiar() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000) })
  }

  if (loading) return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"><p className="text-gray-400 text-sm">Carregando...</p></div>

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-2 mb-1">
          <Store className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Loja Virtual</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Sua vitrine online — a cliente navega, monta o carrinho e envia o pedido, que entra direto na Produção.</p>

        {erro && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-700">{erro}</div>}
        {ok && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">✓ {ok}</div>}

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 space-y-4">

          {/* Ativa */}
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white">Loja ativa</p>
              <p className="text-xs text-gray-400">Quando desligada, o link mostra "loja indisponível".</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.ativo ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.ativo ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>

          {/* Slug + link */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Link da loja</label>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-400 whitespace-nowrap">{baseUrl}/loja/</span>
              <input type="text" value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                className={inputClass} placeholder="minha-loja" />
            </div>
            {link && (
              <div className="flex items-center gap-2 mt-2">
                <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                  {link} <ExternalLink size={11} />
                </a>
                <button type="button" onClick={copiar} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  {copiado ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                </button>
              </div>
            )}
          </div>

          {/* Logo + cor */}
          <div className="flex gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Logo</label>
              {logoPreview ? (
                <div className="relative inline-block">
                  <img src={logoPreview} alt="Logo" className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                  <button type="button" onClick={() => { setLogoNovo(''); setLogoAcao('remover') }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-1 w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-gray-400 hover:border-orange-400">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[9px]">Logo</span>
                  <input type="file" accept="image/*" className="hidden" onChange={selecionarLogo} />
                </label>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Cor principal</label>
              <input type="color" value={form.corPrimaria} onChange={e => setForm(f => ({ ...f, corPrimaria: e.target.value }))}
                className="w-full h-10 border border-gray-200 dark:border-gray-600 rounded-lg px-1 cursor-pointer" />
            </div>
          </div>

          {/* Descrição curta (subtítulo) */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Descrição curta (subtítulo)</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              rows={2} className={inputClass} placeholder="Ex: Peças artesanais feitas com carinho. Escolha as suas!" />
          </div>

          {/* Banner / capa */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Banner / capa da loja</label>
            {bannerAcao === 'nova' && bannerNovo ? (
              <div className="relative">
                <img src={bannerNovo} alt="Banner" className="w-full h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
                <button type="button" onClick={() => { setBannerNovo(''); setBannerAcao(temBanner ? 'remover' : 'manter') }}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ) : (temBanner && bannerAcao !== 'remover') ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300">
                <span>✓ Banner salvo</span>
                <label className="text-xs text-orange-500 cursor-pointer hover:underline">Trocar<input type="file" accept="image/*" className="hidden" onChange={selecionarBanner} /></label>
                <button type="button" onClick={() => setBannerAcao('remover')} className="text-xs text-red-500 hover:underline">Remover</button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer text-gray-400 hover:border-orange-400">
                <ImageIcon className="w-5 h-5" />
                <span className="text-[10px]">Subir banner (imagem larga)</span>
                <input type="file" accept="image/*" className="hidden" onChange={selecionarBanner} />
              </label>
            )}
          </div>

          {/* Texto de boas-vindas */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Mensagem de boas-vindas <span className="text-gray-400">(aparece no topo da loja)</span></label>
            <textarea value={form.textoBoasVindas} onChange={e => setForm(f => ({ ...f, textoBoasVindas: e.target.value }))}
              rows={2} className={inputClass} placeholder="Ex: Seja bem-vinda! Aproveite as novidades da coleção." />
          </div>

          {/* WhatsApp */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">WhatsApp para contato</label>
            <input type="text" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
              className={inputClass} placeholder="(11) 99999-9999" />
          </div>

          {/* Fonte do catálogo */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Fonte do catálogo</label>
            <select value={form.fonteCatalogo} onChange={e => setForm(f => ({ ...f, fonteCatalogo: e.target.value }))} className={inputClass}>
              <option value="precificacao">Produtos da Precificação (marcados como "visível na loja")</option>
              <option value="estoque">Estoque a Pronta Entrega (com saldo)</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>

          {/* Frete */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Frete / entrega</label>
            <div className="flex gap-2">
              <select value={form.freteTipo} onChange={e => setForm(f => ({ ...f, freteTipo: e.target.value }))} className={inputClass}>
                <option value="retirada">Só retirada</option>
                <option value="gratis">Entrega grátis</option>
                <option value="fixo">Entrega com valor fixo</option>
              </select>
              {form.freteTipo === 'fixo' && (
                <input type="number" step="0.01" min="0" value={form.freteValor}
                  onChange={e => setForm(f => ({ ...f, freteValor: e.target.value }))}
                  className={inputClass + ' max-w-[130px]'} placeholder="R$ 0,00" />
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button onClick={salvar} disabled={salvando}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {salvando ? 'Salvando...' : 'Salvar loja'}
            </button>
          </div>
        </div>

        <a href="/config/loja/vitrine"
          className="mt-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:border-orange-300 transition">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-white">Gerenciar vitrine</p>
            <p className="text-xs text-gray-400">Coleções, ordem dos produtos, destaques e imagem da loja</p>
          </div>
          <span className="text-orange-500 text-lg">→</span>
        </a>

        <p className="text-xs text-gray-400 mt-4">
          Dica: em Precificação → Produtos, marque os produtos que devem aparecer na loja. Pedidos da loja entram na Produção com o canal "Loja".
        </p>
      </div>
    </div>
  )
}
