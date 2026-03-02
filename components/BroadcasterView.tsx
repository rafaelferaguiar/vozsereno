import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GeminiLiveService } from '../services/geminiLiveService';
import { AudioSourceType, TranscriptSegment, LiveStatus, BroadcastMessage } from '../types';
import { Button } from './Button';
import { TranscriptDisplay } from './TranscriptDisplay';
import { Visualizer } from './Visualizer';
import { supabase } from '../services/supabaseClient';

// Icons
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>;
const SystemAudioIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" /></svg>;
const TrashIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
const ExitIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="4" height="16" x="6" y="4" /><rect width="4" height="16" x="14" y="4" /></svg>;
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>;

const PRESET_MESSAGES = [
  "Momento do louvor, as letras estarão passando no telão.",
  "Momento de oração.",
  "Avisos da Igreja.",
  "O Culto retornará em breve."
];

interface BroadcasterViewProps {
  onBack: () => void;
}

export const BroadcasterView: React.FC<BroadcasterViewProps> = ({ onBack }) => {
  const [status, setStatus] = useState<LiveStatus>({ isConnected: false, isRecording: false });
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [currentPartial, setCurrentPartial] = useState<string>('');
  const [audioSource, setAudioSource] = useState<AudioSourceType>(AudioSourceType.MICROPHONE);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState('');

  const liveService = useRef<GeminiLiveService>(new GeminiLiveService());
  const broadcastChannel = useRef<BroadcastChannel | null>(null);
  const intentionalStop = useRef(false);
  const isPausedRef = useRef(false);

  // Setup Broadcast Channel
  useEffect(() => {
    broadcastChannel.current = new BroadcastChannel('voz_sereno_channel');
    return () => {
      broadcastChannel.current?.close();
    };
  }, []);

  // Função para transmitir estado via Supabase
  const broadcastState = useCallback(async (newSegments: TranscriptSegment[], newPartial: string, isLive: boolean) => {
    try {
      // Usamos upsert no ID 1 para manter um estado global único
      await supabase
        .from('transcription_state')
        .upsert({
          id: 1,
          segments: newSegments,
          current_partial: newPartial,
          is_live: isLive,
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('Erro ao sincronizar com Supabase:', err);
    }
  }, []);

  // Configura estado de Pause via Ref
  useEffect(() => {
    isPausedRef.current = isPaused;
    if (isPaused && pauseMessage) {
      setCurrentPartial(''); // Limpa texto temporário
    }
  }, [isPaused, pauseMessage]);

  // Monitora mudanças de estado e transmite
  useEffect(() => {
    const timer = setTimeout(() => {
      // Se estiver pausado com preset, envia o preset como partial e esconde blocos anteriores.
      const broadcastPartial = isPaused ? (pauseMessage ? `⏸ ${pauseMessage}` : '[Legendas Pausadas]') : currentPartial;
      const broadcastSegments = isPaused ? [] : segments;

      broadcastState(broadcastSegments, broadcastPartial, status.isRecording);
    }, 500); // Debounce para não sobrecarregar o banco

    return () => clearTimeout(timer);
  }, [segments, currentPartial, status.isRecording, isPaused, pauseMessage, broadcastState]);

  // Setup Service Callbacks
  useEffect(() => {
    const service = liveService.current;

    service.onConnect = () => {
      setStatus(prev => ({ ...prev, isConnected: true, error: undefined }));
    };

    service.onDisconnect = () => {
      setStatus(prev => ({ ...prev, isConnected: false, isRecording: false }));

      // Reconexão automática se a queda não foi intencional (Timeout do Gemini ou erro de Rede)
      if (!intentionalStop.current) {
        console.warn("✨ Conexão perdida! Tentando reconectar automaticamente em 2s...");
        setTimeout(() => {
          if (!intentionalStop.current) {
            handleStart().catch(console.error);
          }
        }, 2000);
      }
    };

    service.onError = (err) => {
      setStatus(prev => ({ ...prev, error: err, isRecording: false }));
      if (!intentionalStop.current) {
        // Tentativa de reconexão em caso de erro severo
        setTimeout(() => {
          if (!intentionalStop.current) handleStart().catch(console.error);
        }, 3000);
      }
    };

    // Aqui removemos a dependência de 'segments' e 'currentPartial' usando updates funcionais
    service.onTranscriptionUpdate = (text, isFinal) => {
      // Ignorar se a legenda estiver pausada
      if (isPausedRef.current) return;

      if (isFinal) {
        setSegments(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            text: text.trim(),
            timestamp: new Date(),
            isFinal: true
          }
        ]);
        setCurrentPartial('');
      } else {
        setCurrentPartial(text);
      }
      // NOTA: A transmissão ocorre via useEffect acima
    };

    return () => {
      service.disconnect();
    };
  }, []); // Dependência vazia CRÍTICA para evitar desconexão em re-renders

  const handleStart = async () => {
    try {
      intentionalStop.current = false;
      setStatus(prev => ({ ...prev, error: undefined, isRecording: true }));

      let stream: MediaStream;

      if (audioSource === AudioSourceType.SYSTEM_AUDIO) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1, height: 1 },
          audio: {
            echoCancellation: false,
            autoGainControl: false,
            noiseSuppression: false,
            channelCount: 1
          }
        });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true,
            channelCount: 1
          }
        });
      }

      await liveService.current.connect();
      await liveService.current.startAudioStream(stream);
      setStatus(prev => ({ ...prev, isRecording: true }));

    } catch (err: any) {
      console.error(err);
      setStatus(prev => ({
        ...prev,
        error: "Erro ao iniciar captura de áudio. Verifique permissões."
      }));
    }
  };

  const handleStop = useCallback(async () => {
    intentionalStop.current = true;
    setIsPaused(false);
    setPauseMessage('');
    await liveService.current.disconnect();
    setStatus(prev => ({ ...prev, isRecording: false, isConnected: false }));
  }, []);

  const handleClear = () => {
    setSegments([]);
    setCurrentPartial('');
  };

  const handleDownload = () => {
    const text = segments.map(s => `[${s.timestamp.toLocaleTimeString()}] ${s.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="!p-2 !rounded-full" onClick={onBack} title="Sair do modo Transmissor">
            <ExitIcon />
          </Button>
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              Painel do Transmissor
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">ADMIN</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {status.error && (
            <span className="text-red-400 text-sm bg-red-900/20 px-3 py-1 rounded-full border border-red-900/50">
              {status.error}
            </span>
          )}
          <Visualizer active={status.isRecording} />
          <div className={`w-3 h-3 rounded-full ${status.isConnected ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-700'}`} />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 flex flex-col w-full mx-auto relative z-0">
          {/* Reusing existing component for Admin preview */}
          <TranscriptDisplay
            segments={segments}
            currentPartial={currentPartial}
            isFullScreen={false}
            fontSize={24}
          />
        </div>

        {/* Controls */}
        <div className="border-t border-slate-800 bg-slate-900/90 backdrop-blur-xl p-4 md:p-6 sticky bottom-0 z-20">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center">

            <div className="flex bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setAudioSource(AudioSourceType.MICROPHONE)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${audioSource === AudioSourceType.MICROPHONE ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                disabled={status.isRecording}
              >
                <MicIcon /> Mic
              </button>
              <button
                onClick={() => setAudioSource(AudioSourceType.SYSTEM_AUDIO)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${audioSource === AudioSourceType.SYSTEM_AUDIO ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                disabled={status.isRecording}
              >
                <SystemAudioIcon /> Sistema
              </button>
            </div>

            <div className="flex gap-3">
              {!status.isRecording ? (
                <Button onClick={handleStart} variant="primary" icon={<MicIcon />}>
                  Iniciar Transmissão
                </Button>
              ) : (
                <Button onClick={handleStop} variant="danger" icon={<StopIcon />}>
                  Parar Transmissão
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleClear} variant="secondary" className="!px-3" title="Limpar Texto">
                <TrashIcon />
              </Button>
              <Button onClick={handleDownload} variant="secondary" className="!px-3" title="Baixar Transcrição">
                <DownloadIcon />
              </Button>
            </div>
          </div>

          {/* Preset / Pause Feature */}
          <div className="max-w-6xl mx-auto mt-4 pt-4 border-t border-slate-700/50">
            <div className="flex flex-col gap-2">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center justify-between">
                Layouts Predefinidos & Pausa
                {isPaused && <span className="text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full animate-pulse">Pausado</span>}
              </span>
              <div className="flex flex-wrap gap-2 items-center">
                {isPaused ? (
                  <Button
                    onClick={() => { setIsPaused(false); setPauseMessage(''); }}
                    className="!bg-indigo-600 hover:!bg-indigo-500 !text-white !py-1.5 shadow-[0_0_15px_rgba(79,70,229,0.5)] !gap-1"
                  >
                    <PlayIcon /> Retomar Legendas
                  </Button>
                ) : (
                  <Button
                    onClick={() => { setIsPaused(true); setPauseMessage(''); }}
                    variant="secondary"
                    className="hover:!text-amber-400 !py-1.5 !gap-1"
                    title="Pausar o áudio momentaneamente"
                  >
                    <PauseIcon /> Pausar
                  </Button>
                )}

                <div className="w-px h-6 bg-slate-700/50 mx-1" />

                {PRESET_MESSAGES.map((msg, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setIsPaused(true);
                      setPauseMessage(msg);
                    }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${isPaused && pauseMessage === msg
                        ? 'bg-amber-600 text-white shadow-lg ring-2 ring-amber-500/50'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 active:scale-95'
                      }`}
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};