import { useEffect, useRef, useState } from 'react';
import { useEditor } from '../stores/editorStore';
import { db } from '../data/db';
import { createBackup } from '../features/backup/backup';
import { renderProject, type RenderedImage } from '../features/export/render';
import { defaultExportOptions, exportOptionsSchema, safeFilename, type ExportOptions } from '../features/export/options';
import { createShareUrl, downloadFile, shareFile } from '../features/export/sharing';
import { preparePrint, type PrintDocument } from '../features/export/printing';
import { Field } from './Fields';
import { e } from '../app/exportMessages';

export default function ExportPanel() {
  const project = useEditor((state) => state.project), records = useEditor((state) => state.records);
  const [options, setOptions] = useState<ExportOptions>({ ...defaultExportOptions, includeTitle: project.style.showTitle });
  const [customScale, setCustomScale] = useState(false);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const [image, setImage] = useState<{ result: RenderedImage; url: string; file: File }>();
  const [projectFile, setProjectFile] = useState<File>(), [shareUrl, setShareUrl] = useState('');
  const [printDocument, setPrintDocument] = useState<PrintDocument>();
  const controller = useRef<AbortController | null>(null), active = useRef(true);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const imageRef = useRef<typeof image>(undefined), printRef = useRef<PrintDocument | undefined>(undefined);
  useEffect(() => { if (!busy && restoreFocus.current?.isConnected) restoreFocus.current.focus(); }, [busy]);
  useEffect(() => {
    active.current = true;
    let stopped = false;
    void db.settings.get('exportOptions.v1').then((row) => {
      if (stopped) return;
      if (row) {
        const parsed = exportOptionsSchema.safeParse(JSON.parse(row.value));
        if (parsed.success) { setOptions({ ...parsed.data, transparent: parsed.data.format !== 'jpeg' && parsed.data.transparent }); setCustomScale(![1, 2, 3].includes(parsed.data.scale)); }
      }
    }).catch(() => { if (!stopped) setStatus(e.preferencesError); }).finally(() => { if (!stopped) setReady(true); });
    return () => {
      stopped = true; active.current = false; controller.current?.abort(); printRef.current?.dispose();
      if (imageRef.current) { URL.revokeObjectURL(imageRef.current.url); imageRef.current.result.canvas.width = imageRef.current.result.canvas.height = 1; }
    };
  }, []);
  const current = image && JSON.stringify(image.result.options) === JSON.stringify(options);
  async function perform(action: (signal: AbortSignal) => Promise<void>) {
    if (busy) return;
    restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    controller.current?.abort(); controller.current = new AbortController();
    setBusy(true); setError(''); setStatus('');
    try { await action(controller.current.signal); }
    catch (failure) { if (active.current && !(failure instanceof DOMException && failure.name === 'AbortError')) setError(failure instanceof Error ? failure.message : e.renderError); }
    finally { if (active.current) setBusy(false); }
  }
  function update<K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) {
    printRef.current?.dispose(); printRef.current = undefined; setPrintDocument(undefined);
    setOptions((previous) => ({ ...previous, [key]: value, ...(key === 'format' && value === 'jpeg' ? { transparent: false } : {}) }));
    setError(''); setStatus('');
  }
  async function generate(signal: AbortSignal) {
    const result = await renderProject(project, records, options, signal);
    if (!active.current) { result.canvas.width = result.canvas.height = 1; return; }
    const file = new File([result.blob], safeFilename(project.title, result.options.format === 'jpeg' ? 'jpg' : result.options.format), { type: result.blob.type });
    const next = { result, file, url: URL.createObjectURL(result.blob) };
    if (imageRef.current) { URL.revokeObjectURL(imageRef.current.url); imageRef.current.result.canvas.width = imageRef.current.result.canvas.height = 1; }
    printRef.current?.dispose(); printRef.current = undefined; setPrintDocument(undefined);
    imageRef.current = next; setImage(next);
    try { await db.settings.put({ key: 'exportOptions.v1', value: JSON.stringify(result.options) }); }
    catch { if (active.current) setStatus(e.preferencesError); }
  }
  return <div className="export-panel" aria-busy={busy}>
    <p className="field-hint">{e.hint}</p>
    <form onSubmit={(event) => { event.preventDefault(); void perform(generate); }}>
      <fieldset disabled={busy || !ready}>
        <div className="export-fields">
          <Field label={e.format}>{(id) => <select id={id} value={options.format} onChange={(event) => update('format', event.target.value as ExportOptions['format'])}><option value="png">PNG</option><option value="jpeg">JPEG</option><option value="webp">WebP</option></select>}</Field>
          <Field label={e.width} hint="320〜2,400">{(id) => <input type="number" id={id} min={320} max={2400} step={1} required value={Number.isFinite(options.width) ? options.width : ''} onChange={(event) => update('width', event.target.valueAsNumber)} />}</Field>
          <Field label={e.scale}>{(id) => <select id={id} value={customScale ? 'custom' : options.scale} onChange={(event) => { const custom = event.target.value === 'custom'; setCustomScale(custom); if (!custom) update('scale', Number(event.target.value)); }}><option value="1">1倍</option><option value="2">2倍</option><option value="3">3倍</option><option value="custom">{e.custom}</option></select>}</Field>
          {customScale && <Field label={e.customScale} hint="0.1〜4">{(id) => <input id={id} type="number" min={.1} max={4} step={.1} required value={Number.isFinite(options.scale) ? options.scale : ''} onChange={(event) => update('scale', event.target.valueAsNumber)} />}</Field>}
        </div>
        <label className="toggle-label"><input type="checkbox" checked={options.transparent} disabled={options.format === 'jpeg'} onChange={(event) => update('transparent', event.target.checked)} />{e.transparent}</label>
        <p className="field-hint">{options.format === 'jpeg' ? e.jpegHint : e.transparencyHint}</p>
        <label className="toggle-label"><input type="checkbox" checked={options.includeTitle} onChange={(event) => update('includeTitle', event.target.checked)} />{e.includeTitle}</label>
        <label className="toggle-label"><input type="checkbox" checked={options.includeUnranked} onChange={(event) => update('includeUnranked', event.target.checked)} />{e.includeUnranked}</label>
        <button type="submit" className="button primary full">{busy ? e.updating : e.create}</button>
      </fieldset>
    </form>
    {image && <figure className="export-preview"><div role="region" aria-label={e.preview} tabIndex={0}><img src={image.url} alt={e.preview} /></div><figcaption>{e.dimensions(image.result.width, image.result.height)} · {image.result.blob.type}{!current && <p>{e.stale}</p>}</figcaption></figure>}
    <div className="export-actions">
      <button className="button primary" disabled={busy || !current} onClick={() => { if (image) { downloadFile(image.file); setStatus(e.downloaded); } }}>{e.download}</button>
      <button className="button secondary" disabled={busy || !current} onClick={() => void perform(async () => { if (image) { const result = await shareFile(image.file); if (active.current) setStatus(result); } })}>{e.shareImage}</button>
      <button className="button secondary" disabled={busy || !current} onClick={() => void perform(async (signal) => {
        if (!image) return;
        const prepared = await preparePrint(image.result, project.title, signal);
        if (!active.current) { prepared.dispose(); return; }
        printRef.current?.dispose(); printRef.current = prepared; setPrintDocument(prepared); setStatus(e.printReady);
      })}>{e.preparePrint}</button>
      <button className="button secondary" disabled={busy || !current || !printDocument} onClick={() => { try { printDocument?.print(); setStatus(e.printing); } catch { setError(e.printError); } }}>{e.print}</button>
    </div>
    <p className="field-hint">{e.printHint}{printDocument && ` ${e.pages(printDocument.pages)}`}</p>
    <div className="property-section"><h3>{e.shareProject}</h3>
      <div className="export-actions"><button className="button secondary" disabled={busy} onClick={() => void perform(async (signal) => {
        const blob = await createBackup(project, records); signal.throwIfAborted();
        setProjectFile(new File([blob], safeFilename(project.title, 'tier.json'), { type: 'application/json' })); setStatus(e.projectReady);
      })}>{e.prepareProject}</button>
      <button className="button secondary" disabled={busy || !projectFile} onClick={() => void perform(async () => { if (projectFile) { const result = await shareFile(projectFile); if (active.current) setStatus(result); } })}>{e.shareProject}</button></div>
    </div>
    <div className="property-section"><h3>{e.urlTitle}</h3><p className="field-hint">{e.urlHint}</p>
      <button className="button secondary" disabled={busy} onClick={() => { setError(''); try { setShareUrl(createShareUrl(project, location.href)); } catch (failure) { setError(failure instanceof Error ? failure.message : e.invalidUrl); } }}>{e.createUrl}</button>
      {shareUrl && <><Field label={e.url}>{(id) => <textarea id={id} rows={3} readOnly value={shareUrl} onFocus={(event) => event.target.select()} />}</Field><button className="button secondary" onClick={() => { void navigator.clipboard?.writeText(shareUrl).then(() => setStatus(e.copied)).catch(() => setError(e.copyError)); if (!navigator.clipboard) setError(e.copyError); }}>{e.copyUrl}</button></>}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="form-feedback" role="status">{busy ? e.updating : status}</p>
  </div>;
}
