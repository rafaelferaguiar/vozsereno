import React from 'react';

interface LiveBadgeProps {
  visible: boolean;
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-2 bg-red-600/10 border border-red-500/50 px-3 py-1.5 rounded-md shadow-[0_0_15px_rgba(239,68,68,0.4)]">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
      </span>
      <span className="text-red-500 font-bold text-xs tracking-wider uppercase">Ao Vivo</span>
    </div>
  );
};