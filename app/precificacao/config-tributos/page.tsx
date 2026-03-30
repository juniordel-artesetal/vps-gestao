'use client'

import { useState, useEffect } from 'react'

interface ConfigTributaria {
  regime: string; aliquotaPadrao: number; observacoes: string | null; updatedAt: string
}

const REGIMES = [
  { key: 'MEI', label: 'MEI', desc: 'Microempreendedor Individual', aliquota: 0,
    nota: 'MEI é isento de IR, PIS, COFINS e IPI. Paga apenas taxa fixa mensal (DAS). Alíquota sobre vendas: 0%.' },
  { key: 'SIMPLES_NACIONAL', label: 'Simples Nacional', desc: 'Microempresa ou Empresa de Pequeno Porte', aliquota: 6,
    nota: 'Alíquota varia de 4% a 19,5% dependendo do Anexo e faturamento. Valor sugerido: 6% (Anexo I, faixa inicial).' },
  { key: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido', desc: 'Tributação sobre lucro estimado', aliquota: 11.33,
    nota: 'Incide IRPJ (15%), CSLL (9%), PIS (0,65%), COFINS (3%). Alíquota efetiva estimada: ~11,33% sobre receita bruta.' },
  { key: 'LUCRO_REAL', label: 'Lucro Real', desc: 'Tributação sobre lucro efetivo', aliquota: 15,
    nota: 'Alíquota varia conforme lucro real apurado. Consulte seu contador para o valor correto.' },
]

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

export default function ConfigTributosPage() {
  const [config, setConfig]   = useState<ConfigTributaria | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [form, setForm] = useState({ regime: 'MEI', aliquotaPadrao: '0', observacoes: '' })

  useEffect(() => {
    fetch('/api/precificacao/config-tributos')
      .then(r => r.json())
      .then(data => {
        if (data) {
          setConfig(data)
          setForm({ regime: data.regime || 'MEI', aliquotaPadrao: String(data.aliquotaPadrao || 0), observacoes: data.observacoes || '' })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function selectRegime(key: string) {
    const r = REGIMES.find(r => r.key === key)
    setForm(p => ({ ...p, regime: key, aliquotaPadrao: String(r?.aliquota ?? 0) }))
  }

  async function handleSave() {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch('/api/precificacao/config-tributos', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regime: form.regime, aliquotaPadrao: Number(form.aliquotaPadrao), observacoes: form.observacoes || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  const regimeSel = REGIMES.find(r => r.key === form.regime)
  const aliquota  = Number(form.aliquotaPadrao)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configuração Tributária</h1>
        <p className="text-gray-500 text-sm mt-1">Define o regime tributário e a alíquota padrão usada nos cálculos de precificação.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">Carregando...</div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* Regime */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <p className="text-sm font-semibold text-gray-700 mb-4">Regime Tributário</p>
            <div className="grid grid-cols-2 gap-3">
              {REGIMES.map(r => (
                <button key={r.key} onClick={() => selectRegime(r.key)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.regime === r.key ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                  <p className={`font-semibold text-sm ${form.regime === r.key ? 'text-orange-700' : 'text-gray-800'}`}>{r.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                  <p className={`text-xs font-bold mt-1.5 ${form.regime === r.key ? 'text-orange-600' : 'text-gray-400'}`}>Sugestão: {r.aliquota}%</p>
                </button>
              ))}
            </div>
            {regimeSel && (
              <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-xs text-blue-700">ℹ️ {regimeSel.nota}</p>
              </div>
            )}
          </div>

          {/* Alíquota */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">Alíquota efetiva (%)</p>
              <span className="text-xs text-gray-400">Aplicada automaticamente nos produtos</span>
            </div>
            <div className="flex items-center gap-3">
              <input type="number" step="0.01" min="0" max="100" value={form.aliquotaPadrao}
                onChange={e => setForm(p => ({ ...p, aliquotaPadrao: e.target.value }))}
                className={inputClass + ' text-2xl font-bold text-orange-600 max-w-40'} />
              <span className="text-2xl text-gray-400 font-bold">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Exemplo: produto de R$ 100,00 com {aliquota}% → R$ {(100 * aliquota / 100).toFixed(2)} de imposto
            </p>
            {aliquota > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[30, 60, 100].map(preco => (
                  <div key={preco} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-xs text-gray-400">Produto R$ {preco},00</p>
                    <p className="text-sm font-bold text-red-500">- R$ {(preco * aliquota / 100).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">imposto</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Observações / NCMs específicos</label>
            <textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
              rows={4} className={inputClass}
              placeholder="Ex: Produtos com NCM 6217.10.00 têm alíquota de IPI reduzida..." />
            <p className="text-xs text-gray-400 mt-1">Use este campo para registrar exceções ou observações do seu contador.</p>
          </div>

          {/* Salvar */}
          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar configuração'}
            </button>
            {saved && <span className="text-green-600 text-sm font-medium">✅ Configuração salva!</span>}
            {config?.updatedAt && !saved && (
              <span className="text-xs text-gray-400">Última atualização: {new Date(config.updatedAt).toLocaleString('pt-BR')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
