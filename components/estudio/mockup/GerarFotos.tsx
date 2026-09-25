'use client'
// SOA Edition — GERAR FOTOS: N artes × M produtos-mockup → foto pronta para postar (com cena, se quiser)
// ou o KIT DE LISTAGEM inteiro (frente/ângulo/detalhe/medidas/em uso nos tamanhos de cada marketplace).
// Cada foto é autorizada (e debitada) pelo servidor antes de sair. Teto: 50 por execução.
'use no memo'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Download, Upload, Check, Trash2 } from 'lucide-react'
import { comporMockup, renderCena, gerarKitListagem, blobDe, nomeArquivo, novoCanvas, carregarImagem, CENA_FESTA, aparar } from '@/lib/estudio/mockup'
import { Autorizador, SemCota, baixar, carregarMolde, exigirSaldo } from '@/lib/estudio/cliente'
import { TAMANHOS_CANAIS } from '@/lib/estudio/tamanhos'
import { CENA_PADRAO, type ConfigCena, type ConfigKitListagem } from '@/lib/estudio/mockupTipos'
import type { MockupPronto } from '@/lib/estudio/mockupCliente'
import CotaBarra from '../CotaBarra'
import { inp, lbl, btn, btnP, cartao } from '../caixas/comum'

type Arte = { id: string; nome: string; canvas: HTMLCanvasElement; mini: string }
type Salvo = { id: string; nome: string; valor: ConfigCena }
type KitSalvo = { id: string; nome: string; valor: ConfigKitListagem }
const LIMITE = 50

export default function GerarFotos({ mockups, cenas, kits }: { mockups: MockupPronto[]; cenas: Salvo[]; kits: KitSalvo[] }) {
  const [artes, setArtes] = useState<Arte[]>([])
  const [sel, setSel] = useState<string[]>([])
  const [cenaId, setCenaId] = useState<string>('padrao')
  const [canal, setCanal] = useState<string>('shopee')
  const [kitId, setKitId] = useState<string>('')
  const [gerados, setGerados] = useState<{ id: string; nome: string; url: string }[] | null>(null)
  const [rodando, setRodando] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [cotaTick, setCotaTick] = useState(0); const [faltam, setFaltam] = useState(0)

  useEffect(() => {
    fetch('/api/estudio/assets?tipo=gerado').then(r => r.json()).then(d => setGerados((d.assets || d.itens || []).filter((a: { mime?: string; url: string }) => /image\/(png|jpeg|webp)/.test(a.mime || '') || /\.(png|jpe?g|webp)(\?|$)/i.test(a.url)).slice(0, 60))).catch(() => setGerados([]))
  }, [])

  async function addArquivo(f: File) {
    const m = await carregarMolde(f)
    const k = Math.min(1, 2400 / Math.max(m.largura, m.altura))
    const c = novoCanvas(m.largura * k, m.altura * k); c.getContext('2d')!.drawImage(m.fonte, 0, 0, c.width, c.height)
    const mk = 120 / Math.max(c.width, c.height), mini = novoCanvas(c.width * mk, c.height * mk); mini.getContext('2d')!.drawImage(c, 0, 0, mini.width, mini.height)
    setArtes(a => [...a, { id: Math.random().toString(36).slice(2), nome: f.name.replace(/\.[^.]+$/, ''), canvas: c, mini: mini.toDataURL('image/png') }])
  }
  async function addGerado(g: { id: string; nome: string; url: string }) {
    const i = await carregarImagem(g.url)
    const c = novoCanvas(i.naturalWidth, i.naturalHeight); c.getContext('2d')!.drawImage(i, 0, 0)
    setArtes(a => [...a, { id: g.id, nome: g.nome.replace(/\.[^.]+$/, ''), canvas: c, mini: g.url }])
  }

  const escolhidos = mockups.filter(m => sel.includes(m.id))
  const kit = kits.find(k => k.id === kitId)?.valor || null
  const porPar = kit ? kit.tomadas.length * kit.tamanhos.length : 1
  const total = artes.length * escolhidos.length * porPar
  const cena = (): ConfigCena | null => cenaId === 'transparente' ? null : cenaId === 'padrao' ? CENA_PADRAO : cenaId === 'festa' ? CENA_FESTA : cenas.find(c => c.id === cenaId)?.valor || CENA_PADRAO

  async function gerar() {
    setErro(''); setAviso('')
    if (!artes.length || !escolhidos.length) { setErro('Escolha pelo menos uma arte e um produto.'); return }
    if (total > LIMITE) { setErro(`Isso dá ${total} imagens — o máximo é ${LIMITE} por execução. Divida em partes.`); return }
    try {
      await exigirSaldo(total)
      const aut = new Autorizador(total)
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const imgs = new Map<string, HTMLImageElement>()
      const cf = cena()
      if (cf?.fundo.tipo === 'foto') imgs.set(cf.fundo.url, await carregarImagem(cf.fundo.url).catch(() => null as never))
      let i = 0
      for (const a of artes) for (const m of escolhidos) {
        const composto = comporMockup(m.produto, a.canvas, m.cfg)
        const produto = aparar(composto)
        const pasta = `${nomeArquivo(a.nome)}_${nomeArquivo(m.nome)}`
        if (kit) {
          const fotos = await gerarKitListagem({
            vistas: { frente: composto, area: m.cfg.area }, kit: { ...kit, medidas: m.medidas }, cenaUso: cf || CENA_FESTA, img: u => imgs.get(u),
            autorizar: k => aut.garantir(i + k), aoProgredir: (f, t) => setRodando(`Kit ${pasta}: ${f}/${t}`),
          })
          for (const f of fotos) zip.file(`${pasta}/${nomeArquivo(f.canal.canal)}/${f.tomada}_${f.canal.largura}x${f.canal.altura}.jpg`, await blobDe(f.canvas))
          i += fotos.length
        } else {
          await aut.garantir(i)
          setRodando(`${i + 1}/${total}`)
          if (!cf) zip.file(`${pasta}.png`, await blobDe(produto, 'image/png'))
          else { const t = TAMANHOS_CANAIS.find(x => x.id === canal) || TAMANHOS_CANAIS[0]; zip.file(`${pasta}.jpg`, await blobDe(renderCena(produto, cf, t.largura, t.altura, u => imgs.get(u)))) }
          i++
        }
        await new Promise(r => setTimeout(r, 0))
      }
      baixar(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), kit ? 'kit-listagem.zip' : 'fotos-mockup.zip')
      setAviso(`${total} foto(s) prontas — o download começou.`)
    } catch (e) {
      if (e instanceof SemCota) { setErro(e.message); setFaltam(e.faltam) } else setErro((e as Error).message)
    } finally { setRodando(''); setCotaTick(x => x + 1) }
  }

  return (
    <div className="space-y-4">
      <CotaBarra atualizar={cotaTick} faltam={faltam} />
      <div className={`${cartao} space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">1. Artes</p>
          <label className={`${btn} cursor-pointer text-xs`}><Upload className="w-3.5 h-3.5" /> Subir artes<input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={async e => { const fs = [...(e.target.files || [])]; e.target.value = ''; for (const f of fs) await addArquivo(f).catch(x => setErro((x as Error).message)) }} /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          {artes.map(a => (
            <div key={a.id} className="relative w-20"><img src={a.mini} alt={a.nome} className="w-20 h-20 object-contain rounded-lg border border-gray-200 bg-white" /><p className="text-[10px] truncate">{a.nome}</p>
              <button onClick={() => setArtes(x => x.filter(y => y.id !== a.id))} className="absolute -top-1 -right-1 bg-white rounded-full shadow"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></div>
          ))}
          {!artes.length && <p className="text-xs text-gray-400">Suba as artes (PNG com fundo transparente fica melhor) ou escolha das já geradas abaixo.</p>}
        </div>
        {!!gerados?.length && (
          <details className="text-xs"><summary className="cursor-pointer text-gray-500">Usar artes já geradas ({gerados.length})</summary>
            <div className="flex flex-wrap gap-1.5 mt-2">{gerados.map(g => <button key={g.id} onClick={() => addGerado(g)} className="w-16" title={g.nome}><img src={g.url} alt="" className="w-16 h-16 object-contain rounded border bg-white" /></button>)}</div>
          </details>
        )}
      </div>
      <div className={`${cartao} space-y-2`}>
        <p className="text-sm font-semibold">2. Produtos</p>
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-5 lg:grid-cols-7">
          {mockups.map(m => {
            const on = sel.includes(m.id)
            return (
              <button key={m.id} onClick={() => setSel(s => (on ? s.filter(x => x !== m.id) : [...s, m.id]))} className={`relative rounded-xl border p-1.5 text-left ${on ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`}>
                <Miniatura m={m} />
                <p className="text-[10px] truncate mt-1">{m.nome}</p>
                <span className="text-[9px] text-gray-400">{m.origem === 'meu' ? 'meu' : m.origem === 'caixa' ? 'caixa montada' : 'biblioteca'}</span>
                {on && <Check className="absolute top-1 right-1 w-4 h-4 text-orange-500" />}
              </button>
            )
          })}
        </div>
      </div>
      <div className={`${cartao} grid gap-3 sm:grid-cols-3 items-end`}>
        <div><label className={lbl}>3. Cena</label>
          <select className={inp} value={cenaId} onChange={e => setCenaId(e.target.value)}>
            <option value="padrao">Estúdio (padrão)</option><option value="festa">Festa</option><option value="transparente">Sem cena (PNG transparente)</option>
            {cenas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Tamanho da foto</label>
          <select className={inp} value={canal} onChange={e => setCanal(e.target.value)} disabled={cenaId === 'transparente' || !!kit}>
            {TAMANHOS_CANAIS.map(t => <option key={t.id} value={t.id}>{t.canal} · {t.rotulo}</option>)}
          </select>
        </div>
        <div><label className={lbl}>Kit de listagem (opcional)</label>
          <select className={inp} value={kitId} onChange={e => setKitId(e.target.value)}>
            <option value="">Só a foto</option>{kits.map(k => <option key={k.id} value={k.id}>{k.nome}</option>)}
          </select>
        </div>
        <div className="sm:col-span-3 flex flex-wrap items-center gap-3">
          <button onClick={gerar} disabled={!!rodando} className={btnP}>{rodando ? <><Loader2 className="w-4 h-4 animate-spin" /> {rodando}</> : <><Download className="w-4 h-4" /> Gerar {total || ''} foto(s)</>}</button>
          <span className="text-xs text-gray-500">Usa {total} imagem(ns) da sua cota{total > LIMITE ? ` — passa do limite de ${LIMITE}` : ''}.</span>
          {erro && <span className="text-xs text-red-600">{erro}</span>}
          {aviso && <span className="text-xs text-green-700">{aviso}</span>}
        </div>
      </div>
    </div>
  )
}

function Miniatura({ m }: { m: MockupPronto }) {
  const url = useMemo(() => {
    const k = 110 / Math.max(m.produto.width, m.produto.height), c = novoCanvas(m.produto.width * k, m.produto.height * k)
    c.getContext('2d')!.drawImage(m.produto, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  }, [m])
  return url ? <img src={url} alt="" className="w-full aspect-square object-contain bg-gray-50 rounded-lg" /> : <div className="w-full aspect-square bg-gray-50 rounded-lg" />
}
