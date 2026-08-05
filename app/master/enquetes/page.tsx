'use client'
// Master → Enquetes: criar pesquisa (perguntas de múltipla escolha, escala 1–5 ou
// texto), segmentar (todas / ativas / inativas · por plano · por módulo mais usado),
// ativar/desativar, e ver RESULTADOS agregados (contagem/percentual + textos).
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, Trash2, X, BarChart3, ClipboardList, Power, RefreshCw, Send } from 'lucide-react'

type Tipo = 'multipla' | 'escala' | 'texto'
interface PerguntaForm { id: string; texto: string; tipo: Tipo; opcoes: string[] }
interface EnqueteRow {
  id: string; titulo: string; descricao: string | null; publico: string; planos: string | null
  modulo: string | null; canalPopup: boolean; canalEmail: boolean; ativo: boolean; createdAt: string; respostas: number
  perguntas: PerguntaForm[]
}

const PLANOS = ['FREE', 'TRIAL', 'MENSAL', 'ANUAL', 'PRO', 'BUSINESS']
const MODULOS = ['Produção', 'Precificação', 'Financeiro', 'Gestão/DRE', 'Compras', 'Clientes', 'Tarefas', 'Demandas', 'Loja', 'Orçamentos', 'Assistente de Compras', 'Promoções']
const PUBLICO_LABEL: Record<string, string> = { todas: 'Todas', ativas: 'Ativas (30d)', inativas: 'Inativas (30d+)' }
const inp = 'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500'
const gid = () => Math.random().toString(36).slice(2, 9)

export default function EnquetesPage() {
  const [lista, setLista] = useState<EnqueteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [aviso, setAviso] = useState('')
  const [criar, setCriar] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  // Form
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [publico, setPublico] = useState('todas')
  const [planos, setPlanos] = useState<string[]>([])
  const [modulo, setModulo] = useState('')
  const [canalPopup, setCanalPopup] = useState(true)
  const [canalEmail, setCanalEmail] = useState(false)
  const [perguntas, setPerguntas] = useState<PerguntaForm[]>([{ id: gid(), texto: '', tipo: 'multipla', opcoes: ['', ''] }])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  function flash(m: string) { setAviso(m); setTimeout(() => setAviso(''), 2500) }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/master/enquetes')
      if (r.ok) { const d = await r.json(); setLista(d.lista || []) }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function resetForm() {
    setTitulo(''); setDescricao(''); setPublico('todas'); setPlanos([]); setModulo(''); setCanalPopup(true); setCanalEmail(false)
    setPerguntas([{ id: gid(), texto: '', tipo: 'multipla', opcoes: ['', ''] }]); setErro('')
  }

  async function salvar() {
    setErro('')
    if (!titulo.trim()) { setErro('Informe o título.'); return }
    const perg = perguntas
      .filter(p => p.texto.trim())
      .map(p => ({ id: p.id, texto: p.texto.trim(), tipo: p.tipo, opcoes: p.tipo === 'multipla' ? p.opcoes.map(o => o.trim()).filter(Boolean) : undefined }))
    if (perg.length === 0) { setErro('Adicione ao menos uma pergunta.'); return }
    if (perg.some(p => p.tipo === 'multipla' && (p.opcoes?.length ?? 0) < 2)) { setErro('Perguntas de múltipla escolha precisam de ao menos 2 opções.'); return }
    setSalvando(true)
    try {
      const r = await fetch('/api/master/enquetes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descricao, publico, planos, modulo: modulo || null, canalPopup, canalEmail, perguntas: perg }),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não consegui salvar.'); return }
      setCriar(false); resetForm(); flash('Enquete criada'); carregar()
    } finally { setSalvando(false) }
  }

  async function toggle(e: EnqueteRow) {
    await fetch(`/api/master/enquetes/${e.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !e.ativo }) })
    setLista(prev => prev.map(x => x.id === e.id ? { ...x, ativo: !x.ativo } : x)); flash(e.ativo ? 'Enquete pausada' : 'Enquete ativada')
  }
  async function excluir(e: EnqueteRow) {
    if (!confirm(`Excluir "${e.titulo}" e todas as respostas?`)) return
    await fetch(`/api/master/enquetes/${e.id}`, { method: 'DELETE' })
    setLista(prev => prev.filter(x => x.id !== e.id)); flash('Enquete excluída')
  }
  async function verResultados(id: string) {
    setResultado({ loading: true })
    const r = await fetch(`/api/master/enquetes/${id}`)
    setResultado(r.ok ? await r.json() : { erro: true })
  }
  async function enviarEmail(e: EnqueteRow) {
    const prev = await (await fetch(`/api/master/enquetes/${e.id}/enviar-email`)).json().catch(() => null)
    if (!prev) { flash('Não consegui calcular os destinatários.'); return }
    if (prev.total === 0) { flash('Ninguém no público-alvo pendente (todas já responderam ou nenhuma bate a segmentação).'); return }
    if (!confirm(`Enviar o convite por e-mail para ${prev.total} assinante(s) do público-alvo?\n(Não manda pra quem já respondeu nem pra quem saiu da lista.)`)) return
    const r = await fetch(`/api/master/enquetes/${e.id}/enviar-email`, { method: 'POST' })
    const d = await r.json()
    flash(r.ok ? `E-mails enviados: ${d.enviados}${d.falhas ? ` · falhas: ${d.falhas}` : ''}` : (d.error || 'Falha no envio'))
  }

  // ── Construtor de perguntas ──
  const setPerg = (id: string, patch: Partial<PerguntaForm>) => setPerguntas(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  const addPerg = () => setPerguntas(prev => [...prev, { id: gid(), texto: '', tipo: 'multipla', opcoes: ['', ''] }])
  const delPerg = (id: string) => setPerguntas(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <a href="/master" className="text-gray-400 hover:text-white"><ArrowLeft size={18} /></a>
          <div>
            <h1 className="text-white font-semibold text-sm flex items-center gap-2"><ClipboardList size={15} className="text-orange-400" /> Enquetes</h1>
            <p className="text-gray-500 text-xs">Pesquisas com as assinantes — comportamento de uso e o que elas querem</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {aviso && <span className="text-xs text-green-400 bg-green-900/30 border border-green-800 px-3 py-1 rounded-full">{aviso}</span>}
          <button onClick={carregar} className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><RefreshCw size={13} /> Atualizar</button>
          <button onClick={() => { resetForm(); setCriar(true) }} className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5"><Plus size={14} /> Nova enquete</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 md:p-6">
        {loading ? <p className="text-gray-500 text-sm text-center py-12">Carregando…</p>
          : lista.length === 0 ? <p className="text-gray-600 text-sm text-center py-12">Nenhuma enquete ainda. Crie a primeira!</p> : (
            <div className="grid gap-3">
              {lista.map(e => (
                <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{e.titulo}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${e.ativo ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-700/40 text-gray-400 border-gray-600'}`}>{e.ativo ? 'Ativa' : 'Pausada'}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">{PUBLICO_LABEL[e.publico] || e.publico}</span>
                      {e.planos && <span className="text-[11px] text-gray-400">planos: {e.planos}</span>}
                      {e.modulo && <span className="text-[11px] text-gray-400">módulo: {e.modulo}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{(e.perguntas as any)?.length ?? 0} pergunta(s) · <span className="text-orange-400 font-medium">{e.respostas} resposta(s)</span> · {e.canalPopup ? 'pop-up' : ''}{e.canalEmail ? ' + e-mail' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => verResultados(e.id)} className="text-xs flex items-center gap-1 text-teal-300 border border-teal-500/40 hover:bg-teal-500/10 px-2.5 py-1.5 rounded-lg"><BarChart3 size={13} /> Resultados</button>
                    {e.canalEmail && e.ativo && <button onClick={() => enviarEmail(e)} className="text-xs flex items-center gap-1 text-orange-300 border border-orange-500/40 hover:bg-orange-500/10 px-2.5 py-1.5 rounded-lg"><Send size={13} /> E-mail</button>}
                    <button onClick={() => toggle(e)} title={e.ativo ? 'Pausar' : 'Ativar'} className={`p-1.5 rounded-lg border ${e.ativo ? 'text-green-400 border-green-500/30 hover:bg-green-500/10' : 'text-gray-400 border-gray-600 hover:bg-gray-800'}`}><Power size={14} /></button>
                    <button onClick={() => excluir(e)} className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Criar enquete */}
      {criar && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-white font-semibold">Nova enquete</h2>
              <button onClick={() => setCriar(false)}><X size={18} className="text-gray-400 hover:text-white" /></button>
            </div>
            <div className="p-6 space-y-4">
              <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título (ex.: O que você quer ver no SOA?)" className={inp + ' w-full'} />
              <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição curta (opcional)" className={inp + ' w-full'} />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Público</label>
                  <select value={publico} onChange={e => setPublico(e.target.value)} className={inp + ' w-full'}>
                    <option value="todas">Todas</option>
                    <option value="ativas">Ativas (30d)</option>
                    <option value="inativas">Inativas (30d+)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Módulo mais usado</label>
                  <select value={modulo} onChange={e => setModulo(e.target.value)} className={inp + ' w-full'}>
                    <option value="">Qualquer</option>
                    {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Canais</label>
                  <div className="flex gap-3 items-center h-9">
                    <label className="text-xs text-gray-300 flex items-center gap-1"><input type="checkbox" checked={canalPopup} onChange={e => setCanalPopup(e.target.checked)} /> Pop-up</label>
                    <label className="text-xs text-gray-300 flex items-center gap-1"><input type="checkbox" checked={canalEmail} onChange={e => setCanalEmail(e.target.checked)} /> E-mail</label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Planos (opcional — vazio = todos)</label>
                <div className="flex flex-wrap gap-1.5">
                  {PLANOS.map(p => (
                    <button key={p} onClick={() => setPlanos(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                      className={`text-xs px-2.5 py-1 rounded-lg border ${planos.includes(p) ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}>{p}</button>
                  ))}
                </div>
              </div>

              {/* Perguntas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-400 uppercase">Perguntas</label>
                  <button onClick={addPerg} className="text-xs text-orange-400 flex items-center gap-1"><Plus size={12} /> Adicionar pergunta</button>
                </div>
                {perguntas.map((p, idx) => (
                  <div key={p.id} className="bg-gray-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{idx + 1}.</span>
                      <input value={p.texto} onChange={e => setPerg(p.id, { texto: e.target.value })} placeholder="Texto da pergunta" className={inp + ' flex-1'} />
                      <select value={p.tipo} onChange={e => setPerg(p.id, { tipo: e.target.value as Tipo })} className={inp}>
                        <option value="multipla">Múltipla escolha</option>
                        <option value="escala">Escala 1–5</option>
                        <option value="texto">Texto livre</option>
                      </select>
                      <button onClick={() => delPerg(p.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={14} /></button>
                    </div>
                    {p.tipo === 'multipla' && (
                      <div className="pl-6 space-y-1.5">
                        {p.opcoes.map((o, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input value={o} onChange={e => setPerg(p.id, { opcoes: p.opcoes.map((x, k) => k === oi ? e.target.value : x) })} placeholder={`Opção ${oi + 1}`} className={inp + ' flex-1 py-1.5'} />
                            {p.opcoes.length > 2 && <button onClick={() => setPerg(p.id, { opcoes: p.opcoes.filter((_, k) => k !== oi) })} className="text-gray-500 hover:text-red-400"><X size={14} /></button>}
                          </div>
                        ))}
                        <button onClick={() => setPerg(p.id, { opcoes: [...p.opcoes, ''] })} className="text-xs text-teal-400 flex items-center gap-1"><Plus size={11} /> opção</button>
                      </div>
                    )}
                    {p.tipo === 'escala' && <p className="pl-6 text-[11px] text-gray-500">Resposta de 1 a 5 (ex.: 1 = ruim, 5 = ótimo).</p>}
                    {p.tipo === 'texto' && <p className="pl-6 text-[11px] text-gray-500">Campo aberto pra ela escrever.</p>}
                  </div>
                ))}
              </div>

              {erro && <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{erro}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-2">
              <button onClick={() => setCriar(false)} className="text-sm text-gray-400 px-4 py-2">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-5 py-2 font-medium disabled:opacity-50">{salvando ? 'Salvando…' : 'Criar enquete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {resultado && (
        <div className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setResultado(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl my-8" onClick={e => e.stopPropagation()}>
            {resultado.loading ? <div className="p-12 text-center text-gray-500 text-sm">Carregando…</div>
              : resultado.erro ? <div className="p-12 text-center text-gray-500 text-sm">Não consegui carregar.</div> : (
                <>
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                    <div>
                      <h2 className="text-white font-semibold">{resultado.enquete.titulo}</h2>
                      <p className="text-xs text-gray-500">{resultado.totalRespostas} resposta(s)</p>
                    </div>
                    <button onClick={() => setResultado(null)}><X size={18} className="text-gray-400 hover:text-white" /></button>
                  </div>
                  <div className="p-6 space-y-5">
                    {resultado.totalRespostas === 0 && <p className="text-sm text-gray-500 text-center py-6">Ainda sem respostas.</p>}
                    {resultado.resultados.map((r: any) => (
                      <div key={r.perguntaId}>
                        <p className="text-sm font-medium text-white mb-2">{r.texto} {r.tipo === 'escala' && r.media != null && <span className="text-teal-400 text-xs">· média {r.media}</span>}</p>
                        {(r.tipo === 'multipla' || r.tipo === 'escala') && (
                          <div className="space-y-1.5">
                            {r.opcoes.map((o: any) => (
                              <div key={o.opcao}>
                                <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-300">{r.tipo === 'escala' ? `Nota ${o.opcao}` : o.opcao}</span><span className="text-gray-500">{o.n} · {o.pct}%</span></div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${o.pct}%` }} /></div>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.tipo === 'texto' && (
                          <div className="space-y-1.5 max-h-52 overflow-y-auto">
                            {r.textos.length === 0 ? <p className="text-xs text-gray-600">Sem respostas de texto.</p>
                              : r.textos.map((t: any, i: number) => (
                                <div key={i} className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300"><span className="text-gray-500">{t.quem}:</span> {t.texto}</div>
                              ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
