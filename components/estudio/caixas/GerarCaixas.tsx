'use client'
// SOA Edition — EDIÇÃO EM MASSA DO KIT: tema do banco + nomes/idades (colados ou puxados dos pedidos)
// → caixas prontas para imprimir ({tema}_{nome}_{idade}), folha de apliques e pastas por data/categoria.
import { useEffect, useState } from 'react'
import { Loader2, Download, ClipboardList, Package } from 'lucide-react'
import { abrirTemaCaixas, carregarMoldeCaixa, custoKit, gerarKitCaixas, listarMoldes, listarTemasCaixas, temAplique, type FormatoKit } from '@/lib/estudio/caixasCliente'
import { pastaDeSaida } from '@/lib/estudio/caixas'
import { Autorizador, SemCota, baixar, enviarArquivo, exigirSaldo } from '@/lib/estudio/cliente'
import { linhasDoTema } from '@/lib/estudio/tema'
import { LIMITE_LOTE, type PedidoFonte } from '@/lib/estudio/dados'
import type { Linha } from '@/lib/estudio/tipos'
import CotaBarra from '../CotaBarra'
import { useBaseEstudio, inp, lbl, btn, btnP, cartao } from './comum'

export default function GerarCaixas() {
  const { workspaceId, storage } = useBaseEstudio()
  const [temas, setTemas] = useState<{ id: string; nome: string; temaNome: string | null }[]>([])
  const [temaId, setTemaId] = useState('')
  const [fonte, setFonte] = useState<'colar' | 'pedidos'>('colar')
  const [texto, setTexto] = useState('Sophia;4\nMaria;5\nJoão;7')
  const [pedidos, setPedidos] = useState<PedidoFonte[] | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [formato, setFormato] = useState<FormatoKit>('pdf-por-nome')
  const [pasta, setPasta] = useState<'data' | 'categoria' | 'nenhuma'>('data')
  const [guardar, setGuardar] = useState(true)
  const [rodando, setRodando] = useState<{ feitos: number; total: number } | null>(null)
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('')
  const [cotaTick, setCotaTick] = useState(0)
  const [faltam, setFaltam] = useState(0)

  useEffect(() => { listarTemasCaixas().then(t => { setTemas(t); if (t[0]) setTemaId(t[0].id) }) }, [])
  useEffect(() => { if (fonte === 'pedidos' && !pedidos) fetch('/api/estudio/pedidos').then(r => r.json()).then(d => setPedidos(d.pedidos || [])).catch(() => setPedidos([])) }, [fonte, pedidos])

  function linhas(): Linha[] {
    if (fonte === 'colar') {
      return texto.split('\n').map(l => l.split(/[;\t]/).map(x => x.trim())).filter(p => p[0]).map(([nome, idade]) => ({ nome, idade: idade || '' }))
    }
    return (pedidos || []).filter(p => marcados.includes(p.id)).flatMap(p => linhasDoTema(p.campos, { Pedido: p.numero || '' }, ['nome', 'idade']))
  }

  async function gerar() {
    setErro(''); setAviso('')
    const ls = linhas()
    if (!temaId) { setErro('Escolha o tema.'); return }
    if (!ls.length) { setErro('Informe pelo menos um nome.'); return }
    if (ls.length > LIMITE_LOTE) { setErro(`Máximo de ${LIMITE_LOTE} nomes por execução.`); return }
    try {
      const t = await abrirTemaCaixas(temaId)
      const todos = await listarMoldes()
      const moldes = await Promise.all(t.tema.moldeIds.map(id => todos.find(m => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m).map(carregarMoldeCaixa))
      if (!moldes.length) throw new Error('O tema está sem caixas.')
      const total = custoKit(t.tema, moldes.length, ls.length)
      await exigirSaldo(total)
      const aut = new Autorizador(total)
      setRodando({ feitos: 0, total })
      const nomeTema = t.temaNome || t.nome
      const dir = pastaDeSaida(pasta, t.tema)
      const r = await gerarKitCaixas({ tema: t.tema, temaNome: nomeTema, moldes, linhas: ls, formato, pasta: dir, autorizar: i => aut.garantir(i), aoProgredir: (f, tot) => setRodando({ feitos: f, total: tot }) })
      baixar(r.arquivo, r.nome)
      if (guardar && storage && workspaceId) {
        await enviarArquivo(r.arquivo, r.nome, 'gerado', workspaceId, { pasta: dir ? `Caixas/${dir}` : 'Caixas', meta: { tema: nomeTema, itens: ls.length, formato: 'kit-caixas' }, lote: aut.lote }).catch(() => {})
      }
      setAviso(`${ls.length} kit(s) gerado(s) — ${total} imagem(ns) da cota.${temAplique(t.tema) ? ' A folha de apliques está no ZIP (PNG transparente).' : ''}`)
    } catch (e) {
      if (e instanceof SemCota) { setErro(e.message); setFaltam(e.faltam) }
      else setErro((e as Error).message)
    } finally { setRodando(null); setCotaTick(x => x + 1) }
  }

  return (
    <div className="space-y-4">
      <CotaBarra atualizar={cotaTick} faltam={faltam} />
      <div className={`${cartao} grid gap-3 md:grid-cols-2`}>
        <div className="space-y-2">
          <div><label className={lbl}>Tema</label>
            <select className={inp} value={temaId} onChange={e => setTemaId(e.target.value)}>
              {!temas.length && <option value="">Nenhum tema salvo</option>}
              {temas.map(t => <option key={t.id} value={t.id}>{t.temaNome || t.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setFonte('colar')} className={`${btn} text-xs ${fonte === 'colar' ? '!border-orange-500 text-orange-600' : ''}`}><ClipboardList className="w-3.5 h-3.5" /> Colar nomes</button>
            <button onClick={() => setFonte('pedidos')} className={`${btn} text-xs ${fonte === 'pedidos' ? '!border-orange-500 text-orange-600' : ''}`}><Package className="w-3.5 h-3.5" /> Puxar dos pedidos</button>
          </div>
          {fonte === 'colar' ? (
            <div><label className={lbl}>Um por linha: Nome;Idade</label><textarea className={`${inp} font-mono text-xs h-36`} value={texto} onChange={e => setTexto(e.target.value)} /></div>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {pedidos === null ? <p className="p-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin inline" /> Carregando…</p> : !pedidos.length ? <p className="p-2 text-xs text-gray-400">Nenhum pedido em aberto.</p> : pedidos.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-2 text-xs">
                  <input type="checkbox" className="accent-orange-500" checked={marcados.includes(p.id)} onChange={e => setMarcados(m => (e.target.checked ? [...m, p.id] : m.filter(x => x !== p.id)))} />
                  <span className="flex-1 truncate">#{p.numero} · {p.destinatario} — {p.campos.Nome || 'sem nome'}{p.campos.Idade ? `, ${p.campos.Idade}` : ''}{p.campos.Tema ? ` · tema ${p.campos.Tema}` : ''}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div><label className={lbl}>Saída</label>
            <select className={inp} value={formato} onChange={e => setFormato(e.target.value as FormatoKit)}>
              <option value="pdf-por-nome">Um PDF por nome (todas as caixas)</option>
              <option value="pdf-unico">Um PDF único com tudo</option>
              <option value="png">PNG por caixa</option>
            </select>
          </div>
          <div><label className={lbl}>Organizar em pastas</label>
            <select className={inp} value={pasta} onChange={e => setPasta(e.target.value as typeof pasta)}>
              <option value="data">Pela data de hoje</option><option value="categoria">Pela categoria do tema (novos/editados)</option><option value="nenhuma">Sem pasta</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-orange-500" checked={guardar} onChange={e => setGuardar(e.target.checked)} /> Guardar também em Meus arquivos</label>
          <p className="text-xs text-gray-500">Nome dos arquivos: a regra do tema (padrão <code>{'{tema}_{nome}_{idade}'}</code>).</p>
          <button onClick={gerar} disabled={!!rodando || !temaId} className={btnP}>
            {rodando ? <><Loader2 className="w-4 h-4 animate-spin" /> {rodando.feitos}/{rodando.total}</> : <><Download className="w-4 h-4" /> Gerar e baixar</>}
          </button>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          {aviso && <p className="text-xs text-green-700">{aviso}</p>}
        </div>
      </div>
    </div>
  )
}
