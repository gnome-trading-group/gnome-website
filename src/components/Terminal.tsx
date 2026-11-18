import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Shell, type VimDoc } from '../terminal/shell'
import './Terminal.css'
import { VimView } from './VimView'

type Entry = { id: number; kind: 'echo' | 'out' | 'dim'; prompt?: string; text: string }

type Props = { open: boolean; onOpen: () => void; onClose: () => void }

export function Terminal({ open, onOpen, onClose }: Props) {
  const [shell] = useState(() => new Shell())
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [prompt, setPrompt] = useState(() => shell.prompt())
  const [doc, setDoc] = useState<VimDoc | null>(null)
  const historyIdx = useRef(-1)
  const nextId = useRef(0)
  const outRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const push = (...items: Omit<Entry, 'id'>[]) =>
    setEntries((prev) => [...prev, ...items.map((e) => ({ ...e, id: nextId.current++ }))])

  useEffect(() => {
    if (!open || doc) return
    setEntries((prev) => (prev.length ? prev : [{ id: nextId.current++, kind: 'dim', text: shell.banner }]))
    inputRef.current?.focus({ preventScroll: true })
  }, [open, doc, shell])

  useEffect(() => {
    const out = outRef.current
    if (out) out.scrollTop = out.scrollHeight
  }, [entries, doc])

  useEffect(() => {
    if (doc) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName ?? '')
      if ((e.key === '~' || e.key === '`') && !typing) {
        e.preventDefault()
        onOpen()
        inputRef.current?.focus({ preventScroll: true })
      } else if (e.key === 'Escape') onClose()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [doc, onOpen, onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const line = input
    setInput('')
    historyIdx.current = -1
    push({ kind: 'echo', prompt: shell.prompt(), text: line })
    const r = shell.run(line)
    if (r.clear) setEntries([])
    else if (r.exit) onClose()
    else if (r.vim) setDoc(r.vim)
    else if (r.out) push({ kind: 'out', text: r.out })
    setPrompt(shell.prompt())
  }

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const history = shell.history
    if (e.key === 'Tab') {
      e.preventDefault()
      const c = shell.complete(input)
      if (c.options.length) {
        push({ kind: 'echo', prompt: shell.prompt(), text: input }, { kind: 'out', text: c.options.join('  ') })
      }
      setInput(c.line)
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault()
      historyIdx.current = historyIdx.current < 0 ? history.length - 1 : Math.max(0, historyIdx.current - 1)
      setInput(history[historyIdx.current])
    } else if (e.key === 'ArrowDown' && historyIdx.current >= 0) {
      e.preventDefault()
      historyIdx.current++
      if (historyIdx.current >= history.length) {
        historyIdx.current = -1
        setInput('')
      } else setInput(history[historyIdx.current])
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault()
      setEntries([])
    } else if (e.ctrlKey && e.key === 'c' && !getSelection()?.toString()) {
      e.preventDefault()
      push({ kind: 'echo', prompt: shell.prompt(), text: input + '^C' })
      setInput('')
    }
  }

  if (doc) {
    return (
      <VimView
        doc={doc}
        onWrite={(content) => shell.writeFile(doc.abs, content)}
        onQuit={() => setDoc(null)}
      />
    )
  }

  if (!open) return null

  return (
    <div
      id="term"
      role="dialog"
      aria-label="Terminal"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button') && !getSelection()?.toString()) {
          inputRef.current?.focus({ preventScroll: true })
        }
      }}
    >
      <header>
        <span>{prompt.replace(/\$$/, '')}</span>
        <button type="button" onClick={onClose}>
          esc ✕
        </button>
      </header>
      <div className="term-out" ref={outRef}>
        {entries.map((e) =>
          e.kind === 'echo' ? (
            <div key={e.id}>
              <span className="p">{e.prompt}</span> {e.text}
            </div>
          ) : (
            <div key={e.id} className={e.kind === 'dim' ? 'dim' : undefined}>
              {e.text}
            </div>
          ),
        )}
      </div>
      <form onSubmit={submit} autoComplete="off">
        <span className="p">{prompt}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onInputKey}
          aria-label="Command"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </form>
    </div>
  )
}
