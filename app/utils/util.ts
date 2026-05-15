import type { Toast } from '@nuxt/ui/runtime/composables/useToast.js';

export function getRbErrorCode(error: unknown) {
  const my = error as { data?: { code?: number; hint?: string; message?: string } };
  return my.data?.code;
}

export function handleError(error: unknown, title: string, forceHint: boolean = false) {
  useToast().add(getErrorToast(error, title, forceHint));
}

export function getErrorToast(error: unknown, title: string, forceHint: boolean = false): Partial<Toast> {
  const my = error as { data?: { code?: number; hint?: string; message?: string } };
  const fallback = error instanceof Error ? error.message : String(error);
  const message = forceHint ? my?.data?.hint : (my?.data?.message ?? fallback);
  const codeExt = my.data?.code ? ` (${my.data?.code})` : '';
  const description = message ? message + codeExt : undefined;

  return {
    title,
    description,
    icon: 'material-symbols:error-med-outline-rounded',
    color: 'error',
  };
}

export function formatDate(_date: Date | string | number | null | undefined = undefined) {
  const date = new Date(_date || Date.now());
  return date.toLocaleString();
}

export function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

export function intPrecString(num: number, prec: number, keepPlus: boolean = false, pad: string = ''): string {
  const isNeg = num < 0;
  const absStr = Math.abs(num).toString();

  let result: string;

  if (prec === 0) {
    result = absStr;
  } else {
    const len = absStr.length;

    if (len > prec) {
      const intPart = absStr.slice(0, len - prec);
      const decPart = absStr.slice(len - prec);
      result = `${intPart}.${decPart}`;
    } else {
      const zeros = '0'.repeat(prec - len);
      result = `0.${zeros}${absStr}`;
    }
  }

  return isNeg ? `-${pad}${result}` : keepPlus ? `+${pad}${result}` : result;
}

export function buildUrl(path: string) {
  const config = useRuntimeConfig();
  return /^https?:/i.test(path) ? path : `${config.public.apiBase ?? ''}${path}`;
}

export function arrayRemove<T>(arr: T[] | undefined, item: T): T | undefined {
  if (arr) {
    const idx = arr.indexOf(item);
    if (idx >= 0) {
      return arr.splice(idx, 1)[0];
    }
  }
  return undefined;
}

export interface TitlePart {
  text?: string;
  sep?: string;
  end?: string;
}

export function buildTitleParts(parts: TitlePart[]) {
  return parts
    .filter(p => p && p.text)
    .map(p => `${p.sep ?? ''}${p.text}${p.end ?? ''}`)
    .join('');
}
