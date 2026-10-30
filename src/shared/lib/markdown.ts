// Copiado de letsgrow-mobile/lib/markdown.ts por scripts/sync-shared.mjs. Não edite aqui.
/**
 * A restricted markdown for Bobby's answers (UX item 10): paragraphs, **bold**, *italic*, bullet and numbered
 * lists, titles (#) and simple pipe tables. No images, no links: link text stays as plain text.
 */
export type Inline = { text: string; bold?: boolean; italic?: boolean }
export type MdBlock =
  | { kind: 'heading'; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'bullets'; items: Inline[][] }
  | { kind: 'numbered'; items: Inline[][] }
  | { kind: 'table'; rows: string[][] }

/** **bold**, __bold__, *italic*, _italic_ and `code` (shown as plain text); [text](url) keeps only the text. */
export function parseInline(text: string): Inline[] {
  const clean = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]+)`/g, '$1')
  const out: Inline[] = []
  const re = /(\*\*|__)(.+?)\1|(\*|_)(?=\S)(.+?)(?<=\S)\3/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    if (m.index > last) out.push({ text: clean.slice(last, m.index) })
    out.push(m[2] != null ? { text: m[2], bold: true } : { text: m[4], italic: true })
    last = re.lastIndex
  }
  if (last < clean.length) out.push({ text: clean.slice(last) })
  return out.filter(i => i.text)
}

export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: MdBlock[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { blocks.push({ kind: 'paragraph', inline: parseInline(para.join(' ')) }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) { flush(); continue }
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (heading) { flush(); blocks.push({ kind: 'heading', inline: parseInline(heading[1]) }); continue }
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^\d+[.)]\s+(.*)$/)
    if (bullet || numbered) {
      flush()
      const kind = bullet ? 'bullets' : 'numbered'
      const prev = blocks[blocks.length - 1]
      const item = parseInline((bullet ?? numbered)![1])
      if (prev && prev.kind === kind) prev.items.push(item)
      else blocks.push({ kind, items: [item] } as MdBlock)
      continue
    }
    if (line.startsWith('|') && line.endsWith('|')) {
      flush()
      const cells = line.slice(1, -1).split('|').map(c => c.trim())
      if (cells.every(c => /^:?-{2,}:?$/.test(c))) continue // the |---|---| separator
      const prev = blocks[blocks.length - 1]
      if (prev && prev.kind === 'table') prev.rows.push(cells)
      else blocks.push({ kind: 'table', rows: [cells] })
      continue
    }
    para.push(line)
  }
  flush()
  return blocks
}
