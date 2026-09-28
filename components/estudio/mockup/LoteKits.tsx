'use client'
// SOA Design — LOTE DE KITS (a funcionalidade de venda): escolhe o KIT → importa os temas (subpasta = tema, ou pasta única
// "sereia_milk.png") → o matcher liga cada arquivo ao slot (com confiança) e agrupa por tema → CONFERÊNCIA SÓ DAS
// EXCEÇÕES → gera TODOS os individuais + TODOS os kits numa operação, pela fila (50 temas × 6 caixas = 350 imagens),
// sem baixar/reenviar nada. Opcional: salvar cada tema como projeto (caixas vivas + kit) na hora em que a fila chega nele.
'use no memo'
import { useState } from 'react'
import { Upload, FolderOpen, AlertTriangle, Check, Loader2, Trash2, Sparkles } from 'lucide-react'
import { agruparKits, produtosDoKit, type ArquivoKit } from '@/lib/estudio/kitLote'
import { snapCaixa, type MotorKit, type KitTemplate, type Composicao, type ExportPreset } from '@/lib/estudio/kitMotor'
import { criarTema } from '@/lib/estudio/kitCriar'
import { hashArquivo, lerHistorico, lembrarCorrecao } from '@/lib/estudio/matcher'
import { sugerirCasamentosIA } from '@/lib/estudio/iaCliente'
import type { BoxTemplate, BoxInstancia } from '@/lib/estudio/caixaViva'
import type { ConfigCena } from '@/lib/estudio/mockupTipos'
import SaidasKit, { type TemaSaida } from './SaidasKit'
import { useBaseEstudio, btn, cartao } from '../caixas/comum'

type Arq = ArquivoKit & { file: File; hash: string }
const ACEITOS = /\.(png|jpe?g|webp|pdf|svg)$/i
async function doArraste(dt: DataTransfer): Promise<{ file: File; caminho: string }[]> {
  const out: { file: File; caminho: string }[] = []
  const ents = [...dt.items].map(i => i.webkitGetAsEntry?.()).filter(Boolean) as FileSystemEntry[]
  if (!ents.length) return [...dt.files].map(f => ({ file: f, caminho: f.name }))
  const andar = async (e: FileSystemEntry, pre: string): Promise<void> => {
    if (e.isFile) { const f = await new Promise<File>((r, j) => (e as FileSystemFileEntry).file(r, j)); out.push({ file: f, caminho: pre + f.name }); return }
    const l = (e as FileSystemDirectoryEntry).createReader()
    for (;;) { const lote = await new Promise<FileSystemEntry[]>((r, j) => l.readEntries(r, j)); if (!lote.length) break; for (const x of lote) await andar(x, `${pre}${e.name}/`) }
  }
  for (const e of ents) await andar(e, '')
  return out
}

export default function LoteKits({ kit, comps, tpls, mockups, presets, cenasDela, motor, onCriados }: { kit: KitTemplate; comps: Composicao[]; tpls: Map<string, BoxTemplate>; mockups: Map<string, Record<string, unknown>>; presets: ExportPreset[]; cenasDela: { id: string; nome: string; valor: ConfigCena }[]; motor: MotorKit; onCriados: () => void }) {
  const { workspaceId, storage } = useBaseEstudio()
  const [arqs, setArqs] = useState<Arq[]>([])
  const [lendo, setLendo] = useState<{ feitos: number; total: number } | null>(null)
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [parcial, setParcial] = useState<Record<string, boolean>>({})
  const [semTema, setSemTema] = useState<Record<string, boolean>>({})
  const [manter, setManter] = useState<Record<string, string>>({})   // tema|slot → arquivo que fica (repetidos)
  const [salvarProjetos, setSalvarProjetos] = useState(true)
  const [sugestoesIA, setSugestoesIA] = useState<Record<string, { alvo: string; confianca: number }>>({})
  const [verOk, setVerOk] = useState(false)
  const [erro, setErro] = useState(''); const [arrastando, setArrastando] = useState(false); const [iaOcupada, setIaOcupada] = useState(false)

  async function importar(lista: { file: File; caminho: string }[]) {
    const bons = lista.filter(x => ACEITOS.test(x.file.name) && !x.file.name.startsWith('.'))
    const novos: Arq[] = []
    setLendo({ feitos: 0, total: bons.length })
    for (let i = 0; i < bons.length; i++) {
      const { file, caminho } = bons[i], partes = caminho.split('/'), nomeArq = partes.pop()!
      let w = 1000, h = 1000
      try { if (/^image\/(png|jpe?g|webp)$/.test(file.type)) { const b = await createImageBitmap(file); w = b.width; h = b.height; b.close() } } catch { /* proporção só desempata */ }
      novos.push({ id: `k${Date.now().toString(36)}${i}`, nome: nomeArq.replace(/\.[^.]+$/, ''), caminho: caminho.replace(/\.[^.]+$/, ''), pasta: partes.join('/'), w, h, file, hash: await hashArquivo(file) })
      if (i % 10 === 9 || i === bons.length - 1) { setLendo({ feitos: i + 1, total: bons.length }); await new Promise(r => setTimeout(r, 0)) }
    }
    setArqs(a => [...a, ...novos]); setLendo(null)
  }
  const historico = lerHistorico()
  const r = agruparKits(arqs, kit, tpls, { escolhas, historico })
  const porId = new Map(arqs.map(a => [a.id, a]))
  const nomeSlot = (id: string) => kit.slots.find(s => s.id === id)?.name || id
  const excTemas = r.temas.filter(t => (t.faltando.length && !parcial[t.chave] && !semTema[t.chave]) || t.repetidos.some(x => !manter[`${t.chave}|${x.slotId}`]))
  const temasOk = r.temas.filter(t => !semTema[t.chave] && !excTemas.includes(t))

  // temas prontos para sair: caixas montadas na memória a partir dos arquivos (hash do conteúdo = cache)
  const temasSaida: TemaSaida[] = temasOk.map(t => {
    const caixas: Record<string, BoxInstancia | undefined> = {}, arquivos: Record<string, File> = {}
    for (const s of kit.slots) {
      const rep = t.repetidos.find(x => x.slotId === s.id)
      const aid = rep ? manter[`${t.chave}|${s.id}`] : t.slots[s.id]
      const a = aid ? porId.get(aid) : null
      if (!a) continue
      const tpl = tpls.get(s.boxTemplateId); if (!tpl) continue
      const url = `local:${a.hash}`
      motor.artesLocais.set(url, a.file); arquivos[s.id] = a.file
      const mid = tpl.config.mockupId || null
      caixas[s.id] = { id: `lote:${t.chave}:${s.id}`, nome: `${t.tema} · ${s.name}`, boxTemplateId: tpl.id, mockupId: mid, artworkUrl: url, faces: {}, apliques: [], saidas: [], config: { snap: snapCaixa(tpl, mid ? mockups.get(mid) || null : null) } }
    }
    return {
      chave: t.chave, tema: t.tema, caixas, comps,
      antes: salvarProjetos && storage && workspaceId ? async () => { await criarTema({ tema: t.tema, kit, comps, tpls, mockups, arquivos, workspaceId }); onCriados() } : undefined,
    }
  })

  async function pedirIA() {
    if (!r.excecoes.length) return
    setIaOcupada(true); setErro('')
    try {
      const nomes = r.excecoes.map(e => porId.get(e.arquivoId)!.caminho)
      const alvos = produtosDoKit(kit, tpls).map(p => `${p.id}: ${p.nome}${p.apelidos?.length ? ` (${p.apelidos.join(', ')})` : ''}`)
      const s = await sugerirCasamentosIA(nomes, alvos)
      if (!s.ok) { setErro(s.mensagem); return }
      const out: Record<string, { alvo: string; confianca: number }> = {}
      s.casamentos.forEach(c => { const e = r.excecoes[c.indice]; if (e && kit.slots.some(x => x.id === c.alvo)) out[e.arquivoId] = { alvo: c.alvo, confianca: c.confianca } })
      setSugestoesIA(out)
    } finally { setIaOcupada(false) }
  }

  const totalArqs = arqs.length
  return (
    <div className="space-y-3">
      <div className={`${cartao} space-y-2 ${arrastando ? 'ring-2 ring-orange-400' : ''}`} onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setArrastando(true) } }} onDragLeave={() => setArrastando(false)} onDrop={async e => { e.preventDefault(); setArrastando(false); await importar(await doArraste(e.dataTransfer)) }} data-soltar-kits>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold flex-1">Temas do lote <span className="font-normal text-xs text-gray-500">— arraste a pasta KITS (uma subpasta por tema) ou os arquivos “tema_modelo.png”</span></p>
          {!!arqs.length && <button onClick={() => { setArqs([]); setEscolhas({}); setParcial({}); setSemTema({}); setManter({}); setSugestoesIA({}) }} className={btn + ' !text-xs'}>Limpar</button>}
          <label className={btn + ' cursor-pointer !text-xs'}><FolderOpen className="w-3.5 h-3.5" /> Escolher pasta<input type="file" multiple className="hidden" data-pasta-kits {...{ webkitdirectory: '' }} onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; void importar(fs.map(f => ({ file: f, caminho: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name }))) }} /></label>
          <label className={btn + ' cursor-pointer !text-xs'}><Upload className="w-3.5 h-3.5" /> Arquivos<input type="file" multiple accept="image/*,.pdf,.svg" className="hidden" data-arquivos-kits onChange={e => { const fs = [...(e.target.files || [])]; e.target.value = ''; void importar(fs.map(f => ({ file: f, caminho: f.name }))) }} /></label>
        </div>
        {lendo && <div className="space-y-1"><p className="text-xs text-gray-600 dark:text-gray-300"><Loader2 className="inline w-3.5 h-3.5 animate-spin" /> Lendo e analisando… {lendo.feitos}/{lendo.total}</p><div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div className="h-full bg-orange-500" style={{ width: `${Math.round((lendo.feitos / Math.max(1, lendo.total)) * 100)}%` }} /></div></div>}
        {!!totalArqs && <p className="text-xs text-gray-600 dark:text-gray-300" data-resumo-lote-kits><b>{totalArqs}</b> arquivo(s) → <b>{r.casados}</b> casaram com um slot · <b>{r.temas.length}</b> tema(s) · {temasOk.length} prontos{r.excecoes.length + excTemas.length ? <> · <span className="text-amber-700 font-semibold">{r.excecoes.length + excTemas.length} pedem atenção</span></> : ' ✓'}</p>}
      </div>

      {!!r.excecoes.length && (
        <div className={`${cartao} space-y-1.5 border-amber-300`} data-excecoes-arquivo>
          <div className="flex items-center gap-2"><p className="text-sm font-semibold flex-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-600" /> {r.excecoes.length} arquivo(s) sem slot certo</p>
            <button onClick={pedirIA} disabled={iaOcupada} className={btn + ' !text-xs'} title="A IA só SUGERE — você confirma" data-sugerir-ia>{iaOcupada ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-violet-600" />} Sugerir com IA</button></div>
          {r.excecoes.map(e => { const a = porId.get(e.arquivoId)!, sug = sugestoesIA[a.id]; return (
            <div key={a.id} className="flex items-center gap-2 text-xs" data-excecao-kit={a.caminho}>
              <span className="flex-1 truncate">{a.caminho} <span className="text-amber-700">— {e.motivo}{e.empate ? `: ${e.empate.map(nomeSlot).join(' ou ')}` : ''}</span>{sug && <span className="text-violet-700"> · IA sugere: {nomeSlot(sug.alvo)} ({Math.round(sug.confianca * 100)}%) <button onClick={() => { setEscolhas(x => ({ ...x, [a.id]: sug.alvo })); lembrarCorrecao(a.nome, sug.alvo) }} className="underline font-semibold" data-aceitar-ia>aceitar</button></span>}</span>
              <select className="border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 bg-white dark:bg-gray-800" value="" onChange={ev => { const v = ev.target.value; if (!v) return; setEscolhas(x => ({ ...x, [a.id]: v })); if (v !== 'ignorar') lembrarCorrecao(a.nome, v) }}>
                <option value="">escolher o slot…</option>{kit.slots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="ignorar">ignorar</option>
              </select>
            </div>) })}
        </div>
      )}
      {!!excTemas.length && (
        <div className={`${cartao} space-y-1.5 border-amber-300`} data-excecoes-tema>
          <p className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-600" /> {excTemas.length} tema(s) incompleto(s)</p>
          {excTemas.map(t => (
            <div key={t.chave} className="text-xs space-y-1 rounded-lg border border-amber-200 px-2 py-1.5" data-tema-excecao={t.tema}>
              <p className="font-medium">{t.tema}</p>
              {!!t.faltando.length && <p className="flex flex-wrap items-center gap-2">Falta: {t.faltando.map(nomeSlot).join(', ')} <button onClick={() => setParcial(x => ({ ...x, [t.chave]: true }))} className="rounded bg-emerald-600 text-white px-1.5" data-gerar-parcial>gerar parcial (sem essas caixas)</button><button onClick={() => setSemTema(x => ({ ...x, [t.chave]: true }))} className="text-gray-500 underline">ignorar o tema</button></p>}
              {t.repetidos.filter(x => !manter[`${t.chave}|${x.slotId}`]).map(x => <p key={x.slotId} className="flex items-center gap-2">Dois arquivos para {nomeSlot(x.slotId)}: <select className="border border-gray-200 rounded px-1 bg-white dark:bg-gray-800" value="" onChange={ev => setManter(m => ({ ...m, [`${t.chave}|${x.slotId}`]: ev.target.value }))} data-repetido><option value="">qual fica?</option>{x.arquivos.map(aid => <option key={aid} value={aid}>{porId.get(aid)?.caminho}</option>)}</select></p>)}
            </div>
          ))}
        </div>
      )}
      {!!temasOk.length && (
        <div className={`${cartao} space-y-1`}>
          <button onClick={() => setVerOk(v => !v)} className="text-xs text-emerald-700 inline-flex items-center gap-1" data-ver-temas-ok><Check className="w-3.5 h-3.5" /> {temasOk.length} tema(s) prontos {verOk ? '' : '(ver)'}</button>
          {verOk && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1 text-[11px]">{temasOk.map(t => <div key={t.chave} className="flex items-center gap-1.5 rounded border border-gray-200 dark:border-gray-700 px-1.5 py-1" data-tema-ok={t.tema}><span className="flex-1 truncate font-medium">{t.tema}</span><span className="text-gray-400">{Object.keys(t.slots).length}/{kit.slots.length}</span><button onClick={() => setSemTema(x => ({ ...x, [t.chave]: true }))} title="Tirar do lote"><Trash2 className="w-3 h-3 text-gray-400 hover:text-red-600" /></button></div>)}</div>}
        </div>
      )}
      {!!temasSaida.length && (
        <>
          <label className="text-xs text-gray-600 dark:text-gray-300 inline-flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={salvarProjetos} onChange={e => setSalvarProjetos(e.target.checked)} disabled={!storage} data-salvar-projetos /> Salvar cada tema como projeto (caixas vivas + kit) — dá para editar e regenerar depois</label>
          <SaidasKit kit={kit} temas={temasSaida} comps={comps} presets={presets} cenasDela={cenasDela} motor={motor} gravar={false} rotulo="Gerar o lote:" />
        </>
      )}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
    </div>
  )
}
