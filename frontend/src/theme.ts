// Dynamic accent: extract the vibrant color from the album cover, then
// CLAMP it so it always reads on the warm off-white canvas — as waveform
// peak, as a hairline marker, and as text. Never use the raw swatch.

import { Vibrant } from "node-vibrant/browser";

export const FALLBACK_ACCENT = "#d6273c";
const CANVAS_RGB: Rgb = { r: 0xfa, g: 0xf8, b: 0xf5 };

interface Rgb {
  r: number;
  g: number;
  b: number;
}
interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255,
    gn = g / 255,
    bn = b / 255;
  const max = Math.max(rn, gn, bn),
    min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: hue(h + 1 / 3) * 255,
    g: hue(h) * 255,
    b: hue(h - 1 / 3) * 255,
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastWithCanvas(rgb: Rgb): number {
  const a = relativeLuminance(rgb);
  const c = relativeLuminance(CANVAS_RGB);
  const [hi, lo] = a > c ? [a, c] : [c, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Force the extracted color into a range that always reads on the canvas:
 *  saturation floor (beige covers), luminance floor via a 4.0:1 contrast
 *  minimum (near-white covers, neon), and a ceiling so it never collapses
 *  into plain black. */
export function clampAccent(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = Math.min(Math.max(hsl.s, 0.45), 0.95);

  // darken until it holds 4.0:1 against the canvas
  while (contrastWithCanvas(hslToRgb(hsl)) < 4.0 && hsl.l > 0.18) {
    hsl.l -= 0.02;
  }
  // lighten if it's so dark it stops reading as a color
  while (contrastWithCanvas(hslToRgb(hsl)) > 11 && hsl.l < 0.5) {
    hsl.l += 0.02;
  }
  return rgbToHex(hslToRgb(hsl));
}

/** Pull the song's accent from its cover. Resolves to a clamped, legible
 *  color; falls back to the signal red on any failure. */
export async function extractAccent(coverUrl: string | null): Promise<string> {
  if (!coverUrl) return FALLBACK_ACCENT;
  try {
    const palette = await Vibrant.from(coverUrl).getPalette();
    const swatch =
      palette.Vibrant ?? palette.DarkVibrant ?? palette.LightVibrant ?? palette.Muted;
    return swatch ? clampAccent(swatch.hex) : FALLBACK_ACCENT;
  } catch {
    return FALLBACK_ACCENT;
  }
}

export function setAccent(color: string): void {
  document.documentElement.style.setProperty("--accent", color);
}
