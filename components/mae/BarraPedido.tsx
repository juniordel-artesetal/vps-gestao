'use client'
'use no memo'
// "GERAR ARTE" vindo do card do pedido (/estudio/mae?pedido=<id>), Sprint 12: acha o tema (vínculo
// produto ↔ tema ou campo TEMA), abre base + tema, preenche NOME e IDADE, calcula a HASHTAG e mostra a
// barra do pedido no editor (variáveis editáveis + avisos). A exportação do painel usa estes valores e
// registra a arte no card.
import { confirmarTroca } from './historicoGlobal'
import { useEffect, useState } from 'react'
import { X, ClipboardList, Loader2 } from 'lucide-react'
import { useBiblioteca, useMaeDoc } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { statusDoCard } from '@/lib/mae/pedidos/pedidos'
import { apiMae, temasDisponiveis, linhaDoPedido, valoresDaLinha, abrirTemaEBase, usePedidoAberto, ajustarTextoDoPedido, iniciarAjustePedido, salvarAjustePedido, ajustePedidoAlterado, useAjustePedido, type LinhaPedido, type TemaDisponivel, type PosicaoPedido, type TrocaPedido } from './pedidosMae'
import { useFontes, GOOGLE_FONTS, carregarFonte } from './fontesTexto'
import type { DocTema } from '@/lib/mae/schema'
import { useEditor } from './estado'
import { ler } from '@/lib/mae/biblioteca/arquivos'
import { lerApelidos, ARQ_APELIDOS } from '@/lib/mae/temasProntos/montar'

const inp = 'rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-0.5 text-xs'

/** Lê ?pedido= e abre o pedido assim que a Biblioteca estiver conectada. */
let pedidoDaUrlAberto = false
export function useAbrirPedidoDaUrl() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  useEffect(() => {
    if (pedidoDaUrlAberto || !liberada) return
    pedidoDaUrlAberto = true
    const q = new URLSearchParams(window.location.search)
    const id = q.get('pedido')
    // Lote 5 (item 59): ?ajustar=1 (botão Ajustar da edição em massa); Lote 6 (item 97): &tema= da linha
    if (id) { usePedidoAberto.setState({ ajustar: q.get('ajustar') === '1' }); void abrirPedido(raiz, id, q.get('tema') ?? undefined) }
  }, [raiz, liberada])
}

export async function abrirPedido(raiz: FileSystemDirectoryHandle | null, id: string, temaEscolhido?: string) {
  const set = usePedidoAberto.setState
  set({ aviso: 'Abrindo o pedido…' })
  try {
    // Lote 6 (item 97): os apelidos (TEMA do SOA → tema MAE) também valem aqui — antes o Ajustar dizia "o tema não existe"
    const [p, ts, vs, ap] = await Promise.all([apiMae.pedido(id), temasDisponiveis(raiz), apiMae.vinculos().catch(() => []),
      raiz ? ler(raiz, ARQ_APELIDOS).then(f => f.text()).then(lerApelidos).catch(() => ({})) : Promise.resolve({})])
    const l = linhaDoPedido(p, ts, vs, ap)
    const tid = temaEscolhido ?? l.tema?.themeId
    const t = ts.find(x => x.id === tid)
    if (!t) { set({ pedido: p, valores: valoresDaLinha(l), origemTema: null, aviso: l.campos.TEMA ? `O tema "${l.campos.TEMA}" do pedido não existe — escolha o tema.` : 'O pedido não tem TEMA — escolha o tema.' }); return }
    const { tema, base } = await abrirTemaEBase(raiz, t)
    // a base aberta (com marcas/ajustes ainda não salvos) vale mais que a cópia salva da MESMA base
    const atual = useMaeDoc.getState().hist.atual
    // Lote 4 (item 30): abrir o pedido troca o tema (e a base, se for outra) — pergunta se quer salvar antes
    const trocaBase = !(atual.id === base.id && (atual.version ?? 0) >= (base.version ?? 0))
    const temaAberto = useMaeTema.getState().hist?.atual
    const trocas = [...(temaAberto && temaAberto.id !== tema.id ? ['tema' as const] : []), ...(trocaBase ? ['base' as const] : [])]
    if (trocas.length && !(await confirmarTroca(...trocas))) { set({ aviso: null }); return }
    if (!(atual.id === base.id && (atual.version ?? 0) >= (base.version ?? 0))) useMaeDoc.getState().carregar(base)
    useMaeTema.getState().carregar(tema)
    useEditor.getState().set({ modo: 'tema', face: null, camada: null })
    set({ pedido: p, valores: valoresDaLinha(l, tema), origemTema: temaEscolhido ? 'manual' : l.tema!.origem, aviso: l.alertas.filter(a => a !== 'tema não encontrado').join(' · ') || null })
    iniciarAjustePedido()
  } catch (e) { set({ aviso: `Não consegui abrir o pedido: ${(e as Error).message}` }) }
}

export default function BarraPedido() {
  const raiz = useBiblioteca(s => s.raiz)
  const { pedido, valores, origemTema, aviso, ajustar } = usePedidoAberto()
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const textos = useEditor(s => s.textos)
  const [temas, setTemas] = useState<TemaDisponivel[]>([])
  useEffect(() => { if (pedido && !origemTema) void temasDisponiveis(raiz).then(setTemas) }, [pedido, origemTema, raiz])
  if (!pedido && !aviso) return null
  const st = pedido ? statusDoCard(pedido.artes) : null
  const mudar = (k: string, v: string) => usePedidoAberto.setState(s => {
    const n = { ...s.valores, [k]: v }
    // nome/idade mudaram e a hashtag não foi editada à mão → recalcula
    if (k !== 'HASHTAG' && pedido) { const l: LinhaPedido = { ...linhaDoPedido(pedido, [], []), editadas: { NOME: n.NOME, IDADE: n.IDADE } }; n.HASHTAG = valoresDaLinha(l, tema).HASHTAG }
    return { valores: n }
  })
  const avisosTexto = textos.filter(t => t.aviso).map(t => t.aviso!)
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-orange-200 bg-orange-50/70 dark:bg-orange-950/30 px-3 py-1.5 text-xs" data-barra-pedido>
      <ClipboardList className="w-4 h-4 text-orange-600" />
      {pedido ? (<>
        <b>Pedido #{pedido.numero}</b><span className="text-gray-500">{pedido.cliente}</span>
        {origemTema && tema && <span className="text-gray-600">· tema <b>{tema.name}</b> <span className="text-gray-400">({({ variacao: 'pelo produto', produto: 'pelo produto', campo: 'pelo campo TEMA', manual: 'escolhido' } as Record<string, string>)[origemTema]}, v{tema.version})</span></span>}
        {!origemTema && (
          <select defaultValue="" onChange={e => e.target.value && abrirPedido(raiz, pedido.id, e.target.value)} className={inp} data-escolher-tema-pedido>
            <option value="">Escolher o tema…</option>
            {temas.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {(['NOME', 'IDADE', 'HASHTAG'] as const).map(k => (
          <label key={k} className="flex items-center gap-1">{k}<input value={valores[k] ?? ''} onChange={e => mudar(k, e.target.value)} className={`${inp} ${k === 'IDADE' ? 'w-10' : 'w-32'}`} data-var-pedido={k} /></label>
        ))}
        {/* Lote 6 (item 98): o tamanho do texto fica SÓ no painel da direita (obedece "Só nesta caixa" / "Todas as
            caixas da parte"); a barra de cima mostra os dados do pedido. Pedido antigo com tamanho do nome inteiro: dá para tirar. */}
        {valores._ESCALA_NOME && Math.abs(Number(valores._ESCALA_NOME) - 1) > 0.005 && (
          <button className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px]" title="Tamanho antigo, valia para o pedido inteiro"
            onClick={() => { usePedidoAberto.setState(s => { const v = { ...s.valores }; delete v._ESCALA_NOME; return { valores: v } }); void apiMae.ajustarPedido(pedido.id, { NOME: null }).catch(() => null) }} data-tirar-escala-antiga>
            nome a {Math.round(Number(valores._ESCALA_NOME) * 100)}% no pedido inteiro · tirar</button>
        )}
        {st && <span className={st.status === 'gerada' ? 'text-emerald-700 font-semibold' : st.status === 'revisar' ? 'text-amber-700' : 'text-gray-500'} data-status-pedido={st.status}>{st.status === 'gerada' ? 'Arte gerada ✓' : st.status === 'revisar' ? 'Revisar' : 'Arte não gerada'}</span>}
        {!ajustar && <span className="text-gray-500">Gere em Exportar → Arte pra aprovação / impressão.</span>}
        {ajustar && <AjustarPedido />}
      </>) : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {(aviso || avisosTexto.length > 0) && <span className="text-amber-700 w-full" data-aviso-pedido>{[aviso, ...avisosTexto].filter(Boolean).join(' · ')}</span>}
      {pedido && <button className="ml-auto" onClick={() => usePedidoAberto.setState({ pedido: null, valores: {}, origemTema: null, aviso: null })} aria-label="Fechar o pedido"><X className="w-3.5 h-3.5" /></button>}
    </div>
  )
}

/**
 * Lote 5 (item 59): barra do "Ajustar" — o tema fica travado; os textos deste pedido se mexem na arte (mover,
 * tamanho, girar), 1 ou 2 linhas no texto escolhido, letra trocada só aqui (item 75). "Usar como padrão do tema"
 * leva o ajuste para o tema; "Voltar ao padrão" desfaz o do pedido.
 */
function AjustarPedido() {
  const { pedido, valores } = usePedidoAberto()
  const slot = useEditor(s => s.slot)
  const doc = useMaeDoc(s => s.hist.atual)
  const raiz = useBiblioteca(s => s.raiz)
  const { locais } = useFontes()
  const [letraSel, setLetraSel] = useState<number | null>(null)
  const [perguntaSair, setPerguntaSair] = useState(false)
  const salvando = useAjustePedido(s => s.salvando)
  useAjustePedido(s => s.hist); useAjustePedido(s => s.marca)
  if (!pedido) return null
  const posicoes = Object.fromEntries(Object.entries(valores).filter(([k]) => k.startsWith('_POS_')).map(([k, v]) => [k.slice(5), (() => { try { return JSON.parse(v) as PosicaoPedido } catch { return {} } })()]))
  const s = doc.textSlots.find(x => x.id === slot) ?? null
  const ap = s ? posicoes[s.id] ?? {} : {}
  const nome = String(valores.NOME ?? '')
  const trocas: TrocaPedido[] = (() => { try { return JSON.parse(valores._TROCAS_NOME ?? '[]') } catch { return [] } })()
  const salvarTrocas = (l: TrocaPedido[]) => {
    usePedidoAberto.setState(st => ({ valores: { ...st.valores, _TROCAS_NOME: JSON.stringify(l) } }))
    void apiMae.trocas(pedido.id, { NOME: l.length ? l : null }).catch(() => null)
  }
  function usarComoPadrao() {
    if (!Object.keys(posicoes).length) return
    if (!confirm('Levar estes ajustes para o TEMA (todos os pedidos passam a usar)?')) return
    useMaeTema.getState().aplicar('Ajuste do pedido vira padrão do tema', tt => {
      const x = tt as DocTema; x.textSlotAdjust ??= {}
      for (const [id, p] of Object.entries(posicoes)) {
        const a = (x.textSlotAdjust[id] ??= {})
        a.dx = Math.max(-1, Math.min(1, (a.dx ?? 0) + (p.dx ?? 0))); a.dy = Math.max(-1, Math.min(1, (a.dy ?? 0) + (p.dy ?? 0)))
        a.scale = Math.max(0.2, Math.min(4, (a.scale ?? 1) * (p.scale ?? 1))); a.rotationDeg = (a.rotationDeg ?? 0) + (p.rotationDeg ?? 0)
      }
    })
    voltarAoPadrao()
  }
  /** Tira todos os ajustes deste pedido (entra no Ctrl+Z; vai para o pedido no "Salvar ajuste do pedido"). */
  function voltarAoPadrao() {
    ajustarTextoDoPedido(Object.keys(posicoes), a => { for (const k of Object.keys(a)) delete (a as Record<string, unknown>)[k] }, undefined, 'Voltar ao padrão (pedido)')
  }
  /** Lote 6 (item 100): voltar à lista de pedidos — na linha deste pedido (destacada); `gerar` = gera ao chegar. */
  const irParaLista = (gerar = false) => { window.location.href = `/estudio/mae/pedidos?destaque=${encodeURIComponent(pedido!.id)}${gerar ? '&gerar=1' : ''}` }
  async function voltar() {
    if (ajustePedidoAlterado()) { setPerguntaSair(true); return }
    irParaLista()
  }
  const btn = 'rounded border border-orange-300 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-[11px] hover:border-orange-500'
  return (
    <span className="flex w-full flex-wrap items-center gap-1.5 rounded bg-white/70 dark:bg-gray-900/50 px-1.5 py-1" data-ajustar-pedido>
      <b className="text-orange-700">Ajustando só este pedido</b><span className="text-gray-500">— o tema está travado. Clique num texto na arte: arraste, cantos = tamanho, alça = girar.</span>
      {s && <span className="flex items-center gap-1">{s.variable}:
        {([[undefined, 'auto'], [1, '1 linha'], [2, '2 linhas']] as const).map(([n, r]) => <button key={r} className={btn + (ap.lines === n ? ' !border-orange-600 bg-orange-50' : '')} onClick={() => ajustarTextoDoPedido(s.id, a => { if (n) a.lines = n; else delete a.lines })} data-linhas-ajuste={r}>{r}</button>)}
      </span>}
      {nome && <span className="flex flex-wrap items-center gap-0.5" data-trocar-letra-pedido>Trocar letra:
        {[...nome].map((c, i) => c === ' ' ? <span key={i} className="w-1" /> : <button key={i} className={btn + (letraSel === i ? ' !border-orange-600 bg-orange-50' : trocas.some(t => t.letra === c) ? ' !border-orange-400' : '')} onClick={() => setLetraSel(letraSel === i ? null : i)}>{c}</button>)}
        {letraSel !== null && (
          <select defaultValue="" onChange={e => {
            const ps = e.target.value; const c = nome[letraSel]
            if (!ps) { salvarTrocas(trocas.filter(t => t.letra !== c)); return }
            const [orig, p] = ps.split('|'); const g = GOOGLE_FONTS.find(x => x.ps === p)
            const fonte = orig === 'google' && g ? { postscriptName: g.ps, family: g.family, source: 'google' as const, url: g.url } : { postscriptName: p, family: locais.find(l => l.ps === p)?.family ?? p, source: 'local' as const }
            void carregarFonte(fonte, raiz)
            salvarTrocas([...trocas.filter(t => t.letra !== c), { letra: c, so: letraSel === 0 || nome[letraSel - 1] === ' ' ? 'inicial' : 'todas', fonte }])
          }} className={inp}>
            <option value="">fonte da letra “{nome[letraSel]}” (só neste pedido)…</option>
            <option value="">— voltar à do tema —</option>
            {locais.length > 0 && <optgroup label="Deste computador">{locais.map(l => <option key={l.ps} value={`local|${l.ps}`}>{l.family}</option>)}</optgroup>}
            <optgroup label="Google Fonts">{GOOGLE_FONTS.map(g => <option key={g.ps} value={`google|${g.ps}`}>{g.family}</option>)}</optgroup>
          </select>
        )}
      </span>}
      <span className="ml-auto flex flex-wrap gap-1">
        <button className={btn} disabled={!Object.keys(posicoes).length} onClick={usarComoPadrao} data-ajuste-padrao-tema>Usar este ajuste como padrão do tema</button>
        <button className={btn} disabled={!Object.keys(posicoes).length} onClick={voltarAoPadrao} data-ajuste-voltar>Voltar ao padrão</button>
      </span>
      {/* Lote 6 (itens 80/100): o ajuste vai para o PEDIDO só aqui — e volta para a lista */}
      <span className="flex w-full flex-wrap items-center gap-1" data-acoes-ajuste>
        <button className={btn} onClick={() => void voltar()} data-voltar-pedidos>← Voltar aos pedidos</button>
        <button className={btn + ' !border-orange-500 bg-orange-500 text-white'} disabled={salvando} onClick={() => void salvarAjustePedido()} data-salvar-ajuste>{salvando ? 'Salvando…' : 'Salvar ajuste do pedido'}</button>
        <button className={btn} disabled={salvando} onClick={async () => { if (await salvarAjustePedido()) irParaLista() }} data-salvar-voltar>Salvar e voltar</button>
        <button className={btn} disabled={salvando} onClick={async () => { if (await salvarAjustePedido()) irParaLista(true) }} data-salvar-gerar>Salvar e gerar</button>
        {ajustePedidoAlterado() ? <span className="text-amber-700" data-ajuste-nao-salvo>• ajuste não salvo</span> : <span className="text-emerald-700" data-ajuste-salvo>ajuste salvo ✓</span>}
      </span>
      {perguntaSair && (
        <span className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-pergunta-sair-ajuste>
          <span className="block max-w-sm w-full rounded-xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl text-sm">
            <b className="block">Salvar o ajuste do pedido #{pedido.numero} antes de voltar?</b>
            <span className="flex justify-end gap-1.5 text-xs">
              <button className={btn} onClick={() => setPerguntaSair(false)} data-sair-ajuste="cancelar">Cancelar</button>
              <button className={btn} onClick={() => irParaLista()} data-sair-ajuste="nao">Não salvar</button>
              <button className={btn + ' !border-orange-500 bg-orange-500 text-white'} autoFocus onClick={async () => { if (await salvarAjustePedido()) irParaLista() }} data-sair-ajuste="salvar">Salvar</button>
            </span>
          </span>
        </span>
      )}
    </span>
  )
}
