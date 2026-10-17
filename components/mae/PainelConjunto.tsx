'use client'
// MAE — CONJUNTO DE APLIQUE (Lote 10, item 157) e MOLDURINHA EM QUALQUER PEÇA (item 158), a parte de TELA:
//   <SecaoConjuntos/>   painel Apliques 3D: novo conjunto, transformar o aplique selecionado, conjuntos salvos (presets)
//   <EditorConjunto/>   painel da direita: as peças (impressa × só recorte + material, formato, papel, tamanho, posição,
//                       bordinha/silhueta, moldurinha, "troca em cada tema"), ordem, salvar como preset
//   <MolduraNaForma/>   moldurinha numa forma comum (contorna a forma, afastada da borda)
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { ArrowDown, ArrowUp, Layers3, Plus, Save, Trash2, Frame } from 'lucide-react'
import type { DocTema, PecaConjunto } from '@/lib/mae/schema'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { acharCamadaTema, ajustarSoNaFace, voltarAoPadrao, marcarRefEstilos } from '@/lib/mae/vinculo/tema'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { acharFace } from '@/lib/mae/vinculo/partes'
import EditorEfeitos from './EditorEfeitos'
import { limparEfeitos } from '@/lib/mae/schema/efeitos'
import { conjuntoPadrao, conjuntoDoAplique } from '@/lib/mae/vinculo/conjunto'
import { useEditor } from './estado'
import { SeletorImagem } from './SeletorImagem'
import Deslizador from './Deslizador'
import { sync } from './sincronia'
import CorComPaleta from './CorComPaleta'

const btn = 'inline-flex items-center gap-1 rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 text-[11px] hover:border-orange-400 disabled:opacity-40'
const MATERIAIS = ['Dourado', 'Prateado', 'Glitter rosa', 'Glitter dourado', 'Preto', 'Branco', 'Holográfico']
const FORMATOS: [string, string][] = [['ellipse', 'Círculo'], ['scallop', 'Escalope'], ['cloud', 'Nuvem'], ['heart', 'Coração'], ['star', 'Estrela'], ['rect', 'Retângulo'], ['polygon', 'Polígono']]
const gid = () => `pc_${Math.random().toString(36).slice(2, 8)}`
type Conjunto = Extract<DocTema['partContent'][string][number], { type: 'conjunto' }>

// ── presets de conjunto (nuvem; o nome é a usuária quem dá) ──
interface PresetConjunto { nome: string; aspect: number; pecas: PecaConjunto[] }
export const usePresetsConjunto = create<{ lista: PresetConjunto[]; carregado: boolean }>()(() => ({ lista: [], carregado: false }))
async function carregarPresetsConjunto() {
  try {
    const r = await sync.presets.listar()
    usePresetsConjunto.setState({ carregado: true, lista: r.meus.filter(p => p.conjunto).map(p => ({ nome: p.name, aspect: (p.conjunto!.aspect as number) ?? 1, pecas: p.conjunto!.pecas as PecaConjunto[] })) })
  } catch { usePresetsConjunto.setState({ carregado: true }) }
}

/** Põe o conjunto na parte ativa (ou só na caixa clicada, se o modo for "só nesta caixa"). */
function inserirConjunto(cj: Conjunto, label: string) {
  const ed = useEditor.getState()
  const parte = ed.parteAtiva
  if (!parte) { alert('Escolha a parte (FRENTE, LATERAL…) onde o conjunto vai.'); return }
  const doc = useMaeDoc.getState().hist.atual
  useMaeTema.getState().aplicar(label, t => {
    const x = t as DocTema
    if (ed.escopo === 'face' && ed.face) ((x.faceContent ??= {})[ed.face] ??= []).push(cj as never)
    else {
      (x.partContent[parte] ??= []).push(cj as never)
      // Lote 14 (item 195): com uma caixa clicada, o conjunto entra SÓ nela (antes ia para todas e era preciso tirar à
      // mão pela lista de camadas) — as outras caixas da parte ligam no "Em quais caixas"
      if (ed.face) for (const i of doc.parts.find(p => p.id === parte)?.instances ?? []) if (i.faceId !== ed.face) ajustarSoNaFace(x, i.faceId, cj.id, { visible: false })
    }
    x.appliques = { enabled: true, borderMm: 1, borderColor: '#ffffff', silhouetteMm: 3, ...(x.appliques ?? {}) } as never
  })
  useEditor.getState().set({ camada: cj.id, slot: null })
}

/** Painel Apliques 3D: criar / transformar / conjuntos salvos. */
export function SecaoConjuntos() {
  const camada = useEditor(s => s.camada)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const presets = usePresetsConjunto(s => s.lista)
  useEffect(() => { if (!usePresetsConjunto.getState().carregado) void carregarPresetsConjunto() }, [])
  const sel = tema && camada ? acharCamadaTema(tema, camada)?.c : null
  const podeTransformar = sel?.type === 'image' && (sel.anchor ?? 'face') !== 'paper'
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5 text-xs" data-secao-conjuntos>
      <p className="font-semibold flex items-center gap-1"><Layers3 className="w-3.5 h-3.5" /> Conjuntos de aplique</p>
      <p className="text-[10px] text-gray-500">Peças empilhadas: moldura só de recorte num papel (dourado, glitter…), círculo impresso com papel e moldurinha, personagem por cima. Sai uma folha impressa e uma folha de recorte por material.</p>
      <div className="flex flex-wrap gap-1">
        <button className={btn} onClick={() => inserirConjunto(conjuntoPadrao(), 'Novo conjunto de aplique')} data-novo-conjunto><Plus className="w-3 h-3" /> Novo conjunto</button>
        {podeTransformar && <button className={btn} onClick={() => {
          const c = sel as unknown as { id: string; name?: string; path: string; sha256?: string; aspect?: number; transform?: { x: number; y: number; scale: number; rotationDeg: number } }
          const cj = conjuntoDoAplique(c)
          useMaeTema.getState().aplicar('Transformar em conjunto de aplique', t => {
            const a = acharCamadaTema(t as DocTema, c.id); if (!a) return
            a.lista.splice(a.i, 1, cj as never)
            ;(t as DocTema).appliques = { enabled: true, borderMm: 1, borderColor: '#ffffff', silhouetteMm: 3, ...((t as DocTema).appliques ?? {}) } as never
          })
          useEditor.getState().set({ camada: cj.id })
        }} data-transformar-conjunto>Transformar o selecionado em conjunto</button>}
      </div>
      {presets.length > 0 && (
        <div className="space-y-0.5" data-presets-conjunto>
          <p className="text-[10px] font-semibold">Conjuntos salvos</p>
          <div className="flex flex-wrap gap-1">{presets.map(p => (
            <button key={p.nome} className={btn} onClick={() => {
              const cj = { ...conjuntoPadrao(p.nome), aspect: p.aspect, pecas: p.pecas.map(x => ({ ...JSON.parse(JSON.stringify(x)), id: gid() })) } as Conjunto
              inserirConjunto(cj, `Conjunto "${p.nome}"`)
            }} data-aplicar-preset-conjunto={p.nome}>{p.nome}</button>
          ))}</div>
        </div>
      )}
    </div>
  )
}

/** Painel da direita: as peças do conjunto selecionado. */
export function EditorConjunto({ camadaId }: { camadaId: string }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const [escolher, setEscolher] = useState<{ i: number; o: 'imagem' | 'papel' } | null>(null)
  const [nomePreset, setNomePreset] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const a = tema ? acharCamadaTema(tema, camadaId) : null
  if (!a || (a.c as { type: string }).type !== 'conjunto') return null
  const cj = a.c as unknown as Conjunto
  const mudar = (label: string, f: (c: Conjunto) => void, juntar?: string) => useMaeTema.getState().aplicar(label, t => { const x = acharCamadaTema(t as DocTema, camadaId); if (x) f(x.c as unknown as Conjunto) }, juntar)
  const peca = (i: number, label: string, f: (p: PecaConjunto) => void, juntar?: string) => mudar(label, c => f(c.pecas[i]), juntar ? `cj:${camadaId}:${i}:${juntar}` : undefined)
  const n = cj.pecas.length
  // Lote 14 (item 195): MEDIDA REAL — a largura da caixa (a clicada, ou a 1ª da parte) × a escala do conjunto
  const larguraConj = larguraDoConjunto(camadaId, cj)
  const mmDaPeca = (p: PecaConjunto) => ({ w: larguraConj * (p.escala ?? 1), h: (larguraConj * (p.escala ?? 1)) / ((p.imagem?.aspect ?? p.aspect) || 1) })
  return (
    <div className="space-y-1.5 text-xs" data-editor-conjunto>
      <p className="font-semibold flex items-center gap-1"><Layers3 className="w-3.5 h-3.5" /> Conjunto de aplique · {n} peça{n > 1 ? 's' : ''}</p>
      <p className="text-[10px] text-gray-500">De cima para baixo. Mover, girar e redimensionar o conjunto na arte leva todas as peças juntas.</p>
      {larguraConj > 0 && <label className="block text-[11px] text-gray-500">Largura do conjunto<Deslizador min={5} max={Math.max(50, Math.round(larguraConj / ((cj as { transform?: { scale?: number } }).transform?.scale || 1) * 2))} step={0.5} unidade="mm" value={Math.round(larguraConj * 10) / 10}
        onChange={e => { const alvo = Number(e.target.value), por = larguraConj / ((cj as { transform?: { scale?: number } }).transform?.scale || 1); if (por > 0) mudar('Largura do conjunto', c => { marcarRefEstilos(c as never); const t = (c as { transform?: { scale: number } }).transform; if (t) t.scale = Math.max(0.02, alvo / por) }, `cj:${camadaId}:larg`) }} data-largura-conjunto /></label>}
      <label className="flex items-center gap-1.5 text-[11px]" title="Como os apliques 3D: o conjunto pode passar da borda da caixa"><input type="checkbox" className="accent-orange-500" checked={!!(cj as { bleed?: boolean }).bleed} onChange={e => mudar(e.target.checked ? 'Pode sair da face' : 'Preso na face', c => { const x = c as { bleed?: boolean }; if (e.target.checked) x.bleed = true; else delete x.bleed })} data-sair-da-face /> Pode sair da face</label>
      <CaixasDoConjunto camadaId={camadaId} />
      {[...cj.pecas].map((p, i) => ({ p, i })).reverse().map(({ p, i }) => (
        <details key={p.id} className="rounded border border-gray-200 dark:border-gray-700 p-1" data-peca={p.nome}>
          <summary className="cursor-pointer flex items-center gap-1">
            <span className="flex-1 truncate font-medium">{p.nome}</span>
            <span className={`rounded px-1 text-[9px] ${p.tipo === 'recorte' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>{p.tipo === 'recorte' ? `recorte · ${p.material ?? '?'}` : 'impressa'}</span>
            <button className="p-0.5" disabled={i === n - 1} title="Subir" onClick={e => { e.preventDefault(); mudar('Ordem das peças', c => { const [x] = c.pecas.splice(i, 1); c.pecas.splice(i + 1, 0, x) }) }}><ArrowUp className="w-3 h-3" /></button>
            <button className="p-0.5" disabled={i === 0} title="Descer" onClick={e => { e.preventDefault(); mudar('Ordem das peças', c => { const [x] = c.pecas.splice(i, 1); c.pecas.splice(i - 1, 0, x) }) }}><ArrowDown className="w-3 h-3" /></button>
            <button className="p-0.5" disabled={n <= 1} title="Excluir a peça" onClick={e => { e.preventDefault(); mudar('Excluir peça', c => { c.pecas.splice(i, 1) }) }} data-excluir-peca><Trash2 className="w-3 h-3" /></button>
          </summary>
          <div className="space-y-1 pt-1">
            <input defaultValue={p.nome} key={`${p.id}:${p.nome}`} onBlur={e => { const v = e.target.value.trim(); if (v && v !== p.nome) peca(i, 'Nome da peça', x => { x.nome = v.slice(0, 60) }) }} className="w-full rounded border border-gray-200 bg-transparent px-1 py-0.5" aria-label="Nome da peça" />
            <div className="flex flex-wrap items-center gap-1">
              <select value={p.tipo} onChange={e => peca(i, 'Tipo da peça', x => { x.tipo = e.target.value as 'impressa' | 'recorte'; if (x.tipo === 'recorte' && !x.material) x.material = 'Dourado' })} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" data-tipo-peca>
                <option value="impressa">Impressa (imprime e corta)</option><option value="recorte">Só recorte (material)</option>
              </select>
              {p.tipo === 'recorte' && <>
                <input list="mae-materiais" defaultValue={p.material ?? ''} key={`${p.id}:mat:${p.material}`} onBlur={e => { const v = e.target.value.trim(); if (v !== (p.material ?? '')) peca(i, 'Material', x => { x.material = v.slice(0, 40) || undefined }) }} placeholder="Material" className="w-24 rounded border border-gray-200 bg-transparent px-1 py-0.5" data-material-peca />
                <datalist id="mae-materiais">{MATERIAIS.map(m => <option key={m} value={m} />)}</datalist>
              </>}
              <CorComPaleta value={p.cor} onChange={cor => peca(i, 'Cor da peça', x => { x.cor = cor }, 'cor')} className="h-5 w-6" title={p.tipo === 'recorte' ? 'Cor do material na arte' : 'Cor da peça'} />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <select value={p.imagem ? 'imagem' : p.forma?.kind ?? 'ellipse'} onChange={e => { const v = e.target.value; if (v === 'imagem') setEscolher({ i, o: 'imagem' }); else peca(i, 'Formato da peça', x => { delete x.imagem; x.forma = { kind: v as never, params: { radius: 0.15, sides: v === 'cloud' ? 7 : v === 'polygon' ? 6 : v === 'star' ? 5 : 12, inner: v === 'star' ? 0.5 : v === 'cloud' ? 0.72 : 0.86 } } }) }} className="rounded border border-gray-200 bg-transparent px-1 py-0.5" data-formato-peca>
                {FORMATOS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}<option value="imagem">Imagem (PNG)…</option>
              </select>
              {p.tipo === 'impressa' && !p.imagem && <button className={btn} onClick={() => setEscolher({ i, o: 'papel' })} data-papel-peca>{p.papel ? 'Trocar papel' : 'Papel…'}</button>}
              {p.papel && <button className={btn} onClick={() => peca(i, 'Tirar papel', x => { delete x.papel })}>sem papel</button>}
              <label className="flex items-center gap-1" title="Peça que se troca em cada tema (o papel do círculo, o personagem)"><input type="checkbox" checked={!!p.trocar} onChange={e => peca(i, 'Troca no tema', x => { if (e.target.checked) x.trocar = true; else delete x.trocar })} /> troca em cada tema</label>
            </div>
            {escolher?.i === i && <SeletorImagem pastas={escolher.o === 'papel' ? ['Papéis'] : ['Elementos', 'Papéis']} onEscolher={img => {
              peca(i, escolher.o === 'papel' ? 'Papel da peça' : 'Imagem da peça', x => {
                if (escolher.o === 'papel') x.papel = { path: img.path, sha256: img.sha256, aspect: img.aspect }
                else { delete x.forma; x.imagem = { path: img.path, sha256: img.sha256, aspect: img.aspect }; x.aspect = img.aspect ?? 1 }
              })
              setEscolher(null)
            }} />}
            {larguraConj > 0
              ? <div className="grid grid-cols-2 gap-1" data-medida-peca>
                  <label className="block text-[11px] text-gray-500">Largura<Deslizador min={1} max={Math.max(10, Math.round(larguraConj * 1.5))} step={0.5} unidade="mm" value={Math.round(mmDaPeca(p).w * 10) / 10} onChange={e => peca(i, 'Tamanho da peça', x => { x.escala = Math.max(0.02, Math.min(2, Number(e.target.value) / larguraConj)) }, 'esc')} data-largura-peca /></label>
                  <label className="block text-[11px] text-gray-500">Altura<Deslizador min={1} max={Math.max(10, Math.round(larguraConj * 1.5))} step={0.5} unidade="mm" value={Math.round(mmDaPeca(p).h * 10) / 10} onChange={e => { const h = Number(e.target.value); peca(i, 'Altura da peça', x => { if (x.forma) x.aspect = Math.max(0.2, Math.min(5, (larguraConj * (x.escala ?? 1)) / h)); else x.escala = Math.max(0.02, Math.min(2, (h * ((x.imagem?.aspect ?? x.aspect) || 1)) / larguraConj)) }, 'alt') }} data-altura-peca /></label>
                </div>
              : <Faixa rotulo="Tamanho" valor={p.escala} min={0.05} max={1.5} passo={0.01} onChange={v => peca(i, 'Tamanho da peça', x => { x.escala = v }, 'esc')} />}
            <Faixa rotulo="Posição ↔" valor={p.x} min={0} max={1} passo={0.005} pct onChange={v => peca(i, 'Posição da peça', x => { x.x = v }, 'x')} />
            <Faixa rotulo="Posição ↕" valor={p.y} min={0} max={1} passo={0.005} pct onChange={v => peca(i, 'Posição da peça', x => { x.y = v }, 'y')} />
            {p.forma && !(larguraConj > 0) && <Faixa rotulo="Proporção (largura ÷ altura)" valor={p.aspect} min={0.2} max={5} passo={0.01} onChange={v => peca(i, 'Proporção da peça', x => { x.aspect = v }, 'asp')} />}
            {/* Lote 14 (item 195): máscara de corte — a peça só aparece dentro da de baixo */}
            {i > 0 && <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" className="accent-orange-500" checked={!!p.recortarAbaixo} onChange={e => peca(i, e.target.checked ? 'Recortar pela peça de baixo' : 'Sem recorte', x => { if (e.target.checked) x.recortarAbaixo = true; else delete x.recortarAbaixo })} data-recortar-abaixo /> Recortar pela peça de baixo</label>}
            {p.forma && (p.forma.kind === 'scallop' || p.forma.kind === 'cloud' || p.forma.kind === 'polygon' || p.forma.kind === 'star') && <Faixa rotulo={p.forma.kind === 'star' ? 'Pontas' : p.forma.kind === 'polygon' ? 'Lados' : 'Babados'} valor={p.forma.params.sides ?? 12} min={3} max={24} passo={1} onChange={v => peca(i, 'Babados', x => { if (x.forma) x.forma.params.sides = Math.round(v) }, 'sid')} />}
            {p.tipo === 'impressa' && <Faixa rotulo="Bordinha" valor={p.bordaMm ?? 1} min={0} max={5} passo={0.1} mm onChange={v => peca(i, 'Bordinha da peça', x => { x.bordaMm = v }, 'bor')} />}
            <Faixa rotulo="Silhueta / folga do corte" valor={p.silhuetaMm ?? (p.tipo === 'recorte' ? 0 : 3)} min={0} max={8} passo={0.1} mm onChange={v => peca(i, 'Silhueta da peça', x => { x.silhuetaMm = v }, 'sil')} />
            {/* Lote 10 (item 158): moldurinha dentro da peça, afastada da borda */}
            {p.forma && (
              <div className="rounded border border-dashed border-gray-200 p-1 space-y-0.5" data-moldura-peca>
                <label className="flex items-center gap-1"><input type="checkbox" checked={!!p.moldura} onChange={e => peca(i, e.target.checked ? 'Moldurinha na peça' : 'Tirar moldurinha', x => { if (e.target.checked) x.moldura = { offsetMm: 2, widthMm: 0.6, color: '#ffffff', dash: null }; else delete x.moldura })} data-ligar-moldura-peca /> <Frame className="w-3 h-3" /> Moldurinha dentro da peça</label>
                {p.moldura && <>
                  <Faixa rotulo="Distância da borda" valor={p.moldura.offsetMm} min={0} max={15} passo={0.1} mm onChange={v => peca(i, 'Distância da moldurinha', x => { if (x.moldura) x.moldura.offsetMm = v }, 'mof')} />
                  <Faixa rotulo="Espessura" valor={p.moldura.widthMm} min={0.1} max={4} passo={0.05} mm onChange={v => peca(i, 'Espessura da moldurinha', x => { if (x.moldura) x.moldura.widthMm = v }, 'mw')} />
                  <label className="flex items-center gap-1">Cor <CorComPaleta value={p.moldura.color} onChange={cor => peca(i, 'Cor da moldurinha', x => { if (x.moldura) x.moldura.color = cor }, 'mc')} className="h-5 w-6" />
                    <input type="checkbox" checked={!!p.moldura.dash} onChange={e => peca(i, 'Pesponto', x => { if (x.moldura) x.moldura.dash = e.target.checked ? { onMm: 1.2, offMm: 0.8 } : null })} /> pesponto</label>
                </>}
              </div>
            )}
            {/* Lote 14 (item 195): os ESTILOS da peça (moldurinha estilizada, contorno, sombra, brilho…) */}
            <EditorEfeitos key={`efp:${p.id}`} efeitos={limparEfeitos(p.effects)} titulo={`Estilos da peça — ${p.nome}`}
              onMudar={(novos, label, j) => peca(i, label, x => { x.effects = novos as never }, j ? `ef:${j}` : undefined)} />
          </div>
        </details>
      ))}
      <div className="flex flex-wrap gap-1">
        <button className={btn} onClick={() => mudar('Nova peça', c => { c.pecas.push({ id: gid(), nome: 'Peça', tipo: 'impressa', cor: '#ffffff', forma: { kind: 'ellipse', params: { radius: 0, sides: 6, inner: 0.5 } }, aspect: 1, x: 0.5, y: 0.5, escala: 0.6 } as PecaConjunto) })} data-nova-peca-forma><Plus className="w-3 h-3" /> Peça (forma)</button>
        <button className={btn} onClick={() => { mudar('Nova peça', c => { c.pecas.push({ id: gid(), nome: 'Imagem', tipo: 'impressa', cor: '#ffffff', forma: { kind: 'ellipse', params: { radius: 0, sides: 6, inner: 0.5 } }, aspect: 1, x: 0.5, y: 0.5, escala: 0.6 } as PecaConjunto) }); setEscolher({ i: n, o: 'imagem' }) }} data-nova-peca-imagem><Plus className="w-3 h-3" /> Peça (imagem)</button>
      </div>
      <div className="flex items-center gap-1" data-salvar-conjunto>
        <input value={nomePreset} onChange={e => setNomePreset(e.target.value)} placeholder="Nome (ex.: Frame escalopado)" className="flex-1 min-w-0 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px]" data-nome-preset-conjunto />
        <button className={btn} disabled={!nomePreset.trim()} onClick={() => {
          const nome = nomePreset.trim().slice(0, 60)
          const pecas = JSON.parse(JSON.stringify(cj.pecas)) as PecaConjunto[]
          usePresetsConjunto.setState(s => ({ lista: [...s.lista.filter(x => x.nome !== nome), { nome, aspect: cj.aspect ?? 1, pecas }] }))
          void sync.presets.salvar({ id: `conjunto_${nome.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`, name: nome, effects: [], owner: 'me', free: true, conjunto: { aspect: cj.aspect ?? 1, pecas: pecas as never } })
          setMsg(`Conjunto "${nome}" salvo — aparece em "Conjuntos salvos" (painel Apliques 3D), em qualquer tema.`); setNomePreset('')
        }} data-salvar-preset-conjunto><Save className="w-3 h-3" /> Salvar conjunto</button>
      </div>
      {msg && <p className="text-[10px] text-emerald-700">{msg}</p>}
    </div>
  )
}

/** Lote 10 (item 158): moldurinha numa FORMA comum (círculo, coração…) — contorna a forma, afastada da borda. */
export function MolduraNaForma({ camadaId }: { camadaId: string }) {
  return (
    <button className={btn} onClick={() => {
      let id: string | null = null
      useMaeTema.getState().aplicar('Moldurinha na forma', t => {
        const a = acharCamadaTema(t as DocTema, camadaId); if (!a) return
        id = `l_${Math.random().toString(36).slice(2, 8)}`
        a.lista.splice(a.i + 1, 0, { id, type: 'frame', name: 'Moldurinha (na forma)', alvo: camadaId, offsetMm: 2, widthMm: 0.6, dash: null, cornerMm: 0, color: '#ffffff', recortada: true } as never)
      })
      if (id) useEditor.getState().set({ camada: id })
    }} title="Bordinha dentro da forma, afastada da borda — acompanha o formato (círculo, escalope, coração)" data-moldura-na-forma><Frame className="w-3 h-3" /> Moldurinha nesta forma</button>
  )
}

/** Controle de faixa com rótulo (o Deslizador do MAE: bolinha + caixinha). Lote 14 (item 198): sempre na unidade certa. */
function Faixa({ rotulo, valor, min, max, passo, onChange, mm, pct }: { rotulo: string; valor: number; min: number; max: number; passo: number; onChange: (v: number) => void; mm?: boolean; pct?: boolean }) {
  return <label className="block text-[11px] text-gray-500">{rotulo}<Deslizador min={min} max={max} step={passo} value={valor} onChange={e => onChange(Number(e.target.value))} aria-label={rotulo} {...(mm ? { unidade: 'mm' } : pct ? { unidade: '%', fator: 100 } : {})} /></label>
}

/** Largura (mm) do conjunto na caixa clicada — ou na 1ª caixa da parte dele. 0 = sem caixa para medir. */
function larguraDoConjunto(camadaId: string, cj: Conjunto): number {
  const doc = useMaeDoc.getState().hist.atual, tema = useMaeTema.getState().hist?.atual as DocTema | undefined
  if (!tema) return 0
  const a = acharCamadaTema(tema, camadaId)
  const face = a?.faceId ?? useEditor.getState().face ?? doc.parts.find(p => p.id === a?.partId)?.instances[0]?.faceId
  const f = face ? acharFace(doc, face) : null
  if (!f) return 0
  const xs = f.face.polygonMm.map(p => p[0])
  return (Math.max(...xs) - Math.min(...xs)) * ((cj as { transform?: { scale?: number } }).transform?.scale ?? 1)
}

/** Lote 14 (item 195): EM QUAIS CAIXAS o conjunto vai (o mesmo jeito do NOME/IDADE) — marcar/desmarcar cada caixa. */
function CaixasDoConjunto({ camadaId }: { camadaId: string }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null) as DocTema | null
  const a = tema ? acharCamadaTema(tema, camadaId) : null
  if (!tema || !a?.partId) return null
  const faces = doc.parts.find(p => p.id === a.partId)?.instances.map(i => i.faceId) ?? []
  if (faces.length < 2) return null
  const nome = (f: string) => { const x = acharFace(doc, f); return x ? `${x.molde.name}${x.molde.faces.filter(y => !y.hole).length > 1 ? ` · ${f.split('_').pop()}` : ''}` : f }
  const visivel = (f: string) => (tema.localOverrides?.[f]?.[camadaId] as { visible?: boolean } | undefined)?.visible !== false
  return (
    <div className="rounded border border-gray-200 dark:border-gray-700 p-1.5 space-y-0.5" data-caixas-conjunto>
      <p className="text-[11px] font-semibold">Em quais caixas</p>
      {faces.map(f => (
        <label key={f} className="flex items-center gap-1 text-[11px]"><input type="checkbox" className="accent-orange-500" checked={visivel(f)}
          onChange={e => useMaeTema.getState().aplicar(e.target.checked ? `Conjunto na ${nome(f)}` : `Conjunto fora da ${nome(f)}`, t => { if (e.target.checked) voltarAoPadrao(t as DocTema, f, camadaId, 'visible'); else ajustarSoNaFace(t as DocTema, f, camadaId, { visible: false }) })} data-caixa-conjunto={nome(f)} /> {nome(f)}</label>
      ))}
    </div>
  )
}
