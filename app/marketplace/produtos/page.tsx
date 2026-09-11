'use client'
// Produtos do marketplace (Fase 2): bloco "Dados do Marketplace" + validação + Vincular e publicar.
// ⚠️ A publicação chama a API do TikTok (ainda a validar na loja de dev) — por isso o padrão é RASCUNHO.
import { useEffect, useState, useCallback } from 'react'
import { Loader2, Store, CheckCircle2, AlertTriangle, UploadCloud } from 'lucide-react'

const num = (s: string) => { const n = Number(String(s).replace(',', '.')); return isNaN(n) ? undefined : n }
const ST: Record<string, { t: string; c: string }> = {
  nao_publicado: { t: 'Não publicado', c: 'text-gray-500' },
  rascunho: { t: 'Rascunho', c: 'text-amber-600' },
  publicado: { t: 'Publicado', c: 'text-emerald-600' },
}

interface Produto { id: string; nome: string; sku: string | null; status: string; temCampos: boolean }
interface Campos { titulo?: string; descricao?: string; categoriaId?: string; marca?: string; gtin?: string; imagens?: string[]; pesoGramas?: number; dimensoes?: { comprimento?: number; largura?: number; altura?: number }; garantia?: string }

export default function ProdutosMarketplace() {
  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [sel, setSel] = useState<Produto | null>(null)
  const [campos, setCampos] = useState<Campos>({})
  const [faltando, setFaltando] = useState<string[]>([])
  const [status, setStatus] = useState('nao_publicado')
  const [msg, setMsg] = useState(''); const [ocupado, setOcupado] = useState(false)

  const carregarLista = useCallback(async () => {
    const r = await fetch('/api/marketplace/produto/campos')
    if (r.status === 404) { setLiberado(false); return }
    setLiberado(true)
    const j = await r.json().catch(() => ({}))
    setProdutos(j.produtos ?? [])
  }, [])
  useEffect(() => { carregarLista() }, [carregarLista])

  async function abrir(p: Produto) {
    setSel(p); setMsg(''); setCampos({}); setFaltando([])
    const r = await fetch('/api/marketplace/produto/campos?produtoId=' + encodeURIComponent(p.id))
    const j = await r.json().catch(() => ({}))
    setCampos(j.campos ?? {}); setFaltando(j.validacao?.faltando ?? []); setStatus(j.vinculo?.status ?? 'nao_publicado')
  }

  async function salvar() {
    if (!sel) return
    setOcupado(true); setMsg('')
    const r = await fetch('/api/marketplace/produto/campos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId: sel.id, campos }) })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    if (r.ok) { setFaltando(j.validacao?.faltando ?? []); setMsg('Campos salvos.') } else setMsg(j.error || 'Erro ao salvar.')
  }

  async function publicar(rascunho: boolean) {
    if (!sel) return
    setOcupado(true); setMsg('')
    await salvar()
    const r = await fetch('/api/marketplace/produto/publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId: sel.id, rascunho }) })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    if (r.ok) { setStatus(j.status || (rascunho ? 'rascunho' : 'publicado')); setMsg(`Enviado ao TikTok como ${rascunho ? 'rascunho' : 'publicado'}. ✅`); carregarLista() }
    else setMsg('Não publicou: ' + (j.error || 'erro') + (j.faltando ? '' : ' — (a integração de escrita ainda está em validação na loja de dev)'))
  }

  const up = (k: keyof Campos, v: any) => setCampos(c => ({ ...c, [k]: v }))
  const upDim = (k: 'comprimento' | 'largura' | 'altura', v: any) => setCampos(c => ({ ...c, dimensoes: { ...c.dimensoes, [k]: v } }))
  const inp = 'mt-1 w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-700'

  if (liberado === false) return (
    <div className="p-6 max-w-xl mx-auto text-center text-sm text-gray-500">
      <Store className="w-8 h-8 mx-auto mb-2 text-orange-400" /> Este recurso é do módulo Integração com Marketplaces.
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Produtos</h1>
      <p className="text-sm text-gray-500 mb-5">Preencha os dados que o marketplace exige e publique o anúncio. Recomendamos publicar como <b>rascunho</b> para revisar no TikTok antes de ir ao ar.</p>

      <div className="grid md:grid-cols-[280px_1fr] gap-5">
        {/* Lista de produtos */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 max-h-[70vh] overflow-y-auto">
          {liberado === null ? <div className="flex items-center gap-2 text-gray-400 text-sm p-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
            : produtos.length === 0 ? <p className="text-xs text-gray-500 p-2">Nenhum produto cadastrado.</p>
            : produtos.map(p => (
              <button key={p.id} onClick={() => abrir(p)} className={`w-full text-left px-2.5 py-2 rounded-lg text-sm mb-0.5 ${sel?.id === p.id ? 'bg-orange-50 dark:bg-orange-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className="font-medium text-gray-900 dark:text-white truncate">{p.nome}</div>
                <div className={`text-xs ${ST[p.status]?.c ?? 'text-gray-500'}`}>{ST[p.status]?.t ?? p.status}</div>
              </button>
            ))}
        </div>

        {/* Editor de campos */}
        {!sel ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500">Escolha um produto para preencher os dados do marketplace.</div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">{sel.nome}</h2>
              <span className={`text-xs font-medium ${ST[status]?.c ?? 'text-gray-500'}`}>{ST[status]?.t ?? status}</span>
            </div>

            {faltando.length > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> Falta para publicar: {faltando.join(', ')}.
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 text-xs text-gray-500">
              <label className="sm:col-span-2">Título do anúncio<input className={inp} value={campos.titulo ?? ''} onChange={e => up('titulo', e.target.value)} /></label>
              <label className="sm:col-span-2">Descrição<textarea className={inp} rows={3} value={campos.descricao ?? ''} onChange={e => up('descricao', e.target.value)} /></label>
              <label>Categoria do canal (ID)<input className={inp} value={campos.categoriaId ?? ''} onChange={e => up('categoriaId', e.target.value)} placeholder="ID da categoria do TikTok" /></label>
              <label>Marca<input className={inp} value={campos.marca ?? ''} onChange={e => up('marca', e.target.value)} /></label>
              <label>GTIN / EAN<input className={inp} value={campos.gtin ?? ''} onChange={e => up('gtin', e.target.value)} /></label>
              <label>Garantia<input className={inp} value={campos.garantia ?? ''} onChange={e => up('garantia', e.target.value)} /></label>
              <label className="sm:col-span-2">Imagens (uma URL por linha)<textarea className={inp} rows={2} value={(campos.imagens ?? []).join('\n')} onChange={e => up('imagens', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} /></label>
              <label>Peso da embalagem (g)<input className={inp} inputMode="decimal" value={campos.pesoGramas ?? ''} onChange={e => up('pesoGramas', num(e.target.value))} /></label>
              <div className="grid grid-cols-3 gap-2">
                <label>C (cm)<input className={inp} inputMode="decimal" value={campos.dimensoes?.comprimento ?? ''} onChange={e => upDim('comprimento', num(e.target.value))} /></label>
                <label>L (cm)<input className={inp} inputMode="decimal" value={campos.dimensoes?.largura ?? ''} onChange={e => upDim('largura', num(e.target.value))} /></label>
                <label>A (cm)<input className={inp} inputMode="decimal" value={campos.dimensoes?.altura ?? ''} onChange={e => upDim('altura', num(e.target.value))} /></label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={salvar} disabled={ocupado} className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">Salvar campos</button>
              <button onClick={() => publicar(true)} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"><UploadCloud className="w-4 h-4" /> Publicar como rascunho</button>
              <button onClick={() => publicar(false)} disabled={ocupado} className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-gray-900 hover:opacity-90 disabled:opacity-50"><CheckCircle2 className="w-4 h-4" /> Publicar (ativo)</button>
            </div>
            {msg && <p className="text-xs text-gray-600 dark:text-gray-300 mt-3">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
