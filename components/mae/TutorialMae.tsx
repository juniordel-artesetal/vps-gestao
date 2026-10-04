'use client'
// TUTORIAL DE PRIMEIRO USO do Método MAE (Sprint 12): abre sozinho na 1ª vez (guardado no navegador) e
// pelo botão "?" da barra. Curto: o caminho da base ao pedido, incluindo os campos TEMA, NOME e IDADE.
import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const CHAVE = 'mae:tutorial:v1'
const PASSOS: { titulo: string; texto: string }[] = [
  { titulo: 'Bem-vinda ao Método MAE', texto: 'Molde, Arrasta, Encaixa: você monta a base do kit UMA vez e cada tema novo se encaixa em todos os moldes. Tudo fica no seu computador, na pasta "Biblioteca MAE" — o SOA guarda só a receita.' },
  { titulo: '1. Conecte a Biblioteca', texto: 'Clique em "Escolher pasta" e crie uma pasta "Biblioteca MAE" (de preferência no OneDrive ou Google Drive). Papéis, elementos, fontes e exportações ficam lá.' },
  { titulo: '2. Monte a base (modo Base)', texto: 'Importe os moldes (PDF, SVG, DXF ou PNG), confira as faces, marque as partes (FRENTE, FUNDO, ALÇA…), as posições do NOME e a Identidade do Ateliê. Salve a base.' },
  { titulo: '3. Crie um tema (modo Tema)', texto: 'Arraste um papel para a parte e ele aparece em todas as faces dela. Elementos, nome estilizado, máscaras, apliques 3D… "Só nesta caixa" ajusta um molde específico.' },
  { titulo: '4. Exporte', texto: 'Arte pra aprovação (JPG leve, para o WhatsApp) e Arte pra impressão (PDF 300 dpi com sobra e marca de registro). Imprima sempre em TAMANHO REAL (100%).' },
  { titulo: '5. Ligue aos pedidos', texto: 'Em Configurações → Campos do pedido, crie os campos TEMA, NOME e IDADE. No card do pedido aparece "Gerar arte". Vincule produto ↔ tema para o SOA achar o tema sozinho.' },
  { titulo: '6. Edição em massa (add-on)', texto: 'Botão "Pedidos" na barra: todos os pedidos pendentes, agrupados por tema. Confira, desmarque o que não quiser e "Gerar todos" — 1 PDF por pedido e o card mostra "Arte gerada ✓".' },
]

export function useTutorial() {
  // a tela do MAE só existe no navegador (carregada sem SSR): dá para ler o localStorage já no início
  const [aberto, setAberto] = useState(() => { try { return !localStorage.getItem(CHAVE) } catch { return false } })
  return { aberto, abrir: () => setAberto(true), fechar: () => { setAberto(false); try { localStorage.setItem(CHAVE, '1') } catch { /* ok */ } } }
}

export default function TutorialMae({ onFechar }: { onFechar: () => void }) {
  const [i, setI] = useState(0)
  const p = PASSOS[i]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Tutorial do Método MAE" data-tutorial-mae>
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-5 shadow-xl space-y-3">
        <div className="flex items-start gap-2">
          <h2 className="flex-1 text-base font-semibold text-gray-900 dark:text-white">{p.titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar o tutorial" data-fechar-tutorial><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{p.texto}</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-400 tabular-nums">{i + 1} de {PASSOS.length}</span>
          <span className="flex-1" />
          <button className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs disabled:opacity-40" disabled={!i} onClick={() => setI(i - 1)}><ChevronLeft className="w-3.5 h-3.5" /> Voltar</button>
          {i < PASSOS.length - 1
            ? <button className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2 py-1 text-xs font-medium text-white" onClick={() => setI(i + 1)} data-proximo-tutorial>Próximo <ChevronRight className="w-3.5 h-3.5" /></button>
            : <button className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-medium text-white" onClick={onFechar} data-concluir-tutorial>Começar</button>}
        </div>
      </div>
    </div>
  )
}
