export type Mode = 'normal' | 'insert' | 'visual' | 'vline' | 'command' | 'search'
export type Pos = { r: number; c: number }
export type VimEvent = { quit?: boolean; write?: string }

type Snapshot = { lines: string[]; cur: Pos }
type Register = { text: string; linewise: boolean }
type Motion = { pos: Pos; linewise?: boolean; inclusive?: boolean }

const OPERATORS = new Set(['d', 'y', 'c'])
const HALF_PAGE = 15
const INDENT = '    '
const HELP_MSG = 'modes: i a o (insert)  v V (visual)  : (command)  / (search).  try dd, yw, p, u, :%s/a/b/g, :w!, :q'

const charClass = (ch: string | undefined) => (ch === undefined || /\s/.test(ch) ? 0 : /\w/.test(ch) ? 1 : 2)
const before = (a: Pos, b: Pos) => a.r < b.r || (a.r === b.r && a.c <= b.c)
const ordered = (a: Pos, b: Pos): [Pos, Pos] => (before(a, b) ? [a, b] : [b, a])
const firstNonBlank = (line: string) => Math.max(0, line.search(/\S|$/))

export class Vim {
  lines: string[]
  cur: Pos = { r: 0, c: 0 }
  mode: Mode = 'normal'
  cmd = ''
  msg = ''
  msgError = false
  anchor: Pos = { r: 0, c: 0 }
  modified = false
  numbers = true
  readonly readonly: boolean
  readonly name: string

  private pending = ''
  private count = ''
  private reg: Register = { text: '', linewise: false }
  private undoStack: Snapshot[] = []
  private redoStack: Snapshot[] = []
  private lastSearch = ''
  private wantCol = 0
  private warnedReadonly = false

  constructor(name: string, content: string, readonly: boolean) {
    this.name = name
    this.lines = content.replace(/\n$/, '').split('\n')
    this.readonly = readonly
    this.msg = `"${name}" ${readonly ? '[readonly] ' : ''}${this.lines.length}L, ${new TextEncoder().encode(content).length}B`
  }

  get text(): string {
    return this.lines.join('\n') + '\n'
  }

  get showcmd(): string {
    return this.count + this.pending
  }

  selection(): { from: Pos; to: Pos; linewise: boolean } | null {
    if (this.mode !== 'visual' && this.mode !== 'vline') return null
    const [from, to] = ordered(this.anchor, this.cur)
    return { from, to, linewise: this.mode === 'vline' }
  }

  key(k: string): VimEvent {
    if (this.mode === 'insert') return this.insertKey(k)
    if (this.mode === 'command' || this.mode === 'search') return this.lineKey(k)
    return this.normalKey(k)
  }

  private line(r = this.cur.r): string {
    return this.lines[r]
  }

  private clamp(insert = this.mode === 'insert') {
    this.cur.r = Math.max(0, Math.min(this.lines.length - 1, this.cur.r))
    const len = this.line().length
    this.cur.c = Math.max(0, Math.min(insert ? len : Math.max(0, len - 1), this.cur.c))
  }

  private setMsg(text: string, error = false) {
    this.msg = text
    this.msgError = error
  }

  private save() {
    this.undoStack.push({ lines: [...this.lines], cur: { ...this.cur } })
    if (this.undoStack.length > 200) this.undoStack.shift()
    this.redoStack = []
    this.modified = true
    if (this.readonly && !this.warnedReadonly) {
      this.warnedReadonly = true
      this.setMsg('W10: Warning: Changing a readonly file', true)
    }
  }

  private restore(from: Snapshot[], to: Snapshot[], label: string) {
    const snap = from.pop()
    if (!snap) return this.setMsg(`Already at ${label === 'undo' ? 'oldest' : 'newest'} change`)
    to.push({ lines: [...this.lines], cur: { ...this.cur } })
    this.lines = snap.lines
    this.cur = snap.cur
    this.clamp(false)
    this.setMsg(`1 change; ${label}`)
  }

  private wordStart(p: Pos): Pos {
    let { r, c } = p
    let line = this.line(r)
    const k = charClass(line[c])
    if (k > 0) while (c < line.length && charClass(line[c]) === k) c++
    for (;;) {
      if (c >= line.length) {
        if (r >= this.lines.length - 1) return { r, c: line.length }
        r++
        c = 0
        line = this.line(r)
        if (!line.length) return { r, c: 0 }
        continue
      }
      if (charClass(line[c]) === 0) {
        c++
        continue
      }
      return { r, c }
    }
  }

  private wordEnd(p: Pos): Pos {
    let { r, c } = p
    let line = this.line(r)
    c++
    for (;;) {
      if (c >= line.length) {
        if (r >= this.lines.length - 1) return { r, c: Math.max(0, line.length - 1) }
        r++
        c = 0
        line = this.line(r)
        continue
      }
      if (charClass(line[c]) === 0) {
        c++
        continue
      }
      break
    }
    const k = charClass(line[c])
    while (c + 1 < line.length && charClass(line[c + 1]) === k) c++
    return { r, c }
  }

  private wordBack(p: Pos): Pos {
    let { r, c } = p
    let line = this.line(r)
    c--
    for (;;) {
      if (c < 0) {
        if (r === 0) return { r: 0, c: 0 }
        r--
        line = this.line(r)
        c = line.length - 1
        if (!line.length) return { r, c: 0 }
        continue
      }
      if (charClass(line[c]) === 0) {
        c--
        continue
      }
      break
    }
    const k = charClass(line[c])
    while (c > 0 && charClass(line[c - 1]) === k) c--
    return { r, c }
  }

  private motion(k: string, n: number): Motion | null {
    const { r, c } = this.cur
    const last = this.lines.length - 1
    switch (k) {
      case 'h':
      case 'ArrowLeft':
      case 'Backspace':
        return { pos: { r, c: Math.max(0, c - n) } }
      case 'l':
      case 'ArrowRight':
      case ' ':
        return { pos: { r, c: c + n } }
      case 'j':
      case 'ArrowDown':
        return { pos: { r: Math.min(last, r + n), c: this.wantCol }, linewise: true }
      case 'k':
      case 'ArrowUp':
        return { pos: { r: Math.max(0, r - n), c: this.wantCol }, linewise: true }
      case 'w': {
        let p = this.cur
        for (let i = 0; i < n; i++) p = this.wordStart(p)
        return { pos: p }
      }
      case 'e': {
        let p = this.cur
        for (let i = 0; i < n; i++) p = this.wordEnd(p)
        return { pos: p, inclusive: true }
      }
      case 'b': {
        let p = this.cur
        for (let i = 0; i < n; i++) p = this.wordBack(p)
        return { pos: p }
      }
      case '0':
      case 'Home':
        return { pos: { r, c: 0 } }
      case '^':
        return { pos: { r, c: firstNonBlank(this.line()) } }
      case '$':
      case 'End':
        return { pos: { r: Math.min(last, r + n - 1), c: Math.max(0, this.line(Math.min(last, r + n - 1)).length - 1) }, inclusive: true }
      case 'G': {
        const target = this.count ? Math.min(last, n - 1) : last
        return { pos: { r: target, c: firstNonBlank(this.line(target)) }, linewise: true }
      }
      case 'gg': {
        const target = this.count ? Math.min(last, n - 1) : 0
        return { pos: { r: target, c: firstNonBlank(this.line(target)) }, linewise: true }
      }
      case 'C-d':
        return { pos: { r: Math.min(last, r + HALF_PAGE), c }, linewise: true }
      case 'C-u':
        return { pos: { r: Math.max(0, r - HALF_PAGE), c }, linewise: true }
      default:
        return null
    }
  }

  private extract(a: Pos, end: Pos): string {
    if (a.r === end.r) return this.line(a.r).slice(a.c, end.c)
    return [this.line(a.r).slice(a.c), ...this.lines.slice(a.r + 1, end.r), this.line(end.r).slice(0, end.c)].join('\n')
  }

  private deleteChars(a: Pos, end: Pos, yankOnly = false) {
    this.reg = { text: this.extract(a, end), linewise: false }
    if (yankOnly) return
    this.lines[a.r] = this.line(a.r).slice(0, a.c) + this.line(end.r).slice(end.c)
    this.lines.splice(a.r + 1, end.r - a.r)
    this.cur = { ...a }
  }

  private deleteLines(r1: number, r2: number, yankOnly = false) {
    this.reg = { text: this.lines.slice(r1, r2 + 1).join('\n'), linewise: true }
    if (yankOnly) return
    this.lines.splice(r1, r2 - r1 + 1)
    if (!this.lines.length) this.lines = ['']
    this.cur.r = Math.min(r1, this.lines.length - 1)
    this.cur.c = firstNonBlank(this.line())
  }

  private applyOperator(op: string, from: Pos, to: Pos, linewise: boolean, inclusive: boolean) {
    const [a, b] = ordered(from, to)
    if (op !== 'y') this.save()
    if (linewise) {
      if (op === 'c') {
        this.reg = { text: this.lines.slice(a.r, b.r + 1).join('\n'), linewise: true }
        const indent = this.line(a.r).match(/^\s*/)![0]
        this.lines.splice(a.r, b.r - a.r + 1, indent)
        this.cur = { r: a.r, c: indent.length }
        this.mode = 'insert'
        return
      }
      this.deleteLines(a.r, b.r, op === 'y')
      if (op === 'y') {
        this.cur = { r: a.r, c: this.cur.c }
        this.setMsg(b.r > a.r ? `${b.r - a.r + 1} lines yanked` : '')
      }
      return
    }
    const end = inclusive ? { r: b.r, c: b.c + 1 } : b
    this.deleteChars(a, end, op === 'y')
    if (op === 'y') this.cur = { ...a }
    if (op === 'c') this.mode = 'insert'
  }

  private paste(after: boolean, n: number) {
    if (!this.reg.text) return
    this.save()
    if (this.reg.linewise) {
      const block = Array.from({ length: n }, () => this.reg.text.split('\n')).flat()
      const at = after ? this.cur.r + 1 : this.cur.r
      this.lines.splice(at, 0, ...block)
      this.cur = { r: at, c: firstNonBlank(this.line(at)) }
      return
    }
    const text = this.reg.text.repeat(n)
    const line = this.line()
    const at = after && line.length ? this.cur.c + 1 : this.cur.c
    const parts = text.split('\n')
    if (parts.length === 1) {
      this.lines[this.cur.r] = line.slice(0, at) + text + line.slice(at)
      this.cur.c = at + text.length - 1
      return
    }
    const tail = line.slice(at)
    this.lines.splice(this.cur.r, 1, line.slice(0, at) + parts[0], ...parts.slice(1, -1), parts[parts.length - 1] + tail)
    this.cur = { r: this.cur.r + 1, c: 0 }
  }

  private enterInsert(pos?: Pos) {
    this.setMsg('')
    this.save()
    if (pos) this.cur = pos
    this.mode = 'insert'
  }

  private openLine(below: boolean) {
    this.setMsg('')
    this.save()
    const indent = this.line().match(/^\s*/)![0]
    const at = below ? this.cur.r + 1 : this.cur.r
    this.lines.splice(at, 0, indent)
    this.cur = { r: at, c: indent.length }
    this.mode = 'insert'
  }

  private search(forward: boolean) {
    const needle = this.lastSearch
    if (!needle) return this.setMsg('E35: No previous regular expression', true)
    const total = this.lines.length
    for (let i = 0; i <= total; i++) {
      const r = (this.cur.r + (forward ? i : -i) + total * 2) % total
      const line = this.line(r)
      let c = -1
      if (forward) c = line.indexOf(needle, i === 0 ? this.cur.c + 1 : 0)
      else c = i === 0 ? line.lastIndexOf(needle, this.cur.c - 1) : line.lastIndexOf(needle)
      if (i === 0 && c < 0) continue
      if (c >= 0) {
        const wrapped = forward ? r < this.cur.r || (r === this.cur.r && c <= this.cur.c) : r > this.cur.r || (r === this.cur.r && c >= this.cur.c)
        this.cur = { r, c }
        this.setMsg(wrapped ? `search hit ${forward ? 'BOTTOM, continuing at TOP' : 'TOP, continuing at BOTTOM'}` : `${forward ? '/' : '?'}${needle}`, false)
        return
      }
    }
    this.setMsg(`E486: Pattern not found: ${needle}`, true)
  }

  private normalKey(k: string): VimEvent {
    const visual = this.mode === 'visual' || this.mode === 'vline'

    if (this.pending === 'r') {
      this.pending = ''
      if (k.length === 1 && this.line().length) {
        this.save()
        const l = this.line()
        this.lines[this.cur.r] = l.slice(0, this.cur.c) + k + l.slice(this.cur.c + 1)
      }
      this.count = ''
      return {}
    }
    if (this.pending === 'Z') {
      this.pending = ''
      if (k === 'Q') return { quit: true }
      if (k === 'Z') return this.exec(this.modified ? 'x' : 'q')
      return {}
    }

    if (k === 'Escape') {
      this.pending = ''
      this.count = ''
      if (visual) this.mode = 'normal'
      this.clamp(false)
      return {}
    }
    if (/^[1-9]$/.test(k) || (k === '0' && this.count)) {
      this.count += k
      return {}
    }
    const n = Math.max(1, parseInt(this.count || '1', 10))

    if (this.pending === 'g' || (k === 'g' && !OPERATORS.has(this.pending))) {
      if (this.pending !== 'g') {
        this.pending = 'g'
        return {}
      }
      this.pending = ''
      if (k === 'g') return this.move('gg', n)
      this.count = ''
      return {}
    }

    if (OPERATORS.has(this.pending)) {
      const op = this.pending
      if (k === op) {
        const r2 = Math.min(this.lines.length - 1, this.cur.r + n - 1)
        this.pending = ''
        this.count = ''
        this.applyOperator(op, { r: this.cur.r, c: 0 }, { r: r2, c: 0 }, true, false)
        if (op === 'y' && r2 === this.cur.r) this.setMsg('')
        return {}
      }
      const word = op === 'c' && k === 'w' && charClass(this.line()[this.cur.c]) !== 0 ? 'e' : k
      const m = this.motion(word, n)
      this.pending = ''
      this.count = ''
      if (!m) return {}
      let target = m.pos
      if (word === 'w' && target.r > this.cur.r) target = { r: this.cur.r, c: this.line().length }
      this.applyOperator(op, this.cur, target, !!m.linewise, !!m.inclusive)
      this.clamp()
      return {}
    }

    if (visual) return this.visualKey(k, n)

    const m = this.motion(k, n)
    if (m) return this.move(k, n)

    this.count = ''
    const line = this.line()
    switch (k) {
      case 'd':
      case 'y':
      case 'c':
        this.pending = k
        this.count = n > 1 ? String(n) : ''
        return {}
      case 'r':
      case 'Z':
        this.pending = k
        return {}
      case 'x':
      case 'Delete':
        if (!line.length) return {}
        this.save()
        this.deleteChars(this.cur, { r: this.cur.r, c: Math.min(line.length, this.cur.c + n) })
        this.clamp()
        return {}
      case 'X':
        if (!this.cur.c) return {}
        this.save()
        this.deleteChars({ r: this.cur.r, c: Math.max(0, this.cur.c - n) }, this.cur)
        return {}
      case 'D':
        this.save()
        this.deleteChars(this.cur, { r: this.cur.r, c: line.length })
        this.clamp()
        return {}
      case 'C':
        this.save()
        this.deleteChars(this.cur, { r: this.cur.r, c: line.length })
        this.mode = 'insert'
        return {}
      case 's':
        this.save()
        this.deleteChars(this.cur, { r: this.cur.r, c: Math.min(line.length, this.cur.c + n) })
        this.mode = 'insert'
        return {}
      case 'S':
        this.applyOperator('c', this.cur, this.cur, true, false)
        return {}
      case 'p':
      case 'P':
        this.paste(k === 'p', n)
        this.clamp()
        return {}
      case 'u':
        for (let i = 0; i < n; i++) this.restore(this.undoStack, this.redoStack, 'undo')
        return {}
      case 'C-r':
        for (let i = 0; i < n; i++) this.restore(this.redoStack, this.undoStack, 'redo')
        return {}
      case 'i':
      case 'Insert':
        this.enterInsert()
        return {}
      case 'a':
        this.enterInsert({ r: this.cur.r, c: Math.min(line.length, this.cur.c + 1) })
        return {}
      case 'I':
        this.enterInsert({ r: this.cur.r, c: firstNonBlank(line) })
        return {}
      case 'A':
        this.enterInsert({ r: this.cur.r, c: line.length })
        return {}
      case 'o':
      case 'O':
        this.openLine(k === 'o')
        return {}
      case 'J': {
        if (this.cur.r >= this.lines.length - 1) return {}
        this.save()
        const next = this.line(this.cur.r + 1).trimStart()
        this.cur.c = line.length
        this.lines[this.cur.r] = next ? `${line} ${next}` : line
        this.lines.splice(this.cur.r + 1, 1)
        return {}
      }
      case '~': {
        if (!line.length) return {}
        this.save()
        const end = Math.min(line.length, this.cur.c + n)
        const flipped = [...line.slice(this.cur.c, end)].map((ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase())).join('')
        this.lines[this.cur.r] = line.slice(0, this.cur.c) + flipped + line.slice(end)
        this.cur.c = end
        this.clamp()
        return {}
      }
      case 'v':
      case 'V':
        this.anchor = { ...this.cur }
        this.mode = k === 'v' ? 'visual' : 'vline'
        this.setMsg('')
        return {}
      case ':':
        this.mode = 'command'
        this.cmd = ''
        return {}
      case '/':
        this.mode = 'search'
        this.cmd = ''
        return {}
      case 'n':
      case 'N':
        this.search(k === 'n')
        return {}
      case 'Enter':
        return this.move('j', n)
      default:
        return {}
    }
  }

  private move(k: string, n: number): VimEvent {
    const m = this.motion(k, n)
    this.count = ''
    if (!m) return {}
    this.cur = { ...m.pos }
    this.clamp()
    if (!m.linewise || k === 'G' || k === 'gg') this.wantCol = this.cur.c
    return {}
  }

  private visualKey(k: string, n: number): VimEvent {
    const sel = this.selection()!
    switch (k) {
      case 'v':
      case 'V': {
        const next = k === 'v' ? 'visual' : 'vline'
        this.mode = this.mode === next ? 'normal' : next
        return {}
      }
      case 'o':
        ;[this.anchor, this.cur] = [this.cur, this.anchor]
        return {}
      case 'd':
      case 'x':
      case 'y':
      case 'c': {
        const op = k === 'x' ? 'd' : k
        this.mode = 'normal'
        this.applyOperator(op, sel.from, sel.to, sel.linewise, true)
        if (op === 'y') this.cur = { ...sel.from }
        this.clamp()
        return {}
      }
      case ':':
        this.mode = 'command'
        this.cmd = "'<,'>"
        return {}
      default:
        return this.move(k, n)
    }
  }

  private insertKey(k: string): VimEvent {
    const line = this.line()
    const { r, c } = this.cur
    switch (k) {
      case 'Escape':
        this.mode = 'normal'
        this.cur.c = Math.max(0, c - 1)
        this.clamp(false)
        return {}
      case 'Enter': {
        const indent = line.match(/^\s*/)![0].slice(0, c)
        this.lines.splice(r, 1, line.slice(0, c), indent + line.slice(c))
        this.cur = { r: r + 1, c: indent.length }
        return {}
      }
      case 'Backspace':
        if (c > 0) {
          this.lines[r] = line.slice(0, c - 1) + line.slice(c)
          this.cur.c--
        } else if (r > 0) {
          const prev = this.line(r - 1)
          this.lines.splice(r - 1, 2, prev + line)
          this.cur = { r: r - 1, c: prev.length }
        }
        return {}
      case 'Delete':
        if (c < line.length) this.lines[r] = line.slice(0, c) + line.slice(c + 1)
        else if (r < this.lines.length - 1) this.lines.splice(r, 2, line + this.line(r + 1))
        return {}
      case 'Tab':
        return this.insertText(INDENT)
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'Home':
      case 'End': {
        const m = this.motion(k, 1)!
        this.cur = { ...m.pos }
        if (k === 'End') this.cur.c = this.line().length
        this.clamp(true)
        return {}
      }
      default:
        return k.length === 1 ? this.insertText(k) : {}
    }
  }

  insertText(text: string): VimEvent {
    if (this.mode !== 'insert') {
      for (const ch of text) this.key(ch)
      return {}
    }
    const parts = text.split('\n')
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) this.insertKey('Enter')
      const line = this.line()
      this.lines[this.cur.r] = line.slice(0, this.cur.c) + parts[i] + line.slice(this.cur.c)
      this.cur.c += parts[i].length
    }
    this.modified = true
    return {}
  }

  private lineKey(k: string): VimEvent {
    const isSearch = this.mode === 'search'
    switch (k) {
      case 'Escape':
        this.mode = 'normal'
        this.cmd = ''
        return {}
      case 'Backspace':
        if (!this.cmd) this.mode = 'normal'
        this.cmd = this.cmd.slice(0, -1)
        return {}
      case 'Enter': {
        const line = this.cmd
        this.cmd = ''
        this.mode = 'normal'
        if (isSearch) {
          if (line) this.lastSearch = line
          this.search(true)
          return {}
        }
        return this.exec(line)
      }
      default:
        if (k.length === 1) this.cmd += k
        return {}
    }
  }

  private exec(input: string): VimEvent {
    const cmd = input.trim().replace(/^'<,'>/, '')
    this.setMsg('')
    if (!cmd) return {}
    if (/^\d+$/.test(cmd)) {
      this.cur = { r: Math.min(this.lines.length - 1, Math.max(0, +cmd - 1)), c: 0 }
      this.cur.c = firstNonBlank(this.line())
      return {}
    }
    if (cmd === '$') return this.exec(String(this.lines.length))
    const sub = cmd.match(/^(%)?s\/((?:\\.|[^/])*)\/((?:\\.|[^/])*)\/?([gi]*)$/)
    if (sub) return this.substitute(!!sub[1] || input.trim().startsWith("'<,'>"), sub[2], sub[3], sub[4])
    const writeBytes = () => `"${this.name}" ${this.lines.length}L, ${new TextEncoder().encode(this.text).length}B written`
    switch (cmd) {
      case 'q':
      case 'quit':
      case 'qa':
        if (this.modified) {
          this.setMsg('E37: No write since last change (add ! to override)', true)
          return {}
        }
        return { quit: true }
      case 'q!':
      case 'qa!':
      case 'cq':
        return { quit: true }
      case 'w':
      case 'write':
      case 'wq':
      case 'x':
        if (cmd === 'x' && !this.modified) return { quit: true }
        if (this.readonly) {
          this.setMsg("E45: 'readonly' option is set (add ! to override)", true)
          return {}
        }
        this.modified = false
        this.setMsg(writeBytes())
        return cmd === 'w' || cmd === 'write' ? { write: this.text } : { write: this.text, quit: true }
      case 'w!':
      case 'wq!':
      case 'x!':
        this.modified = false
        this.setMsg(writeBytes())
        return cmd === 'w!' ? { write: this.text } : { write: this.text, quit: true }
      case 'set nu':
      case 'set number':
        this.numbers = true
        return {}
      case 'set nonu':
      case 'set nonumber':
        this.numbers = false
        return {}
      case 'noh':
      case 'nohlsearch':
        return {}
      case 'h':
      case 'help':
        this.setMsg(HELP_MSG)
        return {}
      default:
        this.setMsg(`E492: Not an editor command: ${cmd}`, true)
        return {}
    }
  }

  private substitute(all: boolean, pattern: string, replacement: string, flags: string): VimEvent {
    let re: RegExp
    try {
      re = new RegExp(pattern, flags.includes('g') ? 'g' : '')
    } catch {
      this.setMsg(`E486: Pattern not found: ${pattern}`, true)
      return {}
    }
    const rows = all ? this.lines.map((_, i) => i) : [this.cur.r]
    let count = 0
    let changedLines = 0
    const next = [...this.lines]
    for (const r of rows) {
      const before = next[r]
      const after = before.replace(re, () => {
        count++
        return replacement.replace(/\\\//g, '/')
      })
      if (after !== before) {
        next[r] = after
        changedLines++
      }
    }
    if (!count) {
      this.setMsg(`E486: Pattern not found: ${pattern}`, true)
      return {}
    }
    this.save()
    this.lines = next
    if (count > 1) this.setMsg(`${count} substitutions on ${changedLines} line${changedLines > 1 ? 's' : ''}`)
    return {}
  }
}
