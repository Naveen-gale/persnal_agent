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
    <div style={codeStyles.wrapper}>
      <div style={codeStyles.header}>
        <span style={codeStyles.lang}>{language || 'code'}</span>
        <button onClick={handleCopy} style={codeStyles.copyBtn} title="Copy code">
          {copied ? (
            <>
              <Check size={13} color="#10b981" />
              <span style={{ color: '#10b981' }}>Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre style={codeStyles.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let index = 0;

  // Inline formatting helper
  const formatInline = (text) => {
    let result = text;
    // Bold
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic
    result = result.replace(/(\*|_)(.*?)\1/g, '<em>$2</em>');
    // Inline code
    result = result.replace(
      /`([^`]+)`/g,
      '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #93c5fd;">$1</code>'
    );
    // Links
    result = result.replace(
      /\[(.*?)\]\((.*?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; text-decoration: underline;">$1</a>'
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
        const rowLines = tableLines.slice(2); // skip separator row (|---|---|)

        elements.push(
          <div key={`table-${elements.length}`} style={tableStyles.container}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  {headerCells.map((h, hIdx) => (
                    <th
                      key={hIdx}
                      style={tableStyles.th}
                      dangerouslySetInnerHTML={{ __html: formatInline(h) }}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowLines.map((rowStr, rIdx) => {
                  const cells = rowStr
                    .slice(1, -1)
                    .split('|')
                    .map((c) => c.trim());
                  return (
                    <tr key={rIdx} style={rIdx % 2 === 1 ? tableStyles.trEven : {}}>
                      {cells.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          style={tableStyles.td}
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
          style={renderStyles.h1}
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
          style={renderStyles.h2}
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
          style={renderStyles.h3}
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
          style={renderStyles.blockquote}
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
        <ul key={`ul-${elements.length}`} style={renderStyles.ul}>
          {listItems.map((item, liIdx) => (
            <li
              key={liIdx}
              style={renderStyles.li}
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
        <ol key={`ol-${elements.length}`} style={renderStyles.ol}>
          {listItems.map((item, liIdx) => (
            <li
              key={liIdx}
              style={renderStyles.li}
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
          style={renderStyles.p}
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      );
    } else {
      elements.push(<div key={`space-${elements.length}`} style={{ height: '6px' }} />);
    }
    index++;
  }

  return <div style={renderStyles.container}>{elements}</div>;
}

const codeStyles = {
  wrapper: {
    backgroundColor: '#0a0d14',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '10px',
    margin: '10px 0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  lang: {
    fontSize: '11px',
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontFamily: 'monospace',
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: '#cbd5e1',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '3px 6px',
    borderRadius: '4px',
  },
  pre: {
    padding: '12px 14px',
    margin: 0,
    overflowX: 'auto',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#e2e8f0',
  },
};

const tableStyles = {
  container: {
    overflowX: 'auto',
    margin: '10px 0',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    textAlign: 'left',
  },
  th: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '8px 12px',
    fontWeight: '600',
    color: '#f8fafc',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  td: {
    padding: '8px 12px',
    color: '#cbd5e1',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
  },
  trEven: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
};

const renderStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
  },
  h1: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '10px 0 6px 0',
  },
  h2: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#f8fafc',
    margin: '8px 0 4px 0',
  },
  h3: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f8fafc',
    margin: '6px 0 2px 0',
  },
  blockquote: {
    margin: '8px 0',
    padding: '8px 14px',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderLeft: '3px solid #3b82f6',
    borderRadius: '0 6px 6px 0',
    color: '#cbd5e1',
    fontStyle: 'italic',
    fontSize: '13px',
  },
  ul: {
    margin: '4px 0 6px 20px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  ol: {
    margin: '4px 0 6px 22px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  li: {
    fontSize: '14px',
    lineHeight: 1.5,
    color: '#e2e8f0',
  },
  p: {
    fontSize: '14px',
    lineHeight: 1.55,
    color: '#f1f5f9',
    margin: '2px 0',
    wordBreak: 'break-word',
  },
};
