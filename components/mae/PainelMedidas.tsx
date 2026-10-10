'use client'
'use no memo'
// Lote 6 (itens 90 e 91): PEÇAS POR MEDIDA — etiquetas, tags e rótulos não têm molde de caixa: a base é feita de
// peças planas definidas por medida. Catálogo de medidas prontas (marcar as que vende e todas entram de uma vez),
// medida personalizada (retângulo, cantos arredondados, círculo/oval, com furo), cada medida editável, duplicar com
// outra medida; e a ESTRUTURA (o esqueleto da arte: fundo, base, faixa, laterais) — divisórias editáveis (posição,
// inclinação, corte reto ou transição suave, faixa), pedaços com nome (cada um é uma PARTE do tema).
import { useState } from 'react'
import { Plus, Copy, Trash2, Ruler, Save, Type } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { CATALOGO_MEDIDAS, CATEGORIAS_MEDIDAS, type FormaMedida } from '@/lib/mae/medidas/catalogo'
import { novaPeca, mudarMedida, aplicarEstrutura, medidaDe, ehPecaPorMedida, ESTRUTURAS_PRONTAS, pedacosDaPeca, type Estrutura, type Divisoria, type Medida } from '@/lib/mae/medidas/pecas'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { lerMedidaMm } from '@/lib/mae/editor/unidades'
import type { DocTrabalho } from '@/lib/mae/schema'
import Deslizador from './Deslizador'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const inp = 'rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-xs'
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR')
const NOMES_FORMA: Record<FormaMedida, string> = { retangulo: 'Retângulo', arredondado: 'Cantos arredondados', circulo: 'Círculo / oval' }
const ARQ_ESTRUTURAS = 'Bases/estruturas.json'

type Doc = DocTrabalho & { estrutura?: Estrutura; tipo?: string }
const aplicar = (label: string, f: (d: Doc) => void, juntar?: string) => useMaeDoc.getState().aplicar(label, d => f(d as Doc), juntar)
/** Mudou a medida/forma: a estrutura da base vale de novo para a peça. */
const reestruturar = (d: Doc) => aplicarEstrutura(d, d.estrutura ?? ESTRUTURAS_PRONTAS[0])

export default function PainelMedidas() {
  const doc = useMaeDoc(s => s.hist.atual) as Doc
  const raiz = useBiblioteca(s => s.raiz)
  const [cat, setCat] = useState<string | null>(CATEGORIAS_MEDIDAS[0])
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [nova, setNova] = useState<{ nome: string; l: string; a: string; forma: FormaMedida; raio: string; furo: boolean } | null>(null)
  const [minhas, setMinhas] = useState<Estrutura[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const pecas = doc.molds.filter(ehPecaPorMedida)
  const estrutura = doc.estrutura ?? ESTRUTURAS_PRONTAS[0]

  function adicionar(itens: { nome: string; medida: Medida }[]) {
    if (!itens.length) return
    aplicar(`Peças por medida (+${itens.length})`, d => {
      const ab = d.artboards[0]
      // ao lado das que já existem, em linhas
      const ocup = d.molds.filter(m => m.artboardId === ab.id)
      let y = ocup.length ? Math.max(...ocup.map(m => m.transform.yMm + (m.source.heightMm ?? m.source.widthMm))) + 8 : 10, x = 10, linhaH = 0
      for (const it of itens) {
        if (x + it.medida.larguraMm > ab.widthMm - 10) { x = 10; y += linhaH + 8; linhaH = 0 }
        d.molds.push(novaPeca(it.nome, it.medida, ab.id, { xMm: x, yMm: y }))
        x += it.medida.larguraMm + 8; linhaH = Math.max(linhaH, it.medida.alturaMm)
      }
      if (!d.tipo) { d.tipo = 'medida'; d.smartArt = { ...(d.smartArt ?? {}), overflowMm: 2 } }
      reestruturar(d)
    })
    setMarcadas(new Set())
  }
  const doCatalogo = () => adicionar(CATALOGO_MEDIDAS.filter(m => marcadas.has(m.id)).map(m => ({ nome: `${m.categoria} · ${m.nome}`.replace(/^Etiqueta escolar · /, 'Etiqueta '), medida: { forma: m.forma, larguraMm: m.larguraMm, alturaMm: m.alturaMm, ...(m.raioMm ? { raioMm: m.raioMm } : {}), ...(m.furo ? { furo: m.furo } : {}), catalogoId: m.id } })))

  function criarPersonalizada() {
    if (!nova) return
    const l = lerMedidaMm(nova.l), a = lerMedidaMm(nova.forma === 'circulo' && !nova.a.trim() ? nova.l : nova.a)
    if (!(l && a && l > 1 && a > 1 && l < 2000 && a < 2000)) { setMsg('Confira a largura e a altura (ex.: 90 ou 9cm).'); return }
    adicionar([{ nome: nova.nome.trim() || `Peça ${fmt(l)}×${fmt(a)}`, medida: { forma: nova.forma, larguraMm: l, alturaMm: a, ...(nova.forma === 'arredondado' ? { raioMm: lerMedidaMm(nova.raio) ?? 3 } : {}), ...(nova.furo ? { furo: { x: 0.5, y: Math.min(0.3, 6 / a), diametroMm: 4 } } : {}) } }])
    setNova(null); setMsg(null)
  }
  function duplicar(id: string) {
    const p = doc.molds.find(m => m.id === id), med = p ? medidaDe(p) : null
    if (!p || !med) return
    const r = prompt(`Duplicar "${p.name}" com outra medida (largura × altura, em mm ou cm — ex.: 7 x 3 cm):`, `${fmt(med.larguraMm)} x ${fmt(med.alturaMm)}`)
    if (!r) return
    const [l, a] = r.toLowerCase().replace('cm', ' cm').split(/\s*[x×]\s*/).map(v => lerMedidaMm(v.trim() + (/cm\s*$/.test(r.toLowerCase()) && !/cm|mm/.test(v) ? 'cm' : '')))
    if (!(l && a)) { setMsg('Medida não entendida — use por exemplo "7 x 3 cm" ou "70 x 30".'); return }
    adicionar([{ nome: `${p.name} ${fmt(l)}×${fmt(a)}`, medida: { ...med, larguraMm: l, alturaMm: a } }])
  }
  const mudar = (id: string, label: string, m: Partial<Medida>, juntar?: string) => aplicar(label, d => { const p = d.molds.find(x => x.id === id); if (p) { mudarMedida(p, m); reestruturar(d) } }, juntar)

  // ── estrutura ──
  const usarEstrutura = (e: Estrutura, label = `Estrutura: ${e.nome}`, juntar?: string) => aplicar(label, d => aplicarEstrutura(d, e), juntar)
  const mudarDiv = (i: number, p: Partial<Divisoria>, juntar?: string) => usarEstrutura({ ...estrutura, divisorias: estrutura.divisorias.map((x, k) => (k === i ? { ...x, ...p } : x)) }, 'Divisória', juntar)
  const exemplo = pecas[0] ? medidaDe(pecas[0]) : null
  const nomesPedacos = exemplo ? pedacosDaPeca(exemplo, estrutura).map(p => p.nome) : []
  async function carregarMinhas() {
    if (minhas) return
    let l: Estrutura[] = []
    try { if (raiz) l = JSON.parse(await (await ler(raiz, ARQ_ESTRUTURAS)).text()) } catch { /* ainda não há */ }
    setMinhas(Array.isArray(l) ? l : [])
  }
  async function salvarComoMinha() {
    const nome = prompt('Nome da estrutura (ex.: Etiqueta escolar com faixa):', estrutura.nome)?.trim()
    if (!nome) return
    await carregarMinhas()
    const lista = [...(minhas ?? []).filter(x => x.nome !== nome), { ...estrutura, id: `minha_${Date.now().toString(36)}`, nome }]
    setMinhas(lista)
    if (raiz) await gravar(raiz, ARQ_ESTRUTURAS, JSON.stringify(lista, null, 1)).catch(() => setMsg('Não consegui gravar na Biblioteca.'))
    setMsg(`Estrutura "${nome}" salva — aparece em "Usar estrutura" em qualquer base.`)
  }
  function marcarNome() {
    aplicar('Área do NOME em todas as medidas', d => {
      for (const p of d.molds.filter(ehPecaPorMedida)) {
        const face = p.faces.find(f => !f.hole)
        if (!face || d.textSlots.some(s => p.faces.some(f => f.id === s.faceId) && s.variable === 'NOME')) continue
        d.textSlots.push({ id: `ts_nome_${p.id.slice(-6)}`, variable: 'NOME', faceId: face.id, box: { x: 0.42, y: 0.28, w: 0.54, h: 0.44 }, single: { lines: 1, sizePt: 22 }, compound: { lines: 2, sizePt: 18, lineHeight: 0.9 }, autoFit: { minScale: 0.6 } })
      }
    })
  }

  return (
    <div className="space-y-3" data-painel-medidas>
      <p className="text-[11px] text-gray-500">Etiquetas, tags e rótulos: peças planas definidas por medida — sem molde. Cada peça já nasce com o contorno de corte.</p>
      {msg && <p className="text-[11px] text-amber-700" data-msg-medidas>{msg}</p>}

      {/* catálogo */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-catalogo-medidas>
        <p className="text-xs font-semibold flex items-center gap-1"><Ruler className="w-3.5 h-3.5 text-orange-500" /> Medidas prontas</p>
        <div className="flex flex-wrap gap-1">{CATEGORIAS_MEDIDAS.map(c => <button key={c} className={btn + ' !py-0.5 !text-[10px]' + (cat === c ? ' !border-orange-500 bg-orange-50 text-orange-800' : '')} onClick={() => setCat(c)} data-categoria-medida={c}>{c}</button>)}</div>
        <ul className="space-y-0.5 max-h-40 overflow-y-auto">
          {CATALOGO_MEDIDAS.filter(m => m.categoria === cat).map(m => (
            <li key={m.id}><label className="flex items-center gap-1.5 text-[11px]">
              <input type="checkbox" className="accent-orange-500" checked={marcadas.has(m.id)} onChange={e => setMarcadas(s => { const n = new Set(s); if (e.target.checked) n.add(m.id); else n.delete(m.id); return n })} data-medida-pronta={m.id} />
              <span className="flex-1">{m.nome}</span>
              <span className="tabular-nums text-gray-500">{m.forma === 'circulo' && m.larguraMm === m.alturaMm ? `Ø ${fmt(m.larguraMm / 10)}` : `${fmt(m.larguraMm / 10)} × ${fmt(m.alturaMm / 10)}`} cm{m.furo ? ' · furo' : ''}</span>
              {m.conferida && <span className="text-[9px] text-emerald-700" title="Conferida pela Naty">✔</span>}
            </label></li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-1">
          <button className={btn + ' !border-orange-500 bg-orange-500 text-white'} disabled={!marcadas.size} onClick={doCatalogo} data-adicionar-medidas><Plus className="w-3.5 h-3.5" /> Adicionar marcadas ({marcadas.size})</button>
          <button className={btn} onClick={() => setNova({ nome: '', l: '', a: '', forma: 'retangulo', raio: '3', furo: false })} data-medida-personalizada><Plus className="w-3.5 h-3.5" /> Medida personalizada</button>
        </div>
        <p className="text-[10px] text-gray-400">As medidas variam entre marcas — confira e ajuste (cada uma continua editável abaixo).</p>
      </div>

      {nova && (
        <div className="rounded-lg border border-orange-200 p-2 space-y-1 text-[11px]" data-nova-medida>
          <input value={nova.nome} onChange={e => setNova({ ...nova, nome: e.target.value })} placeholder="Nome (ex.: Bolsinha P)" className={inp + ' w-full'} data-nome-medida />
          <div className="flex flex-wrap items-center gap-1">
            <select value={nova.forma} onChange={e => setNova({ ...nova, forma: e.target.value as FormaMedida })} className={inp}>{(Object.keys(NOMES_FORMA) as FormaMedida[]).map(f => <option key={f} value={f}>{NOMES_FORMA[f]}</option>)}</select>
            <input value={nova.l} onChange={e => setNova({ ...nova, l: e.target.value })} placeholder="largura" className={inp + ' w-16'} inputMode="decimal" data-largura-medida />×
            <input value={nova.a} onChange={e => setNova({ ...nova, a: e.target.value })} placeholder="altura" className={inp + ' w-16'} inputMode="decimal" data-altura-medida /><span className="text-gray-400">mm (ou &quot;9cm&quot;)</span>
            {nova.forma === 'arredondado' && <label className="flex items-center gap-1">raio <input value={nova.raio} onChange={e => setNova({ ...nova, raio: e.target.value })} className={inp + ' w-10'} inputMode="decimal" /> mm</label>}
            <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={nova.furo} onChange={e => setNova({ ...nova, furo: e.target.checked })} /> com furo</label>
          </div>
          <div className="flex gap-1"><button className={btn + ' !border-orange-500'} onClick={criarPersonalizada} data-criar-medida>Criar</button><button className={btn} onClick={() => setNova(null)}>Cancelar</button></div>
        </div>
      )}

      {/* peças da base */}
      {pecas.length > 0 && (
        <div className="space-y-1" data-lista-pecas>
          <p className="text-xs font-semibold">Peças desta base ({pecas.length})</p>
          {pecas.map(p => {
            const m = medidaDe(p)!
            return (
              <div key={p.id} className="rounded border border-gray-100 dark:border-gray-800 p-1.5 space-y-1 text-[11px]" data-peca-medida={p.name}>
                <div className="flex items-center gap-1">
                  <input defaultValue={p.name} key={`n${p.id}`} onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.name) aplicar('Nome da peça', d => { const x = d.molds.find(mm => mm.id === p.id); if (x) x.name = v.slice(0, 120) }) }} className={inp + ' flex-1 min-w-0 font-semibold'} />
                  <button className={btn + ' !px-1'} onClick={() => duplicar(p.id)} title="Duplicar com outra medida" data-duplicar-medida><Copy className="w-3 h-3" /></button>
                  <button className={btn + ' !px-1'} onClick={() => { if (confirm(`Excluir a peça ${p.name}?`)) aplicar('Excluir peça', d => { d.molds = d.molds.filter(x => x.id !== p.id); reestruturar(d) }) }} title="Excluir" data-excluir-medida><Trash2 className="w-3 h-3" /></button>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <select value={m.forma} onChange={e => mudar(p.id, 'Forma da peça', { forma: e.target.value as FormaMedida })} className={inp}>{(Object.keys(NOMES_FORMA) as FormaMedida[]).map(f => <option key={f} value={f}>{NOMES_FORMA[f]}</option>)}</select>
                  <input defaultValue={fmt(m.larguraMm)} key={`l${p.id}:${m.larguraMm}`} onBlur={e => { const v = lerMedidaMm(e.target.value); if (v && v > 1 && Math.abs(v - m.larguraMm) > 0.01) mudar(p.id, 'Largura da peça', { larguraMm: v }) }} className={inp + ' w-14'} inputMode="decimal" aria-label="Largura (mm)" data-largura-peca />×
                  <input defaultValue={fmt(m.alturaMm)} key={`a${p.id}:${m.alturaMm}`} onBlur={e => { const v = lerMedidaMm(e.target.value); if (v && v > 1 && Math.abs(v - m.alturaMm) > 0.01) mudar(p.id, 'Altura da peça', { alturaMm: v }) }} className={inp + ' w-14'} inputMode="decimal" aria-label="Altura (mm)" data-altura-peca /> mm
                  {m.forma === 'arredondado' && <label className="flex items-center gap-1">raio <input defaultValue={fmt(m.raioMm ?? 3)} key={`r${p.id}:${m.raioMm}`} onBlur={e => { const v = lerMedidaMm(e.target.value); if (v !== null && v >= 0) mudar(p.id, 'Raio dos cantos', { raioMm: v }) }} className={inp + ' w-10'} inputMode="decimal" /></label>}
                  <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={!!m.furo} onChange={e => mudar(p.id, e.target.checked ? 'Furo na peça' : 'Sem furo', { furo: e.target.checked ? { x: 0.5, y: Math.min(0.3, 6 / m.alturaMm), diametroMm: 4 } : null })} data-furo-peca /> furo</label>
                  {m.furo && <>
                    <label className="flex items-center gap-1">Ø <input defaultValue={fmt(m.furo.diametroMm)} key={`fd${p.id}:${m.furo.diametroMm}`} onBlur={e => { const v = lerMedidaMm(e.target.value); if (v && v > 0.5) mudar(p.id, 'Diâmetro do furo', { furo: { ...m.furo!, diametroMm: v } }) }} className={inp + ' w-10'} inputMode="decimal" /> mm</label>
                    <label className="flex items-center gap-1">do topo <input defaultValue={fmt(m.furo.y * m.alturaMm)} key={`fy${p.id}:${m.furo.y}`} onBlur={e => { const v = lerMedidaMm(e.target.value); if (v !== null && v > 0 && v < m.alturaMm) mudar(p.id, 'Posição do furo', { furo: { ...m.furo!, y: v / m.alturaMm } }) }} className={inp + ' w-10'} inputMode="decimal" /> mm</label>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* estrutura */}
      {pecas.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-estrutura>
          <p className="text-xs font-semibold">Estrutura (o esqueleto da arte) <span className="font-normal text-gray-400">— vale para todas as medidas</span></p>
          <select value="" onFocus={() => void carregarMinhas()} onChange={e => { const v = e.target.value; const e2 = [...ESTRUTURAS_PRONTAS, ...(minhas ?? [])].find(x => x.id === v); if (e2) usarEstrutura(JSON.parse(JSON.stringify(e2))) }} className={inp + ' w-full'} data-usar-estrutura>
            <option value="">Usar estrutura… (atual: {estrutura.nome})</option>
            <optgroup label="Prontas">{ESTRUTURAS_PRONTAS.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</optgroup>
            {!!minhas?.length && <optgroup label="Minhas estruturas">{minhas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}</optgroup>}
          </select>
          {estrutura.divisorias.map((dv, i) => (
            <div key={dv.id} className="rounded border border-gray-100 dark:border-gray-800 p-1.5 space-y-1 text-[11px]" data-divisoria={i}>
              <div className="flex flex-wrap items-center gap-1">
                <b>{dv.eixo === 'h' ? 'Divisória horizontal' : 'Divisória vertical'}</b>
                <select value={dv.tipo} onChange={e => mudarDiv(i, { tipo: e.target.value as 'reto' | 'suave' })} className={inp} data-tipo-divisoria><option value="reto">corte reto</option><option value="suave">transição suave</option></select>
                <button className={btn + ' !px-1 ml-auto'} onClick={() => usarEstrutura({ ...estrutura, divisorias: estrutura.divisorias.filter((_, k) => k !== i), nomes: undefined }, 'Tirar divisória')} title="Tirar esta divisória"><Trash2 className="w-3 h-3" /></button>
              </div>
              <label className="block text-gray-500">Posição<Deslizador min={0.05} max={0.95} step={0.01} value={dv.pos} unidade="%" fator={100} onChange={e => mudarDiv(i, { pos: Number(e.target.value) }, `div:${dv.id}:pos`)} data-pos-divisoria /></label>
              <label className="block text-gray-500">Inclinação<Deslizador min={-30} max={30} step={1} value={dv.inclinacaoDeg ?? 0} unidade="°" onChange={e => mudarDiv(i, { inclinacaoDeg: Number(e.target.value) }, `div:${dv.id}:inc`)} /></label>
              {dv.tipo === 'suave'
                ? <label className="block text-gray-500">Tamanho da transição<Deslizador min={1} max={40} step={0.5} value={dv.suaveMm ?? 6} unidade="mm" onChange={e => mudarDiv(i, { suaveMm: Number(e.target.value) }, `div:${dv.id}:suave`)} /></label>
                : <label className="block text-gray-500">Faixa (0 = sem faixa)<Deslizador min={0} max={20} step={0.5} value={dv.faixaMm ?? 0} unidade="mm" onChange={e => mudarDiv(i, { faixaMm: Number(e.target.value) }, `div:${dv.id}:faixa`)} data-faixa-divisoria /></label>}
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => usarEstrutura({ ...estrutura, id: 'personalizada', divisorias: [...estrutura.divisorias, { id: `d${Date.now().toString(36)}`, eixo: 'h', pos: 0.7, tipo: 'reto' }], nomes: undefined }, '+ Divisória horizontal')} data-mais-divisoria="h">+ horizontal</button>
            <button className={btn} onClick={() => usarEstrutura({ ...estrutura, id: 'personalizada', divisorias: [...estrutura.divisorias, { id: `d${Date.now().toString(36)}`, eixo: 'v', pos: 0.35, tipo: 'reto' }], nomes: undefined }, '+ Divisória vertical')} data-mais-divisoria="v">+ vertical (lateral)</button>
            <button className={btn} onClick={() => void salvarComoMinha()} data-salvar-estrutura><Save className="w-3 h-3" /> Salvar como minha estrutura</button>
          </div>
          {nomesPedacos.length > 1 && (
            <div className="space-y-0.5" data-nomes-pedacos>
              <p className="text-[10px] text-gray-500">Pedaços (cada um é uma parte: arraste o papel para ele no Tema):</p>
              <div className="flex flex-wrap gap-1">{nomesPedacos.map((n, k) => (
                <input key={`${k}:${n}`} defaultValue={n} onBlur={e => { const v = e.target.value.trim().toUpperCase().slice(0, 40); if (v && v !== n) usarEstrutura({ ...estrutura, nomes: nomesPedacos.map((x, j) => (j === k ? v : x)) }, 'Nome do pedaço') }} className={inp + ' w-24'} />
              ))}</div>
            </div>
          )}
          <p className="text-[10px] text-gray-400">Na arte, arraste a divisória (linha laranja) para subir/descer a base ou mudar a lateral.</p>
        </div>
      )}
      {pecas.length > 0 && <button className={btn} onClick={marcarNome} data-marcar-nome-medidas><Type className="w-3.5 h-3.5" /> Marcar a área do NOME em todas as medidas</button>}
    </div>
  )
}
