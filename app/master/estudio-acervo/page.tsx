'use client'
// app/master/estudio-acervo — TEMPLATES ESPECIAIS: conexão do Drive da Naty (plataforma), pasta-fonte,
// sincronizar agora, e CURADORIA: processar (roteador de camadas, aqui no navegador) → conferir → aprovar.
// Regra de IP (Decisão 0): só aprovar o que é GENÉRICO/AUTORAL — sem personagem, marca ou mascote de
// terceiro. Nada é publicado sem esta aprovação; tudo fica na trilha de auditoria.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, RefreshCw, Check, X, Wand2, EyeOff, Link2 } from 'lucide-react'

interface Item {
  id: string; nome: string; status: string | null; categoria: string | null; versao: number; arquivoUrl: string | null; arquivoNome: string | null
  moldeUrl: string | null; preview: string | null; processado: boolean; publicadoEm: string | null; temCampos: boolean
}
interface Sync { id: string; origem: string; executadoEm: string; novos: number; atualizados: number; iguais: number; erros: number; detalhes: string[] }

const ROTULO: Record<string, string> = { pendente_curadoria: 'pendente', publicado: 'publicado', reprovado: 'reprovado', despublicado: 'despublicado' }

export default function MasterAcervo() {
  const router = useRouter()
  const [st, setSt] = useState<{ configurado: boolean; conectado: boolean; email: string | null; pastaId: string | null } | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [syncs, setSyncs] = useState<Sync[]>([])
  const [pasta, setPasta] = useState('')
  const [ocupado, setOcupado] = useState<string>('')
  const [msg, setMsg] = useState('')
  const [filtro, setFiltro] = useState('pendente_curadoria')

  const carregar = useCallback(async () => {
    const r = await fetch('/api/master/estudio/acervo')
    if (r.status === 401) { router.push('/master/login'); return }
    const d = await r.json()
    setSt(d.status); setItens(d.itens || []); setSyncs(d.syncs || []); setPasta(p => p || d.status?.pastaId || '')
  }, [router])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { const q = new URLSearchParams(window.location.search).get('drive'); if (q) setMsg(q === 'conectado' ? 'Drive do acervo conectado.' : q === 'indisponivel' ? 'Faltam as credenciais do Google Drive no ambiente.' : 'Não consegui conectar o Drive.') }, [])

  async function acao(corpo: Record<string, unknown>, rotulo: string) {
    setOcupado(rotulo); setMsg('')
    try {
      const r = await fetch('/api/master/estudio/acervo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falhou')
      if (corpo.acao === 'sync') setMsg(`Sincronizado: ${j.novos} novo(s), ${j.atualizados} atualizado(s), ${j.iguais} igual(is), ${j.erros} erro(s).${j.pendentesDeTempo ? ` ${j.pendentesDeTempo} ficaram para a próxima.` : ''}`)
      carregar()
    } catch (e) { setMsg((e as Error).message) } finally { setOcupado('') }
  }

  /** Processa no navegador: roteador de camadas → campos (nome/idade) → molde limpo no Blob → prévia. */
  async function processar(i: Item) {
    if (!i.arquivoUrl) return
    setOcupado(i.id); setMsg('')
    try {
      const [{ importarArte, caixasDosCampos, camadasDosCampos }, { renderizar }, { upload }] = await Promise.all([import('@/lib/estudio/importarArte'), import('@/lib/estudio/render'), import('@vercel/blob/client')])
      const b = await (await fetch(i.arquivoUrl)).blob()
      const arte = await importarArte(new File([b], i.arquivoNome || 'arquivo', { type: b.type }))
      const campos = arte.campos
      const fundo = arte.recompor ? await arte.recompor(camadasDosCampos(campos)) : arte.fundo
      const caixas = caixasDosCampos(campos, arte.caminho === 'achatado')
      if (!caixas.length) throw new Error(`Não achei nome/idade em “${i.nome}” (${arte.caminho === 'achatado' ? 'arte achatada' : 'nenhuma camada de texto ou camada chamada nome/idade'}). Peça à Naty o arquivo com camadas nomeadas — ou reprove.`)
      const cfg = { versao: 1, largura: fundo.width, altura: fundo.height, caixas, fontesUsuario: [], pagina: arte.pagina }
      const png = await new Promise<Blob>((res, rej) => fundo.toBlob(x => (x ? res(x) : rej(new Error('molde'))), 'image/png'))
      const up = await upload(`estudio/__acervo_naty__/molde/${i.id}.png`, png, { access: 'public', handleUploadUrl: '/api/master/estudio/acervo/upload', contentType: 'image/png' })
      const out = document.createElement('canvas')
      renderizar(out, fundo, cfg as never, { nome: 'Sophia', idade: '4' }, () => 'sans-serif', {})
      const k = 360 / Math.max(out.width, out.height), mini = document.createElement('canvas'); mini.width = Math.round(out.width * k); mini.height = Math.round(out.height * k)
      const gm = mini.getContext('2d')!; gm.fillStyle = '#fff'; gm.fillRect(0, 0, mini.width, mini.height); gm.drawImage(out, 0, 0, mini.width, mini.height)
      const r = await fetch(`/api/master/estudio/acervo/${i.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'processado', moldeUrl: up.url, config: cfg, preview: mini.toDataURL('image/jpeg', 0.8) }) })
      if (!r.ok) throw new Error((await r.json()).error || 'Falha ao gravar')
      setMsg(`“${i.nome}”: ${caixas.length} campo(s) (${arte.formato.toUpperCase()}, caminho ${arte.caminho}). Confira a prévia com “Sophia/4” antes de aprovar.`)
      carregar()
    } catch (e) { setMsg((e as Error).message) } finally { setOcupado('') }
  }
  async function decidir(i: Item, acao: 'aprovar' | 'reprovar' | 'despublicar') {
    if (acao === 'aprovar' && !confirm(`Publicar “${i.nome}” para as assinantes?\n\nConfirme: é GENÉRICO/AUTORAL — sem personagem, marca, logo ou mascote de terceiro.`)) return
    const nota = acao === 'aprovar' ? 'conferido: genérico/autoral' : prompt('Motivo (fica na auditoria):') || null
    setOcupado(i.id)
    await fetch(`/api/master/estudio/acervo/${i.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, nota }) })
    setOcupado(''); carregar()
  }

  const vis = itens.filter(i => !filtro || i.status === filtro)
  const b = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-1.5 text-sm hover:border-orange-400 disabled:opacity-50'
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 sm:p-6 space-y-5">
      <Link href="/master" className="text-sm text-gray-400 hover:text-orange-400 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Master</Link>
      <div>
        <h1 className="text-2xl font-bold">Templates Especiais — acervo da Naty</h1>
        <p className="text-sm text-gray-400">Sincroniza o Drive (semanal + manual), processa pelo roteador de camadas e publica SÓ o que for aprovado aqui. Só aprove arte genérica/autoral.</p>
      </div>
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
      <div className="rounded-2xl border border-gray-800 p-4 space-y-3">
        {!st ? <Loader2 className="w-4 h-4 animate-spin" /> : !st.configurado ? <p className="text-sm text-red-300">Faltam no ambiente: GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET / INTEGRACOES_TOKEN_KEY / BLOB_READ_WRITE_TOKEN (e a URI de retorno /api/master/estudio/acervo/callback no cliente OAuth).</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Drive: {st.conectado ? <b className="text-green-400">conectado{st.email ? ` (${st.email})` : ''}</b> : <b className="text-red-400">não conectado</b>}</span>
              <button onClick={() => { window.location.href = '/api/master/estudio/acervo/conectar' }} className={b}><Link2 className="w-4 h-4" /> {st.conectado ? 'Reconectar' : 'Conectar o Drive da Naty'}</button>
              {st.conectado && <button onClick={() => acao({ acao: 'desconectar' }, 'desc')} className={b}>Desconectar</button>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input value={pasta} onChange={e => setPasta(e.target.value)} placeholder="Link ou id da pasta do acervo no Drive" className="flex-1 min-w-[240px] rounded-lg bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm" />
              <button onClick={() => acao({ acao: 'pasta', pastaId: pasta }, 'pasta')} className={b}>Salvar pasta</button>
              <button onClick={() => acao({ acao: 'sync' }, 'sync')} disabled={!!ocupado || !st.conectado || !st.pastaId} className={b}>{ocupado === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sincronizar agora</button>
            </div>
          </>
        )}
        {!!syncs.length && <details className="text-xs text-gray-400"><summary className="cursor-pointer">Últimas sincronizações</summary>{syncs.map(s => <p key={s.id}>{new Date(s.executadoEm).toLocaleString('pt-BR')} · {s.origem} · {s.novos} novo(s), {s.atualizados} atualizado(s), {s.iguais} igual(is), {s.erros} erro(s){s.detalhes?.length ? ` — ${s.detalhes.slice(0, 3).join(' · ')}` : ''}</p>)}</details>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['pendente_curadoria', 'publicado', 'reprovado', 'despublicado', ''].map(f => <button key={f} onClick={() => setFiltro(f)} className={`rounded-lg px-3 py-1 text-sm border ${filtro === f ? 'bg-orange-500 border-orange-500' : 'border-gray-700'}`}>{f ? ROTULO[f] : 'todos'} ({itens.filter(i => !f || i.status === f).length})</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {vis.map(i => (
          <div key={i.id} className="rounded-xl border border-gray-800 bg-gray-900 p-2.5 space-y-2">
            <div className="aspect-square bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden">{i.preview ? <img src={i.preview} alt={i.nome} className="max-w-full max-h-full" /> : <span className="text-xs text-gray-500">{i.processado ? 'sem prévia' : 'não processado'}</span>}</div>
            <p className="text-sm font-medium truncate" title={i.arquivoNome || ''}>{i.nome} <span className="text-[10px] text-gray-500">v{i.versao}</span></p>
            <p className="text-[11px] text-gray-400">{i.categoria || 'Geral'} · {ROTULO[i.status || ''] || i.status}</p>
            <div className="flex flex-wrap gap-1">
              {i.status === 'pendente_curadoria' && <button onClick={() => processar(i)} disabled={!!ocupado} className={`${b} !px-2 !py-1 !text-xs`}>{ocupado === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} {i.processado ? 'Reprocessar' : 'Processar'}</button>}
              {i.status === 'pendente_curadoria' && i.processado && <button onClick={() => decidir(i, 'aprovar')} className={`${b} !px-2 !py-1 !text-xs !border-green-700 text-green-300`}><Check className="w-3.5 h-3.5" /> Aprovar</button>}
              {i.status === 'pendente_curadoria' && <button onClick={() => decidir(i, 'reprovar')} className={`${b} !px-2 !py-1 !text-xs !border-red-800 text-red-300`}><X className="w-3.5 h-3.5" /> Reprovar</button>}
              {i.status === 'publicado' && <button onClick={() => decidir(i, 'despublicar')} className={`${b} !px-2 !py-1 !text-xs !border-red-800 text-red-300`}><EyeOff className="w-3.5 h-3.5" /> Despublicar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
