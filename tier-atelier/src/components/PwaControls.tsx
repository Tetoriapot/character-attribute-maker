import { useState } from 'react';
import { usePwa, applyUpdate, checkForUpdate, installPwa, registerPwa } from '../features/pwa/client';
import { updateBlocker } from '../features/pwa/policy';
import { useEditor } from '../stores/editorStore';
import { p } from '../app/pwaMessages';
import { Dialog } from './Dialog';

export function PwaControls() {
  const state = usePwa(), editor = useEditor();
  const [open, setOpen] = useState(false);
  const blocker = updateBlocker(editor);
  return <>
    <div className="pwa-controls">
      <button className="button secondary small" onClick={() => setOpen(true)}>{p.open}</button>
      {!state.online && <span role="status" className="offline-status">{p.offline}</span>}
    </div>
    {state.updateAvailable && !state.dismissed && <aside className="pwa-notice" aria-label={p.updateReady}>
      <p role="status">{p.updateReady}</p><div className="pwa-actions">
        <button className="button primary small" onClick={() => setOpen(true)}>{p.updateOpen}</button>
        <button className="button secondary small" onClick={() => usePwa.setState({ dismissed: true })}>{p.later}</button>
      </div>
    </aside>}
    {open && <Dialog title={p.title} onClose={() => { if (!state.applying) setOpen(false); }}>
      <div className="pwa-panel" aria-busy={state.applying}>
        <p role="status" data-testid="offline-status">{state.mode === 'development' ? p.development : state.mode === 'unsupported' ? p.unsupported : state.offlineReady ? p.ready : p.preparing}</p>
        {!state.online && <p>{p.offline}。{state.offlineReady ? p.offlineHint : p.notReady}</p>}
        {state.mode === 'enabled' && <>
          {state.updateAvailable && <><p>{p.updateReady}</p><p>{p.updateHint}</p>{blocker && !state.applying && <p>{blocker}</p>}
            <button className="button primary" disabled={state.applying || !!blocker} onClick={() => void applyUpdate()}>{state.applying ? p.updating : p.update}</button></>}
          <div className="pwa-actions"><button className="button secondary" disabled={state.checking || state.applying || !state.online} onClick={() => void checkForUpdate()}>{state.checking ? p.checking : p.check}</button>
            {!state.offlineReady && <button className="button secondary" disabled={state.applying || !state.online} onClick={() => void registerPwa()}>{p.retry}</button>}
          </div>
        </>}
        <p>{p.offlineHelp}</p><p>{p.storage}</p>
        {state.installed ? <p>{p.installed}</p> : <><p>{p.installHint}</p>{state.installPrompt && <button className="button primary" disabled={state.applying} onClick={() => void installPwa()}>{p.install}</button>}</>}
        {state.message && <p role="status">{state.message}</p>}{state.error && <p className="form-error" role="alert">{state.error}</p>}
      </div>
    </Dialog>}
  </>;
}
