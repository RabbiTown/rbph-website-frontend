import { BlobReader, ZipReader, type FileEntry } from '@zip.js/zip.js';
import { createSHA256, md5 } from 'hash-wasm';

const partBytes = 8 * 1024 * 1024;

interface Limits {
  max_file_bytes: number;
  max_group_bytes: number;
  max_files: number;
}

interface Spec {
  relative_path: string;
  size: number;
  mime_type: string;
}

let source: File;
let entries: FileEntry[] | undefined;
let reader: ZipReader<Blob> | undefined;
let specs: Spec[] = [];
let limits: Limits;

let sequence = 0;
const acknowledgements = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();

const send = (data: unknown, transfer: Transferable[] = []) => postMessage(data, { transfer });

function mime(path: string) {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  const types: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    mjs: 'text/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    txt: 'text/plain',
    pdf: 'application/pdf',
    zip: 'application/zip',
  };

  return types[extension] ?? 'application/octet-stream';
}

function validatePath(path: string) {
  if (!path || [...path].length > 1024 || path !== path.trim() || (/[\\:]/.test(path) || [...path].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid archive path');
}

async function prepare(file: File, archive: boolean, suppliedLimits: Limits) {
  await reader?.close();
  reader = undefined;
  entries = undefined;
  specs = [];

  source = file;
  limits = suppliedLimits;
  if (source.size > (archive ? limits.max_group_bytes : limits.max_file_bytes)) throw new Error('Upload exceeds size limit');

  const hash = await createSHA256();
  let processed = 0;
  const input = source.stream().getReader();

  for (;;) {
    const { value, done } = await input.read();
    if (done) break;

    hash.update(value);
    processed += value.length;
    send({ type: 'preparing', bytes: processed, total: source.size });
  }

  if (archive) {
    reader = new ZipReader(new BlobReader(source), { useWebWorkers: false });
    entries = [];

    // Iterate the central directory with a count limit instead of allocating every entry.
    let directoryEntries = 0;

    for await (const entry of reader.getEntriesGenerator()) {
      if (++directoryEntries > limits.max_files * 4) throw new Error('Too many ZIP entries');
      if (entry.encrypted || entry.symlink) throw new Error('Encrypted archives and symbolic links are unsupported');
      if (entry.directory) continue;
      if (entries.length >= limits.max_files) throw new Error('Too many files');

      entries.push(entry);
    }

    specs = entries.map(entry => ({ relative_path: entry.filename, size: entry.uncompressedSize, mime_type: mime(entry.filename) }));
  } else {
    specs = [{ relative_path: source.name, size: source.size, mime_type: source.type || mime(source.name) }];
  }

  if (!specs.length) throw new Error('Archive is empty');

  const paths = new Set<string>();
  let total = 0;

  for (const spec of specs) {
    validatePath(spec.relative_path);
    if (paths.has(spec.relative_path)) throw new Error('Duplicate archive path');

    paths.add(spec.relative_path);
    total += spec.size;
    if (!Number.isSafeInteger(spec.size) || spec.size < 0 || spec.size > limits.max_file_bytes || total > limits.max_group_bytes) throw new Error('Upload exceeds size limit');
  }

  for (const path of paths) {
    const components = path.split('/');
    components.pop();

    while (components.length) {
      if (paths.has(components.join('/'))) throw new Error('File and directory paths conflict');
      components.pop();
    }
  }

  return { specs, source_sha256: hash.digest(), source_size: source.size };
}

async function readFile(index: number) {
  const spec = specs[index];
  if (!spec) throw new Error('Unknown file');

  const hash = await createSHA256();

  let buffer = new Uint8Array(Math.min(partBytes, spec.size));
  let used = 0;
  let total = 0;
  let number = 0;

  const pending = new Set<Promise<void>>();
  let failed: Error | undefined;

  async function emit(bytes: Uint8Array<ArrayBuffer>) {
    if (failed) throw failed;

    const digest = await md5(bytes);
    const binary = digest
      .match(/../g)!
      .map(hex => String.fromCharCode(Number.parseInt(hex, 16)))
      .join('');

    const id = ++sequence;
    const promise = new Promise<void>((resolve, reject) => acknowledgements.set(id, { resolve, reject }));
    pending.add(promise);
    void promise.then(
      () => pending.delete(promise),
      error => {
        failed = error;
        pending.delete(promise);
      },
    );

    send({ type: 'part', id, file_id: index, part_number: ++number, content_md5: btoa(binary), md5: digest, bytes }, [bytes.buffer]);

    if (pending.size >= 4) await Promise.race(pending);
    if (failed) throw failed;
  }

  const sink = new WritableStream<Uint8Array>({
    async write(chunk) {
      total += chunk.length;
      if (total > spec.size || total > limits.max_file_bytes) throw new Error('Decompressed file exceeds declared size');

      hash.update(chunk);

      let offset = 0;

      while (offset < chunk.length) {
        const length = Math.min(buffer.length - used, chunk.length - offset);
        buffer.set(chunk.subarray(offset, offset + length), used);
        used += length;
        offset += length;

        if (used === buffer.length) {
          await emit(buffer);
          buffer = new Uint8Array(Math.min(partBytes, spec.size));
          used = 0;
        }
      }
    },
  });

  if (entries) await entries[index]!.getData(sink, { checkSignature: true, useWebWorkers: false });
  else await source.stream().pipeTo(sink);

  if (total !== spec.size) throw new Error('File size does not match ZIP metadata');
  if (used) await emit(buffer.slice(0, used));

  await Promise.all(pending);
  if (failed) throw failed;

  return { sha256: hash.digest() };
}

onmessage = (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'ack') {
    const ack = acknowledgements.get(message.id);
    acknowledgements.delete(message.id);

    if (message.error) ack?.reject(new Error(message.error));
    else ack?.resolve();

    return;
  }

  const operation = message.type === 'prepare' ? prepare(message.file, message.archive, message.limits) : readFile(message.index);

  void operation.then(
    result => send({ type: 'result', rpc: message.rpc, result }),
    error => send({ type: 'error', rpc: message.rpc, error: error instanceof Error ? error.message : String(error) }),
  );
};
