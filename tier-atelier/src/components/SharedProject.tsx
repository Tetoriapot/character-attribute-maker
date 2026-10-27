import { useEffect, useState } from 'react';
import type { Project } from '../data/types';
import { useEditor } from '../stores/editorStore';
import { importSharedProject } from '../features/storage/session';
import { readShareHash } from '../features/export/sharing';
import { confirmDrafts } from '../features/editor/useDraft';
import { Dialog } from './Dialog';
import { e } from '../app/exportMessages';
import { t } from '../app/messages';

export function SharedProject() {
  const [incoming, setIncoming] = useState<{ project?: Project; error?: string }>();
  const [error, setError] = useState('');
  const busy = useEditor((state) => state.busy);
  useEffect(() => {
    const read = () => {
      if (!location.hash.startsWith('#tier=')) return;
      try { setIncoming({ project: readShareHash(location.hash) }); } catch { setIncoming({ error: e.invalidUrl }); }
    };
    read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
  }, []);
  function close() { if (!busy) { setIncoming(undefined); setError(''); history.replaceState(null, '', location.pathname + location.search); } }
  if (!incoming) return null;
  return <Dialog title={e.importTitle} onClose={close}>
    {incoming.error ? <p className="form-error" role="alert">{incoming.error}</p> : incoming.project && <>
      <h3 className="delete-name">{incoming.project.title}</h3><p>{t.tierCount(incoming.project.tiers.length)} · {t.itemCount(Object.keys(incoming.project.items).length)}</p><p>{e.importHint}</p>
      <button className="button primary full" disabled={busy} onClick={() => {
        if (incoming.project && confirmDrafts()) void importSharedProject(incoming.project).then((success) => { if (success) close(); else setError(useEditor.getState().error ?? e.invalidUrl); });
      }}>{e.import}</button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </Dialog>;
}
