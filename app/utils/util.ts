export function getRbErrorCode(error: unknown) {
  const my = error as { data?: { code?: number; hint?: string; message?: string } };
  return my.data?.code;
}

export function handleError(error: unknown, title: string, useHint: boolean = false) {
  const my = error as { data?: { code?: number; hint?: string; message?: string } };
  const fallback = error instanceof Error ? error.message : String(error);
  const message = useHint ? my?.data?.hint : my?.data?.message ?? fallback;
  const codeExt = my.data?.code ? ` (${my.data?.code})` : '';

  useToast().add({
    title,
    description: message + codeExt,
    icon: 'material-symbols:error-med-outline-rounded',
    color: 'error',
  });
}
