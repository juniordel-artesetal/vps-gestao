'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserPlus, Shield, Users, Wrench, X, Eye, EyeOff } from 'lucide-react'

interface Usuario {
  id: string
  nome: string
  email: string
  role: 'ADMIN' | 'DELEGADOR' | 'OPERADOR'
  ativo: boolean
  createdAt: string
}

const ROLES = [
  {
    id: 'ADMIN',
    label: 'Administrador',
    descricao: 'Acesso total — precificação, financeiro, configurações',
    cor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: Shield,
  },
  {
    id: 'DELEGADOR',
    label: 'Supervisor(a)',
    descricao: 'Acesso à produção e delegação de tarefas',
    cor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: Users,
  },
  {
    id: 'OPERADOR',
    label: 'Operador(a)',
    descricao: 'Só executa tarefas de produção',
    cor: 'bg-green-50 text-green-700 border-green-200',
    icon: Wrench,
  },
]

function getRoleBadge(role: string) {
  const r = ROLES.find(r => r.id === role)
  return r ? (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${r.cor}`}>
      {r.label}
    </span>
  ) : null
}

export default function ConfigUsuariosPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState('')
  const [erro, setErro] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    role: 'OPERADOR' as 'ADMIN' | 'DELEGADOR' | 'OPERADOR',
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') router.push('/modulos')
      else carregarUsuarios()
    }
  }, [status])

  async function carregarUsuarios() {
    try {
      const res = await fetch('/api/config/usuarios')
      const data = await res.json()
      setUsuarios(data.usuarios || [])
    } catch {
      setErro('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  function atualizaForm(campo: string, valor: string) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  async function criarUsuario(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErro('')

    try {
      const res = await fetch('/api/config/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao criar usuário')
        return
      }

      setUsuarios(prev => [...prev, data.usuario])
      setModalAberto(false)
      setForm({ nome: '', email: '', senha: '', role: 'OPERADOR' })
      mostrarSucessoMsg('Usuário criado com sucesso!')
    } catch {
      setErro('Erro ao criar usuário')
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    // Não deixa desativar o próprio usuário
    if (id === session?.user?.id) {
      setErro('Você não pode desativar sua própria conta')
      setTimeout(() => setErro(''), 3000)
      return
    }
    try {
      await fetch(`/api/config/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !ativo }),
      })
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ativo: !ativo } : u))
    } catch {
      setErro('Erro ao atualizar usuário')
    }
  }

  async function alterarRole(id: string, role: string) {
    if (id === session?.user?.id) {
      setErro('Você não pode alterar seu próprio perfil')
      setTimeout(() => setErro(''), 3000)
      return
    }
    try {
      await fetch(`/api/config/usuarios/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      setUsuarios(prev => prev.map(u => u.id === id ? { ...u, role: role as any } : u))
      mostrarSucessoMsg('Perfil atualizado!')
    } catch {
      setErro('Erro ao atualizar perfil')
    }
  }

  function mostrarSucessoMsg(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 3000)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Usuários</h1>
            <p className="text-sm text-gray-500">Gerencie a equipe do seu negócio</p>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <UserPlus size={15} />
            Novo usuário
          </button>
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

        {/* Legenda de perfis */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {ROLES.map(role => {
            const RoleIcon = role.icon
            return (
              <div key={role.id} className={`border rounded-xl p-3 ${role.cor}`}>
                <div className="flex items-center gap-2 mb-1">
                  <RoleIcon size={14} />
                  <span className="text-xs font-semibold">{role.label}</span>
                </div>
                <p className="text-xs opacity-75">{role.descricao}</p>
              </div>
            )
          })}
        </div>

        {/* Lista de usuários */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Usuário</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Perfil</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(usuario => (
                <tr key={usuario.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-semibold flex-shrink-0">
                        {usuario.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                          {usuario.nome}
                          {usuario.id === session?.user?.id && (
                            <span className="text-xs text-gray-400">(você)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">{usuario.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {usuario.id === session?.user?.id ? (
                      getRoleBadge(usuario.role)
                    ) : (
                      <select
                        value={usuario.role}
                        onChange={e => alterarRole(usuario.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                      >
                        <option value="ADMIN">Administrador</option>
                        <option value="DELEGADOR">Supervisor(a)</option>
                        <option value="OPERADOR">Operador(a)</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAtivo(usuario.id, usuario.ativo)}
                      disabled={usuario.id === session?.user?.id}
                      className={`text-xs px-2 py-0.5 rounded-full border transition ${
                        usuario.ativo
                          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                      } disabled:cursor-default`}
                    >
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-gray-300">
                      {new Date(usuario.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                </tr>
              ))}

              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nenhum usuário cadastrado além de você
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Usuários inativos não conseguem fazer login mas mantêm o histórico de tarefas
        </p>

      </div>

      {/* Modal criar usuário */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-100 w-full max-w-md p-6">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Novo usuário</h2>
                <p className="text-xs text-gray-400 mt-0.5">A senha pode ser alterada pelo usuário depois</p>
              </div>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={criarUsuario} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Nome</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => atualizaForm('nome', e.target.value)}
                  className={inputClass}
                  placeholder="Ex: Ana Paula"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => atualizaForm('email', e.target.value)}
                  className={inputClass}
                  placeholder="ana@email.com"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Senha inicial</label>
                <div className="relative">
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={form.senha}
                    onChange={e => atualizaForm('senha', e.target.value)}
                    className={inputClass + ' pr-10'}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-2">Perfil de acesso</label>
                <div className="flex flex-col gap-2">
                  {ROLES.map(role => {
                    const RoleIcon = role.icon
                    return (
                      <label
                        key={role.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                          form.role === role.id
                            ? 'border-orange-400 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={role.id}
                          checked={form.role === role.id}
                          onChange={() => atualizaForm('role', role.id)}
                          className="mt-0.5 accent-orange-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <RoleIcon size={13} className="text-gray-500" />
                            <span className="text-xs font-semibold text-gray-800">{role.label}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{role.descricao}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {erro && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setModalAberto(false); setErro('') }}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm transition hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-2 text-sm font-semibold transition disabled:opacity-50"
                >
                  {salvando ? 'Criando...' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
