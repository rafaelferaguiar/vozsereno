import React, { useEffect, useState } from 'react';

interface VisualizerProps {
  active: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ active }) => {
  const [heights, setHeights] = useState<number[]>([10, 15, 8, 20, 12]);

  useEffect(() => {
    if (!active) {
      setHeights([5, 5, 5, 5, 5]);
      return;
    }

    const interval = setInterval(() => {
      setHeights(prev => prev.map(() => Math.random() * 24 + 4));
    }, 100);

    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="flex items-end justify-center gap-1 h-8">
      {heights.map((h, i) => (
        <div 
          key={i} 
          className="w-1.5 bg-indigo-500 rounded-full transition-all duration-100 ease-in-out"
          style={{ height: `${h}px`, opacity: active ? 1 : 0.3 }}
        />
      ))}
    </div>
  );
};