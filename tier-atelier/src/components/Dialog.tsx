import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { t } from '../app/messages';

export function Dialog({ title, children, onClose, drawer = false, closeDisabled = false }: { title: string; children: ReactNode; onClose: () => void; drawer?: boolean; closeDisabled?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      else document.getElementById('board-heading')?.focus();
    };
  }, []);
  return <dialog ref={ref} className={drawer ? 'dialog drawer' : 'dialog'} aria-labelledby={titleId}
    onKeyDown={(event) => {
      if (event.key !== 'Tab' || !(event.target instanceof HTMLElement) || event.target.closest('dialog') !== event.currentTarget) return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }}>
    <div className="dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" disabled={closeDisabled} onClick={onClose} aria-label={t.close} autoFocus><Icon name="close" /></button></div>
    <div className="dialog-content">{children}</div>
  </dialog>;
}
