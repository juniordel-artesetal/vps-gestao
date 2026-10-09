'use client'
'use no memo'
// Lote 5 — recursos novos do painel de Texto do tema:
//  · item 62: SUFIXO (anos/aninhos/só o número; maiúsculas/minúsculas) — o padrão do tema;
//  · item 73: bloco NOME + IDADE (arranjo, tamanho da idade em % do nome, espaço entre as linhas);
//  · item 77: valor padrão da FRASE e dos campos extras (o pedido pode trocar na lista);
//  · item 74: FUNDO do texto (faixa que acompanha o texto, ou a logo do tema com a área do nome);
//  · item 75: TROCAR LETRA (a letra sai noutra fonte, só na inicial ou em todas, com ajuste fino).
import Deslizador from './Deslizador'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import type { DocTema } from '@/lib/mae/schema'
import { ESTILO_PADRAO, type EstiloTexto } from '@/lib/mae/texto/noTexto'
import { sufixoDaIdade } from '@/lib/mae/texto/variaveis'
import { useFontes, GOOGLE_FONTS, carregarFonte } from './fontesTexto'
import { SeletorImagem, MiniaturaArquivo } from './SeletorImagem'
import Glifo from './Glifo'
import { alternativas, glifoDoChar, glifosSemCodigo, type FonteHB } from '@/lib/mae/texto/fonte'
import { nomeOT } from '@/lib/mae/texto/opentype'
import { useBiblioteca } from '@/lib/mae/editor/loja'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const ativo = ' !border-orange-500 bg-orange-50 text-orange-800'
const caixaCls = 'rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1.5'
type Mudar = (label: string, f: (e: EstiloTexto) => void, juntar?: string) => void
const tema = () => useMaeTema.getState()

/**
 * Lote 5 (item 77): FRASE presa ao nome — posição (acima/abaixo/antes/depois), tamanho, espaço e o valor padrão do
 * tema (o pedido troca na lista). Vale para todas as posições desta variável na base.
 */
function FraseDoNome({ variavel }: { variavel: string }) {
  const t = useMaeTema(s => s.hist?.atual ?? null)
  const doc = useMaeDoc(s => s.hist.atual)
  if (!t) return null
  const slots = doc.textSlots.filter(s => s.variable === variavel)
  if (!slots.length) return null
  const fr = slots[0].frase
  const f = { posicao: 'acima' as const, tamanhoPct: 0.5, espaco: 0.05, ...(fr ?? {}) }
  const mudar = (p: Partial<typeof f> | null, label: string, j?: string) => useMaeDoc.getState().aplicar(label, d => {
    for (const s of d.textSlots) if (s.variable === variavel) { if (p === null) delete s.frase; else s.frase = { ...f, ...(s.frase ?? {}), ...p } }
  }, j)
  return (
    <div className={caixaCls} data-frase-nome>
      <p className="text-[11px] font-semibold">Frase junto do nome <span className="font-normal text-gray-400">(&ldquo;A Pequena&rdquo; Laura, &ldquo;Fazendinha do&rdquo; Davi)</span></p>
      <div className="flex flex-wrap gap-1">
        <button className={btn + (!fr ? ativo : '')} onClick={() => mudar(null, 'Sem frase no nome')} data-frase-pos="nenhuma">Sem frase</button>
        {([['acima', 'Em cima'], ['abaixo', 'Embaixo'], ['antes', 'Antes (mesma linha)'], ['depois', 'Depois (mesma linha)']] as const).map(([v, r]) => (
          <button key={v} className={btn + (fr && f.posicao === v ? ativo : '')} onClick={() => { mudar({ posicao: v }, `Frase ${r.toLowerCase()}`); if (!t.sample?.FRASE) tema().aplicar('Frase padrão', x => { (x as DocTema).sample = { ...(x as DocTema).sample, FRASE: 'A Pequena' } }) }} data-frase-pos={v}>{r}</button>
        ))}
      </div>
      {fr && (<>
        <label className="block text-[11px]">Frase padrão do tema
          <input defaultValue={t.sample?.FRASE ?? ''} key={`${t.id}:frase`} onChange={e => tema().aplicar('Frase padrão', x => { (x as DocTema).sample = { ...(x as DocTema).sample, FRASE: e.target.value.slice(0, 120) } }, 'amostra:FRASE')} className="mt-0.5 w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs" data-frase-padrao />
        </label>
        {(f.posicao === 'acima' || f.posicao === 'abaixo') && (<>
          <label className="block text-[10px] text-gray-500">Tamanho da frase (% do nome)<Deslizador min={0.2} max={1.5} step={0.01} value={f.tamanhoPct} unidade="%" fator={100} onChange={e => mudar({ tamanhoPct: Number(e.target.value) }, 'Tamanho da frase', 'frase:pct')} className="w-full h-3 accent-orange-500" data-frase-tam /></label>
          <label className="block text-[10px] text-gray-500">Espaço entre a frase e o nome<Deslizador min={-0.5} max={1} step={0.01} value={f.espaco} unidade="%" fator={100} onChange={e => mudar({ espaco: Number(e.target.value) }, 'Espaço da frase', 'frase:esp')} className="w-full h-3 accent-orange-500" /></label>
          <p className="text-[10px] text-gray-400">A frase tem estilo próprio: escolha <b>FRASE</b> nos botões de texto acima para mudar a fonte e os efeitos.</p>
        </>)}
        <p className="text-[10px] text-gray-400">Na edição em massa, a FRASE vira uma coluna (ex.: trocar para &ldquo;Fazendinha da&rdquo;). Vazia, some e o nome recentraliza.</p>
      </>)}
    </div>
  )
}

/** Itens 62/73/77: o que é próprio da variável escolhida. */
export function ConfigDaVariavel({ variavel }: { variavel: string }) {
  const t = useMaeTema(s => s.hist?.atual ?? null)
  const doc = useMaeDoc(s => s.hist.atual)
  if (!t) return null
  if (variavel === 'NOME') return <FraseDoNome variavel="NOME" />
  if (variavel === 'SUFIXO' || variavel === 'IDADE') {
    const id = { formato: 'anos' as const, caixa: 'maiusculas' as const, ...(t.idade ?? {}) }
    const mudar = (p: Partial<typeof id>) => tema().aplicar('Formato da idade', x => { (x as DocTema).idade = { ...id, ...p } })
    return (
      <div className={caixaCls} data-config-sufixo>
        <p className="text-[11px] font-semibold">Sufixo da idade (padrão do tema) — ex.: <b>{t.sample?.IDADE ?? '1'} {sufixoDaIdade(t.sample?.IDADE ?? '1', id.formato, id.caixa) || '(só o número)'}</b></p>
        <div className="flex flex-wrap gap-1">
          {([['anos', 'ano / anos'], ['aninhos', 'aninho / aninhos'], ['numero', 'só o número']] as const).map(([v, r]) => <button key={v} className={btn + (id.formato === v ? ativo : '')} onClick={() => mudar({ formato: v })} data-formato-idade={v}>{r}</button>)}
        </div>
        <div className="flex flex-wrap gap-1">
          {([['maiusculas', 'ANOS'], ['minusculas', 'anos'], ['primeira', 'Anos']] as const).map(([v, r]) => <button key={v} className={btn + (id.caixa === v ? ativo : '')} onClick={() => mudar({ caixa: v })} data-caixa-sufixo={v}>{r}</button>)}
        </div>
        <p className="text-[10px] text-gray-400">1 → ANO/ANINHO · 2 ou mais → ANOS/ANINHOS · &ldquo;8 meses&rdquo; → MESES (mesversário). O pedido pode trocar o formato na lista da edição em massa. O SUFIXO segue o estilo da IDADE até você estilizar ele.</p>
      </div>
    )
  }
  if (variavel === 'NOME_IDADE') {
    const slots = doc.textSlots.filter(s => s.variable === 'NOME_IDADE')
    const b = { arranjo: 'empilhado' as const, idadePct: 0.6, espaco: 0.05, ...(slots[0]?.bloco ?? {}) }
    const mudar = (p: Partial<typeof b>, label: string, j?: string) => useMaeDoc.getState().aplicar(label, d => { for (const s of d.textSlots) if (s.variable === 'NOME_IDADE') s.bloco = { ...b, ...(s.bloco ?? {}), ...p } }, j)
    return (
      <>
      <div className={caixaCls} data-config-bloco>
        <p className="text-[11px] font-semibold">Nome + idade (um bloco só, que move e gira junto)</p>
        <div className="flex flex-wrap gap-1">
          {([['empilhado', 'Nome em cima, idade embaixo'], ['linha', 'Na mesma linha'], ['faz', 'Nome faz 5']] as const).map(([v, r]) => <button key={v} className={btn + (b.arranjo === v ? ativo : '')} onClick={() => mudar({ arranjo: v }, 'Arranjo do bloco')} data-arranjo={v}>{r}</button>)}
        </div>
        {b.arranjo === 'empilhado' && (<>
          <label className="block text-[10px] text-gray-500">Tamanho da idade (% do nome)
            <Deslizador min={0.2} max={1.5} step={0.01} value={b.idadePct} unidade="%" fator={100} onChange={e => mudar({ idadePct: Number(e.target.value) }, 'Tamanho da idade', 'bloco:pct')} className="w-full h-3 accent-orange-500" data-bloco-pct />
          </label>
          <label className="block text-[10px] text-gray-500">Espaço entre as linhas
            <Deslizador min={-0.5} max={1} step={0.01} value={b.espaco} unidade="%" fator={100} onChange={e => mudar({ espaco: Number(e.target.value) }, 'Espaço do bloco', 'bloco:esp')} className="w-full h-3 accent-orange-500" data-bloco-espaco />
          </label>
          <p className="text-[10px] text-gray-400">Nome composto em 2 linhas vira 3 (&ldquo;Davi / Henrique / 1 ano&rdquo;). Sem idade, o nome ocupa o bloco todo.</p>
          {/* Lote 5 (item 73): por padrão o bloco tem um estilo só; opcional, a idade com o estilo dela */}
          <label className="flex items-center gap-1.5 text-[11px]" data-estilo-idade-bloco>
            <input type="checkbox" className="accent-orange-500" checked={!!t.textStyles?.['NOME_IDADE:IDADE']} onChange={e => tema().aplicar(e.target.checked ? 'Estilo próprio da idade do bloco' : 'Idade com o estilo do bloco', x => {
              const tt = x as DocTema
              if (e.target.checked) tt.textStyles = { ...tt.textStyles, 'NOME_IDADE:IDADE': JSON.parse(JSON.stringify(tt.textStyles?.NOME_IDADE ?? tt.textStyles?.NOME ?? ESTILO_PADRAO)) }
              else delete tt.textStyles['NOME_IDADE:IDADE']
            })} /> Estilo próprio para a idade (outra fonte/efeitos) — edite em &ldquo;Idade do bloco&rdquo;
          </label>
        </>)}
      </div>
      <FraseDoNome variavel="NOME_IDADE" />
      </>
    )
  }
  if (!['NOME', 'HASHTAG', 'ARROBA'].includes(variavel)) {
    // FRASE e campos extras: o valor padrão do tema (o pedido troca na lista)
    return (
      <div className={caixaCls} data-config-campo>
        <label className="block text-[11px]">Valor padrão de <b>{variavel}</b> {variavel === 'FRASE' ? '(ex.: "A Pequena", "Fazendinha do")' : ''}
          <input defaultValue={t.sample?.[variavel] ?? ''} key={`${t.id}:${variavel}`} onChange={e => tema().aplicar(`Padrão de ${variavel}`, x => { (x as DocTema).sample = { ...(x as DocTema).sample, [variavel]: e.target.value.slice(0, 120) } }, `amostra:${variavel}`)} className="mt-0.5 w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs" data-padrao-campo />
        </label>
        <p className="text-[10px] text-gray-400">Na edição em massa vira uma coluna editável por pedido. Vazio = o texto some.</p>
      </div>
    )
  }
  return null
}

/** Item 74: fundo atrás do texto. */
export function FundoDoTexto({ estilo, mudar }: { estilo: EstiloTexto; mudar: Mudar }) {
  const f = estilo.fundo
  const [escolher, setEscolher] = useState<'logo' | 'papel' | null>(null)
  const raiz = useBiblioteca(s => s.raiz)
  const set = (p: Partial<NonNullable<EstiloTexto['fundo']>>, label: string, j?: string) => mudar(label, e => { e.fundo = { tipo: 'retangulo', cor: '#dc2626', raioMm: 0, sobraMm: 3, alturaPct: 1.5, textoAcima: 0.05, effects: [], ...(e.fundo ?? {}), ...p } as NonNullable<EstiloTexto['fundo']> }, j)
  return (
    <div className={caixaCls} data-fundo-texto>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] font-semibold mr-1">Fundo do texto</span>
        <button className={btn + (!f ? ativo : '')} onClick={() => mudar('Sem fundo', e => { delete e.fundo })} data-fundo="nenhum">Sem fundo</button>
        <button className={btn + (f?.tipo === 'retangulo' ? ativo : '')} onClick={() => set({ tipo: 'retangulo' }, 'Fundo: faixa')} data-fundo="retangulo">Faixa</button>
        <button className={btn + (f?.tipo === 'imagem' ? ativo : '')} onClick={() => { set({ tipo: 'imagem' }, 'Fundo: logo'); setEscolher('logo') }} data-fundo="imagem">Logo</button>
      </div>
      {f?.tipo === 'retangulo' && (<>
        <div className="flex items-center gap-1.5 text-[11px]">Cor <input type="color" value={f.cor} onChange={e => set({ cor: e.target.value }, 'Cor da faixa', 'fundo:cor')} className="h-6 w-8 rounded border border-gray-200" data-fundo-cor />
          <button className={btn} onClick={() => setEscolher(escolher === 'papel' ? null : 'papel')}>{f.textura ? <MiniaturaArquivo path={f.textura.path} className="h-4 w-4" /> : null} Papel dentro…</button>
          {f.textura && <button className={btn} onClick={() => set({ textura: undefined }, 'Faixa sem papel')} aria-label="Tirar o papel"><Trash2 className="w-3 h-3" /></button>}
        </div>
        {escolher === 'papel' && <SeletorImagem pastas={['Papéis']} atual={f.textura?.path} onEscolher={a => { set({ textura: { path: a.path, sha256: a.sha256, aspect: a.aspect } }, 'Papel na faixa'); setEscolher(null) }} />}
        <div className="grid grid-cols-2 gap-x-2">
          <label className="block text-[10px] text-gray-500">Sobra nas laterais<Deslizador min={0} max={30} step={0.5} value={f.sobraMm} unidade="mm" onChange={e => set({ sobraMm: Number(e.target.value) }, 'Sobra da faixa', 'fundo:sobra')} className="w-full h-3 accent-orange-500" data-fundo-sobra /></label>
          <label className="block text-[10px] text-gray-500">Altura (% do texto)<Deslizador min={0.5} max={4} step={0.05} value={f.alturaPct} unidade="%" fator={100} onChange={e => set({ alturaPct: Number(e.target.value) }, 'Altura da faixa', 'fundo:alt')} className="w-full h-3 accent-orange-500" data-fundo-altura /></label>
          <label className="block text-[10px] text-gray-500">Texto acima do centro<Deslizador min={-0.5} max={0.5} step={0.01} value={f.textoAcima} unidade="%" fator={100} onChange={e => set({ textoAcima: Number(e.target.value) }, 'Posição do texto na faixa', 'fundo:acima')} className="w-full h-3 accent-orange-500" data-fundo-acima /></label>
          <label className="block text-[10px] text-gray-500">Cantos arredondados<Deslizador min={0} max={30} step={0.5} value={f.raioMm} unidade="mm" onChange={e => set({ raioMm: Number(e.target.value) }, 'Cantos da faixa', 'fundo:raio')} className="w-full h-3 accent-orange-500" data-fundo-raio /></label>
        </div>
        <p className="text-[10px] text-gray-400">A faixa cresce e encolhe com o nome (também na edição em massa). Os estilos da faixa (traçado, sombra…) ficam no fim deste painel.</p>
      </>)}
      {f?.tipo === 'imagem' && (<>
        {f.imagem && <div className="flex items-center gap-1.5"><MiniaturaArquivo path={f.imagem.path} className="h-12 w-12" /><button className={btn} onClick={() => setEscolher(escolher === 'logo' ? null : 'logo')}>Trocar a logo…</button></div>}
        {(escolher === 'logo' || !f.imagem) && <SeletorImagem pastas={['Elementos', 'Identidade']} atual={f.imagem?.path} onEscolher={a => { set({ imagem: { path: a.path, sha256: a.sha256, aspect: a.aspect, area: f.imagem?.area ?? { x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, esticarAte: f.imagem?.esticarAte } }, 'Logo atrás do nome'); setEscolher(null); if (raiz) void raiz }} />}
        {f.imagem && (<>
          <p className="text-[10px] text-gray-500">Área do nome dentro da logo (a logo nunca deforma — o nome se ajusta a ela):</p>
          <div className="grid grid-cols-2 gap-x-2">
            {(['x', 'y', 'w', 'h'] as const).map(k => (
              <label key={k} className="block text-[10px] text-gray-500">{{ x: 'Esquerda', y: 'Topo', w: 'Largura', h: 'Altura' }[k]}
                <Deslizador min={k === 'w' || k === 'h' ? 0.02 : 0} max={1} step={0.01} value={f.imagem!.area[k]} unidade="%" fator={100} onChange={e => set({ imagem: { ...f.imagem!, area: { ...f.imagem!.area, [k]: Number(e.target.value) } } }, 'Área do nome na logo', `fundo:area:${k}`)} className="w-full h-3 accent-orange-500" data-area-logo={k} />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[11px]"><input type="checkbox" checked={!!f.imagem.esticarAte} onChange={e => set({ imagem: { ...f.imagem!, esticarAte: e.target.checked ? 1.3 : undefined } }, e.target.checked ? 'Faixa pode esticar na largura' : 'Logo sem esticar')} data-esticar-logo /> Faixa lisa: pode esticar só na largura até
            <input inputMode="decimal" disabled={!f.imagem.esticarAte} defaultValue={String(Math.round(((f.imagem.esticarAte ?? 1.3) - 1) * 100))} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v >= 0 && v <= 100) set({ imagem: { ...f.imagem!, esticarAte: 1 + v / 100 } }, 'Quanto a faixa estica') }} className="w-10 rounded border border-gray-200 bg-transparent px-1" />%</label>
        </>)}
      </>)}
    </div>
  )
}

/** Item 75: trocar a fonte (ou o glifo) de uma letra só — regra do tema. */
export function TrocarLetra({ estilo, mudar, fonte }: { estilo: EstiloTexto; mudar: Mudar; fonte?: FonteHB }) {
  const { locais } = useFontes()
  const raiz = useBiblioteca(s => s.raiz)
  const [letra, setLetra] = useState('')
  // Lote 5 (item 75): cada troca é por OUTRA FONTE ou por OUTRO GLIFO da mesma fonte (alternativas, floreios)
  const [modo, setModo] = useState<Record<number, 'fonte' | 'glifo'>>({})
  const trocas = estilo.trocas ?? []
  const set = (i: number, p: Partial<NonNullable<EstiloTexto['trocas']>[number]>, label: string, j?: string) => mudar(label, e => { const l = [...(e.trocas ?? [])]; l[i] = { ...l[i], ...p }; e.trocas = l }, j)
  return (
    <div className={caixaCls} data-trocar-letra>
      <p className="text-[11px] font-semibold">Trocar letra <span className="font-normal text-gray-400">(ex.: o J que parece T — vale para todos os pedidos)</span></p>
      {trocas.map((t, i) => (
        <div key={i} className="rounded border border-gray-100 dark:border-gray-800 p-1.5 space-y-1" data-troca={t.letra}>
          <div className="flex gap-1 text-[10px]">
            {(['fonte', 'glifo'] as const).map(m => <button key={m} className={btn + ((modo[i] ?? (t.gid && !t.fonte ? 'glifo' : 'fonte')) === m ? ativo : '')} onClick={() => setModo(s => ({ ...s, [i]: m }))} data-troca-modo={m}>{m === 'fonte' ? 'Outra fonte' : 'Outro glifo desta fonte'}</button>)}
          </div>
          {(modo[i] ?? (t.gid && !t.fonte ? 'glifo' : 'fonte')) === 'glifo' ? (
            <div className="space-y-1" data-troca-glifos>
              {!fonte && <p className="text-[10px] text-gray-400">Carregando a fonte…</p>}
              {fonte && (() => {
                const normal = glifoDoChar(fonte, t.letra.codePointAt(0) ?? 0)
                const alts = alternativas(fonte, t.letra, 0, { kerning: true })
                const extras = glifosSemCodigo(fonte, 80)
                return (<>
                  <div className="flex flex-wrap gap-1">
                    {normal !== undefined && <Glifo f={fonte} gid={normal} ativo={!t.gid} titulo="a letra normal" onClick={() => set(i, { gid: undefined, fonte: undefined }, `Letra ${t.letra} normal`)} />}
                    {alts.map(a => <Glifo key={`${a.tag}${a.value}`} f={fonte} gid={a.gid} ativo={t.gid === a.gid} titulo={`${nomeOT(a.tag)} ${a.value}`} onClick={() => set(i, { gid: a.gid, fonte: undefined }, `Letra ${t.letra}: outro glifo`)} />)}
                  </div>
                  {extras.length > 0 && <details className="text-[10px]"><summary className="cursor-pointer text-gray-500">Outros glifos da fonte (floreios guardados fora do teclado)</summary>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto pt-1">{extras.map(g => <Glifo key={g} f={fonte} gid={g} ativo={t.gid === g} titulo={`glifo ${g}`} onClick={() => set(i, { gid: g, fonte: undefined }, `Letra ${t.letra}: outro glifo`)} />)}</div>
                  </details>}
                </>)
              })()}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            <b className="text-base leading-none w-5 text-center">{t.letra}</b>
            {(modo[i] ?? (t.gid && !t.fonte ? 'glifo' : 'fonte')) === 'fonte' && <select value={t.fonte ? `${(t.fonte as { source?: string }).source ?? 'local'}|${t.fonte.postscriptName}` : ''} onChange={e => {
              const [orig, ps] = e.target.value.split('|')
              const g = GOOGLE_FONTS.find(x => x.ps === ps)
              const fonte = orig === 'google' && g ? { postscriptName: g.ps, family: g.family, source: 'google' as const, url: g.url } : { postscriptName: ps, family: locais.find(l => l.ps === ps)?.family ?? ps, source: 'local' as const }
              set(i, { fonte, gid: undefined }, `Letra ${t.letra} em outra fonte`)
              void carregarFonte(fonte, raiz)
            }} className="flex-1 min-w-0 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px]" data-troca-fonte>
              <option value="">— escolha a fonte da letra —</option>
              {locais.length > 0 && <optgroup label="Deste computador">{locais.map(l => <option key={l.ps} value={`local|${l.ps}`}>{l.family}{l.style && !/regular/i.test(l.style) ? ` ${l.style}` : ''}</option>)}</optgroup>}
              <optgroup label="Google Fonts">{GOOGLE_FONTS.map(g => <option key={g.ps} value={`google|${g.ps}`}>{g.family}</option>)}</optgroup>
            </select>}
            <select value={t.so ?? 'todas'} onChange={e => set(i, { so: e.target.value as 'todas' }, 'Onde trocar a letra')} className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px]" data-troca-so>
              <option value="todas">em todas</option><option value="inicial">só na inicial</option>
            </select>
            <button className={btn} onClick={() => mudar(`Tirar a troca do ${t.letra}`, e => { e.trocas = (e.trocas ?? []).filter((_, k) => k !== i) })} aria-label="Tirar a troca"><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="grid grid-cols-3 gap-x-2">
            <label className="block text-[10px] text-gray-500">Tamanho<Deslizador min={0.3} max={3} step={0.01} value={t.escala ?? 1} unidade="%" fator={100} onChange={e => set(i, { escala: Number(e.target.value) }, 'Tamanho da letra trocada', `troca:${i}:esc`)} className="w-full h-3 accent-orange-500" /></label>
            <label className="block text-[10px] text-gray-500">Linha de base<Deslizador min={-20} max={20} step={0.1} value={t.baselineMm ?? 0} unidade="mm" onChange={e => set(i, { baselineMm: Number(e.target.value) }, 'Linha de base da letra trocada', `troca:${i}:base`)} className="w-full h-3 accent-orange-500" /></label>
            <label className="block text-[10px] text-gray-500">Espaço<Deslizador min={-10} max={10} step={0.1} value={t.espacoMm ?? 0} unidade="mm" onChange={e => set(i, { espacoMm: Number(e.target.value) }, 'Espaço da letra trocada', `troca:${i}:esp`)} className="w-full h-3 accent-orange-500" /></label>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-1">
        <input value={letra} onChange={e => setLetra(e.target.value.slice(0, 1))} placeholder="Letra" className="w-14 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-sm text-center" data-nova-troca />
        <button className={btn} disabled={!letra.trim()} onClick={() => { mudar(`Trocar a letra ${letra}`, e => { e.trocas = [...(e.trocas ?? []), { letra, so: 'todas' }] }); setLetra('') }} data-adicionar-troca><Plus className="w-3.5 h-3.5" /> Trocar esta letra</button>
      </div>
      <p className="text-[10px] text-gray-400">Maiúscula e minúscula são letras diferentes (J ≠ j). Para trocar só num pedido, use o &ldquo;Ajustar&rdquo; na edição em massa.</p>
    </div>
  )
}
