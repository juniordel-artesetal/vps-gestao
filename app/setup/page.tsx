'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const SEGMENTOS = [
  { id: 'lacos',            nome: 'Laços e Tiaras',           emoji: '🎀', descricao: 'Laços, tiaras e acessórios para cabelo',         setores: ['Pedido', 'Produção', 'Embalagem', 'Expedição'] },
  { id: 'costura',          nome: 'Costura e Moda',            emoji: '🧵', descricao: 'Roupas, uniformes e moda autoral',                setores: ['Modelagem', 'Corte', 'Costura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'bijuteria',        nome: 'Bijuteria e Joias',         emoji: '💍', descricao: 'Bijuterias, joias e acessórios',                  setores: ['Design', 'Montagem', 'Controle de Qualidade', 'Embalagem', 'Expedição'] },
  { id: 'sublimacao',       nome: 'Sublimação',                emoji: '🖨️', descricao: 'Camisetas, canecas e personalizados',             setores: ['Arte', 'Impressão', 'Prensa', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'croche_trico',     nome: 'Crochê e Tricô',            emoji: '🧶', descricao: 'Peças em crochê, tricô e amigurumi',              setores: ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'mdf_madeira',      nome: 'MDF e Madeira',             emoji: '🪵', descricao: 'Peças em MDF, madeira e decoração',               setores: ['Design', 'Corte', 'Pintura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'biscuit',          nome: 'Biscuit e Modelagem',       emoji: '🎨', descricao: 'Biscuit, porcelana fria e modelagem',             setores: ['Modelagem', 'Secagem', 'Pintura', 'Verniz', 'Embalagem', 'Expedição'] },
  { id: 'festas',           nome: 'Festas e Lembrancinhas',    emoji: '🎉', descricao: 'Lembrancinhas, decoração de festas e eventos',    setores: ['Arte', 'Produção', 'Montagem', 'Embalagem', 'Expedição'] },
  { id: 'papelaria',        nome: 'Papelaria Criativa',        emoji: '📒', descricao: 'Convites, adesivos, scrapbook e papelaria',       setores: ['Arte', 'Impressão', 'Corte', 'Montagem', 'Embalagem', 'Expedição'] },
  { id: 'encadernacao',     nome: 'Encadernação Artesanal',    emoji: '📚', descricao: 'Cadernos, agendas, planners e álbuns costurados', setores: ['Arte', 'Impressão', 'Corte e Dobra', 'Furação', 'Costura', 'Capa e Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'velas_cosmeticos', nome: 'Velas e Cosméticos',        emoji: '🕯️', descricao: 'Velas artesanais, sabonetes e cosméticos',        setores: ['Formulação', 'Produção', 'Rotulagem', 'Embalagem', 'Expedição'] },
  { id: 'macrame',          nome: 'Macramê e Têxtil',          emoji: '🪢', descricao: 'Macramê, bordado e arte têxtil',                  setores: ['Design', 'Produção', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'resina',           nome: 'Resina e Acrílico',         emoji: '💎', descricao: 'Peças em resina epóxi e acrílico',                setores: ['Design', 'Moldagem', 'Cura', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'ceramica',         nome: 'Cerâmica e Barro',          emoji: '🏺', descricao: 'Cerâmica, argila e porcelana',                    setores: ['Modelagem', 'Secagem', 'Queima', 'Pintura', 'Embalagem', 'Expedição'] },
  { id: 'bolsas',           nome: 'Bolsas e Carteiras',        emoji: '👜', descricao: 'Bolsas, carteiras em couro ou tecido',            setores: ['Design', 'Corte', 'Montagem', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'personalizado',    nome: 'Personalizado',             emoji: '⚙️', descricao: 'Configuro meus próprios setores',                 setores: [] },
]

export default function SetupPage() {
  const router = useRouter()
  const [segmento, setSegmento] = useState('')
  const [setoresEditaveis, setSetoresEditaveis] = useState<string[]>([])
  const [novoSetor, setNovoSetor] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function selecionarSegmento(id: string) {
    const seg = SEGMENTOS.find(s => s.id === id)
    setSegmento(id)
    setSetoresEditaveis(seg?.setores || [])
    setErro('')
  }

  function adicionarSetor() {
    if (!novoSetor.trim()) return
    setSetoresEditaveis(prev => [...prev, novoSetor.trim()])
    setNovoSetor('')
  }

  function removerSetor(index: number) {
    setSetoresEditaveis(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!segmento) { setErro('Selecione o tipo do seu negócio'); return }
    setLoading(true)
    setErro('')

    try {
      const res = await fetch('/api/onboarding/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmento, setores: setoresEditaveis }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao configurar'); setLoading(false); return }
      router.push('/modulos')
    } catch {
      setErro('Erro ao salvar configuração')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="VPS Gestão" width={200} height={64} priority />
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <div className="text-center mb-6">
            <h2 className="text-white text-xl font-semibold mb-2">Bem-vindo ao VPS Gestão! 🎉</h2>
            <p className="text-gray-400 text-sm">Qual é o tipo do seu negócio?</p>
          </div>

          {/* Grid de segmentos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {SEGMENTOS.map(seg => (
              <button
                key={seg.id}
                onClick={() => selecionarSegmento(seg.id)}
                className={`text-left p-3 rounded-xl border transition ${
                  segmento === seg.id
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                }`}
              >
                <div className="text-xl mb-1">{seg.emoji}</div>
                <div className="text-xs font-semibold text-white leading-tight">{seg.nome}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-tight">{seg.descricao}</div>
              </button>
            ))}
          </div>

          {/* Setores editáveis */}
          {segmento && (
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
              <p className="text-xs font-medium text-gray-400 mb-3">
                {segmento === 'personalizado' ? 'Adicione seus setores:' : 'Setores do template — edite à vontade:'}
              </p>

              <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                {setoresEditaveis.map((setor, i) => (
                  <span key={i} className="flex items-center gap-1 bg-orange-500/20 text-orange-400 text-xs px-3 py-1 rounded-full border border-orange-500/30">
                    {setor}
                    <button onClick={() => removerSetor(i)} className="ml-1 hover:text-red-400 transition font-bold">×</button>
                  </span>
                ))}
                {setoresEditaveis.length === 0 && (
                  <span className="text-xs text-gray-500">Nenhum setor adicionado ainda</span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={novoSetor}
                  onChange={e => setNovoSetor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetor())}
                  placeholder="+ Nome do setor..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  onClick={adicionarSetor}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg transition"
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          {erro && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2 mb-4">{erro}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !segmento}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-3 text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Configurando...' : 'Começar a usar o VPS Gestão →'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">VPS Gestão © 2026</p>
      </div>
    </div>
  )
}