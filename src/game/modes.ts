import * as THREE from 'three';
import { Glass3D, makeStream, buildRewardCup, buildPersonalCup, makeEffect, glowTexture } from './glass';
import { platePlaque, textSprite } from './textures';
import {
  PUZZLES, REWARD_RECIPES, TEA_COLORS, VISITORS, AUTHORED_RECIPES, EFFECT_LABELS,
  type ColorId, type Layer, type PuzzleDef, type EffectId, type PuzzleSnapshot,
} from './data';
import {
  cloneState, fromSnapshot, snapshot, validate, applyPour, isSolved,
  INVALID_MESSAGES, type PuzzleState, type InvalidReason,
} from './puzzles';
import type { ServiceDraft, QuietDraft, JournalCard, CupCustom } from './persist';
import { mtt } from './store';
import type { WorldRefs } from './world';
import type { AudioEngine } from './audio';

export type EffectKind = 'burst' | 'starlight' | 'petals' | 'fireflies' | 'embers' | 'moondust' | 'shimmer';

export interface EngineCtx {
  scene: THREE.Scene;
  world: WorldRefs;
  audio: AudioEngine;
  reduced: () => boolean;
  /** Adds a tween; update receives eased progress k (0→1). */
  tween: (dur: number, update: (k: number) => void, done?: () => void, ease?: (k: number) => number) => void;
  spawnEffect: (pos: THREE.Vector3, hex: string, kind: EffectKind) => void;
}

const ease = (k: number) => 1 - Math.pow(1 - k, 3);

function layerToView(layers: Layer[]) {
  return layers.map((l) => ({ color: l.color, locked: l.locked }));
}

function pushStateToStore(glasses: { capacity: number; layers: Layer[] }[]) {
  return glasses.map((g) => ({ capacity: g.capacity, layers: layerToView(g.layers) }));
}

// =====================================================================
// Tea Service controller
// =====================================================================

export class ServiceController {
  private ctx: EngineCtx;
  private glasses3d: Glass3D[] = [];
  private plateGroup: THREE.Group | null = null;
  private rewardCup: THREE.Group | null = null;
  private state: PuzzleState | null = null;
  private def: PuzzleDef | null = null;
  private visitorId: string | null = null;
  private history: PuzzleSnapshot[] = [];
  private solved = false;

  constructor(ctx: EngineCtx) { this.ctx = ctx; }

  get active() { return this.state !== null && !this.solved; }

  /** Begins (or resumes) a puzzle. draft = restored unsaved pour state. */
  start(def: PuzzleDef, visitorId: string, draft?: ServiceDraft | null) {
    this.def = def;
    this.visitorId = visitorId;
    this.solved = false;
    this.history = draft ? draft.history : [];
    this.state = draft ? fromSnapshot({ glasses: draft.glasses.map((g) => ({ capacity: g.capacity, layers: g.layers.map((l) => ({ ...l })) })) }) : cloneState(def);

    // rebuild glasses
    this.glasses3d.forEach((g) => g.group.removeFromParent());
    this.glasses3d = def.glasses.map((_, i) => {
      const g = new Glass3D();
      g.group.position.copy(this.ctx.world.glassAnchors[i]);
      this.ctx.scene.add(g.group);
      return g;
    });
    this.syncGlasses();

    if (!this.plateGroup) this.buildPlate(def);
    else this.refreshPlate(def);

    const visitor = VISITORS.find((v) => v.id === visitorId);
    mtt.getState().set({
      screen: 'service',
      puzzle: def,
      visitorId,
      servedThisVisit: false,
      glasses: pushStateToStore(this.state.glasses),
      selectedGlass: null,
      pourLocked: false,
    });
    mtt.getState().updateProgress({ seenIntro: true });
    this.persistDraft();
    if (!draft) {
      this.ctx.audio.shimmer();
      if (visitor) mtt.getState().pushCaption(visitor.arrivalLine, 'line');
    }
  }

  private syncGlasses() {
    this.state!.glasses.forEach((g, i) => this.glasses3d[i]?.setLayers(g.layers));
  }

  private buildPlate(def: PuzzleDef) {
    const group = new THREE.Group();
    const saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.035, 32),
      new THREE.MeshStandardMaterial({ color: '#f0e4cc', roughness: 0.35 })
    );
    group.add(saucer);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.014, 10, 40),
      new THREE.MeshStandardMaterial({ color: '#c9a25e', metalness: 0.6, roughness: 0.3 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.03;
    group.add(rim);
    group.position.copy(this.ctx.world.plateAnchor);
    this.ctx.scene.add(group);
    this.plateGroup = group;
    this.refreshPlate(def);
  }

  /** Stacked rings for target-stack, side-by-side rings otherwise; plaque always carries names + numbers. */
  private refreshPlate(def: PuzzleDef) {
    if (!this.plateGroup) return;
    // remove old rings + plaques
    [...this.plateGroup.children].forEach((c) => {
      if (c.userData.platePart) { c.removeFromParent(); }
    });
    const colors: ColorId[] = def.ruleType === 'target-stack'
      ? def.targetOrder!
      : [...new Set(def.glasses.flatMap((g) => g.layers.map((l) => l.color)))].filter((c) => c !== 'honey' || def.lockedGlass != null) as ColorId[];

    if (def.ruleType === 'target-stack') {
      colors.forEach((cid, i) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.19 - i * 0.042, 0.02, 10, 40),
          new THREE.MeshStandardMaterial({ color: TEA_COLORS[cid].hex, roughness: 0.3, emissive: TEA_COLORS[cid].hex, emissiveIntensity: 0.25 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.045 + i * 0.034;
        ring.userData.platePart = true;
        this.plateGroup!.add(ring);
      });
    } else {
      colors.forEach((cid, i) => {
        const a = -Math.PI / 2 + (i - (colors.length - 1) / 2) * 0.55;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.11, 0.02, 10, 36),
          new THREE.MeshStandardMaterial({ color: TEA_COLORS[cid].hex, roughness: 0.3, emissive: TEA_COLORS[cid].hex, emissiveIntensity: 0.25 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14);
        ring.userData.platePart = true;
        this.plateGroup!.add(ring);
        if (def.lockedGlass != null && cid === 'honey') {
          const note = new THREE.Mesh(
            new THREE.PlaneGeometry(0.3, 0.075),
            new THREE.MeshBasicMaterial({ map: textSprite(['resting — do not pour'], { font: 30, width: 560, bg: 'rgba(60,36,20,0.9)' }), transparent: true })
          );
          note.position.set(Math.cos(a) * 0.14, 0.16, Math.sin(a) * 0.14);
          note.userData.platePart = true;
          this.plateGroup!.add(note);
        }
      });
    }

    // plaque sprite with numbered, named rows (never color-only)
    const rows = def.ruleType === 'target-stack'
      ? def.targetOrder!.map((c) => TEA_COLORS[c])
      : colors.map((c) => TEA_COLORS[c]);
    const title = def.ruleType === 'target-stack' ? 'Layered Grace — pour in order' : 'A color for every glass';
    const tex = platePlaque(rows.map((r) => ({ hex: r.hex, glyph: r.glyph, name: r.name })), title);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const h = rows.length * 74 + 130;
    spr.scale.set(0.68, (0.68 * h) / 640, 1);
    spr.position.set(0, 0.52, 0);
    spr.userData.platePart = true;
    this.plateGroup.add(spr);
  }

  selectGlass(i: number) {
    const s = mtt.getState();
    if (!this.state || this.solved || s.pourLocked) return;
    if (s.selectedGlass == null) {
      s.set({ selectedGlass: i });
      this.glasses3d[i]?.setSelected(true);
      this.ctx.audio.select();
      const g = this.state.glasses[i];
      if (g.layers.length === 0) mtt.getState().pushCaption('That glass is empty — choose a glass with tea to pour.', 'cue');
      return;
    }
    const from = s.selectedGlass;
    if (from === i) {
      s.set({ selectedGlass: null });
      this.glasses3d[i]?.setSelected(false);
      return;
    }
    this.attemptPour(from, i);
  }

  attemptPour(from: number, to: number) {
    const s = mtt.getState();
    if (!this.state || !this.def || s.pourLocked) return;
    const reason: InvalidReason | null = validate(this.state, from, to, this.def);
    if (reason) {
      this.ctx.audio.invalid(INVALID_MESSAGES[reason]);
      const dst = this.glasses3d[to];
      if (dst) {
        const base = dst.group.position.clone();
        if (!this.ctx.reduced()) {
          this.ctx.tween(0.3, (k) => { dst.group.position.x = base.x + Math.sin(k * Math.PI) * 0.008; }, () => { dst.group.position.copy(base); });
        }
      }
      s.set({ selectedGlass: null });
      this.glasses3d.forEach((g) => g.setSelected(false));
      return;
    }
    // commit logic first (state is authoritative)
    this.history.push(snapshot(this.state));
    if (this.history.length > 12) this.history.shift();
    const { state, moved } = applyPour(this.state, from, to);
    this.state = state;
    s.set({ selectedGlass: null, pourLocked: true });
    this.glasses3d.forEach((g) => g.setSelected(false));
    this.animatePour(from, to, TEA_COLORS[moved.color].hex, () => {
      this.syncGlasses();
      s.set({ glasses: pushStateToStore(this.state!.glasses), pourLocked: false });
      this.persistDraft();
      if (isSolved(this.state!, this.def!)) this.onWin();
    });
  }

  private animatePour(from: number, to: number, hex: string, done: () => void) {
    const src = this.glasses3d[from];
    const dst = this.glasses3d[to];
    const reduced = this.ctx.reduced();
    this.ctx.audio.pour();
    const commit = () => {
      this.ctx.audio.settle();
      done();
      if (!reduced && dst) {
        dst.group.scale.set(1.03, 1.06, 1.03);
        this.ctx.tween(0.35, (k) => dst.group.scale.setScalar(1 + (1 - k) * 0.06), () => dst.group.scale.setScalar(1));
      }
    };
    if (reduced || !src || !dst) {
      setTimeout(commit, 120);
      return;
    }
    const fromP = src.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, src.topY() + 0.02, 0));
    const toP = dst.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, dst.topY() + 0.02, 0));
    const stream = makeStream(fromP, toP, hex);
    const smat = stream.material as THREE.MeshBasicMaterial;
    smat.opacity = 0;
    this.ctx.scene.add(stream);
    this.ctx.tween(0.22, (k) => { smat.opacity = k * 0.85; }, () => {
      this.ctx.tween(0.4, () => {}, () => {
        this.ctx.tween(0.25, (k) => { smat.opacity = 0.85 * (1 - k); }, () => {
          stream.removeFromParent();
          stream.geometry.dispose();
          commit();
        });
      });
    });
  }

  private onWin() {
    this.solved = true;
    const def = this.def!;
    const recipe = REWARD_RECIPES[def.rewardRecipe];
    const s = mtt.getState();
    this.ctx.audio.success();
    s.pushCaption('[a small bloom of light]', 'sound');
    // bloom
    const anchor = this.ctx.world.glassAnchors[0].clone().add(new THREE.Vector3(0, 0.15, 0));
    this.ctx.spawnEffect(anchor, recipe.accentHex, 'burst');
    // reward cup reveal
    if (this.rewardCup) this.rewardCup.removeFromParent();
    this.rewardCup = buildRewardCup(recipe);
    this.rewardCup.position.copy(this.ctx.world.rewardAnchor);
    this.rewardCup.scale.setScalar(0.01);
    this.ctx.scene.add(this.rewardCup);
    this.ctx.tween(0.9, (k) => this.rewardCup!.scale.setScalar(0.01 + k * 0.99), () => {
      this.ctx.audio.cupReveal();
      s.pushCaption('[the cup gleams]', 'sound');
    }, ease);
    if (!s.progress.earnedCups.includes(recipe.id)) {
      s.updateProgress({ earnedCups: [...s.progress.earnedCups, recipe.id] });
    }
    // a second earned cup joins the shelf
    this.addToShelf(recipe.id);
    const visitor = VISITORS.find((v) => v.id === this.visitorId);
    if (visitor) s.pushCaption(visitor.servedLine, 'line');
    s.set({
      servedThisVisit: true,
      puzzle: { ...def, name: def.name + ' — served' },
    });
    mtt.getState().persistServiceDraft(null);
    s.showToast(`The ${recipe.name} joins your shelf.`);
  }

  private shelfCups = new Set<string>();
  /** Restores previously earned cups to the display shelf (boot continuity). */
  seedShelf(ids: string[]) {
    ids.forEach((id) => this.addToShelf(id));
  }
  private addToShelf(recipeId: string) {
    if (this.shelfCups.has(recipeId)) return;
    this.shelfCups.add(recipeId);
    const recipe = REWARD_RECIPES[recipeId];
    const mini = buildRewardCup(recipe);
    mini.scale.setScalar(0.62);
    const count = this.shelfCups.size - 1;
    const base = new THREE.Vector3(-3.7, 1.65, -1.35);
    const along = new THREE.Vector3(-0.36, 0, 0.22).normalize();
    mini.position.copy(base).add(along.multiplyScalar(-0.42 + count * 0.42));
    mini.lookAt(0, 1.65, 0.6);
    this.ctx.scene.add(mini);
  }

  undo() {
    if (!this.state || !this.def || this.solved || this.history.length === 0) return;
    const snap = this.history.pop()!;
    this.state = fromSnapshot(snap);
    this.syncGlasses();
    mtt.getState().set({ glasses: pushStateToStore(this.state.glasses), selectedGlass: null });
    this.glasses3d.forEach((g) => g.setSelected(false));
    this.ctx.audio.settle();
    mtt.getState().pushCaption('[the last pour gently returns]', 'sound');
    this.persistDraft();
  }

  reset() {
    if (!this.def || this.solved) return;
    this.state = cloneState(this.def);
    this.history = [];
    this.syncGlasses();
    mtt.getState().set({ glasses: pushStateToStore(this.state.glasses), selectedGlass: null });
    this.glasses3d.forEach((g) => g.setSelected(false));
    this.ctx.audio.settle();
    mtt.getState().pushCaption('[fresh tea, no harm done]', 'sound');
    this.persistDraft();
  }

  private persistDraft() {
    if (!this.state || !this.def || this.solved) {
      mtt.getState().persistServiceDraft(null);
      return;
    }
    const draft: ServiceDraft = {
      puzzleId: this.def.id,
      visitorId: this.visitorId!,
      glasses: this.state.glasses.map((g) => ({ capacity: g.capacity, layers: g.layers.map((l) => ({ ...l })) })),
      history: this.history.slice(-12),
      startedAt: Date.now(),
    };
    mtt.getState().persistServiceDraft(draft);
  }

  hint() {
    if (!this.def) return;
    mtt.getState().pushCaption(this.def.hint, 'cue');
  }
}

// =====================================================================
// Quiet Mode controller
// =====================================================================

export class QuietController {
  private ctx: EngineCtx;
  private tray: THREE.Group | null = null;
  private glasses3d: Glass3D[] = [];
  private personalCup: THREE.Group | null = null;
  private state: { capacity: number; layers: Layer[] }[] = [
    { capacity: 3, layers: [] },
    { capacity: 3, layers: [] },
  ];
  private focused = 0;

  constructor(ctx: EngineCtx) { this.ctx = ctx; }

  get active() { return this.tray !== null; }

  enter(draft?: QuietDraft | null) {
    if (!this.tray) this.buildTray();
    if (draft) {
      this.state = draft.glasses.map((g) => ({ capacity: g.capacity, layers: g.layers.map((l) => ({ ...l })) }));
      this.focused = draft.focused;
    }
    this.sync();
    mtt.getState().set({ screen: 'quiet', quietGlasses: pushStateToStore(this.state), quietFocused: this.focused, selectedGlass: null });
    mtt.getState().updateProgress({ seenIntro: true });
    this.persistDraft();
    if (!draft) this.ctx.audio.journalOpen();
  }

  private buildTray() {
    const tray = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.035, 0.3),
      new THREE.MeshStandardMaterial({ color: '#8a5a33', roughness: 0.5, emissive: '#c9a25e', emissiveIntensity: 0.08 })
    );
    tray.add(board);
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(0.01, 0.008, 8, 20),
      new THREE.MeshStandardMaterial({ color: '#c9a25e', metalness: 0.7, roughness: 0.3 })
    );
    trim.visible = false;
    tray.add(trim);
    // soft glow beneath (magic, engine effect)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#c9a25e'), transparent: true, opacity: 0.4, depthWrite: false }));
    glow.scale.set(0.7, 0.25, 1);
    glow.position.y = -0.1;
    tray.add(glow);
    tray.position.copy(this.ctx.world.trayAnchor);
    tray.scale.setScalar(0.01);
    this.ctx.scene.add(tray);
    this.tray = tray;
    this.ctx.tween(0.8, (k) => tray.scale.setScalar(0.01 + k * 0.99), undefined, ease);

    this.glasses3d = [0, 1].map(() => {
      const g = new Glass3D(0.07, 0.18);
      tray.add(g.group);
      return g;
    });
    this.glasses3d[0].group.position.set(-0.15, 0.02, 0);
    this.glasses3d[1].group.position.set(0.12, 0.02, 0.02);
    this.applyCup(mtt.getState().cup);
  }

  applyCup(custom: CupCustom) {
    if (!this.tray) return;
    if (this.personalCup) this.personalCup.removeFromParent();
    this.personalCup = buildPersonalCup(custom);
    this.personalCup.position.set(0.24, 0.02, -0.06);
    this.personalCup.scale.setScalar(0.9);
    this.tray.add(this.personalCup);
  }

  private sync() {
    this.state.forEach((g, i) => this.glasses3d[i]?.setLayers(g.layers));
    this.glasses3d.forEach((g, i) => g.setSelected(i === this.focused));
  }

  focusGlass(i: number) {
    this.focused = i;
    this.sync();
    mtt.getState().set({ quietFocused: i });
    this.ctx.audio.select();
  }

  selectGlass(i: number) {
    if (mtt.getState().quietFocused === i) return;
    // clicking the other glass pours focused → other
    this.pourBetween(mtt.getState().quietFocused, i);
  }

  addIngredient(color: ColorId) {
    const dst = this.state[this.focused];
    if (dst.layers.length >= dst.capacity) {
      this.ctx.audio.invalid('That glass is full — pour something out first, or choose the other glass.');
      return;
    }
    const srcPos = this.glasses3d[this.focused].group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.1, 0.3, 0));
    const toP = this.glasses3d[this.focused].group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.2, 0));
    this.ctx.audio.pour();
    mtt.getState().pushCaption(`[a jar of ${TEA_COLORS[color].name} drifts over and tips]`, 'sound');
    const commit = () => {
      dst.layers.push({ color });
      this.sync();
      this.persistDraft();
      this.ctx.audio.settle();
      mtt.getState().set({ quietGlasses: pushStateToStore(this.state) });
    };
    if (this.ctx.reduced()) { setTimeout(commit, 100); return; }
    const stream = makeStream(srcPos, toP, TEA_COLORS[color].hex);
    const smat = stream.material as THREE.MeshBasicMaterial;
    smat.opacity = 0;
    this.ctx.scene.add(stream);
    this.ctx.tween(0.2, (k) => { smat.opacity = k * 0.85; }, () => {
      this.ctx.tween(0.32, () => {}, () => {
        this.ctx.tween(0.2, (k) => { smat.opacity = 0.85 * (1 - k); }, () => {
          stream.removeFromParent();
          stream.geometry.dispose();
          commit();
        });
      });
    });
  }

  pourBetween(from: number, to: number) {
    if (from === to) return;
    const src = this.state[from];
    const dst = this.state[to];
    if (src.layers.length === 0) {
      this.ctx.audio.invalid('That glass is empty — nothing to pour yet.');
      return;
    }
    if (dst.layers.length >= dst.capacity) {
      this.ctx.audio.invalid('That glass is full to the brim.');
      return;
    }
    const moved = src.layers[src.layers.length - 1];
    this.ctx.audio.pour();
    const commit = () => {
      src.layers.pop();
      dst.layers.push({ ...moved });
      this.focused = to;
      this.sync();
      this.persistDraft();
      this.ctx.audio.settle();
      mtt.getState().set({ quietGlasses: pushStateToStore(this.state), quietFocused: to });
    };
    if (this.ctx.reduced()) { setTimeout(commit, 100); return; }
    const fromP = this.glasses3d[from].group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.19, 0));
    const toP = this.glasses3d[to].group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.19, 0));
    const stream = makeStream(fromP, toP, TEA_COLORS[moved.color].hex);
    const smat = stream.material as THREE.MeshBasicMaterial;
    smat.opacity = 0;
    this.ctx.scene.add(stream);
    this.ctx.tween(0.2, (k) => { smat.opacity = k * 0.85; }, () => {
      this.ctx.tween(0.3, () => {}, () => {
        this.ctx.tween(0.2, (k) => { smat.opacity = 0.85 * (1 - k); }, () => {
          stream.removeFromParent();
          stream.geometry.dispose();
          commit();
        });
      });
    });
  }

  emptyGlass(i: number) {
    const g = this.state[i];
    if (g.layers.length === 0) return;
    g.layers = [];
    this.sync();
    this.persistDraft();
    this.ctx.audio.settle();
    mtt.getState().pushCaption('[the glass empties, gently]', 'sound');
    mtt.getState().set({ quietGlasses: pushStateToStore(this.state) });
  }

  /** Builds the pending blend from the focused glass and opens the save modal. */
  openSaveBlend() {
    const g = this.state[this.focused];
    if (g.layers.length === 0) {
      mtt.getState().showToast('The glass is empty — mix something first.');
      return;
    }
    const colors = g.layers.map((l) => TEA_COLORS[l.color].hex);
    const ids = g.layers.map((l) => l.color).sort().join(',');
    const authored = AUTHORED_RECIPES.find((r) => [...r.colors].sort().join(',') === ids);
    mtt.getState().set({
      pendingBlend: {
        colors,
        ingredientNames: g.layers.map((l) => TEA_COLORS[l.color].name),
        recognized: !!authored,
        authoredName: authored?.name,
        authoredEffect: authored ? EFFECT_LABELS[authored.effect] : undefined,
        authoredEffectId: authored?.effect,
      },
    });
    mtt.getState().patchUi({ modal: 'save-blend', saveBlendName: authored?.name ?? '' });
    this.ctx.audio.journalOpen();
  }

  commitBlend(name: string, effectLabel: string, effectId: string, recognized: boolean) {
    const s = mtt.getState();
    const g = this.state[this.focused];
    const card: JournalCard = {
      id: `j-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
      name: name.trim() || 'Unnamed Blend',
      colors: g.layers.map((l) => TEA_COLORS[l.color].hex),
      ingredientNames: g.layers.map((l) => TEA_COLORS[l.color].name),
      effect: effectLabel,
      effectId,
      recognized,
      authoredId: recognized ? AUTHORED_RECIPES.find((r) => [...r.colors].sort().join(',') === g.layers.map((l) => l.color).sort().join(','))?.id : undefined,
      favorite: false,
      createdAt: Date.now(),
    };
    s.setJournal([card, ...s.journal]);
    s.showToast(`“${card.name}” saved to your journal.`);
    this.ctx.audio.saveChime();
    // shimmer effect above the glass
    const kindMap: Record<string, EffectKind> = {
      starlight: 'starlight', embers: 'embers', petals: 'petals', moondust: 'moondust',
      sparkle: 'burst', fireflies: 'fireflies', shimmer: 'shimmer', none: 'shimmer',
    };
    const kind = kindMap[effectId] ?? 'shimmer';
    if (effectId !== 'none') {
      const pos = this.glasses3d[this.focused].group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.22, 0));
      this.ctx.spawnEffect(pos, '#ffe2a0', kind);
    }
    s.set({ pendingBlend: null });
    s.patchUi({ modal: null });
  }

  private persistDraft() {
    const draft: QuietDraft = {
      glasses: this.state.map((g) => ({ capacity: g.capacity, layers: g.layers.map((l) => ({ ...l })) })),
      focused: this.focused,
    };
    mtt.getState().persistQuietDraft(draft);
  }

  /** Called once per frame from the engine: tray bob. */
  update(t: number, reduced: boolean) {
    if (!this.tray) return;
    const amp = reduced ? 0 : 0.012;
    this.tray.position.y = this.ctx.world.trayAnchor.y + Math.sin(t * 0.9) * amp;
    this.tray.rotation.z = Math.sin(t * 0.55) * (reduced ? 0 : 0.008);
  }
}

// =====================================================================
// helpers shared with engine
// =====================================================================

export function nextPuzzleDef(cursor: number): { def: PuzzleDef; cursor: number } {
  const idx = cursor % PUZZLES.length;
  return { def: PUZZLES[idx], cursor: idx + 1 };
}

export function matchAuthoredName(id?: string) {
  return AUTHORED_RECIPES.find((r) => r.id === id)?.name ?? 'A blend of your own';
}

export { validate, isSolved };
