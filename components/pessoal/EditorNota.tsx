'use client'
// Editor rich text (Tiptap) das Notas pessoais — cara de Evernote.
// Salva HTML via onChange (o autosave/debounce fica no pai). Remontar por key={notaId} troca a nota.
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, List, ListOrdered, ListChecks,
  Quote, Code, Link as LinkIcon, Highlighter, Heading1, Heading2,
} from 'lucide-react'

function Btn({ on, active, disabled, title, children }: { on: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={on} disabled={disabled} title={title}
      className={`p-1.5 rounded-md text-sm transition ${active ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' : 'text-gray-500 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-800'} disabled:opacity-40`}>
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor }) {
  const link = () => {
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link (URL):', prev || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 dark:border-neutral-800 pb-2 mb-2 sticky top-0 bg-white dark:bg-neutral-900 z-10">
      <Btn on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título"><Heading1 className="w-4 h-4" /></Btn>
      <Btn on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Subtítulo"><Heading2 className="w-4 h-4" /></Btn>
      <span className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1" />
      <Btn on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrito"><Bold className="w-4 h-4" /></Btn>
      <Btn on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Itálico"><Italic className="w-4 h-4" /></Btn>
      <Btn on={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Riscado"><Strikethrough className="w-4 h-4" /></Btn>
      <Btn on={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Realce"><Highlighter className="w-4 h-4" /></Btn>
      <span className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1" />
      <Btn on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista"><List className="w-4 h-4" /></Btn>
      <Btn on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada"><ListOrdered className="w-4 h-4" /></Btn>
      <Btn on={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist"><ListChecks className="w-4 h-4" /></Btn>
      <span className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1" />
      <Btn on={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citação"><Quote className="w-4 h-4" /></Btn>
      <Btn on={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Código"><Code className="w-4 h-4" /></Btn>
      <Btn on={link} active={editor.isActive('link')} title="Link"><LinkIcon className="w-4 h-4" /></Btn>
    </div>
  )
}

export default function EditorNota({ initialHtml, onChange }: { initialHtml: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Comece a escrever…' }),
    ],
    content: initialHtml || '',
    editorProps: { attributes: { class: 'tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[50vh]' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  if (!editor) return <div className="text-sm text-gray-400 py-8">Carregando editor…</div>
  return (
    <div className="flex flex-col h-full">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  )
}
