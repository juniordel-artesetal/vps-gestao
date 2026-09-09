'use client'
// Configuração do 2FA (verificação em duas etapas) da conta logada.
// Ativar: iniciar → ler o QR no app autenticador → confirmar o código → guardar os
// códigos de recuperação. Desativar: exige um código válido. Tudo via /api/config/2fa.
import { useEffect, useState } from 'react'
import { Lock, ShieldCheck, Copy, Check } from 'lucide-react'

type Passo = 'carregando' | 'inativo' | 'config' | 'ativo'

export default function SegurancaPage() {
  const [passo, setPasso] = useState<Passo>('carregando')
  const [backupRestantes, setBackupRestantes] = useState(0)
  const [qr, setQr] = useState('')
  const [segredo, setSegredo] = useState('')
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiado, setCopiado] = useState(false)

  async function carregarStatus() {
    try {
      const r = await fetch('/api/config/2fa')
      const d = await r.json()
      setBackupRestantes(d.backupRestantes ?? 0)
      setPasso(d.ativo ? 'ativo' : 'inativo')
    } catch { setPasso('inativo') }
  }
  useEffect(() => { carregarStatus() }, [])

  async function iniciar() {
    setErro(''); setCarregando(true)
    try {
      const r = await fetch('/api/config/2fa', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Erro ao iniciar.'); return }
      setQr(d.qr); setSegredo(d.segredo); setCodigo(''); setBackupCodes([])
      setPasso('config')
    } finally { setCarregando(false) }
  }

  async function ativar() {
    setErro(''); setCarregando(true)
    try {
      const r = await fetch('/api/config/2fa', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Código incorreto.'); return }
      setBackupCodes(d.backupCodes || [])
      setBackupRestantes((d.backupCodes || []).length)
      setPasso('ativo')
    } finally { setCarregando(false) }
  }

  async function desativar() {
    setErro('')
    const c = window.prompt('Para desativar, digite um código do app autenticador (ou um código de recuperação):')
    if (!c) return
    setCarregando(true)
    try {
      const r = await fetch('/api/config/2fa', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: c }),
      })
      const d = await r.json()
      if (!r.ok) { setErro(d.error || 'Não foi possível desativar.'); return }
      setBackupCodes([]); setSegredo(''); setQr('')
      await carregarStatus()
    } finally { setCarregando(false) }
  }

  function copiarBackup() {
    navigator.clipboard?.writeText(backupCodes.join('\n')).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
          <Lock size={18} className="text-orange-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Segurança da conta</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Verificação em duas etapas (2FA)</p>
        </div>
      </div>

      <div className="mt-5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
        {passo === 'carregando' && <p className="text-sm text-gray-400">Carregando…</p>}

        {passo === 'inativo' && (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Com o 2FA ligado, além da senha o login pede um código gerado no seu celular
              (Google Authenticator, Authy, etc.). Isso protege a conta mesmo se a senha vazar.
            </p>
            <button onClick={iniciar} disabled={carregando}
              className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-50">
              {carregando ? 'Aguarde…' : 'Ativar verificação em duas etapas'}
            </button>
          </>
        )}

        {passo === 'config' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              1. Abra seu app autenticador e escaneie o QR Code abaixo (ou digite o código manual).
            </p>
            {qr && <img src={qr} alt="QR Code do 2FA" className="rounded-lg border border-gray-200 dark:border-gray-700" width={200} height={200} />}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Código manual: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded select-all">{segredo}</code>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">2. Digite o código de 6 dígitos do app</label>
              <input
                type="text" inputMode="numeric" value={codigo}
                onChange={e => { setCodigo(e.target.value); setErro('') }}
                placeholder="000000" maxLength={6}
                className="w-40 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm tracking-widest bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={ativar} disabled={carregando || codigo.length < 6}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors disabled:opacity-50">
                {carregando ? 'Verificando…' : 'Confirmar e ativar'}
              </button>
              <button onClick={() => { setPasso('inativo'); setErro('') }} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm px-3">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {passo === 'ativo' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <ShieldCheck size={18} />
              <span className="font-semibold text-sm">Verificação em duas etapas ativa</span>
            </div>

            {backupCodes.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Guarde seus códigos de recuperação</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 mb-3">
                  São mostrados só agora. Use um deles se perder o acesso ao app. Cada código serve uma vez.
                </p>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-sm text-gray-800 dark:text-gray-100">
                  {backupCodes.map(c => <span key={c} className="select-all">{c}</span>)}
                </div>
                <button onClick={copiarBackup} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 hover:underline">
                  {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar todos</>}
                </button>
              </div>
            )}

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Códigos de recuperação restantes: <strong>{backupRestantes}</strong>
            </p>
            <button onClick={desativar} disabled={carregando}
              className="text-red-600 dark:text-red-400 hover:underline text-sm disabled:opacity-50">
              Desativar verificação em duas etapas
            </button>
          </div>
        )}

        {erro && <p className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{erro}</p>}
      </div>
    </div>
  )
}
