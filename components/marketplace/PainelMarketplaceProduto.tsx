'use client'
// Bloco "Dados do Marketplace" + status de publicação, embutido no editor de produto (fluxo
// normal). ISOLADO: se o módulo estiver off, não renderiza nada (a API responde 404). Salvar os
// campos dispara a publicação automática quando o canal TikTok está marcado numa variação.
import { useEffect, useState, useCallback } from 'react'

const ST: Record<string, { t: string; c: string }> = {
  nao_publicado: { t: 'Não publicado', c: 'bg-gray-100 text-gray-600' },
  pendente: { t: 'Pendente', c: 'bg-amber-100 text-amber-700' },
  rascunho: { t: 'Rascunho', c: 'bg-blue-100 text-blue-700' },
  publicado: { t: 'Publicado ✅', c: 'bg-emerald-100 text-emerald-700' },
}
const num = (s: string) => { const n = Number(String(s).replace(',', '.')); return isNaN(n) ? undefined : n }

interface Campos { titulo?: string; descricao?: string; categoriaId?: string; marca?: string; gtin?: string; imagens?: string[]; pesoGramas?: number; dimensoes?: { comprimento?: number; largura?: number; altura?: number }; publicarAtivo?: boolean }

export default function PainelMarketplaceProduto({ produtoId }: { produtoId: string }) {
  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [aberto, setAberto] = useState(false)
  const [campos, setCampos] = useState<Campos>({})
  const [faltando, setFaltando] = useState<string[]>([])
  const [status, setStatus] = useState('nao_publicado')
  const [ultimoErro, setUltimoErro] = useState<string | null>(null)
  const [linkAnuncio, setLinkAnuncio] = useState<string | null>(null)
  const [msg, setMsg] = useState(''); const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const r = await fetch('/api/marketplace/produto/campos?produtoId=' + encodeURIComponent(produtoId))
    if (r.status === 404) { setLiberado(false); return }
    setLiberado(true)
    const j = await r.json().catch(() => ({}))
    setCampos(j.campos ?? {}); setFaltando(j.validacao?.faltando ?? [])
    setStatus(j.vinculo?.status ?? 'nao_publicado'); setUltimoErro(j.vinculo?.ultimoErro ?? null); setLinkAnuncio(j.vinculo?.linkAnuncio ?? null)
  }, [produtoId])
  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setSalvando(true); setMsg('')
    const r = await fetch('/api/marketplace/produto/campos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ produtoId, campos }) })
    const j = await r.json().catch(() => ({}))
    setSalvando(false)
    if (r.ok) { setFaltando(j.validacao?.faltando ?? []); setMsg('Dados salvos. Se o canal TikTok estiver marcado numa variação, o anúncio sobe/atualiza sozinho.'); carregar() }
    else setMsg(j.error || 'Erro ao salvar.')
  }

  const up = (k: keyof Campos, v: any) => setCampos(c => ({ ...c, [k]: v }))
  const upDim = (k: 'comprimento' | 'largura' | 'altura', v: any) => setCampos(c => ({ ...c, dimensoes: { ...c.dimensoes, [k]: v } }))
  const inp = 'mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm'

  if (liberado === null || liberado === false) return null // módulo off → nada

  return (
    <div className="mt-2 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
      <button type="button" onClick={() => setAberto(a => !a)} className="w-full flex items-center justify-between text-sm font-medium text-gray-700">
        <span className="flex items-center gap-2">🛍️ Dados do Marketplace <span className={`text-xs rounded-full px-2 py-0.5 ${ST[status]?.c ?? ST.nao_publicado.c}`}>{ST[status]?.t ?? status}</span></span>
        <span className="text-gray-400 text-xs">{aberto ? '▲ fechar' : '▼ abrir'}</span>
      </button>

      {status === 'pendente' && ultimoErro && <p className="mt-2 text-xs text-amber-700">{ultimoErro}</p>}
      {faltando.length > 0 && status !== 'pendente' && <p className="mt-2 text-xs text-amber-700">Para publicar, falta: {faltando.join(', ')}.</p>}
      {linkAnuncio && <a href={linkAnuncio} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-blue-600 underline">Ver anúncio no TikTok</a>}

      {aberto && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
          <label className="col-span-2">Título do anúncio<input className={inp} value={campos.titulo ?? ''} onChange={e => up('titulo', e.target.value)} /></label>
          <label className="col-span-2">Categoria do canal (ID)<input className={inp} value={campos.categoriaId ?? ''} onChange={e => up('categoriaId', e.target.value)} placeholder="ID da categoria do TikTok" /></label>
          <label>Marca<input className={inp} value={campos.marca ?? ''} onChange={e => up('marca', e.target.value)} /></label>
          <label>GTIN / EAN<input className={inp} value={campos.gtin ?? ''} onChange={e => up('gtin', e.target.value)} /></label>
          <p className="col-span-2 text-[11px] text-gray-500 bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">🖼️ As <b>fotos da variação</b> (na configuração da variação, em Precificação) são usadas no anúncio automaticamente — não precisa colar URL. Sem foto? Adicione fotos à variação.</p>
          <label>Peso (g)<input className={inp} inputMode="decimal" value={campos.pesoGramas ?? ''} onChange={e => up('pesoGramas', num(e.target.value))} /></label>
          <div className="grid grid-cols-3 gap-1">
            <label>C(cm)<input className={inp} inputMode="decimal" value={campos.dimensoes?.comprimento ?? ''} onChange={e => upDim('comprimento', num(e.target.value))} /></label>
            <label>L<input className={inp} inputMode="decimal" value={campos.dimensoes?.largura ?? ''} onChange={e => upDim('largura', num(e.target.value))} /></label>
            <label>A<input className={inp} inputMode="decimal" value={campos.dimensoes?.altura ?? ''} onChange={e => upDim('altura', num(e.target.value))} /></label>
          </div>
          <label className="col-span-2 flex items-center gap-2 mt-1 text-gray-600">
            <input type="checkbox" checked={!!campos.publicarAtivo} onChange={e => up('publicarAtivo', e.target.checked)} className="accent-orange-500" />
            Publicar como ATIVO (padrão é rascunho, pra você revisar no TikTok antes)
          </label>
          <div className="col-span-2 mt-1">
            <button type="button" onClick={salvar} disabled={salvando} className="rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-1.5 disabled:opacity-50">
              {salvando ? 'Salvando…' : 'Salvar dados do marketplace'}
            </button>
            {msg && <p className="mt-2 text-xs text-gray-600">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
