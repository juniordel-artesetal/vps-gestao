'use client'
// SOA Edition — CENAS (fundo + sombra + reflexo + luz + props) e KITS DE LISTAGEM (tomadas × tamanhos por
// marketplace + medidas + badge de preço). Os dois são receitas salvas e reutilizáveis.
'use no memo'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, Trash2, Plus } from 'lucide-react'
import { renderCena, comporMockup, aparar } from '@/lib/estudio/mockup'
import { FUNDOS_PRONTOS, PROPS } from '@/lib/estudio/cenasAcervo'
import { TAMANHOS_CANAIS } from '@/lib/estudio/tamanhos'
import { CENA_PADRAO, TOMADAS, type ConfigCena, type ConfigKitListagem, type Tomada } from '@/lib/estudio/mockupTipos'
import { arteDeTeste, type MockupPronto } from '@/lib/estudio/mockupCliente'
import { inp, lbl, btn, btnP, cartao, num } from '../caixas/comum'

type Salvo<T> = { id: string; nome: string; valor: T }

export function EditorCenas({ cenas, amostra, onMudou }: { cenas: Salvo<ConfigCena>[]; amostra: MockupPronto | null; onMudou: () => void }) {
  const [cena, setCena] = useState<ConfigCena>(CENA_PADRAO)
  const [nome, setNome] = useState('')
  const [id, setId] = useState<string | null>(null)
  const ref = useRef<HTMLCanvasElement>(null)
  const produto = useMemo(() => (amostra ? aparar(comporMockup(amostra.produto, arteDeTeste(), amostra.cfg)) : null), [amostra])
  useEffect(() => {
    const c = ref.current; if (!c || !produto) return
    const id2 = requestAnimationFrame(() => { const out = renderCena(produto, cena, 600, 600); c.width = 600; c.height = 600; c.getContext('2d')!.drawImage(out, 0, 0) })
    return () => cancelAnimationFrame(id2)
  }, [cena, produto])
  const set = (p: Partial<ConfigCena>) => setCena(c => ({ ...c, ...p }))

  async function salvar() {
    if (!nome.trim()) return alert('Dê um nome à cena.')
    const corpo = JSON.stringify({ nome: nome.trim(), fundo: cena.fundo, sombra: cena.sombra, reflexo: cena.reflexo, luz: cena.luz, props: cena.props, config: { produto: cena.produto } })
    const r = id ? await fetch(`/api/estudio/cenas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corpo }) : await fetch('/api/estudio/cenas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo })
    const j = await r.json().catch(() => ({})); if (!r.ok) return alert(j.error || 'Não consegui salvar.')
    if (!id && j.id) setId(j.id); onMudou()
  }
  const f = cena.fundo
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className={`${cartao} flex flex-col items-center gap-2`}>
        <canvas ref={ref} className="max-w-full h-auto rounded-xl" />
        {!amostra && <p className="text-xs text-gray-400">Carregando um produto de exemplo…</p>}
      </div>
      <div className={`${cartao} space-y-3 text-xs`}>
        <div className="flex flex-wrap gap-1">
          {cenas.map(c => <button key={c.id} onClick={() => { setCena(c.valor); setNome(c.nome); setId(c.id) }} className={`${btn} text-xs`}>{c.nome}</button>)}
          <button onClick={() => { setCena(CENA_PADRAO); setNome(''); setId(null) }} className={`${btn} text-xs`}><Plus className="w-3.5 h-3.5" /> Nova</button>
        </div>
        <div><label className={lbl}>Fundo</label>
          <select className={inp} value={f.tipo === 'preset' ? `p:${f.id}` : f.tipo} onChange={e => { const v = e.target.value; if (v.startsWith('p:')) set({ fundo: { tipo: 'preset', id: v.slice(2) } }); else if (v === 'cor') set({ fundo: { tipo: 'cor', cor: '#ffffff' } }); else if (v === 'gradiente') set({ fundo: { tipo: 'gradiente', de: '#fdf2f8', para: '#e0f2fe', angulo: 90 } }); else if (v === 'textura') set({ fundo: { tipo: 'textura', textura: 'linho', cor: '#f5f0e6' } }) }}>
            <option value="cor">Cor</option><option value="gradiente">Degradê</option><option value="textura">Textura</option>
            {FUNDOS_PRONTOS.map(p => <option key={p.id} value={`p:${p.id}`}>Pronto: {p.nome}</option>)}
          </select>
          <div className="flex items-center gap-1.5 mt-1.5">
            {f.tipo === 'cor' && <input type="color" value={f.cor} onChange={e => set({ fundo: { ...f, cor: e.target.value } })} className="w-8 h-6 rounded border" />}
            {f.tipo === 'gradiente' && <><input type="color" value={f.de} onChange={e => set({ fundo: { ...f, de: e.target.value } })} className="w-8 h-6 rounded border" /><input type="color" value={f.para} onChange={e => set({ fundo: { ...f, para: e.target.value } })} className="w-8 h-6 rounded border" /><input type="range" min={0} max={360} value={f.angulo} onChange={e => set({ fundo: { ...f, angulo: Number(e.target.value) } })} className="flex-1 accent-orange-500" /></>}
            {f.tipo === 'textura' && <><select className={inp} value={f.textura} onChange={e => set({ fundo: { ...f, textura: e.target.value } })}>{['papel', 'kraft', 'tecido', 'linho', 'granulado'].map(t => <option key={t}>{t}</option>)}</select><input type="color" value={f.cor} onChange={e => set({ fundo: { ...f, cor: e.target.value } })} className="w-8 h-6 rounded border" /></>}
          </div>
        </div>
        <label className="block">Tamanho do produto {Math.round(cena.produto.altura * 100)}%<input type="range" min={20} max={95} value={Math.round(cena.produto.altura * 100)} onChange={e => set({ produto: { ...cena.produto, altura: Number(e.target.value) / 100 } })} className="w-full accent-orange-500" /></label>
        <label className="block">Altura na cena<input type="range" min={20} max={80} value={Math.round(cena.produto.cy * 100)} onChange={e => set({ produto: { ...cena.produto, cy: Number(e.target.value) / 100 } })} className="w-full accent-orange-500" /></label>
        <label className="block">Sombra de contato {cena.sombra.contato}%<input type="range" min={0} max={100} value={cena.sombra.contato} onChange={e => set({ sombra: { ...cena.sombra, contato: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
        <label className="block">Sombra projetada {cena.sombra.projetada}%<input type="range" min={0} max={100} value={cena.sombra.projetada} onChange={e => set({ sombra: { ...cena.sombra, projetada: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
        <label className="block">Reflexo no piso {cena.reflexo}%<input type="range" min={0} max={100} value={cena.reflexo} onChange={e => set({ reflexo: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
        <label className="block">Luz {cena.luz.intensidade}% · direção {cena.luz.direcao}°<input type="range" min={0} max={100} value={cena.luz.intensidade} onChange={e => set({ luz: { ...cena.luz, intensidade: Number(e.target.value) } })} className="w-full accent-orange-500" /><input type="range" min={0} max={180} value={cena.luz.direcao} onChange={e => set({ luz: { ...cena.luz, direcao: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
        <div>
          <label className={lbl}>Props (elementos de cena)</label>
          <div className="flex flex-wrap gap-1">{PROPS.map(p => <button key={p.id} onClick={() => set({ props: [...cena.props, { id: Math.random().toString(36).slice(2), elemento: p.id, x: 0.15 + Math.random() * 0.7, y: 0.75 + Math.random() * 0.15, escala: 0.14, rot: 0, cor: '#f472b6' }] })} className={`${btn} text-[11px] !px-2 !py-1`}>+ {p.nome}</button>)}</div>
          {cena.props.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1 mt-1">
              <span className="w-16 truncate">{PROPS.find(x => x.id === p.elemento)?.nome}</span>
              <input type="color" value={p.cor || '#f472b6'} onChange={e => set({ props: cena.props.map((q, j) => (j === i ? { ...q, cor: e.target.value } : q)) })} className="w-6 h-5 rounded border" />
              <input type="range" min={0} max={100} value={Math.round(p.x * 100)} onChange={e => set({ props: cena.props.map((q, j) => (j === i ? { ...q, x: Number(e.target.value) / 100 } : q)) })} className="flex-1 accent-orange-500" title="posição" />
              <input type="range" min={0} max={100} value={Math.round(p.y * 100)} onChange={e => set({ props: cena.props.map((q, j) => (j === i ? { ...q, y: Number(e.target.value) / 100 } : q)) })} className="flex-1 accent-orange-500" title="altura" />
              <button onClick={() => set({ props: cena.props.filter((_, j) => j !== i) })}><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5"><input className={inp} placeholder="Nome da cena" value={nome} onChange={e => setNome(e.target.value)} /><button onClick={salvar} className={btnP}><Save className="w-4 h-4" /></button></div>
        {id && <button onClick={async () => { if (confirm('Excluir esta cena?')) { await fetch(`/api/estudio/cenas/${id}`, { method: 'DELETE' }); setId(null); onMudou() } }} className="text-red-600 text-xs">Excluir cena</button>}
      </div>
    </div>
  )
}

const KIT_NOVO: ConfigKitListagem = { tomadas: ['frente', 'angulo', 'detalhe', 'medidas', 'em-uso'], tamanhos: ['shopee', 'mercadolivre', 'elo7'], medidas: { largura: 10, altura: 10, profundidade: null }, badge: null, cenaId: null }

export function EditorKits({ kits, cenas, onMudou }: { kits: Salvo<ConfigKitListagem>[]; cenas: Salvo<ConfigCena>[]; onMudou: () => void }) {
  const [kit, setKit] = useState<ConfigKitListagem>(KIT_NOVO)
  const [nome, setNome] = useState('Kit festa infantil')
  const [id, setId] = useState<string | null>(null)
  const alterna = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v])
  async function salvar() {
    if (!nome.trim() || !kit.tomadas.length || !kit.tamanhos.length) return alert('Dê um nome e escolha tomadas e tamanhos.')
    const corpo = JSON.stringify({ nome: nome.trim(), tomadas: kit.tomadas, tamanhos: kit.tamanhos, config: { medidas: kit.medidas, badge: kit.badge, cenaId: kit.cenaId } })
    const r = id ? await fetch(`/api/estudio/kits-listagem/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: corpo }) : await fetch('/api/estudio/kits-listagem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo })
    const j = await r.json().catch(() => ({})); if (!r.ok) return alert(j.error || 'Não consegui salvar.')
    if (!id && j.id) setId(j.id); onMudou()
  }
  return (
    <div className={`${cartao} space-y-3 text-sm max-w-3xl`}>
      <div className="flex flex-wrap gap-1">
        {kits.map(k => <button key={k.id} onClick={() => { setKit(k.valor); setNome(k.nome); setId(k.id) }} className={`${btn} text-xs`}>{k.nome}</button>)}
        <button onClick={() => { setKit(KIT_NOVO); setNome(''); setId(null) }} className={`${btn} text-xs`}><Plus className="w-3.5 h-3.5" /> Novo</button>
      </div>
      <div><label className={lbl}>Nome</label><input className={inp} value={nome} onChange={e => setNome(e.target.value)} /></div>
      <div><label className={lbl}>Tomadas</label>
        <div className="flex flex-wrap gap-1.5">{TOMADAS.map(t => { const on = kit.tomadas.includes(t.id); return <button key={t.id} onClick={() => setKit(k => ({ ...k, tomadas: alterna<Tomada>(k.tomadas, t.id) }))} title={t.dica} className={`rounded-lg px-2.5 py-1 text-xs border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>{t.nome}</button> })}</div>
      </div>
      <div><label className={lbl}>Tamanhos (marketplaces)</label>
        <div className="flex flex-wrap gap-1.5">{TAMANHOS_CANAIS.map(t => { const on = kit.tamanhos.includes(t.id); return <button key={t.id} onClick={() => setKit(k => ({ ...k, tamanhos: alterna(k.tamanhos, t.id) }))} className={`rounded-lg px-2.5 py-1 text-xs border ${on ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 dark:border-gray-700'}`}>{t.canal} · {t.rotulo}</button> })}</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className={lbl}>Largura padrão (cm)</label><input className={inp} inputMode="decimal" value={String(kit.medidas.largura)} onChange={e => setKit(k => ({ ...k, medidas: { ...k.medidas, largura: num(e.target.value, 0) } }))} /></div>
        <div><label className={lbl}>Altura (cm)</label><input className={inp} inputMode="decimal" value={String(kit.medidas.altura)} onChange={e => setKit(k => ({ ...k, medidas: { ...k.medidas, altura: num(e.target.value, 0) } }))} /></div>
        <div><label className={lbl}>Profundidade (cm)</label><input className={inp} inputMode="decimal" value={kit.medidas.profundidade == null ? '' : String(kit.medidas.profundidade)} onChange={e => setKit(k => ({ ...k, medidas: { ...k.medidas, profundidade: e.target.value ? num(e.target.value, 0) : null } }))} /></div>
      </div>
      <p className="text-[11px] text-gray-500">Cada mockup usa as próprias medidas quando tem; estas valem para quem não tem.</p>
      <div><label className={lbl}>Cena do “em uso”</label>
        <select className={inp} value={kit.cenaId || ''} onChange={e => setKit(k => ({ ...k, cenaId: e.target.value || null }))}><option value="">Festa (padrão)</option>{cenas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
      </div>
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-orange-500" checked={!!kit.badge?.ativo} onChange={e => setKit(k => ({ ...k, badge: e.target.checked ? { ativo: true, texto: 'Personalizado', preco: 'R$ 0,00', cor: '#f97316' } : null }))} /> Selo com nome/preço</label>
        {kit.badge && <div className="grid grid-cols-[1fr_120px_40px] gap-1.5"><input className={inp} value={kit.badge.texto} onChange={e => setKit(k => ({ ...k, badge: { ...k.badge!, texto: e.target.value } }))} /><input className={inp} value={kit.badge.preco} onChange={e => setKit(k => ({ ...k, badge: { ...k.badge!, preco: e.target.value } }))} /><input type="color" value={kit.badge.cor} onChange={e => setKit(k => ({ ...k, badge: { ...k.badge!, cor: e.target.value } }))} className="w-10 h-8 rounded border" /></div>}
      </div>
      <p className="text-xs text-gray-500">Este kit gera {kit.tomadas.length * kit.tamanhos.length} foto(s) por produto (cada uma usa 1 imagem da cota).</p>
      <div className="flex gap-2">
        <button onClick={salvar} className={btnP}><Save className="w-4 h-4" /> Salvar kit</button>
        {id && <button onClick={async () => { if (confirm('Excluir este kit?')) { await fetch(`/api/estudio/kits-listagem/${id}`, { method: 'DELETE' }); setId(null); onMudou() } }} className={btn}><Trash2 className="w-4 h-4" /> Excluir</button>}
      </div>
    </div>
  )
}
