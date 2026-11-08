'use client';

import { useState } from 'react';
import { mtt } from '@/game/store';
import {
  TEA_COLORS, QUIET_INGREDIENTS, VISITORS, type Location,
} from '@/game/data';
import { Glyph, LayerStack, Chip, HowToDialog, SettingsDialog, AtmosphereDialog, JournalDialog, SaveBlendDialog, CupDialog, AboutDialog } from './panels';

function IconBtn({ label, onClick, open }: { label: string; onClick: () => void; open?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={open}
      className={`mtt-chip rounded-full px-3 py-1.5 text-xs text-[#f2dfb8] ${open ? 'ring-1 ring-[#e8a34d]' : ''}`}
    >
      {label}
    </button>
  );
}

function VisitorChoice({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {VISITORS.map((v) => (
        <button
          key={v.id}
          onClick={() => onPick(v.id)}
          className="mtt-chip group rounded-xl p-3 text-left"
          title={v.placeholderNote ?? 'Concept turnaround — reuse candidate, not final casting'}
        >
          <div className="flex items-center gap-2">
            {v.portrait ? (
               
              <img src={v.portrait} alt={v.label} className="h-12 w-12 rounded-lg object-cover" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-[#e8a34d77] text-[10px] text-[#a98d68]">soon</span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-[#f2dfb8]">{v.label}</div>
              <div className="text-[11px] capitalize text-[#cbb389]">{v.category} visitor</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Overlay() {
  const s = mtt();
  const [choiceOpen, setChoiceOpen] = useState(false);
  const a = s.actions;
  const showModal = (m: 'howto' | 'settings' | 'atmosphere' | 'journal' | 'about' | 'save-blend' | 'cup') => s.patchUi({ modal: m });
  const close = () => s.patchUi({ modal: null });

  if (!s.booted) return null;

  const puzzle = s.puzzle;
  const inService = s.screen === 'service';
  const inQuiet = s.screen === 'quiet';

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* ---------- top-left: mode switch + places ---------- */}
      <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[46vw] flex-col gap-2">
        <div className="mtt-panel flex items-center gap-1 rounded-full p-1.5">
          <button
            onClick={() => a.setScreen('service')}
            aria-pressed={inService}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${inService ? 'bg-[#e8a34d] text-[#2a1a10]' : 'text-[#e8d9bd] hover:bg-[#4a302060]'}`}
          >
            Tea Service
          </button>
          <button
            onClick={() => a.setScreen('quiet')}
            aria-pressed={inQuiet}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${inQuiet ? 'bg-[#e8a34d] text-[#2a1a10]' : 'text-[#e8d9bd] hover:bg-[#4a302060]'}`}
          >
            Quiet Nook
          </button>
          <span className="mx-1 h-4 w-px bg-[#e8a34d44]" />
          {(['center', 'counter', 'nook'] as Location[]).map((loc) => (
            <button
              key={loc}
              onClick={() => a.teleport(loc)}
              title={`Go to ${loc === 'center' ? 'the middle of the tent' : loc === 'counter' ? 'the service counter' : 'the quiet nook'}`}
              aria-label={`Go to ${loc}`}
              className={`h-7 w-7 rounded-full text-[11px] ${s.location === loc ? 'bg-[#e8a34d55] text-[#f2dfb8]' : 'text-[#cbb389] hover:bg-[#4a302060]'}`}
            >
              {loc === 'center' ? '•' : loc === 'counter' ? '☕' : '☾'}
            </button>
          ))}
        </div>
        <div className="ml-2 text-[11px] text-[#cbb38999]">glowing floor discs also carry you — click one</div>
      </div>

      {/* ---------- top-right: controls ---------- */}
      <div className="pointer-events-auto absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
        <IconBtn label="Journal" onClick={() => showModal('journal')} open={s.ui.modal === 'journal'} />
        <IconBtn label="How to pour" onClick={() => showModal('howto')} open={s.ui.modal === 'howto'} />
        <IconBtn label="Atmosphere" onClick={() => showModal('atmosphere')} open={s.ui.modal === 'atmosphere'} />
        <IconBtn label="Settings" onClick={() => showModal('settings')} open={s.ui.modal === 'settings'} />
        <IconBtn label="About" onClick={() => showModal('about')} open={s.ui.modal === 'about'} />
      </div>

      {/* ---------- toast ---------- */}
      {s.toast && (
        <div className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2">
          <div className="toast-pill mtt-panel rounded-full px-4 py-2 text-sm text-[#f2dfb8]">{s.toast}</div>
        </div>
      )}

      {/* ---------- captions ---------- */}
      {s.settings.captions && s.captions.length > 0 && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex w-[min(92vw,560px)] -translate-x-1/2 flex-col items-center gap-1">
          {s.captions.map((c) => (
            <div key={c.id} className={`caption-pill mtt-panel max-w-full truncate rounded-full px-3 py-1 text-xs ${c.kind === 'cue' ? 'text-[#ffd98a]' : c.kind === 'line' ? 'text-[#d9c3e8] italic' : 'text-[#cbb389]'}`}>
              {c.text}
            </div>
          ))}
        </div>
      )}

      {/* ---------- arrival (first visit) ---------- */}
      {s.screen === 'arrival' && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center p-4">
          <div className="mtt-panel w-full max-w-xl rounded-3xl p-6">
            <div className="font-story text-2xl text-[#f2dfb8]">Welcome in. What calls you first?</div>
            <p className="mt-2 text-sm leading-relaxed text-[#cbb389]">
              A visitor may be waiting at the counter — or the cushion nook is warm and empty and yours.
              Both are equally good answers. You can wander between them whenever you like.
            </p>
            {choiceOpen ? (
              <>
                <div className="mt-4 text-sm font-medium text-[#e8d9bd]">Who would you like to welcome first?</div>
                <VisitorChoice onPick={(id) => { setChoiceOpen(false); a.welcomeVisitor(id); }} />
                <p className="mt-2 text-[11px] text-[#a98d68]">
                  There is no canonical first visitor — the one you pick simply arrives first.
                  Labels are working placeholders; casting awaits Director approval.
                </p>
              </>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="mtt-chip rounded-xl px-4 py-3 text-[#f2dfb8]" data-selected="true" onClick={() => setChoiceOpen(true)}>
                  Welcome a visitor
                </button>
                <button className="mtt-chip rounded-xl px-4 py-3 text-[#f2dfb8]" onClick={() => a.setScreen('quiet')}>
                  Slip into Quiet Mode
                </button>
                <button className="mtt-chip rounded-xl px-4 py-3 text-[#cbb389]" onClick={() => showModal('howto')}>
                  How it works (optional)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- bottom HUD ---------- */}
      {s.screen !== 'arrival' && (
        <div className="pointer-events-auto absolute bottom-4 left-1/2 w-[min(94vw,760px)] -translate-x-1/2">
          {/* --- tea service --- */}
          {inService && puzzle && !s.servedThisVisit && s.glasses && (
            <div className="mtt-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-story text-sm text-[#f2dfb8]">
                  {puzzle.name}
                  <span className="ml-2 text-[11px] font-normal text-[#cbb389]">{puzzle.teachLine}</span>
                </div>
                <div className="flex gap-1.5">
                  <Chip onClick={a.undoPuzzle} title="Undo the last pour">Undo</Chip>
                  <Chip onClick={a.resetPuzzle} title="Start this puzzle over">Reset</Chip>
                  <Chip onClick={a.requestHint} title="A gentle hint">Hint</Chip>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {s.glasses.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => a.selectGlass(i)}
                    data-selected={s.selectedGlass === i}
                    className="mtt-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-[#e8d9bd]"
                    title="Tap once to choose the source, then tap the glass that receives it"
                  >
                    <span className="text-[10px] text-[#cbb389]">#{i + 1}</span>
                    <LayerStack colors={g.layers.map((l) => TEA_COLORS[l.color].hex)} height={34} />
                    <span className="max-w-28 truncate">
                      {g.layers.length === 0 ? 'empty' : g.layers.map((l) => (
                        <span key={`${i}-${l.color}-${Math.random()}`} className="mr-1 inline-flex items-center gap-0.5">
                          <Glyph glyph={TEA_COLORS[l.color].glyph} color={TEA_COLORS[l.color].hex} size={11} />
                          {l.locked && <span className="text-[9px] text-[#ffd98a]">resting</span>}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-[#cbb389]">
                {s.selectedGlass == null
                  ? 'Tap a glass with tea to choose it (the 3D glasses work too).'
                  : `Glass ${s.selectedGlass + 1} is chosen — tap another glass to pour one layer.`}
              </div>
            </div>
          )}

          {inService && puzzle && s.servedThisVisit && (
            <div className="mtt-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-story text-sm text-[#f2dfb8]">
                  Served, beautifully.
                  <span className="ml-2 text-[11px] font-normal text-[#cbb389]">The reward cup is on the counter; its twin rests on the shelf behind.</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip onClick={() => setChoiceOpen(true)}>Welcome another visitor</Chip>
                  <Chip onClick={() => a.setScreen('quiet')}>Visit Quiet Mode</Chip>
                  <Chip onClick={() => a.teleport('center')}>Sit a moment</Chip>
                </div>
              </div>
              {choiceOpen && (
                <VisitorChoice onPick={(id) => { setChoiceOpen(false); a.welcomeVisitor(id); }} />
              )}
            </div>
          )}

          {inService && !puzzle && (
            <div className="mtt-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-[#e8d9bd]">The counter is quiet for now.</div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip onClick={() => setChoiceOpen(true)}>Welcome a visitor</Chip>
                  <Chip onClick={() => a.setScreen('quiet')}>Quiet Nook instead</Chip>
                </div>
              </div>
              {choiceOpen && <VisitorChoice onPick={(id) => { setChoiceOpen(false); a.welcomeVisitor(id); }} />}
            </div>
          )}

          {/* --- quiet nook --- */}
          {inQuiet && s.quietGlasses && (
            <div className="mtt-panel rounded-2xl p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-story text-sm text-[#f2dfb8]">
                  Quiet Nook
                  <span className="ml-2 text-[11px] font-normal text-[#cbb389]">No orders, no timer. Mix anything; save what you like.</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip onClick={() => a.openSaveBlend()} title="Save the focused glass as a blend">Save blend</Chip>
                  <Chip onClick={() => showModal('cup')} title="Customize your personal cup">My cup</Chip>
                  <Chip onClick={() => showModal('journal')} title="Open the tea journal">Journal</Chip>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {s.quietGlasses.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => a.focusGlass(i)}
                    data-selected={s.quietFocused === i}
                    className="mtt-chip flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-[#e8d9bd]"
                    title={s.quietFocused === i ? 'Focused — ingredients pour here' : 'Click to focus; clicking the 3D glass pours into it'}
                  >
                    <span className="text-[10px] text-[#cbb389]">#{i + 1}</span>
                    <LayerStack colors={g.layers.map((l) => TEA_COLORS[l.color].hex)} height={34} />
                  </button>
                ))}
                <Chip onClick={() => a.pourTo(1 - s.quietFocused)} title="Pour the focused glass into the other">Pour → other</Chip>
                <Chip onClick={() => a.emptyGlass(s.quietFocused)} title="Gently empty the focused glass">Empty</Chip>
                <span className="mx-1 h-5 w-px bg-[#e8a34d44]" />
                {QUIET_INGREDIENTS.map((cid) => {
                  const c = TEA_COLORS[cid];
                  return (
                    <button
                      key={cid}
                      onClick={() => a.addIngredient(cid)}
                      title={`Add ${c.name} to glass ${s.quietFocused + 1}`}
                      className="mtt-chip flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] text-[#e8d9bd]"
                    >
                      <Glyph glyph={c.glyph} color={c.hex} size={13} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- resume dialog ---------- */}
      {s.resumeOffer && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="mtt-panel w-full max-w-md rounded-3xl p-6 text-center">
            <div className="font-story text-2xl text-[#f2dfb8]">Welcome back</div>
            <p className="mt-2 text-sm text-[#cbb389]">You left some tea mid-pour. It kept warm.</p>
            <div className="mt-4 flex flex-col gap-2">
              {s.resumeOffer.service && (
                <button className="mtt-chip rounded-xl px-4 py-3 text-[#f2dfb8]" data-selected="true" onClick={a.resumeService}>
                  Resume the puzzle at the counter
                </button>
              )}
              {s.resumeOffer.quiet && (
                <button className="mtt-chip rounded-xl px-4 py-3 text-[#f2dfb8]" data-selected={s.resumeOffer.quiet && !s.resumeOffer.service} onClick={a.resumeQuiet}>
                  Resume your blend in the nook
                </button>
              )}
              <button className="mtt-chip rounded-xl px-4 py-3 text-[#cbb389]" onClick={a.startFresh}>
                Start fresh (journal and settings stay)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- dialogs ---------- */}
      <HowToDialog open={s.ui.modal === 'howto'} onClose={close} />
      <SettingsDialog open={s.ui.modal === 'settings'} onClose={close} />
      <AtmosphereDialog open={s.ui.modal === 'atmosphere'} onClose={close} />
      <JournalDialog open={s.ui.modal === 'journal'} onClose={close} />
      {s.pendingBlend && <SaveBlendDialog open={s.ui.modal === 'save-blend'} onClose={close} />}
      <CupDialog open={s.ui.modal === 'cup'} onClose={close} />
      <AboutDialog open={s.ui.modal === 'about'} onClose={close} />
    </div>
  );
}
