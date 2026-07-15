'use client'
// app/dashboard/pedidos/print/page.tsx
// Impressão em massa via window.open() com HTML gerado — abordagem mais confiável
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatarDataBR } from '@/lib/data'

interface Pedido {
  id: string; numero: string; destinatario: string; idCliente: string | null
  canal: string | null; produto: string | null; quantidade: number | null
  valor: string | number | null; prioridade: string | null; status: string
  dataEntrada: string | null; dataEnvio: string | null
  observacoes: string | null; camposExtras: string | null
}

interface SetorHist {
  setorNome: string; status: string
  entradaEm: string | null; saidaEm: string | null; atual: boolean
}

const STATUS_PT: Record<string,string> = {
  ABERTO:'Aberto', EM_PRODUCAO:'Em produção',
  PRONTO:'Pronto', CONCLUIDO:'Pronto', ENVIADO:'Enviado', CANCELADO:'Cancelado',
}

function fmtR(v: any) {
  const n = parseFloat(String(v))
  return isNaN(n) ? '—' : 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function fmtDate(s: string | null) {
  // Data sem hora → sem conversão de fuso (evita voltar um dia)
  return formatarDataBR(s)
}
function fmtDT(s: string | null) {
  if (!s) return '—'
  try { return new Date(s).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) } catch { return s }
}

// Gera QR e/ou código de barras (Code128) client-side como data URL
async function gerarCodigos(codigo: string, tipo: string): Promise<{ qr?: string; barras?: string }> {
  const out: { qr?: string; barras?: string } = {}
  try {
    if (tipo === 'qr' || tipo === 'ambos') {
      const QRCode = (await import('qrcode')).default
      out.qr = await QRCode.toDataURL(codigo, { margin: 1, width: 130 })
    }
    if (tipo === 'barras' || tipo === 'ambos') {
      const JsBarcode = (await import('jsbarcode')).default
      const c = document.createElement('canvas')
      JsBarcode(c, codigo, { format: 'CODE128', width: 2, height: 40, fontSize: 11, margin: 4 })
      out.barras = c.toDataURL('image/png')
    }
  } catch { /* silencioso */ }
  return out
}

function buildPedidoHtml(pedido: Pedido, hist: SetorHist[], nomeAtelier: string, logo: string, codigos: { qr?: string; barras?: string } = {}): string {
  let camposExtras: Record<string,any> = {}
  try { if (pedido.camposExtras) camposExtras = JSON.parse(pedido.camposExtras) } catch {}
  const camposVisiveis = Object.entries(camposExtras).filter(([k]) => !k.startsWith('_'))

  const prioColor = pedido.prioridade === 'URGENTE' ? '#ef4444' : pedido.prioridade === 'ALTA' ? '#f97316' : '#6b7280'
  const prioLabel = pedido.prioridade && pedido.prioridade !== 'NORMAL' ? ` &bull; <span style="color:${prioColor}">${pedido.prioridade}</span>` : ''

  const camposHtml = camposVisiveis.map(([k, v]) => {
    const isImg = typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http'))
    return `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:7px 10px">
      <div style="font-size:10px;color:#9a3412;margin-bottom:2px">${k}</div>
      ${isImg ? `<img src="${v}" style="max-height:80px;max-width:100%;object-fit:contain;margin-top:4px">` : `<div style="font-weight:600;font-size:12px">${String(v)||'—'}</div>`}
    </div>`
  }).join('')

  const fluxoHtml = hist.length > 0 ? `
    <div style="margin-top:14px">
      <div style="font-size:10px;font-weight:bold;color:#f97316;text-transform:uppercase;margin-bottom:8px">Fluxo de Produção</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${hist.map(s => `
          <div style="padding:6px 10px;border-radius:6px;font-size:11px;
            background:${s.saidaEm?'#dcfce7':s.atual?'#fff7ed':'#f3f4f6'};
            border:1px solid ${s.saidaEm?'#86efac':s.atual?'#fdba74':'#e5e7eb'};
            color:${s.saidaEm?'#166534':s.atual?'#9a3412':'#4b5563'}">
            <div style="font-weight:bold">${s.setorNome}</div>
            ${s.entradaEm?`<div style="font-size:10px">&darr; ${fmtDT(s.entradaEm)}</div>`:''}
            ${s.saidaEm?`<div style="font-size:10px">&check; ${fmtDT(s.saidaEm)}</div>`:''}
          </div>`).join('')}
      </div>
    </div>` : ''

  const obsHtml = pedido.observacoes ? `
    <div style="margin:14px 0;background:#fefce8;border:1px solid #fde047;border-radius:6px;padding:8px 12px">
      <div style="font-size:10px;font-weight:bold;color:#854d0e;margin-bottom:2px">Observações</div>
      <div style="font-size:12px">${pedido.observacoes}</div>
    </div>` : ''

  return `
    <div class="pedido-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;border-bottom:2px solid #f97316;padding-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          ${logo ? `<img src="${logo}" style="height:32px;object-fit:contain">` : ''}
          <div>
            <div style="font-weight:bold;font-size:14px">${nomeAtelier}</div>
            <div style="font-size:10px;color:#6b7280">Ficha de Produção</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:bold;font-size:18px;color:#f97316">#${pedido.numero}</div>
          <div style="font-size:10px;color:#6b7280">${STATUS_PT[pedido.status]||pedido.status}${prioLabel}</div>
          ${(codigos.qr || codigos.barras) ? `<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:6px">
            ${codigos.barras ? `<img src="${codigos.barras}" style="height:40px">` : ''}
            ${codigos.qr ? `<img src="${codigos.qr}" style="height:56px;width:56px">` : ''}
          </div>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        ${[
          ['Cliente / Destinatário', pedido.destinatario||'—'],
          ['ID na Plataforma', pedido.idCliente||'—'],
          ['Canal de Venda', pedido.canal||'—'],
          ['Data de Entrada', fmtDate(pedido.dataEntrada)],
          ['Data de Envio', fmtDate(pedido.dataEnvio)],
          ['Valor', fmtR(pedido.valor)],
          ['Produto(s)', pedido.produto||'—'],
          ['Quantidade', pedido.quantidade!=null?String(pedido.quantidade):'—'],
        ].map(([l,v]) => `
          <div style="background:#f9fafb;border-radius:6px;padding:7px 10px">
            <div style="font-size:10px;color:#6b7280;margin-bottom:2px">${l}</div>
            <div style="font-weight:600">${v}</div>
          </div>`).join('')}
      </div>
      ${camposVisiveis.length > 0 ? `
        <div style="margin-bottom:14px">
          <div style="font-size:10px;font-weight:bold;color:#f97316;text-transform:uppercase;margin-bottom:6px">Campos Personalizados</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${camposHtml}</div>
        </div>` : ''}
      ${obsHtml}
      ${fluxoHtml}
    </div>`
}

async function safe(url: string, fb: any) {
  try { const r = await fetch(url); return r.ok ? r.json() : fb } catch { return fb }
}

function PrintMassContent() {
  const searchParams = useSearchParams()
  const idsParam     = searchParams.get('ids') || ''
  const ids          = idsParam.split(',').map(s => s.trim()).filter(Boolean)

  useEffect(() => {
    if (ids.length === 0) return

    async function gerarImpressao() {
      const [cfg, st, exp] = await Promise.all([
        safe('/api/config/geral', {}),
        safe('/api/producao/setores', []),
        safe('/api/config/expedicao', { ativo: false }),
      ])
      const nomeAtelier = cfg.nome || 'SOA'
      const logo        = cfg.logo || ''
      const expAtivo    = !!exp?.ativo
      const tipoCodigo  = exp?.tipoCodigo || 'ambos'

      // Carrega todos os pedidos em paralelo (+ gera os códigos quando ativo)
      const resultados = await Promise.all(ids.map(async id => {
        const [pRes, hRes] = await Promise.all([
          safe(`/api/producao/pedidos/${id}`, null),
          safe(`/api/producao/historico/${id}`, {}),
        ])
        const pedido = pRes?.pedido ?? pRes
        const hist   = hRes?.fluxo || hRes?.historico || []
        const codigos = (expAtivo && pedido) ? await gerarCodigos(String(pedido.numero || pedido.id || ''), tipoCodigo) : {}
        return { pedido, hist, codigos }
      }))

      // Gera HTML completo
      const cardsHtml = resultados.map(({ pedido, hist, codigos }) =>
        pedido ? buildPedidoHtml(pedido, hist, nomeAtelier, logo, codigos) : ''
      ).join('\n')

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Impressão — ${nomeAtelier}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 0; background: white; }
    @page { size: A4 portrait; margin: 1.5cm; }
    .pedido-card {
      page-break-after: always;
      break-after: page;
      padding: 8px 0;
    }
    .pedido-card:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
${cardsHtml}
</body>
</html>`

      const win = window.open('', '_blank', 'width=900,height=700')
      if (!win) { alert('Permita pop-ups para imprimir'); return }
      win.document.open()
      win.document.write(html)
      win.document.close()
      win.onload = () => { win.focus(); win.print() }
    }

    gerarImpressao()
  }, [ids.join(',')])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap:'16px', fontFamily:'Arial, sans-serif' }}>
      <div style={{ fontSize:'32px' }}>🖨️</div>
      <p style={{ fontSize:'16px', color:'#374151', margin:0 }}>
        Preparando impressão de <strong>{ids.length}</strong> pedido{ids.length !== 1 ? 's' : ''}...
      </p>
      <p style={{ fontSize:'12px', color:'#9ca3af', margin:0 }}>
        Uma nova janela será aberta com as fichas de produção.
      </p>
      <p style={{ fontSize:'11px', color:'#d97706', margin:0 }}>
        ⚠ Se não abrir, verifique se pop-ups estão permitidos para este site.
      </p>
    </div>
  )
}

export default function PrintMassPage() {
  return (
    <Suspense fallback={
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
        <p style={{ color:'#6b7280' }}>Carregando...</p>
      </div>
    }>
      <PrintMassContent />
    </Suspense>
  )
}
