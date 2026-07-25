'use client'
// Área da parceira — dois modos:
//   ONBOARDING (sessão leve, ainda não completou/aprovada): checklist para definir
//     senha, código e walletId.
//   PAINEL (aprovada + senha + código): a joia do Ticket 03/04.
// A decisão do modo vem do BANCO (endpoint /onboarding), não do cookie.
import { useEffect, useState } from 'react'

const ASAAS_REF = 'https://www.asaas.com/r/7606c57d-94eb-4b39-a708-e2b5f0c8d179'
const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (d: string) => new Date(d).toLocaleDateString('pt-BR')
const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500'

export default function AreaParceira() {
  const [st, setSt] = useState<any>(null)
  const [erro, setErro] = useState(false)

  const carregar = () => fetch('/api/parceira/onboarding').then(r => {
    // Artesã logada sem parceria vinculada → convite pra virar parceira.
    if (r.status === 401) { window.location.href = '/seja-parceira'; return null }
    return r.ok ? r.json() : Promise.reject()
  }).then(d => { if (d) setSt(d) }).catch(() => setErro(true))
  useEffect(() => { carregar() }, [])

  if (erro) return <Centro>Não consegui carregar sua área.</Centro>
  if (!st) return <Centro>Carregando…</Centro>
  return st.completo ? <Painel /> : <Onboarding st={st} recarregar={carregar} />
}

// ─────────────────────────────────────────── ONBOARDING
function Onboarding({ st, recarregar }: { st: any; recarregar: () => Promise<void> }) {
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [wallet, setWallet] = useState('')
  const [busy, setBusy] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [codStatus, setCodStatus] = useState<'' | 'checando' | 'livre' | 'ocupado' | 'invalido'>('')

  // Disponibilidade do código em tempo real.
  useEffect(() => {
    const c = codigo.trim()
    if (!c) { setCodStatus(''); return }
    setCodStatus('checando')
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/parceira/onboarding?codigo=${encodeURIComponent(c)}`)
        const d = await r.json()
        setCodStatus(!d.valido ? 'invalido' : d.disponivel ? 'livre' : 'ocupado')
      } catch { setCodStatus('') }
    }, 400)
    return () => clearTimeout(t)
  }, [codigo])

  const post = async (url: string, body: any, tag: string) => {
    setBusy(tag); setErros(e => ({ ...e, [tag]: '' }))
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErros(e => ({ ...e, [tag]: d.error || 'Não consegui salvar.' })); setBusy(''); return }
      setBusy(''); await recarregar()
    } catch { setErros(e => ({ ...e, [tag]: 'Erro de conexão.' })); setBusy('') }
  }

  const pronta = st.temSenha && st.temCodigo

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Oi, {st.nome}! 💛</h1>
        <p className="text-gray-400 text-sm mt-1">Falta pouco pra concluir seu cadastro de parceira.</p>

        {/* Senha */}
        <Passo n={1} feito={st.temSenha} titulo="Crie sua senha">
          {!st.temSenha && (
            <form onSubmit={e => { e.preventDefault(); post('/api/parceira/onboarding', { senha }, 'senha') }} className="space-y-2">
              <input type="password" className={inputCls} value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" required />
              <p className="text-xs text-gray-500">Depois você entra com seu e-mail e esta senha.</p>
              {erros.senha && <p className="text-xs text-red-400">{erros.senha}</p>}
              <button disabled={busy === 'senha'} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg py-2 text-sm font-semibold">{busy === 'senha' ? 'Salvando…' : 'Salvar senha'}</button>
            </form>
          )}
        </Passo>

        {/* Código */}
        <Passo n={2} feito={st.temCodigo} titulo="Escolha seu código">
          {st.temCodigo ? (
            <p className="text-sm text-gray-400">Seu código: <b className="text-white">{st.cupom}</b></p>
          ) : (
            <form onSubmit={e => { e.preventDefault(); post('/api/parceira/onboarding', { codigo }, 'codigo') }} className="space-y-2">
              <input className={inputCls} value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="MARIA10" required />
              <p className="text-xs">
                {codStatus === 'checando' && <span className="text-gray-500">conferindo…</span>}
                {codStatus === 'livre' && <span className="text-emerald-400">✅ disponível — vira seu link usesoa.com.br/r/{codigo} e seu cupom</span>}
                {codStatus === 'ocupado' && <span className="text-red-400">já está em uso, escolha outro</span>}
                {codStatus === 'invalido' && <span className="text-red-400">3 a 20 letras/números</span>}
                {!codStatus && <span className="text-gray-500">3–20 letras/números. Vira seu link E seu cupom.</span>}
              </p>
              {erros.codigo && <p className="text-xs text-red-400">{erros.codigo}</p>}
              <button disabled={busy === 'codigo' || codStatus === 'ocupado' || codStatus === 'invalido'} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg py-2 text-sm font-semibold">{busy === 'codigo' ? 'Salvando…' : 'Salvar código'}</button>
            </form>
          )}
        </Passo>

        {/* walletId (opcional) */}
        <Passo n={3} feito={st.temWallet} titulo="Seu Asaas (opcional agora)">
          {st.temWallet ? (
            <p className="text-sm text-emerald-400">walletId cadastrado ✅</p>
          ) : (
            <form onSubmit={e => { e.preventDefault(); post('/api/parceira/wallet', { walletId: wallet.trim() }, 'wallet') }} className="space-y-2">
              <p className="text-xs text-gray-500">É por onde sua comissão cai automática. Não tem conta? <a href={ASAAS_REF} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">abra grátis pela nossa parceria</a> → Integrações → Carteira/Wallet → copie o Wallet ID.</p>
              <input className={inputCls} value={wallet} onChange={e => setWallet(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
              {erros.wallet && <p className="text-xs text-red-400">{erros.wallet}</p>}
              <button disabled={busy === 'wallet' || !wallet.trim()} className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg py-2 text-sm font-semibold">{busy === 'wallet' ? 'Salvando…' : 'Salvar walletId'}</button>
              <p className="text-[11px] text-gray-600">Pode deixar pra depois — sem ele, sua comissão fica registrada e a gente repassa.</p>
            </form>
          )}
        </Passo>

        {/* Estado geral */}
        <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-900 p-4 text-center">
          {st.status === 'recusada' ? (
            <p className="text-sm text-gray-400">Sua candidatura não foi aprovada desta vez. Dúvidas? Fale com a Equipe SOA.</p>
          ) : pronta ? (
            <p className="text-sm text-emerald-300">🎉 Cadastro completo! Sua candidatura está em análise. Assim que aprovarmos, seu painel libera e você recebe um e-mail. 💛</p>
          ) : (
            <p className="text-sm text-gray-400">Conclua os passos acima para enviar sua candidatura para aprovação.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Passo({ n, feito, titulo, children }: { n: number; feito: boolean; titulo: string; children?: React.ReactNode }) {
  return (
    <div className="mt-5 rounded-2xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-sm font-bold ${feito ? 'bg-emerald-500' : 'bg-orange-500'}`}>{feito ? '✓' : n}</span>
        <h2 className="font-semibold">{titulo}</h2>
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────── PAINEL (completo)
function fraseEvento(nome: string, status: string): string {
  if (status === 'ATIVA') return `🎉 ${nome} assinou`
  if (status === 'TRIAL') return `✨ ${nome} começou o teste`
  if (status === 'AGUARDANDO_PAGAMENTO') return `👀 ${nome} está decidindo`
  if (status === 'CANCELADA' || status === 'CORTADA') return `💛 ${nome} pausou por enquanto`
  return `${nome} — ${status}`
}

function Painel() {
  const [d, setD] = useState<any>(null)
  const [erro, setErro] = useState(false)
  const [copiado, setCopiado] = useState('')
  const [wallet, setWallet] = useState('')
  const [salvandoW, setSalvandoW] = useState(false)
  const [wErro, setWErro] = useState('')

  const carregar = () => fetch('/api/parceira/dashboard').then(r => r.ok ? r.json() : Promise.reject()).then(setD).catch(() => setErro(true))
  useEffect(() => { carregar() }, [])

  async function salvarWallet(e: React.FormEvent) {
    e.preventDefault(); setWErro(''); setSalvandoW(true)
    try {
      const r = await fetch('/api/parceira/wallet', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ walletId: wallet.trim() }) })
      const b = await r.json().catch(() => ({}))
      if (!r.ok) { setWErro(b.error || 'Não consegui salvar. Confira o walletId.'); setSalvandoW(false); return }
      setWallet(''); await carregar()
    } catch { setWErro('Erro de conexão. Tente de novo.') }
    setSalvandoW(false)
  }

  const copiar = (txt: string, tag: string) => { navigator.clipboard?.writeText(txt); setCopiado(tag); setTimeout(() => setCopiado(''), 1500) }

  if (erro) return <Centro>Não consegui carregar seu painel.</Centro>
  if (!d) return <Centro>Carregando…</Centro>

  const link = `usesoa.com.br/r/${d.material.linkSlug}`
  const textos = [
    `Uso o SOA pra organizar toda a produção do meu ateliê 💛 Se você é artesã e vive perdida com encomendas, testa grátis por 30 dias pelo meu link: ${link}`,
    `Gente, parei de anotar encomenda em caderno! O SOA organiza pedidos, prazos e produção num lugar só. Quem entra pelo meu link ganha 30 dias grátis 👉 ${link}`,
    `Cansada da bagunça no ateliê? Testa o SOA de graça por 30 dias: ${link} 💛`,
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold">Oi, {d.parceira.nome}! 💛</h1>
        <p className="text-gray-400 text-sm">Seu painel de parceria</p>

        {!d.parceira.temWallet && (
          <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-300">⚠️ Adicione seu walletId do Asaas para receber suas comissões.</p>
            <p className="mt-1 text-xs text-amber-200/80">Ainda não tem conta? <a href={ASAAS_REF} target="_blank" rel="noopener noreferrer" className="underline">Abra a sua aqui</a> → Integrações → Carteira/Wallet → copie o Wallet ID.</p>
            <form onSubmit={salvarWallet} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" required />
              <button type="submit" disabled={salvandoW} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold">{salvandoW ? 'Salvando…' : 'Salvar'}</button>
            </form>
            {wErro && <p className="mt-2 text-xs text-red-400">{wErro}</p>}
          </div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Tile label="Recebido" valor={brl(d.ganhos.recebido)} cor="text-emerald-400" />
          <Tile label="A receber" valor={brl(d.ganhos.pendente)} cor="text-amber-400" />
          <Tile label="Ativas" valor={String(d.ganhos.ativas)} cor="text-white" />
        </div>

        <h2 className="text-sm font-semibold text-gray-300 mt-7 mb-2">Suas indicações</h2>
        <div className="grid grid-cols-5 gap-2 text-center">
          {[['🔗', d.funil.cliques, 'cliques'], ['✍️', d.funil.cadastros, 'cadastros'], ['✨', d.funil.emTrial, 'testando'], ['🎉', d.funil.assinaram, 'assinaram'], ['💤', d.funil.cancelaram, 'pausaram']].map(([e, n, l]) => (
            <div key={l as string} className="bg-gray-900 border border-gray-800 rounded-xl py-3">
              <div className="text-lg">{e as string}</div>
              <div className="text-lg font-bold">{n as number}</div>
              <div className="text-[10px] text-gray-500">{l as string}</div>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-gray-300 mt-7 mb-2">Novidades</h2>
        <div className="space-y-2">
          {d.timeline.length === 0 && <p className="text-gray-500 text-sm">Assim que alguém usar seu link, aparece aqui. 💛</p>}
          {d.timeline.map((ev: any, i: number) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex items-center justify-between text-sm">
              <span>{fraseEvento(ev.nome, ev.status)}</span>
              <span className="text-gray-500 text-xs">{dataBR(ev.quando)}</span>
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold text-gray-300 mt-7 mb-2">Seu material</h2>
        <div className="space-y-3">
          <Copiavel titulo="Seu link" valor={link} onCopy={() => copiar(`https://${link}`, 'link')} copiado={copiado === 'link'} />
          <Copiavel titulo="Seu cupom" valor={d.material.cupom} onCopy={() => copiar(d.material.cupom, 'cupom')} copiado={copiado === 'cupom'} />
          <p className="text-xs text-gray-500 pt-1">Textos prontos pra postar — é só copiar e compartilhar:</p>
          {textos.map((t, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1"><span className="text-xs text-gray-400">Texto {i + 1}</span>
                <button onClick={() => copiar(t, `txt${i}`)} className="text-xs text-orange-400 font-medium">{copiado === `txt${i}` ? '✅ copiado' : 'copiar'}</button></div>
              <p className="text-sm text-gray-300">{t}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-600 mt-8">Dúvidas? Fale com a Equipe SOA. 💛</p>
      </div>
    </div>
  )
}

function Centro({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center p-6">{children}</div>
}
function Tile({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
    <div className={`text-lg font-bold ${cor}`}>{valor}</div>
    <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
  </div>
}
function Copiavel({ titulo, valor, onCopy, copiado }: { titulo: string; valor: string; onCopy: () => void; copiado: boolean }) {
  return <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between">
    <div><div className="text-xs text-gray-400">{titulo}</div><div className="text-sm font-medium">{valor}</div></div>
    <button onClick={onCopy} className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold">{copiado ? '✅' : 'Copiar'}</button>
  </div>
}
