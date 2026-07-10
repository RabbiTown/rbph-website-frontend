export interface RbError {
  code: number;
  message?: string;
  retry_after?: number;
}

export enum RbErrorCode {
  ServiceUnavailable = -111,
  TooManyRequests = -110,
  CaptchaUnavailable = -109,
  CaptchaInvalid = -108,
  Maintenance = -107,
  PasswordChangeRequired = -106,
  NotFound = -104,
  Forbidden = -103,
  Unauthorized = -101,
  InternalServerError = -100,
}

const defaultErrorHintKeys: Record<number, string> = {
  [RbErrorCode.ServiceUnavailable]: 'errors.serviceUnavailable',
  [RbErrorCode.TooManyRequests]: 'errors.tooManyRequests',
  [RbErrorCode.CaptchaUnavailable]: 'errors.captchaUnavailable',
  [RbErrorCode.CaptchaInvalid]: 'errors.captchaInvalid',
  [RbErrorCode.Maintenance]: 'errors.maintenance',
  [RbErrorCode.NotFound]: 'errors.notFound',
  [RbErrorCode.Forbidden]: 'errors.forbidden',
  [RbErrorCode.Unauthorized]: 'errors.unauthorized',
  [RbErrorCode.InternalServerError]: 'errors.internalServerError',
  [RbErrorCode.PasswordChangeRequired]: 'errors.passwordChangeRequired',
};

export function defaultErrorHint(code: number | undefined, t?: (key: string) => string) {
  if (code === undefined) return undefined;
  const key = defaultErrorHintKeys[code];
  return key ? (t ? t(key) : key) : undefined;
}
