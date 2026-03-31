'use client'
// ══════════════════════════════════════════════════════════════
// Destino: app/dashboard/pedidos/[id]/print/page.tsx
// Função : Ficha de impressão profissional do pedido
//          Campos corrigidos para bater com a API de produção
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

// ─── Types (espelho exato da API de produção) ─────────────────
interface Pedido {
  id: string
  numero: string
  destinatario: string          // ← nome correto da API
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
  camposExtras: string | null   // ← JSON string na API de produção
  setor_atual_nome: string | null
  setor_atual_id: string | null
}

interface Setor {
  id: string
  nome: string
  icone: string
  ordem: number
}

interface Demanda {
  id: string
  nomeProduto: string
  freelancerNome?: string
  qtdSolicitada: number
  qtdProduzida: number
  valorTotal: number
  status: string
}

// ─── Helpers ─────────────────────────────────────────────────
function R(n: any) {
  const num = parseFloat(String(n ?? ''))
  if (isNaN(num)) return '—'
  return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function dt(s: string | null | undefined) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('pt-BR') } catch { return '—' }
}
function safe(url: string, fb: any) {
  return fetch(url).then(r => r.ok ? r.json() : fb).catch(() => fb)
}

const STATUS_PT: Record<string, string> = {
  ABERTO: 'Aberto', EM_PRODUCAO: 'Em produção',
  CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado',
}
const PRIO_PT: Record<string, string> = {
  URGENTE: '🔴 Urgente', ALTA: '🟠 Alta',
  NORMAL: '🟢 Normal', BAIXA: '⚪ Baixa',
}

// ─── Página ──────────────────────────────────────────────────
export default function PrintPage() {
  const params    = useParams() as { id: string }
  const pedidoId  = params.id

  const [pedido,    setPedido]    = useState<Pedido | null>(null)
  const [setores,   setSetores]   = useState<Setor[]>([])
  const [demandas,  setDemandas]  = useState<Demanda[]>([])
  const [workspace, setWorkspace] = useState({ nome: 'Meu Ateliê' })
  const [loading,   setLoading]   = useState(true)
  const [erro,      setErro]      = useState('')

  const carregar = useCallback(async () => {
    try {
      const [p, s, d, ws] = await Promise.all([
        safe(`/api/producao/pedidos/${pedidoId}`, null),
        safe('/api/producao/setores', { setores: [] }),
        safe(`/api/demandas?pedidoId=${pedidoId}`, []),
        safe('/api/config/geral', {}),
      ])

      if (!p) { setErro('Pedido não encontrado'); setLoading(false); return }

      // A API de produção retorna { pedido: {...} } ou diretamente o objeto
      const pedidoData = p.pedido || p
      setPedido(pedidoData)
      setSetores(Array.isArray(s) ? s : (s.setores || []))
      setDemandas(Array.isArray(d) ? d : (d.demandas || []))
      setWorkspace({ nome: ws.nomeProprietaria || ws.nome || 'Meu Ateliê' })
    } catch (e) {
      setErro('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [pedidoId])

  useEffect(() => { carregar() }, [carregar])

  // Dispara impressão após carregar (com delay para render)
  useEffect(() => {
    if (!loading && pedido) {
      const t = setTimeout(() => window.print(), 800)
      return () => clearTimeout(t)
    }
  }, [loading, pedido])

  // Campos personalizados — parse do JSON string da API
  const camposExtras: Record<string, string> = (() => {
    if (!pedido?.camposExtras) return {}
    try {
      const parsed = typeof pedido.camposExtras === 'string'
        ? JSON.parse(pedido.camposExtras)
        : pedido.camposExtras
      return Object.fromEntries(
        Object.entries(parsed).filter(([k]) => !k.startsWith('_'))
      )
    } catch { return {} }
  })()

  // Setor atual
  const setorAtualIdx = setores.findIndex(s => s.id === pedido?.setor_atual_id)
  const statusLabel   = STATUS_PT[pedido?.status || ''] || pedido?.status || '—'
  const prioLabel     = PRIO_PT[pedido?.prioridade || ''] || pedido?.prioridade || '—'

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'white' }}>
        <p style={{ color:'#9ca3af', fontSize:'14px' }}>Carregando ficha...</p>
      </div>
    )
  }

  // ── Erro ──
  if (erro || !pedido) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'white' }}>
        <p style={{ color:'#ef4444', fontSize:'14px' }}>{erro || 'Pedido não encontrado'}</p>
      </div>
    )
  }

  const totalDemandas = demandas.reduce((s, d) => s + Number(d.valorTotal || 0), 0)

  return (
    <>
      {/* Botões — somem no print */}
      <div className="no-print" style={{
        position:'fixed', top:16, right:16, zIndex:999,
        display:'flex', gap:8,
      }}>
        <button
          onClick={() => window.print()}
          style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'8px 18px', background:'#f97316', color:'white',
            border:'none', borderRadius:8, fontSize:13, fontWeight:600,
            cursor:'pointer',
          }}
        >
          🖨️ Imprimir
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding:'8px 14px', background:'#f3f4f6', color:'#374151',
            border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, cursor:'pointer',
          }}
        >
          Fechar
        </button>
      </div>

      {/* ── Ficha ── */}
      <div style={{
        maxWidth:800, margin:'0 auto', padding:'32px 40px',
        background:'white', color:'#111827',
        fontFamily:"'Segoe UI', system-ui, sans-serif",
      }}>

        {/* ── Cabeçalho ── */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-start',
          paddingBottom:16, marginBottom:24,
          borderBottom:'3px solid #f97316',
        }}>
          <div>
            <div style={{ fontSize:22, fontWeight:700, color:'#111827' }}>
              {workspace.nome}
            </div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
              Ficha de Produção
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:28, fontWeight:800, color:'#f97316', fontFamily:'monospace' }}>
              {pedido.numero ? `#${pedido.numero}` : '—'}
            </div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
              Emitido em {dt(new Date().toISOString())}
            </div>
          </div>
        </div>

        {/* ── Seção 1: Dados do pedido ── */}
        <Section title="Dados do Pedido">
          <Grid cols={3}>
            <Field label="Destinatário / Cliente" value={pedido.destinatario} large />
            <Field label="Canal" value={pedido.canal || '—'} />
            <Field label="Prioridade" value={prioLabel} />
          </Grid>
          <Grid cols={1} style={{ marginTop:10 }}>
            <Field label="Produto(s)" value={pedido.produto} />
          </Grid>
          <Grid cols={3} style={{ marginTop:10 }}>
            <Field label="Quantidade total" value={`${pedido.quantidade} peça${pedido.quantidade !== 1 ? 's' : ''}`} />
            <Field label="Valor total" value={R(pedido.valor)} highlight />
            <Field label="Status" value={statusLabel} />
          </Grid>
          <Grid cols={3} style={{ marginTop:10 }}>
            <Field label="Data de entrada" value={dt(pedido.dataEntrada)} />
            <Field label="Data de envio" value={dt(pedido.dataEnvio)} />
            <Field label="ID do cliente" value={pedido.idCliente || '—'} />
          </Grid>
          {pedido.endereco && (
            <Grid cols={1} style={{ marginTop:10 }}>
              <Field label="Endereço de entrega" value={pedido.endereco} />
            </Grid>
          )}
          {pedido.observacoes && (
            <div style={{
              marginTop:10, padding:'10px 14px',
              background:'#fefce8', border:'1px solid #fde68a',
              borderRadius:8, borderLeft:'4px solid #f59e0b',
            }}>
              <div style={{ fontSize:11, color:'#92400e', fontWeight:600, marginBottom:4 }}>OBSERVAÇÕES</div>
              <div style={{ fontSize:13, color:'#78350f' }}>{pedido.observacoes}</div>
            </div>
          )}
        </Section>

        {/* ── Seção 2: Campos personalizados ── */}
        {Object.keys(camposExtras).length > 0 && (
          <Section title="Informações Adicionais">
            <Grid cols={3}>
              {Object.entries(camposExtras).map(([k, v]) => (
                <Field key={k} label={k} value={String(v) || '—'} />
              ))}
            </Grid>
          </Section>
        )}

        {/* ── Seção 3: Fluxo de produção ── */}
        {setores.length > 0 && (
          <Section title="Fluxo de Produção">
            {/* Linha de setores */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
              {setores.map((setor, idx) => {
                const concluido = pedido.status === 'CONCLUIDO' || setorAtualIdx > idx
                const atual     = setor.id === pedido.setor_atual_id
                return (
                  <div key={setor.id} style={{
                    display:'flex', alignItems:'center', gap:8,
                    padding:'8px 14px', borderRadius:8, minWidth:130,
                    border: atual ? '2px solid #f97316' : '2px solid ' + (concluido ? '#86efac' : '#e5e7eb'),
                    background: atual ? '#fff7ed' : (concluido ? '#f0fdf4' : '#f9fafb'),
                  }}>
                    {/* Checkbox */}
                    <div style={{
                      width:18, height:18, borderRadius:4, flexShrink:0,
                      border:'2px solid ' + (concluido ? '#22c55e' : atual ? '#f97316' : '#d1d5db'),
                      background: concluido ? '#22c55e' : 'white',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      {concluido && <span style={{ color:'white', fontSize:11, fontWeight:700 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{
                        fontSize:12, fontWeight:600,
                        color: atual ? '#c2410c' : concluido ? '#15803d' : '#374151',
                      }}>
                        {setor.icone} {setor.nome}
                      </div>
                      {atual && <div style={{ fontSize:10, color:'#f97316' }}>← atual</div>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Grid de assinaturas */}
            <div style={{
              display:'grid',
              gridTemplateColumns: `repeat(${Math.min(setores.length, 4)}, 1fr)`,
              gap:10,
            }}>
              {setores.map(setor => (
                <div key={setor.id} style={{
                  border:'1px dashed #d1d5db', borderRadius:8, padding:10,
                }}>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:24 }}>
                    {setor.icone} {setor.nome}
                  </div>
                  <div style={{ borderBottom:'1px solid #d1d5db', marginBottom:4 }} />
                  <div style={{ fontSize:10, color:'#d1d5db' }}>assinatura / data</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Seção 4: Demandas de freelancer ── */}
        {demandas.length > 0 && (
          <Section title="Demandas de Freelancer">
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
                  {['Produto','Freelancer','Qtd','Produzido','Valor','Status'].map(h => (
                    <th key={h} style={{
                      padding:'8px 10px', textAlign: h === 'Qtd' || h === 'Produzido' ? 'center' : 'left',
                      fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demandas.map((d, i) => (
                  <tr key={d.id} style={{
                    borderBottom:'1px solid #f3f4f6',
                    background: i % 2 === 0 ? 'white' : '#fafafa',
                  }}>
                    <td style={{ padding:'8px 10px', fontWeight:500 }}>{d.nomeProduto}</td>
                    <td style={{ padding:'8px 10px', color:'#6b7280' }}>{d.freelancerNome || '—'}</td>
                    <td style={{ padding:'8px 10px', textAlign:'center' }}>{d.qtdSolicitada}</td>
                    <td style={{ padding:'8px 10px', textAlign:'center' }}>{d.qtdProduzida}</td>
                    <td style={{ padding:'8px 10px', color:'#f97316', fontWeight:600 }}>{R(Number(d.valorTotal))}</td>
                    <td style={{ padding:'8px 10px' }}>
                      <span style={{
                        padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600,
                        background: d.status === 'PAGO' ? '#dcfce7' : '#fef9c3',
                        color:      d.status === 'PAGO' ? '#15803d' : '#854d0e',
                      }}>{d.status}</span>
                    </td>
                  </tr>
                ))}
                <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                  <td colSpan={4} style={{ padding:'8px 10px', textAlign:'right', fontSize:12, color:'#6b7280' }}>
                    Total freelancers:
                  </td>
                  <td style={{ padding:'8px 10px', color:'#f97316', fontWeight:700 }}>
                    {R(totalDemandas)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </Section>
        )}

        {/* ── Rodapé ── */}
        <div style={{
          marginTop:32, paddingTop:12,
          borderTop:'1px solid #e5e7eb',
          display:'flex', justifyContent:'space-between',
          fontSize:11, color:'#9ca3af',
        }}>
          <span>{workspace.nome} — Sistema VPS Gestão</span>
          <span>#{pedido.numero || '------'} · Impresso em {new Date().toLocaleString('pt-BR')}</span>
        </div>
      </div>
    </>
  )
}

// ─── Componentes auxiliares de layout ────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{
        display:'flex', alignItems:'center', gap:10, marginBottom:12,
      }}>
        <span style={{
          display:'block', height:1, flex:1, background:'#fed7aa',
        }} />
        <span style={{
          fontSize:11, fontWeight:700, letterSpacing:'0.08em',
          color:'#f97316', textTransform:'uppercase', whiteSpace:'nowrap',
        }}>{title}</span>
        <span style={{ display:'block', height:1, flex:1, background:'#fed7aa' }} />
      </div>
      {children}
    </div>
  )
}

function Grid({ cols, children, style }: { cols: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap:12,
      ...style,
    }}>
      {children}
    </div>
  )
}

function Field({
  label, value, large, highlight,
}: {
  label: string; value: string | number | null | undefined
  large?: boolean; highlight?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize:11, color:'#9ca3af', fontWeight:500, marginBottom:2 }}>
        {label}
      </div>
      <div style={{
        fontSize: large ? 15 : 13,
        fontWeight: large || highlight ? 700 : 500,
        color: highlight ? '#f97316' : '#111827',
      }}>
        {value || '—'}
      </div>
    </div>
  )
}
