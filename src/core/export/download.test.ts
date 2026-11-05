// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTextFile } from './download';

describe('downloadTextFile', () => {
  const createObjectURL = vi.fn<(obj: Blob | MediaSource) => string>(() => 'blob:fake-url');
  const revokeObjectURL = vi.fn<(url: string) => void>();
  const click = vi.fn<() => void>();

  beforeEach(() => {
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    click.mockClear();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
  });

  afterEach(() => vi.restoreAllMocks());

  it('cria um Blob com o mime certo, baixa com o nome do arquivo e revoga a URL', () => {
    downloadTextFile('conversa.md', '# Título', 'text/markdown;charset=utf-8');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe('text/markdown;charset=utf-8');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('usa text/markdown como mime padrão', () => {
    downloadTextFile('x.md', 'conteúdo');
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect((blob as Blob).type).toBe('text/markdown;charset=utf-8');
  });
});
