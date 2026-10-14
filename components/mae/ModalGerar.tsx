'use client'
// Lote 14 (item 201): GERAR — uma tela só, com as opções em um lugar (sai a barra de opções em cima da lista, o
// "Gerar selecionados" × "Gerar em lote" e o modal antigo do lote). Lembra a última escolha neste navegador e mostra
// "Vai gerar N arquivos" antes de clicar.
import { useState } from 'react'
import { Download, X, Loader2, ChevronRight, ChevronDown } from 'lucide-react'
import { ESCOLHAS_PADRAO, escolhasValidas, planejarGeracao, type EscolhasGerar, type ItemPlano } from '@/lib/mae/exportar/planejar'

const CHAVE = 'mae:gerar'
export function escolhasGuardadas(): EscolhasGerar {
  try { return escolhasValidas(JSON.parse(localStorage.getItem(CHAVE) ?? '{}')) } catch { return ESCOLHAS_PADRAO }
}
export function guardarEscolhas(e: EscolhasGerar) { try { localStorage.setItem(CHAVE, JSON.stringify(e)) } catch { /* sem armazenamento */ } }

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const sec = 'text-[11px] font-semibold uppercase tracking-wide text-gray-500'
const ck = 'accent-orange-500'

export default function ModalGerar({ itens, exemploPedido, comSoa, nomeEtapa, onFechar, onGerar }: {
  /** Um por pedido e produto (o que vai ser gerado). */
  itens: ItemPlano[]
  /** Nome do arquivo de exemplo de "um PDF por pedido". */
  exemploPedido: string
  comSoa: boolean
  /** Etapa de Impressão do SOA (null = o fluxo não tem). */
  nomeEtapa: string | null
  onFechar: () => void; onGerar: (e: EscolhasGerar) => void
}) {
  const [e, setE] = useState<EscolhasGerar>(escolhasGuardadas)
  const [indo, setIndo] = useState(false)
  const [avancado, setAvancado] = useState(false)
  const mudar = (p: Partial<EscolhasGerar>) => setE(x => ({ ...x, ...p }))
  const pedidos = new Set(itens.map(i => i.pedido)).size
  const plano = planejarGeracao(itens, e)
  const lote = e.modo === 'lote'
  const hoje = new Date(), dm = `${String(hoje.getDate()).padStart(2, '0')}-${String(hoje.getMonth() + 1).padStart(2, '0')}_${String(hoje.getHours()).padStart(2, '0')}h`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onFechar} role="dialog" aria-modal="true" data-modal-gerar>
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 shadow-xl text-sm" onClick={x => x.stopPropagation()}>
        <div className="flex items-center gap-2"><Download className="w-4 h-4 text-orange-500" /><b>Gerar {pedidos} pedido{pedidos === 1 ? '' : 's'}</b><button className="ml-auto" onClick={onFechar} aria-label="Fechar"><X className="w-4 h-4" /></button></div>

        <fieldset className="space-y-1.5">
          <legend className={sec}>Arquivos</legend>
          <label className="flex items-start gap-2 text-xs"><input type="radio" className={ck + ' mt-0.5'} checked={!lote} onChange={() => mudar({ modo: 'pedido' })} data-modo-gerar="pedido" />
            <span><b>Um PDF por pedido</b><br /><span className="text-gray-500">Cada cliente no seu arquivo: <i>{exemploPedido}</i> · Pasta: Exportações / hoje / Pedidos</span></span></label>
          <label className="flex items-start gap-2 text-xs"><input type="radio" className={ck + ' mt-0.5'} checked={lote} onChange={() => mudar({ modo: 'lote' })} data-modo-gerar="lote" />
            <span><b>Juntar os pedidos para imprimir de uma vez (lote)</b><br /><span className="text-gray-500">Vários pedidos no mesmo PDF: <i>LOTE_{dm}_{pedidos}pedidos_…</i> · Pasta: Exportações / hoje / LOTES</span></span></label>
          {lote && (
            <div className="ml-6 space-y-1">
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" className={ck + ' mt-0.5'} checked={e.porProduto} onChange={x => mudar({ porProduto: x.target.checked })} data-por-produto />
                <span>Um PDF por tipo de produto <span className="text-gray-500">— Pegue e Monte num PDF, Tags noutro, Etiquetas noutro… (desligado: tudo num PDF só)</span></span></label>
              <label className="flex items-center gap-2 text-xs">Até
                <input type="text" inputMode="numeric" value={e.maxPedidos} onChange={x => mudar({ maxPedidos: Math.max(1, Math.min(50, parseInt(x.target.value.replace(/\D/g, '') || '1'))) })} className="w-12 rounded border border-gray-200 bg-transparent px-1 text-right" aria-label="Pedidos por PDF" data-max-pedidos /> pedidos por PDF</label>
            </div>
          )}
        </fieldset>

        {/* a ordem das páginas só existe no lote (com 1 pedido por PDF não faz diferença) */}
        {lote && (
          <fieldset className="space-y-1">
            <legend className={sec}>Ordem das páginas (no lote)</legend>
            <label className="flex items-start gap-2 text-xs"><input type="radio" className={ck + ' mt-0.5'} checked={e.ordem === 'modelo'} onChange={() => mudar({ ordem: 'modelo' })} data-ordem-gerar="modelo" />
              <span><b>A mesma caixa junta</b>: todas as MILK, depois todos os CUBOS… <span className="text-gray-500">(para cortar em sequência, sem trocar o arquivo de corte — junta pela marca de registro da caixa)</span></span></label>
            {e.ordem === 'modelo' && <label className="ml-6 flex items-center gap-2 text-xs"><input type="checkbox" className={ck} checked={e.intercalar} onChange={x => mudar({ intercalar: x.target.checked })} data-intercalar /> Intercalar temas (dois do mesmo tema não ficam colados)</label>}
            <label className="flex items-start gap-2 text-xs"><input type="radio" className={ck + ' mt-0.5'} checked={e.ordem === 'pedido'} onChange={() => mudar({ ordem: 'pedido' })} data-ordem-gerar="pedido" /><span><b>O kit de cada cliente junto</b></span></label>
          </fieldset>
        )}

        <fieldset className="space-y-1">
          <legend className={sec}>Na folha</legend>
          {lote && <label className="flex items-center gap-2 text-xs"><input type="checkbox" className={ck} checked={e.identificacao} onChange={x => mudar({ identificacao: x.target.checked })} data-identificacao /> Nome do pedido na margem (&ldquo;#123 · Naty&rdquo;), fora do corte</label>}
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className={ck} checked={e.fundoMarca} onChange={x => mudar({ fundoMarca: x.target.checked })} data-fundo-marca /> Fundo branco atrás das marcas de registro
            {e.fundoMarca && <> · folga <input type="text" inputMode="decimal" value={String(e.folgaMarcaMm).replace('.', ',')} onChange={x => { const v = Number(x.target.value.replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v <= 10) mudar({ folgaMarcaMm: v }) }} className="w-10 rounded border border-gray-200 bg-transparent px-1 text-right" aria-label="Folga em mm" data-folga-marca /> mm</>}</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className={ck} checked={e.linhas} onChange={x => mudar({ linhas: x.target.checked })} data-linhas /> Linhas de corte</label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className={ck} checked={e.apliques} onChange={x => mudar({ apliques: x.target.checked })} data-apliques /> Folhas de aplique</label>
          <label className={`flex items-start gap-2 text-xs ${lote ? '' : 'opacity-50'}`} title={lote ? '' : 'Só ao juntar os pedidos (lote)'}><input type="checkbox" className={ck + ' mt-0.5'} disabled={!lote} checked={lote && e.aproveitar} onChange={x => mudar({ aproveitar: x.target.checked })} data-aproveitar-folhas />
            <span>Aproveitar folhas: completar folhas incompletas com outros pedidos (tags, etiquetas)</span></label>
        </fieldset>

        {comSoa && (
          <fieldset className="space-y-1">
            <legend className={sec}>Depois de gerar</legend>
            <label className={`flex items-center gap-2 text-xs ${nomeEtapa ? '' : 'opacity-50'}`} title={nomeEtapa ? '' : 'O fluxo de produção não tem etapa de Impressão'}>
              <input type="checkbox" className={ck} disabled={!nomeEtapa} checked={!!nomeEtapa && e.iniciarImpressao} onChange={x => mudar({ iniciarImpressao: x.target.checked })} data-iniciar-impressao /> Passar os pedidos para a etapa {nomeEtapa ?? 'Impressão'} no SOA</label>
          </fieldset>
        )}

        <div>
          <button className="flex items-center gap-1 text-xs text-gray-600" onClick={() => setAvancado(a => !a)} data-avancado-gerar>{avancado ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} Avançado</button>
          {avancado && (
            <div className="ml-5 mt-1 space-y-1 text-xs">
              <label className="flex items-center gap-2">Quantidade
                <select className="rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1 py-0.5" value={e.quantidade} onChange={x => mudar({ quantidade: x.target.value as 'pedido' })} data-saida-quantidade>
                  <option value="pedido">a do pedido</option><option value="um">1 de cada (para prova)</option>
                </select></label>
              {!lote && <label className="flex items-center gap-2"><input type="checkbox" className={ck} checked={e.folhaSeparada} onChange={x => mudar({ folhaSeparada: x.target.checked })} data-folha-separada /> Cada folha num arquivo separado (para gráfica/RIP)</label>}
              <label className="flex items-center gap-2" title="Tags e etiquetas: o arquivo de corte é o do gabarito (Base → Folhas do kit). Marque só se cortar sem marca de registro."><input type="checkbox" className={ck} checked={e.cortePorPedido} onChange={x => mudar({ cortePorPedido: x.target.checked })} data-corte-por-pedido /> Arquivo de corte por pedido</label>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-xs" data-resumo-gerar>
          <b>Vai gerar {plano.arquivos} arquivo{plano.arquivos === 1 ? '' : 's'}:</b>
          <ul className="mt-0.5 space-y-0.5">
            {plano.linhas.map(l => <li key={l.produto} data-linha-plano={l.produto}>{l.produto} · {l.pedidos} pedido{l.pedidos === 1 ? '' : 's'} · {l.pdfs} PDF{l.pdfs === 1 ? '' : 's'}{lote && l.pdfs > 1 ? ` (até ${e.maxPedidos} por PDF)` : ''}</li>)}
          </ul>
        </div>

        <div className="flex justify-end gap-2">
          <button className={btn} onClick={onFechar}>Cancelar</button>
          <button className={btn + ' bg-orange-500 text-white !border-orange-500'} disabled={indo || !itens.length} onClick={() => { setIndo(true); guardarEscolhas(e); onGerar(e) }} data-confirmar-gerar>
            {indo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Gerar
          </button>
        </div>
      </div>
    </div>
  )
}
