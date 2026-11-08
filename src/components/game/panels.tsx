'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { mtt } from '@/game/store';
import {
  TEA_COLORS, CUP_BODY_COLORS, MOODS, LIGHT_MOOD_ORDER, WEATHER_LABELS, PLAYLIST_LABELS,
  CHOOSABLE_EFFECTS, EFFECT_LABELS, FAMILIARS, type TeaColorDef,
} from '@/game/data';
import type { CupPattern, CupSilhouette } from '@/game/data';

/* ================= shared bits ================= */

export function Glyph({ glyph, color = '#f2dfb8', size = 16 }: { glyph: TeaColorDef['glyph']; color?: string; size?: number }) {
  const s = size;
  const starPts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 9 : 3.8;
    return `${12 + Math.cos(a) * r},${12 + Math.sin(a) * r}`;
  }).join(' ');
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden className="inline-block shrink-0">
      {glyph === 'sun' && (
        <g fill={color}>
          <circle cx="12" cy="12" r="5" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return <line key={i} x1={12 + Math.cos(a) * 7} y1={12 + Math.sin(a) * 7} x2={12 + Math.cos(a) * 10.5} y2={12 + Math.sin(a) * 10.5} stroke={color} strokeWidth="2.4" strokeLinecap="round" />;
          })}
        </g>
      )}
      {glyph === 'flower' && (
        <g>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return <ellipse key={i} cx={12 + Math.cos(a) * 4.6} cy={12 + Math.sin(a) * 4.6} rx="3.4" ry="2.4" fill={color} transform={`rotate(${(a * 180) / Math.PI} ${12 + Math.cos(a) * 4.6} ${12 + Math.sin(a) * 4.6})`} />;
          })}
          <circle cx="12" cy="12" r="2.2" fill="#fff8ec" />
        </g>
      )}
      {glyph === 'star' && <polygon points={starPts} fill={color} />}
      {glyph === 'drop' && <path d="M12 2.5 C16 8 18 11.5 18 14.5 A6 6 0 1 1 6 14.5 C6 11.5 8 8 12 2.5 Z" fill={color} />}
      {glyph === 'bell' && (
        <g fill={color}>
          <path d="M12 3 C8 3 6.5 6.5 6.5 10 L6.5 14 L4.8 17 L19.2 17 L17.5 14 L17.5 10 C17.5 6.5 16 3 12 3 Z" />
          <circle cx="12" cy="19.4" r="1.9" />
        </g>
      )}
      {glyph === 'leaf' && (
        <g>
          <path d="M12 2.5 C18 7 18 15 12 21.5 C6 15 6 7 12 2.5 Z" fill={color} />
          <line x1="12" y1="5" x2="12" y2="19" stroke="#fff8ec" strokeWidth="1.4" />
        </g>
      )}
      {glyph === 'circle' && (
        <g>
          <circle cx="12" cy="12" r="7.5" fill="none" stroke={color} strokeWidth="2.4" />
          <circle cx="12" cy="12" r="2.8" fill={color} />
        </g>
      )}
    </svg>
  );
}

/** Bottom→top layer preview used by chips and journal cards. */
export function LayerStack({ colors, height = 40, width = 18, radius = 4 }: { colors: string[]; height?: number; width?: number; radius?: number }) {
  const seg = Math.max(6, Math.floor(height / Math.max(colors.length, 1)));
  return (
    <span
      className="inline-flex flex-col-reverse overflow-hidden border border-[#e8a34d55]"
      style={{ width, height: colors.length ? seg * colors.length : height, borderRadius: radius, background: 'rgba(223,240,238,0.12)' }}
    >
      {colors.map((c, i) => (
        <span key={i} style={{ height: seg, background: c, opacity: 0.92 }} />
      ))}
    </span>
  );
}

export function Chip({ children, selected = false, onClick, title, className = '' }: { children: React.ReactNode; selected?: boolean; onClick?: () => void; title?: string; className?: string }) {
  return (
    <button title={title} onClick={onClick} data-selected={selected} className={`mtt-chip rounded-xl px-3 py-2 text-sm text-[#f2dfb8] ${className}`}>
      {children}
    </button>
  );
}

/* ================= How to Pour ================= */

export function HowToDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg border-[#e8a34d55] bg-[#30120e]/0" style={undefined}>
        <div className="mtt-panel mtt-scroll max-h-[80vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-story text-xl text-[#f2dfb8]">How to Pour</DialogTitle>
            <DialogDescription className="text-[#cbb389]">Everything you need — nothing you must do.</DialogDescription>
          </DialogHeader>
          <ol className="mt-4 space-y-4 text-sm leading-relaxed text-[#e8d9bd]">
            <li>
              <span className="font-semibold text-[#f2dfb8]">1 · Read the plate.</span> A visitor&apos;s saucer shows
              colored rings with numbered pips, glyphs and names — the order is always readable without color alone.
              Widest ring is the bottom of the glass.
            </li>
            <li>
              <span className="font-semibold text-[#f2dfb8]">2 · Tap a glass with tea, then tap where it pours.</span>
              One tap selects the source (a soft ring appears), the second tap pours a single layer. You can also use
              the glass buttons below the scene — the same rules, fully keyboard-friendly.
            </li>
            <li>
              <span className="font-semibold text-[#f2dfb8]">3 · Match the plate.</span> Some teas want every glass
              sorted; some want one glass stacked in order; some have a special rule on the plate. When it&apos;s right,
              the tea settles — gently.
            </li>
          </ol>
          <div className="mt-4 rounded-xl bg-[#4a302040] p-3 text-xs leading-relaxed text-[#cbb389]">
            Invalid pours never happen — the glass simply explains itself in the caption line. Undo, reset and hints are
            always free. Nothing is ever lost or punished.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Settings ================= */

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = mtt();
  const set = s.updateSettings;
  const vol = (key: 'master' | 'music' | 'weatherVol' | 'ambience' | 'sfx', label: string) => (
    <div key={key}>
      <div className="mb-1 flex items-center justify-between text-sm text-[#e8d9bd]">
        <span>{label}</span>
        <span className="text-xs text-[#cbb389]">{Math.round(s.settings[key] * 100)}%</span>
      </div>
      <Slider
        value={[s.settings[key]]}
        min={0}
        max={1}
        step={0.05}
        onValueChange={(v) => set({ [key]: v[0] } as never)}
        aria-label={label}
      />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <div className="mtt-panel mtt-scroll max-h-[82vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-story text-xl text-[#f2dfb8]">Settings</DialogTitle>
            <DialogDescription className="text-[#cbb389]">Everything is optional; everything is remembered.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-3 rounded-xl bg-[#4a302030] p-4">
              {vol('master', 'Master volume')}
              {vol('music', 'Music')}
              {vol('weatherVol', 'Weather & nature')}
              {vol('ambience', 'Room ambience')}
              {vol('sfx', 'Effects')}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="mute" className="text-sm text-[#e8d9bd]">Mute everything</Label>
              <Switch id="mute" checked={s.settings.muted} onCheckedChange={(v) => set({ muted: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rm" className="text-sm text-[#e8d9bd]">Reduced motion & effects</Label>
              <Switch id="rm" checked={s.settings.reducedMotion} onCheckedChange={(v) => set({ reducedMotion: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="cap" className="text-sm text-[#e8d9bd]">Show sound captions</Label>
              <Switch id="cap" checked={s.settings.captions} onCheckedChange={(v) => set({ captions: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="sym" className="text-sm text-[#e8d9bd]">Always show layer glyphs</Label>
              <Switch id="sym" checked={s.settings.alwaysSymbols} onCheckedChange={(v) => set({ alwaysSymbols: v })} />
            </div>
            <div>
              <div className="mb-2 text-sm text-[#e8d9bd]">Your familiar (cosmetic only)</div>
              <div className="flex flex-wrap gap-2">
                {FAMILIARS.map((f) => (
                  <Chip key={f.id} selected={s.settings.familiar === f.id} onClick={() => set({ familiar: f.id })}>
                    {f.image ? (
                       
                      <img src={f.image} alt={f.label} className="mr-2 inline-block h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="mr-2 inline-block h-8 w-8 rounded-full border border-dashed border-[#e8a34d77] text-center leading-8 text-xs">—</span>
                    )}
                    {f.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[#a98d68]">
                Familiars keep you company and react softly — they never do chores, solve puzzles or replace anyone.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Atmosphere ================= */

export function AtmosphereDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = mtt();
  const a = s.atmosphere;
  const up = s.updateAtmosphere;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <div className="mtt-panel mtt-scroll max-h-[82vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-story text-xl text-[#f2dfb8]">Atmosphere</DialogTitle>
            <DialogDescription className="text-[#cbb389]">
              Weather, light and music are independent — changing one never changes the others.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-5">
            <div>
              <div className="mb-2 text-sm font-medium text-[#e8d9bd]">Light & sky</div>
              <div className="flex flex-wrap gap-2">
                {LIGHT_MOOD_ORDER.map((id) => (
                  <Chip key={id} selected={a.light === id} onClick={() => up({ light: id })}>
                    <span className="mr-2 inline-block h-4 w-4 rounded-full align-[-2px]" style={{ background: MOODS[id].swatchHex }} />
                    {MOODS[id].name}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-[#e8d9bd]">Weather outside</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(WEATHER_LABELS) as (keyof typeof WEATHER_LABELS)[]).map((w) => (
                  <Chip key={w} selected={a.weather === w} onClick={() => up({ weather: w })}>
                    {WEATHER_LABELS[w]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-[#e8d9bd]">Music</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PLAYLIST_LABELS) as (keyof typeof PLAYLIST_LABELS)[]).map((p) => (
                  <Chip key={p} selected={a.playlist === p} onClick={() => up({ playlist: p })}>
                    {PLAYLIST_LABELS[p]}
                  </Chip>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#a98d68]">
                Music is the mastered 40-track library (four moods × ten tracks, ElevenLabs Music v2.5), played straight from the manifest with 5 s crossfades. Weather and room sounds remain gentle procedural sketches until their recording pass.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Save blend ================= */

export function SaveBlendDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = mtt();
  const blend = s.pendingBlend;
  const [name, setName] = useState('');
  if (!blend) return null;
  const effectiveName = name.trim() || (blend.recognized && blend.authoredName) || '';
  const recognized = blend.recognized;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <div className="mtt-panel rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-story text-xl text-[#f2dfb8]">
              {recognized ? 'The journal knows this one' : 'A new blend of your own'}
            </DialogTitle>
            <DialogDescription className="text-[#cbb389]">
              {recognized
                ? `This is “${blend.authoredName}” — ${blend.authoredEffect} comes with it.`
                : 'Nothing here is a mistake. Name it, and choose how it shimmers.'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-center gap-4">
            <LayerStack colors={blend.colors} height={64} width={26} radius={6} />
            <div className="text-xs leading-relaxed text-[#cbb389]">
              {blend.ingredientNames.join(' · ')}
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="blend-name" className="text-sm text-[#e8d9bd]">Name your blend</Label>
            <Input
              id="blend-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={blend.authoredName ?? 'Unnamed Blend'}
              className="mt-1 border-[#e8a34d44] bg-[#2a1a1066] text-[#f2dfb8] placeholder:text-[#a98d68]"
            />
          </div>
          {!recognized && (
            <div className="mt-4">
              <div className="mb-2 text-sm text-[#e8d9bd]">Choose its shimmer</div>
              <div className="flex flex-wrap gap-2">
                {CHOOSABLE_EFFECTS.map((e) => (
                  <Chip
                    key={e}
                    selected={s.ui.saveBlendEffectId === e}
                    onClick={() => s.patchUi({ saveBlendEffectId: e, saveBlendEffect: EFFECT_LABELS[e] })}
                  >
                    {EFFECT_LABELS[e]}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          <div className="mt-6 flex gap-2">
            <button
              className="mtt-chip flex-1 rounded-xl px-4 py-3 text-[#f2dfb8]"
              data-selected="true"
              onClick={() => {
                const effectId = recognized ? (blend.authoredEffectId ?? 'shimmer') : s.ui.saveBlendEffectId;
                const effectLabel = recognized ? (blend.authoredEffect ?? 'A quiet magic') : s.ui.saveBlendEffect;
                s.actions.commitBlend(effectiveName || 'Unnamed Blend', effectLabel, effectId, recognized);
                setName('');
                onClose();
              }}
            >
              Add to journal
            </button>
            <Chip onClick={() => { onClose(); }}>Not yet</Chip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Personal cup ================= */

function CupSvg({ silhouette, bodyHex, pattern, handle }: { silhouette: CupSilhouette; bodyHex: string; pattern: CupPattern; handle: CupHandleLocal }) {
  const paths: Record<CupSilhouette, string> = {
    round: 'M30 24 Q30 20 36 20 L64 20 Q70 20 70 24 L68 66 Q67 76 57 78 L43 78 Q33 76 32 66 Z',
    tall: 'M34 16 L66 16 L64 74 Q63 80 57 80 L43 80 Q37 80 36 74 Z',
    tulip: 'M36 20 Q30 46 38 62 Q42 72 50 72 Q58 72 62 62 Q70 46 64 20 Z',
  };
  return (
    <svg width="120" height="110" viewBox="0 0 100 96" aria-hidden>
      {handle === 'loop' && <path d="M70 34 Q88 42 68 58" fill="none" stroke={bodyHex} strokeWidth="6" strokeLinecap="round" />}
      <path d={paths[silhouette]} fill={bodyHex} />
      <ellipse cx="50" cy="20" rx="17" ry="4" fill="rgba(255,248,236,0.5)" />
      {pattern === 'stripes' && [40, 50, 60].map((x) => <line key={x} x1={x} y1="24" x2={x} y2="74" stroke="rgba(255,248,236,0.75)" strokeWidth="4" />)}
      {pattern === 'dots' && [[42, 34], [56, 42], [46, 54], [58, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill="rgba(255,248,236,0.85)" />)}
      {pattern === 'scallop' && [36, 50, 64].map((y) => (
        <path key={y} d={`M34 ${y} Q42 ${y + 5} 50 ${y} T66 ${y}`} fill="none" stroke="rgba(255,248,236,0.85)" strokeWidth="3" />
      ))}
    </svg>
  );
}
type CupHandleLocal = 'loop' | 'none';

export function CupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = mtt();
  const [draft, setDraft] = useState(s.cup);
  const set = (p: Partial<typeof draft>) => setDraft({ ...draft, ...p });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <div className="mtt-panel mtt-scroll max-h-[82vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-story text-xl text-[#f2dfb8]">Your personal cup</DialogTitle>
            <DialogDescription className="text-[#cbb389]">It lives on your floating tray in the nook.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex gap-6">
            <div className="rounded-2xl bg-[#4a302030] p-4">
              <CupSvg silhouette={draft.silhouette} bodyHex={draft.bodyHex} pattern={draft.pattern} handle={draft.handle} />
            </div>
            <div className="flex-1 space-y-3 text-sm text-[#e8d9bd]">
              <div>
                <div className="mb-1 text-xs text-[#cbb389]">Silhouette</div>
                <div className="flex flex-wrap gap-2">
                  {(['round', 'tall', 'tulip'] as CupSilhouette[]).map((v) => (
                    <Chip key={v} selected={draft.silhouette === v} onClick={() => set({ silhouette: v })}>{v}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-[#cbb389]">Body color</div>
                <div className="flex flex-wrap gap-2">
                  {CUP_BODY_COLORS.map((c) => (
                    <button
                      key={c}
                      aria-label={`body color ${c}`}
                      onClick={() => set({ bodyHex: c })}
                      className={`h-7 w-7 rounded-full border-2 ${draft.bodyHex === c ? 'border-[#f2dfb8]' : 'border-transparent'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-[#cbb389]">Pattern</div>
                <div className="flex flex-wrap gap-2">
                  {(['none', 'stripes', 'dots', 'scallop'] as CupPattern[]).map((v) => (
                    <Chip key={v} selected={draft.pattern === v} onClick={() => set({ pattern: v })}>{v}</Chip>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-[#cbb389]">Handle</div>
                <div className="flex flex-wrap gap-2">
                  {(['loop', 'none'] as CupHandleLocal[]).map((v) => (
                    <Chip key={v} selected={draft.handle === v} onClick={() => set({ handle: v })}>{v}</Chip>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              className="mtt-chip flex-1 rounded-xl px-4 py-3 text-[#f2dfb8]"
              data-selected="true"
              onClick={() => { s.actions.applyCup(draft); onClose(); }}
            >
              Place it on my tray
            </button>
            <Chip onClick={onClose}>Close</Chip>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= Journal ================= */

export function JournalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = mtt();
  const [variantOf, setVariantOf] = useState<string | null>(null);
  const [variantName, setVariantName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  let cards = [...s.journal];
  const q = s.ui.journalSearch.trim().toLowerCase();
  if (q) cards = cards.filter((c) => c.name.toLowerCase().includes(q) || c.ingredientNames.join(' ').toLowerCase().includes(q));
  if (s.ui.journalSort === 'az') cards.sort((a, b) => a.name.localeCompare(b.name));
  else if (s.ui.journalSort === 'favorites') cards.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.createdAt - a.createdAt);
  else cards.sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <div className="mtt-panel rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-story text-xl text-[#f2dfb8]">The Tea Journal</DialogTitle>
            <DialogDescription className="text-[#cbb389]">
              Every blend you save lives here. Variations never overwrite the original.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={s.ui.journalSearch}
              onChange={(e) => s.patchUi({ journalSearch: e.target.value })}
              placeholder="Search blends…"
              className="w-44 border-[#e8a34d44] bg-[#2a1a1066] text-sm text-[#f2dfb8] placeholder:text-[#a98d68]"
              aria-label="Search blends"
            />
            {(['newest', 'az', 'favorites'] as const).map((sort) => (
              <Chip key={sort} selected={s.ui.journalSort === sort} onClick={() => s.patchUi({ journalSort: sort })}>
                {sort === 'newest' ? 'Newest' : sort === 'az' ? 'A–Z' : 'Favorites'}
              </Chip>
            ))}
          </div>
          <div className="mtt-scroll mt-4 max-h-[46vh] space-y-3 overflow-y-auto pr-1">
            {cards.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#e8a34d44] p-6 text-center text-sm text-[#a98d68]">
                No blends yet. Mix something in the Quiet Nook and save it — any mixture can be named and kept.
              </div>
            )}
            {cards.map((c) => (
              <div key={c.id} className="rounded-xl bg-[#4a302040] p-3">
                <div className="flex items-center gap-3">
                  <LayerStack colors={c.colors} height={52} width={22} radius={5} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-story text-[15px] text-[#f2dfb8]">
                      {c.name}
                      {c.parentName && <span className="ml-2 text-[11px] text-[#b48ec7]">variation of “{c.parentName}”</span>}
                    </div>
                    <div className="truncate text-[11px] text-[#cbb389]">{c.ingredientNames.join(' · ')}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded-full bg-[#b48ec733] px-2 py-0.5 text-[10px] text-[#d9c3e8]">{c.effect}</span>
                      {c.recognized && <span className="rounded-full bg-[#e8a34d33] px-2 py-0.5 text-[10px] text-[#f2dfb8]">journal recipe</span>}
                    </div>
                  </div>
                  <button
                    aria-label={c.favorite ? 'Unfavorite' : 'Favorite'}
                    onClick={() => s.actions.toggleFavorite(c.id)}
                    className="text-xl leading-none"
                    style={{ color: c.favorite ? '#e8c46a' : '#7a5230' }}
                  >
                    ★
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  {variantOf === c.id ? (
                    <>
                      <Input
                        value={variantName}
                        onChange={(e) => setVariantName(e.target.value)}
                        placeholder={`${c.name} (variation)`}
                        className="h-7 w-48 border-[#e8a34d44] bg-[#2a1a1066] text-xs text-[#f2dfb8]"
                        aria-label="Variation name"
                      />
                      <Chip onClick={() => { s.actions.saveVariant(c.id, variantName || `${c.name} (variation)`); setVariantOf(null); setVariantName(''); }}>Save variation</Chip>
                      <Chip onClick={() => setVariantOf(null)}>Cancel</Chip>
                    </>
                  ) : (
                    <Chip onClick={() => { setVariantOf(c.id); setVariantName(''); }}>Save as variation</Chip>
                  )}
                  {confirmDelete === c.id ? (
                    <>
                      <Chip onClick={() => { s.actions.deleteCard(c.id); setConfirmDelete(null); }}>Really remove</Chip>
                      <Chip onClick={() => setConfirmDelete(null)}>Keep it</Chip>
                    </>
                  ) : (
                    <Chip onClick={() => setConfirmDelete(c.id)}>Remove</Chip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================= About / prototype notes ================= */

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <div className="mtt-panel mtt-scroll max-h-[82vh] overflow-y-auto rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="font-story text-xl text-[#f2dfb8]">About this prototype</DialogTitle>
            <DialogDescription className="text-[#cbb389]">First playable slice — Director working edition, November 2026.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-[#e8d9bd]">
            <p>
              This build proves the two essential loops in one tent: <span className="text-[#f2dfb8]">Tea Service</span> —
              three teaching puzzles (basic sort, ordered layers, special rule) with an ornate recipe-specific reward cup —
              and <span className="text-[#f2dfb8]">Quiet Mode</span> — free mixing, naming, saving, cup customization and
              independent atmosphere controls, with resume/start-fresh persistence. It corresponds to milestones M1–M4 (desktop).
            </p>
            <div className="rounded-xl bg-[#4a302030] p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#cbb389]">Placeholder ledger</div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-[#cbb389]">
                <li>All 3D geometry is placeholder primitives awaiting the approved art pipeline (brief §14 gates respected — no mesh conversion was run).</li>
                <li>The Plush Traveler (animal visitor) has no asset in this workspace; a placeholder card stands in.</li>
                <li>Music is real (the mastered 40-track library, −18 LUFS masters); weather beds, ambience and the 30-family SFX catalog are still procedural sketches pending their recording pass.</li>
                <li>Quest 3 / WebXR seated input is milestone M6 — this build is desktop-first on purpose.</li>
                <li>Quiet Mode and Tea Service catalogs are intentionally NOT connected (open design decision preserved).</li>
              </ul>
            </div>
            <div className="rounded-xl bg-[#4a302030] p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#cbb389]">Reference art (concept only)</div>
              <div className="flex gap-3">
                { }
                <img src="/assets/MTT_reference_masterboard_v01.jpg" alt="Master reference board (concept)" className="h-24 w-40 rounded-lg object-cover" />
                { }
                <img src="/assets/MTT_furniture_counter_concept_v01.jpg" alt="Counter concept" className="h-24 w-40 rounded-lg object-cover" />
              </div>
              <p className="mt-2 text-[11px] text-[#a98d68]">
                Asset provenance lives in <span className="text-[#e8a34d]">/assets/manifest.json</span> (MTT_[family]_[asset]_[view]_v##).
                Concept images are references, never completion claims.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
