import React, { useEffect, useRef } from 'react';
import { TranscriptSegment } from '../types';

interface TranscriptDisplayProps {
  segments: TranscriptSegment[];
  currentPartial: string;
  isFullScreen: boolean;
  fontSize: number;
}

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ 
  segments, 
  currentPartial, 
  isFullScreen,
  fontSize
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [segments, currentPartial]);

  const textSizeClass = `text-[${fontSize}px] leading-relaxed`;

  return (
    <div 
      ref={containerRef}
      className={`
        relative w-full h-full overflow-y-auto px-4 py-8 md:px-16 transition-all duration-300
        ${isFullScreen ? 'flex flex-col justify-end pb-20' : 'bg-slate-900/50 rounded-2xl border border-slate-800 shadow-inner'}
      `}
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {/* History Segments */}
        {segments.map((seg) => (
          <p 
            key={seg.id} 
            className={`transition-opacity duration-500 text-slate-300 ${isFullScreen ? 'opacity-80' : 'opacity-70'}`}
            style={{ fontSize: `${Math.max(16, fontSize * 0.7)}px` }}
          >
            {seg.text}
          </p>
        ))}

        {/* Current Live Segment - Highlighted */}
        {(currentPartial || segments.length === 0) && (
          <div className="mt-4">
            <p 
              className={`font-semibold text-white tracking-wide animate-pulse-slow transition-all`}
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.4' }}
            >
              {currentPartial}
              <span className="inline-block w-2 h-[1em] ml-1 bg-indigo-500 align-middle animate-blink rounded-sm"/>
            </p>
            {segments.length === 0 && !currentPartial && (
              <p className="text-slate-500 italic text-lg mt-2">
                Aguardando fala...
              </p>
            )}
          </div>
        )}
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
};