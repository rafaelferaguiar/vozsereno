import React, { useState } from 'react';
import { BroadcasterView } from './components/BroadcasterView';
import { ViewerView } from './components/ViewerView';
import { Button } from './components/Button';

type AppMode = 'VIEWER' | 'BROADCASTER';

function App() {
  const [mode, setMode] = useState<AppMode>('VIEWER');
  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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

  return (
    <>
      {/* Componente Principal baseado no Modo */}
      {mode === 'BROADCASTER' ? (
        <BroadcasterView onBack={() => setMode('VIEWER')} />
      ) : (
        <ViewerView onOpenAdmin={handleOpenAdmin} />
      )}

      {/* Modal de Login */}
      {showLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-4">Acesso Administrativo</h2>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Digite a senha de administrador"
                            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                            autoFocus
                        />
                        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="secondary" onClick={handleCloseAdmin} className="flex-1">
                            Cancelar
                        </Button>
                        <Button type="submit" variant="primary" className="flex-1">
                            Entrar
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