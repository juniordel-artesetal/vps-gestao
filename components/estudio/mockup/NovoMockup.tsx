'use client'
// SOA Edition — PRODUTO-MOCKUP (Fluxo A): foto do produto liso → isolar (IA ou recorte automático) →
// área de aplicação (4 pontos ou malha) → luz/sombra/cor → salvar para reutilizar com qualquer arte.
'use no memo'
import { useState } from 'react'
import { Loader2, Wand2, Scissors, Save, X, Upload } from 'lucide-react'
import { removerFundoLocal, proporArea, comporMockup, novoCanvas, blobDe } from '@/lib/estudio/mockup'
import { removerFundoIA, CUSTO_IA } from '@/lib/estudio/iaCliente'
import { converterArea } from '@/lib/estudio/areaMolde'
import { carregarMolde, enviarArquivo } from '@/lib/estudio/cliente'
import { LS_PADRAO, type ConfigMockup } from '@/lib/estudio/mockupTipos'
import { arteDeTeste, type MockupPronto } from '@/lib/estudio/mockupCliente'
import EditorArea from './EditorArea'
import { useBaseEstudio, inp, lbl, btn, btnP, num } from '../caixas/comum'

export default function NovoMockup({ editar, onFechar, onSalvo }: { editar?: MockupPronto | null; onFechar: () => void; onSalvo: () => void }) {
  const { workspaceId, storage } = useBaseEstudio()
  const [foto, setFoto] = useState<HTMLCanvasElement | null>(null)
  const [produto, setProduto] = useState<HTMLCanvasElement | null>(editar?.produto || null)
  const [cfg, setCfg] = useState<ConfigMockup | null>(editar?.cfg || null)
  const [arte, setArte] = useState<HTMLCanvasElement>(() => arteDeTeste())
  const [nome, setNome] = useState(editar?.nome || '')
  const [medidas, setMedidas] = useState({ l: String(editar?.medidas.largura ?? ''), a: String(editar?.medidas.altura ?? ''), p: String(editar?.medidas.profundidade ?? '') })
  const [ocupado, setOcupado] = useState(''); const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')

  async function abrirFoto(f: File) {
    setErro(''); setAviso('')
    try {
      const m = await carregarMolde(f)
      const k = Math.min(1, 2400 / Math.max(m.largura, m.altura))
      const c = novoCanvas(m.largura * k, m.altura * k); c.getContext('2d')!.drawImage(m.fonte, 0, 0, c.width, c.height)
      setFoto(c); setProduto(null); setCfg(null)
      if (!nome) setNome(f.name.replace(/\.[^.]+$/, '').slice(0, 60))
    } catch (e) { setErro((e as Error).message) }
  }
  function usarProduto(p: HTMLCanvasElement) {
    setProduto(p)
    setCfg({ area: proporArea(p), recorte: null, ls: LS_PADRAO, cor: null, opacidade: 100 })
  }
  async function isolar(modo: 'ia' | 'local' | 'nada') {
    if (!foto) return
    setErro(''); setAviso('')
    if (modo === 'nada') { usarProduto(foto); return }
    if (modo === 'local') { setOcupado('Recortando…'); await new Promise(r => setTimeout(r, 20)); try { usarProduto(removerFundoLocal(foto)) } finally { setOcupado('') } return }
    if (!confirm(CUSTO_IA)) return
    setOcupado('A IA está recortando o produto…')
    try { const r = await removerFundoIA(foto); usarProduto(r.canvas); if (r.aviso) setAviso(r.aviso) }
    finally { setOcupado('') }
  }

  async function salvar() {
    if (!produto || !cfg) return
    if (!nome.trim()) { setErro('Dê um nome ao mockup.'); return }
    if (!storage || !workspaceId) { setErro('Armazenamento indisponível neste ambiente.'); return }
    setOcupado('Salvando…'); setErro('')
    try {
      const corpo: Record<string, unknown> = {
        nome: nome.trim(), tipo: 'proprio', areaAplicacao: cfg.area, sombra: cfg.ls, luz: { luz: cfg.ls.luz, direcao: cfg.ls.direcao },
        config: { cor: cfg.cor, opacidade: cfg.opacidade, recorte: cfg.recorte, medidas: { largura: num(medidas.l, 10), altura: num(medidas.a, 10), profundidade: medidas.p ? num(medidas.p) : null } },
      }
      // prévia leve com a arte de teste
      const pv = comporMockup(produto, arte, cfg)
      const k = 280 / Math.max(pv.width, pv.height), mini = novoCanvas(pv.width * k, pv.height * k), gm = mini.getContext('2d')!
      gm.fillStyle = '#fff'; gm.fillRect(0, 0, mini.width, mini.height); gm.drawImage(pv, 0, 0, mini.width, mini.height)
      corpo.previewUrl = mini.toDataURL('image/jpeg', 0.75)
      if (!editar || foto) {
        // recorte (PNG com transparência) + foto original leve — os dois no Blob; original pesado não sobe
        const rec = await enviarArquivo(await blobDe(produto, 'image/png'), `${nome.trim()}-recorte.png`, 'mockup', workspaceId, { pasta: 'Mockups', meta: { largura: produto.width, altura: produto.height, recorte: true } })
        corpo.produtoRecortadoAssetId = rec.id; corpo.recorteUrl = rec.url
        if (foto) { const fo = await enviarArquivo(await blobDe(foto, 'image/jpeg', 0.9), `${nome.trim()}-foto.jpg`, 'mockup', workspaceId, { pasta: 'Mockups', meta: { largura: foto.width, altura: foto.height } }); corpo.fotoAssetId = fo.id; corpo.fotoUrl = fo.url }
      }
      const r = editar && editar.origem === 'meu'
        ? await fetch(`/api/estudio/mockups/${editar.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
        : await fetch('/api/estudio/mockups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não consegui salvar.')
      onSalvo()
    } catch (e) { setErro((e as Error).message) } finally { setOcupado('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{editar ? 'Ajustar mockup' : 'Novo produto-mockup'}</h3>
            <p className="text-xs text-gray-500">Fotografe o produto LISO (em branco), de preferência sobre um fundo liso. A arte vai seguir a perspectiva e receber a luz e a sombra da foto.</p>
          </div>
          <button onClick={onFechar}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {!produto && (
          <div className="space-y-3">
            <label className={`${btn} cursor-pointer`}><Upload className="w-4 h-4" /> {foto ? 'Trocar a foto' : 'Escolher a foto do produto'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) abrirFoto(f); e.target.value = '' }} />
            </label>
            {foto && (
              <div className="space-y-2">
                <img src={foto.toDataURL('image/jpeg', 0.7)} alt="" className="max-h-72 rounded-xl border border-gray-200" />
                <p className="text-sm font-medium">Isolar o produto (tirar o fundo):</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => isolar('ia')} disabled={!!ocupado} className={btnP}><Wand2 className="w-4 h-4" /> Com IA (1 imagem da cota)</button>
                  <button onClick={() => isolar('local')} disabled={!!ocupado} className={btn}><Scissors className="w-4 h-4" /> Automático (fundo liso, grátis)</button>
                  <button onClick={() => isolar('nada')} disabled={!!ocupado} className={btn}>Usar a foto inteira</button>
                </div>
              </div>
            )}
          </div>
        )}

        {produto && cfg && (
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="space-y-2">
              <EditorArea produto={produto} cfg={cfg} arte={arte} onCfg={setCfg} />
              <p className="text-[11px] text-gray-500">Arraste os pontos laranja até os cantos da área onde a arte vai. Superfície curva (caneca, garrafa)? Use “Malha”.</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex gap-1.5">
                {(['perspectiva', 'malha'] as const).map(t => <button key={t} onClick={() => setCfg({ ...cfg, area: converterArea(cfg.area, t) })} className={`${btn} text-xs ${cfg.area.tipo === t ? '!border-orange-500 text-orange-600' : ''}`}>{t === 'perspectiva' ? '4 pontos' : 'Malha 3×3'}</button>)}
                <button onClick={() => setCfg({ ...cfg, area: proporArea(produto) })} className={`${btn} text-xs`}>Detectar</button>
              </div>
              <label className="block text-xs">Sombra da foto na arte {cfg.ls.sombra}%<input type="range" min={0} max={100} value={cfg.ls.sombra} onChange={e => setCfg({ ...cfg, ls: { ...cfg.ls, sombra: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
              <label className="block text-xs">Brilho da foto na arte {cfg.ls.luz}%<input type="range" min={0} max={100} value={cfg.ls.luz} onChange={e => setCfg({ ...cfg, ls: { ...cfg.ls, luz: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
              <label className="block text-xs">Direção da luz {cfg.ls.direcao}°<input type="range" min={0} max={180} value={cfg.ls.direcao} onChange={e => setCfg({ ...cfg, ls: { ...cfg.ls, direcao: Number(e.target.value) } })} className="w-full accent-orange-500" /></label>
              <label className="block text-xs">Opacidade da arte {cfg.opacidade}%<input type="range" min={20} max={100} value={cfg.opacidade} onChange={e => setCfg({ ...cfg, opacidade: Number(e.target.value) })} className="w-full accent-orange-500" /></label>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" className="accent-orange-500" checked={!!cfg.cor} onChange={e => setCfg({ ...cfg, cor: e.target.checked ? { cor: '#f9a8d4', intensidade: 80 } : null })} /> Cor do produto</label>
                {cfg.cor && <><input type="color" value={cfg.cor.cor} onChange={e => setCfg({ ...cfg, cor: { ...cfg.cor!, cor: e.target.value } })} className="w-8 h-6 rounded border" /><input type="range" min={10} max={100} value={cfg.cor.intensidade} onChange={e => setCfg({ ...cfg, cor: { ...cfg.cor!, intensidade: Number(e.target.value) } })} className="flex-1 accent-orange-500" /></>}
              </div>
              <label className={`${btn} cursor-pointer text-xs`}>Testar com uma arte minha<input type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; const m = await carregarMolde(f); const c = novoCanvas(m.largura, m.altura); c.getContext('2d')!.drawImage(m.fonte, 0, 0); setArte(c) }} /></label>
              <div><label className={lbl}>Medidas reais (cm) — para a foto de medidas</label>
                <div className="grid grid-cols-3 gap-1">{(['l', 'a', 'p'] as const).map(k => <input key={k} className={inp} inputMode="decimal" placeholder={k === 'l' ? 'larg.' : k === 'a' ? 'alt.' : 'prof.'} value={medidas[k]} onChange={e => setMedidas(m => ({ ...m, [k]: e.target.value.replace(/[^\d.,]/g, '') }))} />)}</div>
              </div>
              <div><label className={lbl}>Nome</label><input className={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Caneca branca 325 ml" /></div>
              <div className="flex gap-2">
                <button onClick={salvar} disabled={!!ocupado} className={btnP}>{ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar mockup</button>
                {!editar && <button onClick={() => { setProduto(null); setCfg(null) }} className={btn}>Voltar</button>}
              </div>
            </div>
          </div>
        )}
        {(ocupado || erro || aviso) && <p className={`text-sm ${erro ? 'text-red-600' : 'text-gray-600'}`}>{ocupado ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {ocupado}</span> : erro || aviso}</p>}
      </div>
    </div>
  )
}
