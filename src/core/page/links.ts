import type { PageLink } from './types';

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Links http(s) e mailto da página, sem repetições (mesmo href + texto). */
export function extractLinks(doc: Document, limit = 2000): PageLink[] {
  const seen = new Set<string>();
  const out: PageLink[] = [];
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    let href: string;
    try {
      href = new URL(a.getAttribute('href') ?? '', doc.baseURI).href;
    } catch {
      continue;
    }
    if (!/^(https?|mailto):/.test(href)) continue;
    const text = collapse(
      (a.textContent ?? '') || a.getAttribute('aria-label') || a.querySelector('img')?.alt || '',
    );
    const key = `${href}\n${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, href });
    if (out.length >= limit) break;
  }
  return out;
}
