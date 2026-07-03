export const SYNC_CONNECTION_LIMIT_CLOSE_CODE = 4008;

export type SyncWorkerRequest =
  | { type: 'connect'; clientId: string; url: string }
  | { type: 'reconnect'; clientId: string }
  | { type: 'disconnect'; clientId: string };

export type SyncWorkerResponse =
  | { type: 'status'; online: boolean; connectionLimited: boolean; clientCount: number }
  | { type: 'message'; data: string }
  | { type: 'close'; code: number; reason: string; wasClean: boolean }
  | { type: 'error'; message: string };
