export interface RbError {
  code: number;
  message?: string;
}

export enum RbErrorCode {
  NotFound = -104,
  Forbidden = -103,
  Unauthorized = -101,
  InternalServerError = -100,
}

export const defaultErrorHints: Record<number, string> = {
  [RbErrorCode.NotFound]: '请求的资源不存在。',
  [RbErrorCode.Forbidden]: '权限不足。',
  [RbErrorCode.Unauthorized]: '登录失效，请重新登录。',
  [RbErrorCode.InternalServerError]: '出现内部错误，请联系管理员。',
};
