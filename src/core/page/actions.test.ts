// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseKey, performAction, waitForQuiet } from './actions';
import { describeElement } from './elementInfo';
import { fieldKindOf } from './fields';
import type { ActResponse } from './types';

function page(html: string): Element[] {
  document.body.innerHTML = html;
  return Array.from(document.querySelectorAll('[data-id]')).sort(
    (a, b) => Number(a.getAttribute('data-id')) - Number(b.getAttribute('data-id')),
  );
}

const ok = (r: ActResponse) => {
  if (!r.ok) throw new Error(r.error);
  return r.message;
};
const err = (r: ActResponse) => (r.ok ? '' : r.error);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('performAction', () => {
  it('click dispara pointer/mouse e o click (ação padrão)', () => {
    const els = page('<button data-id="1">Próximo</button>');
    const seen: string[] = [];
    for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click'])
      els[0]!.addEventListener(t, () => seen.push(t));
    expect(ok(performAction({ action: 'click', id: 1 }, els, document))).toMatch(/Próximo/);
    expect(seen).toEqual(expect.arrayContaining(['mousedown', 'mouseup', 'click']));
    expect(seen.filter((t) => t === 'click')).toHaveLength(1);
  });

  it('click em caixa de marcar alterna o estado', () => {
    const els = page('<input data-id="1" type="checkbox" aria-label="Aceito">');
    ok(performAction({ action: 'click', id: 1 }, els, document));
    expect((els[0] as HTMLInputElement).checked).toBe(true);
  });

  it('erros: sem snapshot, id inexistente, elemento removido, desabilitado', () => {
    const els = page('<button data-id="1" disabled>X</button>');
    expect(err(performAction({ action: 'click', id: 1 }, undefined, document))).toMatch(
      /get_page_snapshot/,
    );
    expect(err(performAction({ action: 'click', id: 9 }, els, document))).toMatch(/Não existe/);
    expect(err(performAction({ action: 'click', id: 1 }, els, document))).toMatch(/desabilitado/);
    els[0]!.remove();
    expect(err(performAction({ action: 'click', id: 1 }, els, document))).toMatch(/não está mais/);
  });

  it('type usa o setter nativo (compatível com React) e dispara input/change', () => {
    const els = page('<input data-id="1" aria-label="Nome">');
    const input = els[0] as HTMLInputElement;
    // Simula o React: a instância tem um setter próprio que não deve ser o único caminho.
    let tracked = '';
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () =>
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.get!.call(input),
      set: (v: string) => {
        tracked = v;
      },
    });
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    ok(performAction({ action: 'type', id: 1, text: 'Ana' }, els, document));
    expect(input.value).toBe('Ana');
    expect(tracked).toBe('');
    expect(events).toEqual(['input', 'change']);
  });

  it('type com submit envia o formulário pelo botão padrão', () => {
    const els = page(`
      <form method="post"><input data-id="1" name="q"><button data-id="2">Buscar</button></form>`);
    const form = document.querySelector('form')!;
    let submitter: HTMLElement | null = null;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitter = (e as SubmitEvent).submitter;
    });
    expect(
      ok(performAction({ action: 'type', id: 1, text: 'x', submit: true }, els, document)),
    ).toMatch(/submetido/);
    expect(submitter).toBe(els[1]);
  });

  it('Enter cancelado pela página não submete', () => {
    const els = page('<form><input data-id="1"></form>');
    const form = document.querySelector('form')!;
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener('submit', onSubmit);
    els[0]!.addEventListener('keydown', (e) => e.preventDefault());
    expect(ok(performAction({ action: 'press_key', id: 1, key: 'enter' }, els, document))).toMatch(
      /tratou/,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('recusa digitar em senha, 2FA e cartão (defesa em profundidade)', () => {
    const els = page(`
      <input data-id="1" type="password">
      <input data-id="2" autocomplete="one-time-code">
      <label>Número do cartão <input data-id="3" name="cc"></label>
      <input data-id="4" name="user_password" type="text">`);
    for (const id of [1, 2, 3, 4]) {
      expect(err(performAction({ action: 'type', id, text: '123' }, els, document))).toMatch(
        /nunca preenche/,
      );
    }
    expect((els[0] as HTMLInputElement).value).toBe('');
  });

  it('type recusa elementos que não são campo de texto', () => {
    const els = page('<button data-id="1">Ok</button>');
    expect(err(performAction({ action: 'type', id: 1, text: 'a' }, els, document))).toMatch(
      /não é um campo/,
    );
  });

  it('select_option por texto (sem acento/maiúsculas) ou valor; erro lista as opções', () => {
    const els = page(`<select data-id="1" aria-label="Estado">
      <option value="sp">São Paulo</option><option value="rj">Rio de Janeiro</option></select>`);
    const select = els[0] as HTMLSelectElement;
    const changed = vi.fn();
    select.addEventListener('change', changed);
    ok(performAction({ action: 'select_option', id: 1, option: 'sao paulo' }, els, document));
    expect(select.value).toBe('sp');
    ok(performAction({ action: 'select_option', id: 1, option: 'rj' }, els, document));
    expect(select.value).toBe('rj');
    expect(changed).toHaveBeenCalledTimes(2);
    expect(
      err(performAction({ action: 'select_option', id: 1, option: 'Bahia' }, els, document)),
    ).toMatch(/São Paulo \| Rio de Janeiro/);
  });

  it('Tab move o foco para o próximo campo', () => {
    const els = page('<input data-id="1" aria-label="A"><input data-id="2" aria-label="B">');
    (els[0] as HTMLInputElement).focus();
    expect(ok(performAction({ action: 'press_key', key: 'Tab' }, els, document))).toMatch(/"B"/);
    expect(document.activeElement).toBe(els[1]);
    ok(performAction({ action: 'press_key', key: 'Shift+Tab' }, els, document));
    expect(document.activeElement).toBe(els[0]);
  });

  it('scroll da janela e até um elemento', () => {
    const els = page('<p data-id="1">alvo</p>');
    const spy = vi.fn();
    window.scrollBy = spy as unknown as typeof window.scrollBy;
    expect(ok(performAction({ action: 'scroll', direction: 'down' }, els, document))).toMatch(
      /rolada/,
    );
    expect(spy).toHaveBeenCalledWith({ left: 0, top: window.innerHeight * 0.8 });
    expect(ok(performAction({ action: 'scroll', id: 1 }, els, document))).toMatch(/Rolado até/);
  });

  it('parseKey', () => {
    expect(parseKey('esc')).toMatchObject({ key: 'Escape', keyCode: 27 });
    expect(parseKey('Shift+Tab')).toMatchObject({ key: 'Tab', shift: true });
    expect(parseKey('a')).toMatchObject({ key: 'a', code: 'KeyA', keyCode: 65 });
    expect(() => parseKey('Ctrl+Alt+Del')).toThrow(/não suportada/);
  });

  it('waitForQuiet resolve depois que o DOM para de mudar', async () => {
    vi.useFakeTimers();
    const done = vi.fn();
    void waitForQuiet(document, 300, 2000).then(done);
    document.body.append('a');
    await vi.advanceTimersByTimeAsync(200);
    document.body.append('b');
    await vi.advanceTimersByTimeAsync(200);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(done).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('describeElement e fieldKindOf', () => {
  it('descreve botão de envio, método e se o formulário tem senha', () => {
    page(`<form method="POST" action="/login">
      <input name="user"><input type="password" name="pw"><button id="b">Entrar</button></form>`);
    const info = describeElement(document.querySelector('#b')!, 3);
    expect(info).toMatchObject({
      id: 3,
      role: 'button',
      name: 'Entrar',
      isSubmit: true,
      form: { method: 'post', hasPassword: true, submitLabel: 'Entrar' },
    });
    expect(info.form?.action).toMatch(/\/login$/);
  });

  it('busca, link absoluto e botões que não enviam', () => {
    page(`<form role="search"><input id="q" name="q"></form>
      <a id="a" href="/x">X</a><form><button id="n" type="button">Ver</button></form>`);
    expect(describeElement(document.querySelector('#q')!, 1).isSearch).toBe(true);
    expect(describeElement(document.querySelector('#a')!, 2).href).toMatch(/^http.*\/x$/);
    expect(describeElement(document.querySelector('#n')!, 3).isSubmit).toBe(false);
  });

  it('classifica campos sensíveis por tipo, autocomplete, nome e rótulo', () => {
    page(`<input id="a" type="password"><input id="b" autocomplete="cc-number">
      <input id="c" name="otpCode"><label for="d">Código de verificação</label><input id="d">
      <input id="e" name="cvv"><input id="f" name="email"><input id="g" name="shipping">`);
    const k = (id: string) => fieldKindOf(document.querySelector(`#${id}`)!);
    expect(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(k)).toEqual([
      'password',
      'card',
      'otp',
      'otp',
      'card',
      'normal',
      'normal',
    ]);
  });
});
