// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { combineFrameTexts, walkFrames, type FrameText } from './frames';

/** Extrator falso: título/texto do próprio documento, sem Readability (mais simples de montar). */
const fakeExtract = (doc: Document) => ({
  title: doc.title,
  text: (doc.body?.textContent ?? '').trim(),
});

/**
 * jsdom tenta navegar de verdade ao receber um `src` via `setAttribute`/conexão ao documento (e,
 * sem um resource loader, isso zera o `contentDocument`). Para poder escrever no `contentDocument`
 * sintético (como um frame de mesma origem de verdade teria) e ainda assim dar um rótulo de URL ao
 * `resolveFrameUrl` (que lê `el.getAttribute('src')` no fallback), fixamos só `getAttribute('src')`.
 */
function addIframe(parent: Document, opts: { src?: string; title?: string; text?: string }) {
  const iframe = parent.createElement('iframe');
  parent.body.append(iframe);
  const inner = iframe.contentDocument!;
  if (opts.src) {
    const original = iframe.getAttribute.bind(iframe);
    iframe.getAttribute = (name: string) => (name === 'src' ? opts.src! : original(name));
  }
  if (opts.title) inner.title = opts.title;
  if (opts.text !== undefined) inner.body.innerHTML = opts.text;
  return { iframe, inner };
}

/** Faz o acesso a contentDocument lançar, como ocorre com um frame de outra origem. */
function makeInaccessible(iframe: HTMLIFrameElement) {
  Object.defineProperty(iframe, 'contentDocument', {
    get() {
      throw new DOMException('Blocked a frame with origin from accessing a cross-origin frame.');
    },
  });
}

describe('walkFrames', () => {
  it('lê o texto de frames de mesma origem, em ordem, rotulado com a URL', () => {
    document.body.innerHTML = '';
    addIframe(document, { src: 'https://x.test/a.html', title: 'A', text: 'Primeiro frame.' });
    addIframe(document, { src: 'https://x.test/b.html', title: 'B', text: 'Segundo frame.' });
    const result = walkFrames(document, fakeExtract);
    expect(result.inaccessibleFrames).toBe(0);
    expect(result.parts).toEqual([
      { url: 'https://x.test/a.html', title: 'A', text: 'Primeiro frame.' },
      { url: 'https://x.test/b.html', title: 'B', text: 'Segundo frame.' },
    ]);
  });

  it('descarta frames vazios', () => {
    document.body.innerHTML = '';
    addIframe(document, { src: 'https://x.test/vazio.html', text: '   ' });
    addIframe(document, { src: 'https://x.test/cheio.html', text: 'Conteúdo real.' });
    const result = walkFrames(document, fakeExtract);
    expect(result.parts).toEqual([
      { url: 'https://x.test/cheio.html', title: '', text: 'Conteúdo real.' },
    ]);
  });

  it('conta frames de outra origem sem lançar nem travar a varredura', () => {
    document.body.innerHTML = '';
    const { iframe } = addIframe(document, { text: 'nunca lido' });
    makeInaccessible(iframe);
    addIframe(document, { src: 'https://x.test/acessivel.html', text: 'Lido normalmente.' });
    const result = walkFrames(document, fakeExtract);
    expect(result.inaccessibleFrames).toBe(1);
    expect(result.parts).toEqual([
      { url: 'https://x.test/acessivel.html', title: '', text: 'Lido normalmente.' },
    ]);
  });

  it('respeita a lista de domínios bloqueados, por frame', () => {
    document.body.innerHTML = '';
    addIframe(document, { src: 'https://banco.test/x.html', text: 'Dados sigilosos.' });
    addIframe(document, { src: 'https://x.test/publico.html', text: 'Conteúdo público.' });
    const result = walkFrames(document, fakeExtract, ['banco.test']);
    expect(result.parts).toEqual([
      { url: 'https://x.test/publico.html', title: '', text: 'Conteúdo público.' },
    ]);
    expect(result.inaccessibleFrames).toBe(0);
  });

  it('percorre frames aninhados (frame dentro de frame) em profundidade', () => {
    document.body.innerHTML = '';
    const { inner } = addIframe(document, { src: 'https://x.test/externo.html', text: 'Externo.' });
    addIframe(inner, { src: 'https://x.test/interno.html', text: 'Interno.' });
    const result = walkFrames(document, fakeExtract);
    expect(result.parts.map((p) => p.url)).toEqual([
      'https://x.test/externo.html',
      'https://x.test/interno.html',
    ]);
  });

  it('sem frames, devolve listas vazias', () => {
    document.body.innerHTML = '<p>Só a página principal.</p>';
    expect(walkFrames(document, fakeExtract)).toEqual({ parts: [], inaccessibleFrames: 0 });
  });
});

describe('combineFrameTexts', () => {
  it('a página principal (url vazia) não recebe rótulo; os frames recebem', () => {
    const parts: FrameText[] = [
      { url: '', title: 'Principal', text: 'Texto da casca.' },
      { url: 'https://x.test/a.html', title: 'A', text: 'Texto do frame A.' },
    ];
    expect(combineFrameTexts(parts)).toBe(
      'Texto da casca.\n\n--- frame: https://x.test/a.html ---\nTexto do frame A.',
    );
  });

  it('ignora partes sem texto e preserva a ordem recebida', () => {
    const parts: FrameText[] = [
      { url: 'https://x.test/vazio.html', title: '', text: '   ' },
      { url: 'https://x.test/b.html', title: '', text: 'B' },
      { url: 'https://x.test/a.html', title: '', text: 'A' },
    ];
    expect(combineFrameTexts(parts)).toBe(
      '--- frame: https://x.test/b.html ---\nB\n\n--- frame: https://x.test/a.html ---\nA',
    );
  });

  it('lista vazia devolve string vazia', () => {
    expect(combineFrameTexts([])).toBe('');
  });
});
