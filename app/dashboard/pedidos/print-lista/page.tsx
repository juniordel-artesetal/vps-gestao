'use client'
// Impressão em LISTA (picking list): 1 linha por ITEM, vários pedidos na mesma folha.
// Colunas: Produto · Variação · Quantidade · ID etiqueta (= Order.numero) · Canal · Destinatário.
// Recebe ?ids=a,b,c (mesmo formato do print individual); os ids já respeitam os filtros da
// tela de Pedidos (a seleção usa onlyIds sobre o filtro atual). Reusa o parse de
// camposExtras.produtos[] e o mecanismo window.open+print da impressão existente.
import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

async function safe(url: string, fb: any) {
  try { const r = await fetch(url); return r.ok ? r.json() : fb } catch { return fb }
}

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// "Produto (Variação)" → { produto, variacao }. O último parêntese é a variação (ignora "(Nx)").
function parseNomeVariacao(nome: any): { produto: string; variacao: string } {
  const original = String(nome ?? '').trim()
  let s = original
  let variacao = ''
  const m = s.match(/\(([^()]+)\)\s*$/)
  if (m && !/^\d+\s*x$/i.test(m[1].trim())) { variacao = m[1].trim(); s = s.slice(0, m.index).trim() }
  return { produto: s || original, variacao }
}

// Itens de um pedido: prefere o JSON estruturado camposExtras.produtos[]; senão faz o
// fallback do texto "A (Var) (2x) + B" (mesma lógica da tela de detalhe do pedido).
// Shopee não-mapeado (nome="-") cai nos campos do próprio pedido (PRODUTO/Tema/Personalização).
function itensDoPedido(pedido: any): { produto: string; variacao: string; qtd: number }[] {
  let extras: any = null
  try { extras = pedido?.camposExtras ? JSON.parse(pedido.camposExtras) : null } catch { /* inválido */ }

  // Fallback de descrição p/ item não mapeado ("-"): tipo (PRODUTO) + tema + personalização.
  const tipoShopee = String(extras?.PRODUTO || pedido?.produto || '').trim()
  const detalheShopee = [extras?.Tema, extras?.['Personalização']].map((x: any) => String(x ?? '').trim()).filter(Boolean).join(' · ')
  const vazio = (v: string) => !v || v === '-'

  const arr = Array.isArray(extras?.produtos) ? extras.produtos.filter((p: any) => p && p.nome != null) : []
  if (arr.length) {
    return arr.map((p: any) => {
      const nome = String(p.nome ?? '').trim()
      const qtd = Number(p.quantidade) || 1
      if (!vazio(nome)) return { ...parseNomeVariacao(nome), qtd }
      // item não mapeado — usa o que o Shopee mandou
      return vazio(tipoShopee)
        ? { produto: detalheShopee || '—', variacao: '', qtd }
        : { produto: tipoShopee, variacao: detalheShopee, qtd }
    })
  }

  const partes = String(pedido?.produto || '').split(' + ').map(s => s.trim()).filter(Boolean)
  if (!partes.length || (partes.length === 1 && vazio(partes[0]))) {
    if (!vazio(tipoShopee) || detalheShopee) {
      return [vazio(tipoShopee)
        ? { produto: detalheShopee || '—', variacao: '', qtd: Number(pedido?.quantidade) || 1 }
        : { produto: tipoShopee, variacao: detalheShopee, qtd: Number(pedido?.quantidade) || 1 }]
    }
    return [{ produto: '—', variacao: '', qtd: Number(pedido?.quantidade) || 1 }]
  }
  return partes.map(parte => {
    let qtd = 1
    const mq = parte.match(/\((\d+)\s*x\)\s*$/i)
    if (mq) { qtd = Number(mq[1]) || 1; parte = parte.slice(0, mq.index).trim() }
    return { ...parseNomeVariacao(parte), qtd }
  })
}

function PrintListaContent() {
  const sp = useSearchParams()
  const ids = (sp.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean)

  useEffect(() => {
    if (!ids.length) return
    (async () => {
      const cfg = await safe('/api/config/geral', {})
      const nomeAtelier = cfg?.nome || 'SOA'

      const pedidos = await Promise.all(ids.map(async id => {
        const r = await safe(`/api/producao/pedidos/${id}`, null)
        return r?.pedido ?? r
      }))
      const validos = pedidos.filter(Boolean)

      // 1 linha por item
      type Linha = { produto: string; variacao: string; qtd: number; numero: string; canal: string; destinatario: string }
      const linhas: Linha[] = []
      for (const p of validos) {
        for (const it of itensDoPedido(p)) {
          linhas.push({
            ...it,
            numero: String(p.numero || p.id || ''),
            canal: String(p.canal || ''),
            destinatario: String(p.destinatario || p.cliente || ''),
          })
        }
      }
      const totalQtd = linhas.reduce((a, l) => a + (Number(l.qtd) || 0), 0)
      const hoje = new Date().toLocaleDateString('pt-BR')

      const rowsHtml = linhas.map(l => `<tr>
        <td>${esc(l.produto)}</td>
        <td>${esc(l.variacao) || '—'}</td>
        <td class="c">${Number(l.qtd) || 1}</td>
        <td class="mono">${esc(l.numero) || '—'}</td>
        <td>${esc(l.canal) || '—'}</td>
        <td>${esc(l.destinatario) || '—'}</td>
      </tr>`).join('\n')

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Lista de pedidos — ${esc(nomeAtelier)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 0; background: #fff; }
  @page { size: A4 portrait; margin: 1.2cm; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { color: #555; font-size: 11px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }           /* repete o cabeçalho em cada página */
  th, td { border: 1px solid #999; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  td.c, th.c { text-align: center; }
  .mono { font-family: 'Courier New', monospace; font-weight: bold; }
  tfoot td { font-weight: bold; background: #f7f7f7; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <h1>Lista de pedidos — ${esc(nomeAtelier)}</h1>
  <p class="sub">${validos.length} pedido(s) · ${linhas.length} item(ns) · ${totalQtd} peça(s) · impresso em ${hoje}</p>
  <table>
    <thead><tr>
      <th>Produto</th><th>Variação</th><th class="c">Qtd</th><th>ID etiqueta</th><th>Canal</th><th>Destinatário</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr>
      <td colspan="2">Total</td><td class="c">${totalQtd}</td>
      <td colspan="3">${linhas.length} item(ns) em ${validos.length} pedido(s)</td>
    </tr></tfoot>
  </table>
</body></html>`

      const win = window.open('', '_blank', 'width=1000,height=700')
      if (!win) { alert('Permita pop-ups para imprimir a lista.'); return }
      win.document.open(); win.document.write(html); win.document.close()
      win.onload = () => { win.focus(); win.print() }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  return (
    <div style={{ padding: 24, fontFamily: 'Arial, sans-serif', color: '#555' }}>
      {ids.length ? 'Gerando a lista para impressão… Se nada abrir, permita pop-ups no navegador.' : 'Nenhum pedido selecionado.'}
    </div>
  )
}

export default function PrintListaPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Carregando…</div>}><PrintListaContent /></Suspense>
}
