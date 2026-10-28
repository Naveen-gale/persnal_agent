import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/80 border-b border-zinc-800 text-zinc-400">
        <span className="text-[11px] uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-zinc-200 leading-relaxed custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, isUser = false }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let index = 0;

  // Inline formatting helper
  const formatInline = (text) => {
    let result = text;
    // Bold
    result = result.replace(/\*\*(.*?)\*\*/g, `<strong class="font-semibold ${isUser ? 'text-white' : 'text-zinc-100'}">$1</strong>`);
    // Italic
    result = result.replace(/(\*|_)(.*?)\1/g, `<em class="italic ${isUser ? 'text-zinc-200' : 'text-zinc-300'}">$2</em>`);
    // Inline code
    result = result.replace(
      /`([^`]+)`/g,
      `<code class="px-1.5 py-0.5 rounded ${isUser ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-200'} font-mono text-[11px]">$1</code>`
    );
    // Links
    result = result.replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-zinc-200 underline underline-offset-2 hover:text-white transition">$1</a>'
    );
    return result;
  };

  while (index < lines.length) {
    const line = lines[index];

    // 1. Fenced Code Block
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      index++;
      const codeLines = [];
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index++;
      }
      index++; // skip closing ```
      elements.push(
        <CodeBlock
          key={`code-${elements.length}`}
          code={codeLines.join('\n')}
          language={language}
        />
      );
      continue;
    }

    // 2. Table handling (| col1 | col2 |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index].trim());
        index++;
      }

      if (tableLines.length >= 2) {
        const headerCells = tableLines[0]
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        const rowLines = tableLines.slice(2);

        elements.push(
          <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-zinc-800">
            <table className="w-full text-xs text-left text-zinc-300">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-[11px] font-semibold text-zinc-200 uppercase tracking-wider">
                <tr>
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      className="px-3 py-2"
                      dangerouslySetInnerHTML={{ __html: formatInline(h) }}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/60 font-mono text-[11px]">
                {rowLines.map((rowStr, rIdx) => {
                  const cells = rowStr
                    .slice(1, -1)
                    .split('|')
                    .map((c) => c.trim());
                  return (
                    <tr key={rIdx} className={rIdx % 2 === 1 ? 'bg-zinc-900/40' : ''}>
                      {cells.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="px-3 py-1.5"
                          dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                        />
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h2
          key={`h1-${elements.length}`}
          className="text-base font-semibold text-zinc-100 mt-4 mb-2 tracking-tight"
          dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }}
        />
      );
      index++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3
          key={`h2-${elements.length}`}
          className="text-sm font-semibold text-zinc-200 mt-3 mb-1.5 tracking-tight"
          dangerouslySetInnerHTML={{ __html: formatInline(line.slice(3)) }}
        />
      );
      index++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h4
          key={`h3-${elements.length}`}
          className="text-xs font-semibold text-zinc-300 mt-2 mb-1 tracking-tight"
          dangerouslySetInnerHTML={{ __html: formatInline(line.slice(4)) }}
        />
      );
      index++;
      continue;
    }

    // 4. Blockquote
    if (line.startsWith('> ')) {
      const quoteLines = [];
      while (index < lines.length && lines[index].startsWith('> ')) {
        quoteLines.push(lines[index].slice(2));
        index++;
      }
      elements.push(
        <blockquote
          key={`quote-${elements.length}`}
          className="border-l-2 border-zinc-600 pl-3 py-0.5 my-2 text-xs italic text-zinc-400 bg-zinc-900/40 rounded-r"
          dangerouslySetInnerHTML={{ __html: formatInline(quoteLines.join(' ')) }}
        />
      );
      continue;
    }

    // 5. Unordered List (-, *, •)
    if (line.trim().match(/^[-*•]\s+/)) {
      const listItems = [];
      while (index < lines.length && lines[index].trim().match(/^[-*•]\s+/)) {
        listItems.push(lines[index].trim().replace(/^[-*•]\s+/, ''));
        index++;
      }
      elements.push(
        <ul key={`ul-${elements.length}`} className={`list-disc pl-5 my-1.5 space-y-1 text-xs ${isUser ? 'text-zinc-100' : 'text-zinc-300'}`}>
          {listItems.map((item, liIdx) => (
            <li
              key={liIdx}
              className="leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatInline(item) }}
            />
          ))}
        </ul>
      );
      continue;
    }

    // 6. Numbered List (1. , 2. )
    if (line.trim().match(/^\d+\.\s+/)) {
      const listItems = [];
      while (index < lines.length && lines[index].trim().match(/^\d+\.\s+/)) {
        listItems.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
        index++;
      }
      elements.push(
        <ol key={`ol-${elements.length}`} className={`list-decimal pl-5 my-1.5 space-y-1 text-xs ${isUser ? 'text-zinc-100' : 'text-zinc-300'}`}>
          {listItems.map((item, liIdx) => (
            <li
              key={liIdx}
              className="leading-relaxed"
              dangerouslySetInnerHTML={{ __html: formatInline(item) }}
            />
          ))}
        </ol>
      );
      continue;
    }

    // 7. Regular paragraph / line
    if (line.trim()) {
      elements.push(
        <p
          key={`p-${elements.length}`}
          className={`text-xs ${isUser ? 'text-zinc-100' : 'text-zinc-300'} leading-relaxed my-1`}
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      );
    } else {
      elements.push(<div key={`space-${elements.length}`} className="h-2" />);
    }
    index++;
  }

  return <div className="space-y-0.5">{elements}</div>;
}
