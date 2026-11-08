'use client';

import { useEffect, useRef, useState } from 'react';
import { MttGame } from '@/game/engine';
import { mtt } from '@/game/store';
import Overlay from '@/components/game/Overlay';

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<MttGame | null>(null);
  const [ready, setReady] = useState(false);
  const booted = mtt((s) => s.booted);

  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return;
    const game = new MttGame(canvasRef.current);
    gameRef.current = game;
    let cancelled = false;
    game
      .init()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error('MTT engine failed to start', err);
      });
    return () => {
      cancelled = true;
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#2a1a10]">
      <canvas ref={canvasRef} className="block h-full w-full" aria-label="Magical Tea Tent 3D scene" />

      {!ready && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#2a1a10]">
          <div className="font-story text-center">
            <div className="mb-3 text-2xl text-[#f2dfb8]">The Magical Tea Tent</div>
            <div className="animate-pulse text-sm text-[#cbb389]">warming the kettle…</div>
          </div>
        </div>
      )}

      <Overlay />

      {ready && !booted && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="mtt-panel pointer-events-auto mx-4 max-w-lg rounded-3xl p-8 text-center">
            <div className="font-story text-3xl text-[#f2dfb8]">The Magical Tea Tent</div>
            <p className="mt-4 text-sm leading-relaxed text-[#cbb389]">
              A gentle sanctuary with tea to pour and a quiet corner to sit in.
              There is no score, no timer and no wrong way to be here.
            </p>
            <button
              onClick={() => mtt.getState().actions.begin()}
              className="mtt-chip mt-6 w-full rounded-2xl px-6 py-4 font-story text-lg text-[#f2dfb8]"
              data-selected="true"
            >
              Step inside
            </button>
            <p className="mt-3 text-[11px] leading-snug text-[#a98d68]">
              Sound is optional and can be muted at any time — every cue also appears as text.
              Headphones welcome, silence welcome too.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
