/** Conteúdo de página (ou seleção) anexado a uma mensagem do usuário. */
export interface PageContext {
  title: string;
  url: string;
  /** Texto principal da página (vazio quando o contexto é só uma seleção). */
  text: string;
  /** Texto selecionado pelo usuário, se houver. */
  selection?: string;
  /** Lista textual de elementos interativos (ids iguais aos das marcas do screenshot anotado). */
  snapshot?: string;
  /** URL de um PDF embutido na página (<embed>/<object>/<iframe>), quando ela é só um invólucro. */
  embeddedPdf?: string;
  truncated: boolean;
  originalLength: number;
  /** Posição (no texto original da parte principal) a partir de onde foi omitido/cortado. */
  omittedFrom?: number;
}

export const EXTRACT_MESSAGE = 'lucerna:extract';
export const SNAPSHOT_MESSAGE = 'lucerna:snapshot';

export type ExtractResponse = { ok: true; data: PageContext } | { ok: false; error: string };

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapshotItem {
  /** Id numérico (1..n), o mesmo desenhado no screenshot anotado. */
  id: number;
  tag: string;
  role: string;
  name: string;
  /** Texto visível, só quando difere do nome. */
  text?: string;
  type?: string;
  href?: string;
  value?: string;
  options?: string[];
  state: string[];
  /** Caixa em pixels CSS, relativa à viewport da página principal. */
  bbox: BBox;
}

export interface Snapshot {
  url: string;
  title: string;
  viewport: { width: number; height: number; dpr: number };
  items: SnapshotItem[];
  /** Interativos fora da viewport (não listados). */
  offscreenCount: number;
  /** iframes de outra origem, cujo conteúdo não pode ser lido. */
  inaccessibleFrames: number;
  /** Houve corte pelo limite de elementos. */
  truncated: boolean;
}

export type SnapshotResponse = { ok: true; data: Snapshot } | { ok: false; error: string };

/** Imagem anexada a uma mensagem (já redimensionada/comprimida). */
export interface ImageAttachment {
  id: string;
  /** data URL (JPEG). */
  dataUrl: string;
  width: number;
  height: number;
  kind: 'screenshot' | 'annotated' | 'upload';
}

export const LINKS_MESSAGE = 'lucerna:links';
export const TABLES_MESSAGE = 'lucerna:tables';

export interface PageLink {
  text: string;
  href: string;
}

export interface PageTable {
  /** Posição da tabela na página (começa em 1). */
  index: number;
  caption?: string;
  rows: string[][];
}

export interface LinksData {
  url: string;
  title: string;
  links: PageLink[];
}

export interface TablesData {
  url: string;
  title: string;
  tables: PageTable[];
}

export type LinksResponse = { ok: true; data: LinksData } | { ok: false; error: string };
export type TablesResponse = { ok: true; data: TablesData } | { ok: false; error: string };

// --- Modo agente (Fase 5) ---

export const DESCRIBE_MESSAGE = 'lucerna:describe';
export const ACT_MESSAGE = 'lucerna:act';
export const SETTLE_MESSAGE = 'lucerna:settle';

/** Campos cujo conteúdo o agente nunca digita (nem lê no snapshot). */
export type FieldKind = 'password' | 'otp' | 'card' | 'normal';

/** Descrição objetiva de um elemento-alvo, usada pela política de segurança antes de agir. */
export interface ElementInfo {
  id: number;
  tag: string;
  role: string;
  name: string;
  text?: string;
  type?: string;
  /** href absoluto de links. */
  href?: string;
  /** input de texto, textarea ou contenteditable. */
  editable: boolean;
  contentEditable: boolean;
  fieldKind: FieldKind;
  /** Clicar nele envia um formulário. */
  isSubmit: boolean;
  /** Campo ou formulário de busca. */
  isSearch: boolean;
  disabled: boolean;
  form?: {
    method: string;
    action: string;
    hasPassword: boolean;
    /** Nome do botão de envio padrão do formulário. */
    submitLabel?: string;
  };
}

export type DescribeResponse = { ok: true; data: ElementInfo } | { ok: false; error: string };

export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

/** Ação executada no script injetado (ids do último snapshot). */
export type ActRequest =
  | { action: 'click'; id: number }
  | { action: 'type'; id: number; text: string; submit?: boolean }
  | { action: 'press_key'; key: string; id?: number }
  | { action: 'select_option'; id: number; option: string }
  | { action: 'scroll'; id?: number; direction?: ScrollDirection; amount?: number };

export type ActResponse = { ok: true; message: string } | { ok: false; error: string };
