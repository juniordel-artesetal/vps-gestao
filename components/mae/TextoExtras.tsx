'use client'
'use no memo'
// Lote 5 — recursos novos do painel de Texto do tema:
//  · item 62: SUFIXO (anos/aninhos/só o número; maiúsculas/minúsculas) — o padrão do tema;
//  · item 73: bloco NOME + IDADE (arranjo, tamanho da idade em % do nome, espaço entre as linhas);
//  · item 77: valor padrão da FRASE e dos campos extras (o pedido pode trocar na lista);
//  · item 74: FUNDO do texto (faixa que acompanha o texto, ou a logo do tema com a área do nome);
//  · item 75: TROCAR LETRA (a letra sai noutra fonte, só na inicial ou em todas, com ajuste fino).
import { infoEmCache } from './arquivosMae'
import Deslizador from './Deslizador'
import { useRef, useState } from 'react'
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
import { diagramar, letrasSemGlifo, letrasMontaveis, letrasComAcentoFalso, LETRAS_SEMPRE_MONTAR, paraSvg } from '@/lib/mae/texto/diagramar'
import { fonteCarregada } from './fontesTexto'
import { estiloDaVariavel } from '@/lib/mae/texto/noTexto'
import { posicaoEfetiva, areaPassaDaFace } from '@/lib/mae/vinculo/resolver'
import { useEditor } from './estado'
import { nomeOT } from '@/lib/mae/texto/opentype'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import SeletorFonte from './SeletorFonte'
import CorComPaleta from './CorComPaleta'

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
          <input value={t.sample?.FRASE ?? ''} onChange={e => tema().aplicar('Frase padrão', x => { (x as DocTema).sample = { ...(x as DocTema).sample, FRASE: e.target.value.slice(0, 120) } }, 'amostra:FRASE')} className="mt-0.5 w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs" data-frase-padrao />
        </label>
        {(f.posicao === 'acima' || f.posicao === 'abaixo') && (<>
          <label className="block text-[10px] text-gray-500">Tamanho da frase (% do nome)<Deslizador min={0.2} max={1.5} step={0.01} value={f.tamanhoPct} unidade="%" fator={100} onChange={e => mudar({ tamanhoPct: Number(e.target.value) }, 'Tamanho da frase', 'frase:pct')} className="w-full h-3 accent-orange-500" data-frase-tam /></label>
          <label className="block text-[10px] text-gray-500">Espaço entre a frase e o nome<Deslizador min={-1.5} max={1} step={0.01} value={f.espaco} unidade="%" fator={100} onChange={e => mudar({ espaco: Number(e.target.value) }, 'Espaço da frase', 'frase:esp')} className="w-full h-3 accent-orange-500" /></label>
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
        {/* Lote 6 (item 102): tamanho da idade e espaço não somem ao trocar o arranjo (valem no "Nome em cima") */}
        {(<>
          <label className="block text-[10px] text-gray-500">Tamanho da idade (% do nome)
            <Deslizador min={0.2} max={1.5} step={0.01} value={b.idadePct} unidade="%" fator={100} onChange={e => mudar({ idadePct: Number(e.target.value) }, 'Tamanho da idade', 'bloco:pct')} className="w-full h-3 accent-orange-500" data-bloco-pct />
          </label>
          <label className="block text-[10px] text-gray-500">Espaço entre as linhas
            <Deslizador min={-1.5} max={1} step={0.01} value={b.espaco} unidade="%" fator={100} onChange={e => mudar({ espaco: Number(e.target.value) }, 'Espaço do bloco', 'bloco:esp')} className="w-full h-3 accent-orange-500" data-bloco-espaco />
          </label>
          <p className="text-[10px] text-gray-400">Nome composto em 2 linhas vira 3 (&ldquo;Davi / Henrique / 1 ano&rdquo;). Sem idade, o nome ocupa o bloco todo.</p>
          {/* Lote 5 (item 73): por padrão o bloco tem um estilo só; opcional, a idade com o estilo dela */}
          <label className="flex items-center gap-1.5 text-[11px]" data-estilo-idade-bloco>
            <input type="checkbox" className="accent-orange-500" checked={!!t.textStyles?.['NOME_IDADE:IDADE']} onChange={e => tema().aplicar(e.target.checked ? 'Estilo próprio da idade do bloco' : 'Idade com o estilo do bloco', x => {
              const tt = x as DocTema
              // Lote 8 (item 124): a idade não leva a logo/faixa do bloco (o fundo é um só, do bloco)
              if (e.target.checked) { const c = JSON.parse(JSON.stringify(tt.textStyles?.NOME_IDADE ?? tt.textStyles?.NOME ?? ESTILO_PADRAO)); delete c.fundo; tt.textStyles = { ...tt.textStyles, 'NOME_IDADE:IDADE': c } }
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
          <input value={t.sample?.[variavel] ?? ''} onChange={e => tema().aplicar(`Padrão de ${variavel}`, x => { (x as DocTema).sample = { ...(x as DocTema).sample, [variavel]: e.target.value.slice(0, 120) } }, `amostra:${variavel}`)} className="mt-0.5 w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs" data-padrao-campo />
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
        {/* Lote 9 (item 142): a opção "Logo" saiu — logo é ELEMENTO + texto por cima, agrupados (Ctrl+G) */}
      </div>
      {f?.tipo === 'imagem' && <p className="rounded bg-violet-50 px-1.5 py-1 text-[10px] text-violet-900" data-logo-saiu>A logo atrás do nome agora é um <b>elemento</b> + o texto por cima, <b>agrupados</b>. Use o botão “Converter” no topo do painel Tema (fica no mesmo lugar), ou “Sem fundo” para tirar.</p>}
      {f?.tipo === 'retangulo' && (<>
        <div className="flex items-center gap-1.5 text-[11px]">Cor <CorComPaleta value={f.cor} onChange={cor => set({ cor: cor }, 'Cor da faixa', 'fundo:cor')} className="h-6 w-8 rounded border border-gray-200" data-fundo-cor />
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
          <p className="text-[10px] text-gray-500">Área do nome dentro da logo — arraste o retângulo pontilhado (cantos = tamanho). A logo nunca deforma; ela entra do tamanho do nome.</p>
          <AreaDoNome path={f.imagem.path} aspect={f.imagem.aspect} area={f.imagem.area} onMudar={(a, j) => set({ imagem: { ...f.imagem!, area: a } }, 'Área do nome na logo', j)} />
          <details className="text-[10px]" data-area-avancado><summary className="cursor-pointer text-gray-500">Avançado (números)</summary>
          <div className="grid grid-cols-2 gap-x-2">
            {(['x', 'y', 'w', 'h'] as const).map(k => (
              <label key={k} className="block text-[10px] text-gray-500">{{ x: 'Esquerda', y: 'Topo', w: 'Largura', h: 'Altura' }[k]}
                <Deslizador min={k === 'w' || k === 'h' ? 0.02 : 0} max={1} step={0.01} value={f.imagem!.area[k]} unidade="%" fator={100} onChange={e => set({ imagem: { ...f.imagem!, area: { ...f.imagem!.area, [k]: Number(e.target.value) } } }, 'Área do nome na logo', `fundo:area:${k}`)} className="w-full h-3 accent-orange-500" data-area-logo={k} />
              </label>
            ))}
          </div>
          </details>
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
            {/* Lote 13 (item 179): a lista própria — a letra grande em cada fonte, "só fontes que têm ê", prévia na arte */}
            {(modo[i] ?? (t.gid && !t.fonte ? 'glifo' : 'fonte')) === 'fonte' && <span className="flex-1 min-w-0" data-troca-fonte>
              <SeletorFonte letra={t.letra} amostra={String(useMaeTema.getState().hist?.atual.sample?.NOME ?? t.letra)} locais={locais} placeholder="— escolha a fonte da letra —"
                atual={{ valor: t.fonte ? `${(t.fonte as { source?: string }).source ?? 'local'}|${t.fonte.postscriptName}` : '', family: t.fonte?.family ?? '' }}
                onPrevia={v => { if (!v) { useEditor.getState().set({ previaTroca: null }); return } const f = fonteDoValorSel(v, locais); void carregarFonte(f, raiz); useEditor.getState().set({ previaTroca: { variavel: useEditor.getState().variavelTexto ?? 'NOME', letra: t.letra, font: f } }) }}
                onEscolher={v => { useEditor.getState().set({ previaTroca: null }); const fonte = fonteDoValorSel(v, locais); set(i, { fonte, gid: undefined }, `Letra ${t.letra} em outra fonte`); void carregarFonte(fonte, raiz) }} />
            </span>}
            <select value={t.so ?? 'todas'} onChange={e => set(i, { so: e.target.value as 'todas' }, 'Onde trocar a letra')} className="rounded border border-gray-200 bg-transparent px-1 py-0.5 text-[11px]" data-troca-so>
              <option value="todas">em todas</option><option value="inicial">só na inicial</option>
            </select>
            <button className={btn} onClick={() => mudar(`Tirar a troca do ${t.letra}`, e => { e.trocas = (e.trocas ?? []).filter((_, k) => k !== i) })} aria-label="Tirar a troca"><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="grid grid-cols-3 gap-x-2">
            <label className="block text-[10px] text-gray-500">Tamanho<Deslizador min={0.3} max={3} step={0.01} value={t.escala ?? 1} unidade="%" fator={100} onChange={e => set(i, { escala: Number(e.target.value) }, 'Tamanho da letra trocada', `troca:${i}:esc`)} className="w-full h-3 accent-orange-500" /></label>
            <label className="block text-[10px] text-gray-500">Subir/descer a letra<Deslizador min={-20} max={20} step={0.1} value={t.baselineMm ?? 0} unidade="mm" onChange={e => set(i, { baselineMm: Number(e.target.value) }, 'Subir/descer a letra trocada', `troca:${i}:base`)} className="w-full h-3 accent-orange-500" /></label>
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

/**
 * Lote 6 (item 103): a ÁREA DO NOME sobre a logo — retângulo pontilhado arrastável (mover; canto de baixo/direita =
 * tamanho), em fração da logo. Cada arrasto é um passo do Ctrl+Z.
 */
let seqArea = 0
function AreaDoNome({ path, aspect, area, onMudar }: { path: string; aspect: number; area: { x: number; y: number; w: number; h: number }; onMudar: (a: { x: number; y: number; w: number; h: number }, juntar: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const arr = useRef<{ modo: 'mover' | 'tam'; x0: number; y0: number; a0: typeof area; id: number } | null>(null)
  const i = infoEmCache(path)
  const lim = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
  const mover = (e: React.PointerEvent) => {
    const a = arr.current, el = ref.current; if (!a || !el) return
    const r = el.getBoundingClientRect(), dx = (e.clientX - a.x0) / r.width, dy = (e.clientY - a.y0) / r.height
    const n = a.modo === 'mover'
      ? { ...a.a0, x: lim(a.a0.x + dx, 0, 1 - a.a0.w), y: lim(a.a0.y + dy, 0, 1 - a.a0.h) }
      : { ...a.a0, w: lim(a.a0.w + dx, 0.05, 1 - a.a0.x), h: lim(a.a0.h + dy, 0.05, 1 - a.a0.y) }
    onMudar({ x: Math.round(n.x * 1000) / 1000, y: Math.round(n.y * 1000) / 1000, w: Math.round(n.w * 1000) / 1000, h: Math.round(n.h * 1000) / 1000 }, `area:${a.id}`)
  }
  return (
    <div ref={ref} className="relative w-full max-w-[14rem] rounded border border-gray-200 bg-[length:10px_10px] bg-gray-50 select-none touch-none" style={{ aspectRatio: String(aspect || 1) }}
      onPointerMove={mover} onPointerUp={() => { arr.current = null }} onPointerLeave={() => { arr.current = null }} data-area-nome-logo>
      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura local (blob:) */}
      {i && <img src={i.url} alt="" className="absolute inset-0 h-full w-full object-contain pointer-events-none" />}
      <div className="absolute border-2 border-dashed border-orange-500 bg-orange-400/10 cursor-move flex items-center justify-center text-[10px] font-semibold text-orange-700"
        style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.w * 100}%`, height: `${area.h * 100}%` }}
        onPointerDown={e => { e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId); arr.current = { modo: 'mover', x0: e.clientX, y0: e.clientY, a0: area, id: ++seqArea } }} data-area-retangulo>
        NOME
        <span className="absolute -right-1.5 -bottom-1.5 h-3 w-3 rounded-sm border border-orange-600 bg-white cursor-nwse-resize"
          onPointerDown={e => { e.preventDefault(); e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); arr.current = { modo: 'tam', x0: e.clientX, y0: e.clientY, a0: area, id: ++seqArea } }} data-area-canto />
      </div>
    </div>
  )
}

// ── Lote 10 (item 163): fonte sem acento — aviso + MONTAR ACENTOS ──
const LETRAS_PT = 'áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ'   // (inclui ü; o aviso ao escolher a fonte usa LETRAS_ACENTUADAS_PT)
const AMOSTRA_ACENTOS = 'á é í ó ú â ê ô ã õ ç'

/** Prévia em SVG de um texto na fonte, com o estilo (acentos montados incluídos). */
function PreviaTexto({ fonte, texto, estilo }: { fonte: FonteHB; texto: string; estilo: EstiloTexto }) {
  const r = diagramar(fonte, texto, { acentos: estilo.acentos as never }, { w: 400, h: 40 }, { single: { lines: 1, sizePt: 60 } }, ps => fonteCarregada(ps))
  const [x0, y0, x1, y1] = r.bbox
  const p = 2
  return <svg viewBox={`${x0 - p} ${y0 - p} ${Math.max(1, x1 - x0) + 2 * p} ${Math.max(1, y1 - y0) + 2 * p}`} className="h-8 w-full" data-previa-acentos><path d={paraSvg(r.cmds)} fill="currentColor" /></svg>
}

/** Painel Texto: "Esta fonte não tem: á é í…" + montar a letra base + o acento (da própria fonte ou de outra). */
export function MontarAcentos({ estilo, mudar, fonte }: { estilo: EstiloTexto; mudar: Mudar; fonte?: FonteHB }) {
  const { locais } = useFontes()
  const raiz = useBiblioteca(s => s.raiz)
  if (!fonte) return null
  const a = estilo.acentos ?? {}
  // Lote 21 (item 249): o "ú" desenhado SEM acento conta como letra que falta; e as marcadas em "sempre montar" também
  const falsos = letrasComAcentoFalso(fonte, LETRAS_PT)
  const faltam = letrasSemGlifo(fonte, LETRAS_PT, a.sempre).filter(c => !falsos.includes(c) && !(a.sempre ?? []).includes(c))
  const fa = a.fonte ? fonteCarregada(a.fonte.postscriptName) : undefined
  const montaveis = new Set(letrasMontaveis(fonte, LETRAS_PT, fa, a.sempre))
  // Lote 21 (item 249): fonte com todas as letras e nada configurado → só o "Montar sempre", recolhido
  if (!faltam.length && !falsos.length && !estilo.acentos) return (
    <details className={caixaCls} data-montar-acentos-caixa data-montar-acentos-opcional>
      <summary className="cursor-pointer text-[11px] font-semibold">Montar acentos <span className="font-normal text-gray-400">(opcional — a fonte tem todos)</span></summary>
      <div className="space-y-0.5 pt-1" data-sempre-montar>
        <p className="text-[10px] text-gray-500">Montar sempre (se o acento da fonte não ficar bom):</p>
        <div className="flex flex-wrap gap-0.5">
          {[...LETRAS_SEMPRE_MONTAR].map(c => <button key={c} className="min-w-6 rounded border border-gray-200 px-1 text-xs text-gray-600 hover:border-orange-400" onClick={() => mudar(`Montar sempre o ${c}`, e => { e.acentos = { ...(e.acentos ?? {}), sempre: [c] } })} data-sempre-letra={c}>{c}</button>)}
        </div>
      </div>
    </details>
  )
  const semJeito = letrasSemGlifo(fonte, LETRAS_PT, a.sempre).filter(c => !montaveis.has(c))
  const ligado = a.ligado !== false
  const set = (p: Partial<NonNullable<EstiloTexto['acentos']>>, label: string, j?: string) => mudar(label, e => { e.acentos = { ...(e.acentos ?? {}), ...p } }, j)
  return (
    <div className={caixaCls} data-montar-acentos-caixa>
      {falsos.length > 0 && <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-1.5 py-1" data-acento-falso>{falsos.length === 1 ? `O ${falsos[0]} desta fonte não tem acento — vou montar.` : `Estas letras desta fonte não têm acento: ${falsos.join(' ')} — vou montar.`}</p>}
      {faltam.length > 0 && <div className="text-[11px] text-amber-800 bg-amber-50 rounded px-1.5 py-1 space-y-1" data-aviso-acentos>
        <p>Esta fonte não tem: <b className="tracking-wider">{faltam.join(' ')}</b></p>
        {/* Lote 13 (item 180): já configura a troca dessas letras no TEMA (vale para todos os pedidos) — a fonte escolhe-se em "Trocar letra" */}
        <button className={btn} onClick={() => mudar('Trocar letras que faltam (tema)', e => { const ja = new Set((e.trocas ?? []).map(t => t.letra)); e.trocas = [...(e.trocas ?? []), ...faltam.filter(c => !ja.has(c)).map(c => ({ letra: c, so: 'todas' as const }))] })} data-trocar-faltantes-tema>Trocar letra no tema ({faltam.length})</button>
      </div>}
      <label className="flex items-center gap-1 text-[11px] font-semibold"><input type="checkbox" checked={ligado} onChange={e => set({ ligado: e.target.checked }, e.target.checked ? 'Montar acentos' : 'Não montar acentos')} data-montar-acentos /> Montar acentos <span className="font-normal text-gray-400">(a letra da fonte + o acento por cima)</span></label>
      {ligado && <>
        {/* Lote 13 (item 179): a mesma lista própria (cada fonte escrita nela mesma) */}
        <span className="block" data-fonte-acentos>
          <SeletorFonte amostra="á é í ó ú â ê ô ã õ ç" locais={locais} placeholder="Acentos da própria fonte"
            atual={{ valor: a.fonte ? `${(a.fonte as { source?: string }).source ?? 'local'}|${a.fonte.postscriptName}` : '', family: a.fonte?.family ?? '' }}
            extras={[{ valor: '', rotulo: 'Acentos da própria fonte' }]} onPrevia={() => null}
            onEscolher={v => { if (!v) { mudar('Acentos da própria fonte', x => { if (x.acentos) delete x.acentos.fonte }); return } const f = fonteDoValorSel(v, locais); set({ fonte: f }, 'Fonte dos acentos'); void carregarFonte(f, raiz) }} />
        </span>
        {/* Lote 21 (item 249): letras que o MAE monta SEMPRE (a fonte diz ter, mas o desenho não serve) */}
        <div className="space-y-0.5" data-sempre-montar>
          <p className="text-[10px] text-gray-500">Montar sempre (mesmo que a fonte diga ter):</p>
          <div className="flex flex-wrap gap-0.5">
            {[...LETRAS_SEMPRE_MONTAR].map(c => {
              const on = (a.sempre ?? []).includes(c) || falsos.includes(c)
              return <button key={c} disabled={falsos.includes(c)} title={falsos.includes(c) ? 'Esta fonte desenha esta letra sem acento: o MAE já monta sozinho' : on ? 'Parar de montar' : 'Montar sempre'}
                className={`min-w-6 rounded border px-1 text-xs ${on ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-600'} disabled:opacity-70`}
                onClick={() => set({ sempre: on ? (a.sempre ?? []).filter(x => x !== c) : [...(a.sempre ?? []), c] }, on ? `Não montar mais o ${c}` : `Montar sempre o ${c}`)} data-sempre-letra={c}>{c}</button>
            })}
          </div>
        </div>
        {semJeito.length > 0 && <p className="text-[10px] text-red-700" data-acentos-sem-jeito>Sem acento para: <b>{semJeito.join(' ')}</b> — escolha acima uma fonte para os acentos (essas letras saem sem acento).</p>}
        <div className="grid grid-cols-3 gap-x-2">
          <label className="block text-[10px] text-gray-500">Tamanho<Deslizador min={0.3} max={3} step={0.01} value={a.escala ?? 1} unidade="%" fator={100} onChange={e => set({ escala: Number(e.target.value) }, 'Tamanho do acento', 'acentos:esc')} className="w-full h-3 accent-orange-500" /></label>
          <label className="block text-[10px] text-gray-500">Subir/descer<Deslizador min={-20} max={20} step={0.1} value={a.alturaMm ?? 0} unidade="mm" onChange={e => set({ alturaMm: Number(e.target.value) }, 'Altura do acento', 'acentos:alt')} className="w-full h-3 accent-orange-500" /></label>
          <label className="block text-[10px] text-gray-500">Para o lado<Deslizador min={-10} max={10} step={0.1} value={a.dxMm ?? 0} unidade="mm" onChange={e => set({ dxMm: Number(e.target.value) }, 'Acento para o lado', 'acentos:dx')} className="w-full h-3 accent-orange-500" /></label>
        </div>
        <PreviaTexto fonte={fonte} texto={AMOSTRA_ACENTOS} estilo={estilo} />
      </>}
    </div>
  )
}

/** Pedido aberto: o nome usa letra que a fonte do NOME não tem (e não dá para montar) → aviso. */
export function AvisoAcentosPedido({ nome }: { nome: string }) {
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  useFontes(s => s.versao)
  if (!tema || !nome) return null
  const estilo = estiloDaVariavel((tema as DocTema).textStyles, 'NOME')
  const fonte = fonteCarregada(estilo.font.postscriptName)
  if (!fonte) return null
  const faltam = letrasSemGlifo(fonte, nome, estilo.acentos?.sempre)
  if (!faltam.length) return null
  const fa = estilo.acentos?.fonte ? fonteCarregada(estilo.acentos.fonte.postscriptName) : undefined
  const montadas = estilo.acentos?.ligado === false ? [] : letrasMontaveis(fonte, nome, fa, estilo.acentos?.sempre)
  const ruins = faltam.filter(c => !montadas.includes(c))
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] ${ruins.length ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`} data-aviso-acentos-pedido>
      {ruins.length ? <>A fonte do nome não tem <b>{ruins.join(' ')}</b> — essas letras saem sem acento (painel Texto → Montar acentos).</> : <>A fonte não tem <b>{faltam.join(' ')}</b>: acento montado — confira na arte.</>}
    </span>
  )
}

// ── Lote 10 (item 164): área do nome × tamanho do nome ──
const NOME_LONGO = 'Maria Eduarda Beatriz'
const NOME_CURTO = 'Ana'

/** Painel Texto (posição selecionada no Tema): a área do nome, "Testar nome longo" e o aviso de que a área passa da face. */
export function AreaDoNomeCaixa({ slotId }: { slotId: string | null }) {
  const doc = useMaeDoc(s => s.hist?.atual ?? null)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const nomeTeste = useEditor(s => s.nomeTeste)
  const infosTexto = useEditor(s => s.textos)
  const slot = slotId && doc ? doc.textSlots.find(s => s.id === slotId) : null
  if (!slot || !tema || !doc) return null
  const ef = posicaoEfetiva(slot, tema as DocTema)
  const aj = (tema as DocTema).textSlotAdjust?.[slot.id] ?? {}
  const face = doc.molds.find(m => m.faces.some(f => f.id === slot.faceId))
  const fixar = () => useMaeTema.getState().aplicar('Área do nome (só nesta caixa)', t => {
    const x = t as DocTema; x.textSlotAdjust ??= {}; const a = (x.textSlotAdjust[slot.id] ??= {})
    a.area = { w: Math.round(ef.caixa.w * 1000) / 1000, h: Math.round(ef.caixa.h * 1000) / 1000 }
  })
  const caber = () => useMaeTema.getState().aplicar('Área do nome cabe na face', t => {
    const x = t as DocTema; x.textSlotAdjust ??= {}; const a = (x.textSlotAdjust[slot.id] ??= {})
    const c = ef.caixa, m = 0.04
    const w = Math.min(c.w, 1 - 2 * m), h = Math.min(c.h, 1 - 2 * m)
    const cx = Math.min(Math.max(c.x + c.w / 2, m + w / 2), 1 - m - w / 2), cy = Math.min(Math.max(c.y + c.h / 2, m + h / 2), 1 - m - h / 2)
    a.area = { w: Math.round(w * 1000) / 1000, h: Math.round(h * 1000) / 1000 }
    a.dx = Math.round(((a.dx ?? 0) + cx - (c.x + c.w / 2)) * 1000) / 1000; a.dy = Math.round(((a.dy ?? 0) + cy - (c.y + c.h / 2)) * 1000) / 1000
  })
  const soltar = () => useEditor.getState().set({ nomeTeste: null })
  // Lote 13 (item 185): o lado da área que segura o nome e quanto ele encolheu
  const info = infosTexto.find(i => i.slotId.split(':')[0] === slot.id && i.variavel === slot.variable)
  // Lote 13 (item 184): repassar o ajuste desta caixa (tamanho, área, giro) às outras caixas deste texto
  const outras = doc.textSlots.filter(s2 => s2.variable === slot.variable && s2.id !== slot.id)
  const aplicarNasOutras = () => useMaeTema.getState().aplicar(`Ajuste do ${slot.variable} em ${outras.length} caixa(s)`, t => {
    const x = t as DocTema; x.textSlotAdjust ??= {}
    for (const o of outras) {
      const a0 = x.textSlotAdjust[o.id] ?? {}
      x.textSlotAdjust[o.id] = { ...a0, ...(aj.scale ? { scale: aj.scale } : { scale: undefined }), ...(aj.area ? { area: { ...aj.area } } : {}), ...(aj.rotationDeg !== undefined ? { rotationDeg: aj.rotationDeg } : {}) }
      if (!aj.scale) delete x.textSlotAdjust[o.id].scale
    }
  })
  return (
    <div className={caixaCls} data-area-do-nome>
      <p className="text-[11px] font-semibold">Área do nome <span className="font-normal text-gray-400">({ef.area ? 'separada do tamanho' : 'cresce junto com o tamanho'})</span></p>
      <p className="text-[10px] text-gray-500">Na arte: <b>cantos</b> = tamanho da letra · <b>laterais</b> = área do nome. O nome fica no tamanho escolhido; se não couber, encolhe até caber — nunca passa da área.</p>
      {info?.limite && <p className="rounded bg-orange-50 px-1.5 py-1 text-[11px] text-orange-900" data-limite-area>No limite da <b>{info.limite}</b> da área — aumente a área para o nome crescer{info.escala < 1 ? ` · encolhido para ${Math.round(info.escala * 100)}%` : ''}.</p>}
      {areaPassaDaFace(ef.caixa) && <p className="text-[11px] text-red-800 bg-red-50 rounded px-1.5 py-1" data-aviso-area-face>A área do nome passa da face {face?.name ?? ''} <button className={btn} onClick={caber} data-area-caber>Caber na face</button></p>}
      <div className="flex flex-wrap gap-1">
        {!aj.area && <button className={btn} onClick={fixar} data-fixar-area>Separar área do tamanho</button>}
        {/* Lote 13 (item 185): ver os dois casos — nome curto e nome longo (segure) */}
        {([[NOME_CURTO, 'Nome curto'], [NOME_LONGO, 'Nome longo']] as const).map(([n, r]) => (
          <button key={n} className={btn + (nomeTeste === n ? ativo : '')} onPointerDown={() => useEditor.getState().set({ nomeTeste: n })} onPointerUp={soltar} onPointerLeave={soltar}
            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') useEditor.getState().set({ nomeTeste: n }) }} onKeyUp={soltar} title={`Segure para ver a arte com "${n}"`} data-testar-nome={n === NOME_LONGO ? 'longo' : 'curto'} {...(n === NOME_LONGO ? { 'data-testar-nome-longo': true } : {})}>{r} ({n})</button>
        ))}
        {outras.length > 0 && <button className={btn} onClick={aplicarNasOutras} title={`Leva o tamanho, a área e o giro desta caixa para as outras ${outras.length} caixa(s) do ${slot.variable} (proporcional a cada caixa)`} data-aplicar-outras-caixas>Aplicar este ajuste às outras caixas ({outras.length})</button>}
      </div>
    </div>
  )
}

/** Lote 13 (item 179): "local|Nome" / "google|Nome" (valor do seletor) → a fonte do tema. */
function fonteDoValorSel(v: string, locais: { ps: string; family: string }[]) {
  const [orig, ps] = v.split('|')
  const g = GOOGLE_FONTS.find(x => x.ps === ps)
  return orig === 'google' && g ? { postscriptName: g.ps, family: g.family, source: 'google' as const, url: g.url } : { postscriptName: ps, family: locais.find(l => l.ps === ps)?.family ?? ps, source: 'local' as const }
}
