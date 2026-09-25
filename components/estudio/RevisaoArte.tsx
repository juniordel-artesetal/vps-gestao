'use client'
// SOA Edition — revisão da arte importada. Com CAMADAS: lista todas (texto × imagem/vetor), já liga as de
// texto aos campos e deixa marcar qualquer outra como "é o nome/idade" (ela some do fundo = fundo limpo).
// ACHATADA: "quer que eu procure os textos?" (OCR assistente + cobertura). Termina sempre no mesmo lugar:
// campos {nome}/{idade}/… posicionados no editor.
import { useEffect, useRef } from 'react'
import { X, Loader2, ScanText, Layers, Info, Type, Image as ImageIcon, FolderTree } from 'lucide-react'
import { campoDaCamada, modeloDoTexto, type ArteImportada, type CampoDetectado, type PapelCampo } from '@/lib/estudio/importarArte'

export type ModoCobertura = 'entorno' | 'cor' | 'nenhuma'

export default function RevisaoArte({ arte, campos, fase, ocupado, cobertura, onCobertura, onCampos, onProcurar, onConfirmar, onManual }: {
  arte: ArteImportada
  campos: CampoDetectado[]
  fase: 'perguntar' | 'confirmar'
  ocupado: boolean
  cobertura: ModoCobertura
  onCobertura: (m: ModoCobertura) => void
  onCampos: (c: CampoDetectado[]) => void
  onProcurar: () => void
  onConfirmar: () => void
  onManual: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const src = arte.original
    const k = Math.min(360 / src.width, 420 / src.height)
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k)
    const g = c.getContext('2d')!
    g.drawImage(src, 0, 0, c.width, c.height)
    // camadas sem campo: contorno azul claro (dá para ver onde cada uma está)
    g.setLineDash([3, 3]); g.strokeStyle = 'rgba(14,165,233,0.55)'; g.lineWidth = 1
    for (const l of arte.lista) if (l.bbox && !campos.some(cp => cp.camadaId === l.id)) g.strokeRect(l.bbox.x * k, l.bbox.y * k, l.bbox.w * k, l.bbox.h * k)
    g.setLineDash([])
    for (const cp of campos) {
      g.save()
      g.translate((cp.x + cp.w / 2) * k, (cp.y + cp.h / 2) * k); g.rotate((cp.rotacao * Math.PI) / 180)
      g.strokeStyle = cp.incluir ? '#f97316' : '#94a3b8'; g.lineWidth = 2; g.setLineDash(cp.incluir ? [] : [4, 3])
      g.strokeRect((-cp.w / 2) * k, (-cp.h / 2) * k, cp.w * k, cp.h * k)
      g.restore()
    }
  }, [arte, campos])

  const mudar = (id: string, p: Partial<CampoDetectado>) => onCampos(campos.map(c => (c.id === id ? { ...c, ...p } : c)))
  const achatado = arte.caminho === 'achatado'
  const nIncluidos = campos.filter(c => c.incluir).length
  const semCampo = arte.lista.filter(l => l.tipo !== 'texto' && !campos.some(c => c.camadaId === l.id))
  const marcar = (id: string, papel: PapelCampo) => { const cp = campoDaCamada(arte, id, papel); if (cp) onCampos([...campos, cp]) }
  const nTexto = arte.lista.filter(l => l.tipo === 'texto').length

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2">
              {achatado ? <ScanText className="w-5 h-5 text-orange-500" /> : <Layers className="w-5 h-5 text-orange-500" />}
              {achatado ? 'Arte achatada' : `Li ${arte.lista.length} camada(s) — ${nTexto} de texto`}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {achatado
                ? `${arte.formato.toUpperCase()}: o texto faz parte da imagem. Eu encontro onde estão os textos e crio os campos — você confirma.`
                : `${arte.formato.toUpperCase()}: cada camada que vira campo sai do fundo (o que está embaixo aparece limpo) e o nome novo entra no lugar.`}
            </p>
          </div>
          <button onClick={onManual} title="Fechar"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {!!arte.avisos.length && <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 space-y-0.5">{arte.avisos.map(a => <p key={a}>{a}</p>)}</div>}

        {fase === 'perguntar' ? (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onProcurar} disabled={ocupado} className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50">
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />} {ocupado ? 'Procurando os textos…' : 'Procurar os textos para mim'}
            </button>
            <button onClick={onManual} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm">Vou marcar os campos na mão</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_360px]">
            <div className="space-y-2 order-2 md:order-1">
              {!campos.length && <p className="text-sm text-gray-500">{achatado ? 'Não encontrei texto. Marque os campos na mão (botões “+ {nome}”, “+ {idade}”…).' : 'Nenhuma camada virou campo ainda — marque abaixo qual camada é o nome ou a idade.'}</p>}
              {campos.map(c => (
                <div key={c.id} className={`rounded-xl border p-2.5 space-y-1.5 ${c.incluir ? 'border-orange-300 dark:border-orange-900' : 'border-gray-200 dark:border-gray-800 opacity-70'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input type="checkbox" className="accent-orange-500" checked={c.incluir} onChange={e => mudar(c.id, { incluir: e.target.checked })} />
                    <span className="font-medium text-gray-800 dark:text-gray-100">“{c.textoOriginal}”</span>
                    {c.camada && <span className="text-[10px] text-gray-400">camada “{c.camada}”</span>}
                    {c.origem === 'ocr' && <span className="text-[10px] rounded bg-amber-100 text-amber-700 px-1">lido na imagem</span>}
                    <span className="inline-flex items-center gap-1 ml-auto">
                      <span className="w-4 h-4 rounded-full border border-gray-200" style={{ background: c.cor }} title={`cor ${c.cor}`} />
                      {c.contorno && <span className="w-4 h-4 rounded-full border-2" style={{ borderColor: c.contorno }} title={`contorno ${c.contorno}`} />}
                      {c.rotacao ? <span className="text-[10px] text-gray-400">{c.rotacao}°</span> : null}
                    </span>
                  </div>
                  <div className="grid grid-cols-[130px_1fr] gap-2">
                    <select className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-1.5 py-1 bg-white dark:bg-gray-800" value={c.papel}
                      onChange={e => { const papel = e.target.value as PapelCampo; mudar(c.id, { papel, modelo: c.camadaId && !c.textoOriginal.trim().match(/\w/) ? undefined : modeloDoTexto({ ...c, papel }), incluir: true }) }}>
                      <option value="nome">é o NOME</option><option value="idade">é a IDADE</option><option value="nome_idade">nome + idade</option><option value="outro">texto fixo</option>
                    </select>
                    <input className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 font-mono" value={c.modelo ?? modeloDoTexto(c)} onChange={e => mudar(c.id, { modelo: e.target.value })} title="Texto do campo — {nome} e {idade} são trocados em cada arte" />
                  </div>
                  {(c.nome || c.idade || c.fonteArquivo) && <p className="text-[10px] text-gray-400">{c.nome ? `nome “${c.nome}”` : ''}{c.nome && c.idade ? ' · ' : ''}{c.idade ? `idade ${c.idade}` : ''}{c.fonteArquivo ? ` · fonte do arquivo: ${c.fonteArquivo}` : ''}</p>}
                </div>
              ))}

              {!achatado && !!semCampo.length && (
                <details open={!campos.length} className="rounded-xl border border-gray-200 dark:border-gray-800 p-2.5">
                  <summary className="text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">Outras camadas ({semCampo.length}) — alguma é o nome ou a idade?</summary>
                  <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                    {semCampo.map(l => (
                      <div key={l.id} className={`flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 ${l.sugerida ? 'bg-orange-50 dark:bg-orange-950/30' : ''}`}>
                        {l.tipo === 'grupo' ? <FolderTree className="w-3.5 h-3.5 text-gray-400" /> : l.tipo === 'imagem' ? <ImageIcon className="w-3.5 h-3.5 text-gray-400" /> : <Type className="w-3.5 h-3.5 text-gray-400" />}
                        <span className="flex-1 truncate" title={l.nome}>{l.nome}</span>
                        <span className="text-[10px] text-gray-400">{l.tipo === 'ocg' ? 'camada PDF' : l.tipo}</span>
                        {l.bbox ? <>
                          <button onClick={() => marcar(l.id, 'nome')} className="rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 hover:border-orange-400">é o nome</button>
                          <button onClick={() => marcar(l.id, 'idade')} className="rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 hover:border-orange-400">idade</button>
                          <button onClick={() => marcar(l.id, 'nome_idade')} className="rounded border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 hover:border-orange-400">#</button>
                        </> : <span className="text-[10px] text-gray-300">vazia</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">A camada marcada some do fundo e o campo entra no lugar dela, com a cor dela.</p>
                </details>
              )}

              {achatado && !!nIncluidos && (
                <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 p-3 space-y-2">
                  <p className="text-xs text-sky-900 dark:text-sky-100 flex gap-1.5"><Info className="w-4 h-4 flex-shrink-0" /> O texto antigo continua desenhado na arte. Cada campo precisa ficar sobre área LIMPA: o melhor é subir a versão sem o nome (“Trocar molde” — os campos ficam) ou o arquivo com camadas (PSD/SVG/PDF). Enquanto isso, a cobertura tapa o texto antigo.</p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {([['entorno', 'Cobrir com as cores do entorno (recomendado)'], ['cor', 'Cobrir com cor sólida'], ['nenhuma', 'Sem cobertura (vou subir o molde limpo)']] as const).map(([k, t]) => (
                      <button key={k} onClick={() => onCobertura(k)} className={`rounded-lg px-2.5 py-1 border ${cobertura === k ? 'border-sky-500 bg-white dark:bg-gray-900 font-semibold' : 'border-sky-200 dark:border-sky-900'}`}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={onConfirmar} disabled={!nIncluidos} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Criar {nIncluidos} campo(s)</button>
                {(achatado || !campos.some(c => c.incluir)) && <button onClick={onProcurar} disabled={ocupado} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm inline-flex items-center gap-1.5">{ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />} {achatado ? 'Procurar de novo' : 'Procurar textos na imagem'}</button>}
                <button onClick={onManual} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">Marcar na mão</button>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <canvas ref={ref} className="rounded-xl border border-gray-200 dark:border-gray-700 max-w-full" />
              <p className="text-[10px] text-gray-400 mt-1">Laranja = vira campo · cinza = fica como está · azul = outras camadas.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
