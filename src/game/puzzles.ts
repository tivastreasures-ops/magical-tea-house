/**
 * MTT puzzle state + pour validator (pure logic, no Three.js).
 * Data-driven per brief §12. Invalid pours NEVER corrupt state: the
 * validator returns a gentle reason string and the caller shows it as a
 * no-action cue (brief §5.1, acceptance C).
 */
import { TEA_COLORS, type ColorId, type Layer, type PuzzleDef, type PuzzleSnapshot } from './data';

export interface GlassState { capacity: number; layers: Layer[] }
export interface PuzzleState { glasses: GlassState[] }

export type InvalidReason =
  | 'same-glass'
  | 'source-empty'
  | 'locked-glass'
  | 'target-full'
  | 'colors-mix';

export const INVALID_MESSAGES: Record<InvalidReason, string> = {
  'same-glass': 'That is the same glass — pick a different one to pour into.',
  'source-empty': 'That glass is empty — nothing to pour yet.',
  'locked-glass': 'The honey layer is resting. This glass stays just as it is.',
  'target-full': 'That glass is full to the brim.',
  'colors-mix': 'Those colors would mix — pour onto the same color, or into an empty glass.',
};

export function cloneState(def: PuzzleDef): PuzzleState {
  return {
    glasses: def.glasses.map((g) => ({ capacity: g.capacity, layers: g.layers.map((l) => ({ ...l })) })),
  };
}

export function snapshot(s: PuzzleState): PuzzleSnapshot {
  return { glasses: s.glasses.map((g) => ({ capacity: g.capacity, layers: g.layers.map((l) => ({ ...l })) })) };
}

export function fromSnapshot(snap: PuzzleSnapshot): PuzzleState {
  return { glasses: snap.glasses.map((g) => ({ capacity: g.capacity, layers: g.layers.map((l) => ({ ...l })) })) };
}

export function validate(s: PuzzleState, from: number, to: number, def: PuzzleDef): InvalidReason | null {
  if (from === to) return 'same-glass';
  const src = s.glasses[from];
  const dst = s.glasses[to];
  if (!src || !dst) return 'same-glass';
  if (def.lockedGlass === from) return 'locked-glass';
  if (src.layers.length === 0) return 'source-empty';
  if (dst.layers.length >= dst.capacity) return 'target-full';
  if (def.pourRule === 'same-or-empty') {
    const top = src.layers[src.layers.length - 1];
    const dstTop = dst.layers[dst.layers.length - 1];
    if (dstTop && dstTop.color !== top.color) return 'colors-mix';
  }
  return null;
}

/** Applies a validated pour. Returns a NEW state; never mutates the input. */
export function applyPour(s: PuzzleState, from: number, to: number): { state: PuzzleState; moved: Layer } {
  const next = fromSnapshot(snapshot(s));
  const moved = next.glasses[from].layers.pop()!;
  next.glasses[to].layers.push(moved);
  return { state: next, moved };
}

export function isSolved(s: PuzzleState, def: PuzzleDef): boolean {
  switch (def.ruleType) {
    case 'sorted-vessels':
    case 'constraint': {
      // every glass single-color (empty allowed); constraint adds "locked glass untouched",
      // which the validator enforces at all times, so surviving state is valid by construction.
      return s.glasses.every((g) => {
        if (g.layers.length === 0) return true;
        const c = g.layers[0].color;
        return g.layers.every((l) => l.color === c);
      });
    }
    case 'target-stack': {
      if (def.targetIndex == null || !def.targetOrder) return false;
      const g = s.glasses[def.targetIndex];
      if (!g || g.layers.length !== def.targetOrder.length) return false;
      return def.targetOrder.every((c, i) => g.layers[i].color === c);
    }
  }
}

/** Human-readable glass summary for the HUD (symbols handled in UI). */
export function describeGlass(g: GlassState): string[] {
  if (g.layers.length === 0) return ['empty'];
  return g.layers.map((l) => TEA_COLORS[l.color as ColorId].name + (l.locked ? ' (resting)' : ''));
}

/** Quick solvability sanity check for authored puzzles (dev guard). */
export function sanitySolvable(def: PuzzleDef, maxDepth = 40): boolean {
  const seen = new Set<string>();
  const key = (s: PuzzleState) => s.glasses.map((g) => g.layers.map((l) => l.color[0]).join('')).join('|');
  const start = cloneState(def);
  const stack: { s: PuzzleState; d: number }[] = [{ s: start, d: 0 }];
  while (stack.length) {
    const { s, d } = stack.pop()!;
    if (isSolved(s, def)) return true;
    if (d >= maxDepth) continue;
    for (let i = 0; i < s.glasses.length; i++) {
      for (let j = 0; j < s.glasses.length; j++) {
        if (validate(s, i, j, def)) continue;
        const { state } = applyPour(s, i, j);
        const k = key(state);
        if (seen.has(k)) continue;
        seen.add(k);
        stack.push({ s: state, d: d + 1 });
      }
    }
  }
  return false;
}
