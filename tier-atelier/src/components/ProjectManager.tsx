import { useEffect, useState } from 'react';
import { useEditor } from '../stores/editorStore';
import { duplicateProject, exportProject, importProject, newProject, openProject, refreshProjects, removeProject } from '../features/storage/session';
import { confirmDrafts } from '../features/editor/useDraft';
import { storageText as s } from '../app/storageMessages';
import { t } from '../app/messages';
import { Dialog } from './Dialog';
import { Field } from './Fields';
import { Feedback } from './Properties';
import { db } from '../data/db';

export function ProjectManager({ onClose }: { onClose: () => void }) {
  const projects = useEditor((state) => state.projects);
  const active = useEditor((state) => state.project.id);
  const busy = useEditor((state) => state.busy);
  const progress = useEditor((state) => state.progress);
  const saveError = useEditor((state) => state.saveError);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; title: string; revision: number }>();
  useEffect(() => { void refreshProjects().catch(() => useEditor.setState({ error: s.loadError })); }, []);
  async function perform(action: () => Promise<boolean>) {
    if (confirmDrafts() && await action()) onClose();
  }
  return <>
    <p className="field-hint">{s.backupHint}</p>
    <fieldset disabled={busy}>
      <form className="project-create" onSubmit={(event) => { event.preventDefault(); void perform(() => newProject(title)); }}>
        <Field label={s.projectName}>{(id) => <input id={id} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />}</Field>
        <button className="button primary" type="submit">{s.create}</button>
      </form>
      <ul className="project-list">
        {projects.map((project) => <li key={project.id} data-testid="project-entry">
          <div className="project-summary"><strong>{project.title}</strong><span>{t.itemCount(project.count)} · {new Date(project.updatedAt).toLocaleString('ja-JP')}</span>{project.id === active && <span className="current-project">{s.current}</span>}</div>
          <div className="project-actions">
            <button className="button secondary small" disabled={project.id === active} onClick={() => void perform(() => openProject(project.id))}>{s.open}</button>
            <button className="button secondary small" onClick={() => void perform(() => duplicateProject(project.id))}>{s.duplicate}</button>
            <button className="button text-button destructive small" onClick={() => {
              void db.projects.get(project.id).then((row) => {
                if (row) setDeleting({ id: project.id, title: project.title, revision: row.revision });
                else useEditor.setState({ error: s.conflict });
              }).catch(() => useEditor.setState({ error: s.operationError }));
            }}>{s.delete}</button>
          </div>
        </li>)}
      </ul>
      {!projects.length && <p>{s.empty}</p>}
      <div className="backup-actions">
        <button className="button secondary" onClick={() => void exportProject()}>{s.backup}</button>
        <Field label={s.restore}>{(id) => <input id={id} type="file" accept=".json,application/json" onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (file) void perform(() => importProject(file));
        }} />}</Field>
      </div>
    </fieldset>
    {progress && <p className="field-hint" aria-live="polite">{progress}</p>}
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    <Feedback />
    {deleting && <Dialog title={s.deleteTitle} closeDisabled={busy} onClose={() => { if (!busy) setDeleting(undefined); }}>
      <p className="delete-name">{deleting.title}</p><p>{s.deleteHint}</p>
      <div className="dialog-actions"><button className="button secondary" disabled={busy} onClick={() => setDeleting(undefined)}>{t.cancel}</button>
        <button className="button danger" disabled={busy} onClick={() => {
          if (confirmDrafts()) void removeProject(deleting.id, deleting.revision).then((success) => { if (success) setDeleting(undefined); });
        }}>{t.confirmDelete}</button></div><Feedback />
    </Dialog>}
  </>;
}
