'use client'
// app/master/estudio-fontes — curadoria do acervo de fontes do SOA Edition. Master-only (cookie
// master_token via middleware). Aprovar PUBLICA a fonte para todos os ateliês: só com licença
// aberta conferida (SIL OFL, Apache…). Fonte comercial/"free for personal use" → recusar.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, X } from 'lucide-react'

interface Fonte {
  id: string; nome: string; url: string; licenca: string | null; familia: string | null
  sugeridaGlobal: boolean; aprovadaGlobal: boolean; createdAt: string; workspaceNome: string | null
}

export default function MasterEstudioFontes() {
  const router = useRouter()
  const [fontes, setFontes] = useState<Fonte[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const r = await fetch('/api/master/estudio/fontes')
    if (r.status === 401) { router.push('/master/login'); return }
    const d = await r.json()
    setFontes(d.fontes || [])
    setCarregando(false)
    // Pré-visualização: registra cada fonte no navegador do Master.
    for (const f of (d.fontes || []) as Fonte[]) {
      if (!f.familia) continue
      try { const ff = new FontFace(f.familia, `url(${f.url})`); ff.load().then(x => document.fonts.add(x)).catch(() => {}) } catch { /* ignora */ }
    }
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  async function decidir(f: Fonte, aprovar: boolean) {
    if (aprovar && !confirm(`Publicar "${f.nome}" para TODOS os ateliês?\n\nLicença declarada: ${f.licenca || '—'}\n\nSó aprove se conferiu que a licença permite redistribuição (ex.: SIL OFL).`)) return
    await fetch('/api/master/estudio/fontes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: f.id, aprovar }) })
    carregar()
  }

  const Linha = ({ f }: { f: Fonte }) => (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-2xl text-white truncate" style={{ fontFamily: f.familia ? `"${f.familia}", sans-serif` : undefined }}>Maria Eduarda 5 anos</p>
        <p className="text-xs text-gray-400 mt-1">{f.nome} · {f.workspaceNome || '—'} · licença: <b className="text-gray-200">{f.licenca || 'não informada'}</b></p>
      </div>
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 hover:underline">baixar</a>
      {!f.aprovadaGlobal && <button onClick={() => decidir(f, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold px-2.5 py-1"><Check className="w-3.5 h-3.5" /> Aprovar</button>}
      <button onClick={() => decidir(f, false)} className="inline-flex items-center gap-1 rounded-lg border border-gray-700 text-gray-300 text-xs px-2.5 py-1"><X className="w-3.5 h-3.5" /> {f.aprovadaGlobal ? 'Retirar do acervo' : 'Recusar'}</button>
    </div>
  )

  const pendentes = fontes.filter(f => !f.aprovadaGlobal)
  const aprovadas = fontes.filter(f => f.aprovadaGlobal)
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/master" className="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Master</Link>
        <div>
          <h1 className="text-xl font-bold">Acervo de fontes — SOA Edition</h1>
          <p className="text-sm text-gray-400 mt-1">Fontes que as artesãs sobem são privadas. Aqui entram só as sugeridas; aprovar publica para todos. Na dúvida sobre a licença, recuse.</p>
        </div>
        {carregando ? <p className="text-gray-500 text-sm">Carregando…</p> : (
          <>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-amber-300">Sugestões pendentes ({pendentes.length})</h2>
              {pendentes.length ? pendentes.map(f => <Linha key={f.id} f={f} />) : <p className="text-sm text-gray-500">Nenhuma sugestão.</p>}
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-emerald-300">No acervo ({aprovadas.length})</h2>
              {aprovadas.length ? aprovadas.map(f => <Linha key={f.id} f={f} />) : <p className="text-sm text-gray-500">Nenhuma fonte publicada além das 8 nativas.</p>}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
