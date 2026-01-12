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
