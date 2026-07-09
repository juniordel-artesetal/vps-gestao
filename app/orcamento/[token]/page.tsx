'use client'
import { useState, useEffect } from 'react'
import { use } from 'react'
import { CheckCircle, Clock, XCircle, Download, Check, Phone, Mail, MapPin, Calendar, Package } from 'lucide-react'

interface OrcItem {
  id: string
  produto: string
  quantidade: number
  valorUnitario: number | null
  isKit: boolean
  qtdKitPecas: number
  ordem: number
  produtoImagem?: string | null
  produtoDescricao?: string | null
}

interface OrcDados {
  id: string; numero: string; status: string
  clienteNome: string; clienteEmail: string | null; clienteWhatsapp: string | null
  canal: string | null; produto: string; quantidade: number; valor: number | null
  observacoes: string | null; politicasEmpresa: string | null
  dataValidade: string | null; dataEnvioEstimada: string | null; createdAt: string
  aprovadoEm: string | null
  camposExtras: string | null
  workspaceNome: string; workspaceLogo: string | null; workspaceWhatsapp: string | null
  workspaceEmail: string | null; workspaceInstagram: string | null
  workspaceCidade: string | null; workspaceEstado: string | null
  workspaceCor: string | null
  itens: OrcItem[]
}

// Cor primária do ateliê (white-label). Valida hex de 6 dígitos; senão, laranja padrão.
function corValida(c: string | null | undefined): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#f97316'
}

function fmtR(n: number | null) {
  if (n === null || n === undefined) return '—'
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fmtData(s: string | null) {
  if (!s) return '—'
  const d = s.length === 10 ? s : s.slice(0, 10)
  return d.slice(8) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4)
}

export default function OrcamentoPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [orc, setOrc] = useState<OrcDados | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [aprovando, setAprovando] = useState(false)
  const [aprovado, setAprovado] = useState(false)
  const [pedidoEspecial, setPedidoEspecial] = useState('')

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
  }, [])

  useEffect(() => {
    fetch(`/api/orcamentos/aprovacao/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setErro(d.error)
        else { setOrc(d); if (d.status === 'APROVADO') setAprovado(true) }
      })
      .catch(() => setErro('Erro ao carregar orçamento'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAprovar() {
    if (!confirm('Confirmar aprovação deste orçamento?')) return
    setAprovando(true)
    try {
      const res = await fetch(`/api/orcamentos/aprovacao/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoEspecial: pedidoEspecial.trim() || null }),
      })
      const data = await res.json()
      if (data.ok) setAprovado(true)
      else if (data.jaAprovado) setAprovado(true)
      else alert(data.error || 'Erro ao aprovar')
    } finally { setAprovando(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center text-gray-400">
        <Clock className="w-10 h-10 mx-auto mb-3 animate-pulse" />
        <p>Carregando orçamento...</p>
      </div>
    </div>
  )

  if (erro || !orc) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Orçamento não encontrado</h2>
        <p className="text-gray-500 text-sm">{erro || 'Este link pode ter expirado ou ser inválido.'}</p>
      </div>
    </div>
  )

  // Determinar itens a renderizar:
  // - Se tiver itens na tabela OrcamentoItem → usar eles
  // - Senão (orçamento antigo) → fallback para linha única com produto/quantidade/valor
  const temItens = Array.isArray(orc.itens) && orc.itens.length > 0
  const linhasTabela = temItens
    ? orc.itens.map(it => ({
        produto: it.produto,
        quantidade: it.quantidade,
        valorUnitario: it.valorUnitario,
        subtotal: (it.valorUnitario || 0) * it.quantidade,
        imagem: it.produtoImagem || null,
        descricao: it.produtoDescricao || null,
      }))
    : [{
        produto: orc.produto,
        quantidade: orc.quantidade,
        valorUnitario: orc.valor,
        subtotal: (orc.valor || 0) * orc.quantidade,
        imagem: null as string | null,
        descricao: null as string | null,
      }]

  const totalGeral = linhasTabela.reduce((acc, l) => acc + l.subtotal, 0)

  // Branding do ateliê — cor via style inline / hex-alpha (nunca classe Tailwind dinâmica)
  const cor      = corValida(orc.workspaceCor)
  const corTint  = cor + '14'   // ~8% — fundos claros
  const corBorda = cor + '55'   // ~33% — bordas
  const corSombra = cor + '4d'  // ~30% — sombra do botão

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .print-page { box-shadow: none !important; border-radius: 0 !important; }
        }
        @page { margin: 1.5cm; size: A4; }
      `}</style>

      <div className="min-h-screen py-8 px-4" style={{ background: "#f3f4f6", colorScheme: "light" }}>
        <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between" style={{ colorScheme: "light" }}>
          <p className="text-sm text-gray-500">Orçamento {orc.numero}</p>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <Download size={15} />Salvar como PDF
          </button>
        </div>

        <div className="print-page max-w-3xl mx-auto rounded-2xl shadow-lg overflow-hidden" style={{ background: "white", color: "#111" }}>

          <div className="px-8 py-7 flex items-center justify-between" style={{ background: `linear-gradient(to right, ${cor}, ${cor}e6)` }}>
            <div className="flex items-center gap-4">
              {orc.workspaceLogo && !orc.workspaceLogo.startsWith('data:') ? (
                <img src={orc.workspaceLogo} alt="Logo"
                  className="h-14 w-auto max-w-[120px] object-contain rounded-xl bg-white/20 p-1"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : orc.workspaceLogo?.startsWith('data:') ? (
                <img src={orc.workspaceLogo} alt="Logo"
                  className="h-14 w-auto max-w-[120px] object-contain rounded-xl bg-white/20 p-1" />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-2xl">
                  {orc.workspaceNome.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-white font-bold text-xl leading-tight">{orc.workspaceNome}</h1>
                {(orc.workspaceCidade || orc.workspaceEstado) && (
                  <p className="text-white/80 text-sm mt-0.5">
                    {[orc.workspaceCidade, orc.workspaceEstado].filter(Boolean).join(' — ')}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/80 text-xs uppercase tracking-widest font-semibold mb-1">Orçamento</div>
              <div className="text-white font-bold text-lg">{orc.numero}</div>
              <div className="text-white/80 text-xs mt-1">Emitido em {fmtData(orc.createdAt)}</div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6" style={{ background: "white", color: "#111" }}>

            {aprovado && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-700">Orçamento aprovado!</p>
                  <p className="text-sm text-green-600">
                    {orc.aprovadoEm ? `Aprovado em ${fmtData(orc.aprovadoEm)}` : 'Aprovado com sucesso'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Emitido por</h3>
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-800 text-sm">{orc.workspaceNome}</p>
                  {orc.workspaceEmail && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail size={11} />{orc.workspaceEmail}
                    </div>
                  )}
                  {orc.workspaceWhatsapp && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone size={11} />{orc.workspaceWhatsapp}
                    </div>
                  )}
                  {orc.workspaceInstagram && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span className="text-[10px]">@</span>{orc.workspaceInstagram.replace('@','')}
                    </div>
                  )}
                  {(orc.workspaceCidade || orc.workspaceEstado) && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <MapPin size={11} />{[orc.workspaceCidade, orc.workspaceEstado].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Para</h3>
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-800 text-sm">{orc.clienteNome}</p>
                  {orc.clienteEmail && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail size={11} />{orc.clienteEmail}
                    </div>
                  )}
                  {orc.clienteWhatsapp && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone size={11} />{orc.clienteWhatsapp}
                    </div>
                  )}
                  {orc.canal && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Package size={11} />{orc.canal}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(orc.dataValidade || orc.dataEnvioEstimada) && (
              <div className="flex gap-6">
                {orc.dataValidade && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={12} />
                    <span>Válido até <strong className="text-gray-700">{fmtData(orc.dataValidade)}</strong></span>
                  </div>
                )}
                {orc.dataEnvioEstimada && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={12} />
                    <span>Previsão de envio <strong className="text-gray-700">{fmtData(orc.dataEnvioEstimada)}</strong></span>
                  </div>
                )}
              </div>
            )}

            <hr className="border-gray-100" />

            {/* Tabela de produtos — agora itera múltiplos itens */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Produtos / Serviços</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 rounded-l-lg">Descrição</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Qtd.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Valor unit.</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 rounded-r-lg">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasTabela.map((l, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="px-4 py-3">
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          {l.imagem && (
                            <img src={l.imagem} alt={l.produto}
                              style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #eee', flexShrink: 0 }} />
                          )}
                          <div>
                            <div className="text-gray-800 font-medium">{l.produto}</div>
                            {l.descricao && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{l.descricao}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{l.quantidade}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmtR(l.valorUnitario)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtR(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} />
                    <td className="px-4 pt-3 text-right text-xs text-gray-500 font-semibold">TOTAL</td>
                    <td className="px-4 pt-3 text-right text-lg font-bold" style={{ color: cor }}>{fmtR(totalGeral)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {orc.observacoes && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Observações</h3>
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {orc.observacoes}
                </div>
              </div>
            )}

            {orc.politicasEmpresa && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Políticas e Condições</h3>
                <div className="border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                  {orc.politicasEmpresa}
                </div>
              </div>
            )}

            {(() => {
              try {
                let raw: any = orc.camposExtras
                if (typeof raw === 'string') raw = JSON.parse(raw)
                if (typeof raw === 'string') raw = JSON.parse(raw)
                const campos: any[] = raw?.camposSelecionados || []
                const valores: Record<string,string> = raw?.camposValores || {}
                if (campos.length === 0) return null
                return (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:'#6b7280'}}>Detalhes do pedido</h3>
                    <div style={{borderRadius:'12px',border:`1px solid ${corBorda}`,background:corTint,padding:'16px'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                        {campos.map((campo: any) => (
                          <div key={campo.id}>
                            <p style={{fontSize:'10px',color:'#9ca3af',marginBottom:'2px',textTransform:'uppercase',letterSpacing:'0.05em'}}>{campo.nome}</p>
                            <p style={{fontSize:'14px',fontWeight:'600',color:'#111'}}>
                              {campo.tipo === 'checkbox'
                                ? (valores[campo.id] === 'true' ? '✓ Sim' : '✗ Não')
                                : (valores[campo.id] || <span style={{color:'#d1d5db'}}>—</span>)
                              }
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              } catch { return null }
            })()}

            {!aprovado && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{color:'#6b7280'}}>Pedido especial <span style={{fontWeight:'normal',textTransform:'none',letterSpacing:'normal'}}>(opcional)</span></h3>
                <textarea
                  rows={3}
                  placeholder="Gostaria de ter o laço na cor rosa, embalado em papel de presente, com dedicatória para Ana..."
                  value={pedidoEspecial}
                  onChange={e => setPedidoEspecial(e.target.value)}
                  style={{width:'100%',border:'1px solid #e5e7eb',borderRadius:'12px',padding:'12px',fontSize:'14px',background:'white',color:'#111',resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}
                  onFocus={e => e.target.style.borderColor=cor}
                  onBlur={e => e.target.style.borderColor='#e5e7eb'}
                />
                <p style={{fontSize:'11px',color:'#9ca3af',marginTop:'4px'}}>Sua mensagem será enviada junto com a aprovação para {orc.workspaceNome}.</p>
              </div>
            )}

            {aprovado && pedidoEspecial && (
              <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'12px',padding:'16px'}}>
                <p style={{fontSize:'11px',fontWeight:'600',color:'#16a34a',marginBottom:'6px'}}>✅ Pedido especial enviado:</p>
                <p style={{fontSize:'14px',color:'#374151'}}>{pedidoEspecial}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="text-center">
                <div className="border-t border-gray-300 pt-2 mt-8">
                  <p className="text-xs text-gray-400">{orc.workspaceNome}</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-300 pt-2 mt-8">
                  <p className="text-xs text-gray-400">{orc.clienteNome} — Cliente</p>
                </div>
              </div>
            </div>

            {!aprovado && orc.status !== 'RECUSADO' && (
              <div className="no-print">
                <hr className="border-gray-100 mb-6" />
                <div className="rounded-2xl px-6 py-5 text-center" style={{ background: corTint, border: `1px solid ${corBorda}` }}>
                  <p className="text-sm text-gray-600 mb-1">Você está de acordo com este orçamento?</p>
                  <p className="text-xs text-gray-400 mb-4">Ao aprovar, {orc.workspaceNome} será notificada e entrará em contato.</p>
                  <button
                    onClick={handleAprovar}
                    disabled={aprovando}
                    className="inline-flex items-center gap-2 px-8 py-3.5 text-white rounded-2xl text-base font-bold disabled:opacity-50 shadow-lg transition-all active:scale-95"
                    style={{ background: cor, boxShadow: `0 10px 15px -3px ${corSombra}` }}
                  >
                    <Check size={18} />
                    {aprovando ? 'Aprovando...' : 'Aprovar este orçamento'}
                  </button>
                </div>
              </div>
            )}

            {aprovado && (
              <div className="no-print text-center py-2">
                <p className="text-sm text-green-600 font-medium">
                  ✅ Orçamento aprovado! {orc.workspaceNome} foi notificada e entrará em contato em breve.
                </p>
              </div>
            )}

            <div className="text-center pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-300">
                Gerado via SOA · vps-gestao.com.br · {orc.numero}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
