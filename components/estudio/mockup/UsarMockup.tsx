'use client'
// SOA Design — USAR MOCKUP (o dia a dia; a ÚNICA porta de gerar): escolhe o(s) mockup(s) → sobe as artes → cada arte
// cai na FACE certa pelo nome do arquivo (vinculação semântica: "sereia_frente" → área "frente") → confere SÓ as
// exceções → ajusta o enquadramento se quiser → gera em lote (fila; falha de 1 não derruba o lote; cota no servidor).
// Mockup de áreas: arte por face. Produto da biblioteca/caixa montada: uma arte por foto (como sempre).
'use no memo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Download, Upload, Check, Trash2, AlertTriangle, ChevronDown, ChevronRight, Move, CheckCircle2, XCircle } from 'lucide-react'
import { comporMockup, renderCena, gerarKitListagem, blobDe, nomeArquivo, novoCanvas, carregarImagem, CENA_FESTA, aparar } from '@/lib/estudio/mockup'
import { Autorizador, SemCota, baixar, carregarMolde, exigirSaldo } from '@/lib/estudio/cliente'
import { TAMANHOS_CANAIS } from '@/lib/estudio/tamanhos'
import { LIMITE_LOTE } from '@/lib/estudio/dados'
import { CENA_PADRAO, type ConfigCena, type ConfigKitListagem } from '@/lib/estudio/mockupTipos'
import { comporAreas, contornoDaArea, TRANSFORM_PADRAO, type SmartArea, type TransformArte } from '@/lib/estudio/mockupFoto'
import { agruparArtes, type GrupoVinculo } from '@/lib/estudio/vinculo'
import type { MockupPronto } from '@/lib/estudio/mockupCliente'
import FiltroSegmento, { filtrarPorSegmento } from './FiltroSegmento'
import AlcasArte from './AlcasArte'
import CotaBarra from '../CotaBarra'
import { inp, lbl, btn, btnP, cartao } from '../caixas/comum'

type Arte = { id: string; nome: string; canvas: HTMLCanvasElement; mini: string }
type Salvo = { id: string; nome: string; valor: ConfigCena }
type KitSalvo = { id: string; nome: string; valor: ConfigKitListagem }
type Escolha = string | 'lisa'
type Item = { chave: string; mockup: MockupPronto; grupo: GrupoVinculo; estado: 'fila' | 'gerando' | 'ok' | 'erro'; msg?: string }
const LADO_PREVIA = 1000
const reduzir = (src: HTMLCanvasElement, lado: number) => { const k = Math.min(1, lado / Math.max(src.width, src.height)), c = novoCanvas(src.width * k, src.height * k); c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c }

export default function UsarMockup({ mockups, cenas, kits, inicial }: { mockups: MockupPronto[]; cenas: Salvo[]; kits: KitSalvo[]; inicial?: string | null }) {
  const [artes, setArtes] = useState<Arte[]>([])
  const [sel, setSel] = useState<string[]>(inicial ? [inicial] : [])
  const [segmento, setSegmento] = useState(''); const [busca, setBusca] = useState('')
  // conferência: escolha manual por (mockup, grupo, área) · grupos conferidos · ajuste do enquadramento por (mockup, grupo, área)
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({})
  const [conferidos, setConferidos] = useState<Record<string, boolean>>({})
  const [ajustes, setAjustes] = useState<Record<string, TransformArte>>({})
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [previa, setPrevia] = useState<{ mid: string; gid: string } | null>(null)
  const [areaSel, setAreaSel] = useState<string | null>(null)
  const [cenaId, setCenaId] = useState('nenhuma')
  const [formato, setFormato] = useState<'jpg' | 'png'>('jpg')
  const [canal, setCanal] = useState('original')
  const [kitId, setKitId] = useState('')
  const [fila, setFila] = useState<Item[] | null>(null)
  const [rodando, setRodando] = useState(false); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [cotaTick, setCotaTick] = useState(0); const [faltam, setFaltam] = useState(0)
  const [gerados, setGerados] = useState<{ id: string; nome: string; url: string }[] | null>(null)
  const palcoRef = useRef<HTMLDivElement>(null)
  const previaRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => { if (inicial) setSel(s => (s.includes(inicial) ? s : [inicial, ...s])) }, [inicial])
  useEffect(() => {
    fetch('/api/estudio/assets?tipo=gerado').then(r => r.json()).then(d => setGerados((d.assets || d.itens || []).filter((a: { mime?: string; url: string }) => /image\/(png|jpeg|webp)/.test(a.mime || '') || /\.(png|jpe?g|webp)(\?|$)/i.test(a.url)).slice(0, 60))).catch(() => setGerados([]))
  }, [])

  async function addArquivo(f: File) {
    const m = await carregarMolde(f)
    const k = Math.min(1, 2400 / Math.max(m.largura, m.altura))
    const c = novoCanvas(m.largura * k, m.altura * k); c.getContext('2d')!.drawImage(m.fonte, 0, 0, c.width, c.height)
    const mk = 120 / Math.max(c.width, c.height), mini = novoCanvas(c.width * mk, c.height * mk); mini.getContext('2d')!.drawImage(c, 0, 0, mini.width, mini.height)
    setArtes(a => [...a, { id: Math.random().toString(36).slice(2) + Date.now().toString(36), nome: f.name.replace(/\.[^.]+$/, ''), canvas: c, mini: mini.toDataURL('image/png') }])
  }
  async function addGerado(g: { id: string; nome: string; url: string }) {
    const i = await carregarImagem(g.url)
    const c = novoCanvas(i.naturalWidth, i.naturalHeight); c.getContext('2d')!.drawImage(i, 0, 0)
    setArtes(a => [...a, { id: `${g.id}_${Date.now().toString(36)}`, nome: g.nome.replace(/\.[^.]+$/, ''), canvas: c, mini: g.url }])
  }

  const escolhidos = mockups.filter(m => sel.includes(m.id))
  const porId = useMemo(() => new Map(artes.map(a => [a.id, a])), [artes])
  // grupos (uma foto cada) por mockup: mockup de áreas → vinculação semântica; senão → uma arte por foto
  const grupos = useMemo(() => {
    const out = new Map<string, GrupoVinculo[]>()
    for (const m of escolhidos) out.set(m.id, m.smart ? agruparArtes(artes, m.smart.cfg.areas, m.nome) : artes.map(a => ({ id: `g_${a.id}`, tema: a.nome, porArea: {}, principal: a.id, avisos: [], confianca: 1 })))
    return out
  }, [escolhidos.map(m => m.id).join(','), artes]) // eslint-disable-line react-hooks/exhaustive-deps
  const chave = (mid: string, gid: string, aid?: string) => `${mid}|${gid}${aid ? `|${aid}` : ''}`
  const arteDe = (m: MockupPronto, g: GrupoVinculo, a: SmartArea): Arte | null => {
    const e = escolhas[chave(m.id, g.id, a.id)]
    if (e === 'lisa') return null
    const id = e || g.porArea[a.id] || g.principal
    return (id && porId.get(id)) || null
  }
  const pendente = (m: MockupPronto, g: GrupoVinculo) => g.avisos.length > 0 && !conferidos[chave(m.id, g.id)]
  const todosItens = escolhidos.flatMap(m => (grupos.get(m.id) || []).map(g => ({ m, g })))
  const pendentes = todosItens.filter(({ m, g }) => pendente(m, g))
  const kit = kits.find(k => k.id === kitId)?.valor || null
  const porPar = kit ? kit.tomadas.length * kit.tamanhos.length : 1
  const total = todosItens.length * porPar
  const cena = (): ConfigCena | null | 'nenhuma' => cenaId === 'nenhuma' ? 'nenhuma' : cenaId === 'transparente' ? null : cenaId === 'padrao' ? CENA_PADRAO : cenaId === 'festa' ? CENA_FESTA : cenas.find(c => c.id === cenaId)?.valor || CENA_PADRAO

  /** A foto de um (mockup, grupo): cada face com a sua arte e o seu enquadramento. */
  function compor(m: MockupPronto, g: GrupoVinculo, base?: HTMLCanvasElement): HTMLCanvasElement | null {
    if (m.smart) return comporAreas(base || m.smart.foto, m.smart.cfg, a => arteDe(m, g, a)?.canvas || null, a => ajustes[chave(m.id, g.id, a.id)])
    const a = g.principal ? porId.get(g.principal) : null
    if (!a) return null
    return m.compor ? m.compor(a.canvas) : comporMockup(m.produto, a.canvas, m.cfg)
  }

  // prévia do grupo escolhido (baixa resolução; a exportação sai em alta)
  const alvo = previa && escolhidos.find(m => m.id === previa.mid)
  const gAlvo = alvo ? (grupos.get(alvo.id) || []).find(g => g.id === previa!.gid) || null : null
  const basePrev = useMemo(() => (alvo?.smart ? reduzir(alvo.smart.foto, LADO_PREVIA) : null), [alvo])
  useEffect(() => {
    const cv = previaRef.current
    if (!cv || !alvo || !gAlvo) return
    const t = requestAnimationFrame(() => { const r = compor(alvo, gAlvo, basePrev || undefined) || (alvo.smart ? basePrev : alvo.produto); if (!r) return; cv.width = r.width; cv.height = r.height; const g = cv.getContext('2d')!; g.clearRect(0, 0, r.width, r.height); g.drawImage(r, 0, 0) })
    return () => cancelAnimationFrame(t)
  }, [alvo, gAlvo, basePrev, JSON.stringify(ajustes), JSON.stringify(escolhas), artes]) // eslint-disable-line react-hooks/exhaustive-deps
  // escolhe a 1ª prévia sozinha
  useEffect(() => {
    if (previa && todosItens.some(i => i.m.id === previa.mid && i.g.id === previa.gid)) return
    const i = todosItens[0]
    setPrevia(i ? { mid: i.m.id, gid: i.g.id } : null); setAreaSel(null)
  }, [todosItens.map(i => i.m.id + i.g.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  function noTamanho(c: HTMLCanvasElement, fundoBranco: boolean): HTMLCanvasElement {
    const t = TAMANHOS_CANAIS.find(x => x.id === canal)
    const W = t ? t.largura : c.width, H = t ? t.altura : c.height
    const out = novoCanvas(W, H), g = out.getContext('2d')!
    if (fundoBranco) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H) }
    const k = Math.min(W / c.width, H / c.height)
    g.imageSmoothingQuality = 'high'; g.drawImage(c, (W - c.width * k) / 2, (H - c.height * k) / 2, c.width * k, c.height * k)
    return out
  }

  async function gerar(mesmoComPendencias = false) {
    setErro(''); setAviso('')
    if (!artes.length || !escolhidos.length) { setErro('Escolha o mockup e suba pelo menos uma arte.'); return }
    if (total > LIMITE_LOTE) { setErro(`Isso dá ${total} imagens — o máximo é ${LIMITE_LOTE} por vez. Divida em partes.`); return }
    if (pendentes.length && !mesmoComPendencias) { setErro(`${pendentes.length} tema(s) precisam de conferência (marcados em amarelo).`); return }
    const itens: Item[] = todosItens.map(({ m, g }) => ({ chave: chave(m.id, g.id), mockup: m, grupo: g, estado: 'fila' }))
    setFila(itens); setRodando(true)
    const marcar = (i: number, p: Partial<Item>) => setFila(f => f && f.map((x, k) => (k === i ? { ...x, ...p } : x)))
    try {
      await exigirSaldo(total)
      const aut = new Autorizador(total)
      const JSZip = (await import('jszip')).default, zip = new JSZip()
      const cf = cena()
      const imgs = new Map<string, HTMLImageElement>()
      if (cf && cf !== 'nenhuma' && cf.fundo.tipo === 'foto') imgs.set(cf.fundo.url, await carregarImagem(cf.fundo.url).catch(() => null as never))
      let n = 0, ok = 0
      for (let i = 0; i < itens.length; i++) {
        const { mockup: m, grupo: g } = itens[i]
        marcar(i, { estado: 'gerando' })
        const pasta = `${nomeArquivo(g.tema || 'arte')}_${nomeArquivo(m.nome)}`
        try {
          await new Promise(r => setTimeout(r, 0))
          const composto = compor(m, g)
          if (!composto) throw new Error('sem arte')
          if (kit) {
            const fotos = await gerarKitListagem({
              vistas: { frente: composto, area: m.cfg.area }, kit: { ...kit, medidas: m.medidas }, cenaUso: cf && cf !== 'nenhuma' ? cf : CENA_FESTA, img: u => imgs.get(u),
              autorizar: k => aut.garantir(n + k), aoProgredir: () => {},
            })
            for (const f of fotos) zip.file(`${pasta}/${nomeArquivo(f.canal.canal)}/${f.tomada}_${f.canal.largura}x${f.canal.altura}.jpg`, await blobDe(f.canvas))
            n += porPar
          } else {
            await aut.garantir(n); n++
            if (cf === 'nenhuma') zip.file(`${pasta}.${formato}`, await blobDe(noTamanho(composto, formato === 'jpg'), formato === 'png' ? 'image/png' : 'image/jpeg', 0.93))
            else if (!cf) zip.file(`${pasta}.png`, await blobDe(aparar(composto), 'image/png'))
            else { const t = TAMANHOS_CANAIS.find(x => x.id === canal) || TAMANHOS_CANAIS[0]; zip.file(`${pasta}.jpg`, await blobDe(renderCena(aparar(composto), cf, t.largura, t.altura, u => imgs.get(u)))) }
          }
          ok++; marcar(i, { estado: 'ok' })
        } catch (e) {
          if (e instanceof SemCota) throw e
          marcar(i, { estado: 'erro', msg: (e as Error).message })     // falha de 1 não derruba o lote
        }
      }
      if (ok) baixar(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), kit ? 'kit-listagem.zip' : `${nomeArquivo(escolhidos.length === 1 ? escolhidos[0].nome : 'mockups')}-fotos.zip`)
      setAviso(`${ok} de ${itens.length} pronta(s) — o download começou.${ok < itens.length ? ' As que falharam estão marcadas na fila.' : ''}`)
    } catch (e) {
      if (e instanceof SemCota) { setErro(e.message); setFaltam(e.faltam) } else setErro((e as Error).message)
    } finally { setRodando(false); setCotaTick(x => x + 1) }
  }

  const aplicarEnquadramentoEmTodos = (m: MockupPronto, aid: string, t: TransformArte) => setAjustes(x => { const y = { ...x }; for (const g of grupos.get(m.id) || []) y[chave(m.id, g.id, aid)] = t; return y })
  const areaAlvo = alvo?.smart?.cfg.areas.find(a => a.id === areaSel) || null
  const arteAlvo = alvo && gAlvo && areaAlvo ? arteDe(alvo, gAlvo, areaAlvo) : null

  return (
    <div className="space-y-4">
      <CotaBarra atualizar={cotaTick} faltam={faltam} />
      <div className={`${cartao} space-y-2`}>
        <p className="text-sm font-semibold">1. Mockup {!!sel.length && <span className="font-normal text-xs text-gray-500">({sel.length} escolhido{sel.length > 1 ? 's' : ''})</span>}</p>
        <FiltroSegmento itens={mockups} segmento={segmento} onSegmento={setSegmento} busca={busca} onBusca={setBusca} />
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-5 lg:grid-cols-8">
          {filtrarPorSegmento(mockups, segmento, busca).map(m => {
            const on = sel.includes(m.id)
            return (
              <button key={m.id} data-mockup={m.nome} onClick={() => setSel(s => (on ? s.filter(x => x !== m.id) : [...s, m.id]))} className={`relative rounded-xl border p-1.5 text-left ${on ? 'border-orange-500 ring-2 ring-orange-200' : 'border-gray-200 dark:border-gray-700'}`}>
                <Miniatura m={m} />
                <p className="text-[10px] truncate mt-1">{m.nome}</p>
                <span className="text-[9px] text-gray-400">{m.smart ? `${m.smart.cfg.areas.length} face(s): ${m.smart.cfg.areas.map(a => a.nome).join(', ')}` : m.origem === 'caixa' ? 'caixa montada' : 'biblioteca'}</span>
                {on && <Check className="absolute top-1 right-1 w-4 h-4 text-orange-500" />}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`${cartao} space-y-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">2. Artes <span className="font-normal text-xs text-gray-500">— dê a face no nome do arquivo: <code>sereia_frente.png</code>, <code>sereia_lateral.png</code>, <code>sereia_alca.png</code>. Sem face no nome = a arte vai em todas as faces.</span></p>
          <div className="flex gap-2">
            {!!artes.length && <button onClick={() => { setArtes([]); setEscolhas({}); setConferidos({}); setAjustes({}); setFila(null) }} className={`${btn} text-xs`}>Limpar</button>}
            <label className={`${btn} cursor-pointer text-xs`}><Upload className="w-3.5 h-3.5" /> Subir artes<input type="file" multiple data-artes-usar accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={async e => { const fs = [...(e.target.files || [])]; e.target.value = ''; for (const f of fs) await addArquivo(f).catch(x => setErro((x as Error).message)) }} /></label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto">
          {artes.map(a => (
            <div key={a.id} className="relative w-16"><img src={a.mini} alt={a.nome} className="w-16 h-16 object-contain rounded-lg border border-gray-200 bg-white" /><p className="text-[9px] truncate" title={a.nome}>{a.nome}</p>
              <button onClick={() => setArtes(x => x.filter(y => y.id !== a.id))} className="absolute -top-1 -right-1 bg-white rounded-full shadow"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button></div>
          ))}
          {!artes.length && <p className="text-xs text-gray-400">Suba as artes (PNG com fundo transparente fica melhor) — pode ser a pasta inteira de uma vez.</p>}
        </div>
        {!!gerados?.length && (
          <details className="text-xs"><summary className="cursor-pointer text-gray-500">Usar artes já geradas ({gerados.length})</summary>
            <div className="flex flex-wrap gap-1.5 mt-2">{gerados.map(g => <button key={g.id} onClick={() => addGerado(g)} className="w-16" title={g.nome}><img src={g.url} alt="" className="w-16 h-16 object-contain rounded border bg-white" /></button>)}</div>
          </details>
        )}
      </div>

      {!!todosItens.length && (
        <div className="grid lg:grid-cols-[1fr_420px] gap-4">
          <div className={`${cartao} space-y-2`}>
            <p className="text-sm font-semibold">3. Conferência <span className="font-normal text-xs text-gray-500">— {todosItens.length - pendentes.length} de {todosItens.length} casaram sozinhas{pendentes.length ? `; ${pendentes.length} pedem atenção` : ' ✓'}</span></p>
            {escolhidos.map(m => {
              const gs = grupos.get(m.id) || []
              const areasM = m.smart?.cfg.areas.filter(a => !a.oculta) || []
              return (
                <div key={m.id} className="space-y-1">
                  {escolhidos.length > 1 && <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{m.nome}</p>}
                  {gs.map(g => {
                    const k = chave(m.id, g.id), pend = pendente(m, g), aberto = abertos[k] ?? pend
                    const ativo = previa?.mid === m.id && previa.gid === g.id
                    return (
                      <div key={g.id} data-grupo={g.tema} data-pendente={pend ? '1' : '0'} className={`rounded-lg border text-xs ${pend ? 'border-amber-400 bg-amber-50/70 dark:bg-amber-950/20' : ativo ? 'border-orange-300' : 'border-gray-200 dark:border-gray-700'}`}>
                        <div className="flex items-center gap-2 px-2 py-1.5">
                          <button onClick={() => setAbertos(x => ({ ...x, [k]: !aberto }))}>{aberto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</button>
                          {pend ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
                          <button onClick={() => { setPrevia({ mid: m.id, gid: g.id }); setAreaSel(null) }} className="flex-1 text-left font-medium truncate">{g.tema}</button>
                          {m.smart && <span className="text-gray-400">{areasM.filter(a => arteDe(m, g, a)).length}/{areasM.length} faces</span>}
                          <button onClick={() => { setPrevia({ mid: m.id, gid: g.id }); setAreaSel(null) }} className="text-gray-400 hover:text-orange-600" title="Ver e ajustar"><Move className="w-3.5 h-3.5" /></button>
                        </div>
                        {aberto && (
                          <div className="px-2 pb-2 space-y-1.5">
                            {g.avisos.map((a, i) => <p key={i} className="text-amber-700 dark:text-amber-300">{a}</p>)}
                            {m.smart && <div className="grid sm:grid-cols-2 gap-1.5">
                              {areasM.map(a => (
                                <label key={a.id} className="flex items-center gap-1.5"><span className="w-24 truncate text-gray-600 dark:text-gray-300">{a.nome}</span>
                                  <select data-escolha={`${g.tema}:${a.nome}`} className="flex-1 min-w-0 border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value={escolhas[chave(m.id, g.id, a.id)] || g.porArea[a.id] || g.principal || 'lisa'}
                                    onChange={e => setEscolhas(x => ({ ...x, [chave(m.id, g.id, a.id)]: e.target.value }))}>
                                    <option value="lisa">(lisa — sem arte)</option>
                                    {artes.map(ar => <option key={ar.id} value={ar.id}>{ar.nome}</option>)}
                                  </select>
                                </label>
                              ))}
                            </div>}
                            {pend && <button onClick={() => setConferidos(x => ({ ...x, [k]: true }))} className="rounded-md bg-emerald-600 text-white px-2 py-0.5 font-semibold" data-conferido>Conferido ✓</button>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {pendentes.length > 1 && <button onClick={() => setConferidos(x => { const y = { ...x }; pendentes.forEach(({ m, g }) => { y[chave(m.id, g.id)] = true }); return y })} className="text-[11px] text-gray-500 hover:text-emerald-700">Marcar todas como conferidas (faces sem arte ficam lisas)</button>}
          </div>

          <div className="space-y-3">
            <div className={`${cartao} space-y-2`}>
              <p className="text-sm font-semibold">Prévia {gAlvo && <span className="font-normal text-xs text-gray-500">— {gAlvo.tema}{escolhidos.length > 1 && alvo ? ` · ${alvo.nome}` : ''}</span>}</p>
              <div ref={palcoRef} className="relative select-none" style={{ touchAction: 'none' }} data-palco-usar>
                <canvas ref={previaRef} className="w-full h-auto rounded-lg bg-gray-100 dark:bg-gray-800" />
                {alvo?.smart && (
                  <>
                    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                      {alvo.smart.cfg.areas.filter(a => !a.oculta).map(a => (
                        <polygon key={a.id} data-face={a.nome} points={contornoDaArea(a.area, 1, 1).map(p => `${p.x},${p.y}`).join(' ')} fill="transparent" stroke={a.id === areaSel ? '#f97316' : 'rgba(148,163,184,0.7)'} strokeWidth={a.id === areaSel ? 2 : 1} strokeDasharray={a.id === areaSel ? undefined : '5 4'} vectorEffect="non-scaling-stroke"
                          style={{ cursor: 'pointer', pointerEvents: a.id === areaSel ? 'none' : 'all' }} onClick={() => setAreaSel(a.id)} />
                      ))}
                    </svg>
                    {areaAlvo && arteAlvo && gAlvo && (
                      <AlcasArte area={areaAlvo.area} W={alvo.smart.foto.width} H={alvo.smart.foto.height} arte={{ w: arteAlvo.canvas.width, h: arteAlvo.canvas.height }} ajuste={alvo.smart.cfg.real.ajuste}
                        t={ajustes[chave(alvo.id, gAlvo.id, areaAlvo.id)] || areaAlvo.transform} palco={palcoRef}
                        onMudar={t => setAjustes(x => ({ ...x, [chave(alvo.id, gAlvo.id, areaAlvo.id)]: t }))} />
                    )}
                  </>
                )}
              </div>
              {alvo?.smart ? (
                areaAlvo && gAlvo ? (
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-gray-600 dark:text-gray-300">Enquadrando <b>{areaAlvo.nome}</b>: arraste, cantos = zoom, bolinha = giro, rodinha = zoom.</span>
                    <button onClick={() => setAjustes(x => { const y = { ...x }; delete y[chave(alvo.id, gAlvo.id, areaAlvo.id)]; return y })} className="text-gray-500 hover:text-orange-600">voltar ao padrão do mockup</button>
                    <button onClick={() => aplicarEnquadramentoEmTodos(alvo, areaAlvo.id, ajustes[chave(alvo.id, gAlvo.id, areaAlvo.id)] || TRANSFORM_PADRAO)} className="text-gray-500 hover:text-orange-600">usar este enquadramento em todos os temas</button>
                    <button onClick={() => setAreaSel(null)} className="rounded-md bg-emerald-600 text-white px-2 py-0.5 font-semibold">OK</button>
                  </div>
                ) : <p className="text-[11px] text-gray-500">Clique numa face para enquadrar a arte dela (opcional — o padrão é o do mockup).</p>
              ) : <p className="text-[11px] text-gray-500">Produto da biblioteca: a arte ocupa a área definida.</p>}
            </div>

            <div className={`${cartao} space-y-2`}>
              <p className="text-sm font-semibold">4. Saída</p>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={lbl}>Cena</label>
                  <select className={inp} value={cenaId} onChange={e => setCenaId(e.target.value)} data-cena>
                    <option value="nenhuma">Sem cena (a imagem do mockup)</option><option value="padrao">Estúdio</option><option value="festa">Festa</option><option value="transparente">PNG transparente (recorte)</option>
                    {cenas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Formato</label>
                  <select className={inp} value={formato} onChange={e => setFormato(e.target.value as 'jpg' | 'png')} disabled={cenaId !== 'nenhuma' || !!kit} data-formato><option value="jpg">JPG</option><option value="png">PNG</option></select>
                </div>
                <div><label className={lbl}>Tamanho</label>
                  <select className={inp} value={canal} onChange={e => setCanal(e.target.value)} disabled={cenaId === 'transparente' || !!kit} data-tamanho>
                    <option value="original">Tamanho do mockup</option>{TAMANHOS_CANAIS.map(t => <option key={t.id} value={t.id}>{t.canal} · {t.rotulo}</option>)}
                  </select>
                </div>
                <div><label className={lbl}>Kit de listagem</label>
                  <select className={inp} value={kitId} onChange={e => setKitId(e.target.value)}><option value="">Só a foto</option>{kits.map(k => <option key={k.id} value={k.id}>{k.nome}</option>)}</select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => gerar()} disabled={rodando || !total} className={btnP} data-gerar>{rodando ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando…</> : <><Download className="w-4 h-4" /> Gerar {total || ''} foto(s)</>}</button>
                {!!pendentes.length && !rodando && <button onClick={() => gerar(true)} className="text-[11px] text-amber-700 hover:underline">gerar assim mesmo (faces sem arte ficam lisas)</button>}
              </div>
              <p className="text-[11px] text-gray-500">Usa {total} imagem(ns) da cota (até {LIMITE_LOTE} por vez){total > LIMITE_LOTE ? ' — passou do limite, divida em partes' : ''}.</p>
              {erro && <p className="text-xs text-red-600">{erro}</p>}
              {aviso && <p className="text-xs text-emerald-700">{aviso}</p>}
              {fila && (
                <div className="max-h-48 overflow-y-auto space-y-0.5 text-[11px]" data-fila>
                  {fila.map((it, i) => (
                    <p key={i} className="flex items-center gap-1.5" data-item-fila={it.estado}>
                      {it.estado === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : it.estado === 'erro' ? <XCircle className="w-3.5 h-3.5 text-red-600" /> : it.estado === 'gerando' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" /> : <span className="w-3.5 h-3.5 rounded-full border border-gray-300 inline-block" />}
                      <span className="truncate">{it.grupo.tema}{escolhidos.length > 1 ? ` · ${it.mockup.nome}` : ''}</span>{it.msg && <span className="text-red-600">— {it.msg}</span>}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Miniatura({ m }: { m: MockupPronto }) {
  const url = useMemo(() => {
    const src = m.smart?.foto || m.produto
    const k = 110 / Math.max(src.width, src.height), c = novoCanvas(src.width * k, src.height * k)
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  }, [m])
  return url ? <img src={url} alt="" className="w-full aspect-square object-contain bg-gray-50 rounded-lg" /> : <div className="w-full aspect-square bg-gray-50 rounded-lg" />
}
