import { lazy, Suspense, useEffect, useState } from 'react';
import { DragDropProvider, DragOverlay, type DragEndEvent } from '@dnd-kit/react';
import { Accessibility, KeyboardSensor, PointerSensor, PointerActivationConstraints } from '@dnd-kit/dom';
import { useEditor } from '../stores/editorStore';
import type { Selection } from '../data/types';
import { handleDrop } from '../features/editor/drag';
import { Sidebar } from '../components/Sidebar';
import { Board } from '../components/Board';
import { Feedback, ItemForm, Properties } from '../components/Properties';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { t } from './messages';
import { storageText as s } from './storageMessages';
import { addImages, exportProject, flushSave, initializeStorage } from '../features/storage/session';
import { confirmDrafts } from '../features/editor/useDraft';
import { ProjectManager } from '../components/ProjectManager';
import { ImageImport } from '../components/ImageImport';
import { d } from './designMessages';
import { e } from './exportMessages';
import { SharedProject } from '../components/SharedProject';
import { HistoryTools } from '../components/EditingTools';
import { h } from './editingMessages';
import { PwaControls } from '../components/PwaControls';
import { usePwa } from '../features/pwa/client';

const ExportPanel = lazy(() => import('../components/ExportPanel'));

const sensors = [KeyboardSensor, PointerSensor.configure({
  activationConstraints: (event) => event.pointerType === 'touch'
    ? [new PointerActivationConstraints.Delay({ value: 300, tolerance: 6 })]
    : [new PointerActivationConstraints.Distance({ value: 6 })],
})];
const accessibility = Accessibility.configure({
  screenReaderInstructions: { draggable: t.dragInstructions },
  announcements: { dragstart: () => t.dragStart, dragend: (event: DragEndEvent) => event.canceled ? t.dragCancel : t.dragEnd },
});

function useCompactLayout() {
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1050px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1050px)');
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}

export default function App() {
  const compact = useCompactLayout();
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [dialog, setDialog] = useState<'add' | 'help' | 'tiers' | 'properties' | 'projects' | 'images' | 'export' | null>(null);
  const project = useEditor((state) => state.project);
  const editEpoch = useEditor((state) => state.editEpoch);
  const dirty = useEditor((state) => state.dirty);
  const draftEdited = useEditor((state) => Object.keys(state.drafts).length > 0);
  const ready = useEditor((state) => state.ready);
  const loadError = useEditor((state) => state.loadError);
  const saveError = useEditor((state) => state.saveError);
  const saveStatus = useEditor((state) => state.saveStatus);
  const busy = useEditor((state) => state.busy);
  const progress = useEditor((state) => state.progress);
  const focusAfterOperation = useEditor((state) => state.focusAfterOperation);
  const dispatch = useEditor((state) => state.dispatch);
  const select = useEditor((state) => state.select);
  const clearError = useEditor((state) => state.clearError);
  useEffect(() => { void initializeStorage(); }, []);
  useEffect(() => {
    if (!busy && focusAfterOperation?.isConnected && !focusAfterOperation.closest('[inert], dialog:not([open])')) focusAfterOperation.focus();
  }, [busy, focusAfterOperation]);
  useEffect(() => {
    if (!dirty && !draftEdited && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { if (usePwa.getState().reloading) return; event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, draftEdited, busy]);

  function choose(selection: Selection) {
    if (!confirmDrafts()) return;
    select(selection);
    if (compact) setDialog('properties');
    else { setDialog(null); setRightVisible(true); }
  }
  function addTier() {
    if (dispatch({ type: 'tier.add' }, t.added)) {
      if (compact) setDialog('properties');
      else setRightVisible(true);
    }
  }
  function addText() { clearError(); setDialog('add'); }
  function closeDialog() { if (!busy) { clearError(); setDialog(null); } }
  function showDialog(next: typeof dialog) {
    if ((dialog === 'properties' || dialog === 'add') && !confirmDrafts()) return;
    clearError(); setDialog(next);
  }
  function importImages(files: File[]) {
    if (files.length && !busy && confirmDrafts()) { setDialog('images'); void addImages(files); }
  }
  if (!ready) return <main className="loading-screen"><h1>{t.brand}</h1><p role={loadError ? 'alert' : 'status'}>{loadError ?? s.loading}</p>{loadError && <button className="button primary" onClick={() => void initializeStorage()}>{s.retryLoad}</button>}</main>;

  return <DragDropProvider sensors={sensors} plugins={(defaults) => [...defaults.filter((plugin) => plugin !== Accessibility), accessibility]}
    onDragStart={(event) => useEditor.setState({ draggingId: event.operation.source ? String(event.operation.source.id) : null })}
    onDragEnd={(event) => { handleDrop(event); useEditor.setState({ draggingId: null }); }}>
    <div className="app" onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }} onDrop={(event) => {
      if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); importImages(Array.from(event.dataTransfer.files)); }
    }} onPaste={(event) => {
      if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return;
      const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
      if (files.length) { event.preventDefault(); importImages(files); }
    }}>
      <a className="skip-link" href="#board-heading">{t.board}</a>
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><div><strong>{t.brand}</strong><span>{t.tagline}</span></div></div>
        <div className="header-project"><span className="header-divider" /><button onClick={() => choose({ kind: 'project' })} title={t.projectSettings}>{project.title}<Icon name="down" size={14} /></button></div>
        <div className="header-actions"><button className="button secondary small projects-button" disabled={busy} onClick={() => showDialog('projects')}>{s.projects}</button><button className="help-button" disabled={busy} aria-label={t.help} onClick={() => showDialog('help')}><Icon name="help" /><span>{t.help}</span></button></div>
      </header>
      <div className="workspace-bar"><div className="workspace-title"><Icon name="layers" size={16} /><span>{t.editor}</span><button className="button secondary small export-open" disabled={busy} onClick={() => showDialog('export')}>{e.open}</button></div>
        <HistoryTools />
        <PwaControls />
        <div className="workspace-tools"><span className={`save-status ${saveStatus}`} data-testid="save-status" role="status">{s[saveStatus]}</span><span className="toolbar-divider" />
          <button className="icon-button" aria-label={t.panelLeft} aria-pressed={!compact && leftVisible} onClick={() => compact ? setDialog('tiers') : setLeftVisible(!leftVisible)} title={t.panelLeft}><Icon name="panel" /></button>
          <button className="icon-button" aria-label={t.panelRight} aria-pressed={!compact && rightVisible} onClick={() => compact ? setDialog('properties') : setRightVisible(!rightVisible)} title={t.panelRight}><Icon name="settings" /></button>
        </div>
      </div>
      {progress && <div className="operation-progress" role="status">{progress}</div>}
      {saveError && <div className="storage-error" role="alert"><p>{saveError}</p><div className="tray-actions"><button className="button secondary small" disabled={busy} onClick={() => void flushSave().catch(() => undefined)}>{s.retry}</button><button className="button secondary small" disabled={busy} onClick={() => void exportProject()}>{s.backup}</button></div></div>}
      <div inert={busy} className={`workspace ${!leftVisible ? 'left-hidden' : ''} ${!rightVisible || compact ? 'right-hidden' : ''}`}>
        {leftVisible && <aside className="left-panel" aria-label={t.tierList}><Sidebar onSelect={choose} onAddTier={addTier} onAddText={addText} /></aside>}
        <main className="canvas"><div className="save-notice"><Icon name="info" size={16} /><span>{s.saveHint}</span></div>
          {(!rightVisible || compact) && !dialog && <Feedback />}
          <Board key={project.id} onSelect={choose} onAddTier={addTier} onAddText={addText} onAddImages={() => setDialog('images')} />
          <footer className="canvas-footer"><span>{t.itemCount(Object.keys(project.items).length)}</span><button onClick={() => void exportProject()}>{s.backup}</button></footer>
        </main>
        {!compact && rightVisible && <aside className="right-panel" aria-label={t.properties}><div className="panel-heading"><h2>{t.properties}</h2><Icon name="settings" size={17} /></div><Properties key={editEpoch} /></aside>}
      </div>
      <nav inert={busy} className="mobile-toolbar" aria-label={t.editor}>
        <button onClick={() => setDialog('tiers')}><Icon name="layers" /><span>{t.tierList}</span></button>
        <button className="mobile-add" onClick={addText}><Icon name="plus" /><span>{t.addText}</span></button>
        <button onClick={() => setDialog('properties')}><Icon name="settings" /><span>{t.settings}</span></button>
        <button onClick={() => choose({ kind: 'design' })}><Icon name="panel" /><span>{d.title}</span></button>
      </nav>
      {dialog === 'add' && <Dialog title={t.addTextTitle} onClose={closeDialog}><ItemForm onDone={closeDialog} /><Feedback /></Dialog>}
      {dialog === 'help' && <Dialog title={t.helpTitle} onClose={closeDialog}><div className="help-content"><h3>{t.tiers}</h3><p>{t.helpTier}</p><p>{t.helpDelete}</p><h3>{t.items}</h3><p>{t.helpItem}</p><h3>{h.tools}</h3><p>{h.historyHint}</p><p>{h.shortcuts}</p><p>{h.selectionHint}</p><p>{h.virtualHint}</p><h3>{t.settings}</h3><p>{t.helpKeyboard}</p><p>{t.helpTouch}</p><div className="notice-inline">{t.storageNotice}</div></div></Dialog>}
      {dialog === 'tiers' && <Dialog drawer title={t.tierList} onClose={closeDialog}><Sidebar onSelect={choose} onAddTier={addTier} onAddText={addText} /></Dialog>}
      {dialog === 'properties' && <Dialog drawer title={t.properties} onClose={closeDialog}><Properties key={editEpoch} /></Dialog>}
      {dialog === 'projects' && <Dialog title={s.projects} onClose={closeDialog}><ProjectManager onClose={closeDialog} /></Dialog>}
      {dialog === 'images' && <Dialog title={s.images} onClose={closeDialog}><ImageImport /></Dialog>}
      {dialog === 'export' && <Dialog title={e.title} onClose={closeDialog}><Suspense fallback={<p role="status">{e.updating}</p>}><ExportPanel key={project.id} /></Suspense></Dialog>}
      <SharedProject />
      <span className="visually-hidden">{h.shortcuts}</span>
    </div>
    <DragOverlay dropAnimation={null}>{(source) => <div className="drag-preview" aria-hidden="true">{project.items[String(source.id)]?.name ?? project.tiers.find((tier) => tier.id === String(source.id))?.name}</div>}</DragOverlay>
  </DragDropProvider>;
}
