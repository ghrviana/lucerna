import { captureAnnotated, captureSnapshot } from '../page/capture';
import { wrapPageData } from '../page/contextBlock';
import type { ImageAttachment, PageContext } from '../page/types';
import { hashText } from './loopGuard';

/** Estado da página depois de uma ação: snapshot novo (ids novos) e, opcionalmente, screenshot. */
export interface Observation {
  text: string;
  images?: ImageAttachment[];
  /** URL + hash do snapshot, para saber se a ação mudou algo (detector de laço). */
  signature?: string;
}

const signatureOf = (page: PageContext) => `${page.url}#${hashText(page.snapshot ?? '')}`;

const describe = (page: PageContext, withImage: boolean) =>
  `Observação da página após a ação${withImage ? ' (screenshot anotado anexado, mesmos ids)' : ''}. ` +
  `Use só os ids abaixo nas próximas ações.\n${wrapPageData(page.snapshot ?? '', page)}`;

export async function observePage(tabId: number, screenshot: boolean): Promise<Observation> {
  if (screenshot) {
    try {
      const { image, context } = await captureAnnotated(tabId);
      return { text: describe(context, true), images: [image], signature: signatureOf(context) };
    } catch (err) {
      console.warn('Lucerna: screenshot da observação falhou; seguindo só com o snapshot', err);
    }
  }
  const page = await captureSnapshot(tabId);
  return { text: describe(page, false), signature: signatureOf(page) };
}
