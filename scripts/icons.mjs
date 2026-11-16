// Genera los iconos PNG de la PWA (public/icon-*.png) sin dependencias.
// Mismo dibujo que public/icon.svg, a sangre completa para que sirva como icono "maskable".
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const BG = [0x4f, 0x46, 0xe5];

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

// Cobertura (0..1) de un cuadrado redondeado en el píxel (x, y), con borde suavizado.
function rounded(x, y, x0, y0, size, r) {
  const cx = Math.min(Math.max(x, x0 + r), x0 + size - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + size - r);
  const d = Math.hypot(x - cx, y - cy) - r;
  return Math.min(Math.max(0.5 - d, 0), 1);
}

function icon(n) {
  const u = n / 64;
  const tiles = [[18, 18, 1], [34, 18, 0.7], [18, 34, 0.7], [34, 34, 1]];
  const raw = Buffer.alloc(n * (n * 3 + 1));
  for (let y = 0; y < n; y++) {
    const row = y * (n * 3 + 1);
    for (let x = 0; x < n; x++) {
      let a = 0;
      for (const [tx, ty, op] of tiles) a = Math.max(a, op * rounded(x + 0.5, y + 0.5, tx * u, ty * u, 12 * u, 3.5 * u));
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = Math.round(BG[c] + (255 - BG[c]) * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const n of [180, 192, 512]) {
  writeFileSync(new URL(`../public/icon-${n}.png`, import.meta.url), icon(n));
  console.log(`icon-${n}.png`);
}
