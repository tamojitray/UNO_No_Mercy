import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Info, AlertCircle, CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      if (next.length > 3) {
        return next.slice(next.length - 3);
      }
      return next;
    });
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 w-full max-w-md px-4 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              layout
              className="pointer-events-auto"
            >
              <div className={`
                flex items-center gap-3 p-4 rounded-xl shadow-2xl border backdrop-blur-md
                ${toast.type === 'error' 
                  ? 'bg-red-500/10 border-red-500/20 text-red-200' 
                  : toast.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                  : 'bg-slate-800/80 border-white/10 text-slate-100'}
              `}>
                <div className="shrink-0">
                  {toast.type === 'error' && <AlertCircle size={20} className="text-red-400" />}
                  {toast.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400" />}
                  {toast.type === 'info' && <Info size={20} className="text-blue-400" />}
                </div>
                <p className="text-sm font-medium flex-1">{toast.message}</p>
                <button 
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
