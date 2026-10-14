'use client'
'use no memo'
// Lote 14 (item 189.3): FOLHAS DO KIT — o coração das peças sob medida. Cada folha é um CARTÃO de preencher (papel,
// orientação automática, marca de registro, espaço, margem, as peças × quantidade, quantas vezes sai no kit) com a
// prévia da folha atualizando na hora, "✔ cabem até N" / "⚠ N não couberam", o gabarito/faca de corte (opcional,
// trava as posições) e o resumo "Este kit = 5 folhas impressas". A marca de registro desta base fica SÓ aqui.
// Também: AJUSTE FINO (189.4: as folhas inteiras, mover/girar/tirar, reorganizar) e PRODUTO DO SOA (189.7).
// (Base antiga de caixas com folhas: o mesmo cartão, com o grupo do produto escolhido na folha.)
import { useEffect, useRef, useState } from 'react'
import { FilePlus2, RotateCw, Trash2, Copy, ChevronUp, ChevronDown, Lock, Unlock, Upload, Plus, Printer, Wand2, Loader2 } from 'lucide-react'
import { useBiblioteca, useMaeDoc } from '@/lib/mae/editor/loja'
import { aproveitamento, criarFolha, excluirFolha, folhasDa, tamanhoPeca, vagasDoGabarito, docDaFolha, sobraNaFolha, type Folha } from '@/lib/mae/editor/folhaMontada'
import { montarFolhaDoKit, validarFolha, resumoDoKit, exemploDoPedido, pedidasDa, sincronizarKit, grupoDoKit, ehBaseMedida } from '@/lib/mae/editor/kitBase'
import { contornoDaMedida, furoDaMedida, medidaDe } from '@/lib/mae/medidas/pecas'
import { gravar } from '@/lib/mae/biblioteca/arquivos'
import { parteArquivo } from '@/lib/mae/exportar/nomes'
import { lerGabaritoDaPlotter } from './moldesEditor'
import { DocTema, type DocTrabalho } from '@/lib/mae/schema'
import { gruposDa } from '@/lib/mae/editor/grupos'
import { marcaNaFolha, zonasNaFolha } from '@/lib/mae/exportar/marca'
import { FOLHAS, medidasFolha } from '@/lib/mae/schema'
import { useMarcas, carregarMarcas, marcaDaPrancheta, adicionarMarca } from './marcasMae'
import { mensagemDeErro } from '@/lib/mae/erros'
import { LigarProduto } from './PainelGrupos'
import { useEditor } from './estado'
import type { MarcaRegistro } from './sincronia'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ib = 'inline-flex items-center rounded p-0.5 text-gray-500 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-30'
const sel = 'rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-xs'
const inpN = 'w-12 rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-right text-xs'
type Doc = DocTrabalho
const num = (s: string) => Number(String(s).replace(',', '.'))

/** As zonas da marca de registro numa folha W × H (a marca escolhida nela). */
function zonasDaFolha(f: Pick<Folha, 'registrationPresetId' | 'registrationPresetSha'>, marcas: MarcaRegistro[], w: number, h: number) {
  const m = marcaDaPrancheta(f, marcas)
  return m ? zonasNaFolha(m.zonas, marcaNaFolha(w, h, m.wMm, m.hMm, 0.6, m.ajuste), m.hMm) : []
}

/** Monta de novo a folha pelas peças pedidas (se não estiver travada) e mantém o kit do produto em dia. */
function remontar(d: Doc, id: string, marcas: MarcaRegistro[]) {
  const x = folhasDa(d).find(y => y.id === id)
  if (x && !x.travada) {
    const r = montarFolhaDoKit(x, d.molds, (w, h) => zonasDaFolha(x, marcas, w, h))
    x.widthMm = r.widthMm; x.heightMm = r.heightMm; x.pecas = r.pecas; x.origem = 'preencher'
  }
  sincronizarKit(d)
}

/** A folha desenhada: zonas da marca, as peças no formato delas (círculo, cantos, furo); fora/sobra em vermelho. */
function FolhaSvg({ f, moldes, zonas, faltando = [], grande, onMover, selecionada, onSelecionar, travada }: {
  f: Folha; moldes: Doc['molds']; zonas: { x: number; y: number; w: number; h: number }[]; faltando?: string[]; grande?: boolean
  onMover?: (i: number, x: number, y: number, juntar: string) => void; selecionada?: number | null; onSelecionar?: (i: number | null) => void; travada?: boolean
}) {
  const svg = useRef<SVGSVGElement>(null)
  const arrasto = useRef<{ i: number; dx: number; dy: number } | null>(null)
  const emMm = (e: React.PointerEvent) => { const s = svg.current; if (!s) return [0, 0]; const p = s.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(s.getScreenCTM()!.inverse()); return [q.x, q.y] }
  // peças que não couberam: em vermelho, ao lado da folha
  const ladoW = faltando.length ? 50 : 0
  const forma = (m: Doc['molds'][number], x: number, y: number, rot: number) => {
    const med = medidaDe(m)
    if (!med) { const t = tamanhoPeca(m, rot as 0 | 90); return <rect x={x} y={y} width={t.w} height={t.h} /> }
    const giro = (p: [number, number]): [number, number] => (rot === 90 ? [med.alturaMm - p[1], p[0]] : p)
    const pts = contornoDaMedida(med).map(p => giro(p as [number, number]))
    const furo = furoDaMedida(med)?.map(p => giro(p as [number, number]))
    const d = (ps: [number, number][]) => `M${ps.map(([a, b]) => `${(x + a).toFixed(2)},${(y + b).toFixed(2)}`).join('L')}Z`
    return <path d={d(pts) + (furo ? d(furo) : '')} fillRule="evenodd" />
  }
  return (
    <svg ref={svg} viewBox={`0 0 ${f.widthMm + ladoW} ${f.heightMm}`} className={`w-full rounded border border-gray-300 bg-white touch-none ${grande ? '' : 'max-h-56'}`} style={{ aspectRatio: `${f.widthMm + ladoW} / ${f.heightMm}` }} data-previa-folha={f.nome}
      onPointerMove={e => { const a = arrasto.current; if (!a || !onMover || travada) return; const [x, y] = emMm(e); onMover(a.i, Math.round((x - a.dx) * 2) / 2, Math.round((y - a.dy) * 2) / 2, `folha:mover:${f.id}:${a.i}`) }}
      onPointerUp={() => { arrasto.current = null }} onPointerLeave={() => { arrasto.current = null }} onPointerDown={() => onSelecionar?.(null)}>
      <rect x={0} y={0} width={f.widthMm} height={f.heightMm} fill="#fff" stroke="#cbd5e1" strokeWidth={0.6} />
      {zonas.map((z, i) => <rect key={`z${i}`} x={z.x} y={z.y} width={z.w} height={z.h} fill="#94a3b8" opacity={0.35} />)}
      {f.pecas.map((p, i) => {
        const m = moldes.find(x => x.id === p.moldeId); if (!m) return null
        const t = tamanhoPeca(m, p.rot as 0 | 90)
        const fora = p.xMm < -0.01 || p.yMm < -0.01 || p.xMm + t.w > f.widthMm + 0.01 || p.yMm + t.h > f.heightMm + 0.01
        return (
          <g key={i} fill={fora ? '#fecaca' : '#ffedd5'} stroke={fora ? '#dc2626' : selecionada === i ? '#ea580c' : '#fb923c'} strokeWidth={selecionada === i ? 0.8 : 0.4}
            onPointerDown={e => { if (!onMover) return; e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); const [x, y] = emMm(e); arrasto.current = { i, dx: x - p.xMm, dy: y - p.yMm }; onSelecionar?.(i) }}
            style={{ cursor: onMover && !travada ? 'move' : 'default' }} data-peca-na-folha={i}>
            {forma(m, p.xMm, p.yMm, p.rot)}
          </g>
        )
      })}
      {faltando.map((nome, i) => <g key={`f${i}`} data-peca-faltando><rect x={f.widthMm + 6} y={4 + i * 9} width={40} height={7} fill="#fee2e2" stroke="#dc2626" strokeWidth={0.4} /><text x={f.widthMm + 8} y={9 + i * 9} fontSize={4} fill="#991b1b">{nome.slice(0, 18)}</text></g>)}
    </svg>
  )
}

/** As peças pedidas que ficaram de fora da folha (nome repetido por peça). */
function faltandoDa(f: Folha, moldes: Doc['molds']): string[] {
  if (f.travada) return []
  const out: string[] = []
  for (const p of pedidasDa(f)) {
    const n = p.qtd - f.pecas.filter(x => x.moldeId === p.moldeId).length
    const nome = moldes.find(m => m.id === p.moldeId)?.name ?? 'peça'
    for (let i = 0; i < n && out.length < 20; i++) out.push(nome)
  }
  return out
}

export default function PainelFolhas() {
  const doc = useMaeDoc(s => s.hist.atual)
  const aplicar = useMaeDoc.getState().aplicar
  const marcas = useMarcas(s => s.marcas)
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  useEffect(() => { if (raiz && liberada && !useMarcas.getState().carregado) carregarMarcas(raiz).catch(() => null) }, [raiz, liberada])
  const folhas = folhasDa(doc)
  const medida = ehBaseMedida(doc)
  const kit = grupoDoKit(doc)
  const [aviso, setAviso] = useState<string | null>(null)
  const nova = () => {
    const m = medidasFolha('A4', 'retrato')
    const pecas = doc.molds.filter(x => x.source.kind === 'medida').slice(0, 1)
    aplicar('Nova folha do kit', d => {
      const id = criarFolha(d, { nome: `Folha ${folhasDa(d).length + 1}`, ...m })
      const f = folhasDa(d).find(x => x.id === id)!
      f.orientacao = 'auto'; f.impressoes = 1
      if (pecas[0]) f.pedidas = [{ moldeId: pecas[0].id, qtd: 999 }]
      remontar(d, id, marcas)
      // "o máximo que cabe" vira o número que coube (a usuária ajusta)
      if (f.pedidas?.[0]) f.pedidas[0].qtd = Math.max(1, f.pecas.length)
      sincronizarKit(d)
    })
  }
  return (
    <section className="space-y-2" data-painel-folhas>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{medida ? 'Folhas do kit' : 'Folhas de impressão'}</h2>
        <button className={btn} onClick={nova} data-nova-folha><FilePlus2 className="w-3.5 h-3.5" /> Adicionar folha</button>
      </div>
      <p className="text-[11px] text-gray-500">Cada folha: as peças que ela leva e quantas vezes sai no kit. O MAE distribui na folha (fora da marca de registro) — ou siga o seu gabarito/faca de corte.</p>
      {aviso && <p className="text-[11px] text-amber-700" data-aviso-folhas>{aviso}</p>}
      {!folhas.length && <p className="text-[11px] text-gray-400">Nenhuma folha ainda. {medida && !doc.molds.length ? 'Comece pelas Peças.' : ''}</p>}
      {folhas.map((f, i) => <CartaoFolha key={f.id} f={f} i={i} total={folhas.length} medida={medida} setAviso={setAviso} />)}
      {medida && folhas.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1 text-[11px]" data-resumo-kit>
          <p className="font-semibold">Como o pedido conta</p>
          <label className="flex items-start gap-1.5"><input type="radio" className="accent-orange-500 mt-0.5" checked={(kit?.contagem ?? (folhas.length === 1 ? 'pecas' : 'kit')) === 'kit'} onChange={() => aplicar('Pedido conta por kit', d => { sincronizarKit(d); const g = grupoDoKit(d); if (g) g.contagem = 'kit' })} data-contagem="kit" /><span><b>1 unidade no pedido = 1 kit</b> (qtd 2 = 2 kits)</span></label>
          <label className="flex items-start gap-1.5"><input type="radio" className="accent-orange-500 mt-0.5" checked={(kit?.contagem ?? (folhas.length === 1 ? 'pecas' : 'kit')) === 'pecas'} onChange={() => aplicar('Pedido conta por peças', d => { sincronizarKit(d); const g = grupoDoKit(d); if (g) g.contagem = 'pecas' })} data-contagem="pecas" /><span><b>O pedido vem em quantidade de peças</b> (a Shopee manda 96 tags → 96 ÷ {folhas[0].pecas.length || '…'} por folha = {folhas[0].pecas.length ? Math.ceil(96 / folhas[0].pecas.length) : '…'} folhas)</span></label>
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-100" data-resumo-kit-texto>{resumoDoKit(folhas)}</p>
        </div>
      )}
    </section>
  )
}

function CartaoFolha({ f, i, total, medida, setAviso }: { f: Folha; i: number; total: number; medida: boolean; setAviso: (s: string | null) => void }) {
  const doc = useMaeDoc(s => s.hist.atual)
  const aplicar = useMaeDoc.getState().aplicar
  const marcas = useMarcas(s => s.marcas)
  const raiz = useBiblioteca(s => s.raiz)
  const [testando, setTestando] = useState(false)
  const mudar = (label: string, g: (x: Folha, d: Doc) => void, remonta = true, j?: string) => aplicar(label, d => { const x = folhasDa(d).find(y => y.id === f.id); if (!x) return; g(x, d); if (remonta) remontar(d, f.id, marcas) }, j)
  const zonas = zonasDaFolha(f, marcas, f.widthMm, f.heightMm)
  const pedidas = pedidasDa(f)
  const travada = !!f.travada
  const ap = aproveitamento(f, doc.molds)
  const ficaram = travada ? 0 : Math.max(0, pedidas.reduce((s, p) => s + p.qtd, 0) - f.pecas.length)
  // "cabem até N" (um tipo de peça só) — conta com a mesma orientação/espaço/margem da folha
  const cabemAte = !travada && pedidas.length === 1 ? montarFolhaDoKit({ ...f, pedidas: [{ moldeId: pedidas[0].moldeId, qtd: 999 }] }, doc.molds, (w, h) => zonasDaFolha(f, marcas, w, h)).pecas.length : null
  const avisos = validarFolha(f, doc.molds, zonas).filter(a => !/fora da folha/.test(a) || travada)
  const pecasDaBase = doc.molds
  async function importarGabarito(arq: File) {
    setAviso('Lendo o gabarito…')
    try {
      const g = await lerGabaritoDaPlotter(arq)
      // Lote 14 (item 187): as vagas ficam com as peças desta folha (e as que têm parte no tema) — nunca uma peça solta
      const comParte = new Set(doc.parts.flatMap(p => p.instances.map(x => x.faceId)))
      const preferir = new Set([...pedidas.map(p => p.moldeId), ...doc.molds.filter(m => m.faces.some(x => comParte.has(x.id))).map(m => m.id)])
      const r = vagasDoGabarito(g.contornos, doc.molds, preferir)
      if (!r.pecas.length) { setAviso('Nenhuma forma do arquivo bate com as peças desta base (confira a medida das peças em Peças).'); return }
      let faca: string | undefined
      if (raiz) { faca = `Folhas de impressão/${parteArquivo(f.nome, 40) || 'folha'}-faca.${arq.name.split('.').pop()?.toLowerCase() ?? 'svg'}`; await gravar(raiz, faca, arq).catch(() => { faca = undefined }) }
      const cont = new Map<string, number>(); for (const p of r.pecas) cont.set(p.moldeId, (cont.get(p.moldeId) ?? 0) + 1)
      mudar('Gabarito / faca de corte', x => { x.widthMm = g.wMm; x.heightMm = g.hMm; x.pecas = r.pecas; x.travada = true; x.origem = 'importado'; x.pedidas = [...cont].map(([moldeId, qtd]) => ({ moldeId, qtd })); if (faca) x.faca = faca }, false)
      aplicar('Kit', d => sincronizarKit(d))
      setAviso(`Gabarito: ${r.pecas.length} posições exatamente como no arquivo (travado)${r.ignorados ? ` — ${r.ignorados} forma(s) sem peça da mesma medida ficaram de fora (marcas, textos ou uma peça que falta em Peças)` : ''}.${faca ? ` O arquivo de corte é o próprio gabarito: ${faca}.` : ''}`)
    } catch (e) { setAviso(`Não consegui ler o gabarito: ${mensagemDeErro(e)}`) }
  }
  /** 189.9: folha de TESTE DE CORTE — só os contornos e a marca (conferir na plotter/faca antes da arte). */
  async function imprimirTeste() {
    if (!raiz) return
    setTestando(true); setAviso(null)
    try {
      const { exportar } = await import('./exportarMae')
      const tema = DocTema.parse({ schemaVersion: 1, type: 'theme', id: 'teste_corte', version: 1, baseId: doc.id, baseVersion: doc.version, partContent: {}, name: 'Teste de corte' })
      const v = docDaFolha(doc, tema, f)
      const r = await exportar({ raiz, doc: v.doc, tema: v.tema, identidade: useEditor.getState().identidade, marcas }, {
        tipo: 'impressao', aprovacao: 'folha', formato: 'pdf', agrupar: 'tudo', linhas: true, linhasOriginais: false, svg: true, dxf: true, valores: {},
        pasta: 'Folhas de impressão/Teste de corte', apliques: false, nomeArquivo: `TESTE_${parteArquivo(f.nome, 40) || 'folha'}`, fundoMarca: true,
      } as never)
      setAviso(`Folha de teste salva: ${r.arquivos.join(', ')} — imprima e corte para conferir antes da arte.`)
    } catch (e) { setAviso(`Não consegui gerar o teste: ${mensagemDeErro(e)}`) } finally { setTestando(false) }
  }
  async function novaMarca(arq: File) {
    if (!raiz) return
    try { const m = await adicionarMarca(raiz, arq); mudar('Marca da folha', x => { x.registrationPresetId = m.id; x.registrationPresetSha = m.sha256 }) } catch (e) { setAviso(mensagemDeErro(e)) }
  }
  const papelAtual = (Object.keys(FOLHAS) as (keyof typeof FOLHAS)[]).find(k => { const m = FOLHAS[k]; return Math.abs(Math.min(f.widthMm, f.heightMm) - m.widthMm) < 1 && Math.abs(Math.max(f.widthMm, f.heightMm) - m.heightMm) < 1 }) ?? 'personalizado'
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5 text-[11px]" data-cartao-folha={f.nome}>
      <div className="flex items-center gap-1">
        <input defaultValue={f.nome} key={`n${f.id}`} onBlur={e => { const v = e.target.value.trim().slice(0, 80); if (v && v !== f.nome) mudar('Nome da folha', x => { x.nome = v }, false) }} className={sel + ' flex-1 min-w-0 font-semibold'} data-nome-folha />
        <button className={ib} disabled={i === 0} onClick={() => aplicar('Subir folha', d => { const l = folhasDa(d); [l[i - 1], l[i]] = [l[i], l[i - 1]]; sincronizarKit(d) })} aria-label="Subir a folha"><ChevronUp className="w-3.5 h-3.5" /></button>
        <button className={ib} disabled={i === total - 1} onClick={() => aplicar('Descer folha', d => { const l = folhasDa(d); [l[i + 1], l[i]] = [l[i], l[i + 1]]; sincronizarKit(d) })} aria-label="Descer a folha"><ChevronDown className="w-3.5 h-3.5" /></button>
        <button className={btn + ' !px-1.5'} onClick={() => aplicar('Duplicar folha', d => { const l = folhasDa(d); const x = l.find(y => y.id === f.id); if (!x) return; const c = JSON.parse(JSON.stringify(x)) as Folha; c.id = 'fm_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3); c.nome = `${x.nome} (cópia)`.slice(0, 80); l.splice(l.indexOf(x) + 1, 0, c); sincronizarKit(d) })} title="Duplicar" data-duplicar-folha><Copy className="w-3 h-3" /></button>
        <button className={btn + ' !px-1.5'} onClick={() => { if (confirm(`Excluir a ${f.nome}?`)) aplicar('Excluir folha', d => { excluirFolha(d, f.id); sincronizarKit(d) }) }} title="Excluir" data-excluir-folha><Trash2 className="w-3 h-3" /></button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        Papel
        <select className={sel} value={papelAtual} disabled={travada} onChange={e => { const v = e.target.value; if (v === 'personalizado') { const r = prompt('Largura × altura da folha (mm), ex.: 300 x 200', `${Math.round(f.widthMm)} x ${Math.round(f.heightMm)}`); const [w, h] = (r ?? '').split(/\s*[x×]\s*/).map(num); if (w > 20 && h > 20 && w < 2000 && h < 2000) mudar('Tamanho da folha', x => { x.widthMm = w; x.heightMm = h }); return } const m = medidasFolha(v as keyof typeof FOLHAS, f.widthMm > f.heightMm ? 'paisagem' : 'retrato'); mudar('Papel da folha', x => { x.widthMm = m.widthMm; x.heightMm = m.heightMm }) }} data-papel-folha>
          {(Object.keys(FOLHAS) as string[]).map(k => <option key={k} value={k}>{k}</option>)}<option value="personalizado">{papelAtual === 'personalizado' ? `${Math.round(f.widthMm)} × ${Math.round(f.heightMm)} mm` : 'Personalizado…'}</option>
        </select>
        Orientação
        <select className={sel} value={f.orientacao ?? 'auto'} disabled={travada} onChange={e => mudar('Orientação da folha', x => { x.orientacao = e.target.value as 'auto' })} data-orientacao-folha>
          <option value="auto">Automática</option><option value="retrato">Retrato</option><option value="paisagem">Paisagem</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        Marca de registro
        <select className={sel + ' max-w-[10rem]'} value={f.registrationPresetId ?? ''} onChange={e => { const m = marcas.find(x => x.id === e.target.value); mudar('Marca da folha', x => { if (m) { x.registrationPresetId = m.id; x.registrationPresetSha = m.sha256 } else { delete x.registrationPresetId; delete x.registrationPresetSha } }) }} data-marca-folha>
          <option value="">Sem marca</option>{marcas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <label className={btn + ' cursor-pointer !py-0.5'} title="O PDF da marca do Silhouette/Cricut/Brother — entra na lista geral de marcas"><Plus className="w-3 h-3" /> Adicionar nova<input type="file" accept=".pdf" className="hidden" onChange={e => { const a = e.target.files?.[0]; if (a) void novaMarca(a); e.target.value = '' }} data-nova-marca-folha /></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1">Espaço entre peças <input type="text" inputMode="decimal" defaultValue={String(f.espacoMm).replace('.', ',')} key={`e${f.id}:${f.espacoMm}`} disabled={travada} onBlur={e => { const v = num(e.target.value); if (v >= 0 && v <= 50 && v !== f.espacoMm) mudar('Espaço entre as peças', x => { x.espacoMm = v }) }} className={inpN} data-espaco-folha /> mm</label>
        <label className="flex items-center gap-1">Margem da folha <input type="text" inputMode="decimal" defaultValue={String(f.margemMm).replace('.', ',')} key={`m${f.id}:${f.margemMm}`} disabled={travada} onBlur={e => { const v = num(e.target.value); if (v >= 0 && v <= 50 && v !== f.margemMm) mudar('Margem da folha', x => { x.margemMm = v }) }} className={inpN} data-margem-folha /> mm</label>
      </div>
      <div className="space-y-0.5" data-pecas-da-folha>
        <p className="font-semibold">Peças nesta folha</p>
        {pedidas.map((p, k) => (
          <div key={`${p.moldeId}:${k}`} className="flex items-center gap-1">
            <select className={sel + ' flex-1 min-w-0'} value={p.moldeId} disabled={travada} onChange={e => mudar('Peça da folha', x => { x.pedidas = pedidasDa(x).map((q, j) => (j === k ? { ...q, moldeId: e.target.value } : q)) })} data-peca-pedida={k}>
              {pecasDaBase.map(m => <option key={m.id} value={m.id}>{m.name} ({Math.round(tamanhoPeca(m, 0).w)}×{Math.round(tamanhoPeca(m, 0).h)})</option>)}
            </select>
            <input type="text" inputMode="numeric" defaultValue={p.qtd} key={`q${p.moldeId}:${p.qtd}`} disabled={travada} onBlur={e => { const v = Math.max(1, Math.min(999, parseInt(e.target.value.replace(/\D/g, '') || '1'))); if (v !== p.qtd) mudar('Quantidade na folha', x => { x.pedidas = pedidasDa(x).map((q, j) => (j === k ? { ...q, qtd: v } : q)) }) }} className={inpN} aria-label="Quantidade" data-qtd-pedida={k} />
            <button className={ib} disabled={travada} onClick={() => mudar('Tirar peça da folha', x => { x.pedidas = pedidasDa(x).filter((_, j) => j !== k) })} aria-label="Tirar"><Trash2 className="w-3 h-3" /></button>
          </div>
        ))}
        {!travada && pecasDaBase.length > 0 && <button className={btn + ' !py-0.5'} onClick={() => mudar('Peça na folha', x => { const usados = new Set(pedidasDa(x).map(q => q.moldeId)); const m = pecasDaBase.find(mm => !usados.has(mm.id)) ?? pecasDaBase[0]; x.pedidas = [...pedidasDa(x), { moldeId: m.id, qtd: 1 }] })} data-adicionar-peca-folha><Plus className="w-3 h-3" /> Adicionar peça</button>}
        {!pecasDaBase.length && <p className="text-gray-400">Crie as peças na etapa Peças.</p>}
      </div>
      {medida && <label className="flex items-center gap-1">Impressões desta folha no kit <input type="text" inputMode="numeric" defaultValue={f.impressoes ?? 1} key={`i${f.id}:${f.impressoes}`} onBlur={e => { const v = Math.max(1, Math.min(50, parseInt(e.target.value.replace(/\D/g, '') || '1'))); if (v !== (f.impressoes ?? 1)) mudar('Impressões da folha', x => { x.impressoes = v }, false) }} className={inpN} data-impressoes-folha /></label>}
      <p className={`font-semibold ${ficaram ? 'text-amber-700' : 'text-emerald-700'}`} data-status-folha>
        {ficaram
          ? `⚠ ${ficaram} peça(s) não couberam: diminua a quantidade, troque o papel ou ajuste na etapa Ajuste fino`
          : `✔ ${ap.pecas} peça${ap.pecas === 1 ? '' : 's'}${cabemAte !== null ? ` · cabem até ${cabemAte}` : ''} · ${ap.pct}% da folha${travada ? ' · gabarito travado' : ''}`}
      </p>
      {avisos.map(a => <p key={a} className="text-amber-700" data-validacao-folha>⚠ {a}</p>)}
      <FolhaSvg f={f} moldes={doc.molds} zonas={zonas} faltando={faltandoDa(f, doc.molds)} />
      <div className="rounded border border-orange-200 bg-orange-50/40 dark:bg-orange-950/20 p-1.5 space-y-1" data-gabarito>
        <div className="flex flex-wrap items-center gap-1">
          <b>Gabarito / faca de corte</b> <span className="text-gray-500">(opcional)</span>
          {travada && <button className={btn + ' ml-auto !py-0.5'} onClick={() => { if (confirm('Destravar? Se a plotter ou a faca cortam com um arquivo fixo, mexer nas posições quebra o corte.')) mudar('Destravar gabarito', x => { x.travada = false }, false) }} data-travar-gabarito><Unlock className="w-3 h-3" /> Destravar</button>}
        </div>
        <label className={btn + ' cursor-pointer !py-0.5'} title="As posições ficam idênticas ao arquivo (travadas); o mesmo arquivo é o de corte">
          <Upload className="w-3 h-3" /> Enviar arquivo
          <input type="file" accept=".svg,.dxf,.pdf" className="hidden" onChange={e => { const a = e.target.files?.[0]; if (a) void importarGabarito(a); e.target.value = '' }} data-importar-gabarito />
        </label>
        <p className="text-gray-500">Aceita: SVG, PDF, DXF (o arquivo da plotter ou da faca). Sem gabarito, o MAE distribui sozinho, em grade.{travada ? <> <Lock className="inline w-3 h-3" /> Travado{f.faca ? `: ${f.faca}` : ''}.</> : null}</p>
        <p className="text-gray-500">Sangria de cada peça: {sobraNaFolha(doc, f).toLocaleString('pt-BR')} mm (no máximo metade do espaço até a vizinha).</p>
      </div>
      <div className="flex flex-wrap gap-1">
        <button className={btn} disabled={!raiz || !f.pecas.length || testando} onClick={() => void imprimirTeste()} title="Só os contornos e a marca de registro — confira o corte na plotter ou na faca antes de imprimir com arte" data-imprimir-teste>{testando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Printer className="w-3 h-3" />} Imprimir teste de corte</button>
        {!travada && <button className={btn} onClick={() => mudar('Reorganizar a folha', () => { /* remontar faz */ })} title="Volta à distribuição automática do MAE" data-reorganizar-folha><Wand2 className="w-3 h-3" /> Reorganizar</button>}
      </div>
      {/* base antiga de caixas com folhas: o produto (grupo) que sai nesta folha */}
      {!medida && (
        <label className="block text-gray-600">Produto (grupo) que sai nesta folha
          <select className={sel + ' w-full mt-0.5'} value={gruposDa(doc).find(g => g.folhaId === f.id || g.folhas?.includes(f.id))?.id ?? ''} onChange={e => aplicar('Grupo da folha', d => { for (const g of gruposDa(d)) { if (g.folhaId === f.id) delete g.folhaId; if (g.folhas?.includes(f.id)) g.folhas = g.folhas.filter(x => x !== f.id); if (g.id === e.target.value) g.folhas = [...(g.folhas ?? (g.folhaId ? [g.folhaId] : [])), f.id] } })} data-grupo-folha>
            <option value="">— nenhum (crie grupos em Grupos de produto) —</option>
            {gruposDa(doc).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}

/** 189.4: AJUSTE FINO — as folhas inteiras; arrastar, girar 90°, tirar; reorganizar; cadeado com gabarito. */
export function PainelAjusteFino() {
  const doc = useMaeDoc(s => s.hist.atual)
  const aplicar = useMaeDoc.getState().aplicar
  const marcas = useMarcas(s => s.marcas)
  const [sel, setSel] = useState<{ f: string; i: number } | null>(null)
  const folhas = folhasDa(doc)
  const mudar = (fid: string, label: string, g: (x: Folha) => void, j?: string) => aplicar(label, d => { const x = folhasDa(d).find(y => y.id === fid); if (x) g(x) }, j)
  return (
    <section className="space-y-2" data-painel-ajuste>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ajuste fino</h2>
      <p className="text-[11px] text-gray-500">Opcional. Arraste as peças, gire 90° ou tire; &ldquo;Reorganizar automaticamente&rdquo; volta à grade do MAE.</p>
      {!folhas.length && <p className="text-[11px] text-gray-400">Monte as folhas em Folhas do kit.</p>}
      {folhas.map(f => {
        const faltando = faltandoDa(f, doc.molds)
        const s = sel?.f === f.id ? sel.i : null
        return (
          <div key={f.id} className="space-y-1" data-ajuste-folha={f.nome}>
            <div className="flex flex-wrap items-center gap-1 text-[11px]">
              <b className="flex-1">{f.nome}</b>
              {f.travada
                ? <><span className="text-emerald-700"><Lock className="inline w-3 h-3" /> travada (gabarito)</span><button className={btn + ' !py-0.5'} onClick={() => { if (confirm('Destravar o gabarito? A plotter/faca corta com o arquivo fixo.')) mudar(f.id, 'Destravar gabarito', x => { x.travada = false }) }}><Unlock className="w-3 h-3" /> destravar</button></>
                : <button className={btn + ' !py-0.5'} onClick={() => aplicar('Reorganizar automaticamente', d => remontar(d, f.id, marcas))} data-reorganizar-auto><Wand2 className="w-3 h-3" /> Reorganizar automaticamente</button>}
            </div>
            {faltando.length > 0 && <p className="text-[11px] text-red-700" data-alarme-fora>⚠ {faltando.length} peça(s) fora da folha: diminua a quantidade em Folhas do kit, ou troque o papel.</p>}
            <FolhaSvg f={f} moldes={doc.molds} zonas={zonasDaFolha(f, marcas, f.widthMm, f.heightMm)} faltando={faltando} grande travada={!!f.travada} selecionada={s}
              onSelecionar={i => setSel(i === null ? null : { f: f.id, i })}
              onMover={(i, x, y, j) => mudar(f.id, 'Mover peça', z => { const p = z.pecas[i]; if (p) { p.xMm = x; p.yMm = y } }, j)} />
            {s !== null && f.pecas[s] && !f.travada && (
              <div className="flex gap-1">
                <button className={btn} onClick={() => mudar(f.id, 'Girar peça 90°', x => { const p = x.pecas[s]; if (p) p.rot = p.rot === 90 ? 0 : 90 })} data-girar-peca><RotateCw className="w-3.5 h-3.5" /> Girar 90°</button>
                <button className={btn} onClick={() => { mudar(f.id, 'Tirar peça', x => { x.pecas.splice(s, 1) }); setSel(null) }} data-tirar-peca><Trash2 className="w-3.5 h-3.5" /> Tirar</button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** 189.7: PRODUTO DO SOA do kit + como o pedido vai sair. */
export function PainelProdutoKit() {
  const doc = useMaeDoc(s => s.hist.atual)
  const aplicar = useMaeDoc.getState().aplicar
  const g = grupoDoKit(doc)
  const folhas = folhasDa(doc)
  const contagem = g?.contagem ?? (folhas.length === 1 ? 'pecas' : 'kit')
  const nomePeca = (doc.molds.find(m => m.id === folhas[0]?.pecas[0]?.moldeId)?.name ?? 'peças').toLowerCase()
  return (
    <section className="space-y-2" data-painel-produto-kit>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Produto do SOA</h2>
      <p className="text-[11px] text-gray-500">O produto do SOA (ex.: Kit etiqueta escolar, Tags de agradecimento) que sai neste kit.</p>
      {g ? <div className="text-[11px]"><LigarProduto g={g} /></div>
        : <button className={btn} onClick={() => aplicar('Kit do produto', d => sincronizarKit(d))} data-comecar-produto>Ligar a um produto</button>}
      {!g?.produtoId && !g?.produtoNome && <p className="text-[11px] text-amber-700" data-sem-produto>⚠ Sem produto ligado: os pedidos não acham esta base.</p>}
      {folhas.length > 0 && <p className="text-xs font-semibold" data-exemplo-pedido>Como o pedido vai sair: {exemploDoPedido(folhas, contagem, nomePeca)}.</p>}
    </section>
  )
}
