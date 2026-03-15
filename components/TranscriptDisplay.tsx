import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TranscriptSegment } from '../types';

interface TranscriptDisplayProps {
  segments: TranscriptSegment[];
  currentPartial: string;
  isFullScreen: boolean;
  fontSize: number;
}

/**
 * Typewriter hook: animates from the currently displayed text towards the target text.
 * - If target grows (new chars): reveals them at ~30ms/char (snappy, feels live)
 * - If target shrinks or changes completely (new sentence): resets immediately
 */
function useTypewriter(target: string, charsPerMs = 18) {
  const [displayed, setDisplayed] = useState('');
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const displayedRef = useRef('');

  // Cancel any running animation
  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    cancel();

    if (!target) {
      displayedRef.current = '';
      setDisplayed('');
      return;
    }

    // If the target starts with what we already have → just reveal remaining chars
    const shared = displayedRef.current.length <= target.length && target.startsWith(displayedRef.current);

    if (!shared) {
      // New unrelated text → jump immediately to reduce confusion
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }

    // Animate the reveal of additional characters
    let startIndex = displayedRef.current.length;

    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;
      const charsToReveal = Math.floor(elapsed / charsPerMs);

      if (charsToReveal > 0) {
        lastTimeRef.current = timestamp;
        startIndex = Math.min(startIndex + charsToReveal, target.length);
        const next = target.slice(0, startIndex);
        displayedRef.current = next;
        setDisplayed(next);
      }

      if (startIndex < target.length) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);

    return cancel;
  }, [target, cancel, charsPerMs]);

  return displayed;
}

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  segments,
  currentPartial,
  isFullScreen,
  fontSize
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Admin gets updates fast (direct Gemini callbacks) → faster typewriter
  // Viewer gets updates via Supabase → typewriter hides the network gap
  const animatedPartial = useTypewriter(currentPartial, 18);

  // Auto-scroll to bottom whenever content changes
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [segments, animatedPartial]);

  return (
    <div
      ref={containerRef}
      className={`
        relative w-full h-full overflow-y-auto px-4 py-8 md:px-16 transition-all duration-300
        ${isFullScreen ? 'flex flex-col justify-end pb-20' : 'bg-slate-900/50 rounded-2xl border border-slate-800 shadow-inner'}
      `}
      style={{ scrollBehavior: 'auto', touchAction: 'pan-y' }}
    >
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {/* History Segments – last 3 only to avoid scroll */}
        {segments.slice(-3).map((seg) => (
          <p
            key={seg.id}
            className={`transition-opacity duration-500 text-slate-300 ${isFullScreen ? 'opacity-80' : 'opacity-70'}`}
            style={{ fontSize: `${Math.max(16, fontSize * 0.7)}px` }}
          >
            {seg.text}
          </p>
        ))}

        {/* Current Live Segment – animated typewriter */}
        {(currentPartial || segments.length === 0) && (
          <div className="mt-4">
            <p
              className="font-semibold text-white tracking-wide transition-all"
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.4' }}
            >
              {animatedPartial}
              <span className="inline-block w-2 h-[1em] ml-1 bg-indigo-500 align-middle animate-blink rounded-sm" />
            </p>
            {segments.length === 0 && !currentPartial && (
              <p className="text-slate-500 italic text-lg mt-2">
                Aguardando fala...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};