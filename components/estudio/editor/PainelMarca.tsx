'use client'
// SOA Edition — KIT DA MARCA (Canva Brand Kit): cores, fontes e logos do ateliê, aplicáveis com 1
// clique em qualquer design. Cor → preenche a camada selecionada (ou o fundo); fonte → texto
// selecionado; logo → entra como objeto inteligente.
import { useEffect, useState } from 'react'
import { Palette, Plus, X, Upload, ImagePlus, Loader2 } from 'lucide-react'
import { FONTES_NATIVAS } from '../fontesNativas'

interface Logo { id: string; nome: string; url: string; meta?: { proxyUrl?: string; versao?: number } }
interface Kit { cores: string[]; fontes: string[]; logos: Logo[] }
export interface FonteKit { id: string; nome: string }

export default function PainelMarca({ corAtual, fonteAtual, fontesDisponiveis, onCor, onFonte, onLogo, onEnviarLogo }: {
  /** Cor da camada selecionada (para "adicionar esta cor"). */
  corAtual: string | null
  /** Fonte do texto selecionado ("fredoka" ou "u:<assetId>"). */
  fonteAtual: string | null
  fontesDisponiveis: FonteKit[]
  onCor: (cor: string) => void
  onFonte: (id: string) => void
  onLogo: (l: Logo) => void
  /** Sobe um arquivo e devolve o asset (para virar logo do kit). */
  onEnviarLogo: (f: File) => Promise<Logo | null>
}) {
  const [kit, setKit] = useState<Kit | null>(null)
  const [nova, setNova] = useState('#f97316')
  const [lib, setLib] = useState<Logo[] | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { fetch('/api/estudio/marca').then(r => r.json()).then(d => setKit({ cores: d.cores || [], fontes: d.fontes || [], logos: d.logos || [] })).catch(() => setKit({ cores: [], fontes: [], logos: [] })) }, [])

  async function salvar(k: Kit) {
    setKit(k)
    await fetch('/api/estudio/marca', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cores: k.cores, fontes: k.fontes, logos: k.logos.map(l => l.id) }) }).catch(() => {})
  }
  const nomeFonte = (id: string) => FONTES_NATIVAS.find(f => f.id === id)?.rotulo || fontesDisponiveis.find(f => f.id === id)?.nome || 'Fonte'

  if (!kit) return <p className="text-xs text-gray-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando o kit…</p>
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 inline-flex items-center gap-1"><Palette className="w-3.5 h-3.5 text-orange-500" /> Kit da marca <span className="font-normal text-gray-400">— vale em todos os designs</span></p>

      <div>
        <p className="text-[10px] text-gray-500 mb-1">Cores (clique aplica na camada selecionada; sem seleção, no fundo)</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {kit.cores.map(c => (
            <span key={c} className="relative group">
              <button onClick={() => onCor(c)} className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm" style={{ background: c }} title={c} />
              <button onClick={() => salvar({ ...kit, cores: kit.cores.filter(x => x !== c) })} className="absolute -top-1 -right-1 hidden group-hover:block bg-white dark:bg-gray-800 rounded-full"><X className="w-3 h-3 text-gray-500" /></button>
            </span>
          ))}
          <input type="color" value={nova} onChange={e => setNova(e.target.value)} className="w-7 h-7 rounded border border-gray-200" title="Nova cor" />
          <button onClick={() => salvar({ ...kit, cores: [...kit.cores, nova] })} className="text-[10px] rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-1.5 py-1 inline-flex items-center gap-0.5 hover:border-orange-400"><Plus className="w-3 h-3" /> cor</button>
          {corAtual && !kit.cores.includes(corAtual.toLowerCase()) && /^#[0-9a-f]{6}$/i.test(corAtual) && (
            <button onClick={() => salvar({ ...kit, cores: [...kit.cores, corAtual.toLowerCase()] })} className="text-[10px] text-orange-600 hover:underline">+ a cor selecionada</button>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] text-gray-500 mb-1">Fontes da marca (clique aplica no texto selecionado)</p>
        <div className="flex flex-wrap gap-1">
          {kit.fontes.map(f => (
            <span key={f} className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700">
              <button onClick={() => onFonte(f)} className="text-[11px] px-2 py-1">{nomeFonte(f)}</button>
              <button onClick={() => salvar({ ...kit, fontes: kit.fontes.filter(x => x !== f) })} className="pr-1 text-gray-300 hover:text-red-600"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {fonteAtual && !kit.fontes.includes(fonteAtual) && (
            <button onClick={() => salvar({ ...kit, fontes: [...kit.fontes, fonteAtual] })} className="text-[10px] rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-1.5 py-1 inline-flex items-center gap-0.5 hover:border-orange-400"><Plus className="w-3 h-3" /> {nomeFonte(fonteAtual)}</button>
          )}
          {!kit.fontes.length && !fonteAtual && <span className="text-[10px] text-gray-400">Selecione um texto com a fonte da marca e adicione aqui.</span>}
        </div>
      </div>

      <div>
        <p className="text-[10px] text-gray-500 mb-1">Logos (clique coloca no design)</p>
        <div className="flex flex-wrap gap-1.5 items-center">
          {kit.logos.map(l => (
            <span key={l.id} className="relative group">
              <button onClick={() => onLogo(l)} className="w-14 h-14 rounded-lg border border-gray-200 dark:border-gray-700 bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#fff_0%_50%)] bg-[length:8px_8px] p-1">
                <img src={l.meta?.proxyUrl || l.url} alt={l.nome} className="w-full h-full object-contain" />
              </button>
              <button onClick={() => salvar({ ...kit, logos: kit.logos.filter(x => x.id !== l.id) })} className="absolute -top-1 -right-1 hidden group-hover:block bg-white dark:bg-gray-800 rounded-full"><X className="w-3 h-3 text-gray-500" /></button>
            </span>
          ))}
          <label className="w-14 h-14 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-[9px] text-gray-500 cursor-pointer hover:border-orange-400">
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> enviar</>}
            <input type="file" accept="image/*" className="hidden" onChange={async e => {
              const f = e.target.files?.[0]; e.target.value = ''
              if (!f) return
              setEnviando(true)
              try { const l = await onEnviarLogo(f); if (l) await salvar({ ...kit, logos: [...kit.logos, l] }) } finally { setEnviando(false) }
            }} />
          </label>
          <button onClick={async () => {
            const d = await fetch('/api/estudio/assets').then(r => r.json()).catch(() => ({ assets: [] }))
            setLib((d.assets || []).filter((a: { mime: string | null; tipo: string }) => (a.mime || '').startsWith('image/') && a.tipo !== 'gerado'))
          }} className="w-14 h-14 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center text-[9px] text-gray-500 hover:border-orange-400"><ImagePlus className="w-4 h-4" /> arquivos</button>
        </div>
        {lib && (
          <div className="mt-2 grid grid-cols-4 gap-1 max-h-40 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 p-1">
            {lib.map(a => (
              <button key={a.id} onClick={() => { if (!kit.logos.some(x => x.id === a.id)) salvar({ ...kit, logos: [...kit.logos, a] }); setLib(null) }} className="rounded border border-gray-100 dark:border-gray-800 hover:border-orange-400 p-0.5">
                <img src={a.meta?.proxyUrl || a.url} alt="" className="w-full aspect-square object-contain" />
              </button>
            ))}
            {!lib.length && <p className="col-span-4 text-[10px] text-gray-400 p-2">Nenhuma imagem guardada.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
