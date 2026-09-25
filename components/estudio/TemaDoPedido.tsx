'use client'
// SOA Edition — "tema existente" no pedido. A artesã marca que o pedido usa um tema que já tem
// modelo pronto, escolhe o tema e informa nome(s) e idade; a arte sai AUTOMÁTICA, pronta para
// baixar/imprimir, e fica anexada ao pedido. Some sozinho para quem não tem o módulo (API 404).
import { useEffect, useState } from 'react'
import { WandSparkles, Loader2, X, AlertTriangle, Download } from 'lucide-react'
import { CLASSES_PRECARGA } from './fontesNativas'
import { CHAVES_TEMA, temaDoPedido, separar, type TemaPronto } from '@/lib/estudio/tema'
import { SemCota, baixar } from '@/lib/estudio/cliente'
import type { PedidoFonte } from '@/lib/estudio/dados'
import CotaBarra from './CotaBarra'

export default function TemaDoPedido({ pedido, campos, workspaceId, onCampos, onArteGerada }: {
  pedido: Omit<PedidoFonte, 'campos' | 'quantidade'>
  /** camposExtras atuais do formulário do pedido. */
  campos: Record<string, string>
  workspaceId: string | undefined
  /** Tema/Nome/Idade gravados → a tela do pedido atualiza o formulário (senão o próximo "Salvar" apagaria). */
  onCampos: (novos: Record<string, string | undefined>) => void
  onArteGerada?: () => void
}) {
  const [temas, setTemas] = useState<TemaPronto[] | null>(null)
  const [storage, setStorage] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [temaId, setTemaId] = useState('')
  const [nome, setNome] = useState('')
  const [idade, setIdade] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [gerando, setGerando] = useState<{ feitos: number; total: number } | null>(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [faltam, setFaltam] = useState(0)

  useEffect(() => {
    fetch('/api/estudio/temas').then(r => (r.ok ? r.json() : null)).then(d => setTemas(d ? d.temas || [] : null)).catch(() => setTemas(null))
    fetch('/api/estudio/status').then(r => (r.ok ? r.json() : null)).then(d => setStorage(!!d?.storage)).catch(() => {})
  }, [])

  if (temas === null) return null // sem o módulo
  const temaEscrito = campos[CHAVES_TEMA.tema]?.trim() || ''
  const tema = temaDoPedido(campos, temas)
  const nomes = separar(campos[CHAVES_TEMA.nome])

  function abrir() {
    setTemaId(tema?.id || temas?.[0]?.id || '')
    setNome(campos[CHAVES_TEMA.nome] || '')
    setIdade(campos[CHAVES_TEMA.idade] || '')
    setErro(''); setAberto(true)
  }

  async function salvar() {
    setSalvando(true); setErro('')
    try {
      const r = await fetch(`/api/estudio/pedidos/${pedido.id}/tema`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: temaId, nome, idade }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      onCampos(j.campos); setAberto(false)
    } catch (e) { setErro((e as Error).message) } finally { setSalvando(false) }
  }

  async function remover() {
    if (!confirm('Tirar o tema pronto deste pedido? Nome e idade continuam no pedido.')) return
    const r = await fetch(`/api/estudio/pedidos/${pedido.id}/tema`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remover: true }) })
    if (r.ok) onCampos({ [CHAVES_TEMA.tema]: undefined })
  }

  async function gerar() {
    if (!tema || !workspaceId) return
    setErro(''); setOk(''); setFaltam(0); setGerando({ feitos: 0, total: Math.max(1, nomes.length) })
    try {
      const { gerarArtesDoTema } = await import('@/lib/estudio/automatico')
      const r = await gerarArtesDoTema({
        pedido: { ...pedido, quantidade: 1, campos }, tema, workspaceId, guardar: storage,
        aoProgredir: (feitos, total) => setGerando({ feitos, total }),
      })
      baixar(r.arquivo, r.nome)
      setOk(`${r.itens} arte(s) pronta(s)${r.url ? ' e anexada(s) ao pedido' : ''}. ✅`)
      onArteGerada?.()
    } catch (e) {
      if (e instanceof SemCota) { setFaltam(e.faltam); setErro(e.message) }
      else setErro((e as Error).message || 'Não consegui gerar a arte.')
    } finally { setGerando(null) }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
      <div aria-hidden className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
        {CLASSES_PRECARGA.map(c => <span key={c} className={c}>Aa<b>Aa</b></span>)}
      </div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <WandSparkles className="w-4 h-4 text-orange-500" /> Tema pronto
        </h2>
        {temaEscrito && <button onClick={remover} className="text-xs text-gray-400 hover:text-red-600">remover tema</button>}
      </div>

      {!temaEscrito ? (
        temas.length ? (
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer">
            <input type="checkbox" checked={false} onChange={abrir} className="accent-orange-500" />
            Este pedido usa um tema que já existe (a arte sai automática)
          </label>
        ) : (
          <p className="text-xs text-gray-500">Nenhum tema pronto ainda. No SOA Edition, salve um template marcando <b>“Tema pronto”</b> — ele aparece aqui.</p>
        )
      ) : !tema ? (
        <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>O tema “{temaEscrito}” está sem modelo pronto — configure um template para esse tema no SOA Edition (ou <button onClick={abrir} className="underline">escolha outro</button>).</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {tema.preview && <img src={tema.preview} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-100 dark:border-gray-800" />}
            <div className="text-sm min-w-0">
              <p className="font-medium text-gray-900 dark:text-white">{tema.temaNome}</p>
              <p className="text-gray-500 truncate">{nomes.length ? nomes.join(', ') : 'sem nome'}{campos[CHAVES_TEMA.idade] ? ` · ${campos[CHAVES_TEMA.idade]}` : ''}</p>
            </div>
            <button onClick={abrir} className="ml-auto text-xs text-orange-600 hover:underline">editar</button>
          </div>
          {gerando ? (
            <div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-full bg-orange-500 transition-all" style={{ width: `${(gerando.feitos / gerando.total) * 100}%` }} /></div>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Gerando {gerando.feitos} de {gerando.total}…</p>
            </div>
          ) : (
            <button onClick={gerar} disabled={!nomes.length} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 disabled:opacity-40">
              <Download className="w-4 h-4" /> Gerar {nomes.length > 1 ? `${nomes.length} artes` : 'arte'} (PDF para imprimir)
            </button>
          )}
        </div>
      )}
      {ok && <p className="text-xs text-emerald-700 dark:text-emerald-400">{ok}</p>}
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      {faltam > 0 && <CotaBarra faltam={faltam} />}

      {aberto && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAberto(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Tema do pedido</h3>
              <button onClick={() => setAberto(false)} aria-label="Fechar"><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-56 overflow-y-auto">
              {temas.map(t => (
                <button key={t.id} onClick={() => setTemaId(t.id)}
                  className={`rounded-xl border p-1.5 text-left ${temaId === t.id ? 'border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900' : 'border-gray-200 dark:border-gray-700'}`}>
                  {t.preview ? <img src={t.preview} alt="" className="w-full aspect-square object-cover rounded-lg" /> : <div className="w-full aspect-square rounded-lg bg-gray-100 dark:bg-gray-800" />}
                  <span className="block text-[11px] font-medium mt-1 truncate text-gray-800 dark:text-gray-100">{t.temaNome}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome <span className="text-gray-400">(vários? um por linha — sai uma arte para cada)</span></label>
              <textarea value={nome} onChange={e => setNome(e.target.value)} rows={3} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Idade</label>
              <input value={idade} onChange={e => setIdade(e.target.value)} placeholder="Ex.: 5 anos" className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800" />
            </div>
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            <button onClick={salvar} disabled={salvando || !temaId || !nome.trim()} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 text-sm disabled:opacity-40">
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar no pedido
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
