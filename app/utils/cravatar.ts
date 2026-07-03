const MD5_S = new Uint8Array([
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]);

const MD5_K = new Uint32Array(64);
for (let i = 0; i < 64; i += 1) {
  MD5_K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
}

function rotl(value: number, count: number) {
  return (value << count) | (value >>> (32 - count));
}

function md5HexFallback(input: string) {
  const bytes = new TextEncoder().encode(input);
  const blockWords = (((bytes.length + 8) >>> 6) + 1) * 16;
  const words = new Uint32Array(blockWords);

  for (let i = 0; i < bytes.length; i += 1) {
    words[i >>> 2] |= bytes[i] << ((i & 3) << 3);
  }

  words[bytes.length >>> 2] |= 0x80 << ((bytes.length & 3) << 3);
  words[blockWords - 2] = bytes.length * 8;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let offset = 0; offset < blockWords; offset += 16) {
    let aa = a;
    let bb = b;
    let cc = c;
    let dd = d;

    for (let i = 0; i < 64; i += 1) {
      let f: number;
      let g: number;

      if (i < 16) {
        f = (bb & cc) | (~bb & dd);
        g = i;
      } else if (i < 32) {
        f = (dd & bb) | (~dd & cc);
        g = (5 * i + 1) & 15;
      } else if (i < 48) {
        f = bb ^ cc ^ dd;
        g = (3 * i + 5) & 15;
      } else {
        f = cc ^ (bb | ~dd);
        g = (7 * i) & 15;
      }

      const temp = dd;
      dd = cc;
      cc = bb;
      const sum = (aa + f + MD5_K[i] + words[offset + g]) >>> 0;
      bb = (bb + rotl(sum, MD5_S[i])) >>> 0;
      aa = temp;
    }

    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }

  const out = new Uint8Array(16);
  const view = new DataView(out.buffer);
  view.setUint32(0, a, true);
  view.setUint32(4, b, true);
  view.setUint32(8, c, true);
  view.setUint32(12, d, true);

  return Array.from(out, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function md5Hex(input: string) {
  const runtimeCrypto = (globalThis as any).process?.getBuiltinModule?.('crypto');
  if (runtimeCrypto?.createHash) {
    return runtimeCrypto.createHash('md5').update(input).digest('hex');
  }

  return md5HexFallback(input);
}

export function buildAvatarUrl(email: string, provider: AvatarProvider) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return '';

  const hash = md5Hex(normalized);
  if (provider === AvatarProvider.Catavatar) return `https://puzzle.cat/api/users/avatar/public/${hash}`;
  return `https://cn.cravatar.com/avatar/${hash}.png?d=identicon`;
}
