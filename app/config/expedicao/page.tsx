'use client'
// app/config/expedicao/page.tsx
// Configura a consulta por leitura na Expedição: ativar, tipo de código
// (QR/Barras/Ambos), quais campos aparecem no pop-up e qual fica em destaque.

import { useEffect, useState } from 'react'
import { ScanLine, Check, QrCode, Barcode, Star } from 'lucide-react'

const CAMPOS_PADRAO: { key: string; label: string }[] = [
  { key: 'numero', label: 'Nº do pedido' },
  { key: 'destinatario', label: 'Cliente' },
  { key: 'produto', label: 'Produto(s)' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'valor', label: 'Valor' },
  { key: 'status', label: 'Status' },
  { key: 'prioridade', label: 'Prioridade' },
  { key: 'canal', label: 'Canal' },
  { key: 'dataEntrada', label: 'Entrada' },
  { key: 'dataEnvio', label: 'Envio' },
  { key: 'endereco', label: 'Endereço' },
  { key: 'observacoes', label: 'Observações' },
  { key: 'setor_atual_nome', label: 'Setor atual' },
]

export default function ConfigExpedicaoPage() {
  const [ativo, setAtivo] = useState(false)
  const [tipoCodigo, setTipoCodigo] = useState('ambos')
  const [campos, setCampos] = useState<string[]>(['numero', 'destinatario', 'produto', 'setor_atual_nome'])
  const [campoDestaque, setCampoDestaque] = useState('numero')
  const [customFields, setCustomFields] = useState<{ key: string; label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const [cfg, cf] = await Promise.all([
          fetch('/api/config/expedicao').then(r => r.ok ? r.json() : null).catch(() => null),
          fetch('/api/config/campos-pedido').then(r => r.ok ? r.json() : []).catch(() => []),
        ])
        if (cfg) {
          setAtivo(!!cfg.ativo); setTipoCodigo(cfg.tipoCodigo || 'ambos')
          if (Array.isArray(cfg.campos) && cfg.campos.length) setCampos(cfg.campos)
          setCampoDestaque(cfg.campoDestaque || 'numero')
        }
        const lista = Array.isArray(cf) ? cf : (cf?.campos || [])
        setCustomFields(lista.map((c: any) => ({ key: c.nome, label: c.nome })).filter((c: any) => c.key))
      } finally { setLoading(false) }
    })()
  }, [])

  const todos = [...CAMPOS_PADRAO, ...customFields.filter(c => !CAMPOS_PADRAO.some(p => p.key === c.key))]
  function toggleCampo(key: string) {
    setCampos(prev => {
      const novo = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      if (!novo.includes(campoDestaque) && novo.length) setCampoDestaque(novo[0])
      return novo
    })
  }
  function labelDe(key: string) { return todos.find(c => c.key === key)?.label || key }

  async function salvar() {
    setSalvando(true); setMsg('')
    try {
      const r = await fetch('/api/config/expedicao', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo, tipoCodigo, campos, campoDestaque }),
      })
      setMsg(r.ok ? 'Configuração salva!' : 'Erro ao salvar')
    } finally { setSalvando(false); setTimeout(() => setMsg(''), 3000) }
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  const TIPOS = [
    { id: 'qr', label: 'QR-Code', icon: QrCode },
    { id: 'barras', label: 'Código de barras', icon: Barcode },
    { id: 'ambos', label: 'Ambos', icon: ScanLine },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><ScanLine className="w-5 h-5 text-orange-500" /> Expedição — Leitura de pedidos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Leia o QR/código de barras da etiqueta pela câmera e veja o pedido em destaque.</p>
        </div>

        {/* Ativar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Ativar consulta por leitura</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Mostra o botão "Ler pedido" na expedição e imprime o código na etiqueta.</p>
            </div>
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} className="w-5 h-5 accent-orange-500" />
          </label>
        </div>

        {/* Tipo de código */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="font-semibold text-gray-900 dark:text-white mb-1">Código na etiqueta</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">O que imprimir na etiqueta. O leitor reconhece qualquer um.</p>
          <div className="grid grid-cols-3 gap-2">
            {TIPOS.map(t => (
              <button key={t.id} onClick={() => setTipoCodigo(t.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm transition ${tipoCodigo === t.id ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 font-semibold' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}>
                <t.icon size={20} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Campos do pop-up */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="font-semibold text-gray-900 dark:text-white mb-1">Campos do pop-up</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Marque o que aparece ao ler o pedido. A ⭐ define o campo em destaque (grande).</p>
          <div className="space-y-1.5">
            {todos.map(c => {
              const sel = campos.includes(c.key)
              return (
                <div key={c.key} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${sel ? 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10' : 'border-gray-100 dark:border-gray-800'}`}>
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input type="checkbox" checked={sel} onChange={() => toggleCampo(c.key)} className="w-4 h-4 accent-orange-500" />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{c.label}</span>
                    {customFields.some(f => f.key === c.key) && <span className="text-[10px] text-gray-400">personalizado</span>}
                  </label>
                  <button onClick={() => sel && setCampoDestaque(c.key)} disabled={!sel} title="Destacar"
                    className={`p-1 rounded ${campoDestaque === c.key ? 'text-orange-500' : 'text-gray-300 hover:text-orange-400'} disabled:opacity-30`}>
                    <Star size={16} fill={campoDestaque === c.key ? 'currentColor' : 'none'} />
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Em destaque: <strong className="text-orange-500">{labelDe(campoDestaque)}</strong></p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={salvar} disabled={salvando} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            <Check size={16} /> {salvando ? 'Salvando...' : 'Salvar configuração'}
          </button>
          {msg && <span className="text-sm text-green-600 dark:text-green-400">{msg}</span>}
        </div>
      </div>
    </div>
  )
}
