type Listener<T> = (msg: SyncMessage<T>) => void;
type CloseListener = (event: CloseEvent) => void;
export type SyncConnectionState = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'limited' | 'unsupported';
export type SyncTransport = 'shared-worker' | 'direct';

const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_DELAY = 5_000;

const listeners: { [K in SyncMessageType]?: Listener<SyncMessageMap[K]>[] } = {};
const closeListeners: CloseListener[] = [];

const clientId = crypto.randomUUID();
const wsOnline = ref(false);
const syncSupported = ref(import.meta.client && typeof WebSocket !== 'undefined');
const connectionState = ref<SyncConnectionState>('idle');
const transport = ref<SyncTransport>();
const sharedClientCount = ref(0);
const endpoint = ref<string>();
const stateChangedAt = ref(Date.now());
const lastClose = ref<{ code: number; reason: string; wasClean: boolean; at: number }>();
let worker: SharedWorker | undefined;
let workerHeartbeat: number | undefined;
let sharedWorkerUnavailable = import.meta.client && typeof SharedWorker === 'undefined';
let directSocket: WebSocket | undefined;
let directHeartbeat: number | undefined;
let directReconnectTimer: number | undefined;
let directConnectionLimited = false;
let shouldConnect = false;

function socketUrl() {
  const url = new URL(buildUrl('/sync'), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function dispatchMessage(raw: string) {
  try {
    const data = JSON.parse(raw);
    if (data.type) {
      const type = data.type in SyncMessageType ? (data.type as SyncMessageType) : SyncMessageType.Unknown;
      (listeners[type] ?? []).forEach(listener => listener(data));
    }
  } catch {
    /* ignored */
  }
}

function notifyClose(event: Pick<CloseEvent, 'code' | 'reason' | 'wasClean'>) {
  lastClose.value = {
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
    at: Date.now(),
  };
  connectionState.value = event.code === SYNC_CONNECTION_LIMIT_CLOSE_CODE ? 'limited' : 'reconnecting';
  closeListeners.forEach(listener =>
    listener(
      new CloseEvent('close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      }),
    ),
  );
}

function handleWorkerMessage(event: MessageEvent<SyncWorkerResponse>) {
  if (transport.value !== 'shared-worker') return;
  const message = event.data;
  if (message.type === 'status') {
    sharedClientCount.value = message.clientCount;
    wsOnline.value = shouldConnect && message.online;
    if (shouldConnect) {
      if (message.connectionLimited) connectionState.value = 'limited';
      else if (message.online) connectionState.value = 'online';
    }
  } else if (message.type === 'message' && shouldConnect) {
    dispatchMessage(message.data);
  } else if (message.type === 'close' && shouldConnect) {
    notifyClose(message);
  } else if (message.type === 'error') {
    console.error(message.message);
  }
}

function ensureWorker() {
  if (worker) return true;
  if (sharedWorkerUnavailable) return false;

  try {
    worker = new SharedWorker(new URL('../workers/sync.shared-worker.ts', import.meta.url), {
      name: 'rbph-sync',
      type: 'module',
    });
    worker.port.onmessage = handleWorkerMessage;
    worker.onerror = event => {
      console.error('Shared sync worker error', event);
      fallbackToDirect();
    };
    worker.port.start();
    return true;
  } catch (error) {
    console.error('Shared sync worker unavailable', error);
    sharedWorkerUnavailable = true;
    worker?.port.close();
    worker = undefined;
    return false;
  }
}

function registerClient() {
  const url = socketUrl();
  endpoint.value = url;
  worker?.port.postMessage({
    type: 'connect',
    clientId,
    url,
  } satisfies SyncWorkerRequest);
}

function clearDirectHeartbeat() {
  if (directHeartbeat) window.clearInterval(directHeartbeat);
  directHeartbeat = undefined;
}

function clearDirectReconnectTimer() {
  if (directReconnectTimer) window.clearTimeout(directReconnectTimer);
  directReconnectTimer = undefined;
}

function closeDirectSocket() {
  clearDirectHeartbeat();
  clearDirectReconnectTimer();
  const current = directSocket;
  directSocket = undefined;
  current?.close(1000, 'Client disconnected');
}

function scheduleDirectReconnect() {
  if (directReconnectTimer || directConnectionLimited || !shouldConnect || transport.value !== 'direct') return;
  directReconnectTimer = window.setTimeout(() => {
    directReconnectTimer = undefined;
    connectDirectSocket();
  }, RECONNECT_DELAY);
}

function connectDirectSocket() {
  if (!shouldConnect || transport.value !== 'direct' || directSocket || directConnectionLimited) return;

  clearDirectReconnectTimer();
  const url = endpoint.value ?? socketUrl();
  endpoint.value = url;

  let current: WebSocket;
  try {
    current = new WebSocket(url);
  } catch (error) {
    console.error('Direct sync connection unavailable', error);
    connectionState.value = 'reconnecting';
    scheduleDirectReconnect();
    return;
  }

  directSocket = current;
  sharedClientCount.value = 1;
  current.onopen = () => {
    if (directSocket !== current) return;
    wsOnline.value = true;
    connectionState.value = 'online';
    clearDirectHeartbeat();
    directHeartbeat = window.setInterval(() => {
      if (current.readyState === WebSocket.OPEN) current.send(JSON.stringify({}));
    }, HEARTBEAT_INTERVAL);
  };
  current.onmessage = event => {
    if (directSocket === current && shouldConnect && typeof event.data === 'string') dispatchMessage(event.data);
  };
  current.onerror = () => {
    if (directSocket === current) console.error('Direct sync WebSocket error');
  };
  current.onclose = event => {
    if (directSocket !== current) return;
    directSocket = undefined;
    clearDirectHeartbeat();
    wsOnline.value = false;
    sharedClientCount.value = 0;
    if (!shouldConnect) return;

    directConnectionLimited = event.code === SYNC_CONNECTION_LIMIT_CLOSE_CODE;
    notifyClose(event);
    scheduleDirectReconnect();
  };
}

function fallbackToDirect() {
  sharedWorkerUnavailable = true;
  if (workerHeartbeat) window.clearInterval(workerHeartbeat);
  workerHeartbeat = undefined;
  if (shouldConnect && transport.value === 'shared-worker') {
    worker?.port.postMessage({ type: 'disconnect', clientId } satisfies SyncWorkerRequest);
  }
  worker?.port.close();
  worker = undefined;
  if (!shouldConnect || transport.value !== 'shared-worker') return;
  wsOnline.value = false;
  sharedClientCount.value = 0;
  transport.value = 'direct';
  connectionState.value = 'connecting';
  connectDirectSocket();
}

watch(connectionState, () => (stateChangedAt.value = Date.now()));

function disconnect() {
  shouldConnect = false;
  wsOnline.value = false;
  connectionState.value = 'idle';
  if (workerHeartbeat) window.clearInterval(workerHeartbeat);
  workerHeartbeat = undefined;
  if (transport.value === 'shared-worker') worker?.port.postMessage({ type: 'disconnect', clientId } satisfies SyncWorkerRequest);
  closeDirectSocket();
  directConnectionLimited = false;
  sharedClientCount.value = 0;
  transport.value = undefined;
}

function connect() {
  if (shouldConnect) return;
  shouldConnect = true;
  if (!syncSupported.value) {
    connectionState.value = 'unsupported';
    return;
  }

  connectionState.value = 'connecting';
  endpoint.value = socketUrl();
  if (ensureWorker()) {
    transport.value = 'shared-worker';
    registerClient();
    workerHeartbeat = window.setInterval(registerClient, HEARTBEAT_INTERVAL);
  } else {
    transport.value = 'direct';
    connectDirectSocket();
  }
}

function reconnect() {
  if (!shouldConnect || connectionState.value !== 'limited') return;
  connectionState.value = 'connecting';
  if (transport.value === 'shared-worker') {
    worker?.port.postMessage({ type: 'reconnect', clientId } satisfies SyncWorkerRequest);
  } else if (transport.value === 'direct') {
    directConnectionLimited = false;
    connectDirectSocket();
  }
}

function resumeConnection() {
  if (!shouldConnect) return;
  if (transport.value === 'shared-worker') {
    registerClient();
  } else if (transport.value === 'direct' && !directSocket && !directConnectionLimited) {
    connectionState.value = 'connecting';
    connectDirectSocket();
  }
}

if (import.meta.client) {
  window.addEventListener('pagehide', event => {
    if (!event.persisted) disconnect();
  });
  window.addEventListener('online', resumeConnection);
  window.addEventListener('pageshow', resumeConnection);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeConnection();
  });
}

export function useSync() {
  function listen<T extends SyncMessageType>(msg: T, callback: Listener<SyncMessageMap[T]>) {
    if (!listeners[msg]) listeners[msg] = [];
    listeners[msg].push(callback);

    onUnmounted(() => {
      arrayRemove(listeners[msg], callback);
    });
  }

  function listenClose(callback: CloseListener) {
    closeListeners.push(callback);

    onUnmounted(() => {
      arrayRemove(closeListeners, callback);
    });
  }

  return {
    listen,
    listenClose,
    online: wsOnline,
    supported: syncSupported,
    state: connectionState,
    debug: {
      clientId,
      endpoint,
      transport,
      sharedClientCount,
      stateChangedAt,
      lastClose,
    },
    connect,
    reconnect,
    disconnect,
  };
}

class SyncTime {
  serverTime: number = NaN;
  localTime: number = 0;

  currentTimeRef: Ref<number> = ref(Date.now());

  timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  intervalId: ReturnType<typeof setTimeout> | undefined = undefined;

  syncWith(server_time: Date) {
    this.serverTime = server_time.getTime();
    this.localTime = Date.now();
    this.updateCurrentTimeRef();
    this.startAutoUpdate();
  }

  calcCurrentTime() {
    if (isNaN(this.serverTime)) {
      return Date.now();
    } else {
      return this.serverTime + Date.now() - this.localTime;
    }
  }

  updateCurrentTimeRef() {
    this.currentTimeRef.value = this.calcCurrentTime();
  }

  startAutoUpdate() {
    this.stopAutoUpdate();

    const current = this.calcCurrentTime();
    const nextMs = 60000 - (current % 60000);
    this.timeoutId = setTimeout(() => {
      this.updateCurrentTimeRef();
      this.intervalId = setInterval(() => this.updateCurrentTimeRef(), 60000);
    }, nextMs);
  }

  stopAutoUpdate() {
    clearTimeout(this.timeoutId);
    clearInterval(this.intervalId);
  }
}

const syncTime = new SyncTime();

export function useSyncTime() {
  return syncTime;
}

export function useCurrentTimeSec() {
  useSyncTime().updateCurrentTimeRef();

  const syncTime = useSyncTime().currentTimeRef;

  const currentTime = ref(syncTime.value);

  watch(syncTime, val => {
    currentTime.value = val;
  });

  const timer = setInterval(() => {
    currentTime.value += 1000;
  }, 1000);

  onUnmounted(() => clearInterval(timer));

  return currentTime;
}
