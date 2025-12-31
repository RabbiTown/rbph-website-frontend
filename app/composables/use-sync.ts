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
      if (data.type && data.data) {
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
