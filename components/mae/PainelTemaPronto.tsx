'use client'
'use no memo'
// TEMAS PRONTOS (Lote 2, item 26): a aluna já tem a arte pronta (PDF, uma caixa por página; ou PNG/JPG) na
// pasta Temas/ e quer só pôr NOME, IDADE e HASHTAG em massa. Três passos guiados:
//   1. escolher o arquivo (da pasta Temas/ ou do computador — fica guardado em Temas/);
//   2. dar nome a cada página (CAIXA MILK, TOPO…) e ao tema (= o que o campo TEMA do pedido vai procurar);
//   3. ajustar onde ficam NOME/IDADE/HASHTAG e o estilo do texto, e salvar.
// Por dentro é base + tema como qualquer outro: cada página vira prancheta + parte, e a página é o papel.
import { useEffect, useRef, useState } from 'react'
import { FileImage, FolderOpen, Upload, Check, Loader2, Type, Save, Move } from 'lucide-react'
import { useMaeDoc, useBiblioteca } from '@/lib/mae/editor/loja'
import { useMaeTema } from '@/lib/mae/editor/tema'
import { gravar, ler, listar, sha256 } from '@/lib/mae/biblioteca/arquivos'
import { montarTemaPronto, nomeDoArquivo, ehArquivoPronto, produtoDoCaminho, casarPaginas, temaProntoNaBase, paginasDoTemaAntigo, pecasDaBase, rotuloDaMedida, proporcaoDiferente, pecaComAMedida, temaProntoNasPecas, type PaginaPronta , adicionarPaginasNaBase, papelDasPaginasNovas, trocarArquivoNaBase, ordemDosArquivos, folhaParecida } from '@/lib/mae/temasProntos/montar'
import type { DocTema, DocTrabalho } from '@/lib/mae/schema'
import { useEditor } from './estado'
import { salvarBase, salvarTema, listarBases, listarTemas, renomearTemaNoDisco } from './arquivosMae'
import { Secao, useLado } from './Funcoes'
import { confirmarTroca } from './historicoGlobal'
import { mensagemDeErro } from '@/lib/mae/erros'
import { normalizarBusca } from '@/lib/mae/editor/buscaTemas'
import { dpiDaImagem } from '@/lib/mae/exportar/png'
import { colocarPapel } from '@/lib/mae/vinculo/tema'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const inp = 'w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs'
const DPI = 300
const PX_MM = DPI / 25.4
const VISTO = 'mae:tema-pronto:visto'
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, ' ').slice(0, 60) || 'tema'

// Lote 23 (item 267): `fonte` = o arquivo DESTA página (vários PNG, um por página); `folha` = a folha padrão parecida
interface PaginaEd { nome: string; wMm: number; hMm: number; mini: string; fonte?: string; folha?: { nome: string; wMm: number; hMm: number } | null }
const r1 = (v: number) => Math.round(v * 10) / 10
const tipoImg = (p: string): 'png' | 'jpg' => (/\.png$/i.test(p) ? 'png' : 'jpg')

export default function PainelTemaPronto() {
  return <Secao ids={['pronto']}><Conteudo /></Secao>
}

function Conteudo() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const base = useMaeDoc(s => s.hist.atual)
  const [arquivos, setArquivos] = useState<string[]>([])
  // Lote 13 (item 181): a lista de arquivos ganha a busca (a partir de 10) — mesma regra da busca de temas
  const [filtroArq, setFiltroArq] = useState('')
  const [arq, setArq] = useState<string | null>(null)
  const [nomeTema, setNomeTema] = useState('')
  const [produto, setProduto] = useState('')
  const [paginas, setPaginas] = useState<PaginaEd[] | null>(null)
  const [rodando, setRodando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [guia, setGuia] = useState(() => { try { return localStorage.getItem(VISTO) !== '1' } catch { return true } })
  const inpArq = useRef<HTMLInputElement>(null)
  // Lote 14 (item 194): numa BASE QUE JÁ EXISTE (cada página na prancheta de mesmo nome) × base nova; a marca do PDF
  const [bases, setBases] = useState<{ doc: DocTrabalho }[] | null>(null)
  const [destino, setDestino] = useState<string>('nova')
  const [semMarca, setSemMarca] = useState(false)
  const [migrar, setMigrar] = useState<{ base: string; msg: string | null; rodando: boolean } | null>(null)
  // Lote 23 (item 267): busca de base (mais de 8), arrastar para ordenar as páginas, adicionar/trocar página
  const [filtroBase, setFiltroBase] = useState('')
  const [arrastando, setArrastando] = useState<number | null>(null)
  const [msgPaginas, setMsgPaginas] = useState<string | null>(null)
  const inpAdd = useRef<HTMLInputElement>(null)
  const inpTroca = useRef<HTMLInputElement>(null)
  const [trocando, setTrocando] = useState<string | null>(null)
  useEffect(() => { if (raiz && liberada && (paginas || migrar) && !bases) void listarBases(raiz).then(l => {
    // a versão mais nova de cada base (Lote 16, item 205: inclusive as de PEÇAS SOB MEDIDA, recém-criadas)
    const porId = new Map<string, { doc: DocTrabalho }>()
    // Lote 23 (item 267): TODAS as bases — inclusive as criadas por um tema pronto (antes ficavam de fora)
    for (const b of l) if (b.doc.molds.length && (porId.get(b.doc.id)?.doc.version ?? 0) <= (b.doc.version ?? 0)) porId.set(b.doc.id, b)
    setBases([...porId.values()])
  }).catch(() => setBases([])) }, [raiz, liberada, paginas, migrar, bases])
  const baseDestino = destino !== 'nova' ? bases?.find(b => b.doc.id === destino)?.doc ?? null : null
  // Lote 16 (item 205): base de PEÇAS → uma arte por peça (não casa página × prancheta)
  const destinoPecas = baseDestino?.tipo === 'medida' ? pecasDaBase(baseDestino) : null
  // Lote 19 (item 240): a usuária diz qual caixa é cada página (seletor); base de uma caixa só liga sozinha
  const [escolhaPag, setEscolhaPag] = useState<Record<number, string | null>>({})
  const [ajustePag, setAjustePag] = useState<Record<number, 'esticar' | 'preencher' | 'caber'>>({})
  const casamento = baseDestino && paginas && !destinoPecas ? casarPaginas(paginas, baseDestino, escolhaPag) : null
  const [artesPeca, setArtesPeca] = useState<Record<string, { arq: string | null; pagina: number; aspect: number | null; ajuste: 'preencher' | 'caber' }>>({})
  const [ignorarSugestao, setIgnorarSugestao] = useState(false)
  const inpPeca = useRef<HTMLInputElement>(null)
  const [pecaSubindo, setPecaSubindo] = useState<string | null>(null)
  // "Nunca criar base nova quando já existe": a arte tem a medida de uma peça de uma base de peças → pergunta
  const sugestao = destino === 'nova' && paginas?.length && bases ? pecaComAMedida(bases.map(b => b.doc), paginas[0].wMm, paginas[0].hMm) : null
  // a página de cada peça: a de proporção mais parecida (a usuária troca)
  useEffect(() => {
    if (!destinoPecas || !paginas) return
    setArtesPeca(a => {
      const n = { ...a }
      for (const m of destinoPecas) if (!n[m.id]) {
        const md = (m as { medida?: { larguraMm: number; alturaMm: number } }).medida!, alvo = md.larguraMm / md.alturaMm
        const i = paginas.map((p, k) => [k, Math.abs(Math.log((p.wMm / p.hMm) / alvo))] as const).sort((x, y) => x[1] - y[1])[0]?.[0] ?? 0
        n[m.id] = { arq: null, pagina: i, aspect: paginas[i] ? paginas[i].wMm / paginas[i].hMm : null, ajuste: 'preencher' }
      }
      return n
    })
  }, [destino, paginas]) // eslint-disable-line react-hooks/exhaustive-deps
  const lado = useLado()
  const ehPronto = !!base.pronto && !!tema && tema.baseId === base.id

  async function recarregar() {
    if (!raiz) return
    // Lote 4 (item 44): Temas/<Produto>/<Tema>.pdf — uma subpasta por produto (e os soltos em Temas/)
    const out: string[] = []
    for (const e of await listar(raiz, 'Temas').catch(() => [])) {
      if (e.tipo === 'arquivo' && ehArquivoPronto(e.nome)) out.push(`Temas/${e.nome}`)
      else if (e.tipo === 'pasta' && e.nome !== 'paginas') for (const s of await listar(raiz, `Temas/${e.nome}`).catch(() => [])) if (s.tipo === 'arquivo' && ehArquivoPronto(s.nome)) out.push(`Temas/${e.nome}/${s.nome}`)
    }
    setArquivos(out.sort())
  }
  useEffect(() => { if (raiz && liberada) void recarregar() }, [raiz, liberada]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Lote 23 (item 267): vários PNG/JPG de uma vez — um por página, na ordem do nome do arquivo. */
  async function subirVarios(fs: File[]) {
    if (!raiz || !fs.length) return
    if (fs.length === 1) { await subir(fs[0]); return }
    if (fs.some(f => /\.pdf$/i.test(f.name))) { setErro('Para várias páginas de uma vez, use PNG ou JPG (um por página). PDF vai um de cada vez.'); return }
    if (fs.some(f => !ehArquivoPronto(f.name))) { setErro('Use PNG ou JPG.'); return }
    for (const f of fs) await gravar(raiz, `Temas/${f.name}`, f)
    await recarregar(); await escolherImagens(fs.map(f => `Temas/${f.name}`))
  }
  /** Uma imagem como página: tamanho REAL pelos dpi do arquivo (sem dpi: 300) e a folha padrão parecida. */
  async function paginaDaImagem(path: string): Promise<PaginaEd> {
    const f = await ler(raiz!, path)
    const dpi = dpiDaImagem(new Uint8Array(await f.arrayBuffer())) ?? DPI
    const bmp = await createImageBitmap(f)
    const wMm = r1(bmp.width / (dpi / 25.4)), hMm = r1(bmp.height / (dpi / 25.4))
    bmp.close()
    return { nome: nomeDoArquivo(path).toUpperCase().slice(0, 60), wMm, hMm, mini: URL.createObjectURL(f), fonte: path, folha: folhaParecida(wMm, hMm) }
  }
  async function escolherImagens(paths: string[]) {
    if (!raiz) return
    const ord = ordemDosArquivos(paths)
    setErro(null); setArq(ord[0]); setNomeTema(nomeDoArquivo(ord[0]).slice(0, 120)); setBases(null); setArtesPeca({}); setIgnorarSugestao(false); setProduto(produtoDoCaminho(ord[0])); setPaginas(null); setSalvo(false)
    try {
      const out: PaginaEd[] = []
      for (const [i, p] of ord.entries()) { setRodando(`Lendo a imagem ${i + 1} de ${ord.length}…`); out.push(await paginaDaImagem(p)) }
      setPaginas(out)
    } catch (e) { setErro(`Não consegui ler as imagens: ${mensagemDeErro(e)}`); setArq(null) } finally { setRodando(null) }
  }

  async function subir(f: File | undefined) {
    if (!f || !raiz) return
    if (!ehArquivoPronto(f.name)) { setErro('Use PDF, PNG ou JPG.'); return }
    await gravar(raiz, `Temas/${f.name}`, f)
    await recarregar(); await escolher(`Temas/${f.name}`)
  }

  /** Passo 1 → 2: lê as páginas (tamanho + miniatura) para dar nome a cada uma. */
  async function escolher(path: string) {
    if (!raiz) return
    setErro(null); setArq(path); setNomeTema(nomeDoArquivo(path).slice(0, 120)); setBases(null); setArtesPeca({}); setIgnorarSugestao(false); setProduto(produtoDoCaminho(path)); setPaginas(null); setSalvo(false); setRodando('Lendo o arquivo…')
    try {
      const f = await ler(raiz, path)
      if (/\.pdf$/i.test(path)) {
        const { paginasDoPdf, paginaPdfComoImagem } = await import('@/lib/mae/importacao/navegador')
        const bytes = new Uint8Array(await f.arrayBuffer())
        const tams = await paginasDoPdf(bytes)
        const out: PaginaEd[] = []
        for (const [i, t] of tams.entries()) {
          setRodando(`Lendo a página ${i + 1} de ${tams.length}…`)
          const m = await paginaPdfComoImagem(bytes, i + 1, 0.5)
          out.push({ nome: tams.length > 1 ? `CAIXA ${i + 1}` : nomeDoArquivo(path).toUpperCase().slice(0, 60), wMm: Math.round(t.larguraMm * 10) / 10, hMm: Math.round(t.alturaMm * 10) / 10, mini: URL.createObjectURL(m.blob) })
        }
        setPaginas(out)
      } else {
        // imagem: o tamanho REAL pelos dpi do arquivo (sem dpi, 300); dá para corrigir abaixo (Lote 23, item 267)
        setPaginas([await paginaDaImagem(path)])
      }
    } catch (e) { setErro(`Não consegui ler "${path.split('/').pop()}": ${mensagemDeErro(e)}`); setArq(null) } finally { setRodando(null) }
  }

  /** Passo 2 → 3: grava cada página como imagem em alta (o papel), monta base + tema e abre no editor. */
  async function criar() {
    if (!raiz || !arq || !paginas) return
    if (!(await confirmarTroca('tema', 'base'))) return
    setErro(null)
    try {
      const f = await ler(raiz, arq)
      const bytes = new Uint8Array(await f.arrayBuffer())
      const sha = await sha256(bytes)
      const pasta = `Temas/paginas/${produto.trim() ? `${slug(produto)} - ` : ''}${slug(nomeTema || nomeDoArquivo(arq))}`
      const ps: PaginaPronta[] = []
      if (/\.pdf$/i.test(arq)) {
        const { paginaPdfComoImagem } = await import('@/lib/mae/importacao/navegador')
        for (const [i, p] of paginas.entries()) {
          setRodando(`Preparando a página ${i + 1} de ${paginas.length} em alta resolução…`)
          const r = await paginaPdfComoImagem(bytes, i + 1, PX_MM)
          const path = `${pasta}/pagina-${i + 1}.jpg`
          await gravar(raiz, path, r.blob)
          ps.push({ nome: p.nome, wMm: p.wMm, hMm: p.hMm, imagem: { path, sha256: await sha256(r.blob), aspect: r.w / r.h, nome: p.nome } })
        }
      } else {
        // Lote 23 (item 267): cada página com o SEU arquivo (vários PNG), na ordem da lista
        for (const p of paginas) {
          const path = p.fonte ?? arq
          const shaP = path === arq ? sha : await sha256(new Uint8Array(await (await ler(raiz, path)).arrayBuffer()))
          ps.push({ nome: p.nome, wMm: p.wMm, hMm: p.hMm, imagem: { path, sha256: shaP, aspect: p.wMm / p.hMm, nome: p.nome }, fonte: { path, sha256: shaP, kind: tipoImg(path) } })
        }
      }
      setRodando('Montando o tema…')
      if (baseDestino && destinoPecas) {
        // Lote 16 (item 205): uma arte por peça — cada uma vai para todas as cópias da peça nas folhas
        const pecas: { moldeId: string; imagem: { path: string; sha256: string; aspect: number; nome?: string }; ajuste: 'preencher' | 'caber' }[] = []
        for (const m of destinoPecas) {
          const a = artesPeca[m.id]
          if (!a || a.pagina < 0) continue
          if (!a.arq) { const p = ps[a.pagina]; if (p) pecas.push({ moldeId: m.id, imagem: { ...p.imagem, aspect: p.imagem.aspect ?? p.wMm / p.hMm }, ajuste: a.ajuste }); continue }
          // arte de OUTRO arquivo (a tampa num PNG à parte): a 1ª página dele
          setRodando(`Preparando a arte de ${m.name}…`)
          const fo = await ler(raiz, a.arq)
          if (/\.pdf$/i.test(a.arq)) {
            const { paginaPdfComoImagem } = await import('@/lib/mae/importacao/navegador')
            const r = await paginaPdfComoImagem(new Uint8Array(await fo.arrayBuffer()), 1, PX_MM)
            const path = `${pasta}/peca-${slug(m.name).replace(/\s+/g, '-')}.jpg`
            await gravar(raiz, path, r.blob)
            pecas.push({ moldeId: m.id, imagem: { path, sha256: await sha256(r.blob), aspect: r.w / r.h }, ajuste: a.ajuste })
          } else {
            const bmp = await createImageBitmap(fo)
            pecas.push({ moldeId: m.id, imagem: { path: a.arq, sha256: await sha256(new Uint8Array(await fo.arrayBuffer())), aspect: bmp.width / bmp.height }, ajuste: a.ajuste })
            bmp.close()
          }
        }
        const t = temaProntoNasPecas({ nome: nomeTema, produto, base: baseDestino, semMarca, pecas })
        useMaeDoc.getState().carregar(baseDestino)
        useMaeTema.getState().carregar(t)
        await salvarTema(raiz, t)
        useEditor.getState().set({ face: null, camada: null, slot: null })
        setPaginas(null); setArq(null); setSalvo(false)
        return
      }
      if (baseDestino && casamento) {
        // Lote 14 (item 194): na base que já existe — nada de base nova; a base fica como está (produtos, quantidades)
        const t = temaProntoNaBase({ nome: nomeTema, produto, base: baseDestino, semMarca, paginas: casamento.pares.map(p => ({ artboardId: p.artboardId, imagem: ps[p.pagina].imagem, ajuste: ajustePag[p.pagina] })) })
        useMaeDoc.getState().carregar(baseDestino)
        useMaeTema.getState().carregar(t)
        await salvarTema(raiz, t)
        useEditor.getState().set({ face: null, camada: null, slot: null })
        setPaginas(null); setArq(null); setSalvo(false)
        return
      }
      const { base: b, tema: t } = montarTemaPronto({ nome: nomeTema, produto, arquivo: { path: arq, sha256: sha, kind: /\.pdf$/i.test(arq) ? 'pdf' : /\.png$/i.test(arq) ? 'png' : 'jpg' }, paginas: ps })
      if (semMarca) (t as DocTema & { semMarca?: boolean }).semMarca = true
      useMaeDoc.getState().carregar(b)
      useMaeTema.getState().carregar(t)
      await salvarBase(raiz, b); await salvarTema(raiz, t)
      useEditor.getState().set({ face: null, camada: null, slot: null })
      setPaginas(null); setArq(null); setSalvo(false)
    } catch (e) { setErro(mensagemDeErro(e)) } finally { setRodando(null) }
  }

  /** Lote 14 (item 194): migração — cada tema pronto com base própria vira um tema na base escolhida. */
  async function juntarProntos(baseId: string) {
    if (!raiz || !migrar) return
    const alvo = bases?.find(b => b.doc.id === baseId)?.doc
    if (!alvo) return
    if (!confirm(`Juntar os temas prontos na base "${alvo.name}"? Cada um ganha uma versão nesta base; o antigo fica arquivado (dá para voltar).`)) return
    setMigrar({ ...migrar, rodando: true, msg: null })
    const todasBases = await listarBases(raiz).catch(() => [])
    const linhas: string[] = []
    let feitos = 0
    for (const { doc: t } of await listarTemas(raiz).catch(() => [])) {
      const b = todasBases.filter(x => x.doc.id === t.baseId).sort((x, y) => y.doc.version - x.doc.version)[0]?.doc
      if (!b?.pronto || (t as DocTema & { arquivado?: boolean }).arquivado) continue
      const pgs = paginasDoTemaAntigo(b, t)
      const c = casarPaginas(pgs, alvo)
      if (!c.pares.length) { linhas.push(`⚠ ${t.name}: nenhuma página com o nome de uma caixa da base — ficou como está.`); continue }
      await renomearTemaNoDisco(raiz, t, `${t.name} (base própria)`).catch(() => null)
      const antigo = { ...t, name: `${t.name} (base própria)`, arquivado: true } as DocTema
      await salvarTema(raiz, antigo).catch(() => null)
      await salvarTema(raiz, temaProntoNaBase({ nome: t.name ?? 'Tema pronto', produto: t.produto, base: alvo, paginas: c.pares.map(p => ({ artboardId: p.artboardId, imagem: pgs[p.pagina].imagem })), semMarca: (t as DocTema & { semMarca?: boolean }).semMarca }))
      feitos++
      if (c.semPrancheta.length || c.tamanhoDiferente.length) linhas.push(`${t.name}: ${c.semPrancheta.length ? `${c.semPrancheta.length} página(s) sem caixa de mesmo nome` : ''}${c.tamanhoDiferente.length ? ` · ${c.tamanhoDiferente.length} de tamanho diferente` : ''}`)
    }
    setMigrar(m => m && { ...m, rodando: false, msg: `${feitos} tema(s) junto(s) na base "${alvo.name}".${linhas.length ? `\n${linhas.join('\n')}` : ''}` })
  }

  async function salvar() {
    if (!raiz || !tema) return
    await salvarBase(raiz, useMaeDoc.getState().hist.atual); await salvarTema(raiz, useMaeTema.getState().hist!.atual)
    setSalvo(true)
  }
  /** Lote 23 (item 267): arquivos → páginas prontas (PNG/JPG: uma cada, pelos dpi; PDF: todas as páginas em JPG 300 dpi). */
  async function paginasDosArquivos(fs: File[], pasta: string): Promise<PaginaPronta[]> {
    const out: PaginaPronta[] = []
    for (const f of [...fs].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))) {
      if (!ehArquivoPronto(f.name)) throw new Error(`"${f.name}": use PDF, PNG ou JPG.`)
      if (/\.pdf$/i.test(f.name)) {
        const { paginasDoPdf, paginaPdfComoImagem } = await import('@/lib/mae/importacao/navegador')
        const bytes = new Uint8Array(await f.arrayBuffer())
        const tams = await paginasDoPdf(bytes)
        for (const [k, t] of tams.entries()) {
          setRodando(`Preparando ${f.name} — página ${k + 1} de ${tams.length}…`)
          const r = await paginaPdfComoImagem(bytes, k + 1, PX_MM)
          const path = `${pasta}/${slug(nomeDoArquivo(f.name))}-${k + 1}.jpg`
          await gravar(raiz!, path, r.blob)
          const sh = await sha256(r.blob)
          const nome = tams.length > 1 ? `${nomeDoArquivo(f.name).toUpperCase()} ${k + 1}`.slice(0, 60) : nomeDoArquivo(f.name).toUpperCase().slice(0, 60)
          out.push({ nome, wMm: r1(t.larguraMm), hMm: r1(t.alturaMm), imagem: { path, sha256: sh, aspect: r.w / r.h, nome }, fonte: { path, sha256: sh, kind: 'jpg' } })
        }
      } else {
        const path = `${pasta}/${f.name}`
        await gravar(raiz!, path, f)
        const pg = await paginaDaImagem(path)
        let { wMm, hMm } = pg
        if (pg.folha && (Math.abs(wMm - pg.folha.wMm) > 1.5 || Math.abs(hMm - pg.folha.hMm) > 1.5)
            && confirm(`"${f.name}": pelos dpi do arquivo a página tem ${wMm} × ${hMm} mm, que não bate com a folha ${pg.folha.nome} (${pg.folha.wMm} × ${pg.folha.hMm} mm). Ajustar à folha?`)) { wMm = pg.folha.wMm; hMm = pg.folha.hMm }
        const sh = await sha256(new Uint8Array(await f.arrayBuffer()))
        out.push({ nome: pg.nome, wMm, hMm, imagem: { path, sha256: sh, aspect: wMm / hMm, nome: pg.nome }, fonte: { path, sha256: sh, kind: tipoImg(f.name) } })
      }
    }
    return out
  }
  /** "+ Adicionar página": pranchetas novas NA MESMA base (nunca base nova), com o papel de cada uma no tema. */
  async function adicionarPaginas(fs: File[]) {
    if (!raiz || !tema || !fs.length) return
    setErro(null); setMsgPaginas(null)
    try {
      const pasta = `Temas/paginas/${tema.produto ? `${slug(tema.produto)} - ` : ''}${slug(tema.name ?? 'tema')}`
      const novas = await paginasDosArquivos(fs, pasta)
      let partes: string[] = []
      useMaeDoc.getState().aplicar(`Adicionar ${novas.length} página(s)`, d => { partes = adicionarPaginasNaBase(d as DocTrabalho, novas) })
      useMaeTema.getState().aplicar('Papel das páginas novas', t => { papelDasPaginasNovas(t as DocTema, partes, novas) })
      setSalvo(false); setMsgPaginas(`${novas.length} página(s) adicionada(s) na mesma base — clique em Salvar.`)
    } catch (e) { setErro(mensagemDeErro(e)) } finally { setRodando(null) }
  }
  /** "Trocar arquivo" de uma página: o molde e o papel passam a ser o arquivo novo (a 1ª página, se for PDF). */
  async function trocarArquivo(artboardId: string, f: File) {
    if (!raiz || !tema) return
    setErro(null); setMsgPaginas(null)
    try {
      const pasta = `Temas/paginas/${tema.produto ? `${slug(tema.produto)} - ` : ''}${slug(tema.name ?? 'tema')}`
      const [p] = await paginasDosArquivos([f], pasta)
      if (!p) return
      let parte: string | null = null
      useMaeDoc.getState().aplicar('Trocar o arquivo da página', d => { parte = trocarArquivoNaBase(d as DocTrabalho, artboardId, p) })
      if (parte) useMaeTema.getState().aplicar('Trocar o papel da página', t => { colocarPapel(t as DocTema, parte!, p.imagem) })
      setSalvo(false); setMsgPaginas('Arquivo trocado — clique em Salvar.')
    } catch (e) { setErro(mensagemDeErro(e)) } finally { setRodando(null) }
  }
  const fecharGuia = () => { setGuia(false); try { localStorage.setItem(VISTO, '1') } catch { /* sem storage */ } }
  const irPara = (modo: 'base' | 'tema', funcao: string, passo?: number) => {
    try { localStorage.setItem(`mae:funcao:${modo}`, funcao) } catch { /* sem storage */ }
    useEditor.getState().set({ modo, funcao, ...(passo ? { passo, posicionar: null } : {}), face: null, camada: null })
  }

  const etapa = ehPronto ? 3 : paginas ? 2 : 1
  return (
    <section className="space-y-2" data-tema-pronto>
      {lado === 'tudo' && <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5"><FileImage className="w-4 h-4 text-orange-500" /> Tema pronto</h2>}
      {guia && (
        <div className="rounded-lg border border-orange-200 bg-orange-50/70 dark:bg-orange-950/30 p-2 text-[11px] text-gray-700 dark:text-gray-200 space-y-1" data-guia-pronto>
          <p className="font-semibold">Já tem a arte pronta? Ponha nome, idade e hashtag em massa:</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>Escolha o arquivo (PDF com uma caixa por página, ou PNG) — ele fica na pasta <b>Temas/</b>.</li>
            <li>Dê nome a cada página. O nome do tema é o que o campo <b>TEMA</b> do pedido procura.</li>
            <li>Ajuste onde ficam NOME, IDADE e HASHTAG e salve. Depois é só gerar em <b>Pedidos e edição em massa</b>.</li>
          </ol>
          <button className={btn} onClick={fecharGuia} data-fechar-guia-pronto>Entendi</button>
        </div>
      )}
      <ol className="flex gap-1 text-[10px]" data-etapa-pronto={etapa}>
        {['Arquivo', 'Páginas', 'Textos e salvar'].map((t, i) => (
          <li key={t} className={`flex-1 rounded px-1.5 py-0.5 text-center ${etapa === i + 1 ? 'bg-orange-500 text-white' : etapa > i + 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{i + 1}. {t}</li>
        ))}
      </ol>
      {!liberada && <p className="text-[11px] text-gray-500">Conecte a pasta Biblioteca MAE (painel da direita) para usar os temas prontos.</p>}
      {erro && <p className="text-xs text-red-600" data-erro-pronto>{erro}</p>}
      {rodando && <p className="text-xs text-gray-500 flex items-center gap-1" data-rodando-pronto><Loader2 className="w-3.5 h-3.5 animate-spin" /> {rodando}</p>}

      {etapa === 1 && liberada && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => inpArq.current?.click()} title="Escolher um PDF/PNG do computador — uma cópia fica em Temas/" data-subir-pronto><Upload className="w-3.5 h-3.5" /> Escolher arquivo…</button>
            <button className={btn} onClick={() => void recarregar()} title="Ler de novo a pasta Temas/" data-atualizar-prontos><FolderOpen className="w-3.5 h-3.5" /> Atualizar</button>
          </div>
          {/* Lote 23 (item 267): vários PNG de uma vez (um por página); PDF continua um de cada vez */}
          <input ref={inpArq} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => { void subirVarios(Array.from(e.target.files ?? [])); e.target.value = '' }} data-arquivo-pronto />
          <p className="text-[10px] text-gray-500">PNG: pode escolher <b>vários de uma vez</b> (um por página, na ordem do nome). PDF: um arquivo com todas as páginas.</p>
          {/* Lote 14 (item 194): MIGRAÇÃO — os temas prontos que ganharam base própria passam para a base escolhida (o antigo
              fica ARQUIVADO, com " (base própria)" no nome — dá para voltar) */}
          {!migrar ? <button className="text-[11px] underline text-gray-500" onClick={() => setMigrar({ base: '', msg: null, rodando: false })} data-abrir-migrar>Juntar os temas prontos antigos numa base…</button> : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1 text-[11px]" data-migrar-prontos>
              <p className="font-semibold">Juntar os temas prontos numa base</p>
              <select className={inp} value={migrar.base} onChange={e => setMigrar({ ...migrar, base: e.target.value })} data-base-migrar>
                <option value="">Escolha a base (ex.: kit caixas e sacolas)…</option>{(bases ?? []).map(b => <option key={b.doc.id} value={b.doc.id}>{b.doc.name}</option>)}
              </select>
              <div className="flex gap-1">
                <button className={btn} disabled={!migrar.base || migrar.rodando} onClick={() => void juntarProntos(migrar.base)} data-confirmar-migrar>{migrar.rodando ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Juntar</button>
                <button className={btn} onClick={() => setMigrar(null)}>Fechar</button>
              </div>
              {migrar.msg && <p className="whitespace-pre-line text-gray-600" data-msg-migrar>{migrar.msg}</p>}
            </div>
          )}
          {arquivos.length > 10 && <input value={filtroArq} onChange={e => setFiltroArq(e.target.value)} placeholder={`Buscar entre ${arquivos.length} arquivos…`} className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs" data-busca-prontos />}
          {arquivos.length ? (
            <ul className="space-y-0.5 max-h-40 overflow-y-auto" data-lista-prontos>
              {arquivos.filter(a => normalizarBusca(filtroArq).split(' ').filter(Boolean).every(p => normalizarBusca(a.split('/').pop() ?? a).includes(p))).map(a => <li key={a}><button className="text-xs underline text-left break-all" title="Usar este arquivo" onClick={() => void escolher(a)} data-arquivo-tema={a.split('/').pop()}>{produtoDoCaminho(a) ? <span className="text-gray-400 no-underline">{produtoDoCaminho(a)} / </span> : null}{a.split('/').pop()}</button></li>)}
            </ul>
          ) : <p className="text-[11px] text-gray-400">Nenhum PDF/PNG em Temas/ ainda.</p>}
        </div>
      )}

      {etapa === 2 && paginas && (
        <div className="space-y-2" data-paginas-pronto>
          <label className="block text-[11px] text-gray-500">Produto <span className="text-gray-400">(Kit Festa, Sacola P, Rótulo Nutella… — a arte certa é produto + tema)</span>
            <input value={produto} onChange={e => setProduto(e.target.value)} className={inp} placeholder="Ex.: Sacola P" data-produto-tema-pronto />
          </label>
          <label className="block text-[11px] text-gray-500">Nome do tema <span className="text-gray-400">(igual ao campo TEMA do pedido)</span>
            <input value={nomeTema} maxLength={120} onChange={e => setNomeTema(e.target.value)} className={inp} data-nome-tema-pronto />
          </label>
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1 text-[11px]" data-destino-pronto>
            <p className="font-semibold">Onde entra</p>
            {(bases?.length ?? 0) > 8 && <input value={filtroBase} onChange={e => setFiltroBase(e.target.value)} placeholder={`Buscar entre ${bases!.length} bases…`} className={inp} data-busca-base-pronto />}
            <select className={inp} value={destino} onChange={e => setDestino(e.target.value)} data-base-pronto>
              <option value="nova">Base nova (uma prancheta por página)</option>
              {(bases ?? []).filter(b => b.doc.id === destino || normalizarBusca(filtroBase).split(' ').filter(Boolean).every(p => normalizarBusca(b.doc.name ?? '').includes(p))).map(b => <option key={b.doc.id} value={b.doc.id}>Na base &ldquo;{b.doc.name}&rdquo; — {b.doc.tipo === 'medida' ? 'peças sob medida: uma arte por peça' : 'cada página na caixa de mesmo nome'}</option>)}
            </select>
            {/* Lote 16 (item 205): nunca cria base nova quando já existe uma base com peça desta medida — pergunta */}
            {sugestao && !ignorarSugestao && (
              <div className="rounded border border-amber-300 bg-amber-50 p-1.5 space-y-1" data-sugestao-base-pecas>
                <p className="text-amber-900">Esta arte tem a medida da peça <b>{sugestao.pecaNome}</b> da base <b>{sugestao.baseNome}</b> (peças sob medida). Usar essa base?</p>
                <div className="flex gap-1">
                  <button className={btn + ' !border-orange-500'} onClick={() => setDestino(sugestao.baseId)} data-usar-base-pecas>Usar essa base</button>
                  <button className={btn} onClick={() => setIgnorarSugestao(true)} data-criar-base-nova-mesmo>Criar base nova mesmo assim</button>
                </div>
              </div>
            )}
            {destinoPecas && (
              <div className="space-y-1" data-artes-pecas>
                <p className="text-gray-500">Uma arte por peça — vai para <b>todas as cópias</b> da peça nas folhas:</p>
                {destinoPecas.map(m => {
                  const a = artesPeca[m.id] ?? { arq: null, pagina: 0, aspect: null, ajuste: 'preencher' as const }
                  const mudar = (x: Partial<typeof a>) => setArtesPeca(s => ({ ...s, [m.id]: { ...a, ...x } }))
                  const difere = a.aspect ? proporcaoDiferente(m, a.aspect) : false
                  return (
                    <div key={m.id} className="rounded border border-gray-200 dark:border-gray-700 p-1 space-y-0.5" data-arte-peca={m.id}>
                      <p className="font-medium">Arte de {m.name} <span className="font-normal text-gray-400">({rotuloDaMedida(m)})</span></p>
                      <div className="flex flex-wrap items-center gap-1">
                        <select className={inp + ' !w-auto'} value={a.arq ? 'arq' : String(a.pagina)} onChange={e => {
                          const v = e.target.value
                          if (v === 'outro') { setPecaSubindo(m.id); inpPeca.current?.click(); return }
                          if (v === 'arq') return
                          const i = Number(v); mudar({ arq: null, pagina: i, aspect: i >= 0 && paginas[i] ? paginas[i].wMm / paginas[i].hMm : null })
                        }} data-pagina-peca>
                          {paginas.map((p, i) => <option key={i} value={i}>Página {i + 1}{paginas.length > 1 ? ` (${p.nome})` : ''}</option>)}
                          {a.arq && <option value="arq">{a.arq.split('/').pop()}</option>}
                          <option value="outro">Outro arquivo…</option>
                          <option value={-1}>Sem arte (fica o fundo da base)</option>
                        </select>
                      </div>
                      {difere && (
                        <p className="text-amber-700 flex flex-wrap items-center gap-1" data-aviso-proporcao>⚠ A arte tem outra proporção que a peça:
                          <select className={inp + ' !w-auto'} value={a.ajuste} onChange={e => mudar({ ajuste: e.target.value as 'preencher' | 'caber' })} data-ajuste-peca>
                            <option value="preencher">Preencher (corta a sobra)</option><option value="caber">Caber (sobra borda)</option>
                          </select>
                        </p>
                      )}
                    </div>
                  )
                })}
                <input ref={inpPeca} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" data-arquivo-peca onChange={async e => {
                  const f = e.target.files?.[0]; e.target.value = ''
                  const id = pecaSubindo; setPecaSubindo(null)
                  if (!f || !raiz || !id) return
                  if (!ehArquivoPronto(f.name)) { setErro('Use PDF, PNG ou JPG.'); return }
                  const path = `Temas/${f.name}`
                  await gravar(raiz, path, f)
                  let aspect: number | null = null
                  try {
                    if (/\.pdf$/i.test(f.name)) { const { paginasDoPdf } = await import('@/lib/mae/importacao/navegador'); const t = (await paginasDoPdf(new Uint8Array(await f.arrayBuffer())))[0]; aspect = t ? t.larguraMm / t.alturaMm : null }
                    else { const b = await createImageBitmap(f); aspect = b.width / b.height; b.close() }
                  } catch { /* sem proporção: sem aviso */ }
                  setArtesPeca(s => ({ ...s, [id]: { ...(s[id] ?? { pagina: 0, ajuste: 'preencher' }), arq: path, aspect } }))
                }} />
              </div>
            )}
            {casamento && (
              <div className="space-y-0.5" data-casamento-pronto>
                {/* Lote 19 (item 240): cada página com o seletor da caixa (já com a melhor sugestão: nome, caixa única ou tamanho) */}
                {paginas.map((pg, i) => {
                  const dif = casamento.tamanhoDiferente.find(t => t.pagina === i)
                  return (
                    <div key={i} className="rounded border border-gray-200 p-1 dark:border-gray-700" data-pagina-caixa={i}>
                      <label className="flex flex-wrap items-center gap-1">
                        <span className={casamento.daPagina[i] ? 'text-emerald-700' : 'text-amber-700'}>{casamento.daPagina[i] ? '✔' : '⚠'} Página {i + 1} (&ldquo;{pg.nome}&rdquo;) é a caixa:</span>
                        <select className="rounded border border-gray-200 bg-transparent px-1 text-[11px] dark:border-gray-700" value={casamento.daPagina[i] ?? ''} onChange={e => setEscolhaPag(x => ({ ...x, [i]: e.target.value || null }))} data-seletor-caixa={i}>
                          <option value="">(fica de fora)</option>
                          {casamento.caixas.map(c => <option key={c.artboardId} value={c.artboardId}>{c.nome} ({Math.round(c.wMm)} × {Math.round(c.hMm)} mm)</option>)}
                        </select>
                      </label>
                      {!casamento.daPagina[i] && <p className="text-[10px] text-amber-700" data-aviso-sem-prancheta>Diga qual caixa é esta página.</p>}
                      {dif && (
                        <p className="text-[10px] text-amber-700" data-aviso-tamanho>A página tem {dif.pagMm} mm e a caixa, {dif.abMm} mm:{' '}
                          {(['esticar', 'preencher', 'caber'] as const).map(a => <button key={a} className={`ml-1 rounded border px-1 ${(ajustePag[i] ?? 'esticar') === a ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}`} onClick={() => setAjustePag(x => ({ ...x, [i]: a }))} data-ajuste-pagina={a}>{a === 'esticar' ? 'ajustar (esticar)' : a}</button>)}
                        </p>
                      )}
                    </div>
                  )
                })}
                {casamento.semPagina.map(n => <p key={`p${n}`} className="text-amber-700" data-aviso-sem-pagina>⚠ A caixa {n} da base não tem página neste PDF.</p>)}
              </div>
            )}
            <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={semMarca} onChange={e => setSemMarca(e.target.checked)} data-pdf-com-marca /> Este PDF já tem marca de registro <span className="text-gray-400">(o MAE não põe a dele neste tema)</span></label>
          </div>
          <ul className="space-y-1.5 max-h-80 overflow-y-auto">
            {paginas.length > 1 && <li className="text-[10px] text-gray-500">Arraste as miniaturas para mudar a ordem das páginas.</li>}
            {paginas.map((p, i) => (
              <li key={`${i}:${p.mini}`} className={`flex gap-2 items-start rounded ${arrastando === i ? 'opacity-50' : ''}`} data-pagina-pronto={i + 1}
                draggable={paginas.length > 1} onDragStart={() => setArrastando(i)} onDragEnd={() => setArrastando(null)} onDragOver={e => { if (arrastando !== null) e.preventDefault() }}
                onDrop={e => { e.preventDefault(); if (arrastando === null || arrastando === i) return; const de = arrastando; setPaginas(ps => { const n = [...ps!]; const [x] = n.splice(de, 1); n.splice(i, 0, x); return n }); setArrastando(null) }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.mini} alt={`Página ${i + 1}`} className="w-14 h-auto rounded border border-gray-200 bg-white" />
                <div className="flex-1 space-y-0.5">
                  <input value={p.nome} onChange={e => setPaginas(ps => ps!.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} className={inp} title="Nome desta caixa (aparece nos arquivos por caixa)" data-nome-pagina />
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    <input key={`w${p.wMm}`} inputMode="decimal" defaultValue={String(p.wMm).replace('.', ',')} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) setPaginas(ps => ps!.map((x, j) => j === i ? { ...x, wMm: v } : x)) }} className="w-14 rounded border border-gray-200 px-1" aria-label="Largura em mm" /> ×
                    <input key={`h${p.hMm}`} inputMode="decimal" defaultValue={String(p.hMm).replace('.', ',')} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) setPaginas(ps => ps!.map((x, j) => j === i ? { ...x, hMm: v } : x)) }} className="w-14 rounded border border-gray-200 px-1" aria-label="Altura em mm" /> mm
                  </p>
                  {p.folha && (Math.abs(p.wMm - p.folha.wMm) > 1.5 || Math.abs(p.hMm - p.folha.hMm) > 1.5) && (
                    <p className="text-[10px] text-amber-700" data-aviso-folha-png>⚠ Pelos dpi do arquivo, a página tem {p.wMm} × {p.hMm} mm — não bate com a folha {p.folha.nome} ({p.folha.wMm} × {p.folha.hMm} mm).{' '}
                      <button className="underline font-semibold" onClick={() => setPaginas(ps => ps!.map((x, j) => (j === i ? { ...x, wMm: p.folha!.wMm, hMm: p.folha!.hMm } : x)))} data-ajustar-folha>Ajustar à folha</button>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-1">
            <button className={btn} onClick={() => { setPaginas(null); setArq(null) }}>← Voltar</button>
            <button className={`${btn} bg-orange-500 text-white !border-orange-500 hover:bg-orange-600`} disabled={!!rodando || !nomeTema.trim() || (!!casamento && !casamento.pares.length) || (!!sugestao && !ignorarSugestao) || (!!destinoPecas && !destinoPecas.some(m => (artesPeca[m.id]?.pagina ?? 0) >= 0 || artesPeca[m.id]?.arq))} onClick={criar} title={baseDestino ? 'Cada página entra na caixa de mesmo nome da base; os textos e os produtos são os da base' : 'Cada página vira uma prancheta; NOME, IDADE e HASHTAG entram na 1ª página para você ajustar'} data-criar-pronto><Check className="w-3.5 h-3.5" /> Criar tema pronto</button>
          </div>
        </div>
      )}

      {etapa === 3 && tema && (
        <div className="space-y-1.5" data-pronto-aberto>
          <p className="text-[11px] text-gray-600 dark:text-gray-300">Tema pronto <b>{tema.name}</b>{tema.produto ? <> · produto <b>{tema.produto}</b></> : null} · {base.artboards.length} página(s). O campo TEMA do pedido = <b>{tema.name}</b>.</p>
          <label className="block text-[11px] text-gray-500">Produto deste tema
            <input key={tema.id} defaultValue={tema.produto ?? ''} placeholder="Ex.: Kit Festa" className={inp}
              onBlur={e => { const v = e.target.value.trim(); if (v !== (tema.produto ?? '')) useMaeTema.getState().aplicar('Produto do tema', d => { if (v) d.produto = v; else delete d.produto }) }} data-produto-pronto-aberto />
          </label>
          <div className="flex flex-wrap gap-1">
            <button className={btn} onClick={() => irPara('base', 'passo-6', 6)} title="Arraste as caixas de NOME, IDADE e HASHTAG na folha; para pôr em outra página, escolha a variável e clique nela" data-pronto-posicao><Move className="w-3.5 h-3.5" /> Posição dos textos</button>
            <button className={btn} onClick={() => irPara('tema', 'texto')} title="Fonte, cor, contorno e sombra do nome, idade e hashtag" data-pronto-estilo><Type className="w-3.5 h-3.5" /> Estilo do texto</button>
            <button className={`${btn} bg-orange-500 text-white !border-orange-500 hover:bg-orange-600`} onClick={() => void salvar()} title="Grava a base e o tema na Biblioteca (e na nuvem)" data-salvar-pronto><Save className="w-3.5 h-3.5" /> Salvar</button>
          </div>
          {/* Lote 23 (item 267): completar o tema pronto — mais páginas na MESMA base e trocar o arquivo de uma página */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-1.5 space-y-1 text-[11px]" data-paginas-do-pronto>
            <p className="font-semibold">Páginas ({base.artboards.length})</p>
            <ul className="space-y-0.5">
              {base.artboards.map((ab, k) => (
                <li key={ab.id} className="flex items-center gap-1" data-pagina-do-pronto={k + 1}>
                  <span className="flex-1 truncate">{k + 1}. {ab.name ?? `Página ${k + 1}`} <span className="text-gray-400">({Math.round(ab.widthMm)} × {Math.round(ab.heightMm)} mm)</span></span>
                  <button className="underline text-gray-600" onClick={() => { setTrocando(ab.id); inpTroca.current?.click() }} data-trocar-arquivo-pagina>Trocar arquivo</button>
                </li>
              ))}
            </ul>
            <button className={btn} onClick={() => inpAdd.current?.click()} disabled={!!rodando} data-adicionar-pagina-pronto>+ Adicionar página</button>
            <span className="ml-1 text-[10px] text-gray-500">PNG/JPG (um ou vários) ou PDF — entram na mesma base.</span>
            {msgPaginas && <p className="text-[11px] text-emerald-700" data-msg-paginas-pronto>{msgPaginas}</p>}
            <input ref={inpAdd} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => { void adicionarPaginas(Array.from(e.target.files ?? [])); e.target.value = '' }} data-arquivo-adicionar-pagina />
            <input ref={inpTroca} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; const id = trocando; setTrocando(null); if (f && id) void trocarArquivo(id, f) }} data-arquivo-trocar-pagina />
          </div>
          {salvo && <p className="text-[11px] text-emerald-700" data-pronto-salvo>Salvo ✓ — gere em “Pedidos e edição em massa”.</p>}
          <button className="text-[11px] underline text-gray-500" onClick={async () => { if (!(await confirmarTroca('tema', 'base'))) return; useMaeTema.getState().carregar(null); setSalvo(false) }} data-novo-pronto>Cadastrar outro tema pronto</button>
        </div>
      )}
      {etapa !== 3 && tema && !rodando && !paginas && <p className="text-[10px] text-gray-400">O tema aberto agora não é um tema pronto. Escolha um arquivo acima para cadastrar um.</p>}
    </section>
  )
}
