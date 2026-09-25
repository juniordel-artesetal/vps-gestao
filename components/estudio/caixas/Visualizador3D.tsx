'use client'
'use no memo'
// SOA Edition — VISUALIZADOR 3D da caixa montada (WebGL). Arrastar gira, roda do mouse aproxima, botão
// direito arrasta (pan); duplo clique ou "Resetar vista" volta ao 3/4. O three (e os controles/GLTF) é
// carregado sob demanda dentro do efeito → não entra no bundle das outras telas.
// Estado 3D mutável fica em refs (por isso 'use no memo').
import { useEffect, useRef, useState } from 'react'
import { Loader2, RotateCcw, RefreshCw } from 'lucide-react'
import type * as T from 'three'
import type { OrbitControls as TOrbit } from 'three/examples/jsm/controls/OrbitControls.js'
import type { FaceMolde, MoldeCaixaDef } from '@/lib/estudio/caixasTipos'
import type { Vista } from '@/lib/estudio/montada'
import { montarCena3D, aplicarArteGLB, recortarAoConteudo, type Cena3D, type FundoCena3D, type FaceUV } from '@/lib/estudio/caixa3d'

type Three = typeof import('three')

/** Ângulo livre (graus) para vistas fora dos presets (ex.: de baixo, para conferir o fundo). */
export type Angulo3D = { az: number; el: number }

export interface Api3D {
  /** Renderiza de um ângulo pronto (ou livre) num quadrado `lado`×`lado`. transparente = sem fundo e sem sombra, recortado ao objeto. */
  snapshot(vista: Vista | Angulo3D, lado: number, transparente?: boolean): HTMLCanvasElement
  /** Grava uma volta completa (webm). */
  gravar360(segundos: number): Promise<Blob>
  resetar(): void
}

export interface PropsVisualizador3D {
  montagem: MoldeCaixaDef['montagem'] | null
  faces: FaceMolde[]
  arte: HTMLCanvasElement | null
  AW: number
  AH: number
  corBase?: string
  laco?: { cor: string } | null
  pedra?: { cor: string } | null
  corAlca?: string | null
  fundo: FundoCena3D
  /** Modelo GLB próprio (malhas nomeadas pelo papel da face). */
  model3dUrl?: string | null
  faceUV?: FaceUV | null
  onPronto?: (api: Api3D) => void
  className?: string
}

const PRESETS: Record<Vista, Angulo3D> = {
  frente34: { az: 35, el: 22 }, frente: { az: 0, el: 12 }, lateral: { az: 72, el: 16 }, cima: { az: 28, el: 58 }, tras34: { az: 215, el: 22 },
}
const FOV = 30

interface Estado {
  THREE: Three
  renderer: T.WebGLRenderer
  scene: T.Scene
  camera: T.PerspectiveCamera
  controls: TOrbit
  cena: Cena3D | null
  glb: { raiz: T.Object3D; dispose(): void } | null
  centro: T.Vector3
  raio: number
  raf: number
  gravando: { inicio: number; dur: number; az0: number; el: number; dist: number; fim: () => void } | null
  ro: ResizeObserver
  vivo: boolean
  GLTFLoader: typeof import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader | null
}

export default function Visualizador3D(props: PropsVisualizador3D) {
  const { montagem, faces, arte, AW, AH, corBase, laco, pedra, corAlca, fundo, model3dUrl, faceUV, onPronto, className } = props
  const host = useRef<HTMLDivElement>(null)
  const est = useRef<Estado | null>(null)
  const avisouPronto = useRef(false)
  const onProntoRef = useRef(onPronto)
  onProntoRef.current = onPronto
  const [pronto, setPronto] = useState(false)
  const [girar, setGirar] = useState(false)
  const [erro, setErro] = useState('')
  const [montando, setMontando] = useState(false)

  // ── câmera ──
  function distancia(e: Estado, aspect = e.camera.aspect) {
    const v = (FOV * Math.PI) / 360
    const h = Math.atan(Math.tan(v) * Math.min(1, aspect))
    return (e.raio / Math.sin(Math.min(v, h))) * 1.08
  }
  function posicionar(e: Estado, a: Angulo3D, aspect = e.camera.aspect) {
    const az = (a.az * Math.PI) / 180, el = (a.el * Math.PI) / 180, D = distancia(e, aspect)
    e.camera.position.set(e.centro.x + D * Math.sin(az) * Math.cos(el), e.centro.y + D * Math.sin(el), e.centro.z + D * Math.cos(az) * Math.cos(el))
    e.camera.near = Math.max(0.01, D / 100); e.camera.far = D * 20
    e.camera.lookAt(e.centro)
    e.camera.updateProjectionMatrix()
  }
  function resetar() {
    const e = est.current; if (!e) return
    e.controls.target.copy(e.centro)
    posicionar(e, PRESETS.frente34)
    e.controls.update()
  }

  function snapshot(vista: Vista | Angulo3D, lado: number, transparente = false): HTMLCanvasElement {
    const e = est.current
    if (!e) throw new Error('O 3D ainda está carregando.')
    const { renderer, camera, scene, controls } = e
    const tamAnt = renderer.getSize(new e.THREE.Vector2()), prAnt = renderer.getPixelRatio()
    const posAnt = camera.position.clone(), alvoAnt = controls.target.clone(), aspAnt = camera.aspect, nearAnt = camera.near, farAnt = camera.far
    const bgAnt = scene.background
    const L = Math.max(64, Math.min(4096, Math.round(lado)))
    try {
      renderer.setPixelRatio(1)
      renderer.setSize(L, L, false)
      camera.aspect = 1
      posicionar(e, typeof vista === 'string' ? PRESETS[vista] : vista, 1)
      if (transparente) { scene.background = null; renderer.setClearColor(0x000000, 0); if (e.cena) e.cena.sombra.visible = false }
      renderer.render(scene, camera)
      const out = document.createElement('canvas'); out.width = L; out.height = L
      out.getContext('2d')!.drawImage(renderer.domElement, 0, 0, L, L)
      return transparente ? recortarAoConteudo(out) : out
    } finally {
      scene.background = bgAnt
      if (e.cena) e.cena.sombra.visible = true
      renderer.setPixelRatio(prAnt)
      renderer.setSize(tamAnt.x, tamAnt.y, false)
      camera.aspect = aspAnt; camera.near = nearAnt; camera.far = farAnt
      camera.position.copy(posAnt); controls.target.copy(alvoAnt); camera.lookAt(alvoAnt)
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
  }

  function gravar360(segundos: number): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const e = est.current
      if (!e) { reject(new Error('O 3D ainda está carregando.')); return }
      const cv = e.renderer.domElement as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }
      if (typeof MediaRecorder === 'undefined' || typeof cv.captureStream !== 'function') {
        reject(new Error('Este navegador não grava vídeo do 3D — use o Chrome ou o Edge no computador.')); return
      }
      if (e.gravando) { reject(new Error('Já estou gravando um vídeo.')); return }
      const tipo = ['video/webm;codecs=vp8', 'video/webm', 'video/webm;codecs=vp9'].find(t => MediaRecorder.isTypeSupported(t))
      if (!tipo) { reject(new Error('Este navegador não grava vídeo WebM — use o Chrome ou o Edge no computador.')); return }
      let rec: MediaRecorder
      const fluxo = cv.captureStream(30)
      const soltar = () => fluxo.getTracks().forEach(t => t.stop())
      try { rec = new MediaRecorder(fluxo, { mimeType: tipo, videoBitsPerSecond: 5_000_000 }) } catch (x) { soltar(); reject(new Error(`Não consegui gravar o vídeo: ${(x as Error).message}`)); return }
      const partes: Blob[] = []
      rec.ondataavailable = ev => { if (ev.data.size) partes.push(ev.data) }
      rec.onstop = () => {
        soltar()
        if (!partes.length) reject(new Error('O navegador não entregou o vídeo — tente de novo (ou use o Chrome/Edge no computador).'))
        else resolve(new Blob(partes, { type: 'video/webm' }))
      }
      rec.onerror = () => reject(new Error('A gravação do vídeo falhou.'))
      const off = e.camera.position.clone().sub(e.controls.target)
      const dist = off.length()
      e.controls.enabled = false
      e.gravando = {
        inicio: Infinity, dur: Math.max(1, segundos) * 1000, // o giro só começa quando o gravador de fato inicia
        az0: Math.atan2(off.x, off.z), el: Math.asin(Math.max(-1, Math.min(1, off.y / (dist || 1)))), dist,
        fim: () => { e.controls.enabled = true; e.gravando = null; if (rec.state !== 'inactive') { rec.requestData(); rec.stop() } },
      }
      rec.onstart = () => { if (e.gravando) e.gravando.inicio = performance.now() + 300 } // 300 ms parado: o codificador aquece
      rec.start(200)
    })
  }

  // ── inicialização (uma vez por montagem existente) ──
  const temMontagem = !!montagem
  useEffect(() => {
    const el = host.current
    if (!temMontagem || !el) return
    let cancelado = false
    let estLocal: Estado | null = null
    ;(async () => {
      try {
        const THREE = await import('three')
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
        if (cancelado) return
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.outputColorSpace = THREE.SRGBColorSpace
        const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight)
        renderer.setSize(w, h, false)
        const cv = renderer.domElement
        cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block'; cv.style.touchAction = 'none'
        el.appendChild(cv)
        const scene = new THREE.Scene()
        scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e0d8, 1.5))
        scene.add(new THREE.AmbientLight(0xffffff, 0.5))
        const sol = new THREE.DirectionalLight(0xffffff, 1.3); sol.position.set(-4.5, 8.5, 5.5); scene.add(sol)
        const reb = new THREE.DirectionalLight(0xffffff, 0.5); reb.position.set(5, 2, -4); scene.add(reb)
        const camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 1000)
        const controls = new OrbitControls(camera, cv)
        controls.enableDamping = true; controls.dampingFactor = 0.08; controls.autoRotateSpeed = 2.2
        const ro = new ResizeObserver(() => {
          const e = est.current; if (!e || e.gravando) return
          const W = Math.max(1, el.clientWidth), H = Math.max(1, el.clientHeight)
          e.renderer.setSize(W, H, false); e.camera.aspect = W / H; e.camera.updateProjectionMatrix()
        })
        ro.observe(el)
        const e: Estado = { THREE, renderer, scene, camera, controls, cena: null, glb: null, centro: new THREE.Vector3(0, 1, 0), raio: 2, raf: 0, gravando: null, ro, vivo: true, GLTFLoader: null }
        estLocal = e
        est.current = e
        cv.addEventListener('dblclick', resetar)
        const loop = () => {
          if (!e.vivo) return
          e.raf = requestAnimationFrame(loop)
          if (e.gravando) {
            const g = e.gravando, t = Math.max(0, (performance.now() - g.inicio) / g.dur)
            const az = g.az0 + 2 * Math.PI * Math.min(1, t), tg = e.controls.target
            e.camera.position.set(tg.x + g.dist * Math.sin(az) * Math.cos(g.el), tg.y + g.dist * Math.sin(g.el), tg.z + g.dist * Math.cos(az) * Math.cos(g.el))
            e.camera.lookAt(tg)
            e.renderer.render(e.scene, e.camera)
            if (t >= 1) g.fim()
            return
          }
          e.controls.update()
          e.renderer.render(e.scene, e.camera)
        }
        loop()
        setPronto(true)
      } catch (x) {
        if (!cancelado) setErro(`Não consegui abrir o 3D neste navegador (${(x as Error).message}).`)
      }
    })()
    return () => {
      cancelado = true
      const e = estLocal || est.current
      if (!e) return
      e.vivo = false
      cancelAnimationFrame(e.raf)
      e.gravando?.fim()
      e.ro.disconnect()
      e.renderer.domElement.removeEventListener('dblclick', resetar)
      e.controls.dispose()
      e.cena?.dispose()
      e.glb?.dispose()
      e.scene.traverse(o => {
        const m = o as T.Mesh
        if (m.geometry) m.geometry.dispose()
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
        for (const mt of mats) { for (const v of Object.values(mt)) if (v && (v as T.Texture).isTexture) (v as T.Texture).dispose(); mt.dispose() }
      })
      if (e.scene.background && (e.scene.background as T.Texture).isTexture) (e.scene.background as T.Texture).dispose()
      e.scene.clear()
      e.renderer.dispose()
      e.renderer.forceContextLoss()
      e.renderer.domElement.remove()
      est.current = null
      avisouPronto.current = false
      setPronto(false)
    }
  }, [temMontagem]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── (re)montar a caixa quando as props mudam ──
  const chaveFundo = fundo.tipo === 'cor' ? fundo.cor : fundo.canvas
  useEffect(() => {
    const e = est.current
    if (!pronto || !e || !montagem) return
    let cancelado = false
    ;(async () => {
      setMontando(true)
      try {
        const nova = montarCena3D(e.THREE, { montagem, faces, arte, AW, AH, corBase, laco, pedra, corAlca, fundo })
        let glb: Estado['glb'] = null
        if (model3dUrl) {
          try {
            if (!e.GLTFLoader) e.GLTFLoader = (await import('three/examples/jsm/loaders/GLTFLoader.js')).GLTFLoader
            const gltf = await new e.GLTFLoader().loadAsync(model3dUrl)
            const r = aplicarArteGLB(e.THREE, gltf.scene, { faces, arte, AW, AH, corBase, alturaCm: montagem.dims?.a || null, faceUV })
            glb = { raiz: gltf.scene, dispose: r.dispose }
          } catch (x) { console.error('[3D] GLB', x) }
        }
        if (cancelado || !est.current) { nova.dispose(); glb?.dispose(); return }
        // troca a caixa antiga pela nova
        if (e.cena) { e.scene.remove(e.cena.grupo); e.cena.dispose() }
        if (e.glb) { e.scene.remove(e.glb.raiz); e.glb.dispose() }
        e.cena = nova; e.glb = glb
        if (glb) {
          // GLB substitui as faces geradas (fica alça/laço/pedra/sombra)
          nova.grupo.children.filter(o => !['alca', 'laco', 'pedra', 'sombra'].includes(o.name)).forEach(o => (o.visible = false))
          e.scene.add(glb.raiz)
        }
        e.scene.add(nova.grupo)
        e.scene.background = nova.fundo
        const bb = glb ? new e.THREE.Box3().setFromObject(glb.raiz).union(nova.limites) : nova.limites
        const primeira = !avisouPronto.current
        e.centro = bb.getCenter(new e.THREE.Vector3())
        e.raio = Math.max(0.5, bb.getBoundingSphere(new e.THREE.Sphere()).radius)
        if (primeira) resetar()
        if (nova.avisos.length) console.info('[3D]', nova.avisos.join(' '))
        if (primeira) { avisouPronto.current = true; onProntoRef.current?.({ snapshot, gravar360, resetar }) }
      } catch (x) {
        setErro(`Não consegui montar a caixa em 3D (${(x as Error).message}).`)
      } finally { if (!cancelado) setMontando(false) }
    })()
    return () => { cancelado = true }
  }, [pronto, montagem, faces, arte, AW, AH, corBase, laco?.cor, pedra?.cor, corAlca, chaveFundo, model3dUrl, faceUV]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const e = est.current; if (e) e.controls.autoRotate = girar }, [girar, pronto])

  if (!montagem) {
    return <div className={`${className || ''} flex items-center justify-center rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-6 text-center text-sm text-gray-500`}>3D disponível para os tipos do acervo — este molde usa o mockup 2D.</div>
  }
  return (
    <div className={`relative ${className || ''}`}>
      <div ref={host} className="absolute inset-0 overflow-hidden rounded-2xl" />
      {(!pronto || montando) && !erro && <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>}
      {erro && <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-600">{erro}</div>}
      <div className="absolute left-2 bottom-2 flex gap-1.5">
        <button type="button" onClick={resetar} className="inline-flex items-center gap-1 rounded-lg bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 px-2 py-1 text-[11px] shadow-sm"><RotateCcw className="w-3.5 h-3.5" /> Resetar vista</button>
        <button type="button" onClick={() => setGirar(g => !g)} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] shadow-sm ${girar ? 'bg-orange-500 text-white border-orange-500' : 'bg-white/90 dark:bg-gray-900/90 border-gray-200 dark:border-gray-700'}`}><RefreshCw className="w-3.5 h-3.5" /> Girar sozinho</button>
      </div>
      <p className="absolute right-2 bottom-2 text-[10px] text-gray-400 bg-white/70 dark:bg-gray-900/70 rounded px-1.5 py-0.5 pointer-events-none">arraste: girar · roda: zoom · botão direito: mover</p>
    </div>
  )
}
