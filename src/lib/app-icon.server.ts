import { deflateSync } from "node:zlib";

/**
 * Home-screen icons must be real raster images: iOS ignores SVG for
 * `apple-touch-icon`, which is why an SVG monogram showed as a broken tile.
 * There is no native image library in this runtime, so the monogram is
 * rasterised here with a small stroke font and encoded as a PNG by hand.
 */

type Pt = [number, number];
type Glyph = Pt[][];

const O: Glyph = [
  [
    [0.5, 0],
    [0.15, 0.25],
    [0, 0.5],
    [0.15, 0.75],
    [0.5, 1],
    [0.85, 0.75],
    [1, 0.5],
    [0.85, 0.25],
    [0.5, 0],
  ],
];

const P_BOWL: Pt[] = [
  [0, 1],
  [0, 0],
  [0.7, 0],
  [0.95, 0.28],
  [0.7, 0.55],
  [0, 0.55],
];

const FONT: Record<string, Glyph> = {
  A: [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
    [
      [0.18, 0.62],
      [0.82, 0.62],
    ],
  ],
  B: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [0.7, 0],
      [0.92, 0.24],
      [0.7, 0.48],
      [0, 0.48],
    ],
    [
      [0, 0.48],
      [0.75, 0.48],
      [0.97, 0.74],
      [0.75, 1],
      [0, 1],
    ],
  ],
  C: [
    [
      [1, 0.2],
      [0.72, 0],
      [0.3, 0],
      [0, 0.3],
      [0, 0.7],
      [0.3, 1],
      [0.72, 1],
      [1, 0.8],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [0.6, 0],
      [1, 0.4],
      [1, 0.6],
      [0.6, 1],
      [0, 1],
    ],
  ],
  E: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
  ],
  F: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
    ],
    [
      [0, 0.5],
      [0.8, 0.5],
    ],
  ],
  G: [
    [
      [1, 0.2],
      [0.7, 0],
      [0.3, 0],
      [0, 0.3],
      [0, 0.7],
      [0.3, 1],
      [0.7, 1],
      [1, 0.75],
      [1, 0.55],
      [0.55, 0.55],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
  ],
  J: [
    [
      [0.8, 0],
      [0.8, 0.75],
      [0.55, 1],
      [0.25, 1],
      [0, 0.78],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [0, 0.55],
    ],
    [
      [0.3, 0.38],
      [1, 1],
    ],
  ],
  L: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  M: [
    [
      [0, 1],
      [0, 0],
      [0.5, 0.6],
      [1, 0],
      [1, 1],
    ],
  ],
  N: [
    [
      [0, 1],
      [0, 0],
      [1, 1],
      [1, 0],
    ],
  ],
  O,
  P: [P_BOWL],
  Q: [
    ...O,
    [
      [0.6, 0.68],
      [1, 1],
    ],
  ],
  R: [
    P_BOWL,
    [
      [0.4, 0.55],
      [1, 1],
    ],
  ],
  S: [
    [
      [1, 0.2],
      [0.7, 0],
      [0.3, 0],
      [0.05, 0.25],
      [0.3, 0.48],
      [0.7, 0.52],
      [0.95, 0.75],
      [0.7, 1],
      [0.3, 1],
      [0, 0.8],
    ],
  ],
  T: [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0.5, 0],
      [0.5, 1],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 0.7],
      [0.3, 1],
      [0.7, 1],
      [1, 0.7],
      [1, 0],
    ],
  ],
  V: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
  ],
  W: [
    [
      [0, 0],
      [0.25, 1],
      [0.5, 0.35],
      [0.75, 1],
      [1, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [1, 1],
    ],
    [
      [1, 0],
      [0, 1],
    ],
  ],
  Y: [
    [
      [0, 0],
      [0.5, 0.52],
      [1, 0],
    ],
    [
      [0.5, 0.52],
      [0.5, 1],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ],
  "0": O,
  "1": [
    [
      [0.25, 0.2],
      [0.5, 0],
      [0.5, 1],
    ],
  ],
  "2": [
    [
      [0, 0.25],
      [0.3, 0],
      [0.7, 0],
      [1, 0.3],
      [0, 1],
      [1, 1],
    ],
  ],
  "3": [
    [
      [0, 0.1],
      [0.4, 0],
      [0.9, 0.25],
      [0.45, 0.5],
      [0.95, 0.72],
      [0.6, 1],
      [0.1, 0.92],
    ],
  ],
  "4": [
    [
      [0.75, 1],
      [0.75, 0],
      [0, 0.7],
      [1, 0.7],
    ],
  ],
  "5": [
    [
      [1, 0],
      [0.2, 0],
      [0.1, 0.45],
      [0.5, 0.4],
      [0.9, 0.6],
      [0.7, 1],
      [0.2, 1],
    ],
  ],
  "6": [
    [
      [0.85, 0.05],
      [0.4, 0.05],
      [0.1, 0.45],
      [0.1, 0.8],
      [0.45, 1],
      [0.8, 0.85],
      [0.75, 0.6],
      [0.35, 0.5],
      [0.1, 0.7],
    ],
  ],
  "7": [
    [
      [0, 0],
      [1, 0],
      [0.4, 1],
    ],
  ],
  "8": [
    [
      [0.5, 0.5],
      [0.15, 0.3],
      [0.35, 0.03],
      [0.65, 0.03],
      [0.85, 0.3],
      [0.5, 0.5],
      [0.15, 0.72],
      [0.4, 1],
      [0.65, 1],
      [0.85, 0.72],
      [0.5, 0.5],
    ],
  ],
  "9": [
    [
      [0.15, 0.95],
      [0.6, 0.95],
      [0.9, 0.55],
      [0.9, 0.2],
      [0.55, 0],
      [0.2, 0.15],
      [0.25, 0.4],
      [0.65, 0.5],
      [0.9, 0.3],
    ],
  ],
};

function hexToRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function distanceToSegment(px: number, py: number, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / len));
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** A square icon: brand background, initials drawn in a readable contrast colour. */
export function monogramPng(text: string, brandHex: string, maskable: boolean, size = 512) {
  const bg = hexToRgb(brandHex, [15, 118, 110]);
  const fg: [number, number, number] = luminance(bg) > 0.6 ? [17, 17, 17] : [255, 255, 255];

  const letters = (text || "•").slice(0, 2).toUpperCase().split("");
  // Maskable icons are cropped to a circle on Android: keep the initials small.
  const boxHeight = size * (maskable ? 0.34 : 0.44);
  const glyphWidth = boxHeight * 0.62;
  const gap = boxHeight * 0.18;
  const totalWidth = letters.length * glyphWidth + (letters.length - 1) * gap;
  const originX = (size - totalWidth) / 2;
  const originY = (size - boxHeight) / 2;
  const stroke = boxHeight * 0.13;

  type Seg = { a: Pt; b: Pt };
  const segments: Seg[] = [];
  letters.forEach((ch, i) => {
    const glyph = FONT[ch] ?? FONT["O"] ?? [];
    const ox = originX + i * (glyphWidth + gap);
    for (const poly of glyph) {
      for (let j = 0; j < poly.length - 1; j += 1) {
        const p = poly[j];
        const q = poly[j + 1];
        if (!p || !q) continue;
        segments.push({
          a: [ox + p[0] * glyphWidth, originY + p[1] * boxHeight],
          b: [ox + q[0] * glyphWidth, originY + q[1] * boxHeight],
        });
      }
    }
  });

  const half = stroke / 2;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      let d = Infinity;
      for (const s of segments) {
        const dist = distanceToSegment(x + 0.5, y + 0.5, s.a, s.b);
        if (dist < d) d = dist;
      }
      const alpha = Math.max(0, Math.min(1, half + 0.5 - d));
      const o = rowStart + 1 + x * 3;
      raw[o] = Math.round(bg[0] + (fg[0] - bg[0]) * alpha);
      raw[o + 1] = Math.round(bg[1] + (fg[1] - bg[1]) * alpha);
      raw[o + 2] = Math.round(bg[2] + (fg[2] - bg[2]) * alpha);
    }
  }

  return encodePng(raw, size, size);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1)
    c = (CRC_TABLE[(c ^ (buf[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(raw: Buffer, width: number, height: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
