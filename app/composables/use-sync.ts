type Listener<T> = (msg: SyncMessage<T>) => void;
type CloseListener = (event: CloseEvent) => void;
export type SyncConnectionState = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'limited' | 'unsupported';

const listeners: { [K in SyncMessageType]?: Listener<SyncMessageMap[K]>[] } = {};
const closeListeners: CloseListener[] = [];

const clientId = crypto.randomUUID();
const wsOnline = ref(false);
const syncSupported = ref(import.meta.client && typeof SharedWorker !== 'undefined');
const connectionState = ref<SyncConnectionState>('idle');
const sharedClientCount = ref(0);
const endpoint = ref<string>();
const stateChangedAt = ref(Date.now());
const lastClose = ref<{ code: number; reason: string; wasClean: boolean; at: number }>();
let worker: SharedWorker | undefined;
let workerHeartbeat: number | undefined;
let shouldConnect = false;

function socketUrl() {
  const url = new URL(buildUrl('/sync'), window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

function handleWorkerMessage(event: MessageEvent<SyncWorkerResponse>) {
  const message = event.data;
  if (message.type === 'status') {
    sharedClientCount.value = message.clientCount;
    wsOnline.value = shouldConnect && message.online;
    if (shouldConnect) {
      if (message.connectionLimited) connectionState.value = 'limited';
      else if (message.online) connectionState.value = 'online';
    }
  } else if (message.type === 'message' && shouldConnect) {
    try {
      const data = JSON.parse(message.data);
      if (data.type) {
        const type = data.type in SyncMessageType ? (data.type as SyncMessageType) : SyncMessageType.Unknown;
        (listeners[type] ?? []).forEach(listener => listener(data));
      }
    } catch {
      /* ignored */
    }
  } else if (message.type === 'close' && shouldConnect) {
    lastClose.value = {
      code: message.code,
      reason: message.reason,
      wasClean: message.wasClean,
      at: Date.now(),
    };
    connectionState.value = message.code === SYNC_CONNECTION_LIMIT_CLOSE_CODE ? 'limited' : 'reconnecting';
    closeListeners.forEach(listener =>
      listener(
        new CloseEvent('close', {
          code: message.code,
          reason: message.reason,
          wasClean: message.wasClean,
        }),
      ),
    );
  } else if (message.type === 'error') {
    console.error(message.message);
  }
}

function ensureWorker() {
  if (worker) return true;
  if (!syncSupported.value) return false;

  try {
    worker = new SharedWorker(new URL('../workers/sync.shared-worker.ts', import.meta.url), {
      name: 'rbph-sync',
      type: 'module',
    });
    worker.port.onmessage = handleWorkerMessage;
    worker.onerror = event => {
      console.error('Shared sync worker error', event);
      syncSupported.value = false;
      wsOnline.value = false;
      connectionState.value = 'unsupported';
    };
    worker.port.start();
    return true;
  } catch (error) {
    console.error('Shared sync worker unavailable', error);
    syncSupported.value = false;
    connectionState.value = 'unsupported';
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

watch(connectionState, () => (stateChangedAt.value = Date.now()));

function disconnect() {
  shouldConnect = false;
  wsOnline.value = false;
  connectionState.value = 'idle';
  if (workerHeartbeat) window.clearInterval(workerHeartbeat);
  workerHeartbeat = undefined;
  worker?.port.postMessage({ type: 'disconnect', clientId } satisfies SyncWorkerRequest);
}

function connect() {
  if (shouldConnect) return;
  shouldConnect = true;
  connectionState.value = syncSupported.value ? 'connecting' : 'unsupported';
  if (!ensureWorker()) return;
  registerClient();
  workerHeartbeat = window.setInterval(registerClient, 30_000);
}

function reconnect() {
  if (!shouldConnect || !worker || connectionState.value !== 'limited') return;
  connectionState.value = 'connecting';
  worker.port.postMessage({ type: 'reconnect', clientId } satisfies SyncWorkerRequest);
}

if (import.meta.client) {
  window.addEventListener('pagehide', event => {
    if (!event.persisted) disconnect();
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
