import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptSegment, BroadcastMessage } from '../types';
import { Button } from './Button';
import { TranscriptDisplay } from './TranscriptDisplay';
import { LiveBadge } from './LiveBadge';
import { supabase } from '../services/supabaseClient';

// Icons
const FullScreenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>;
const ExitFullScreenIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>;
const FontIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const MinusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

interface ViewerViewProps {
  onOpenAdmin: () => void;
}

export const ViewerView: React.FC<ViewerViewProps> = ({ onOpenAdmin }) => {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentPartial, setCurrentPartial] = useState<string>('');
  const [isLive, setIsLive] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fontSize, setFontSize] = useState(48); // Fonte maior por padrão para leitura
  const [showSettings, setShowSettings] = useState(false);

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
    // 1. Busca estado inicial
    const fetchInitialState = async () => {
      const { data, error } = await supabase
        .from('transcription_state')
        .select('*')
        .eq('id', 1)
        .single();

      if (data && !error) {
        if (data.segments) {
          setSegments(data.segments.map((s: any) => ({
            ...s,
            timestamp: new Date(s.timestamp)
          })));
        }
        setCurrentPartial(data.current_partial || '');
        setIsLive(data.is_live || false);
      }
    };

    fetchInitialState();

    // 2. Inscreve para atualizações em tempo real
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transcription_state',
          filter: 'id=eq.1'
        },
        (payload: any) => {
          const newData = payload.new;
          if (newData.segments) {
            setSegments(newData.segments.map((s: any) => ({
              ...s,
              timestamp: new Date(s.timestamp)
            })));
          }
          setCurrentPartial(newData.current_partial || '');
          setIsLive(newData.is_live || false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  const increaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 4, 120));
  };

  const decreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 4, 16));
  };

  return (
    <div className={`min-h-screen flex flex-col ${isFullScreen ? 'bg-black' : 'bg-slate-950'} transition-colors duration-500`}>

      {/* Header (Hidden in full screen) */}
      {!isFullScreen && (
        <header className="px-5 py-3 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl sticky top-0 z-20 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src="/logo.png" alt="Logo Igreja" className="w-12 h-12 object-contain" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight leading-none">Voz Sereno</h1>
              <LiveBadge visible={isLive} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Font Size Settings Toggle */}
            <div className="relative">
              <Button
                onClick={() => setShowSettings(!showSettings)}
                variant={showSettings ? "primary" : "secondary"}
                className="!p-2.5 rounded-full"
                title="Configurar Legenda"
              >
                <FontIcon />
              </Button>

              {showSettings && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowSettings(false)}
                  />
                  <div className="absolute right-0 mt-3 w-48 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-4 z-40 animate-in fade-in zoom-in duration-200 origin-top-right">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3">Tamanho da Fonte</p>
                    <div className="flex items-center justify-between gap-2 bg-slate-900/50 rounded-xl p-2 border border-slate-700">
                      <Button onClick={decreaseFontSize} variant="ghost" className="!p-2 text-slate-300 hover:text-white hover:bg-slate-700" title="Diminuir">
                        <MinusIcon />
                      </Button>
                      <span className="text-sm font-bold text-slate-100 min-w-[3rem] text-center">{fontSize}px</span>
                      <Button onClick={increaseFontSize} variant="ghost" className="!p-2 text-slate-300 hover:text-white hover:bg-slate-700" title="Aumentar">
                        <PlusIcon />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <Button onClick={toggleFullScreen} variant="secondary" className="!p-2.5 rounded-full" title="Tela Cheia">
              <FullScreenIcon />
            </Button>
          </div>
        </header>
      )}

      {/* Fullscreen Overlay Controls - Always visible now to prevent user getting stuck */}
      {isFullScreen && (
        <div className="fixed top-6 right-6 z-50 flex gap-4 items-center animate-fade-in">
          <LiveBadge visible={isLive} />
          <div className="flex items-center gap-1 bg-slate-900/60 backdrop-blur-md p-1 rounded-lg border border-white/10 shadow-xl transition-opacity hover:bg-slate-900/90">
            <Button onClick={decreaseFontSize} variant="ghost" className="!p-2 text-white/70 hover:text-white" title="Diminuir Fonte">
              <MinusIcon />
            </Button>
            <div className="px-2 min-w-[2.5rem] text-center border-x border-white/5 mx-1">
              <span className="text-[10px] uppercase font-bold text-white/60 tracking-widest">{fontSize}</span>
            </div>
            <Button onClick={increaseFontSize} variant="ghost" className="!p-2 text-white/70 hover:text-white" title="Aumentar Fonte">
              <PlusIcon />
            </Button>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <Button variant="ghost" onClick={toggleFullScreen} className="!p-2 text-white/70 hover:text-white" title="Sair da Tela Cheia">
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