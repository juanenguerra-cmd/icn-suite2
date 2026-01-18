import React, { useEffect } from 'react';

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal({ title, open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modalback" style={{ display: 'flex' }} role="dialog" aria-modal="true">
      <div className="modal">
        <div className="top">
          <div>
            <strong>{title}</strong>
          </div>
          <button className="closex" type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="sep" />
        {children}
      </div>
    </div>
  );
}
