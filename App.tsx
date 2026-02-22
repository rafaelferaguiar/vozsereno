import React, { useState, useEffect } from 'react';
import { BroadcasterView } from './components/BroadcasterView';
import { ViewerView } from './components/ViewerView';
import { Button } from './components/Button';
import { LandingView } from './components/LandingView';
import { supabase } from './services/supabaseClient';

type AppMode = 'LANDING' | 'VIEWER' | 'BROADCASTER';

function App() {
  const [mode, setMode] = useState<AppMode>('LANDING');
  const [isLive, setIsLive] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Fetch live status in App level to share across views
  useEffect(() => {
    const fetchInitialLiveStatus = async () => {
      const { data } = await supabase
        .from('transcription_state')
        .select('is_live')
        .eq('id', 1)
        .single();

      if (data) setIsLive(data.is_live);
    };

    fetchInitialLiveStatus();

    const channel = supabase
      .channel('live-status-global')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'transcription_state', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new && typeof payload.new.is_live !== 'undefined') {
            setIsLive(payload.new.is_live);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Adbur@555') {
      setMode('BROADCASTER');
      setShowLogin(false);
      setPassword('');
      setError('');
    } else {
      setError('Senha incorreta');
    }
  };

  const handleOpenAdmin = () => {
    setShowLogin(true);
  };

  const handleCloseAdmin = () => {
    setShowLogin(false);
    setPassword('');
    setError('');
  };

  const renderContent = () => {
    switch (mode) {
      case 'LANDING':
        return <LandingView onStart={() => setMode('VIEWER')} isLive={isLive} />;
      case 'BROADCASTER':
        return <BroadcasterView onBack={() => setMode('VIEWER')} />;
      case 'VIEWER':
      default:
        return <ViewerView onOpenAdmin={handleOpenAdmin} isLiveExternal={isLive} />;
    }
  };

  return (
    <>
      {/* Componente Principal baseado no Modo */}
      {renderContent()}

      {/* Modal de Login */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-t-white/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />

            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Administração</h2>
            <p className="text-slate-400 text-sm mb-6">Entre com sua credencial para acessar os controles de transmissão.</p>

            <form onSubmit={handleAdminLogin} className="space-y-5">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha do Administrador"
                  className="w-full bg-slate-800/50 border border-slate-700 text-white rounded-2xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                  autoFocus
                />
                {error && (
                  <div className="flex items-center gap-2 mt-3 text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    {error}
                  </div>
                )}
              </div>
              <div className="flex gap-4 pt-4">
                <Button type="button" variant="secondary" onClick={handleCloseAdmin} className="flex-1 !rounded-2xl !py-4 font-semibold text-slate-300">
                  Voltar
                </Button>
                <Button type="submit" variant="primary" className="flex-1 !rounded-2xl !py-4 font-bold shadow-lg shadow-indigo-500/20">
                  Acessar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default App;