import React from 'react';

interface LiveBadgeProps {
  visible: boolean;
}

export const LiveBadge: React.FC<LiveBadgeProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
      </span>
      <span className="text-red-400 font-bold text-[10px] tracking-widest uppercase">Ao Vivo</span>
    </div>
  );
};