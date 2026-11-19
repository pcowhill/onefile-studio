import type { VarStore } from './env';

const TOKEN = /\{([^{}\n]{1,40})\}/g;

export function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Replaces `{Variable name}` tokens with live values. Unknown tokens are left as typed. */
export function interpolate(text: string, vars: VarStore): string {
  return text.replace(TOKEN, (m, name: string) => {
    const v = vars.byName(name);
    return v ? formatNumber(vars.get(v.id)) : m;
  });
}

export function hasTokens(text: string): boolean {
  TOKEN.lastIndex = 0;
  return TOKEN.test(text);
}

/**
 * Renders a tiny, safe subset of Markdown into DOM nodes (never innerHTML):
 * "# " / "## " headings, "- " bullets, blank-line paragraphs and **bold**.
 */
export function renderRichText(doc: Document, text: string): DocumentFragment {
  const frag = doc.createDocumentFragment();
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-•*]\s+/.test(l)) && lines.length) {
      const ul = doc.createElement('ul');
      for (const l of lines) {
        const li = doc.createElement('li');
        appendInline(doc, li, l.replace(/^\s*[-•*]\s+/, ''));
        ul.appendChild(li);
      }
      frag.appendChild(ul);
      continue;
    }
    let para: HTMLElement | null = null;
    for (const line of lines) {
      const h = /^(#{1,3})\s+(.*)$/.exec(line);
      if (h) {
        para = null;
        const el = doc.createElement(h[1].length === 1 ? 'h3' : 'h4');
        appendInline(doc, el, h[2]);
        frag.appendChild(el);
        continue;
      }
      if (!line.trim()) continue;
      if (!para) {
        para = doc.createElement('p');
        frag.appendChild(para);
      } else {
        para.appendChild(doc.createElement('br'));
      }
      appendInline(doc, para, line);
    }
  }
  return frag;
}

function appendInline(doc: Document, parent: HTMLElement, text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      const b = doc.createElement('strong');
      b.textContent = p.slice(2, -2);
      parent.appendChild(b);
    } else parent.appendChild(doc.createTextNode(p));
  }
}
