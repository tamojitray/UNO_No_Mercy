import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BugReport = () => {
    const [bug, setBug] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [showNotification, setShowNotification] = useState(false);

    const API_BASE = import.meta.env.PROD 
      ? window.location.origin 
      : window.location.protocol + "//" + window.location.hostname + ":8000";

    useEffect(() => {
        // Show notification on mount
        setShowNotification(true);
        const timer = setTimeout(() => {
            setShowNotification(false);
        }, 10000);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedBug = bug.trim();
        if (!trimmedBug) return;

        setSending(true);
        try {
            await axios.post(`${API_BASE}/report_bug/`, { bug: trimmedBug });
            setBug('');
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to send bug report:', error);
            alert('Failed to send bug report. Please try again later.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className={`fixed bottom-6 left-6 z-[200] transition-all duration-300 ease-in-out`}>
            {isOpen ? (
                <div className="w-80 bg-slate-900/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-gradient-to-r from-red-600 to-rose-500 p-4 flex items-center justify-between border-b border-white/10 shadow-lg">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white animate-pulse">
                                <path d="M12 2a1 1 0 0 1 1 1v1.071c1.78.136 3.402.793 4.733 1.787l1.107-1.108a1 1 0 0 1 1.414 1.414l-1.05 1.05a9.002 9.002 0 0 1 1.767 4.786H21a1 1 0 1 1 0 2h-1.029a9.002 9.002 0 0 1-1.767 4.786l1.05 1.05a1 1 0 0 1-1.414 1.414l-1.107-1.108A8.955 8.955 0 0 1 13 20.929V22a1 1 0 1 1-2 0v-1.071a8.955 8.955 0 0 1-4.733-1.787l-1.107 1.108a1 1 0 0 1-1.414-1.414l1.05-1.05a9.002 9.002 0 0 1-1.767-4.786H3a1 1 0 1 1 0-2h1.029a9.002 9.002 0 0 1 1.767-4.786l-1.05-1.05a1 1 0 0 1 1.414-1.414l1.107 1.108A8.955 8.955 0 0 1 11 4.071V3a1 1 0 0 1 1-1zM8 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                            </svg>
                            <h3 className="text-white font-black text-xs tracking-[0.2em] uppercase">Report Bug</h3>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)} 
                            className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-5 bg-slate-900/50 flex flex-col gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bug Description</label>
                            <textarea
                                value={bug}
                                onChange={(e) => setBug(e.target.value)}
                                placeholder="What went wrong? Be specific..."
                                rows={4}
                                className="w-full bg-slate-800/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50 transition-all resize-none shadow-inner"
                            />
                        </div>
                        
                        <button
                            type="submit"
                            disabled={sending || !bug.trim()}
                            className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:from-slate-700 disabled:to-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all active:scale-[0.98] shadow-xl shadow-red-900/20 flex items-center justify-center gap-2"
                        >
                            {sending ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <span>Submit Report</span>
                            )}
                        </button>
                    </form>
                    
                    <div className="bg-black/20 p-3 border-t border-white/5 text-center">
                        <p className="text-[9px] text-slate-500 font-medium">Thank you for helping us improve!</p>
                    </div>
                </div>
            ) : (
                <div className="relative flex flex-col items-start gap-4">
                    {showNotification && (
                        <div className="absolute bottom-full left-0 mb-4 w-64 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-white text-slate-900 text-[11px] font-bold py-3 px-4 rounded-2xl shadow-2xl relative border border-white/20">
                                This site is in development, please report bugs by clicking this button.
                                {/* Triangle pointer */}
                                <div className="absolute top-full left-6 -mt-1 border-8 border-transparent border-t-white"></div>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => {
                            setIsOpen(true);
                            setShowNotification(false);
                        }}
                        className="group relative flex items-center justify-center"
                        title="Report a Bug"
                    >
                        <div className="absolute inset-0 bg-red-600 rounded-2xl blur-xl opacity-0 group-hover:opacity-40 transition-opacity duration-300"></div>
                        <div className="relative bg-slate-900/80 hover:bg-red-600 backdrop-blur-xl border border-white/10 hover:border-red-400/50 text-white p-4 rounded-2xl shadow-2xl transition-all duration-300 hover:-translate-y-1 active:scale-90 group-hover:rotate-6">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-red-500 group-hover:text-white transition-colors">
                                <path d="M12 2a1 1 0 0 1 1 1v1.071c1.78.136 3.402.793 4.733 1.787l1.107-1.108a1 1 0 0 1 1.414 1.414l-1.05 1.05a9.002 9.002 0 0 1 1.767 4.786H21a1 1 0 1 1 0 2h-1.029a9.002 9.002 0 0 1-1.767 4.786l1.05 1.05a1 1 0 0 1-1.414 1.414l-1.107-1.108A8.955 8.955 0 0 1 13 20.929V22a1 1 0 1 1-2 0v-1.071a8.955 8.955 0 0 1-4.733-1.787l-1.107 1.108a1 1 0 0 1-1.414-1.414l1.05-1.05a9.002 9.002 0 0 1-1.767-4.786H3a1 1 0 1 1 0-2h1.029a9.002 9.002 0 0 1 1.767-4.786l-1.05-1.05a1 1 0 0 1 1.414-1.414l1.107 1.108A8.955 8.955 0 0 1 11 4.071V3a1 1 0 0 1 1-1zM8 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
                            </svg>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BugReport;
