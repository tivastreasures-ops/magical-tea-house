'use client';

import * as THREE from 'three';
import { buildWorld, CAMERA_SPOTS, type WorldRefs } from './world';
import { AudioEngine, audio } from './audio';
import { ServiceController, QuietController, nextPuzzleDef, type EngineCtx, type EffectKind } from './modes';
import { makeEffect, makePortraitCard, makeFamiliar, makeSteam, type BurstOptions } from './glass';
import {
  MOODS, VISITORS, FAMILIARS, FAMILIAR_BLIPS, PUZZLES,
  type FamiliarId, type Location, type LightMood, type WeatherId, type PlaylistId,
} from './data';
import { clearDrafts, loadAll } from './persist';
import { mtt } from './store';

interface Tween { t: number; dur: number; update: (k: number) => void; done?: () => void; ease: (k: number) => number }
interface LiveEffect { obj: THREE.Object3D; update: (dt: number, t: number) => boolean }

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

/**
 * MTT engine — renderer, camera, teleport locomotion, interaction raycast,
 * atmosphere/mixer, reduced-motion handling and the store wiring that lets
 * the React HUD drive the world. Desktop-first; WebXR (Quest 3 seated) is a
 * later milestone (brief §12/M6) and is intentionally not stubbed as working.
 */
export class MttGame {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private world!: WorldRefs;
  private clock = new THREE.Clock();
  private time = 0;
  private tweens: Tween[] = [];
  private effects: LiveEffect[] = [];
  private steam: { obj: THREE.Object3D; update: (dt: number, t: number) => void } | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private camTarget = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private camLook = new THREE.Vector3();
  private portrait: THREE.Mesh | null = null;
  private familiar: THREE.Sprite | null = null;
  private service!: ServiceController;
  private quiet!: QuietController;
  private lastSettingsKey = '';
  private lastAtmoKey = '';
  private lastFamiliarId: FamiliarId | null = null;
  private disposed = false;
  private canvas: HTMLCanvasElement;
  private reducedMotion = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init() {
    const s = mtt.getState();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(58, (this.canvas.clientWidth || 16) / (this.canvas.clientHeight || 9), 0.05, 60);
    this.world = buildWorld(this.scene);
    this.applyMood(s.atmosphere.light);
    this.applyWeatherFx(s.atmosphere.weather);

    const spot = CAMERA_SPOTS.center;
    this.camera.position.copy(spot.pos);
    this.camLook.copy(spot.look);
    this.camTarget.pos.copy(spot.pos);
    this.camTarget.look.copy(spot.look);
    this.camera.lookAt(this.camLook);

    const ctx: EngineCtx = {
      scene: this.scene,
      world: this.world,
      audio,
      reduced: () => this.reducedMotion,
      tween: (dur, update, done, ease = easeOut) => { this.tweens.push({ t: 0, dur, update, done, ease }); },
      spawnEffect: (pos, hex, kind) => this.spawnEffect(pos, hex, kind),
    };
    this.service = new ServiceController(ctx);
    this.quiet = new QuietController(ctx);

    this.reducedMotion = s.settings.reducedMotion;
    this.world.windowPainter.setReduced(this.reducedMotion);

    // steam
    if (!this.reducedMotion) {
      this.steam = makeSteam(this.world.kettleSteamAnchor);
      this.scene.add(this.steam.obj);
    }

    // restore earned cups onto the shelf
    this.service.seedShelf(s.progress.earnedCups);

    this.wireActions();
    this.computeResumeOffer();
    this.bindPointer();
    window.addEventListener('resize', this.onResize);

    mtt.getState().set({ engineReady: true });
    this.renderer.setAnimationLoop(this.tick);
  }

  // ---------- store wiring ----------

  private wireActions() {
    const a = mtt.getState().actions;
    a.begin = () => {
      audio.init(mtt.getState().settings, (text, kind) => { if (text) mtt.getState().pushCaption(text, kind); });
      audio.resume();
      audio.startAmbience();
      const st = mtt.getState();
      const offer = st.resumeOffer;
      if (offer) return; // resume dialog is showing
      if (!st.progress.seenIntro) {
        st.set({ booted: true, screen: 'arrival' });
      } else {
        st.set({ booted: true, screen: 'center' });
      }
      st.pushCaption('Welcome in. Stay as long as you like.', 'line');
    };
    a.teleport = (loc: Location) => this.teleport(loc);
    a.setScreen = (scr) => {
      if (scr === 'service') this.teleport('counter');
      else if (scr === 'quiet') this.teleport('nook');
    };
    a.welcomeVisitor = (visitorId) => {
      const st = mtt.getState();
      const { def, cursor } = nextPuzzleDef(st.progress.puzzleCursor);
      st.updateProgress({ puzzleCursor: cursor, seenIntro: true });
      this.service.start(def, visitorId);
      this.teleport('counter');
    };
    a.resumeService = () => {
      const saved = loadAll().serviceDraft;
      const def = saved ? PUZZLES.find((p) => p.id === saved.puzzleId) : null;
      if (saved && def) {
        this.service.start(def, saved.visitorId, saved);
        this.teleport('counter');
      } else {
        this.teleport('counter');
      }
      mtt.getState().set({ resumeOffer: null });
    };
    a.resumeQuiet = () => {
      this.quiet.enter(loadAll().quietDraft ?? undefined);
      this.teleport('nook');
      mtt.getState().set({ resumeOffer: null });
    };
    a.startFresh = () => {
      clearDrafts();
      mtt.getState().set({ resumeOffer: null });
      const st = mtt.getState();
      if (!st.progress.seenIntro) st.set({ booted: true, screen: 'arrival' });
      else st.set({ booted: true, screen: 'center' });
    };
    a.selectGlass = (i) => {
      const st = mtt.getState();
      if (st.screen === 'service') this.service.selectGlass(i);
      else if (st.screen === 'quiet') this.quiet.selectGlass(i);
    };
    a.pourTo = (i) => {
      const st = mtt.getState();
      if (st.screen === 'service') this.service.selectGlass(i);
      else if (st.screen === 'quiet') this.quiet.pourBetween(st.quietFocused, i);
    };
    a.undoPuzzle = () => this.service.undo();
    a.resetPuzzle = () => this.service.reset();
    a.requestHint = () => this.service.hint();
    a.addIngredient = (color) => {
      if (mtt.getState().screen !== 'quiet') {
        mtt.getState().showToast('Slip over to the Quiet Nook to mix freely.');
        return;
      }
      this.quiet.addIngredient(color);
    };
    a.emptyGlass = (i) => this.quiet.emptyGlass(i);
    a.focusGlass = (i) => this.quiet.focusGlass(i);
    a.openSaveBlend = () => this.quiet.openSaveBlend();
    a.commitBlend = (name, effect, effectId, recognized) => this.quiet.commitBlend(name, effect, effectId, recognized);
    a.toggleFavorite = (cardId) => {
      const st = mtt.getState();
      st.setJournal(st.journal.map((c) => (c.id === cardId ? { ...c, favorite: !c.favorite } : c)));
    };
    a.saveVariant = (cardId, name) => {
      const st = mtt.getState();
      const src = st.journal.find((c) => c.id === cardId);
      if (!src) return;
      const variant = { ...src, id: `j-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, name: name.trim() || `${src.name} (variation)`, parentName: src.name, createdAt: Date.now(), favorite: false };
      st.setJournal([variant, ...st.journal]);
      st.showToast(`“${variant.name}” saved — the original is untouched.`);
      audio.saveChime();
    };
    a.deleteCard = (cardId) => {
      const st = mtt.getState();
      st.setJournal(st.journal.filter((c) => c.id !== cardId));
    };
    a.applyCup = (c) => {
      mtt.getState().setCup(c);
      this.quiet.applyCup(c);
      audio.saveChime();
    };
    a.pokeFamiliar = () => {
      const id = mtt.getState().settings.familiar;
      audio.familiar();
      if (id !== 'none') mtt.getState().pushCaption(FAMILIAR_BLIPS[id], 'line');
    };
  }

  private computeResumeOffer() {
    const saved = loadAll();
    const service = !!saved.serviceDraft;
    const quiet = !!saved.quietDraft;
    if (service || quiet) mtt.getState().set({ resumeOffer: { service, quiet } });
  }

  // ---------- navigation ----------

  teleport(loc: Location) {
    const spot = CAMERA_SPOTS[loc];
    this.camTarget.pos.copy(spot.pos);
    this.camTarget.look.copy(spot.look);
    audio.teleport();
    const st = mtt.getState();
    const label = loc === 'counter' ? 'the service counter' : loc === 'nook' ? 'the quiet nook' : 'the middle of the tent';
    st.pushCaption(`[you drift over to ${label}]`, 'sound');
    if (loc === 'counter') {
      st.set({ location: 'counter', screen: 'service' });
    } else if (loc === 'nook') {
      this.quiet.enter(loadAll().quietDraft ?? undefined);
      st.set({ location: 'nook' });
    } else {
      st.set({ location: 'center', screen: 'center' });
    }
  }

  // ---------- atmosphere ----------

  private applyMood(id: LightMood) {
    const m = MOODS[id];
    this.world.ambient.color.set(m.ambientHex);
    this.world.ambient.intensity = m.ambientIntensity;
    this.world.sun.color.set(m.sunHex);
    this.world.sun.intensity = m.sunIntensity;
    this.world.sun.position.set(...m.sunPos);
    this.world.lanterns.forEach((l) => {
      l.color.set(m.lanternHex);
      l.intensity = m.lanternIntensity;
    });
    this.scene.fog = new THREE.FogExp2(m.fogHex, m.fogDensity);
    this.scene.background = new THREE.Color(m.fogHex).multiplyScalar(0.9);
    this.world.windowPainter.set(m, mtt.getState().atmosphere.weather);
  }

  private applyWeatherFx(w: WeatherId) {
    this.world.windowPainter.set(MOODS[mtt.getState().atmosphere.light], w);
  }

  private applyPlaylist(p: PlaylistId) {
    audio.setPlaylist(p);
  }

  private applyAudioSettings() {
    audio.applySettings(mtt.getState().settings);
    const rm = mtt.getState().settings.reducedMotion;
    if (rm !== this.reducedMotion) {
      this.reducedMotion = rm;
      this.world.windowPainter.setReduced(rm);
      if (this.steam) this.steam.obj.visible = !rm;
    }
  }

  // ---------- effects ----------

  private spawnEffect(pos: THREE.Vector3, hex: string, kind: EffectKind) {
    const opts: BurstOptions = { reduced: this.reducedMotion };
    const eff = makeEffect(pos, hex, kind, opts);
    this.scene.add(eff.obj);
    this.effects.push({ obj: eff.obj, update: (dt, t) => eff.update(dt, t) });
  }

  // ---------- visitors & familiars ----------

  private async setVisitorCard(visitorId: string) {
    const visitor = VISITORS.find((v) => v.id === visitorId);
    if (!visitor) return;
    if (this.portrait) {
      this.portrait.removeFromParent();
      this.portrait = null;
    }
    const card = await makePortraitCard(visitor.portrait, visitor.label, 'concept reference · not final art');
    if (this.disposed) return;
    card.position.copy(this.world.visitorAnchor);
    card.rotation.y = Math.PI / 2;
    card.userData.kind = 'portrait';
    const mat = card.material as THREE.MeshBasicMaterial;
    mat.opacity = 0;
    this.scene.add(card);
    this.portrait = card;
    this.tweens.push({
      t: 0, dur: this.reducedMotion ? 0.2 : 1.1, ease: easeOut,
      update: (k) => {
        mat.opacity = k;
        card.position.y = this.world.visitorAnchor.y + (this.reducedMotion ? 0 : (1 - k) * 0.12);
      },
    });
    audio.shimmer();
  }

  private async setFamiliar(id: FamiliarId) {
    if (this.familiar) {
      this.familiar.removeFromParent();
      this.familiar = null;
    }
    if (id === 'none') return;
    const img = FAMILIARS.find((f) => f.id === id)?.image ?? null;
    const spr = await makeFamiliar(img);
    if (this.disposed) return;
    spr.position.copy(this.world.familiarAnchor);
    spr.userData.kind = 'familiar';
    this.scene.add(spr);
    this.familiar = spr;
  }

  // ---------- interaction ----------

  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
  }

  private setPointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e);
    const hit = this.castPointer();
    const el = this.renderer.domElement;
    el.style.cursor = hit ? 'pointer' : 'default';
    this.world.teleports.forEach((t) => this.world.discGlow(t, t === hit));
  };

  private castPointer(): THREE.Object3D | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const roots: THREE.Object3D[] = [
      ...this.world.teleports,
      this.world.journalBook,
      ...this.serviceGlasses(),
      ...this.quietGlasses(),
    ];
    if (this.portrait) roots.push(this.portrait);
    if (this.familiar) roots.push(this.familiar);
    const hits = this.raycaster.intersectObjects(roots, true);
    if (hits.length === 0) return null;
    let o: THREE.Object3D | null = hits[0].object;
    while (o) {
      if (o.userData.kind) return o;
      o = o.parent;
      if (o && (o.userData.kind || o.userData.isRoot)) break;
    }
    // climb to one of our roots
    o = hits[0].object;
    while (o) {
      if (roots.includes(o)) return o;
      o = o.parent;
    }
    return null;
  }

  private serviceGlasses(): THREE.Object3D[] {
     
    const list = (this.service as unknown as { glasses3d?: { group: THREE.Group }[] }).glasses3d ?? [];
    return list.map((g, i) => {
      g.group.userData.kind = 'glass';
      g.group.userData.glassIndex = i;
      return g.group;
    });
  }

  private quietGlasses(): THREE.Object3D[] {
     
    const list = (this.quiet as unknown as { glasses3d?: { group: THREE.Group }[] }).glasses3d ?? [];
    return list.map((g, i) => {
      g.group.userData.kind = 'glass';
      g.group.userData.glassIndex = i;
      return g.group;
    });
  }

  private onPointerDown = (e: PointerEvent) => {
    audio.resume();
    this.setPointer(e);
    const hit = this.castPointer();
    if (!hit) return;
    const kind = hit.userData.kind;
    if (kind === 'teleport') {
      const idx = this.world.teleports.indexOf(hit as THREE.Mesh);
      const loc: Location[] = ['center', 'counter', 'nook'];
      this.teleport(loc[idx]);
    } else if (kind === 'glass') {
      const idx = hit.userData.glassIndex as number;
      mtt.getState().actions.selectGlass(idx);
    } else if (kind === 'familiar') {
      mtt.getState().actions.pokeFamiliar();
    } else if (kind === 'journal') {
      audio.journalOpen();
      mtt.getState().patchUi({ modal: 'journal' });
    }
  };

  private onResize = () => {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  // ---------- main loop ----------

  private tick = () => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(tw.ease(k));
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.done?.();
      }
    }
    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (!this.effects[i].update(dt, this.time)) {
        this.effects[i].obj.removeFromParent();
        this.effects.splice(i, 1);
      }
    }
    // ambient motion (reduced-motion aware)
    if (this.steam && !this.reducedMotion) this.steam.update(dt, this.time);
    if (!this.reducedMotion) {
      this.world.teleports.forEach((t, i) => {
        const m = t.material as THREE.MeshStandardMaterial;
        m.opacity = 0.7 + Math.sin(this.time * 2 + i) * 0.15;
      });
      if (this.portrait) this.portrait.position.y = this.world.visitorAnchor.y + Math.sin(this.time * 0.8) * 0.015;
      if (this.familiar) {
        this.familiar.position.y = this.world.familiarAnchor.y + Math.sin(this.time * 1.3) * 0.03;
      }
      const jm = this.world.journalBook.material as THREE.MeshStandardMaterial;
      jm.emissiveIntensity = 0.3 + Math.sin(this.time * 1.7) * 0.12;
    }
    this.quiet.update(this.time, this.reducedMotion);
    this.world.windowPainter.paint(dt);

    // camera glide
    const damp = 1 - Math.exp(-4.2 * dt);
    if (this.reducedMotion) {
      this.camera.position.copy(this.camTarget.pos);
      this.camLook.copy(this.camTarget.look);
    } else {
      this.camera.position.lerp(this.camTarget.pos, damp);
      this.camLook.lerp(this.camTarget.look, damp);
    }
    this.camera.lookAt(this.camLook);

    // poll store-driven config
    const st = mtt.getState();
    const sk = JSON.stringify(st.settings);
    if (sk !== this.lastSettingsKey) {
      this.lastSettingsKey = sk;
      this.applyAudioSettings();
      if (this.lastFamiliarId !== st.settings.familiar) {
        this.lastFamiliarId = st.settings.familiar;
        void this.setFamiliar(st.settings.familiar);
      }
    }
    const ak = JSON.stringify(st.atmosphere);
    if (ak !== this.lastAtmoKey) {
      const prev = this.lastAtmoKey;
      this.lastAtmoKey = ak;
      const prevObj = prev ? (JSON.parse(prev) as { light: LightMood; weather: WeatherId; playlist: PlaylistId }) : null;
      if (!prevObj || prevObj.light !== st.atmosphere.light) this.applyMood(st.atmosphere.light);
      if (!prevObj || prevObj.weather !== st.atmosphere.weather) {
        this.applyWeatherFx(st.atmosphere.weather);
        audio.setWeather(st.atmosphere.weather);
      }
      if (!prevObj || prevObj.playlist !== st.atmosphere.playlist) this.applyPlaylist(st.atmosphere.playlist);
    }

    // visitor card sync (welcome actions set visitorId)
    if (st.visitorId && this.portrait?.userData.visitorId !== st.visitorId) {
      this.portrait = null;
      void this.setVisitorCard(st.visitorId).then(() => {
        if (this.portrait) this.portrait.userData.visitorId = st.visitorId;
      });
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.renderer?.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    const el = this.renderer?.domElement;
    if (el) {
      el.removeEventListener('pointermove', this.onPointerMove);
      el.removeEventListener('pointerdown', this.onPointerDown);
    }
    audio.dispose();
    this.renderer?.dispose();
  }
}
