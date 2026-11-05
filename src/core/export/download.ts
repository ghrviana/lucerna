/**
 * Baixa um arquivo de texto pelo navegador (Blob + <a download>), sem precisar da permissão
 * `chrome.downloads` (fora do manifest; mantém as permissões mínimas do projeto).
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = 'text/markdown;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
