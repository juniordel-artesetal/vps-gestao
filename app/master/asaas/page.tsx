'use client'
// app/master/asaas/page.tsx — conexão Asaas da PLATAFORMA (assinaturas + split de comissão).
// Master-only (cookie master_token via middleware). API key e token do webhook são
// gravados CRIPTOGRAFADOS e nunca voltam do servidor em claro — a tela só vê flags.
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CreditCard, CheckCircle2, XCircle, Save, Plug, Copy, Check,
  RefreshCw, AlertTriangle, Trash2,
} from 'lucide-react'
import Link from 'next/link'

interface Config {
  ativo: boolean; conectado: boolean; sandbox: boolean
  temApiKey: boolean; temWebhookToken: boolean
  walletIdPlataforma: string | null
  contaNome: string | null; contaEmail: string | null
  ultimoTesteEm: string | null; ultimoTesteOk: boolean | null; ultimoTesteErro: string | null
}
interface Evento {
  id: string; eventoId: string; evento: string
  pagamentoRef: string | null; assinaturaRef: string | null
  erro: string | null; recebidoEm: string; processadoEm: string | null
}

export default function MasterAsaasPage() {
  const router = useRouter()
  const [cfg, setCfg] = useState<Config | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [sandbox, setSandbox] = useState(true)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [pendentes, setPendentes] = useState(0)
  const [tokenNovo, setTokenNovo] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const aviso = (tipo: 'ok' | 'erro', texto: string) => {
    setMsg({ tipo, texto }); setTimeout(() => setMsg(null), 6000)
  }

  const carregar = useCallback(async () => {
    const res = await fetch('/api/config/asaas')
    if (res.status === 401) { router.push('/master/login'); return }
    if (res.ok) { const d: Config = await res.json(); setCfg(d); setSandbox(d.sandbox !== false) }

    const ev = await fetch('/api/config/asaas/eventos')
    if (ev.ok) { const d = await ev.json(); setEventos(d.eventos ?? []); setPendentes(d.pendentes ?? 0) }
    setCarregando(false)
  }, [router])
  useEffect(() => { carregar() }, [carregar])

  async function salvar() {
    setOcupado('salvar')
    const res = await fetch('/api/config/asaas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey || undefined, sandbox }),
    })
    setOcupado('')
    if (!res.ok) return aviso('erro', 'Não foi possível salvar.')
    setApiKey(''); aviso('ok', 'Configuração salva. Rode "Testar conexão".'); carregar()
  }

  async function testar() {
    setOcupado('testar')
    const res = await fetch('/api/config/asaas/testar', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setOcupado('')
    if (d.ok) aviso('ok', `Conectado${d.dados?.nome ? ` — ${d.dados.nome}` : ''}.`)
    else aviso('erro', d.erro || 'Falha ao conectar.')
    carregar()
  }

  // O token só é exibido AQUI, uma vez. Depois vive só criptografado no banco.
  async function gerarToken() {
    if (cfg?.temWebhookToken && !confirm(
      'Já existe um token. Gerar um novo INVALIDA o atual e o webhook do Asaas para de ser aceito até você colar o novo no painel. Continuar?'
    )) return
    setOcupado('token')
    const res = await fetch('/api/config/asaas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gerarWebhookToken: true }),
    })
    const d = await res.json().catch(() => ({}))
    setOcupado('')
    if (!d.webhookToken) return aviso('erro', 'Não foi possível gerar o token.')
    setTokenNovo(d.webhookToken); setCopiado(false); carregar()
  }

  async function alternarAtivo() {
    setOcupado('flag')
    await fetch('/api/config/asaas', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: !cfg?.ativo }),
    })
    setOcupado('')
    carregar()
  }

  async function reprocessar() {
    setOcupado('reproc')
    const res = await fetch('/api/config/asaas/eventos', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setOcupado('')
    if (d.ok) aviso('ok', `${d.aplicados} evento(s) aplicado(s), ${d.falhas} falha(s).`)
    else aviso('erro', d.erro || 'Falha ao reprocessar.')
    carregar()
  }

  async function desconectar() {
    if (!confirm('Isso apaga a API key e o token do webhook, e desliga o módulo. Continuar?')) return
    setOcupado('desc')
    await fetch('/api/config/asaas', { method: 'DELETE' })
    setOcupado(''); setTokenNovo(''); aviso('ok', 'Desconectado.'); carregar()
  }

  if (carregando) return <div className="p-6 text-gray-500 text-sm">Carregando…</div>

  const urlWebhook = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/asaas` : ''

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/master/parceiros" className="text-gray-400 hover:text-white"><ArrowLeft className="w-5 h-5" /></Link>
        <CreditCard className="w-6 h-6 text-orange-500" />
        <h1 className="text-xl font-bold">Asaas — motor de pagamento</h1>
        {cfg?.sandbox && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">SANDBOX</span>}
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.tipo === 'ok'
          ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
          : 'bg-red-500/15 text-red-200 border border-red-500/30'}`}>{msg.texto}</div>
      )}

      {/* ── STATUS + KILL-SWITCH ───────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-100">Status</span>
          {cfg?.conectado
            ? <span className="flex items-center gap-1 text-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Conectado</span>
            : <span className="flex items-center gap-1 text-sm text-gray-400"><XCircle className="w-4 h-4" /> Desconectado</span>}
        </div>

        {cfg?.contaNome && <p className="text-xs text-gray-400">Conta: {cfg.contaNome}{cfg.contaEmail ? ` · ${cfg.contaEmail}` : ''}</p>}
        {cfg?.walletIdPlataforma && <p className="text-xs text-gray-500 font-mono break-all">wallet: {cfg.walletIdPlataforma}</p>}
        {cfg?.ultimoTesteEm && (
          <p className={`text-xs ${cfg.ultimoTesteOk ? 'text-gray-500' : 'text-red-300'}`}>
            Último teste: {cfg.ultimoTesteEm}{cfg.ultimoTesteErro ? ` — ${cfg.ultimoTesteErro}` : ''}
          </p>
        )}

        {/* Kill-switch: só liga se a credencial já foi testada com sucesso. */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-800">
          <div>
            <p className="text-sm font-medium text-gray-100">Módulo ativo</p>
            <p className="text-xs text-gray-500">Desligado, os webhooks são só guardados — nada é cobrado nem alterado.</p>
          </div>
          <button
            onClick={alternarAtivo}
            disabled={!cfg?.conectado || !!ocupado}
            title={!cfg?.conectado ? 'Teste a conexão antes de ligar o módulo' : ''}
            className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed ${
              cfg?.ativo ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
          >{cfg?.ativo ? 'LIGADO' : 'DESLIGADO'}</button>
        </div>
      </div>

      {/* ── CREDENCIAL ─────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 mb-4">
        <h2 className="font-semibold text-gray-100">Credencial</h2>
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            API Key {cfg?.temApiKey && <span className="text-emerald-400">(salva)</span>}
          </label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off"
            placeholder={cfg?.temApiKey ? '•••• (mantém se vazio)' : 'cole a API key do Asaas'}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100" />
          <p className="text-xs text-gray-500 mt-1">
            Guardada criptografada. A chave de sandbox não funciona em produção e vice-versa.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-300">
          <input type="checkbox" checked={sandbox} onChange={e => setSandbox(e.target.checked)} /> Ambiente Sandbox (teste)
        </label>
        <div className="flex flex-wrap gap-2">
          <button onClick={salvar} disabled={!!ocupado}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50">
            <Save className="w-4 h-4" /> {ocupado === 'salvar' ? 'Salvando…' : 'Salvar'}
          </button>
          <button onClick={testar} disabled={!cfg?.temApiKey || !!ocupado}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 font-medium disabled:opacity-40">
            <Plug className="w-4 h-4" /> {ocupado === 'testar' ? 'Testando…' : 'Testar conexão'}
          </button>
          {cfg?.temApiKey && (
            <button onClick={desconectar} disabled={!!ocupado}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-red-300 hover:bg-red-500/10 text-sm disabled:opacity-40">
              <Trash2 className="w-4 h-4" /> Desconectar
            </button>
          )}
        </div>
      </div>

      {/* ── WEBHOOK ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 mb-4">
        <h2 className="font-semibold text-gray-100">Webhook</h2>
        <div>
          <label className="text-xs text-gray-400 block mb-1">URL (cadastre no painel do Asaas)</label>
          <code className="block bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-300 break-all">{urlWebhook}</code>
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">
            Token de autenticação {cfg?.temWebhookToken && <span className="text-emerald-400">(salvo)</span>}
          </label>
          {tokenNovo ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <code className="flex-1 bg-gray-800 border border-emerald-500/40 rounded-lg px-3 py-2 text-xs text-emerald-200 break-all">{tokenNovo}</code>
                <button onClick={() => { navigator.clipboard.writeText(tokenNovo); setCopiado(true) }}
                  className="px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100">
                  {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Copie agora — este token não será exibido de novo. Cole no campo de token ao cadastrar o webhook no Asaas.
              </p>
            </div>
          ) : (
            <button onClick={gerarToken} disabled={!!ocupado}
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100 text-sm disabled:opacity-40">
              {ocupado === 'token' ? 'Gerando…' : cfg?.temWebhookToken ? 'Gerar novo token' : 'Gerar token'}
            </button>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Sem token salvo, o webhook rejeita tudo com 401 (fail closed).
          </p>
        </div>
      </div>

      {/* ── EVENTOS ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-100">Últimos eventos</h2>
          {pendentes > 0 && (
            <button onClick={reprocessar} disabled={!cfg?.ativo || !!ocupado}
              title={!cfg?.ativo ? 'Ligue o módulo para reprocessar' : ''}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30 text-xs disabled:opacity-40">
              <RefreshCw className="w-3.5 h-3.5" />
              {ocupado === 'reproc' ? 'Reprocessando…' : `Reprocessar ${pendentes} pendente(s)`}
            </button>
          )}
        </div>

        {eventos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum evento recebido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 border-b border-gray-800">
                <tr>
                  <th className="text-left py-2 font-medium">Evento</th>
                  <th className="text-left py-2 font-medium">Cobrança</th>
                  <th className="text-left py-2 font-medium">Recebido</th>
                  <th className="text-left py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {eventos.map(e => (
                  <tr key={e.id} className="border-b border-gray-800/60">
                    <td className="py-2 pr-3 font-mono">{e.evento}</td>
                    <td className="py-2 pr-3 font-mono text-gray-500">{e.pagamentoRef ?? '—'}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-500">{e.recebidoEm}</td>
                    <td className="py-2">
                      {e.processadoEm
                        ? <span className="text-emerald-400">processado</span>
                        : <span className="text-amber-300" title={e.erro ?? ''}>pendente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
