import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../stores/editorStore';
import { confirmDrafts } from '../features/editor/useDraft';
import { matchingIds, selectableIds } from '../features/editor/filter';
import { h } from '../app/editingMessages';
import { d } from '../app/designMessages';
import { t } from '../app/messages';
import { Field } from './Fields';

export function HistoryTools() {
  const past = useEditor((state) => state.history.past.length), future = useEditor((state) => state.history.future.length);
  const disabled = useEditor((state) => state.busy || !!state.draggingId);
  const container = useRef<HTMLDivElement>(null);
  function travel(direction: 'undo' | 'redo') {
    if (confirmDrafts()) { useEditor.getState().travel(direction); container.current?.focus(); }
  }
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
      if (document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      const direction = key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === 'y' && event.ctrlKey ? 'redo' : undefined;
      if (!direction) return;
      const state = useEditor.getState();
      if (state.busy || state.draggingId || !(direction === 'undo' ? state.history.past.length : state.history.future.length)) return;
      event.preventDefault();
      if (confirmDrafts()) { state.travel(direction); container.current?.focus(); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, []);
  return <div ref={container} className="history-tools" tabIndex={-1} role="group" aria-label={h.tools} title={h.historyHint}>
    <button className="button secondary small" disabled={disabled || !past} onClick={() => travel('undo')} aria-keyshortcuts="Control+z Meta+z">{h.undo}</button>
    <button className="button secondary small" disabled={disabled || !future} onClick={() => travel('redo')} aria-keyshortcuts="Control+Shift+z Meta+Shift+z Control+y">{h.redo}</button>
  </div>;
}

export function EditingTools() {
  const busy = useEditor((state) => state.busy);
  const project = useEditor((state) => state.project), query = useEditor((state) => state.query), tags = useEditor((state) => state.filterTags);
  const selected = useEditor((state) => state.selectedIds), mode = useEditor((state) => state.selectionMode);
  const zoom = useEditor((state) => state.zoom), grid = useEditor((state) => state.grid), dragging = useEditor((state) => !!state.draggingId);
  const [destination, setDestination] = useState('unranked');
  const [open, setOpen] = useState(false);
  const visible = useMemo(() => matchingIds(project, query, tags), [project, query, tags]);
  const availableTags = useMemo(() => [...new Set(Object.values(project.items).flatMap((item) => item.tags))].sort((a, b) => a.localeCompare(b, 'ja')), [project.items]);
  const hidden = selected.filter((id) => !visible.includes(id)).length;
  return <details className="editing-tools" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>{h.panel}{(query || tags.length > 0 || selected.length > 0) && <span className="editing-summary">{h.results(visible.length, Object.keys(project.items).length)} · {h.selected(selected.length, hidden)}</span>}</summary>
    <fieldset disabled={dragging}>
      <div className="editing-search"><Field label={h.search}>{(id) => <input id={id} type="search" value={query} maxLength={200} placeholder={h.search} onChange={(event) => useEditor.setState({ query: event.target.value })} />}</Field>
        <Field label={h.zoom}>{(id) => <select id={id} value={zoom} onChange={(event) => useEditor.setState({ zoom: Number(event.target.value) })}>{[50, 75, 100, 125, 150, 200].map((value) => <option key={value} value={value}>{value}%</option>)}</select>}</Field>
        <label className="toggle-label"><input type="checkbox" checked={grid} onChange={(event) => useEditor.setState({ grid: event.target.checked })} />{h.grid}</label>
      </div>
      <div className="image-name-setting">
        <label className="toggle-label"><input type="checkbox" disabled={busy} checked={project.style.showImageNames === false} onChange={(event) => {
          if (!confirmDrafts()) return;
          if (useEditor.getState().dispatch({ type: 'design.update', style: { showImageNames: !event.target.checked } }, d.applied)) {
            useEditor.setState((state) => ({ drafts: {}, editEpoch: state.editEpoch + 1 }));
          }
        }} />{d.hideImageNames}</label><p className="field-hint">{d.imageNamesHint}</p>
      </div>
      <details className="filter-tags"><summary>{h.tags}{tags.length > 0 && ` (${tags.length})`}</summary><p className="field-hint">{h.tagHint}</p><div className="tag-options">{availableTags.length ? availableTags.map((tag) => <label key={tag}><input type="checkbox" checked={tags.includes(tag)} onChange={(event) => useEditor.setState({ filterTags: event.target.checked ? [...tags, tag] : tags.filter((value) => value !== tag) })} />{tag}</label>) : <p>{h.noTags}</p>}</div></details>
      <div className="editing-actions"><button className="button secondary small" disabled={!query && !tags.length} onClick={() => useEditor.setState({ query: '', filterTags: [] })}>{h.resetFilter}</button><span role="status">{h.results(visible.length, Object.keys(project.items).length)}</span>
        <button className="button secondary small" aria-pressed={mode} onClick={() => useEditor.setState({ selectionMode: !mode, selectedIds: [], selectionAnchor: null })}>{h.multi}</button>
      </div>
      {mode && <div className="bulk-tools"><p className="field-hint">{h.selectionHint}</p><div className="editing-actions"><button className="button secondary small" onClick={() => useEditor.setState({ selectedIds: [...new Set([...selected, ...selectableIds(project, visible)])] })}>{h.selectVisible}</button><button className="button secondary small" disabled={!selected.length} onClick={() => useEditor.setState({ selectedIds: [], selectionAnchor: null })}>{h.clearSelection}</button></div>
        <p role="status">{h.selected(selected.length, hidden)}</p>{hidden > 0 && <p className="field-hint">{h.hiddenSelection}</p>}
        <div className="bulk-destination"><Field label={h.destination}>{(id) => <select id={id} value={destination !== 'unranked' && !project.tiers.some((tier) => tier.id === destination) ? 'unranked' : destination} onChange={(event) => setDestination(event.target.value)}><option value="unranked">{t.unrankedItems}</option>{project.tiers.map((tier) => <option key={tier.id} value={tier.id} disabled={tier.locked}>{tier.name}{tier.locked ? ` (${t.locked})` : ''}</option>)}</select>}</Field>
          <button className="button primary" disabled={!selected.length} onClick={() => {
            if (!confirmDrafts()) return;
            const tierId = project.tiers.some((tier) => tier.id === destination) ? destination : null;
            if (useEditor.getState().dispatch({ type: 'items.move', ids: selected, tierId }, h.moved(selected.length))) {
              useEditor.setState((state) => ({ drafts: {}, editEpoch: state.editEpoch + 1 }));
            }
          }}>{h.move}</button></div>
      </div>}
      <p className="field-hint">{h.searchHint}</p><p className="field-hint">{h.viewHint}</p>
    </fieldset>
  </details>;
}
