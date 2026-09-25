'use client'
// SOA Edition — painel de EFEITOS da camada: catálogo em categorias (1 clique), prévia ao passar o
// mouse, cada efeito ativo editável, e "salvar como meu efeito" (EstudioPreset tipo 'efeito').
// Tudo autoral (texturas geradas por código).
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Save } from 'lucide-react'
import { EFEITOS_PRONTOS, CATEGORIAS_EFEITOS, semEfeitos, type Efeitos, type TipoTextura } from '@/lib/estudio/efeitos'

const lbl = 'block text-[10px] text-gray-500'
const faixa = (rot: string, v: number, min: number, max: number, f: (n: number) => void, suf = '') => (
  <label className={lbl}>{rot} <span className="tabular-nums text-gray-400">{v}{suf}</span>
    <input type="range" min={min} max={max} value={v} onChange={e => f(Number(e.target.value))} className="w-full accent-orange-500" />
  </label>
)
const cor = (v: string, f: (c: string) => void, t = 'Cor') => <input type="color" value={v} onChange={e => f(e.target.value)} className="w-7 h-6 rounded border border-gray-200" title={t} />

interface Preset { id: string; nome: string; operacoes: Efeitos[] }

export default function PainelEfeitos({ efeitos, ehImagem, onMudar, onPrevia }: {
  efeitos: Efeitos | null
  ehImagem: boolean
  onMudar: (e: Efeitos | null) => void
  /** Prévia temporária (null = volta ao atual). */
  onPrevia: (e: Efeitos | null) => void
}) {
  const [cat, setCat] = useState<string>('Sombras')
  const [meus, setMeus] = useState<Preset[]>([])
  const previaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const atual: Efeitos = efeitos || {}

  const carregar = () => fetch('/api/estudio/presets?tipo=efeito').then(r => r.json()).then(d => setMeus(d.presets || [])).catch(() => {})
  useEffect(() => { carregar() }, [])

  const mesclar = (e: Efeitos): Efeitos => ({ ...atual, ...e })
  const previa = (e: Efeitos | null) => {
    if (previaTimer.current) clearTimeout(previaTimer.current)
    previaTimer.current = setTimeout(() => onPrevia(e ? mesclar(e) : null), e ? 120 : 0)
  }
  const set = <K extends keyof Efeitos>(k: K, v: Efeitos[K]) => onMudar({ ...atual, [k]: v })

  async function salvarMeu() {
    if (semEfeitos(efeitos)) return
    const nome = prompt('Nome do seu efeito:', 'Meu efeito')
    if (!nome?.trim()) return
    await fetch('/api/estudio/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, tipo: 'efeito', operacoes: [efeitos] }) })
    carregar()
  }
  async function excluirMeu(p: Preset) {
    if (!confirm(`Excluir "${p.nome}"?`)) return
    await fetch(`/api/estudio/presets/${p.id}`, { method: 'DELETE' }); carregar()
  }

  const lista = cat === 'Meus' ? [] : EFEITOS_PRONTOS.filter(e => e.categoria === cat && (ehImagem || !(e.efeitos.sombraInterna || e.efeitos.moldura)))

  return (
    <div className="space-y-2" onMouseLeave={() => previa(null)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-orange-500" /> Efeitos</p>
        <span className="flex gap-2">
          {!semEfeitos(efeitos) && <button onClick={salvarMeu} className="text-[10px] text-orange-600 hover:underline inline-flex items-center gap-0.5"><Save className="w-3 h-3" /> salvar como meu</button>}
          {!semEfeitos(efeitos) && <button onClick={() => onMudar(null)} className="text-[10px] text-gray-400 hover:text-red-600">tirar todos</button>}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {[...CATEGORIAS_EFEITOS, 'Meus'].map(c => (
          <button key={c} onClick={() => setCat(c)} className={`text-[10px] rounded-full px-2 py-0.5 border ${cat === c ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {lista.map(e => (
          <button key={e.id} onMouseEnter={() => previa(e.efeitos)} onFocus={() => previa(e.efeitos)} onClick={() => { previa(null); onMudar(mesclar(e.efeitos)) }}
            className="text-[11px] text-left rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 hover:border-orange-400 hover:bg-orange-50/60 dark:hover:bg-orange-950/20">{e.nome}</button>
        ))}
        {cat === 'Meus' && !meus.length && <p className="col-span-2 text-[10px] text-gray-400">Monte um efeito e use "salvar como meu".</p>}
        {cat === 'Meus' && meus.map(p => (
          <span key={p.id} className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-400">
            <button onMouseEnter={() => previa(p.operacoes[0])} onClick={() => { previa(null); onMudar(mesclar(p.operacoes[0])) }} className="flex-1 text-[11px] text-left px-2 py-1.5 truncate">{p.nome}</button>
            <button onClick={() => excluirMeu(p)} className="px-1 text-gray-300 hover:text-red-600"><X className="w-3 h-3" /></button>
          </span>
        ))}
      </div>

      {/* efeitos ativos — cada um editável */}
      {atual.sombra && (
        <Bloco titulo="Sombra" onTirar={() => set('sombra', null)}>
          <div className="flex items-center gap-1">{cor(atual.sombra.cor, c => set('sombra', { ...atual.sombra!, cor: c }))}</div>
          <div className="grid grid-cols-2 gap-x-2">
            {faixa('Opacidade', atual.sombra.opacidade, 0, 100, v => set('sombra', { ...atual.sombra!, opacidade: v }), '%')}
            {faixa('Desfoque', atual.sombra.desfoque, 0, 80, v => set('sombra', { ...atual.sombra!, desfoque: v }))}
            {faixa('Deslocar ↔', atual.sombra.dx, -60, 60, v => set('sombra', { ...atual.sombra!, dx: v }))}
            {faixa('Deslocar ↕', atual.sombra.dy, -60, 60, v => set('sombra', { ...atual.sombra!, dy: v }))}
          </div>
        </Bloco>
      )}
      {atual.sombraInterna && ehImagem && (
        <Bloco titulo="Sombra interna" onTirar={() => set('sombraInterna', null)}>
          <div className="flex items-center gap-1">{cor(atual.sombraInterna.cor, c => set('sombraInterna', { ...atual.sombraInterna!, cor: c }))}</div>
          <div className="grid grid-cols-2 gap-x-2">
            {faixa('Opacidade', atual.sombraInterna.opacidade, 0, 100, v => set('sombraInterna', { ...atual.sombraInterna!, opacidade: v }), '%')}
            {faixa('Desfoque', atual.sombraInterna.desfoque, 0, 60, v => set('sombraInterna', { ...atual.sombraInterna!, desfoque: v }))}
          </div>
        </Bloco>
      )}
      {atual.brilho && (
        <Bloco titulo="Brilho (glow)" onTirar={() => set('brilho', null)}>
          <div className="flex items-center gap-1">{cor(atual.brilho.cor, c => set('brilho', { ...atual.brilho!, cor: c }))}</div>
          <div className="grid grid-cols-2 gap-x-2">
            {faixa('Opacidade', atual.brilho.opacidade, 0, 100, v => set('brilho', { ...atual.brilho!, opacidade: v }), '%')}
            {faixa('Tamanho', atual.brilho.desfoque, 0, 80, v => set('brilho', { ...atual.brilho!, desfoque: v }))}
          </div>
          {!ehImagem && atual.sombra && <p className="text-[10px] text-amber-600">Em texto/forma vale um só: sombra ou brilho (a sombra tem prioridade).</p>}
        </Bloco>
      )}
      {atual.contorno && (
        <Bloco titulo="Contorno" onTirar={() => set('contorno', null)}>
          <div className="flex items-center gap-2">{cor(atual.contorno.cor, c => set('contorno', { ...atual.contorno!, cor: c }))}
            <div className="flex-1">{faixa('Espessura', atual.contorno.largura, 1, 40, v => set('contorno', { ...atual.contorno!, largura: v }), 'px')}</div></div>
        </Bloco>
      )}
      {atual.sobreposicao && (
        <Bloco titulo={atual.sobreposicao.tipo === 'gradiente' ? 'Sobreposição de gradiente' : 'Sobreposição de cor'} onTirar={() => set('sobreposicao', null)}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <select className="text-[11px] border border-gray-200 dark:border-gray-700 rounded px-1 bg-white dark:bg-gray-800" value={atual.sobreposicao.tipo} onChange={e => set('sobreposicao', { ...atual.sobreposicao!, tipo: e.target.value as 'cor' | 'gradiente' })}>
              <option value="cor">Cor</option><option value="gradiente">Gradiente</option>
            </select>
            {cor(atual.sobreposicao.cor, c => set('sobreposicao', { ...atual.sobreposicao!, cor: c }))}
            {atual.sobreposicao.tipo === 'gradiente' && cor(atual.sobreposicao.cor2, c => set('sobreposicao', { ...atual.sobreposicao!, cor2: c }), 'Cor 2')}
            {ehImagem && <select className="text-[11px] border border-gray-200 dark:border-gray-700 rounded px-1 bg-white dark:bg-gray-800" value={atual.sobreposicao.mistura} onChange={e => set('sobreposicao', { ...atual.sobreposicao!, mistura: e.target.value as 'normal' })}>
              <option value="normal">Normal</option><option value="multiply">Multiplicar</option><option value="screen">Tela</option><option value="overlay">Sobrepor</option>
            </select>}
          </div>
          <div className="grid grid-cols-2 gap-x-2">
            {ehImagem && faixa('Opacidade', atual.sobreposicao.opacidade, 0, 100, v => set('sobreposicao', { ...atual.sobreposicao!, opacidade: v }), '%')}
            {atual.sobreposicao.tipo === 'gradiente' && faixa('Ângulo', atual.sobreposicao.angulo, 0, 360, v => set('sobreposicao', { ...atual.sobreposicao!, angulo: v }), '°')}
          </div>
        </Bloco>
      )}
      {atual.textura && (
        <Bloco titulo="Textura" onTirar={() => set('textura', null)}>
          <select className="w-full text-[11px] border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value={atual.textura.tipo} onChange={e => set('textura', { ...atual.textura!, tipo: e.target.value as TipoTextura })}>
            <option value="papel">Papel</option><option value="kraft">Kraft</option><option value="tecido">Tecido</option><option value="linho">Linho</option><option value="granulado">Granulado</option>
          </select>
          {faixa('Intensidade', atual.textura.intensidade, 0, 100, v => set('textura', { ...atual.textura!, intensidade: v }), '%')}
        </Bloco>
      )}
      {atual.moldura && (
        <Bloco titulo="Moldura / borda" onTirar={() => set('moldura', null)}>
          <div className="flex items-center gap-2">{cor(atual.moldura.cor, c => set('moldura', { ...atual.moldura!, cor: c }))}</div>
          <div className="grid grid-cols-2 gap-x-2">
            {faixa('Largura', atual.moldura.largura, 1, 80, v => set('moldura', { ...atual.moldura!, largura: v }), 'px')}
            {ehImagem && faixa('Cantos', atual.moldura.raio, 0, 120, v => set('moldura', { ...atual.moldura!, raio: v }), 'px')}
          </div>
        </Bloco>
      )}
    </div>
  )
}

function Bloco({ titulo, onTirar, children }: { titulo: string; onTirar: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-1">
      <div className="flex items-center justify-between"><p className="text-[11px] font-medium text-gray-700 dark:text-gray-200">{titulo}</p>
        <button onClick={onTirar} className="text-gray-300 hover:text-red-600" title="Tirar"><X className="w-3.5 h-3.5" /></button></div>
      {children}
    </div>
  )
}
