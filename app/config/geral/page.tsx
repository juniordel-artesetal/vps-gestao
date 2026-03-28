'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const PRESETS = [
  { id: 'laranja',  nome: 'Laranja',  cor: '#f97316' },
  { id: 'roxo',     nome: 'Roxo',     cor: '#7c3aed' },
  { id: 'ciano',    nome: 'Ciano',    cor: '#0891b2' },
  { id: 'verde',    nome: 'Verde',    cor: '#059669' },
  { id: 'ambar',    nome: 'Âmbar',    cor: '#d97706' },
  { id: 'vermelho', nome: 'Vermelho', cor: '#dc2626' },
  { id: 'rosa',     nome: 'Rosa',     cor: '#db2777' },
  { id: 'carvao',   nome: 'Carvão',   cor: '#374151' },
]

export default function ConfigGeralPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [nomeNegocio, setNomeNegocio] = useState('')
  const [corPrimaria, setCorPrimaria] = useState('#f97316')
  const [presetSelecionado, setPresetSelecionado] = useState('laranja')
  const [modo, setModo] = useState<'light' | 'dark'>('light')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') carregarDados()
  }, [status])

  async function carregarDados() {
    try {
      const res = await fetch('/api/config/geral')
      const data = await res.json()
      setNomeNegocio(data.nomeNegocio || '')
      setCorPrimaria(data.corPrimaria || '#f97316')
      setPresetSelecionado(data.presetNome || 'laranja')
      setModo(data.modo || 'light')
    } catch {
      setErro('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }

  function selecionarPreset(preset: typeof PRESETS[0]) {
    setPresetSelecionado(preset.id)
    setCorPrimaria(preset.cor)
  }

  async function salvar() {
    setSalvando(true)
    setErro('')
    try {
      const res = await fetch('/api/config/geral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomeNegocio,
          corPrimaria,
          presetNome: presetSelecionado,
          modo,
        }),
      })
      if (!res.ok) { setErro('Erro ao salvar'); return }
      setSucesso('Configurações salvas!')
      setTimeout(() => setSucesso(''), 3000)
    } catch {
      setErro('Erro ao salvar configurações')
    } finally {
      setSalvando(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.push('/modulos')} className="text-gray-400 hover:text-gray-600 transition">←</button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Configurações Gerais</h1>
            <p className="text-sm text-gray-500">Personalize seu sistema</p>
          </div>
        </div>

        {/* Alertas */}
        {sucesso && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4 text-sm text-green-700">
            ✓ {sucesso}
          </div>
        )}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm text-red-600">
            {erro}
          </div>
        )}

        {/* Dados do negócio */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Dados do negócio</h2>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Nome do negócio</label>
              <input
                type="text"
                value={nomeNegocio}
                onChange={e => setNomeNegocio(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Ex: Ateliê da Maria"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Proprietário</label>
              <input
                type="text"
                value={session?.user?.name || ''}
                disabled
                className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
              <input
                type="text"
                value={session?.user?.email || ''}
                disabled
                className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Tema */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Tema de cores</h2>

          {/* Presets */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 block mb-2">Cor primária</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => selecionarPreset(preset)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                    presetSelecionado === preset.id
                      ? 'border-gray-400 bg-gray-100 text-gray-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: preset.cor }}
                  />
                  {preset.nome}
                </button>
              ))}
            </div>
          </div>

          {/* Cor personalizada */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 block mb-2">Ou escolha uma cor personalizada</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={corPrimaria}
                onChange={e => {
                  setCorPrimaria(e.target.value)
                  setPresetSelecionado('custom')
                }}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={corPrimaria}
                onChange={e => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                    setCorPrimaria(e.target.value)
                    setPresetSelecionado('custom')
                  }
                }}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="#f97316"
              />
              <div
                className="flex-1 h-10 rounded-lg border border-gray-100"
                style={{ backgroundColor: corPrimaria }}
              />
            </div>
          </div>

          {/* Preview */}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 block mb-2">Preview</label>
            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: corPrimaria }}>V</div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{nomeNegocio || 'Nome do Negócio'}</div>
                  <div className="text-xs text-gray-400">VPS Gestão</div>
                </div>
              </div>
              <button
                className="px-4 py-1.5 rounded-lg text-white text-xs font-medium"
                style={{ backgroundColor: corPrimaria }}
              >
                Botão de exemplo
              </button>
              <span
                className="ml-2 text-xs font-medium"
                style={{ color: corPrimaria }}
              >
                Link de exemplo
              </span>
            </div>
          </div>

          {/* Modo dark/light */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Modo de exibição</label>
            <div className="flex gap-2">
              {[
                { id: 'light', label: '☀️ Claro', desc: 'Fundo branco' },
                { id: 'dark',  label: '🌙 Escuro', desc: 'Fundo escuro' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setModo(opt.id as 'light' | 'dark')}
                  className={`flex-1 p-3 rounded-xl border text-left transition ${
                    modo === opt.id
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-800">{opt.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              O modo escuro será aplicado em breve — em desenvolvimento 🔨
            </p>
          </div>
        </div>

        {/* Botão salvar */}
        <button
          onClick={salvar}
          disabled={salvando}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50"
        >
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>

        {/* Link config produção */}
        <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800">Configurar Produção</div>
            <div className="text-xs text-gray-400">Gerencie setores e fluxo de produção</div>
          </div>
          <button
            onClick={() => router.push('/config/producao')}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium transition"
          >
            Acessar →
          </button>
        </div>

      </div>
    </div>
  )
}
