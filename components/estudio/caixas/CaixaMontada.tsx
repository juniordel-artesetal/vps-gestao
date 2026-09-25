'use client'
// SOA Edition — CAIXA MONTADA: a arte de impressão (o molde preenchido) vira a caixa em 3D — frente,
// laterais, trás e cima no lugar certo — com laço, pedra e fundo opcionais. Vistas para o anúncio, lote
// (N nomes × M caixas) e kit de listagem.
'use no memo'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Download, Wand2, Save } from 'lucide-react'
import { carregarMoldeCaixa, listarMoldes, listarTemasCaixas, abrirTemaCaixas, carregarFontesTema, montagemDe, resolverFonteNativa, type MoldeCarregado } from '@/lib/estudio/caixasCliente'
import { carregarImagensTema, renderMoldeTema, nomeDaRegra, type Imagens } from '@/lib/estudio/caixas'
import { renderMontada, VISTAS, type Vista } from '@/lib/estudio/montada'
import { renderCena, gerarKitListagem, blobDe, CENA_FESTA } from '@/lib/estudio/mockup'
import { FUNDOS_PRONTOS } from '@/lib/estudio/cenasAcervo'
import { Autorizador, SemCota, baixar, carregarMolde, exigirSaldo } from '@/lib/estudio/cliente'
import { chamarIA, CUSTO_IA } from '@/lib/estudio/iaCliente'
import { CENA_PADRAO, type ConfigCena, type ConfigKitListagem } from '@/lib/estudio/mockupTipos'
import type { MoldeCaixa, TemaCaixas } from '@/lib/estudio/caixasTipos'
import CotaBarra from '../CotaBarra'
import { CanvasPrevia } from './MapearFaces'
import { inp, lbl, btn, btnP, cartao } from './comum'

type Fundo = { tipo: 'branco' } | { tipo: 'preset'; id: string } | { tipo: 'ia'; tema: string; img: HTMLImageElement | null }
const KIT_PADRAO: ConfigKitListagem = { tomadas: ['frente', 'angulo', 'detalhe', 'em-uso'], tamanhos: ['shopee', 'mercadolivre', 'elo7'], medidas: { largura: 6, altura: 10, profundidade: 6 }, badge: null, cenaId: null }

export default function CaixaMontada() {
  const [moldes, setMoldes] = useState<MoldeCaixa[]>([])
  const [temas, setTemas] = useState<{ id: string; nome: string; temaNome: string | null }[]>([])
  const [moldeId, setMoldeId] = useState('')
  const [origem, setOrigem] = useState<'tema' | 'arquivo' | 'lisa'>('tema')
  const [temaId, setTemaId] = useState('')
  const [linha, setLinha] = useState({ nome: 'Sophia', idade: '4' })
  const [arquivo, setArquivo] = useState<HTMLCanvasElement | null>(null)
  const [laco, setLaco] = useState<{ on: boolean; cor: string }>({ on: false, cor: '#e11d48' })
  const [pedra, setPedra] = useState<{ on: boolean; cor: string }>({ on: false, cor: '#f9a8d4' })
  const [fundo, setFundo] = useState<Fundo>({ tipo: 'branco' })
  const [vistas, setVistas] = useState<Vista[]>(['frente34', 'frente', 'lateral'])
  const [previas, setPrevias] = useState<{ v: Vista; c: HTMLCanvasElement }[]>([])
  const [loteNomes, setLoteNomes] = useState('')
  const [loteMoldes, setLoteMoldes] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [cotaTick, setCotaTick] = useState(0); const [faltam, setFaltam] = useState(0)
  const imgs = useRef<Imagens>(new Map())
  const temaCache = useRef<Record<string, { tema: TemaCaixas; nome: string }>>({})

  useEffect(() => {
    listarMoldes().then(ms => { const ok = ms.filter(m => m.montagem || m.acervoId); setMoldes(ok); if (ok[0]) setMoldeId(ok[0].id) })
    listarTemasCaixas().then(t => { setTemas(t); if (t[0]) setTemaId(t[0].id) })
  }, [])

  const cena = (): ConfigCena => {
    const base = { ...CENA_PADRAO, produto: { cx: 0.5, cy: 0.54, altura: 0.7 }, sombra: { contato: 60, projetada: 28, suavidade: 60 } }
    if (fundo.tipo === 'branco') return { ...base, fundo: { tipo: 'cor', cor: '#ffffff' } }
    if (fundo.tipo === 'preset') return { ...base, fundo: { tipo: 'preset', id: fundo.id } }
    return { ...base, fundo: fundo.img ? { tipo: 'foto', url: 'ia' } : { tipo: 'cor', cor: '#ffffff' } }
  }
  const resolver = (u: string) => (u === 'ia' && fundo.tipo === 'ia' ? fundo.img : null)

  async function temaDo(id: string) {
    if (!temaCache.current[id]) { const t = await abrirTemaCaixas(id); temaCache.current[id] = { tema: t.tema, nome: t.temaNome || t.nome } }
    return temaCache.current[id]
  }

  /** Arte de impressão do molde (tema + nome, arquivo dela, ou nada = caixa lisa). */
  async function arteDe(mc: MoldeCarregado, l: { nome: string; idade: string }): Promise<HTMLCanvasElement | null> {
    if (origem === 'lisa') return null
    if (origem === 'arquivo') {
      if (!arquivo) throw new Error('Suba a arte de impressão (o molde preenchido).')
      const c = document.createElement('canvas'); c.width = mc.W; c.height = mc.H; c.getContext('2d')!.drawImage(arquivo, 0, 0, mc.W, mc.H); return c
    }
    const t = await temaDo(temaId)
    await carregarImagensTema(t.tema, imgs.current); await carregarFontesTema(t.tema)
    // a caixa montada só precisa de ~1400 px por face: renderiza o molde numa escala menor que a impressão
    const k = Math.min(1, 2400 / Math.max(mc.W, mc.H)), W = Math.round(mc.W * k), H = Math.round(mc.H * k)
    const b = document.createElement('canvas'); b.width = W; b.height = H; b.getContext('2d')!.drawImage(mc.dieLine, 0, 0, W, H)
    return renderMoldeTema({ molde: mc.molde, dieLine: b, W, H, tema: { ...t.tema, linhas: false }, linha: l, fonte: resolverFonteNativa, imgs: imgs.current })
  }

  function montar(mc: MoldeCarregado, arte: HTMLCanvasElement | null, v: Vista, lado = 1400) {
    const mont = montagemDe(mc)
    if (!mont) throw new Error(`"${mc.molde.nome}" não tem a montagem 3D — informe as medidas em Mapear faces.`)
    return renderMontada(mont, mc.molde.faces, arte, arte?.width || mc.W, arte?.height || mc.H, { vista: v, lado, laco: laco.on ? { cor: laco.cor } : null, pedra: pedra.on ? { cor: pedra.cor } : null })
  }

  async function previsualizar() {
    const m = moldes.find(x => x.id === moldeId); if (!m) return
    setOcupado('Montando a caixa…'); setErro('')
    try {
      const mc = await carregarMoldeCaixa(m)
      const arte = await arteDe(mc, linha)
      const cfg = cena()
      setPrevias(vistas.map(v => ({ v, c: renderCena(montar(mc, arte, v, 900), cfg, 700, 700, resolver) })))
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }
  useEffect(() => { if (moldeId && (origem !== 'tema' || temaId)) previsualizar() }, [moldeId, origem, temaId, arquivo, laco, pedra, fundo, vistas]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fundoIA() {
    const tema = prompt('Tema do fundo (ex.: Astronauta, Fazendinha, Sonic):', temas.find(t => t.id === temaId)?.temaNome || '')?.trim()
    if (!tema) return
    if (!confirm(CUSTO_IA)) return
    setOcupado('Criando o fundo com IA…'); setErro('')
    const r = await chamarIA('fundo-tema', { tema, proporcao: '1:1' })
    setOcupado(''); setCotaTick(x => x + 1)
    if (r.ok && r.imagem) setFundo({ tipo: 'ia', tema, img: r.imagem })
    else { setErro(`${r.ok ? 'A IA não devolveu imagem.' : r.mensagem} Ficou o fundo branco.`); setFundo({ tipo: 'branco' }) }
  }

  async function exportar(modo: 'vistas' | 'kit' | 'lote') {
    setErro(''); setAviso('')
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const cfg = cena()
      if (modo === 'lote') {
        const nomes = loteNomes.split('\n').map(l => l.split(/[;\t]/).map(x => x.trim())).filter(p => p[0]).map(([nome, idade]) => ({ nome, idade: idade || '' }))
        const ms = moldes.filter(m => loteMoldes.includes(m.id))
        if (!nomes.length || !ms.length) throw new Error('Informe os nomes e marque as caixas do lote.')
        const total = nomes.length * ms.length
        if (total > 50) throw new Error('Máximo de 50 imagens por execução.')
        await exigirSaldo(total); const aut = new Autorizador(total)
        let i = 0
        for (const l of nomes) for (const m of ms) {
          setOcupado(`Gerando ${i + 1}/${total}…`)
          await aut.garantir(i)
          const mc = await carregarMoldeCaixa(m)
          const c = renderCena(montar(mc, await arteDe(mc, l), 'frente34'), cfg, 1200, 1200, resolver)
          zip.file(`${nomeDaRegra('{nome}_{idade}_{molde}', { tema: '', nome: l.nome, idade: l.idade, molde: m.nome })}.jpg`, await blobDe(c))
          i++
        }
      } else {
        const m = moldes.find(x => x.id === moldeId); if (!m) throw new Error('Escolha a caixa.')
        const mc = await carregarMoldeCaixa(m)
        const arte = await arteDe(mc, linha)
        if (modo === 'vistas') {
          await exigirSaldo(vistas.length); const aut = new Autorizador(vistas.length)
          for (let i = 0; i < vistas.length; i++) {
            setOcupado(`Gerando ${i + 1}/${vistas.length}…`); await aut.garantir(i)
            zip.file(`${nomeDaRegra('{nome}_{molde}', { tema: '', nome: linha.nome, idade: '', molde: m.nome })}_${vistas[i]}.jpg`, await blobDe(renderCena(montar(mc, arte, vistas[i]), cfg, 1400, 1400, resolver)))
          }
        } else {
          const kit = await kitEscolhido()
          const d = mc.def?.montagem.dims || mc.molde.montagem?.dims
          const k2: ConfigKitListagem = { ...kit, medidas: d ? { largura: d.l, altura: d.a, profundidade: d.p } : kit.medidas }
          const total = k2.tomadas.length * k2.tamanhos.length
          await exigirSaldo(total); const aut = new Autorizador(total)
          const fotos = await gerarKitListagem({
            vistas: { frente: montar(mc, arte, 'frente'), angulo: montar(mc, arte, 'frente34') }, kit: k2, cenaUso: fundo.tipo === 'branco' ? CENA_FESTA : cfg, img: resolver,
            autorizar: i => aut.garantir(i), aoProgredir: (f, t) => setOcupado(`Kit ${f}/${t}…`),
          })
          for (const f of fotos) zip.file(`${f.canal.canal}/${f.tomada}_${f.canal.largura}x${f.canal.altura}.jpg`, await blobDe(f.canvas))
        }
      }
      baixar(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), modo === 'kit' ? 'kit-listagem.zip' : modo === 'lote' ? 'caixas-montadas.zip' : 'vistas.zip')
      setAviso('Pronto — o download começou.')
    } catch (e) {
      if (e instanceof SemCota) { setErro(e.message); setFaltam(e.faltam) } else setErro((e as Error).message)
    } finally { setOcupado(''); setCotaTick(x => x + 1) }
  }
  async function kitEscolhido(): Promise<ConfigKitListagem> {
    const d = await fetch('/api/estudio/kits-listagem').then(r => r.json()).catch(() => ({}))
    const k = (d.itens || [])[0]
    if (!k) return KIT_PADRAO
    const j = (v: unknown) => (typeof v === 'string' ? JSON.parse(v) : v)
    const cfg = j(k.config) || {}
    return { tomadas: j(k.tomadas), tamanhos: j(k.tamanhos), medidas: cfg.medidas || KIT_PADRAO.medidas, badge: cfg.badge || null, cenaId: cfg.cenaId || null }
  }
  async function salvarMockup() {
    const m = moldes.find(x => x.id === moldeId); if (!m) return
    const r = await fetch('/api/estudio/mockups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: `Caixa montada — ${m.nome}`, tipo: 'caixa', moldeCaixaId: m.id, config: { laco: laco.on ? { cor: laco.cor } : null, pedra: pedra.on ? { cor: pedra.cor } : null, fundo: fundo.tipo === 'ia' ? { tipo: 'ia', tema: fundo.tema } : fundo } }) }).then(x => x.json())
    setAviso(r.id ? 'Mockup de caixa salvo — aparece em Mockups para aplicar artes em lote.' : r.error || 'Não consegui salvar.')
  }

  return (
    <div className="space-y-4">
      <CotaBarra atualizar={cotaTick} faltam={faltam} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className={`${cartao} space-y-3 text-sm`}>
          <div><label className={lbl}>Caixa</label>
            <select className={inp} value={moldeId} onChange={e => setMoldeId(e.target.value)}>{moldes.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
            {!moldes.length && <p className="text-[11px] text-gray-400 mt-1">Adicione caixas em “Moldes e kits”.</p>}
          </div>
          <div><label className={lbl}>Arte</label>
            <select className={inp} value={origem} onChange={e => setOrigem(e.target.value as typeof origem)}>
              <option value="tema">Tema do banco + nome</option><option value="arquivo">Subir a arte de impressão</option><option value="lisa">Caixa lisa (sem arte)</option>
            </select>
          </div>
          {origem === 'tema' && <>
            <select className={inp} value={temaId} onChange={e => setTemaId(e.target.value)}>{temas.map(t => <option key={t.id} value={t.id}>{t.temaNome || t.nome}</option>)}</select>
            <div className="grid grid-cols-2 gap-1.5"><input className={inp} value={linha.nome} onChange={e => setLinha(l => ({ ...l, nome: e.target.value }))} placeholder="Nome" /><input className={inp} value={linha.idade} onChange={e => setLinha(l => ({ ...l, idade: e.target.value }))} placeholder="Idade" /></div>
            <button onClick={previsualizar} className={`${btn} text-xs`}>Atualizar prévia</button>
          </>}
          {origem === 'arquivo' && (
            <label className={`${btn} cursor-pointer text-xs`}>Escolher arte (PNG/JPG/PDF do molde preenchido)
              <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const m = await carregarMolde(f); const c = document.createElement('canvas'); c.width = m.largura; c.height = m.altura; c.getContext('2d')!.drawImage(m.fonte, 0, 0); setArquivo(c) } catch (x) { setErro((x as Error).message) } }} />
            </label>
          )}
          <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange-500" checked={laco.on} onChange={e => setLaco(l => ({ ...l, on: e.target.checked }))} /> Laço <input type="color" value={laco.cor} onChange={e => setLaco(l => ({ ...l, cor: e.target.value }))} className="w-8 h-6 rounded border" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange-500" checked={pedra.on} onChange={e => setPedra(p => ({ ...p, on: e.target.checked }))} /> Pedra/strass <input type="color" value={pedra.cor} onChange={e => setPedra(p => ({ ...p, cor: e.target.value }))} className="w-8 h-6 rounded border" /></label>
            <label className={lbl}>Fundo</label>
            <select className={inp} value={fundo.tipo === 'preset' ? fundo.id : fundo.tipo} onChange={e => { const v = e.target.value; if (v === 'branco') setFundo({ tipo: 'branco' }); else if (v === 'ia') fundoIA(); else setFundo({ tipo: 'preset', id: v }) }}>
              <option value="branco">Branco</option>
              {FUNDOS_PRONTOS.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              <option value="ia">{fundo.tipo === 'ia' ? `IA: ${fundo.tema}` : 'Gerar pelo tema (IA)…'}</option>
            </select>
          </div>
          <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
            <label className={lbl}>Vistas</label>
            <div className="flex flex-wrap gap-1">{VISTAS.map(v => { const on = vistas.includes(v.id); return <button key={v.id} onClick={() => setVistas(vs => (on ? vs.filter(x => x !== v.id) : [...vs, v.id]))} className={`rounded-lg px-2 py-1 text-[11px] border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>{v.nome}</button> })}</div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2">
            <button onClick={() => exportar('vistas')} disabled={!!ocupado} className={btnP}><Download className="w-4 h-4" /> Vistas ({vistas.length})</button>
            <button onClick={() => exportar('kit')} disabled={!!ocupado} className={btn}><Wand2 className="w-4 h-4" /> Kit de listagem</button>
            <button onClick={salvarMockup} className={btn}><Save className="w-4 h-4" /> Salvar como mockup</button>
          </div>
        </div>
        <div className="space-y-3">
          {(ocupado || erro || aviso) && <p className={`text-sm ${erro ? 'text-red-600' : 'text-gray-600'}`}>{ocupado ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {ocupado}</span> : erro || aviso}</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {previas.map(p => <div key={p.v} className={`${cartao} !p-2`}><p className="text-[11px] text-gray-500 mb-1">{VISTAS.find(v => v.id === p.v)?.nome}</p><CanvasPrevia fonte={p.c} className="w-full h-auto rounded-lg" /></div>)}
          </div>
          <div className={`${cartao} space-y-2`}>
            <p className="text-sm font-semibold">Lote: vários nomes × várias caixas</p>
            <textarea className={`${inp} font-mono text-xs h-24`} placeholder={'Sophia;4\nMaria;5'} value={loteNomes} onChange={e => setLoteNomes(e.target.value)} />
            <div className="flex flex-wrap gap-1">{moldes.map(m => { const on = loteMoldes.includes(m.id); return <button key={m.id} onClick={() => setLoteMoldes(l => (on ? l.filter(x => x !== m.id) : [...l, m.id]))} className={`rounded-lg px-2 py-1 text-[11px] border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>{m.nome}</button> })}</div>
            <button onClick={() => exportar('lote')} disabled={!!ocupado} className={btn}><Download className="w-4 h-4" /> Gerar lote (ZIP)</button>
          </div>
        </div>
      </div>
    </div>
  )
}
