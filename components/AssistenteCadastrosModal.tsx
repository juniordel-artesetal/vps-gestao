'use client'

// Modal do "Assistente de Cadastros" (assinante ATUAL, em Configurações).
// Popula materiais + produtos (com composição, SEM preços) dos segmentos escolhidos.
// NÃO cria setores nem mexe no fluxo de produção de quem já opera. Idempotente:
// rodar de novo não duplica (dedup por nome). A artesã só preenche os valores dela.
import { useState, useEffect } from 'react'
import { X, Sparkles, Check, Loader2, PackagePlus } from 'lucide-react'

interface SegResumo { id: string; nome: string; icone: string; produtos: number; materiais: number }
interface Resultado {
  produtosCriados: number; produtosPulados: number
  materiaisCriados: number; materiaisReusados: number
  segmentos: string[]; ignorados: string[]
}

export default function AssistenteCadastrosModal({ onClose }: { onClose: () => void }) {
  const [segmentos, setSegmentos] = useState<SegResumo[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [rodando, setRodando] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/onboarding/assistente-cadastros')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSegmentos(d.segmentos || []))
      .catch(() => setErro('Não foi possível carregar os segmentos.'))
      .finally(() => setCarregando(false))
  }, [])

  function toggle(id: string) {
    setSel(prev => {
      const novo = new Set(prev)
      novo.has(id) ? novo.delete(id) : novo.add(id)
      return novo
    })
  }

  async function popular() {
    if (sel.size === 0) { setErro('Escolha ao menos um segmento.'); return }
    setRodando(true); setErro(''); setResultado(null)
    try {
      const res = await fetch('/api/onboarding/assistente-cadastros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmentos: [...sel] }),
      })
      const d = await res.json()
      if (!res.ok) { setErro(d.error || 'Erro ao popular o catálogo.'); return }
      setResultado(d)
    } catch { setErro('Erro ao popular o catálogo.') }
    finally { setRodando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
              <Sparkles size={17} className="text-orange-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Assistente de Cadastros</h2>
              <p className="text-xs text-gray-400">Popule materiais e produtos do seu segmento — sem preços, você só ajusta os valores.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={18} /></button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-5">
          {carregando && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 py-8">
              <Loader2 size={16} className="animate-spin" /> Carregando segmentos...
            </div>
          )}

          {!carregando && !resultado && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Marque um ou mais segmentos. Vamos criar os <strong>materiais</strong> e os <strong>produtos com composição</strong> já montada.
                Nada é sobrescrito: o que já existe é reaproveitado.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {segmentos.map(s => {
                  const on = sel.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`flex items-center gap-2.5 text-left p-3 rounded-xl border transition ${
                        on
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <span className="text-xl flex-shrink-0">{s.icone}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-gray-800 dark:text-white truncate">{s.nome}</span>
                        <span className="block text-xs text-gray-400">{s.produtos} produtos · {s.materiais} materiais</span>
                      </span>
                      <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                        on ? 'bg-orange-500 border-orange-500' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {on && <Check size={11} className="text-white" />}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {resultado && (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <Check size={22} className="text-green-500" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Catálogo populado! 🎉</p>
              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p><strong className="text-gray-700 dark:text-gray-200">{resultado.produtosCriados}</strong> produtos criados{resultado.produtosPulados > 0 && <> · {resultado.produtosPulados} já existiam</>}</p>
                <p><strong className="text-gray-700 dark:text-gray-200">{resultado.materiaisCriados}</strong> materiais criados{resultado.materiaisReusados > 0 && <> · {resultado.materiaisReusados} reaproveitados</>}</p>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Agora é só abrir a <strong>Precificação</strong> e preencher os valores dos seus materiais — os produtos já vêm com a composição pronta.
              </p>
            </div>
          )}

          {erro && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mt-3">{erro}</p>}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          {!resultado ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancelar
              </button>
              <button
                onClick={popular}
                disabled={rodando || sel.size === 0}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {rodando ? <><Loader2 size={15} className="animate-spin" /> Populando...</> : <><PackagePlus size={15} /> Popular meu catálogo{sel.size > 0 ? ` (${sel.size})` : ''}</>}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition">
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
