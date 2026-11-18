export type FileNode = { type: 'file'; content: string }
export type DirNode = { type: 'dir'; children: Record<string, Node> }
export type Node = FileNode | DirNode

export const HOME = '/home/guest'

// Vite's glob skips dotfiles, so content files use a leading "_" that becomes "." in the shell.
const sources = import.meta.glob('../content/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const dir = (children: Record<string, Node> = {}): DirNode => ({ type: 'dir', children })
const file = (content: string): FileNode => ({ type: 'file', content })

function mount(home: DirNode, relPath: string, content: string) {
  const parts = relPath.split('/').map((p) => p.replace(/^_/, '.'))
  const name = parts.pop()!
  let current = home
  for (const part of parts) {
    const next = (current.children[part] ??= dir())
    if (next.type !== 'dir') throw new Error(`content path collides with a file: ${relPath}`)
    current = next
  }
  current.children[name] = file(content)
}

export function buildRoot(): DirNode {
  const home = dir()
  for (const [path, content] of Object.entries(sources)) {
    mount(home, path.replace('../content/', ''), content)
  }
  return dir({
    home: dir({ guest: home }),
    etc: dir({
      motd: file('Welcome to gnome-os. Mind the hats.\n'),
      hostname: file('gnome\n'),
    }),
    tmp: dir(),
  })
}
