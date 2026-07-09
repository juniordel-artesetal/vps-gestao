'use client'

import { useState, useEffect } from 'react'
import ModalImportacaoMateriais from '@/components/ModalImportacaoMateriais'

interface Material {
  id: string
  nome: string
  unidade: string
  precoPacote: number
  qtdPacote: number
  precoUnidade: number
  precoMetroLinear?: number | null
  larguraTecido?: number | null
  fornecedor: string | null
  ativo?: boolean
  vinculado?: boolean
  descricao?: string | null
  // saldo vindo do estoque (merged no load)
  saldoEstoque?: number | null
  estoqueMinimo?: number | null
  estoqueStatus?: 'ok' | 'alerta' | 'zerado' | null
}

interface Fornecedor {
  id: string
  nome: string
  ativo: boolean
}

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
const UNIDADES = ['unidade', 'metros', 'm²', 'centímetros', 'gramas', 'folha', 'pacote', 'rolo', 'kg', 'litro']

function fmtBRL(n: number, decimais = 2) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: decimais, maximumFractionDigits: decimais })
}

export default function MateriaisPage() {
  const [materiais, setMateriais] = useState<Material[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [showNovoForn, setShowNovoForn] = useState(false)
  const [novoFornForm, setNovoFornForm] = useState({ nome: '', telefone: '', email: '' })
  const [salvandoForn, setSalvandoForn] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [busca, setBusca]         = useState('')
  const [modalImport, setModalImport] = useState(false)
  // Filtros detalhados
  const [fFornecedor, setFFornecedor] = useState('')
  const [fUnidade, setFUnidade]       = useState('')
  const [fPrecoMin, setFPrecoMin]     = useState('')
  const [fPrecoMax, setFPrecoMax]     = useState('')
  const [fSemPreco, setFSemPreco]     = useState(false)
  const [fVinculo, setFVinculo]       = useState('') // '' | 'com' | 'sem'
  const [fStatus, setFStatus]         = useState('ativos') // 'ativos'|'inativos'|'todos'
  // Seleção / ações em massa
  const [sel, setSel]                 = useState<Set<string>>(new Set())
  const [aplicandoLote, setAplicandoLote] = useState(false)
  const [form, setForm] = useState({
    nome: '', unidade: 'unidade', precoPacote: '', qtdPacote: '', fornecedor: '',
    precoMetroLinear: '', larguraTecido: '',
  })

  async function load() {
    setLoading(true)
    const [mats, estoques] = await Promise.all([
      fetch('/api/precificacao/materiais?status=' + fStatus).then(r => r.json()).catch(() => []),
      fetch('/api/estoque/materiais').then(r => r.json()).catch(() => []),  // ← endpoint correto
    ])
    // Merge saldo do estoque em cada material
    // A API retorna: saldoAtual, estoqueMinimo (não saldo/minimo)
    const estoqueMap: Record<string, any> = {}
    if (Array.isArray(estoques)) {
      estoques.forEach((e: any) => { if (e.materialId) estoqueMap[e.materialId] = e })
    }
    const merged = (Array.isArray(mats) ? mats : []).map((m: Material) => {
      const est = estoqueMap[m.id]
      if (!est) return m
      const saldo = Number(est.saldoAtual ?? 0)       // ← campo correto
      const min   = est.estoqueMinimo != null ? Number(est.estoqueMinimo) : null  // ← campo correto
      const status: 'ok' | 'alerta' | 'zerado' = saldo <= 0 ? 'zerado' : (min !== null && min > 0 && saldo <= min ? 'alerta' : 'ok')
      return { ...m, saldoEstoque: saldo, estoqueMinimo: min, estoqueStatus: status }
    })
    setMateriais(merged)
    setLoading(false)
  }

  useEffect(() => { load() }, [fStatus]) // recarrega ao trocar status (ver inativos)
  useEffect(() => { setSel(new Set()) }, [fStatus, busca, fFornecedor, fUnidade, fPrecoMin, fPrecoMax, fSemPreco, fVinculo])

  useEffect(() => {
    // Carrega fornecedores para o select
    fetch('/api/fornecedores?ativo=true')
      .then(r => r.ok ? r.json() : [])
      .then(d => setFornecedores(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  function openNew() {
    setForm({ nome: '', unidade: 'unidade', precoPacote: '', qtdPacote: '', fornecedor: '', precoMetroLinear: '', larguraTecido: '' })
    setEditId(null); setShowForm(true)
  }

  function openEdit(m: Material) {
    setForm({
      nome: m.nome, unidade: m.unidade,
      precoPacote: String(m.precoPacote), qtdPacote: String(m.qtdPacote),
      fornecedor: m.fornecedor || '',
      precoMetroLinear: m.precoMetroLinear != null ? String(m.precoMetroLinear) : '',
      larguraTecido:    m.larguraTecido    != null ? String(m.larguraTecido)    : '',
    })
    setEditId(m.id); setShowForm(true)
  }

  async function salvarNovoFornecedor() {
    if (!novoFornForm.nome.trim()) return alert('Nome do fornecedor é obrigatório')
    setSalvandoForn(true)
    try {
      const res = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoFornForm.nome, whatsapp: novoFornForm.telefone, email: novoFornForm.email, ativo: true }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao salvar fornecedor')
      const novo = await res.json()
      // Recarrega lista de fornecedores e seleciona o novo automaticamente
      const lista = await fetch('/api/fornecedores?ativo=true').then(r => r.json()).catch(() => [])
      setFornecedores(Array.isArray(lista) ? lista : [])
      setForm(p => ({ ...p, fornecedor: novoFornForm.nome }))
      setNovoFornForm({ nome: '', telefone: '', email: '' })
      setShowNovoForn(false)
    } catch (e: any) { alert(e.message) }
    finally { setSalvandoForn(false) }
  }

  async function handleSave() {
    const ehTecido = form.unidade === 'm²' || form.unidade === 'm2'
    if (ehTecido) {
      const temPrecoMetro = form.precoMetroLinear || (form.precoPacote && form.qtdPacote)
      if (!form.nome || !form.larguraTecido || !temPrecoMetro)
        return alert('Para tecido em m², informe o preço por metro (ou o preço do rolo e os metros) e a largura do tecido')
    } else if (!form.nome || !form.precoPacote || !form.qtdPacote) {
      return alert('Nome, preço e quantidade são obrigatórios')
    }
    setSaving(true)
    try {
      const url    = editId ? `/api/precificacao/materiais/${editId}` : '/api/precificacao/materiais'
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowForm(false); load()
    } catch (e: any) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este material?')) return
    await fetch(`/api/precificacao/materiais/${id}`, { method: 'DELETE' })
    load()
  }

  const fornecedoresLista = Array.from(new Set(materiais.map(m => m.fornecedor).filter(Boolean))) as string[]
  const unidadesLista     = Array.from(new Set(materiais.map(m => m.unidade).filter(Boolean))) as string[]

  const filtered = materiais.filter(m => {
    const q = busca.toLowerCase()
    if (q && !(m.nome.toLowerCase().includes(q) || (m.fornecedor || '').toLowerCase().includes(q))) return false
    if (fFornecedor && (m.fornecedor || '') !== fFornecedor) return false
    if (fUnidade && m.unidade !== fUnidade) return false
    const pu = Number(m.precoUnidade) || 0
    if (fPrecoMin && pu < Number(fPrecoMin)) return false
    if (fPrecoMax && pu > Number(fPrecoMax)) return false
    if (fSemPreco && pu > 0) return false
    if (fVinculo === 'com' && !m.vinculado) return false
    if (fVinculo === 'sem' && m.vinculado) return false
    return true
  })

  const toggleSel = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const todosMarcados = filtered.length > 0 && filtered.every(m => sel.has(m.id))
  const marcarTodos = () => setSel(s => { const n = new Set(s); todosMarcados ? filtered.forEach(m => n.delete(m.id)) : filtered.forEach(m => n.add(m.id)); return n })

  async function aplicarLote(payload: any, confirmMsg?: string) {
    if (sel.size === 0) return
    if (confirmMsg && !confirm(confirmMsg)) return
    setAplicandoLote(true)
    try {
      const res = await fetch('/api/precificacao/materiais/lote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(sel), ...payload }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro na ação em massa')
      setSel(new Set()); load()
    } catch (e: any) { alert(e.message) } finally { setAplicandoLote(false) }
  }
  const loteAjustePreco = () => { const p = prompt('Reajustar o PREÇO dos materiais selecionados em % (ex: 10 ou -5):'); if (p !== null && p.trim() !== '') aplicarLote({ acao: 'ajustePreco', pct: Number(p.replace(',', '.')) }) }
  const loteEditarForn  = () => { const f = prompt('Definir FORNECEDOR dos selecionados (deixe vazio para limpar):'); if (f !== null) aplicarLote({ acao: 'editar', fornecedor: f.trim() }) }
  const loteEditarUnid  = () => { const u = prompt('Definir UNIDADE dos selecionados (ex: un, m², m, kg, g, unidade):'); if (u && u.trim()) aplicarLote({ acao: 'editar', unidade: u.trim() }) }

  // Preço por unidade (prévia) — em modo tecido (m²) deriva de metro linear ÷ largura
  const ehTecido = form.unidade === 'm²' || form.unidade === 'm2'
  const nP = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
  const precoMetroEfetivo = ehTecido
    ? (nP(form.precoMetroLinear) ?? (nP(form.precoPacote) != null && nP(form.qtdPacote) != null ? nP(form.precoPacote)! / nP(form.qtdPacote)! : null))
    : null
  const precoUnidade = ehTecido
    ? (precoMetroEfetivo != null && nP(form.larguraTecido) != null ? precoMetroEfetivo / nP(form.larguraTecido)! : null)
    : (nP(form.precoPacote) != null && nP(form.qtdPacote) != null ? nP(form.precoPacote)! / nP(form.qtdPacote)! : null)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Materiais</h1>
          <p className="text-gray-500 text-sm mt-1">
            Cadastre as matérias-primas. O rendimento por produto é definido em cada configuração de produto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModalImport(true)} className="border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-4 py-2 rounded-lg">
            Importar materiais
          </button>
          <button onClick={openNew} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
            + Novo Material
          </button>
        </div>
      </div>

      {modalImport && (
        <ModalImportacaoMateriais onClose={() => setModalImport(false)} onImportado={() => { setModalImport(false); load() }} />
      )}

      {/* Filtros detalhados */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome/fornecedor..." className={inputClass + ' max-w-[220px]'} />
        <select value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} className={inputClass + ' max-w-[170px]'}>
          <option value="">Todos fornecedores</option>
          {fornecedoresLista.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={fUnidade} onChange={e => setFUnidade(e.target.value)} className={inputClass + ' max-w-[130px]'}>
          <option value="">Todas unidades</option>
          {unidadesLista.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <input value={fPrecoMin} onChange={e => setFPrecoMin(e.target.value)} placeholder="Preço mín" type="number" className={inputClass + ' max-w-[100px]'} />
        <input value={fPrecoMax} onChange={e => setFPrecoMax(e.target.value)} placeholder="Preço máx" type="number" className={inputClass + ' max-w-[100px]'} />
        <select value={fVinculo} onChange={e => setFVinculo(e.target.value)} className={inputClass + ' max-w-[150px]'}>
          <option value="">Com/sem vínculo</option>
          <option value="com">Vinculados</option>
          <option value="sem">Sem vínculo</option>
        </select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className={inputClass + ' max-w-[120px]'}>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
          <option value="todos">Todos</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 px-2"><input type="checkbox" checked={fSemPreco} onChange={e => setFSemPreco(e.target.checked)} className="accent-orange-500" /> Sem preço</label>
      </div>

      {/* Ações em massa */}
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
          <span className="text-sm text-orange-700 font-medium">{sel.size} selecionado(s)</span>
          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
            <button onClick={() => aplicarLote({ acao: 'ativar' })} disabled={aplicandoLote} className="text-xs font-medium text-green-700 bg-white border border-green-200 hover:bg-green-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">Ativar</button>
            <button onClick={() => aplicarLote({ acao: 'inativar' })} disabled={aplicandoLote} className="text-xs font-medium text-yellow-700 bg-white border border-yellow-200 hover:bg-yellow-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">Inativar</button>
            <button onClick={loteAjustePreco} disabled={aplicandoLote} className="text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">Ajustar preço %</button>
            <button onClick={loteEditarForn} disabled={aplicandoLote} className="text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">Editar fornecedor</button>
            <button onClick={loteEditarUnid} disabled={aplicandoLote} className="text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">Editar unidade</button>
            <button onClick={() => aplicarLote({ acao: 'excluir' }, `Excluir ${sel.size} material(is)? Os que estão em uso viram inativos; os demais são removidos.`)} disabled={aplicandoLote} className="text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg disabled:opacity-50">Excluir</button>
            <button onClick={() => setSel(new Set())} className="text-xs text-gray-500 hover:text-gray-700 px-2">Limpar</button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editId ? 'Editar' : 'Novo'} Material</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                  className={inputClass} placeholder="Ex: Papel Offset A4 180g" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unidade de compra</label>
                  <select value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} className={inputClass}>
                    {/* Mostra a unidade atual mesmo se não estiver na lista padrão (ex.: importados 'un', 'm', 'g') */}
                    {form.unidade && !UNIDADES.includes(form.unidade) && <option value={form.unidade}>{form.unidade}</option>}
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Fornecedor</label>
                  <div className="flex gap-2">
                    <select
                      value={form.fornecedor}
                      onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">— Nenhum —</option>
                      {fornecedores.map(f => (
                        <option key={f.id} value={f.nome}>{f.nome}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setShowNovoForn(v => !v); setNovoFornForm({ nome: '', telefone: '', email: '' }) }}
                      className="flex-shrink-0 text-xs bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 px-2.5 py-1.5 rounded-lg font-medium transition whitespace-nowrap"
                      title="Cadastrar novo fornecedor"
                    >
                      + Novo
                    </button>
                  </div>

                  {/* Mini-form inline de novo fornecedor */}
                  {showNovoForn && (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-orange-700">Cadastrar novo fornecedor</p>
                      <input
                        value={novoFornForm.nome}
                        onChange={e => setNovoFornForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Nome do fornecedor *"
                        className={inputClass}
                        autoFocus
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={novoFornForm.telefone}
                          onChange={e => setNovoFornForm(p => ({ ...p, telefone: e.target.value }))}
                          placeholder="Telefone (opcional)"
                          className={inputClass}
                        />
                        <input
                          value={novoFornForm.email}
                          onChange={e => setNovoFornForm(p => ({ ...p, email: e.target.value }))}
                          placeholder="E-mail (opcional)"
                          className={inputClass}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={salvarNovoFornecedor}
                          disabled={salvandoForn}
                          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {salvandoForn ? 'Salvando...' : 'Salvar e selecionar'}
                        </button>
                        <button
                          onClick={() => setShowNovoForn(false)}
                          className="flex-1 border border-gray-200 text-gray-500 text-xs py-1.5 rounded-lg hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Modo tecido (m²): compra por metro linear, consome por área */}
              {ehTecido && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700">🧵 Tecido comprado por metro</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Preço por metro (R$/m)</label>
                      <input type="number" step="0.01" min="0" value={form.precoMetroLinear}
                        onChange={e => setForm(p => ({ ...p, precoMetroLinear: e.target.value }))}
                        className={inputClass} placeholder="Ex: 9,50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Largura do tecido (m) *</label>
                      <input type="number" step="0.01" min="0" value={form.larguraTecido}
                        onChange={e => setForm(p => ({ ...p, larguraTecido: e.target.value }))}
                        className={inputClass} placeholder="Ex: 1,40" />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">
                    Não tem o preço por metro? Informe abaixo o preço do rolo e os metros — o sistema calcula (rolo ÷ metros = R$/m).
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {ehTecido ? 'Preço do rolo (R$)' : 'Preço do pacote (R$) *'}
                  </label>
                  <input type="number" step="0.01" min="0" value={form.precoPacote}
                    onChange={e => setForm(p => ({ ...p, precoPacote: e.target.value }))}
                    className={inputClass} placeholder={ehTecido ? 'Ex: 475,00' : 'Ex: 90,00'} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {ehTecido ? 'Metros no rolo' : 'Qtd no pacote *'}
                  </label>
                  <input type="number" step={ehTecido ? '0.01' : '1'} min={ehTecido ? '0' : '1'} value={form.qtdPacote}
                    onChange={e => setForm(p => ({ ...p, qtdPacote: e.target.value }))}
                    className={inputClass} placeholder={ehTecido ? 'Ex: 50' : 'Ex: 500'} />
                </div>
              </div>
              {precoUnidade !== null && (
                <div className="bg-orange-50 rounded-lg px-3 py-2 text-sm text-orange-700 font-medium">
                  {ehTecido ? (
                    <>
                      Preço por m²: <strong>R$ {fmtBRL(precoUnidade, 4)}</strong>
                      {precoMetroEfetivo != null && (
                        <span className="text-orange-500 font-normal"> · {fmtBRL(precoMetroEfetivo, 2)} R$/m ÷ {form.larguraTecido} m de largura</span>
                      )}
                    </>
                  ) : (
                    <>Preço por unidade ({form.unidade}): <strong>R$ {precoUnidade >= 1 ? fmtBRL(precoUnidade, 2) : fmtBRL(precoUnidade, 4)}</strong></>
                  )}
                </div>
              )}
              {/* Saldo em estoque — exibe se o material já tem registro */}
              {editId && (() => {
                const mat = materiais.find(m => m.id === editId)
                if (!mat || mat.saldoEstoque == null) return (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 flex items-center justify-between">
                    <span>📦 Sem registro no estoque ainda</span>
                    <a href="/precificacao/estoque-materiais" className="text-orange-500 hover:underline">Adicionar ao estoque →</a>
                  </div>
                )
                const cor = mat.estoqueStatus === 'zerado' ? 'bg-red-50 text-red-600' : mat.estoqueStatus === 'alerta' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'
                return (
                  <div className={`rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-between ${cor}`}>
                    <span>📦 Saldo em estoque: <strong>{Number(mat.saldoEstoque).toLocaleString('pt-BR')} {mat.unidade}</strong></span>
                    {mat.estoqueStatus === 'zerado' && <span>⚠️ Zerado</span>}
                    {mat.estoqueStatus === 'alerta' && <span>⚠️ Abaixo do mínimo</span>}
                    {mat.estoqueStatus === 'ok' && <span>✓ OK</span>}
                  </div>
                )
              })()}
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                💡 O rendimento (quantos produtos saem de cada unidade) é definido ao adicionar este material em um produto.
              </p>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 rounded-lg disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
          {busca ? 'Nenhum material encontrado.' : 'Nenhum material cadastrado. Clique em "+ Novo Material" para começar.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs">
                <th className="px-3 py-3"><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} className="accent-orange-500" /></th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase">Material</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase">Fornecedor</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Estoque</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Preço pacote</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Qtd pacote</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Preço / unidade</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} className={'border-b border-gray-50 ' + (sel.has(m.id) ? 'bg-orange-50/50 ' : i % 2 === 0 ? '' : 'bg-gray-50/40')}>
                  <td className="px-3 py-3"><input type="checkbox" checked={sel.has(m.id)} onChange={() => toggleSel(m.id)} className="accent-orange-500" /></td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {m.nome}
                    <span className="ml-2 text-xs text-gray-400">({m.unidade})</span>
                    {m.ativo === false && <span className="ml-2 text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">inativo</span>}
                    {m.vinculado && <span className="ml-1 text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">vinculado</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.fornecedor || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {m.saldoEstoque == null ? (
                      <span className="text-xs text-gray-300">—</span>
                    ) : m.estoqueStatus === 'zerado' ? (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Zerado</span>
                    ) : m.estoqueStatus === 'alerta' ? (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        {Number(m.saldoEstoque).toLocaleString('pt-BR')} ⚠️
                      </span>
                    ) : (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        {Number(m.saldoEstoque).toLocaleString('pt-BR')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">R$ {fmtBRL(Number(m.precoPacote))}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{Number(m.qtdPacote).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3 text-center font-bold text-orange-600">
                    R$ {fmtBRL(Number(m.precoUnidade), 4)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => openEdit(m)} className="text-xs text-blue-500 hover:underline">Editar</button>
                      <button onClick={() => handleDelete(m.id)} className="text-xs text-red-500 hover:underline">Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
