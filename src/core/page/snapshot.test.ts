// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isDomainBlocked, normalizeDomain, parseDomainList } from './blocklist';
import { fitSize, scaleBox } from './image';
import { buildSnapshot, formatSnapshot } from './snapshot';

/** jsdom não faz layout: define a caixa de cada elemento manualmente. */
function box(el: Element, x: number, y: number, w: number, h: number) {
  el.getBoundingClientRect = () =>
    ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y }) as DOMRect;
  return el;
}

function page(html: string) {
  document.body.innerHTML = html;
  return document.body;
}

describe('buildSnapshot', () => {
  it('lista elementos interativos com id, papel, nome, estado e caixa', () => {
    const body = page(`
      <a id="l" href="/login">Entrar</a>
      <button id="b" disabled>Enviar</button>
      <label for="e">E-mail</label><input id="e" type="email" value="a@b.c">
      <input id="c" type="checkbox" aria-label="Aceito" checked>
      <select id="s" aria-label="País"><option>Brasil</option><option selected>Chile</option></select>
      <div id="plain">texto comum</div>
      <input type="hidden" value="x">
    `);
    box(body.querySelector('#l')!, 10, 20, 80, 20);
    box(body.querySelector('#b')!, 10, 50, 60, 30);
    box(body.querySelector('#e')!, 10, 90, 200, 24);
    box(body.querySelector('#c')!, 10, 120, 16, 16);
    box(body.querySelector('#s')!, 10, 150, 100, 24);

    const { snapshot, elements } = buildSnapshot(document, window);
    const byName = Object.fromEntries(snapshot.items.map((i) => [i.name, i]));

    expect(snapshot.items.map((i) => i.id)).toEqual([1, 2, 3, 4, 5]);
    expect(elements).toHaveLength(5);
    expect(elements[0]).toBe(body.querySelector('#l'));
    expect(byName['Entrar']).toMatchObject({
      role: 'link',
      href: '/login',
      bbox: { x: 10, y: 20, w: 80, h: 20 },
    });
    expect(byName['Enviar']?.state).toContain('disabled');
    expect(byName['E-mail']).toMatchObject({ role: 'textbox', value: 'a@b.c', type: 'email' });
    expect(byName['Aceito']).toMatchObject({ role: 'checkbox' });
    expect(byName['Aceito']?.state).toContain('checked');
    expect(byName['País']).toMatchObject({
      role: 'combobox',
      value: 'Chile',
      options: ['Brasil', 'Chile'],
    });
  });

  it('não expõe valores de senha, cartão ou código de uso único', () => {
    const body = page(`
      <input id="p" type="password" aria-label="Senha" value="segredo123">
      <input id="c" type="text" aria-label="Cartão" autocomplete="cc-number" value="4111111111111111">
      <input id="o" type="text" aria-label="Código" autocomplete="one-time-code" value="123456">
    `);
    body.querySelectorAll('input').forEach((el, i) => box(el, 0, i * 30, 100, 20));
    const out = formatSnapshot(buildSnapshot(document, window).snapshot);
    for (const secret of ['segredo123', '4111111111111111', '123456'])
      expect(out).not.toContain(secret);
    expect(out).toContain('sensitive');
  });

  it('ignora ocultos e conta os fora da viewport', () => {
    const body = page(`
      <button id="v">Visível</button>
      <button id="h" style="display:none">Oculto</button>
      <button id="z">Sem tamanho</button>
      <button id="far">Longe</button>
    `);
    box(body.querySelector('#v')!, 5, 5, 50, 20);
    box(body.querySelector('#h')!, 5, 40, 50, 20);
    box(body.querySelector('#z')!, 5, 70, 0, 0);
    box(body.querySelector('#far')!, 5, window.innerHeight + 500, 50, 20);
    const { snapshot } = buildSnapshot(document, window);
    expect(snapshot.items.map((i) => i.name)).toEqual(['Visível']);
    expect(snapshot.offscreenCount).toBe(1);
  });

  it('atravessa shadow DOM aberto', () => {
    const body = page('<div id="host"></div>');
    const root = body.querySelector('#host')!.attachShadow({ mode: 'open' });
    root.innerHTML = '<button id="in">Dentro da sombra</button>';
    box(root.querySelector('#in')!, 30, 30, 90, 24);
    const { snapshot } = buildSnapshot(document, window);
    expect(snapshot.items.map((i) => i.name)).toEqual(['Dentro da sombra']);
  });

  it('atravessa iframe de mesma origem somando o deslocamento', () => {
    const body = page('<iframe id="f"></iframe>');
    const frame = body.querySelector('#f') as HTMLIFrameElement;
    box(frame, 100, 200, 300, 150);
    const inner = frame.contentDocument!;
    inner.body.innerHTML = '<button id="x">No iframe</button>';
    box(inner.querySelector('#x')!, 10, 15, 60, 20);
    const { snapshot } = buildSnapshot(document, window);
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]).toMatchObject({
      name: 'No iframe',
      bbox: { x: 110, y: 215, w: 60, h: 20 },
    });
  });
});

describe('formatSnapshot', () => {
  it('gera uma linha por elemento com o id entre colchetes', () => {
    const body = page('<button id="b">Salvar</button>');
    box(body.querySelector('#b')!, 1, 2, 3, 4);
    const out = formatSnapshot(buildSnapshot(document, window).snapshot);
    expect(out).toContain('[1] button "Salvar" @1,2 3x4');
    expect(out).toMatch(/^Viewport \d+x\d+/);
  });
});

describe('imagem', () => {
  it('fitSize reduz só quando passa do limite', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitSize(2560, 1440)).toEqual({ width: 1280, height: 720 });
  });
  it('scaleBox converte pixels CSS para pixels da imagem', () => {
    expect(scaleBox({ x: 100, y: 50, w: 40, h: 20 }, 0.5)).toEqual({ x: 50, y: 25, w: 20, h: 10 });
    expect(scaleBox({ x: 0, y: 0, w: 1, h: 1 }, 0.1).w).toBe(1);
  });
});

describe('blocklist', () => {
  it('normaliza entradas', () => {
    expect(normalizeDomain(' https://Mail.Exemplo.com/caixa?x=1 ')).toBe('mail.exemplo.com');
    expect(normalizeDomain('*.banco.com.br')).toBe('banco.com.br');
    expect(parseDomainList('a.com\nA.com, b.com;')).toEqual(['a.com', 'b.com']);
  });
  it('bloqueia o domínio e subdomínios, mas não sufixos parecidos', () => {
    const list = ['banco.com'];
    expect(isDomainBlocked('https://banco.com/x', list)).toBe(true);
    expect(isDomainBlocked('https://app.banco.com/x', list)).toBe(true);
    expect(isDomainBlocked('https://meubanco.com/x', list)).toBe(false);
    expect(isDomainBlocked('not a url', list)).toBe(false);
    expect(isDomainBlocked('https://banco.com', [])).toBe(false);
  });
});
