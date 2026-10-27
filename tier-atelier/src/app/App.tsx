import { useEffect, useState } from 'react';
import { DragDropProvider, type DragEndEvent } from '@dnd-kit/react';
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
  const [draftEdited, setDraftEdited] = useState(false);
  const [dialog, setDialog] = useState<'add' | 'help' | 'tiers' | 'properties' | null>(null);
  const project = useEditor((state) => state.project);
  const dirty = useEditor((state) => state.dirty);
  const dispatch = useEditor((state) => state.dispatch);
  const select = useEditor((state) => state.select);
  const clearError = useEditor((state) => state.clearError);
  useEffect(() => {
    if (!dirty && !draftEdited) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, draftEdited]);

  function choose(selection: Selection) {
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
  function closeDialog() { clearError(); setDialog(null); }

  return <DragDropProvider sensors={sensors} plugins={(defaults) => [...defaults.filter((plugin) => plugin !== Accessibility), accessibility]} onDragEnd={handleDrop}>
    <div className="app" onInput={() => setDraftEdited(true)}>
      <a className="skip-link" href="#board-heading">{t.board}</a>
      <header className="app-header">
        <div className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span><div><strong>{t.brand}</strong><span>{t.tagline}</span></div></div>
        <div className="header-project"><span className="header-divider" /><button onClick={() => choose({ kind: 'project' })} title={t.projectSettings}>{project.title}<Icon name="down" size={14} /></button></div>
        <div className="header-actions"><span className="phase-badge">{t.phase}</span><button className="help-button" aria-label={t.help} onClick={() => setDialog('help')}><Icon name="help" /><span>{t.help}</span></button></div>
      </header>
      <div className="workspace-bar"><div className="workspace-title"><Icon name="layers" size={16} /><span>{t.editor}</span></div>
        <div className="workspace-tools"><span className="unsaved"><i />{t.storageShort}</span><span className="toolbar-divider" />
          <button className="icon-button" aria-label={t.panelLeft} aria-pressed={!compact && leftVisible} onClick={() => compact ? setDialog('tiers') : setLeftVisible(!leftVisible)} title={t.panelLeft}><Icon name="panel" /></button>
          <button className="icon-button" aria-label={t.panelRight} aria-pressed={!compact && rightVisible} onClick={() => compact ? setDialog('properties') : setRightVisible(!rightVisible)} title={t.panelRight}><Icon name="settings" /></button>
        </div>
      </div>
      <div className={`workspace ${!leftVisible ? 'left-hidden' : ''} ${!rightVisible || compact ? 'right-hidden' : ''}`}>
        {leftVisible && <aside className="left-panel" aria-label={t.tierList}><Sidebar onSelect={choose} onAddTier={addTier} onAddText={addText} /></aside>}
        <main className="canvas"><div className="save-notice"><Icon name="info" size={16} /><span>{t.storageNotice}</span></div>
          {(!rightVisible || compact) && !dialog && <Feedback />}
          <Board onSelect={choose} onAddTier={addTier} onAddText={addText} />
          <footer className="canvas-footer"><span>{t.itemCount(Object.keys(project.items).length)}</span><span>{t.textItem}</span></footer>
        </main>
        {!compact && rightVisible && <aside className="right-panel" aria-label={t.properties}><div className="panel-heading"><h2>{t.properties}</h2><Icon name="settings" size={17} /></div><Properties /></aside>}
      </div>
      <nav className="mobile-toolbar" aria-label={t.editor}>
        <button onClick={() => setDialog('tiers')}><Icon name="layers" /><span>{t.tierList}</span></button>
        <button className="mobile-add" onClick={addText}><Icon name="plus" /><span>{t.addText}</span></button>
        <button onClick={() => setDialog('properties')}><Icon name="settings" /><span>{t.settings}</span></button>
      </nav>
      {dialog === 'add' && <Dialog title={t.addTextTitle} onClose={closeDialog}><ItemForm onDone={closeDialog} /><Feedback /></Dialog>}
      {dialog === 'help' && <Dialog title={t.helpTitle} onClose={closeDialog}><div className="help-content"><h3>{t.tiers}</h3><p>{t.helpTier}</p><p>{t.helpDelete}</p><h3>{t.items}</h3><p>{t.helpItem}</p><h3>{t.settings}</h3><p>{t.helpKeyboard}</p><p>{t.helpTouch}</p><div className="notice-inline">{t.storageNotice}</div></div></Dialog>}
      {dialog === 'tiers' && <Dialog drawer title={t.tierList} onClose={closeDialog}><Sidebar onSelect={choose} onAddTier={addTier} onAddText={addText} /></Dialog>}
      {dialog === 'properties' && <Dialog drawer title={t.properties} onClose={closeDialog}><Properties /></Dialog>}
    </div>
  </DragDropProvider>;
}
