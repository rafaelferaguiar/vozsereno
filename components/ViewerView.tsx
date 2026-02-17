import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptSegment, BroadcastMessage } from '../types';
import { Button } from './Button';
import { TranscriptDisplay } from './TranscriptDisplay';
import { LiveBadge } from './LiveBadge';

// Icons
const FullScreenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>;
const ExitFullScreenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>;
const FontIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>;

interface ViewerViewProps {
  onOpenAdmin: () => void;
}

export const ViewerView: React.FC<ViewerViewProps> = ({ onOpenAdmin }) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentPartial, setCurrentPartial] = useState<string>('');
  const [isLive, setIsLive] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fontSize, setFontSize] = useState(48); // Fonte maior por padrão para leitura
  
  const broadcastChannel = useRef<BroadcastChannel | null>(null);

  // Sincroniza o estado do React com o estado real do navegador
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  useEffect(() => {
    broadcastChannel.current = new BroadcastChannel('voz_sereno_channel');
    
    broadcastChannel.current.onmessage = (event) => {
      const msg = event.data as BroadcastMessage;
      
      if (msg.type === 'SYNC') {
        if (msg.payload.segments) {
            // Rehydrate Dates (JSON serialization turns dates to strings)
            const hydratedSegments = msg.payload.segments.map(s => ({
                ...s,
                timestamp: new Date(s.timestamp)
            }));
            setSegments(hydratedSegments);
        }
        if (msg.payload.currentPartial !== undefined) {
          setCurrentPartial(msg.payload.currentPartial);
        }
        if (msg.payload.isLive !== undefined) {
          setIsLive(msg.payload.isLive);
        }
      }
    };

    return () => {
      broadcastChannel.current?.close();
    };
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const cycleFontSize = () => {
    setFontSize(prev => prev >= 80 ? 32 : prev + 8);
  };

  return (
    <div className={`min-h-screen flex flex-col ${isFullScreen ? 'bg-black' : 'bg-slate-950'} transition-colors duration-500`}>
      
      {/* Header (Hidden in full screen) */}
      {!isFullScreen && (
        <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-white font-bold text-lg">V</span>
             </div>
             <div>
               <h1 className="text-xl font-bold text-slate-100 tracking-tight">Voz Sereno</h1>
               <p className="text-xs text-slate-400">Ao Vivo</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4">
             <LiveBadge visible={isLive} />
             <div className="flex gap-2">
                <Button onClick={cycleFontSize} variant="secondary" className="!px-3 !py-2" title="Tamanho da Fonte">
                    <FontIcon />
                </Button>
                <Button onClick={toggleFullScreen} variant="secondary" className="!px-3 !py-2" title="Tela Cheia">
                    <FullScreenIcon />
                </Button>
             </div>
          </div>
        </header>
      )}

      {/* Fullscreen Overlay Controls - Always visible now to prevent user getting stuck */}
      {isFullScreen && (
         <div className="fixed top-6 right-6 z-50 flex gap-4 items-center animate-fade-in">
            <LiveBadge visible={isLive} />
            <div className="flex gap-2 bg-slate-900/40 backdrop-blur-sm p-1.5 rounded-lg border border-white/10 shadow-xl transition-opacity hover:bg-slate-900/80">
                 <Button onClick={cycleFontSize} variant="ghost" className="!p-2 text-white/80 hover:text-white" title="Aumentar Fonte">
                    <FontIcon />
                </Button>
                <Button variant="ghost" onClick={toggleFullScreen} className="!p-2 text-white/80 hover:text-white" title="Sair da Tela Cheia">
                    <ExitFullScreenIcon />
                </Button>
            </div>
         </div>
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 flex flex-col w-full mx-auto relative z-0">
           <TranscriptDisplay 
             segments={segments} 
             currentPartial={currentPartial}
             isFullScreen={isFullScreen}
             fontSize={fontSize}
           />
        </div>
      </main>

      {/* Admin Button Footer */}
      {!isFullScreen && (
        <footer className="fixed bottom-4 right-4 z-50">
            <button 
                onClick={onOpenAdmin}
                className="text-slate-700 hover:text-slate-500 text-xs uppercase font-bold tracking-widest px-4 py-2 transition-colors"
            >
                Admin
            </button>
        </footer>
      )}
    </div>
  );
};