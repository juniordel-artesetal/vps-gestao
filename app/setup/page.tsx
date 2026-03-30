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
  { id: 'costura_criativa', nome: 'Costura Criativa',          emoji: '👜', descricao: 'Bolsas, carteiras, nécessaires e acessórios em tecido ou couro', setores: ['Design', 'Corte', 'Montagem', 'Acabamento', 'Embalagem', 'Expedição'] },
  { id: 'balao',            nome: 'Balão Personalizado',       emoji: '🎈', descricao: 'Balões personalizados, decoração e festas',       setores: ['Design', 'Impressão', 'Corte', 'Montagem', 'Acabamento', 'Expedição'] },
  { id: 'personalizado',    nome: 'Personalizado',             emoji: '⚙️', descricao: 'Configuro meus próprios setores',                 setores: [] },
]

export default function SetupPage() {
  const router = useRouter()
  const [segmento, setSegmento] = useState('')
  const [setoresEditaveis, setSetoresEditaveis] = useState<string[]>([])
  const [novoSetor, setNovoSetor] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function selecionarSegmento(id: string) {
    const seg = SEGMENTOS.find(s => s.id === id)
    setSegmento(id)
    setSetoresEditaveis(seg?.setores ? [...seg.setores] : [])
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

  function moverSetor(de: number, para: number) {
    setSetoresEditaveis(prev => {
      const novo = [...prev]
      const [item] = novo.splice(de, 1)
      novo.splice(para, 0, item)
      return novo
    })
  }

  async function handleSubmit() {
    if (!segmento) { setErro('Selecione o tipo do seu negócio'); return }
    if (setoresEditaveis.length === 0) { setErro('Adicione pelo menos um setor'); return }
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

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="VPS Gestão" width={200} height={64} priority />
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">

          {/* Título */}
          <div className="text-center mb-6">
            <h2 className="text-white text-xl font-semibold mb-2">Bem-vindo ao VPS Gestão! 🎉</h2>
            <p className="text-gray-400 text-sm">Qual é o tipo do seu negócio? Vamos configurar tudo para você.</p>
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

          {/* Setores editáveis com drag and drop */}
          {segmento && (
            <div className="bg-gray-800 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-300">
                  {segmento === 'personalizado' ? 'Adicione seus setores:' : 'Setores do template — edite e reordene:'}
                </p>
                <span className="text-xs text-gray-500">{setoresEditaveis.length} setor{setoresEditaveis.length !== 1 ? 'es' : ''}</span>
              </div>
              <p className="text-xs text-gray-600 mb-3">Arraste para reordenar • Use ↑↓ • × para remover</p>

              {/* Lista de setores */}
              <div className="flex flex-col gap-2 mb-3">
                {setoresEditaveis.map((setor, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => setDragIndex(i)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      if (dragIndex !== null && dragIndex !== i) {
                        moverSetor(dragIndex, i)
                      }
                      setDragIndex(null)
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing group transition ${
                      dragIndex === i
                        ? 'border-orange-500 bg-orange-500/10 opacity-50'
                        : 'border-gray-600 bg-gray-700 hover:border-orange-500/50'
                    }`}
                  >
                    {/* Número ordem */}
                    <span className="text-xs font-bold text-orange-500 w-5 text-center flex-shrink-0">
                      {i + 1}
                    </span>

                    {/* Ícone drag */}
                    <svg className="w-3 h-3 text-gray-500 flex-shrink-0 group-hover:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                    </svg>

                    {/* Nome */}
                    <span className="text-sm text-white flex-1">{setor}</span>

                    {/* Setas */}
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={() => i > 0 && moverSetor(i, i - 1)}
                        disabled={i === 0}
                        className="text-gray-400 hover:text-white disabled:opacity-20 px-1.5 py-0.5 text-xs rounded hover:bg-gray-600 transition"
                        title="Mover para cima"
                      >↑</button>
                      <button
                        onClick={() => i < setoresEditaveis.length - 1 && moverSetor(i, i + 1)}
                        disabled={i === setoresEditaveis.length - 1}
                        className="text-gray-400 hover:text-white disabled:opacity-20 px-1.5 py-0.5 text-xs rounded hover:bg-gray-600 transition"
                        title="Mover para baixo"
                      >↓</button>
                    </div>

                    {/* Remover */}
                    <button
                      onClick={() => removerSetor(i)}
                      className="text-gray-500 hover:text-red-400 transition text-base font-bold flex-shrink-0 w-5 text-center"
                      title="Remover setor"
                    >×</button>
                  </div>
                ))}

                {setoresEditaveis.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-3">
                    Nenhum setor adicionado ainda — adicione abaixo
                  </p>
                )}
              </div>

              {/* Adicionar novo setor */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={novoSetor}
                  onChange={e => setNovoSetor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarSetor())}
                  placeholder="Nome do novo setor..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <button
                  onClick={adicionarSetor}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-4 py-2 rounded-lg transition font-medium"
                >
                  + Adicionar
                </button>
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2 mb-4">
              {erro}
            </p>
          )}

          {/* Botão finalizar */}
          <button
            onClick={handleSubmit}
            disabled={loading || !segmento}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-3 text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Configurando seu sistema...' : 'Começar a usar o VPS Gestão →'}
          </button>

        </div>

        <p className="text-center text-xs text-gray-600 mt-4">VPS Gestão © 2026</p>
      </div>
    </div>
  )
}
