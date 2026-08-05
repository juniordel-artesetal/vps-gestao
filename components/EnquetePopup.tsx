'use client'
// Pop-up de enquete: aparece 1x quando há enquete pendente pro workspace. Não
// intrusivo (surge com um respiro; dá pra "responder depois" = adia 3 dias, ou
// fechar). Ao responder, o servidor marca (não repete). Sem enquete → nada.
import { useEffect, useState } from 'react'
import { X, ClipboardList, Check } from 'lucide-react'

type Tipo = 'multipla' | 'escala' | 'texto'
interface Pergunta { id: string; texto: string; tipo: Tipo; opcoes?: string[] }
interface Enquete { id: string; titulo: string; descricao: string | null; perguntas: Pergunta[] }

const ADIAR_MS = 3 * 24 * 60 * 60 * 1000 // 3 dias

export default function EnquetePopup() {
  const [enq, setEnq] = useState<Enquete | null>(null)
  const [mostrar, setMostrar] = useState(false)
  const [resp, setResp] = useState<Record<string, string | number>>({})
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch('/api/enquetes/pendente')
      .then(r => r.ok ? r.json() : { enquete: null })
      .then((d: any) => {
        if (!vivo || !d?.enquete) return
        const e: Enquete = d.enquete
        try {
          const ate = Number(localStorage.getItem(`enquete_adiada_${e.id}`) || 0)
          if (ate && Date.now() < ate) return // adiada
        } catch { /* localStorage indisponível — mostra mesmo assim */ }
        setEnq(e)
        setTimeout(() => vivo && setMostrar(true), 1500) // respiro
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  function adiar() {
    if (enq) { try { localStorage.setItem(`enquete_adiada_${enq.id}`, String(Date.now() + ADIAR_MS)) } catch {} }
    setMostrar(false)
  }

  async function enviar() {
    if (!enq) return
    setEnviando(true)
    try {
      await fetch(`/api/enquetes/${enq.id}/responder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respostas: resp }),
      })
      setPronto(true)
      try { localStorage.setItem(`enquete_adiada_${enq.id}`, String(Date.now() + 3.15e11)) } catch {}
      setTimeout(() => setMostrar(false), 1800)
    } finally { setEnviando(false) }
  }

  if (!enq || !mostrar) return null

  // Habilita enviar só quando ao menos uma pergunta foi respondida.
  const algumaRespondida = Object.values(resp).some(v => v !== '' && v != null)

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/40" onClick={adiar}>
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {pronto ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-3"><Check className="text-green-600 dark:text-green-400" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Obrigada pela resposta! 💛</h3>
            <p className="text-sm text-gray-500 mt-1">Sua opinião ajuda a melhorar o SOA pra você.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center flex-shrink-0"><ClipboardList size={17} className="text-orange-500" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">{enq.titulo}</h3>
                  {enq.descricao && <p className="text-xs text-gray-500 mt-0.5">{enq.descricao}</p>}
                </div>
              </div>
              <button onClick={adiar} className="text-gray-400 hover:text-gray-600 dark:hover:text-white flex-shrink-0"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5">
              {enq.perguntas.map((p, i) => (
                <div key={p.id}>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">{i + 1}. {p.texto}</p>
                  {p.tipo === 'multipla' && (
                    <div className="space-y-1.5">
                      {(p.opcoes || []).map(o => (
                        <button key={o} onClick={() => setResp(r => ({ ...r, [p.id]: o }))}
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition ${resp[p.id] === o ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'}`}>
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                  {p.tipo === 'escala' && (
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setResp(r => ({ ...r, [p.id]: n }))}
                          className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition ${resp[p.id] === n ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                  {p.tipo === 'texto' && (
                    <textarea value={String(resp[p.id] || '')} onChange={e => setResp(r => ({ ...r, [p.id]: e.target.value }))}
                      rows={3} placeholder="Escreva aqui…"
                      className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2 flex-shrink-0">
              <button onClick={adiar} className="flex-1 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-xl py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800">Responder depois</button>
              <button onClick={enviar} disabled={enviando || !algumaRespondida}
                className="flex-1 text-sm font-medium bg-orange-500 text-white rounded-xl py-2.5 hover:bg-orange-600 disabled:opacity-50">
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
