import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import type { Item, Project, Selection, Tier } from '../data/types';
import { useEditor } from '../stores/editorStore';
import { Icon } from './Icon';
import { t } from '../app/messages';
import { storageText as s } from '../app/storageMessages';
import { AssetImage } from './AssetImage';
import { appearance } from '../features/design/appearance';
import { isItemNameVisible, resolveStyle } from '../features/design/settings';
import { useAssetUrl } from '../features/assets/useAssetUrl';
import { matchingIds } from '../features/editor/filter';
import { VirtualTray } from './VirtualTray';
import { EditingTools } from './EditingTools';
import { h } from '../app/editingMessages';

export function ItemCard({ item, selected, locked, onSelect }: { item: Item; selected: boolean; locked?: boolean; onSelect: () => void }) {
  const style = useEditor((state) => state.project.style);
  const mode = useEditor((state) => state.selectionMode), multiSelected = useEditor((state) => state.selectedIds.includes(item.id));
  const toggle = useEditor((state) => state.toggleItem);
  const draggable = useDraggable({ id: item.id, type: 'item', disabled: locked });
  const drop = useDroppable({ id: `item:${item.id}`, accept: 'item', disabled: locked || draggable.isDragSource, collisionPriority: 2 });
  return <div ref={(node) => { draggable.ref(node); drop.ref(node); }}
    data-dragging={draggable.isDragging || draggable.isDropping} className={`item-card ${selected ? 'selected' : ''} ${multiSelected ? 'multi-selected' : ''} ${drop.isDropTarget ? 'drop-target' : ''}`}>
    <button type="button" className="item-select" disabled={mode && locked} onClick={(event) => { if (mode || event.ctrlKey || event.metaKey || event.shiftKey) toggle(item.id, event.shiftKey); else onSelect(); }} aria-label={mode ? h.selectItem(item.name) : t.editItem(item.name)} aria-pressed={mode ? multiSelected : selected} title={item.name}>
      {item.assetId ? <AssetImage assetId={item.assetId} crop={item.crop} fit={style.imageFit} /> : <span className="item-initial" aria-hidden="true">{Array.from(item.name)[0]}</span>}<span className={`item-name ${!isItemNameVisible(item, style) ? 'visually-hidden' : ''}`}>{item.name}</span>
    </button>
    {mode && <input className="item-checkbox" type="checkbox" disabled={locked} checked={multiSelected} aria-label={h.selectItem(item.name)} onChange={() => toggle(item.id)} />}
    <button ref={draggable.handleRef} type="button" className="item-grip" disabled={locked} aria-label={t.dragItem(item.name)} title={t.dragItem(item.name)}><Icon name="grip" size={14} /></button>
  </div>;
}

function ItemZone({ project, ids, tier, selection, onSelect }: { project: Project; ids: string[]; tier?: Tier; selection: Selection; onSelect: (selection: Selection) => void }) {
  const { ref, isDropTarget } = useDroppable({ id: `zone:${tier?.id ?? 'unranked'}`, accept: 'item', disabled: tier?.locked, collisionPriority: 1 });
  const renderItem = (id: string) => {
    const item = project.items[id];
    return item && <ItemCard key={id} item={item} locked={tier?.locked} selected={selection.kind === 'item' && selection.id === id} onSelect={() => onSelect({ kind: 'item', id })} />;
  };
  return <div ref={ref} className={`item-zone ${isDropTarget ? 'drop-target' : ''}`} data-testid={tier ? 'tier-items' : 'unranked-items'}>
    {!tier && ids.length >= 100 ? <VirtualTray ids={ids} renderItem={renderItem} /> : ids.map(renderItem)}
    {ids.length === 0 && <span className="tier-empty">{(tier?.itemIds.length ?? project.unrankedItemIds.length) ? h.noResults : tier ? tier.locked ? t.locked : t.emptyTier : ''}</span>}
  </div>;
}

function TierRow({ tier, index, project, visible, selection, onSelect }: { tier: Tier; index: number; project: Project; visible: Set<string>; selection: Selection; onSelect: (selection: Selection) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useEditor((state) => state.dispatch);
  const draggable = useDraggable({ id: tier.id, type: 'tier', disabled: tier.locked });
  const drop = useDroppable({ id: `tier:${tier.id}`, accept: 'tier', disabled: draggable.isDragSource });
  const selected = selection.kind === 'tier' && selection.id === tier.id;
  return <section aria-label={t.tierRegion(tier.name)} style={{ '--tier-height': `${Math.min(400, tier.minHeight ?? 104)}px`, ...(tier.labelWidth ? { '--tier-label': `${tier.labelWidth}px` } : {}) } as CSSProperties} ref={(node) => { draggable.ref(node); drop.ref(node); }}
    data-dragging={draggable.isDragging || draggable.isDropping} className={`tier-row ${selected ? 'selected' : ''} ${drop.isDropTarget ? 'drop-target' : ''} ${collapsed ? 'collapsed' : ''}`}>
    <div className="tier-label" style={{ backgroundColor: tier.background, color: tier.foreground }}>
      <button ref={draggable.handleRef} className="tier-grip" disabled={tier.locked} aria-label={t.dragTier(tier.name)} title={t.dragTier(tier.name)}><Icon name="grip" size={16} /></button>
      <button className="tier-name" aria-label={t.editTier(tier.name)} aria-pressed={selected} onClick={() => onSelect({ kind: 'tier', id: tier.id })}><span>{tier.name}</span>{tier.locked && <Icon name="lock" size={13} />}</button>
    </div>
    {collapsed ? <div className="collapsed-content">{t.collapsed}<span className="count">{t.itemCount(tier.itemIds.length)}</span></div>
      : <ItemZone project={project} ids={tier.itemIds.filter((id) => visible.has(id))} tier={tier} selection={selection} onSelect={onSelect} />}
    <div className="tier-tools">
      <button className="icon-button" disabled={tier.locked || index === 0} aria-label={t.up} title={t.up} onClick={() => dispatch({ type: 'tier.move', id: tier.id, index: index - 1 }, t.moved)}><Icon name="up" size={15} /></button>
      <button className="icon-button" disabled={tier.locked || index === project.tiers.length - 1} aria-label={t.down} title={t.down} onClick={() => dispatch({ type: 'tier.move', id: tier.id, index: index + 1 }, t.moved)}><Icon name="down" size={15} /></button>
      <button className="icon-button fold-button" aria-label={collapsed ? t.expand : t.collapse} aria-expanded={!collapsed} title={collapsed ? t.expand : t.collapse} onClick={() => setCollapsed(!collapsed)}><Icon name={collapsed ? 'plus' : 'layers'} size={14} /></button>
    </div>
  </section>;
}

export function Board({ onSelect, onAddText, onAddTier, onAddImages }: { onSelect: (selection: Selection) => void; onAddText: () => void; onAddTier: () => void; onAddImages: () => void }) {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  const query = useEditor((state) => state.query), tags = useEditor((state) => state.filterTags);
  const zoom = useEditor((state) => state.zoom), grid = useEditor((state) => state.grid);
  const visible = useMemo(() => new Set(matchingIds(project, query, tags)), [project, query, tags]);
  const viewport = useRef<HTMLDivElement>(null), [viewportWidth, setViewportWidth] = useState(0);
  useLayoutEffect(() => {
    const element = viewport.current; if (!element) return;
    const measure = () => setViewportWidth(Math.max(1, element.clientWidth - 6));
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);
  const style = resolveStyle(project.style);
  const backgroundUrl = useAssetUrl(style.backgroundMode === 'image' ? style.backgroundAssetId : null);
  return <><EditingTools /><div ref={viewport} className="board-viewport" role="region" aria-label={t.board} tabIndex={0}><div className={`design-surface ${grid ? 'editing-grid' : ''}`} style={{ ...appearance(project.style, backgroundUrl), zoom: zoom / 100, width: viewportWidth || undefined }}>
    <div className={`canvas-heading title-${style.titleDecoration}`} style={{ textAlign: style.titleAlign }}><div className={!style.showTitle ? 'visually-hidden' : ''}><span className="eyebrow">{t.board}</span><h1 id="board-heading" tabIndex={-1}>{project.title}</h1>{project.description && <p className="project-description">{project.description}</p>}</div>
      <button className="icon-button" onClick={() => onSelect({ kind: 'project' })} aria-label={t.projectSettings} title={t.projectSettings}><Icon name="settings" /></button>
    </div>
    <div className="board-meta"><span>{t.boardHint}</span><span>{t.tierCount(project.tiers.length)}<span className="meta-divider">/</span>{t.itemCount(Object.keys(project.items).length)}</span></div>
    <div className="tier-board" aria-label={t.board}>
      {project.tiers.map((tier, index) => <TierRow key={tier.id} tier={tier} index={index} project={project} visible={visible} selection={selection} onSelect={onSelect} />)}
      {project.tiers.length === 0 && <div className="empty-board"><Icon name="layers" size={30} /><h2>{t.noTiers}</h2><p>{t.noTiersHint}</p></div>}
    </div>
    <button className="add-tier-row" onClick={onAddTier}><Icon name="plus" size={16} />{t.addTier}</button>
    <section className="unranked" aria-label={t.unrankedItems}>
      <div className="tray-heading"><h2>{t.unrankedItems}<span className="count">{project.unrankedItemIds.length}</span></h2><div className="tray-actions"><button className="button primary small" onClick={onAddImages}><Icon name="plus" size={16} />{s.images}</button><button className="button secondary small" onClick={onAddText}><Icon name="text" size={16} />{t.addText}</button></div></div>
      <div className={project.unrankedItemIds.length ? 'tray-content' : 'tray-content empty'}>
        <ItemZone project={project} ids={project.unrankedItemIds.filter((id) => visible.has(id))} selection={selection} onSelect={onSelect} />
        {project.unrankedItemIds.length === 0 && <div className="empty-tray"><span className="empty-icon"><Icon name="text" size={24} /></span><div><h3>{t.emptyTray}</h3><p>{t.emptyTrayHint}</p></div></div>}
      </div>
    </section>
  </div></div></>;
}
