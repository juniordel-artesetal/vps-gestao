'use client'
import { useState } from 'react'
import { Bug, Lightbulb, Sparkles, ImageIcon, X, CheckCircle, Loader2 } from 'lucide-react'

const TIPOS = [
  {
    value: 'BUG',
    label: 'Bug',
    emoji: '🐛',
    icon: Bug,
    cor: 'red',
    desc: 'Algo está quebrado ou funcionando errado',
    selectedCls: 'border-red-400 bg-red-50 dark:bg-red-900/20',
    iconCls: 'text-red-500',
    labelCls: 'text-red-700 dark:text-red-400',
  },
  {
    value: 'MELHORIA',
    label: 'Melhoria',
    emoji: '✨',
    icon: Sparkles,
    cor: 'blue',
    desc: 'Uma funcionalidade pode ser melhorada',
    selectedCls: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20',
    iconCls: 'text-blue-500',
    labelCls: 'text-blue-700 dark:text-blue-400',
  },
  {
    value: 'SUGESTAO',
    label: 'Sugestão',
    emoji: '💡',
    icon: Lightbulb,
    cor: 'yellow',
    desc: 'Ideia de nova funcionalidade',
    selectedCls: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    iconCls: 'text-yellow-500',
    labelCls: 'text-yellow-700 dark:text-yellow-400',
  },
]

const inputClass =
  'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 ' +
  'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500'

export default function FeedbackPage() {
  const [tipo,          setTipo]          = useState('')
  const [titulo,        setTitulo]        = useState('')
  const [descricao,     setDescricao]     = useState('')
  const [imagemBase64,  setImagemBase64]  = useState<string | null>(null)
  const [imagemNome,    setImagemNome]    = useState('')
  const [enviando,      setEnviando]      = useState(false)
  const [sucesso,       setSucesso]       = useState(false)
  const [erro,          setErro]          = useState('')

  function handleImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setErro('Imagem muito grande. Tamanho máximo: 2 MB.')
      return
    }
    setErro('')
    setImagemNome(file.name)
    const reader = new FileReader()
    reader.onload = () => setImagemBase64(reader.result as string)
    reader.readAsDataURL(file)
    // limpa o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''
  }

  async function handleSubmit() {
    if (!tipo)           { setErro('Selecione o tipo de feedback.'); return }
    if (!titulo.trim())  { setErro('Informe um título.');            return }
    if (!descricao.trim()) { setErro('Descreva o problema ou sugestão.'); return }
    setErro('')
    setEnviando(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, titulo: titulo.trim(), descricao: descricao.trim(), imagemBase64 }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao enviar')
      }
      setSucesso(true)
    } catch (err: any) {
      setErro(err.message || 'Erro ao enviar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  function resetForm() {
    setSucesso(false)
    setTipo('')
    setTitulo('')
    setDescricao('')
    setImagemBase64(null)
    setImagemNome('')
    setErro('')
  }

  // ── Tela de sucesso ────────────────────────────────────────────────────────
  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center px-4">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Feedback enviado!
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm">
            Obrigada pelo retorno! Nossa equipe vai analisar e trazer atualizações em breve.
          </p>
        </div>
        <button
          onClick={resetForm}
          className="mt-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold
                     hover:bg-orange-600 transition-colors"
        >
          Enviar outro feedback
        </button>
      </div>
    )
  }

  // ── Formulário ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Cabeçalho */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Portal de Feedback
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Encontrou um bug? Tem uma ideia para melhorar o sistema? Nos conte! 💬
        </p>
      </div>

      {/* Tipo de feedback */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Tipo de feedback <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TIPOS.map(t => {
            const Icon = t.icon
            const sel  = tipo === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center
                  ${sel
                    ? t.selectedCls
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-200 dark:hover:border-gray-600'
                  }`}
              >
                <Icon className={`w-6 h-6 ${sel ? t.iconCls : 'text-gray-400'}`} />
                <span className={`text-sm font-semibold ${sel ? t.labelCls : 'text-gray-600 dark:text-gray-400'}`}>
                  {t.emoji} {t.label}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 leading-tight">
                  {t.desc}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Título */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Título <span className="text-red-500">*</span>
        </label>
        <input
          className={inputClass}
          placeholder="Resumo curto do problema ou sugestão"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          maxLength={120}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{titulo.length}/120</p>
      </div>

      {/* Descrição */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Descrição <span className="text-red-500">*</span>
        </label>
        <textarea
          className={inputClass + ' min-h-[130px] resize-y'}
          placeholder={
            tipo === 'BUG'
              ? 'Descreva o que aconteceu:\n• O que você estava fazendo?\n• O que esperava acontecer?\n• O que aconteceu de fato?'
              : 'Descreva com detalhes a sua ideia ou sugestão de melhoria...'
          }
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          rows={5}
        />
      </div>

      {/* Upload de imagem */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Print de tela <span className="text-gray-400 font-normal">(opcional)</span>
        </label>

        {imagemBase64 ? (
          <div className="relative border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <img
              src={imagemBase64}
              alt="Preview do print"
              className="max-h-52 w-full object-contain bg-gray-50 dark:bg-gray-900"
            />
            <button
              type="button"
              onClick={() => { setImagemBase64(null); setImagemNome('') }}
              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors shadow"
              title="Remover imagem"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" />
              {imagemNome}
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center gap-3 border-2 border-dashed border-gray-200
                            dark:border-gray-700 rounded-xl p-8 cursor-pointer
                            hover:border-orange-300 dark:hover:border-orange-700
                            hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors">
            <ImageIcon className="w-9 h-9 text-gray-300 dark:text-gray-600" />
            <div className="text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Clique para anexar um print
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                PNG, JPG ou WEBP — máximo 2 MB
              </p>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleImagem}
            />
          </label>
        )}
      </div>

      {/* Erro */}
      {erro && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200
                        dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400
                        flex items-center gap-2">
          <span className="text-base">⚠️</span>
          {erro}
        </div>
      )}

      {/* Botão */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={enviando}
        className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold
                   hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed
                   flex items-center justify-center gap-2 transition-colors text-sm"
      >
        {enviando ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
        ) : (
          'Enviar Feedback'
        )}
      </button>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-4">
        Seu feedback é lido e analisado pela nossa equipe. Obrigada! 💛
      </p>
    </div>
  )
}
