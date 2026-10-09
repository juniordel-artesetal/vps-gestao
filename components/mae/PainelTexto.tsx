'use client'
'use no memo'
// TEXTO DO TEMA (Sprint 7): estilizar o NOME uma vez (vale para todas as posições) — fonte local ou
// Google, cor, caixa, alinhamento, tracking, kerning, entrelinha, escala, linha de base, curva, recursos
// OpenType e o PAINEL DE GLIFOS (variações de cada letra). Valores de prévia (NOME, IDADE, hashtag) e os
// avisos do auto-ajuste. Os estilos de camada (Sprint 8) ficam logo abaixo.
import Deslizador from './Deslizador'
import { listarImagens, infoImagem, infoEmCache } from './arquivosMae'
import { useLado } from './Funcoes'
import { useEffect, useState } from 'react'
import { AlertTriangle, Type, Unlock, Loader2, Trash2 } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { ESTILO_PADRAO, type EstiloTexto } from '@/lib/mae/texto/noTexto'
import { alternativas, glifosPUA, glifosSemCodigo, glifoDoChar, svgDoGlifo, type FonteHB } from '@/lib/mae/texto/fonte'
import { prepararTexto, hashtag } from '@/lib/mae/texto/diagramar'
import type { DocTema } from '@/lib/mae/schema'
import { useFontes, listarLocais, carregarFonte, fonteCarregada, GOOGLE_FONTS } from './fontesTexto'
import { excluirSelecionado } from './excluir'
import { useEditor } from './estado'
import EditorEfeitos from './EditorEfeitos'
import { ModoDoNome, ReplicarTextos } from './TextosPaginas'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativoCls = ' !border-orange-500 bg-orange-50 text-orange-800'
const NOMES_OT: Record<string, string> = { liga: 'Ligaduras', calt: 'Alternativos contextuais', dlig: 'Ligaduras extras', swsh: 'Swash', cswh: 'Swash contextual', salt: 'Alternativos', aalt: 'Todos os alternativos', titl: 'Títulos', hist: 'Históricos', ornm: 'Ornamentos' }
const nomeOT = (t: string) => NOMES_OT[t] ?? (t.startsWith('ss') ? `Conjunto ${Number(t.slice(2))}` : t.startsWith('cv') ? `Variante ${Number(t.slice(2))}` : t)

let seq = 0
const unidadeDe = (txt: string) => { const u = txt.replace(/[-−\d.,\s]/g, ''); return u.length <= 2 ? u : null }
function Faixa({ rotulo, valor, min, max, passo, fmt, onMudar, dado }: { rotulo: string; valor: number; min: number; max: number; passo: number; fmt: (v: number) => string; onMudar: (v: number, j: string) => void; dado: string }) {
  const [id, setId] = useState(0)
  const u = unidadeDe(fmt(valor))
  return (
    <label className="block text-[10px] text-gray-500">
      {u === null
        ? <><span className="flex justify-between"><span>{rotulo}</span><span className="tabular-nums">{fmt(valor)}</span></span>
          <input type="range" min={min} max={max} step={passo} value={valor} onPointerDown={() => setId(++seq)} onChange={e => onMudar(Number(e.target.value), `${dado}:${id}`)} className="w-full h-3 accent-orange-500" data-texto-faixa={dado} /></>
        : <><span>{rotulo}</span>{u === '°' && valor !== 0 && <button type="button" className="ml-1 rounded border border-gray-200 px-1 text-[10px] text-gray-500 hover:border-orange-400" onClick={e => { e.preventDefault(); onMudar(0, `${dado}:zero:${Date.now()}`) }} title="Voltar para 0°" data-zero-giro={dado}>0°</button>}
          <Deslizador min={min} max={max} step={passo} value={valor} onPointerDown={() => setId(++seq)} onChange={e => onMudar(Number(e.target.value), `${dado}:${id}`)} unidade={u} fator={u === '%' ? 100 : 1} className="h-3 accent-orange-500" data-texto-faixa={dado} aria-label={rotulo} /></>}
    </label>
  )
}

/** Miniatura SVG de um glifo. */
function Glifo({ f, gid, ativo, onClick, titulo }: { f: FonteHB; gid: number; ativo?: boolean; onClick: () => void; titulo: string }) {
  const d = svgDoGlifo(f, gid)
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? []
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1)
  const x0 = Math.min(...xs, 0), x1 = Math.max(...xs, f.upem * 0.3), y0 = Math.min(...ys, -f.ascender), y1 = Math.max(...ys, 0)
  const m = (x1 - x0 + y1 - y0) * 0.05
  return (
    <button title={titulo} onClick={onClick} className={`w-10 h-10 rounded border bg-white ${ativo ? 'border-orange-500 ring-1 ring-orange-400' : 'border-gray-200 hover:border-orange-300'}`} data-glifo={gid}>
      <svg viewBox={`${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`} className="w-full h-full"><path d={d} fill="#1f2937" /></svg>
    </button>
  )
}

/** Texto clicado na folha (tema): tamanho, giro e "voltar ao padrão" SÓ NESTA CAIXA. */
export function TextoSoNestaCaixa() {
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const slotId = useEditor(s => s.slot)
  const t = slotId ? doc.textSlots.find(x => x.id === slotId) : null
  if (!tema || !t) return null
  const aj = tema.textSlotAdjust?.[t.id] ?? {}
  const caixa = doc.molds.find(m => m.faces.some(f => f.id === t.faceId))?.name ?? ''
  const ajustar = (label: string, f: (a: NonNullable<DocTema['textSlotAdjust']>[string]) => void, juntar?: string) => useMaeTema.getState().aplicar(`${label} (só nesta caixa)`, tt => {
    const x = tt as DocTema; x.textSlotAdjust ??= {}; f(x.textSlotAdjust[t.id] ??= {})
  }, juntar ? `slot:${t.id}:${juntar}` : undefined)
  return (
    <div className="rounded-lg border border-orange-200 p-2 space-y-1.5" data-texto-so-nesta>
      <p className="text-[11px] font-semibold">{t.variable === 'ARROBA' ? '@' : t.variable} — só nesta caixa: {caixa}</p>
      <p className="text-[10px] text-gray-400">Na folha: arraste para mover, cantos = tamanho, alça de cima = girar (Shift = 15°). Setas: ajuste fino.</p>
      <Faixa rotulo="Tamanho nesta caixa" valor={aj.scale ?? 1} min={0.3} max={2.5} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="slot-tam" onMudar={(v, j) => ajustar('Tamanho do texto', a => { a.scale = Math.round(v * 100) / 100 }, j)} />
      <Faixa rotulo="Girar nesta caixa" valor={aj.rotationDeg ?? 0} min={-180} max={180} passo={1} fmt={v => `${Math.round(v)}°`} dado="slot-giro" onMudar={(v, j) => ajustar('Girar texto', a => { a.rotationDeg = v }, j)} />
      <div className="flex flex-wrap gap-1">
        {Object.keys(aj).length > 0 && <button className={btn} onClick={() => useMaeTema.getState().aplicar('Voltar ao padrão (texto)', tt => { delete (tt as DocTema).textSlotAdjust?.[t.id] })} data-texto-padrao>Voltar ao padrão</button>}
        {/* Lote 5 (item 53): lixeira — tira o texto SÓ desta caixa (Delete faz o mesmo; Ctrl+Z desfaz) */}
        <button className={btn + ' text-red-600'} onClick={() => excluirSelecionado()} title="Excluir este texto desta caixa (Delete). As outras caixas continuam." data-excluir-texto><Trash2 className="w-3.5 h-3.5" /> Excluir desta caixa</button>
      </div>
    </div>
  )
}

export default function PainelTexto() {
  const ladoTexto = useLado()
  const doc = useMaeDoc(s => s.hist.atual)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const raiz = useBiblioteca(s => s.raiz)
  const { permissao, locais, carregando } = useFontes()
  useFontes(s => s.versao)
  const infos = useEditor(s => s.textos)
  const variaveis = [...new Set(doc.textSlots.map(s => s.variable))]
  const [variavel, setVariavel] = useState<string>(variaveis[0] ?? 'NOME')
  const [letra, setLetra] = useState<number | null>(null)
  const [modoNome, setModoNome] = useState<'simples' | 'composto'>(() => (String(useMaeTema.getState().hist?.atual.sample?.NOME ?? '').trim().split(/\s+/).length >= 2 ? 'composto' : 'simples'))
  useEffect(() => { if (permissao === 'desconhecida') void listarLocais(false) }, [permissao])
  if (!tema) return null
  const estilo: EstiloTexto = tema.textStyles?.[variavel] ?? ESTILO_PADRAO
  const fonte = fonteCarregada(estilo.font.postscriptName)
  const mudar = (label: string, f: (e: EstiloTexto) => void, juntar?: string) => useMaeTema.getState().aplicar(label, t => {
    const tt = t as DocTema
    tt.textStyles ??= {}
    if (!tt.textStyles[variavel]) tt.textStyles[variavel] = JSON.parse(JSON.stringify(ESTILO_PADRAO))
    f(tt.textStyles[variavel])
  }, juntar ? `${variavel}:${juntar}` : undefined)
  const mudarAmostra = (k: string, v: string) => useMaeTema.getState().aplicar('Prévia do texto', t => { (t as DocTema).sample = { ...(t as DocTema).sample, [k]: v } }, `amostra:${k}`)
  const valor = variavel === 'HASHTAG' ? hashtag(tema.sample?.NOME ?? '', tema.sample?.IDADE ?? '', tema.hashtag?.middle ?? 'faz') : tema.sample?.[variavel] ?? variavel
  const texto = prepararTexto(valor, estilo)
  const avisos = infos.filter(i => i.variavel === variavel && (i.aviso || i.revisar))

  async function escolherFonte(v: string) {
    const [orig, ps] = v.split('|')
    const g = GOOGLE_FONTS.find(x => x.ps === ps)
    const nova = orig === 'google' && g ? { postscriptName: g.ps, family: g.family, source: 'google' as const, url: g.url } : { postscriptName: ps, family: locais.find(l => l.ps === ps)?.family ?? ps, source: 'local' as const }
    mudar('Fonte do texto', e => { e.font = nova; e.glyphChoices = []; e.features = [] })
    const f = await carregarFonte(nova, raiz)
    // o nome técnico de verdade vem da fonte (Google às vezes difere do nome do arquivo)
    if (f && f.ps !== nova.postscriptName) mudar('Fonte do texto', e => { e.font = { ...nova, postscriptName: f.ps } })
  }
  const escolhaDa = (i: number) => estilo.glyphChoices.find(c => c.index === i)
  const escolher = (c: EstiloTexto['glyphChoices'][number] | null, i: number) => mudar('Glifo da letra', e => { e.glyphChoices = [...e.glyphChoices.filter(x => x.index !== i), ...(c ? [c] : [])] })
  // variações da letra SEM os conjuntos globais (senão um ss01 ligado esconde as outras); a escolha grava o
  // glifo exato, então vale com ou sem conjunto ligado no texto
  const alts = fonte && letra !== null && letra < texto.length ? alternativas(fonte, texto, letra, { kerning: estilo.kerning }) : []
  const pua = fonte ? glifosPUA(fonte, 120) : []
  const semCod = fonte && letra !== null ? glifosSemCodigo(fonte, 120) : []

  return (
    <div className="space-y-2" data-painel-texto>
      <h3 className="text-xs font-semibold flex items-center gap-1"><Type className="w-3.5 h-3.5" /> Textos <span className="font-normal text-gray-400">(um estilo vale para todas as posições)</span></h3>
      {!variaveis.length && <p className="text-[11px] text-gray-400">A base não tem posições de texto (passo 6 da base).</p>}
      <div className="flex flex-wrap gap-1">{variaveis.map(v => <button key={v} className={btn + (variavel === v ? ativoCls : '')} onClick={() => { setVariavel(v); setLetra(null) }} data-variavel={v}>{v}</button>)}</div>
      <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500" data-amostra>
        <label className="col-span-2">NOME (prévia)<input defaultValue={tema.sample?.NOME ?? ''} key={`n${tema.id}`} onChange={e => mudarAmostra('NOME', e.target.value)} className="w-full rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs text-gray-900" data-amostra-nome /></label>
        <label>IDADE<input defaultValue={tema.sample?.IDADE ?? ''} key={`i${tema.id}`} onChange={e => mudarAmostra('IDADE', e.target.value)} className="w-full rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs text-gray-900" /></label>
        <label className="col-span-3">Hashtag: # + nome + <input defaultValue={tema.hashtag?.middle ?? 'faz'} key={`h${tema.id}`} onChange={e => useMaeTema.getState().aplicar('Texto da hashtag', t => { (t as DocTema).hashtag = { middle: e.target.value.slice(0, 40) } }, 'hashtag')} className="w-16 rounded border border-gray-200 bg-transparent px-1 text-xs text-gray-900" data-hashtag-meio /> + idade → <b className="text-gray-700">{hashtag(tema.sample?.NOME ?? '', tema.sample?.IDADE ?? '', tema.hashtag?.middle ?? 'faz')}</b></label>
      </div>

      {/* Lote 4 (item 51): textura de papel dentro do texto (máscara de corte), estilos por cima */}
      <PreencherComPapel textura={estilo.textura} onMudar={(t, label, j) => mudar(label, e => { if (t) e.textura = t; else delete e.textura }, j)} />
      {/* Lote 4: nome simples × composto (item 50) e replicar entre as páginas (item 52) */}
      {variavel === 'NOME' && <ModoDoNome key={`modo:${variavel}`} variavel={variavel} modo={modoNome} setModo={setModoNome} />}
      <ReplicarTextos variavel={variavel} />

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-2 space-y-1.5" data-estilo-texto>
        <div className="flex items-center gap-1">
          <select value={`${estilo.font.source}|${estilo.font.postscriptName}`} onChange={e => escolherFonte(e.target.value)} className="flex-1 min-w-0 rounded border border-gray-200 bg-white dark:bg-gray-900 px-1 py-1 text-xs" data-fonte>
            <option value={`${estilo.font.source}|${estilo.font.postscriptName}`}>{estilo.font.family ?? estilo.font.postscriptName}</option>
            {locais.length > 0 && <optgroup label="Deste computador">{locais.map(l => <option key={l.ps} value={`local|${l.ps}`}>{l.family}{l.style && !/regular/i.test(l.style) ? ` ${l.style}` : ''}</option>)}</optgroup>}
            <optgroup label="Google Fonts">{GOOGLE_FONTS.map(g => <option key={g.ps} value={`google|${g.ps}`}>{g.family}</option>)}</optgroup>
          </select>
          <input type="color" value={estilo.color} onChange={e => mudar('Cor do texto', x => { x.color = e.target.value }, 'cor')} className="w-8 h-7 rounded border border-gray-200" data-cor-texto />
        </div>
        {(permissao === 'pedir' || permissao === 'desconhecida') && <button className={btn + ' w-full justify-center'} onClick={() => listarLocais(true)} data-liberar-fontes><Unlock className="w-3.5 h-3.5" /> Liberar as fontes do computador</button>}
        {permissao === 'negada' && <p className="text-[10px] text-red-600">O navegador bloqueou as fontes do computador (cadeado na barra de endereço → Fontes → Permitir).</p>}
        {carregando.length > 0 && <p className="text-[10px] text-gray-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> carregando {carregando.join(', ')}…</p>}
        <div className="flex flex-wrap gap-1">
          {([['normal', 'Aa'], ['alta', 'AA'], ['baixa', 'aa']] as const).map(([v, r]) => <button key={v} className={btn + (estilo.caixa === v ? ativoCls : '')} onClick={() => mudar('Caixa do texto', e => { e.caixa = v })} data-caixa-texto={v}>{r}</button>)}
          <span className="w-1" />
          {([['left', 'Esq.'], ['center', 'Centro'], ['right', 'Dir.']] as const).map(([v, r]) => <button key={v} className={btn + (estilo.align === v ? ativoCls : '')} onClick={() => mudar('Alinhamento', e => { e.align = v })} data-alinhar-texto={v}>{r}</button>)}
          <label className="text-[10px] text-gray-500 flex items-center gap-1 ml-auto"><input type="checkbox" checked={estilo.kerning} onChange={() => mudar('Kerning', e => { e.kerning = !e.kerning })} className="accent-orange-500" /> Kerning</label>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <Faixa rotulo="Tamanho (todas as caixas)" valor={estilo.sizeScale ?? 1} min={0.3} max={2.5} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="tamanho" onMudar={(v, j) => mudar('Tamanho do texto (todas)', e => { e.sizeScale = Math.round(v * 100) / 100 }, j)} />
          <Faixa rotulo="Girar (todas as caixas)" valor={estilo.rotationDeg ?? 0} min={-180} max={180} passo={1} fmt={v => `${Math.round(v)}°`} dado="giro" onMudar={(v, j) => mudar('Girar texto (todas)', e => { e.rotationDeg = v }, j)} />
          <Faixa rotulo="Tracking" valor={estilo.tracking} min={-200} max={400} passo={5} fmt={v => String(v)} dado="tracking" onMudar={(v, j) => mudar('Tracking', e => { e.tracking = v }, j)} />
          <Faixa rotulo="Entrelinha" valor={estilo.lineHeight} min={0.5} max={2} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="entrelinha" onMudar={(v, j) => mudar('Entrelinha', e => { e.lineHeight = v }, j)} />
          <Faixa rotulo="Escala horizontal" valor={estilo.scaleX} min={0.5} max={2} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="sx" onMudar={(v, j) => mudar('Escala horizontal', e => { e.scaleX = v }, j)} />
          <Faixa rotulo="Escala vertical" valor={estilo.scaleY} min={0.5} max={2} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="sy" onMudar={(v, j) => mudar('Escala vertical', e => { e.scaleY = v }, j)} />
          <Faixa rotulo="Linha de base" valor={estilo.baselineMm} min={-10} max={10} passo={0.1} fmt={v => `${v.toLocaleString('pt-BR')} mm`} dado="base" onMudar={(v, j) => mudar('Linha de base', e => { e.baselineMm = v }, j)} />
          <Faixa rotulo="Curva" valor={estilo.curveRadiusMm ? Math.sign(estilo.curveRadiusMm) * Math.round(1000 / Math.abs(estilo.curveRadiusMm)) : 0} min={-40} max={40} passo={1} fmt={v => (v ? (v > 0 ? `arco ↑ ${v}` : `arco ↓ ${-v}`) : 'reto')} dado="curva"
            onMudar={(v, j) => mudar('Texto em curva', e => { e.curveRadiusMm = v ? Math.sign(v) * Math.round(1000 / Math.abs(v)) : 0 }, j)} />
        </div>
        {fonte && fonte.gsub.length > 0 && (
          <div className="flex flex-wrap gap-1" data-opentype>
            {fonte.gsub.filter(t => !['ccmp', 'locl', 'liga', 'calt', 'kern', 'mark', 'mkmk', 'frac', 'numr', 'dnom', 'sups', 'ordn', 'case'].includes(t)).map(t => (
              <button key={t} className={btn + (estilo.features.includes(t) ? ativoCls : '')} onClick={() => mudar(`OpenType: ${nomeOT(t)}`, e => { e.features = e.features.includes(t) ? e.features.filter(x => x !== t) : [...e.features, t] })} data-ot={t}>{nomeOT(t)}</button>
            ))}
          </div>
        )}
        {fonte && (
          <div className="space-y-1" data-painel-glifos>
            <p className="text-[10px] text-gray-500">Glifos — clique numa letra para ver as variações:</p>
            <div className="flex flex-wrap gap-0.5">
              {[...texto].map((c, i) => c === ' ' ? <span key={i} className="w-2" /> : <button key={i} className={`min-w-6 px-1 py-0.5 rounded border text-sm ${letra === i ? 'border-orange-500 bg-orange-50' : escolhaDa(i) ? 'border-orange-300' : 'border-gray-200'}`} onClick={() => setLetra(letra === i ? null : i)} data-letra={i}>{c}</button>)}
            </div>
            {letra !== null && (
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1" data-alternativas>
                  {glifoDoChar(fonte, texto.codePointAt(letra) ?? 0) !== undefined && <Glifo f={fonte} gid={glifoDoChar(fonte, texto.codePointAt(letra) ?? 0)!} ativo={!escolhaDa(letra)} onClick={() => escolher(null, letra)} titulo="normal" />}
                  {alts.map(a => <Glifo key={`${a.tag}${a.value}`} f={fonte} gid={a.gid} ativo={escolhaDa(letra)?.kind === 'glyph' && (escolhaDa(letra) as { gid: number }).gid === a.gid} onClick={() => escolher({ index: letra, char: texto[letra], kind: 'glyph', gid: a.gid }, letra)} titulo={`${nomeOT(a.tag)} ${a.value}`} />)}
                </div>
                {(pua.length > 0 || semCod.length > 0) && <p className="text-[10px] text-gray-400">Outros glifos da fonte (swashes e enfeites guardados fora do teclado):</p>}
                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto" data-outros-glifos>
                  {pua.map(cp => { const g = glifoDoChar(fonte, cp); return g ? <Glifo key={`u${cp}`} f={fonte} gid={g} ativo={escolhaDa(letra)?.kind === 'unicode' && (escolhaDa(letra) as { cp: number }).cp === cp} onClick={() => escolher({ index: letra, char: texto[letra], kind: 'unicode', cp }, letra)} titulo={`U+${cp.toString(16).toUpperCase()}`} /> : null })}
                  {semCod.map(g => <Glifo key={`g${g}`} f={fonte} gid={g} ativo={escolhaDa(letra)?.kind === 'glyph' && (escolhaDa(letra) as { gid: number }).gid === g} onClick={() => escolher({ index: letra, char: texto[letra], kind: 'glyph', gid: g }, letra)} titulo={`glifo ${g}`} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {ladoTexto === 'tudo' && <TextoSoNestaCaixa />}
      {avisos.length > 0 && (
        <ul className="space-y-0.5" data-avisos-texto>
          {avisos.map(a => <li key={a.slotId} className={`text-[11px] flex gap-1 ${a.revisar ? 'text-red-600' : 'text-amber-700'}`}><AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />{doc.molds.find(m => m.faces.some(f => doc.textSlots.find(t => t.id === a.slotId)?.faceId === f.id))?.name}: {a.aviso}</li>)}
        </ul>
      )}

      {/* Lote 4 (item 50): com "efeitos próprios do nome composto", o editor mexe nos do composto */}
      {(() => {
        const doComposto = variavel === 'NOME' && modoNome === 'composto' && !!estilo.efeitosComposto
        return (
          <EditorEfeitos key={doComposto ? 'efc' : 'ef'} efeitos={(doComposto ? estilo.efeitosComposto : estilo.effects) as never} estiloTexto={estilo} titulo={doComposto ? `Estilos do ${variavel} composto` : `Estilos do ${variavel}`}
            textura={estilo.textura} onTextura={t => mudar('Papel do preset no texto', e => { e.textura = t as never })}
            onMudar={(efs, label, j) => mudar(label, e => { if (doComposto) e.efeitosComposto = efs as never; else e.effects = efs as never }, j)} onPreset={id => mudar('Preset', e => { if (id) e.effectPresetId = id; else delete e.effectPresetId })} />
        )
      })()}

    </div>
  )
}

/** Lote 4 (item 51): "Preencher com papel" — um papel de Papéis/ dentro do texto (glitter no NOME), movível e redimensionável. */
function PreencherComPapel({ textura, onMudar }: { textura?: EstiloTexto['textura']; onMudar: (t: EstiloTexto['textura'] | null, label: string, juntar?: string) => void }) {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const [aberto, setAberto] = useState(false)
  const [papeis, setPapeis] = useState<string[]>([])
  const [, setV] = useState(0)
  useEffect(() => {
    if (!aberto || !raiz || !liberada) return
    let vivo = true
    listarImagens(raiz, 'Papéis').then(async l => { if (!vivo) return; setPapeis(l); for (const p of l.slice(0, 40)) { await infoImagem(raiz, p).catch(() => null); if (vivo) setV(v => v + 1) } })
    return () => { vivo = false }
  }, [aberto, raiz, liberada])
  async function usar(path: string) {
    if (!raiz) return
    const i = await infoImagem(raiz, path)
    onMudar({ path: i.path, sha256: i.sha256, aspect: i.aspect, scale: textura?.scale ?? 1, dx: textura?.dx ?? 0, dy: textura?.dy ?? 0 }, 'Preencher o texto com papel')
    setAberto(false)
  }
  const ajustar = (p: Partial<NonNullable<EstiloTexto['textura']>>, label: string, j: string) => textura && onMudar({ ...textura, ...p }, label, j)
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5" data-preencher-papel>
      <div className="flex items-center gap-1">
        <button className={btn} disabled={!liberada} onClick={() => setAberto(a => !a)} title="Uma textura (glitter, papel) dentro do texto — os estilos (traçado, sombra, chanfro) ficam por cima" data-abrir-preencher-papel>{textura ? 'Trocar o papel do texto' : 'Preencher com papel'}</button>
        {textura && <button className={btn} onClick={() => onMudar(null, 'Tirar o papel do texto')} data-tirar-papel-texto>Tirar</button>}
      </div>
      {aberto && (
        <div className="grid grid-cols-5 gap-1 max-h-32 overflow-y-auto" data-papeis-texto>
          {papeis.map(p => {
            const i = infoEmCache(p)
            return (
              <button key={p} className="aspect-square rounded border border-gray-200 bg-white overflow-hidden hover:border-orange-400" title={p.split('/').pop()} onClick={() => void usar(p)} data-papel-texto={p}>
                {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
                {i ? <img src={i.url} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] text-gray-400">{p.split('/').pop()}</span>}
              </button>
            )
          })}
          {!papeis.length && <p className="col-span-5 text-[11px] text-gray-400">Nenhum papel em Papéis/.</p>}
        </div>
      )}
      {textura && (<>
        <p className="text-[10px] text-gray-500 truncate">↳ {textura.path.split('/').pop()} — recortado no texto; na edição em massa acompanha o nome.</p>
        <Faixa rotulo="Tamanho da textura" valor={textura.scale ?? 1} min={0.2} max={5} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="tex-tam" onMudar={(v, j) => ajustar({ scale: Math.round(v * 100) / 100 }, 'Tamanho da textura', j)} />
        <Faixa rotulo="Mover a textura ↔" valor={textura.dx ?? 0} min={-1} max={1} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="tex-dx" onMudar={(v, j) => ajustar({ dx: v }, 'Mover a textura', j)} />
        <Faixa rotulo="Mover a textura ↕" valor={textura.dy ?? 0} min={-1} max={1} passo={0.01} fmt={v => `${Math.round(v * 100)}%`} dado="tex-dy" onMudar={(v, j) => ajustar({ dy: v }, 'Mover a textura', j)} />
      </>)}
    </div>
  )
}
