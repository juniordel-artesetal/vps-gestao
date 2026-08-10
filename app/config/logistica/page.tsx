'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Truck, CheckCircle2, XCircle, Link2, Unlink, Save, PackageCheck } from 'lucide-react'

interface Config {
  provedor: string; conectado: boolean
  remetenteNome: string | null; remetenteDoc: string | null; cepOrigem: string | null
  logradouroOrigem: string | null; numeroOrigem: string | null; bairroOrigem: string | null
  cidadeOrigem: string | null; ufOrigem: string | null; tokenExpiraEm: string | null
}

function ConfigLogisticaInner() {
  const params = useSearchParams()
  const [moduloPostagem, setModulo] = useState(false)
  const [credenciaisServidor, setCredSrv] = useState(false)
  const [cfg, setCfg] = useState<Config | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const res = await fetch('/api/config/logistica')
      if (res.ok) {
        const d = await res.json()
        setModulo(!!d.moduloPostagem)
        setCredSrv(!!d.credenciaisServidor)
        setCfg(d.config)
      }
    } finally { setCarregando(false) }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    const c = params.get('conexao')
    if (c === 'ok') setMsg('✅ Conta conectada com sucesso!')
    else if (c === 'erro') setMsg('❌ Não foi possível conectar. Tente de novo.')
    else if (c === 'negado') setMsg('Conexão cancelada.')
    if (c) setTimeout(() => setMsg(''), 5000)
  }, [params])

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    setCfg(prev => prev ? { ...prev, [k]: v } : prev)
  }

  async function salvarTudo() {
    setSalvando(true)
    try {
      await fetch('/api/config/logistica', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduloPostagem, remetente: cfg }),
      })
      setMsg('Configurações salvas.')
      setTimeout(() => setMsg(''), 3000)
      carregar()
    } finally { setSalvando(false) }
  }

  async function desconectar() {
    if (!confirm('Desconectar a conta de transportadora?')) return
    await fetch('/api/config/logistica', { method: 'DELETE' })
    carregar()
  }

  if (carregando) return <div className="p-6 text-gray-400 text-sm">Carregando…</div>

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
          <Truck className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Postagem &amp; Frete</h1>
          <p className="text-sm text-gray-500">Cote, compre e imprima etiquetas de envio direto no sistema.</p>
        </div>
      </div>

      {msg && <div className="mb-4 px-4 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-sm">{msg}</div>}

      {/* Toggle do módulo */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2"><PackageCheck className="w-4 h-4 text-orange-500" /> Módulo de Postagem</div>
            <p className="text-xs text-gray-500 mt-0.5">Ativa a cotação de frete e a emissão de etiquetas. Desligado = nada aparece.</p>
          </div>
          <input type="checkbox" checked={moduloPostagem} onChange={e => setModulo(e.target.checked)} className="w-5 h-5 accent-orange-500" />
        </label>
      </div>

      {moduloPostagem && (
        <>
          {/* Conexão da transportadora */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-800 dark:text-gray-100">Conta Melhor Envio (transportadora)</div>
                <p className="text-xs text-gray-500 mt-0.5">Para vendas diretas: Correios, Jadlog e outras. As da Shopee/ML vêm do próprio marketplace.</p>
              </div>
              {cfg?.conectado
                ? <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium"><CheckCircle2 className="w-4 h-4" /> Conectada</span>
                : <span className="flex items-center gap-1 text-sm text-gray-400"><XCircle className="w-4 h-4" /> Desconectada</span>}
            </div>

            {!credenciaisServidor && (
              <div className="mt-3 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                As credenciais do app Melhor Envio ainda não estão configuradas no servidor (variáveis MELHORENVIO_*). Conexão indisponível até isso.
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {cfg?.conectado ? (
                <>
                  <a href="/api/logistica/oauth/iniciar" className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:brightness-95">
                    <Link2 className="w-4 h-4" /> Reconectar
                  </a>
                  <button onClick={desconectar} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                    <Unlink className="w-4 h-4" /> Desconectar
                  </button>
                </>
              ) : (
                <a
                  href={credenciaisServidor ? '/api/logistica/oauth/iniciar' : undefined}
                  aria-disabled={!credenciaisServidor}
                  className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium ${credenciaisServidor ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed pointer-events-none'}`}
                >
                  <Link2 className="w-4 h-4" /> Conectar Melhor Envio
                </a>
              )}
            </div>
            {cfg?.tokenExpiraEm && (
              <p className="text-[11px] text-gray-400 mt-2">Token válido até {new Date(cfg.tokenExpiraEm).toLocaleDateString('pt-BR')} (renovado automaticamente).</p>
            )}
          </div>

          {/* Remetente */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
            <div className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Endereço de origem (remetente)</div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nome / Ateliê" value={cfg?.remetenteNome} onChange={v => set('remetenteNome', v)} />
              <Campo label="CPF/CNPJ" value={cfg?.remetenteDoc} onChange={v => set('remetenteDoc', v)} />
              <Campo label="CEP" value={cfg?.cepOrigem} onChange={v => set('cepOrigem', v)} />
              <Campo label="Logradouro" value={cfg?.logradouroOrigem} onChange={v => set('logradouroOrigem', v)} />
              <Campo label="Número" value={cfg?.numeroOrigem} onChange={v => set('numeroOrigem', v)} />
              <Campo label="Bairro" value={cfg?.bairroOrigem} onChange={v => set('bairroOrigem', v)} />
              <Campo label="Cidade" value={cfg?.cidadeOrigem} onChange={v => set('cidadeOrigem', v)} />
              <Campo label="UF" value={cfg?.ufOrigem} onChange={v => set('ufOrigem', v)} />
            </div>
          </div>
        </>
      )}

      <button onClick={salvarTudo} disabled={salvando}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50">
        <Save className="w-4 h-4" /> {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  )
}

function Campo({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500 block mb-1">{label}</label>
      <input value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100" />
    </div>
  )
}

export default function ConfigLogisticaPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400 text-sm">Carregando…</div>}>
      <ConfigLogisticaInner />
    </Suspense>
  )
}
