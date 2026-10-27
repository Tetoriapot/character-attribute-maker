import { useEditor } from '../stores/editorStore';
import type { Selection } from '../data/types';
import { t } from '../app/messages';
import { Icon } from './Icon';
import { d } from '../app/designMessages';

export function Sidebar({ onSelect, onAddTier, onAddText }: { onSelect: (selection: Selection) => void; onAddTier: () => void; onAddText: () => void }) {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  return <div className="sidebar-content">
    <button className={`project-nav ${selection.kind === 'project' ? 'active' : ''}`} onClick={() => onSelect({ kind: 'project' })}><Icon name="layers" /><span>{t.projectSettings}</span><Icon name="settings" size={15} /></button>
    <button className={`project-nav ${selection.kind === 'design' ? 'active' : ''}`} onClick={() => onSelect({ kind: 'design' })}><Icon name="settings" /><span>{d.title}</span></button>
    <div className="sidebar-section"><div className="section-heading"><h2>{t.tierList}</h2><span className="count">{project.tiers.length}</span></div>
      <div className="tier-nav-list">{project.tiers.map((tier, index) => <button key={tier.id} className={`tier-nav ${selection.kind === 'tier' && selection.id === tier.id ? 'active' : ''}`} aria-pressed={selection.kind === 'tier' && selection.id === tier.id} onClick={() => onSelect({ kind: 'tier', id: tier.id })}>
        <span className="tier-number">{String(index + 1).padStart(2, '0')}</span><span className="tier-swatch" style={{ backgroundColor: tier.background }} /><span className="tier-nav-name">{tier.name}</span>{tier.locked && <Icon name="lock" size={13} />}<span className="tier-nav-count">{tier.itemIds.length}</span>
      </button>)}</div>
      <button className="button outline full" onClick={onAddTier}><Icon name="plus" size={16} />{t.addTier}</button>
    </div>
    <div className="sidebar-section"><div className="section-heading"><h2>{t.items}</h2><span className="count">{Object.keys(project.items).length}</span></div>
      <button className="add-item-button" onClick={onAddText}><span className="text-icon"><Icon name="text" size={21} /></span><span>{t.textItem}</span><Icon name="plus" size={17} /></button><p className="field-hint">{t.textOnlyNotice}</p>
    </div>
    <div className="storage-note"><Icon name="info" size={18} /><div><h3>{t.storageTitle}</h3><p>{t.storageNotice}</p></div></div>
    <div className="sidebar-footer"><span>{t.brand}</span><span>v0.7</span></div>
  </div>;
}
