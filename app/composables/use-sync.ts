type Listener<T> = (msg: SyncMessage<T>) => void;
type CloseListener = (event: CloseEvent) => void;

let ws: WebSocket | null = null;

const listeners: { [K in SyncMessageType]?: Listener<SyncMessageMap[K]>[] } = {};
const closeListeners: CloseListener[] = [];

let heartbeatTimer: number | null = null;

let autoReconnect = false;
const wsOnline = ref(false);

function disconnect() {
  autoReconnect = false;
  ws?.close();
}

function connect() {
  if (ws) return;

  ws = new WebSocket(buildUrl('/sync'));

  ws.onopen = () => {
    startHeartBeat();
  };

  ws.onclose = event => {
    ws = null;
    stopHeartbeat();
    closeListeners.forEach(l => l(event));

    if (autoReconnect) {
      setTimeout(() => {
        connect();
      }, 5000);
    }
  };

  ws.onerror = err => {
    console.error('WebSocket error', err);
  };

  ws.onmessage = ev => {
    try {
      const data = JSON.parse(ev.data);
      if (data.type) {
        const type = data.type in SyncMessageType ? (data.type as SyncMessageType) : SyncMessageType.Unknown;
        (listeners[type] ?? []).forEach(l => l(data));
      }
    } catch {
      /* ignored */
    }
  };

  autoReconnect = true;
}

function startHeartBeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = window.setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({}));
    }
  }, 30_000);
  wsOnline.value = true;
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  wsOnline.value = false;
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
    connect,
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
