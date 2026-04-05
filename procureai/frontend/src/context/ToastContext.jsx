// src/context/ToastContext.jsx
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const toast = {
    success: msg => addToast(msg, 'success'),
    error:   msg => addToast(msg, 'error'),
    info:    msg => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast-enter flex items-center gap-2 px-4 py-2.5 rounded-md border text-sm font-mono pointer-events-auto
              ${t.type === 'success' ? 'bg-bg-raised border-[rgba(39,168,98,.3)] text-[#27a862]'
              : t.type === 'error'   ? 'bg-bg-raised border-[rgba(240,79,67,.3)] text-[#f04f43]'
              : 'bg-bg-raised border-border-md text-text-primary'}`}
          >
            {t.type === 'success' && <span>✓</span>}
            {t.type === 'error'   && <span>✗</span>}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
