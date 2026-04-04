'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CheckCircle, AlertCircle, AtSign, Phone, Mail, Link, MapPin, FileText, Users, HelpCircle, Upload, X, Package, UserCheck } from 'lucide-react'
import { aplicarTema } from '@/components/ThemeLoader'
import { VERSAO_ATUAL } from '@/lib/versao'

const PRESETS = [
  { id: 'laranja',  nome: 'Laranja',  cor: '#f97316' },
  { id: 'roxo',     nome: 'Roxo',     cor: '#7c3aed' },
  { id: 'ciano',    nome: 'Ciano',    cor: '#0891b2' },
  { id: 'verde',    nome: 'Verde',    cor: '#16a34a' },
  { id: 'ambar',    nome: 'Âmbar',    cor: '#d97706' },
  { id: 'vermelho', nome: 'Vermelho', cor: '#dc2626' },
  { id: 'rosa',     nome: 'Rosa',     cor: '#db2777' },
  { id: 'carvao',   nome: 'Carvão',   cor: '#374151' },
]

const ESTADOS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const COMO_CONHECEU = ['Instagram','TikTok','YouTube','Indicação de amiga','Google','Grupo do WhatsApp','Telegram','Hotmart','Outro']

// Segmentos do artesanato
// Mesmos segmentos do Setup/Onboarding
const SEGMENTOS = [
  { id: 'lacos',            nome: 'Laços e Tiaras',        emoji: '🎀' },
  { id: 'costura',          nome: 'Costura e Moda',         emoji: '🧵' },
  { id: 'bijuteria',        nome: 'Bijuteria e Joias',      emoji: '💍' },
  { id: 'sublimacao',       nome: 'Sublimação',             emoji: '🖨️' },
  { id: 'croche_trico',     nome: 'Crochê e Tricô',         emoji: '🧶' },
  { id: 'mdf_madeira',      nome: 'MDF e Madeira',          emoji: '🪵' },
  { id: 'biscuit',          nome: 'Biscuit e Modelagem',    emoji: '🎨' },
  { id: 'festas',           nome: 'Festas e Lembrancinhas', emoji: '🎉' },
  { id: 'papelaria',        nome: 'Papelaria Criativa',     emoji: '📒' },
  { id: 'encadernacao',     nome: 'Encadernação Artesanal', emoji: '📚' },
  { id: 'velas_cosmeticos', nome: 'Velas e Cosméticos',     emoji: '🕯️' },
  { id: 'macrame',          nome: 'Macramê e Têxtil',       emoji: '🪢' },
  { id: 'resina',           nome: 'Resina e Acrílico',      emoji: '💎' },
  { id: 'ceramica',         nome: 'Cerâmica e Barro',       emoji: '🏺' },
  { id: 'costura_criativa', nome: 'Costura Criativa',       emoji: '👜' },
  { id: 'balao',            nome: 'Balão Personalizado',    emoji: '🎈' },
  { id: 'personalizado',    nome: 'Personalizado',          emoji: '⚙️' },
]

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
const labelClass = "block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1"

export default function ConfigGeralPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nome: '', corPrimaria: '#f97316', logo: '',
    nomeProprietaria: '', instagram: '', whatsapp: '', emailContato: '',
    telegram: '', linkLoja: '', cidade: '', estado: '', cnpj: '',
    comoConheceu: '', qtdColaboradoras: 1, aceitaMarketing: true,
    // NOVOS campos
    segmento:        '',
    moduloEstoque:   false,
    moduloDemandas:  false,
  })
  const [corCustom,       setCorCustom]       = useState('#f97316')
  const [loading,         setLoading]         = useState(true)
  const [salvando,        setSalvando]        = useState(false)
  const [sucesso,         setSucesso]         = useState(false)
  const [profileCompleto, setProfileCompleto] = useState(false)
  const [erro,            setErro]            = useState('')
  const [logoPreview,     setLogoPreview]     = useState('')
  const [uploadandoLogo,  setUploadandoLogo]  = useState(false)

  useEffect(() => {
    fetch('/api/config/geral')
      .then(r => { if (!r.ok) throw new Error('erro'); return r.text() })
      .then(t => { try { return t ? JSON.parse(t) : null } catch { return null } })
      .then(d => {
        if (d) {
          setForm({
            nome:             d.nome             || '',
            corPrimaria:      d.corPrimaria       || '#f97316',
            logo:             d.logo              || '',
            nomeProprietaria: d.nomeProprietaria  || '',
            instagram:        d.instagram         || '',
            whatsapp:         d.whatsapp          || '',
            emailContato:     d.emailContato      || session?.user?.email || '',
            telegram:         d.telegram          || '',
            linkLoja:         d.linkLoja          || '',
            cidade:           d.cidade            || '',
            estado:           d.estado            || '',
            cnpj:             d.cnpj              || '',
            comoConheceu:     d.comoConheceu      || '',
            qtdColaboradoras: d.qtdColaboradoras  || 1,
            aceitaMarketing:  d.aceitaMarketing   ?? true,
            segmento:         d.segmento          || '',
            moduloEstoque:    d.moduloEstoque      ?? false,
            moduloDemandas:   d.moduloDemandas     ?? false,
          })
          setCorCustom(d.corPrimaria || '#f97316')
          setProfileCompleto(d.profileCompleto || false)
          if (d.logo) setLogoPreview(d.logo)
        }
      })
      .finally(() => setLoading(false))
  }, [session])

  function atualiza(campo: string, valor: any) {
    setForm(prev => ({ ...prev, [campo]: valor }))
  }

  function selecionarCor(cor: string) {
    atualiza('corPrimaria', cor)
    setCorCustom(cor)
    aplicarTema(cor)
  }

  // Upload de logo — converte para base64
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setErro('Logo deve ter no máximo 2MB')
      return
    }
    setUploadandoLogo(true)
    const reader = new FileReader()
    reader.onload = ev => {
      const base64 = ev.target?.result as string
      setLogoPreview(base64)
      atualiza('logo', base64)
      setUploadandoLogo(false)
    }
    reader.readAsDataURL(file)
  }

  function removerLogo() {
    setLogoPreview('')
    atualiza('logo', '')
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!form.nome.trim())             return setErro('Nome do ateliê é obrigatório')
    if (!form.nomeProprietaria.trim()) return setErro('Nome da proprietária é obrigatório')
    if (!form.instagram.trim())        return setErro('@Instagram é obrigatório')
    if (!form.whatsapp.trim())         return setErro('WhatsApp é obrigatório')
    if (!form.emailContato.trim())     return setErro('E-mail de contato é obrigatório')
    // Segmento obrigatório (#23)
    if (!form.segmento)                return setErro('Segmento é obrigatório — nos ajuda a personalizar o sistema para você')

    setSalvando(true)
    try {
      const res  = await fetch('/api/config/geral', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error || 'Erro ao salvar'); return }
      setProfileCompleto(data.profileCompleto)
      aplicarTema(form.corPrimaria)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch { setErro('Erro ao salvar configurações') }
    finally { setSalvando(false) }
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Carregando...</div>

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Configurações Gerais</h1>
          <p className="text-sm text-gray-500 mt-0.5">Personalize seu sistema e mantenha seu perfil atualizado</p>
        </div>
        {profileCompleto
          ? <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full"><CheckCircle size={12}/> Perfil completo</span>
          : <span className="flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full"><AlertCircle size={12}/> Complete seu perfil</span>
        }
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* ── LOGO DA EMPRESA ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">🖼️ Logo do seu ateliê</h2>
          <div className="flex items-center gap-4">
            {/* Preview */}
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 bg-gray-50 dark:bg-gray-800">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <Upload size={24} className="text-gray-300" />
              )}
            </div>
            {/* Controles */}
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">JPG ou PNG, máximo 2MB. Aparece na sidebar e tela de login.</p>
              <div className="flex gap-2 flex-wrap">
                <button type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadandoLogo}
                  className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                  <Upload size={12} />
                  {uploadandoLogo ? 'Carregando...' : logoPreview ? 'Trocar logo' : 'Enviar logo'}
                </button>
                {logoPreview && (
                  <button type="button" onClick={removerLogo}
                    className="flex items-center gap-1.5 text-xs border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">
                    <X size={12} /> Remover
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoChange} className="hidden" />
            </div>
          </div>
        </div>

        {/* ── DADOS DO NEGÓCIO ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">📋 Dados do negócio</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2">
              <label className={labelClass}>Nome do Ateliê <span className="text-red-500">*</span></label>
              <input value={form.nome} onChange={e => atualiza('nome', e.target.value)}
                className={inputClass} placeholder="Ex: Ateliê da Maria" required />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}>Nome da Proprietária <span className="text-red-500">*</span></label>
              <input value={form.nomeProprietaria} onChange={e => atualiza('nomeProprietaria', e.target.value)}
                className={inputClass} placeholder="Seu nome completo" required />
            </div>

            {/* SEGMENTO OBRIGATÓRIO (#23) */}
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Segmento do negócio <span className="text-red-500">*</span>
                <span className="ml-1 text-xs text-gray-400 font-normal">— personaliza o sistema para você</span>
              </label>
              <select value={form.segmento} onChange={e => atualiza('segmento', e.target.value)}
                className={inputClass} required>
                <option value="">Selecione seu segmento...</option>
                {SEGMENTOS.map(s => <option key={s.id} value={s.id}>{s.emoji} {s.nome}</option>)}
              </select>
              {!form.segmento && (
                <p className="text-xs text-orange-500 mt-1">⚠ Informe o segmento para que possamos personalizar o sistema</p>
              )}
            </div>

            <div>
              <label className={labelClass}><AtSign size={11} className="inline mr-1"/>@Instagram <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                <input value={form.instagram} onChange={e => atualiza('instagram', e.target.value.replace('@',''))}
                  className={inputClass + ' pl-7'} placeholder="seu.atelier" required />
              </div>
            </div>

            <div>
              <label className={labelClass}><Phone size={11} className="inline mr-1"/>WhatsApp <span className="text-red-500">*</span></label>
              <input value={form.whatsapp} onChange={e => atualiza('whatsapp', e.target.value)}
                className={inputClass} placeholder="(11) 99999-9999" required />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}><Mail size={11} className="inline mr-1"/>E-mail de contato <span className="text-red-500">*</span></label>
              <input type="email" value={form.emailContato} onChange={e => atualiza('emailContato', e.target.value)}
                className={inputClass} placeholder="contato@seuatelie.com.br" required />
            </div>

          </div>
        </div>

        {/* ── CANAIS OPCIONAIS ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">🔗 Canais e links <span className="text-xs font-normal text-gray-400">(opcionais)</span></h2>
          <p className="text-xs text-gray-400 mb-4">Quanto mais informações, melhores conteúdos e dicas exclusivas você receberá</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className={labelClass}>Telegram</label>
              <input value={form.telegram} onChange={e => atualiza('telegram', e.target.value)}
                className={inputClass} placeholder="@seutelegram" />
            </div>

            <div>
              <label className={labelClass}><Link size={11} className="inline mr-1"/>Link da Loja</label>
              <input value={form.linkLoja} onChange={e => atualiza('linkLoja', e.target.value)}
                className={inputClass} placeholder="https://link.bio/sualoja" />
            </div>

            <div>
              <label className={labelClass}><FileText size={11} className="inline mr-1"/>CNPJ / CPF</label>
              <input value={form.cnpj} onChange={e => atualiza('cnpj', e.target.value)}
                className={inputClass} placeholder="00.000.000/0001-00" />
            </div>

            <div>
              <label className={labelClass}><Users size={11} className="inline mr-1"/>Qtd de colaboradoras</label>
              <select value={form.qtdColaboradoras} onChange={e => atualiza('qtdColaboradoras', Number(e.target.value))} className={inputClass}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n === 10 ? '10 ou mais' : `${n} pessoa${n > 1 ? 's' : ''}`}</option>)}
              </select>
            </div>

            <div>
              <label className={labelClass}><MapPin size={11} className="inline mr-1"/>Cidade</label>
              <input value={form.cidade} onChange={e => atualiza('cidade', e.target.value)}
                className={inputClass} placeholder="São Paulo" />
            </div>

            <div>
              <label className={labelClass}>Estado</label>
              <select value={form.estado} onChange={e => atualiza('estado', e.target.value)} className={inputClass}>
                <option value="">Selecione...</option>
                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass}><HelpCircle size={11} className="inline mr-1"/>Como conheceu o VPS Gestão?</label>
              <select value={form.comoConheceu} onChange={e => atualiza('comoConheceu', e.target.value)} className={inputClass}>
                <option value="">Selecione...</option>
                {COMO_CONHECEU.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

          </div>
        </div>

        {/* ── MÓDULOS OPCIONAIS ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">⚙️ Módulos do sistema</h2>
          <p className="text-xs text-gray-400 mb-4">Ative apenas os módulos que fazem sentido para o seu negócio</p>
          <div className="flex flex-col gap-3">

            {/* Toggle Estoque */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Package size={15} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">Estoque de Produtos</p>
                  <p className="text-xs text-gray-400">Controle de produtos prontos para pronta entrega</p>
                </div>
              </div>
              <button type="button"
                onClick={() => atualiza('moduloEstoque', !form.moduloEstoque)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.moduloEstoque ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.moduloEstoque ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Toggle Demandas */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                  <UserCheck size={15} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">Demandas de Freelancers</p>
                  <p className="text-xs text-gray-400">Gerencie freelancers vinculados aos pedidos</p>
                </div>
              </div>
              <button type="button"
                onClick={() => atualiza('moduloDemandas', !form.moduloDemandas)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.moduloDemandas ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.moduloDemandas ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

          </div>
        </div>

        {/* ── TEMA DE CORES ── */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">🎨 Tema de cores</h2>
          <label className={labelClass}>Cor primária</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map(p => (
              <button key={p.id} type="button" onClick={() => selecionarCor(p.cor)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition ${
                  form.corPrimaria === p.cor
                    ? 'border-gray-400 bg-gray-50 dark:bg-gray-800 font-semibold'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}>
                <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: p.cor }}/>
                {p.nome}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <input type="color" value={corCustom}
              onChange={e => { setCorCustom(e.target.value); atualiza('corPrimaria', e.target.value); aplicarTema(e.target.value) }}
              className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200 p-0.5"/>
            <input value={corCustom}
              onChange={e => { setCorCustom(e.target.value); if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) { atualiza('corPrimaria', e.target.value); aplicarTema(e.target.value) }}}
              className={inputClass + ' w-32'} placeholder="#f97316"/>
            <div className="flex-1 h-10 rounded-xl border border-gray-100" style={{ background: form.corPrimaria }}/>
          </div>
        </div>

        {/* ── LGPD ── */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">🔒 Proteção de dados — LGPD</h3>
          <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed mb-3">
            Seus dados são coletados e armazenados de acordo com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
            Utilizamos suas informações exclusivamente para operar o sistema e, com seu consentimento,
            enviar conteúdos relevantes sobre gestão de ateliê e novos produtos da nossa empresa.
            Para exercer seus direitos de titular, entre em contato pelo e-mail <strong>suporte@vps-gestao.com.br</strong>.
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={form.aceitaMarketing} onChange={e => atualiza('aceitaMarketing', e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-400"/>
            <span className="text-xs text-blue-700 dark:text-blue-400">
              Aceito receber comunicações sobre novidades, dicas de gestão e ofertas exclusivas da VPS Gestão e produtos parceiros.
            </span>
          </label>
        </div>

        <p className="text-xs text-gray-400 text-center">VPS Gestão v{VERSAO_ATUAL}</p>

        {erro && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={14}/> {erro}
          </div>
        )}
        {sucesso && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-600 text-sm rounded-xl px-4 py-3">
            <CheckCircle size={14}/> Configurações salvas com sucesso!
          </div>
        )}

        <button type="submit" disabled={salvando}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold transition disabled:opacity-50"
          style={{ backgroundColor: 'var(--cor-primaria)' }}>
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>

      </form>
    </div>
  )
}
