import { marked } from 'marked'
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { highlightMarkdown } from '../terminal/highlight'
import type { VimDoc } from '../terminal/shell'
import { Vim, type VimEvent } from '../terminal/vim'
import './VimView.css'

type Props = { doc: VimDoc; onQuit: () => void; onWrite: (content: string) => void }

const NAMED_KEYS = new Set([
  'Escape', 'Enter', 'Backspace', 'Tab', 'Delete', 'Insert',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
])
const SCREEN_LINES = 40
const TOUCH_KEYS: [string, string][] = [
  ['esc', 'Escape'], ['i', 'i'], ['v', 'v'], ['u', 'u'], [':', ':'], ['/', '/'], [':wq!', ':wq!\n'], [':q!', ':q!\n'],
]

function keyName(e: KeyboardEvent): string | null {
  if (e.metaKey || e.altKey) return null
  if (e.ctrlKey) {
    if (e.key === '[' || e.key === 'c') return 'Escape'
    return e.key.length === 1 ? `C-${e.key.toLowerCase()}` : null
  }
  if (NAMED_KEYS.has(e.key)) return e.key
  return e.key.length === 1 ? e.key : null
}

function charClasses(text: string): (string | undefined)[][] {
  return highlightMarkdown(text).map((tokens) => tokens.flatMap((t) => Array.from(t.text, () => t.cls)))
}

function renderLine(
  text: string,
  classes: (string | undefined)[],
  sel: [number, number] | null,
  cursor: number | null,
  cursorKind: string,
): ReactNode[] {
  const width = Math.max(text.length, cursor !== null ? cursor + 1 : 0, sel ? sel[1] : 0)
  const out: ReactNode[] = []
  let run = ''
  let runCls = ''
  const flush = () => {
    if (run) out.push(<span key={out.length} className={runCls || undefined}>{run}</span>)
    run = ''
  }
  for (let i = 0; i < width; i++) {
    const cls = [
      classes[i],
      sel && i >= sel[0] && i < sel[1] ? 'sel' : '',
      i === cursor ? `cur ${cursorKind}` : '',
    ].filter(Boolean).join(' ')
    if (cls !== runCls) {
      flush()
      runCls = cls
    }
    run += text[i] ?? ' '
  }
  flush()
  return out
}

export function VimView({ doc, onQuit, onWrite }: Props) {
  const [vim] = useState(() => new Vim(doc.name, doc.content, !doc.isNew))
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const bufRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const touch = useMemo(() => matchMedia('(hover: none)').matches, [])

  const handle = (ev: VimEvent) => {
    if (ev.write !== undefined) onWrite(ev.write)
    if (ev.quit) onQuit()
  }
  const press = (keys: string) => {
    for (const k of keys === 'Escape' ? [keys] : Array.from(keys)) handle(vim.key(k === '\n' ? 'Enter' : k))
    redraw()
    inputRef.current?.focus({ preventScroll: true })
  }

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      const k = keyName(e)
      if (!k) return
      e.preventDefault()
      e.stopPropagation()
      handle(vim.key(k))
      redraw()
    }
    addEventListener('keydown', onKey, true)
    return () => removeEventListener('keydown', onKey, true)
    // handle closes over props that stay stable for the life of one open file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vim])

  useLayoutEffect(() => {
    bufRef.current?.querySelector('.cur')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  const text = vim.text
  const classes = useMemo(() => charClasses(text), [text])
  // Files come from the site's own bundled content or this visitor's own typing, so rendering them as HTML is safe.
  const preview = useMemo(() => marked.parse(text, { async: false }) as string, [text])

  const sel = vim.selection()
  const cursorKind = vim.mode === 'insert' ? 'bar' : 'block'
  const selRange = (r: number, len: number): [number, number] | null => {
    if (!sel || r < sel.from.r || r > sel.to.r) return null
    if (sel.linewise) return [0, Math.max(1, len)]
    return [r === sel.from.r ? sel.from.c : 0, r === sel.to.r ? sel.to.c + 1 : len + 1]
  }

  const modeLabel: Record<string, string> = { insert: '-- INSERT --', visual: '-- VISUAL --', vline: '-- VISUAL LINE --' }
  const cmdline =
    vim.mode === 'command' || vim.mode === 'search' ? (
      <span>
        {vim.mode === 'command' ? ':' : '/'}
        {vim.cmd}
        <span className="cur block"> </span>
      </span>
    ) : modeLabel[vim.mode] ? (
      <span className="mode">{modeLabel[vim.mode]}</span>
    ) : (
      <span className={vim.msgError ? 'err' : undefined}>{vim.msg}</span>
    )
  const total = vim.lines.length
  const pct = total <= SCREEN_LINES ? 'All' : vim.cur.r === 0 ? 'Top' : vim.cur.r === total - 1 ? 'Bot' : `${Math.round((vim.cur.r / (total - 1)) * 100)}%`

  return (
    <div className="vim" onPointerUp={() => inputRef.current?.focus({ preventScroll: true })}>
      <div className="vim-panes">
        <div className="vim-pane">
          <div className={`vim-buf${vim.numbers ? ' numbered' : ''}`} ref={bufRef}>
            {vim.lines.map((line, r) => (
              <div key={r} className="ln">
                <span className="t">
                  {renderLine(line, classes[r] ?? [], selRange(r, line.length), r === vim.cur.r ? vim.cur.c : null, cursorKind)}
                </span>
              </div>
            ))}
            {Array.from({ length: Math.max(0, SCREEN_LINES - total) }, (_, i) => (
              <div key={`~${i}`} className="ln tilde">
                <span className="t"> </span>
              </div>
            ))}
          </div>
          <div className="vim-status active">
            <span>
              {doc.path}
              {vim.modified ? ' [+]' : ''}
              {vim.readonly ? ' [RO]' : ''}
            </span>
            <span>markdown  utf-8</span>
          </div>
        </div>
        <div className="vim-pane preview">
          <article className="vim-doc" dangerouslySetInnerHTML={{ __html: preview }} />
          <div className="vim-status">
            <span>preview</span>
            <span>live</span>
          </div>
        </div>
      </div>
      <div className="vim-cmdline">
        {cmdline}
        <span className="ruler">
          <span className="showcmd">{vim.showcmd}</span>
          <span>
            {vim.cur.r + 1},{vim.cur.c + 1}
          </span>
          <span>{pct}</span>
        </span>
      </div>
      {touch && (
        <div className="vim-keys">
          {TOUCH_KEYS.map(([label, keys]) => (
            <button key={label} type="button" onPointerDown={(e) => e.preventDefault()} onClick={() => press(keys)}>
              {label}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={inputRef}
        className="vim-input"
        aria-label="vim input"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        onInput={(e) => {
          const el = e.currentTarget
          const typed = el.value
          el.value = ''
          if (typed) press(typed)
        }}
      />
    </div>
  )
}
