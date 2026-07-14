'use client'
// Tela do Master pra conectar o Google Drive do dono (onde os vídeos do suporte ficam).
// Credenciais ficam no servidor; aqui só o botão "Conectar" e o status.
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

type Status = { configurado: boolean; conectado: boolean; contaEmail: string | null; pastaOk: boolean }

const MSG_ERRO: Record<string, string> = {
  nao_autorizado: 'Sessão do Master expirada. Entre novamente.',
  recusado: 'Você recusou a autorização no Google.',
  state: 'Falha de segurança na validação (state). Tente de novo.',
  token: 'O Google não devolveu os tokens. Refaça a conexão (confira as credenciais no servidor).',
}

function Conteudo() {
  const params = useSearchParams()
  const [st, setSt] = useState<Status | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    try {
      const r = await fetch('/api/master/google-drive/config')
      setSt(r.ok ? await r.json() : null)
    } catch { setSt(null) }
    setCarregando(false)
  }
  useEffect(() => { carregar() }, [])

  async function desconectar() {
    if (!confirm('Desconectar o Google Drive? Vídeos já enviados continuam no seu Drive; novos envios ficam bloqueados até reconectar.')) return
    await fetch('/api/master/google-drive/config', { method: 'DELETE' })
    carregar()
  }

  const ok = params.get('ok')
  const erro = params.get('erro')

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">Google Drive — Vídeos do Suporte</h1>
      <p className="text-sm text-gray-500 mb-6">
        Os vídeos anexados nos chamados do suporte são salvos no <b>seu</b> Google Drive
        (pasta <code>SOA - Suporte/Videos</code>). Escopo mínimo: o app só enxerga os arquivos que ele mesmo cria.
      </p>

      {ok && <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-800 px-4 py-3 text-sm">✅ Google Drive conectado com sucesso.</div>}
      {erro && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">⚠️ {MSG_ERRO[erro] || 'Erro ao conectar.'}</div>}

      {carregando ? (
        <div className="text-gray-400 text-sm">Carregando…</div>
      ) : !st ? (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm">Não foi possível ler o status. Confira se você está logado no Master.</div>
      ) : !st.configurado ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900 mb-2">Credenciais ainda não configuradas no servidor</p>
          <p className="text-sm text-amber-800 mb-2">Defina estas variáveis de ambiente (Vercel → Settings → Environment Variables) e faça redeploy:</p>
          <pre className="text-xs bg-white/70 rounded p-3 overflow-x-auto">GOOGLE_DRIVE_CLIENT_ID=…
GOOGLE_DRIVE_CLIENT_SECRET=…
GOOGLE_DRIVE_REDIRECT_URI=https://usesoa.com.br/api/master/google-drive/callback</pre>
          <p className="text-xs text-amber-700 mt-2">O <code>refresh token</code> é gerado ao conectar e fica criptografado no banco — nunca em env, log ou commit.</p>
        </div>
      ) : (
        <div className="rounded-xl border p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{st.conectado ? '🟢 Conectado' : '⚪ Não conectado'}</p>
              {st.contaEmail && <p className="text-sm text-gray-500">Conta: {st.contaEmail}</p>}
              {st.conectado && <p className="text-xs text-gray-400 mt-1">{st.pastaOk ? 'Pasta destino pronta.' : 'A pasta destino será criada no primeiro envio.'}</p>}
            </div>
            {st.conectado ? (
              <button onClick={desconectar} className="px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50">Desconectar</button>
            ) : (
              <a href="/api/master/google-drive/iniciar" className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600">Conectar Google Drive</a>
            )}
          </div>
          {st.conectado && (
            <a href="/api/master/google-drive/iniciar" className="inline-block mt-4 text-xs text-orange-600 hover:underline">Reconectar / trocar de conta</a>
          )}
        </div>
      )}
    </div>
  )
}

export default function GoogleDrivePage() {
  return <Suspense fallback={<div className="p-6 text-gray-400">Carregando…</div>}><Conteudo /></Suspense>
}
