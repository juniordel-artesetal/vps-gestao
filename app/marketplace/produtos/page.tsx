'use client'
// Produtos do marketplace (Fase 2) — a lista é por VARIAÇÃO, cada uma com o SELO do seu canal/loja.
// Fonte do canal = PrecVariacao.canal; selo = canalVisual (não reinventar).
// Publicar age no produto do canal TikTok (as variações TikTok viram SKUs do mesmo anúncio),
// idempotente via MarketplaceAnuncio. Variação de canal não-marketplace aparece com selo, sem publicar.
// ⚠️ A publicação chama a API do TikTok (ainda a validar na loja de dev) — por isso o padrão é RASCUNHO.
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Loader2, Store, CheckCircle2, AlertTriangle, UploadCloud } from 'lucide-react'
import { canalVisual } from '@/lib/canalVisual'

const num = (s: string) => { const n = Number(String(s).replace(',', '.')); return isNaN(n) ? undefined : n }
const brl = (n?: number | null) => typeof n === 'number' && !isNaN(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'
const ST: Record<string, { t: string; c: string }> = {
  nao_publicado: { t: 'Não publicado', c: 'text-gray-500' },
  pendente: { t: 'Pendente (faltam dados)', c: 'text-amber-600' },
  rascunho: { t: 'Rascunho', c: 'text-amber-600' },
  publicado: { t: 'Publicado', c: 'text-emerald-600' },
}
const ehTikTok = (canal?: string | null) => ['tiktok', 'tiktokshop', 'tiktok shop'].includes(String(canal || '').trim().toLowerCase())

interface Variacao {
  variacaoId: string; produtoId: string; produtoNome: string
  variacaoNome: string | null; tipo: string | null; subOpcao: string | null
  canal: string | null; preco: number | null; temCampos: boolean; statusAnuncio: string
}
interface Campos { titulo?: string; descricao?: string; categoriaId?: string; marca?: string; gtin?: string; imagens?: string[]; pesoGramas?: number; dimensoes?: { comprimento?: number; largura?: number; altura?: number }; garantia?: string }

const nomeVar = (v: Variacao) => v.variacaoNome || v.subOpcao || v.tipo || 'Padrão'

export default function ProdutosMarketplace() {
  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [variacoes, setVariacoes] = useState<Variacao[]>([])
  const [fCanal, setFCanal] = useState('')       // filtro por canal (slug) — '' = todos
  const [sel, setSel] = useState<Variacao | null>(null)
  const [campos, setCampos] = useState<Campos>({})
  const [faltando, setFaltando] = useState<string[]>([])
  const [status, setStatus] = useState('nao_publicado')
  const [msg, setMsg] = useState(''); const [ocupado, setOcupado] = useState(false)

  const carregarLista = useCallback(async () => {
    const r = await fetch('/api/marketplace/produto/campos')
    if (r.status === 404) { setLiberado(false); return }
    setLiberado(true)
    const j = await r.json().catch(() => ({}))
    setVariacoes(j.variacoes ?? [])
  }, [])
  useEffect(() => { carregarLista() }, [carregarLista])

  // Canais presentes (para o filtro do topo), na ordem em que aparecem.
  const canaisPresentes = useMemo(() => {
    const seen = new Map<string, string>()
    for (const v of variacoes) { const c = String(v.canal || 'shopee').toLowerCase(); if (!seen.has(c)) seen.set(c, canalVisual(v.canal).label) }
    return [...seen.entries()].map(([slug, label]) => ({ slug, label }))
  }, [variacoes])

  const lista = useMemo(() => fCanal ? variacoes.filter(v => String(v.canal || 'shopee').toLowerCase() === fCanal) : variacoes, [variacoes, fCanal])

  async function abrir(v: Variacao) {
    setSel(v); setMsg(''); setCampos({}); setFaltando([]); setStatus(v.statusAnuncio || 'nao_publicado')
    const r = await fetch('/api/marketplace/produto/campos?produtoId=' + encodeURIComponent(v.produtoId))
    const j = await r.json().catch(() => ({}))
    setCampos(j.campos ?? {}); setFaltando(j.validacao?.faltando ?? []); setStatus(j.vinculo?.status ?? v.statusAnuncio ?? 'nao_publicado')
  }

  async function salvar() {
    if (!sel) return
    setOcupado(true); setMsg('')
    const r = await fetch('/api/marketplace/produto/campos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId: sel.produtoId, campos }) })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    if (r.ok) { setFaltando(j.validacao?.faltando ?? []); setMsg('Campos salvos.') } else setMsg(j.error || 'Erro ao salvar.')
  }

  async function publicar(rascunho: boolean) {
    if (!sel) return
    setOcupado(true); setMsg('')
    await salvar()
    const r = await fetch('/api/marketplace/produto/publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId: sel.produtoId, rascunho }) })
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

  const selTikTok = sel && ehTikTok(sel.canal)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Produtos</h1>
      <p className="text-sm text-gray-500 mb-4">Cada linha é uma <b>variação</b> com o selo do seu canal. Publique as variações do <b>TikTok Shop</b> — recomendamos como <b>rascunho</b> para revisar no TikTok antes de ir ao ar.</p>

      {/* Filtro por canal */}
      {canaisPresentes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button onClick={() => setFCanal('')} className={`text-xs px-2.5 py-1 rounded-full border ${fCanal === '' ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>Todos</button>
          {canaisPresentes.map(c => { const cv = canalVisual(c.slug); return (
            <button key={c.slug} onClick={() => setFCanal(c.slug)} className={`text-xs px-2.5 py-1 rounded-full border ${fCanal === c.slug ? cv.classe + ' font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>{cv.emoji} {cv.label}</button>
          )})}
        </div>
      )}

      <div className="grid md:grid-cols-[320px_1fr] gap-5">
        {/* Lista de VARIAÇÕES */}
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 max-h-[70vh] overflow-y-auto">
          {liberado === null ? <div className="flex items-center gap-2 text-gray-400 text-sm p-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
            : lista.length === 0 ? <p className="text-xs text-gray-500 p-2">Nenhuma variação cadastrada.</p>
            : lista.map(v => { const cv = canalVisual(v.canal); const tk = ehTikTok(v.canal); return (
              <button key={v.variacaoId} onClick={() => abrir(v)} className={`w-full text-left px-2.5 py-2 rounded-lg mb-0.5 ${sel?.variacaoId === v.variacaoId ? 'bg-orange-50 dark:bg-orange-950/40' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{v.produtoNome} <span className="text-gray-400">—</span> {nomeVar(v)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{brl(v.preco)}</div>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border ${cv.classe}`}>{cv.emoji} {cv.label}</span>
                </div>
                <div className={`text-[11px] mt-1 ${tk ? (ST[v.statusAnuncio]?.c ?? 'text-gray-500') : 'text-gray-400'}`}>
                  {tk ? (ST[v.statusAnuncio]?.t ?? v.statusAnuncio) : 'Sem publicação no TikTok'}
                </div>
              </button>
            )})}
        </div>

        {/* Editor de campos (dados do produto no marketplace) */}
        {!sel ? (
          <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500">Escolha uma variação para ver os detalhes e publicar.</div>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className="font-semibold text-gray-900 dark:text-white truncate">{sel.produtoNome} <span className="text-gray-400">—</span> {nomeVar(sel)}</h2>
              {(() => { const cv = canalVisual(sel.canal); return <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full border ${cv.classe}`}>{cv.emoji} {cv.label}</span> })()}
            </div>
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-gray-500">Preço: <b className="text-gray-700 dark:text-gray-200">{brl(sel.preco)}</b></span>
              {selTikTok && <span className={`font-medium ${ST[status]?.c ?? 'text-gray-500'}`}>{ST[status]?.t ?? status}</span>}
            </div>

            {!selTikTok ? (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-3 text-xs text-gray-600 dark:text-gray-300">
                Esta variação é do canal <b>{canalVisual(sel.canal).label}</b>. Ela aparece aqui para você ver de qual loja é.
                A publicação no <b>TikTok Shop</b> só vale para variações marcadas no canal TikTok (na precificação).
              </div>
            ) : (<>
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
                <p className="sm:col-span-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">🖼️ As <b>fotos da variação</b> (cadastradas na configuração da variação, em Precificação) são usadas no anúncio automaticamente. Preço e SKUs também vêm das <b>variações</b> do canal TikTok. Sem foto? Adicione fotos à variação.</p>
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
              <p className="text-[11px] text-gray-400 mt-2">Publicar envia o produto com todas as variações do canal TikTok como SKUs (mesmo anúncio, idempotente).</p>
            </>)}
            {msg && <p className="text-xs text-gray-600 dark:text-gray-300 mt-3">{msg}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
