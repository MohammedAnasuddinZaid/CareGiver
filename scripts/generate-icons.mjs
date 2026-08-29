/**
 * Generates PWA icons without external dependencies.
 * Renders the CareGiver mark (person glyph on teal rounded square)
 * with 4x4 supersampling for smooth edges, then encodes PNGs via zlib.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TEAL = [15, 118, 110];
const TEAL_LIGHT = [19, 140, 130];
const WHITE = [255, 255, 255];

// ---------- tiny PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- shape helpers (signed distances, normalized coords 0..1) ----------
function sdRoundRect(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - (halfW - r);
  const qy = Math.abs(py) - (halfH - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdRing(px, py, cx, cy, radius, strokeWidth) {
  const d = Math.hypot(px - cx, py - cy) - radius;
  return Math.abs(d) - strokeWidth / 2;
}

function sdArcShoulders(px, py, cx, cy, radius, strokeWidth) {
  // Only the upper part of a big circle below the head reads as shoulders.
  if (py > cy) return 1e6;
  const d = Math.abs(Math.hypot(px - cx, py - cy) - radius) - strokeWidth / 2;
  return py > cy - strokeWidth ? Math.min(d, 1e6) : d;
}

function coverage(sd) {
  // 1px feather in normalized units
  return Math.min(1, Math.max(0, 0.5 - sd));
}

function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const SS = 4;
  const radiusRatio = maskable ? 0 : 0.22;
  const glyphScale = maskable ? 0.72 : 0.92;

  const half = 0.5;
  const stroke = 0.055;

  function sample(nx, ny) {
    // background
    let bgA = maskable
      ? 1
      : coverage(sdRoundRect(nx - half, ny - half, half - 0.004, half - 0.004, radiusRatio));

    // vertical gradient on background
    const gradT = Math.min(1, Math.max(0, ny));
    const br = TEAL[0] + (TEAL_LIGHT[0] - TEAL[0]) * (1 - gradT) * 0.25;
    const bg = [br, TEAL[1] + (TEAL_LIGHT[1] - TEAL[1]) * (1 - gradT) * 0.25, TEAL[2]];

    // glyph (scaled toward center)
    const gx = (nx - 0.5) / glyphScale + 0.5;
    const gy = (ny - 0.5) / glyphScale + 0.5;

    const head = coverage(sdRing(gx, gy, 0.5, 0.36, 0.15, stroke));
    const shoulders = coverage(sdArcShoulders(gx, gy, 0.5, 0.86, 0.27, stroke));
    const fgA = Math.min(1, head + shoulders);

    if (bgA <= 0 && fgA <= 0) return null;
    const outA = fgA + bgA * (1 - fgA);
    const r = (WHITE[0] * fgA + bg[0] * bgA * (1 - fgA)) / (outA || 1);
    const g = (WHITE[1] * fgA + bg[1] * bgA * (1 - fgA)) / (outA || 1);
    const b = (WHITE[2] * fgA + bg[2] * bgA * (1 - fgA)) / (outA || 1);
    return [r, g, b, outA * 255];
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const nx = (x + (sx + 0.5) / SS) / size;
          const ny = (y + (sy + 0.5) / SS) / size;
          const c = sample(nx, ny);
          if (c) {
            acc[0] += c[0];
            acc[1] += c[1];
            acc[2] += c[2];
            acc[3] += c[3];
          }
        }
      }
      const n = SS * SS;
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(acc[0] / n);
      rgba[idx + 1] = Math.round(acc[1] / n);
      rgba[idx + 2] = Math.round(acc[2] / n);
      rgba[idx + 3] = Math.round(acc[3] / n);
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync(join(root, "public", "icons"), { recursive: true });
writeFileSync(join(root, "public", "icons", "icon-192.png"), renderIcon(192));
writeFileSync(join(root, "public", "icons", "icon-512.png"), renderIcon(512));
writeFileSync(join(root, "public", "icons", "icon-maskable-512.png"), renderIcon(512, { maskable: true }));
console.log("Icons written to public/icons/");
