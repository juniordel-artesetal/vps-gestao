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

interface Campos { titulo?: string; descricao?: string; categoriaId?: string; categoriaNome?: string; marca?: string; gtin?: string; imagens?: string[]; pesoGramas?: number; dimensoes?: { comprimento?: number; largura?: number; altura?: number }; publicarAtivo?: boolean; atributos?: Record<string, string>; estoqueAnuncio?: number }
interface Folha { id: string; caminho: string }
interface Atributo { id: string; nome: string; obrigatorio: boolean; customizavel: boolean; multipla: boolean; valores: string[] }

// Seletor de categoria: só FOLHAS (o TikTok recusa categoria-mãe), busca pelo caminho completo.
function SeletorCategoria({ valor, nome, onEscolher }: { valor?: string; nome?: string; onEscolher: (f: Folha) => void }) {
  const [folhas, setFolhas] = useState<Folha[] | null>(null)
  const [aviso, setAviso] = useState('')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  async function abrir() {
    setAberto(true)
    if (folhas) return
    const j = await fetch('/api/marketplace/categorias').then(r => r.json()).catch(() => ({}))
    setFolhas(j.folhas ?? []); if (j.aviso) setAviso(j.aviso)
  }
  const termos = busca.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean)
  const lista = (folhas ?? []).filter(f => { const c = f.caminho.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return termos.every(t => c.includes(t)) }).slice(0, 60)
  return (
    <div className="col-span-2">
      <span>Categoria do TikTok (subcategoria final)</span>
      <button type="button" onClick={abrir} className="mt-1 w-full text-left border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white">
        {valor ? (nome || `ID ${valor}`) : <span className="text-gray-400">Escolher categoria…</span>}
      </button>
      {aberto && (
        <div className="mt-1 rounded-lg border border-gray-200 bg-white p-2">
          <input autoFocus className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm" placeholder="Buscar (ex.: agenda, caderno, caneca)" value={busca} onChange={e => setBusca(e.target.value)} />
          {folhas === null && <p className="mt-2 text-gray-400">Carregando categorias do TikTok…</p>}
          {aviso && <p className="mt-2 text-amber-700">{aviso}</p>}
          <ul className="mt-1 max-h-56 overflow-auto">
            {lista.map(f => (
              <li key={f.id}><button type="button" onClick={() => { onEscolher(f); setAberto(false) }} className="w-full text-left px-2 py-1 rounded hover:bg-orange-50 text-gray-700">{f.caminho}</button></li>
            ))}
            {folhas && lista.length === 0 && <li className="px-2 py-1 text-gray-400">Nada encontrado.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function PainelMarketplaceProduto({ produtoId }: { produtoId: string }) {
  const [liberado, setLiberado] = useState<boolean | null>(null)
  const [aberto, setAberto] = useState(false)
  const [campos, setCampos] = useState<Campos>({})
  const [faltando, setFaltando] = useState<string[]>([])
  const [status, setStatus] = useState('nao_publicado')
  const [ultimoErro, setUltimoErro] = useState<string | null>(null)
  const [linkAnuncio, setLinkAnuncio] = useState<string | null>(null)
  const [msg, setMsg] = useState(''); const [salvando, setSalvando] = useState(false)
  const [atributos, setAtributos] = useState<Atributo[]>([])
  const [exigencias, setExigencias] = useState<string[]>([])
  const categoriaId = campos.categoriaId
  // Atributos da categoria escolhida (os obrigatórios primeiro) — vêm da API do TikTok.
  useEffect(() => {
    if (!aberto || !categoriaId || !/^\d+$/.test(categoriaId)) return
    let vivo = true
    fetch('/api/marketplace/categorias/atributos?categoriaId=' + categoriaId).then(r => r.json()).then(j => {
      if (!vivo) return
      setAtributos(j.atributos ?? []); setExigencias(j.exigencias ?? [])
    }).catch(() => {})
    return () => { vivo = false }
  }, [aberto, categoriaId])

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
          <label className="col-span-2">Descrição<textarea className={inp} rows={3} value={campos.descricao ?? ''} onChange={e => up('descricao', e.target.value)} placeholder="Uma linha por parágrafo (vira HTML no TikTok)" /></label>
          <SeletorCategoria valor={campos.categoriaId} nome={campos.categoriaNome} onEscolher={f => setCampos(c => ({ ...c, categoriaId: f.id, categoriaNome: f.caminho }))} />
          {exigencias.map(x => <p key={x} className="col-span-2 text-amber-700">{x}</p>)}
          {atributos.length > 0 && (
            <div className="col-span-2 grid grid-cols-2 gap-2 rounded-lg border border-gray-100 bg-white p-2">
              <p className="col-span-2 font-medium text-gray-600">Atributos da categoria <span className="font-normal text-gray-400">(* obrigatório no TikTok)</span></p>
              {atributos.filter(a => a.obrigatorio || campos.atributos?.[a.id]).concat(atributos.filter(a => !a.obrigatorio && !campos.atributos?.[a.id]).slice(0, 4)).map(a => (
                <label key={a.id}>{a.nome}{a.obrigatorio && <b className="text-red-500"> *</b>}
                  {a.valores.length > 0 && !a.customizavel && !a.multipla ? (
                    <select className={inp} value={campos.atributos?.[a.id] ?? ''} onChange={e => setCampos(c => ({ ...c, atributos: { ...c.atributos, [a.id]: e.target.value } }))}>
                      <option value="">—</option>
                      {a.valores.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <>
                      <input className={inp} list={'tt-' + a.id} value={campos.atributos?.[a.id] ?? ''} placeholder={a.multipla ? 'separe por ;' : ''} onChange={e => setCampos(c => ({ ...c, atributos: { ...c.atributos, [a.id]: e.target.value } }))} />
                      {a.valores.length > 0 && <datalist id={'tt-' + a.id}>{a.valores.map(v => <option key={v} value={v} />)}</datalist>}
                    </>
                  )}
                </label>
              ))}
            </div>
          )}
          <label>Marca<input className={inp} value={campos.marca ?? ''} onChange={e => up('marca', e.target.value)} placeholder="vazio = Sem marca" /></label>
          <label>GTIN / EAN<input className={inp} value={campos.gtin ?? ''} onChange={e => up('gtin', e.target.value)} /></label>
          <p className="col-span-2 text-[11px] text-gray-500 bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">🖼️ As <b>fotos da variação</b> (na configuração da variação, em Precificação) são usadas no anúncio automaticamente — não precisa colar URL. Sem foto? Adicione fotos à variação.</p>
          <label>Peso (g)<input className={inp} inputMode="decimal" value={campos.pesoGramas ?? ''} onChange={e => up('pesoGramas', num(e.target.value))} /></label>
          <div className="grid grid-cols-3 gap-1">
            <label>C(cm)<input className={inp} inputMode="decimal" value={campos.dimensoes?.comprimento ?? ''} onChange={e => upDim('comprimento', num(e.target.value))} /></label>
            <label>L<input className={inp} inputMode="decimal" value={campos.dimensoes?.largura ?? ''} onChange={e => upDim('largura', num(e.target.value))} /></label>
            <label>A<input className={inp} inputMode="decimal" value={campos.dimensoes?.altura ?? ''} onChange={e => upDim('altura', num(e.target.value))} /></label>
          </div>
          <label className="col-span-2">Estoque do anúncio <span className="text-gray-400">(usado quando a variação não tem controle no Estoque de Produtos)</span><input className={inp} inputMode="numeric" value={campos.estoqueAnuncio ?? ''} onChange={e => up('estoqueAnuncio', num(e.target.value))} /></label>
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
