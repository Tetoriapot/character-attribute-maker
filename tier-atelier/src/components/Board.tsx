import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/react';
import type { Item, Project, Selection, Tier } from '../data/types';
import { useEditor } from '../stores/editorStore';
import { Icon } from './Icon';
import { t } from '../app/messages';
import { storageText as s } from '../app/storageMessages';

export function ItemCard({ item, selected, locked, onSelect }: { item: Item; selected: boolean; locked?: boolean; onSelect: () => void }) {
  const thumbnail = useEditor((state) => item.assetId ? state.thumbnails[item.assetId] : undefined);
  const draggable = useDraggable({ id: item.id, type: 'item', disabled: locked });
  const drop = useDroppable({ id: `item:${item.id}`, accept: 'item', disabled: locked || draggable.isDragSource, collisionPriority: 2 });
  return <div ref={(node) => { draggable.ref(node); drop.ref(node); }}
    data-dragging={draggable.isDragging || draggable.isDropping} className={`item-card ${selected ? 'selected' : ''} ${drop.isDropTarget ? 'drop-target' : ''}`}>
    <button type="button" className="item-select" onClick={onSelect} aria-label={t.editItem(item.name)} aria-pressed={selected} title={item.name}>
      {thumbnail ? <img className="item-thumbnail" src={thumbnail} alt="" loading="lazy" draggable={false} /> : <span className="item-initial" aria-hidden="true">{Array.from(item.name)[0]}</span>}<span className="item-name">{item.name}</span>
    </button>
    <button ref={draggable.handleRef} type="button" className="item-grip" disabled={locked} aria-label={t.dragItem(item.name)} title={t.dragItem(item.name)}><Icon name="grip" size={14} /></button>
  </div>;
}

function ItemZone({ project, ids, tier, selection, onSelect }: { project: Project; ids: string[]; tier?: Tier; selection: Selection; onSelect: (selection: Selection) => void }) {
  const { ref, isDropTarget } = useDroppable({ id: `zone:${tier?.id ?? 'unranked'}`, accept: 'item', disabled: tier?.locked, collisionPriority: 1 });
  return <div ref={ref} className={`item-zone ${isDropTarget ? 'drop-target' : ''}`} data-testid={tier ? 'tier-items' : 'unranked-items'}>
    {ids.map((id) => {
      const item = project.items[id];
      return item && <ItemCard key={id} item={item} locked={tier?.locked} selected={selection.kind === 'item' && selection.id === id} onSelect={() => onSelect({ kind: 'item', id })} />;
    })}
    {ids.length === 0 && tier && <span className="tier-empty">{tier.locked ? t.locked : t.emptyTier}</span>}
  </div>;
}

function TierRow({ tier, index, project, selection, onSelect }: { tier: Tier; index: number; project: Project; selection: Selection; onSelect: (selection: Selection) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const dispatch = useEditor((state) => state.dispatch);
  const draggable = useDraggable({ id: tier.id, type: 'tier', disabled: tier.locked });
  const drop = useDroppable({ id: `tier:${tier.id}`, accept: 'tier', disabled: draggable.isDragSource });
  const selected = selection.kind === 'tier' && selection.id === tier.id;
  return <section aria-label={t.tierRegion(tier.name)} ref={(node) => { draggable.ref(node); drop.ref(node); }}
    data-dragging={draggable.isDragging || draggable.isDropping} className={`tier-row ${selected ? 'selected' : ''} ${drop.isDropTarget ? 'drop-target' : ''} ${collapsed ? 'collapsed' : ''}`}>
    <div className="tier-label" style={{ backgroundColor: tier.background, color: tier.foreground }}>
      <button ref={draggable.handleRef} className="tier-grip" disabled={tier.locked} aria-label={t.dragTier(tier.name)} title={t.dragTier(tier.name)}><Icon name="grip" size={16} /></button>
      <button className="tier-name" aria-label={t.editTier(tier.name)} aria-pressed={selected} onClick={() => onSelect({ kind: 'tier', id: tier.id })}><span>{tier.name}</span>{tier.locked && <Icon name="lock" size={13} />}</button>
    </div>
    {collapsed ? <div className="collapsed-content">{t.collapsed}<span className="count">{t.itemCount(tier.itemIds.length)}</span></div>
      : <ItemZone project={project} ids={tier.itemIds} tier={tier} selection={selection} onSelect={onSelect} />}
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
  return <>
    <div className="canvas-heading"><div><span className="eyebrow">{t.board}</span><h1 id="board-heading" tabIndex={-1}>{project.title}</h1>{project.description && <p className="project-description">{project.description}</p>}</div>
      <button className="icon-button" onClick={() => onSelect({ kind: 'project' })} aria-label={t.projectSettings} title={t.projectSettings}><Icon name="settings" /></button>
    </div>
    <div className="board-meta"><span>{t.boardHint}</span><span>{t.tierCount(project.tiers.length)}<span className="meta-divider">/</span>{t.itemCount(Object.keys(project.items).length)}</span></div>
    <div className="tier-board" aria-label={t.board}>
      {project.tiers.map((tier, index) => <TierRow key={tier.id} tier={tier} index={index} project={project} selection={selection} onSelect={onSelect} />)}
      {project.tiers.length === 0 && <div className="empty-board"><Icon name="layers" size={30} /><h2>{t.noTiers}</h2><p>{t.noTiersHint}</p></div>}
    </div>
    <button className="add-tier-row" onClick={onAddTier}><Icon name="plus" size={16} />{t.addTier}</button>
    <section className="unranked" aria-label={t.unrankedItems}>
      <div className="tray-heading"><h2>{t.unrankedItems}<span className="count">{project.unrankedItemIds.length}</span></h2><div className="tray-actions"><button className="button primary small" onClick={onAddImages}><Icon name="plus" size={16} />{s.images}</button><button className="button secondary small" onClick={onAddText}><Icon name="text" size={16} />{t.addText}</button></div></div>
      <div className={project.unrankedItemIds.length ? 'tray-content' : 'tray-content empty'}>
        <ItemZone project={project} ids={project.unrankedItemIds} selection={selection} onSelect={onSelect} />
        {project.unrankedItemIds.length === 0 && <div className="empty-tray"><span className="empty-icon"><Icon name="text" size={24} /></span><div><h3>{t.emptyTray}</h3><p>{t.emptyTrayHint}</p></div></div>}
      </div>
    </section>
  </>;
}
