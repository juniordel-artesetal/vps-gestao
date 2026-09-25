'use client'
// SOA Edition — painel de ESTILOS DE CAMADA (modelo Photoshop), igual para imagem, forma e TEXTO: cada estilo liga/
// desliga, edita, empilha e reordena; opacidade do preenchimento; catálogo pronto (1 clique, prévia ao passar o mouse);
// "salvar estilo" (EstudioPreset tipo 'estilo-camada') para aplicar em 1 clique noutras camadas. Tudo autoral.
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Save, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react'
import {
  EFEITOS_PRONTOS, CATEGORIAS_EFEITOS, ORDEM_PADRAO, NOMES_EFEITOS, semEfeitos, normalizarEfeitos, efeitoPadrao, deslocamento, anguloDistancia,
  type Efeitos, type ChaveEfeito, type TipoTextura, type Mistura, type Sombra,
} from '@/lib/estudio/efeitos'

const lbl = 'block text-[10px] text-gray-500'
const sel = 'text-[11px] border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800'
const faixa = (rot: string, v: number, min: number, max: number, f: (n: number) => void, suf = '') => (
  <label className={lbl}>{rot} <span className="tabular-nums text-gray-400">{Math.round(v)}{suf}</span>
    <input type="range" min={min} max={max} value={v} onChange={e => f(Number(e.target.value))} className="w-full accent-orange-500" />
  </label>
)
const cor = (v: string, f: (c: string) => void, t = 'Cor') => <input type="color" value={v} onChange={e => f(e.target.value)} className="w-7 h-6 rounded border border-gray-200" title={t} />
const MISTURAS: [Mistura, string][] = [['normal', 'Normal'], ['multiply', 'Multiplicar'], ['screen', 'Tela'], ['overlay', 'Sobrepor'], ['soft-light', 'Luz suave'], ['hard-light', 'Luz direta'], ['color-dodge', 'Subexpor cor'], ['color-burn', 'Superexpor cor'], ['darken', 'Escurecer'], ['lighten', 'Clarear'], ['difference', 'Diferença'], ['color', 'Cor'], ['luminosity', 'Luminosidade']]
const mistura = (v: Mistura | undefined, f: (m: Mistura) => void) => (
  <select className={sel} value={v || 'normal'} onChange={e => f(e.target.value as Mistura)} title="Modo de mesclagem">{MISTURAS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
)

interface Preset { id: string; nome: string; operacoes: Efeitos[] }

export default function PainelEfeitos({ efeitos, ehImagem, onMudar, onPrevia }: {
  efeitos: Efeitos | null
  ehImagem: boolean
  onMudar: (e: Efeitos | null) => void
  /** Prévia temporária (null = volta ao atual). */
  onPrevia: (e: Efeitos | null) => void
}) {
  const [cat, setCat] = useState<string>('Texto')
  const [meus, setMeus] = useState<Preset[]>([])
  const [aberto, setAberto] = useState<ChaveEfeito | null>(null)
  const previaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const atual: Efeitos = normalizarEfeitos(efeitos)
  const ordem: ChaveEfeito[] = (atual.ordem?.length ? [...atual.ordem, ...ORDEM_PADRAO.filter(x => !atual.ordem!.includes(x))] : ORDEM_PADRAO)
    .filter(k => ehImagem || k !== 'moldura')

  // "Meus estilos": o tipo novo ('estilo-camada') e os antigos ('efeito')
  const carregar = () => Promise.all(['estilo-camada', 'efeito'].map(t => fetch(`/api/estudio/presets?tipo=${t}`).then(r => r.json()).then(d => (d.presets || []) as Preset[]).catch(() => [])))
    .then(([a, b]) => setMeus([...a, ...b])).catch(() => {})
  useEffect(() => { carregar() }, [])

  const mesclar = (e: Efeitos): Efeitos => ({ ...atual, ...normalizarEfeitos(e) })
  const previa = (e: Efeitos | null) => {
    if (previaTimer.current) clearTimeout(previaTimer.current)
    previaTimer.current = setTimeout(() => onPrevia(e ? mesclar(e) : null), e ? 120 : 0)
  }
  const mudar = (n: Efeitos) => onMudar(semEfeitos(n) && !n.ordem ? null : n)
  const set = <K extends keyof Efeitos>(k: K, v: Efeitos[K]) => mudar({ ...atual, [k]: v })
  const ligado = (k: ChaveEfeito) => !!atual[k] && !(atual[k] as { off?: boolean }).off
  function alternar(k: ChaveEfeito) {
    const x = atual[k] as { off?: boolean } | null | undefined
    if (!x) { set(k, efeitoPadrao(k) as never); setAberto(k) }
    else set(k, { ...x, off: !x.off } as never)
  }
  function mover(k: ChaveEfeito, d: -1 | 1) {
    const o = [...(atual.ordem?.length ? [...atual.ordem, ...ORDEM_PADRAO.filter(x => !atual.ordem!.includes(x))] : ORDEM_PADRAO)]
    const i = o.indexOf(k), j = i + d
    if (j < 0 || j >= o.length) return
    ;[o[i], o[j]] = [o[j], o[i]]
    mudar({ ...atual, ordem: o })
  }

  async function salvarMeu() {
    if (semEfeitos(atual)) return
    const nome = prompt('Nome do estilo (aplica em 1 clique noutras camadas e textos):', 'Meu estilo')
    if (!nome?.trim()) return
    await fetch('/api/estudio/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, tipo: 'estilo-camada', operacoes: [atual] }) })
    setCat('Meus'); carregar()
  }
  async function excluirMeu(p: Preset) {
    if (!confirm(`Excluir "${p.nome}"?`)) return
    await fetch(`/api/estudio/presets/${p.id}`, { method: 'DELETE' }); carregar()
  }

  const lista = cat === 'Meus' ? [] : EFEITOS_PRONTOS.filter(e => e.categoria === cat && (ehImagem || !e.efeitos.moldura))
  const sombraCtl = (k: 'sombra' | 'sombraInterna') => {
    const s = atual[k] as Sombra
    const { angulo, distancia } = anguloDistancia(s.dx, s.dy)
    const mudarS = (p: Partial<Sombra>) => set(k, { ...s, ...p })
    return (<>
      <div className="flex items-center gap-1.5">{cor(s.cor, c => mudarS({ cor: c }))}{mistura(s.mistura, m => mudarS({ mistura: m }))}</div>
      <div className="grid grid-cols-2 gap-x-2">
        {faixa('Opacidade', s.opacidade, 0, 100, v => mudarS({ opacidade: v }), '%')}
        {faixa('Ângulo', angulo, 0, 360, v => mudarS(deslocamento(v, distancia)), '°')}
        {faixa('Distância', distancia, 0, 100, v => mudarS(deslocamento(angulo, v)), 'px')}
        {faixa('Tamanho', s.desfoque, 0, 100, v => mudarS({ desfoque: v }), 'px')}
        {k === 'sombra' && faixa('Espalhar', s.espalhar || 0, 0, 100, v => mudarS({ espalhar: v }), '%')}
      </div>
    </>)
  }
  const editor = (k: ChaveEfeito) => {
    const e = atual
    switch (k) {
      case 'sombra': case 'sombraInterna': return sombraCtl(k)
      case 'brilho': { const b = e.brilho!; const m = (p: Partial<typeof b>) => set('brilho', { ...b, ...p }); return (<>
        <div className="flex items-center gap-1.5">{cor(b.cor, c => m({ cor: c }))}{mistura(b.mistura, x => m({ mistura: x }))}</div>
        <div className="grid grid-cols-2 gap-x-2">{faixa('Opacidade', b.opacidade, 0, 100, v => m({ opacidade: v }), '%')}{faixa('Tamanho', b.desfoque, 0, 100, v => m({ desfoque: v }), 'px')}{faixa('Espalhar', b.espalhar || 0, 0, 100, v => m({ espalhar: v }), '%')}</div></>) }
      case 'brilhoInterno': { const b = e.brilhoInterno!; const m = (p: Partial<typeof b>) => set('brilhoInterno', { ...b, ...p }); return (<>
        <div className="flex items-center gap-1.5 flex-wrap">{cor(b.cor, c => m({ cor: c }))}{mistura(b.mistura, x => m({ mistura: x }))}
          <select className={sel} value={b.origem || 'borda'} onChange={x => m({ origem: x.target.value as 'borda' | 'centro' })}><option value="borda">Da borda</option><option value="centro">Do centro</option></select></div>
        <div className="grid grid-cols-2 gap-x-2">{faixa('Opacidade', b.opacidade, 0, 100, v => m({ opacidade: v }), '%')}{faixa('Tamanho', b.desfoque, 0, 100, v => m({ desfoque: v }), 'px')}</div></>) }
      case 'contorno': { const c = e.contorno!; const m = (p: Partial<typeof c>) => set('contorno', { ...c, ...p }); return (<>
        <div className="flex items-center gap-1.5 flex-wrap">{cor(c.cor, x => m({ cor: x }))}
          <select className={sel} value={c.posicao || 'fora'} onChange={x => m({ posicao: x.target.value as 'fora' })} title="Posição"><option value="fora">Externo</option><option value="dentro">Interno</option><option value="centro">Centro</option></select>
          {mistura(c.mistura, x => m({ mistura: x }))}</div>
        <div className="grid grid-cols-2 gap-x-2">{faixa('Espessura', c.largura, 1, 60, v => m({ largura: v }), 'px')}{faixa('Opacidade', c.opacidade ?? 100, 0, 100, v => m({ opacidade: v }), '%')}</div></>) }
      case 'chanfro': { const c = e.chanfro!; const m = (p: Partial<typeof c>) => set('chanfro', { ...c, ...p }); return (<>
        <div className="flex items-center gap-1.5 flex-wrap">
          <select className={sel} value={c.estilo} onChange={x => m({ estilo: x.target.value as 'interno' })}><option value="interno">Chanfro interno</option><option value="externo">Chanfro externo</option><option value="relevo">Entalhe (relevo)</option><option value="almofada">Entalhe almofadado</option></select>
          <select className={sel} value={c.tecnica || 'suave'} onChange={x => m({ tecnica: x.target.value as 'suave' })}><option value="suave">Suave</option><option value="cinzel">Cinzel</option></select>
          <select className={sel} value={c.direcao} onChange={x => m({ direcao: x.target.value as 'cima' })}><option value="cima">Para cima</option><option value="baixo">Para baixo</option></select></div>
        <div className="grid grid-cols-2 gap-x-2">
          {faixa('Profundidade', c.profundidade, 1, 1000, v => m({ profundidade: v }), '%')}{faixa('Tamanho', c.tamanho, 1, 60, v => m({ tamanho: v }), 'px')}
          {faixa('Suavizar', c.suavizar, 0, 16, v => m({ suavizar: v }), 'px')}{faixa('Ângulo da luz', c.angulo, 0, 360, v => m({ angulo: v }), '°')}
          {faixa('Altitude', c.altitude, 0, 90, v => m({ altitude: v }), '°')}
        </div>
        <div className="grid grid-cols-2 gap-x-2 items-end">
          <div className="flex items-center gap-1">{cor(c.corLuz, x => m({ corLuz: x }), 'Realce')}<div className="flex-1">{faixa('Realce', c.opLuz, 0, 100, v => m({ opLuz: v }), '%')}</div></div>
          <div className="flex items-center gap-1">{cor(c.corSombra, x => m({ corSombra: x }), 'Sombra')}<div className="flex-1">{faixa('Sombra', c.opSombra, 0, 100, v => m({ opSombra: v }), '%')}</div></div>
        </div></>) }
      case 'corSobreposta': { const c = e.corSobreposta!; const m = (p: Partial<typeof c>) => set('corSobreposta', { ...c, ...p }); return (<>
        <div className="flex items-center gap-1.5">{cor(c.cor, x => m({ cor: x }))}{mistura(c.mistura, x => m({ mistura: x }))}</div>
        {faixa('Opacidade', c.opacidade, 0, 100, v => m({ opacidade: v }), '%')}</>) }
      case 'degrade': { const d = e.degrade!; const m = (p: Partial<typeof d>) => set('degrade', { ...d, ...p }); return (<>
        <div className="flex items-center gap-1 flex-wrap">
          {d.cores.map((p, i) => <span key={i}>{cor(p.cor, x => m({ cores: d.cores.map((q, j) => (j === i ? { ...q, cor: x } : q)) }), `Cor ${i + 1}`)}</span>)}
          {d.cores.length < 5 && <button className="text-[11px] text-orange-600 px-1" title="Mais uma cor" onClick={() => m({ cores: [...d.cores.map((p, i) => ({ ...p, pos: i / d.cores.length })), { cor: d.cores[d.cores.length - 1].cor, pos: 1 }] })}>+</button>}
          {d.cores.length > 2 && <button className="text-[11px] text-gray-400 px-1" title="Uma cor a menos" onClick={() => m({ cores: d.cores.slice(0, -1).map((p, i, a) => ({ ...p, pos: a.length > 1 ? i / (a.length - 1) : 0 })) })}>−</button>}
          <select className={sel} value={d.tipo} onChange={x => m({ tipo: x.target.value as 'linear' })}><option value="linear">Linear</option><option value="radial">Radial</option></select>
          {mistura(d.mistura, x => m({ mistura: x }))}
          <label className="text-[10px] text-gray-500 inline-flex items-center gap-0.5"><input type="checkbox" checked={!!d.inverter} onChange={x => m({ inverter: x.target.checked })} /> inverter</label>
        </div>
        <div className="grid grid-cols-2 gap-x-2">
          {faixa('Opacidade', d.opacidade, 0, 100, v => m({ opacidade: v }), '%')}{faixa('Ângulo', d.angulo, 0, 360, v => m({ angulo: v }), '°')}{faixa('Escala', d.escala, 10, 150, v => m({ escala: v }), '%')}
        </div></>) }
      case 'textura': { const t = e.textura!; return (<>
        <select className={sel + ' w-full'} value={t.tipo} onChange={x => set('textura', { ...t, tipo: x.target.value as TipoTextura })}>
          <option value="papel">Papel</option><option value="kraft">Kraft</option><option value="tecido">Tecido</option><option value="linho">Linho</option><option value="granulado">Granulado</option>
        </select>
        {faixa('Intensidade', t.intensidade, 0, 100, v => set('textura', { ...t, intensidade: v }), '%')}</>) }
      case 'moldura': { const m0 = e.moldura!; const m = (p: Partial<typeof m0>) => set('moldura', { ...m0, ...p }); return (<>
        <div className="flex items-center gap-2">{cor(m0.cor, x => m({ cor: x }))}</div>
        <div className="grid grid-cols-2 gap-x-2">{faixa('Largura', m0.largura, 1, 80, v => m({ largura: v }), 'px')}{faixa('Cantos', m0.raio, 0, 120, v => m({ raio: v }), 'px')}</div></>) }
    }
  }

  return (
    <div className="space-y-2" onMouseLeave={() => previa(null)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-orange-500" /> Estilos de camada</p>
        <span className="flex gap-2">
          {!semEfeitos(atual) && <button onClick={salvarMeu} className="text-[10px] text-orange-600 hover:underline inline-flex items-center gap-0.5"><Save className="w-3 h-3" /> salvar estilo</button>}
          {!semEfeitos(atual) && <button onClick={() => onMudar(null)} className="text-[10px] text-gray-400 hover:text-red-600">tirar todos</button>}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {[...CATEGORIAS_EFEITOS.filter(c => ehImagem || c !== 'Molduras'), 'Meus'].map(c => (
          <button key={c} onClick={() => setCat(c)} className={`text-[10px] rounded-full px-2 py-0.5 border ${cat === c ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {lista.map(e => (
          <button key={e.id} onMouseEnter={() => previa(e.efeitos)} onFocus={() => previa(e.efeitos)} onClick={() => { previa(null); onMudar(mesclar(e.efeitos)) }}
            className="text-[11px] text-left rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 hover:border-orange-400 hover:bg-orange-50/60 dark:hover:bg-orange-950/20">{e.nome}</button>
        ))}
        {cat === 'Meus' && !meus.length && <p className="col-span-2 text-[10px] text-gray-400">Monte um estilo e use “salvar estilo”.</p>}
        {cat === 'Meus' && meus.map(p => (
          <span key={p.id} className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-400">
            <button onMouseEnter={() => previa(p.operacoes[0])} onClick={() => { previa(null); onMudar(mesclar(p.operacoes[0])) }} className="flex-1 text-[11px] text-left px-2 py-1.5 truncate">{p.nome}</button>
            <button onClick={() => excluirMeu(p)} className="px-1 text-gray-300 hover:text-red-600"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>

      {faixa('Opacidade do preenchimento (os estilos ficam)', atual.preenchimento ?? 100, 0, 100, v => mudar({ ...atual, preenchimento: v >= 100 ? undefined : v }), '%')}

      {/* a pilha de estilos, como no Photoshop: ☑ liga/desliga · nome (abre) · ↑↓ ordem · × tira */}
      <div className="rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {ordem.map((k, i) => {
          const tem = !!atual[k]
          return (
            <div key={k} data-estilo={k}>
              <div className="flex items-center gap-1.5 px-1.5 py-1">
                <input type="checkbox" checked={ligado(k)} onChange={() => alternar(k)} className="accent-orange-500" title={tem ? 'Ligar/desligar' : 'Adicionar'} />
                <button onClick={() => (tem ? setAberto(aberto === k ? null : k) : alternar(k))} className={`flex-1 text-left text-[11px] inline-flex items-center gap-0.5 ${tem ? 'text-gray-800 dark:text-gray-100 font-medium' : 'text-gray-500'}`}>
                  {tem && <ChevronRight className={`w-3 h-3 transition-transform ${aberto === k ? 'rotate-90' : ''}`} />}{NOMES_EFEITOS[k]}
                </button>
                {tem && <>
                  <button onClick={() => mover(k, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Subir"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => mover(k, 1)} disabled={i === ordem.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Descer"><ChevronDown className="w-3 h-3" /></button>
                  <button onClick={() => { set(k, null); if (aberto === k) setAberto(null) }} className="text-gray-300 hover:text-red-600" title="Tirar"><X className="w-3 h-3" /></button>
                </>}
              </div>
              {tem && aberto === k && <div className={`px-2 pb-2 space-y-1 ${ligado(k) ? '' : 'opacity-50'}`}>{editor(k)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
