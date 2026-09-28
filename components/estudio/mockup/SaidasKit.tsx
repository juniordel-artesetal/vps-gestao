'use client'
// SOA Design — SAÍDAS DO KIT (Fase 5): marcar kit completo · outras composições · cada caixa individual × cenas (várias)
// × presets de exportação (vários, cada um com seus tamanhos/qualidade/formato). Toda saída REFERENCIA as mesmas caixas
// vivas (nada é duplicado): o motor renderiza cada caixa uma vez e reaproveita em todos os kits/cenas/tamanhos; a fila
// só cobra e desenha o que não está no cache (hash das dependências).
'use no memo'
import { useEffect, useState } from 'react'
import { Layers, Check } from 'lucide-react'
import { naCena, PRESETS_EXPORT_PADRAO, type MotorKit, type KitTemplate, type Composicao, type ExportPreset, type PosicaoSlot } from '@/lib/estudio/kitMotor'
import { CENAS_PRONTAS, cenaPronta } from '@/lib/estudio/cenasProntas'
import { criarJob, custo, assinar } from '@/lib/estudio/filaMockups'
import { hashTexto } from '@/lib/estudio/matcher'
import { blobDe, carregarImagem, nomeArquivo } from '@/lib/estudio/mockup'
import { Autorizador, SemCota, exigirSaldo } from '@/lib/estudio/cliente'
import { gravarSaidas, type SaidaMarcada } from '@/lib/estudio/kitCriar'
import type { BoxInstancia } from '@/lib/estudio/caixaViva'
import type { ConfigCena } from '@/lib/estudio/mockupTipos'
import { btnP, cartao } from '../caixas/comum'

export interface TemaSaida {
  chave: string; tema: string; projetoId?: string | null
  caixas: Record<string, BoxInstancia | undefined>
  /** composições que valem para ESTE tema (snapshot) + ajustes por tema */
  comps: Composicao[]; ajustes?: Record<string, Record<string, Partial<PosicaoSlot>>>
  /** antes de desenhar (lote: sobe as artes e cria as caixas/tema) */
  antes?: () => Promise<void>
}
type Salvo = { id: string; nome: string; valor: ConfigCena }
const CENAS_ESPECIAIS = [{ id: 'branco', nome: 'Fundo branco' }, { id: 'transparente', nome: 'PNG transparente' }]

export default function SaidasKit({ kit, temas, comps: comps0, presets, cenasDela, motor, gravar = true, rotulo = 'Gerar' }: { kit: KitTemplate; temas: TemaSaida[]; comps: Composicao[]; presets: ExportPreset[]; cenasDela: Salvo[]; motor: MotorKit; gravar?: boolean; rotulo?: string }) {
  const todosPresets = [...PRESETS_EXPORT_PADRAO, ...presets]
  const porNome = (a: Composicao, b: Composicao) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })
  const comps = [...comps0].sort(porNome)
  const [principal, setPrincipal] = useState(comps[0]?.id || '')
  const [incluiKit, setIncluiKit] = useState(true)
  const [outrasComps, setOutrasComps] = useState<string[]>([])
  const [individuais, setIndividuais] = useState(true)
  const [cenas, setCenas] = useState<string[]>([])
  const [presetIds, setPresetIds] = useState<string[]>([PRESETS_EXPORT_PADRAO[0].id])
  const [altura, setAltura] = useState(0.72)
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [, setV] = useState(0)
  useEffect(() => assinar(() => setV(v => v + 1)), [])
  useEffect(() => { if (!principal && comps[0]) Promise.resolve().then(() => setPrincipal(comps[0].id)) }, [comps, principal])

  const cenaCfg = (id: string): ConfigCena | null => id === 'transparente' ? null : id === 'branco' ? cenaPronta('liso-branco')!.cena : cenaPronta(id)?.cena || cenasDela.find(c => c.id === id)?.valor || cenaPronta('liso-branco')!.cena
  const nomeCena = (id: string) => CENAS_ESPECIAIS.find(c => c.id === id)?.nome || cenaPronta(id)?.nome || cenasDela.find(c => c.id === id)?.nome || id
  // monta a lista de saídas (receitas) — mesma lista para todos os temas
  type Item = { id: string; rotulo: string; arquivo: string; chave: string; tema: TemaSaida; tipo: SaidaMarcada['tipo']; slotId?: string; comp?: Composicao; cenaId: string; W: number; H: number; fmt: 'jpg' | 'png'; q: number }
  function montar(): { itens: Item[]; marcadas: SaidaMarcada[] } {
    const itens: Item[] = [], marcadas: SaidaMarcada[] = []
    const selPresets = todosPresets.filter(p => presetIds.includes(p.id))
    for (const t of temas) {
      const compsT = (t.comps.length ? [...t.comps] : comps).sort(porNome)
      for (const pr of selPresets) {
        const cenasUsadas = cenas.length ? cenas : [pr.cenaDefault || 'branco']
        const saidas: { tipo: SaidaMarcada['tipo']; comp?: Composicao; slotId?: string; nome: string }[] = []
        const cp = compsT.find(c => c.id === principal) || compsT[0]
        if (incluiKit && cp && pr.outputsIncluidos.includes('kit')) saidas.push({ tipo: 'kit', comp: cp, nome: 'kit' })
        for (const id of outrasComps) { const c = compsT.find(x => x.id === id); if (c && c.id !== cp?.id && pr.outputsIncluidos.includes('composicao')) saidas.push({ tipo: 'composicao', comp: c, nome: `kit_${nomeArquivo(c.nome)}` }) }
        if (individuais && pr.outputsIncluidos.includes('individual')) for (const s of [...kit.slots].sort((a, b) => a.order - b.order)) if (t.caixas[s.id]) saidas.push({ tipo: 'individual', slotId: s.id, nome: nomeArquivo(s.name) })
        for (const sd of saidas) for (const cid of cenasUsadas) for (const tam of pr.tamanhos) {
          const fmt: 'jpg' | 'png' = cid === 'transparente' ? 'png' : pr.formato
          const dep = sd.tipo === 'individual' ? motor.hashCaixa(t.caixas[sd.slotId!]!) : motor.hashKit(sd.comp!, t.ajustes?.[sd.comp!.id], t.caixas)
          const chave = hashTexto(JSON.stringify(['saida-v1', dep, cid, cid.startsWith('liso') || cenaPronta(cid) || cid === 'branco' || cid === 'transparente' ? '' : JSON.stringify(cenasDela.find(c => c.id === cid)?.valor || ''), tam.largura, tam.altura, fmt, pr.qualidade, altura]))
          const pasta = `${nomeArquivo(t.tema)}/${nomeArquivo(pr.nome)}`
          itens.push({ id: `${t.chave}|${pr.id}|${sd.tipo}|${sd.slotId || sd.comp?.id}|${cid}|${tam.largura}x${tam.altura}`, rotulo: `${t.tema} · ${sd.nome} · ${nomeCena(cid)} · ${pr.nome} ${tam.largura}×${tam.altura}`, arquivo: `${pasta}/${nomeArquivo(t.tema)}_${sd.nome}_${nomeArquivo(nomeCena(cid))}_${tam.largura}x${tam.altura}.${fmt}`, chave, tema: t, tipo: sd.tipo, slotId: sd.slotId, comp: sd.comp, cenaId: cid, W: tam.largura, H: tam.altura, fmt, q: pr.qualidade })
        }
        if (t === temas[0]) for (const sd of saidas) for (const cid of cenasUsadas) if (!marcadas.some(m => m.tipo === sd.tipo && m.slotId === sd.slotId && m.composicaoId === sd.comp?.id && m.cenaId === cid)) marcadas.push({ tipo: sd.tipo, slotId: sd.slotId, composicaoId: sd.comp?.id, cenaId: cid })
      }
    }
    return { itens, marcadas }
  }
  const { itens } = montar()
  const novas = custo(itens.map(i => i.chave))

  async function gerar() {
    setErro(''); setAviso('')
    const { itens: lista, marcadas } = montar()
    if (!lista.length) { setErro('Marque pelo menos uma saída e um preset.'); return }
    try { await exigirSaldo(custo(lista.map(i => i.chave))) } catch (e) { setErro((e as Error).message); return }
    const imgs = new Map<string, HTMLImageElement>()
    for (const c of cenasDela) if (c.valor.fundo.tipo === 'foto' && cenas.includes(c.id)) { const im = await carregarImagem(c.valor.fundo.url).catch(() => null); if (im) imgs.set(c.valor.fundo.url, im) }
    const porId = new Map(lista.map(i => [i.id, i]))
    criarJob({
      nome: `${kit.nome} · ${temas.length} tema(s) · ${lista.length} imagem(ns)`, nomeZip: `${nomeArquivo(kit.nome)}-${new Date().toISOString().slice(0, 10)}.zip`,
      // salvar o PROJETO de cada tema é um item próprio (sem cota, nunca do cache): tema salvo mesmo se as imagens vierem do cache
      itens: [...temas.filter(t => t.antes).map(t => ({ id: `salvar|${t.chave}`, rotulo: `salvar o projeto “${t.tema}”`, arquivo: '', chave: `salvar:${t.chave}:${Date.now()}`, semCota: true })), ...lista.map(({ id, rotulo, arquivo, chave }) => ({ id, rotulo, arquivo, chave }))],
      autorizar: n => { const a = new Autorizador(n); return { lote: a.lote, garantir: i => a.garantir(i) } },
      ehSemCota: e => e instanceof SemCota,
      render: async it => {
        if (it.semCota) { const t = temas.find(y => `salvar|${y.chave}` === it.id)!; await t.antes!(); return [] }
        const x = porId.get(it.id)!
        const prod = x.tipo === 'individual' ? await motor.caixa(x.tema.caixas[x.slotId!]!, 'alta') : await motor.kit(x.comp!, x.tema.ajustes?.[x.comp!.id], x.tema.caixas, 'alta')
        const out = naCena(prod, cenaCfg(x.cenaId), x.W, x.H, u => imgs.get(u), { altura })
        return blobDe(out, x.fmt === 'png' ? 'image/png' : 'image/jpeg', x.q / 100)
      },
    })
    if (gravar) for (const t of temas) if (t.projetoId) gravarSaidas(t.projetoId, marcadas, presetIds.filter(p => !p.startsWith('fx-'))).catch(() => {})
    setAviso(`${lista.length} imagem(ns) na fila${lista.length - custo(lista.map(i => i.chave)) > 0 ? ` (${lista.length - custo(lista.map(i => i.chave))} já prontas no cache — não cobram)` : ''}. Acompanhe no painel da fila.`)
  }

  const chip = (on: boolean) => `text-[11px] rounded-full px-2 py-0.5 border ${on ? 'border-orange-400 bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-200' : 'border-gray-200 dark:border-gray-700'}`
  const alternar = (lista: string[], set: (v: string[]) => void, id: string) => set(lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id])
  const compsT = (temas[0]?.comps.length ? [...temas[0].comps] : comps).sort(porNome)
  return (
    <div className={`${cartao} space-y-2.5`} data-saidas-kit>
      <p className="text-sm font-semibold">Saídas <span className="font-normal text-xs text-gray-500">— tudo referencia as mesmas caixas (nada duplicado)</span></p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={incluiKit} onChange={e => setIncluiKit(e.target.checked)} data-inclui-kit /> Kit completo</label>
        <select className="border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value={principal} onChange={e => setPrincipal(e.target.value)}>{compsT.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
        {compsT.filter(c => c.id !== principal).map(c => <label key={c.id} className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={outrasComps.includes(c.id)} onChange={() => alternar(outrasComps, setOutrasComps, c.id)} data-outra-comp={c.nome} /> {c.nome}</label>)}
        <label className="inline-flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={individuais} onChange={e => setIndividuais(e.target.checked)} data-individuais /> Cada caixa individual</label>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-gray-500">Cenas <span className="text-gray-400">(várias; nenhuma = a cena do preset)</span></p>
        <div className="flex flex-wrap gap-1" data-cenas-saida>
          {[...CENAS_ESPECIAIS, ...CENAS_PRONTAS.map(c => ({ id: c.id, nome: c.nome })), ...cenasDela.map(c => ({ id: c.id, nome: c.nome }))].map(c => <button key={c.id} onClick={() => alternar(cenas, setCenas, c.id)} className={chip(cenas.includes(c.id))} data-cena-saida={c.nome}>{cenas.includes(c.id) && <Check className="inline w-3 h-3 mr-0.5" />}{c.nome}</button>)}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] text-gray-500">Presets de exportação <span className="text-gray-400">(vários de uma vez)</span></p>
        <div className="flex flex-wrap gap-1" data-presets-saida>{todosPresets.map(p => <button key={p.id} onClick={() => alternar(presetIds, setPresetIds, p.id)} className={chip(presetIds.includes(p.id))} title={`${p.tamanhos.map(t => `${t.largura}×${t.altura}`).join(', ')} · ${p.formato.toUpperCase()} ${p.qualidade}% · ${p.outputsIncluidos.join('+')}`} data-preset-saida={p.nome}>{presetIds.includes(p.id) && <Check className="inline w-3 h-3 mr-0.5" />}{p.nome}</button>)}</div>
      </div>
      <label className="block text-[11px] text-gray-500">Tamanho do conjunto na cena {Math.round(altura * 100)}%<input type="range" min={40} max={92} value={Math.round(altura * 100)} onChange={e => setAltura(Number(e.target.value) / 100)} className="w-full accent-orange-500" /></label>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={gerar} disabled={!itens.length} className={btnP} data-gerar-saidas><Layers className="w-4 h-4" /> {rotulo} {itens.length} imagem(ns)</button>
        <span className="text-[11px] text-gray-500" data-custo-saidas>{novas} nova(s) na cota{itens.length - novas ? ` · ${itens.length - novas} já prontas (cache)` : ''} · caixas desenhadas: {motor.stats.caixaRender} (cache {motor.stats.caixaCache}) · kits: {motor.stats.kitRender} (cache {motor.stats.kitCache})</span>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {aviso && <p className="text-xs text-emerald-700" data-aviso-saidas>{aviso}</p>}
    </div>
  )
}
