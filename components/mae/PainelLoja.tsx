'use client'
'use no memo'
// LOJA DA NATY (Sprint 12): packs de tema e presets — pegar (grátis) ou comprar pelo checkout do SOA,
// baixar o pack para "Packs Naty/" e aplicar na base aberta (pelo nome das partes, com aviso das partes
// que o pack não cobre). A conta da Naty também PUBLICA o tema aberto como pack.
import { Secao } from './Funcoes'
import { confirmarTroca } from './historicoGlobal'
import { useEditor } from './estado'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { ShoppingBag, Download, Loader2, Upload, ExternalLink } from 'lucide-react'
import { useBiblioteca, useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { gravar, ler, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { aplicarPack, avisosDoPack, arquivosDoTema, caminhoNoPack, slugPack, type InfoPack } from '@/lib/mae/pedidos/loja'
import { DocTema } from '@/lib/mae/schema'
import { salvarTema } from './arquivosMae'
import { apiMae } from './pedidosMae'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
/** Loja aberta (o item "Loja da Naty" do menu abre o painel já expandido). */
export const useLojaAberta = create<{ aberta: boolean }>()(() => ({ aberta: false }))
const reais = (c: number | null) => (c ? `R$ ${(c / 100).toFixed(2).replace('.', ',')}` : 'grátis')
interface Pack { id: string; version: number; nome: string; descricao: string; precoCentavos: number | null; partes: string[]; arquivos: number; comprado: boolean }
interface Preset { id: string; nome: string; precoCentavos: number | null; comprado: boolean }

export default function PainelLoja() {
  const funcao = useEditor(s => s.funcao)
  useEffect(() => { if (funcao === 'loja') useLojaAberta.setState({ aberta: true }) }, [funcao])
  return <Secao ids={['loja']}><PainelLojaConteudo /></Secao>
}

function PainelLojaConteudo() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const aberta = useLojaAberta(s => s.aberta)
  const setAberta = (f: (a: boolean) => boolean) => useLojaAberta.setState(s => ({ aberta: f(s.aberta) }))
  const [loja, setLoja] = useState<{ packs: Pack[]; presets: Preset[] } | null>(null)
  const [ehNaty, setEhNaty] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [cpf, setCpf] = useState('')
  const [precisaCpf, setPrecisaCpf] = useState<string | null>(null)
  const [pub, setPub] = useState({ preco: '', descricao: '' })

  async function carregar() {
    try { setLoja(await (await fetch('/api/mae/loja')).json()) } catch { setMsg('Loja indisponível agora.') }
    apiMae.addons().then(a => setEhNaty(a.ehNaty)).catch(() => {})
  }
  useEffect(() => { if (aberta && !loja) void carregar() }, [aberta]) // eslint-disable-line react-hooks/exhaustive-deps

  async function comprar(tipo: 'pack' | 'preset', id: string) {
    setOcupado(id); setMsg(null)
    try {
      const r = await fetch('/api/mae/loja/comprar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, id, ...(cpf ? { cpf } : {}) }) })
      const j = await r.json()
      if (j.precisaCpf) { setPrecisaCpf(id); setMsg(j.error); return }
      if (!r.ok) { setMsg(j.error || 'Não consegui comprar.'); return }
      if (j.invoiceUrl) { window.open(j.invoiceUrl, '_blank', 'noopener'); setMsg('Pague na fatura que abriu (Pix ou cartão). Assim que o pagamento confirmar, o pack libera aqui.') }
      setPrecisaCpf(null); await carregar()
    } finally { setOcupado(null) }
  }

  async function baixarEAplicar(p: Pack) {
    if (!raiz) return
    setOcupado(p.id); setMsg(null)
    try {
      const r = await fetch(`/api/mae/loja/pack/${encodeURIComponent(p.id)}`)
      const j = await r.json()
      if (!r.ok) { setMsg(j.error || 'Não consegui baixar.'); return }
      const raw = j.doc as { loja: InfoPack }
      const info = raw.loja
      const pack = DocTema.parse(raw)
      let n = 0
      for (const a of info.arquivos) {
        const destino = caminhoNoPack(pack.name ?? pack.id, a.path)
        try { const f = await ler(raiz, destino); if ((await sha256(f)) === a.sha256) { n++; continue } } catch { /* ainda não baixado */ }
        const b = await (await fetch(a.url)).blob()
        await gravar(raiz, destino, b); n++
        setMsg(`Baixando ${n} de ${info.arquivos.length} arquivos para Packs Naty/${slugPack(pack.name ?? pack.id)}/…`)
      }
      const novoId = 'th_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      const r2 = aplicarPack(pack, info, doc, novoId)
      // Lote 4 (item 30): o pack vira o tema aberto — o atual com alterações pergunta antes
      if (!(await confirmarTroca('tema'))) return
      await salvarTema(raiz, r2.tema)
      useMaeTema.getState().carregar(r2.tema)
      const av = avisosDoPack(r2.semConteudo)
      setMsg(`Pack "${pack.name}" aplicado na base "${doc.name}".${av.length ? ' Atenção: ' + av.join('; ') + '.' : ''}`)
    } catch (e) { setMsg(`Falhou: ${(e as Error).message}`) } finally { setOcupado(null) }
  }

  async function publicar() {
    if (!raiz || !tema) return
    setOcupado('publicar'); setMsg(null)
    try {
      const { upload } = await import('@vercel/blob/client')
      const arquivos = []
      for (const path of arquivosDoTema(tema)) {
        const f = await ler(raiz, path)
        const b = await upload(`mae-loja/${slugPack(tema.name ?? tema.id)}/${path.replace(/[^A-Za-z0-9._/-]/g, '_')}`, f, { access: 'public', handleUploadUrl: '/api/mae/loja/upload' })
        arquivos.push({ path, url: b.url, sha256: await sha256(f) })
        setMsg(`Enviando ${arquivos.length} arquivos…`)
      }
      const partes = Object.fromEntries(Object.keys(tema.partContent).map(id => [id, doc.parts.find(p => p.id === id)?.name ?? id]))
      const preco = Math.round(Number(pub.preco.replace(',', '.')) * 100) || null
      const r = await fetch('/api/mae/loja/publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc: tema, precoCentavos: preco, descricao: pub.descricao, partes, arquivos }) })
      const j = await r.json()
      setMsg(r.ok ? `Publicado na Loja (v${j.version}).` : j.error || 'Não consegui publicar.')
      await carregar()
    } catch (e) { setMsg(`Falhou: ${(e as Error).message}`) } finally { setOcupado(null) }
  }

  return (
    <section className="space-y-2" data-painel-loja>
      <button className="flex w-full items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white" onClick={() => setAberta(a => !a)} data-abrir-loja><ShoppingBag className="w-4 h-4 text-orange-500" /> Loja da Naty {aberta ? '▾' : '▸'}</button>
      {aberta && (<>
        {!loja && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        {loja && !loja.packs.length && !loja.presets.length && <p className="text-[11px] text-gray-400">A Naty ainda não publicou packs.</p>}
        {loja?.packs.map(p => (
          <div key={p.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-xs space-y-1" data-pack={p.nome}>
            <div className="flex items-center gap-1"><b className="flex-1">{p.nome}</b><span className="text-gray-500">{reais(p.precoCentavos)}</span></div>
            {p.descricao && <p className="text-[11px] text-gray-500">{p.descricao}</p>}
            <p className="text-[10px] text-gray-400">Partes: {p.partes.join(', ') || '—'} · {p.arquivos} arquivos</p>
            {p.comprado
              ? <button className={btn} disabled={!liberada || !!ocupado} onClick={() => baixarEAplicar(p)} data-baixar-pack>{ocupado === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Baixar e aplicar nesta base</button>
              : <button className={btn} disabled={!!ocupado} onClick={() => comprar('pack', p.id)} data-comprar-pack><ShoppingBag className="w-3 h-3" /> Comprar ({reais(p.precoCentavos)})</button>}
            {precisaCpf === p.id && <div className="flex gap-1"><input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="CPF do titular" inputMode="numeric" className="flex-1 rounded border border-gray-200 bg-transparent px-1" /><button className={btn} onClick={() => comprar('pack', p.id)}>Continuar</button></div>}
          </div>
        ))}
        {!!loja?.presets.length && <p className="text-[11px] font-semibold pt-1">Presets de nome</p>}
        {loja?.presets.map(p => (
          <div key={p.id} className="flex items-center gap-1 text-xs" data-preset-loja={p.nome}>
            <span className="flex-1">{p.nome}</span><span className="text-gray-500">{reais(p.precoCentavos)}</span>
            {p.comprado ? <span className="text-emerald-700 text-[11px]">na sua biblioteca</span> : <button className={btn} disabled={!!ocupado} onClick={() => comprar('preset', p.id)}>Comprar</button>}
          </div>
        ))}
        {ehNaty && tema && (
          <div className="rounded-lg border border-orange-200 p-2 space-y-1 text-xs" data-publicar-loja>
            <p className="font-semibold">Publicar “{tema.name}” como pack</p>
            <input value={pub.preco} onChange={e => setPub(x => ({ ...x, preco: e.target.value }))} placeholder="Preço em R$ (vazio = grátis)" inputMode="decimal" className="w-full rounded border border-gray-200 bg-transparent px-1" />
            <input value={pub.descricao} onChange={e => setPub(x => ({ ...x, descricao: e.target.value }))} placeholder="Descrição" className="w-full rounded border border-gray-200 bg-transparent px-1" />
            <button className={btn} disabled={!!ocupado || !liberada} onClick={publicar} data-publicar>{ocupado === 'publicar' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Publicar na Loja</button>
          </div>
        )}
        {msg && <p className="text-[11px] text-gray-600 dark:text-gray-300" data-msg-loja>{msg} {msg.includes('fatura') && <ExternalLink className="inline w-3 h-3" />}</p>}
      </>)}
    </section>
  )
}
