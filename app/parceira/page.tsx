'use client'
// Painel da parceira (a joia) — mobile-first, tom SOA. Só 1º nome + agregados
// (a trava LGPD vive no endpoint). Escopo por parceiroId da sessão.
import { useEffect, useState } from 'react'

const brl = (n: number) => (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = (d: string) => new Date(d).toLocaleDateString('pt-BR')

function fraseEvento(nome: string, status: string): string {
  if (status === 'ATIVA') return `🎉 ${nome} assinou`
  if (status === 'TRIAL') return `✨ ${nome} começou o teste`
  if (status === 'AGUARDANDO_PAGAMENTO') return `👀 ${nome} está decidindo`
  if (status === 'CANCELADA' || status === 'CORTADA') return `💛 ${nome} pausou por enquanto`
  return `${nome} — ${status}`
}

export default function PainelParceira() {
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

  if (erro) return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center p-6">Não consegui carregar seu painel.</div>
  if (!d) return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center p-6">Carregando…</div>

  const link = `usesoa.com.br/r/${d.material.linkSlug}`
  // Textos VERBATIM do Diretor (tom SOA) — só {cupom}/link preenchidos.
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

        {/* Banner walletId — some quando a parceira já tem carteira cadastrada */}
        {!d.parceira.temWallet && (
          <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-semibold text-amber-300">⚠️ Adicione seu walletId do Asaas para receber suas comissões.</p>
            <p className="mt-1 text-xs text-amber-200/80">Ainda não tem conta? <a href="https://www.asaas.com/r/7606c57d-94eb-4b39-a708-e2b5f0c8d179" target="_blank" rel="noopener noreferrer" className="underline">Abra a sua aqui</a> → Integrações → Carteira/Wallet → copie o Wallet ID.</p>
            <form onSubmit={salvarWallet} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500" required />
              <button type="submit" disabled={salvandoW} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold">{salvandoW ? 'Salvando…' : 'Salvar'}</button>
            </form>
            {wErro && <p className="mt-2 text-xs text-red-400">{wErro}</p>}
          </div>
        )}

        {/* Ganhos */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Tile label="Recebido" valor={brl(d.ganhos.recebido)} cor="text-emerald-400" />
          <Tile label="A receber" valor={brl(d.ganhos.pendente)} cor="text-amber-400" />
          <Tile label="Ativas" valor={String(d.ganhos.ativas)} cor="text-white" />
        </div>

        {/* Funil */}
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

        {/* Timeline */}
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

        {/* Material de divulgação */}
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
