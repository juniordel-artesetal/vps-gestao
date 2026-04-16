'use client'
// ══════════════════════════════════════════════════════════════
// Destino: app/dashboard/pedidos/print/page.tsx
// Função : Impressão em massa de pedidos (URL: /print?ids=id1,id2,id3)
// ══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface Pedido {
  id: string
  numero: string
  destinatario: string
  idCliente: string | null
  canal: string | null
  produto: string | null
  quantidade: number | null
  quantidadeSku: number | null
  valor: string | number | null
  prioridade: string | null
  status: string
  dataEntrada: string | null
  dataEnvio: string | null
  observacoes: string | null
  endereco: string | null
  camposExtras: string | null
}

interface Setor {
  id: string
  nome: string
  ordem: number
}

interface SetorHist {
  setorNome: string
  status: string
  entradaEm: string | null
  saidaEm: string | null
  atual: boolean
}

const STATUS_PT: Record<string, string> = {
  ABERTO: 'Aberto', EM_PRODUCAO: 'Em produção',
  CONCLUIDO: 'Concluído', ENVIADO: 'Enviado', CANCELADO: 'Cancelado',
}

function fmtR(v: any) {
  const n = parseFloat(String(v))
  if (isNaN(n)) return '—'
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('pt-BR') } catch { return s }
}
function fmtDateTime(s: string | null) {
  if (!s) return '—'
  try { return new Date(s).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) } catch { return s }
}

async function safe(url: string, fb: any) {
  try { const r = await fetch(url); return r.ok ? r.json() : fb } catch { return fb }
}

interface PedidoCardProps {
  pedidoId: string
  nomeAtelier: string
  logo: string
  setores: Setor[]
  index: number
  total: number
}

function PedidoCard({ pedidoId, nomeAtelier, logo, setores, index, total }: PedidoCardProps) {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [hist,   setHist]   = useState<SetorHist[]>([])
  const [erro,   setErro]   = useState('')

  const carregar = useCallback(async () => {
    if (!pedidoId || pedidoId === 'undefined') return
    const [p, h] = await Promise.all([
      safe(`/api/producao/pedidos/${pedidoId}`, null),
      safe(`/api/producao/historico/${pedidoId}`, {}),
    ])
    if (!p) { setErro('Pedido não encontrado'); return }
    setPedido(p.pedido ?? p)
    setHist(h.fluxo || h.historico || [])
  }, [pedidoId])

  useEffect(() => { carregar() }, [carregar])

  if (erro) return (
    <div style={{ padding: '20px', color: '#ef4444', fontSize: '13px', pageBreakAfter: 'always' }}>
      ⚠ Pedido {pedidoId}: {erro}
    </div>
  )

  if (!pedido) return (
    <div style={{ padding: '20px', fontSize: '13px', color: '#6b7280', pageBreakAfter: index < total - 1 ? 'always' : 'auto' }}>
      Carregando pedido {index + 1} de {total}...
    </div>
  )

  let camposExtras: Record<string, any> = {}
  try { if (pedido.camposExtras) camposExtras = JSON.parse(pedido.camposExtras) } catch {}
  const camposVisiveis = Object.entries(camposExtras).filter(([k]) => !k.startsWith('_'))

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#111',
      padding: '24px',
      pageBreakAfter: index < total - 1 ? 'always' : 'auto',
      maxWidth: '780px',
      margin: '0 auto',
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '2px solid #f97316', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {logo && <img src={logo} alt="logo" style={{ height: '36px', objectFit: 'contain' }} />}
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{nomeAtelier}</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Ficha de Produção</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#f97316' }}>#{pedido.numero}</div>
          <div style={{ fontSize: '10px', color: '#6b7280' }}>
            {STATUS_PT[pedido.status] || pedido.status}
            {pedido.prioridade && pedido.prioridade !== 'NORMAL' && (
              <span style={{ marginLeft: '6px', color: pedido.prioridade === 'URGENTE' ? '#ef4444' : '#f97316' }}>
                ● {pedido.prioridade}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dados principais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
        {[
          ['Cliente / Destinatário', pedido.destinatario || '—'],
          ['ID na Plataforma',       pedido.idCliente || '—'],
          ['Canal de Venda',         pedido.canal || '—'],
          ['Data de Entrada',        fmtDate(pedido.dataEntrada)],
          ['Data de Envio',          fmtDate(pedido.dataEnvio)],
          ['Valor',                  fmtR(pedido.valor)],
          ['Produto(s)',             pedido.produto || '—'],
          ['Quantidade',             pedido.quantidade != null ? String(pedido.quantidade) : '—'],
        ].map(([label, val]) => (
          <div key={label} style={{ background: '#f9fafb', borderRadius: '6px', padding: '7px 10px' }}>
            <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '2px' }}>{label}</div>
            <div style={{ fontWeight: '600' }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Campos extras */}
      {camposVisiveis.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#f97316', textTransform: 'uppercase', marginBottom: '6px' }}>Campos Personalizados</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {camposVisiveis.map(([k, v]) => {
              const isImg = typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http'))
              return (
                <div key={k} style={{ background: '#fff7ed', borderRadius: '6px', padding: '7px 10px', border: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: '10px', color: '#9a3412', marginBottom: '2px' }}>{k}</div>
                  {isImg
                    ? <img src={v} alt={k} style={{ maxHeight: '80px', maxWidth: '100%', objectFit: 'contain', marginTop: '4px' }} />
                    : <div style={{ fontWeight: '600', fontSize: '12px' }}>{String(v) || '—'}</div>
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Observações */}
      {pedido.observacoes && (
        <div style={{ marginBottom: '14px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '6px', padding: '8px 12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#854d0e', marginBottom: '2px' }}>Observações</div>
          <div style={{ fontSize: '12px' }}>{pedido.observacoes}</div>
        </div>
      )}

      {/* Fluxo de produção */}
      {hist.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#f97316', textTransform: 'uppercase', marginBottom: '8px' }}>Fluxo de Produção</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {hist.map((s, i) => (
              <div key={i} style={{
                padding: '6px 10px', borderRadius: '6px', fontSize: '11px',
                background: s.saidaEm ? '#dcfce7' : s.atual ? '#fff7ed' : '#f3f4f6',
                border: `1px solid ${s.saidaEm ? '#86efac' : s.atual ? '#fdba74' : '#e5e7eb'}`,
                color: s.saidaEm ? '#166534' : s.atual ? '#9a3412' : '#4b5563',
              }}>
                <div style={{ fontWeight: 'bold' }}>{s.setorNome}</div>
                {s.entradaEm && <div style={{ fontSize: '10px' }}>↓ {fmtDateTime(s.entradaEm)}</div>}
                {s.saidaEm   && <div style={{ fontSize: '10px' }}>✓ {fmtDateTime(s.saidaEm)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PrintMassContent() {
  const searchParams  = useSearchParams()
  const idsParam      = searchParams.get('ids') || ''
  const ids           = idsParam.split(',').map(s => s.trim()).filter(Boolean)

  const [nomeAtelier, setNomeAtelier] = useState('VPS Gestão')
  const [logo,        setLogo]        = useState('')
  const [setores,     setSetores]     = useState<Setor[]>([])
  const [pronto,      setPronto]      = useState(false)

  useEffect(() => {
    Promise.all([
      safe('/api/config/geral', {}),
      safe('/api/producao/setores', []),
    ]).then(([cfg, st]) => {
      if (cfg.nome) setNomeAtelier(cfg.nome)
      if (cfg.logo) setLogo(cfg.logo)
      setSetores(Array.isArray(st) ? st : (st.setores || []))
      setPronto(true)
    })
  }, [])

  // Auto-print após todos carregarem
  useEffect(() => {
    if (!pronto || ids.length === 0) return
    const t = setTimeout(() => window.print(), 1200)
    return () => clearTimeout(t)
  }, [pronto, ids.length])

  if (ids.length === 0) return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
      Nenhum pedido selecionado para impressão.
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Botão imprimir */}
      <div className="no-print" style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 999,
        display: 'flex', gap: '8px',
      }}>
        <button onClick={() => window.print()}
          style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
          🖨️ Imprimir {ids.length} pedido{ids.length > 1 ? 's' : ''}
        </button>
        <button onClick={() => window.close()}
          style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' }}>
          ✕ Fechar
        </button>
      </div>

      {pronto && ids.map((id, i) => (
        <PedidoCard
          key={id}
          pedidoId={id}
          nomeAtelier={nomeAtelier}
          logo={logo}
          setores={setores}
          index={i}
          total={ids.length}
        />
      ))}
    </>
  )
}

export default function PrintMassPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>}>
      <PrintMassContent />
    </Suspense>
  )
}
