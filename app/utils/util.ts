import type { Toast } from '@nuxt/ui/runtime/composables/useToast.js';

export function getRbErrorCode(error: unknown) {
  const my = error as { data?: { code?: number; hint?: string; message?: string } };
  return my.data?.code;
}

export function handleError(error: unknown, title: string, useHint: boolean = false) {
  useToast().add(getErrorToast(error, title, useHint));
}

export function getErrorToast(error: unknown, title: string, useHint: boolean = false): Partial<Toast> {
  const my = error as { data?: { code?: number; hint?: string; message?: string } };
  const fallback = error instanceof Error ? error.message : String(error);
  const message = useHint ? my?.data?.hint : my?.data?.message ?? fallback;
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
