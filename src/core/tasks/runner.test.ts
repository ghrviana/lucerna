import { describe, expect, it } from 'vitest';
import { createScheduledTask } from '../storage/scheduledTasks';
import { buildPrompt } from './runner';

describe('buildPrompt', () => {
  it('sem instrução, pede resumo e aviso de mudança; sem resposta anterior, avisa que é a primeira', () => {
    const task = createScheduledTask({
      name: 'Preço',
      url: 'https://x.test/produto',
      intervalHours: 24,
    });
    const prompt = buildPrompt(task);
    expect(prompt).toContain('https://x.test/produto');
    expect(prompt).toContain('Resuma o que há de mais importante');
    expect(prompt).toContain('primeira verificação');
    expect(prompt).not.toContain('verificacao_anterior');
  });

  it('usa a instrução do usuário e inclui a resposta anterior para comparar', () => {
    const task = {
      ...createScheduledTask({ name: 'Preço', url: 'https://x.test', intervalHours: 24 }),
      instruction: 'avise se o preço ficar abaixo de R$ 500',
      lastSummary: 'Preço atual: R$ 700.',
    };
    const prompt = buildPrompt(task);
    expect(prompt).toContain('avise se o preço ficar abaixo de R$ 500');
    expect(prompt).toContain('<verificacao_anterior>');
    expect(prompt).toContain('Preço atual: R$ 700.');
  });
});
