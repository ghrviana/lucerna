/**
 * Detector simples de prompt injection: frases típicas de quem tenta dar ordens ao assistente
 * a partir do conteúdo de uma página. Achar uma não bloqueia nada sozinho: marca a sessão como
 * suspeita e, daí em diante, toda ação de escrita pede confirmação (ver policy.ts).
 */

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').toLowerCase();

const PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget)\b (all |any )?(the |your )?(previous|prior|above|earlier|preceding) (instructions|prompts?|messages|rules|directions)/,
  /\bignor[ea](r)? (todas |quaisquer )?(as )?(instrucoes|ordens|regras|mensagens) (anteriores|acima|previas)/,
  /\besque[cç]a (todas )?(as )?(instrucoes|ordens|regras)/,
  /\b(new|updated|novas?) (instructions|instrucoes)\s*:/,
  /\b(system prompt|prompt de sistema|prompt do sistema)\b/,
  /\byou are now\b|\bvoce (agora )?e agora\b|\ba partir de agora,? voce\b/,
  /\b(ai|assistant|agent|chatbot|ia|assistente|agente)\s*[,:]\s*(please |por favor )?(navigate|go to|open|click|type|send|visit|va para|acesse|abra|clique|digite|envie)\b/,
  /\[\s*(system|sistema)\s*\]|<\s*\/?\s*(system|sistema)\s*>/,
  /\b(do not|don't|nao) (tell|inform|mention|avise|conte|diga)( (to|ao|a))? (the )?(user|usuario)\b/,
];

/** Devolve o trecho suspeito encontrado (até ~80 caracteres) ou undefined. */
export function detectInjection(text: string): string | undefined {
  if (!text) return undefined;
  const folded = fold(text);
  for (const re of PATTERNS) {
    const m = re.exec(folded);
    if (m) {
      const start = Math.max(0, m.index - 10);
      return folded
        .slice(start, m.index + Math.max(m[0].length, 60))
        .trim()
        .slice(0, 80);
    }
  }
  return undefined;
}
