// SOA Edition — ARTE AUTOMÁTICA POR TEMA (só navegador). O pedido traz Tema + Nome + Idade; se o
// tema tem template pronto, a arte sai sem a artesã abrir o editor: carrega o template, liga as
// variáveis aos campos do pedido, reserva a cota, gera, baixa e anexa ao pedido (a produção imprime
// pelo fluxo que já existe). Mesmo renderizador do editor → a arte é idêntica à da prévia.
import { variaveisDo, type ConfigTemplate } from './tipos'
import { carregarMolde, gerarLote, enviarArquivo, exigirSaldo, Autorizador, type Formato } from './cliente'
import { nomesArquivos, LIMITE_LOTE, type PedidoFonte } from './dados'
import { linhasDoTema, type TemaPronto } from './tema'
import { FONTES_NATIVAS } from '@/components/estudio/fontesNativas'

export interface ResultadoAutomatico { arquivo: Blob; nome: string; itens: number; url: string | null }

export async function gerarArtesDoTema(p: {
  pedido: PedidoFonte
  tema: TemaPronto
  formato?: Formato
  workspaceId: string
  guardar: boolean
  aoProgredir?: (feitos: number, total: number) => void
}): Promise<ResultadoAutomatico> {
  const d = await fetch(`/api/estudio/templates/${p.tema.id}`).then(r => r.json())
  const t = d.template
  if ((typeof t?.config === 'string' ? JSON.parse(t.config) : t?.config)?.tipo === 'kit-caixas') return gerarKitDoPedido(p)
  if (!t?.moldeUrl) throw new Error(`O tema "${p.tema.temaNome}" está sem molde — abra o template no SOA Edition e confira.`)
  const cfg = t.config as ConfigTemplate
  for (const f of cfg.fontesUsuario || []) {
    if (!f.url) continue
    try { const ff = new FontFace(f.familia, `url(${f.url})`); await ff.load(); document.fonts.add(ff) } catch { /* segue com fallback */ }
  }
  const resolverFonte = (id: string) => {
    if (id.startsWith('u:')) { const u = cfg.fontesUsuario.find(f => `u:${f.id}` === id); return u ? `"${u.familia}"` : 'sans-serif' }
    return FONTES_NATIVAS.find(f => f.id === id)?.familia || 'sans-serif'
  }
  const molde = await carregarMolde(t.moldeUrl, t.moldeMime)
  const conf: ConfigTemplate = { ...cfg, largura: molde.largura, altura: molde.altura }

  const base = {
    Pedido: p.pedido.numero || '', pedido: p.pedido.numero || '', Cliente: p.pedido.destinatario || '',
    Produto: p.pedido.produto || '', 'Data de envio': p.pedido.dataEnvio || '',
  }
  const linhas = linhasDoTema(p.pedido.campos, base, variaveisDo(conf.caixas))
  if (linhas.length > LIMITE_LOTE) throw new Error(`Este pedido tem ${linhas.length} nomes — o máximo é ${LIMITE_LOTE} por vez. Gere pelo editor, em levas.`)

  const formato: Formato = p.formato || 'pdf-unico'
  const ext = formato === 'png' ? 'png' : formato === 'jpg' ? 'jpg' : 'pdf'
  await exigirSaldo(linhas.length)
  const aut = new Autorizador(linhas.length)
  {
    const r = await gerarLote({
      molde, cfg: conf, linhas, nomes: nomesArquivos('{pedido}_{nome}', linhas, ext), formato, resolverFonte,
      aoProgredir: (f, total) => p.aoProgredir?.(f, total), cancelado: () => false, autorizar: i => aut.garantir(i),
    })
    const nome = formato === 'pdf-unico'
      ? `${p.pedido.numero ? `Pedido ${p.pedido.numero} - ` : ''}${p.tema.temaNome}.pdf`.replace(/[\\/:*?"<>|]/g, '')
      : r.nome
    let url: string | null = null
    if (p.guardar) {
      try {
        url = (await enviarArquivo(r.arquivo, nome, 'gerado', p.workspaceId,
          { pasta: 'Artes geradas', pedidoId: p.pedido.id, meta: { itens: linhas.length, formato, tema: p.tema.temaNome, automatico: true }, lote: aut.lote })).url
      } catch { /* baixou mesmo assim; guardar é bônus */ }
    }
    await fetch('/api/estudio/jobs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lote: aut.lote, templateId: p.tema.id, origem: 'tema', totalItens: linhas.length, formato: r.nome.endsWith('.zip') ? 'zip' : formato, regraNome: '{pedido}_{nome}', status: 'concluido', zipUrl: url, pedidoId: p.pedido.id }),
    }).catch(() => {})
    return { arquivo: r.arquivo, nome, itens: linhas.length, url }
  }
}

/** Tema de KIT DE CAIXAS (Método Mãe): todas as caixas do kit + folha de apliques, anexadas ao pedido. */
async function gerarKitDoPedido(p: Parameters<typeof gerarArtesDoTema>[0]): Promise<ResultadoAutomatico> {
  const { abrirTemaCaixas, listarMoldes, carregarMoldeCaixa, gerarKitCaixas, custoKit } = await import('./caixasCliente')
  const { tema } = await abrirTemaCaixas(p.tema.id)
  const todos = await listarMoldes()
  const moldes = await Promise.all(tema.moldeIds.map(id => todos.find(m => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m).map(carregarMoldeCaixa))
  if (!moldes.length) throw new Error(`O tema "${p.tema.temaNome}" está sem caixas — abra o kit no SOA Edition e confira.`)
  const vars = variaveisDo(tema.elementos.filter(e => e.texto).map(e => ({ texto: e.texto!.modelo } as never)))
  const base = { Pedido: p.pedido.numero || '', pedido: p.pedido.numero || '', Cliente: p.pedido.destinatario || '' }
  const linhas = linhasDoTema(p.pedido.campos, base, vars.length ? vars : ['nome', 'idade'])
  if (linhas.length > LIMITE_LOTE) throw new Error(`Este pedido tem ${linhas.length} nomes — o máximo é ${LIMITE_LOTE} por vez.`)
  const total = custoKit(tema, moldes.length, linhas.length)
  await exigirSaldo(total)
  const aut = new Autorizador(total)
  const r = await gerarKitCaixas({
    tema, temaNome: p.tema.temaNome, moldes, linhas, formato: 'pdf-por-nome', pasta: '',
    autorizar: i => aut.garantir(i), aoProgredir: (f, t) => p.aoProgredir?.(f, t),
  })
  const nome = r.nome.endsWith('.zip') ? `${p.pedido.numero ? `Pedido ${p.pedido.numero} - ` : ''}${p.tema.temaNome}.zip`.replace(/[\\/:*?"<>|]/g, '') : r.nome
  let url: string | null = null
  if (p.guardar) {
    try {
      url = (await enviarArquivo(r.arquivo, nome, 'gerado', p.workspaceId,
        { pasta: 'Artes geradas', pedidoId: p.pedido.id, meta: { itens: linhas.length, formato: 'kit-caixas', tema: p.tema.temaNome, automatico: true }, lote: aut.lote })).url
    } catch { /* baixou mesmo assim; guardar é bônus */ }
  }
  await fetch('/api/estudio/jobs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lote: aut.lote, templateId: p.tema.id, origem: 'tema', totalItens: linhas.length, formato: r.nome.endsWith('.zip') ? 'zip' : 'pdf-individual', regraNome: tema.regraNome, status: 'concluido', zipUrl: url, pedidoId: p.pedido.id }),
  }).catch(() => {})
  return { arquivo: r.arquivo, nome, itens: linhas.length, url }
}
