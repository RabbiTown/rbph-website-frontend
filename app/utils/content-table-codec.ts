import { gunzipSync, gzipSync } from 'fflate';

export type RbTableCellData = {
  text: string;
  align?: 'left' | 'center' | 'right';
};

export type RbTableData = {
  header?: boolean;
  rows?: RbTableCellData[][];
};

const alignments = [undefined, 'left', 'center', 'right'] as const;
// v1: flags:u8, rows:LEB128, then per row cells:LEB128; per cell align:u8, UTF-8 length:LEB128, text.
// b1 is padded Base64; g1 is padded Base64 of a single gzip member containing those same bytes.
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

export function isTableAlign(value: unknown): value is NonNullable<RbTableCellData['align']> {
  return value === 'left' || value === 'center' || value === 'right';
}

export function normalizeTableData(value: unknown): RbTableData {
  if (!value || typeof value !== 'object') return { header: false, rows: [] };

  const raw = value as { header?: unknown; rows?: unknown };
  return {
    header: raw.header === true,
    rows: Array.isArray(raw.rows)
      ? raw.rows.map(row =>
          Array.isArray(row)
            ? row.map(cell => {
                const rawCell: { text?: unknown; align?: unknown } = cell && typeof cell === 'object' ? cell : { text: cell };
                return {
                  text: typeof rawCell.text === 'string' ? rawCell.text : '',
                  ...(isTableAlign(rawCell.align) ? { align: rawCell.align } : {}),
                };
              })
            : [],
        )
      : [],
  };
}

function encodeUint32(value: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error('Invalid table length');
  const bytes: number[] = [];
  do {
    const byte = value & 0x7f;
    value >>>= 7;
    bytes.push(byte | (value ? 0x80 : 0));
  } while (value);
  return bytes;
}

function encodeBinary(data: RbTableData): Uint8Array {
  const rows = data.rows ?? [];
  const parts = [Uint8Array.from([data.header ? 1 : 0, ...encodeUint32(rows.length)])];
  for (const row of rows) {
    parts.push(Uint8Array.from(encodeUint32(row.length)));
    for (const cell of row) {
      const text = textEncoder.encode(cell.text);
      parts.push(Uint8Array.from([alignments.indexOf(cell.align), ...encodeUint32(text.length)]), text);
    }
  }
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function decodeBinary(bytes: Uint8Array): RbTableData {
  let offset = 0;
  function readByte() {
    if (offset >= bytes.length) throw new Error('Truncated table data');
    return bytes[offset++]!;
  }
  function readUint32() {
    let value = 0;
    for (let index = 0; index < 5; index += 1) {
      const byte = readByte();
      if (index === 4 && byte > 0x0f) throw new Error('Invalid table length');
      value += (byte & 0x7f) * 2 ** (index * 7);
      if (!(byte & 0x80)) {
        if (index > 0 && byte === 0) throw new Error('Non-canonical table length');
        return value;
      }
    }
    throw new Error('Invalid table length');
  }

  const flags = readByte();
  if (flags > 1) throw new Error('Invalid table flags');
  const rowCount = readUint32();
  if (rowCount > bytes.length - offset) throw new Error('Truncated table rows');
  const rows: RbTableCellData[][] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const cellCount = readUint32();
    if (cellCount > Math.floor((bytes.length - offset) / 2)) throw new Error('Truncated table cells');
    const row: RbTableCellData[] = [];
    for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
      const align = readByte();
      if (align > 3) throw new Error('Invalid table alignment');
      const length = readUint32();
      if (length > bytes.length - offset) throw new Error('Truncated table text');
      const text = textDecoder.decode(bytes.subarray(offset, offset + length));
      offset += length;
      row.push({ text, ...(align ? { align: alignments[align]! } : {}) });
    }
    rows.push(row);
  }
  if (offset !== bytes.length) throw new Error('Unexpected trailing table data');
  return { header: flags === 1, rows };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Invalid table Base64');
  }
  const binary = atob(value);
  if (btoa(binary) !== value) throw new Error('Non-canonical table Base64');
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function decodeGzip(bytes: Uint8Array): Uint8Array {
  // v1 writes a single gzip member without optional header fields.
  if (bytes.length < 20 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8 || bytes[3] !== 0) {
    throw new Error('Invalid table gzip header');
  }
  const trailer = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 8, 8);
  const size = trailer.getUint32(4, true);
  // DEFLATE cannot expand beyond 1032 bytes per compressed byte. Check before allocation.
  if (size > (bytes.length - 18) * 1032) throw new Error('Invalid table gzip length');
  const binary = gunzipSync(bytes);
  let crc = 0xffffffff;
  for (const byte of binary) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!;
  if (binary.length !== size || (crc ^ 0xffffffff) >>> 0 !== trailer.getUint32(0, true)) {
    throw new Error('Invalid table gzip checksum or length');
  }
  return binary;
}

export function encodeRbTableData(data: RbTableData): string {
  const binary = encodeBinary(normalizeTableData(data));
  const plain = `b1:${encodeBase64(binary)}`;
  const compressed = `g1:${encodeBase64(gzipSync(binary, { level: 6, mtime: 0 }))}`;
  return compressed.length < plain.length ? compressed : plain;
}

export function decodeRbTableData(value: unknown): RbTableData {
  if (typeof value !== 'string' || !value) throw new Error('Missing table data');
  if (value.startsWith('b1:')) return decodeBinary(decodeBase64(value.slice(3)));
  if (value.startsWith('g1:')) return decodeBinary(decodeGzip(decodeBase64(value.slice(3))));
  throw new Error('Unsupported table encoding');
}
