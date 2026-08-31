import type { App, Ref } from 'vue';

export const RBT_CONTEXT_KEY = 'rbph-theme-context';
export const RBT_VUE_RUNTIME_KEY = '__RBPH_THEME_VUE_RUNTIME_V1__';

export type RbtContentType = 'markdown' | 'html' | 'unsafe-markdown';

export interface RbtContentBlock {
  id: number;
  sort?: number;
  contentType: RbtContentType;
  revision: string;
  content?: string;
  contentUrl?: string | null;
}

export enum RbtTeamPuzzleState {
  Locked = -1,
  Unlocked = 0,
  Solved = 1,
}

export type RbtPuzzleState = RbtTeamPuzzleState | 'locked' | 'unlocked' | 'solved';

export interface RbtPuzzleSummary {
  id: number;
  slug?: string | null;
  title: string;
  state: RbtPuzzleState;
  answer?: string;
}

export interface RbtCurrency {
  id: number;
  slug?: string;
  name: string;
  amount: number;
  precision: number;
  growth?: number;
  icon?: string;
}

export interface RbtSubmission {
  userName?: string;
  answer: string;
  normalizedAnswer: string;
  action: RbJudgeAction;
  message?: string;
  createdAt: string;
}

export interface RbtSubmissionPage {
  data: RbtSubmission[];
  total: number;
}

export interface RbtCurrencyPenalty {
  currency_id: number;
  name: string;
  prec: number;
  amount: number;
}

export interface RbtAnnouncementPuzzle {
  id: number;
  slug?: string | null;
  title: string;
  round_id: number;
  round_slug?: string | null;
  is_round_puzzle: boolean;
}

export interface RbtAnnouncement {
  id: number;
  title: string;
  content: string;
  content_type: RbContentType;
  is_pinned: boolean;
  game_id?: number | null;
  puzzles: RbtAnnouncementPuzzle[];
  utime_at: string;
}

export interface RbtThemeI18n {
  readonly locale: Readonly<Ref<string>>;
  readonly availableLocales: Readonly<Ref<readonly string[]>>;
  t(key: string, values?: Record<string, unknown> | unknown[], plural?: number): string;
  te(key: string, locale?: string): boolean;
  n(value: number, options?: Intl.NumberFormatOptions): string;
  d(value: string | number | Date, options?: Intl.DateTimeFormatOptions): string;
}

export interface RbtSyncTime {
  readonly currentTime: Readonly<Ref<number>>;
  calcCurrentTime(): number;
}

export interface RbtThemeUtils {
  formatDate(date?: Date | string | number | null): string;
  formatTime(milliseconds: number): string;
  intPrecString(number: number, precision: number, keepPlus?: boolean, pad?: string): string;
  formatCurrencyPenaltySuffix(penalty?: RbtCurrencyPenalty[]): string;
}

export type RbtJudgeActionConst = Readonly<JudgeActionConst>;
export type RbtSyncMessage<T extends SyncMessageType = SyncMessageType> = Readonly<SyncMessage<SyncMessageMap[T]>>;
export type RbtApi = ReturnType<typeof useApi>;

export interface RbtSubmitState {
  state?: RbtPuzzleState;
  cooldownTill?: string;
  maxSubmit?: number | null;
  submitCount?: number;
}

export interface RbtThemeContext {
  readonly judgeActionConsts: Readonly<Ref<Readonly<Record<RbJudgeAction, RbtJudgeActionConst>>>>;
  api: RbtApi;
  i18n: RbtThemeI18n;
  sync: {
    readonly time: RbtSyncTime;
    isSelfEcho(sid?: string): boolean;
    on<T extends SyncMessageType>(type: T, callback: (message: RbtSyncMessage<T>) => void): () => void;
  };
  readonly utils: RbtThemeUtils;
  state: {
    readonly round?: Readonly<Ref<unknown>>;
    readonly puzzle?: Readonly<Ref<unknown>>;
    readonly currencies: Readonly<Ref<RbtCurrency[]>>;
    getCurrencies(): RbtCurrency[];
  };
  content: {
    readonly blocks: RbtContentBlock[];
    mount(element: Element, blocks?: RbtContentBlock[]): () => void;
  };
  actions: {
    openPuzzle?: (puzzle: RbtPuzzleSummary) => Promise<void>;
    submitAnswer?: (answer: string, options?: { feedback?: 'host-toast' | 'none' }) => Promise<unknown>;
    listSubmissions?: (options?: { onlySuccessful?: boolean; page?: number }) => Promise<RbtSubmissionPage>;
    navigate?: (target: string) => Promise<void>;
  };
  ui?: {
    apiVersion: 1;
    overlayRoot: HTMLElement;
    readonly locale: Readonly<Ref<unknown>>;
    install(app: App): void;
  };
}

export function useRbtContext() {
  const context = inject<RbtThemeContext>(RBT_CONTEXT_KEY);
  if (!context) throw new Error('Rbt components must be rendered inside an RBPH theme');
  return context;
}

export function rbtPuzzleSolved(state: RbtPuzzleState | undefined) {
  return state === RbtTeamPuzzleState.Solved || state === 'solved';
}

export function rbtContentTypeValue(type: RbtContentType): RbContentType {
  if (type === 'html') return RbContentType.Html;
  if (type === 'unsafe-markdown') return RbContentType.UnsafeMarkdown;
  return RbContentType.Markdown;
}

export function rbtContentType(type: RbContentType): RbtContentType {
  if (type === RbContentType.Html) return 'html';
  if (type === RbContentType.UnsafeMarkdown) return 'unsafe-markdown';
  return 'markdown';
}

export function rbtContentBlockValue(block: RbtContentBlock, index = 0): RbContentBlock {
  return {
    id: block.id,
    sort: block.sort ?? index,
    content: block.content ?? '',
    content_type: rbtContentTypeValue(block.contentType),
    revision: block.revision,
    content_url: block.contentUrl,
  };
}

export function rbtContentBlock(block: RbContentBlock): RbtContentBlock {
  return {
    id: block.id,
    sort: block.sort,
    contentType: rbtContentType(block.content_type),
    revision: block.revision,
    content: block.content,
    contentUrl: block.content_url,
  };
}
