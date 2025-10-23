import React, { useEffect } from 'react';

/**
 * ScorePopup
 * Props:
 * - visible: boolean
 * - score: number | string
 * - onClose: () => void
 * - autoHideMs: number (ms) or 0 to disable auto hide
 * - position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
 * - showBackdrop: boolean
 * - size: 'sm' | 'md' | 'lg'
 * - closable: boolean (show close X). Default false per request.
 */
export default function ScorePopup({
  visible,
  score,
  onClose = () => {},
  autoHideMs = 3000,
  position = 'bottom-right',
  showBackdrop = false,
  size = 'md',
  closable = false,
}) {
  useEffect(() => {
    if (!visible) return;
    if (!autoHideMs || autoHideMs <= 0) return;
    const t = setTimeout(() => onClose(), autoHideMs);
    return () => clearTimeout(t);
  }, [visible, autoHideMs, onClose]);

  if (!visible) return null;

  const sizes = {
    sm: { w: 'w-14 h-14', text: 'text-lg', sub: 'text-xs' },
    md: { w: 'w-20 h-20', text: 'text-2xl', sub: 'text-sm' },
    lg: { w: 'w-28 h-28', text: 'text-4xl', sub: 'text-base' },
  };
  const s = sizes[size] || sizes.md;

  const posMap = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    center: 'inset-0 flex items-center justify-center',
  };
  const posClass = posMap[position] || posMap['bottom-right'];

  return (
    <>
      {showBackdrop && <div className="fixed inset-0 bg-black/30 z-[998]" onClick={onClose} />}
      <div
        role="status"
        aria-live="polite"
        className={`fixed z-[999] ${position === 'center' ? posClass : `${posClass} flex items-end`}`}
      >
        <div className="m-4">
          <div className={`relative ${s.w} ${s.h} rounded-full bg-gradient-to-br from-green-500 to-emerald-400 shadow-2xl flex items-center justify-center`}>
            {/* Big score number */}
            <div className="text-white text-center select-none">
              <div className={`${s.text} font-extrabold leading-none`}>{score}</div>
              <div className={`${s.sub} opacity-90 mt-0.5`}>Điểm</div>
            </div>

            {/* pulse ring */}
            <span className="absolute inline-block w-full h-full rounded-full animate-pulse-slow opacity-60" />

            {/* optional close (hidden by default) */}
            {closable && (
              <button
                onClick={onClose}
                aria-label="Close score popup"
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white/90 text-black flex items-center justify-center text-xs shadow-md"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-slow {
          0% { transform: scale(1); opacity: 0.28; }
          50% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1); opacity: 0.28; }
        }
        .animate-pulse-slow { animation: pulse-slow 1700ms infinite; border: 2px solid rgba(255,255,255,0.06); }
      `}</style>
    </>
  );
}
