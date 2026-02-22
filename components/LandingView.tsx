import React from 'react';
import { Button } from './Button';
import { LiveBadge } from './LiveBadge';

interface LandingViewProps {
    onStart: () => void;
    isLive: boolean;
}

export const LandingView: React.FC<LandingViewProps> = ({ onStart, isLive }) => {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-8">
            {/* Main Card Container */}
            <div className="w-full max-w-md bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative">

                {/* Header Section */}
                <header className="px-8 py-8 flex justify-between items-start border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
                        <div className="flex flex-col">
                            <h1 className="text-xl font-bold text-white tracking-tight leading-none">Voz Sereno</h1>
                            <LiveBadge visible={isLive} />
                        </div>
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded-2xl border border-white/5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
                            <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />
                        </svg>
                    </div>
                </header>

                {/* Content Section */}
                <div className="px-8 py-10 flex flex-col items-center text-center">
                    <h2 className="text-3xl font-bold text-white mb-8 leading-tight">
                        Acessibilidade e <br />
                        Inclusão no nosso Culto
                    </h2>

                    {/* Waveform Graphic */}
                    <div className="flex items-center justify-center gap-1.5 h-16 mb-10">
                        <div className="w-1.5 h-6 bg-indigo-500/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-12 bg-indigo-500/80 rounded-full animate-bounce" style={{ animationDelay: '100ms' }} />
                        <div className="w-1.5 h-16 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                        <div className="w-1.5 h-12 bg-indigo-500/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        <div className="w-1.5 h-6 bg-indigo-500/60 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>

                    <p className="text-slate-300 text-lg leading-relaxed mb-10 max-w-[90%] font-medium">
                        Transmissão de legendas ao vivo para que todos possam acompanhar a palavra com clareza e emoção.
                    </p>

                    {/* App Preview Card */}
                    <div className="w-full bg-black/40 border border-white/5 rounded-3xl p-6 text-left mb-10">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-4">Visualização do App:</p>
                        <p className="text-xl italic text-slate-200 font-medium mb-6">
                            "...consegue entender a palavra."
                        </p>
                        <div className="flex justify-between items-center opacity-30">
                            <div className="h-1.5 w-24 bg-slate-700 rounded-full" />
                            <div className="h-1.5 w-8 bg-slate-700 rounded-full" />
                        </div>
                    </div>

                    {/* CTA Button */}
                    <button
                        onClick={onStart}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                        Acessar Legendas
                    </button>
                </div>

                {/* Footer Section */}
                <footer className="mt-4 pb-8 text-center bg-slate-900/20 py-4">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em]">
                        Powered by <span className="text-slate-400">Voz Sereno Technology</span>
                    </p>
                </footer>
            </div>
        </div>
    );
};
