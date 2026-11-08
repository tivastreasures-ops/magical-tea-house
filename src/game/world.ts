import * as THREE from 'three';
import { fabricTexture, woodTexture, rugTexture, textSprite, WindowPainter } from './textures';

/**
 * MTT tent shell — one intimate room (brief §8): curved service counter to
 * the left, quiet floor-cushion nest to the right, clear sightlines, garden
 * window. Everything is modular placeholder geometry (primitive "artist
 * blocks") awaiting the approved 3D pipeline — nothing here claims to be
 * final art. Weather/light are engine effects, never baked geometry.
 */

export interface WorldRefs {
  scene: THREE.Scene;
  ambient: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  lanterns: THREE.PointLight[];
  windowPainter: WindowPainter;
  teleports: THREE.Mesh[];
  discGlow: (mesh: THREE.Mesh, on: boolean) => void;
  counterTopY: number;
  glassAnchors: THREE.Vector3[];
  plateAnchor: THREE.Vector3;
  rewardAnchor: THREE.Vector3;
  trayAnchor: THREE.Vector3;
  kettleSteamAnchor: THREE.Vector3;
  jarAnchor: THREE.Vector3;
  visitorAnchor: THREE.Vector3;
  familiarAnchor: THREE.Vector3;
  journalBook: THREE.Mesh;
  steamGroup: THREE.Group;
}

const COUNTER_C = new THREE.Vector3(-2.6, 0, 0);

export function buildWorld(scene: THREE.Scene): WorldRefs {
  const wood = woodTexture();
  const woodLight = woodTexture('#a5713f', '#bd8a54', '#8a5a33');
  const fabric = fabricTexture();

  // ---------- shell ----------
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.7 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.userData.repeat = [4, 4];
  (floor.material as THREE.MeshStandardMaterial).map!.repeat.set(4, 4);
  scene.add(floor);

  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(4.4, 4.4, 3.1, 40, 1, true),
    new THREE.MeshStandardMaterial({ map: fabric, roughness: 0.9, side: THREE.BackSide })
  );
  wall.position.y = 1.55;
  (wall.material as THREE.MeshStandardMaterial).map!.repeat.set(6, 1);
  scene.add(wall);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(4.65, 1.7, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: '#c98a6a', roughness: 0.95, side: THREE.BackSide })
  );
  roof.position.y = 3.95;
  scene.add(roof);

  // wooden poles
  const poleMat = new THREE.MeshStandardMaterial({ color: '#6e4526', roughness: 0.7 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 3.1, 10), poleMat);
    pole.position.set(Math.cos(a) * 4.28, 1.55, Math.sin(a) * 4.28);
    scene.add(pole);
  }

  // ---------- lighting (mood-controlled) ----------
  const ambient = new THREE.HemisphereLight('#fff2dd', '#8a6a4a', 1.0);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffedc9', 1.4);
  sun.position.set(3, 6, 2);
  scene.add(sun);
  const lanterns: THREE.PointLight[] = [];
  const lanternPos: [number, number, number][] = [
    [-1.7, 2.15, 0.6], [1.9, 2.2, 0.4], [0, 2.4, 2.2],
  ];
  lanternPos.forEach((p) => {
    const l = new THREE.PointLight('#ffc985', 0.8, 6, 1.6);
    l.position.set(...p);
    scene.add(l);
    lanterns.push(l);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#ffdca0', emissive: '#ffbf74', emissiveIntensity: 1.6 })
    );
    bulb.position.copy(l.position);
    scene.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 3.9 - p[1], 6), poleMat);
    cord.position.set(p[0], p[1] + (3.9 - p[1]) / 2, p[2]);
    scene.add(cord);
  });

  // ---------- curved counter (left) ----------
  const counterTopY = 0.95;
  const sector = (rIn: number, rOut: number, a0: number, a1: number) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, rOut, a0, a1, false);
    shape.absarc(0, 0, rIn, a1, a0, true);
    return shape;
  };
  const counterMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 });
  const counterShape = sector(1.05, 1.5, -Math.PI * 0.62, Math.PI * 0.62);
  const counterGeo = new THREE.ExtrudeGeometry(counterShape, { depth: counterTopY - 0.06, bevelEnabled: false, curveSegments: 32 });
  counterGeo.rotateX(-Math.PI / 2);
  const counter = new THREE.Mesh(counterGeo, counterMat);
  counter.position.set(COUNTER_C.x, 0.06, COUNTER_C.z);
  scene.add(counter);
  const topGeo = new THREE.ExtrudeGeometry(sector(1.0, 1.56, -Math.PI * 0.64, Math.PI * 0.64), { depth: 0.05, bevelEnabled: false, curveSegments: 32 });
  topGeo.rotateX(-Math.PI / 2);
  const counterTop = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ map: woodLight, roughness: 0.4 }));
  counterTop.position.set(COUNTER_C.x, counterTopY, COUNTER_C.z);
  scene.add(counterTop);

  // working anchors along the counter arc
  const anchorAt = (deg: number, r = 1.28, y = counterTopY + 0.004) =>
    new THREE.Vector3(COUNTER_C.x + r * Math.cos((deg * Math.PI) / 180), y, COUNTER_C.z + r * Math.sin((deg * Math.PI) / 180));
  const glassAnchors = [anchorAt(42), anchorAt(14), anchorAt(-14), anchorAt(-42), anchorAt(-68)];
  const plateAnchor = anchorAt(74);
  const rewardAnchor = anchorAt(-90, 1.24);

  // shelf behind counter for earned cups
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.3), new THREE.MeshStandardMaterial({ map: woodLight, roughness: 0.5 }));
  shelf.position.set(-3.7, 1.62, -1.35);
  shelf.lookAt(0, 1.62, 0.6);
  scene.add(shelf);
  const shelfBrackets = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.05, 0.06), poleMat);
  shelfBrackets.position.copy(shelf.position);
  shelfBrackets.quaternion.copy(shelf.quaternion);
  shelfBrackets.translateY(-0.05);
  shelfBrackets.translateZ(-0.1);
  scene.add(shelfBrackets);

  // ---------- garden window (back) ----------
  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.82, 0.1, 14, 48),
    new THREE.MeshStandardMaterial({ color: '#a5713f', roughness: 0.45 })
  );
  frame.position.set(0, 1.72, -4.33);
  scene.add(frame);
  const painter = new WindowPainter();
  const sky = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 40),
    new THREE.MeshBasicMaterial({ map: painter.texture })
  );
  sky.position.set(0, 1.72, -4.4);
  scene.add(sky);
  // sill + curtains
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.07, 0.16), new THREE.MeshStandardMaterial({ map: woodLight, roughness: 0.5 }));
  sill.position.set(0, 0.92, -4.26);
  scene.add(sill);
  const curtainMat = new THREE.MeshStandardMaterial({ color: '#b48ec7', roughness: 0.85, side: THREE.DoubleSide });
  [-1, 1].forEach((s) => {
    const cur = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.5, 8, 8), curtainMat);
    cur.position.set(s * 1.15, 1.8, -4.28);
    cur.rotation.y = s * 0.25;
    const pos = cur.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 12) * 0.05);
    pos.needsUpdate = true;
    scene.add(cur);
  });

  // ---------- quiet nook (right) ----------
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.35, 40), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.9 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(2.0, 0.012, 0.35);
  scene.add(rug);
  const cushion = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 28, 20),
    new THREE.MeshStandardMaterial({ color: '#e8a0b0', roughness: 0.9 })
  );
  cushion.scale.set(1, 0.34, 1);
  cushion.position.set(2.2, 0.28, 0.25);
  scene.add(cushion);
  const pillowColors = ['#7fb0a5', '#e8c46a', '#b48ec7'];
  pillowColors.forEach((c, i) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    p.scale.set(1, 0.55, 1);
    const a = 0.6 + i * 1.5;
    p.position.set(2.2 + Math.cos(a) * 0.62, 0.15, 0.25 + Math.sin(a) * 0.62);
    scene.add(p);
  });
  // side table + summoned journal
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.52, 20), counterMat);
  table.position.set(1.15, 0.26, 1.25);
  scene.add(table);
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.045, 24), new THREE.MeshStandardMaterial({ map: woodLight, roughness: 0.4 }));
  tableTop.position.set(1.15, 0.54, 1.25);
  scene.add(tableTop);
  const journalBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.06, 0.26),
    new THREE.MeshStandardMaterial({ color: '#7a4a8a', roughness: 0.5, emissive: '#9a6ab8', emissiveIntensity: 0.35 })
  );
  journalBook.position.set(1.15, 0.6, 1.25);
  journalBook.rotation.y = 0.5;
  journalBook.userData.kind = 'journal';
  scene.add(journalBook);

  // ---------- kettle & steam (side table near counter) ----------
  const kettleTable = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.7, 16), counterMat);
  kettleTable.position.set(-1.35, 0.35, 1.6);
  scene.add(kettleTable);
  const kettle = new THREE.Group();
  const kBody = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.001, 0), new THREE.Vector2(0.09, 0.005), new THREE.Vector2(0.12, 0.06),
      new THREE.Vector2(0.13, 0.13), new THREE.Vector2(0.1, 0.19), new THREE.Vector2(0.085, 0.2),
    ], 24),
    new THREE.MeshStandardMaterial({ color: '#c9a25e', metalness: 0.75, roughness: 0.35 })
  );
  kettle.add(kBody);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.14, 10), kBody.material as THREE.Material);
  spout.position.set(0.12, 0.16, 0);
  spout.rotation.z = -0.7;
  kettle.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 8, 20, Math.PI), kBody.material as THREE.Material);
  handle.position.set(0, 0.17, -0.1);
  handle.rotation.x = 0.25;
  kettle.add(handle);
  kettle.position.set(-1.35, 0.72, 1.6);
  scene.add(kettle);
  const steamGroup = new THREE.Group();
  steamGroup.position.set(-1.35, 0.95, 1.6);
  scene.add(steamGroup);

  // ---------- teleport discs ----------
  const teleports: THREE.Mesh[] = [];
  const discMat = () => new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffc266', emissiveIntensity: 0.55, transparent: true, opacity: 0.85, roughness: 0.4 });
  const discSpots: [number, number][] = [[0, 1.35], [-1.05, 0.1], [0.95, 1.15]];
  discSpots.forEach(([x, z]) => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.02, 32), discMat());
    disc.position.set(x, 0.012, z);
    disc.userData.kind = 'teleport';
    scene.add(disc);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.014, 8, 40),
      new THREE.MeshStandardMaterial({ color: '#e8c46a', emissive: '#d9a94e', emissiveIntensity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.02, z);
    scene.add(ring);
    teleports.push(disc);
  });
  const discGlow = (mesh: THREE.Mesh, on: boolean) => {
    const m = mesh.material as THREE.MeshStandardMaterial;
    m.emissiveIntensity = on ? 1.3 : 0.55;
  };

  // signs
  const signA = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.24),
    new THREE.MeshBasicMaterial({ map: textSprite(['Tea Service'], { font: 52, width: 640, border: '#c9a25e' }), transparent: true })
  );
  signA.position.set(-2.1, 2.5, 0.2);
  scene.add(signA);
  const signB = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 0.24),
    new THREE.MeshBasicMaterial({ map: textSprite(['Quiet Nook'], { font: 52, width: 640, border: '#c9a25e' }), transparent: true })
  );
  signB.position.set(2.0, 2.45, 0.4);
  scene.add(signB);

  const trayAnchor = new THREE.Vector3(1.85, 0.72, 0.15);
  const kettleSteamAnchor = new THREE.Vector3(-1.35, 0.95, 1.6);
  const jarAnchor = new THREE.Vector3(1.15, 0.62, 1.25);
  const visitorAnchor = new THREE.Vector3(-3.15, 1.32, 0.15);
  const familiarAnchor = new THREE.Vector3(1.3, 1.55, 0.95);

  return {
    scene, ambient, sun, lanterns, windowPainter: painter, teleports, discGlow,
    counterTopY, glassAnchors, plateAnchor, rewardAnchor, trayAnchor,
    kettleSteamAnchor, jarAnchor, visitorAnchor, familiarAnchor,
    journalBook, steamGroup,
  };
}

/** Camera seating positions (brief §11: seated-first, stable horizon, no walking). */
export const CAMERA_SPOTS = {
  center: { pos: new THREE.Vector3(0, 1.4, 2.35), look: new THREE.Vector3(0, 1.05, -1.5) },
  counter: { pos: new THREE.Vector3(-1.05, 1.42, 0.1), look: new THREE.Vector3(-2.35, 0.98, -0.05) },
  nook: { pos: new THREE.Vector3(0.95, 1.28, 1.85), look: new THREE.Vector3(2.1, 0.62, 0.1) },
};
