import * as THREE from 'three';
import { TEA_COLORS, type ColorId, type TeaColorDef } from './data';

/**
 * MTT texture factory — every visual is generated on canvas so the
 * prototype is self-contained. Concept images are used ONLY as framed
 * reference portraits, never as textures pretending to be 3D art.
 */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---------- glyph drawing (shared visual language for color-blind support) ----------

export function drawGlyph(ctx: CanvasRenderingContext2D, glyph: TeaColorDef['glyph'], x: number, y: number, r: number, fill: string) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  ctx.lineWidth = Math.max(1.5, r * 0.28);
  ctx.lineCap = 'round';
  ctx.translate(x, y);
  switch (glyph) {
    case 'sun': {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.stroke();
      }
      break;
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.34, r * 0.24, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff8ec';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.4;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'drop': {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.75, -r * 0.1, r * 0.6, r * 0.65, 0, r * 0.85);
      ctx.bezierCurveTo(-r * 0.6, r * 0.65, -r * 0.75, -r * 0.1, 0, -r);
      ctx.fill();
      break;
    }
    case 'bell': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.45);
      ctx.quadraticCurveTo(-r * 0.7, -r * 0.8, 0, -r * 0.9);
      ctx.quadraticCurveTo(r * 0.7, -r * 0.8, r * 0.7, r * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, r * 0.62, r * 0.18, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'leaf': {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.2, 0, r);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r);
      ctx.fill();
      ctx.strokeStyle = '#fff8ec';
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, r * 0.7); ctx.stroke();
      break;
    }
    case 'circle': {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ---------- wood / fabric / rug ----------

export function woodTexture(base = '#8a5a33', light = '#a5713f', dark = '#6e4526'): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = Math.random() > 0.5 ? light : dark;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, y, 512, 64);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(60,35,15,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    // grain
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(60,35,15,${0.05 + Math.random() * 0.08})`;
      ctx.lineWidth = 1;
      const gy = y + 4 + Math.random() * 56;
      ctx.beginPath(); ctx.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 64) ctx.lineTo(x, gy + Math.sin(x * 0.05 + i) * 2);
      ctx.stroke();
    }
    // plank seams (staggered)
    const off = (y / 64) % 2 === 0 ? 0 : 128;
    ctx.strokeStyle = 'rgba(50,30,12,0.6)';
    ctx.beginPath(); ctx.moveTo((off + 170) % 512, y); ctx.lineTo((off + 170) % 512, y + 64); ctx.stroke();
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function fabricTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#e9d9b8'; ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 128) {
    ctx.fillStyle = '#d9a8a0';
    ctx.fillRect(x, 0, 64, 512);
  }
  // weave noise
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(120,90,60,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function rugTexture(): THREE.CanvasTexture {
  const { c, ctx } = canvas(512, 512);
  ctx.fillStyle = '#c9a86a'; ctx.fillRect(0, 0, 512, 512);
  const rings = ['#b48ec7', '#7fb0a5', '#e8a34d', '#e86a8a'];
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = rings[i % rings.length];
    ctx.lineWidth = 18;
    ctx.beginPath(); ctx.arc(256, 256, 220 - i * 40, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = '#8a6a3a';
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * 60, 256 + Math.sin(a) * 60);
    ctx.lineTo(256 + Math.cos(a) * 46, 256 + Math.sin(a) * 46);
    ctx.stroke();
  }
  return toTexture(c);
}

// ---------- small text sprite ----------

export function textSprite(lines: string[], opts: { width?: number; font?: number; bg?: string; fg?: string; border?: string } = {}): THREE.CanvasTexture {
  const width = opts.width ?? 512;
  const font = opts.font ?? 44;
  const lineH = font * 1.25;
  const { c, ctx } = canvas(width, lineH * lines.length + 44);
  ctx.fillStyle = opts.bg ?? 'rgba(43,26,18,0.88)';
  roundRect(ctx, 4, 4, c.width - 8, c.height - 8, 26);
  ctx.fill();
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 5;
    roundRect(ctx, 10, 10, c.width - 20, c.height - 20, 22);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.fg ?? '#f7ecd8';
  ctx.font = `${font}px Georgia, 'Times New Roman', serif`;
  lines.forEach((l, i) => ctx.fillText(l, c.width / 2, 22 + lineH * (i + 0.5)));
  return toTexture(c);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- portrait cards (concept art presented honestly, framed) ----------

export async function portraitCard(imageUrl: string | null, label: string, sub: string): Promise<THREE.CanvasTexture> {
  const W = 512; const H = 640;
  const { c, ctx } = canvas(W, H);
  // parchment card
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#f4e7cc');
  grad.addColorStop(1, '#e2c9a2');
  ctx.fillStyle = grad;
  roundRect(ctx, 8, 8, W - 16, H - 16, 34);
  ctx.fill();
  ctx.strokeStyle = '#8a5a33';
  ctx.lineWidth = 10;
  roundRect(ctx, 14, 14, W - 28, H - 28, 30);
  ctx.stroke();

  const imgArea = { x: 34, y: 34, w: W - 68, h: H - 178 };
  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl);
      // contain-fit
      const scale = Math.min(imgArea.w / img.width, imgArea.h / img.height);
      const dw = img.width * scale; const dh = img.height * scale;
      ctx.save();
      roundRect(ctx, imgArea.x, imgArea.y, imgArea.w, imgArea.h, 20);
      ctx.clip();
      ctx.fillStyle = '#efe6d6';
      ctx.fillRect(imgArea.x, imgArea.y, imgArea.w, imgArea.h);
      ctx.drawImage(img, imgArea.x + (imgArea.w - dw) / 2, imgArea.y + (imgArea.h - dh) / 2, dw, dh);
      ctx.restore();
      ctx.strokeStyle = 'rgba(120,80,40,0.55)';
      ctx.lineWidth = 4;
      roundRect(ctx, imgArea.x, imgArea.y, imgArea.w, imgArea.h, 20);
      ctx.stroke();
    } catch {
      placeholderInside(ctx, imgArea);
    }
  } else {
    placeholderInside(ctx, imgArea);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#4a2c18';
  ctx.font = `bold 34px Georgia, serif`;
  ctx.fillText(truncate(label, 26), W / 2, H - 96);
  ctx.font = `24px Georgia, serif`;
  ctx.fillStyle = '#7a5230';
  ctx.fillText(truncate(sub, 40), W / 2, H - 58);
  return toTexture(c);
}

function placeholderInside(ctx: CanvasRenderingContext2D, area: { x: number; y: number; w: number; h: number }) {
  ctx.save();
  roundRect(ctx, area.x, area.y, area.w, area.h, 20);
  ctx.clip();
  ctx.fillStyle = '#ded4c2';
  ctx.fillRect(area.x, area.y, area.w, area.h);
  // soft diamond pattern
  ctx.strokeStyle = 'rgba(150,120,90,0.35)';
  ctx.lineWidth = 2;
  for (let i = -area.h; i < area.w; i += 40) {
    ctx.beginPath(); ctx.moveTo(area.x + i, area.y); ctx.lineTo(area.x + i + area.h, area.y + area.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(area.x + i + area.h, area.y); ctx.lineTo(area.x + i, area.y + area.h); ctx.stroke();
  }
  ctx.fillStyle = '#6a5138';
  ctx.textAlign = 'center';
  ctx.font = 'bold 36px Georgia, serif';
  ctx.fillText('awaiting asset', area.x + area.w / 2, area.y + area.h / 2 - 10);
  ctx.font = '22px Georgia, serif';
  ctx.fillText('placeholder card', area.x + area.w / 2, area.y + area.h / 2 + 30);
  ctx.restore();
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ---------- familiar medallions ----------

export async function medallion(imageUrl: string | null, tint = '#e8b04d'): Promise<THREE.CanvasTexture> {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#efe3cc';
  ctx.fillRect(0, 0, S, S);
  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl);
      const scale = Math.max(S / img.width, S / img.height) * 0.96;
      const dw = img.width * scale; const dh = img.height * scale;
      ctx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
    } catch { /* leave plain */ }
  }
  ctx.restore();
  // brass ring
  ctx.strokeStyle = tint;
  ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 10, 0, Math.PI * 2); ctx.stroke();
  return toTexture(c);
}

// ---------- plate plaque (target readout with non-color cues) ----------

export function platePlaque(pieces: { hex: string; glyph: TeaColorDef['glyph']; name: string }[], title: string): THREE.CanvasTexture {
  const W = 640;
  const rowH = 74;
  const H = rowH * pieces.length + 130;
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = 'rgba(38,22,14,0.92)';
  roundRect(ctx, 6, 6, W - 12, H - 12, 30); ctx.fill();
  ctx.strokeStyle = '#c9a25e'; ctx.lineWidth = 6;
  roundRect(ctx, 14, 14, W - 28, H - 28, 24); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f2dfb8';
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText(title, W / 2, 56);
  pieces.forEach((p, i) => {
    const y = 56 + rowH * (i + 0.8);
    // numbered pip (order marker, not color-dependent)
    ctx.fillStyle = '#f2dfb8';
    ctx.beginPath(); ctx.arc(86, y, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2416';
    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillText(String(i + 1), 86, y + 1);
    // color swatch + glyph
    ctx.fillStyle = p.hex;
    roundRect(ctx, 150, y - 26, 220, 52, 14); ctx.fill();
    drawGlyph(ctx, p.glyph, 260, y, 20, '#2c1a10');
    // name
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f2dfb8';
    ctx.font = '36px Georgia, serif';
    ctx.fillText(p.name, 410, y);
    ctx.textAlign = 'center';
  });
  ctx.fillStyle = '#cbb389';
  ctx.font = '26px Georgia, serif';
  ctx.fillText('bottom → top', W / 2, H - 34);
  return toTexture(c);
}

// ---------- window view painter ----------

export class WindowPainter {
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private time = 0;
  private drops: { x: number; y: number; v: number; r: number }[] = [];
  private stars: { x: number; y: number; r: number; tw: number }[] = [];
  private mood: { skyTop: string; skyBottom: string; night: boolean } = { skyTop: '#bfe3d8', skyBottom: '#fdf0cf', night: false };
  private weather: 'clear' | 'rain' | 'snow' = 'clear';
  private reduced = false;

  constructor() {
    const { c, ctx } = canvas(512, 512);
    this.ctx = ctx;
    this.texture = toTexture(c);
    for (let i = 0; i < 70; i++) this.drops.push({ x: Math.random() * 512, y: Math.random() * 512, v: 90 + Math.random() * 160, r: 1 + Math.random() * 2 });
    for (let i = 0; i < 90; i++) this.stars.push({ x: Math.random() * 512, y: Math.random() * 300, r: 0.6 + Math.random() * 1.6, tw: Math.random() * Math.PI * 2 });
  }

  setReduced(r: boolean) { this.reduced = r; }

  set(mood: { skyTop: string; skyBottom: string; night: boolean }, weather: 'clear' | 'rain' | 'snow') {
    this.mood = mood; this.weather = weather;
    if (this.reduced) this.paint(0);
  }

  paint(dt: number) {
    if (this.reduced && this.time > 0) { return; } // static frame in reduced motion
    this.time += dt;
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, this.mood.skyTop);
    g.addColorStop(1, this.mood.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);

    if (this.mood.night) {
      for (const s of this.stars) {
        const a = 0.5 + 0.5 * Math.sin(this.time * 1.4 + s.tw);
        ctx.fillStyle = `rgba(255,244,214,${0.35 + a * 0.6})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#f7ecc9';
      ctx.beginPath(); ctx.arc(390, 110, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.mood.skyTop;
      ctx.beginPath(); ctx.arc(376, 98, 30, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,236,180,0.85)';
      ctx.beginPath(); ctx.arc(380, 130, 40, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,180,0.25)';
      ctx.beginPath(); ctx.arc(380, 130, 70, 0, Math.PI * 2); ctx.fill();
    }

    // hills
    ctx.fillStyle = this.mood.night ? 'rgba(30,42,58,0.9)' : 'rgba(88,130,92,0.85)';
    ctx.beginPath();
    ctx.moveTo(0, 380);
    ctx.quadraticCurveTo(140, 300, 280, 372);
    ctx.quadraticCurveTo(400, 430, 512, 356);
    ctx.lineTo(512, 512); ctx.lineTo(0, 512);
    ctx.fill();
    ctx.fillStyle = this.mood.night ? 'rgba(22,30,44,0.95)' : 'rgba(64,100,72,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 440);
    ctx.quadraticCurveTo(200, 380, 380, 448);
    ctx.quadraticCurveTo(460, 480, 512, 452);
    ctx.lineTo(512, 512); ctx.lineTo(0, 512);
    ctx.fill();
    // tiny garden gate
    ctx.strokeStyle = this.mood.night ? '#1c2434' : '#3c4a38';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(120, 470); ctx.lineTo(120, 408); ctx.lineTo(152, 388); ctx.lineTo(184, 408); ctx.lineTo(184, 470); ctx.stroke();

    if (this.weather === 'rain' && !this.reduced) {
      ctx.strokeStyle = 'rgba(200,215,235,0.55)';
      ctx.lineWidth = 2;
      for (const d of this.drops) {
        d.y += d.v * dt; d.x += 18 * dt;
        if (d.y > 512) { d.y = -20; d.x = Math.random() * 512; }
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 3, d.y + 14); ctx.stroke();
      }
    }
    if (this.weather === 'snow' && !this.reduced) {
      for (const d of this.drops) {
        d.y += d.v * 0.14 * dt; d.x += Math.sin(this.time + d.r) * 12 * dt;
        if (d.y > 512) { d.y = -12; d.x = Math.random() * 512; }
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r + 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (this.weather !== 'clear' && this.reduced) {
      ctx.fillStyle = this.weather === 'rain' ? 'rgba(160,180,210,0.14)' : 'rgba(255,255,255,0.16)';
      ctx.fillRect(0, 0, 512, 512);
    }
    // vignette
    const v = ctx.createRadialGradient(256, 256, 160, 256, 256, 300);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(20,10,5,0.35)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 512, 512);
    this.texture.needsUpdate = true;
  }
}

// ---------- layer top stamp (glyph stamped on the top surface of a layer) ----------

export function layerStamp(color: ColorId): THREE.CanvasTexture {
  const S = 128;
  const { c, ctx } = canvas(S, S);
  ctx.clearRect(0, 0, S, S);
  drawGlyph(ctx, TEA_COLORS[color].glyph, S / 2, S / 2, 34, 'rgba(35,20,10,0.75)');
  const t = toTexture(c);
  return t;
}

// ---------- pattern texture for personal cup ----------

export function cupPatternTexture(pattern: 'none' | 'stripes' | 'dots' | 'scallop', bodyHex: string): THREE.CanvasTexture {
  const S = 256;
  const { c, ctx } = canvas(S, S);
  ctx.fillStyle = bodyHex;
  ctx.fillRect(0, 0, S, S);
  if (pattern === 'stripes') {
    ctx.fillStyle = 'rgba(255,248,236,0.75)';
    for (let x = 0; x < S; x += 48) ctx.fillRect(x, 0, 20, S);
  } else if (pattern === 'dots') {
    ctx.fillStyle = 'rgba(255,248,236,0.8)';
    for (let y = 16; y < S; y += 44) for (let x = ((y / 44) % 2) * 22 + 14; x < S; x += 44) {
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
    }
  } else if (pattern === 'scallop') {
    ctx.strokeStyle = 'rgba(255,248,236,0.85)';
    ctx.lineWidth = 7;
    for (let y = 30; y < S; y += 60) {
      ctx.beginPath();
      for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.09) * 9);
      ctx.stroke();
    }
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
