import { storageText as s } from '../app/storageMessages';
import { useEditor } from '../stores/editorStore';
import { addImages } from '../features/storage/session';
import { Field } from './Fields';
import { Feedback } from './Properties';

export function ImageImport() {
  const busy = useEditor((state) => state.busy);
  const errors = useEditor((state) => state.imageErrors);
  const saveError = useEditor((state) => state.saveError);
  const progress = useEditor((state) => state.progress);
  return <div className="image-import">
    <p>{s.imageHelp}</p><p className="field-hint">{s.limits}</p>
    <Field label={s.selectFiles}>{(id) => <input id={id} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(event) => {
      const files = Array.from(event.target.files ?? []); event.target.value = '';
      if (files.length) void addImages(files);
    }} />}</Field>
    <div className="file-drop-hint">{s.drop}</div>
    {progress && <p className="field-hint" aria-live="polite">{progress}</p>}
    {saveError && <p className="form-error" role="alert">{saveError}</p>}
    {errors.length > 0 && <ul className="import-errors" role="alert">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul>}
    <Feedback />
  </div>;
}
