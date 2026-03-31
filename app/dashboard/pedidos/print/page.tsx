'use client'
// ══════════════════════════════════════════════════════════════
// Destino: app/dashboard/pedidos/print/page.tsx
// Função : Impressão em lote — renderiza N pedidos numa só página
//          URL: /dashboard/pedidos/print?ids=id1,id2,id3
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Pedido {
  id: string
  numero: string
  destinatario: string
  idCliente: string | null
  canal: string | null
  produto: string
  quantidade: number
  valor: number | null
  dataEntrada: string | null
  dataEnvio: string | null
  observacoes: string | null
  prioridade: string
  status: string
  endereco: string | null
  camposExtras: string | null
  setor_atual_nome: string | null
  setor_atual_id: string | null
}

interface Setor   { id: string; nome: string; icone: string; ordem: number }
interface Demanda { id: string; nomeProduto: string; freelancerNome?: string; freelancer?: string; qtdSolicitada: number; qtdProduzida: number; valorPorItem?: number; valorTotal: number; status: string }

function R(n: any) {
  const num = parseFloat(String(n ?? ''))
  if (isNaN(num)) return '—'
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function dt(s: string | null | undefined) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('pt-BR') } catch { return '—' }
}
async function safe(url: string, fb: any) {
  try { const r = await fetch(url); return r.ok ? r.json() : fb } catch { return fb }
}

const STATUS_PT: Record<string,string> = { ABERTO:'Aberto', EM_PRODUCAO:'Em produção', CONCLUIDO:'Concluído', CANCELADO:'Cancelado' }
const PRIO_PT:   Record<string,string> = { URGENTE:'🔴 Urgente', ALTA:'🟠 Alta', NORMAL:'🟢 Normal', BAIXA:'⚪ Baixa' }

interface FichaData { pedido: Pedido; demandas: Demanda[] }

export default function BulkPrintPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <p style={{ color:'#6b7280' }}>Carregando fichas...</p>
      </div>
    }>
      <BulkPrintContent />
    </Suspense>
  )
}

function BulkPrintContent() {
  const searchParams = useSearchParams()
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean)

  const [fichas,    setFichas]    = useState<FichaData[]>([])
  const [setores,   setSetores]   = useState<Setor[]>([])
  const [workspace, setWorkspace] = useState({ nome: 'Meu Ateliê' })
  const [loading,   setLoading]   = useState(true)
  const [erro,      setErro]      = useState('')

  useEffect(() => {
    if (!ids.length) { setErro('Nenhum pedido selecionado'); setLoading(false); return }

    // Timeout de segurança — garante que loading sempre some
    const timeout = setTimeout(() => {
      setErro('Tempo esgotado ao carregar pedidos')
      setLoading(false)
    }, 10000)

    async function carregar() {
      try {
        // Workspace e setores
        const wsRes = await fetch('/api/config/geral').catch(() => null)
        const ws = wsRes?.ok ? await wsRes.json().catch(() => ({})) : {}
        setWorkspace({ nome: ws.nomeProprietaria || ws.nome || 'Meu Ateliê' })

        const sRes = await fetch('/api/producao/setores').catch(() => null)
        const sData = sRes?.ok ? await sRes.json().catch(() => ({})) : {}
        setSetores(Array.isArray(sData) ? sData : (sData.setores || []))

        // Pedidos em paralelo
        const resultados = await Promise.all(
          ids.map(async id => {
            try {
              const pRes = await fetch(`/api/producao/pedidos/${id}`)
              if (!pRes.ok) return null
              const pData = await pRes.json().catch(() => null)
              const pedido = pData?.pedido || pData
              if (!pedido?.id) return null

              const dRes = await fetch(`/api/demandas?pedidoId=${id}`).catch(() => null)
              const dData = dRes?.ok ? await dRes.json().catch(() => []) : []
              const demandas = Array.isArray(dData) ? dData : (dData.demandas || [])

              return { pedido, demandas } as FichaData
            } catch { return null }
          })
        )

        const validos = resultados.filter(Boolean) as FichaData[]
        if (!validos.length) setErro('Nenhum pedido encontrado')
        setFichas(validos)
      } catch (e) {
        setErro('Erro ao carregar pedidos')
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    }

    carregar()
    return () => clearTimeout(timeout)
  }, []) // roda só uma vez ao montar

  // Remove dark mode ao montar (garante preview e impressão em modo claro)
  useEffect(() => {
    const html = document.documentElement
    const wasDark = html.classList.contains('dark')
    html.classList.remove('dark')

    // Esconde sidebar via JS direto (mais confiável que CSS)
    const main = document.querySelector('main')
    const sidebar = main?.previousElementSibling as HTMLElement | null
    if (sidebar) sidebar.style.display = 'none'

    const style = document.createElement('style')
    style.id = 'print-override'
    style.innerHTML = `
      @media print {
        .no-print { display: none !important; }
        .page-break { page-break-after: always !important; break-after: page !important; }
        @page { margin: 12mm 10mm; size: A4; }
        main { overflow: visible !important; max-height: none !important; }
      }
    `
    document.head.appendChild(style)

    return () => {
      if (wasDark) html.classList.add('dark')
      if (sidebar) sidebar.style.display = ''
      document.getElementById('print-override')?.remove()
    }
  }, [])

  // Dispara impressão após carregar tudo
  useEffect(() => {
    if (!loading && fichas.length > 0) {
      const t = setTimeout(() => window.print(), 800)
      return () => clearTimeout(t)
    }
  }, [loading, fichas.length])

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🖨️</div>
        <p style={{ color:'#6b7280' }}>Carregando {ids.length} pedido{ids.length !== 1 ? 's' : ''}...</p>
      </div>
    </div>
  )

  if (erro || !fichas.length) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
      <p style={{ color:'#ef4444' }}>{erro || 'Nenhum pedido encontrado'}</p>
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-after: always; break-after: page; }
          @page { margin: 12mm 10mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Botões */}
      <div className="no-print" style={{
        position:'sticky', top:0, zIndex:50, background:'white',
        borderBottom:'1px solid #e5e7eb', padding:'10px 24px',
        display:'flex', alignItems:'center', gap:12,
      }}>
        <button onClick={() => window.print()} style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'8px 18px', background:'#f97316', color:'white',
          border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
        }}>
          🖨️ Imprimir {fichas.length} pedido{fichas.length !== 1 ? 's' : ''}
        </button>
        <button onClick={() => window.close()} style={{
          padding:'8px 14px', background:'#f3f4f6', color:'#374151',
          border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, cursor:'pointer',
        }}>
          Fechar
        </button>
        <span style={{ fontSize:12, color:'#9ca3af', marginLeft:8 }}>
          {fichas.length} ficha{fichas.length !== 1 ? 's' : ''} — cada uma em uma página separada
        </span>
      </div>

      {/* Fichas */}
      {fichas.map(({ pedido, demandas }, idx) => {
        const camposExtras = (() => {
          if (!pedido.camposExtras) return {}
          try {
            const p = typeof pedido.camposExtras === 'string' ? JSON.parse(pedido.camposExtras) : pedido.camposExtras
            return Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith('_')))
          } catch { return {} }
        })()
        const setorAtualIdx  = setores.findIndex(s => s.id === pedido.setor_atual_id)
        const totalDemandas  = demandas.reduce((s, d) => s + Number(d.valorTotal || 0), 0)

        return (
          <div
            key={pedido.id}
            style={{
              maxWidth:800, margin:'0 auto', padding:'28px 40px',
              fontFamily:"'Segoe UI',system-ui,sans-serif", color:'#111827',
              // Quebra de página após cada ficha (exceto a última)
              ...(idx < fichas.length - 1 ? {
                pageBreakAfter: 'always' as const,
                breakAfter: 'page' as const,
              } : {})
            }}
          >
            {/* Cabeçalho */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:14, marginBottom:20, borderBottom:'3px solid #f97316' }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700 }}>{workspace.nome}</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Ficha de Produção · {idx + 1}/{fichas.length}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:26, fontWeight:800, color:'#f97316', fontFamily:'monospace' }}>
                  {pedido.numero ? `#${pedido.numero}` : '—'}
                </div>
                <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Emitido em {dt(new Date().toISOString())}</div>
              </div>
            </div>

            {/* Dados */}
            <Sec title="Dados do Pedido">
              <G3><F label="Destinatário" value={pedido.destinatario} large /><F label="Canal" value={pedido.canal} /><F label="Prioridade" value={PRIO_PT[pedido.prioridade] || pedido.prioridade} /></G3>
              <G1 mt><F label="Produto(s)" value={pedido.produto} /></G1>
              <G3 mt><F label="Quantidade" value={`${pedido.quantidade} peça${pedido.quantidade !== 1 ? 's' : ''}`} /><F label="Valor total" value={R(pedido.valor)} highlight /><F label="Status" value={STATUS_PT[pedido.status] || pedido.status} /></G3>
              <G3 mt><F label="Data entrada" value={dt(pedido.dataEntrada)} /><F label="Data envio" value={dt(pedido.dataEnvio)} /><F label="ID cliente" value={pedido.idCliente} /></G3>
              {pedido.observacoes && <div style={{ marginTop:10, padding:'8px 12px', background:'#fefce8', border:'1px solid #fde68a', borderRadius:8, borderLeft:'4px solid #f59e0b' }}><div style={{ fontSize:11, color:'#92400e', fontWeight:600, marginBottom:3 }}>OBSERVAÇÕES</div><div style={{ fontSize:13, color:'#78350f' }}>{pedido.observacoes}</div></div>}
            </Sec>

            {/* Campos extras */}
            {Object.keys(camposExtras).length > 0 && (
              <Sec title="Informações Adicionais">
                <G3>{Object.entries(camposExtras).map(([k,v]) => <F key={k} label={k} value={String(v)} />)}</G3>
              </Sec>
            )}

            {/* Fluxo */}
            {setores.length > 0 && (
              <Sec title="Fluxo de Produção">
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
                  {setores.map((setor, si) => {
                    const concluido = pedido.status === 'CONCLUIDO' || setorAtualIdx > si
                    const atual     = setor.id === pedido.setor_atual_id
                    return (
                      <div key={setor.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 12px', borderRadius:8, border:`2px solid ${atual ? '#f97316' : concluido ? '#86efac' : '#e5e7eb'}`, background: atual ? '#fff7ed' : concluido ? '#f0fdf4' : '#f9fafb', minWidth:110 }}>
                        <div style={{ width:16, height:16, borderRadius:3, flexShrink:0, border:`2px solid ${concluido ? '#22c55e' : atual ? '#f97316' : '#d1d5db'}`, background: concluido ? '#22c55e' : 'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {concluido && <span style={{ color:'white', fontSize:10, fontWeight:700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize:12, fontWeight:600, color: atual ? '#c2410c' : concluido ? '#15803d' : '#374151' }}>{setor.icone} {setor.nome}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:`repeat(${Math.min(setores.length,4)},1fr)`, gap:8 }}>
                  {setores.map(s => (
                    <div key={s.id} style={{ border:'1px dashed #d1d5db', borderRadius:8, padding:8 }}>
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:22 }}>{s.icone} {s.nome}</div>
                      <div style={{ borderBottom:'1px solid #d1d5db', marginBottom:3 }} />
                      <div style={{ fontSize:10, color:'#d1d5db' }}>assinatura / data</div>
                    </div>
                  ))}
                </div>
              </Sec>
            )}

            {/* Demandas */}
            {demandas.length > 0 && (
              <Sec title="Demandas de Freelancer">
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                    {['Produto','Freelancer','Qtd Solicitada','Qtd Produzida','Valor/Item','Total','Status'].map(h => (
                      <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {demandas.map((d,di) => {
                      const nomeFreelancer = d.freelancerNome || d.freelancer || '—'
                      const valorItem = d.valorPorItem ?? null
                      const valorTot  = d.valorTotal ?? null
                      return (
                        <tr key={d.id} style={{ borderBottom:'1px solid #f3f4f6', background: di%2===0?'white':'#fafafa' }}>
                          <td style={{ padding:'6px 8px', fontWeight:500 }}>{d.nomeProduto}</td>
                          <td style={{ padding:'6px 8px', color:'#374151', fontWeight:600 }}>{nomeFreelancer}</td>
                          <td style={{ padding:'6px 8px', textAlign:'center' }}>{d.qtdSolicitada}</td>
                          <td style={{ padding:'6px 8px', textAlign:'center' }}>{d.qtdProduzida}</td>
                          <td style={{ padding:'6px 8px', color:'#6b7280' }}>{valorItem !== null ? R(valorItem) : '—'}</td>
                          <td style={{ padding:'6px 8px', color:'#f97316', fontWeight:600 }}>{R(valorTot)}</td>
                          <td style={{ padding:'6px 8px' }}><span style={{ padding:'2px 7px', borderRadius:20, fontSize:11, fontWeight:600, background:d.status==='PAGO'?'#dcfce7':'#fef9c3', color:d.status==='PAGO'?'#15803d':'#854d0e' }}>{d.status}</span></td>
                        </tr>
                      )
                    })}
                    <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                      <td colSpan={5} style={{ padding:'6px 8px', textAlign:'right', fontSize:12, color:'#6b7280' }}>Total freelancers:</td>
                      <td style={{ padding:'6px 8px', color:'#f97316', fontWeight:700 }}>{R(totalDemandas)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </Sec>
            )}

            {/* Rodapé */}
            <div style={{ marginTop:24, paddingTop:10, borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', fontSize:11, color:'#9ca3af' }}>
              <span>{workspace.nome} — Sistema VPS Gestão</span>
              <span>#{pedido.numero||'------'} · Impresso em {new Date().toLocaleString('pt-BR')}</span>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Helpers de layout ─────────────────────────────────────────
function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
        <span style={{ flex:1, height:1, background:'#fed7aa' }} />
        <span style={{ fontSize:11, fontWeight:700, color:'#f97316', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{title}</span>
        <span style={{ flex:1, height:1, background:'#fed7aa' }} />
      </div>
      {children}
    </div>
  )
}
function G3({ children, mt }: { children: React.ReactNode; mt?: boolean }) {
  return <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, ...(mt?{marginTop:10}:{}) }}>{children}</div>
}
function G1({ children, mt }: { children: React.ReactNode; mt?: boolean }) {
  return <div style={{ marginTop: mt?10:0 }}>{children}</div>
}
function F({ label, value, large, highlight }: { label: string; value?: string|number|null; large?: boolean; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize:11, color:'#9ca3af', fontWeight:500, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:large?15:13, fontWeight:large||highlight?700:500, color:highlight?'#f97316':'#111827' }}>{value||'—'}</div>
    </div>
  )
}
