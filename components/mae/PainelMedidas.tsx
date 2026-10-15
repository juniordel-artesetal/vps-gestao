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
import { novaPeca, mudarMedida, aplicarEstrutura, estruturaDaPeca, medidaDe, ehPecaPorMedida, ESTRUTURAS_PRONTAS, pedacosDaPeca, type Estrutura, type Divisoria, type Medida, type Miolo } from '@/lib/mae/medidas/pecas'
import { criarFolha, folhasDa } from '@/lib/mae/editor/folhaMontada'
import { montarFolhaDoKit, sincronizarKit } from '@/lib/mae/editor/kitBase'
import { medidasFolha } from '@/lib/mae/schema'
import { gravar, ler } from '@/lib/mae/biblioteca/arquivos'
import { lerMedidaMm } from '@/lib/mae/editor/unidades'
import type { DocTrabalho } from '@/lib/mae/schema'
import Deslizador from './Deslizador'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const inp = 'rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-xs'
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR')
const NOMES_FORMA: Record<FormaMedida, string> = { retangulo: 'Retângulo', arredondado: 'Cantos arredondados', circulo: 'Círculo / oval' }
/** Lote 14 (item 189.2): os formatos da medida personalizada (quadrado = retângulo de lados iguais; oval = círculo esticado). */
const FORMATOS = [['retangulo', 'Retângulo'], ['quadrado', 'Quadrado'], ['circulo', 'Círculo'], ['oval', 'Oval'], ['arredondado', 'Retângulo com canto arredondado']] as const
type Formato = typeof FORMATOS[number][0]
const formaDo = (f: Formato): FormaMedida => (f === 'quadrado' ? 'retangulo' : f === 'oval' ? 'circulo' : f)

/**
 * Lote 14 (item 189.9): MODELOS PRONTOS DE KIT — começar já configurado e só ajustar. Folhas em A4 (orientação
 * automática), espaço 2 mm, margem 5 mm, sem marca (escolha a sua em Folhas do kit).
 */
const MODELOS_KIT: { id: string; nome: string; pecas: { nome: string; medida: Medida }[]; folhas: { nome: string; pecas: [number, number][]; impressoes: number }[]; contagem: 'kit' | 'pecas' }[] = [
  { id: 'etiqueta-escolar', nome: 'Kit etiqueta escolar', contagem: 'kit',
    pecas: [{ nome: 'Livros 9×5', medida: { forma: 'arredondado', larguraMm: 90, alturaMm: 50, raioMm: 3 } }, { nome: 'Caderno 7×3', medida: { forma: 'arredondado', larguraMm: 70, alturaMm: 30, raioMm: 3 } }, { nome: 'Lápis 5×2', medida: { forma: 'arredondado', larguraMm: 50, alturaMm: 20, raioMm: 2 } }],
    folhas: [{ nome: 'Folha 1', pecas: [[0, 4], [1, 6]], impressoes: 2 }, { nome: 'Folha 2', pecas: [[2, 30]], impressoes: 3 }] },
  { id: 'tags-4cm', nome: 'Tags 4 cm × 24 (A4)', contagem: 'pecas',
    pecas: [{ nome: 'Tag redonda 4 cm', medida: { forma: 'circulo', larguraMm: 40, alturaMm: 40, furo: { x: 0.5, y: 0.14, diametroMm: 3.5 } } }],
    folhas: [{ nome: 'Folha de tags', pecas: [[0, 24]], impressoes: 1 }] },
]
import { useEditor } from './estado'

const ARQ_ESTRUTURAS = 'Bases/estruturas.json'

type Doc = DocTrabalho & { estrutura?: Estrutura; tipo?: string }
const aplicar = (label: string, f: (d: Doc) => void, juntar?: string) => useMaeDoc.getState().aplicar(label, d => f(d as Doc), juntar)
/** Mudou a medida/forma: a estrutura da base vale de novo para a peça. */
const reestruturar = (d: Doc) => aplicarEstrutura(d, d.estrutura ?? ESTRUTURAS_PRONTAS[0], { manter: true })   // Lote 16 (item 207): respeita a de cada peça

export default function PainelMedidas({ parte = 'pecas' }: { parte?: 'pecas' | 'miolo' }) {
  const doc = useMaeDoc(s => s.hist.atual) as Doc
  const raiz = useBiblioteca(s => s.raiz)
  const [cat, setCat] = useState<string | null>(CATEGORIAS_MEDIDAS[0])
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [nova, setNova] = useState<{ nome: string; l: string; a: string; forma: Formato; raio: string; furo: boolean; furoD: string; furoY: string } | null>(null)
  const [minhas, setMinhas] = useState<Estrutura[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const pecas = doc.molds.filter(ehPecaPorMedida)
  // Lote 16 (item 207): "Aplicar em" — todas as peças (null) ou uma peça (o padrão: a peça escolhida no editor)
  const alvo0 = useEditor(s => s.estruturaAlvo)
  const alvo = alvo0 && pecas.some(p => p.id === alvo0) ? alvo0 : null
  const setAlvo = (id: string | null) => useEditor.getState().set({ estruturaAlvo: id })
  const estrutura = estruturaDaPeca(doc, alvo)

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
      // Lote 14 (item 189.2): adicionar peça NÃO cria kit escondido — a composição é só nas Folhas do kit
      sincronizarKit(d as never)
    })
    setMarcadas(new Set())
  }
  /** Lote 14 (item 189.9): começa de um modelo pronto de kit (peças + folhas já montadas). */
  function usarModelo(id: string) {
    const mo = MODELOS_KIT.find(x => x.id === id); if (!mo) return
    aplicar(`Modelo: ${mo.nome}`, d => {
      const ab = d.artboards[0]
      const ids = mo.pecas.map((p, k) => { const m = novaPeca(p.nome, p.medida, ab.id, { xMm: 10 + k * 10, yMm: 10 + k * 10 }); d.molds.push(m); return m.id })
      d.tipo = 'medida'; d.smartArt = { ...(d.smartArt ?? {}), overflowMm: 2 }
      reestruturar(d)
      for (const fo of mo.folhas) {
        const fid = criarFolha(d as never, { nome: fo.nome, ...medidasFolha('A4', 'retrato') })
        const f = folhasDa(d as never).find(x => x.id === fid)!
        f.orientacao = 'auto'; f.impressoes = fo.impressoes; f.pedidas = fo.pecas.map(([k, qtd]) => ({ moldeId: ids[k], qtd }))
        const r = montarFolhaDoKit(f, d.molds, () => [])
        f.widthMm = r.widthMm; f.heightMm = r.heightMm; f.pecas = r.pecas
      }
      sincronizarKit(d as never)
      const g = (d.grupos ?? [])[0]; if (g) g.contagem = mo.contagem
    })
    setMsg(`Modelo "${mo.nome}" pronto — ajuste as peças e as folhas (e escolha a marca de registro em Folhas do kit).`)
  }
  /** Lote 14 (item 189.5): o miolo de uma peça (null = sem miolo, o fundo inteiro). */
  const mudarMiolo = (id: string, mi: Miolo | null, juntar?: string) => mudar(id, mi ? 'Miolo da peça' : 'Sem miolo', { miolo: mi }, juntar)
  const doCatalogo = () => adicionar(CATALOGO_MEDIDAS.filter(m => marcadas.has(m.id)).map(m => ({ nome: `${m.categoria} · ${m.nome}`.replace(/^Etiqueta escolar · /, 'Etiqueta '), medida: { forma: m.forma, larguraMm: m.larguraMm, alturaMm: m.alturaMm, ...(m.raioMm ? { raioMm: m.raioMm } : {}), ...(m.furo ? { furo: m.furo } : {}), catalogoId: m.id } })))

  function criarPersonalizada() {
    if (!nova) return
    const iguais = nova.forma === 'quadrado' || nova.forma === 'circulo'
    const l = lerMedidaMm(nova.l), a = lerMedidaMm(iguais && !nova.a.trim() ? nova.l : nova.a)
    if (!(l && a && l > 1 && a > 1 && l < 2000 && a < 2000)) { setMsg('Confira a largura e a altura (ex.: 90 ou 9cm).'); return }
    const furoD = lerMedidaMm(nova.furoD) ?? 4, furoY = lerMedidaMm(nova.furoY) ?? Math.min(0.3 * a, 6)
    if (nova.furo && !(furoD > 0.5 && furoY > furoD / 2 && furoY < a - furoD / 2)) { setMsg('O furo precisa ficar dentro da peça (confira o diâmetro e a distância do topo).'); return }
    adicionar([{ nome: nova.nome.trim() || `Peça ${fmt(l)}×${fmt(a)}`, medida: { forma: formaDo(nova.forma), larguraMm: l, alturaMm: a, ...(nova.forma === 'arredondado' ? { raioMm: lerMedidaMm(nova.raio) ?? 3 } : {}), ...(nova.furo ? { furo: { x: 0.5, y: furoY / a, diametroMm: furoD } } : {}) } }])
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
  const usarEstrutura = (e: Estrutura, label = `Estrutura: ${e.nome}`, juntar?: string) => aplicar(label, d => aplicarEstrutura(d, e, { peca: alvo }), juntar)
  const mudarDiv = (i: number, p: Partial<Divisoria>, juntar?: string) => usarEstrutura({ ...estrutura, divisorias: estrutura.divisorias.map((x, k) => (k === i ? { ...x, ...p } : x)) }, 'Divisória', juntar)
  const pecaExemplo = (alvo && pecas.find(p => p.id === alvo)) || pecas[0]
  const exemplo = pecaExemplo ? medidaDe(pecaExemplo) : null
  const nomesPedacos = exemplo ? pedacosDaPeca(exemplo, estrutura).map(p => p.nome) : []
  async function carregarMinhas() {
    if (minhas) return
    let l: Estrutura[] = []
    try { if (raiz) l = JSON.parse(await (await ler(raiz, ARQ_ESTRUTURAS)).text()) } catch { /* ainda não há */ }
    setMinhas(Array.isArray(l) ? l : [])
  }
  async function salvarComoMinha() {
    // Lote 16 (item 207): salva a estrutura da peça escolhida em "Aplicar em" (ou a de todas)
    const nome = prompt('Nome da estrutura (ex.: Etiqueta escolar com faixa):', estrutura.nome)?.trim()
    if (!nome) return
    await carregarMinhas()
    const lista = [...(minhas ?? []).filter(x => x.nome !== nome), { ...estrutura, id: `minha_${Date.now().toString(36)}`, nome }]
    setMinhas(lista)
    if (raiz) await gravar(raiz, ARQ_ESTRUTURAS, JSON.stringify(lista, null, 1)).catch(() => setMsg('Não consegui gravar na Biblioteca.'))
    setMsg(`Estrutura "${nome}" salva — aparece em "Usar estrutura" em qualquer base.`)
  }

  return (
    <div className="space-y-3" data-painel-medidas={parte}>
      {msg && <p className="text-[11px] text-amber-700" data-msg-medidas>{msg}</p>}
      {parte === 'miolo' && <MioloDasPecas pecas={pecas} mudarMiolo={mudarMiolo} />}
      {parte === 'pecas' && <>
      <p className="text-[11px] text-gray-500">Etiquetas, tags, rótulos: escolha as peças (prontas ou com a sua medida). Cada peça já nasce com o contorno de corte. Quantas de cada vão no kit, você diz em <b>Folhas do kit</b>.</p>
      {!pecas.length && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 p-2 space-y-1" data-modelos-kit>
          <p className="text-xs font-semibold">Começar de um modelo pronto</p>
          <div className="flex flex-wrap gap-1">{MODELOS_KIT.map(m => <button key={m.id} className={btn} onClick={() => usarModelo(m.id)} data-modelo-kit={m.id}>{m.nome}</button>)}</div>
        </div>
      )}

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
          <button className={btn} onClick={() => setNova({ nome: '', l: '', a: '', forma: 'retangulo', raio: '3', furo: false, furoD: '4', furoY: '' })} data-medida-personalizada><Plus className="w-3.5 h-3.5" /> Medida personalizada</button>
        </div>
        <p className="text-[10px] text-gray-400">As medidas variam entre marcas — confira e ajuste (cada uma continua editável abaixo).</p>
      </div>

      {nova && (
        <div className="rounded-lg border border-orange-200 p-2 space-y-1 text-[11px]" data-nova-medida>
          <input value={nova.nome} onChange={e => setNova({ ...nova, nome: e.target.value })} placeholder="Nome (ex.: Bolsinha P)" className={inp + ' w-full'} data-nome-medida />
          <div className="flex flex-wrap items-center gap-1">
            <select value={nova.forma} onChange={e => setNova({ ...nova, forma: e.target.value as Formato })} className={inp} data-formato-medida>{FORMATOS.map(([f, n]) => <option key={f} value={f}>{n}</option>)}</select>
            <input value={nova.l} onChange={e => setNova({ ...nova, l: e.target.value })} placeholder={nova.forma === 'quadrado' || nova.forma === 'circulo' ? 'lado/diâmetro' : 'largura'} className={inp + ' w-16'} inputMode="decimal" data-largura-medida />
            {nova.forma !== 'quadrado' && nova.forma !== 'circulo' && <>×<input value={nova.a} onChange={e => setNova({ ...nova, a: e.target.value })} placeholder="altura" className={inp + ' w-16'} inputMode="decimal" data-altura-medida /></>}
            <span className="text-gray-400">mm (ou &quot;9cm&quot;)</span>
            {nova.forma === 'arredondado' && <label className="flex items-center gap-1">raio <input value={nova.raio} onChange={e => setNova({ ...nova, raio: e.target.value })} className={inp + ' w-10'} inputMode="decimal" /> mm</label>}
            <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={nova.furo} onChange={e => setNova({ ...nova, furo: e.target.checked })} data-furo-medida /> furo</label>
            {nova.furo && <><label className="flex items-center gap-1">Ø <input value={nova.furoD} onChange={e => setNova({ ...nova, furoD: e.target.value })} className={inp + ' w-10'} inputMode="decimal" data-furo-diametro /> mm</label>
              <label className="flex items-center gap-1">do topo <input value={nova.furoY} onChange={e => setNova({ ...nova, furoY: e.target.value })} placeholder="auto" className={inp + ' w-10'} inputMode="decimal" /> mm</label></>}
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

      </>}
      {/* estrutura (Fundo e miolo) */}
      {parte === 'miolo' && pecas.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-estrutura>
          <p className="text-xs font-semibold">Estrutura (o esqueleto da arte)</p>
          {/* Lote 17 (item 209): cada peça com as suas partes (Corpo · FUNDO ≠ Tampa · FUNDO) — ou o mesmo papel em todas */}
          {pecas.length > 1 && (
            <label className="flex items-start gap-1.5 text-[11px]" title="Ligado: arrastar um papel para FUNDO vale para todas as peças. Desligado (padrão): cada peça tem as suas partes.">
              <input type="checkbox" className="accent-orange-500 mt-0.5" checked={!!(doc as { partesCompartilhadas?: boolean }).partesCompartilhadas}
                onChange={e => aplicar(e.target.checked ? 'Mesmo papel em todas as peças' : 'Partes por peça', d => { (d as { partesCompartilhadas?: boolean }).partesCompartilhadas = e.target.checked || undefined; reestruturar(d) })} data-partes-compartilhadas />
              <span>Usar o mesmo papel em todas as peças <span className="text-gray-400">(fundo, faixa, miolo… — desligado: cada peça tem as suas partes)</span></span>
            </label>
          )}
          {/* Lote 16 (item 207): a estrutura é POR PEÇA (o corpo com faixa, a tampa com fundo + miolo) */}
          {pecas.length > 1 && (
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-gray-500">Aplicar em:</span>
              <select value={alvo ?? ''} onChange={e => setAlvo(e.target.value || null)} className={inp} data-estrutura-alvo>
                <option value="">Todas as peças</option>
                {pecas.map(p => <option key={p.id} value={p.id}>{p.name}{medidaDe(p)?.estrutura ? ' (própria)' : ''}</option>)}
              </select>
              {alvo && (
                <select value="" onChange={e => { const de = pecas.find(p => p.id === e.target.value); if (de) usarEstrutura(estruturaDaPeca(doc, de.id), `Copiar estrutura de ${de.name}`) }} className={inp} data-copiar-estrutura>
                  <option value="">Copiar estrutura de…</option>
                  {pecas.filter(p => p.id !== alvo).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </div>
          )}
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
    </div>
  )
}

/** Lote 14 (item 189.6): na etapa Textos da base de peças sob medida — a área do NOME em todas as peças (no miolo). */
export function BotaoNomeMedidas() {
  const marcarNome = () => aplicar('Área do NOME em todas as peças', d => {
    for (const p of d.molds.filter(ehPecaPorMedida)) {
      const face = p.faces.find(f => f.id.endsWith('_miolo')) ?? p.faces.find(f => !f.hole)
      if (!face || d.textSlots.some(s => p.faces.some(f => f.id === s.faceId) && s.variable === 'NOME')) continue
      d.textSlots.push({ id: `ts_nome_${p.id.slice(-6)}`, variable: 'NOME', faceId: face.id, box: { x: 0.12, y: 0.32, w: 0.76, h: 0.36 }, single: { lines: 1, sizePt: 22 }, compound: { lines: 2, sizePt: 18, lineHeight: 0.9 }, autoFit: { minScale: 0.6 } })
    }
  })
  return <button className={btn} onClick={marcarNome} data-marcar-nome-medidas><Type className="w-3.5 h-3.5" /> Marcar a área do NOME em todas as peças</button>
}

/** Lote 14 (item 189.5): o MIOLO de cada tipo de peça — no formato da peça com margem, ou outra forma; vale em todas as cópias. */
function MioloDasPecas({ pecas, mudarMiolo }: { pecas: DocTrabalho['molds']; mudarMiolo: (id: string, mi: Miolo | null, juntar?: string) => void }) {
  if (!pecas.length) return <p className="text-[11px] text-gray-400">Crie as peças primeiro (etapa Peças).</p>
  return (
    <div className="space-y-1.5" data-miolo-pecas>
      <p className="text-[11px] text-gray-500">Cada peça tem o <b>fundo</b> (a peça inteira, com a sobra de corte) e, se quiser, o <b>miolo</b>: a forma de dentro onde vai a arte e o nome. No tema, cada um recebe papel, cor e estilos (parte FUNDO e parte MIOLO).</p>
      {pecas.map(p => {
        const m = medidaDe(p)!, mi = m.miolo ?? null
        const valor = !mi ? '' : mi.forma
        return (
          <div key={p.id} className="rounded border border-gray-100 dark:border-gray-800 p-1.5 space-y-1 text-[11px]" data-miolo-peca={p.name}>
            <div className="flex items-center gap-1"><b className="flex-1 truncate">{p.name}</b>
              <select className={inp} value={valor} onChange={e => { const v = e.target.value; mudarMiolo(p.id, !v ? null : v === 'mesma' ? { forma: 'mesma', margemMm: mi?.margemMm ?? 3 } : { forma: v as FormaMedida, x: mi?.x ?? 0.5, y: mi?.y ?? 0.5, w: mi?.w ?? 0.7, h: mi?.h ?? 0.7 }) }} data-forma-miolo>
                <option value="">Sem miolo (só o fundo)</option><option value="mesma">Miolo no formato da peça</option><option value="circulo">Miolo círculo / oval</option><option value="retangulo">Miolo retângulo</option><option value="arredondado">Miolo com canto arredondado</option>
              </select>
            </div>
            {mi?.forma === 'mesma' && <label className="block text-gray-500">Margem<Deslizador min={0} max={Math.max(2, Math.min(m.larguraMm, m.alturaMm) / 2 - 1)} step={0.5} value={mi.margemMm ?? 3} unidade="mm" onChange={e => mudarMiolo(p.id, { ...mi, margemMm: Number(e.target.value) }, `miolo:${p.id}:mg`)} data-margem-miolo /></label>}
            {mi && mi.forma !== 'mesma' && <>
              <label className="block text-gray-500">Largura<Deslizador min={0.1} max={1} step={0.01} value={mi.w ?? 0.7} unidade="%" fator={100} onChange={e => mudarMiolo(p.id, { ...mi, w: Number(e.target.value) }, `miolo:${p.id}:w`)} data-largura-miolo /></label>
              <label className="block text-gray-500">Altura<Deslizador min={0.1} max={1} step={0.01} value={mi.h ?? 0.7} unidade="%" fator={100} onChange={e => mudarMiolo(p.id, { ...mi, h: Number(e.target.value) }, `miolo:${p.id}:h`)} /></label>
              <label className="block text-gray-500">Posição ↔<Deslizador min={0} max={1} step={0.01} value={mi.x ?? 0.5} unidade="%" fator={100} onChange={e => mudarMiolo(p.id, { ...mi, x: Number(e.target.value) }, `miolo:${p.id}:x`)} /></label>
              <label className="block text-gray-500">Posição ↕<Deslizador min={0} max={1} step={0.01} value={mi.y ?? 0.5} unidade="%" fator={100} onChange={e => mudarMiolo(p.id, { ...mi, y: Number(e.target.value) }, `miolo:${p.id}:y`)} /></label>
            </>}
          </div>
        )
      })}
      <p className="text-[10px] text-gray-400">A moldurinha entre o fundo e o miolo é do tema (Moldurinha, na parte MIOLO).</p>
    </div>
  )
}
