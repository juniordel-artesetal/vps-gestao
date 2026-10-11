'use client'
// CADASTRO MANUAL RÁPIDO de pedido (Lote 7, item 120) — só no MAE avulso (sem SOA): nº, cliente, produto,
// quantidade, nome, idade, tema e observação. O mesmo nº não se repete.
import { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { apiMae } from './pedidosMae'

const inp = 'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs'
const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const VAZIO = { numero: '', cliente: '', produto: '', quantidade: '1', nome: '', idade: '', tema: '', dataEnvio: '', observacao: '' }

export default function PedidoManual({ produtos, onFechar, onCriado }: { produtos: string[]; onFechar: () => void; onCriado: () => void }) {
  const [f, setF] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  const campo = (k: keyof typeof VAZIO, rotulo: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <label className="block text-[11px] text-gray-600">{rotulo}<input value={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.value }))} className={inp} data-manual={k} {...extra} /></label>
  )
  async function salvar(continuar: boolean) {
    setErro(null); setIndo(true)
    try {
      const r = await apiMae.criarPedidos([{ origem: 'manual', numero: f.numero, cliente: f.cliente || null, dataEnvio: f.dataEnvio || null, observacao: f.observacao || null,
        itens: [{ nome: f.produto, quantidade: parseInt(f.quantidade) || 1 }], campos: { ...(f.nome ? { NOME: f.nome } : {}), ...(f.idade ? { IDADE: f.idade } : {}), ...(f.tema ? { TEMA: f.tema } : {}) } }])
      if (!r.novos) { setErro(`Já existe um pedido nº ${f.numero}.`); return }
      onCriado()
      if (continuar) setF(x => ({ ...VAZIO, produto: x.produto, dataEnvio: x.dataEnvio })); else onFechar()
    } catch (e) { setErro((e as Error).message) } finally { setIndo(false) }
  }
  const ok = f.numero.trim() && f.produto.trim()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar} role="dialog" aria-modal="true" data-modal-pedido-manual>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2"><Plus className="w-4 h-4 text-orange-500" /><b className="text-sm">Novo pedido</b><button className="ml-auto" onClick={onFechar} aria-label="Fechar"><X className="w-4 h-4" /></button></div>
        <div className="grid grid-cols-2 gap-2">
          {campo('numero', 'Nº do pedido *', { autoFocus: true })}
          {campo('cliente', 'Cliente')}
          <label className="block text-[11px] text-gray-600">Produto *
            <input value={f.produto} onChange={e => setF(x => ({ ...x, produto: e.target.value }))} list="mae-produtos-manual" className={inp} data-manual="produto" />
            <datalist id="mae-produtos-manual">{produtos.map(p => <option key={p} value={p} />)}</datalist>
          </label>
          {campo('quantidade', 'Quantidade', { inputMode: 'numeric' })}
          {campo('nome', 'Nome (aniversariante)')}
          {campo('idade', 'Idade', { inputMode: 'numeric' })}
          {campo('tema', 'Tema')}
          {campo('dataEnvio', 'Prazo de envio', { type: 'date' })}
        </div>
        <label className="block text-[11px] text-gray-600">Observação<textarea value={f.observacao} onChange={e => setF(x => ({ ...x, observacao: e.target.value }))} rows={2} className={inp} data-manual="observacao" /></label>
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onFechar}>Fechar</button>
          <button className={btn} disabled={!ok || indo} onClick={() => void salvar(true)} data-manual-salvar-outro>Salvar e cadastrar outro</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={!ok || indo} onClick={() => void salvar(false)} data-manual-salvar>{indo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Salvar</button>
        </div>
      </div>
    </div>
  )
}
