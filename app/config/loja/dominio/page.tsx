'use client'

// Tela guiada "Configure seu domínio próprio" (self-service). Passo a passo dentro do SOA:
// cadastrar subdomínio → copiar 1 CNAME → colar no provedor → ativa sozinho (polling + cron) → no ar.
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Globe, ArrowLeft, Copy, Check, Trash2, RefreshCw, Loader2, Lock, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react'

type DnsRec = { tipo: string; nome: string; valor: string; descricao: string }
type DomRow = { dominio: string; status: 'PENDENTE' | 'VERIFICANDO' | 'ATIVO' | 'ERRO'; instrucoesDns: DnsRec[] | null; verificadoEm: string | null }

const BADGE: Record<string, { txt: string; cls: string }> = {
  PENDENTE:    { txt: 'Aguardando você criar o registro', cls: 'bg-amber-500/15 text-amber-600' },
  VERIFICANDO: { txt: 'Verificando…',                     cls: 'bg-blue-500/15 text-blue-600' },
  ATIVO:       { txt: 'No ar',                             cls: 'bg-emerald-500/15 text-emerald-600' },
  ERRO:        { txt: 'Precisa de atenção',                cls: 'bg-red-500/15 text-red-600' },
}

const GUIAS: { nome: string; passos: string[] }[] = [
  { nome: 'Registro.br', passos: ['Entre em painel.registro.br e clique no seu domínio', 'Abra "Editar Zona DNS" (ou só "DNS")', 'Adicione um registro do tipo CNAME', 'Cole o Nome e o Valor copiados acima e salve'] },
  { nome: 'Hostinger', passos: ['No hPanel, abra "Domínios" → seu domínio', 'Vá em "DNS / Nameservers" → gerenciar registros', 'Adicione um registro CNAME', 'Cole o Nome e o Valor e salve'] },
  { nome: 'GoDaddy', passos: ['Em "Meus produtos", ache o domínio e clique em "DNS"', 'Na parte de Registros, clique em "Adicionar"', 'Escolha o tipo CNAME', 'Cole o Nome (Host) e o Valor (Aponta para) e salve'] },
  { nome: 'Cloudflare', passos: ['Escolha o domínio → aba "DNS" → "Add record"', 'Tipo CNAME; cole o Nome e o Valor', 'IMPORTANTE: deixe o Proxy DESLIGADO (nuvem cinza, "DNS only")', 'Salve'] },
  { nome: 'HostGator', passos: ['No painel/cPanel, abra "Zona de DNS" (Editor de Zona)', 'Clique em adicionar registro e escolha CNAME', 'Cole o Nome e o Valor copiados acima', 'Salve'] },
]

const SUF2 = new Set(['com.br', 'net.br', 'org.br', 'art.br', 'blog.br', 'eco.br', 'app.br', 'co.uk', 'com.pt'])
function ehApexCli(d: string): boolean {
  const p = d.toLowerCase().split('.').filter(Boolean)
  if (p.length < 2) return false
  if (SUF2.has(p.slice(-2).join('.'))) return p.length === 3
  return p.length === 2
}
const pareceCompleto = (d: string) => /\.[a-z]{2,}$/.test(d) && d.includes('.')

function CopyBtn({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(texto).then(() => { setOk(true); setTimeout(() => setOk(false), 1500) })}
      className={`text-xs font-medium flex items-center gap-1 flex-shrink-0 rounded-lg border px-2.5 py-1.5 transition ${ok ? 'text-emerald-600 border-emerald-300' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-orange-400 hover:text-orange-600'}`}>
      {ok ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
    </button>
  )
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-14 pb-6 last:pb-0">
      <div className="absolute left-0 top-0 w-9 h-9 rounded-full grid place-items-center bg-white dark:bg-gray-800 border-2 border-orange-500 text-orange-500 font-bold text-sm">{n}</div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1.5">{titulo}</h2>
      <div className="text-sm text-gray-600 dark:text-gray-300 space-y-3">{children}</div>
    </div>
  )
}

export default function ConfigDominioPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [row, setRow] = useState<DomRow | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [input, setInput] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [guia, setGuia] = useState<string>('Registro.br')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/modulos')
  }, [status])

  async function carregar() {
    try {
      const d = await fetch('/api/config/loja/dominio').then(x => x.json())
      setRow(d?.dominio || null)
    } catch { /* ignora */ } finally { setCarregando(false) }
  }
  useEffect(() => { if (status === 'authenticated') carregar() }, [status])

  // Auto-verificação enquanto pendente/verificando (ativa sozinho; o cron cobre a aba fechada + aviso).
  useEffect(() => {
    if (!row || (row.status !== 'PENDENTE' && row.status !== 'VERIFICANDO')) return
    let vivo = true
    const checar = async () => {
      try {
        const d = await fetch('/api/config/loja/dominio/verificar', { method: 'POST' }).then(x => x.ok ? x.json() : null)
        if (!vivo || !d) return
        if (d.dominio) setRow(d.dominio)
        if (!d.ativo && d.aviso) setAviso(d.aviso)
      } catch { /* silencioso */ }
    }
    checar()
    const t = setInterval(checar, 20000)
    return () => { vivo = false; clearInterval(t) }
  }, [row?.status])

  async function adicionar() {
    setErro(''); setAviso(''); setSalvando(true)
    try {
      const r = await fetch('/api/config/loja/dominio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dominio: input }) })
      const d = await r.json()
      if (!r.ok) { setErro(d?.error || 'Não foi possível adicionar.'); return }
      setRow(d.dominio); setInput('')
    } catch { setErro('Falha de conexão. Tente de novo.') } finally { setSalvando(false) }
  }

  async function verificar() {
    setErro(''); setAviso(''); setVerificando(true)
    try {
      const r = await fetch('/api/config/loja/dominio/verificar', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) { setErro(d?.error || 'Não foi possível verificar.'); return }
      if (d.dominio) setRow(d.dominio)
      if (!d.ativo && d.aviso) setAviso(d.aviso)
    } catch { setErro('Falha de conexão. Tente de novo.') } finally { setVerificando(false) }
  }

  async function remover() {
    if (!confirm('Remover o domínio próprio? A loja volta a responder só pelo link da plataforma.')) return
    setErro(''); setAviso('')
    try {
      await fetch('/api/config/loja/dominio', { method: 'DELETE' })
      setRow(null); setInput('')
    } catch { setErro('Falha ao remover. Tente de novo.') }
  }

  const apexAviso = !row && pareceCompleto(input) && ehApexCli(input)
  const registros = row?.instrucoesDns || []
  const principal = registros.find(r => r.tipo === 'CNAME') || registros[0]
  const extras = registros.filter(r => r !== principal)
  const passosGuia = GUIAS.find(g => g.nome === guia)?.passos || []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-6">
        <a href="/config/loja" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mb-3"><ArrowLeft size={12} /> Loja Virtual</a>

        <div className="flex items-center gap-2 mb-1">
          <Globe className="w-5 h-5 text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Domínio próprio</h1>
          {row && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${BADGE[row.status]?.cls || ''}`}>{BADGE[row.status]?.txt || row.status}</span>}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Coloque o endereço da sua marca (ex.: <span className="font-medium">loja.suamarca.com.br</span>) no lugar do link da plataforma. Você faz só o mínimo — copia um valor e cola no seu provedor; o resto o sistema resolve sozinho.</p>

        {erro && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2 mb-4 text-xs text-red-700 dark:text-red-400 flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />{erro}</div>}
        {aviso && <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg px-3 py-2 mb-4 text-xs text-blue-700 dark:text-blue-400">{aviso}</div>}

        {carregando ? <p className="text-gray-400 text-sm py-12 text-center">Carregando…</p> : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">

            {/* ───────── SEM DOMÍNIO — cadastrar ───────── */}
            {!row && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600 rounded-lg px-3 py-2.5 text-xs text-gray-600 dark:text-gray-300 flex items-start gap-2">
                  <span>🔑</span><span><b className="text-gray-800 dark:text-white">Antes de começar:</b> você precisa já ter um domínio comprado (Registro.br, Hostinger, GoDaddy…) e acesso ao painel dele. A gente conecta o domínio que é seu — não vende domínio.</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                  <span>✨</span><span><b>Recomendado — só 1 passo:</b> use um subdomínio no formato <b>loja.suamarca.com.br</b>. É um único registro pra criar. O domínio raiz (só suamarca.com.br) é o modo avançado — pede mais registros.</span>
                </div>

                <Passo n={1} titulo="Digite o endereço que você quer usar">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" value={input} onChange={e => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                      placeholder="loja.suamarca.com.br"
                      className="flex-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-800 dark:text-white" />
                    <button type="button" onClick={adicionar} disabled={salvando || input.length < 4}
                      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 whitespace-nowrap">
                      {salvando ? 'Adicionando…' : 'Adicionar domínio'}
                    </button>
                  </div>
                  {apexAviso && (
                    <p className="text-xs text-amber-600 flex items-start gap-1">
                      <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                      Isso é um domínio <b>raiz</b> (avançado) — exige mais de um registro e dá mais trabalho. Se puder, use <b>loja.{input}</b> (só 1 passo).
                    </p>
                  )}
                </Passo>
              </div>
            )}

            {/* ───────── ATIVO ───────── */}
            {row?.status === 'ATIVO' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 size={18} />
                  <a href={`https://${row.dominio}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{row.dominio}</a>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Lock size={12} className="text-emerald-500" /> Certificado de segurança (HTTPS) ativo. Sua loja já abre por este endereço; o link antigo da plataforma continua funcionando também.</p>
                <button type="button" onClick={remover} className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> Remover domínio</button>
              </div>
            )}

            {/* ───────── PENDENTE/VERIFICANDO — passo a passo ───────── */}
            {row && row.status !== 'ATIVO' && (
              <div>
                <Passo n={1} titulo="Copie o registro abaixo">
                  <p>No seu provedor de domínio, você vai criar <b>um registro CNAME</b> com estes dois valores:</p>
                  {principal && (
                    <div className="border border-orange-200 dark:border-orange-500/30 rounded-lg p-3 bg-orange-50/50 dark:bg-orange-500/5">
                      <div className="grid grid-cols-[92px_1fr_auto] gap-x-3 gap-y-2 items-center text-sm">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Tipo</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-white">{principal.tipo}</span>
                        <span></span>
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Nome</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-white break-all">{principal.nome}</span>
                        <CopyBtn texto={principal.nome} />
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Valor</span>
                        <span className="font-mono font-semibold text-gray-800 dark:text-white break-all">{principal.valor}</span>
                        <CopyBtn texto={principal.valor} />
                      </div>
                    </div>
                  )}
                  {extras.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Seu provedor também pediu este registro de confirmação — crie do mesmo jeito:</p>
                      {extras.map((rec, i) => (
                        <div key={i} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/40">
                          <div className="grid grid-cols-[92px_1fr_auto] gap-x-3 gap-y-1.5 items-center text-sm">
                            <span className="text-gray-400 text-xs uppercase">Tipo</span><span className="font-mono text-gray-800 dark:text-white">{rec.tipo}</span><span></span>
                            <span className="text-gray-400 text-xs uppercase">Nome</span><span className="font-mono text-gray-800 dark:text-white break-all">{rec.nome}</span><CopyBtn texto={rec.nome} />
                            <span className="text-gray-400 text-xs uppercase">Valor</span><span className="font-mono text-gray-800 dark:text-white break-all">{rec.valor}</span><CopyBtn texto={rec.valor} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Passo>

                <Passo n={2} titulo="Cole no painel do seu provedor">
                  <p>Abra o site onde você comprou o domínio, entre na parte de <b>DNS</b> e crie o registro. Escolha seu provedor:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {GUIAS.map(g => (
                      <button key={g.nome} type="button" onClick={() => setGuia(g.nome)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${guia === g.nome ? 'bg-orange-500 text-white border-orange-500' : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-orange-300'}`}>
                        {g.nome}
                      </button>
                    ))}
                  </div>
                  <ol className="bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-600 rounded-lg p-3 pl-6 space-y-1 list-decimal list-inside text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {passosGuia.map((p, i) => <li key={i}>{p}</li>)}
                  </ol>
                </Passo>

                <Passo n={3} titulo="Pode fechar — a gente te avisa">
                  <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <Loader2 size={14} className="mt-0.5 flex-shrink-0 animate-spin" />
                    <span>Depois de salvar no provedor, <b>não precisa fazer mais nada</b>. O sistema detecta e ativa sozinho — pode fechar esta tela, você recebe um aviso no sininho quando estiver no ar. O DNS pode levar de alguns minutos até algumas horas pra propagar.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={verificar} disabled={verificando}
                      className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1 disabled:opacity-50">
                      {verificando ? <><Loader2 size={12} className="animate-spin" /> Verificando…</> : <><RefreshCw size={12} /> Verificar agora</>}
                    </button>
                    <button type="button" onClick={remover} className="text-xs text-gray-400 hover:text-red-600 flex items-center gap-1"><Trash2 size={12} /> Trocar / remover</button>
                  </div>
                </Passo>
              </div>
            )}
          </div>
        )}

        {/* Ajuda extra */}
        {row && row.status !== 'ATIVO' && (
          <p className="text-xs text-gray-400 mt-4 flex items-start gap-1">
            <HelpCircle size={13} className="mt-0.5 flex-shrink-0" />
            Travou em algum passo? Chame a Sofia no chat de suporte — ela te guia pelo caminho do seu provedor.
          </p>
        )}
      </div>
    </div>
  )
}
