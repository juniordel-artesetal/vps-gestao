'use client'
// Painel "Fontes": lista as fontes INSTALADAS no computador (Local Font Access). Nenhuma fonte é enviada
// ao servidor; a prévia usa a própria fonte instalada pelo nome da família.
import { useState } from 'react'
import { Type, Search, AlertTriangle, Loader2 } from 'lucide-react'
import { listarFontes, type ResultadoFontes } from '@/lib/mae/fontes/fontesLocais'

const MOSTRAR = 300

export default function PainelFontes() {
  const [res, setRes] = useState<ResultadoFontes | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')

  async function listar() {
    setCarregando(true)
    try { setRes(await listarFontes()) } finally { setCarregando(false) }
  }
  const termo = busca.trim().toLowerCase()
  const familias = res?.ok ? res.familias.filter(f => !termo || f.family.toLowerCase().includes(termo)) : []

  return (
    <section className="space-y-2" data-painel-fontes>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Fontes do computador</h2>
      <button onClick={listar} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40">
        {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Type className="w-3.5 h-3.5" />} Listar fontes instaladas
      </button>
      {res && !res.ok && <p className="text-xs text-red-600 flex items-start gap-1" data-erro-fontes><AlertTriangle className="w-3.5 h-3.5 mt-px" />{res.mensagem}</p>}
      {res?.ok && (
        <>
          <p className="text-xs text-gray-500" data-contagem-fontes><b>{res.familias.length}</b> famílias · {res.total} estilos instalados</p>
          <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fonte (ex.: Pacifico)" className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent pl-7 pr-2 py-1.5 text-xs" /></div>
          <ul className="max-h-72 overflow-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800" data-lista-fontes>
            {familias.slice(0, MOSTRAR).map(f => (
              <li key={f.family} className="px-2 py-1.5" title={f.estilos.map(e => e.postscriptName).join(', ')}>
                <p className="text-base leading-tight truncate" style={{ fontFamily: `"${f.family}", system-ui` }}>{f.family}</p>
                <p className="text-[10px] text-gray-400">{f.estilos.length} estilo(s) · {f.estilos[0]?.postscriptName}</p>
              </li>
            ))}
            {!familias.length && <li className="px-2 py-3 text-xs text-gray-400">Nenhuma fonte com esse nome.</li>}
          </ul>
          {familias.length > MOSTRAR && <p className="text-[10px] text-gray-400">Mostrando {MOSTRAR} de {familias.length} — refine a busca.</p>}
        </>
      )}
    </section>
  )
}
