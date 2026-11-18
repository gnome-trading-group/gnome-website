export type Token = { text: string; cls?: string }

function inline(line: string): Token[] {
  const tokens: Token[] = []
  let rest = line
  const marker = line.match(/^(\s*)([-*]|\d+\.)(\s)/)
  if (marker) {
    if (marker[1]) tokens.push({ text: marker[1] })
    tokens.push({ text: marker[2], cls: 'm' })
    rest = line.slice(marker[1].length + marker[2].length)
  }
  for (const part of rest.split(/(`[^`]+`)/)) {
    if (!part) continue
    tokens.push(part.length > 1 && part.startsWith('`') && part.endsWith('`') ? { text: part, cls: 'ic' } : { text: part })
  }
  return tokens
}

export function highlightMarkdown(md: string): Token[][] {
  let inCode = false
  return md
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => {
      if (/^```/.test(line)) {
        inCode = !inCode
        return [{ text: line, cls: 'f' }]
      }
      if (inCode) return [{ text: line, cls: 'c' }]
      if (/^#{1,6}\s/.test(line)) return [{ text: line, cls: 'h' }]
      if (/^>/.test(line)) return [{ text: line, cls: 'q' }]
      if (/^\|/.test(line) || /^---+$/.test(line)) return [{ text: line, cls: 'f' }]
      return inline(line)
    })
}
