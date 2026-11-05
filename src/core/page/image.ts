import type { BBox, ImageAttachment, SnapshotItem } from './types';

export const MAX_IMAGE_WIDTH = 1280;
export const JPEG_QUALITY = 0.7;
/** Limite do arquivo original aceito em anexos manuais. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Reduz proporcionalmente para no máximo `maxWidth` de largura (nunca aumenta). */
export function fitSize(width: number, height: number, maxWidth = MAX_IMAGE_WIDTH) {
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.max(1, Math.round((height * maxWidth) / width)) };
}

/** Caixa do elemento (pixels CSS) convertida para pixels da imagem. */
export function scaleBox(box: BBox, scale: number): BBox {
  return {
    x: Math.round(box.x * scale),
    y: Math.round(box.y * scale),
    w: Math.max(1, Math.round(box.w * scale)),
    h: Math.max(1, Math.round(box.h * scale)),
  };
}

const MARK_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2'];

/** Desenha caixas numeradas (set-of-marks) sobre o contexto 2D, com os mesmos ids do snapshot. */
export function drawMarks(
  ctx: OffscreenCanvasRenderingContext2D,
  items: SnapshotItem[],
  scale: number,
): void {
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (const item of items) {
    const color = MARK_COLORS[item.id % MARK_COLORS.length] as string;
    const b = scaleBox(item.bbox, scale);
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    const label = String(item.id);
    const tw = ctx.measureText(label).width + 8;
    const th = 16;
    // Etiqueta no canto superior esquerdo; se não couber acima, vai para dentro da caixa.
    const ly = b.y - th >= 0 ? b.y - th : b.y;
    ctx.fillStyle = color;
    ctx.fillRect(b.x, ly, tw, th);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, b.x + 4, ly + th / 2 + 1);
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64 = ''] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'));
    reader.readAsDataURL(blob);
  });
}

export interface ProcessOptions {
  kind: ImageAttachment['kind'];
  /** Se presente, desenha marcas numeradas. `viewportWidth` é a largura da viewport em pixels CSS. */
  marks?: { items: SnapshotItem[]; viewportWidth: number };
}

/** Redimensiona (largura máx. 1280), achata transparência em branco, comprime em JPEG ~0,7. */
export async function processImage(source: Blob, opts: ProcessOptions): Promise<ImageAttachment> {
  const bitmap = await createImageBitmap(source);
  const { width, height } = fitSize(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível para processar a imagem.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  if (opts.marks) drawMarks(ctx, opts.marks.items, width / opts.marks.viewportWidth);

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  return {
    id: crypto.randomUUID(),
    dataUrl: await blobToDataUrl(blob),
    width,
    height,
    kind: opts.kind,
  };
}
