/// <reference lib="webworker" />

import { SYNC_CONNECTION_LIMIT_CLOSE_CODE, type SyncWorkerRequest, type SyncWorkerResponse } from '../utils/sync-worker';

interface SyncClient {
  port: MessagePort;
  lastSeen: number;
}

const CLIENT_TIMEOUT = 120_000;
const CLIENT_CLEANUP_INTERVAL = 30_000;
const SOCKET_HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_DELAY = 5_000;

const clients = new Map<string, SyncClient>();
let socket: WebSocket | null = null;
let socketUrl: string | null = null;
let socketHeartbeat: ReturnType<typeof setInterval> | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let online = false;
let connectionLimited = false;

function send(port: MessagePort, message: SyncWorkerResponse) {
  port.postMessage(message);
}

function broadcast(message: SyncWorkerResponse) {
  clients.forEach(client => send(client.port, message));
}

function status(): SyncWorkerResponse {
  return { type: 'status', online, connectionLimited, clientCount: clients.size };
}

function broadcastStatus() {
  broadcast(status());
}

function setOnline(value: boolean) {
  if (online === value) return;
  online = value;
  broadcastStatus();
}

function clearSocketHeartbeat() {
  if (socketHeartbeat) clearInterval(socketHeartbeat);
  socketHeartbeat = undefined;
}

function clearReconnectTimer() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = undefined;
}

function closeSocket() {
  clearReconnectTimer();
  clearSocketHeartbeat();
  const current = socket;
  socket = null;
  connectionLimited = false;
  setOnline(false);
  current?.close(1000, 'No active clients');
}

function scheduleReconnect() {
  if (reconnectTimer || connectionLimited || !clients.size || !socketUrl) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connectSocket();
  }, RECONNECT_DELAY);
}

function connectSocket() {
  if (socket || connectionLimited || !clients.size || !socketUrl) return;

  const current = new WebSocket(socketUrl);
  socket = current;
  current.onopen = () => {
    if (socket !== current) return;
    setOnline(true);
    clearSocketHeartbeat();
    socketHeartbeat = setInterval(() => {
      if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({}));
    }, SOCKET_HEARTBEAT_INTERVAL);
  };
  current.onmessage = event => {
    if (socket === current && typeof event.data === 'string') {
      broadcast({ type: 'message', data: event.data });
    }
  };
  current.onerror = () => {
    if (socket === current) broadcast({ type: 'error', message: 'WebSocket error' });
  };
  current.onclose = event => {
    if (socket !== current) return;
    socket = null;
    clearSocketHeartbeat();
    online = false;
    connectionLimited = event.code === SYNC_CONNECTION_LIMIT_CLOSE_CODE;
    broadcast({
      type: 'close',
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    });
    broadcastStatus();
    scheduleReconnect();
  };
}

function registerClient(clientId: string, port: MessagePort, url: string) {
  clients.set(clientId, { port, lastSeen: Date.now() });
  broadcastStatus();

  if (socketUrl !== url) {
    socketUrl = url;
    if (socket) closeSocket();
  }
  connectSocket();
}

function removeClient(clientId: string) {
  clients.delete(clientId);
  if (!clients.size) closeSocket();
  else broadcastStatus();
}

function reconnect(clientId: string) {
  if (!clients.has(clientId)) return;
  connectionLimited = false;
  broadcastStatus();
  connectSocket();
}

setInterval(() => {
  const expiredBefore = Date.now() - CLIENT_TIMEOUT;
  clients.forEach((client, clientId) => {
    if (client.lastSeen < expiredBefore) clients.delete(clientId);
  });
  if (!clients.size) closeSocket();
}, CLIENT_CLEANUP_INTERVAL);

const workerScope = self as unknown as SharedWorkerGlobalScope;
workerScope.onconnect = event => {
  const port = event.ports[0];
  if (!port) return;

  port.onmessage = (message: MessageEvent<SyncWorkerRequest>) => {
    const request = message.data;
    if (request.type === 'connect') {
      registerClient(request.clientId, port, request.url);
    } else if (request.type === 'reconnect') {
      reconnect(request.clientId);
    } else if (request.type === 'disconnect') {
      removeClient(request.clientId);
    }
  };
  port.start();
};

export {};
