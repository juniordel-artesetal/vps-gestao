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
import { montarTemaPronto, nomeDoArquivo, ehArquivoPronto, produtoDoCaminho, type PaginaPronta } from '@/lib/mae/temasProntos/montar'
import { useEditor } from './estado'
import { salvarBase, salvarTema } from './arquivosMae'
import { Secao, useLado } from './Funcoes'
import { confirmarTroca } from './historicoGlobal'

const btn = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium hover:border-orange-400 disabled:opacity-40'
const inp = 'w-full rounded border border-gray-200 dark:border-gray-700 bg-transparent px-1.5 py-1 text-xs'
const DPI = 300
const PX_MM = DPI / 25.4
const VISTO = 'mae:tema-pronto:visto'
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w -]+/g, '').trim().replace(/\s+/g, ' ').slice(0, 60) || 'tema'

interface PaginaEd { nome: string; wMm: number; hMm: number; mini: string }

export default function PainelTemaPronto() {
  return <Secao ids={['pronto']}><Conteudo /></Secao>
}

function Conteudo() {
  const raiz = useBiblioteca(s => s.raiz), liberada = useBiblioteca(s => s.liberada)
  const tema = useMaeTema(s => s.hist?.atual ?? null)
  const base = useMaeDoc(s => s.hist.atual)
  const [arquivos, setArquivos] = useState<string[]>([])
  const [arq, setArq] = useState<string | null>(null)
  const [nomeTema, setNomeTema] = useState('')
  const [produto, setProduto] = useState('')
  const [paginas, setPaginas] = useState<PaginaEd[] | null>(null)
  const [rodando, setRodando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [guia, setGuia] = useState(() => { try { return localStorage.getItem(VISTO) !== '1' } catch { return true } })
  const inpArq = useRef<HTMLInputElement>(null)
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

  async function subir(f: File | undefined) {
    if (!f || !raiz) return
    if (!ehArquivoPronto(f.name)) { setErro('Use PDF, PNG ou JPG.'); return }
    await gravar(raiz, `Temas/${f.name}`, f)
    await recarregar(); await escolher(`Temas/${f.name}`)
  }

  /** Passo 1 → 2: lê as páginas (tamanho + miniatura) para dar nome a cada uma. */
  async function escolher(path: string) {
    if (!raiz) return
    setErro(null); setArq(path); setNomeTema(nomeDoArquivo(path)); setProduto(produtoDoCaminho(path)); setPaginas(null); setSalvo(false); setRodando('Lendo o arquivo…')
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
          out.push({ nome: tams.length > 1 ? `CAIXA ${i + 1}` : nomeDoArquivo(path).toUpperCase(), wMm: Math.round(t.larguraMm * 10) / 10, hMm: Math.round(t.alturaMm * 10) / 10, mini: URL.createObjectURL(m.blob) })
        }
        setPaginas(out)
      } else {
        const bmp = await createImageBitmap(f)
        // imagem: 300 dpi (o tamanho em mm pode ser corrigido abaixo)
        setPaginas([{ nome: nomeDoArquivo(path).toUpperCase(), wMm: Math.round((bmp.width / PX_MM) * 10) / 10, hMm: Math.round((bmp.height / PX_MM) * 10) / 10, mini: URL.createObjectURL(f) }])
        bmp.close()
      }
    } catch (e) { setErro(`Não consegui ler "${path.split('/').pop()}": ${(e as Error).message}`); setArq(null) } finally { setRodando(null) }
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
        const p = paginas[0]
        ps.push({ nome: p.nome, wMm: p.wMm, hMm: p.hMm, imagem: { path: arq, sha256: sha, aspect: p.wMm / p.hMm, nome: p.nome } })
      }
      setRodando('Montando o tema…')
      const { base: b, tema: t } = montarTemaPronto({ nome: nomeTema, produto, arquivo: { path: arq, sha256: sha, kind: /\.pdf$/i.test(arq) ? 'pdf' : /\.png$/i.test(arq) ? 'png' : 'jpg' }, paginas: ps })
      useMaeDoc.getState().carregar(b)
      useMaeTema.getState().carregar(t)
      await salvarBase(raiz, b); await salvarTema(raiz, t)
      useEditor.getState().set({ face: null, camada: null, slot: null })
      setPaginas(null); setArq(null); setSalvo(false)
    } catch (e) { setErro((e as Error).message || 'Não consegui criar o tema.') } finally { setRodando(null) }
  }

  async function salvar() {
    if (!raiz || !tema) return
    await salvarBase(raiz, useMaeDoc.getState().hist.atual); await salvarTema(raiz, useMaeTema.getState().hist!.atual)
    setSalvo(true)
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
          <input ref={inpArq} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => { void subir(e.target.files?.[0]); e.target.value = '' }} data-arquivo-pronto />
          {arquivos.length ? (
            <ul className="space-y-0.5 max-h-40 overflow-y-auto" data-lista-prontos>
              {arquivos.map(a => <li key={a}><button className="text-xs underline text-left break-all" title="Usar este arquivo" onClick={() => void escolher(a)} data-arquivo-tema={a.split('/').pop()}>{produtoDoCaminho(a) ? <span className="text-gray-400 no-underline">{produtoDoCaminho(a)} / </span> : null}{a.split('/').pop()}</button></li>)}
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
            <input value={nomeTema} onChange={e => setNomeTema(e.target.value)} className={inp} data-nome-tema-pronto />
          </label>
          <ul className="space-y-1.5 max-h-80 overflow-y-auto">
            {paginas.map((p, i) => (
              <li key={i} className="flex gap-2 items-start" data-pagina-pronto={i + 1}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.mini} alt={`Página ${i + 1}`} className="w-14 h-auto rounded border border-gray-200 bg-white" />
                <div className="flex-1 space-y-0.5">
                  <input value={p.nome} onChange={e => setPaginas(ps => ps!.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} className={inp} title="Nome desta caixa (aparece nos arquivos por caixa)" data-nome-pagina />
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    <input inputMode="decimal" defaultValue={String(p.wMm).replace('.', ',')} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) setPaginas(ps => ps!.map((x, j) => j === i ? { ...x, wMm: v } : x)) }} className="w-14 rounded border border-gray-200 px-1" aria-label="Largura em mm" /> ×
                    <input inputMode="decimal" defaultValue={String(p.hMm).replace('.', ',')} onBlur={e => { const v = Number(e.target.value.replace(',', '.')); if (v > 0) setPaginas(ps => ps!.map((x, j) => j === i ? { ...x, hMm: v } : x)) }} className="w-14 rounded border border-gray-200 px-1" aria-label="Altura em mm" /> mm
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-1">
            <button className={btn} onClick={() => { setPaginas(null); setArq(null) }}>← Voltar</button>
            <button className={`${btn} bg-orange-500 text-white !border-orange-500 hover:bg-orange-600`} disabled={!!rodando || !nomeTema.trim()} onClick={criar} title="Cada página vira uma prancheta; NOME, IDADE e HASHTAG entram na 1ª página para você ajustar" data-criar-pronto><Check className="w-3.5 h-3.5" /> Criar tema pronto</button>
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
          {salvo && <p className="text-[11px] text-emerald-700" data-pronto-salvo>Salvo ✓ — gere em “Pedidos e edição em massa”.</p>}
          <button className="text-[11px] underline text-gray-500" onClick={() => { useMaeTema.getState().carregar(null); setSalvo(false) }} data-novo-pronto>Cadastrar outro tema pronto</button>
        </div>
      )}
      {etapa !== 3 && tema && !rodando && !paginas && <p className="text-[10px] text-gray-400">O tema aberto agora não é um tema pronto. Escolha um arquivo acima para cadastrar um.</p>}
    </section>
  )
}
