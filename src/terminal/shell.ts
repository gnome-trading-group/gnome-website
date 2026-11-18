import { buildRoot, HOME, type DirNode, type Node } from './fs'

export type VimDoc = { name: string; path: string; abs: string; content: string; isNew: boolean }
export type RunResult = { out?: string; clear?: boolean; exit?: boolean; vim?: VimDoc }
export type Completion = { line: string; options: string[] }

type Command = (args: string[]) => string | RunResult

const LISTED_DATE = 'Nov 18 09:12'

const GNOME = String.raw`
        /\
       /  \
      /____\
     /      \
    /________\
   (  ^    ^  )
    \  (o)   /
     \______/`

const HELP = [
  'navigation   ls [-a] [-l] [path]   cd [path]   pwd   tree [-a] [path]',
  'files        cat <file>   head [-n N] <file>   tail [-n N] <file>   grep <text> <file>',
  '             vim <file>   (opens a viewer; :q to close)',
  'other        whoami  date  echo  history  contact  clear  exit',
  '',
  'tab completes. ↑/↓ walk history. some things here are hidden.',
].join('\n')

const byteLength = (s: string) => new TextEncoder().encode(s).length

export class Shell {
  readonly banner = "gnome-os 1.0 · type 'help'"
  readonly history: string[] = []
  private readonly root: DirNode = buildRoot()
  private cwd = HOME
  private prev = HOME
  private readonly commands: Record<string, Command>

  constructor() {
    const viewer: Command = (a) => this.vim(a)
    const readOnly = (name: string): Command => () => `${name}: read-only file system`
    const notVim: Command = () => 'this is a vim household. try: vim <file>'
    this.commands = {
      help: () => HELP,
      ls: (a) => this.ls(a),
      ll: (a) => this.ls(['-la', ...a]),
      cd: (a) => this.cd(a),
      pwd: () => this.cwd,
      cat: (a) => this.cat(a),
      head: (a) => this.slice('head', a, (lines, n) => lines.slice(0, n)),
      tail: (a) => this.slice('tail', a, (lines, n) => lines.slice(-n)),
      grep: (a) => this.grep(a),
      tree: (a) => this.tree(a),
      vim: viewer,
      vi: viewer,
      nvim: viewer,
      view: viewer,
      less: viewer,
      more: viewer,
      echo: (a) => a.join(' '),
      whoami: () => 'guest',
      hostname: () => 'gnome',
      uname: (a) => (a.includes('-a') ? 'gnome-os 1.0.0 gnome x86_64 GNU/Gnome' : 'gnome-os'),
      date: () => new Date().toString(),
      history: () => this.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`).join('\n'),
      contact: () => 'contact@gnometrading.group',
      sudo: () => 'guest is not in the sudoers file. This incident will be reported to the head gnome.',
      rm: () => 'rm: permission denied. gnomes keep everything.',
      mkdir: readOnly('mkdir'),
      touch: readOnly('touch'),
      mv: readOnly('mv'),
      cp: readOnly('cp'),
      nano: notVim,
      emacs: notVim,
      man: (a) => (a[0] ? `no manual entry for ${a[0]}. try 'help'.` : 'what manual page do you want?'),
      gnome: () => GNOME,
    }
  }

  writeFile(abs: string, content: string): boolean {
    const slash = abs.lastIndexOf('/')
    const parent = this.get(abs.slice(0, slash) || '/')
    if (!parent || parent.type !== 'dir') return false
    parent.children[abs.slice(slash + 1)] = { type: 'file', content }
    return true
  }

  prompt(): string {
    return `guest@gnome:${this.pretty(this.cwd)}$`
  }

  run(line: string): RunResult {
    const raw = line.trim()
    if (!raw) return {}
    this.history.push(raw)
    if (/[|>]/.test(raw)) return { out: "gsh: pipes and redirects aren't supported here" }
    const [name, ...args] = this.parse(raw)
    if (name === 'clear') return { clear: true }
    if (name === 'exit' || name === 'logout') return { exit: true }
    const command = this.commands[name]
    if (!command) return { out: `gsh: command not found: ${name}` }
    const result = command(args)
    return typeof result === 'string' ? { out: result } : result
  }

  complete(line: string): Completion {
    const [, head, word] = line.match(/^(.*?)(\S*)$/)!
    if (!head.trim()) {
      const names = Object.keys(this.commands).filter((c) => c.startsWith(word)).sort()
      return this.finish(head, '', word, names.map((name) => ({ name, dir: false })))
    }
    const slash = word.lastIndexOf('/')
    const dirPart = slash >= 0 ? word.slice(0, slash + 1) : ''
    const stem = slash >= 0 ? word.slice(slash + 1) : word
    const node = this.get(this.resolve(dirPart || '.'))
    if (!node || node.type !== 'dir') return { line, options: [] }
    const matches = Object.keys(node.children)
      .filter((n) => n.startsWith(stem) && (stem.startsWith('.') || !n.startsWith('.')))
      .sort()
      .map((name) => ({ name, dir: node.children[name].type === 'dir' }))
    return this.finish(head, dirPart, stem, matches)
  }

  private finish(head: string, dirPart: string, stem: string, matches: { name: string; dir: boolean }[]): Completion {
    if (!matches.length) return { line: head + dirPart + stem, options: [] }
    if (matches.length === 1) {
      const only = matches[0]
      return { line: head + dirPart + only.name + (only.dir ? '/' : ' '), options: [] }
    }
    let prefix = matches[0].name
    for (const m of matches) while (!m.name.startsWith(prefix)) prefix = prefix.slice(0, -1)
    return { line: head + dirPart + prefix, options: matches.map((m) => m.name + (m.dir ? '/' : '')) }
  }

  private env(): Record<string, string> {
    return { HOME, USER: 'guest', PWD: this.cwd, SHELL: '/bin/gsh', HAT: 'pointy' }
  }

  private parse(line: string): string[] {
    const env = this.env()
    return (line.match(/"[^"]*"|'[^']*'|\S+/g) ?? [])
      .map((t) => t.replace(/^(["'])(.*)\1$/, '$2'))
      .map((t) => t.replace(/\$(\w+)/g, (_, k: string) => env[k] ?? ''))
  }

  private flags(args: string[]): { flags: Set<string>; rest: string[] } {
    const flags = new Set<string>()
    const rest: string[] = []
    for (const a of args) {
      if (/^-[a-zA-Z]+$/.test(a)) for (const c of a.slice(1)) flags.add(c)
      else rest.push(a)
    }
    return { flags, rest }
  }

  private resolve(path: string | undefined): string {
    if (path === undefined || path === '' || path === '~') return HOME
    const expanded = path.startsWith('~/') ? HOME + path.slice(1) : path
    const parts = (expanded.startsWith('/') ? expanded : `${this.cwd}/${expanded}`).split('/')
    const out: string[] = []
    for (const p of parts) {
      if (!p || p === '.') continue
      if (p === '..') out.pop()
      else out.push(p)
    }
    return '/' + out.join('/')
  }

  private get(abs: string): Node | null {
    let node: Node = this.root
    for (const part of abs.split('/').filter(Boolean)) {
      if (node.type !== 'dir' || !node.children[part]) return null
      node = node.children[part]
    }
    return node
  }

  private pretty(abs: string): string {
    if (abs === HOME) return '~'
    return abs.startsWith(HOME + '/') ? '~' + abs.slice(HOME.length) : abs
  }

  private readFile(cmd: string, target: string | undefined): string | { content: string } {
    if (!target) return `usage: ${cmd} <file>`
    const node = this.get(this.resolve(target))
    if (!node) return `${cmd}: ${target}: No such file or directory`
    if (node.type === 'dir') return `${cmd}: ${target}: Is a directory`
    return { content: node.content }
  }

  private entries(node: DirNode, all: boolean): string[] {
    const names = Object.keys(node.children)
      .filter((n) => all || !n.startsWith('.'))
      .sort((a, b) => a.replace(/^\./, '').localeCompare(b.replace(/^\./, '')))
    return all ? ['.', '..', ...names] : names
  }

  private longRow(name: string, node: Node): string {
    const isDir = node.type === 'dir'
    const size = isDir ? 4096 : byteLength(node.content)
    const suffix = isDir && name !== '.' && name !== '..' ? '/' : ''
    return `${isDir ? 'drwxr-xr-x' : '-rw-r--r--'}  guest  gnome  ${String(size).padStart(5)}  ${LISTED_DATE}  ${name}${suffix}`
  }

  private ls(args: string[]): string {
    const { flags, rest } = this.flags(args)
    const all = flags.has('a') || flags.has('A')
    const long = flags.has('l')
    const targets = rest.length ? rest : ['.']
    return targets
      .map((t) => {
        const abs = this.resolve(t)
        const node = this.get(abs)
        if (!node) return `ls: cannot access '${t}': No such file or directory`
        if (node.type === 'file') return long ? this.longRow(t, node) : t
        const names = this.entries(node, all)
        const child = (n: string): Node =>
          n === '.' ? node : n === '..' ? this.get(this.resolve(abs + '/..'))! : node.children[n]
        const body = long
          ? [`total ${names.length * 4}`, ...names.map((n) => this.longRow(n, child(n)))].join('\n')
          : names.map((n) => (n !== '.' && n !== '..' && child(n).type === 'dir' ? n + '/' : n)).join('  ')
        return targets.length > 1 ? `${t}:\n${body}` : body
      })
      .join('\n\n')
  }

  private cd(args: string[]): string {
    const back = args[0] === '-'
    const abs = this.resolve(back ? this.prev : args[0])
    const node = this.get(abs)
    if (!node) return `cd: no such file or directory: ${args[0]}`
    if (node.type !== 'dir') return `cd: not a directory: ${args[0]}`
    this.prev = this.cwd
    this.cwd = abs
    return back ? this.cwd : ''
  }

  private cat(args: string[]): string {
    if (!args.length) return 'usage: cat <file>'
    return args
      .map((t) => {
        const r = this.readFile('cat', t)
        return typeof r === 'string' ? r : r.content.replace(/\n$/, '')
      })
      .join('\n')
  }

  private slice(cmd: string, args: string[], pick: (lines: string[], n: number) => string[]): string {
    let n = 10
    const files: string[] = []
    for (let i = 0; i < args.length; i++) {
      const a = args[i]
      const count = a === '-n' ? args[++i] : a.match(/^-n?(\d+)$/)?.[1]
      if (count === undefined) files.push(a)
      else if (!/^\d+$/.test(count)) return `${cmd}: invalid number of lines: '${count ?? ''}'`
      else n = Number(count)
    }
    const r = this.readFile(cmd, files[0])
    return typeof r === 'string' ? r : pick(r.content.replace(/\n$/, '').split('\n'), n).join('\n')
  }

  private grep(args: string[]): string {
    const [pattern, ...files] = args
    if (!pattern || !files.length) return 'usage: grep <text> <file>...'
    const needle = pattern.toLowerCase()
    return files
      .flatMap((t) => {
        const r = this.readFile('grep', t)
        if (typeof r === 'string') return [r]
        return r.content
          .split('\n')
          .filter((l) => l.toLowerCase().includes(needle))
          .map((l) => (files.length > 1 ? `${t}:${l}` : l))
      })
      .join('\n')
  }

  private tree(args: string[]): string {
    const { flags, rest } = this.flags(args)
    const label = rest[0] ?? '.'
    const node = this.get(this.resolve(label))
    if (!node) return `tree: ${label}: No such file or directory`
    if (node.type !== 'dir') return label
    const lines = [label]
    let dirs = 0
    let files = 0
    const walk = (d: DirNode, indent: string) => {
      const names = this.entries(d, flags.has('a')).filter((n) => n !== '.' && n !== '..')
      names.forEach((n, i) => {
        const last = i === names.length - 1
        const c = d.children[n]
        lines.push(indent + (last ? '└── ' : '├── ') + n)
        if (c.type === 'dir') {
          dirs++
          walk(c, indent + (last ? '    ' : '│   '))
        } else files++
      })
    }
    walk(node, '')
    return `${lines.join('\n')}\n\n${dirs} director${dirs === 1 ? 'y' : 'ies'}, ${files} file${files === 1 ? '' : 's'}`
  }

  private vim(args: string[]): string | RunResult {
    if (!args[0]) return 'usage: vim <file>'
    const abs = this.resolve(args[0])
    const node = this.get(abs)
    if (node?.type === 'dir') return `vim: ${args[0]}: Is a directory`
    const name = abs.split('/').filter(Boolean).pop() ?? '/'
    return { vim: { name, path: this.pretty(abs), abs, content: node?.content ?? '', isNew: !node } }
  }
}
