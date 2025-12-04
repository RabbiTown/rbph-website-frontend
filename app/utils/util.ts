const MS_IN_SECOND = 1000;
const MS_IN_MINUTE = 60 * MS_IN_SECOND;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;

export type OffsetDateTimeTuple = [year: number, ordinalDay: number, hour: number, minute: number, second: number, nanosecond: number, offsetHour: number, offsetMinute: number, offsetSecond: number];

export function odt2Date(tuple?: OffsetDateTimeTuple): Date {
  if (!tuple) {
    return new Date(0);
  }

  const [year, ordinalDay, hour, minute, second, nanosecond, offsetHour, offsetMinute, offsetSecond] = tuple;

  if (ordinalDay < 1 || ordinalDay > 366) {
    throw new RangeError('Ordinal day must be between 1 and 366');
  }

  const utcStartOfYear = Date.UTC(year, 0, 1);
  const daysMs = (ordinalDay - 1) * MS_IN_DAY;
  const timeMs = hour * MS_IN_HOUR + minute * MS_IN_MINUTE + second * MS_IN_SECOND + Math.floor(nanosecond / 1_000_000);
  const offsetMs = offsetHour * MS_IN_HOUR + offsetMinute * MS_IN_MINUTE + offsetSecond * MS_IN_SECOND;

  return new Date(utcStartOfYear + daysMs + timeMs - offsetMs);
}

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
