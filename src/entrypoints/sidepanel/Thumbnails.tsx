import { useEffect, useState } from 'react';
import { useT } from '@/core/i18n/store';
import type { TranslationKey } from '@/core/i18n/translate';
import type { ImageAttachment } from '@/core/page/types';

const KIND_KEY: Record<ImageAttachment['kind'], TranslationKey> = {
  screenshot: 'thumb.screenshot',
  annotated: 'thumb.annotated',
  upload: 'thumb.upload',
};

function Lightbox({ image, onClose }: { image: ImageAttachment; onClose: () => void }) {
  const t = useT();
  const label = t(KIND_KEY[image.kind]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3"
      onClick={onClose}
    >
      <img src={image.dataUrl} alt={label} className="max-h-full max-w-full rounded bg-white" />
    </div>
  );
}

/** Miniaturas clicáveis (abrem ampliadas). Com `onRemove`, mostra o botão de remover. */
export function Thumbnails({
  images,
  onRemove,
}: {
  images: ImageAttachment[];
  onRemove?: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState<ImageAttachment | null>(null);
  if (images.length === 0) return null;
  return (
    <>
      <ul className="flex flex-wrap gap-2">
        {images.map((img) => {
          const label = t(KIND_KEY[img.kind]);
          const enlargeLabel = t('thumb.enlarge', { kind: label.toLowerCase() });
          const removeLabel = t('thumb.remove');
          return (
            <li key={img.id} className="relative">
              <button aria-label={enlargeLabel} title={enlargeLabel} onClick={() => setOpen(img)}>
                <img
                  src={img.dataUrl}
                  alt={label}
                  className="h-16 w-24 rounded border border-neutral-300 object-cover"
                />
              </button>
              {onRemove && (
                <button
                  aria-label={removeLabel}
                  title={removeLabel}
                  className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-neutral-800 text-xs leading-5 text-white"
                  onClick={() => onRemove(img.id)}
                >
                  ✕
                </button>
              )}
              {img.kind === 'annotated' && (
                <span
                  role="img"
                  aria-label={label}
                  title={label}
                  className="absolute bottom-0.5 left-0.5 rounded bg-white/90 px-1 text-[10px]"
                >
                  🎯
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {open && <Lightbox image={open} onClose={() => setOpen(null)} />}
    </>
  );
}
