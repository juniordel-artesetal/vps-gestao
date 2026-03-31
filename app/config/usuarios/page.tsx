'use client'
// ══════════════════════════════════════════════════════════════
// Destino: app/config/usuarios/page.tsx
// Função : CRUD de usuárias do workspace com controle de roles,
//          reset de senha e histórico de último login
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  UserPlus, Edit2, Trash2, X, AlertCircle,
  Shield, User, Eye, EyeOff, RefreshCw, Clock, Wifi
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────
interface Usuario {
  id: string
  nome: string
  email: string
  role: 'ADMIN' | 'DELEGADOR' | 'OPERADOR'
  ativo: boolean
  primeiroLogin: boolean
  createdAt: string
  ultimoLogin: string | null
  ultimoIp: string | null
}

const ic = 'w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white dark:bg-gray-800 dark:text-white'

const ROLES = [
  { value: 'ADMIN',     label: 'Administradora', desc: 'Acesso total a todos os módulos',           badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'DELEGADOR', label: 'Delegadora',     desc: 'Produção + Financeiro — sem Precificação',  badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'OPERADOR',  label: 'Operadora',      desc: 'Apenas operações de produção',              badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
]

function Badge({ role }: { role: string }) {
  const r = ROLES.find(x => x.value === role) || ROLES[2]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.badge}`}>{r.label}</span>
}

function tempo(s: string | null) {
  if (!s) return 'Nunca'
  const d   = new Date(s)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1)   return 'Agora há pouco'
  if (min < 60)  return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}h atrás`
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' })
}

function gerarSenhaAleatoria() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Modal criar / editar ─────────────────────────────────────
function ModalUsuaria({
  item, selfId, onClose, onSave,
}: {
  item: Usuario | null
  selfId: string
  onClose: () => void
  onSave: () => void
}) {
  const isEdit = !!item
  const [f, setF] = useState({
    nome:      item?.nome  || '',
    email:     item?.email || '',
    role:      item?.role  || 'OPERADOR',
    ativo:     item?.ativo !== false,
    senha:     '',
    novaSenha: '',
  })
  const [showS,  setShowS]  = useState(false)
  const [showN,  setShowN]  = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro,   setErro]   = useState('')

  function gerarSenha() {
    const s = gerarSenhaAleatoria()
    if (isEdit) { setF(p => ({ ...p, novaSenha: s })); setShowN(true) }
    else        { setF(p => ({ ...p, senha:     s })); setShowS(true) }
  }

  async function salvar() {
    if (!f.nome.trim())  { setErro('Nome é obrigatório'); return }
    if (!isEdit && !f.email.trim()) { setErro('E-mail é obrigatório'); return }
    if (!isEdit && f.senha.length < 6) { setErro('Senha mínima de 6 caracteres'); return }

    setSaving(true); setErro('')
    try {
      const url    = isEdit ? `/api/config/usuarios/${item!.id}` : '/api/config/usuarios'
      const method = isEdit ? 'PUT' : 'POST'
      const body: any = { nome: f.nome.trim(), role: f.role, ativo: f.ativo }
      if (!isEdit) { body.email = f.email.trim(); body.senha = f.senha }
      else if (f.novaSenha) body.novaSenha = f.novaSenha

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { setErro((await res.json()).error || 'Erro ao salvar'); return }
      onSave()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-800">
          <h2 className="font-semibold text-gray-800 dark:text-white">
            {isEdit ? `Editar: ${item!.nome}` : 'Nova Usuária'}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-5 space-y-4">
          {erro && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{erro}
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Nome completo *</label>
            <input className={ic} value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} placeholder="Nome da usuária" />
          </div>

          {/* E-mail (só criação) */}
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">E-mail *</label>
              <input className={ic} type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
          )}

          {/* Role selector */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Nível de acesso *</label>
            <div className="space-y-2">
              {ROLES.map(r => (
                <label key={r.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                  f.role === r.value ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/10' : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                }`}>
                  <input type="radio" name="role" value={r.value} checked={f.role === r.value} onChange={() => setF(p => ({ ...p, role: r.value as any }))} className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-white">{r.label}</span>
                      <Badge role={r.value} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Senha inicial (criação) */}
          {!isEdit && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Senha inicial *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input className={ic + ' pr-10'} type={showS ? 'text' : 'password'} value={f.senha} onChange={e => setF(p => ({ ...p, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                  <button type="button" onClick={() => setShowS(!showS)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showS ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="button" onClick={gerarSenha} title="Gerar senha aleatória" className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">A usuária será solicitada a trocar no primeiro acesso.</p>
            </div>
          )}

          {/* Reset senha (edição de terceiros) */}
          {isEdit && item?.id !== selfId && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Redefinir senha (opcional)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input className={ic + ' pr-10'} type={showN ? 'text' : 'password'} value={f.novaSenha} onChange={e => setF(p => ({ ...p, novaSenha: e.target.value }))} placeholder="Deixe em branco para não alterar" />
                  <button type="button" onClick={() => setShowN(!showN)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                    {showN ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="button" onClick={gerarSenha} title="Gerar senha" className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Ativo/inativo (só edição de terceiros) */}
          {isEdit && item?.id !== selfId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={f.ativo} onChange={e => setF(p => ({ ...p, ativo: e.target.checked }))} className="rounded" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Usuária ativa (pode fazer login)</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="px-4 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuária'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────
export default function UsuariosPage() {
  const { data: session } = useSession()
  const selfId = session?.user?.id || ''

  const [usuarios,   setUsuarios]   = useState<Usuario[]>([])
  const [loading,    setLoading]    = useState(true)
  const [modalForm,  setModalForm]  = useState<Usuario|null|false>(false)
  const [deletando,  setDeletando]  = useState<Usuario|null>(null)
  const [erroGlobal, setErroGlobal] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/config/usuarios')
      if (r.ok) setUsuarios(await r.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function deletar() {
    if (!deletando) return
    setErroGlobal('')
    const res = await fetch(`/api/config/usuarios/${deletando.id}`, { method: 'DELETE' })
    if (!res.ok) { setErroGlobal((await res.json()).error || 'Erro ao excluir') }
    setDeletando(null)
    await carregar()
  }

  const adminsAtivos = usuarios.filter(u => u.role === 'ADMIN' && u.ativo)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Usuárias do Ateliê</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gerencie quem tem acesso ao sistema e com qual permissão</p>
          </div>
          <button onClick={() => setModalForm(null)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 shadow-sm">
            <UserPlus className="w-4 h-4" />Nova Usuária
          </button>
        </div>

        {/* Erro global */}
        {erroGlobal && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />{erroGlobal}
            <button onClick={() => setErroGlobal('')} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Cards por role */}
        <div className="grid grid-cols-3 gap-3">
          {ROLES.map(r => {
            const cnt = usuarios.filter(u => u.role === r.value).length
            return (
              <div key={r.value} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{cnt}</p>
                <p className="text-xs text-gray-500 mt-0.5">{r.label}{cnt !== 1 ? 's' : ''}</p>
              </div>
            )
          })}
        </div>

        {/* Lista */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-10">Carregando...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Nenhuma usuária cadastrada</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {usuarios.map(u => (
                <div key={u.id} className={`flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors ${!u.ativo ? 'opacity-60' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    u.role === 'ADMIN' ? 'bg-purple-100 dark:bg-purple-900/30' :
                    u.role === 'DELEGADOR' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    {u.role === 'ADMIN'
                      ? <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      : <User className={`w-5 h-5 ${u.role === 'DELEGADOR' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`} />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">{u.nome}</span>
                      {u.id === selfId && <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-2 py-0.5 rounded-full">você</span>}
                      <Badge role={u.role} />
                      {!u.ativo && <span className="text-xs bg-red-100 dark:bg-red-900/20 text-red-600 px-2 py-0.5 rounded-full">inativa</span>}
                      {u.primeiroLogin && <span className="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 px-2 py-0.5 rounded-full">aguardando 1º acesso</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                  </div>

                  {/* Último login */}
                  <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />{tempo(u.ultimoLogin)}
                    </div>
                    {u.ultimoIp && (
                      <div className="flex items-center gap-1 text-xs text-gray-300 dark:text-gray-600">
                        <Wifi className="w-3 h-3" />{u.ultimoIp}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setModalForm(u)} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {/* Delete: não pode ser ela mesma, nem o único admin */}
                    {u.id !== selfId && !(u.role === 'ADMIN' && adminsAtivos.length <= 1) && (
                      <button onClick={() => setDeletando(u)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info de permissões */}
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Níveis de acesso</p>
          <div className="space-y-1.5">
            {ROLES.map(r => (
              <div key={r.value} className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400">
                <Badge role={r.value} /><span>— {r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modais */}
      {modalForm !== false && (
        <ModalUsuaria item={modalForm} selfId={selfId} onClose={() => setModalForm(false)} onSave={() => { setModalForm(false); carregar() }} />
      )}
      {deletando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Excluir usuária?</h3>
            <p className="text-sm text-gray-500 mb-4"><strong>{deletando.nome}</strong> perderá acesso ao sistema imediatamente.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeletando(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300">Cancelar</button>
              <button onClick={deletar} className="flex-1 px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
