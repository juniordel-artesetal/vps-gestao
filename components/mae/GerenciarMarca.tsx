'use client'
// Lote 18 (item 225): EXCLUIR uma marca de registro com cuidado — "usada em N bases e M pranchetas", "Trocar por outra
// marca" (atualiza as bases), "Substituir arquivo" (mantém id, nome, ajuste fino e ligações) e a LIXEIRA de 30 dias.
import { useEffect, useRef, useState } from 'react'
import { Trash2, RotateCcw, RefreshCw, X } from 'lucide-react'
import { useBiblioteca } from '@/lib/mae/editor/loja'
import { mensagemDeErro } from '@/lib/mae/erros'
import { excluirMarca, restaurarMarca, substituirArquivoMarca, trocarMarcaNasBases, useMarcas, usoDaMarca } from './marcasMae'
import { sync, type MarcaRegistro } from './sincronia'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] font-medium hover:border-orange-400 disabled:opacity-40'
const sel = 'rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5 text-[11px]'

export function ExcluirMarca({ marca, onFechar }: { marca: MarcaRegistro; onFechar: () => void }) {
  const raiz = useBiblioteca(s => s.raiz)
  const marcas = useMarcas(s => s.marcas)
  const [uso, setUso] = useState<{ bases: { id: string; nome: string }[]; pranchetas: number } | null>(null)
  const [outra, setOutra] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const arq = useRef<HTMLInputElement>(null)
  useEffect(() => { if (raiz) void usoDaMarca(raiz, marca.id).then(setUso).catch(e => setMsg(mensagemDeErro(e))) }, [raiz, marca.id])
  const outras = marcas.filter(m => m.id !== marca.id)
  async function rodar(f: () => Promise<string>) {
    setOcupado(true); setMsg(null)
    try { setMsg(await f()) } catch (e) { setMsg(`Não deu: ${mensagemDeErro(e)}`) } finally { setOcupado(false) }
  }
  return (
    <div className="space-y-1.5 rounded-lg border border-red-200 bg-red-50/60 p-2 text-[11px] dark:bg-red-950/20" data-excluir-marca={marca.nome}>
      <div className="flex items-center gap-1">
        <b className="flex-1">Marca “{marca.nome}”</b>
        <button onClick={onFechar} aria-label="Fechar"><X className="h-3.5 w-3.5" /></button>
      </div>
      <p data-uso-marca>{!uso ? 'Contando onde ela é usada…' : uso.pranchetas ? <>Usada em <b>{uso.bases.length} base(s)</b> e <b>{uso.pranchetas} prancheta(s)/folha(s)</b>: {uso.bases.map(b => b.nome).join(', ')}.</> : 'Nenhuma base usa esta marca.'}</p>
      {!!uso?.pranchetas && outras.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <select className={sel} value={outra} onChange={e => setOutra(e.target.value)} data-trocar-marca-por>
            <option value="">Trocar por outra marca…</option>
            {outras.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <button className={btn} disabled={!outra || ocupado || !raiz} data-confirmar-trocar-marca onClick={() => void rodar(async () => {
            const n = await trocarMarcaNasBases(raiz!, marca.id, outras.find(m => m.id === outra)!)
            setUso(await usoDaMarca(raiz!, marca.id))
            return `Trocada em ${n} base(s) (cada uma salva numa versão nova). Agora dá para excluir sem estragar nada.`
          })}><RefreshCw className="h-3 w-3" /> Trocar nas bases</button>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        <button className={btn} disabled={ocupado || !raiz} onClick={() => arq.current?.click()} title="Põe o PDF novo no lugar deste, mantendo o nome, o ajuste fino e as bases ligadas" data-substituir-arquivo-marca>Substituir arquivo</button>
        <button className={`${btn} text-red-700`} disabled={ocupado || !raiz} data-confirmar-excluir-marca onClick={() => {
          if (uso?.pranchetas && !confirm(`"${marca.nome}" ainda é usada em ${uso.pranchetas} prancheta(s). Excluir mesmo assim? Ela fica 30 dias na lixeira.`)) return
          void rodar(async () => { await excluirMarca(raiz!, marca.id); onFechar(); return 'Marca na lixeira (30 dias).' })
        }}><Trash2 className="h-3 w-3" /> Excluir (lixeira 30 dias)</button>
      </div>
      <input ref={arq} type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f && raiz) void rodar(async () => { await substituirArquivoMarca(raiz, marca.id, f, marca.pagina || 1); return `Arquivo trocado: ${f.name}. Nome, ajuste fino e bases mantidos.` }) }} data-arquivo-substituir-marca />
      {msg && <p className="text-gray-700" data-msg-marca>{msg}</p>}
    </div>
  )
}

/** Lote 18 (item 225): as marcas na lixeira (30 dias) com Restaurar. */
export function LixeiraMarcas() {
  const raiz = useBiblioteca(s => s.raiz)
  const marcas = useMarcas(s => s.marcas)
  const [lista, setLista] = useState<(MarcaRegistro & { em: string })[] | null>(null)
  const [aberta, setAberta] = useState(false)
  useEffect(() => { if (aberta) void sync.marcas.lixeira().then(setLista) }, [aberta, marcas.length])
  return (
    <div className="text-[10px]" data-lixeira-marcas>
      <button className="text-gray-500 underline" onClick={() => setAberta(a => !a)}>Lixeira das marcas</button>
      {aberta && (
        <ul className="mt-0.5 space-y-0.5">
          {!lista && <li className="text-gray-400">Lendo…</li>}
          {lista && !lista.length && <li className="text-gray-400">Vazia.</li>}
          {lista?.map(m => (
            <li key={m.id} className="flex items-center gap-1" data-marca-na-lixeira={m.nome}>
              <span className="flex-1 truncate">{m.nome} <span className="text-gray-400">· excluída em {new Date(m.em).toLocaleDateString('pt-BR')}</span></span>
              <button className={btn} disabled={!raiz} onClick={() => raiz && void restaurarMarca(raiz, m).then(() => setLista(l => l?.filter(x => x.id !== m.id) ?? null))} data-restaurar-marca><RotateCcw className="h-3 w-3" /> Restaurar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
