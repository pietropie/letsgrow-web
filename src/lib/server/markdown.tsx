import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";

/**
 * Markdown dos textos legais (content/*.md), lido no build: a página sai estática, sem JavaScript.
 * Só o que esses textos usam: ##, parágrafo, lista com "-", tabela, **negrito** e ⟦campo a preencher⟧.
 */
export function readContent(name: string): string {
  return readFileSync(join(process.cwd(), "content", name), "utf8").replace(/\r\n/g, "\n");
}

export const hasPlaceholders = (md: string) => md.includes("⟦");

function inline(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|⟦[^⟧]+⟧)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith("**")) return <strong key={`${key}-${i}`} className="font-semibold">{inline(part.slice(2, -2), `${key}-${i}`)}</strong>;
    if (part.startsWith("⟦")) return <mark key={`${key}-${i}`} className="rounded bg-state-alert px-1 text-text">{part}</mark>;
    return part;
  });
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${i}`;
    if (!line.trim() || line.startsWith("---") || line.startsWith(">")) { i++; continue; }
    if (line.startsWith("## ")) {
      out.push(<h2 key={key} className="mt-4 text-[22px] leading-[30px] font-bold text-text">{inline(line.slice(3), key)}</h2>);
      i++; continue;
    }
    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      out.push(
        <div key={key} className="overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm leading-5">
            <thead><tr>{cells(head).map((c, j) => <th key={j} scope="col" className="border-b border-border bg-surface p-3 font-semibold">{inline(c, `${key}h${j}`)}</th>)}</tr></thead>
            <tbody>{body.map((r, k) => <tr key={k} className="align-top">{cells(r).map((c, j) => <td key={j} className="border-b border-border p-3 last:border-b-0">{inline(c, `${key}r${k}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) items.push(lines[i++].slice(2));
      out.push(<ul key={key} className="flex list-disc flex-col gap-1 pl-6">{items.map((t, j) => <li key={j}>{inline(t, `${key}l${j}`)}</li>)}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(## |\||- |---|>)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={key}>{inline(para.join(" "), key)}</p>);
  }
  return <>{out}</>;
}
