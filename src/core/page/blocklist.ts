/** Normaliza uma entrada digitada pelo usuário ("https://Mail.Exemplo.com/x", "*.banco.com") para um domínio. */
export function normalizeDomain(entry: string): string {
  return entry
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/^\*\./, '')
    .replace(/[/?#:].*$/, '')
    .replace(/^\.+|\.+$/g, '');
}

export function parseDomainList(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,;]+/)
        .map(normalizeDomain)
        .filter(Boolean),
    ),
  );
}

/** Verdadeiro se o host da URL é um dos domínios da lista ou subdomínio deles. */
export function isDomainBlocked(url: string, domains: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => d && (host === d || host.endsWith(`.${d}`)));
}
