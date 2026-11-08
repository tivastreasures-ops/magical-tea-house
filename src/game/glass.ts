import * as THREE from 'three';
import { TEA_COLORS, type ColorId, type Layer, type RewardRecipeDef } from './data';
import type { CupCustom } from './persist';
import { layerStamp, cupPatternTexture, portraitCard, medallion, drawGlyph } from './textures';

/**
 * MTT 3D entities — puzzle glasses with separated liquid layers, ornate
 * reward cups, personal cups, portrait cards and gentle effect helpers.
 * Hand-painted storybook feel through warm materials and soft forms;
 * concept images appear only as framed reference portraits (never as
 * stand-in 3D art — brief §14).
 */

export const GLASS = {
  radius: 0.085,
  height: 0.21,
  wall: 0.012,
};

function glassMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: '#dff0ee',
    transparent: true,
    opacity: 0.22,
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export class Glass3D {
  group = new THREE.Group();
  radius: number;
  usableHeight: number;
  private body: THREE.Mesh;
  private layerGroup = new THREE.Group();
  private ring: THREE.Mesh;
  private stamp: THREE.Mesh | null = null;
  private lockSprite: THREE.Sprite | null = null;
  layerCount = 0;

  constructor(radius = GLASS.radius, height = GLASS.height) {
    this.radius = radius;
    this.usableHeight = height - 0.03;
    const geo = new THREE.CylinderGeometry(radius, radius * 0.82, height, 28, 1, true);
    this.body = new THREE.Mesh(geo, glassMaterial());
    this.body.position.y = height / 2;
    this.group.add(this.body);
    // rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.006, 10, 28),
      new THREE.MeshStandardMaterial({ color: '#e8dcc4', roughness: 0.4, metalness: 0.1 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = height;
    this.group.add(rim);
    // base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.84, radius * 0.88, 0.012, 28),
      new THREE.MeshPhysicalMaterial({ color: '#cfe4e0', transparent: true, opacity: 0.4, roughness: 0.2 })
    );
    base.position.y = 0.006;
    this.group.add(base);
    // invisible pick volume (generous hit box — accessibility, brief §11)
    const pick = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.15, radius * 0.95, height * 1.1, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    pick.position.y = height / 2;
    this.group.add(pick);
    // selection ring (hidden by default)
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.35, 0.011, 10, 36),
      new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffb84d', emissiveIntensity: 1.4, transparent: true, opacity: 0.95 })
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.015;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.group.add(this.layerGroup);
  }

  setSelected(on: boolean) {
    this.ring.visible = on;
  }

  /** Rebuild liquid layers bottom→top. Cheap: a handful of low-poly cylinders. */
  setLayers(layers: Layer[]) {
    this.layerGroup.clear();
    this.stamp?.removeFromParent();
    this.stamp = null;
    this.lockSprite?.removeFromParent();
    this.lockSprite = null;
    this.layerCount = layers.length;
    if (layers.length === 0) return;
    const h = this.usableHeight / Math.max(layers.length, 1);
    layers.forEach((l, i) => {
      const def = TEA_COLORS[l.color as ColorId];
      const mat = new THREE.MeshPhysicalMaterial({
        color: def.hex,
        transparent: true,
        opacity: 0.94,
        roughness: 0.28,
        clearcoat: 0.6,
        emissive: def.hex,
        emissiveIntensity: 0.06,
      });
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(this.radius * 0.87, this.radius * 0.87, h * 0.92, 24), mat);
      mesh.position.y = 0.02 + h * i + h / 2;
      mesh.userData.isLayer = true;
      this.layerGroup.add(mesh);
      if (i === layers.length - 1) {
        // glyph stamp on the top surface — non-color cue
        const tex = layerStamp(l.color);
        const stamp = new THREE.Mesh(
          new THREE.CircleGeometry(this.radius * 0.6, 20),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
        );
        stamp.rotation.x = -Math.PI / 2;
        stamp.position.y = 0.02 + h * (i + 1) + 0.004;
        this.layerGroup.add(stamp);
        this.stamp = stamp;
        if (l.locked) {
          const c = document.createElement('canvas');
          c.width = c.height = 128;
          const ctx = c.getContext('2d')!;
          drawGlyph(ctx, 'drop', 64, 64, 44, '#ffe6b0');
          const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
          spr.scale.setScalar(0.07);
          spr.position.set(this.radius * 1.5, 0.02 + h * (i + 1) + 0.05, 0);
          this.lockSprite = spr;
          this.layerGroup.add(spr);
        }
      }
    });
  }

  topY(): number {
    return 0.02 + (this.usableHeight / Math.max(this.layerCount || 1, 1)) * this.layerCount;
  }
}

/** Gentle pour stream: a tapered ribbon that fades in, then out. */
export function makeStream(from: THREE.Vector3, to: THREE.Vector3, hex: string): THREE.Mesh {
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.max(from.y, to.y) + 0.06;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const geo = new THREE.TubeGeometry(curve, 20, 0.011, 8, false);
  const mat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.85, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

// ---------- cups ----------

function latheProfile(silhouette: RewardRecipeDef['silhouette'] | CupCustom['silhouette']): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const push = (x: number, y: number) => pts.push(new THREE.Vector2(x, y));
  switch (silhouette) {
    case 'bloom':
    case 'round':
      push(0.0, 0.0); push(0.055, 0.0); push(0.07, 0.012); push(0.085, 0.05); push(0.1, 0.1); push(0.11, 0.14); push(0.105, 0.16);
      break;
    case 'grace':
    case 'tall':
      push(0.0, 0.0); push(0.045, 0.0); push(0.055, 0.014); push(0.06, 0.09); push(0.08, 0.17); push(0.095, 0.22); push(0.09, 0.24);
      break;
    case 'rest':
    case 'tulip':
      push(0.0, 0.0); push(0.05, 0.0); push(0.065, 0.012); push(0.09, 0.07); push(0.095, 0.13); push(0.075, 0.18); push(0.085, 0.21);
      break;
  }
  return pts;
}

const GOLD = () => new THREE.MeshStandardMaterial({ color: '#d9a94e', metalness: 0.85, roughness: 0.3 });

/** Ornate reward cup — recipe-specific (brief §5.3), deliberately separate from puzzle glasses. */
export function buildRewardCup(recipe: RewardRecipeDef): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(latheProfile(recipe.silhouette), 40), GOLD());
  g.add(body);
  // accent band
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(recipe.silhouette === 'grace' ? 0.075 : 0.1, 0.008, 10, 40),
    new THREE.MeshStandardMaterial({ color: recipe.accentHex, metalness: 0.4, roughness: 0.35, emissive: recipe.accentHex, emissiveIntensity: 0.25 })
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = recipe.silhouette === 'grace' ? 0.15 : 0.11;
  g.add(band);
  // gems on the rim
  const gemMat = new THREE.MeshStandardMaterial({ color: recipe.gemHex, metalness: 0.2, roughness: 0.15, emissive: recipe.gemHex, emissiveIntensity: 0.6 });
  for (let i = 0; i < 3; i++) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), gemMat);
    const a = (i / 3) * Math.PI * 2 + 0.5;
    gem.position.set(Math.cos(a) * (recipe.silhouette === 'grace' ? 0.088 : 0.1), recipe.silhouette === 'grace' ? 0.225 : 0.155, Math.sin(a) * (recipe.silhouette === 'grace' ? 0.088 : 0.1));
    g.add(gem);
  }
  // saucer
  const saucer = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0.0), new THREE.Vector2(0.1, 0.005), new THREE.Vector2(0.16, 0.02), new THREE.Vector2(0.165, 0.03),
  ], 40), GOLD());
  saucer.position.y = -0.004;
  g.add(saucer);
  return g;
}

/** Player-customized personal cup (brief §6) — distinct from puzzle glass & reward cups. */
export function buildPersonalCup(custom: CupCustom): THREE.Group {
  const g = new THREE.Group();
  const tex = cupPatternTexture(custom.pattern, custom.bodyHex);
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(latheProfile(custom.silhouette), 36),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.05 })
  );
  g.add(body);
  if (custom.handle === 'loop') {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 10, 24, Math.PI), new THREE.MeshStandardMaterial({ color: custom.bodyHex, roughness: 0.5 }));
    handle.rotation.z = Math.PI / 2;
    handle.rotation.y = Math.PI / 2;
    handle.position.set(-0.105, custom.silhouette === 'tall' ? 0.14 : 0.1, 0);
    g.add(handle);
  }
  return g;
}

// ---------- portrait card & familiar ----------

export async function makePortraitCard(imageUrl: string | null, label: string, sub: string): Promise<THREE.Mesh> {
  const tex = await portraitCard(imageUrl, label, sub);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.975),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  mesh.userData.kind = 'portrait';
  return mesh;
}

export async function makeFamiliar(imageUrl: string | null): Promise<THREE.Sprite> {
  const tex = await medallion(imageUrl);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  spr.scale.setScalar(0.34);
  spr.userData.kind = 'familiar';
  return spr;
}

// ---------- gentle effects ----------

export interface BurstOptions { reduced?: boolean; orbit?: boolean }

/** Soft sparkle burst / drifting motes. Reduced-motion: one calm glow. */
export function makeEffect(pos: THREE.Vector3, hex: string, kind: 'burst' | 'starlight' | 'petals' | 'fireflies' | 'embers' | 'moondust' | 'shimmer', opts: BurstOptions = {}): { obj: THREE.Object3D; update: (dt: number, t: number) => boolean; reduced: boolean } {
  const group = new THREE.Group();
  group.position.copy(pos);
  const colors = { starlight: '#fff2b8', embers: '#ffb066', petals: '#f2a0b5', fireflies: '#d8e8a0', moondust: '#cfd8ff', shimmer: '#ffe9c0', burst: hex }[kind];
  const col = new THREE.Color(colors);

  if (opts.reduced) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(colors), transparent: true, opacity: 0.85, depthWrite: false,
    }));
    glow.scale.setScalar(kind === 'shimmer' ? 0.22 : 0.3);
    group.add(glow);
    return {
      obj: group, reduced: true,
      update: (dt) => {
        glow.material.opacity -= dt * 0.8;
        glow.scale.multiplyScalar(1 + dt * 0.25);
        return glow.material.opacity > 0.02;
      },
    };
  }

  const N = kind === 'shimmer' ? 14 : 22;
  const positions = new Float32Array(N * 3);
  const vels: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 0.06;
    positions[i * 3 + 1] = Math.random() * 0.03;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
    const orbit = kind === 'fireflies' || kind === 'starlight' || kind === 'moondust';
    if (orbit) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.09 + Math.random() * 0.1;
      vels.push(new THREE.Vector3(Math.cos(a) * r, 0.05 + Math.random() * 0.1, Math.sin(a) * r));
    } else {
      vels.push(new THREE.Vector3((Math.random() - 0.5) * 0.16, 0.12 + Math.random() * 0.22, (Math.random() - 0.5) * 0.16));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: col, size: kind === 'petals' ? 0.02 : 0.014, transparent: true, opacity: 0.95,
    map: glowTexture(colors), depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  group.add(points);
  let life = 0;
  const maxLife = kind === 'fireflies' ? 4.2 : 2.2;
  return {
    obj: group, reduced: false,
    update: (dt) => {
      life += dt;
      const attr = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let x = attr.getX(i) + vels[i].x * dt;
        let y = attr.getY(i) + vels[i].y * dt;
        let z = attr.getZ(i) + vels[i].z * dt;
        if (kind === 'petals') { y -= dt * 0.1; x += Math.sin(life * 3 + i) * 0.0006; }
        if (kind === 'fireflies' || kind === 'starlight' || kind === 'moondust') {
          const swirl = dt * 1.2;
          const nx = x * Math.cos(swirl) - z * Math.sin(swirl);
          const nz = x * Math.sin(swirl) + z * Math.cos(swirl);
          x = nx; z = nz;
          y += Math.sin(life * 2 + i) * 0.0007;
        }
        attr.setXYZ(i, x, y, z);
      }
      attr.needsUpdate = true;
      mat.opacity = Math.max(0, 0.95 * (1 - life / maxLife));
      return life < maxLife;
    },
  };
}

let glowTexCache: Record<string, THREE.CanvasTexture> = {};
export function glowTexture(hex: string): THREE.CanvasTexture {
  if (glowTexCache[hex]) return glowTexCache[hex];
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, hex);
  g.addColorStop(0.4, hex + 'aa');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  glowTexCache[hex] = t;
  return t;
}

/** Rising steam sprites (kettle) — skipped entirely in reduced motion. */
export function makeSteam(pos: THREE.Vector3): { obj: THREE.Object3D; update: (dt: number, t: number) => void } {
  const group = new THREE.Group();
  group.position.copy(pos);
  const sprites: THREE.Sprite[] = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#f4ede0'), transparent: true, opacity: 0.25, depthWrite: false }));
    s.scale.setScalar(0.08);
    group.add(s);
    sprites.push(s);
  }
  return {
    obj: group,
    update: (_dt, t) => {
      sprites.forEach((s, i) => {
        const phase = (t * 0.35 + i / sprites.length) % 1;
        s.position.y = phase * 0.34;
        s.position.x = Math.sin(phase * 7 + i) * 0.03;
        s.material.opacity = 0.3 * Math.sin(Math.PI * phase);
        s.scale.setScalar(0.06 + phase * 0.1);
      });
    },
  };
}
