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
  const message = forceHint ? my?.data?.hint : my?.data?.message ?? fallback;
  const codeExt = my.data?.code ? ` (${my.data?.code})` : '';
  const description = message ? message + codeExt : undefined;

  return {
    title,
    description,
    icon: 'material-symbols:error-med-outline-rounded',
    color: 'error',
  };
}

export function formatDate(_date: Date | string | undefined) {
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

export function intPrecString(num: number, prec: number): string {
  const str = num.toString();
  if (prec === 0) return str; // 精度为 0

  const len = str.length;
  if (len > prec) {
    const intPart = str.slice(0, len - prec);
    const decPart = str.slice(len - prec);
    return `${intPart}.${decPart}`;
  } else {
    const zeros = '0'.repeat(prec - len);
    return `0.${zeros}${str}`;
  }
}
