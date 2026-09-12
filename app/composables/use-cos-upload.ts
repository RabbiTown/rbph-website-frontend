export interface CosLimits {
  direct: boolean;
  max_file_bytes: number;
  max_group_bytes: number;
  max_files: number;
}

export enum CosUploadPurpose {
  Asset = 0,
  Theme = 1,
}

export enum CosUploadMode {
  File = 0,
  Group = 1,
}

export enum CosUploadState {
  Uploading = 0,
  Confirming = 1,
  Failed = 2,
  Complete = 3,
  Cancelled = 4,
  Cleaned = 5,
}

export interface UploadBackend {
  backend: string;
  public_read: boolean;
  recommended: boolean;
  direct_upload: boolean;
  direct_upload_limits?: CosLimits;
}

interface Spec {
  relative_path: string;
  size: number;
  mime_type: string;
}

interface Request {
  request_id: string;
  purpose: CosUploadPurpose;
  mode: CosUploadMode;
  game_id: number;
  puzzle_id?: number;
  round_id?: number;
  backend: string;
  original_name: string;
  source_sha256: string;
  source_size: number;
  files: Spec[];
}

interface FileState {
  complete: boolean;
  completing: boolean;
  sha256?: string;
}

export interface CosTask {
  id: string;
  state: CosUploadState;
  request: Request;
  files: FileState[];
  completed_files?: number;
  error?: string;
  result?: unknown;
}

export type CosTaskSummary = Omit<CosTask, 'files'> & { files?: FileState[] };

interface Part {
  PartNumber: number;
  ETag: string;
  Size: number;
}

interface StartOptions {
  purpose: CosUploadPurpose;
  mode: CosUploadMode;
  game_id: number;
  puzzle_id?: number;
  round_id?: number;
  backend: UploadBackend;
}

const root = '/admin/assets/uploads';

// The backend is authoritative; this small local index also preserves an idempotency
// key when the create response is lost. Files and signing credentials are never stored.
async function localKey(key: string, candidate: string, replace = false): Promise<string> {
  return new Promise(resolve => {
    const open = indexedDB.open('rbph-cos-uploads', 1);

    open.onupgradeneeded = () => open.result.createObjectStore('tasks');
    open.onerror = () => resolve(candidate);

    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const read = store.get(key);

      let value = candidate;

      read.onsuccess = () => {
        value = replace ? candidate : (read.result ?? candidate);
        store.put(value, key);
      };

      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };

      tx.onerror = () => {
        db.close();
        resolve(candidate);
      };
    };
  });
}

export function useCosUpload() {
  const upload = createCosUpload(useApi());

  onBeforeUnmount(upload.dispose);

  return upload;
}

export function createCosUpload(api: ReturnType<typeof useApi>) {
  const name = ref('');
  const phase = ref('');
  const bytes = ref(0);
  const total = ref(0);
  const completedFiles = ref(0);
  const totalFiles = ref(0);
  const speed = ref(0);
  const active = ref(false);
  const task = ref<CosTask>();
  const error = ref('');
  const tasks = ref<CosTaskSummary[]>([]);

  let worker: Worker | undefined;
  let controller: AbortController | undefined;
  let selected: File | undefined;
  let options: StartOptions | undefined;

  let speedTimer: ReturnType<typeof setInterval> | undefined;
  let transferredBytes = 0;

  let rpcId = 0;
  const calls = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();

  let partHandler: ((message: { id: number; file_id: number; part_number: number; content_md5: string; md5: string; bytes: Uint8Array<ArrayBuffer> }) => Promise<void>) | undefined;

  function stopSpeed() {
    clearInterval(speedTimer);
    speedTimer = undefined;
    speed.value = 0;
  }

  function startSpeed() {
    stopSpeed();
    transferredBytes = 0;

    const samples = [{ time: performance.now(), bytes: 0 }];

    speedTimer = setInterval(() => {
      const now = performance.now();
      samples.push({ time: now, bytes: transferredBytes });

      while (samples.length > 2 && samples[1]!.time <= now - 5000) samples.shift();

      const first = samples[0]!;
      speed.value = ((transferredBytes - first.bytes) * 1000) / Math.max(1, now - first.time);
    }, 1000);
  }

  function stopWorker() {
    worker?.terminate();
    worker = undefined;

    for (const call of calls.values()) call.reject(new Error('Upload paused'));

    calls.clear();
  }

  function rpc<T>(message: Record<string, unknown>): Promise<T> {
    const rpc = ++rpcId;

    return new Promise((resolve, reject) => {
      calls.set(rpc, { resolve: value => resolve(value as T), reject });
      worker!.postMessage({ ...message, rpc });
    });
  }

  function initWorker() {
    worker = new Worker(new URL('../workers/cos-upload.worker.ts', import.meta.url), { type: 'module' });

    worker.onerror = () => {
      for (const call of calls.values()) call.reject(new Error('Upload worker failed'));
      calls.clear();
    };

    worker.onmessage = ({ data }) => {
      if (data.type === 'preparing') {
        bytes.value = data.bytes;
        total.value = data.total;
      } else if (data.type === 'part') {
        const current = worker;

        void partHandler!(data).then(
          () => current?.postMessage({ type: 'ack', id: data.id }),
          e => current?.postMessage({ type: 'ack', id: data.id, error: e instanceof Error ? e.message : String(e) }),
        );
      } else {
        const call = calls.get(data.rpc);
        calls.delete(data.rpc);

        if (data.type === 'error') call?.reject(new Error(data.error));
        else call?.resolve(data.result);
      }
    };
  }

  async function retry<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();

      try {
        return await operation();
      } catch (e) {
        if (signal.aborted || attempt >= 3) throw e;

        await new Promise<void>((resolve, reject) => {
          const abort = () => {
            clearTimeout(timer);
            reject(new Error('Upload paused'));
          };

          const timer = setTimeout(
            () => {
              signal.removeEventListener('abort', abort);
              resolve();
            },
            500 * 2 ** attempt + Math.random() * 200,
          );

          signal.addEventListener('abort', abort, { once: true });
        });
      }
    }
  }

  async function loadTasks(game: number, purpose: CosUploadPurpose, puzzle?: number, round?: number) {
    const response = await api.get<{ uploads: CosTaskSummary[] }>(root, { query: { game_id: game } });

    tasks.value = response.data.uploads.filter(t => t.request.purpose === purpose && (t.request.puzzle_id ?? undefined) === puzzle && (t.request.round_id ?? undefined) === round);
  }

  async function start(file: File, supplied: StartOptions, resumeId?: string) {
    if (active.value) return;

    selected = file;
    options = supplied;

    name.value = file.name;
    bytes.value = 0;
    total.value = 0;
    completedFiles.value = 0;
    totalFiles.value = 0;
    stopSpeed();

    active.value = true;
    error.value = '';
    phase.value = 'preparing';

    if (!resumeId) task.value = undefined;

    let localIndexKey: string | undefined;

    controller = new AbortController();
    const signal = controller.signal;

    initWorker();

    try {
      const limits = supplied.backend.direct_upload_limits;
      if (!limits) throw new Error('Missing upload limits');

      // Backend settings can be Vue proxies; send only plain values across the Worker boundary.
      const prepared = await rpc<{ specs: Spec[]; source_sha256: string; source_size: number }>({
        type: 'prepare',
        file,
        archive: supplied.mode === CosUploadMode.Group,
        limits: {
          max_file_bytes: limits.max_file_bytes,
          max_group_bytes: limits.max_group_bytes,
          max_files: limits.max_files,
        },
      });
      signal.throwIfAborted();

      localIndexKey = JSON.stringify([supplied.purpose, supplied.mode, supplied.game_id, supplied.puzzle_id, supplied.round_id, supplied.backend.backend, prepared.source_sha256]);

      if (resumeId) {
        task.value = (await retry(() => api.get<CosTask>(`${root}/${resumeId}`), signal)).data;
        if (task.value.request.source_sha256 !== prepared.source_sha256 || task.value.request.source_size !== file.size) throw new Error('Selected file does not match the original upload');
      } else {
        // Reuse any existing server task before allocating a new request ID.
        const pending = (await api.get<{ uploads: CosTaskSummary[] }>(root, { query: { game_id: supplied.game_id } })).data.uploads;
        const match = pending.find(
          t =>
            t.request.source_sha256 === prepared.source_sha256 &&
            t.request.backend === supplied.backend.backend &&
            t.request.purpose === supplied.purpose &&
            t.request.mode === supplied.mode &&
            (t.request.puzzle_id ?? undefined) === supplied.puzzle_id &&
            (t.request.round_id ?? undefined) === supplied.round_id,
        );

        if (match) task.value = (await retry(() => api.get<CosTask>(`${root}/${match.id}`), signal)).data;
        else {
          const key = localIndexKey;
          const requestId = await localKey(key, crypto.randomUUID());
          const request: Request = {
            request_id: requestId,
            purpose: supplied.purpose,
            mode: supplied.mode,
            game_id: supplied.game_id,
            puzzle_id: supplied.puzzle_id,
            round_id: supplied.round_id,
            backend: supplied.backend.backend,
            original_name: file.name,
            source_sha256: prepared.source_sha256,
            source_size: file.size,
            files: prepared.specs,
          };

          task.value = (await retry(() => api.post<CosTask>(root, request), signal)).data;

          if ([CosUploadState.Complete, CosUploadState.Cleaned, CosUploadState.Cancelled].includes(task.value.state)) {
            request.request_id = await localKey(key, crypto.randomUUID(), true);
            task.value = (await retry(() => api.post<CosTask>(root, request), signal)).data;
          }
        }
      }

      const current = task.value;
      if (current.request.files.length !== prepared.specs.length || current.request.files.some((f, i) => f.relative_path !== prepared.specs[i]?.relative_path || f.size !== prepared.specs[i]?.size)) throw new Error('File manifest changed');

      totalFiles.value = prepared.specs.length;
      completedFiles.value = current.files.filter(file => file.complete).length;

      total.value = prepared.specs.reduce((n, f) => n + f.size, 0);
      bytes.value = 0;
      phase.value = 'uploading';
      startSpeed();

      for (let index = 0; index < prepared.specs.length && current.state !== CosUploadState.Complete && current.state !== CosUploadState.Confirming; index++) {
        signal.throwIfAborted();

        if (current.files[index]?.complete) {
          bytes.value += prepared.specs[index]!.size;
          continue;
        }

        const path = `${root}/${current.id}/files/${index}`;
        const status = (await retry(() => api.get<{ parts: Part[]; file: FileState }>(`${path}/parts`), signal)).data;

        if (status.file.complete) {
          completedFiles.value++;
          bytes.value += prepared.specs[index]!.size;
          continue;
        }

        if (status.file.completing && status.file.sha256) {
          await retry(() => api.post(`${path}/complete`, { sha256: status.file.sha256 }, { timeout: 660000 }), signal);
          completedFiles.value++;
          bytes.value += prepared.specs[index]!.size;
          continue;
        }

        const known = new Map(status.parts.map(p => [p.PartNumber, p]));

        partHandler = async message => {
          const old = known.get(message.part_number);

          if (old && old.Size === message.bytes.length && old.ETag.replaceAll('"', '').toLowerCase() === message.md5) {
            bytes.value += message.bytes.length;
            return;
          }

          await retry(async () => {
            const signed = (await api.post<{ part: { url: string; authorization: string; content_md5: string } }>(`${path}/parts`, { part_number: message.part_number, content_md5: message.content_md5 })).data.part;

            signal.throwIfAborted();

            const response = await fetch(signed.url, { method: 'PUT', body: message.bytes, credentials: 'omit', signal, headers: { Authorization: signed.authorization, 'Content-MD5': signed.content_md5 } });
            if (!response.ok) throw new Error(`COS upload failed (${response.status})`);
          }, signal);

          signal.throwIfAborted();
          transferredBytes += message.bytes.length;
          bytes.value += message.bytes.length;
        };

        const digest = await rpc<{ sha256: string }>({ type: 'read', index });
        await retry(() => api.post(`${path}/complete`, digest, { timeout: 660000 }), signal);
        current.files[index] = { complete: true, completing: true, sha256: digest.sha256 };
        completedFiles.value++;
      }

      stopSpeed();
      phase.value = 'confirming';
      task.value = (await retry(() => api.post<CosTask>(`${root}/${current.id}/complete`), signal)).data;

      while (task.value.state === CosUploadState.Confirming) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        signal.throwIfAborted();
        task.value = (await retry(() => api.get<CosTask>(`${root}/${current.id}`), signal)).data;
      }

      if (task.value.state !== CosUploadState.Complete) throw new Error(task.value.error || 'Upload confirmation failed');

      completedFiles.value = totalFiles.value;
      bytes.value = total.value;
      phase.value = 'complete';

      if (localIndexKey) await localKey(localIndexKey, crypto.randomUUID(), true);

      tasks.value = tasks.value.filter(t => t.id !== current.id);
    } catch (e) {
      if (signal.aborted) phase.value = 'paused';
      else {
        phase.value = 'failed';
        error.value = e instanceof Error ? e.message : String(e);
      }

      throw e;
    } finally {
      stopSpeed();
      controller.abort();
      stopWorker();
      active.value = false;
    }
  }

  function pause() {
    stopSpeed();
    controller?.abort();
    stopWorker();
    phase.value = 'paused';
  }

  async function cancel(id = task.value?.id) {
    pause();

    if (id) await retry(() => api.del(`${root}/${id}`), new AbortController().signal);
    if (task.value?.id === id) task.value = undefined;

    tasks.value = tasks.value.filter(t => t.id !== id);
    phase.value = '';
  }

  async function resume() {
    if (selected && options) await start(selected, options, task.value?.id);
  }

  function dispose() {
    stopSpeed();
    controller?.abort();
    stopWorker();
    selected = undefined;
  }

  function reportError(e: unknown) {
    error.value = e instanceof Error ? e.message : String(e);
  }

  return { name, phase, bytes, total, completedFiles, totalFiles, speed, active, task, error, tasks, dispose, reportError, start, pause, cancel, resume, loadTasks };
}
