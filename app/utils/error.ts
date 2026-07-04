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

export const defaultErrorHints: Record<number, string> = {
  [RbErrorCode.ServiceUnavailable]: '认证服务暂时不可用，请稍后重试。',
  [RbErrorCode.TooManyRequests]: '操作过于频繁，请稍后重试。',
  [RbErrorCode.CaptchaUnavailable]: '验证码服务暂时不可用。',
  [RbErrorCode.CaptchaInvalid]: '验证码验证失败，请重试。',
  [RbErrorCode.Maintenance]: '系统正在维护。',
  [RbErrorCode.NotFound]: '请求的资源不存在。',
  [RbErrorCode.Forbidden]: '权限不足。',
  [RbErrorCode.Unauthorized]: '登录失效，请重新登录。',
  [RbErrorCode.InternalServerError]: '出现内部错误，请联系管理员。',
  [RbErrorCode.PasswordChangeRequired]: '必须先修改临时密码。',
};
